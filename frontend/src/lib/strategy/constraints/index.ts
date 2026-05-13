/**
 * TrendHunter AI — Constraints System
 * src/lib/strategy/constraints/
 *
 * vocabulary.ts — типы и интерфейсы
 * setter.ts — установка constraints в Block 0
 * checker.ts — проверка в post-generation validator
 */

// ─────────────────────────────────────────────────────────────
// VOCABULARY (15 типов)
// ─────────────────────────────────────────────────────────────

export type ConstraintType =
  | 'NO_SEGMENT'                 // target_segment (enum)
  | 'MAX_COMPANY_SIZE'           // target_company_size_max (number)
  | 'NO_CHANNEL'                 // channel_type (enum)
  | 'REQUIRES_PAID_BUDGET'       // requires_paid_budget (boolean)
  | 'MAX_PRICE_MONTHLY'          // price_point_monthly (number)
  | 'MIN_PRICE_MONTHLY'          // price_point_monthly (number)
  | 'MAX_SALE_CYCLE_DAYS'        // sale_cycle_fit_days (number)
  | 'NO_TEAM_REQUIRED'           // requires_team (boolean)
  | 'NO_SALES_TEAM_REQUIRED'     // requires_sales_team (boolean)
  | 'MAX_BUILD_COST'             // estimated_build_cost (number)
  | 'NO_ENTERPRISE_SALES_MOTION' // requires_enterprise_sales_motion (boolean)
  | 'EXPERIMENT_ONLY'            // is_hypothesis (boolean)
  | 'ALIGN_WITH_SEGMENT'         // target_company_size_max vs segment
  | 'MAX_MONTHLY_CHANNEL_COST'   // channel_monthly_tool_cost (number)
  | 'MAX_KILL_SWITCH_WINDOW'     // time_window_days ≤ channel_days

export interface Constraint {
  type: ConstraintType
  value: string | number | boolean
  source_block: 'BLOCK_0' | 'S0' | 'S1' | 'S2'
  reason: string
}

export interface ConstraintViolation {
  constraint: Constraint
  field: string
  actual_value: unknown
  expected: string
  dependency_group: string[]
  repair_instruction: string
}

// ─────────────────────────────────────────────────────────────
// SETTER (Block 0 устанавливает constraints автоматически)
// ─────────────────────────────────────────────────────────────

import type { ResearchOutput, Segment } from '../data-contract'
import type {
  ResourceProfile, StrategyMode,
  KillSwitch, UserInputs
} from '../block0'

interface SetterParams {
  inputs: UserInputs
  segment: Segment
  resource_profile: ResourceProfile
  kill_switch: KillSwitch
  research: ResearchOutput
  strategy_mode: StrategyMode
  experiment_budget: number
}

/**
 * Устанавливает все constraints из Block 0.
 * Детерминированный код — никакого LLM.
 */
export function buildConstraints(params: SetterParams): Constraint[] {
  const {
    inputs, segment, resource_profile, kill_switch,
    research, strategy_mode, experiment_budget
  } = params

  const constraints: Constraint[] = []
  const isSolo = inputs.team_size === 'solo'
  const isBootstrap = resource_profile === 'bootstrap' || resource_profile === 'ai_native_solo'
  const commercial_intent = research.b2.commercial_intent_ratio
  const sale_cycle = research.b3.sale_cycle_days

  // NO_SEGMENT:ENTERPRISE — solo + длинный цикл сделки
  if (isSolo && sale_cycle > 60) {
    constraints.push({
      type: 'NO_SEGMENT',
      value: 'ENTERPRISE',
      source_block: 'BLOCK_0',
      reason: 'Solo основатель + цикл сделки >60 дней = недостижимо без sales команды',
    })
  }

  // NO_CHANNEL:PAID_SEARCH — низкий commercial intent
  if (commercial_intent < 0.3) {
    constraints.push({
      type: 'NO_CHANNEL',
      value: 'PAID_SEARCH',
      source_block: 'BLOCK_0',
      reason: `Commercial intent ${Math.round(commercial_intent * 100)}% — платный поиск нерентабелен`,
    })
    constraints.push({
      type: 'NO_CHANNEL',
      value: 'PAID_SOCIAL',
      source_block: 'BLOCK_0',
      reason: `Commercial intent ${Math.round(commercial_intent * 100)}% — платные соцсети нерентабельны`,
    })
  }

  // MAX_SALE_CYCLE_DAYS — kill switch / 1.5
  const maxSaleCycle = Math.floor(kill_switch.channel_days / 1.5)
  if (maxSaleCycle > 0) {
    constraints.push({
      type: 'MAX_SALE_CYCLE_DAYS',
      value: maxSaleCycle,
      source_block: 'BLOCK_0',
      reason: `Kill switch ${kill_switch.channel_days} дней → максимальный цикл сделки ${maxSaleCycle} дней`,
    })
  }

  // NO_TEAM_REQUIRED — solo
  if (isSolo) {
    constraints.push({
      type: 'NO_TEAM_REQUIRED',
      value: true,
      source_block: 'BLOCK_0',
      reason: 'Solo основатель — без найма команды разработки',
    })
  }

  // NO_SALES_TEAM_REQUIRED — solo или bootstrap
  if (isSolo || isBootstrap) {
    constraints.push({
      type: 'NO_SALES_TEAM_REQUIRED',
      value: true,
      source_block: 'BLOCK_0',
      reason: `${resource_profile} профиль — без sales команды`,
    })
  }

  // MAX_BUILD_COST — bootstrap: 40% от бюджета
  if (isBootstrap && inputs.budget_actual > 0) {
    const maxBuild = Math.round(inputs.budget_actual * 0.4)
    constraints.push({
      type: 'MAX_BUILD_COST',
      value: maxBuild,
      source_block: 'BLOCK_0',
      reason: `Bootstrap: максимум 40% бюджета ($${maxBuild}) на создание v1`,
    })
  }

  // REQUIRES_PAID_BUDGET:false — bootstrap или free toolstack
  if (isBootstrap || inputs.budget_actual < 86) {
    constraints.push({
      type: 'REQUIRES_PAID_BUDGET',
      value: false,
      source_block: 'BLOCK_0',
      reason: 'Bootstrap/free stack — только бесплатные каналы',
    })
  }

  // EXPERIMENT_ONLY — experiment_mode
  if (strategy_mode === 'experiment_mode') {
    constraints.push({
      type: 'EXPERIMENT_ONLY',
      value: true,
      source_block: 'BLOCK_0',
      reason: 'experiment_mode — все выводы формулируются как гипотезы',
    })
  }

  // NO_ENTERPRISE_SALES_MOTION — solo или bootstrap
  if (isSolo || isBootstrap) {
    constraints.push({
      type: 'NO_ENTERPRISE_SALES_MOTION',
      value: true,
      source_block: 'BLOCK_0',
      reason: `${resource_profile} — без enterprise sales процесса`,
    })
  }

  // MAX_MONTHLY_CHANNEL_COST — 30% от бюджета / месяцы kill switch
  if (experiment_budget > 0 && kill_switch.experiment_days > 0) {
    const months = Math.ceil(kill_switch.experiment_days / 30)
    const maxChannelCost = Math.round(experiment_budget * 0.3 / months)
    if (maxChannelCost > 0) {
      constraints.push({
        type: 'MAX_MONTHLY_CHANNEL_COST',
        value: maxChannelCost,
        source_block: 'BLOCK_0',
        reason: `30% бюджета на инструменты канала = $${maxChannelCost}/мес`,
      })
    }
  }

  // MAX_KILL_SWITCH_WINDOW
  constraints.push({
    type: 'MAX_KILL_SWITCH_WINDOW',
    value: kill_switch.channel_days,
    source_block: 'BLOCK_0',
    reason: `Kill switch window не может превышать ${kill_switch.channel_days} дней`,
  })

  return constraints
}

// ─────────────────────────────────────────────────────────────
// CHECKER (post-generation validator использует это)
// ─────────────────────────────────────────────────────────────

/**
 * Проверяет output блока на соответствие constraint.
 * Работает ТОЛЬКО с JSON полями, никогда с prose текстом.
 */
export function checkConstraint(
  constraint: Constraint,
  output: Record<string, unknown>
): ConstraintViolation | null {

  switch (constraint.type) {

    case 'NO_SEGMENT': {
      const val = output['target_segment']
      if (val === constraint.value) {
        return {
          constraint,
          field: 'target_segment',
          actual_value: val,
          expected: `NOT ${constraint.value}`,
          dependency_group: ['angle_text', 'target_segment', 'barrier_type'],
          repair_instruction:
            `target_segment = "${val}" нарушает NO_SEGMENT:${constraint.value}. ` +
            `Причина: ${constraint.reason}. ` +
            `Выбери другой сегмент и перегенерируй group: [angle_text, target_segment, barrier_type].`,
        }
      }
      return null
    }

    case 'MAX_COMPANY_SIZE': {
      const val = output['target_company_size_max']
      if (typeof val === 'number' && val > Number(constraint.value)) {
        return {
          constraint,
          field: 'target_company_size_max',
          actual_value: val,
          expected: `≤ ${constraint.value}`,
          dependency_group: ['profile_text', 'target_segment', 'target_company_size_max'],
          repair_instruction:
            `target_company_size_max = ${val} превышает лимит ${constraint.value}. ` +
            `Причина: ${constraint.reason}. ` +
            `Выбери профиль из компаний меньшего размера.`,
        }
      }
      return null
    }

    case 'NO_CHANNEL': {
      const val = output['channel_type']
      if (val === constraint.value) {
        return {
          constraint,
          field: 'channel_type',
          actual_value: val,
          expected: `NOT ${constraint.value}`,
          dependency_group: ['channel_description', 'channel_type', 'requires_paid_budget'],
          repair_instruction:
            `channel_type = "${val}" запрещён. Причина: ${constraint.reason}. ` +
            `Выбери другой channel_type из доступных каналов.`,
        }
      }
      return null
    }

    case 'REQUIRES_PAID_BUDGET': {
      const val = output['requires_paid_budget']
      if (constraint.value === false && val === true) {
        return {
          constraint,
          field: 'requires_paid_budget',
          actual_value: val,
          expected: 'false',
          dependency_group: ['channel_description', 'channel_type', 'requires_paid_budget'],
          repair_instruction:
            `requires_paid_budget = true при бесплатном бюджете. ` +
            `Причина: ${constraint.reason}. ` +
            `Выбери бесплатный канал: PLG, COMMUNITY, или SEO.`,
        }
      }
      return null
    }

    case 'MAX_SALE_CYCLE_DAYS': {
      const val = output['sale_cycle_fit_days']
      if (typeof val === 'number' && val > Number(constraint.value)) {
        return {
          constraint,
          field: 'sale_cycle_fit_days',
          actual_value: val,
          expected: `≤ ${constraint.value} дней`,
          dependency_group: ['channel_description', 'channel_type', 'sale_cycle_fit_days'],
          repair_instruction:
            `sale_cycle_fit_days = ${val} дней превышает kill switch ${constraint.value} дней. ` +
            `Причина: ${constraint.reason}. ` +
            `Выбери канал с более коротким циклом.`,
        }
      }
      return null
    }

    case 'NO_TEAM_REQUIRED': {
      const val = output['requires_team']
      if (constraint.value === true && val === true) {
        return {
          constraint,
          field: 'requires_team',
          actual_value: val,
          expected: 'false',
          dependency_group: ['feature_description', 'requires_team', 'estimated_build_cost'],
          repair_instruction:
            `requires_team = true для solo основателя. ` +
            `Причина: ${constraint.reason}. ` +
            `Предложи функцию которую один человек создаст без найма. ` +
            `Используй no-code/AI инструменты вместо разработки.`,
        }
      }
      return null
    }

    case 'NO_SALES_TEAM_REQUIRED': {
      const val = output['requires_sales_team']
      if (constraint.value === true && val === true) {
        return {
          constraint,
          field: 'requires_sales_team',
          actual_value: val,
          expected: 'false',
          dependency_group: ['channel_description', 'channel_type', 'requires_sales_team'],
          repair_instruction:
            `requires_sales_team = true при ограничении. ` +
            `Причина: ${constraint.reason}. ` +
            `Выбери канал где продажи автоматизированы (PLG, AI_OUTBOUND).`,
        }
      }
      return null
    }

    case 'MAX_BUILD_COST': {
      const val = output['estimated_build_cost']
      if (typeof val === 'number' && val > Number(constraint.value)) {
        return {
          constraint,
          field: 'estimated_build_cost',
          actual_value: val,
          expected: `≤ $${constraint.value}`,
          dependency_group: ['feature_description', 'requires_team', 'estimated_build_cost'],
          repair_instruction:
            `estimated_build_cost = $${val} превышает лимит $${constraint.value}. ` +
            `Причина: ${constraint.reason}. ` +
            `Если MAX_BUILD_COST < $500: предложи no-code или ручную демонстрацию. ` +
            `Укажи в feature_description что полная разработка требует большего бюджета.`,
        }
      }
      return null
    }

    case 'NO_ENTERPRISE_SALES_MOTION': {
      const val = output['requires_enterprise_sales_motion']
      if (constraint.value === true && val === true) {
        return {
          constraint,
          field: 'requires_enterprise_sales_motion',
          actual_value: val,
          expected: 'false',
          dependency_group: ['feature_description', 'requires_enterprise_sales_motion'],
          repair_instruction:
            `requires_enterprise_sales_motion = true при ограничении. ` +
            `Причина: ${constraint.reason}. ` +
            `Предложи продукт с self-service моделью.`,
        }
      }
      return null
    }

    case 'EXPERIMENT_ONLY': {
      const val = output['is_hypothesis']
      if (constraint.value === true && val !== true) {
        return {
          constraint,
          field: 'is_hypothesis',
          actual_value: val,
          expected: 'true',
          dependency_group: ['angle_text', 'condition', 'is_hypothesis'],
          repair_instruction:
            `is_hypothesis должен быть true в experiment_mode. ` +
            `Причина: ${constraint.reason}. ` +
            `Каждое утверждение должно содержать условие: "если X → то Y". ` +
            `Перегенерируй group: [angle_text, condition, is_hypothesis].`,
        }
      }
      return null
    }

    case 'ALIGN_WITH_SEGMENT': {
      const segment = output['target_segment']
      const size = output['target_company_size_max']

      if (segment === 'B2C' && size !== null && size !== undefined) {
        return {
          constraint,
          field: 'target_company_size_max',
          actual_value: size,
          expected: 'null для B2C',
          dependency_group: ['profile_text', 'target_segment', 'target_company_size_max'],
          repair_instruction:
            `target_company_size_max должен быть null для B2C сегмента.`,
        }
      }

      if (segment === 'SMB' && typeof size === 'number' && size > 200) {
        return {
          constraint,
          field: 'target_company_size_max',
          actual_value: size,
          expected: '≤ 200 для SMB',
          dependency_group: ['profile_text', 'target_segment', 'target_company_size_max'],
          repair_instruction:
            `SMB сегмент → target_company_size_max ≤ 200. ` +
            `Текущее: ${size}. Скорректируй профиль клиента.`,
        }
      }

      if (segment === 'ENTERPRISE' && typeof size === 'number' && size < 201) {
        return {
          constraint,
          field: 'target_company_size_max',
          actual_value: size,
          expected: '≥ 201 для ENTERPRISE',
          dependency_group: ['profile_text', 'target_segment', 'target_company_size_max'],
          repair_instruction:
            `ENTERPRISE сегмент → target_company_size_max ≥ 201. ` +
            `Текущее: ${size}. Скорректируй профиль клиента.`,
        }
      }

      return null
    }

    case 'MAX_MONTHLY_CHANNEL_COST': {
      const val = output['channel_monthly_tool_cost']
      if (typeof val === 'number' && val > Number(constraint.value)) {
        return {
          constraint,
          field: 'channel_monthly_tool_cost',
          actual_value: val,
          expected: `≤ $${constraint.value}/мес`,
          dependency_group: ['channel_description', 'channel_type', 'channel_monthly_tool_cost'],
          repair_instruction:
            `channel_monthly_tool_cost = $${val} превышает лимит $${constraint.value}. ` +
            `Причина: ${constraint.reason}. ` +
            `Выбери более дешёвый канал или используй бесплатные инструменты.`,
        }
      }
      return null
    }

    case 'MAX_KILL_SWITCH_WINDOW': {
      const signal = output['channel_kill_switch_signal']
      if (signal && typeof signal === 'object') {
        const timeWindow = (signal as Record<string, unknown>)['time_window_days']
        if (typeof timeWindow === 'number' && timeWindow > Number(constraint.value)) {
          return {
            constraint,
            field: 'channel_kill_switch_signal.time_window_days',
            actual_value: timeWindow,
            expected: `≤ ${constraint.value} дней`,
            dependency_group: ['kill_switch_description', 'channel_kill_switch_signal'],
            repair_instruction:
              `kill_switch_signal.time_window_days = ${timeWindow} превышает ` +
              `kill_switch.channel_days = ${constraint.value}. ` +
              `Уменьши time_window_days до ${constraint.value} или меньше.`,
          }
        }
      }
      return null
    }

    case 'MAX_PRICE_MONTHLY': {
      const val = output['price_point_monthly']
      if (typeof val === 'number' && val > Number(constraint.value)) {
        return {
          constraint,
          field: 'price_point_monthly',
          actual_value: val,
          expected: `≤ $${constraint.value}`,
          dependency_group: ['profile_text', 'price_point_monthly'],
          repair_instruction:
            `price_point_monthly = $${val} выше лимита $${constraint.value}. ` +
            `Выбери клиента с более низким чеком.`,
        }
      }
      return null
    }

    case 'MIN_PRICE_MONTHLY': {
      const val = output['price_point_monthly']
      if (typeof val === 'number' && val < Number(constraint.value)) {
        return {
          constraint,
          field: 'price_point_monthly',
          actual_value: val,
          expected: `≥ $${constraint.value}`,
          dependency_group: ['profile_text', 'price_point_monthly'],
          repair_instruction:
            `price_point_monthly = $${val} ниже минимума $${constraint.value}. ` +
            `Выбери клиента с более высоким чеком для окупаемости.`,
        }
      }
      return null
    }

    default:
      return null
  }
}

/**
 * Проверяет все constraints для output блока.
 * Возвращает первое найденное нарушение.
 */
export function checkAllConstraints(
  constraints: Constraint[],
  output: Record<string, unknown>
): ConstraintViolation | null {
  for (const constraint of constraints) {
    const violation = checkConstraint(constraint, output)
    if (violation) return violation
  }
  return null
}

/**
 * Строит ACTIVE CONSTRAINTS секцию для промпта (ЧАСТЬ 0).
 * LLM видит явный список ограничений перед генерацией.
 */
export function buildActiveConstraintsPrompt(constraints: Constraint[]): string {
  if (constraints.length === 0) return ''

  const lines = constraints.map((c, i) =>
    `${i + 1}. ${c.type}: ${JSON.stringify(c.value)} — ${c.reason}`
  )

  return `ACTIVE CONSTRAINTS (соблюдай обязательно):
${lines.join('\n')}

Все эти ограничения — жёсткие. Твой JSON output должен их соблюдать.`
}
