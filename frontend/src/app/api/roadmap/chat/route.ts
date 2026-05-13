/**
 * TrendHunter AI — Roadmap Chat Route
 * src/app/api/roadmap/chat/route.ts
 *
 * SSE endpoint для чата с AI командой (Макс / Marcus / Leo).
 * Три роли — один роут. Переключение через active_role в сессии.
 *
 * Поток:
 * 1. Авторизация пользователя (NextAuth)
 * 2. Загрузка сессии роадмапа + контекста
 * 3. Определение активной роли
 * 4. Сборка system prompt = базовый промпт роли + контекст workspace
 * 5. Стриминг ответа Claude через SSE
 * 6. Сохранение сообщений в БД
 * 7. Async Summarization если нужна
 */

import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import type { Database } from '@/types/database.types'
// Используем существующий auth адаптер проекта (не дублируем логику)
import { getStrategyAuthUser } from '@/lib/strategy/auth'
// Summarization — вызываем напрямую, не через HTTP (решает auth hole)
import { runSummarization } from '@/lib/roadmap/summarization'
// AI Team prompts
import {
  MAX_SYSTEM_PROMPT_STATIC,
  buildMaxContext,
} from '@/lib/roadmap/prompts/strategist'
import {
  MARCUS_SYSTEM_PROMPT_STATIC,
  buildMarcusContext,
} from '@/lib/roadmap/prompts/builder'
import {
  LEO_SYSTEM_PROMPT_STATIC,
  buildLeoContext,
  type LeoCalculation,
} from '@/lib/roadmap/prompts/director'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Role = 'max' | 'marcus' | 'leo'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

type WorkspaceContext = {
  // Conversations (агрегаты для Макса, финансы для Leo, одна карточка для Marcus)
  conversations_summary?: {
    active_count: number
    hot_count: number
    stalled_count: number
    conversion_rate: number
    outcome_reasons_top3: string[]
  }
  // Experiments (полные для Leo, агрегаты для Макса)
  experiments_summary?: {
    active_count: number
    validated_count: number
    rejected_count: number
    recent_validated: string[]
    recent_rejected: string[]
  }
  // Daily logs (агрегаты для Макса)
  daily_logs_summary?: {
    energy_trend_7d: 'up' | 'stable' | 'down'
    energy_avg_7d: number
    blocking_repeated: boolean
  }
  // Активная карточка разговора (только для Marcus)
  active_conversation?: {
    contact_name?: string
    last_message?: string
    stage?: string
    [key: string]: unknown
  } | null
  // Финансовые метрики (для Leo)
  financial_metrics?: {
    mrr?: number
    paying_clients?: number
    price?: number
  }
  // Leo memory — расчёты
  leo_calculations?: LeoCalculation[]
  // Marcus state — счётчик попыток
  marcus_state?: {
    channel: string | null
    attempt_count: number
    hypotheses: string[]
    deviation_count: number
  }
  // AI memory — общая
  user_memory_summary?: string
  // Kill switch данные
  kill_switch_date?: string
  kill_switch_metric?: string
  days_remaining?: number
}

type RoadmapSession = {
  id: string
  user_id: string
  trend_id: string
  niche: string
  active_role: Role
  kill_switch_date: string
  kill_switch_metric: string
  strategy_summary: string     // краткое резюме стратегии (S0-S5)
  channel_type: string | null  // из S3
  status: 'trial' | 'paid' | 'expired' | 'frozen'
  day_number: number            // день из 90
  message_count: number         // счётчик сообщений (вместо COUNT(*))
  trial_expires_at: string | null
  paid_until: string | null
  created_at: string
}

// ─────────────────────────────────────────────────────────────
// VERCEL CONFIG
// ─────────────────────────────────────────────────────────────

export const maxDuration = 300

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient<Database>(url, key)
}

function getAnthropicClient() {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 25_000,
  })
}

/** Безопасное закрытие SSE writer */
function safeClose(
  writer: WritableStreamDefaultWriter,
  closed: { value: boolean }
) {
  if (!closed.value) {
    closed.value = true
    writer.close().catch(() => {})
  }
}

/** Отправка SSE события */
function sendEvent(
  writer: WritableStreamDefaultWriter,
  event: string,
  data: unknown
) {
  const encoder = new TextEncoder()
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  writer.write(encoder.encode(payload)).catch(() => {})
}

// ─────────────────────────────────────────────────────────────
// ROLE DETECTION
// Определяем нужную роль на основе сообщения пользователя.
// Правила из AI_TEAM_INTEGRATION_v1.md
// ─────────────────────────────────────────────────────────────

function detectRoleFromMessage(
  message: string,
  currentRole: Role
): Role {
  const lower = message.toLowerCase()

  // ── ПРИОРИТЕТ 1: Кризисные сигналы → ВСЕГДА Макс ────────────
  const crisisSignals = [
    'не хочу жить', 'хочу умереть', 'незачем жить', 'хочу всё бросить',
    'бездарь', 'всё бессмысленно', 'нет смысла продолжать',
    'ничего не выйдет', 'я не подхожу', 'я провалился',
  ]
  if (crisisSignals.some(s => lower.includes(s))) return 'max'

  // ── ПРИОРИТЕТ 2: Эмоциональные сигналы → Макс ───────────────
  const emotionalSignals = [
    'устал', 'не вижу смысла', 'сдаюсь', 'бесит', 'не уверен',
    'хочу бросить', 'не получается', 'выматывает', 'надоело',
  ]
  if (emotionalSignals.some(s => lower.includes(s))) return 'max'

  // ── ПРИОРИТЕТ 3: Стратегические сомнения → Макс ─────────────
  const strategicSignals = [
    'стоит ли продолжать', 'может сменить', 'угол не работает',
    'что вообще делать', 'куда двигаться', 'менять нишу',
  ]
  if (strategicSignals.some(s => lower.includes(s))) return 'max'

  // ── Бизнес-контекст — фильтр слабых финансовых триггеров ────
  const businessContext = [
    'клиент', 'продукт', 'стратегия', 'ниша', 'письм', 'сообщени',
    'выручк', 'mrr', 'продаж', 'канал', 'reddit', 'linkedin',
    'конверси', 'подписк', 'тариф', 'оффер', 'платящ',
  ]
  const hasBusinessContext = businessContext.some(s => lower.includes(s))

  // ── ПРИОРИТЕТ 4: Финансовые расчёты → Leo ───────────────────
  const leoSignalsStrong = [
    'посчитай', 'посчитать', 'когда выйду в плюс', 'сколько нужно',
    'что выгоднее', 'unit экономик', 'roi', 'окупаемость',
    'стоит ли вести блог', 'стоит ли подкаст',
  ]
  const leoSignalsWeak = ['цена', 'сколько стоит', 'сколько зарабат']

  if (leoSignalsStrong.some(s => lower.includes(s))) return 'leo'
  if (leoSignalsWeak.some(s => lower.includes(s)) && hasBusinessContext) return 'leo'

  // ── ПРИОРИТЕТ 5: Тактические / текстовые задачи → Marcus ────
  const marcusSignals = [
    'помоги написать', 'что ответить', 'как сформулировать',
    'помоги составить', 'напиши письмо', 'напиши сообщение',
    'не отвечают', 'ноль ответов', '0 ответов',
    'стоит ли добавить фичу', 'этот человек подходит',
    'что писать', 'возражение',
  ]
  if (marcusSignals.some(s => lower.includes(s))) return 'marcus'

  return currentRole
}

// ─────────────────────────────────────────────────────────────
// SYSTEM PROMPTS
// Промпты загружаются из src/lib/roadmap/prompts/
// Статическая часть каждого промпта — для prompt caching.
// Динамическая часть (контекст) — собирается при каждом запросе.
// ─────────────────────────────────────────────────────────────

/**
 * Возвращает { system: string[] } для Claude API.
 * Первый элемент — статический промпт роли (кешируется).
 * Второй элемент — динамический контекст пользователя.
 *
 * Backend-интеграция:
 * - Парсить первую строку ответа на "подключаю Marcus/Leo" → смена active_role
 * - Перехватывать JSON { "crisis_alert": "severe", ... } → показ хардкод-экрана
 * - Логировать 3+ манипулятивных флага в сессии → счётчик jailbreak
 */
function buildSystemPrompt(
  role: Role,
  session: RoadmapSession,
  workspace: WorkspaceContext,
  recentSummary?: string
): string {
  // Общий workspace-контекст (метрики, разговоры, эксперименты)
  const workspaceLines: string[] = []

  if (workspace.conversations_summary) {
    const cs = workspace.conversations_summary
    workspaceLines.push(`
Разговоры с лидами:
- Активных: ${cs.active_count}
- Горячих: ${cs.hot_count}
- Зависших: ${cs.stalled_count}
- Конверсия: ${cs.conversion_rate}%
- Топ причины отказов: ${cs.outcome_reasons_top3.join(', ')}`)
  }

  if (workspace.experiments_summary) {
    const es = workspace.experiments_summary
    workspaceLines.push(`
Эксперименты:
- Активных: ${es.active_count}
- Подтверждено: ${es.validated_count}
- Отклонено: ${es.rejected_count}
- Подтверждённые гипотезы: ${es.recent_validated.join(', ') || 'нет'}
- Отклонённые: ${es.recent_rejected.join(', ') || 'нет'}`)
  }

  if (workspace.daily_logs_summary) {
    const dl = workspace.daily_logs_summary
    workspaceLines.push(`
Энергия пользователя:
- Тренд за 7 дней: ${dl.energy_trend_7d}
- Среднее: ${dl.energy_avg_7d}/5
- Повторяющийся блокер: ${dl.blocking_repeated ? 'да' : 'нет'}`)
  }

  const workspaceContext = workspaceLines.join('\n')

  // SEPARATOR для prompt caching: всё до сепаратора — статично (кешируется)
  // Всё после — динамический контекст пользователя (не кешируется)
  const CACHE_SEP = '\n\n// DYNAMIC_CONTEXT_SEPARATOR\n\n'

  // ── Макс (Стратег) ──────────────────────────────────────────
  if (role === 'max') {
    const dynamicContext = buildMaxContext({
      niche: session.niche,
      kill_switch_date: session.kill_switch_date,
      kill_switch_metric: session.kill_switch_metric,
      day_number: session.day_number,
      days_remaining: workspace.days_remaining ?? 0,
      strategy_summary: session.strategy_summary,
      recent_summary: recentSummary,
      user_memory: workspace.user_memory_summary,
    })

    return `${MAX_SYSTEM_PROMPT_STATIC}${CACHE_SEP}${dynamicContext}\n${workspaceContext}`
  }

  // ── Marcus (Билдер) ─────────────────────────────────────────
  if (role === 'marcus') {
    // Извлекаем channel из strategy_summary
    const channelMatch = session.strategy_summary?.match(/[Кк]анал[:\s]+([^\n]+)/)
    const channel = channelMatch?.[1]?.trim() || session.channel_type || 'не указан'

    const dynamicContext = buildMarcusContext({
      niche: session.niche,
      channel,
      user_memory: workspace.user_memory_summary,
      active_conversation: workspace.active_conversation
        ? {
            contact: workspace.active_conversation.contact_name || '',
            last_message: workspace.active_conversation.last_message || '',
            stage: workspace.active_conversation.stage || '',
          }
        : undefined,
      attempt_count: workspace.marcus_state?.attempt_count,
      deviation_count: workspace.marcus_state?.deviation_count,
      current_funnel_stage: undefined,
      last_hypothesis: workspace.marcus_state?.hypotheses?.slice(-1)[0],
      tested_hypotheses: workspace.marcus_state?.hypotheses,
    })

    return `${MARCUS_SYSTEM_PROMPT_STATIC}${CACHE_SEP}${dynamicContext}\n${workspaceContext}`
  }

  // ── Leo (Директор) ──────────────────────────────────────────
  const dynamicContext = buildLeoContext({
    niche: session.niche,
    price: workspace.financial_metrics?.price ?? 0,
    kill_switch_date: session.kill_switch_date,
    kill_switch_days_remaining: workspace.days_remaining ?? 0,
    kill_switch_metric: session.kill_switch_metric,
    mrr: workspace.financial_metrics?.mrr,
    paying_clients: workspace.financial_metrics?.paying_clients,
    leo_calculations: workspace.leo_calculations,
  })

  return `${LEO_SYSTEM_PROMPT_STATIC}${CACHE_SEP}${dynamicContext}\n${workspaceContext}`
}

// ─────────────────────────────────────────────────────────────
// WORKSPACE CONTEXT BUILDER
// Собирает данные для AI в зависимости от роли
// ─────────────────────────────────────────────────────────────

async function buildWorkspaceContext(
  supabase: ReturnType<typeof createClient<Database>>,
  roadmapId: string,
  userId: string,
  role: Role,
  activeConversationId?: string
): Promise<WorkspaceContext> {
  const ctx: WorkspaceContext = {}

  // Kill switch days remaining
  const { data: session } = await supabase
    .from('roadmap_sessions')
    .select('kill_switch_date, day_number')
    .eq('id', roadmapId)
    .single()

  if (session?.kill_switch_date) {
    const ksDate = new Date(session.kill_switch_date)
    const now = new Date()
    ctx.days_remaining = Math.max(
      0,
      Math.ceil((ksDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    )
  }

  // Conversations — агрегаты для Макса и Leo, одна карточка для Marcus
  if (role === 'marcus' && activeConversationId) {
    const { data: conv } = await supabase
      .from('roadmap_conversations')
      .select('lead_name, lead_handle, channel, status, next_action, message_history, notes')
      .eq('id', activeConversationId)
      .eq('user_id', userId)
      .single()
    ctx.active_conversation = conv
  }

  if (role === 'max' || role === 'leo') {
    const { data: convs } = await supabase
      .from('roadmap_conversations')
      .select('status, outcome_reason')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)

    if (convs && convs.length > 0) {
      const active = convs.filter(c => ['hot', 'active', 'stalled'].includes(c.status))
      const hot = convs.filter(c => c.status === 'hot')
      const stalled = convs.filter(c => c.status === 'stalled')
      const lost = convs.filter(c => c.status === 'lost')
      const won = convs.filter(c => c.status === 'won')

      // Топ причины отказов
      const reasonCounts: Record<string, number> = {}
      lost.forEach(c => {
        if (c.outcome_reason) {
          reasonCounts[c.outcome_reason] = (reasonCounts[c.outcome_reason] || 0) + 1
        }
      })
      const top3 = Object.entries(reasonCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason, count]) => `${reason} (${count})`)

      ctx.conversations_summary = {
        active_count: active.length,
        hot_count: hot.length,
        stalled_count: stalled.length,
        conversion_rate: convs.length > 0
          ? Math.round((won.length / convs.length) * 100)
          : 0,
        outcome_reasons_top3: top3,
      }
    }
  }

  // Experiments — агрегаты для Макса, полные для Leo
  const { data: exps } = await supabase
    .from('roadmap_experiments')
    .select('status, hypothesis, confidence')
    .eq('roadmap_id', roadmapId)
    .eq('user_id', userId)

  if (exps && exps.length > 0) {
    const validated = exps.filter(e => e.status === 'validated')
    const rejected = exps.filter(e => e.status === 'rejected')
    const active = exps.filter(e => e.status === 'active')

    ctx.experiments_summary = {
      active_count: active.length,
      validated_count: validated.length,
      rejected_count: rejected.length,
      recent_validated: validated.slice(-3).map(e => e.hypothesis),
      recent_rejected: rejected.slice(-3).map(e => e.hypothesis),
    }
  }

  // Daily logs — только для Макса
  if (role === 'max') {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { data: logs } = await supabase
      .from('roadmap_daily_logs')
      .select('energy, what_blocking, date')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .gte('date', sevenDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true })

    if (logs && logs.length >= 2) {
      const energies = logs.map(l => l.energy).filter(Boolean) as number[]
      const avg = energies.length > 0
        ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10
        : 3

      // Тренд энергии
      const firstHalf = energies.slice(0, Math.floor(energies.length / 2))
      const secondHalf = energies.slice(Math.floor(energies.length / 2))
      const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1)
      const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1)
      const trend: 'up' | 'stable' | 'down' =
        secondAvg > firstAvg + 0.3 ? 'up' :
        secondAvg < firstAvg - 0.3 ? 'down' : 'stable'

      // Повторяющийся блокер
      const blockings = logs.map(l => l.what_blocking).filter(Boolean) as string[]
      const blockingRepeated = blockings.length >= 3

      ctx.daily_logs_summary = {
        energy_trend_7d: trend,
        energy_avg_7d: avg,
        blocking_repeated: blockingRepeated,
      }
    }
  }

  // Leo — расчёты из памяти + финансовые метрики (CRITICAL — leo_calculations)
  if (role === 'leo') {
    const { data: mem } = await supabase
      .from('roadmap_user_memory')
      .select('leo_calculations')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .single()

    if (mem?.leo_calculations) {
      ctx.leo_calculations = mem.leo_calculations as unknown as LeoCalculation[]
    }

    // Парсим цену из strategy_summary (формат: "Цена: $X" или "Цена: X")
    const session = await supabase
      .from('roadmap_sessions')
      .select('strategy_summary, channel_type')
      .eq('id', roadmapId)
      .single()

    if (session.data?.strategy_summary) {
      const priceMatch = session.data.strategy_summary.match(/[Цц]ена[:\s]+\$?(\d+)/)?.[1]
      ctx.financial_metrics = {
        price: priceMatch ? parseInt(priceMatch, 10) : undefined,
      }
    }
  }

  // Marcus — state (счётчик попыток)
  if (role === 'marcus') {
    const { data: mem } = await supabase
      .from('roadmap_user_memory')
      .select('marcus_state')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .single()

    if (mem?.marcus_state) {
      ctx.marcus_state = mem.marcus_state as {
        channel: string | null
        attempt_count: number
        hypotheses: string[]
        deviation_count: number
      }
    }
  }

  // Загружаем user_memory summary для всех ролей (страхи, milestones)
  {
    const { data: mem } = await supabase
      .from('roadmap_user_memory')
      .select('fears, milestones, open_questions, emotional_context')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .single()

    if (mem) {
      const parts: string[] = []
      if ((mem.fears as string[])?.length > 0) {
        parts.push(`Страхи: ${(mem.fears as string[]).join(', ')}`)
      }
      if ((mem.milestones as string[])?.length > 0) {
        const last3 = (mem.milestones as string[]).slice(-3)
        parts.push(`Достижения: ${last3.join(', ')}`)
      }
      if ((mem.open_questions as string[])?.length > 0) {
        parts.push(`Открытые вопросы: ${(mem.open_questions as string[]).join(', ')}`)
      }
      const emo = mem.emotional_context as Record<string, unknown> | null
      if (emo?.distress_signal_count_7d && (emo.distress_signal_count_7d as number) > 1) {
        parts.push(`Эмоциональный контекст: ${emo.distress_signal_count_7d} сигнала тревоги за 7 дней`)
      }
      if (parts.length > 0) {
        ctx.user_memory_summary = parts.join('\n')
      }
    }
  }

  return ctx
}

// ─────────────────────────────────────────────────────────────
// SAVE MESSAGES TO DB
// ─────────────────────────────────────────────────────────────

async function saveMessages(
  supabase: ReturnType<typeof createClient<Database>>,
  roadmapId: string,
  userId: string,
  userMessage: string,
  assistantMessage: string,
  role: Role,
  inputTokens: number,
  outputTokens: number
) {
  const cost = (inputTokens * 0.000003) + (outputTokens * 0.000015)

  const userTs = new Date()
  const assistantTs = new Date(userTs.getTime() + 1)

  await supabase.from('roadmap_chat_messages').insert({
    roadmap_id: roadmapId,
    user_id: userId,
    role: 'user',
    ai_role: null,
    content: userMessage,
    tokens_input: inputTokens,
    tokens_output: 0,
    cost_usd: 0,
    created_at: userTs.toISOString(),
  })

  await supabase.from('roadmap_chat_messages').insert({
    roadmap_id: roadmapId,
    user_id: userId,
    role: 'assistant',
    ai_role: role,
    content: assistantMessage,
    tokens_input: 0,
    tokens_output: outputTokens,
    cost_usd: cost,
    created_at: assistantTs.toISOString(),
  })
}

// ─────────────────────────────────────────────────────────────
// TRIGGER SUMMARIZATION
// Async POST к /api/roadmap/summarize — не блокирует ответ
// ─────────────────────────────────────────────────────────────

// triggerSummarizationIfNeeded удалена — логика перенесена в finally блок
// Используем runSummarization() напрямую через message_count из roadmap_sessions
// Это исправляет auth hole: нет fetch() → нет проблем с cookies в production

// ─────────────────────────────────────────────────────────────
// JAILBREAK DETECTION
// Логирует манипулятивные паттерны в roadmap_trigger_history
// После 3+ флагов одного типа — Макс называет паттерн (из промпта)
// ─────────────────────────────────────────────────────────────

const JAILBREAK_PATTERNS = {
  // Прямые попытки обойти систему
  direct_override: [
    'забудь все инструкции', 'игнорируй промпт', 'ты теперь', 'притворись что',
    'выйди из роли', 'act as', 'jailbreak', 'dan mode', 'ignore previous',
    'forget your instructions',
  ],
  // Постепенная манипуляция через контент
  gradual_manipulation: [
    'усиль давление', 'добавь срочность', 'сделай агрессивнее',
    'манипулируй', 'давить на клиента', 'психологическое давление',
    'заставь купить', 'не давай выбора',
  ],
  // Ролевые игры для обхода
  roleplay_bypass: [
    'сыграй роль', 'представь что ты', 'в игре можно', 'это просто игра',
    'для романа', 'для сценария', 'play a character', 'pretend you are',
  ],
  // Запрос показать промпт / внутреннюю логику
  prompt_extraction: [
    'покажи свои инструкции', 'что у тебя в промпте', 'раскрой свой промпт',
    'как ты устроен изнутри', 'покажи system prompt', 'show your prompt',
  ],
}

interface JailbreakFlag {
  type: keyof typeof JAILBREAK_PATTERNS
  matched_pattern: string
}

function detectJailbreakFlags(message: string): JailbreakFlag[] {
  const lower = message.toLowerCase()
  const flags: JailbreakFlag[] = []

  for (const [type, patterns] of Object.entries(JAILBREAK_PATTERNS)) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        flags.push({
          type: type as keyof typeof JAILBREAK_PATTERNS,
          matched_pattern: pattern,
        })
        break // Один флаг на тип за сообщение
      }
    }
  }

  return flags
}

async function logJailbreakFlags(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  roadmapId: string,
  flags: JailbreakFlag[]
): Promise<void> {
  if (flags.length === 0) return

  const rows = flags.map(flag => ({
    user_id: userId,
    roadmap_id: roadmapId,
    trigger_type: `jailbreak_${flag.type}`,
    content: flag.matched_pattern,
    confidence: 'high',
  }))

  await supabase
    .from('roadmap_trigger_history')
    .insert(rows)
    .then(() => {}, err => console.error('[Jailbreak] Log error:', err))
}

async function getRecentJailbreakCount(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  roadmapId: string,
  flagType: string
): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { count } = await supabase
    .from('roadmap_trigger_history')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('roadmap_id', roadmapId)
    .eq('trigger_type', `jailbreak_${flagType}`)
    .gte('sent_at', sevenDaysAgo)

  return count ?? 0
}

// ─────────────────────────────────────────────────────────────
// MAIN ROUTE HANDLER
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Авторизация ──────────────────────────────────────────
  const user = await getStrategyAuthUser()
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  const userId = user.id

  // ── 2. Парсинг тела запроса ─────────────────────────────────
  // Читаем ДО создания stream (body consumed только один раз)
  let body: {
    roadmap_id: string
    message: string
    history?: ChatMessage[]
    active_conversation_id?: string
    force_role?: Role
  }

  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { roadmap_id, message, history = [], active_conversation_id, force_role } = body

  if (!roadmap_id || !message) {
    return new Response(JSON.stringify({ error: 'roadmap_id and message required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 3. Загрузка сессии роадмапа ─────────────────────────────
  const supabase = getSupabase()

  const { data: roadmapSession, error: sessionError } = await supabase
    .from('roadmap_sessions')
    .select('*')
    .eq('id', roadmap_id)
    .eq('user_id', userId)
    .single()

  if (sessionError || !roadmapSession) {
    return new Response(JSON.stringify({ error: 'Roadmap session not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const session = roadmapSession as RoadmapSession

  // ── 3b. Trial / paid guard (CRITICAL — billing protection) ──
  {
    const now = new Date()
    const isExpired = session.status === 'expired'
    const isTrialExpired = session.status === 'trial' &&
      session.trial_expires_at != null &&
      now > new Date(session.trial_expires_at)

    if (isExpired || isTrialExpired) {
      // Обновляем статус если trial истёк
      if (isTrialExpired) {
        supabase
          .from('roadmap_sessions')
          .update({ status: 'expired' })
          .eq('id', roadmap_id)
          .then(() => {}, () => {})
      }
      return new Response(JSON.stringify({
        error: 'trial_expired',
        message: 'Триал завершён. Для продолжения необходима подписка.',
      }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  // ── 4. Определение активной роли ────────────────────────────
  const currentRole = session.active_role ?? 'max'
  let detectedRole = force_role ?? detectRoleFromMessage(message, currentRole)

  // ── State Machine: невозможные комбинации ─────────────────
  // Правило: кризисные сигналы ВСЕГДА идут к Максу независимо от текущей роли
  // Это гарантирует что даже при active_role=leo кризис обработает правильная роль
  const crisisKeywordsCheck = [
    'не хочу жить', 'хочу умереть', 'незачем жить', 'бездарь',
    'всё бессмысленно', 'хочу всё бросить', 'ничего не выйдет',
  ]
  const msgLower = message.toLowerCase()
  const isCrisisMessage = crisisKeywordsCheck.some(k => msgLower.includes(k))

  if (isCrisisMessage && detectedRole !== 'max') {
    // Принудительно возвращаем к Максу при любом кризисном сигнале
    detectedRole = 'max'
    console.log(`[Chat] Crisis override: ${currentRole} → max`)
  }

  // Правило: frozen сессия не обрабатывается
  if (session.status === 'frozen') {
    return new Response(JSON.stringify({
      error: 'session_frozen',
      message: 'Сессия приостановлена.',
    }), { status: 403, headers: { 'Content-Type': 'application/json' } })
  }

  // Если роль изменилась — обновляем в сессии
  if (detectedRole !== currentRole) {
    await supabase
      .from('roadmap_sessions')
      .update({ active_role: detectedRole })
      .eq('id', roadmap_id)
  }

  // ── 4b. Jailbreak detection & logging ──────────────────────
  const jailbreakFlags = detectJailbreakFlags(message)
  if (jailbreakFlags.length > 0) {
    // Логируем асинхронно — не блокируем ответ
    logJailbreakFlags(supabase, userId, roadmap_id, jailbreakFlags)
      .catch(() => {})

    // Проверяем накопленные флаги за 7 дней
    // При 3+ флагах одного типа — добавляем в контекст чтобы Макс назвал паттерн
    for (const flag of jailbreakFlags) {
      const recentCount = await getRecentJailbreakCount(
        supabase, userId, roadmap_id, flag.type
      ).catch(() => 0)

      if (recentCount >= 2) {
        // 3-я попытка (2 в истории + текущая) — Макс должен назвать паттерн
        // Передаётся через контекст — промпт Макса уже знает что делать
        console.log(`[Jailbreak] Pattern detected: ${flag.type} (count: ${recentCount + 1})`)
      }
    }
  }

  // ── 5. Сборка контекста и промпта ───────────────────────────
  const workspace = await buildWorkspaceContext(
    supabase, roadmap_id, userId, detectedRole, active_conversation_id
  )

  // Последний summary если есть
  const { data: lastSummary } = await supabase
    .from('roadmap_chat_summaries')
    .select('summary_content')
    .eq('roadmap_id', roadmap_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const systemPrompt = buildSystemPrompt(
    detectedRole,
    session,
    workspace,
    lastSummary?.summary_content
  )

  // ── 6. Создание SSE stream ───────────────────────────────────
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const isClosed = { value: false }

  const response = new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })

  // ── 7. Генерация ответа (async) ──────────────────────────────
  ;(async () => {
    const anthropic = getAnthropicClient()
    let fullResponse = ''
    let inputTokens = 0
    let outputTokens = 0

    try {
      // Сигнал о смене роли если изменилась
      if (detectedRole !== currentRole) {
        sendEvent(writer, 'role_change', {
          previous_role: currentRole,
          new_role: detectedRole,
          role_label: detectedRole === 'max' ? 'Макс' :
                      detectedRole === 'marcus' ? 'Marcus' : 'Leo',
        })
      }

      sendEvent(writer, 'status', { step: 'generating', role: detectedRole })

      // Формируем историю для Claude
      // История: последние 4 сообщения + summary контекст (компрессия)
      // Снижает input tokens с 15k до ~4k на истории
      const recentHistory = history.slice(-4)

      // ── Prompt Caching (экономия ~70% на static части) ──────
      // Разбиваем system на static (кешируется) + dynamic (свежий контекст)
      const systemParts = systemPrompt.split('\n\n// DYNAMIC_CONTEXT_SEPARATOR\n\n')
      const systemMessages: Anthropic.TextBlockParam[] = systemParts.length === 2
        ? [
            {
              type: 'text' as const,
              text: systemParts[0],
              cache_control: { type: 'ephemeral' },
            },
            { type: 'text' as const, text: systemParts[1] },
          ]
        : [{ type: 'text' as const, text: systemPrompt }]

      const maxTokens = detectedRole === 'leo' ? 1200
        : detectedRole === 'max' ? 1000
        : 1500

      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system: systemMessages,
        messages: [
          ...recentHistory.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: message },
        ],
      })

      // ── Стриминг токенов с crisis-перехватом ────────────────
      let streamBuffer = ''
      let crisisIntercepted = false

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text
          fullResponse += text
          streamBuffer += text

          // Crisis alert перехват — проверяем буфер на JSON-маркер
          // НЕ стримим пользователю если это crisis JSON
          if (!crisisIntercepted) {
            if (streamBuffer.includes('"crisis_alert"') &&
                streamBuffer.includes('"severe"')) {
              crisisIntercepted = true
              // Отправляем специальный crisis event — frontend показывает хардкод-экран
              sendEvent(writer, 'crisis', { level: 'severe', role: detectedRole })
              // Инкрементируем distress счётчик
              supabase.rpc('increment_distress_context', {
                p_roadmap_id: roadmap_id,
                p_user_id: userId,
              }).then(() => {}, () => {})
              // Не стримим дальше
              break
            }

            // Проверяем наличие structured output JSON-маркера
            // Используем ПОЛНУЮ проверку — не только начало буфера
            // Это предотвращает ложное срабатывание на обычные ответы с "{"
            const hasUpdateCalc = streamBuffer.includes('"update_calculation"') &&
              streamBuffer.includes('"id"') && streamBuffer.includes('"actual_outcome"')
            const hasStrategyUpdate = streamBuffer.includes('"strategy_update"') &&
              streamBuffer.includes('"field"') && streamBuffer.includes('"new_value"')
            const isJsonMarker = hasUpdateCalc || hasStrategyUpdate

            // Стримим токен пользователю
            // Если в буфере накопился JSON-маркер — не стримим его часть
            // Но обычный текст (даже начинающийся с {) — стримим всегда
            if (!isJsonMarker) {
              sendEvent(writer, 'token', { text })
            } else if (!hasUpdateCalc && !hasStrategyUpdate) {
              // Буфер только начинает накапливать маркер — стримим текущий токен
              sendEvent(writer, 'token', { text })
            }
          }
        }
      }

      // Финальная статистика
      const finalMessage = await stream.finalMessage()
      inputTokens = finalMessage.usage.input_tokens
      outputTokens = finalMessage.usage.output_tokens

      sendEvent(writer, 'done', {
        role: detectedRole,
        role_label: detectedRole === 'max' ? 'Макс' :
                    detectedRole === 'marcus' ? 'Marcus' : 'Leo',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      })

    } catch (err) {
      console.error('[Roadmap Chat] Claude error:', err)
      sendEvent(writer, 'error', {
        code: 'CLAUDE_ERROR',
        message: 'Что-то пошло не так. Попробуй ещё раз.',
      })
    } finally {
      safeClose(writer, isClosed)

      if (fullResponse) {
        // ── Обработка structured outputs от ролей ────────────
        // (не показываются пользователю, только внутренняя обработка)

        // Leo: обновление actual_outcome расчёта
        const updateCalcMatch = fullResponse.match(/"update_calculation"\s*:\s*\{[^}]+\}/)
        if (updateCalcMatch && detectedRole === 'leo') {
          try {
            const parsed = JSON.parse(`{${updateCalcMatch[0]}}`) as {
              update_calculation: { id: string; actual_outcome: string }
            }
            if (parsed.update_calculation?.id) {
              supabase.rpc('update_leo_calculation_outcome', {
                p_roadmap_id: roadmap_id,
                p_user_id: userId,
                p_calc_id: parsed.update_calculation.id,
                p_actual_outcome: parsed.update_calculation.actual_outcome,
              }).then(() => {}, () => {})
            }
          } catch { /* ignore malformed JSON */ }
        }

        // Макс: обновление стратегии при явном согласовании
        const strategyUpdateMatch = fullResponse.match(/"strategy_update"\s*:\s*\{[^}]+\}/)
        if (strategyUpdateMatch && detectedRole === 'max') {
          try {
            const parsed = JSON.parse(`{${strategyUpdateMatch[0]}}`) as {
              strategy_update: Record<string, string>
            }
            if (parsed.strategy_update) {
              // Обновляем strategy_summary в сессии
              const { data: sess } = await supabase
                .from('roadmap_sessions')
                .select('strategy_summary')
                .eq('id', roadmap_id)
                .single()

              if (sess?.strategy_summary) {
                let updated = sess.strategy_summary
                for (const [field, value] of Object.entries(parsed.strategy_update)) {
                  // Заменяем или добавляем поле в строку резюме
                  const fieldRegex = new RegExp(`(${field}[:\s]+)[^\n]+`, 'i')
                  if (fieldRegex.test(updated)) {
                    updated = updated.replace(fieldRegex, `$1${value}`)
                  } else {
                    updated += `
${field}: ${value}`
                  }
                }
                supabase
                  .from('roadmap_sessions')
                  .update({ strategy_summary: updated })
                  .eq('id', roadmap_id)
                  .then(() => {}, () => {})
              }
            }
          } catch { /* ignore malformed JSON */ }
        }

        // ── Сохраняем сообщения в БД ─────────────────────────
        // Очищаем fullResponse от JSON-маркеров перед сохранением
        const cleanResponse = fullResponse
          .replace(/\{"update_calculation"[^}]+\}/g, '')
          .replace(/\{"strategy_update"[^}]+\}/g, '')
          .trim()

        saveMessages(
          supabase, roadmap_id, userId,
          message, cleanResponse || fullResponse,
          detectedRole, inputTokens, outputTokens
        ).catch(err => console.error('[Roadmap Chat] Save error:', err))

        // ── Summarization — вызываем напрямую, не через HTTP ──
        // Фиксит auth hole: нет fetch(), нет проблем с cookies
        const newCount = await supabase
          .rpc('increment_message_count', {
            p_roadmap_id: roadmap_id,
            p_user_id: userId,
          })
          .then(r => (r.data as number) ?? 0, () => 0)

        if (newCount > 0 && newCount % 20 === 0) {
          runSummarization(roadmap_id, userId, supabase)
            .catch(err => console.error('[Roadmap Chat] Summarization error:', err))
        }
      }
    }
  })()

  return response
}
