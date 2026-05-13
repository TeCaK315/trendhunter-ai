/**
 * TrendHunter AI — BlockDecision v4
 * src/lib/strategy/block-decision.ts
 */

import type { ConstraintType } from './constraints/index'

export type FieldSource = 'CODE' | 'LLM'
export type FieldConfidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface DecisionField {
  value: unknown
  confidence: FieldConfidence
  source: FieldSource
  context_note?: string
}

export interface BlockDecision {
  block_id: string
  fields: Record<string, DecisionField>
  constraints_added: { type: ConstraintType; value: unknown; reason: string }[]
}

export type AllDecisions = Partial<Record<'S0' | 'S1' | 'S2' | 'S3' | 'S5', BlockDecision>>

// ─── EXTRACT FROM S0 (v4) ───

export function extractS0Decision(
  output: Record<string, unknown>,
  is_hypothesis: boolean
): BlockDecision {
  return {
    block_id: 'S0',
    fields: {
      positioning_angle: {
        value: output['positioning_angle'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Краткий угол для S1',
      },
      target_segment: {
        value: output['target_segment'], confidence: 'HIGH', source: 'CODE',
        context_note: 'Сегмент рынка',
      },
      barrier_type: {
        value: output['barrier_type'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Тип барьера — влияет на S2 feature и S5 timeline',
      },
      bridge_to_next: {
        value: output['bridge_to_next'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Мостик в S1 — используется как bridge_from_s0 в S1',
      },
      is_hypothesis: { value: is_hypothesis, confidence: 'HIGH', source: 'CODE' },
      condition: { value: output['condition'] ?? null, confidence: 'HIGH', source: 'LLM' },
    },
    constraints_added: [],
  }
}

// ─── EXTRACT FROM S1 (v4) ───

export function extractS1Decision(output: Record<string, unknown>): BlockDecision {
  return {
    block_id: 'S1',
    fields: {
      client_profile_short: {
        value: output['client_profile_short'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Краткий профиль для S2 и S3',
      },
      primary_trigger: {
        value: output['primary_trigger'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Триггер для скрипта S3',
      },
      where_to_find: {
        value: output['where_to_find'], confidence: 'MEDIUM', source: 'LLM',
        context_note: 'Места где клиент — для канала S3',
      },
      validation_signal: {
        value: output['validation_signal'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Kill switch метрика — используется в S5',
      },
      target_company_size_max: {
        value: output['target_company_size_max'] ?? null,
        confidence: 'HIGH', source: 'LLM',
      },
      price_point_monthly: {
        value: output['price_point_monthly'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Цена для S5 calculator',
      },
      price_source: {
        value: output['price_source'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Источник цены: MARKET_DATA|CALCULATION|STRATEGIC_LOGIC',
      },
      filter_questions: {
        value: output['filter_questions'] ?? [], confidence: 'HIGH', source: 'LLM',
        context_note: 'Вопросы для первого разговора в S3',
      },
    },
    constraints_added: [],
  }
}

// ─── EXTRACT FROM S2 (v4) ───

export function extractS2Decision(output: Record<string, unknown>): BlockDecision {
  const constraints_added: BlockDecision['constraints_added'] = []

  if (output['requires_team'] === true) {
    constraints_added.push({
      type: 'NO_TEAM_REQUIRED', value: false,
      reason: 'S2 определил что для v1 нужна команда',
    })
  }
  if (output['requires_enterprise_sales_motion'] === true) {
    constraints_added.push({
      type: 'NO_ENTERPRISE_SALES_MOTION', value: false,
      reason: 'S2 определил что нужен enterprise sales',
    })
  }

  return {
    block_id: 'S2',
    fields: {
      v1_feature_name: {
        value: output['v1_feature_name'], confidence: 'HIGH', source: 'LLM',
        context_note: 'S3 продаёт эту функцию',
      },
      barrier_mechanism: {
        value: output['barrier_mechanism'], confidence: 'HIGH', source: 'LLM',
        context_note: 'S3 объясняет почему не у конкурента',
      },
      minimum_artifact: {
        value: output['minimum_artifact'] ?? output['artifact_description'],
        confidence: 'HIGH', source: 'LLM',
        context_note: 'Артефакт для показа клиенту',
      },
      estimated_build_cost: {
        value: output['estimated_build_cost'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Стоимость разработки для S5',
      },
      first_build_step: {
        value: output['first_build_step'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Первый шаг — может использоваться в S5 first_action',
      },
      requires_team: {
        value: output['requires_team'] ?? false, confidence: 'HIGH', source: 'LLM',
      },
      requires_sales_team: {
        value: output['requires_sales_team'] ?? false, confidence: 'HIGH', source: 'LLM',
      },
    },
    constraints_added,
  }
}

// ─── EXTRACT FROM S3 (v4) ───

export function extractS3Decision(output: Record<string, unknown>): BlockDecision {
  return {
    block_id: 'S3',
    fields: {
      channel_type: {
        value: output['channel_type'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Канал — влияет на таймлайн S5',
      },
      sale_cycle_fit_days: {
        value: output['sale_cycle_fit_days'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Цикл для S5 timeline',
      },
      channel_kill_switch_signal: {
        value: output['channel_kill_switch_signal'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Kill switch метрика для S5',
      },
      requires_paid_budget: {
        value: output['requires_paid_budget'] ?? false, confidence: 'HIGH', source: 'LLM',
      },
      requires_sales_team: {
        value: output['requires_sales_team'] ?? false, confidence: 'HIGH', source: 'LLM',
      },
      channel_monthly_tool_cost: {
        value: output['channel_monthly_tool_cost'] ?? null, confidence: 'MEDIUM', source: 'LLM',
      },
      first_message_text: {
        value: output['first_message_text'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Дословный скрипт — S5 использует первое предложение для first_action_today',
      },
      what_to_say_about_price: {
        value: output['what_to_say_about_price'], confidence: 'HIGH', source: 'LLM',
        context_note: 'Ответ клиенту про цену — S5 расширяет до price_anchor_for_conversation',
      },
    },
    constraints_added: [],
  }
}

// ─── EXTRACT FROM S5 (v4) ───

export function extractS5Decision(output: Record<string, unknown>): BlockDecision {
  return {
    block_id: 'S5',
    fields: {
      timeline_to_first_revenue_days: {
        value: output['timeline_to_first_revenue_days'], confidence: 'HIGH', source: 'LLM',
      },
      experiment_kill_switch_date: {
        value: output['experiment_kill_switch_date'], confidence: 'HIGH', source: 'CODE',
      },
      first_action_today: {
        value: output['first_action_today'], confidence: 'HIGH', source: 'LLM',
      },
      calculator_params: {
        value: output['calculator_params'], confidence: 'HIGH', source: 'LLM',
      },
      price_anchor_for_conversation: {
        value: output['price_anchor_for_conversation'], confidence: 'HIGH', source: 'LLM',
      },
    },
    constraints_added: [],
  }
}

// ─── BUILD DATA SECTION v4 ───

export function buildFromDecisions(
  decisions: AllDecisions,
  for_block: 'S1' | 'S2' | 'S3' | 'S5'
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (for_block === 'S1' && decisions.S0) {
    result['from_s0'] = extractFieldsForBlock(decisions.S0,
      ['positioning_angle', 'target_segment', 'barrier_type',
       'is_hypothesis', 'condition', 'bridge_to_next'])
  }

  if (for_block === 'S2') {
    if (decisions.S0) {
      result['from_s0'] = extractFieldsForBlock(decisions.S0,
        ['positioning_angle', 'target_segment', 'barrier_type', 'is_hypothesis'])
    }
    if (decisions.S1) {
      result['from_s1'] = extractFieldsForBlock(decisions.S1,
        ['client_profile_short', 'primary_trigger', 'target_company_size_max',
         'filter_questions'])
    }
  }

  if (for_block === 'S3') {
    if (decisions.S0) {
      result['from_s0'] = extractFieldsForBlock(decisions.S0,
        ['positioning_angle', 'target_segment', 'barrier_type'])
    }
    if (decisions.S1) {
      result['from_s1'] = extractFieldsForBlock(decisions.S1,
        ['client_profile_short', 'primary_trigger', 'where_to_find',
         'validation_signal', 'target_company_size_max',
         'price_point_monthly', 'filter_questions'])
    }
    if (decisions.S2) {
      result['from_s2'] = extractFieldsForBlock(decisions.S2,
        ['v1_feature_name', 'barrier_mechanism', 'minimum_artifact',
         'first_build_step'])
    }
  }

  if (for_block === 'S5') {
    if (decisions.S0) {
      result['from_s0'] = extractFieldsForBlock(decisions.S0,
        ['is_hypothesis', 'barrier_type', 'condition'])
    }
    if (decisions.S1) {
      result['from_s1'] = extractFieldsForBlock(decisions.S1,
        ['validation_signal', 'price_point_monthly', 'price_source'])
    }
    if (decisions.S2) {
      result['from_s2'] = extractFieldsForBlock(decisions.S2,
        ['estimated_build_cost', 'minimum_artifact', 'v1_feature_name',
         'first_build_step', 'requires_team'])
    }
    if (decisions.S3) {
      result['from_s3'] = extractFieldsForBlock(decisions.S3,
        ['channel_type', 'sale_cycle_fit_days', 'channel_kill_switch_signal',
         'requires_paid_budget', 'requires_sales_team', 'channel_monthly_tool_cost',
         'first_message_text', 'what_to_say_about_price'])
    }
  }

  return result
}

function extractFieldsForBlock(
  decision: BlockDecision,
  fieldNames: string[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const name of fieldNames) {
    const field = decision.fields[name]
    if (!field) continue

    if (field.confidence === 'LOW') {
      result[name] = {
        value: field.value,
        confidence: 'LOW',
        note: 'Используй как контекст. Не строй обязательных решений.',
      }
    } else {
      result[name] = field.value
    }
  }

  return result
}
