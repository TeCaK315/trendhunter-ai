/**
 * TrendHunter AI — Data Contract v2
 * src/lib/strategy/data-contract.ts
 *
 * Версионированный контракт данных между Research и Strategy.
 * Strategy НИКОГДА не читает сырые данные Research напрямую.
 * Всегда через validateResearchData().
 *
 * Изменения v2 (из аудита четырёх AI):
 * - Zod schema вместо ручной валидации (все четыре)
 * - Enum-значения валидируются, не только тип (Copilot)
 * - normalizeNumericFields исправляет данные, не только логирует (все)
 * - Убрана опасная автоконвертация sale_cycle_days < 2 (Copilot)
 * - CAC vs LTV исправлен — не сравниваем CAC с рыночной выручкой (DeepSeek)
 * - checkDataSufficiency: порог paying_ratio 0.05, проверка confidence (GPT)
 * - Semantic versioning: major.minor (DeepSeek)
 * - normalized блок: добавлено normalization_applied (все)
 * - Type guards вместо unsafe as-casts (Copilot)
 * - verdict getter получил safe fallback (мой аудит)
 */

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────
// ZOD SCHEMAS
// ─────────────────────────────────────────────────────────────

const GapItemSchema = z.object({
  pain: z.string().min(1),
  paying_ratio: z.number().min(0).max(1),
  status: z.enum(['open', 'partial', 'closed']),
  category: z.string().nullable().optional(),
})

const CACRangeSchema = z.object({
  low: z.number().min(0),
  mid: z.number().min(0),
  high: z.number().min(0),
})

const CACScenarios_Schema = z.object({
  plg: CACRangeSchema,
  seo_led: CACRangeSchema,
  community_led: CACRangeSchema,
  sales_led: CACRangeSchema,
  recommended: z.enum(['PLG', 'SALES_LED', 'SEO_LED', 'COMMUNITY']),
})

export const ResearchOutputSchema = z.object({
  version: z.string().regex(/^\d+\.\d+$/, 'Version must be X.Y format'),

  /**
   * normalized — metadata о намерении, не гарантия корректности чисел.
   * normalization_applied — список реально применённых конвертаций.
   */
  normalized: z.object({
    currency: z.literal('USD'),
    revenue_unit: z.literal('annual'),
    time_unit: z.literal('days'),
    amounts_unit: z.literal('absolute'),
    normalization_applied: z.array(z.string()).default([]),
  }),

  b1: z.object({
    paying_ratio: z.number().min(0).max(1),
    pain_clusters: z.array(z.string()),
    top_complaints: z.array(z.string()),
    dynamics: z.enum(['growing', 'stable', 'declining']),
    pain_type: z.enum(['bad_solution', 'no_solution', 'expensive_solution']),
    market_type: z.enum(['B2C', 'B2B', 'mixed']),
    classification_confidence: z.enum(['high', 'medium', 'low']),
  }),

  b2: z.object({
    search_volume: z.number().min(0),
    commercial_intent_ratio: z.number().min(0).max(1),
    rising_queries: z.array(z.string()),
    demand_strength: z.enum(['STRONG', 'MEDIUM', 'LOW', 'DECLINING']),
    has_seasonality: z.boolean(),
    geo_top_market: z.string().nullable(),
  }),

  b3: z.object({
    price_range_median: z.number().positive().nullable(),
    price_range_min: z.number().positive().nullable(),
    price_range_max: z.number().positive().nullable(),
    price_model: z.enum(['subscription', 'one_time', 'usage', 'hybrid']),
    sale_cycle_days: z.number().min(0.5).max(730),
    friction_score: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    has_free_tier: z.boolean(),
    monetization_quality: z.enum(['SCALABLE', 'STABLE', 'FRAGILE']),
    monetization_confidence: z.number().min(0).max(1),
  }),

  b4: z.object({
    gap_type: z.enum(['execution', 'strategic', 'none']),
    gap_map: z.array(GapItemSchema),
    competition_intensity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'SATURATED']),
    acquisition_type: z.enum(['PLG', 'SALES_LED', 'SEO_LED', 'COMMUNITY']),
    avg_switching_cost: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    substitute_strength: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    top_complaints: z.array(z.string()),
    competitor_count: z.number().int().min(0),
    top_competitor_g2_reviews: z.number().int().min(0).nullable(),
    entry_point: z.string().nullable(),
    blue_ocean_score: z.number().min(0).max(100).nullable(),
  }),

  b5: z.object({
    revenue_mid: z.number().positive().nullable(),
    revenue_low: z.number().nonnegative().nullable(),
    revenue_high: z.number().positive().nullable(),
    cac_mid: z.number().positive().nullable(),
    cac_scenarios: CACScenarios_Schema.nullable(),
    months_to_first_revenue: z.number().min(0).max(36),
    experiment_budget: z.number().min(0),
    payback_months: z.number().positive().nullable(),
    revenue_confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    revenue_quality: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    cac_spread_flag: z.boolean(),
    leaky_bucket_flag: z.boolean(),
    high_entry_barrier_flag: z.boolean(),
    long_payback_flag: z.boolean(),
    main_economic_risk: z.string(),
    monthly_burn_estimate: z.number().positive().nullable(),
  }),

  b6: z.object({
    blind_spots_count: z.number().int().min(0),
    blind_spots_impact: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NONE']),
    blind_spots_types: z.array(z.string()),
    first_spot_teaser: z.string().nullable(),
    has_revenue_multiplier: z.boolean(),
    unknown_mode: z.boolean(),
    conflict_weight: z.number().int().min(1).max(3),
    data_quality_confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  }),

  b7: z.object({
    verdict: z.enum(['go_if', 'experiment_if', 'no_go_until']),
    confidence: z.number().min(0.1).max(0.95),
    priority_actions: z.array(z.string()),
    bridge_text: z.string().nullable(),
    asymmetric_advantage: z.string().nullable(),
    strategy_mode_recommendation: z.enum(['go_mode', 'experiment_mode']).nullable(),
  }),
})

// ─────────────────────────────────────────────────────────────
// TYPESCRIPT TYPES (выводятся из Zod — всегда в синхроне)
// ─────────────────────────────────────────────────────────────

export type ResearchOutput = z.infer<typeof ResearchOutputSchema>
export type GapItem = z.infer<typeof GapItemSchema>
export type CACScenarios = z.infer<typeof CACScenarios_Schema>
export type CACRange = z.infer<typeof CACRangeSchema>

// Primitive aliases (для удобства импорта)
export type MarketType = 'B2C' | 'B2B' | 'mixed'
export type Segment = 'B2C' | 'SMB' | 'ENTERPRISE'
export type DemandStrength = 'STRONG' | 'MEDIUM' | 'LOW' | 'DECLINING'
export type FrictionScore = 'HIGH' | 'MEDIUM' | 'LOW'
export type CompetitionIntensity = 'LOW' | 'MEDIUM' | 'HIGH' | 'SATURATED'
export type AcquisitionType = 'PLG' | 'SALES_LED' | 'SEO_LED' | 'COMMUNITY'
export type SwitchingCost = 'LOW' | 'MEDIUM' | 'HIGH'
export type RevenueConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type BlindSpotImpact = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
export type GapType = 'execution' | 'strategic' | 'none'
export type Verdict = 'go_if' | 'experiment_if' | 'no_go_until'
export type PriceModel = 'subscription' | 'one_time' | 'usage' | 'hybrid'
export type PainType = 'bad_solution' | 'no_solution' | 'expensive_solution'
export type Dynamics = 'growing' | 'stable' | 'declining'

// ─────────────────────────────────────────────────────────────
// VALIDATION RESULT
// ─────────────────────────────────────────────────────────────

export type ValidationResult =
  | { success: true; data: ResearchOutput; warnings: string[] }
  | { success: false; fatal: boolean; reason: string; field?: string }

// ─────────────────────────────────────────────────────────────
// VERSIONING
// ─────────────────────────────────────────────────────────────

const SUPPORTED_MAJOR_VERSION = 1

function checkVersion(version: string): { compatible: boolean; warning?: string } {
  const parts = version.split('.').map(Number)
  const major = parts[0]
  const minor = parts[1] ?? 0

  if (!major || isNaN(major) || isNaN(minor)) {
    return { compatible: false }
  }

  if (major !== SUPPORTED_MAJOR_VERSION) {
    return { compatible: false }
  }

  if (minor > 0) {
    return {
      compatible: true,
      warning: `Research version ${version} is newer than expected 1.0. New fields may be ignored.`,
    }
  }

  return { compatible: true }
}

// ─────────────────────────────────────────────────────────────
// NORMALIZATION
// ─────────────────────────────────────────────────────────────

interface NormalizationResult {
  data: Record<string, unknown>
  applied: string[]
  warnings: string[]
}

/**
 * Нормализует числовые поля.
 * v2: ИСПРАВЛЯЕТ данные когда это безопасно, предупреждает когда нет.
 *
 * Безопасно исправляем:
 *   paying_ratio > 1 → делим на 100 (явные проценты)
 *
 * Только предупреждаем (не исправляем):
 *   revenue_mid < 1000 → подозрительно мало (не знаем единиц)
 *   cac_mid < 1 → подозрительно мало
 *
 * НЕ делаем:
 *   sale_cycle_days автоконвертацию (убрана — Zod ограничивает min/max)
 */
function normalizeNumericFields(raw: Record<string, unknown>): NormalizationResult {
  const data = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>
  const applied: string[] = []
  const warnings: string[] = []

  // paying_ratio: только если > 1 и <= 100 (явные проценты)
  const b1 = data.b1
  if (b1 !== null && b1 !== undefined && typeof b1 === 'object' && !Array.isArray(b1)) {
    const b1obj = b1 as Record<string, unknown>
    const pr = b1obj['paying_ratio']
    if (typeof pr === 'number') {
      if (pr > 1 && pr <= 100) {
        b1obj['paying_ratio'] = pr / 100
        applied.push(`b1.paying_ratio: ${pr}% → ${b1obj['paying_ratio']}`)
      } else if (pr > 100) {
        warnings.push(`b1.paying_ratio = ${pr} exceeds 100 — invalid value`)
      }
    }
  }

  // revenue fields: предупреждаем, не конвертируем
  const b5 = data.b5
  if (b5 !== null && b5 !== undefined && typeof b5 === 'object' && !Array.isArray(b5)) {
    const b5obj = b5 as Record<string, unknown>
    for (const field of ['revenue_mid', 'revenue_low', 'revenue_high']) {
      const val = b5obj[field]
      if (typeof val === 'number' && val > 0 && val < 1_000) {
        warnings.push(
          `b5.${field} = ${val} is suspiciously low. ` +
          `Contract expects absolute annual USD. Research must ensure correct units.`
        )
      }
    }

    const cac = b5obj['cac_mid']
    if (typeof cac === 'number' && cac > 0 && cac < 1) {
      warnings.push(
        `b5.cac_mid = ${cac} looks like a ratio, not USD. ` +
        `Expected: cost per customer acquisition in USD.`
      )
    }
  }

  // Записываем список применённых конвертаций
  const norm = data.normalized
  if (norm !== null && norm !== undefined && typeof norm === 'object' && !Array.isArray(norm)) {
    ;(norm as Record<string, unknown>)['normalization_applied'] = applied
  }

  return { data, applied, warnings }
}

// ─────────────────────────────────────────────────────────────
// VALIDATE RESEARCH DATA
// ─────────────────────────────────────────────────────────────

/**
 * Главная функция валидации.
 * Вызывается в Block 0 ДО любых вычислений.
 *
 * Порядок:
 * 1. Базовая проверка типа
 * 2. Версия (semantic versioning)
 * 3. Нормализация числовых полей
 * 4. Zod schema validation (enum + ranges + structure)
 */
export function validateResearchData(raw: unknown): ValidationResult {
  // 1. Базовая проверка
  if (raw === null || raw === undefined) {
    return { success: false, fatal: true, reason: 'Research data is null or undefined' }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { success: false, fatal: true, reason: 'Research data must be a plain object' }
  }

  const rawObj = raw as Record<string, unknown>

  // 2. Версия
  const version = rawObj['version']
  if (typeof version !== 'string' || !version) {
    return { success: false, fatal: true, reason: 'Missing or invalid version field' }
  }

  const versionCheck = checkVersion(version)
  if (!versionCheck.compatible) {
    return {
      success: false, fatal: true,
      reason: `Incompatible Research version: ${version}. Expected major version ${SUPPORTED_MAJOR_VERSION}.x`
    }
  }

  const collectedWarnings: string[] = []
  if (versionCheck.warning) collectedWarnings.push(versionCheck.warning)

  // 3. Нормализация
  const normResult = normalizeNumericFields(rawObj)
  collectedWarnings.push(...normResult.warnings)

  // 4. Zod validation
  const zodResult = ResearchOutputSchema.safeParse(normResult.data)
  if (!zodResult.success) {
    const firstError = zodResult.error.issues[0]
    const fieldPath = firstError?.path.join('.') ?? 'unknown'
    return {
      success: false,
      fatal: true,
      reason: `Validation failed at ${fieldPath}: ${firstError?.message ?? 'unknown error'}`,
      field: fieldPath,
    }
  }

  const data = zodResult.data

  // Проверяем математические противоречия которые видны без контекста пользователя.
  // CAC vs LTV и one_time price vs CAC — универсальные.
  // Kill switch и budget floor — Block 0 проверит с реальными параметрами пользователя.
  const mathErrors = checkMathContradictions(
    data,
    data.b5.experiment_budget,  // из Research, не от пользователя
    data.b3.sale_cycle_days * 2, // условный горизонт = 2 цикла сделки
    0  // budget floor = 0 здесь, RULE_001 в Block 0 проверит реальный
  )

  const fatalMathErrors = mathErrors.filter(e => e.severity === 'fatal')
  if (fatalMathErrors.length > 0) {
    return {
      success: false,
      fatal: true,
      reason: `Math contradiction: ${fatalMathErrors[0].message}`,
      field: fatalMathErrors[0].field,
    }
  }

  collectedWarnings.push(
    ...mathErrors
      .filter(e => e.severity === 'warning')
      .map(e => e.message)
  )

  return {
    success: true,
    data,
    warnings: collectedWarnings,
  }
}

// ─────────────────────────────────────────────────────────────
// TYPE GUARD
// ─────────────────────────────────────────────────────────────

export function isResearchOutput(data: unknown): data is ResearchOutput {
  return ResearchOutputSchema.safeParse(data).success
}

// ─────────────────────────────────────────────────────────────
// SAFE GETTERS
// ─────────────────────────────────────────────────────────────

export const Research = {

  // Block 1
  payingRatio:    (r: ResearchOutput): number      => r.b1.paying_ratio ?? 0,
  painClusters:   (r: ResearchOutput): string[]    => r.b1.pain_clusters ?? [],
  topComplaints1: (r: ResearchOutput): string[]    => r.b1.top_complaints ?? [],
  marketType:     (r: ResearchOutput): MarketType  => r.b1.market_type ?? 'B2B',
  dynamics:       (r: ResearchOutput): Dynamics    => r.b1.dynamics ?? 'stable',

  // Block 2
  searchVolume:   (r: ResearchOutput): number         => r.b2.search_volume ?? 0,
  commercialIntentRatio: (r: ResearchOutput): number  => r.b2.commercial_intent_ratio ?? 0,
  demandStrength: (r: ResearchOutput): DemandStrength => r.b2.demand_strength ?? 'LOW',
  risingQueries:  (r: ResearchOutput): string[]       => r.b2.rising_queries ?? [],

  // Block 3
  priceMedian:    (r: ResearchOutput): number | null  => r.b3.price_range_median,
  saleCycleDays:  (r: ResearchOutput): number         => r.b3.sale_cycle_days ?? 30,
  frictionScore:  (r: ResearchOutput): FrictionScore  => r.b3.friction_score ?? 'MEDIUM',
  priceModel:     (r: ResearchOutput): PriceModel     => r.b3.price_model ?? 'subscription',

  // Block 4
  gapType:        (r: ResearchOutput): GapType    => r.b4.gap_type ?? 'none',
  gapMap:         (r: ResearchOutput): GapItem[]  => r.b4.gap_map ?? [],
  topComplaints:  (r: ResearchOutput): string[]   => r.b4.top_complaints ?? [],

  topGapPayingRatio: (r: ResearchOutput): number => {
    const map = r.b4.gap_map ?? []
    return map.length > 0 ? Math.max(...map.map(g => g.paying_ratio)) : 0
  },

  competitionIntensity: (r: ResearchOutput): CompetitionIntensity =>
    r.b4.competition_intensity ?? 'MEDIUM',

  acquisitionType: (r: ResearchOutput): AcquisitionType =>
    r.b4.acquisition_type ?? 'SALES_LED',

  avgSwitchingCost: (r: ResearchOutput): SwitchingCost =>
    r.b4.avg_switching_cost ?? 'MEDIUM',

  // Block 5
  revenueMid:     (r: ResearchOutput): number | null => r.b5.revenue_mid,
  revenueLow:     (r: ResearchOutput): number | null => r.b5.revenue_low,
  revenueHigh:    (r: ResearchOutput): number | null => r.b5.revenue_high,
  cacMid:         (r: ResearchOutput): number | null => r.b5.cac_mid,
  paybackMonths:  (r: ResearchOutput): number | null => r.b5.payback_months,

  experimentBudget: (r: ResearchOutput): number =>
    r.b5.experiment_budget ?? 0,

  monthsToFirstRevenue: (r: ResearchOutput): number =>
    r.b5.months_to_first_revenue ?? 6,

  revenueConfidence: (r: ResearchOutput): RevenueConfidence =>
    r.b5.revenue_confidence ?? 'LOW',

  cacSpreadFlag:  (r: ResearchOutput): boolean => r.b5.cac_spread_flag ?? false,
  leakyBucketFlag: (r: ResearchOutput): boolean => r.b5.leaky_bucket_flag ?? false,

  cacByChannel: (r: ResearchOutput, channel: AcquisitionType): number | null => {
    const scenarios = r.b5.cac_scenarios
    if (!scenarios) return null
    // Type-safe маппинг без unsafe as-cast
    const channelMap: Record<AcquisitionType, CACRange> = {
      PLG:       scenarios.plg,
      SEO_LED:   scenarios.seo_led,
      COMMUNITY: scenarios.community_led,
      SALES_LED: scenarios.sales_led,
    }
    const range = channelMap[channel]
    // Проверяем что range — реальный объект (не undefined из-за неожиданного ключа)
    if (!range || typeof range !== 'object') return null
    return range.mid
  },

  minAvailableCAC: (r: ResearchOutput): number | null => {
    const scenarios = r.b5.cac_scenarios
    if (!scenarios) return r.b5.cac_mid
    const allMids = [
      scenarios.plg.mid,
      scenarios.seo_led.mid,
      scenarios.community_led.mid,
    ].filter(v => typeof v === 'number' && v > 0)
    return allMids.length > 0 ? Math.min(...allMids) : null
  },

  // Block 6
  blindSpotsCount: (r: ResearchOutput): number       => r.b6.blind_spots_count ?? 0,
  blindSpotsImpact: (r: ResearchOutput): BlindSpotImpact =>
    r.b6.blind_spots_impact ?? 'NONE',
  firstSpotTeaser: (r: ResearchOutput): string | null => r.b6.first_spot_teaser,
  hasRevenueMultiplier: (r: ResearchOutput): boolean  => r.b6.has_revenue_multiplier ?? false,
  unknownMode:    (r: ResearchOutput): boolean        => r.b6.unknown_mode ?? false,

  // Block 7
  // safe fallback: 'no_go_until' — самый консервативный (мой аудит)
  verdict:        (r: ResearchOutput): Verdict  => r.b7.verdict ?? 'no_go_until',
  confidence:     (r: ResearchOutput): number   => r.b7.confidence ?? 0.5,
  bridgeText:     (r: ResearchOutput): string | null => r.b7.bridge_text,
  priorityActions: (r: ResearchOutput): string[] => r.b7.priority_actions ?? [],
  asymmetricAdvantage: (r: ResearchOutput): string | null => r.b7.asymmetric_advantage,
}

// ─────────────────────────────────────────────────────────────
// DATA SUFFICIENCY
// ─────────────────────────────────────────────────────────────

/**
 * Проверяет достаточность данных.
 *
 * v2 изменения (GPT + мой аудит):
 * - paying_ratio >= 0.05 (не > 0)
 * - проверка b7.confidence >= 0.3
 * - явные пороги для каждого поля
 */
export function checkDataSufficiency(r: ResearchOutput): 'SUFFICIENT' | 'LIMITED' {
  // Специальный случай: Block 4 пустой
  if (r.b4.gap_type === 'none' && r.b4.top_complaints.length === 0) {
    return 'LIMITED'
  }

  // Считаем валидные числовые сигналы
  const signals = [
    r.b1.paying_ratio >= 0.05,              // минимум 5% платящих
    (r.b5.cac_mid ?? 0) > 0,               // есть данные по CAC
    (r.b5.revenue_mid ?? 0) > 0,           // есть данные по выручке
    r.b2.search_volume > 0,                // есть поисковый спрос
  ].filter(Boolean).length

  const hasStructure =
    r.b4.gap_map.length > 0 ||
    r.b6.blind_spots_count > 0

  // Confidence из Block 7
  const hasAdequateConfidence = r.b7.confidence >= 0.3

  return signals >= 3 && hasStructure && hasAdequateConfidence
    ? 'SUFFICIENT'
    : 'LIMITED'
}

// ─────────────────────────────────────────────────────────────
// MATH CONTRADICTIONS
// ─────────────────────────────────────────────────────────────

export interface MathContradiction {
  field: string
  message: string
  severity: 'fatal' | 'warning'
}

/**
 * Проверяет математические противоречия.
 *
 * v2 исправления (DeepSeek + мой аудит):
 * - Убрано: cac_mid > revenue_mid (CAC vs рыночная выручка — бессмысленно)
 * - Добавлено: cac_mid > LTV одного клиента (реальная бизнес-логика)
 * - Добавлено: one_time price vs CAC (невозможная экономика)
 * - Добавлено: payback_months vs kill_switch горизонт
 * - kill_switch < sale_cycle: fatal только если вдвое короче
 */
export function checkMathContradictions(
  r: ResearchOutput,
  experimentBudget: number,
  killSwitchDays: number,
  budgetFloor: number
): MathContradiction[] {
  const result: MathContradiction[] = []

  const cacMid = r.b5.cac_mid
  const priceMedian = r.b3.price_range_median
  const paybackMonths = r.b5.payback_months
  const saleCycleDays = r.b3.sale_cycle_days

  // Проверка 1: CAC vs LTV клиента (не vs рыночная выручка)
  if (cacMid && priceMedian && priceMedian > 0) {
    const ltv = r.b3.price_model === 'one_time'
      ? priceMedian
      : priceMedian * 24  // 2 года базовый LTV для подписки

    if (cacMid > ltv) {
      result.push({
        field: 'cac_mid',
        message: `CAC ($${cacMid}) превышает LTV клиента ($${Math.round(ltv)}). Привлечение стоит больше чем клиент принесёт.`,
        severity: 'fatal',
      })
    }
  }

  // Проверка 2: One-time price vs CAC
  if (cacMid && priceMedian && r.b3.price_model === 'one_time') {
    if (cacMid > priceMedian * 0.8) {
      result.push({
        field: 'cac_mid',
        message: `CAC ($${cacMid}) > 80% от цены ($${priceMedian}) при one-time модели. Юнит-экономика невозможна.`,
        severity: 'fatal',
      })
    }
  }

  // Проверка 3: Kill switch vs цикл сделки
  if (killSwitchDays < saleCycleDays) {
    const isHard = killSwitchDays < saleCycleDays * 0.5
    result.push({
      field: 'kill_switch_days',
      message: `Горизонт (${killSwitchDays} дней) короче цикла сделки (${saleCycleDays} дней). ` +
        (isHard ? 'Получить сигнал математически невозможно.' : 'Сделку закрыть не успеете, но спрос проверить можно.'),
      severity: isHard ? 'fatal' : 'warning',
    })
  }

  // Проверка 4: Payback vs kill switch
  if (paybackMonths && killSwitchDays > 0) {
    const killSwitchMonths = killSwitchDays / 30
    if (paybackMonths > killSwitchMonths) {
      result.push({
        field: 'payback_months',
        message: `Payback (${paybackMonths} мес) длиннее горизонта (${Math.round(killSwitchMonths)} мес). Окупаемость не наступит до kill switch.`,
        severity: 'warning',
      })
    }
  }

  // Проверка 5: Бюджет ниже минимума
  if (experimentBudget < budgetFloor && budgetFloor > 0) {
    result.push({
      field: 'budget',
      message: `Бюджет ($${experimentBudget}) ниже минимума ($${budgetFloor}).`,
      severity: 'warning',
    })
  }

  return result
}

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPER
// ─────────────────────────────────────────────────────────────

/**
 * Безопасное чтение вложенного поля.
 * v2: type guard вместо unsafe as-cast (Copilot audit fix).
 */
export function getNestedField(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (
      acc !== null &&
      acc !== undefined &&
      typeof acc === 'object' &&
      !Array.isArray(acc)
    ) {
      return (acc as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

// Экспортируется только для unit-тестов.
// В production коде — используй Zod schema или Research.* getters.
