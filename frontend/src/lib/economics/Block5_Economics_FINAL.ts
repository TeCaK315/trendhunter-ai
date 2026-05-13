// ============================================================
// TrendHunter AI — Block 5: Economics
// Version: 2.1 | All Copilot fixes applied
// ============================================================
// Changes v2.0 → v2.1:
//   [Critical #7]  Sanity checks BEFORE diagnosis
//   [Critical #2]  Guard at top of calculatePaybackAndBreakeven
//   [Arch #2]      MIN_G2_REVIEWS_FOR_METHOD_A = 50
//   [Arch #5]      Explicit timeline field names (month_24_monthly_revenue)
//   [Impl #1]      buildFailureOutput: freemium + demand_strength
//   [Impl #2]      isEnterprisePLGMismatch: null price not forced to SALES_LED
//   [Impl #3]      English constants for narrative mode enum
//   [Doc]          method_a_note: documents realization_rate only in Method B
// ============================================================

import { z } from 'zod';

// ─── TYPES ──────────────────────────────────────────────────

type EconomicsDiagnosis = 'GREEN' | 'YELLOW' | 'RED';
type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type RevenueQuality = 'HIGH' | 'MEDIUM' | 'LOW';
type AcquisitionType = 'PLG' | 'SALES_LED' | 'SEO_LED' | 'COMMUNITY_LED' | 'UNKNOWN';
type CompetitionIntensity = 'LOW' | 'MEDIUM' | 'HIGH' | 'SATURATED';
type SwitchingCost = 'LOW' | 'MEDIUM' | 'HIGH';
type MonetizationQuality = 'SCALABLE' | 'STABLE' | 'FRAGILE';
type DemandStrength = 'STRONG' | 'MEDIUM' | 'LOW' | 'DECLINING';

// [Impl #3] English constants instead of Cyrillic in enum
type EconomicsNarrativeMode = 'HIGH_CONFIDENCE_GREEN' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE_RED';

const NARRATIVE_MODES_RU: Record<EconomicsNarrativeMode, string> = {
  HIGH_CONFIDENCE_GREEN: 'РЕЖИМ_1',
  MEDIUM_CONFIDENCE: 'РЕЖИМ_2',
  LOW_CONFIDENCE_RED: 'РЕЖИМ_3',
};

export interface Block5Input {
  paying_ratio: number;
  pain_clusters?: string[];
  commercial_intent_ratio: number;
  search_volume: number;
  demand_strength: DemandStrength;
  price_range_median: number | null;
  price_range_confidence?: ConfidenceLevel;
  sale_cycle_days: number;
  monetization_quality: MonetizationQuality;
  price_model: 'subscription' | 'one_time' | 'usage' | 'hybrid' | 'commission' | null;
  friction_score: 'HIGH' | 'MEDIUM' | 'LOW';
  market_type?: 'B2B' | 'B2C';
  entry_verdict: 'GO' | 'EXPERIMENT' | 'HARD';
  gap_map: Array<{ pain: string; status: 'open' | 'partial' | 'closed' | 'unknown'; paying_ratio: number }>;
  competition_intensity: CompetitionIntensity;
  avg_switching_cost: SwitchingCost;
  open_pain_ratio: number;
  acquisition_type: AcquisitionType;
  substitute_strength: 'LOW' | 'MEDIUM' | 'HIGH';
  top_competitor_g2_reviews: number | null;
  top_competitor_size?: 'micro' | 'small' | 'medium' | 'large';
  has_free_tier_competitors?: boolean;
}

export interface Block5Output {
  revenue_low: number | null;
  revenue_mid: number | null;
  revenue_high: number | null;
  monthly_revenue_low: number | null;
  monthly_revenue_mid: number | null;
  monthly_revenue_high: number | null;
  revenue_confidence: ConfidenceLevel;
  method_a_result: number | null;
  method_b_result: number | null;
  method_agreement_delta: number | null;
  revenue_method_agreement: boolean;
  // [Doc] realization_rate applies ONLY to Method B (search_volume based)
  // Method A uses competitor_revenue which already reflects real market money
  method_a_note: string;
  revenue_quality: RevenueQuality;
  realization_rate: number;
  churn_level: 'LOW' | 'MEDIUM' | 'HIGH';
  cac_scenarios: {
    plg: { low: number; mid: number; high: number } | null;
    seo_led: { low: number; mid: number; high: number } | null;
    community_led: { low: number; mid: number; high: number } | null;
    sales_led: { low: number; mid: number; high: number } | null;
    recommended: AcquisitionType;
  };
  cac_spread_flag: boolean;
  months_to_first_revenue: number;
  experiment_budget: number;
  min_valid_clients: number;
  monthly_burn_estimate: number;
  payback_months: number | null;
  payback_status: 'ok' | 'long' | 'not_viable';
  break_even_clients: number | null;
  break_even_warning: boolean;
  // [Arch #5] Explicit names: monthly revenue AT END of period, not cumulative
  cumulative_timeline: {
    month_first_revenue: number;
    month_24_monthly_revenue: number | null;
    month_36_monthly_revenue: number | null;
  };
  diagnosis: EconomicsDiagnosis;
  economics_confidence: ConfidenceLevel;
  main_economic_risk: string;
  revenue_quality_downgrade: boolean;
  high_entry_barrier_flag: boolean;
  leaky_bucket_flag: boolean;
  long_payback_flag: boolean;
  no_market_validation: boolean;
  freemium_flag: boolean;
  data_conflict_flag: boolean;
  data_quality_score: number;
  price_model_warning?: string;
  calculation_notes: string[];
}

// ─── CONSTANTS ──────────────────────────────────────────────

const GAP_STATUS_WEIGHTS = { open: 1.0, partial: 0.5, unknown: 0.2, closed: 0 } as const;

// [Arch #2] Minimum reviews for reliable Method A
const MIN_G2_REVIEWS_FOR_METHOD_A = 50;

// ─── STEP 1: DATA QUALITY CHECK ─────────────────────────────

interface DataQualityResult {
  can_calculate: boolean;
  method_a_available: boolean;
  method_b_available: boolean;
  confidence_cap: ConfidenceLevel;
  flags: {
    paying_ratio_zero: boolean;
    freemium_flag: boolean;
    blue_ocean: boolean;
    enterprise_plg_mismatch: boolean;
    data_scarcity: boolean;
    data_conflict: boolean;
    marketplace_model: boolean;
    declining_demand: boolean;
    enterprise_no_demand: boolean;
    low_price_sanity: boolean;
  };
  warnings: string[];
  stop_reason?: string;
}

export function runDataQualityCheck(input: Block5Input): DataQualityResult {
  const warnings: string[] = [];
  const flags = {
    paying_ratio_zero: false, freemium_flag: false, blue_ocean: false,
    enterprise_plg_mismatch: false, data_scarcity: false, data_conflict: false,
    marketplace_model: false, declining_demand: false, enterprise_no_demand: false,
    low_price_sanity: false,
  };

  if (input.paying_ratio === 0) {
    flags.paying_ratio_zero = true;
    return {
      can_calculate: false, method_a_available: false, method_b_available: false,
      confidence_cap: 'LOW', flags, warnings,
      stop_reason: 'Никто не платит за решение этой проблемы. Коммерческой ценности не обнаружено.',
    };
  }

  // [Arch #2] Minimum 50 reviews for Method A reliability
  const method_a_available = input.top_competitor_g2_reviews !== null
    && input.top_competitor_g2_reviews >= MIN_G2_REVIEWS_FOR_METHOD_A
    && input.price_range_median !== null;

  const method_b_available = input.search_volume > 0 && input.price_range_median !== null;

  if (!method_a_available && !method_b_available) {
    return {
      can_calculate: false, method_a_available: false, method_b_available: false,
      confidence_cap: 'LOW', flags,
      warnings: ['Недостаточно данных для расчёта Revenue Range'],
      stop_reason: 'Нет данных о ценах конкурентов и поисковом спросе.',
    };
  }

  let confidence_cap: ConfidenceLevel = 'HIGH';

  if (input.price_range_median !== null && input.price_range_median < 15
    && input.paying_ratio < 0.05 && input.has_free_tier_competitors) {
    flags.freemium_flag = true;
    warnings.push('Freemium ниша. Монетизация требует масштаба 100K+ пользователей.');
    confidence_cap = 'MEDIUM';
  }

  if (!method_a_available && input.search_volume > 1000) {
    flags.blue_ocean = true;
    warnings.push('Blue Ocean: конкурентов нет. Рынок не подтверждён данными.');
    confidence_cap = 'LOW';
  }

  // [Impl #2] Only explicit price > $500 triggers mismatch. Null = unknown, not forced.
  if (input.price_range_median !== null && input.price_range_median > 500
    && input.acquisition_type === 'PLG') {
    flags.enterprise_plg_mismatch = true;
    warnings.push('Enterprise ($500+) редко через PLG. CAC скорректирован к SALES_LED.');
  }

  if ((input.top_competitor_g2_reviews ?? 0) < 100 && input.search_volume < 1000) {
    flags.data_scarcity = true;
    warnings.push('Мало данных. Оценка ориентировочная.');
    confidence_cap = 'MEDIUM';
  }

  if (input.competition_intensity === 'LOW' && input.entry_verdict === 'HARD') {
    flags.data_conflict = true;
    warnings.push('Противоречие: низкая конкуренция, но HARD вход. Проверьте Блок 4.');
    confidence_cap = 'LOW';
  }

  if (input.price_model === 'commission') {
    flags.marketplace_model = true;
    warnings.push('Маркетплейс модель. Формулы SaaS — цифры ориентировочные.');
    confidence_cap = 'MEDIUM';
  }

  if (input.demand_strength === 'DECLINING') {
    flags.declining_demand = true;
    warnings.push('Падающий спрос. Выручка конкурентов × 0.6.');
  }

  if (input.price_range_median !== null && input.price_range_median > 500 && input.search_volume < 500) {
    flags.enterprise_no_demand = true;
    warnings.push('Enterprise без поискового спроса. Рынок через прямые продажи.');
    confidence_cap = confidence_cap === 'HIGH' ? 'MEDIUM' : confidence_cap;
  }

  if (input.price_range_median !== null && input.price_range_median < 20
    && (input.acquisition_type === 'SALES_LED' || input.price_model === 'subscription')
    && input.market_type === 'B2B') {
    flags.low_price_sanity = true;
    warnings.push(`Цена $${input.price_range_median} аномально низка для B2B. Проверьте Блок 3.`);
    confidence_cap = 'MEDIUM';
  }

  if (input.price_range_confidence === 'LOW') confidence_cap = 'LOW';
  else if (input.price_range_confidence === 'MEDIUM' && confidence_cap === 'HIGH') confidence_cap = 'MEDIUM';

  return { can_calculate: true, method_a_available, method_b_available, confidence_cap, flags, warnings };
}

// ─── STEP 2: REVENUE QUALITY ─────────────────────────────────

interface RevenueQualityResult {
  quality: RevenueQuality;
  realization_rate: number;
  churn_level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string;
}

export function calculateRevenueQuality(input: Block5Input): RevenueQualityResult {
  let base: RevenueQuality = input.price_model === 'subscription' ? 'HIGH'
    : (input.price_model === 'hybrid' || input.price_model === 'usage') ? 'MEDIUM' : 'LOW';

  const levels: RevenueQuality[] = ['LOW', 'MEDIUM', 'HIGH'];
  let qi = levels.indexOf(base);
  if (input.monetization_quality === 'SCALABLE') qi = Math.min(2, qi + 1);
  if (input.monetization_quality === 'FRAGILE') qi = Math.max(0, qi - 1);
  if (input.substitute_strength === 'HIGH') qi = Math.max(0, qi - 1);
  const quality = levels[qi];

  const lowScore = (input.avg_switching_cost === 'HIGH' ? 2 : 0) + (input.substitute_strength === 'LOW' ? 1 : 0) + (!input.has_free_tier_competitors ? 1 : 0);
  const highScore = (input.avg_switching_cost === 'LOW' ? 2 : 0) + (input.substitute_strength === 'HIGH' ? 2 : 0) + (input.has_free_tier_competitors ? 1 : 0);
  const churn_level: 'LOW' | 'MEDIUM' | 'HIGH' = lowScore >= 3 ? 'LOW' : highScore >= 3 ? 'HIGH' : 'MEDIUM';

  const churnMult = { LOW: 1.0, MEDIUM: 0.8, HIGH: 0.6 }[churn_level];
  const baseRates: Record<RevenueQuality, number> = { HIGH: 0.50, MEDIUM: 0.35, LOW: 0.20 };
  const modelMult = input.price_model === 'one_time' ? 0.6 : 1.0;
  const realization_rate = baseRates[quality] * churnMult * modelMult;

  return { quality, realization_rate, churn_level, reasoning: `${quality}: ${input.price_model} + ${input.monetization_quality} + churn ${churn_level}` };
}

// ─── STEP 3: REVENUE RANGE ───────────────────────────────────

interface RevenueRangeResult {
  method_a: number | null;
  method_b: number | null;
  revenue_low: number;
  revenue_mid: number;
  revenue_high: number;
  confidence: ConfidenceLevel;
  market_share_used: number | null;
  delta_percent: number | null;
  method_a_note: string;
}

const METHOD_A_NOTE = 'Method A: realization_rate NOT applied. competitor_revenue = real market money. realization_rate applies ONLY to Method B (theoretical search_volume → real revenue).';

function calcWeightedGap(gapMap: Block5Input['gap_map']): number {
  if (!gapMap.length) return 0;
  let max = 0;
  for (const g of gapMap) { const v = g.paying_ratio * GAP_STATUS_WEIGHTS[g.status]; if (v > max) max = v; }
  const strong = gapMap.filter(g => g.paying_ratio > 0.5 && (g.status === 'open' || g.status === 'partial')).length;
  return max * (strong >= 2 ? 1.2 : 1.0);
}

function getBaseShare(ev: Block5Input['entry_verdict'], ci: CompetitionIntensity, bo: boolean): number {
  if (bo) return 0.05;
  if (ev === 'GO') return ci === 'LOW' ? 0.03 : ci === 'MEDIUM' ? 0.02 : 0.015;
  if (ev === 'EXPERIMENT') return 0.01;
  return 0.005;
}

export function calculateRevenueRange(input: Block5Input, qr: RevenueQualityResult, dq: DataQualityResult): RevenueRangeResult {
  const isBO = dq.flags.blue_ocean;
  const cap = isBO ? 0.10 : 0.15;
  let method_a: number | null = null;
  let msu: number | null = null;

  if (dq.method_a_available && input.top_competitor_g2_reviews && input.price_range_median) {
    let cr = input.top_competitor_g2_reviews * 7 * input.price_range_median * 12;
    if (dq.flags.declining_demand) cr *= 0.6;
    const bs = getBaseShare(input.entry_verdict, input.competition_intensity, isBO);
    const gv = calcWeightedGap(input.gap_map);
    const sm = input.avg_switching_cost === 'HIGH' ? 0.85 : input.avg_switching_cost === 'LOW' ? 1.15 : 1.0;
    let ms = bs * (1 + gv * 0.3) * sm;
    ms = Math.max(0.005, Math.min(cap, ms));
    msu = ms;
    // NO realization_rate in Method A — double counting prevention
    method_a = cr * ms;
    if (!Number.isFinite(method_a) || method_a < 0) method_a = null;
  }

  let method_b: number | null = null;
  if (dq.method_b_available && input.price_range_median) {
    const cr = input.commercial_intent_ratio > 0.6 ? 0.02 : input.commercial_intent_ratio > 0.3 ? 0.01 : 0.005;
    // DCF: separate factor from realization_rate
    // realization_rate = % of theoretical demand that converts
    // DCF = multiplier because search_volume underestimates B2B demand
    let dcf = input.acquisition_type === 'SALES_LED' ? 1.5 : input.acquisition_type === 'PLG' ? 1.2 : input.acquisition_type === 'UNKNOWN' ? 1.3 : 1.0;
    if (qr.realization_rate > 0.4 && dcf > 1.5) dcf = 1.5;
    let pa: number;
    if (input.paying_ratio >= 0.15) pa = 1.1;
    else if (input.paying_ratio >= 0.10) pa = 1.0;
    else if (input.paying_ratio >= 0.05) pa = 0.5 + input.paying_ratio * 10;
    else pa = Math.pow(input.paying_ratio / 0.05, 2);
    method_b = input.search_volume * 12 * cr * input.price_range_median * qr.realization_rate * dcf * pa;
    if (!Number.isFinite(method_b) || method_b < 0) method_b = null;
  }

  if (!method_a && !method_b) return { method_a: null, method_b: null, revenue_low: 0, revenue_mid: 0, revenue_high: 0, confidence: 'LOW', market_share_used: null, delta_percent: null, method_a_note: METHOD_A_NOTE };
  if (isBO) { const b = method_b!; return { method_a: null, method_b: b, revenue_low: b*0.7, revenue_mid: b, revenue_high: b*1.3, confidence: 'LOW', market_share_used: null, delta_percent: null, method_a_note: METHOD_A_NOTE }; }
  if (!method_a || !method_b) { const b = method_a ?? method_b!; return { method_a, method_b, revenue_low: b*0.7, revenue_mid: b, revenue_high: b*1.5, confidence: 'LOW', market_share_used: msu, delta_percent: null, method_a_note: METHOD_A_NOTE }; }

  const dp = Math.abs(method_a - method_b) / Math.max(method_a, method_b);
  const conf: ConfidenceLevel = dp < 0.30 && input.paying_ratio > 0.3 ? 'HIGH' : dp < 0.30 ? 'MEDIUM' : dp < 0.70 ? 'MEDIUM' : 'LOW';
  const rm = conf === 'HIGH' ? 0.30 : conf === 'MEDIUM' ? 0.50 : 2.00;
  const mid = (method_a + method_b) / 2;
  return { method_a, method_b, revenue_low: Math.min(method_a, method_b)*(1-rm*0.5), revenue_mid: mid, revenue_high: Math.max(method_a, method_b)*(1+rm*0.5), confidence: conf, market_share_used: msu, delta_percent: dp, method_a_note: METHOD_A_NOTE };
}

// ─── STEP 4: CAC SCENARIOS ───────────────────────────────────

interface CACScenario { low: number; mid: number; high: number; }
interface CACResult { plg: CACScenario | null; seo_led: CACScenario | null; community_led: CACScenario | null; sales_led: CACScenario | null; recommended: AcquisitionType; cac_spread_flag: boolean; }

export function calculateCACScenarios(input: Block5Input): CACResult {
  // ── Niche-dependent CAC: базируется на среднем чеке продукта, не на константах ──
  // Эмпирика: PLG CAC ≈ 2–3× MRR, SEO ≈ 4–5× MRR, Sales-led ≈ 40-80% ACV
  // Fallback цена с учётом market_type (B2C ≠ enterprise $500)
  const monthlyPrice = input.price_range_median ?? (() => {
    const mt = input.market_type;
    const pt = input.price_model; // proxy for tier context
    if (mt === 'B2C') return 20;          // B2C default — budget
    if (mt === 'B2B') return pt === 'subscription' ? 150 : 80;
    return 40;                            // mixed default
  })();

  // Мультипликаторы из контекста ниши
  const intentMult = input.commercial_intent_ratio > 0.6 ? 0.8 : input.commercial_intent_ratio > 0.3 ? 1.0 : 1.5;
  const switchingMult = input.market_type === 'B2B' ? (input.avg_switching_cost === 'HIGH' ? 1.3 : input.avg_switching_cost === 'LOW' ? 0.8 : 1.0) : 1.0;
  const frictionMult = input.friction_score === 'LOW' ? 0.8 : input.friction_score === 'HIGH' ? 1.4 : 1.0;

  // Коэффициент конкурентности (больше конкурентов → дороже привлечение)
  const competitorCount = (input.gap_map ?? []).length;
  const competitionMult = competitorCount > 20 ? 2.0 : competitorCount > 10 ? 1.5 : competitorCount > 5 ? 1.2 : 1.0;

  // Сегмент (B2B/B2C)
  const segmentMult = input.market_type === 'B2C' ? 1.0 : input.market_type === 'B2B' ? 2.0 : 1.5;

  // PLG CAC: monthlyPrice × 2.5 × friction × competition × intent
  // + ceiling по market_type чтобы B2C не получал CAC $1500
  const plgCeiling = input.market_type === 'B2C' ? 500 : input.market_type === 'B2B' ? 8000 : 2000;
  const plgBase = Math.min(
    plgCeiling,
    Math.round(monthlyPrice * 2.5 * frictionMult * competitionMult * intentMult),
  );

  // SEO CAC: PLG × 2 (нужен контент, SEO, время)
  const seoBase = Math.round(plgBase * 2.0);

  // Community CAC: PLG × 0.9 (органика, дешевле но медленнее)
  const communityBase = Math.round(plgBase * 0.9);

  // Sales-led CAC: зависит от сегмента и ACV
  const acv = monthlyPrice * 12;
  const salesBase = Math.round(acv * (input.market_type === 'B2C' ? 0.4 : input.market_type === 'B2B' ? 0.8 : 0.6) * competitionMult * switchingMult);

  // Диапазоны: low = mid × 0.5, high = mid × 2
  const range = (mid: number, minFloor: number): CACScenario => ({
    low: Math.round(Math.max(minFloor * 0.5, mid * 0.5)),
    mid: Math.max(minFloor, mid),
    high: Math.round(Math.max(minFloor * 2, mid * 2.0)),
  });

  // [Impl #2] Only explicit price > $500 = mismatch for PLG
  const isEPM = input.price_range_median !== null && input.price_range_median > 500 && input.acquisition_type === 'PLG';
  const plg = isEPM ? null : range(plgBase, 30);
  const seo_led = range(seoBase, 80);
  const community_led = range(communityBase, 25);
  const sales_led = range(salesBase, 200);

  const recommended: AcquisitionType = isEPM ? 'SALES_LED' : input.acquisition_type === 'UNKNOWN' ? 'SEO_LED' : input.acquisition_type;
  const avail = [plg, seo_led, community_led, sales_led].filter(Boolean) as CACScenario[];
  const spread = avail.length >= 2 && Math.max(...avail.map(s=>s.high)) / Math.min(...avail.map(s=>s.low)) > 5;
  return { plg, seo_led, community_led, sales_led, recommended, cac_spread_flag: spread };
}

function getRecommendedMid(cs: CACResult): number {
  const k = cs.recommended === 'PLG' ? 'plg' : cs.recommended === 'SEO_LED' ? 'seo_led' : cs.recommended === 'COMMUNITY_LED' ? 'community_led' : 'sales_led';
  const s = cs[k]; return (s && 'mid' in s) ? s.mid : 500;
}

// ─── STEP 5: MONTHS ──────────────────────────────────────────

export function calculateMonthsToRevenue(input: Block5Input): number {
  let m = input.sale_cycle_days / 30;
  const am: Record<AcquisitionType, number> = { PLG:0.7, SEO_LED:1.2, COMMUNITY_LED:1.3, SALES_LED:1.5, UNKNOWN:1.0 };
  m *= am[input.acquisition_type];
  if (input.friction_score === 'HIGH') m *= 1.3; else if (input.friction_score === 'LOW') m *= 0.8;
  if (input.market_type === 'B2B' && input.avg_switching_cost === 'HIGH') m *= 1.5;
  return Math.min(36, Math.max(0.5, m));
}

// ─── STEP 6: EXPERIMENT BUDGET ───────────────────────────────

interface ExperimentBudgetResult { budget: number; min_valid_clients: number; monthly_burn: number; high_entry_barrier: boolean; relative_label: string; }

export function calculateExperimentBudget(input: Block5Input, cs: CACResult, months: number, revMid: number | null, conf: ConfidenceLevel): ExperimentBudgetResult {
  const p = input.price_range_median ?? 50;
  const model = input.price_model ?? 'subscription';
  const mvc = model === 'subscription' ? (p > 500 ? 8 : p >= 50 ? 15 : 30) : (p > 500 ? 10 : 50);
  const a = input.acquisition_type;
  const mb = a === 'SALES_LED' && p > 500 ? 8000 : a === 'SALES_LED' ? 4000 : a === 'PLG' ? 2000 : a === 'SEO_LED' ? 3000 : a === 'COMMUNITY_LED' ? 2500 : 3000;
  const cac = getRecommendedMid(cs);
  const mfb = Math.max(1, months); // [Critical #3] minimum 1 month always
  const cm = conf === 'HIGH' ? 1.5 : conf === 'MEDIUM' ? 2.0 : 3.0;
  const budget = Math.round((cac * mvc + mfb * mb) * cm);
  const mr = revMid ? revMid / 12 : null;
  const heb = mr !== null && budget > mr * 3;
  const rl = budget < 5000 ? 'Можно стартовать в выходные' : budget < 20000 ? 'Нужен параллельный доход или небольшой инвестор' : budget < 50000 ? 'Серьёзный эксперимент — нужно планировать' : 'Это уже бизнес-ставка, не эксперимент';
  return { budget, min_valid_clients: mvc, monthly_burn: mb, high_entry_barrier: heb, relative_label: rl };
}

// ─── STEP 6b: PAYBACK & BREAK-EVEN ───────────────────────────

interface PaybackResult { payback_months: number | null; payback_status: 'ok' | 'long' | 'not_viable'; break_even_clients: number | null; break_even_warning: boolean; }

export function calculatePaybackAndBreakeven(input: Block5Input, cs: CACResult, mb: number): PaybackResult {
  const price = input.price_range_median;
  // [Critical #2] Guard at top — price must be valid
  if (!price || price <= 0) return { payback_months: null, payback_status: 'not_viable', break_even_clients: null, break_even_warning: false };
  const cac = getRecommendedMid(cs);
  let pm: number | null = null;
  let ps: 'ok' | 'long' | 'not_viable' = 'ok';
  if (price < cac * 0.1) { ps = 'not_viable'; }
  else { pm = Math.round(cac / price * 10) / 10; ps = pm > 24 ? 'not_viable' : pm > 8 ? 'long' : 'ok'; }
  let bec: number | null = null; let bew = false;
  if (price >= 20) { bec = Math.ceil(mb / price); if (bec > 500) bew = true; }
  return { payback_months: pm, payback_status: ps, break_even_clients: bec, break_even_warning: bew };
}

// ─── STEP 7: SANITY CHECKS (BEFORE diagnosis) ────────────────
// [Critical #7] Must run BEFORE calculateDiagnosis

interface SanityResult { passed: boolean; notes: string[]; should_downgrade_confidence: boolean; }

export function runSanityChecks(rm: number | null, cm: number | null, ms: number | null, months: number): SanityResult {
  const notes: string[] = []; let passed = true; let sdc = false;
  if (rm !== null) {
    if (rm <= 0) { notes.push('Revenue ≤ 0'); passed = false; sdc = true; }
    if (rm > 500_000_000) { notes.push('Revenue > $500M — check inputs'); passed = false; sdc = true; }
  }
  if (cm && rm && cm > rm * 0.5) { notes.push('CAC > 50% Revenue — unit economics broken'); sdc = true; }
  if (ms !== null && ms > 0.15) { notes.push('Market share > 15% — unrealistic for new entrant'); passed = false; sdc = true; }
  if (months > 36) { notes.push('Months > 36 — horizon too long'); sdc = true; }
  return { passed, notes, should_downgrade_confidence: sdc };
}

// ─── STEP 8: MAIN RISK ───────────────────────────────────────

export function determineMainRisk(input: Block5Input, cacMid: number | null, revMid: number | null, months: number, rq: RevenueQuality, ps: string): string {
  if (ps === 'not_viable') return 'CAC не окупается при текущем чеке';
  if (input.avg_switching_cost === 'LOW' && rq !== 'HIGH') return 'Высокий churn — клиенты легко уходят к конкурентам';
  if (months > 6 && !input.has_free_tier_competitors) return `Кассовый разрыв: ${Math.round(months)} месяцев до первой выручки`;
  if (input.competition_intensity === 'SATURATED') return 'Ценовая война — насыщенный рынок снижает маржу';
  if (input.substitute_strength === 'HIGH') return 'Пользователи терпят бесплатное решение';
  if (rq === 'LOW') return 'Нет повторяемой выручки — каждый месяц нужны новые клиенты';
  return 'Неопределённость рынка — данных недостаточно';
}

// ─── STEP 9: DIAGNOSIS (AFTER sanity checks) ─────────────────

export function calculateDiagnosis(rm: number | null, months: number, conf: ConfidenceLevel, rq: RevenueQuality, eb: number, input: Block5Input, dq: DataQualityResult): EconomicsDiagnosis {
  if (conf === 'LOW') return 'YELLOW';
  if (dq.flags.blue_ocean) return rm && rm > 0 ? 'YELLOW' : 'RED';
  // [Impl #1] Freemium depends on demand_strength
  if (dq.flags.freemium_flag) return input.demand_strength === 'DECLINING' ? 'RED' : 'YELLOW';
  if (!rm) return 'RED';
  const p = input.price_range_median ?? 0;
  const s = p < 100 ? 'smb' : p < 500 ? 'mid' : 'ent';
  const t = { smb:{g:50000,r:15000,gm:12,rm:24}, mid:{g:150000,r:50000,gm:18,rm:30}, ent:{g:500000,r:150000,gm:24,rm:36} }[s];
  if (rm < t.r) return 'RED';
  if (months > t.rm) return 'RED';
  if (eb > 50000 && rm < t.r * 2) return 'RED';
  if (rq === 'LOW' && rm < t.r * 1.5) return 'RED';
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return (rm > t.g && months < t.gm && rq !== 'LOW' && (conf as string) !== 'LOW') ? 'GREEN' : 'YELLOW';
}

// ─── HELPERS ─────────────────────────────────────────────────

function applyConfidenceCap(cur: ConfidenceLevel, cap: ConfidenceLevel): ConfidenceLevel {
  const l = ['LOW','MEDIUM','HIGH'];
  return l[Math.min(l.indexOf(cur), l.indexOf(cap))] as ConfidenceLevel;
}

function calcDQScore(input: Block5Input, dq: DataQualityResult, conf: ConfidenceLevel): number {
  let s = 5;
  if ((input.top_competitor_g2_reviews ?? 0) >= MIN_G2_REVIEWS_FOR_METHOD_A) s++;
  if (input.search_volume > 1000) s++;
  if (input.price_range_median && input.price_range_median > 0) s++;
  if (conf === 'HIGH') s++; else if (conf === 'LOW') s--;
  if (dq.flags.data_conflict) s -= 2;
  if (dq.flags.data_scarcity) s--;
  return Math.min(10, Math.max(0, s));
}

function calcTimeline(months: number, revMid: number | null): Block5Output['cumulative_timeline'] {
  if (!revMid) return { month_first_revenue: Math.ceil(months), month_24_monthly_revenue: null, month_36_monthly_revenue: null };
  const m = revMid / 12;
  return {
    month_first_revenue: Math.ceil(months),
    month_24_monthly_revenue: Math.round(m * 0.7),  // Monthly revenue at end of year 2
    month_36_monthly_revenue: Math.round(m),          // Monthly revenue at end of year 3
  };
}

function buildFailureOutput(input: Block5Input, dq: DataQualityResult): Block5Output {
  const cs = calculateCACScenarios(input);
  const months = calculateMonthsToRevenue(input);
  // [Impl #1] Freemium + demand_strength in failure path
  const diag: EconomicsDiagnosis = dq.flags.paying_ratio_zero ? 'RED'
    : (dq.flags.freemium_flag && input.demand_strength === 'DECLINING') ? 'RED' : 'YELLOW';
  return {
    revenue_low: null as any, revenue_mid: null as any, revenue_high: null as any,
    monthly_revenue_low: null as any, monthly_revenue_mid: null as any, monthly_revenue_high: null as any,
    revenue_confidence: 'LOW', method_a_result: null, method_b_result: null, method_agreement_delta: null,
    revenue_method_agreement: false,
    method_a_note: 'Method A unavailable — insufficient competitor data',
    revenue_quality: 'LOW', realization_rate: 0.2, churn_level: 'HIGH',
    cac_scenarios: cs, cac_spread_flag: false, months_to_first_revenue: months,
    experiment_budget: 0, min_valid_clients: 0, monthly_burn_estimate: 0,
    payback_months: null, payback_status: 'not_viable', break_even_clients: null, break_even_warning: false,
    cumulative_timeline: { month_first_revenue: Math.ceil(months), month_24_monthly_revenue: null, month_36_monthly_revenue: null },
    diagnosis: diag, economics_confidence: 'LOW', main_economic_risk: dq.stop_reason ?? 'Insufficient data',
    revenue_quality_downgrade: true, high_entry_barrier_flag: false, leaky_bucket_flag: false,
    long_payback_flag: false, no_market_validation: dq.flags.blue_ocean,
    freemium_flag: dq.flags.freemium_flag, data_conflict_flag: dq.flags.data_conflict,
    data_quality_score: 1, calculation_notes: dq.warnings,
  };
}

// ─── MAIN PIPELINE ───────────────────────────────────────────

export function runBlock5Pipeline(input: Block5Input): Block5Output {
  const notes: string[] = [];

  // STEP 1: Data Quality (FIRST — before any calculations)
  const dq = runDataQualityCheck(input);
  if (!dq.can_calculate) return buildFailureOutput(input, dq);
  notes.push(...dq.warnings);

  // STEP 2: Revenue Quality
  const qr = calculateRevenueQuality(input);

  // STEP 3: Revenue Range
  const rr = calculateRevenueRange(input, qr, dq);
  let conf = applyConfidenceCap(rr.confidence, dq.confidence_cap);

  // STEP 4: CAC
  const cs = calculateCACScenarios(input);
  const cacMid = getRecommendedMid(cs);

  // STEP 5: Months
  const months = calculateMonthsToRevenue(input);

  // STEP 6: Budget
  const br = calculateExperimentBudget(input, cs, months, rr.revenue_mid, conf);

  // STEP 6b: Payback
  const pr = calculatePaybackAndBreakeven(input, cs, br.monthly_burn);

  // STEP 7: Risk
  const risk = determineMainRisk(input, cacMid, rr.revenue_mid, months, qr.quality, pr.payback_status);

  // [Critical #7] STEP 8: Sanity checks BEFORE diagnosis
  const sr = runSanityChecks(rr.revenue_mid, cacMid, rr.market_share_used, months);
  notes.push(...sr.notes);
  if (sr.should_downgrade_confidence) conf = 'LOW';

  // [Critical #7] STEP 9: Diagnosis AFTER sanity checks
  const diag = calculateDiagnosis(rr.revenue_mid, months, conf, qr.quality, br.budget, input, dq);
  const tl = calcTimeline(months, rr.revenue_mid);
  const dqs = calcDQScore(input, dq, conf);

  return {
    revenue_low: rr.revenue_low, revenue_mid: rr.revenue_mid, revenue_high: rr.revenue_high,
    monthly_revenue_low: rr.revenue_low / 12, monthly_revenue_mid: rr.revenue_mid / 12, monthly_revenue_high: rr.revenue_high / 12,
    revenue_confidence: conf, method_a_result: rr.method_a, method_b_result: rr.method_b,
    method_agreement_delta: rr.delta_percent,
    revenue_method_agreement: rr.delta_percent !== null ? Math.abs(rr.delta_percent) < 0.5 : false,
    method_a_note: rr.method_a_note,
    revenue_quality: qr.quality, realization_rate: qr.realization_rate, churn_level: qr.churn_level,
    cac_scenarios: cs, cac_spread_flag: cs.cac_spread_flag,
    months_to_first_revenue: months,
    experiment_budget: br.budget, min_valid_clients: br.min_valid_clients, monthly_burn_estimate: br.monthly_burn,
    payback_months: pr.payback_months, payback_status: pr.payback_status, break_even_clients: pr.break_even_clients, break_even_warning: pr.break_even_warning,
    cumulative_timeline: tl, diagnosis: diag, economics_confidence: conf, main_economic_risk: risk,
    revenue_quality_downgrade: qr.quality === 'LOW', high_entry_barrier_flag: br.high_entry_barrier,
    leaky_bucket_flag: qr.quality === 'LOW' && input.substitute_strength === 'HIGH',
    long_payback_flag: pr.payback_status === 'long' || pr.payback_status === 'not_viable',
    no_market_validation: dq.flags.blue_ocean, freemium_flag: dq.flags.freemium_flag, data_conflict_flag: dq.flags.data_conflict,
    data_quality_score: dqs,
    price_model_warning: dq.flags.marketplace_model ? 'Маркетплейс модель — формулы ориентировочные' : undefined,
    calculation_notes: notes,
  };
}

// ─── NARRATIVE ENGINE PROMPT ─────────────────────────────────

export const ECONOMICS_NARRATIVE_PROMPT = `
Ты — аналитик экономики ниш. Пишешь для предпринимателей, не финансистов.
Язык: русский. Выводи ТОЛЬКО валидный JSON без markdown.

ВХОДНЫЕ ДАННЫЕ:
- diagnosis: {{diagnosis}}
- revenue_mid: {{revenue_mid}}
- revenue_low: {{revenue_low}}
- revenue_high: {{revenue_high}}
- revenue_confidence: {{revenue_confidence}}
- revenue_quality: {{revenue_quality}}
- churn_level: {{churn_level}}
- months_to_first_revenue: {{months_to_first_revenue}}
- payback_months: {{payback_months}}
- payback_status: {{payback_status}}
- break_even_clients: {{break_even_clients}}
- experiment_budget: {{experiment_budget}}
- min_valid_clients: {{min_valid_clients}}
- high_entry_barrier: {{high_entry_barrier}}
- main_economic_risk: {{main_economic_risk}}
- cac_recommended_mid: {{cac_recommended_mid}}
- recommended_acquisition: {{recommended_acquisition}}
- cumulative_timeline: {{cumulative_timeline}}
- price_model: {{price_model}}
- freemium_flag: {{freemium_flag}}
- niche_name: {{niche_name}}
- narrative_mode: {{narrative_mode}}

РЕЖИМЫ:

HIGH_CONFIDENCE_GREEN:
  - Первое предложение: конкретная цифра + инсайт
  - ЗАПРЕЩЕНО: "анализ показывает", "данные демонстрируют"
  - Якорь: "Путь к деньгам здесь есть — вопрос в скорости входа."

MEDIUM_CONFIDENCE:
  - Начало: "Экономика [niche_name]..."
  - Якорь: "Деньги возможны — при правильном выборе модели входа."

LOW_CONFIDENCE_RED:
  - ПЕРВОЕ ПРЕДЛОЖЕНИЕ = оговорка о данных
  - Начало: "Данных по [niche_name] достаточно только для оценочного вывода..."
  - Якорь: "Перед входом стоит проверить экономику на реальных сделках."

Revenue Quality — объяснить явно. При LOW — гипотетическое сравнение (маркировать).
Experiment Budget — два слоя: N клиентов → бюджет $X.
Мостик в Стратегию — ВСЕГДА.

ВЫВОД — ТОЛЬКО JSON:
{
  "narrative_economics": "string (4-6 предложений)",
  "revenue_quality_explanation": "string (1-2 предложения)",
  "experiment_budget_explanation": "string (2-3 предложения)",
  "payback_explanation": "string | null",
  "bridge_to_strategy": "string (1 предложение)"
}
`.trim();

// [Impl #3] English constants → UI maps to Russian
export function selectEconomicsNarrativeMode(diag: EconomicsDiagnosis, conf: ConfidenceLevel): EconomicsNarrativeMode {
  if (conf === 'LOW' || diag === 'RED') return 'LOW_CONFIDENCE_RED';
  if (diag === 'GREEN' && conf === 'HIGH') return 'HIGH_CONFIDENCE_GREEN';
  return 'MEDIUM_CONFIDENCE';
}

// ─── BLOCK 7 RULES ───────────────────────────────────────────
/*
Add to conflict-detection.ts:

Rule 13: Economics != RED + high_entry_barrier = true
  → manageable: "GO только с капиталом"

Rule 14: leaky_bucket_flag = true
  → operational: "Retention Hell"

Rule 15: cac_spread_flag = true
  → manageable: "Экономика зависит от выбора канала"

Rule 16: long_payback_flag = true
  → operational: "Долгая окупаемость"

Arbitrator logic:
  no_market_validation = true → verdict max EXPERIMENT
  revenue_quality_downgrade = true → GO → EXPERIMENT
*/
