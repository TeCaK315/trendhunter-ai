import {
  BlockOutput,
  Conflict,
  SkepticOutput,
  OptimistOutput,
} from "@/types/analysis";
export function buildArbitratorPrompt(
  niche: string,
  blocks: (BlockOutput | undefined)[],
  conflicts: Conflict[],
  skepticOutput: SkepticOutput,
  optimistOutput: OptimistOutput,
): string {
  const topConflict = conflicts[0];
  const hasRealConflicts = topConflict?.type !== "none";
  const allDiagnoses = blocks
    .filter(Boolean)
    .map(
      (b) =>
        `Блок ${b!.block_number} (${b!.block_type}): ${b!.diagnosis} | ${b!.key_metric}`,
    )
    .join("\n");
  const skepticText = skepticOutput.points
    ? skepticOutput.points
        .map((p) => `• [${p.severity}] ${p.mechanism}`)
        .join("\n")
    : skepticOutput.blind_spots
      ? skepticOutput.blind_spots
          .map((b) => `• [${b.category}] ${b.risk} (${b.timeline})`)
          .join("\n")
      : "—";
  const optimistText = optimistOutput.neutralizations
    .map((n) => `• [${n.type}] ${n.condition}`)
    .join("\n");
  const conflictSummary = hasRealConflicts
    ? `Главный конфликт: ${topConflict.pair} (вес ${topConflict.weight})\nМеханизм: ${topConflict.mechanism}`
    : "Конфликтов нет — все блоки согласованы";
  return `Ты — Арбитр. Decision Maker. Скептик вскрыл угрозы. Оптимист нашёл условия нейтрализации. Твоя задача: вынести ОДИН условный вердикт и дать ТРИ приоритетных действия. НИША: ${niche} ДИАГНОЗЫ ВСЕХ БЛОКОВ: ${allDiagnoses} ${conflictSummary} СКЕПТИК СКАЗАЛ: ${skepticText} ОПТИМИСТ СКАЗАЛ: ${optimistText} ── ПРАВИЛА ВЫБОРА ВЕРДИКТА ────────────────────────────────────────── go_if → используй когда:   - Нет экзистенциальных конфликтов (вес 3)   - Главный конфликт имеет чёткое условие нейтрализации от Оптимиста   - confidence выше 0.65 no_go_until → используй когда:   - Есть экзистенциальный конфликт (вес 3) БЕЗ нейтрализации   - Проблема🔴 или Конкуренция🔴 без gap   - Математика не сходится и нет реальной модели исправления experiment_if → используй когда:   - Данных достаточно для гипотезы но недостаточно для уверенного GO   - Оптимист нашёл нейтрализацию но она требует валидации   - Конфликты есть но все операционные (вес 1-2), нет экзистенциальных ── ПРАВИЛА ДЕЙСТВИЙ ───────────────────────────────────────────────── Действие 1 → адресует самый тяжёлый конфликт Действие 2 → адресует следующий по критичности Действие 3 → усиливает самый сильный зелёный блок (не исправляет проблему — развивает силу) Каждое действие: глагол + конкретный шаг + временной горизонт НЕ абстрактные советы. Только то что физически меняет диагноз блока. ── ПРАВИЛА УВЕРЕННОСТИ (confidence) ──────────────────────────────── 0.8-1.0 → все блоки зелёные, нет конфликтов, внешний контекст нейтральный 0.6-0.8 → есть операционные конфликты но нейтрализации найдены 0.4-0.6 → есть экзистенциальные конфликты с частичной нейтрализацией 0.2-0.4 → есть экзистенциальные конфликты без нейтрализации Отвечай строго валидным JSON без markdown и пояснений: {   "verdict_type": "go_if" | "no_go_until" | "experiment_if",   "verdict_condition": "конкретное условие одним предложением — что должно быть правдой для GO",   "verdict_reasoning": "почему именно этот вердикт — одно предложение со ссылкой на главный конфликт",   "priority_actions": [     {       "order": 1,       "action": "глагол + конкретный шаг применительно к нише ${niche}",       "timeline": "временной горизонт",       "addresses": "какой конфликт или блок закрывает"     },     {       "order": 2,       "action": "...",       "timeline": "...",       "addresses": "..."     },     {       "order": 3,       "action": "...",       "timeline": "...",       "addresses": "..."     }   ],   "confidence": 0.0 }`;
}
