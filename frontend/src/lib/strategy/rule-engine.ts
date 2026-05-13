/**
 * TrendHunter AI — Rule Engine v1
 * src/lib/strategy/rule-engine.ts
 *
 * Три правила. Только детерминированный код.
 * LLM не принимает никаких решений здесь.
 */

import type { ResearchOutput } from './data-contract'
import type { StrategyMode, ResourceProfile, ToolstackBudget } from './block0'

// ─────────────────────────────────────────────────────────────
// CHANNEL TYPES
// ─────────────────────────────────────────────────────────────

export type ChannelType =
  | 'PLG'
  | 'COMMUNITY'
  | 'SEO'
  | 'OUTBOUND_COLD'
  | 'AI_OUTBOUND'
  | 'PAID_SOCIAL'
  | 'PAID_SEARCH'

// ─────────────────────────────────────────────────────────────
// CHANNEL ANCHORS (минимальные реальные циклы)
// ─────────────────────────────────────────────────────────────

export const CHANNEL_ANCHORS: Record<ChannelType, { min_days: number; max_days: number; min_budget: number }> = {
  PLG:           { min_days: 1,   max_days: 7,   min_budget: 0   },
  PAID_SEARCH:   { min_days: 1,   max_days: 7,   min_budget: 500 },
  PAID_SOCIAL:   { min_days: 3,   max_days: 14,  min_budget: 300 },
  AI_OUTBOUND:   { min_days: 7,   max_days: 14,  min_budget: 150 },
  COMMUNITY:     { min_days: 14,  max_days: 30,  min_budget: 0   },
  OUTBOUND_COLD: { min_days: 14,  max_days: 45,  min_budget: 86  },
  SEO:           { min_days: 90,  max_days: 180, min_budget: 0   },
}

// ─────────────────────────────────────────────────────────────
// RULE_001: AVAILABLE CHANNELS
// ─────────────────────────────────────────────────────────────

/**
 * Определяет доступные каналы на основе параметров пользователя.
 * HARD_STOP только если результат пустой массив.
 *
 * Учитывает:
 * - Бюджет ($)
 * - can_code (открывает PLG)
 * - toolstack_budget
 * - kill_switch_days (канал должен давать сигнал за этот срок)
 * - sale_cycle_days из Research (якорь реалистичности)
 */
export function getAvailableChannels(
  budget_actual: number,
  can_code: boolean,
  toolstack: ToolstackBudget,
  kill_switch_days: number,
  sale_cycle_days: number
): ChannelType[] {
  const channels: ChannelType[] = []

  // PLG — если умеет писать код (бесплатно)
  if (can_code) {
    channels.push('PLG')
  }

  // Community — всегда бесплатно, нужен горизонт ≥ 14 дней
  if (kill_switch_days >= CHANNEL_ANCHORS.COMMUNITY.min_days) {
    channels.push('COMMUNITY')
  }

  // SEO — только при достаточном горизонте (90+ дней)
  if (kill_switch_days >= CHANNEL_ANCHORS.SEO.min_days) {
    channels.push('SEO')
  }

  // Outbound Cold — минимальный бюджет $86/мес (Hunter + Instantly)
  // или не-бесплатный toolstack
  if (
    budget_actual >= CHANNEL_ANCHORS.OUTBOUND_COLD.min_budget ||
    toolstack !== 'free'
  ) {
    // Проверяем что горизонт позволяет
    if (kill_switch_days >= CHANNEL_ANCHORS.OUTBOUND_COLD.min_days) {
      channels.push('OUTBOUND_COLD')
    }
  }

  // AI Outbound — Clay + Instantly ($150-300/мес), 7-14 дней цикл
  if (
    budget_actual >= CHANNEL_ANCHORS.AI_OUTBOUND.min_budget &&
    kill_switch_days >= CHANNEL_ANCHORS.AI_OUTBOUND.min_days
  ) {
    channels.push('AI_OUTBOUND')
  }

  // Paid Social — бюджет $300+
  if (
    budget_actual >= CHANNEL_ANCHORS.PAID_SOCIAL.min_budget &&
    kill_switch_days >= CHANNEL_ANCHORS.PAID_SOCIAL.min_days
  ) {
    channels.push('PAID_SOCIAL')
  }

  // Paid Search — бюджет $500+
  if (
    budget_actual >= CHANNEL_ANCHORS.PAID_SEARCH.min_budget &&
    kill_switch_days >= CHANNEL_ANCHORS.PAID_SEARCH.min_days
  ) {
    channels.push('PAID_SEARCH')
  }

  return channels
}

/**
 * Проверяет что выбранный LLM канал входит в доступные.
 * Используется в post-generation validator для S3.
 */
export function isChannelAvailable(
  channel: ChannelType,
  available_channels: ChannelType[]
): boolean {
  return available_channels.includes(channel)
}

/**
 * Возвращает минимальный цикл для канала (из CHANNEL_ANCHORS).
 * Используется для проверки sale_cycle_fit_days в S3.
 */
export function getChannelMinDays(channel: ChannelType): number {
  return CHANNEL_ANCHORS[channel]?.min_days ?? 14
}

// ─────────────────────────────────────────────────────────────
// RULE_004: CAC TO LTV RATIO
// ─────────────────────────────────────────────────────────────

export interface Rule004Check {
  triggered: boolean
  cac_to_ltv_ratio: number | null
  cac_mid: number | null
  ltv_estimate: number | null
}

/**
 * Проверяет RULE_004: математика окупаемости.
 * cac_to_ltv_ratio > 1.0 → HARD_STOP
 */
export function checkRule004(research: ResearchOutput): Rule004Check {
  const cacMid = research.b5.cac_mid
  const revenueMid = research.b5.revenue_mid

  if (!cacMid || !revenueMid || revenueMid === 0) {
    return { triggered: false, cac_to_ltv_ratio: null, cac_mid: cacMid, ltv_estimate: null }
  }

  // LTV = годовая выручка / 12 месяцев (упрощённый monthly LTV)
  // Предполагаем что revenue_mid уже годовая (из контракта)
  const monthly_revenue = revenueMid / 12
  const ltv_estimate = monthly_revenue * 24  // 2 года как горизонт

  const cac_to_ltv_ratio = cacMid / ltv_estimate

  return {
    triggered: cac_to_ltv_ratio > 1.0,
    cac_to_ltv_ratio,
    cac_mid: cacMid,
    ltv_estimate,
  }
}

// ─────────────────────────────────────────────────────────────
// RULE_009: MODE DOWNGRADE
// ─────────────────────────────────────────────────────────────

export interface Rule009Check {
  triggered: boolean
  reason: string | null
}

/**
 * Проверяет RULE_009: низкая уверенность при go_mode → experiment_mode.
 */
export function checkRule009(
  revenue_confidence: 'HIGH' | 'MEDIUM' | 'LOW',
  strategy_mode: StrategyMode
): Rule009Check {
  if (revenue_confidence === 'LOW' && strategy_mode === 'go_mode') {
    return {
      triggered: true,
      reason: 'revenue_confidence=LOW при go_mode → переводим в experiment_mode для безопасности',
    }
  }

  return { triggered: false, reason: null }
}

// ─────────────────────────────────────────────────────────────
// RERUN LIMIT CHECK
// ─────────────────────────────────────────────────────────────

export const MAX_RERUNS = 2

/**
 * Проверяет достиг ли пользователь максимума reruns.
 * После MAX_RERUNS → nogo_exit с объяснением.
 */
export function isRerunLimitReached(rerun_count: number): boolean {
  return rerun_count >= MAX_RERUNS
}

// ─────────────────────────────────────────────────────────────
// CHEAPEST AVAILABLE CAC
// ─────────────────────────────────────────────────────────────

/**
 * Находит самый дешёвый доступный CAC из доступных каналов.
 * Используется для расчёта MIN_SIGNAL_BUDGET.
 */
export function getCheapestAvailableCAC(
  research: ResearchOutput,
  available_channels: ChannelType[]
): number | null {
  const scenarios = research.b5.cac_scenarios
  if (!scenarios) return null

  const channelToCACKey: Partial<Record<ChannelType, keyof typeof scenarios>> = {
    PLG: 'plg',
    SEO: 'seo_led',
    COMMUNITY: 'community_led',
    OUTBOUND_COLD: 'sales_led',  // приближение
    AI_OUTBOUND: 'sales_led',    // приближение (реально ниже)
  }

  let minCAC: number | null = null

  for (const channel of available_channels) {
    const key = channelToCACKey[channel]
    if (!key) continue

    const cacScenario = scenarios[key]
    if (!cacScenario || typeof cacScenario !== 'object' || !('mid' in cacScenario)) continue

    const midValue = (cacScenario as { mid: number }).mid
    // AI_OUTBOUND реально ~0.3x от SALES_LED
    const actualCAC = channel === 'AI_OUTBOUND'
      ? midValue * 0.3
      : midValue

    if (minCAC === null || actualCAC < minCAC) {
      minCAC = actualCAC
    }
  }

  return minCAC
}

/**
 * Вычисляет минимальный бюджет для получения первого сигнала.
 * Используется в бесплатном блоке для мгновенной обратной связи.
 */
export function computeMinSignalBudget(
  research: ResearchOutput,
  available_channels: ChannelType[],
  min_signal: number = 3
): number {
  const cheapestCAC = getCheapestAvailableCAC(research, available_channels)

  if (!cheapestCAC) return 0  // PLG / Community — бесплатно

  return Math.round(cheapestCAC * min_signal)
}
