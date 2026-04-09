// ============================================================
// TrendHunter AI — Block 6: Blind Spots (Слепые пятна)
// Version: 2.1 | All Copilot audit fixes applied
// ============================================================
// Changes v1.0 → v2.1:
//   [Critical #5]  churn_level HIGH maps to churn_rate > 0.08
//   [Critical #6]  buildSupportingData: guard + fallback when empty
//   [Critical #7]  BLIND_SPOT_SYSTEM_PROMPT: positive examples added
//   [Arch #1]      shouldTriggerUnknown called on pre-filter clusters
//   [Arch #4]      estimateActionability: weighted average not multiply
//   [Arch #6]      applyKillSwitches: adaptive thresholds
//   [Impl #1]      filterCategoryNorms: no in-place mutation
//   [Impl #2]      buildLLMPayload: empty clusters guard
//   [Impl #3]      estimateRevenueImpact: console.warn for unknown signal
//   [Impl #4]      VALIDATION_PROMPT: {{spot_type}} added
// ============================================================

// ─── TYPES ──────────────────────────────────────────────────

export type BlindSpotType = 'CONTRADICTION' | 'STRUCTURAL' | 'BEHAVIORAL' | 'TIMING' | 'UNKNOWN';
export type InsightPosition = '1_doubt' | '2_mechanism' | '3_strategic_turn';
export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
type ExternalRelation = 'confirm' | 'contradict_soft' | 'contradict_hard' | 'neutral';

export interface BlocksData {
  paying_ratio: number;
  pain_clusters: string[];
  search_volume: number;
  commercial_intent_ratio: number;
  demand_strength: 'STRONG' | 'MEDIUM' | 'LOW' | 'DECLINING';
  rising_queries?: string[];
  price_range_median: number | null;
  price_model: 'subscription' | 'one_time' | 'usage' | 'hybrid' | 'commission' | null;
  monetization_quality: 'SCALABLE' | 'STABLE' | 'FRAGILE';
  entry_verdict: 'GO' | 'EXPERIMENT' | 'HARD';
  competition_intensity: 'LOW' | 'MEDIUM' | 'HIGH' | 'SATURATED';
  avg_switching_cost: 'LOW' | 'MEDIUM' | 'HIGH';
  substitute_strength: 'LOW' | 'MEDIUM' | 'HIGH';
  gap_map: Array<{ pain: string; status: string; paying_ratio: number }>;
  acquisition_type: 'PLG' | 'SALES_LED' | 'SEO_LED' | 'COMMUNITY_LED' | 'UNKNOWN';
  top_competitor_name?: string;
  revenue_mid: number | null;
  monthly_revenue_mid: number | null;
  cac_mid: number | null;
  experiment_budget: number | null;
  revenue_quality: 'HIGH' | 'MEDIUM' | 'LOW';
  churn_level: 'LOW' | 'MEDIUM' | 'HIGH';
  economics_confidence: ConfidenceLevel;
  payback_months: number | null;
  niche: string;
  market_type?: 'B2B' | 'B2C';
  category?: string;
}

interface Anomaly {
  id: string;
  type: BlindSpotType;
  signal: string;
  expected: string;
  reality: string;
  impact_vector: Array<'revenue' | 'cac' | 'strategy'>;
  confidence: number;
  impact?: number;
  contradiction_level?: number;
  actionability?: number;
  score?: number;
  strategy_impact?: number;
}

export interface Cluster {
  id: string;
  type: BlindSpotType;
  signals: Anomaly[];
  score: number;
  confidence: number;
  unique_signal_sources: number;
  force_unknown?: boolean;
  external_relation?: ExternalRelation;
}

export interface LLMPayload {
  mode: 'normal' | 'unknown';
  insights?: InsightPayload[];
  unknown_output?: UnknownOutput;
}

export interface InsightPayload {
  type: BlindSpotType;
  position: InsightPosition;
  expected: string;
  reality: string;
  mechanism_context: string;
  supporting_data: Record<string, string | number>;
  action: string | null;
  window_months?: number;
  constraint_layer: ConstraintLayer;
  action_frame: ActionFrame;
}

interface ConstraintLayer {
  must_explain_gap: boolean;
  must_link_to_metric: string[];
  allowed_reasoning_types: string[];
  forbidden: string[];
}

interface ActionFrame {
  must_include_tradeoff: boolean;
  must_include_risk: boolean;
}

export interface UnknownOutput {
  reason: string;
  questions: string[];
  bet_frame: string;
  risk_frame: string;
}

export interface ExternalSignal {
  text: string;
  weight: number;
  source: string;
}

export interface TrendData {
  time_to_saturation_months?: number;
  build_time_months?: number;
  trend_velocity?: number;
  recency_score?: number;
}

// ─── CONSTANTS ──────────────────────────────────────────────

const CATEGORY_NORMS: Record<string, string[]> = {
  'B2C+subscription': ['subscription_high_churn'],
  'B2C+one_time': ['low_paying_ratio'],
  'B2B+SALES_LED': ['low_search_volume', 'long_sales_cycle'],
  'enterprise': ['contact_sales_pricing', 'low_search_volume'],
  'B2C+freemium': ['low_paying_ratio', 'high_intent_low_payment'],
};

const CONSTRAINT_LAYER: ConstraintLayer = {
  must_explain_gap: true,
  must_link_to_metric: ['revenue', 'cac', 'conversion'],
  allowed_reasoning_types: ['friction', 'incentive_misalignment', 'behavior_gap', 'market_structure'],
  forbidden: ['generic_statements', 'unsupported_claims', 'category_clichés'],
};

const ACTION_FRAME: ActionFrame = {
  must_include_tradeoff: true,
  must_include_risk: true,
};

// [Critical #5] Маппинг churn_level → числовой proxy
// HIGH → ~10%/мес, MEDIUM → ~5%, LOW → ~2%
const CHURN_RATE_MAP: Record<'LOW' | 'MEDIUM' | 'HIGH', number> = {
  HIGH: 0.10,
  MEDIUM: 0.05,
  LOW: 0.02,
};

// ─── STEP 1: GENERATE ANOMALIES ─────────────────────────────

export function generateAnomalies(data: BlocksData): Anomaly[] {
  const anomalies: Anomaly[] = [];
  // Если market_type undefined — используем acquisition_type как proxy
  const isB2B = data.market_type === 'B2B' ||
    (data.market_type === undefined && data.acquisition_type === 'SALES_LED');
  const isEnterprise = (data.price_range_median ?? 0) > 500;

  // Паттерн 1 — Спрос vs Конкуренция
  const demandThreshold = isB2B ? 1000 : 8000;
  if (data.search_volume > demandThreshold && ['LOW', 'MEDIUM'].includes(data.competition_intensity)) {
    anomalies.push({
      id: 'demand_vs_competition',
      type: 'CONTRADICTION',
      signal: 'high_demand_low_competition',
      expected: 'Высокий поисковый спрос обычно привлекает конкурентов',
      reality: `${data.search_volume.toLocaleString()} запросов/мес при ${data.competition_intensity} конкуренции`,
      impact_vector: ['revenue', 'strategy'],
      confidence: 0.7,
    });
  }

  // Паттерн 2 — Платёжеспособность vs Качество выручки
  if (data.paying_ratio > 0.15 && data.revenue_quality === 'LOW') {
    anomalies.push({
      id: 'paying_vs_quality',
      type: 'STRUCTURAL',
      signal: 'high_paying_low_quality',
      expected: 'Если люди платят — выручка должна быть стабильной',
      reality: `${Math.round(data.paying_ratio * 100)}% платит, но revenue_quality = LOW`,
      impact_vector: ['revenue'],
      confidence: 0.8,
    });
  }

  // Паттерн 3 — Вход vs Бюджет
  // GO и EXPERIMENT — высокий бюджет при позитивном verdict = аномалия
  // HARD уже сам по себе плохой сигнал, не аномалия
  if (data.experiment_budget !== null && data.entry_verdict !== 'HARD') {
    const budgetThreshold = isEnterprise ? 80000 : 25000;
    if (data.experiment_budget > budgetThreshold) {
      anomalies.push({
        id: 'entry_vs_budget',
        type: 'CONTRADICTION',
        signal: 'go_but_expensive_entry',
        expected: 'GO verdict предполагает доступный порог входа',
        reality: `Бюджет на проверку $${data.experiment_budget.toLocaleString()} при verdict = GO`,
        impact_vector: ['strategy', 'cac'],
        confidence: 0.65,
      });
    }
  }

  // Паттерн 4 — CAC vs Удержание
  if (
    data.cac_mid !== null &&
    data.monthly_revenue_mid !== null &&
    data.monthly_revenue_mid > 0 &&
    data.cac_mid > data.monthly_revenue_mid * 12 &&
    data.avg_switching_cost === 'LOW'
  ) {
    anomalies.push({
      id: 'cac_vs_retention',
      type: 'STRUCTURAL',
      signal: 'high_cac_low_lockin',
      expected: 'Высокий CAC оправдан только при высоком удержании',
      reality: `CAC $${data.cac_mid} при switching_cost LOW — клиенты уйдут`,
      impact_vector: ['cac', 'revenue'],
      confidence: 0.85,
    });
  }

  // Паттерн 5 — Намерение vs Конверсия
  if (data.commercial_intent_ratio > 0.55 && data.paying_ratio < 0.12) {
    anomalies.push({
      id: 'intent_vs_payment',
      type: 'BEHAVIORAL',
      signal: 'high_intent_low_payment',
      expected: 'Высокий commercial intent → конверсия в платящих',
      reality: `Intent ${Math.round(data.commercial_intent_ratio * 100)}% но платит только ${Math.round(data.paying_ratio * 100)}%`,
      impact_vector: ['revenue', 'cac'],
      confidence: 0.75,
    });
  }

  // Паттерн 6 — Насыщенность vs Размер рынка
  if (data.competition_intensity === 'SATURATED' && data.revenue_mid !== null && data.revenue_mid < 300000) {
    anomalies.push({
      id: 'saturated_vs_size',
      type: 'CONTRADICTION',
      signal: 'saturated_small_market',
      expected: 'SATURATED ниша предполагает крупный рынок',
      reality: `Revenue mid $${Math.round(data.revenue_mid / 1000)}K при SATURATED конкуренции`,
      impact_vector: ['revenue', 'strategy'],
      confidence: 0.7,
    });
  }

  // Паттерн 7 — Подписка vs Churn
  // [Critical #5] churn_level HIGH маппируется в > 0.08 (SaaS критический порог)
  const churnRate = CHURN_RATE_MAP[data.churn_level];
  if (data.price_model === 'subscription' && churnRate > 0.08) {
    anomalies.push({
      id: 'subscription_vs_churn',
      type: 'STRUCTURAL',
      signal: 'subscription_high_churn',
      expected: 'Подписочная модель должна удерживать клиентов',
      reality: `Subscription + churn ~${Math.round(churnRate * 100)}%/мес = модель не работает как должна`,
      impact_vector: ['revenue', 'cac'],
      confidence: 0.8,
    });
  }

  // Паттерн 8 — Высокий CAC при наличии дешёвых каналов
  // SALES_LED с CAC $5K+ когда PLG/Community доступны за $100-200
  if (
    data.cac_mid !== null &&
    data.cac_mid > 3000 &&
    data.acquisition_type === 'SALES_LED' &&
    data.revenue_mid !== null &&
    data.revenue_mid > 100000
  ) {
    anomalies.push({
      id: 'expensive_sales_channel',
      type: 'STRUCTURAL',
      signal: 'sales_led_expensive_alternative_exists',
      expected: 'Есть дешёвые каналы (PLG, Community) но используется дорогой SALES_LED',
      reality: `CAC $${data.cac_mid.toLocaleString()} через SALES_LED при revenue $${Math.round(data.revenue_mid / 1000)}K/год`,
      impact_vector: ['cac', 'strategy'],
      confidence: 0.75,
    });
  }

  return anomalies;
}

// ─── STEP 2: ENRICH ANOMALIES ────────────────────────────────

export function enrichAnomalies(anomalies: Anomaly[], data: BlocksData): Anomaly[] {
  return anomalies.map(a => {
    const revenue_impact = a.impact_vector.includes('revenue') ? estimateRevenueImpact(a) : 0;
    const cac_impact = a.impact_vector.includes('cac') ? estimateCACImpact(a) : 0;
    const strategy_impact = a.impact_vector.includes('strategy') ? estimateStrategyImpact(a) : 0;

    const impact = Math.max(revenue_impact, cac_impact, strategy_impact);
    const contradiction_level = estimateContradictionLevel(a);
    const actionability = estimateActionability(a);
    const score = impact * a.confidence * contradiction_level * actionability;

    void data; // used for type-checking context only
    return { ...a, impact, contradiction_level, actionability, score, strategy_impact };
  });
}

function estimateRevenueImpact(a: Anomaly): number {
  const signals: Record<string, number> = {
    high_paying_low_quality: 0.85,
    subscription_high_churn: 0.80,
    saturated_small_market: 0.75,
    high_intent_low_payment: 0.70,
    high_demand_low_competition: 0.60,
    sales_led_expensive_alternative_exists: 0.75,
  };
  // [Impl #3] Warn для неизвестных сигналов
  if (!(a.signal in signals)) {
    console.warn(`[Block6] Unknown signal for revenue impact: ${a.signal}`);
  }
  return signals[a.signal] ?? 0.5;
}

function estimateCACImpact(a: Anomaly): number {
  const signals: Record<string, number> = {
    high_cac_low_lockin: 0.90,
    high_intent_low_payment: 0.70,
    go_but_expensive_entry: 0.75,
    sales_led_expensive_alternative_exists: 0.85,
  };
  return signals[a.signal] ?? 0.4;
}

function estimateStrategyImpact(a: Anomaly): number {
  const signals: Record<string, number> = {
    high_demand_low_competition: 0.85,
    go_but_expensive_entry: 0.80,
    saturated_small_market: 0.75,
    high_cac_low_lockin: 0.70,
    high_intent_low_payment: 0.65,
    sales_led_expensive_alternative_exists: 0.80,
  };
  return signals[a.signal] ?? 0.4;
}

function estimateContradictionLevel(a: Anomaly): number {
  const levels: Record<string, number> = {
    high_cac_low_lockin: 0.95,
    subscription_high_churn: 0.90,
    saturated_small_market: 0.85,
    high_demand_low_competition: 0.80,
    high_paying_low_quality: 0.75,
    high_intent_low_payment: 0.70,
    go_but_expensive_entry: 0.65,
    sales_led_expensive_alternative_exists: 0.80,
  };
  return levels[a.signal] ?? 0.5;
}

function estimateActionability(a: Anomaly): number {
  // [Arch #4] Weighted average вместо перемножения
  const altScore = estimateAlternativePaths(a.signal);
  const executionScore = estimateExecutionFeasibility(a.signal);
  const strategyShift = estimateStrategyShift(a.signal);

  return 0.3 * altScore + 0.3 * executionScore + 0.4 * strategyShift;
}

function estimateAlternativePaths(signal: string): number {
  const paths: Record<string, number> = {
    high_demand_low_competition: 0.9,
    high_cac_low_lockin: 0.85,
    high_intent_low_payment: 0.80,
    high_paying_low_quality: 0.75,
    subscription_high_churn: 0.70,
    saturated_small_market: 0.60,
    go_but_expensive_entry: 0.55,
    sales_led_expensive_alternative_exists: 0.85,
  };
  return paths[signal] ?? 0.4;
}

function estimateExecutionFeasibility(signal: string): number {
  const feasibility: Record<string, number> = {
    high_intent_low_payment: 0.85,
    high_demand_low_competition: 0.80,
    high_paying_low_quality: 0.75,
    subscription_high_churn: 0.70,
    high_cac_low_lockin: 0.65,
    saturated_small_market: 0.55,
    go_but_expensive_entry: 0.50,
    sales_led_expensive_alternative_exists: 0.80,
  };
  return feasibility[signal] ?? 0.5;
}

function estimateStrategyShift(signal: string): number {
  const shift: Record<string, number> = {
    high_demand_low_competition: 0.95,
    high_cac_low_lockin: 0.90,
    subscription_high_churn: 0.85,
    saturated_small_market: 0.80,
    high_intent_low_payment: 0.75,
    high_paying_low_quality: 0.70,
    go_but_expensive_entry: 0.65,
    sales_led_expensive_alternative_exists: 0.85,
  };
  return shift[signal] ?? 0.5;
}

// ─── STEP 3: CLUSTER ANOMALIES ───────────────────────────────

export function clusterAnomalies(anomalies: Anomaly[]): Cluster[] {
  const themes: Record<string, string[]> = {
    churn_retention: ['subscription_high_churn', 'high_cac_low_lockin'],
    demand_conversion: ['high_intent_low_payment', 'high_demand_low_competition'],
    economics: ['high_paying_low_quality', 'go_but_expensive_entry', 'saturated_small_market', 'sales_led_expensive_alternative_exists'],
  };

  const clusters: Cluster[] = [];
  const used = new Set<string>();

  for (const [theme, signals] of Object.entries(themes)) {
    const group = anomalies.filter(a => signals.includes(a.signal) && !used.has(a.id));
    if (group.length < 2) continue;

    const uniqueSources = new Set(group.flatMap(a => a.impact_vector)).size;
    if (uniqueSources < 2) continue;

    const clusterScore = group.reduce((sum, a) => sum + (a.score ?? 0), 0);

    clusters.push({
      id: `cluster_${theme}`,
      type: getDominantType(group),
      signals: group,
      score: clusterScore,
      confidence: Math.min(...group.map(a => a.confidence)),
      unique_signal_sources: uniqueSources,
    });

    group.forEach(a => used.add(a.id));
  }

  anomalies
    .filter(a => !used.has(a.id))
    .forEach(a => {
      clusters.push({
        id: `single_${a.id}`,
        type: a.type,
        signals: [a],
        score: a.score ?? 0,
        confidence: a.confidence,
        unique_signal_sources: a.impact_vector.length,
      });
    });

  return clusters;
}

function getDominantType(anomalies: Anomaly[]): BlindSpotType {
  const typeCounts = anomalies.reduce((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + (a.score ?? 0);
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0][0] as BlindSpotType;
}

// ─── STEP 4: FILTER CATEGORY NORMS ───────────────────────────

export function filterCategoryNorms(clusters: Cluster[], data: BlocksData): Cluster[] {
  const categoryKey = buildCategoryKey(data);
  const norms = CATEGORY_NORMS[categoryKey] ?? [];

  if (norms.length === 0) return clusters;

  // [Impl #1] Иммутабельно — создаём новые объекты, не мутируем входные
  return clusters
    .map(cluster => ({
      ...cluster,
      signals: cluster.signals.filter(a => !norms.includes(a.signal)),
    }))
    .filter(cluster => cluster.signals.length > 0);
}

function buildCategoryKey(data: BlocksData): string {
  const parts: string[] = [];
  if (data.market_type) parts.push(data.market_type);
  if (data.acquisition_type === 'SALES_LED') parts.push('SALES_LED');
  if (data.price_model) parts.push(data.price_model);
  if ((data.price_range_median ?? 0) > 500) parts.push('enterprise');
  return parts.join('+');
}

// ─── STEP 5: EXTERNAL DISRUPTION CHECK ──────────────────────

export async function externalDisruptionCheck(data: BlocksData): Promise<ExternalSignal[]> {
  const niche = data.niche;
  const competitor = data.top_competitor_name ?? niche;

  // Placeholder — real SerpAPI implementation is in the route handler
  const queries = [
    { q: `how to solve ${niche} without software`, weight: 1.2, source: 'workaround' },
    { q: `switching from ${competitor}`, weight: 0.9, source: 'switching' },
    { q: `${niche} problems site:reddit.com`, weight: 0.6, source: 'complaints' },
    { q: `why ${niche} software fails`, weight: 0.7, source: 'failures' },
    { q: `${niche} alternatives`, weight: 0.5, source: 'alternatives' },
  ];

  void queries;
  return []; // placeholder — override in route.ts
}

const SIGNAL_PATTERNS = {
  confirm: [/\bexactly\b|\bworks well\b|\byes\b|\bconfirmed\b|\bsolves\b|\beasy to use\b|\bsimple\b/i],
  contradict_soft: [/\bbut\b|\bhowever\b|\bsometimes\b|\bdepends\b|\bmaybe\b|\bmight\b|\bcould\b|\bexcept\b/i],
  contradict_hard: [
    /\bnot working\b|\bdoesn't work\b|\bnever\b|\bimpossible\b|\bfails\b|\bbroken\b|\buseless\b/i,
    /\bcan't\b|\bcannot\b|\bavoid\b|\bstop using\b|\bmigrate from\b|\balternative to\b/i,
    /\busing excel\b|\bspreadsheet instead\b|\bmanual process\b|\bdo it manually\b|\bdiy\b/i,
  ],
};

export function compareWithExternal(cluster: Cluster, signals: ExternalSignal[]): ExternalRelation {
  const claim = cluster.signals[0];
  if (!claim) return 'neutral';

  const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '');
  const claimWords = normalize(claim.expected).split(' ').filter(w => w.length > 4);

  const score = { confirm: 0, contradict_soft: 0, contradict_hard: 0 };

  for (const signal of signals) {
    const normalized = normalize(signal.text);
    const isRelevant = claimWords.some(word => normalized.includes(word));
    if (!isRelevant) continue;

    for (const [type, patterns] of Object.entries(SIGNAL_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(signal.text)) {
          score[type as keyof typeof score] += signal.weight;
          break;
        }
      }
    }

    if (
      claim.type === 'BEHAVIORAL' &&
      (normalized.includes('workaround') || normalized.includes('manually') || normalized.includes('excel'))
    ) {
      score.contradict_hard += signal.weight * 1.5;
    }
  }

  const totalSignal = score.confirm + score.contradict_soft + score.contradict_hard;
  if (totalSignal < 0.5) return 'neutral';

  if (score.contradict_hard > score.confirm && score.contradict_hard > score.contradict_soft) return 'contradict_hard';
  if (score.contradict_soft > score.confirm) return 'contradict_soft';
  if (score.confirm > 0) return 'confirm';
  return 'neutral';
}

export function applyDisruption(clusters: Cluster[], externalSignals: ExternalSignal[]): Cluster[] {
  return clusters.map(cluster => {
    const relation = compareWithExternal(cluster, externalSignals);
    const updated = { ...cluster, external_relation: relation };

    if (relation === 'confirm') {
      return { ...updated, confidence: Math.min(1, cluster.confidence * 1.3) };
    } else if (relation === 'contradict_soft') {
      return { ...updated, score: cluster.score * 1.5 };
    } else if (relation === 'contradict_hard') {
      return { ...updated, type: 'UNKNOWN' as BlindSpotType, confidence: 0.3, force_unknown: true };
    }
    return updated;
  });
}

// ─── STEP 6: APPLY TIMING ────────────────────────────────────

export function applyTiming(clusters: Cluster[], trends: TrendData): Cluster[] {
  return clusters.map(cluster => {
    if (cluster.type !== 'TIMING') return cluster;

    if (trends.time_to_saturation_months !== undefined && trends.build_time_months !== undefined) {
      const window = trends.time_to_saturation_months - trends.build_time_months;

      if (window < 0) {
        return { ...cluster, score: cluster.score * 0.3, type: 'STRUCTURAL' as BlindSpotType };
      } else {
        const velocity = trends.trend_velocity ?? 0.5;
        const recency = trends.recency_score ?? 0.5;
        return { ...cluster, score: cluster.score * (1 + velocity * recency) };
      }
    }
    return cluster;
  });
}

// ─── STEP 7: KILL SWITCHES ───────────────────────────────────

export function applyKillSwitches(clusters: Cluster[]): Cluster[] {
  // [Arch #6] Адаптивные пороги: при малом количестве кластеров снижаем требования
  const threshold_strategy = clusters.length <= 2 ? 0.2 : 0.3;
  const threshold_action = clusters.length <= 2 ? 0.3 : 0.4;

  return clusters.filter(cluster => {
    const mainAnomaly = cluster.signals[0];
    if (!mainAnomaly) return false;
    if ((mainAnomaly.strategy_impact ?? 0) < threshold_strategy) return false;
    if ((mainAnomaly.actionability ?? 0) < threshold_action) return false;
    return true;
  });
}

// ─── STEP 8: SELECT TOP 3 ────────────────────────────────────

export function selectTop3(clusters: Cluster[]): Cluster[] {
  const sorted = [...clusters].sort((a, b) => b.score - a.score);
  const selected: Cluster[] = [];
  const typeCounts = new Map<BlindSpotType, number>();

  for (const cluster of sorted) {
    const count = typeCounts.get(cluster.type) ?? 0;
    if (count >= 2) continue; // soft constraint: max 2 одного типа

    selected.push(cluster);
    typeCounts.set(cluster.type, count + 1);

    if (selected.length === 3) break;
  }

  return selected;
}

// ─── STEP 9: SHOULD TRIGGER UNKNOWN ─────────────────────────
// [Arch #1] Вызывается ПОСЛЕ kill switches но ДО selectTop3

export function shouldTriggerUnknown(clusters: Cluster[]): boolean {
  if (clusters.length === 0) return true;
  if (clusters.every(c => c.confidence < 0.5)) return true;
  if (clusters.some(c => c.force_unknown)) return true;
  return false;
}

// ─── STEP 10: BUILD LLM PAYLOAD ─────────────────────────────

const POSITION_MAP: InsightPosition[] = ['1_doubt', '2_mechanism', '3_strategic_turn'];

export function buildLLMPayload(clusters: Cluster[], data: BlocksData): LLMPayload {
  // [Impl #2] Guard для пустых кластеров
  if (!clusters || clusters.length === 0) {
    return { mode: 'unknown', unknown_output: buildUnknownOutput(data) };
  }

  if (shouldTriggerUnknown(clusters)) {
    return { mode: 'unknown', unknown_output: buildUnknownOutput(data) };
  }

  const insights: InsightPayload[] = clusters.map((cluster, i) => {
    const main = cluster.signals[0];
    const position = POSITION_MAP[i] ?? '3_strategic_turn';
    const supporting_data = buildSupportingData(cluster, data);
    const actionability = main?.actionability ?? 0;
    const action = actionability >= 0.5 ? inferAction(cluster, data) : null;

    return {
      type: cluster.type,
      position,
      expected: main?.expected ?? '',
      reality: main?.reality ?? '',
      mechanism_context: buildMechanismContext(cluster, data),
      supporting_data,
      action,
      window_months: inferWindowMonths(cluster),
      constraint_layer: CONSTRAINT_LAYER,
      action_frame: ACTION_FRAME,
    };
  });

  return { mode: 'normal', insights };
}

function buildSupportingData(cluster: Cluster, data: BlocksData): Record<string, string | number> {
  const sd: Record<string, string | number> = {};

  if (data.search_volume) sd.search_volume = `${data.search_volume.toLocaleString()}/мес`;
  if (data.paying_ratio) sd.paying_ratio = `${Math.round(data.paying_ratio * 100)}%`;
  if (data.commercial_intent_ratio) sd.commercial_intent = `${Math.round(data.commercial_intent_ratio * 100)}%`;
  if (data.revenue_mid) sd.revenue_potential = `$${Math.round(data.revenue_mid / 1000)}K/год`;
  if (data.cac_mid) sd.cac_estimate = `$${data.cac_mid}`;
  if (data.experiment_budget) sd.entry_cost = `$${data.experiment_budget.toLocaleString()}`;
  if (data.payback_months) sd.payback = `${data.payback_months} мес`;

  // [Critical #6] Fallback если все поля null/undefined
  if (Object.keys(sd).length === 0) {
    const signal = cluster.signals[0]?.signal ?? 'unknown';
    sd.anomaly_signal = signal;
    sd.anomaly_type = cluster.type;
    sd.confidence = Math.round(cluster.confidence * 100) + '%';
    console.warn(`[Block6] buildSupportingData: empty for cluster ${cluster.id}, using fallback`);
  }

  return sd;
}

function buildMechanismContext(cluster: Cluster, data: BlocksData): string {
  const signals = cluster.signals.map(s => s.signal).join(', ');
  return [
    `type=${cluster.type}`,
    `signals=${signals}`,
    `market=${data.market_type ?? 'unknown'}`,
    `expected="${cluster.signals[0]?.expected ?? ''}"`,
    `reality="${cluster.signals[0]?.reality ?? ''}"`,
  ].join(' | ');
}

function inferAction(cluster: Cluster, data: BlocksData): string {
  const signal = cluster.signals[0]?.signal;
  const actionMap: Record<string, string> = {
    high_demand_low_competition: `Войти через ${data.acquisition_type === 'PLG' ? 'PLG' : 'прямые продажи'} до прихода крупных игроков`,
    high_cac_low_lockin: 'Сменить канал на ownership-based (SEO/community) вместо paid acquisition',
    high_intent_low_payment: 'Перейти на B2B сегмент или добавить enterprise tier с обязательным onboarding',
    high_paying_low_quality: 'Перестроить монетизацию под subscription вместо разовых платежей',
    subscription_high_churn: 'Встроить продукт в обязательные workflow до масштабирования привлечения',
    saturated_small_market: 'Найти sub-niche или вертикаль внутри рынка вместо фронтальной атаки',
    go_but_expensive_entry: 'Не входить без unfair distribution advantage или pre-existing audience',
    sales_led_expensive_alternative_exists: 'Переключить на PLG или Community-LED канал — CAC упадёт в 30-50 раз при тех же конверсиях',
  };
  return actionMap[signal ?? ''] ?? 'Провести 5 custdev-интервью с потенциальными клиентами';
}

function inferWindowMonths(cluster: Cluster): number {
  const signal = cluster.signals[0]?.signal;
  const windows: Record<string, number> = {
    high_demand_low_competition: 9,
    go_but_expensive_entry: 18,
    high_intent_low_payment: 12,
    high_cac_low_lockin: 6,
    subscription_high_churn: 6,
    high_paying_low_quality: 12,
    saturated_small_market: 24,
    sales_led_expensive_alternative_exists: 12,
  };
  return windows[signal ?? ''] ?? 12;
}

function buildUnknownOutput(data: BlocksData): UnknownOutput {
  return {
    reason: 'Данные не дают устойчивых паттернов для этой ниши',
    questions: [
      `Почему компании в ${data.niche} до сих пор не платят за автоматизацию — что ломается при попытке внедрения?`,
      `Как ${data.niche} команды решают эту проблему прямо сейчас без продукта — Excel, ручные процессы, аутсорс?`,
      `Что мешает топ-3 конкурентам захватить рынок — это технически, поведенчески или регуляторно?`,
    ],
    bet_frame: `Входя в ${data.niche} сейчас — ты ставишь на то что рынок готов платить за SaaS решение`,
    risk_frame: 'Если это окажется неверным — потеряешь 6-12 месяцев и бюджет на проверку',
  };
}

// ─── MAIN PIPELINE ───────────────────────────────────────────

export async function runBlock6Pipeline(data: BlocksData, trends?: TrendData): Promise<LLMPayload> {
  const rawAnomalies = generateAnomalies(data);
  const enriched = enrichAnomalies(rawAnomalies, data);
  let clusters = clusterAnomalies(enriched);
  clusters = filterCategoryNorms(clusters, data);

  const externalSignals = await externalDisruptionCheck(data);
  clusters = applyDisruption(clusters, externalSignals);

  if (trends) clusters = applyTiming(clusters, trends);

  clusters = applyKillSwitches(clusters);

  // [Arch #1] shouldTriggerUnknown ПЕРЕД selectTop3
  if (shouldTriggerUnknown(clusters)) {
    return { mode: 'unknown', unknown_output: buildUnknownOutput(data) };
  }

  const top3 = selectTop3(clusters);

  return buildLLMPayload(top3, data);
}

// ─── CLAUDE SONNET PROMPT ────────────────────────────────────

export const BLIND_SPOT_SYSTEM_PROMPT = `
Ты — продуктовый стратег который пишет рыночные инсайты для предпринимателей.
Твоя задача: превратить структуру аномалии в инсайт который меняет решение.

Язык: русский. Только текст. Без заголовков, списков, эмодзи.
Максимум: 600 токенов.

ПРАВИЛО 1 — ТОЛЬКО ДАННЫЕ ИЗ supporting_data:
Используй ТОЛЬКО цифры и факты из полей входной структуры.
КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО добавлять цифры которых нет во входных данных.
Если факта нет — не упоминай его.

ПРАВИЛО 2 — ЯЗЫК ПОТЕРЬ:
Не "что не учёл" а "где ошибёшься и потеряешь деньги".
Не "есть возможность" а "вот почему большинство здесь проигрывает".

ПРАВИЛО 3 — ЗАПРЕЩЁННЫЕ ФРАЗЫ:
Запрещено: "рынок готов к disruption", "уникальное окно возможностей",
"время действовать", "как правило в таких рынках", "обычно в SaaS",
"потенциал огромен", "перспективная ниша"

[Critical #7] ПРАВИЛЬНЫЙ vs НЕПРАВИЛЬНЫЙ тон — пример:
НЕПРАВИЛЬНО: "Рынок HR-автоматизации демонстрирует высокий потенциал
и уникальное окно возможностей для новых игроков."

ПРАВИЛЬНО: "В нише с 15 000 запросами в месяц и только тремя
заметными конкурентами рынок выглядит пустым — но это сигнал ловушки,
а не приглашения. Три компании не потому что остальные не пытались."

Принцип: если заменить нишу любой другой и текст останется тем же — перепиши.

ПРАВИЛО 4 — ТИПЫ РАССУЖДЕНИЙ (только эти четыре):
friction — что мешает конверсии или adoption
incentive_misalignment — у кого какие стимулы и почему они расходятся
behavior_gap — разрыв между тем что люди говорят и что делают
market_structure — как устроен рынок структурно (кто контролирует, кто платит)

ПРАВИЛО 5 — ACTION ВСЕГДА С TRADE-OFF:
Не "сделай X".
А "если делаешь X — ты жертвуешь Y ради Z, и главный риск — W".

ПРИМЕР ХОРОШЕГО ACTION:
"Если идёшь через PLG — ты жертвуешь скоростью первых сделок
ради масштаба через 18 месяцев. Главный риск: конкурент с деньгами
войдёт через direct sales пока ты строишь органику."

СТРУКТУРА (строго в этом порядке, без заголовков):
[HOOK] — одно предложение, парадокс или неожиданное утверждение
[UNVEILING] — 2-3 предложения, показываем расхождение с цифрами из supporting_data
[MECHANISM] — 2-3 предложения, структурная причина (один из четырёх типов)
[IMPACT] — 1-2 предложения, влияние на revenue или CAC конкретно
[ACTION] — одно предложение с trade-off и риском

ПОЗИЦИЯ insight_position:
1_doubt: Hook создаёт сомнение. Заканчивается открытым вопросом. Не давай ответ.
2_mechanism: Hook намекает на скрытую системную причину. Объясняй глубоко.
3_strategic_turn: Hook решительный. Заканчивается action с trade-off.

САМОПРОВЕРКА перед выводом:
1. Все цифры есть в supporting_data? Если нет — убрать.
2. Есть trade-off в action? Если нет — добавить.
3. Есть конкретный риск? Если нет — добавить.
4. Текст читается только про эту нишу? Если нет — переписать.
`.trim();

// ─── HAIKU VALIDATION PROMPT ─────────────────────────────────

export const VALIDATION_PROMPT = `
Проверь инсайт по трём критериям.
Ответь ТОЛЬКО JSON: {"result": "ok" | "reject", "reason": "string | null"}

Критерий 1 — ДАННЫЕ: Есть ли в тексте утверждения или цифры которых нет в supporting_data?
Критерий 2 — МЕТРИКИ: Упоминается ли влияние на revenue, CAC или conversion?
Критерий 3 — GENERIC: Можно ли заменить нишу любой другой и текст останется тем же?

[Impl #4] Тип пятна для контекста проверки:
Spot type: {{spot_type}}

Инсайт для проверки:
{{insight_text}}

Supporting data:
{{supporting_data}}

Ниша:
{{niche}}

Правила:
Если Критерий 1 = ДА (есть ненадёжные данные) → reject
Если Критерий 2 = НЕТ (нет метрик) → reject
Если Критерий 3 = ДА (generic текст) → reject
Иначе → ok
`.trim();
