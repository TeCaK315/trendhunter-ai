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
  return `Ты — Арбитр. Decision Maker. Скептик вскрыл угрозы. Оптимист нашёл условия нейтрализации. Твоя задача: вынести ОДИН условный вердикт и дать ТРИ приоритетных действия. НИША: ${niche} ДИАГНОЗЫ ВСЕХ БЛОКОВ: ${allDiagnoses} ${conflictSummary} СКЕПТИК СКАЗАЛ: ${skepticText} ОПТИМИСТ СКАЗАЛ: ${optimistText} ── ПРАВИЛА ВЫБОРА ВЕРДИКТА ────────────────────────────────────────── go_if → используй когда:   - Нет экзистенциальных конфликтов (вес 3)   - Главный конфликт имеет чёткое условие нейтрализации от Оптимиста   - confidence выше 0.65 no_go_until → используй когда:   - Есть экзистенциальный конфликт (вес 3) БЕЗ нейтрализации   - Проблема🔴 или Конкуренция🔴 без gap   - Математика не сходится и нет реальной модели исправления experiment_if → используй когда:   - Данных достаточно для гипотезы но недостаточно для уверенного GO   - Оптимист нашёл нейтрализацию но она требует валидации   - Конфликты есть но все операционные (вес 1-2), нет экзистенциальных ── ПРАВИЛА ДЕЙСТВИЙ ───────────────────────────────────────────────── Действие 1 → адресует самый тяжёлый конфликт Действие 2 → адресует следующий по критичности Действие 3 → усиливает самый сильный зелёный блок (не исправляет проблему — развивает силу) Каждое действие: глагол + конкретный шаг + временной горизонт НЕ абстрактные советы. Только то что физически меняет диагноз блока. ── ФИНАЛЬНЫЙ АБЗАЦ bridge_text (обязательный) ────────────────────── После вердикта и действий — один абзац. Констатировать что данные указывают на разрыв между типичным и стратегическим входом в эту нишу. НЕ продавать. НЕ упоминать слово "стратегия" напрямую. Пример: "Данные указывают на разрыв между типичным результатом в этой нише и тем что возможно при правильном использовании выявленных точек входа." ── ПРАВИЛА УВЕРЕННОСТИ (confidence) ──────────────────────────────── ФОРМУЛА CONFIDENCE (применяй точно): Base = 0.5 + 0.05 × GREEN блоки (из 6) - 0.15 × конфликты weight=3 - 0.05 × конфликты weight=2 + 0.10 × нейтрализации от Оптимиста - 0.03 × YELLOW блоки где classification_confidence = LOW (только data scarcity — НЕ все YELLOW блоки) - 0.10 если любой блок имеет unknown_mode = true - 0.05 если blind_spots_impact = HIGH Clamp(0.10, 0.95) ВАЖНО: YELLOW блоки с нормальными данными = 0 (нейтральные). Штраф только за YELLOW которые возникли из-за нехватки данных. Обязательно верни confidence_factors — массив строк объясняющий из чего сложилась уверенность. Формат каждого фактора: "+0.XX причина" или "-0.XX причина". Отвечай строго валидным JSON без markdown и пояснений: {   "verdict_type": "go_if" | "no_go_until" | "experiment_if",   "verdict_condition": "конкретное условие одним предложением — что должно быть правдой для GO",   "verdict_reasoning": "почему именно этот вердикт — одно предложение со ссылкой на главный конфликт",   "priority_actions": [     {       "order": 1,       "action": "глагол + конкретный шаг применительно к нише ${niche}",       "timeline": "временной горизонт",       "addresses": "какой конфликт или блок закрывает"     },     {       "order": 2,       "action": "...",       "timeline": "...",       "addresses": "..."     },     {       "order": 3,       "action": "...",       "timeline": "...",       "addresses": "..."     }   ],   "confidence": 0.0,   "confidence_factors": ["+0.XX причина", "-0.XX причина"],   "bridge_text": "один абзац. Констатировать разрыв между типичным и стратегическим входом. Не продавать. Не упоминать слово стратегия." }`;
}
