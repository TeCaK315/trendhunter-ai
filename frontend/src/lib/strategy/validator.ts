/**
 * TrendHunter AI — Post-Generation Validator v4.1
 * src/lib/strategy/validator.ts
 */

import { z, ZodSchema, ZodError } from 'zod'
import type { Constraint } from './constraints/index'
import { checkAllConstraints } from './constraints/index'
import type { StrategyContext, BlockId } from './block0'
import type { ChannelType } from './rule-engine'
import { isChannelAvailable, getChannelMinDays } from './rule-engine'

// ─── TYPES ───

export type ValidationStatus =
  | 'VALID' | 'CONSTRAINT_VIOLATION' | 'SCHEMA_ERROR'
  | 'NUMERIC_ERROR' | 'CHANNEL_ERROR' | 'TAG_ERROR' | 'TRACE_ERROR'

export interface ValidationResult {
  valid: boolean
  status: ValidationStatus
  error?: ValidationError
  warnings?: string[]
}

export interface ValidationError {
  type: ValidationStatus
  field?: string
  message: string
  repair_instruction?: string
  dependency_group?: string[]
}

// ─── ENUMS ───

export const DataTraceMethodEnum = z.enum([
  'MARKET_DATA', 'COMPETITOR_SCAN', 'CALCULATION', 'STRATEGIC_LOGIC', 'USER_PROFILE',
])

export const PriceSourceEnum = z.enum(['MARKET_DATA', 'CALCULATION', 'STRATEGIC_LOGIC'])

// ─── SHARED SCHEMAS ───

const AILeverageCardSchema = z.object({
  task_id: z.string(), task_name: z.string(),
  traditional: z.object({ action: z.string(), cost: z.string(), time: z.string() }),
  primary_tool: z.object({
    tool_id: z.string(), name: z.string(), url: z.string(),
    cost_monthly: z.number().nullable(), has_free_tier: z.boolean(), niche_setup: z.string(),
  }),
  free_alternative: z.union([
    z.object({ name: z.string(), url: z.string(), limitation: z.string() }),
    z.null(),
  ]),
  svg_schema: z.string().optional(),
})

const AILeverageInlineSchema = z.object({
  tool: z.string().min(2), task: z.string().min(5), why: z.string().min(5),
})

const DataTraceEntrySchema = z.object({
  claim_id: z.string().regex(/^claim_\d+$/, 'claim_id must match claim_N format'),
  method: z.string().min(10),
})

const AlternativeRejectedSchema = z.object({
  option: z.string().min(2),
  reason: z.string().min(10),
})

// ─── BLOCK SCHEMAS v4 ───

export const S0Schema = z.object({
  angle_text: z.string().min(50),
  why_this_angle: z.string().min(20),
  so_what_for_you: z.string().min(15),
  competitor_context: z.string().min(15),
  barrier_explanation: z.string().min(15),
  condition: z.union([z.string(), z.null()]),
  positioning_angle: z.string().min(10),
  target_segment: z.enum(['B2C', 'SMB', 'ENTERPRISE']),
  barrier_type: z.enum(['DATA_MOAT', 'WORKFLOW_LOCK', 'NETWORK_EFFECT', 'SWITCHING_COST', 'SPEED']),
  is_hypothesis: z.boolean(),
  alternatives_rejected: z.array(AlternativeRejectedSchema).min(2).max(4),
  data_trace: z.array(DataTraceEntrySchema).min(1).max(8),
  bridge_to_next: z.string().min(10),
  ai_leverage: z.union([AILeverageInlineSchema, z.array(AILeverageCardSchema)]).optional(),
  option_a: z.union([z.object({ angle_text: z.string(), condition: z.string() }), z.null()]),
  option_b: z.union([z.object({ angle_text: z.string(), condition: z.string() }), z.null()]),
})

export const S1Schema = z.object({
  profile_text: z.string().min(50),
  trigger_explanation: z.string().min(15),
  where_to_find_text: z.string().min(15),
  filter_questions: z.array(z.object({
    question: z.string().min(10),
    qualifying_answer: z.string().min(5),
  })).length(3),
  so_what_for_you: z.string().min(15),
  bridge_from_s0: z.string().min(10),
  validation_signal: z.string().min(10),
  price_point_monthly: z.number().positive('price > 0').finite('finite').max(99999, 'max 99999'),
  price_source: PriceSourceEnum,
  price_explanation: z.string().min(10),
  target_segment: z.enum(['B2C', 'SMB', 'ENTERPRISE']),
  target_company_size_max: z.union([z.number().positive(), z.null()]),
  primary_trigger: z.string().min(5),
  where_to_find: z.string().min(5),
  client_profile_short: z.string().min(10),
  is_hypothesis: z.boolean(),
  data_trace: z.array(DataTraceEntrySchema).min(1).max(8),
  ai_leverage: z.union([AILeverageInlineSchema, z.array(AILeverageCardSchema)]).optional(),
  option_a: z.union([z.object({ profile_text: z.string(), condition: z.string() }), z.null()]),
  option_b: z.union([z.object({ profile_text: z.string(), condition: z.string() }), z.null()]),
})

export const S2Schema = z.object({
  feature_description: z.string().min(30),
  feature_why: z.string().min(20),
  v1_feature_name: z.string().min(3),
  not_in_v1: z.array(z.string()).min(3),
  first_build_step: z.string().min(20),
  ready_assets: z.array(z.string().min(10)).min(3).max(6),
  artifact_description: z.string().min(15),
  barrier_description: z.string().min(15),
  barrier_mechanism: z.string().min(10),
  estimated_build_cost: z.number().nonnegative(),
  cost_context: z.string().min(15),
  so_what_for_you: z.string().min(15),
  bridge_from_s1: z.string().min(10),
  requires_team: z.boolean(),
  requires_enterprise_sales_motion: z.boolean(),
  requires_sales_team: z.boolean(),
  is_hypothesis: z.boolean(),
  data_trace: z.array(DataTraceEntrySchema).min(1).max(8),
  ai_leverage: z.union([AILeverageInlineSchema, z.array(AILeverageCardSchema)]).optional(),
  option_a: z.union([z.object({ feature_description: z.string(), condition: z.string() }), z.null()]),
  option_b: z.union([z.object({ feature_description: z.string(), condition: z.string() }), z.null()]),
})

const KillSwitchSignalSchema = z.object({
  metric: z.enum(['response_rate', 'meetings_booked', 'signups', 'conversion_rate']),
  threshold: z.number().positive(),
  time_window_days: z.number().positive().int(),
})

const DayByDayEntrySchema = z.object({
  day: z.string(),
  morning_action: z.string().min(15),
  target: z.string().min(5),
  expected_result: z.string().min(10),
  if_below_expected: z.string().min(10),
})

const PriceForConversationSchema = z.object({
  standard_price: z.union([z.string(), z.number()]),
  launch_price: z.union([z.string(), z.number()]),
  what_to_say: z.string().min(20),
  when_to_raise_price: z.string().min(10),
})

export const S3Schema = z.object({
  channel_type: z.enum(['PLG', 'SEO', 'OUTBOUND_COLD', 'COMMUNITY', 'PAID_SEARCH', 'PAID_SOCIAL', 'AI_OUTBOUND']),
  channel_description: z.string().min(20),
  alternatives_rejected: z.array(AlternativeRejectedSchema).min(1).max(6),
  first_message_text: z.string().min(30),
  day_by_day: z.array(DayByDayEntrySchema).length(4),
  what_to_say_about_price: PriceForConversationSchema,
  ready_assets: z.array(z.string().min(10)).min(4).max(6),
  kill_switch_description: z.string().min(20),
  success_criteria: z.string().min(15),
  so_what_for_you: z.string().min(15),
  bridge_from_s2: z.string().min(10),
  requires_paid_budget: z.boolean(),
  requires_sales_team: z.boolean(),
  sale_cycle_fit_days: z.number().positive().int(),
  channel_monthly_tool_cost: z.union([z.number().nonnegative(), z.null()]),
  channel_kill_switch_signal: KillSwitchSignalSchema,
  data_trace: z.array(DataTraceEntrySchema).min(1).max(8),
  is_hypothesis: z.boolean(),
  ai_leverage: z.union([AILeverageInlineSchema, z.array(AILeverageCardSchema)]).optional(),
})

export const S5Schema = z.object({
  timeline_description: z.string().min(30),
  cac_explanation: z.string().min(30),
  timeline_to_first_revenue_days: z.number().positive().int(),
  milestone_30_days: z.string().min(15),
  milestone_90_days: z.string().min(15),
  success_metric_30: z.string().min(10),
  success_metric_90: z.string().min(10),
  kill_switch_description: z.string().min(20),
  experiment_kill_switch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scenario_if_behind: z.string().min(20),
  price_anchor_for_conversation: PriceForConversationSchema,
  first_action_today: z.string().min(20),
  calculator_params: z.object({
    monthly_price: z.number().positive().finite().max(99999),
    price_source: PriceSourceEnum,
    cac_market: z.union([z.number().positive().finite().max(999999), z.null()]),
    cac_real: z.number().positive().finite().max(999999),
    months_to_first_revenue: z.number().positive().finite().max(120),
  }),
  ready_assets: z.array(z.string().min(10)).min(3).max(6),
  so_what_for_you: z.string().min(15),
  bridge_from_s3: z.string().min(10),
  data_trace: z.array(DataTraceEntrySchema).min(1).max(8),
  is_hypothesis: z.boolean(),
  ai_leverage: z.union([AILeverageInlineSchema, z.array(AILeverageCardSchema)]).optional(),
  option_conservative: z.union([z.object({ timeline_days: z.number().positive(), condition: z.string() }), z.null()]),
  option_optimistic: z.union([z.object({ timeline_days: z.number().positive(), condition: z.string() }), z.null()]),
})

export const BLOCK_SCHEMAS: Record<BlockId, ZodSchema> = {
  S0: S0Schema, S1: S1Schema, S2: S2Schema, S3: S3Schema, S5: S5Schema,
}

// ─── REGEX FACTORIES (v4.1 fix — избегаем stateful lastIndex) ───

const createTagRegex = () => /<t\s+id="(claim_\d+)">([^<]+)<\/t>/g
const createUnclosedTagRegex = () => /<t\s+id="claim_\d+">(?![^<]*<\/t>)/

interface TagExtractionResult {
  valid: boolean
  foundIds: string[]
  duplicates: string[]
  hasUnclosedTags: boolean
  errorMessage?: string
}

function extractInlineTags(text: string): TagExtractionResult {
  if (!text) return { valid: true, foundIds: [], duplicates: [], hasUnclosedTags: false }

  const unclosed = createUnclosedTagRegex().test(text)
  if (unclosed) {
    return {
      valid: false, foundIds: [], duplicates: [], hasUnclosedTags: true,
      errorMessage: 'Найдены незакрытые теги <t id="claim_N"> без </t>',
    }
  }

  const ids: string[] = []
  const duplicates: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  const tagRegex = createTagRegex()

  while ((match = tagRegex.exec(text)) !== null) {
    const id = match[1]
    if (!id) continue
    if (seen.has(id)) duplicates.push(id)
    else { seen.add(id); ids.push(id) }
  }

  return {
    valid: duplicates.length === 0,
    foundIds: ids,
    duplicates,
    hasUnclosedTags: false,
    errorMessage: duplicates.length > 0 ? `Дублированные claim_id: ${duplicates.join(', ')}` : undefined,
  }
}

function validateTagsAndTrace(
  texts: string[],
  dataTrace: Array<{ claim_id: string; method: string }>
): ValidationResult {
  const allTagIds = new Set<string>()
  const duplicateIds: string[] = []

  for (const text of texts) {
    const extraction = extractInlineTags(text)
    if (!extraction.valid) {
      return {
        valid: false, status: 'TAG_ERROR',
        error: {
          type: 'TAG_ERROR',
          message: extraction.errorMessage ?? 'Ошибка в inline tags',
          repair_instruction: `TAG_ERROR: ${extraction.errorMessage}\nПроверь что все теги закрыты: <t id="claim_N">текст</t>.`,
        },
      }
    }
    extraction.foundIds.forEach(id => {
      if (allTagIds.has(id)) duplicateIds.push(id)
      allTagIds.add(id)
    })
  }

  if (duplicateIds.length > 0) {
    return {
      valid: false, status: 'TAG_ERROR',
      error: {
        type: 'TAG_ERROR',
        message: `claim_id встречаются в нескольких полях: ${duplicateIds.join(', ')}`,
        repair_instruction: `claim_id должны быть уникальны в рамках всего блока.`,
      },
    }
  }

  const traceIds = new Set(dataTrace.map(d => d.claim_id))
  const missingInTrace: string[] = []
  allTagIds.forEach(id => { if (!traceIds.has(id)) missingInTrace.push(id) })

  if (missingInTrace.length > 0) {
    return {
      valid: false, status: 'TRACE_ERROR',
      error: {
        type: 'TRACE_ERROR', field: 'data_trace',
        message: `claim_id в тексте без соответствия в data_trace: ${missingInTrace.join(', ')}`,
        repair_instruction: `Каждый claim_id в <t id="..."> должен быть в data_trace.\nОтсутствуют: ${missingInTrace.join(', ')}.`,
      },
    }
  }

  const warnings: string[] = []
  traceIds.forEach(id => {
    if (!allTagIds.has(id)) warnings.push(`data_trace.${id} не используется в тексте блока`)
  })

  return { valid: true, status: 'VALID', warnings: warnings.length > 0 ? warnings : undefined }
}

function validateTraceMethods(
  dataTrace: Array<{ claim_id: string; method: string }>
): ValidationResult {
  const validPrefixes = [
    'MARKET_DATA:', 'COMPETITOR_SCAN:', 'CALCULATION:',
    'STRATEGIC_LOGIC:', 'USER_PROFILE:',
  ]
  const invalidMethods: string[] = []

  for (const entry of dataTrace) {
    if (!entry || typeof entry.method !== 'string' || entry.method.length === 0) {
      return {
        valid: false, status: 'TRACE_ERROR',
        error: {
          type: 'TRACE_ERROR',
          field: `data_trace.${entry?.claim_id ?? 'unknown'}.method`,
          message: `method должен быть непустой строкой, получено: ${typeof entry?.method}`,
          repair_instruction: `Каждый элемент data_trace должен иметь непустое поле method строкового типа.`,
        },
      }
    }

    const hasValidPrefix = validPrefixes.some(prefix => entry.method.startsWith(prefix))
    if (!hasValidPrefix) {
      invalidMethods.push(`${entry.claim_id}: "${entry.method.slice(0, 50)}..."`)
    }

    const forbiddenPhrases: RegExp[] = [
      /\bданных\s+нет\b/i,
      /\bданные\s+отсутствуют\b/i,
      /\bне\s+удалось\s+определить\b/i,
      /\bне\s+хватило\s+данных\b/i,
      /\bсистема\s+не\s+нашла\b/i,
      /\bинформация\s+недоступна\b/i,
    ]
    for (const phraseRegex of forbiddenPhrases) {
      if (phraseRegex.test(entry.method)) {
        return {
          valid: false, status: 'TRACE_ERROR',
          error: {
            type: 'TRACE_ERROR',
            field: `data_trace.${entry.claim_id}.method`,
            message: `method содержит запрещённую формулировку: "${phraseRegex.source}"`,
            repair_instruction: `method всегда описывает КАК получена информация. Запрещены формулировки типа "данных нет".`,
          },
        }
      }
    }
  }

  if (invalidMethods.length > 0) {
    return {
      valid: false, status: 'TRACE_ERROR',
      error: {
        type: 'TRACE_ERROR', field: 'data_trace',
        message: `data_trace.method должен начинаться с одного из: ${validPrefixes.join(', ')}`,
        repair_instruction: `Формат method: "[ENUM]: описание".\nДопустимые префиксы: MARKET_DATA, COMPETITOR_SCAN, CALCULATION, STRATEGIC_LOGIC, USER_PROFILE.\nНекорректные: ${invalidMethods.join(', ')}.`,
      },
    }
  }

  return { valid: true, status: 'VALID' }
}

function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }
  return str.replace(/[&<>"']/g, ch => map[ch] ?? ch)
}

export function parseInlineTags(text: string): Array<{
  type: 'text' | 'tag'; content: string; claim_id?: string
}> {
  if (!text) return []

  const result: Array<{ type: 'text' | 'tag'; content: string; claim_id?: string }> = []
  let lastIndex = 0
  const tagRegex = createTagRegex()
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', content: escapeHtml(text.slice(lastIndex, match.index)) })
    }
    result.push({ type: 'tag', content: escapeHtml(match[2]), claim_id: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', content: escapeHtml(text.slice(lastIndex)) })
  }

  return result
}

function getTextsForTagValidation(
  block_id: BlockId, output: Record<string, unknown>
): string[] {
  const texts: string[] = []
  switch (block_id) {
    case 'S0':
      if (typeof output['angle_text'] === 'string') texts.push(output['angle_text'])
      if (typeof output['competitor_context'] === 'string') texts.push(output['competitor_context'])
      break
    case 'S1':
      if (typeof output['profile_text'] === 'string') texts.push(output['profile_text'])
      break
    case 'S2':
      if (typeof output['feature_description'] === 'string') texts.push(output['feature_description'])
      if (typeof output['feature_why'] === 'string') texts.push(output['feature_why'])
      break
    case 'S3':
      if (typeof output['first_message_text'] === 'string') texts.push(output['first_message_text'])
      break
    case 'S5':
      if (typeof output['cac_explanation'] === 'string') texts.push(output['cac_explanation'])
      if (typeof output['timeline_description'] === 'string') texts.push(output['timeline_description'])
      break
  }
  return texts
}

// ─── MAIN VALIDATOR ───

export function validateBlockOutput(params: {
  block_id: BlockId
  output: Record<string, unknown>
  constraints: Constraint[]
  context: StrategyContext
  research_data?: Record<string, unknown>
}): ValidationResult {
  const { block_id, output, constraints, context } = params
  const allWarnings: string[] = []

  // 1. Zod schema
  const schema = BLOCK_SCHEMAS[block_id]
  const schemaResult = schema.safeParse(output)
  if (!schemaResult.success) {
    const firstError = schemaResult.error.issues[0]
    return {
      valid: false, status: 'SCHEMA_ERROR',
      error: {
        type: 'SCHEMA_ERROR',
        field: (firstError.path ?? []).join('.'),
        message: `Schema error: ${firstError.message}`,
        repair_instruction: buildSchemaRepairInstruction(schemaResult.error, block_id),
      },
    }
  }

  // 2. Inline tags validation
  const texts = getTextsForTagValidation(block_id, output)
  const dataTrace = (output['data_trace'] ?? []) as Array<{ claim_id: string; method: string }>

  if (texts.length > 0 && dataTrace.length > 0) {
    const tagResult = validateTagsAndTrace(texts, dataTrace)
    if (!tagResult.valid) return tagResult
    if (tagResult.warnings) allWarnings.push(...tagResult.warnings)
  }

  // 3. Data trace method Enum
  if (dataTrace.length > 0) {
    const methodsResult = validateTraceMethods(dataTrace)
    if (!methodsResult.valid) return methodsResult
  }

  // 4. Channel validation (S3)
  if (block_id === 'S3') {
    const channelType = output['channel_type'] as ChannelType | undefined
    if (channelType && !isChannelAvailable(channelType, context.available_channels)) {
      return {
        valid: false, status: 'CHANNEL_ERROR',
        error: {
          type: 'CHANNEL_ERROR', field: 'channel_type',
          message: `channel_type "${channelType}" недоступен`,
          repair_instruction: `Доступные каналы: ${context.available_channels.join(', ')}.`,
          dependency_group: ['channel_description', 'channel_type', 'requires_paid_budget', 'sale_cycle_fit_days'],
        },
      }
    }

    if (channelType) {
      const minDays = getChannelMinDays(channelType)
      const saleCycleFit = output['sale_cycle_fit_days'] as number | undefined
      if (saleCycleFit && saleCycleFit < minDays) {
        return {
          valid: false, status: 'NUMERIC_ERROR',
          error: {
            type: 'NUMERIC_ERROR', field: 'sale_cycle_fit_days',
            message: `sale_cycle_fit_days (${saleCycleFit}) меньше минимума для ${channelType} (${minDays})`,
            repair_instruction: `Минимум: ${minDays} дней.`,
          },
        }
      }
    }

    // S3 alternatives_rejected semantic check
    const altRejectedS3 = output['alternatives_rejected'] as Array<{ option: string }> | undefined
    if (altRejectedS3 && Array.isArray(altRejectedS3) && channelType) {
      const hasDuplicate = altRejectedS3.some(alt => alt?.option === channelType)
      if (hasDuplicate) {
        return {
          valid: false, status: 'SCHEMA_ERROR',
          error: {
            type: 'SCHEMA_ERROR', field: 'alternatives_rejected',
            message: `alternatives_rejected содержит выбранный channel_type: ${channelType}`,
            repair_instruction: `alternatives_rejected — только отвергнутые каналы.`,
          },
        }
      }
    }
  }

  // S0 alternatives_rejected semantic check
  if (block_id === 'S0') {
    const barrierType = output['barrier_type'] as string | undefined
    const altRejectedS0 = output['alternatives_rejected'] as Array<{ option: string }> | undefined
    if (barrierType && altRejectedS0 && Array.isArray(altRejectedS0)) {
      const hasDuplicate = altRejectedS0.some(alt => alt?.option === barrierType)
      if (hasDuplicate) {
        return {
          valid: false, status: 'SCHEMA_ERROR',
          error: {
            type: 'SCHEMA_ERROR', field: 'alternatives_rejected',
            message: `alternatives_rejected содержит выбранный barrier_type: ${barrierType}`,
            repair_instruction: `alternatives_rejected — только отвергнутые барьеры. Убери ${barrierType}.`,
          },
        }
      }
    }
  }

  // 5. Semantic constraints
  const violation = checkAllConstraints(constraints, output)
  if (violation) {
    return {
      valid: false, status: 'CONSTRAINT_VIOLATION',
      error: {
        type: 'CONSTRAINT_VIOLATION', field: violation.field,
        message: `Constraint violation: ${violation.constraint.type}`,
        repair_instruction: violation.repair_instruction,
        dependency_group: violation.dependency_group,
      },
    }
  }

  // 6. Numeric consistency
  if (params.research_data) {
    const numericCheck = checkNumericConsistency(output, block_id, params.research_data)
    if (!numericCheck.valid) {
      return { valid: false, status: 'NUMERIC_ERROR', error: numericCheck.error! }
    }
  }

  return {
    valid: true, status: 'VALID',
    warnings: allWarnings.length > 0 ? allWarnings : undefined,
  }
}

// ─── NUMERIC CONSISTENCY ───

interface NumericCheckResult {
  valid: boolean
  error?: ValidationError
}

function checkNumericConsistency(
  output: Record<string, unknown>,
  block_id: BlockId,
  research_data: Record<string, unknown>
): NumericCheckResult {
  if (block_id === 'S5') {
    const calcParams = output['calculator_params'] as Record<string, unknown> | undefined
    const researchB5 = research_data['b5'] as Record<string, unknown> | undefined

    if (calcParams && researchB5) {
      const outputCACReal = calcParams['cac_real'] as number | null | undefined
      const cacScenarios = researchB5['cac_scenarios'] as Record<string, { mid: number }> | null

      if (outputCACReal === null || outputCACReal === undefined) {
        return {
          valid: false,
          error: {
            type: 'NUMERIC_ERROR', field: 'calculator_params.cac_real',
            message: 'cac_real не может быть null или undefined',
            repair_instruction: `cac_real — стоимость привлечения клиента. Должно быть положительное число > 0.`,
          },
        }
      }

      if (typeof outputCACReal !== 'number' || !Number.isFinite(outputCACReal) || outputCACReal <= 0) {
        return {
          valid: false,
          error: {
            type: 'NUMERIC_ERROR', field: 'calculator_params.cac_real',
            message: `cac_real должен быть конечным числом > 0, получено: ${outputCACReal}`,
            repair_instruction: `cac_real — реальная стоимость привлечения клиента. Минимум $1.`,
          },
        }
      }

      if (cacScenarios) {
        const channelCacs = Object.values(cacScenarios)
          .filter(s => s && typeof s.mid === 'number' && s.mid > 0)
          .map(s => s.mid)

        if (channelCacs.length === 0) return { valid: true }

        const hasMatch = channelCacs.some(c =>
          outputCACReal >= c * 0.8 && outputCACReal <= c * 1.2
        )

        if (!hasMatch) {
          return {
            valid: false,
            error: {
              type: 'NUMERIC_ERROR', field: 'calculator_params.cac_real',
              message: `cac_real ($${outputCACReal}) не совпадает ни с одним каналом из cac_scenarios`,
              repair_instruction: `cac_real должен быть из cac_scenarios (±20%). Доступные: ${channelCacs.map(c => `$${c}`).join(', ')}.`,
            },
          }
        }
      }
    }
  }

  return { valid: true }
}

function buildSchemaRepairInstruction(error: ZodError, block_id: BlockId): string {
  const errors = error.issues.map(e => `- ${(e.path ?? []).join('.')}: ${e.message}`).join('\n')
  return `Zod schema errors в ${block_id}:\n${errors}\n\nВерни корректный JSON со всеми обязательными полями v4 (включая so_what_for_you, data_trace, bridge_from_*, alternatives_rejected).`
}

export function markAsDegraded(
  output: Record<string, unknown>, reason: string
): Record<string, unknown> {
  return { ...output, _degraded: true, _degraded_reason: reason }
}

export function isDegraded(output: Record<string, unknown>): boolean {
  return output['_degraded'] === true
}
