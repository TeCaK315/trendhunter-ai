/**
 * TrendHunter AI — AI Leverage Personalizer v2
 * src/lib/strategy/ai-leverage/personalizer.ts
 *
 * Изменения v2 (из аудита GPT + DeepSeek + Copilot):
 * - available_channels пустой: early return с пустым состоянием (все три)
 * - acquisition_type undefined: явная защита (DeepSeek + Gemini)
 * - buildReplacesSummary: regex парсит диапазоны $10,000-18,000 (все три)
 * - cards.length === 0: явное состояние вместо "Автоматизирует 0 задач" (Copilot)
 * - missing_tools: экспортируется для UI (Copilot)
 */

import type { BlockId, StrategyContext } from '../block0'
import type { AcquisitionType } from '../data-contract'
import {
  getTasksForBlock,
  segmentToNicheType,
  acquisitionToChannelType,
  type TaskDefinition,
  type ChannelType,
} from './task-library'
import {
  selectToolForTask,
  generateNicheSetup,
  type AILeverageCard,
  type SelectedTool,
} from './tool-registry'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface MissingTool {
  task_id: string
  task_name: string
  reason: string
}

export interface AILeverageSection {
  block_id: BlockId
  cards: AILeverageCard[]
  total_paid_monthly: number
  total_free_monthly: number
  replaces_summary: string | null
  missing_tools: MissingTool[]    // задачи без инструментов
  has_coverage_gap: boolean       // есть ли приоритетные задачи без покрытия
}

export interface AITeamSummary {
  tools: {
    tool_id: string
    name: string
    url: string
    used_in_blocks: BlockId[]
    cost_monthly: number | null
    has_free_tier: boolean
  }[]
  total_paid_monthly: number
  total_traditional_cost: number
  savings_monthly: number
  is_empty: boolean
}

// ─────────────────────────────────────────────────────────────
// MAIN: BUILD AI LEVERAGE SECTION
// ─────────────────────────────────────────────────────────────

export function buildAILeverageSection(params: {
  block_id: BlockId
  context: StrategyContext
  acquisition_type?: string
}): AILeverageSection {
  const { block_id, context, acquisition_type } = params

  // v2 FIX: ранний выход если нет доступных каналов
  if (!context.available_channels || context.available_channels.length === 0) {
    console.warn(`[AILeverage] No available channels for block ${block_id}`)
    return {
      block_id,
      cards: [],
      total_paid_monthly: 0,
      total_free_monthly: 0,
      replaces_summary: null,
      missing_tools: [],
      has_coverage_gap: false,
    }
  }

  const niche_type = segmentToNicheType(context.segment)

  // v2 FIX: явная обработка acquisition_type
  // Если acquisition_type не передан или undefined → берём первый доступный канал
  let channel_type: ChannelType | undefined
  if (acquisition_type && typeof acquisition_type === 'string') {
    channel_type = acquisitionToChannelType(acquisition_type as AcquisitionType)
  } else if (context.available_channels.length > 0) {
    channel_type = context.available_channels[0] as ChannelType
  }
  // channel_type может быть undefined — selectToolForTask обработает это корректно

  const tasks = getTasksForBlock(block_id, context)
  const cards: AILeverageCard[] = []
  const missing_tools: MissingTool[] = []

  for (const task of tasks) {
    const card = buildCard({
      task,
      niche: context.niche,
      niche_type,
      channel_type,
      toolstack_budget: context.toolstack_budget,
    })

    if (card) {
      cards.push(card)
    } else {
      // v2: фиксируем что задача без инструмента
      missing_tools.push({
        task_id:   task.task_id,
        task_name: task.task_name,
        reason:    `Нет инструмента для ${niche_type} / ${channel_type ?? 'любой канал'} / ${context.toolstack_budget}`,
      })
    }
  }

  // Есть ли дыры в приоритетных задачах (priority 1 или 2)
  const priorityTaskIds = tasks
    .filter(t => t.priority <= 2)
    .map(t => t.task_id)
  const has_coverage_gap = missing_tools.some(m =>
    priorityTaskIds.includes(m.task_id as any)
  )

  const replaces_summary = buildReplacesSummary(cards)

  return {
    block_id,
    cards,
    total_paid_monthly: cards.reduce((sum, c) => sum + (c.primary_tool.cost_monthly ?? 0), 0),
    total_free_monthly: 0,
    replaces_summary,
    missing_tools,
    has_coverage_gap,
  }
}

// ─────────────────────────────────────────────────────────────
// BUILD SINGLE CARD
// ─────────────────────────────────────────────────────────────

function buildCard(params: {
  task: TaskDefinition
  niche: string
  niche_type: any
  channel_type: ChannelType | undefined
  toolstack_budget: any
}): AILeverageCard | null {
  const { task, niche, niche_type, channel_type, toolstack_budget } = params

  const tool = selectToolForTask({
    task_id:         task.task_id,
    niche_type,
    channel_type,
    toolstack_budget,
  })

  if (!tool) return null

  const niche_setup = generateNicheSetup(tool, niche, task.task_id)

  const primary_tool: SelectedTool = {
    tool_id:       tool.tool_id,
    name:          tool.name,
    url:           tool.url,
    cost_monthly:  tool.pricing.has_free_tier ? 0 : tool.pricing.paid_start,
    has_free_tier: tool.pricing.has_free_tier,
    niche_setup,
  }

  return {
    task_id:   task.task_id,
    task_name: task.task_name,
    traditional: {
      action: task.traditional_action,
      cost:   task.traditional_cost,
      time:   task.traditional_time,
    },
    primary_tool,
    free_alternative: tool.free_alternative ? {
      name:       tool.free_alternative.tool_name,
      url:        tool.free_alternative.url,
      limitation: tool.free_alternative.limitation,
    } : null,
  }
}

// ─────────────────────────────────────────────────────────────
// REPLACES SUMMARY
// ─────────────────────────────────────────────────────────────

/**
 * v2: парсит диапазоны вида $10,000-18,000/мес (берём максимум).
 * v2: различает /мес и разово.
 * v2: возвращает null если cards пустой.
 */
function buildReplacesSummary(cards: AILeverageCard[]): string | null {
  if (cards.length === 0) return null

  let monthlyTotal = 0
  let onetimeTotal = 0

  for (const card of cards) {
    const costStr = card.traditional.cost

    // Ищем ВСЕ числа с $ (для диапазонов)
    const allMatches = costStr.match(/\$([0-9,]+)/g)
    if (!allMatches) continue

    const numbers = allMatches
      .map(m => parseInt(m.replace(/[$,]/g, ''), 10))
      .filter(n => !isNaN(n))

    if (numbers.length === 0) continue

    // При диапазоне берём максимум (worst case)
    const amount = Math.max(...numbers)

    // Определяем тип: разово или ежемесячно
    const isOneTime = /разово|one.time|единовременно/i.test(costStr)

    if (isOneTime) {
      onetimeTotal += amount
    } else {
      monthlyTotal += amount
    }
  }

  if (monthlyTotal > 0 && onetimeTotal > 0) {
    return `Заменяет работу на $${monthlyTotal.toLocaleString()}/мес + $${onetimeTotal.toLocaleString()} разово`
  }
  if (monthlyTotal > 0) {
    return `Заменяет работу на $${monthlyTotal.toLocaleString()}/мес`
  }
  if (onetimeTotal > 0) {
    return `Заменяет затраты $${onetimeTotal.toLocaleString()}`
  }

  return `Автоматизирует ${cards.length} задач`
}

// ─────────────────────────────────────────────────────────────
// AI TEAM SUMMARY (Final Screen)
// ─────────────────────────────────────────────────────────────

export function buildAITeamSummary(
  sections: AILeverageSection[]
): AITeamSummary {
  // v2: явный ранний выход при пустых секциях
  if (sections.length === 0 || sections.every(s => s.cards.length === 0)) {
    return {
      tools: [],
      total_paid_monthly: 0,
      total_traditional_cost: 0,
      savings_monthly: 0,
      is_empty: true,
    }
  }

  const toolMap = new Map<string, {
    tool_id: string
    name: string
    url: string
    used_in_blocks: BlockId[]
    cost_monthly: number | null
    has_free_tier: boolean
  }>()

  for (const section of sections) {
    for (const card of section.cards) {
      const tool = card.primary_tool
      const existing = toolMap.get(tool.tool_id)

      if (existing) {
        if (!existing.used_in_blocks.includes(section.block_id)) {
          existing.used_in_blocks.push(section.block_id)
        }
      } else {
        toolMap.set(tool.tool_id, {
          tool_id:        tool.tool_id,
          name:           tool.name,
          url:            tool.url,
          used_in_blocks: [section.block_id],
          cost_monthly:   tool.cost_monthly,
          has_free_tier:  tool.has_free_tier,
        })
      }
    }
  }

  const tools = Array.from(toolMap.values())

  const total_paid_monthly = tools.reduce(
    (sum, t) => sum + (t.cost_monthly ?? 0), 0
  )

  // Считаем традиционную стоимость через тот же парсер что buildReplacesSummary
  const total_traditional_cost = sections.reduce((sum, section) => {
    return sum + section.cards.reduce((s, card) => {
      const allMatches = card.traditional.cost.match(/\$([0-9,]+)/g)
      if (!allMatches) return s
      const numbers = allMatches
        .map(m => parseInt(m.replace(/[$,]/g, ''), 10))
        .filter(n => !isNaN(n))
      return s + (numbers.length > 0 ? Math.max(...numbers) : 0)
    }, 0)
  }, 0)

  return {
    tools,
    total_paid_monthly,
    total_traditional_cost,
    savings_monthly: Math.max(0, total_traditional_cost - total_paid_monthly),
    is_empty: false,
  }
}
