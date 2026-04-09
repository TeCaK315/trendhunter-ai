// src/app/api/synthesis/route.ts
//
// Движок синтеза. Собирает всё в один SSE поток.
//
// Порядок выполнения:
// 1. Auth + проверка монет
// 2. Читаем блоки из Supabase (не с фронта — защита от подмены)
// 3. Conflict Detection + fetchExternalContext ПАРАЛЛЕЛЬНО
// 4. Скептик (Sonnet или Opus если Blind Spot)
// 5. Оптимист (Sonnet)
// 6. Арбитр (Opus)
// 7. Сохраняем результат + списываем монеты

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth-helpers";
import { getServerSupabase } from "@/lib/supabase";
import { detectConflicts } from "@/lib/synthesis/conflict-detection";
import { buildSkepticPrompt } from "@/lib/synthesis/prompts/skeptic";
import { buildOptimistPrompt } from "@/lib/synthesis/prompts/optimist";
import { buildArbitratorPrompt } from "@/lib/synthesis/prompts/arbitrator";
import { BlockOutput, SkepticOutput, OptimistOutput } from "@/types/analysis";
import { calculateStrategicDelta, getUpliftLevel } from "@/lib/synthesis/delta";
import { runSalesArchitect } from "@/lib/synthesis/prompts/sales-architect";

const claude = new Anthropic();

const SYNTHESIS_COST = 20; // монет

const MODELS = {
  opus: "claude-opus-4-6",
  sonnet: "claude-sonnet-4-6",
  haiku: "claude-haiku-4-5-20251001",
};

// —— ВНЕШНИЙ КОНТЕКСТ ————————————————————————————————
// Новости за 90 дней — регуляторика + большие игроки
// Запускается параллельно с Conflict Detection
async function fetchExternalContext(niche: string): Promise<string> {
  try {
    const queries = [
      `"${niche}" market 2025 challenges risks competition`,
      `"${niche}" regulation law ban 2025 2026`,
    ];

    const results = await Promise.all(
      queries.map(
        (q) =>
          fetch(
            `https://serpapi.com/search?q=${encodeURIComponent(q)}&tbm=nws&num=5&api_key=${process.env.SERPAPI_KEY}`,
          )
            .then((r) => r.json())
            .then(
              (d) =>
                (d.news_results as any[])
                  ?.slice(0, 5)
                  .map((n) => `${n.title}: ${n.snippet}`)
                  .join("\n") || "",
            )
            .catch(() => ""), // не ломаем синтез если новости недоступны
      ),
    );

    const combined = results.filter(Boolean).join("\n");
    return combined || "Внешний контекст недоступен";
  } catch {
    return "Внешний контекст недоступен";
  }
}

// —— ВЫЗОВ CLAUDE С ВАЛИДНЫМ JSON БЕЗ СТРИМОВ ——————————————————
// System промпт требует чистый JSON.
// Retry до 2 раз если парсинг упал.
async function callClaude(
  prompt: string,
  model: "opus" | "sonnet" = "sonnet",
  retries = 2,
): Promise<any> {
  const modelId = MODELS[model];

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await claude.messages.create({
        model: modelId,
        max_tokens: 1500,
        system:
          "Отвечай только валидным JSON без markdown, без пояснений, без блоков кода. Только чистый JSON объект.",
        messages: [{ role: "user", content: prompt }],
      });

      const text =
        response.content[0].type === "text"
          ? response.content[0].text.trim()
          : "";

      // Убираем остатки markdown если Claude всё же добавил
      const cleaned = text
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      return JSON.parse(cleaned);
    } catch (e) {
      if (attempt === retries) {
        throw new Error(
          `JSON parse failed after ${retries + 1} attempts: ${e}`,
        );
      }
      // Пауза перед retry
      await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
    }
  }
}

// —— ОСНОВНОЙ РОУТ ——————————————————————————————————————
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Хелпер для отправки SSE событий
      // Эскейпим non-ASCII символы в \uXXXX чтобы избежать проблем
      // с разрезанием многобайтовых UTF-8 символов между чанками
      function escapeUnicode(str: string): string {
        return str.replace(/[^\x00-\x7F]/g, (ch) => {
          const code = ch.codePointAt(0)!;
          if (code > 0xFFFF) {
            // surrogate pair for characters outside BMP
            const offset = code - 0x10000;
            const hi = 0xD800 + (offset >> 10);
            const lo = 0xDC00 + (offset & 0x3FF);
            return `\\u${hi.toString(16).padStart(4, '0')}\\u${lo.toString(16).padStart(4, '0')}`;
          }
          return `\\u${code.toString(16).padStart(4, '0')}`;
        });
      }

      function send(event: string, data: object) {
        const jsonStr = escapeUnicode(JSON.stringify(data));
        const chunk = `event: ${event}\ndata: ${jsonStr}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      }

      try {
        // —— 1. АВТОРИЗАЦИЯ ——————————————————————————————
        const user = await getAuthUser();
        if (!user) {
          send("error", { message: "Unauthorized" });
          controller.close();
          return;
        }
        const supabase = getServerSupabase();

        // —— 2. ПРОВЕРКА БАЛАНСА ————————————————————————
        const { data: credits } = await supabase
          .from("user_credits")
          .select("balance")
          .eq("user_id", user.id)
          .single();

        if (!credits || credits.balance < SYNTHESIS_COST) {
          send("error", {
            message: "Недостаточно монет",
            required: SYNTHESIS_COST,
            current: credits?.balance ?? 0,
          });
          controller.close();
          return;
        }

        // —— 3. ЧИТАЕМ ВХОДНЫЕ ДАННЫЕ ———————————————————
        const { trend_id, niche } = (await req.json()) as {
          trend_id: string;
          niche: string;
        };

        if (!trend_id || !niche) {
          send("error", { message: "Нужны trend_id и niche" });
          controller.close();
          return;
        }

        // —— 4. ЧИТАЕМ БЛОКИ ИЗ SUPABASE ————————————————
        // Блоки живут на сервере — фронт не передаёт данные напрямую.
        // Защита от подмены + работает при возврате через день.
        send("status", {
          step: "loading",
          message: "Загружаю результаты блоков...",
        });

        const { data: blockRows, error: blockError } = await supabase
          .from("block_results")
          .select("*")
          .eq("trend_id", trend_id)
          .eq("user_id", user.id)
          .order("block_number");

        if (blockError || !blockRows || blockRows.length < 6) {
          send("error", {
            message: "Не все блоки завершены",
            completed: blockRows?.length ?? 0,
            required: 6,
          });
          controller.close();
          return;
        }

        const blocks: BlockOutput[] = blockRows.map((r: any) => ({
          block_number: r.block_number,
          block_type: r.block_type,
          diagnosis: r.diagnosis,
          score: r.score,
          conflict_weight: r.conflict_weight,
          key_factors: r.key_factors,
          key_metric: r.key_metric,
          block_context: r.block_context,
        }));

        // —— 5. СПИСЫВАЕМ МОНЕТЫ ————————————————————————
        // До запуска агентов — стандарт: нельзя прервать и получить бесплатно
        await supabase
          .from("user_credits")
          .update({ balance: credits.balance - SYNTHESIS_COST })
          .eq("user_id", user.id);

        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: -SYNTHESIS_COST,
          type: "spend",
          description: `AI Синтез: ${niche}`,
          trend_id,
        });

        // —— 6. CONFLICT DETECTION + ВНЕШНИЙ КОНТЕКСТ ————
        // Параллельно — экономим 3-5 секунд.
        // detectConflicts синхронный но оборачиваем для Promise.all.
        send("status", {
          step: "conflicts",
          message: "Анализирую конфликты между блоками...",
        });

        const [conflicts, externalContext] = await Promise.all([
          Promise.resolve(detectConflicts(blocks)),
          fetchExternalContext(niche),
        ]);

        send("conflicts", { conflicts });

        // —— 6.5 #14: FORCE EXPERIMENT CHECK ———————————————
        // Если Блок 2 не уверен в данных — принудительный EXPERIMENT
        const block2 = blocks.find(b => b.block_number === 2);
        const block2ForceExperiment = block2?.block_context?.force_experiment_by_confidence ?? false;
        const block2ConfidenceScore = block2?.block_context?.demand_confidence_score ?? 0.5;

        let forceExperimentDemand = '';
        if (block2ForceExperiment) {
          forceExperimentDemand = `Уверенность в данных Блока 2 ограничена (${typeof block2ConfidenceScore === 'number' ? block2ConfidenceScore.toFixed(2) : '?'}). Принудительно EXPERIMENT — требуется валидация.`;
          console.log(`[Synthesis] Force experiment: demand confidence too low (${block2ConfidenceScore})`);
        }

        // —— 7. СКЕПТИК ——————————————————————————————————
        // Sonnet если есть реальные конфликты.
        // Opus если Blind Spot — там нужен более широкий контекст.
        send("status", {
          step: "skeptic",
          message: "Скептик анализирует риски...",
        });

        const isBlindSpot = conflicts[0]?.type === "none";
        const skepticModel = isBlindSpot ? "opus" : "sonnet";
        const skepticExternalContext = forceExperimentDemand
          ? `${externalContext}\n\n⚠️ FORCE EXPERIMENT: ${forceExperimentDemand}`
          : externalContext;
        const skepticPrompt = buildSkepticPrompt(
          niche,
          blocks,
          conflicts,
          skepticExternalContext,
        );
        const skepticOutput: SkepticOutput = await callClaude(
          skepticPrompt,
          skepticModel,
        );
        send("skeptic", { output: skepticOutput });

        // —— 8. ОПТИМИСТ —————————————————————————————————
        // Получает конфликты + вывод Скептика.
        // Ищет условия нейтрализации — не опровергает.
        send("status", {
          step: "optimist",
          message: "Оптимист ищет условия GO...",
        });

        const optimistPrompt = buildOptimistPrompt(
          niche,
          blocks,
          conflicts,
          skepticOutput,
        );
        const optimistOutput: OptimistOutput = await callClaude(
          optimistPrompt,
          "sonnet",
        );
        send("optimist", { output: optimistOutput });

        // —— 9. АРБИТР ———————————————————————————————————
        // Opus — самый дорогой и важный шаг.
        // Выносит условный вердикт и три приоритетных действия.
        send("status", {
          step: "arbitrator",
          message: "Арбитр выносит вердикт...",
        });

        const arbitratorPrompt = buildArbitratorPrompt(
          niche,
          blocks,
          conflicts,
          skepticOutput,
          optimistOutput,
        );
        const arbitratorOutput = await callClaude(arbitratorPrompt, "opus");
        send("arbitrator", { output: arbitratorOutput });

        // —— 9.5 STRATEGIC DELTA + SALES ARCHITECT ————————
        send("status", { step: "delta", message: "Рассчитываю стратегический разрыв..." });

        let strategicDelta = null;
        let salesText = '';

        try {
          const b4ctx = blocks.find(b => b.block_number === 4)?.block_context as any || {};
          const b5ctx = blocks.find(b => b.block_number === 5)?.block_context as any || {};
          const b6ctx = blocks.find(b => b.block_number === 6)?.block_context as any || {};

          strategicDelta = calculateStrategicDelta(blocks, arbitratorOutput.verdict_type, arbitratorOutput.confidence);

          if (strategicDelta?.show) {
            const topOpenGap = (b4ctx.gap_map || [])
              .filter((g: any) => g.status === 'open')
              .sort((a: any, b: any) => (b.paying_ratio || 0) - (a.paying_ratio || 0))[0]?.pain ?? 'не определена';

            salesText = await runSalesArchitect(claude, {
              niche,
              verdict_type: arbitratorOutput.verdict_type,
              confidence_percent: Math.round(arbitratorOutput.confidence * 100),
              cac_mid: b5ctx.cac_mid ?? b5ctx.cac_scenarios?.[(b5ctx.cac_scenarios?.recommended || 'seo_led').toLowerCase()]?.mid ?? null,
              acquisition_type: b4ctx.acquisition_type ?? 'UNKNOWN',
              months_to_first_revenue: b5ctx.months_to_first_revenue ?? 6,
              main_economic_risk: b5ctx.main_economic_risk ?? '',
              avg_switching_cost: b4ctx.avg_switching_cost ?? 'MEDIUM',
              top_open_gap: topOpenGap,
              first_spot_teaser: b6ctx.first_spot_teaser ?? null,
              uplift_level: getUpliftLevel(strategicDelta.uplift_multiplier),
            });

            send("strategic_delta", { delta: strategicDelta, sales_text: salesText });
          }
        } catch (e) {
          console.error('[Synthesis] Strategic Delta error:', e);
        }

        // —— 10. СОХРАНЯЕМ РЕЗУЛЬТАТ ——————————————————————
        const { error: saveError } = await supabase
          .from("synthesis_results")
          .upsert({
            trend_id,
            user_id: user.id,
            niche,
            conflicts,
            skeptic: skepticOutput,
            optimist: optimistOutput,
            arbitrator: arbitratorOutput,
            strategic_delta: strategicDelta,
            sales_text: salesText,
            bridge_text: arbitratorOutput.bridge_text ?? '',
            is_blind_spot: isBlindSpot,
            created_at: new Date().toISOString(),
          }, { onConflict: 'trend_id,user_id' });

        if (saveError) {
          console.error('[Synthesis] SAVE FAILED:', saveError);
          send("error", {
            message: `Синтез выполнен, но не сохранён: ${saveError.message}`,
            step: "save",
            code: saveError.code,
          });
          controller.close();
          return;
        }

        // Финальное событие — фронт знает что всё готово
        send("complete", {
          synthesis_id: `${trend_id}_${user.id}`,
          verdict_type: arbitratorOutput.verdict_type,
          confidence: arbitratorOutput.confidence,
          coins_spent: SYNTHESIS_COST,
        });
      } catch (error: any) {
        send("error", {
          message: error.message || "Неизвестная ошибка синтеза",
          step: "unknown",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
