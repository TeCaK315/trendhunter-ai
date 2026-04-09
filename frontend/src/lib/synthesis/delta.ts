// src/lib/synthesis/delta.ts
// Strategic Delta calculator for Block 7 (AI Synthesis)
// Adapted from TrendHunter_Block7_FINAL_v2.ts to work with BlockOutput[] format

import { BlockOutput, Conflict } from '@/types/analysis';

// ─── TYPES ──────────────────────────────────────────────────

type VerdictType = 'go_if' | 'experiment_if' | 'no_go_until';

export interface StrategicDelta {
  show: boolean;
  standard_path: {
    revenue_annual: number;
    months_to_revenue: number;
    success_probability: number;
    main_trap: string;
  };
  strategic_path: {
    revenue_annual: number;
    months_to_revenue: number;
    success_probability: number;
    is_locked: true;
  };
  delta_revenue: number;
  delta_months: number;
  delta_probability: number;
  gap_drivers: GapDriver[];
  verdict_frame: string;
  uplift_multiplier: number;
  cta_text: string;
}

export interface GapDriver {
  title: string;
  source: string;
  note?: string;
}

// ─── BLOCK DATA HELPERS ─────────────────────────────────────
// Extract block_context fields from BlockOutput[] array

function getBlockCtx(blocks: BlockOutput[], num: number): any {
  return blocks.find(b => b.block_number === num)?.block_context as any || {};
}

function getBlockDiagnosis(blocks: BlockOutput[], num: number): string {
  return blocks.find(b => b.block_number === num)?.diagnosis ?? 'yellow';
}

function getBlockScore(blocks: BlockOutput[], num: number): number {
  return blocks.find(b => b.block_number === num)?.score ?? 0;
}

// ─── STRATEGIC DELTA ─────────────────────────────────────────

export function calculateStrategicDelta(
  blocks: BlockOutput[],
  verdictType: VerdictType,
  confidence: number
): StrategicDelta {
  const b1ctx = getBlockCtx(blocks, 1);
  const b2ctx = getBlockCtx(blocks, 2);
  const b3ctx = getBlockCtx(blocks, 3);
  const b4ctx = getBlockCtx(blocks, 4);
  const b5ctx = getBlockCtx(blocks, 5);
  const b6ctx = getBlockCtx(blocks, 6);

  // Derived fields from block_context
  const gapMap: Array<{ pain: string; status: string; paying_ratio: number }> = b4ctx.gap_map ?? [];
  const blindSpotsCount: number = b6ctx.blind_spots_count ?? 0;
  const openGapsCount = gapMap.filter((g: any) => g.status === 'open').length;

  // ШАГ 1: Проверка наличия стратегического угла
  const hasStrategicAngle = openGapsCount > 0 || blindSpotsCount > 0;

  if (!hasStrategicAngle) {
    return {
      show: false,
      standard_path: buildStandardPath(b5ctx, confidence),
      strategic_path: { revenue_annual: 0, months_to_revenue: 0, success_probability: 0, is_locked: true },
      delta_revenue: 0,
      delta_months: 0,
      delta_probability: 0,
      gap_drivers: [],
      verdict_frame: '',
      uplift_multiplier: 1.0,
      cta_text: '',
    };
  }

  // ШАГ 2: Uplift Multiplier
  const acquisitionType = b3ctx.requires_sales_contact ? 'SALES_LED' : b3ctx.has_freemium ? 'PLG' : (b4ctx.acquisition_type ?? 'SEO_LED');
  const cacMid = (() => {
    const cs = b5ctx.cac_scenarios;
    if (!cs) return b5ctx.cac_mid ?? null;
    const key = (cs.recommended || 'seo_led').toLowerCase();
    return cs[key]?.mid ?? null;
  })();
  const priceRangeMedian = b3ctx.entry_price_usd ?? null;
  const priceModel = b3ctx.billing_model ?? null;
  const revenueQuality = b5ctx.revenue_quality ?? 'MEDIUM';
  const monthlyRevenueMid = b5ctx.monthly_revenue_mid ?? null;
  const commercialIntentRatio = b2ctx.commercial_intent_ratio ?? 0;

  const uplift = calculateUpliftMultiplier(
    openGapsCount, blindSpotsCount,
    acquisitionType, cacMid, priceRangeMedian,
    priceModel, revenueQuality, monthlyRevenueMid
  );

  // ШАГ 3: Standard Path
  const standard = buildStandardPath(b5ctx, confidence);

  // ШАГ 4: Strategic Path
  const speedMultiplier = calculateSpeedMultiplier(acquisitionType, commercialIntentRatio);
  const probabilityBoost = calculateProbabilityBoost(openGapsCount, blindSpotsCount);

  const strategic = {
    revenue_annual: Math.round(standard.revenue_annual * uplift),
    months_to_revenue: Math.round(standard.months_to_revenue * speedMultiplier),
    success_probability: Math.min(0.95, standard.success_probability + probabilityBoost),
    is_locked: true as const,
  };

  // ШАГ 5: Deltas
  const delta_revenue = strategic.revenue_annual - standard.revenue_annual;
  const delta_months = standard.months_to_revenue - strategic.months_to_revenue;
  const delta_probability = strategic.success_probability - standard.success_probability;

  // ШАГ 6: Gap Drivers
  const painClusters = b1ctx.pain_clusters ?? [];
  const competitionIntensity = b4ctx.competition_intensity ?? 'MEDIUM';
  const avgSwitchingCost = b4ctx.avg_switching_cost ?? 'MEDIUM';
  const firstSpotTeaser = b6ctx.first_spot_teaser ?? null;

  const gap_drivers = buildGapDrivers(
    gapMap, painClusters, acquisitionType, cacMid,
    competitionIntensity, avgSwitchingCost,
    blindSpotsCount, firstSpotTeaser
  );

  // ШАГ 7: Verdict Frame
  const verdict_frame = buildVerdictFrame(verdictType, delta_revenue, standard.revenue_annual);

  // ШАГ 8: CTA Text
  const cta_text = buildCTAText(verdictType);

  return {
    show: true,
    standard_path: standard,
    strategic_path: strategic,
    delta_revenue,
    delta_months,
    delta_probability,
    gap_drivers,
    verdict_frame,
    uplift_multiplier: uplift,
    cta_text,
  };
}

function buildStandardPath(b5ctx: any, confidence: number) {
  return {
    revenue_annual: b5ctx.revenue_mid ?? 0,
    months_to_revenue: b5ctx.months_to_first_revenue ?? 6,
    success_probability: confidence,
    main_trap: b5ctx.main_economic_risk ?? '',
  };
}

function calculateUpliftMultiplier(
  openGapsCount: number,
  blindSpotsCount: number,
  acquisitionType: string,
  cacMid: number | null,
  priceRangeMedian: number | null,
  priceModel: string | null,
  revenueQuality: string,
  monthlyRevenueMid: number | null,
): number {
  let multiplier = 1.0;
  multiplier += openGapsCount * 0.18;
  multiplier += blindSpotsCount * 0.12;

  // PLG opportunity
  if (
    acquisitionType === 'SALES_LED' &&
    (cacMid ?? 0) > 2000 &&
    (priceRangeMedian ?? 999) < 200
  ) {
    multiplier += 0.25;
  }

  // Subscription с LOW quality
  if (priceModel === 'subscription' && revenueQuality === 'LOW') {
    multiplier += 0.15;
  }

  // GATE: Broken economics
  if (monthlyRevenueMid && cacMid) {
    const ltv = monthlyRevenueMid * 12;
    const ltvCacRatio = ltv / cacMid;
    if (ltvCacRatio < 1.2) {
      return Math.min(multiplier, 1.3);
    }
  }

  return Math.min(multiplier, 2.2);
}

function calculateSpeedMultiplier(acquisitionType: string, commercialIntentRatio: number): number {
  let multiplier = 1.0;
  if (acquisitionType === 'SALES_LED') {
    multiplier = 0.65;
  }
  if (commercialIntentRatio > 0.6) {
    multiplier *= 0.8;
  }
  return multiplier;
}

function calculateProbabilityBoost(openGaps: number, blindSpots: number): number {
  const boost = openGaps * 0.05 + blindSpots * 0.04;
  return Math.min(boost, 0.25);
}

function buildGapDrivers(
  gapMap: Array<{ pain: string; status: string; paying_ratio: number }>,
  painClusters: string[],
  acquisitionType: string,
  cacMid: number | null,
  competitionIntensity: string,
  avgSwitchingCost: string,
  blindSpotsCount: number,
  firstSpotTeaser: string | null,
): GapDriver[] {
  const drivers: GapDriver[] = [];

  // Driver 1: Незакрытая боль конкурентов
  const topOpenGap = gapMap
    .filter(g => g.status === 'open')
    .sort((a, b) => b.paying_ratio - a.paying_ratio)[0];

  if (topOpenGap) {
    drivers.push({
      title: `Незакрытая боль: "${topOpenGap.pain}" — ${Math.round(topOpenGap.paying_ratio * 100)}% платящих испытывают это`,
      source: 'block4',
    });
  } else {
    const topPain = painClusters?.[0];
    if (topPain) {
      drivers.push({
        title: `Рыночная боль: "${topPain}" — конкуренты не решили хорошо`,
        source: 'block1_fallback',
      });
    } else {
      drivers.push({
        title: 'Конкуренты не решают главную боль рынка',
        source: 'generic',
      });
    }
  }

  // Driver 2: Неоптимальный канал
  if (acquisitionType === 'SALES_LED' && (cacMid ?? 0) > 1000) {
    drivers.push({
      title: `Канал привлечения: SALES_LED с CAC $${cacMid} — PLG вход в 3-5 раз дешевле`,
      source: 'block5',
    });
  } else if (acquisitionType && acquisitionType !== 'PLG') {
    drivers.push({
      title: `Все используют ${acquisitionType} — альтернативный канал не занят`,
      source: 'block4_fallback',
    });
  } else {
    drivers.push({
      title: `Конкуренция ${competitionIntensity} — стандартный вход не создаёт преимущества`,
      source: 'block4_generic',
    });
  }

  // Driver 3: Слепое пятно
  if (blindSpotsCount > 0 && firstSpotTeaser) {
    drivers.push({
      title: firstSpotTeaser,
      source: 'block6',
    });
  } else {
    const switchingNote = avgSwitchingCost === 'HIGH'
      ? 'Клиентам сложно уйти от конкурентов — нужен нестандартный триггер'
      : 'Нет явных катализаторов смены поставщика';
    drivers.push({
      title: switchingNote,
      source: 'block4_switching',
    });
  }

  return drivers.slice(0, 3);
}

function buildVerdictFrame(
  verdictType: VerdictType,
  deltaRevenue: number,
  standardRevenue: number
): string {
  const deltaF = formatMoney(deltaRevenue);
  const stdF = formatMoney(standardRevenue);

  if (verdictType === 'go_if') {
    return `Ниша работает при стандартном подходе. Но ${deltaF}/год остаются на столе — это разница между хорошим и отличным результатом.`;
  }
  if (verdictType === 'experiment_if') {
    return `Стандартный вход даёт ${stdF}/год с текущей уверенностью. Стратегический вход меняет не только цифры — он меняет вероятность успеха.`;
  }
  return `Стандартный вход в этой нише убыточен. Но данные показывают путь через который математика меняется. Он нестандартный.`;
}

function buildCTAText(verdictType: VerdictType): string {
  if (verdictType === 'go_if') return 'Увидеть как не оставить деньги на столе →';
  if (verdictType === 'experiment_if') return 'Найти ответ в стратегии →';
  return 'Увидеть нестандартный путь →';
}

function formatMoney(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount}`;
}

// ─── UPLIFT LEVEL ────────────────────────────────────────────

export function getUpliftLevel(multiplier: number): string {
  if (multiplier >= 1.8) return 'кратный';
  if (multiplier >= 1.4) return 'значительный';
  return 'умеренный';
}

// ─── CONFIDENCE FORMULA ──────────────────────────────────────

export function calculateConfidence(
  blocks: BlockOutput[],
  conflicts: Conflict[],
  neutralizationsCount: number
): number {
  let confidence = 0.5;

  // +0.05 за каждый GREEN блок
  const greenCount = blocks.filter(b => b.diagnosis === 'green' || b.diagnosis === 'GREEN' as any).length;
  confidence += greenCount * 0.05;

  // -0.15 за каждый экзистенциальный конфликт (weight=3)
  const existentialCount = conflicts.filter(c => c.weight === 3).length;
  confidence -= existentialCount * 0.15;

  // -0.05 за каждый операционный конфликт (weight=2)
  const operationalCount = conflicts.filter(c => c.weight === 2).length;
  confidence -= operationalCount * 0.05;

  // +0.10 за каждую нейтрализацию
  confidence += neutralizationsCount * 0.10;

  // -0.03 за YELLOW блоки с LOW classification_confidence
  const yellowLowConfidence = blocks.filter(b => {
    const ctx = b.block_context as any;
    return (b.diagnosis === 'yellow' || b.diagnosis === 'YELLOW' as any)
      && ctx?.classification_confidence === 'LOW';
  }).length;
  confidence -= yellowLowConfidence * 0.03;

  // -0.10 если unknown_mode в любом блоке
  const b6ctx = getBlockCtx(blocks, 6);
  if (b6ctx.unknown_mode) {
    confidence -= 0.10;
  }

  // -0.05 если blind_spots_impact = HIGH
  if (b6ctx.blind_spots_impact === 'HIGH') {
    confidence -= 0.05;
  }

  return Math.max(0.10, Math.min(0.95, confidence));
}
