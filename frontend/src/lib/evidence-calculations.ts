/**
 * Evidence-Based Calculations
 *
 * Чистые детерминированные формулы БЕЗ GPT.
 * Каждая формула:
 * - Принимает реальные данные
 * - Возвращает числовой результат
 * - Документирует формулу
 */

import { EvidenceScore, GoogleTrendsTimeline } from './evidence-types';

// === КОНКУРЕНТНЫЙ АНАЛИЗ ===

/**
 * Blue Ocean Score: насколько рынок свободен
 * Формула: max(1, 10 - competitors_count * 1.2)
 * 10 = полностью свободный, 1 = красный океан
 */
export function calcBlueOceanScore(competitorsCount: number): EvidenceScore {
  const value = Math.max(1, Math.round((10 - competitorsCount * 1.2) * 10) / 10);
  return {
    value,
    data_type: 'calculated',
    formula: 'max(1, 10 - competitors_count * 1.2)',
    inputs: [`competitors_count=${competitorsCount}`],
    confidence: competitorsCount > 0 ? 80 : 40, // Если 0 конкурентов — может означать что мы плохо искали
  };
}

/**
 * Market Saturation: насколько рынок насыщен
 * <3 = low, 3-7 = medium, >7 = high
 */
export function calcMarketSaturation(competitorsCount: number): {
  level: 'low' | 'medium' | 'high';
  data_type: 'calculated';
  formula: string;
} {
  let level: 'low' | 'medium' | 'high';
  if (competitorsCount < 3) {
    level = 'low';
  } else if (competitorsCount <= 7) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return {
    level,
    data_type: 'calculated',
    formula: '<3=low, 3-7=medium, >7=high',
  };
}

/**
 * Risk Level: уровень риска входа
 * Учитывает количество конкурентов + наличие крупного финансирования
 */
export function calcRiskLevel(
  competitorsCount: number,
  fundedCompetitorsCount: number
): { level: 'low' | 'medium' | 'high'; data_type: 'calculated'; formula: string } {
  const riskScore = competitorsCount * 1.0 + fundedCompetitorsCount * 2.0;

  let level: 'low' | 'medium' | 'high';
  if (riskScore <= 3) {
    level = 'low';
  } else if (riskScore <= 8) {
    level = 'medium';
  } else {
    level = 'high';
  }

  return {
    level,
    data_type: 'calculated',
    formula: 'risk = competitors * 1.0 + funded_competitors * 2.0; <=3=low, <=8=medium, >8=high',
  };
}

// === ИНВЕСТИЦИИ ===

/**
 * Investment Hotness: горячесть рынка для инвесторов
 * Формула: min(10, rounds * 1.5 + total_funding_millions * 0.1)
 */
export function calcInvestmentHotness(
  roundsCount: number,
  totalFundingMillions: number
): EvidenceScore {
  const value = Math.min(10, Math.round((roundsCount * 1.5 + totalFundingMillions * 0.1) * 10) / 10);
  return {
    value,
    data_type: 'calculated',
    formula: 'min(10, rounds_count * 1.5 + total_funding_M * 0.1)',
    inputs: [`rounds=${roundsCount}`, `funding_M=${totalFundingMillions}`],
    confidence: roundsCount > 0 ? 70 : 30,
  };
}

/**
 * Total Funding: сумма реально найденных раундов
 * Парсит "$5M", "$1.2B" и т.д. в число (в миллионах)
 */
export function parseFundingAmount(amountStr: string): number {
  if (!amountStr || amountStr === 'Undisclosed' || amountStr === 'Unknown') return 0;

  const match = amountStr.match(/\$?([\d.]+)\s*(M|B|K|million|billion|thousand)?/i);
  if (!match) return 0;

  const num = parseFloat(match[1]);
  const unit = (match[2] || 'M').toUpperCase().charAt(0);

  switch (unit) {
    case 'B': return num * 1000;
    case 'M': return num;
    case 'K': return num / 1000;
    default: return num;
  }
}

export function calcTotalFunding(amounts: string[]): {
  totalMillions: number;
  formatted: string;
  data_type: 'calculated';
} {
  const totalMillions = amounts.reduce((sum, a) => sum + parseFundingAmount(a), 0);

  let formatted: string;
  if (totalMillions === 0) {
    formatted = 'Нет данных';
  } else if (totalMillions >= 1000) {
    formatted = `$${(totalMillions / 1000).toFixed(1)}B`;
  } else {
    formatted = `$${totalMillions.toFixed(1)}M`;
  }

  return { totalMillions, formatted, data_type: 'calculated' };
}

/**
 * Funding Trend: растёт или падает финансирование
 * Сравнивает количество раундов за первые и вторые 3 месяца
 */
export function calcFundingTrend(
  roundDates: string[]
): { trend: 'growing' | 'stable' | 'declining'; data_type: 'calculated'; formula: string } {
  if (roundDates.length < 2) {
    return { trend: 'stable', data_type: 'calculated', formula: 'insufficient_data' };
  }

  const now = Date.now();
  const threeMonthsAgo = now - 90 * 24 * 60 * 60 * 1000;
  const sixMonthsAgo = now - 180 * 24 * 60 * 60 * 1000;

  let recentCount = 0;
  let olderCount = 0;

  for (const dateStr of roundDates) {
    const date = new Date(dateStr).getTime();
    if (isNaN(date)) continue;

    if (date >= threeMonthsAgo) {
      recentCount++;
    } else if (date >= sixMonthsAgo) {
      olderCount++;
    }
  }

  let trend: 'growing' | 'stable' | 'declining';
  if (recentCount > olderCount * 1.5) {
    trend = 'growing';
  } else if (recentCount < olderCount * 0.5) {
    trend = 'declining';
  } else {
    trend = 'stable';
  }

  return {
    trend,
    data_type: 'calculated',
    formula: 'recent_3m vs older_3m: >1.5x=growing, <0.5x=declining, else=stable',
  };
}

// === GOOGLE TRENDS ===

/**
 * Trend Stability: стабильность тренда (стандартное отклонение)
 * Низкий std_dev = стабильный тренд, высокий = хайп/волатильность
 */
export function calcTrendStability(timeline: GoogleTrendsTimeline[]): EvidenceScore {
  if (timeline.length < 3) {
    return {
      value: 0,
      data_type: 'calculated',
      formula: 'insufficient_data',
      confidence: 0,
    };
  }

  const values = timeline.map(t => t.value);
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  // Нормализуем: stability = 10 - (stdDev / mean * 10), clamped to 1-10
  const normalizedStability = mean > 0
    ? Math.min(10, Math.max(1, Math.round((10 - (stdDev / mean) * 10) * 10) / 10))
    : 5;

  return {
    value: normalizedStability,
    data_type: 'calculated',
    formula: 'stability = 10 - (std_dev / mean * 10), clamped 1-10',
    inputs: [`mean=${mean.toFixed(1)}`, `std_dev=${stdDev.toFixed(1)}`],
    confidence: timeline.length >= 6 ? 80 : 50,
  };
}

/**
 * Growth Comparison: рост за 12 месяцев vs 3 месяца
 */
export function calcGrowthComparison(
  growth12m: number,
  growth3m: number
): EvidenceScore {
  // Если 3m рост сильно опережает 12m — ускоряющийся тренд
  // Если 3m < 12m — замедляется
  let score: number;
  if (growth3m > growth12m * 1.5) {
    score = 9; // Ускоряющийся рост
  } else if (growth3m > growth12m) {
    score = 7; // Стабильный рост
  } else if (growth3m > 0) {
    score = 5; // Замедление роста
  } else if (growth3m > -20) {
    score = 3; // Стагнация
  } else {
    score = 1; // Падение
  }

  return {
    value: score,
    data_type: 'calculated',
    formula: 'growth_3m vs growth_12m comparison',
    inputs: [`growth_12m=${growth12m}%`, `growth_3m=${growth3m}%`],
    confidence: 70,
  };
}

// === UNIT ECONOMICS ===

/**
 * LTV/CAC Ratio
 * >3 = отлично, 2-3 = хорошо, 1-2 = рисково, <1 = плохо
 */
export function calcLtvCacRatio(
  estimatedLtv: number,
  estimatedCac: number
): EvidenceScore {
  if (estimatedCac <= 0 || estimatedLtv <= 0) {
    return {
      value: 0,
      data_type: 'calculated',
      formula: 'LTV / CAC (insufficient data)',
      confidence: 0,
    };
  }

  const ratio = Math.round((estimatedLtv / estimatedCac) * 10) / 10;

  let score: number;
  if (ratio >= 3) score = 9;
  else if (ratio >= 2) score = 7;
  else if (ratio >= 1) score = 4;
  else score = 2;

  return {
    value: score,
    data_type: 'calculated',
    formula: `LTV($${estimatedLtv}) / CAC($${estimatedCac}) = ${ratio}x`,
    inputs: [`LTV=$${estimatedLtv}`, `CAC=$${estimatedCac}`, `ratio=${ratio}x`],
    confidence: 50, // Estimated values
  };
}

/**
 * Estimated CAC from CPC data
 * Assumption: CAC = average_CPC * 50 (2% conversion rate on average)
 */
export function calcEstimatedCac(cpcValues: number[]): EvidenceScore {
  if (cpcValues.length === 0) {
    return {
      value: 0,
      data_type: 'calculated',
      formula: 'no CPC data',
      confidence: 0,
    };
  }

  const avgCpc = cpcValues.reduce((sum, v) => sum + v, 0) / cpcValues.length;
  const estimatedCac = Math.round(avgCpc * 50); // 2% conversion rate

  return {
    value: estimatedCac,
    data_type: 'calculated',
    formula: 'avg_CPC * 50 (assumes 2% conversion)',
    inputs: [`avg_CPC=$${avgCpc.toFixed(2)}`, `conversion=2%`],
    confidence: 40,
  };
}

/**
 * Estimated LTV from competitor pricing
 * Assumption: average monthly price * 18 months (average B2B SaaS lifetime)
 */
export function calcEstimatedLtv(monthlyPrices: number[]): EvidenceScore {
  if (monthlyPrices.length === 0) {
    return {
      value: 0,
      data_type: 'calculated',
      formula: 'no pricing data',
      confidence: 0,
    };
  }

  const avgPrice = monthlyPrices.reduce((sum, v) => sum + v, 0) / monthlyPrices.length;
  const estimatedLtv = Math.round(avgPrice * 18); // 18 month average lifetime

  return {
    value: estimatedLtv,
    data_type: 'calculated',
    formula: 'avg_monthly_price * 18 (avg SaaS lifetime)',
    inputs: [`avg_monthly=$${avgPrice.toFixed(0)}`, `lifetime=18months`],
    confidence: 40,
  };
}

// === PROBLEM SEVERITY ===

/**
 * Problem Severity Score: насколько серьёзна проблема
 * На основе количества жалоб * средний engagement
 */
export function calcProblemSeverity(
  complaintsCount: number,
  totalEngagement: number,
  sourcesCount: number
): EvidenceScore {
  if (complaintsCount === 0) {
    return {
      value: 0,
      data_type: 'calculated',
      formula: 'no complaints found',
      confidence: 20,
    };
  }

  const avgEngagement = totalEngagement / complaintsCount;

  // Score: log scale of complaints * engagement factor * source diversity
  const sourceFactor = Math.min(2, sourcesCount / 3); // Max 2x для 6+ источников
  const rawScore = Math.log10(complaintsCount + 1) * (1 + avgEngagement / 100) * sourceFactor;
  const normalizedScore = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

  return {
    value: normalizedScore,
    data_type: 'calculated',
    formula: 'log10(complaints+1) * (1 + avg_engagement/100) * source_diversity_factor',
    inputs: [
      `complaints=${complaintsCount}`,
      `avg_engagement=${avgEngagement.toFixed(0)}`,
      `sources=${sourcesCount}`,
    ],
    confidence: Math.min(90, 30 + complaintsCount * 3 + sourcesCount * 10),
  };
}

// === FREQUENCY SCORE ===

/**
 * Frequency Score: как часто проблема упоминается
 */
export function calcFrequencyScore(
  redditPostCount: number,
  soQuestionCount: number,
  trendsVolume: number
): EvidenceScore {
  const totalMentions = redditPostCount + soQuestionCount;
  const trendsFactor = trendsVolume > 50 ? 1.5 : trendsVolume > 20 ? 1.2 : 1.0;

  const rawScore = Math.log10(totalMentions + 1) * 3 * trendsFactor;
  const value = Math.min(10, Math.max(0, Math.round(rawScore * 10) / 10));

  return {
    value,
    data_type: 'calculated',
    formula: 'log10(mentions+1) * 3 * trends_factor',
    inputs: [
      `reddit=${redditPostCount}`,
      `stackoverflow=${soQuestionCount}`,
      `trends_volume=${trendsVolume}`,
    ],
    confidence: totalMentions > 5 ? 70 : 40,
  };
}

// === DEMAND VERDICT ===

/**
 * Overall demand score combining growth and stability
 */
export function calcDemandVerdict(
  growthScore: number,
  stabilityScore: number,
  newEntrantsCount: number
): EvidenceScore {
  const entrantsFactor = newEntrantsCount > 5 ? 1.3 : newEntrantsCount > 2 ? 1.1 : 1.0;
  const rawScore = (growthScore * 0.5 + stabilityScore * 0.3 + Math.min(10, newEntrantsCount) * 0.2) * entrantsFactor;
  const value = Math.min(10, Math.max(1, Math.round(rawScore * 10) / 10));

  return {
    value,
    data_type: 'calculated',
    formula: '(growth*0.5 + stability*0.3 + new_entrants*0.2) * entrants_factor',
    inputs: [
      `growth=${growthScore}`,
      `stability=${stabilityScore}`,
      `new_entrants=${newEntrantsCount}`,
    ],
    confidence: 60,
  };
}

// === SCALABILITY ===

/**
 * Scalability Score based on market signals
 */
export function calcScalabilityScore(
  marketSizeSignals: number,
  trendGrowth: number,
  isSubscription: boolean
): EvidenceScore {
  let score = 5; // baseline

  if (trendGrowth > 50) score += 2;
  else if (trendGrowth > 20) score += 1;
  else if (trendGrowth < -10) score -= 2;

  if (marketSizeSignals > 5) score += 2;
  else if (marketSizeSignals > 2) score += 1;

  if (isSubscription) score += 1;

  const value = Math.min(10, Math.max(1, score));

  return {
    value,
    data_type: 'calculated',
    formula: 'base(5) + trend_growth_bonus + market_signals_bonus + subscription_bonus',
    inputs: [
      `trend_growth=${trendGrowth}%`,
      `market_signals=${marketSizeSignals}`,
      `subscription=${isSubscription}`,
    ],
    confidence: 50,
  };
}
