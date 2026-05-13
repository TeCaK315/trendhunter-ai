/**
 * TrendHunter AI — Task Library
 * src/lib/strategy/ai-leverage/task-library.ts
 *
 * Хардкод: какие задачи нужны для каждого блока стратегии.
 * Детерминированный код — никакого LLM.
 *
 * Структура:
 *   BlockId → TaskDefinition[]
 *
 * TaskDefinition описывает ЧТО нужно сделать AI инструменту.
 * Tool Registry (tool-registry.ts) описывает КАКИМ инструментом.
 */

import type { BlockId } from '../block0'
import type { StrategyContext } from '../block0'
import type { AcquisitionType } from '../data-contract'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export type TaskId =
  | 'market_research'
  | 'competitor_analysis'
  | 'positioning_research'
  | 'social_listening'
  | 'icp_research'
  | 'prospecting'
  | 'personalized_outreach'
  | 'lead_qualification'
  | 'mvp_building'
  | 'content_creation'
  | 'revenue_tracking'
  | 'funnel_optimization'

export type NicheType = 'B2C' | 'B2B_SMB' | 'B2B_ENTERPRISE'
export type ChannelType = 'PLG' | 'SEO' | 'OUTBOUND_COLD' | 'COMMUNITY' | 'PAID_SEARCH' | 'PAID_SOCIAL' | 'AI_OUTBOUND'

export interface TaskDefinition {
  task_id: TaskId
  task_name: string
  /** Что именно делает AI вместо традиционного способа */
  traditional_action: string
  traditional_cost: string
  traditional_time: string
  /** Приоритет в блоке (1 = самая важная задача) */
  priority: number
}

// ─────────────────────────────────────────────────────────────
// TASK LIBRARY
// ─────────────────────────────────────────────────────────────

/**
 * Базовые задачи для каждого блока.
 * Не зависят от ниши или сегмента.
 */
const BASE_TASKS_BY_BLOCK: Record<BlockId, TaskDefinition[]> = {
  S0: [
    {
      task_id: 'market_research',
      task_name: 'Анализ рынка и ниши',
      traditional_action: 'Нанять маркетингового аналитика для исследования рынка',
      traditional_cost: '$4,000/мес',
      traditional_time: '2 недели',
      priority: 1,
    },
    {
      task_id: 'competitor_analysis',
      task_name: 'Мониторинг конкурентов',
      traditional_action: 'Ручной анализ сайтов конкурентов + отчёт',
      traditional_cost: '$1,500/мес',
      traditional_time: '1 неделя',
      priority: 2,
    },
    {
      task_id: 'positioning_research',
      task_name: 'Исследование позиционирования',
      traditional_action: 'Стратегический консультант для анализа позиционирования',
      traditional_cost: '$3,000 разово',
      traditional_time: '3-5 дней',
      priority: 3,
    },
  ],

  S1: [
    {
      task_id: 'social_listening',
      task_name: 'Мониторинг разговоров аудитории',
      traditional_action: 'SMM менеджер для мониторинга соцсетей и форумов',
      traditional_cost: '$3,500/мес',
      traditional_time: 'Постоянно',
      priority: 1,
    },
    {
      task_id: 'icp_research',
      task_name: 'Исследование первого клиента',
      traditional_action: 'Серия интервью с клиентами + анализ',
      traditional_cost: '$2,000 разово',
      traditional_time: '2-3 недели',
      priority: 2,
    },
    {
      task_id: 'prospecting',
      task_name: 'Поиск первых 50 клиентов',
      traditional_action: 'SDR + LinkedIn Premium для поиска лидов',
      traditional_cost: '$4,500/мес + $80/мес',
      traditional_time: '2-3 недели',
      priority: 3,
    },
  ],

  S2: [
    {
      task_id: 'mvp_building',
      task_name: 'Создание v1 продукта',
      traditional_action: 'Frontend + backend разработчик для создания MVP',
      traditional_cost: '$10,000-18,000/мес',
      traditional_time: '2-3 месяца',
      priority: 1,
    },
    {
      task_id: 'competitor_analysis',
      task_name: 'Анализ слабых мест конкурентов',
      traditional_action: 'Product менеджер + исследование рынка',
      traditional_cost: '$5,000 разово',
      traditional_time: '1 неделя',
      priority: 2,
    },
  ],

  S3: [
    {
      task_id: 'personalized_outreach',
      task_name: 'Первый контакт с клиентами',
      traditional_action: 'Copywriter + email маркетолог для написания и отправки',
      traditional_cost: '$3,000/мес',
      traditional_time: '3-5 дней',
      priority: 1,
    },
    {
      task_id: 'prospecting',
      task_name: 'Сбор базы контактов',
      traditional_action: 'SDR менеджер для поиска и квалификации лидов',
      traditional_cost: '$4,500/мес',
      traditional_time: '1-2 недели',
      priority: 2,
    },
    {
      task_id: 'lead_qualification',
      task_name: 'Квалификация лидов',
      traditional_action: 'BDR + квалификационные звонки',
      traditional_cost: '$5,000/мес',
      traditional_time: 'Постоянно',
      priority: 3,
    },
  ],

  S5: [
    {
      task_id: 'revenue_tracking',
      task_name: 'Трекинг выручки и конверсий',
      traditional_action: 'Data analyst + BI инструменты для настройки дашборда',
      traditional_cost: '$6,000/мес',
      traditional_time: '1 неделя настройки',
      priority: 1,
    },
    {
      task_id: 'funnel_optimization',
      task_name: 'Оптимизация воронки',
      traditional_action: 'CRO специалист для анализа и оптимизации',
      traditional_cost: '$4,000/мес',
      traditional_time: '2 недели',
      priority: 2,
    },
  ],
}

// ─────────────────────────────────────────────────────────────
// CONTEXT-AWARE TASK SELECTION
// ─────────────────────────────────────────────────────────────

/**
 * Возвращает задачи для блока с учётом контекста.
 * Некоторые задачи добавляются/убираются в зависимости от канала.
 *
 * Детерминированный код — никакого LLM.
 */
export function getTasksForBlock(
  block_id: BlockId,
  context: StrategyContext
): TaskDefinition[] {
  const baseTasks = [...(BASE_TASKS_BY_BLOCK[block_id] ?? [])]

  // S3: задачи зависят от канала
  if (block_id === 'S3') {
    const channels = context.available_channels as unknown as ChannelType[]

    // COMMUNITY канал → добавляем content_creation
    if (channels.includes('COMMUNITY')) {
      baseTasks.push({
        task_id: 'content_creation',
        task_name: 'Создание контента для сообщества',
        traditional_action: 'SMM менеджер + LinkedIn копирайтер',
        traditional_cost: '$3,500/мес',
        traditional_time: 'Постоянно',
        priority: 4,
      })
    }

    // PLG → убираем personalized_outreach, оставляем prospecting и qualification
    if (channels.length === 1 && channels[0] === 'PLG') {
      return baseTasks.filter(t => t.task_id !== 'personalized_outreach')
    }
  }

  // S1: для B2C убираем prospecting (другая механика, нет B2B outbound)
  if (block_id === 'S1' && context.segment === 'B2C') {
    return baseTasks.filter(t => t.task_id !== 'prospecting')
  }

  // B2C: убираем задачи для которых нет B2C инструментов в реестре.
  // Вместо молчаливых пустых карточек — просто не показываем задачу.
  // Актуально для: icp_research (S1), lead_qualification (S3)
  if (context.segment === 'B2C') {
    const NO_B2C_COVERAGE: TaskId[] = [
      // icp_research: все инструменты (Clay, Apollo) — только B2B
      // selectToolForTask fallback поможет, но задача неприменима для B2C
      // lead_qualification: CRM для B2C не применим в том же смысле
    ]
    // Пока фильтр пустой — selectToolForTask v2 fallback справится.
    // Оставляем как место для будущих исключений при расширении реестра.
    if (NO_B2C_COVERAGE.length > 0) {
      return baseTasks
        .filter(t => !NO_B2C_COVERAGE.includes(t.task_id as TaskId))
        .sort((a, b) => a.priority - b.priority)
    }
  }

  // Сортируем по приоритету
  return baseTasks.sort((a, b) => a.priority - b.priority)
}

/**
 * Конвертирует сегмент Strategy в NicheType для Tool Registry.
 */
export function segmentToNicheType(segment: string): NicheType {
  if (segment === 'B2C') return 'B2C'
  if (segment === 'ENTERPRISE') return 'B2B_ENTERPRISE'
  return 'B2B_SMB'
}

/**
 * Конвертирует AcquisitionType в ChannelType для Tool Registry.
 *
 * v2 fix: защита от undefined/null.
 * Если acqType не передан — возвращаем undefined (не OUTBOUND_COLD).
 * Caller решает что делать с undefined.
 */
export function acquisitionToChannelType(
  acqType: AcquisitionType | undefined | null
): ChannelType | undefined {
  if (!acqType) return undefined
  const map: Record<AcquisitionType, ChannelType> = {
    PLG:       'PLG',
    SEO_LED:   'SEO',
    COMMUNITY: 'COMMUNITY',
    SALES_LED: 'OUTBOUND_COLD',
  }
  return map[acqType] ?? undefined
}
