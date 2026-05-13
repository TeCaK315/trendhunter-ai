'use client'

import { useEffect, useState } from 'react'
import ManualMetricsModal from './ManualMetricsModal'
import BannerList from './BannerList'

interface Metric {
  metric_name: string
  value: number
  updated_via?: string | null
  updated_at?: string | null
}

interface Trigger {
  id: string
  trigger_type: string
  actionable_text: string
  suggested_action?: string | null
  source_url?: string | null
  raw_content?: string | null
  context?: { search_query?: string } | null
  acted_upon?: boolean
  generated_at: string
}

interface Banner {
  id: string
  banner_type: string
  content: string
  created_at?: string
}

interface DashboardData {
  metrics: Metric[]
  daily_action: { action_text: string; generated_by_role?: string | null; generated_at?: string | null } | null
  triggers: Trigger[]
  banners: Banner[]
}

interface Access {
  status: string
  trial_expires_at: string | null
  discount_window_until: string | null
  paid_until: string | null
}

interface Session {
  id: string
  kill_switch_date: string
  created_at?: string | null
}

interface Props {
  session: Session
  dashboard: DashboardData
  strategyContext: Record<string, { specific?: Record<string, unknown> }>
  access: Access
  onMetricsChanged: () => void
  onUpgradeClick?: () => void
}

const METRIC_LABELS: Record<string, string> = {
  messages_sent: 'сообщений отправлено клиентам',
  replies_received: 'ответов получено',
  conversations: 'разговоров проведено',
  paying_clients: 'платящих клиентов',
  mrr: 'MRR ($)',
}

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  reddit_post: 'Reddit',
  g2_review: 'G2',
  hackernews: 'HackerNews',
  general_pain: 'Боль рынка',
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const diffHours = Math.floor((Date.now() - date.getTime()) / 3600000)
  if (diffHours < 1) return 'только что'
  if (diffHours < 24) return `${diffHours} ч. назад`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'вчера'
  return `${diffDays} дн. назад`
}

function pick(spec: Record<string, unknown> | undefined, path: string[]): string {
  let cur: unknown = spec
  for (const k of path) {
    if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[k]
    } else return ''
  }
  if (cur === null || cur === undefined) return ''
  if (typeof cur === 'string' || typeof cur === 'number') return String(cur)
  return ''
}

function daysBetween(from: string | Date, to: string | Date): number {
  const fromMs = typeof from === 'string' ? new Date(from).getTime() : from.getTime()
  const toMs = typeof to === 'string' ? new Date(to).getTime() : to.getTime()
  return Math.max(0, Math.ceil((toMs - fromMs) / 86400000))
}

function formatDate(s: string | null | undefined): string {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
  } catch { return '' }
}

export default function RoadmapDashboard({ session, dashboard, strategyContext, access, onMetricsChanged, onUpgradeClick }: Props) {
  const [showMetricsModal, setShowMetricsModal] = useState(false)
  const [banners, setBanners] = useState<Banner[]>(dashboard.banners ?? [])

  useEffect(() => {
    setBanners(dashboard.banners ?? [])
  }, [dashboard.banners])

  const handleDismissBanner = async (bannerId: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== bannerId))
    try {
      await fetch('/api/roadmap/banners/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ banner_id: bannerId }),
      })
    } catch {}
  }

  // Daily action — auto-generate if missing
  const [dailyAction, setDailyAction] = useState(dashboard.daily_action)
  const [generatingAction, setGeneratingAction] = useState(false)
  const [actionError, setActionError] = useState('')

  const fetchDailyAction = async () => {
    setGeneratingAction(true)
    setActionError('')
    try {
      const res = await fetch(`/api/roadmap/daily-action?session_id=${encodeURIComponent(session.id)}`)
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.daily_action) setDailyAction(json.daily_action)
      else setActionError(json.error || 'Не удалось')
    } catch {
      setActionError('Сетевая ошибка')
    } finally {
      setGeneratingAction(false)
    }
  }

  useEffect(() => {
    if (!dailyAction && !generatingAction) fetchDailyAction()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Triggers state (refresh + acted)
  const [triggers, setTriggers] = useState<Trigger[]>(dashboard.triggers ?? [])
  const [triggersLoading, setTriggersLoading] = useState(false)
  const [triggersError, setTriggersError] = useState('')
  const [copiedTriggerId, setCopiedTriggerId] = useState<string | null>(null)

  useEffect(() => {
    const next = (dashboard.triggers ?? []) as Trigger[]
    setTriggers(next)
    if (next.length > 0) {
      console.log('[triggers] loaded:', next.map((t) => ({
        id: t.id,
        type: t.trigger_type,
        has_source_url: !!t.source_url,
        has_raw_content: !!t.raw_content,
        raw_content_preview: t.raw_content?.slice(0, 80),
        has_context: !!t.context,
        search_query: t.context?.search_query,
      })))
    }
  }, [dashboard.triggers])

  const handleRefreshTriggers = async () => {
    setTriggersLoading(true)
    setTriggersError('')
    try {
      const refreshRes = await fetch('/api/roadmap/triggers/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session.id }),
      })
      const refreshJson = await refreshRes.json().catch(() => ({}))
      if (!refreshRes.ok) {
        setTriggersError(refreshJson.error || 'Не удалось обновить')
        return
      }
      const listRes = await fetch(`/api/roadmap/triggers?session_id=${encodeURIComponent(session.id)}`)
      const listJson = await listRes.json().catch(() => ({}))
      setTriggers((listJson.triggers ?? []) as Trigger[])
    } catch (e) {
      setTriggersError(e instanceof Error ? e.message : 'Сетевая ошибка')
    } finally {
      setTriggersLoading(false)
    }
  }

  const handleCopyTrigger = async (trigger: Trigger) => {
    if (!trigger.suggested_action) return
    try {
      await navigator.clipboard.writeText(trigger.suggested_action)
      setCopiedTriggerId(trigger.id)
      setTimeout(() => setCopiedTriggerId((id) => (id === trigger.id ? null : id)), 1500)
    } catch {}
  }

  const handleMarkActed = async (triggerId: string) => {
    setTriggers((prev) => prev.map((t) => (t.id === triggerId ? { ...t, acted_upon: true } : t)))
    try {
      await fetch(`/api/roadmap/triggers/${encodeURIComponent(triggerId)}/acted`, { method: 'POST' })
    } catch {}
  }

  // Live metrics flash (Function Calling updates from chat)
  const [liveMetrics, setLiveMetrics] = useState<Record<string, { value: number; updated_via: string }>>({})
  const [flashedMetric, setFlashedMetric] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ metric_name: string; value: number }>).detail
      if (!detail) return
      setLiveMetrics((prev) => ({
        ...prev,
        [detail.metric_name]: { value: detail.value, updated_via: 'ai_dialog' },
      }))
      setFlashedMetric(detail.metric_name)
      setTimeout(() => setFlashedMetric(null), 2000)
    }
    window.addEventListener('roadmap:metrics:updated', handler)
    return () => window.removeEventListener('roadmap:metrics:updated', handler)
  }, [])

  const trialDaysLeft = access.trial_expires_at
    ? daysBetween(new Date(), access.trial_expires_at)
    : 0

  const sessionStart = session.created_at ? new Date(session.created_at) : new Date()
  const killSwitch = new Date(session.kill_switch_date)
  const totalDays = daysBetween(sessionStart, killSwitch)
  const daysSinceStart = Math.max(0, daysBetween(sessionStart, new Date()))
  const daysLeftToKillSwitch = daysBetween(new Date(), killSwitch)

  const metricsByName = Object.fromEntries(dashboard.metrics.map((m) => [m.metric_name, m]))
  const metricInitial: Record<string, number> = {}
  for (const m of dashboard.metrics) metricInitial[m.metric_name] = Number(m.value) || 0

  const s0 = strategyContext?.S0?.specific
  const s1 = strategyContext?.S1?.specific
  const s3 = strategyContext?.S3?.specific

  const positioning = pick(s0, ['positioning_quote'])
  const competitor = pick(s0, ['versus_block', 'them', 'name'])
  const channel = pick(s3, ['channel', 'human_name'])
  const price = pick(s1, ['price_point', 'monthly'])

  return (
    <>
      {access.status === 'trial' && (
        <div className="roadmap-trial-banner">
          <span className="trial-badge">Trial</span>
          <span>
            Бесплатный период — осталось <strong>{trialDaysLeft} дн.</strong>
          </span>
          <button className="trial-upgrade-btn" type="button" onClick={onUpgradeClick}>Продолжить после триала</button>
        </div>
      )}

      <BannerList banners={banners} onDismiss={handleDismissBanner} />

      <div className="numbers">
        <div className="s-label">
          <span className="s-dot" />
          <span>Главное действие сегодня</span>
          <span className="s-label-bar" />
        </div>
        {generatingAction ? (
          <div style={{ color: '#6E6E6B', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5DCAA5', animation: 'blink 1s infinite', display: 'inline-block' }} />
            Формирую действие на сегодня...
          </div>
        ) : dailyAction ? (
          <div className="roadmap-daily-action">
            <div className="daily-action-text">{dailyAction.action_text}</div>
            <button
              className="cta-btn"
              style={{ marginTop: 16 }}
              type="button"
              onClick={() => {
                window.dispatchEvent(
                  new CustomEvent('roadmap:chat:send', {
                    detail: { message: `Разбери моё действие на сегодня: "${dailyAction.action_text}"` },
                  })
                )
              }}
            >
              Разобрать с AI →
            </button>
          </div>
        ) : (
          <div className="roadmap-no-action">
            <p style={{ color: '#6E6E6B', fontSize: 13.5 }}>
              {actionError || 'Не удалось сформировать действие.'}
              <button
                onClick={fetchDailyAction}
                type="button"
                style={{ color: '#5DCAA5', background: 'none', border: 'none', cursor: 'pointer', marginLeft: 6, fontSize: 13.5, fontFamily: 'inherit' }}
              >
                Попробовать снова
              </button>
            </p>
          </div>
        )}
      </div>

      <div className="numbers">
        <div className="s-label">
          <span className="s-dot mid" />
          <span>Прогресс</span>
          <span className="s-label-bar" />
        </div>
        <div className="numbers-grid">
          <div className="num-row">
            <div className="num-metric">{daysSinceStart} / {totalDays}</div>
            <div className="num-translation"><strong>дней работы</strong> — до kill switch</div>
            <div className="num-compare">осталось {daysLeftToKillSwitch} дн.</div>
          </div>
          {Object.keys(METRIC_LABELS).map((key) => {
            const live = liveMetrics[key]
            const m = metricsByName[key]
            const value = live ? live.value : (m ? Number(m.value) : 0)
            const updatedViaCode = live?.updated_via ?? m?.updated_via
            const updatedVia = updatedViaCode === 'ai_dialog' ? 'через AI' : 'вручную'
            const isFlashed = flashedMetric === key
            return (
              <div
                className="num-row"
                key={key}
                style={{
                  transition: 'background .3s, border-color .3s',
                  background: isFlashed ? 'rgba(93,202,165,0.08)' : undefined,
                  borderColor: isFlashed ? 'rgba(93,202,165,0.35)' : undefined,
                }}
              >
                <div className="num-metric">{value}</div>
                <div className="num-translation"><strong>{METRIC_LABELS[key]}</strong></div>
                <div className="num-compare">{m || live ? `обновлено ${updatedVia}` : 'нет данных'}</div>
              </div>
            )
          })}
        </div>
        <button className="roadmap-manual-metrics-btn" onClick={() => setShowMetricsModal(true)} type="button">
          Внести метрики вручную
        </button>
      </div>

      <div className="numbers">
        <div className="s-label">
          <span className="s-dot" />
          <span>Твоя стратегия</span>
          <span className="s-label-bar" />
        </div>
        <div className="numbers-grid">
          <div className="num-row">
            <div className="num-metric" style={{ fontSize: 14 }}>{positioning || '—'}</div>
            <div className="num-translation"><strong>Позиция</strong></div>
            <div className="num-compare" />
          </div>
          <div className="num-row">
            <div className="num-metric" style={{ fontSize: 14 }}>{competitor || '—'}</div>
            <div className="num-translation"><strong>Главный конкурент</strong></div>
            <div className="num-compare" />
          </div>
          <div className="num-row">
            <div className="num-metric" style={{ fontSize: 14 }}>{channel || '—'}</div>
            <div className="num-translation"><strong>Канал привлечения</strong></div>
            <div className="num-compare" />
          </div>
          <div className="num-row">
            <div className="num-metric">{price ? `$${price}/мес` : '—'}</div>
            <div className="num-translation"><strong>Целевая цена</strong></div>
            <div className="num-compare" />
          </div>
        </div>
      </div>

      <div className="numbers">
        <div className="s-label">
          <span className="s-dot purple" />
          <span>Возможности прямо сейчас</span>
          <span className="s-label-bar" />
        </div>
        <div className="triggers-header">
          <span className="triggers-date">
            {triggers.length > 0
              ? `Обновлено: ${formatRelativeDate(triggers[0].generated_at)}`
              : 'Ещё не обновлялось'}
          </span>
          <button
            className="triggers-refresh-btn"
            onClick={handleRefreshTriggers}
            disabled={triggersLoading}
            type="button"
            style={{ opacity: triggersLoading ? 0.6 : 1, cursor: triggersLoading ? 'not-allowed' : 'pointer' }}
          >
            {triggersLoading ? 'Ищу...' : 'Обновить'}
          </button>
        </div>

        {triggersLoading && (
          <div style={{ padding: 16, color: '#6E6E6B', fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#5DCAA5', animation: 'blink 1s infinite', display: 'inline-block' }} />
            Анализирую данные ниши...
          </div>
        )}

        {!triggersLoading && triggersError && (
          <div className="honest" style={{ marginTop: 8 }}>
            <div className="honest-body">{triggersError}</div>
          </div>
        )}

        {!triggersLoading && !triggersError && triggers.length === 0 && (
          <div className="honest">
            <div className="honest-body">
              Нажми «Обновить» чтобы найти свежие возможности для контакта с клиентами на основе данных твоей ниши.
            </div>
          </div>
        )}

        {!triggersLoading && triggers.length > 0 && (
          <div className="action-grid">
            {triggers.map((trigger) => (
              <div className="action-item do" key={trigger.id} style={{ marginBottom: 10, opacity: trigger.acted_upon ? 0.6 : 1 }}>
                <div className="action-icon">→</div>
                <div className="action-content">
                  <div className="action-label">{TRIGGER_TYPE_LABELS[trigger.trigger_type] ?? trigger.trigger_type}</div>
                  <div className="action-text">{trigger.actionable_text}</div>

                  {trigger.raw_content && (
                    <div
                      style={{
                        marginTop: 10, padding: '10px 14px',
                        background: 'rgba(255,255,255,0.02)',
                        borderLeft: '2px solid rgba(255,255,255,0.15)',
                        borderRadius: '0 8px 8px 0',
                        fontSize: 12.5, color: '#6E6E6B', lineHeight: 1.6,
                        fontStyle: 'italic',
                      }}
                    >
                      «{trigger.raw_content.slice(0, 200)}{trigger.raw_content.length > 200 ? '...' : ''}»
                    </div>
                  )}

                  {trigger.suggested_action && (
                    <div
                      style={{
                        marginTop: 10, padding: '10px 14px',
                        background: 'rgba(93,202,165,0.06)',
                        border: '0.5px solid rgba(93,202,165,0.15)',
                        borderRadius: 8, fontSize: 12.5, color: '#C4C4C2', lineHeight: 1.6,
                      }}
                    >
                      <div style={{ fontSize: 10, color: '#5DCAA5', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                        Готовое сообщение
                      </div>
                      {trigger.suggested_action}
                      <button
                        onClick={() => handleCopyTrigger(trigger)}
                        type="button"
                        style={{
                          display: 'block', marginTop: 8, background: 'none',
                          border: '0.5px solid rgba(93,202,165,0.3)', borderRadius: 6,
                          color: '#5DCAA5', fontSize: 11, padding: '4px 10px',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {copiedTriggerId === trigger.id ? 'Скопировано ✓' : 'Скопировать'}
                      </button>
                    </div>
                  )}

                  {trigger.source_url ? (
                    <a
                      href={trigger.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: '#378ADD', textDecoration: 'none' }}
                    >
                      Открыть пост →
                    </a>
                  ) : trigger.context?.search_query ? (
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(trigger.context.search_query)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 12, color: '#378ADD', textDecoration: 'none' }}
                    >
                      Найти похожие посты →
                    </a>
                  ) : null}

                  {!trigger.acted_upon ? (
                    <button
                      onClick={() => handleMarkActed(trigger.id)}
                      type="button"
                      style={{
                        display: 'block', marginTop: 8, background: 'none',
                        border: 'none', color: '#6E6E6B', fontSize: 11,
                        cursor: 'pointer', padding: 0, fontFamily: 'inherit',
                      }}
                    >
                      ✓ Отметить как выполнено
                    </button>
                  ) : (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#5DCAA5' }}>✓ Выполнено</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showMetricsModal && (
        <ManualMetricsModal
          sessionId={session.id}
          initial={metricInitial}
          onClose={() => setShowMetricsModal(false)}
          onSaved={onMetricsChanged}
        />
      )}
    </>
  )
}
