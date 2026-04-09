// src/app/api/evidence/blind-spots/route.ts
// Блок 6 — Слепые пятна
// Главный вопрос: "Что в этом рынке не видит никто кроме тебя?"
//
// МЕХАНИКА МОНЕТИЗАЦИИ:
// - 3-5 пятен генерируются один раз (статично в raw_data)
// - Пятно 1 бесплатно сразу (public layer)
// - Пятна 2-N: по одному в день ИЛИ все за 5 токенов
// - Синтез знает о пятнах но не раскрывает их (только meta)
//
// ПРАВКИ vs первая версия:
// #1 insert → upsert с ignoreDuplicates (duplicate key при повторном запросе)
// #2 ux_bug убран из lockin_opportunity (UX ≠ switching cost)
// #3 conflict_weight добавлен в output и upsert
// #4 key_factors добавлены в upsert

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth-helpers";
import { getServerSupabase } from "@/lib/supabase";

const claude = new Anthropic();

const BLOCK_COST = { public: 0, unlock_all: 5 } as const;

// ——————————————————————————————————————————————————————————
// ТИПЫ
// ——————————————————————————————————————————————————————————

type BlindSpotType =
  | "unserved_segment" // есть аудитория без решения
  | "pricing_gap" // ценовая модель устарела
  | "tech_shift" // технологический сдвиг не освоен
  | "intent_mismatch" // люди ищут но не покупают — почему?
  | "lockin_opportunity"; // конкуренты держат пользователей в ловушке

type BlindSpotImpact = "high" | "medium" | "low";

interface BlindSpot {
  index: number; // 0 = бесплатно, 1+ = платно/по дням
  type: BlindSpotType;
  title: string; // короткий заголовок (Sonnet)
  insight: string; // полный текст инсайта (Sonnet)
  teaser: string; // одно предложение без деталей (для locked)
  impact: BlindSpotImpact;
  data_signals: string[]; // какие данные из блоков 1-5 привели к этому
  confidence: 'high' | 'medium' | 'low'; // Multi-Pass: из upstream data quality
  depends_on_blocks: number[];             // какие блоки использованы (1-5)
}

interface BlindSpotsBlockContext {
  // Для Синтеза — только мета, без деталей пятен
  blind_spots_count: number;
  blind_spots_types: BlindSpotType[];
  blind_spots_impact: BlindSpotImpact;
  first_spot_teaser: string;
  has_revenue_multiplier: boolean; // true если пятна меняют revenue estimate
  conflict_weight: 1 | 2 | 3; // #3: для Синтеза Conflict Detection
  // Multi-Pass: data quality
  data_quality: {
    upstream_blocks_available: number;
    upstream_confidence: Record<number, 'high' | 'medium' | 'low' | 'unknown'>;
    spots_with_high_confidence: number;
    spots_with_low_confidence: number;
    overall_confidence: 'high' | 'medium' | 'low';
  };
}

// ——————————————————————————————————————————————————————————
// ДЕТЕРМИНИРОВАННОЕ ОПРЕДЕЛЕНИЕ ТИПОВ
// Из данных блоков 1-5 — без GPT
// ——————————————————————————————————————————————————————————

function detectBlindSpotTypes(
  b1: any,
  b2: any,
  b3: any,
  b4: any,
  b5: any,
): {
  type: BlindSpotType;
  signals: string[];
  strength: number;
  impact: BlindSpotImpact;
  depends_on_blocks: number[]; // Multi-Pass: какие блоки использованы
}[] {
  const candidates: {
    type: BlindSpotType;
    signals: string[];
    strength: number;
    impact: BlindSpotImpact;
    depends_on_blocks: number[];
  }[] = [];

  // paying_users_ratio приходит из Block 1 как процент (0-100), нормализуем в 0-1
  const rawPayingRatio = b1?.paying_users_ratio || 0;
  const payingRatio = rawPayingRatio > 1 ? rawPayingRatio / 100 : rawPayingRatio;
  const commercialIntent = b2?.commercial_intent_ratio || 0;
  const demandIndex = b2?.demand_index || 0;
  const risingQueriesRatio = b2?.rising_queries_ratio || 0;
  const hasHypeRisk = b2?.has_hype_risk || false;
  const topGapCategory = b4?.top_gap_category || null;
  const hasStrategicGap = b4?.has_strategic_gap || false;
  const priceConfidence = b3?.price_range?.confidence || "low";
  const topCompetitorSize = b4?.top_competitor_size || null;
  const topCompetitor = b4?.top_competitor || "unknown";
  const gapType = b4?.gap_type || "none";

  // 1. UNSERVED SEGMENT
  // Высокий commercial_intent + низкий paying_ratio = люди хотят платить но не находят решение
  if (commercialIntent > 0.6 && payingRatio < 0.3) {
    candidates.push({
      type: "unserved_segment",
      signals: [
        `Высокий коммерческий интент: ${(commercialIntent * 100).toFixed(0)}%`,
        `Низкая доля платящих: ${(payingRatio * 100).toFixed(0)}%`,
        "Разрыв между спросом и платежами — недообслуженный сегмент",
      ],
      strength: commercialIntent - payingRatio,
      impact: "high",
      depends_on_blocks: [1, 2], // paying_ratio из Б1, commercial_intent из Б2
    });
  }

  // 2. PRICING GAP
  // Топ жалоба = pricing_model + strategic gap = рынок устал от текущей модели
  if (
    topGapCategory === "pricing_model" &&
    hasStrategicGap &&
    priceConfidence !== "low"
  ) {
    const medianPrice = b3?.price_range?.median || 0;
    candidates.push({
      type: "pricing_gap",
      signals: [
        "Топ жалоба конкурентов: ценовая модель",
        `Текущий рыночный консенсус: $${medianPrice}/месяц`,
        "Никто не тестировал альтернативные модели монетизации",
      ],
      strength: 0.85,
      impact: "high",
      depends_on_blocks: [3, 4], // цены из Б3, жалобы из Б4
    });
  }

  // 3. TECH SHIFT
  // rising_queries_ratio > 40% без хайпа = органический технологический сдвиг
  if (risingQueriesRatio > 0.4 && !hasHypeRisk) {
    candidates.push({
      type: "tech_shift",
      signals: [
        `Новые запросы: ${(risingQueriesRatio * 100).toFixed(0)}% от всех`,
        "Органический рост без хайп-сигналов",
        "Конкуренты используют подходы прошлого поколения",
      ],
      strength: risingQueriesRatio,
      impact: "high",
      depends_on_blocks: [2], // rising_queries из Б2
    });
  }

  // 4. INTENT MISMATCH
  // Спрос есть но commercial_intent низкий = возможность переформатировать предложение
  // Взаимоисключает с unserved_segment (тот требует intent > 0.6)
  if (demandIndex > 30 && commercialIntent < 0.45) {
    candidates.push({
      type: "intent_mismatch",
      signals: [
        `Объём спроса: ${demandIndex}`,
        `Коммерческий интент: ${(commercialIntent * 100).toFixed(0)}%`,
        "Люди ищут решение проблемы но не видят подходящее предложение",
      ],
      strength: demandIndex / 100,
      impact: "medium",
      depends_on_blocks: [2], // demand_index и commercial_intent из Б2
    });
  }

  // 5. LOCK-IN OPPORTUNITY
  // #2 FIX: убран ux_bug — UX проблема ≠ switching cost
  // integration, missing_feature, support — указывают на lock-in
  // support добавлен: плохая поддержка при высоких switching costs = ловушка
  const hasLockinComplaints =
    ["integration", "missing_feature", "support"].includes(topGapCategory || "") &&
    gapType !== "none";

  if ((topCompetitorSize === "large" || topCompetitorSize === "medium") && hasLockinComplaints) {
    candidates.push({
      type: "lockin_opportunity",
      signals: [
        `Крупный конкурент: ${topCompetitor}`,
        `Стратегический gap: ${topGapCategory}`,
        "Пользователи застряли из-за интеграций — открытое позиционирование как выход",
      ],
      strength: 0.8,
      impact: "medium",
      depends_on_blocks: [4], // gap данные из Б4
    });
  }

  // Сортируем по силе сигнала, берём топ 3-5
  return candidates.sort((a, b) => b.strength - a.strength).slice(0, 5);
}

// ——————————————————————————————————————————————————————————
// SONNET: ФОРМУЛИРУЕТ ИНСАЙТ ДЛЯ КОНКРЕТНОГО, НЕ ДЛЯ ДЕТЕКЦИИ
// ——————————————————————————————————————————————————————————

async function formulateBlindSpot(
  type: BlindSpotType,
  signals: string[],
  niche: string,
): Promise<{ title: string; insight: string; teaser: string }> {
  const typeDescriptions: Record<BlindSpotType, string> = {
    unserved_segment:
      "недообслуженный сегмент рынка который явно хочет платить но не находит решения",
    pricing_gap: "устаревшая ценовая модель которую никто не решается изменить",
    tech_shift:
      "технологический или поведенческий сдвиг который конкуренты не освоили",
    intent_mismatch:
      "разрыв между тем что ищут люди и тем что предлагают конкуренты",
    lockin_opportunity:
      "пользователи застряли у конкурента благодаря интеграциям и switching cost",
  };

  try {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 450,
      system:
        "Ты аналитик рынка. Пиши как умный наблюдатель, не как маркетолог. Фокусируйся на данных и противоречиях. Коротко и неожиданно.",
      messages: [
        {
          role: "user",
          content: `Ниша: ${niche}

Тип слепого пятна: ${typeDescriptions[type]}

Сигналы из анализа:
- ${signals.join("\n- ")}

Напиши инсайт который:
1. Начинается с неожиданного или противоречивого факта из данных
2. Объясняет почему это упускают остальные участники рынка
3. Намекает на возможность БЕЗ готового ответа (интрига важнее решения)

Верни JSON:
{
  "title": "3-5 слов, заголовок пятна (не вопрос, не список)",
  "insight": "2-3 предложения, полный инсайт с конкретикой",
  "teaser": "одно предложение — интрига без раскрытия детали"
}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);
      return {
        title: parsed.title || type,
        insight: parsed.insight || "",
        teaser: parsed.teaser || "Обнаружен неочевидный паттерн в этой нише.",
      };
    } catch {
      return {
        title: type,
        insight: "",
        teaser: "Обнаружен неочевидный паттерн в этой нише.",
      };
    }
  } catch (error) {
    console.error("[formulateBlindSpot] Sonnet error:", error);
    return {
      title: type,
      insight: "",
      teaser: "Обнаружен неочевидный паттерн в этой нише.",
    };
  }
}

// ——————————————————————————————————————————————————————————
// ГЕНЕРАЦИЯ ВСЕХ ПЯТЕН (параллельно через Promise.all)
// ——————————————————————————————————————————————————————————

async function generateBlindSpots(
  candidates: {
    type: BlindSpotType;
    signals: string[];
    strength: number;
    impact: BlindSpotImpact;
    depends_on_blocks: number[];
  }[],
  niche: string,
  upstreamConfidence: Record<number, 'high' | 'medium' | 'low' | 'unknown'>,
): Promise<BlindSpot[]> {
  const formulations = await Promise.all(
    candidates.map((c) => formulateBlindSpot(c.type, c.signals, niche)),
  );

  return candidates.map((c, idx) => {
    // Multi-Pass 3: confidence пятна = минимальная confidence из upstream блоков
    const blockConfidences = c.depends_on_blocks.map(n => upstreamConfidence[n] || 'unknown');
    const spotConfidence: 'high' | 'medium' | 'low' =
      blockConfidences.includes('low') || blockConfidences.includes('unknown') ? 'low'
      : blockConfidences.every(c => c === 'high') ? 'high'
      : 'medium';

    return {
      index: idx,
      type: c.type,
      title: formulations[idx].title,
      insight: formulations[idx].insight,
      teaser: formulations[idx].teaser,
      impact: c.impact,
      data_signals: c.signals,
      confidence: spotConfidence,
      depends_on_blocks: c.depends_on_blocks,
    };
  });
}

// ——————————————————————————————————————————————————————————
// ДИАГНОЗ
// ——————————————————————————————————————————————————————————

function makeDiagnosis(blindSpots: BlindSpot[]): {
  diagnosis: "green" | "yellow" | "red";
  score: number;
  conflict_weight: 1 | 2 | 3;
  key_factors: string[];
  impact: BlindSpotImpact;
  hasRevenueMultiplier: boolean;
} {
  if (blindSpots.length === 0) {
    return {
      diagnosis: "yellow",
      score: 3,
      conflict_weight: 2,
      key_factors: ["Явных слепых пятен не обнаружено"],
      impact: "low",
      hasRevenueMultiplier: false,
    };
  }

  const highImpactCount = blindSpots.filter((s) => s.impact === "high").length;
  const mediumImpactCount = blindSpots.filter((s) => s.impact === "medium").length;

  const totalImpact: BlindSpotImpact =
    highImpactCount >= 2 ? "high"
    : highImpactCount >= 1 || mediumImpactCount >= 2 ? "medium"
    : mediumImpactCount >= 1 ? "medium"
    : "low";

  const diagnosis: "green" | "yellow" | "red" =
    highImpactCount >= 2 && blindSpots.length >= 3
      ? "green"
      : highImpactCount >= 1 || mediumImpactCount >= 2
        ? "yellow"
        : mediumImpactCount >= 1
          ? "yellow"
          : "red";

  const score = Math.min(
    10,
    3 + highImpactCount * 2 + mediumImpactCount * 1 + (blindSpots.length > 3 ? 1 : 0),
  );

  // #3: conflict_weight — high impact усиливает любой диагноз раздела
  const conflict_weight: 1 | 2 | 3 =
    totalImpact === "high" ? 1 : totalImpact === "medium" ? 2 : 2;

  const hasMultiplier =
    totalImpact === "high" && blindSpots.some((s) => s.type === "pricing_gap");

  return {
    diagnosis,
    score,
    conflict_weight,
    key_factors: [
      `Обнаружено ${blindSpots.length} слепых пятен (${highImpactCount} критичных)`,
      ...blindSpots.slice(0, 2).map((s) => `${s.type}: ${s.teaser}`),
    ],
    impact: totalImpact,
    hasRevenueMultiplier: hasMultiplier,
  };
}

// ——————————————————————————————————————————————————————————
// ОСНОВНОЙ РОУТ
// ——————————————————————————————————————————————————————————

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getServerSupabase();

    const { trend_id, niche } = (await req.json()) as {
      trend_id: string;
      niche: string;
    };
    if (!trend_id || !niche) {
      return NextResponse.json(
        { error: "trend_id и niche required" },
        { status: 400 },
      );
    }

    // Читаем Блоки 1-5 параллельно с user_id (security)
    const [b1r, b2r, b3r, b4r, b5r] = await Promise.all(
      [1, 2, 3, 4, 5].map((n) =>
        supabase
          .from("block_results")
          .select("*")
          .eq("trend_id", trend_id)
          .eq("user_id", user.id)
          .eq("block_number", n)
          .single(),
      ),
    );

    if ([b1r, b2r, b3r, b4r, b5r].some((r) => r.error)) {
      return NextResponse.json(
        {
          error: "Не все блоки анализа завершены. Требуются Блоки 1-5.",
        },
        { status: 422 },
      );
    }

    const b1 = b1r.data!.block_context;
    const b2 = b2r.data!.block_context;
    const b3 = b3r.data!.block_context;
    const b4 = b4r.data!.block_context;
    const b5 = b5r.data!.block_context;

    // Multi-Pass 3: извлекаем confidence из upstream блоков
    const upstreamConfidence: Record<number, 'high' | 'medium' | 'low' | 'unknown'> = {
      1: b1?.classification_confidence || b1?.data_quality?.overall_confidence || 'unknown',
      2: b2?.data_quality?.classification_confidence || 'unknown',
      3: b3?.data_quality?.overall_data_confidence || 'unknown',
      4: b4?.top_competitor_g2_reviews ? 'high' : b4?.competitor_count > 0 ? 'medium' : 'unknown',
      5: b5?.confidence || 'unknown',
    };

    console.log('[Block6] Upstream confidence:', upstreamConfidence);

    // —— Этап 1: детерминировано определяем типы ———————
    const candidates = detectBlindSpotTypes(b1, b2, b3, b4, b5);

    // —— Этап 2: Sonnet формулирует инсайты ———————————
    const blindSpots = await generateBlindSpots(candidates, niche, upstreamConfidence);

    // —— Диагноз ——————————————————————————————————————
    const diagnosisResult = makeDiagnosis(blindSpots);

    // Multi-Pass: data quality
    const spotsHighConf = blindSpots.filter(s => s.confidence === 'high').length;
    const spotsLowConf = blindSpots.filter(s => s.confidence === 'low').length;
    const overallSpotConfidence: 'high' | 'medium' | 'low' =
      spotsHighConf > spotsLowConf && spotsHighConf >= 1 ? 'high'
      : spotsLowConf > blindSpots.length / 2 ? 'low'
      : 'medium';

    // —— block_context для Синтеза —————————————————————
    const block_context: BlindSpotsBlockContext = {
      blind_spots_count: blindSpots.length,
      blind_spots_types: blindSpots.map((s) => s.type),
      blind_spots_impact: diagnosisResult.impact,
      first_spot_teaser:
        blindSpots.length > 0
          ? blindSpots[0].teaser
          : "Явных слепых пятен не обнаружено.",
      has_revenue_multiplier: diagnosisResult.hasRevenueMultiplier,
      conflict_weight: diagnosisResult.conflict_weight, // #3
      data_quality: {
        upstream_blocks_available: Object.values(upstreamConfidence).filter(c => c !== 'unknown').length,
        upstream_confidence: upstreamConfidence,
        spots_with_high_confidence: spotsHighConf,
        spots_with_low_confidence: spotsLowConf,
        overall_confidence: overallSpotConfidence,
      },
    };

    // —— Upsert в Supabase (#4: добавлены conflict_weight и key_factors) ——
    const { error: dbError } = await supabase.from("block_results").upsert({
      trend_id,
      user_id: user.id,
      block_number: 6,
      block_type: "blind_spots",
      diagnosis: diagnosisResult.diagnosis,
      score: Math.max(0, Math.min(10, Math.round(Number.isFinite(diagnosisResult.score) ? diagnosisResult.score : 0))),
      conflict_weight: diagnosisResult.conflict_weight, // #3
      key_factors: diagnosisResult.key_factors, // #4
      key_metric: `${blindSpots.length} слепых пятен обнаружено (${blindSpots.filter((s) => s.impact === "high").length} критичных)`,
      block_context,
      raw_data: {
        layers: { all_blind_spots: blindSpots },
        premium: {
          all_blind_spots: blindSpots,
          blind_spots_impact: diagnosisResult.impact,
          has_revenue_multiplier: diagnosisResult.hasRevenueMultiplier,
          block_context,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);

    // —— #1 FIX: upsert с ignoreDuplicates вместо insert ——
    // Защита от UNIQUE CONSTRAINT при повторном запуске блока
    if (blindSpots.length > 0) {
      await supabase.from("blind_spot_unlocks").upsert(
        {
          trend_id,
          user_id: user.id,
          spot_index: 0,
          unlock_method: "free",
        },
        {
          onConflict: "trend_id,user_id,spot_index",
          ignoreDuplicates: true,
        },
      );
    }

    console.log("[Block6] Blind spots:", {
      diagnosis: diagnosisResult.diagnosis,
      count: blindSpots.length,
      types: blindSpots.map((s) => s.type),
      impact: diagnosisResult.impact,
      has_revenue_multiplier: diagnosisResult.hasRevenueMultiplier,
      conflict_weight: diagnosisResult.conflict_weight,
    });

    return NextResponse.json({
      success: true,
      _cost: BLOCK_COST,
      public: {
        diagnosis: diagnosisResult.diagnosis,
        score: diagnosisResult.score,
        key_metric: `${blindSpots.length} слепых пятен обнаружено`,
        blind_spots_count: blindSpots.length,
        // Первое пятно — бесплатно (хук)
        first_spot:
          blindSpots.length > 0
            ? {
                type: blindSpots[0].type,
                title: blindSpots[0].title,
                insight: blindSpots[0].insight,
                impact: blindSpots[0].impact,
              }
            : null,
        first_spot_teaser: block_context.first_spot_teaser,
        remaining_locked: Math.max(0, blindSpots.length - 1),
      },
      has_premium: true,
    });
  } catch (error: any) {
    console.error("[Block 6 — Blind Spots]", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    );
  }
}

// ——————————————————————————————————————————————————————————
// SUPABASE MIGRATION
// ——————————————————————————————————————————————————————————
//
// create table if not exists blind_spot_unlocks (
//   id uuid default gen_random_uuid() primary key,
//   trend_id uuid not null,
//   user_id uuid not null,
//   spot_index integer not null,
//   unlocked_at timestamptz default now(),
//   unlock_method text check (unlock_method in ('free', 'daily', 'tokens')),
//   unique(trend_id, user_id, spot_index),
//   foreign key (user_id) references auth.users(id) on delete cascade
// );
// create index idx_blind_spot_unlocks_trend on blind_spot_unlocks(trend_id);
// create index idx_blind_spot_unlocks_user on blind_spot_unlocks(user_id);
