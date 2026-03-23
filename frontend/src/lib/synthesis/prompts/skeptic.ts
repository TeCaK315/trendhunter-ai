import { BlockOutput, Conflict } from "@/types/analysis";
function formatBlocks(blocks: (BlockOutput | undefined)[]): string {
  return blocks
    .filter(Boolean)
    .map((b) => {
      const ctx = b!.block_context as any;
      if (b!.block_number === 6) {
        return `Блок 6 (blind_spots): диагноз=${b!.diagnosis}, score=${b!.score}/10   Слепых пятен: ${ctx?.blind_spots_count || 0} (impact: ${ctx?.blind_spots_impact || "unknown"})   Первый инсайт: ${ctx?.first_spot_teaser || "нет данных"}   Revenue multiplier: ${ctx?.has_revenue_multiplier ? "ДА" : "НЕТ"}`;
      }

      return `Блок ${b!.block_number} (${b!.block_type}): диагноз=${b!.diagnosis}, score=${b!.score}/10   Ключевые факторы: ${b!.key_factors?.join(" | ") || "—"}   Главная метрика: ${b!.key_metric || "—"}`;
    })
    .join("\n\n");
}

export function buildSkepticPrompt(
  niche: string,
  blocks: (BlockOutput | undefined)[],
  conflicts: Conflict[],
  externalContext: string,
): string {
  const hasRealConflicts = conflicts[0]?.type !== "none";
  const blocksText = formatBlocks(blocks);
  const b6 = blocks[5];
  const blindSpotsContext = b6?.block_context as any;
  const blindSpotsNote =
    blindSpotsContext?.blind_spots_count > 0
      ? `\nСЛЕПЫЕ ПЯТНА (Блок 6): ${blindSpotsContext.blind_spots_count} пятен обнаружено (impact: ${blindSpotsContext.blind_spots_impact}). Первый инсайт: "${blindSpotsContext.first_spot_teaser}"`
      : "\nСЛЕПЫЕ ПЯТНА (Блок 6): пятен не обнаружено";
  if (hasRealConflicts) {
    const conflictsText = conflicts
      .filter((c) => c.type !== "none")
      .map(
        (c) =>
          `[Вес ${c.weight} / ${c.type}] ${c.pair}\nМеханизм (предварительный): ${c.mechanism}`,
      )
      .join("\n\n");
    return `Ты — Скептик. Risk Manager для предпринимателей. Твоя задача: углубить механизм каждого конфликта. Не пересказывай — вскрывай причину. НИША: ${niche} ДАННЫЕ БЛОКОВ: ${blocksText} ${blindSpotsNote} КОНФЛИКТЫ (отсортированы по критичности): ${conflictsText} ВНЕШНИЙ КОНТЕКСТ (последние 90 дней): ${externalContext} ПРАВИЛА: — Работай только с конфликтами выше. Максимум 4 пункта. — Для каждого конфликта: объясни конкретный механизм угрозы применительно к этой нише. — Не «CAC выше LTV» — а «CAC выше LTV потому что в нише ${niche} customer support стоит 40% выручки и это системно». — Начинай с самого тяжёлого конфликта (вес 3). — Если внешний контекст содержит регуляторный или технологический риск — добавь отдельным пунктом. — Если слепые пятна имеют impact=high И конфликты экзистенциальные — это усугубляет угрозу. — Никаких оговорок и «с одной стороны». Только конкретный механизм. Отвечай строго валидным JSON без markdown и пояснений: {   "points": [     {       "conflict_pair": "название конфликта",       "mechanism": "конкретный механизм угрозы одним предложением применительно к этой нише",       "severity": "existential" | "operational" | "manageable"     }   ] }`;
  }

  return `Ты — Скептик в режиме Blind Spot Detector. Все шесть блоков анализа дали согласованные позитивные диагнозы для ниши: ${niche}. Твоя задача: найти три скрытых риска которые блоки НЕ МОГЛИ поймать по определению. ДАННЫЕ БЛОКОВ: ${blocksText} ${blindSpotsNote} ВНЕШНИЙ КОНТЕКСТ (последние 90 дней): ${externalContext} ПРАВИЛА: — Ищи только в трёх категориях ниже. Не повторяй то что уже есть в данных блоков. — Каждый риск должен быть специфичным для ниши ${niche}, не абстрактным. — Если Блок 6 уже обнаружил слепые пятна — не повторяй их. Ищи то что даже они не поймали. Категории поиска: 1. REGULATORY — законы, ограничения, лицензии которые готовятся или только вышли 2. TECHNOLOGICAL — анонсы Google / Apple / OpenAI / Meta которые могут сделать нишу нерелевантной 3. CULTURAL — изменения в поведении аудитории которые ещё не отразились в данных Отвечай строго валидным JSON без markdown и пояснений: {   "blind_spots": [     {       "category": "regulatory" | "technological" | "cultural",       "risk": "конкретное описание риска для ниши ${niche}",       "timeline": "когда это может материализоваться"     }   ] }`;
}
