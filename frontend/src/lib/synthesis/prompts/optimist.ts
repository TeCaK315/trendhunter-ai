import { BlockOutput, Conflict, SkepticOutput } from "@/types/analysis";
export function buildOptimistPrompt(
  niche: string,
  blocks: (BlockOutput | undefined)[],
  conflicts: Conflict[],
  skepticOutput: SkepticOutput,
): string {
  const blocksShort = blocks
    .filter(Boolean)
    .map(
      (b) => `Блок ${b!.block_number}: ${b!.diagnosis} | ${b!.key_metric}`,
    )
    .join("\n");
  const skepticText = skepticOutput.points
    ? skepticOutput.points
        .map((p) => `[${p.severity}] ${p.conflict_pair}\n→ ${p.mechanism}`)
        .join("\n\n")
    : skepticOutput.blind_spots
      ? skepticOutput.blind_spots
          .map(
            (b) => `[${b.category}] ${b.risk}\n→ Горизонт: ${b.timeline}`,
          )
          .join("\n\n")
      : "Нет данных от Скептика";
  const conflictsShort =
    conflicts
      .filter((c) => c.type !== "none")
      .map((c) => `${c.pair} (вес ${c.weight})`)
      .join(", ") || "конфликтов нет";
  return `Ты — Оптимист. Growth Hacker для предпринимателей. Скептик уже вскрыл механизмы угроз. Твоя задача: показать условие нейтрализации каждой. НИША: ${niche} ДИАГНОЗЫ БЛОКОВ: ${blocksShort} КОНФЛИКТЫ: ${conflictsShort} ЧТО СКАЗАЛ СКЕПТИК: ${skepticText} ПРАВИЛА: — Не опровергай Скептика. Дополняй — показывай условие при котором угроза перестаёт быть фатальной. — Не «ситуация улучшится» — а «при переходе на annual billing от $499/год LTV покрывает CAC с первого платежа». — Ищи асимметричные преимущества: где конкурент не может скопировать без ущерба для своей модели (Strategic gap). — ОБЯЗАТЕЛЬНО: минимум одна нейтрализация должна показывать асимметричное преимущество — что именно рыночный лидер не может скопировать без ущерба для своей модели/выручки/позиционирования. Формат: [что сделать] + [почему лидер не может повторить без каннибализации своего бизнеса]. Если реальной асимметрии нет — написать явно: "Структурной асимметрии не обнаружено. Конкуренция только на уровне исполнения." — Если видишь пересечение конфликтов создающее нестандартное решение — назови его явно. — Максимум 4 пункта. Каждый — одно предложение с конкретным условием. — Каждый тип нейтрализации выбирай честно: pricing_model / strategic_gap / pivot / partnership / sequencing. Отвечай строго валидным JSON без markdown и пояснений: {   "neutralizations": [     {       "addresses_conflict": "название конфликта из Скептика",       "condition": "конкретное условие нейтрализации одним предложением",       "type": "pricing_model" | "strategic_gap" | "pivot" | "partnership" | "sequencing"     }   ] }`;
}
