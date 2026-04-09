import { BlockOutput, Conflict, ConflictType } from "@/types/analysis";
export function detectConflicts(
  blocks: (BlockOutput | undefined)[],
): Conflict[] {
  const b1 = blocks[0];
  const b2 = blocks[1];
  const b3 = blocks[2];
  const b4 = blocks[3];
  const b5 = blocks[4];
  const b6 = blocks[5];
  const conflicts: Conflict[] = [];
  if (b2?.diagnosis === "green" && b5?.diagnosis === "red") {
    conflicts.push({
      weight: 3,
      type: "existential",
      pair: "Спрос🟢 + Экономика🔴",
      mechanism:
        "Рынок есть — математика убивает. CAC структурно выше LTV при любой разумной цене.",
      blocks_involved: [2, 5],
    });
  }

  if (b1?.diagnosis === "red") {
    conflicts.push({
      weight: 3,
      type: "existential",
      pair: "Проблема🔴",
      mechanism:
        "Боль не доказана данными. Рынок не созрел или боль ситуативная. Строить не для кого.",
      blocks_involved: [1],
    });
  }

  if (
    b4?.diagnosis === "red" &&
    (b4.block_context as any)?.gap_type === "none"
  ) {
    conflicts.push({
      weight: 3,
      type: "existential",
      pair: "Конкуренция🔴 без gap",
      mechanism:
        "Поле полностью занято. Нет ни Execution ни Strategic gap. Вход без дифференциации = война на истощение.",
      blocks_involved: [4],
    });
  }

  if (
    b2?.diagnosis === "green" &&
    b3?.diagnosis === "red" &&
    b5?.diagnosis === "red"
  ) {
    conflicts.push({
      weight: 3,
      type: "existential",
      pair: "Спрос🟢 + Продаваемость🔴 + Экономика🔴",
      mechanism:
        "Люди ищут но не покупают и математика не сходится. Вероятно информационный рынок без монетизации.",
      blocks_involved: [2, 3, 5],
    });
  }

  const saleCycleDays = (b3?.block_context as any)?.sale_cycle_days || 0;
  if (
    b5?.diagnosis === "yellow" &&
    saleCycleDays >= 14
  ) {
    conflicts.push({
      weight: 2,
      type: "operational",
      pair: `Экономика🟡 + цикл ${saleCycleDays}д`,
      mechanism:
        `Маргинальная unit-экономика плюс ${saleCycleDays}-дневный цикл продажи = кассовый разрыв до первой выручки.`,
      blocks_involved: [3, 5],
    });
  }

  if (b1?.diagnosis === "yellow" && b4?.diagnosis === "green") {
    conflicts.push({
      weight: 2,
      type: "operational",
      pair: "Проблема🟡 + Конкуренция🟢",
      mechanism:
        "Конкурентов нет — но и боль слабо выражена. Рынок может быть просто маленьким, а не незакрытым.",
      blocks_involved: [1, 4],
    });
  }

  const allOtherGreen = [b1, b2, b3, b4, b5].every(
    (b) => b?.diagnosis === "green",
  );
  if (
    allOtherGreen &&
    b6?.block_context &&
    (b6.block_context as any)?.blind_spots_count === 0
  ) {
    conflicts.push({
      weight: 2,
      type: "operational",
      pair: "Все GREEN + нет слепых пятен",
      mechanism:
        "Картина выглядит идеальной — но без неочевидных инсайтов. Это либо действительно хорошо, либо анализ пропустил что-то структурное.",
      blocks_involved: [6],
    });
  }

  if (b4?.diagnosis === "yellow" && b1?.diagnosis === "green") {
    conflicts.push({
      weight: 1,
      type: "manageable",
      pair: "Конкуренция🟡 + Проблема🟢",
      mechanism:
        "Конкуренты есть но боль реальная и не закрыта. Execution gap — могут скопировать быстро.",
      blocks_involved: [1, 4],
    });
  }

  if (b2?.diagnosis === "yellow" && b5?.diagnosis === "green") {
    conflicts.push({
      weight: 1,
      type: "manageable",
      pair: "Спрос🟡 + Экономика🟢",
      mechanism:
        "Спрос неустойчивый (хайп или информационный) но если рынок подтвердится — математика хорошая.",
      blocks_involved: [2, 5],
    });
  }

  const blindSpotsHighImpact =
    (b6?.block_context as any)?.blind_spots_impact === "high";
  const hasRevenueMultiplier =
    (b6?.block_context as any)?.has_revenue_multiplier === true;
  if (blindSpotsHighImpact && b5?.diagnosis !== "green") {
    conflicts.push({
      weight: 1,
      type: "manageable",
      pair: "Слепые пятна HIGH + Экономика не GREEN",
      mechanism:
        "Revenue Range показывает маргинальный потенциал — но обнаружены инсайты которые могут изменить картину. Требует изучения.",
      blocks_involved: [5, 6],
    });
  }

  if (hasRevenueMultiplier && b5?.diagnosis === "yellow") {
    conflicts.push({
      weight: 1,
      type: "manageable",
      pair: "Revenue Multiplier + Экономика🟡",
      mechanism:
        "Pricing gap обнаружен: текущие цены рынка занижены относительно ценности. Реальный revenue потенциал может быть выше расчётного.",
      blocks_involved: [5, 6],
    });
  }

  // Rule 13: High Entry Barrier
  if (b5?.diagnosis !== 'red' && (b5?.block_context as any)?.high_entry_barrier_flag === true) {
    conflicts.push({ weight: 1, type: 'manageable', pair: 'Экономика: высокий барьер входа', mechanism: 'GO возможен только с капиталом — бюджет на проверку высокий', blocks_involved: [5] });
  }

  // Rule 14: Leaky Bucket
  if ((b5?.block_context as any)?.leaky_bucket_flag === true) {
    conflicts.push({ weight: 2, type: 'operational', pair: 'Экономика: Retention Hell', mechanism: 'Клиенты уйдут к бесплатным аналогам — отток критический', blocks_involved: [5] });
  }

  // Rule 15: CAC Spread
  if ((b5?.block_context as any)?.cac_spread_flag === true) {
    conflicts.push({ weight: 1, type: 'manageable', pair: 'Экономика: CAC spread', mechanism: 'Экономика критически зависит от выбора канала продаж', blocks_involved: [5] });
  }

  // Rule 16: Long Payback
  if ((b5?.block_context as any)?.long_payback_flag === true) {
    conflicts.push({ weight: 2, type: 'operational', pair: 'Экономика: долгая окупаемость', mechanism: 'Долгая окупаемость клиента — структурная проблема', blocks_involved: [5] });
  }

  if (conflicts.length === 0) {
    conflicts.push({
      weight: 1,
      type: "none",
      pair: "no_conflicts",
      mechanism:
        "Все блоки согласованы. Скептик активирует режим Blind Spot: ищет скрытые риски которые данные не поймали.",
      blocks_involved: [],
    });
  }

  return conflicts.sort((a, b) => b.weight - a.weight);
}
