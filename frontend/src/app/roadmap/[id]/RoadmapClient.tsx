'use client'

/**
 * TrendHunter AI — Roadmap Client Component
 * src/app/roadmap/[id]/RoadmapClient.tsx
 *
 * Клиентская часть страницы Роадмапа.
 * Layout: Sidebar (220px) | Dashboard (flex-1) | Chat (420px)
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import styles from './roadmap.module.css'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type Role = 'max' | 'marcus' | 'leo'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  ai_role?: Role
  content: string
  created_at?: string
}

type Conversation = {
  id: string
  lead_name: string
  lead_handle?: string
  channel: string
  status: 'hot' | 'active' | 'stalled' | 'won' | 'lost'
  trajectory?: 'warming' | 'stable' | 'cooling'
  next_action?: string
  next_action_due?: string
  next_action_done?: boolean
  outcome_reason?: string
  last_message_at?: string
}

type Experiment = {
  id: string
  hypothesis: string
  status: 'active' | 'validated' | 'rejected' | 'paused'
  confidence: 'weak_signal' | 'emerging' | 'probable' | 'validated'
  current_value: number
  min_sample_size: number
  category: string
}

type DailyLog = {
  date: string
  energy?: number
  what_blocking?: string
  blocking_to_discuss_with_max?: boolean
}

type RoadmapSession = {
  id: string
  trend_id: string
  niche: string
  active_role: Role
  kill_switch_date: string
  kill_switch_metric: string
  day_number: number
  days_remaining: number
  status: string
  trial_expires_at: string | null
  strategy_summary?: string
}

type InitialData = {
  session: RoadmapSession
  conversations: Conversation[]
  experiments: Experiment[]
  recentLogs: DailyLog[]
  chatHistory: ChatMessage[]
}

// ─────────────────────────────────────────────────────────────
// ROLE CONFIG
// ─────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  max: {
    label: 'Макс',
    description: 'Стратег',
    color: '#639922',
    bgColor: '#eaf3de',
    initial: 'М',
  },
  marcus: {
    label: 'Marcus',
    description: 'Билдер',
    color: '#378add',
    bgColor: '#e6f1fb',
    initial: 'Mc',
  },
  leo: {
    label: 'Leo',
    description: 'Директор',
    color: '#9b59b6',
    bgColor: '#f4eef9',
    initial: 'L',
  },
} as const

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function computeSignal(
  dayNumber: number,
  daysRemaining: number,
  conversations: Conversation[],
  logs: DailyLog[]
): { text: string; state: 'green' | 'yellow' | 'red' } {
  const energies = logs.map(l => l.energy).filter(Boolean) as number[]
  const avgEnergy = energies.length > 0
    ? energies.reduce((a, b) => a + b, 0) / energies.length
    : 3
  const stalled = conversations.filter(c => c.status === 'stalled').length
  const active = conversations.filter(c => ['hot', 'active'].includes(c.status)).length

  if (daysRemaining <= 7) {
    return {
      text: `День ${dayNumber}. Kill Switch Review через ${daysRemaining} ${daysRemaining === 1 ? 'день' : 'дней'}. Пора подводить итоги.`,
      state: 'red',
    }
  }
  if (avgEnergy < 2.5 && stalled > active) {
    return {
      text: `День ${dayNumber}. Стагнация — больше зависших разговоров чем активных. Разберём с Максом.`,
      state: 'red',
    }
  }
  if (daysRemaining <= 30) {
    return {
      text: `День ${dayNumber}. До kill switch ${daysRemaining} дней. Нужно ускорить темп.`,
      state: 'yellow',
    }
  }
  if (dayNumber <= 14) {
    return {
      text: `День ${dayNumber}. Старт — собираем первые данные. Фокус на первых контактах.`,
      state: 'green',
    }
  }
  return {
    text: `День ${dayNumber}. Работа идёт. До kill switch ${daysRemaining} дней.`,
    state: 'yellow',
  }
}

function formatDaysAgo(dateStr?: string): string {
  if (!dateStr) return ''
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diff === 0) return 'сегодня'
  if (diff === 1) return 'вчера'
  return `${diff} дней назад`
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function RoadmapClient({
  roadmapId,
  initialData,
}: {
  roadmapId: string
  initialData: InitialData
}) {
  const { session, conversations: initConvs, experiments: initExps, recentLogs, chatHistory } = initialData

  // ── State ──────────────────────────────────────────────────
  const [conversations, setConversations] = useState<Conversation[]>(initConvs)
  const [experiments, setExperiments] = useState<Experiment[]>(initExps)
  const [messages, setMessages] = useState<ChatMessage[]>(chatHistory)
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeRole, setActiveRole] = useState<Role>(session.active_role ?? 'max')
  const [streamingRole, setStreamingRole] = useState<Role | null>(null)
  const [activeSection, setActiveSection] = useState<'dashboard' | 'conversations' | 'experiments' | 'daily-log' | 'templates'>('dashboard')
  const [morningDismissed, setMorningDismissed] = useState(false)

  // ── Modal state ────────────────────────────────────────────
  const [showAddConv, setShowAddConv] = useState(false)
  const [showAddExp, setShowAddExp] = useState(false)
  const [convDetailId, setConvDetailId] = useState<string | null>(null)

  // ── Daily Log form ─────────────────────────────────────────
  const [logForm, setLogForm] = useState({
    what_done: '', what_learned: '', what_blocking: '',
    blocking_to_discuss: false, energy: 0, small_win: false,
  })
  const [logSaving, setLogSaving] = useState(false)
  const [logError, setLogError] = useState<string | null>(null)
  const [logSaved, setLogSaved] = useState(false)

  // ── Conversation form ──────────────────────────────────────
  const [convForm, setConvForm] = useState({
    lead_name: '', lead_handle: '', channel: 'reddit', notes: '', next_action: '',
  })
  const [convSaving, setConvSaving] = useState(false)
  const [convError, setConvError] = useState<string | null>(null)

  // ── Experiment form ────────────────────────────────────────
  const [expForm, setExpForm] = useState({
    hypothesis: '', category: 'message', metric: 'reply_rate',
    target_value: '', min_sample_size: '20',
  })
  const [expSaving, setExpSaving] = useState(false)
  const [expError, setExpError] = useState<string | null>(null)

  // ── Crisis screen state ───────────────────────────────────
  const [crisisScreen, setCrisisScreen] = useState(false)

  // ── Trial expired state ────────────────────────────────────
  const [trialExpired, setTrialExpired] = useState(false)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  // ── Toast ──────────────────────────────────────────────────
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // ── Toast helper ───────────────────────────────────────────
  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // ── Save Daily Log ─────────────────────────────────────────
  const saveLog = useCallback(async () => {
    if (!logForm.what_done.trim()) return
    setLogSaving(true); setLogError(null)
    try {
      const res = await fetch('/api/roadmap/daily-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmap_id: roadmapId,
          what_done: logForm.what_done,
          what_learned: logForm.what_learned || undefined,
          what_blocking: logForm.what_blocking || undefined,
          blocking_to_discuss_with_max: logForm.blocking_to_discuss,
          energy: logForm.energy || undefined,
          small_win: logForm.small_win,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка')
      setLogSaved(true)
      setLogForm({ what_done: '', what_learned: '', what_blocking: '', blocking_to_discuss: false, energy: 0, small_win: false })
      showToast('Daily Log сохранён ✓')
    } catch (err) {
      setLogError(err instanceof Error ? err.message : 'Что-то пошло не так')
    } finally { setLogSaving(false) }
  }, [logForm, roadmapId, showToast])

  // ── Save Conversation ──────────────────────────────────────
  const saveConversation = useCallback(async () => {
    if (!convForm.lead_name.trim()) return
    setConvSaving(true); setConvError(null)
    try {
      const res = await fetch('/api/roadmap/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmap_id: roadmapId,
          lead_name: convForm.lead_name,
          lead_handle: convForm.lead_handle || undefined,
          channel: convForm.channel,
          notes: convForm.notes || undefined,
          next_action: convForm.next_action || undefined,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка')
      const data = await res.json()
      setConversations(prev => [data.conversation, ...prev])
      setShowAddConv(false)
      setConvForm({ lead_name: '', lead_handle: '', channel: 'reddit', notes: '', next_action: '' })
      showToast('Разговор добавлен ✓')
    } catch (err) {
      setConvError(err instanceof Error ? err.message : 'Что-то пошло не так')
    } finally { setConvSaving(false) }
  }, [convForm, roadmapId, showToast])

  // ── Save Experiment ────────────────────────────────────────
  const saveExperiment = useCallback(async () => {
    if (!expForm.hypothesis.trim()) return
    setExpSaving(true); setExpError(null)
    try {
      const res = await fetch('/api/roadmap/experiments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmap_id: roadmapId,
          hypothesis: expForm.hypothesis,
          category: expForm.category,
          metric: expForm.metric,
          target_value: parseFloat(expForm.target_value) || 20,
          min_sample_size: parseInt(expForm.min_sample_size) || 20,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Ошибка')
      const data = await res.json()
      setExperiments(prev => [data.experiment, ...prev])
      setShowAddExp(false)
      setExpForm({ hypothesis: '', category: 'message', metric: 'reply_rate', target_value: '', min_sample_size: '20' })
      showToast('Гипотеза создана ✓')
    } catch (err) {
      setExpError(err instanceof Error ? err.message : 'Что-то пошло не так')
    } finally { setExpSaving(false) }
  }, [expForm, roadmapId, showToast])

  // ── Update Conversation status ─────────────────────────────
  const updateConvStatus = useCallback(async (id: string, status: Conversation['status']) => {
    const res = await fetch(`/api/roadmap/conversations?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      setConversations(prev => prev.map(c => c.id === id ? { ...c, status } : c))
      showToast('Статус обновлён')
    }
  }, [showToast])


  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // ── Scroll to bottom on new messages ──────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Computed values ────────────────────────────────────────
  const signal = computeSignal(
    session.day_number,
    session.days_remaining,
    conversations,
    recentLogs
  )

  const now = new Date()
  const convStats = {
    hot: conversations.filter(c => c.status === 'hot').length,
    active: conversations.filter(c => c.status === 'active').length,
    stalled: conversations.filter(c => c.status === 'stalled').length,
    won: conversations.filter(c => c.status === 'won').length,
    lost: conversations.filter(c => c.status === 'lost').length,
    overdue: conversations.filter(c =>
      !c.next_action_done && c.next_action_due &&
      new Date(c.next_action_due) < now
    ).length,
  }

  const expStats = {
    active: experiments.filter(e => e.status === 'active').length,
    validated: experiments.filter(e => e.status === 'validated').length,
    rejected: experiments.filter(e => e.status === 'rejected').length,
    readyForDecision: experiments.filter(e =>
      e.status === 'active' && e.current_value >= e.min_sample_size
    ).length,
  }

  const hasLogToday = recentLogs.some(
    l => l.date === new Date().toISOString().split('T')[0]
  )

  const yesterdayLog = recentLogs.find(l => {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    return l.date === yesterday.toISOString().split('T')[0]
  })

  const showMorningView = !morningDismissed && (
    (yesterdayLog?.blocking_to_discuss_with_max) ||
    convStats.overdue > 0 ||
    expStats.readyForDecision > 0
  )

  // Причины отказов
  const outcomeReasons = conversations
    .filter(c => c.status === 'lost' && c.outcome_reason)
    .reduce<Record<string, number>>((acc, c) => {
      acc[c.outcome_reason!] = (acc[c.outcome_reason!] || 0) + 1
      return acc
    }, {})
  const topReasons = Object.entries(outcomeReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // ── Send message ───────────────────────────────────────────
  const sendMessage = useCallback(async (text?: string) => {
    const content = text ?? inputValue.trim()
    if (!content || isStreaming) return

    setInputValue('')
    setIsStreaming(true)

    // Добавляем сообщение пользователя
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])

    // Placeholder для ответа AI
    const assistantId = crypto.randomUUID()
    setMessages(prev => [...prev, {
      id: assistantId,
      role: 'assistant',
      ai_role: activeRole,
      content: '',
      created_at: new Date().toISOString(),
    }])

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/roadmap/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmap_id: roadmapId,
          message: content,
          // Передаём только последние 4 сообщения — остальное в summary на сервере
          history: messages.slice(-4).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: abortRef.current.signal,
      })

      // ── Trial expired ──────────────────────────────────────
      if (res.status === 402) {
        setTrialExpired(true)
        // Убираем placeholder
        setMessages(prev => prev.filter(m => m.id !== assistantId))
        return
      }

      if (!res.ok || !res.body) throw new Error('Stream failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = 'message'

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          // SSE event type
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim()
            continue
          }

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              // ── Crisis event — показываем хардкод-экран ────
              if (eventType === 'crisis') {
                setCrisisScreen(true)
                setMessages(prev => prev.filter(m => m.id !== assistantId))
                reader.cancel()
                return
              }

              // ── Токен — стримим в чат ───────────────────────
              if (data.text !== undefined) {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: m.content + data.text }
                    : m
                ))

              // ── Статус генерации ────────────────────────────
              } else if (data.step === 'generating' && data.role) {
                setStreamingRole(data.role as Role)

              // ── Смена роли ──────────────────────────────────
              } else if (data.previous_role && data.new_role) {
                setActiveRole(data.new_role as Role)
                setStreamingRole(data.new_role as Role)
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, ai_role: data.new_role as Role }
                    : m
                ))

              // ── Финал стрима — статистика ───────────────────
              } else if (data.role && data.input_tokens !== undefined) {
                // done event — убираем streaming state
                setStreamingRole(null)
                // Финализируем ai_role в сообщении
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, ai_role: data.role as Role }
                    : m
                ))

              // ── Ошибка от сервера ───────────────────────────
              } else if (data.code === 'CLAUDE_ERROR') {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: data.message ?? 'Что-то пошло не так. Попробуй ещё раз.' }
                    : m
                ))
              }

            } catch {
              // Игнорируем невалидный JSON в stream
            }

            // Сбрасываем тип события после обработки
            eventType = 'message'
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Пользователь отменил — убираем пустой placeholder
        setMessages(prev => {
          const last = prev[prev.length - 1]
          if (last?.id === assistantId && !last.content) {
            return prev.slice(0, -1)
          }
          return prev
        })
      } else {
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Что-то пошло не так. Попробуй ещё раз.' }
            : m
        ))
      }
    } finally {
      setIsStreaming(false)
      setStreamingRole(null)
    }
  }, [inputValue, isStreaming, messages, roadmapId, activeRole])

  // ── Keyboard handler ───────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const currentRole = streamingRole ?? activeRole
  const roleConfig = ROLE_CONFIG[currentRole]

  // ── Purchase handler (списание монет за доступ к роадмапу) ─
  const handlePurchase = useCallback(async () => {
    setPurchaseLoading(true)
    setPurchaseError(null)
    try {
      const res = await fetch('/api/roadmap/access/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: initialData.session.trend_id,
          use_discount: false,
        }),
      })
      const data = await res.json()
      if (res.ok) {
        window.location.reload()
        return
      }
      if (res.status === 402) {
        setPurchaseError(
          `Не хватает монет: нужно ${data.required}, у вас ${data.current}.`
        )
        return
      }
      setPurchaseError(data.error ?? 'Что-то пошло не так')
    } catch {
      setPurchaseError('Ошибка сети. Попробуйте ещё раз.')
    } finally {
      setPurchaseLoading(false)
    }
  }, [initialData.session.trend_id])

  // ─────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────

  return (
    <div className={styles.layout}>

      {/* ── CRISIS SCREEN (хардкод — не генерируется AI) ── */}
      {crisisScreen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '24px',
        }}>
          <div style={{
            background: '#1a1a2e', border: '1px solid #e74c3c',
            borderRadius: '16px', padding: '40px', maxWidth: '480px',
            width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>🆘</div>
            <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '12px', fontWeight: 600 }}>
              Это важно
            </h2>
            <p style={{ color: '#ccc', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
              Если тебе сейчас тяжело — есть люди, которые умеют помогать в таких ситуациях.
              Позвони или напиши им прямо сейчас.
            </p>
            <div style={{
              background: '#0d0d1a', borderRadius: '12px',
              padding: '20px', marginBottom: '24px', textAlign: 'left',
            }}>
              <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Кризисная поддержка
              </p>
              <p style={{ color: '#fff', fontSize: '16px', marginBottom: '8px' }}>
                🇷🇺 Россия: <strong>8-800-2000-122</strong> (бесплатно)
              </p>
              <p style={{ color: '#fff', fontSize: '16px', marginBottom: '8px' }}>
                🇺🇦 Украина: <strong>7333</strong>
              </p>
              <p style={{ color: '#fff', fontSize: '16px', marginBottom: '8px' }}>
                🌍 Международный: <strong>findahelpline.com</strong>
              </p>
            </div>
            <button
              onClick={() => setCrisisScreen(false)}
              style={{
                background: 'transparent', border: '1px solid #555',
                color: '#aaa', padding: '10px 24px', borderRadius: '8px',
                cursor: 'pointer', fontSize: '14px',
              }}
            >
              Вернуться к чату
            </button>
          </div>
        </div>
      )}

      {/* ── TRIAL EXPIRED SCREEN ───────────────────────── */}
      {trialExpired && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9998, padding: '24px',
        }}>
          <div style={{
            background: '#16161e', border: '1px solid #333',
            borderRadius: '16px', padding: '40px', maxWidth: '420px',
            width: '100%', textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '16px' }}>⏰</div>
            <h2 style={{ color: '#fff', fontSize: '20px', marginBottom: '12px', fontWeight: 600 }}>
              Пробный период завершён
            </h2>
            <p style={{ color: '#aaa', lineHeight: 1.6, marginBottom: '24px', fontSize: '15px' }}>
              3 дня пробного доступа использованы.<br />
              Для продолжения работы с AI-командой — открой полный доступ.
            </p>

            <button
              onClick={handlePurchase}
              disabled={purchaseLoading}
              style={{
                display: 'block', width: '100%',
                background: purchaseLoading ? '#444' : '#6366f1',
                color: '#fff', padding: '14px 24px', borderRadius: '10px',
                border: 'none', fontWeight: 600, fontSize: '15px',
                marginBottom: '12px', cursor: purchaseLoading ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
              }}
            >
              {purchaseLoading ? 'Обработка...' : 'Открыть доступ — 5 000 монет'}
            </button>

            {purchaseError && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ color: '#f87171', fontSize: '13px', marginBottom: '6px' }}>
                  {purchaseError}
                </p>
                {purchaseError.includes('Не хватает монет') && (
                  <a
                    href="/lk"
                    style={{ color: '#6366f1', fontSize: '13px', textDecoration: 'underline' }}
                  >
                    Пополнить баланс в ЛК →
                  </a>
                )}
              </div>
            )}

            <button
              onClick={() => { setTrialExpired(false); setPurchaseError(null) }}
              style={{
                background: 'transparent', border: 'none',
                color: '#666', fontSize: '13px', cursor: 'pointer',
              }}
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* ── SIDEBAR ─────────────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.sidebarLogo}>TrendHunter AI</div>
          <div className={styles.sidebarNiche}>{session.niche}</div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navSection}>Основное</div>

          {[
            { key: 'dashboard', icon: 'ti-layout-dashboard', label: 'Роадмап' },
            { key: 'conversations', icon: 'ti-messages', label: 'Разговоры', badge: convStats.overdue > 0 ? convStats.overdue : undefined },
            { key: 'experiments', icon: 'ti-flask-2', label: 'Лаборатория', badge: expStats.readyForDecision > 0 ? expStats.readyForDecision : undefined },
            { key: 'daily-log', icon: 'ti-notebook', label: 'Daily Log', dot: !hasLogToday },
            { key: 'templates', icon: 'ti-template', label: 'Шаблоны' },
          ].map(item => (
            <button
              key={item.key}
              className={`${styles.navItem} ${activeSection === item.key ? styles.navItemActive : ''}`}
              onClick={() => setActiveSection(item.key as typeof activeSection)}
            >
              <i className={`ti ${item.icon}`} />
              <span>{item.label}</span>
              {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
              {item.dot && <span className={styles.navDot} />}
            </button>
          ))}

          <div className={styles.navSection} style={{ marginTop: 12 }}>AI Команда</div>

          {(['max', 'marcus', 'leo'] as Role[]).map(role => {
            const cfg = ROLE_CONFIG[role]
            return (
              <button
                key={role}
                className={`${styles.navItem} ${activeRole === role ? styles.navItemActive : ''}`}
                onClick={() => {
                  setActiveRole(role)
                  inputRef.current?.focus()
                }}
              >
                <span
                  className={styles.roleAvatar}
                  style={{ background: cfg.bgColor, color: cfg.color }}
                >
                  {cfg.initial}
                </span>
                <span>{cfg.label}</span>
                <span className={styles.roleDesc}>{cfg.description}</span>
                {activeRole === role && <span className={styles.roleActive} />}
              </button>
            )
          })}

          <div className={styles.navSection} style={{ marginTop: 12 }}>Проект</div>
          <Link href={`/lk/research/${initialData.session.trend_id}?tab=strategy`} className={styles.navItem}>
            <i className="ti ti-file-analytics" />
            <span>Стратегия</span>
          </Link>
          <Link href={`/lk/research/${initialData.session.trend_id}`} className={styles.navItem}>
            <i className="ti ti-chart-bar" />
            <span>Исследование</span>
          </Link>
        </nav>

        <div className={styles.sidebarFooter}>
          <Link href="/lk" className={styles.navItem}>
            <i className="ti ti-settings" />
            <span>Настройки</span>
          </Link>
        </div>
      </aside>

      {/* ── DASHBOARD ────────────────────────────────────── */}
      <main className={styles.dashboard}>
        {/* Top bar */}
        <div className={styles.topBar}>
          <div>
            <div className={styles.topBarTitle}>
              {activeSection === 'dashboard' ? 'Дашборд' :
               activeSection === 'conversations' ? 'Разговоры' :
               activeSection === 'experiments' ? 'Лаборатория' :
               activeSection === 'daily-log' ? 'Daily Log' : 'Шаблоны'}
            </div>
            <div className={styles.topBarMeta}>
              День {session.day_number} из 90 · {session.niche}
            </div>
          </div>
          <div
            className={`${styles.ksPill} ${
              session.days_remaining <= 7 ? styles.ksDanger :
              session.days_remaining <= 30 ? styles.ksWarn : styles.ksOk
            }`}
          >
            <i className="ti ti-clock" />
            Kill switch: {session.days_remaining} дней
          </div>
        </div>

        {/* ── Trial баннер ─────────────────────────────── */}
        {session.status === 'trial' && session.trial_expires_at && (() => {
          const expiresAt = new Date(session.trial_expires_at)
          const now = new Date()
          const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          return (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 20px',
              background: daysLeft <= 1 ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.08)',
              borderBottom: `1px solid ${daysLeft <= 1 ? 'rgba(239,68,68,0.2)' : 'rgba(251,191,36,0.15)'}`,
              fontSize: '13px',
            }}>
              <span style={{ color: daysLeft <= 1 ? '#f87171' : '#fbbf24' }}>
                <i className="ti ti-clock" style={{ marginRight: 6 }} />
                {daysLeft === 0
                  ? 'Пробный период истекает сегодня'
                  : `Пробный период: осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`
                }
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={handlePurchase}
                  disabled={purchaseLoading}
                  style={{
                    background: daysLeft <= 1 ? '#ef4444' : '#f59e0b',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '5px 14px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: purchaseLoading ? 'not-allowed' : 'pointer',
                    opacity: purchaseLoading ? 0.7 : 1,
                  }}
                >
                  {purchaseLoading ? '...' : 'Открыть полный доступ — 5 000 монет'}
                </button>
                {purchaseError && (
                  <span style={{ color: '#f87171', fontSize: '12px' }}>
                    {purchaseError}
                  </span>
                )}
              </div>
            </div>
          )
        })()}

        <div className={styles.dashContent}>

          {/* Morning View */}
          {showMorningView && activeSection === 'dashboard' && (
            <div className={styles.morningBanner}>
              <i className="ti ti-sun-high" style={{ color: 'var(--blue-text)', fontSize: 18 }} />
              <div style={{ flex: 1 }}>
                <div className={styles.morningTitle}>Доброе утро</div>
                {yesterdayLog?.blocking_to_discuss_with_max && (
                  <div className={styles.morningText}>
                    Вчера ты отметил блокер:{' '}
                    <strong>{yesterdayLog.what_blocking}</strong>
                    {' '}—{' '}
                    <button
                      className={styles.inlineLink}
                      onClick={() => {
                        sendMessage(`Нужно разобрать блокер: ${yesterdayLog.what_blocking}`)
                        setMorningDismissed(true)
                      }}
                    >
                      разобрать с Максом
                    </button>
                  </div>
                )}
                {convStats.overdue > 0 && (
                  <div className={styles.morningText}>
                    {convStats.overdue} разговор{convStats.overdue > 1 ? 'а' : ''} требуют действия.
                  </div>
                )}
                {expStats.readyForDecision > 0 && (
                  <div className={styles.morningText}>
                    {expStats.readyForDecision} эксперимент{expStats.readyForDecision > 1 ? 'а' : ''} готов{expStats.readyForDecision > 1 ? 'ы' : ''} к решению.
                  </div>
                )}
              </div>
              <button
                className={styles.morningClose}
                onClick={() => setMorningDismissed(true)}
                aria-label="Закрыть"
              >
                <i className="ti ti-x" />
              </button>
            </div>
          )}

          {/* Dashboard section */}
          {activeSection === 'dashboard' && (
            <>
              {/* Signal card */}
              <div className={styles.signalCard}>
                <div className={styles.signalTop}>
                  <div
                    className={styles.signalText}
                    dangerouslySetInnerHTML={{ __html: signal.text }}
                  />
                  <div className={`${styles.signalState} ${styles[`signal_${signal.state}`]}`}>
                    <i className={`ti ${
                      signal.state === 'red' ? 'ti-trending-down' :
                      signal.state === 'green' ? 'ti-trending-up' : 'ti-clock'
                    }`} />
                    {signal.state === 'red' ? 'Внимание' :
                     signal.state === 'green' ? 'Хорошо' : 'В работе'}
                  </div>
                </div>

                {/* Progress bars */}
                <div className={styles.progressRow}>
                  <div className={styles.progItem}>
                    <div className={styles.progLabel}>
                      <span>Клиенты к цели</span>
                      <span>{convStats.won} / 5</span>
                    </div>
                    <div className={styles.progBg}>
                      <div
                        className={styles.progFill}
                        style={{
                          width: `${Math.min(100, (convStats.won / 5) * 100)}%`,
                          background: 'var(--green)',
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles.progItem}>
                    <div className={styles.progLabel}>
                      <span>Гипотезы проверено</span>
                      <span>{expStats.validated + expStats.rejected} / {experiments.length || 1}</span>
                    </div>
                    <div className={styles.progBg}>
                      <div
                        className={styles.progFill}
                        style={{
                          width: `${experiments.length > 0
                            ? Math.min(100, ((expStats.validated + expStats.rejected) / experiments.length) * 100)
                            : 0}%`,
                          background: 'var(--blue)',
                        }}
                      />
                    </div>
                  </div>
                  <div className={styles.progItem}>
                    <div className={styles.progLabel}>
                      <span>Дней использовано</span>
                      <span>{session.day_number} / 90</span>
                    </div>
                    <div className={styles.progBg}>
                      <div
                        className={styles.progFill}
                        style={{
                          width: `${(session.day_number / 90) * 100}%`,
                          background: 'var(--text-tertiary)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics grid */}
              <div className={styles.metricsGrid}>
                {[
                  {
                    label: 'Разговоров активно',
                    value: convStats.active + convStats.hot,
                    sub: convStats.hot > 0 ? `${convStats.hot} горячих` : 'нет горячих',
                    positive: convStats.hot > 0,
                  },
                  {
                    label: 'Stalled',
                    value: convStats.stalled,
                    sub: convStats.overdue > 0 ? `${convStats.overdue} просрочено` : 'все в норме',
                    positive: convStats.stalled === 0,
                    negative: convStats.stalled > 3,
                  },
                  {
                    label: 'Платящих клиентов',
                    value: convStats.won,
                    sub: `цель: 5`,
                    positive: convStats.won > 0,
                  },
                  {
                    label: 'Гипотез validated',
                    value: expStats.validated,
                    sub: `${expStats.active} в работе`,
                    positive: expStats.validated > 0,
                  },
                ].map((m, i) => (
                  <div key={i} className={styles.metricCard}>
                    <div className={styles.metricLabel}>{m.label}</div>
                    <div className={styles.metricVal}>{m.value}</div>
                    <div className={`${styles.metricSub} ${
                      m.negative ? styles.metricNeg :
                      m.positive ? styles.metricPos : ''
                    }`}>{m.sub}</div>
                  </div>
                ))}
              </div>

              {/* Action items */}
              {(convStats.overdue > 0 || expStats.readyForDecision > 0 || !hasLogToday) && (
                <div className={styles.actionCard}>
                  <div className={styles.actionHeader}>
                    <span className={styles.sectionTitle}>Требуют действия</span>
                    <span className={styles.actionCount}>
                      {convStats.overdue + expStats.readyForDecision + (!hasLogToday ? 1 : 0)}
                    </span>
                  </div>

                  {conversations
                    .filter(c =>
                      !c.next_action_done &&
                      c.next_action_due &&
                      new Date(c.next_action_due) < now
                    )
                    .slice(0, 2)
                    .map(conv => (
                      <div key={conv.id} className={styles.actionItem}>
                        <div className={`${styles.actionIcon} ${styles.actionIconWarn}`}>
                          <i className="ti ti-message-circle" />
                        </div>
                        <div className={styles.actionBody}>
                          <div className={styles.actionName}>
                            {conv.lead_handle ?? conv.lead_name} — stalled
                          </div>
                          <div className={styles.actionDesc}>
                            Просрочено: {conv.next_action}
                          </div>
                          <button
                            className={styles.actionCta}
                            onClick={() => sendMessage(
                              `Помоги написать follow-up для ${conv.lead_handle ?? conv.lead_name}. Разговор завис на: ${conv.next_action}`
                            )}
                          >
                            <i className="ti ti-arrow-right" />
                            Написать с Marcus
                          </button>
                        </div>
                      </div>
                    ))}

                  {expStats.readyForDecision > 0 && (
                    <div className={styles.actionItem}>
                      <div className={`${styles.actionIcon} ${styles.actionIconInfo}`}>
                        <i className="ti ti-flask" />
                      </div>
                      <div className={styles.actionBody}>
                        <div className={styles.actionName}>
                          {expStats.readyForDecision} эксперимент{expStats.readyForDecision > 1 ? 'а' : ''} — нужно решение
                        </div>
                        <div className={styles.actionDesc}>
                          Набрано достаточно данных для вывода
                        </div>
                        <button
                          className={styles.actionCta}
                          onClick={() => sendMessage('Помоги принять решение по эксперименту который набрал достаточно данных')}
                        >
                          <i className="ti ti-arrow-right" />
                          Разобрать с Leo
                        </button>
                      </div>
                    </div>
                  )}

                  {!hasLogToday && (
                    <div className={styles.actionItem}>
                      <div className={`${styles.actionIcon} ${styles.actionIconSuccess}`}>
                        <i className="ti ti-notebook" />
                      </div>
                      <div className={styles.actionBody}>
                        <div className={styles.actionName}>Daily Log не заполнен</div>
                        <div className={styles.actionDesc}>
                          3 минуты — зафиксируй день
                        </div>
                        <button
                          className={styles.actionCta}
                          onClick={() => setActiveSection('daily-log')}
                        >
                          <i className="ti ti-arrow-right" />
                          Заполнить
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Two columns: conversations + experiments */}
              <div className={styles.twoCol}>
                {/* Conversations widget */}
                <div className={styles.widgetCard}>
                  <div className={styles.widgetTitle}>
                    <span>Разговоры</span>
                    <button
                      className={styles.widgetLink}
                      onClick={() => setActiveSection('conversations')}
                    >
                      Все →
                    </button>
                  </div>

                  {conversations.slice(0, 4).map(conv => (
                    <div key={conv.id} className={styles.convItem}>
                      <div className={`${styles.convAvatar} ${styles[`conv_${conv.status}`]}`}>
                        {(conv.lead_name[0] + (conv.lead_name.split(' ')[1]?.[0] ?? '')).toUpperCase()}
                      </div>
                      <div className={styles.convInfo}>
                        <div className={styles.convName}>
                          {conv.lead_handle ?? conv.lead_name}
                        </div>
                        <div className={styles.convMeta}>
                          {conv.status} · {formatDaysAgo(conv.last_message_at)}
                        </div>
                      </div>
                      <span className={styles.channelBadge}>{conv.channel}</span>
                      <span className={styles.trajectory}>
                        {conv.trajectory === 'warming' ? '↑' :
                         conv.trajectory === 'cooling' ? '↓' : '→'}
                      </span>
                    </div>
                  ))}

                  {conversations.length === 0 && (
                    <div className={styles.emptyState}>
                      Нет разговоров. Начни с outreach.
                    </div>
                  )}

                  {topReasons.length > 0 && (
                    <div className={styles.outcomeSection}>
                      <div className={styles.outcomeSectionTitle}>Причины отказов</div>
                      {topReasons.map(([reason, count]) => (
                        <div key={reason} className={styles.outcomeRow}>
                          <span className={styles.outcomeLabel}>{reason}</span>
                          <div className={styles.outcomeBg}>
                            <div
                              className={styles.outcomeFill}
                              style={{
                                width: `${(count / (conversations.filter(c => c.status === 'lost').length)) * 100}%`,
                              }}
                            />
                          </div>
                          <span className={styles.outcomeNum}>{count}</span>
                        </div>
                      ))}
                      <button
                        className={styles.actionCta}
                        style={{ marginTop: 8 }}
                        onClick={() => sendMessage(`Разбери паттерн: топ причина отказов — ${topReasons[0]?.[0]}`)}
                      >
                        <i className="ti ti-arrow-right" />
                        Обсудить с Максом
                      </button>
                    </div>
                  )}
                </div>

                {/* Experiments widget */}
                <div className={styles.widgetCard}>
                  <div className={styles.widgetTitle}>
                    <span>Лаборатория</span>
                    <button
                      className={styles.widgetLink}
                      onClick={() => setActiveSection('experiments')}
                    >
                      Все →
                    </button>
                  </div>

                  {/* Validation runway */}
                  <div className={styles.valSection}>
                    <div className={styles.valTitle}>Validation runway</div>
                    {[
                      { label: 'Подтверждено', count: expStats.validated, color: 'var(--green)' },
                      { label: 'Отклонено', count: expStats.rejected, color: 'var(--red)' },
                      { label: 'В работе', count: expStats.active, color: 'var(--blue)' },
                    ].map(row => (
                      <div key={row.label} className={styles.valRow}>
                        <span className={styles.valLabel}>{row.label}</span>
                        <div className={styles.valBg}>
                          <div
                            className={styles.valFill}
                            style={{
                              width: experiments.length > 0
                                ? `${(row.count / experiments.length) * 100}%`
                                : '0%',
                              background: row.color,
                            }}
                          />
                        </div>
                        <span className={styles.valNum}>{row.count}</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.divider} />

                  {experiments.slice(0, 3).map(exp => (
                    <div key={exp.id} className={styles.expItem}>
                      <div className={styles.expHyp}>{exp.hypothesis}</div>
                      <div className={styles.expBarRow}>
                        <div className={styles.expBg}>
                          <div
                            className={styles.expFill}
                            style={{
                              width: `${Math.min(100, (exp.current_value / exp.min_sample_size) * 100)}%`,
                              background:
                                exp.status === 'validated' ? 'var(--green)' :
                                exp.status === 'rejected' ? 'var(--red)' : 'var(--blue)',
                            }}
                          />
                        </div>
                        <span className={`${styles.confBadge} ${styles[`conf_${exp.confidence}`]}`}>
                          {exp.confidence.replace('_', ' ')}
                        </span>
                        <span className={styles.expProgress}>
                          {exp.current_value}/{exp.min_sample_size}
                        </span>
                      </div>
                    </div>
                  ))}

                  {experiments.length === 0 && (
                    <div className={styles.emptyState}>
                      Нет экспериментов. Создай первую гипотезу.
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Conversations section */}
          {activeSection === 'conversations' && (
            <div className={styles.sectionContent}>
              <div className={styles.sectionHeader}>
                <h2>Разговоры с лидами</h2>
                <button className={styles.btnPrimary} onClick={() => setShowAddConv(true)}>
                  <i className="ti ti-plus" /> Добавить
                </button>
              </div>

              {conversations.map(conv => (
                <div key={conv.id} className={styles.convCard}>
                  <div className={styles.convCardLeft}>
                    <div
                      className={`${styles.convAvatar} ${styles[`conv_${conv.status}`]}`}
                      style={{ width: 36, height: 36, fontSize: 13 }}
                    >
                      {(conv.lead_name[0] + (conv.lead_name.split(' ')[1]?.[0] ?? '')).toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.convName}>{conv.lead_handle ?? conv.lead_name}</div>
                      <div className={styles.convMeta}>
                        {conv.channel} · {formatDaysAgo(conv.last_message_at)}
                      </div>
                    </div>
                  </div>
                  <div className={styles.convCardRight}>
                    {/* Status dropdown */}
                    <select
                      className={`${styles.statusBadge} ${styles[`status_${conv.status}`]}`}
                      value={conv.status}
                      onChange={e => updateConvStatus(conv.id, e.target.value as Conversation['status'])}
                      style={{ cursor: 'pointer', border: 'none', background: 'inherit', font: 'inherit' }}
                    >
                      {(['hot','active','stalled','won','lost'] as const).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => {
                        setConvDetailId(conv.id)
                        sendMessage(
                          `Открываю разговор с ${conv.lead_handle ?? conv.lead_name}. ` +
                          `Статус: ${conv.status}. ${conv.next_action ? 'Следующий шаг: ' + conv.next_action : 'Помоги разобрать ситуацию.'}`
                        )
                      }}
                    >
                      Открыть с Marcus
                    </button>
                  </div>
                </div>
              ))}

              {conversations.length === 0 && (
                <div className={styles.emptyFull}>
                  <i className="ti ti-messages" />
                  <p>Пока нет разговоров.</p>
                  <p>Добавь первый после отправки сообщения лиду.</p>
                  <button className={styles.btnPrimary} onClick={() => setShowAddConv(true)}>
                    Добавить разговор
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Experiments / Лаборатория section */}
          {activeSection === 'experiments' && (
            <div className={styles.sectionContent}>
              <div className={styles.sectionHeader}>
                <h2>Лаборатория</h2>
                <button className={styles.btnPrimary} onClick={() => setShowAddExp(true)}>
                  <i className="ti ti-plus" /> Новая гипотеза
                </button>
              </div>

              {experiments.map(exp => (
                <div key={exp.id} className={styles.expCard}>
                  <div className={styles.expCardHeader}>
                    <span className={`${styles.confBadge} ${styles[`conf_${exp.confidence}`]}`}>
                      {exp.confidence.replace('_', ' ')}
                    </span>
                    <span className={`${styles.statusBadge} ${styles[`status_${exp.status}`]}`}>
                      {exp.status}
                    </span>
                    {/* Кнопка решения если готов */}
                    {exp.status === 'active' && exp.current_value >= exp.min_sample_size && (
                      <button
                        className={styles.btnSecondary}
                        style={{ marginLeft: 'auto', fontSize: 11 }}
                        onClick={() => sendMessage(
                          `Помоги принять решение по эксперименту: "${exp.hypothesis}". ` +
                          `Набрано ${exp.current_value} из ${exp.min_sample_size} наблюдений.`
                        )}
                      >
                        <i className="ti ti-gavel" /> Принять решение
                      </button>
                    )}
                  </div>
                  <div className={styles.expCardHyp}>{exp.hypothesis}</div>
                  <div className={styles.expBg} style={{ margin: '8px 0' }}>
                    <div
                      className={styles.expFill}
                      style={{
                        width: `${Math.min(100, (exp.current_value / exp.min_sample_size) * 100)}%`,
                        background:
                          exp.status === 'validated' ? 'var(--green)' :
                          exp.status === 'rejected' ? 'var(--red)' : 'var(--blue)',
                      }}
                    />
                  </div>
                  <div className={styles.expCardMeta}>
                    {exp.current_value} / {exp.min_sample_size} наблюдений · {exp.category}
                    {exp.status === 'active' && exp.current_value >= exp.min_sample_size && (
                      <span style={{ color: 'var(--green-text)', marginLeft: 8 }}>
                        ✓ Готов к решению
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {experiments.length === 0 && (
                <div className={styles.emptyFull}>
                  <i className="ti ti-flask" />
                  <p>Нет активных гипотез.</p>
                  <p>Сформулируй первую вместе с Leo.</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className={styles.btnPrimary}
                      onClick={() => setShowAddExp(true)}
                    >
                      Создать гипотезу
                    </button>
                    <button
                      className={styles.btnSecondary}
                      onClick={() => {
                        sendMessage('Помоги сформулировать первую гипотезу для эксперимента')
                        setActiveRole('leo')
                      }}
                    >
                      Спросить Leo
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Daily Log — connected form */}
          {activeSection === 'daily-log' && (
            <div className={styles.sectionContent}>
              <div className={styles.sectionHeader}>
                <h2>Daily Log</h2>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>

              {logSaved && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--green-bg)', color: 'var(--green-text)',
                  border: '0.5px solid var(--green-border)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  fontSize: 13,
                }}>
                  <i className="ti ti-check" />
                  Лог за сегодня сохранён. Утром Morning View покажет блокеры.
                </div>
              )}

              <div className={styles.dailyLogForm}>
                <div className={styles.formGroup}>
                  <label>Что сделано сегодня?</label>
                  <textarea
                    placeholder="1-3 конкретных действия..."
                    rows={3}
                    value={logForm.what_done}
                    onChange={e => setLogForm(p => ({ ...p, what_done: e.target.value }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Что узнал? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>опционально</span></label>
                  <textarea
                    placeholder="Инсайт или наблюдение..."
                    rows={2}
                    value={logForm.what_learned}
                    onChange={e => setLogForm(p => ({ ...p, what_learned: e.target.value }))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label>Что блокирует завтра? <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>опционально</span></label>
                  <textarea
                    placeholder="Что мешает двигаться дальше?"
                    rows={2}
                    value={logForm.what_blocking}
                    onChange={e => setLogForm(p => ({ ...p, what_blocking: e.target.value }))}
                  />
                  {logForm.what_blocking && (
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      fontSize: 13, color: 'var(--text-secondary)',
                      marginTop: 6, cursor: 'pointer',
                    }}>
                      <input
                        type="checkbox"
                        checked={logForm.blocking_to_discuss}
                        onChange={e => setLogForm(p => ({ ...p, blocking_to_discuss: e.target.checked }))}
                        style={{ accentColor: 'var(--blue)' }}
                      />
                      Разобрать утром с Максом
                    </label>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label>Энергия сегодня</label>
                  <div className={styles.energySlider}>
                    {([
                      { v: 1, emoji: '😴', text: 'выгорел' },
                      { v: 2, emoji: '😕', text: 'тяжело' },
                      { v: 3, emoji: '😐', text: 'нормально' },
                      { v: 4, emoji: '😊', text: 'хорошо' },
                      { v: 5, emoji: '🔥', text: 'отлично' },
                    ]).map(({ v, emoji, text }) => (
                      <button
                        key={v}
                        title={text}
                        className={`${styles.energyBtn} ${logForm.energy === v ? styles.energyBtnActive : ''}`}
                        onClick={() => setLogForm(p => ({ ...p, energy: p.energy === v ? 0 : v }))}
                      >
                        <span style={{ fontSize: 18 }}>{emoji}</span>
                        <span style={{ fontSize: 10, marginTop: 2 }}>{v}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <label style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 13, color: 'var(--text-secondary)', cursor: 'pointer',
                }}>
                  <input
                    type="checkbox"
                    checked={logForm.small_win}
                    onChange={e => setLogForm(p => ({ ...p, small_win: e.target.checked }))}
                    style={{ accentColor: 'var(--blue)' }}
                  />
                  Сегодня был маленький win 🎉
                </label>

                {logError && (
                  <div style={{
                    color: 'var(--red-text)', fontSize: 13,
                    background: 'var(--red-bg)', padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)', border: '0.5px solid var(--red-border)',
                  }}>
                    {logError}
                  </div>
                )}

                <button
                  className={styles.btnPrimary}
                  style={{ width: '100%' }}
                  disabled={logSaving || !logForm.what_done.trim()}
                  onClick={saveLog}
                >
                  {logSaving ? (
                    <><i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} /> Сохраняем...</>
                  ) : (
                    <><i className="ti ti-check" /> Сохранить лог</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Templates */}
          {activeSection === 'templates' && (
            <div className={styles.sectionContent}>
              <div className={styles.sectionHeader}>
                <h2>Шаблоны</h2>
                <button
                  className={styles.btnPrimary}
                  onClick={() => sendMessage('Помоги создать шаблон холодного сообщения для нашего канала')}
                >
                  <i className="ti ti-plus" /> Создать с Marcus
                </button>
              </div>
              <div className={styles.emptyFull}>
                <i className="ti ti-template" />
                <p>Шаблоны сообщений появятся здесь.</p>
                <p>Создай первый вместе с Marcus в чате.</p>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── MODALS ─────────────────────────────────────────── */}

      {/* Add Conversation Modal */}
      {showAddConv && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowAddConv(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Новый разговор</h3>
              <button className={styles.modalClose} onClick={() => setShowAddConv(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className={styles.modalForm}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Имя или ник лида *</label>
                <input
                  className={styles.modalInput}
                  placeholder="@username или Имя Фамилия"
                  value={convForm.lead_name}
                  onChange={e => setConvForm(p => ({ ...p, lead_name: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Handle в соцсети</label>
                <input
                  className={styles.modalInput}
                  placeholder="@handle (опционально)"
                  value={convForm.lead_handle}
                  onChange={e => setConvForm(p => ({ ...p, lead_handle: e.target.value }))}
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Канал</label>
                <select
                  className={styles.modalSelect}
                  value={convForm.channel}
                  onChange={e => setConvForm(p => ({ ...p, channel: e.target.value }))}
                >
                  <option value="reddit">Reddit</option>
                  <option value="linkedin">LinkedIn</option>
                  <option value="email">Email</option>
                  <option value="twitter">Twitter / X</option>
                  <option value="other">Другое</option>
                </select>
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Первое действие</label>
                <input
                  className={styles.modalInput}
                  placeholder="Например: отправить follow-up"
                  value={convForm.next_action}
                  onChange={e => setConvForm(p => ({ ...p, next_action: e.target.value }))}
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Заметки</label>
                <textarea
                  className={styles.modalTextarea}
                  placeholder="Контекст разговора..."
                  rows={3}
                  value={convForm.notes}
                  onChange={e => setConvForm(p => ({ ...p, notes: e.target.value }))}
                />
              </div>
              {convError && (
                <div className={styles.formError}>{convError}</div>
              )}
              <div className={styles.modalFooter}>
                <button className={styles.btnCancel} onClick={() => setShowAddConv(false)}>
                  Отмена
                </button>
                <button
                  className={styles.btnSave}
                  disabled={convSaving || !convForm.lead_name.trim()}
                  onClick={saveConversation}
                >
                  {convSaving ? 'Сохраняем...' : 'Добавить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Experiment Modal */}
      {showAddExp && (
        <div className={styles.modalOverlay} onClick={e => e.target === e.currentTarget && setShowAddExp(false)}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Новая гипотеза</h3>
              <button className={styles.modalClose} onClick={() => setShowAddExp(false)}>
                <i className="ti ti-x" />
              </button>
            </div>
            <div className={styles.modalForm}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Гипотеза *</label>
                <textarea
                  className={styles.modalTextarea}
                  placeholder={'Если отправлять сообщения вечером в пятницу,\nто response rate будет выше...'}
                  rows={3}
                  value={expForm.hypothesis}
                  onChange={e => setExpForm(p => ({ ...p, hypothesis: e.target.value }))}
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Категория</label>
                  <select
                    className={styles.modalSelect}
                    value={expForm.category}
                    onChange={e => setExpForm(p => ({ ...p, category: e.target.value }))}
                  >
                    <option value="message">Сообщение / текст</option>
                    <option value="channel">Канал</option>
                    <option value="price">Цена</option>
                    <option value="positioning">Позиционирование</option>
                    <option value="product">Продукт</option>
                    <option value="other">Другое</option>
                  </select>
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Метрика</label>
                  <select
                    className={styles.modalSelect}
                    value={expForm.metric}
                    onChange={e => setExpForm(p => ({ ...p, metric: e.target.value }))}
                  >
                    <option value="reply_rate">Reply rate</option>
                    <option value="open_rate">Open rate</option>
                    <option value="conversion_to_paying">Конверсия в оплату</option>
                    <option value="conversion_to_meeting">Конверсия в встречу</option>
                    <option value="custom">Другая</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Целевой % или число</label>
                  <input
                    className={styles.modalInput}
                    type="number"
                    placeholder="18"
                    value={expForm.target_value}
                    onChange={e => setExpForm(p => ({ ...p, target_value: e.target.value }))}
                  />
                </div>
                <div className={styles.modalField}>
                  <label className={styles.modalLabel}>Мин. наблюдений</label>
                  <input
                    className={styles.modalInput}
                    type="number"
                    placeholder="20"
                    value={expForm.min_sample_size}
                    onChange={e => setExpForm(p => ({ ...p, min_sample_size: e.target.value }))}
                  />
                </div>
              </div>
              {expError && (
                <div className={styles.formError}>{expError}</div>
              )}
              <div className={styles.modalFooter}>
                <button className={styles.btnCancel} onClick={() => setShowAddExp(false)}>
                  Отмена
                </button>
                <button
                  className={styles.btnSave}
                  disabled={expSaving || !expForm.hypothesis.trim()}
                  onClick={saveExperiment}
                >
                  {expSaving ? 'Создаём...' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: toast.type === 'error' ? 'var(--red-text)' : 'var(--text)',
          color: 'var(--bg-panel)',
          padding: '11px 18px', borderRadius: 10,
          fontSize: 13, fontWeight: 500,
          boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
          zIndex: 200,
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeInUp 0.3s ease',
        }}>
          <i className={`ti ${toast.type === 'error' ? 'ti-alert-circle' : 'ti-check'}`} />
          {toast.text}
        </div>
      )}

      {/* ── CHAT PANEL ──────────────────────────────────── */}
      {/* ── CHAT PANEL ──────────────────────────────────── */}
      <aside className={styles.chatPanel}>

        {/* Chat header */}
        <div className={styles.chatHeader}>
          <div className={styles.chatRoleTabs}>
            {(['max', 'marcus', 'leo'] as Role[]).map(role => {
              const cfg = ROLE_CONFIG[role]
              return (
                <button
                  key={role}
                  className={`${styles.chatRoleTab} ${activeRole === role ? styles.chatRoleTabActive : ''}`}
                  style={activeRole === role ? {
                    background: cfg.bgColor,
                    color: cfg.color,
                    borderColor: cfg.color + '40',
                  } : {}}
                  onClick={() => {
                    setActiveRole(role)
                    inputRef.current?.focus()
                  }}
                >
                  {cfg.label}
                </button>
              )
            })}
          </div>
          <div className={styles.chatRoleDesc}>
            <span
              className={styles.roleDot}
              style={{ background: roleConfig.color }}
            />
            {roleConfig.description}
          </div>
        </div>

        {/* Messages */}
        <div className={styles.chatMessages}>
          {messages.length === 0 && (
            <div className={styles.chatWelcome}>
              <div
                className={styles.welcomeAvatar}
                style={{ background: roleConfig.bgColor, color: roleConfig.color }}
              >
                {roleConfig.initial}
              </div>
              <div className={styles.welcomeName}>{roleConfig.label}</div>
              <div className={styles.welcomeDesc}>
                {activeRole === 'max' && 'Стратег. Работает с общим направлением, мотивацией и ключевыми решениями.'}
                {activeRole === 'marcus' && 'Билдер. Помогает с текстами, разбором фейлов и конкретными тактиками.'}
                {activeRole === 'leo' && 'Директор. Считает unit-экономику, ROI и финансовые решения.'}
              </div>
              {/* Quick starters */}
              <div className={styles.starters}>
                {activeRole === 'max' && [
                  'Как оцениваешь мой текущий прогресс?',
                  'Что сейчас самое важное?',
                  'Застрял, не знаю что делать дальше',
                ].map(s => (
                  <button key={s} className={styles.starterBtn} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
                {activeRole === 'marcus' && [
                  'Помоги написать follow-up сообщение',
                  'Разбери почему нет ответов',
                  'Помоги с первым холодным письмом',
                ].map(s => (
                  <button key={s} className={styles.starterBtn} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
                {activeRole === 'leo' && [
                  'Посчитай когда выйду в плюс',
                  'Какая цена оптимальна?',
                  'Стоит ли инвестировать время в контент?',
                ].map(s => (
                  <button key={s} className={styles.starterBtn} onClick={() => sendMessage(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgUser : styles.msgAssistant}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className={styles.msgAvatar}
                  style={{
                    background: ROLE_CONFIG[msg.ai_role ?? 'max'].bgColor,
                    color: ROLE_CONFIG[msg.ai_role ?? 'max'].color,
                  }}
                >
                  {ROLE_CONFIG[msg.ai_role ?? 'max'].initial}
                </div>
              )}
              <div className={`${styles.msgBubble} ${msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAi}`}>
                {msg.content || (
                  <span className={styles.typing}>
                    <span /><span /><span />
                  </span>
                )}
              </div>
            </div>
          ))}

          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className={styles.chatInput}>
          <div
            className={styles.inputWrapper}
            style={{ borderColor: isStreaming ? roleConfig.color + '60' : undefined }}
          >
            <textarea
              ref={inputRef}
              className={styles.textarea}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Написать ${roleConfig.label}...`}
              rows={1}
              disabled={isStreaming}
            />
            <button
              className={styles.sendBtn}
              onClick={() => sendMessage()}
              disabled={isStreaming || !inputValue.trim()}
              style={{ background: roleConfig.color }}
              aria-label="Отправить"
            >
              {isStreaming ? (
                <i className="ti ti-loader-2" style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <i className="ti ti-send" />
              )}
            </button>
          </div>
          <div className={styles.inputHint}>
            Enter — отправить · Shift+Enter — новая строка
          </div>
        </div>

      </aside>
    </div>
  )
}
