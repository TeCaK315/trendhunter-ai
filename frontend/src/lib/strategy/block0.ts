/**
 * TrendHunter AI — Hidden Block 0
 * src/lib/strategy/block0.ts
 *
 * Формирует StrategyContext. Запускается в бесплатном блоке.
 * Пользователь не видит механику. Видит только статус (🟢🟡🔴).
 */

import {
  ResearchOutput, Research, checkDataSufficiency,
  checkMathContradictions, validateResearchData,
  type Segment, type AcquisitionType, type MathContradiction
} from './data-contract'
import { getAvailableChannels, type ChannelType } from './rule-engine'
import { buildConstraints, type Constraint } from './constraints/index'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type StrategyMode = 'go_mode' | 'experiment_mode' | 'nogo_pivot' | 'nogo_exit'
export type ResourceProfile = 'ai_native_solo' | 'bootstrap' | 'standard' | 'funded'
export type BlockId = 'S0' | 'S1' | 'S2' | 'S3' | 'S5'
export type ToolstackBudget = 'free' | 'low' | 'medium' | 'paid'

export interface UserInputs {
  budget_actual: number             // $ в месяц на эксперимент
  horizon_months: 1 | 2 | 3 | 6    // через сколько месяцев нужен сигнал
  team_size: 'solo' | 'small' | 'team'
  can_code: boolean
  has_audience: boolean
  has_partner: boolean
}

export interface StrategyContext {
  strategy_mode: StrategyMode
  resource_profile: ResourceProfile
  data_confidence: 'high' | 'medium' | 'low'
  data_sufficiency: 'SUFFICIENT' | 'LIMITED'
  segment: Segment
  kill_switch: KillSwitch
  experiment_budget: number         // после применения FLOOR
  strategy_available: boolean
  constraints: Constraint[]
  condition: string | null
  degraded_sections: string[]
  current_date: string              // YYYY-MM-DD
  can_code: boolean
  toolstack_budget: ToolstackBudget
  available_channels: ChannelType[]

  // Для удобства доступа в блоках
  niche: string
  user_inputs: UserInputs
}

export interface KillSwitch {
  channel_days: number
  experiment_days: number
  min_signal: number
}

export interface Block0Result {
  context: StrategyContext
  hard_stop: HardStop | null
  warnings: string[]
}

export interface HardStop {
  rule: 'RULE_001' | 'RULE_004' | 'RULE_009'
  reason: string
  path_a: { label: string; description: string; action: string }
  path_b: { label: string; description: string; action: string }
}

// ─────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────

/** Минимальный бюджет для получения первого сигнала (по сегменту) */
export const EXPERIMENT_BUDGET_FLOOR: Record<Segment, number> = {
  B2C: 500,
  SMB: 1_500,
  ENTERPRISE: 5_000,
}

/** Горизонт эксперимента по resource_profile (дни) */
const EXPERIMENT_DAYS: Record<ResourceProfile, number> = {
  ai_native_solo: 45,
  bootstrap: 60,
  standard: 90,
  funded: 180,
}

/** Дни kill switch для канала */
const CHANNEL_KILL_SWITCH_DAYS: Record<ResourceProfile, number> = {
  ai_native_solo: 14,
  bootstrap: 14,
  standard: 21,
  funded: 21,
}

// ─────────────────────────────────────────────────────────────
// MAIN: COMPUTE STRATEGY CONTEXT
// ─────────────────────────────────────────────────────────────

/**
 * Главная функция Block 0.
 * Принимает данные из Research + вводные пользователя.
 * Возвращает StrategyContext или HardStop.
 */
export function computeStrategyContext(params: {
  research: ResearchOutput
  inputs: UserInputs
  niche: string
  trend_id: string
}): Block0Result {
  const { research: r, inputs, niche } = params
  const warnings: string[] = []

  // ── 1. Определяем сегмент рынка ──────────────────────────
  const segment = detectSegment(r)

  // ── 2. Resource profile из вводных ───────────────────────
  const resource_profile = detectResourceProfile(inputs)

  // ── 3. Kill switch ────────────────────────────────────────
  const kill_switch = computeKillSwitch(inputs, resource_profile)

  // ── 4. Experiment budget с учётом floor ──────────────────
  const raw_budget = inputs.budget_actual
  const budget_floor = EXPERIMENT_BUDGET_FLOOR[segment]
  const experiment_budget = Math.max(
    Research.experimentBudget(r),
    budget_floor
  )

  if (raw_budget < budget_floor) {
    warnings.push(
      `Бюджет ($${raw_budget}) ниже минимума ($${budget_floor}) для ${segment} ниши`
    )
  }

  // ── 5. Toolstack budget из вводных ───────────────────────
  const toolstack_budget = detectToolstackBudget(inputs)

  // ── 6. Доступные каналы ──────────────────────────────────
  const available_channels = getAvailableChannels(
    inputs.budget_actual,
    inputs.can_code,
    toolstack_budget,
    kill_switch.channel_days,
    r.b3.sale_cycle_days
  )

  // ── 7. RULE_001: нет доступных каналов ──────────────────
  if (available_channels.length === 0) {
    return {
      context: buildMinimalContext(segment, resource_profile, niche, inputs),
      hard_stop: buildHardStop001(inputs),
      warnings,
    }
  }

  // ── 8. has_pivot_angle ────────────────────────────────────
  const pivot_angle = hasPivotAngle(r)

  // ── 9. Strategy mode ──────────────────────────────────────
  const verdict = Research.verdict(r)
  const confidence = Research.confidence(r)
  const revenue_confidence = Research.revenueConfidence(r)

  let strategy_mode: StrategyMode

  if (verdict === 'no_go_until') {
    strategy_mode = pivot_angle ? 'nogo_pivot' : 'nogo_exit'
  } else if (verdict === 'go_if' && confidence > 0.65) {
    strategy_mode = 'go_mode'
  } else {
    // experiment_if OR go_if с низкой уверенностью
    strategy_mode = 'experiment_mode'
  }

  // ── 10. RULE_009: downgrade ───────────────────────────────
  if (revenue_confidence === 'LOW' && strategy_mode === 'go_mode') {
    strategy_mode = 'experiment_mode'
    warnings.push('revenue_confidence=LOW → переведено в experiment_mode')
  }

  // ── 11. nogo_exit: стратегия недоступна ──────────────────
  if (strategy_mode === 'nogo_exit') {
    return {
      context: buildMinimalContext(segment, resource_profile, niche, inputs),
      hard_stop: null,
      warnings,
    }
  }

  // ── 12. RULE_004: экономика не сходится ──────────────────
  const cacMid = Research.cacMid(r)
  const revenueMid = Research.revenueMid(r)

  if (cacMid && revenueMid && revenueMid > 0) {
    const ltv = revenueMid / 12  // упрощённый monthly LTV
    const cac_to_ltv = cacMid / ltv

    if (cac_to_ltv > 1.0) {
      return {
        context: buildMinimalContext(segment, resource_profile, niche, inputs),
        hard_stop: buildHardStop004(r, segment),
        warnings,
      }
    }
  }

  // ── 13. Condition для experiment_mode ────────────────────
  const condition = getCondition(r, strategy_mode, kill_switch)

  // ── 14. Data sufficiency ─────────────────────────────────
  const data_sufficiency = checkDataSufficiency(r)
  const data_confidence = detectDataConfidence(r)

  // ── 15. Constraints ──────────────────────────────────────
  const constraints = buildConstraints({
    inputs,
    segment,
    resource_profile,
    kill_switch,
    research: r,
    strategy_mode,
    experiment_budget,
  })

  // ── 16. Math contradictions (предупреждения) ─────────────
  const contradictions = checkMathContradictions(
    r, experiment_budget, kill_switch.channel_days, budget_floor
  )
  for (const c of contradictions) {
    warnings.push(c.message)
  }

  // ── 17. Degraded sections ────────────────────────────────
  const degraded_sections = detectDegradedSections(r, data_sufficiency)

  // ── 18. Собираем финальный контекст ─────────────────────
  const context: StrategyContext = {
    strategy_mode,
    resource_profile,
    data_confidence,
    data_sufficiency,
    segment,
    kill_switch,
    experiment_budget,
    strategy_available: (strategy_mode as StrategyMode) !== 'nogo_exit',
    constraints,
    condition,
    degraded_sections,
    current_date: new Date().toISOString().split('T')[0],
    can_code: inputs.can_code,
    toolstack_budget,
    available_channels,
    niche,
    user_inputs: inputs,
  }

  return { context, hard_stop: null, warnings }
}

// ─────────────────────────────────────────────────────────────
// SEGMENT DETECTION
// ─────────────────────────────────────────────────────────────

export function detectSegment(r: ResearchOutput): Segment {
  const marketType = Research.marketType(r)
  if (marketType === 'B2C') return 'B2C'

  const signals = [
    r.b3.price_range_median !== null && r.b3.price_range_median > 500,
    r.b4.acquisition_type === 'SALES_LED',
    r.b3.sale_cycle_days > 30,
  ].filter(Boolean).length

  if (signals >= 2) return 'ENTERPRISE'
  return 'SMB'
}

// ─────────────────────────────────────────────────────────────
// RESOURCE PROFILE
// ─────────────────────────────────────────────────────────────

function detectResourceProfile(inputs: UserInputs): ResourceProfile {
  if (inputs.budget_actual < 500 || inputs.team_size === 'solo') {
    return 'ai_native_solo'
  }
  if (inputs.budget_actual < 5_000) return 'bootstrap'
  if (inputs.budget_actual < 20_000) return 'standard'
  return 'funded'
}

// ─────────────────────────────────────────────────────────────
// KILL SWITCH
// ─────────────────────────────────────────────────────────────

function computeKillSwitch(
  inputs: UserInputs,
  profile: ResourceProfile
): KillSwitch {
  const horizon_days = inputs.horizon_months * 30

  return {
    channel_days: Math.min(
      CHANNEL_KILL_SWITCH_DAYS[profile],
      horizon_days
    ),
    experiment_days: Math.min(
      EXPERIMENT_DAYS[profile],
      horizon_days
    ),
    min_signal: 3,
  }
}

// ─────────────────────────────────────────────────────────────
// TOOLSTACK BUDGET
// ─────────────────────────────────────────────────────────────

function detectToolstackBudget(inputs: UserInputs): ToolstackBudget {
  const budget = inputs.budget_actual
  if (budget < 50) return 'free'
  if (budget < 200) return 'low'
  if (budget < 500) return 'medium'
  return 'paid'
}

// ─────────────────────────────────────────────────────────────
// HAS PIVOT ANGLE
// ─────────────────────────────────────────────────────────────

export function hasPivotAngle(r: ResearchOutput): boolean {
  // Условие 1: открытый gap с реальными платящими
  const firstGap = r.b4.gap_map[0]
  if (r.b4.gap_type !== 'none' && firstGap && firstGap.paying_ratio > 0.2)
    return true

  // Условие 2: значимые слепые пятна HIGH impact
  if (r.b6.blind_spots_count > 0 && r.b6.blind_spots_impact === 'HIGH')
    return true

  // Условие 3: revenue multiplier
  if (r.b6.has_revenue_multiplier === true)
    return true

  // Условие 4: рынок платит + низкая конкуренция + есть аномалии
  if (
    r.b1.paying_ratio > 0.20 &&
    r.b4.competition_intensity === 'LOW' &&
    r.b6.blind_spots_count > 0
  ) return true

  return false
}

// ─────────────────────────────────────────────────────────────
// CONDITION (для experiment_mode)
// ─────────────────────────────────────────────────────────────

function getCondition(
  r: ResearchOutput,
  mode: StrategyMode,
  kill_switch: KillSwitch
): string | null {
  if (mode !== 'experiment_mode') return null

  if (r.b5.cac_spread_flag && r.b5.cac_mid) {
    const plgCac = Math.round(r.b5.cac_mid * 0.3)
    return `CAC через PLG ≤ $${plgCac} на выборке 10 клиентов`
  }

  if (r.b4.avg_switching_cost === 'HIGH') {
    return `3 из 10 потенциальных клиентов назвали switching cost главным барьером`
  }

  if (r.b6.blind_spots_count > 1) {
    return `Первые 5 клиентов пришли НЕ через ${r.b4.acquisition_type} канал`
  }

  return `3 платящих клиента через выбранный канал за ${kill_switch.channel_days} дней`
}

// ─────────────────────────────────────────────────────────────
// DATA CONFIDENCE
// ─────────────────────────────────────────────────────────────

function detectDataConfidence(r: ResearchOutput): 'high' | 'medium' | 'low' {
  const confidence = Research.confidence(r)
  const revenueConf = Research.revenueConfidence(r)
  const dataQualityConf = r.b6.data_quality_confidence

  if (confidence >= 0.7 && revenueConf === 'HIGH' && dataQualityConf === 'HIGH')
    return 'high'

  if (confidence < 0.5 || revenueConf === 'LOW' || dataQualityConf === 'LOW')
    return 'low'

  return 'medium'
}

// ─────────────────────────────────────────────────────────────
// DEGRADED SECTIONS
// ─────────────────────────────────────────────────────────────

function detectDegradedSections(
  r: ResearchOutput,
  sufficiency: 'SUFFICIENT' | 'LIMITED'
): string[] {
  const sections: string[] = []

  if (sufficiency === 'LIMITED') {
    sections.push('S0', 'S1')
  }

  if (!r.b5.revenue_mid || !r.b5.cac_mid) {
    sections.push('S5')
  }

  if (r.b4.gap_map.length === 0) {
    sections.push('S2')
  }

  return [...new Set(sections)] // убираем дубли
}

// ─────────────────────────────────────────────────────────────
// HARD STOP BUILDERS
// ─────────────────────────────────────────────────────────────

function buildHardStop001(inputs: UserInputs): HardStop {
  const canCode = inputs.can_code

  return {
    rule: 'RULE_001',
    reason: 'При текущем бюджете и горизонте нет доступных каналов для проверки ниши.',
    path_a: {
      label: 'Добавить бесплатный канал',
      description: canCode
        ? 'Построй PLG продукт — первые пользователи без бюджета на маркетинг.'
        : 'Начни с Community: LinkedIn + Reddit — $0, первый сигнал за 30 дней.',
      action: canCode ? 'PLG' : 'COMMUNITY',
    },
    path_b: {
      label: 'Выбрать другую нишу',
      description: 'Покажем 3 ниши с похожим профилем и лучшими параметрами входа.',
      action: 'alternative_niches',
    },
  }
}

function buildHardStop004(r: ResearchOutput, segment: Segment): HardStop {
  const cacMid = Research.cacMid(r) ?? 0
  const priceMedian = Research.priceMedian(r) ?? 0
  const suggestedPrice = Math.round(cacMid * 3 / 12) // cac*3 за год / 12 мес

  return {
    rule: 'RULE_004',
    reason: 'Стоимость привлечения клиента превышает то что он приносит. Математика не сходится.',
    path_a: {
      label: 'Изменить модель монетизации',
      description: priceMedian > 0
        ? `Поднять цену до $${suggestedPrice}/мес — тогда экономика сходится. Или добавить annual billing (первый платёж покрывает CAC сразу).`
        : 'Добавить annual billing — первый платёж покрывает CAC сразу.',
      action: 'change_pricing',
    },
    path_b: {
      label: 'Сменить канал привлечения',
      description: `Сменить с текущего канала на PLG или Community — CAC снижается в 5-20 раз.`,
      action: 'change_channel',
    },
  }
}

// ─────────────────────────────────────────────────────────────
// MINIMAL CONTEXT (для hard_stop и nogo_exit случаев)
// ─────────────────────────────────────────────────────────────

function buildMinimalContext(
  segment: Segment,
  resource_profile: ResourceProfile,
  niche: string,
  inputs: UserInputs
): StrategyContext {
  return {
    strategy_mode: 'nogo_exit',
    resource_profile,
    data_confidence: 'low',
    data_sufficiency: 'LIMITED',
    segment,
    kill_switch: { channel_days: 14, experiment_days: 45, min_signal: 3 },
    experiment_budget: 0,
    strategy_available: false,
    constraints: [],
    condition: null,
    degraded_sections: [],
    current_date: new Date().toISOString().split('T')[0],
    can_code: inputs.can_code,
    toolstack_budget: 'free',
    available_channels: [],
    niche,
    user_inputs: inputs,
  }
}
