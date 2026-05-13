'use client'

/**
 * TrendHunter AI — Kill Switch Review Client
 * src/app/roadmap/[id]/review/KillSwitchClient.tsx
 *
 * Kill Switch Review — финальная точка 90-дневного цикла.
 *
 * 4 фазы через чат с Максом:
 * 1. Факты (данные автоматически)
 * 2. Интерпретация динамики
 * 3. Классификация сценария (A1/A2/A3/B1/B2/C)
 * 4. Выбор пути (Continue / Adjust / Stop)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import styles from './review.module.css'

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

type ReviewData = {
  session: {
    id: string
    niche: string
    kill_switch_date: string
    kill_switch_metric: string
    day_number: number
    days_remaining: number
  }
  kill_switch: {
    target_metric_name: string
    target_value: number
    current_value: number
    progress_percent: number
  }
  metrics: {
    messages_sent: number
    conversations_held: number
    paying_clients: number
    validated_experiments: number
    active_conversations: number
    stalled_conversations: number
    lost_conversations: number
  }
  trajectory: {
    trend: 'accelerating' | 'flat' | 'declining'
    last_14_days_won: number
    prev_14_days_won: number
    confidence: 'high' | 'medium' | 'low'
  }
  pipeline: {
    active_conversations: number
    high_intent_leads: number
    stalled: number
  }
  effort: {
    active_days: number
    consistency_score: number
  }
  outcome_reasons: [string, number][]
  validated_experiments: { hypothesis: string; lesson?: string }[]
  rejected_experiments: { hypothesis: string; lesson?: string }[]
  milestones: string[]
  scenario: 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C'
  previous_review: { scenario: string; decision: string } | null
}

type Phase = 1 | 2 | 3 | 4
type Decision = 'continue' | 'adjust' | 'stop' | null

type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  content: string
}

// ─────────────────────────────────────────────────────────────
// SCENARIO CONFIG
// ─────────────────────────────────────────────────────────────

const SCENARIO_CONFIG = {
  A1: { label: 'Работает', color: 'var(--green)', bg: 'var(--green-bg)', textColor: 'var(--green-text)', desc: 'Модель подтверждена, темп растёт' },
  A2: { label: 'Работает (плато)', color: 'var(--amber)', bg: 'var(--amber-bg)', textColor: 'var(--amber-text)', desc: 'Цель достигнута, но рост остановился' },
  A3: { label: 'Работает (спад)', color: 'var(--amber)', bg: 'var(--amber-bg)', textColor: 'var(--amber-text)', desc: 'Цель достигнута, но тренд падает' },
  B1: { label: 'Пограничный', color: 'var(--amber)', bg: 'var(--amber-bg)', textColor: 'var(--amber-text)', desc: 'Есть сигналы, нет стабильности' },
  B2: { label: 'Пограничный', color: 'var(--amber)', bg: 'var(--amber-bg)', textColor: 'var(--amber-text)', desc: 'Pipeline есть, конверсии нет' },
  C: { label: 'Не работает', color: 'var(--red)', bg: 'var(--red-bg)', textColor: 'var(--red-text)', desc: 'Нет клиентов, нет pipeline' },
}

const TREND_LABEL = {
  accelerating: { label: 'Ускоряется ↑', color: 'var(--green-text)' },
  flat: { label: 'Стабильно →', color: 'var(--text-secondary)' },
  declining: { label: 'Замедляется ↓', color: 'var(--red-text)' },
}

// ─────────────────────────────────────────────────────────────
// MAX REVIEW MESSAGES (детерминированные фразы, не LLM)
// ─────────────────────────────────────────────────────────────

function buildPhase1Message(data: ReviewData): string {
  const { kill_switch, metrics, session } = data
  const progress = `${kill_switch.current_value} из ${kill_switch.target_value}`

  return `День ${session.day_number}. Давай зафиксируем факты.

**Цель:** ${kill_switch.target_metric_name}
**Сейчас:** ${progress} (${kill_switch.progress_percent}%)

За весь период:
— Разговоров проведено: ${metrics.conversations_held}
— Платящих клиентов: ${metrics.paying_clients}
— Гипотез подтверждено: ${metrics.validated_experiments}
— Активных сейчас: ${data.pipeline.active_conversations}

Это просто факты. Согласен с цифрами?`
}

function buildPhase2Message(data: ReviewData): string {
  const { trajectory } = data
  const trendText =
    trajectory.trend === 'accelerating'
      ? `Первая половина — медленнее. Последние 14 дней — быстрее. Это похоже на разгон, не на потолок.`
      : trajectory.trend === 'declining'
      ? `Первая половина — активнее. Последние 14 дней — медленнее. Стоит разобраться почему.`
      : `Темп держится ровно. Не разгон, но и не падение. Стабильная работа.`

  const milestoneText = data.milestones.length > 0
    ? `\n\nЧто произошло за этот период:\n${data.milestones.slice(0, 3).map(m => `— ${m}`).join('\n')}`
    : ''

  const expText = data.validated_experiments.length > 0
    ? `\n\nПодтверждённые гипотезы:\n${data.validated_experiments.slice(0, 3).map(e => `— ${e.hypothesis}`).join('\n')}`
    : ''

  return `Теперь важнее не цифра ${data.kill_switch.current_value}/${data.kill_switch.target_value}.

Важно как ты к ней пришёл.

${trendText}${milestoneText}${expText}

Это даёт другую картину чем просто "достиг" или "не достиг". Есть ли что-то что повлияло на результат — разовый фактор, скидка, изменение подхода?`
}

function buildPhase3Message(data: ReviewData): string {
  const scenario = data.scenario
  const cfg = SCENARIO_CONFIG[scenario]

  const scenarioTexts: Record<string, string> = {
    A1: `По фактам это сценарий **"Работает"** — модель проверена и продолжает расти.\n\nВопрос не "получится ли", а "как масштабировать".`,
    A2: `Цель достигнута, но последние 30 дней без роста. Это не падение, но и не разгон. Ты на плато.\n\nЕсли продолжишь — фокус на возвращении роста, не на масштабировании.`,
    A3: `Цель достигнута, но тренд последних недель падает. Это либо насыщение канала, либо что-то изменилось в подходе.\n\n⚠️ Цель формально выполнена, но модель деградирует.`,
    B1: `По фактам это пограничный сценарий.\n\nЕсть признаки что это может работать:\n— ${data.pipeline.active_conversations} активных разговоров\n— ${data.validated_experiments.length > 0 ? data.validated_experiments.length + ' подтверждённых гипотез' : 'накопленный опыт'}\n\nНо пока это не система — это попытки. Нет стабильного потока.`,
    B2: `По фактам пограничный сценарий с негативным результатом.\n\nТы работал — есть pipeline (${data.pipeline.active_conversations} разговоров, ${data.pipeline.high_intent_leads} тёплых лидов). Но за этот цикл это не привело к платящему клиенту.\n\nВозможно модель работает, но слишком медленно. Или процесс ломается в последнем шаге.`,
    C: `По фактам это сценарий **"Не работает"**.\n\nЭто не провал — это закрытая гипотеза с данными.\n\nТы работал ${data.effort.active_days} активных дней. Это не случай "не пробовал". Это случай "пробовал серьёзно, гипотеза не подтвердилась".`,
  }

  return scenarioTexts[scenario] + `\n\nЗдесь нет правильного ответа. Есть варианты с разными последствиями.`
}

function buildPhase4Message(data: ReviewData): string {
  const scenario = data.scenario

  const paths = {
    continue: {
      A1: `**Continue (+60 дней)**\nЦель меняется: было выживание, станет рост. Фокус на масштабировании того что работает.`,
      A2: `**Continue (+30 дней)**\nЦель — вернуть рост. Не масштабирование, а возвращение динамики.`,
      A3: `**Continue (+30 дней) ⚠️**\nФокус не на масштабировании — на остановке падения. Нужно понять почему деградирует.`,
      B1: `**Continue (+30 дней)**\nФокус: превратить попытки в систему. Через 14 дней — мини-Review.`,
      B2: `**Continue (+30 дней)**\nФокус: найти где именно ломается последний шаг воронки.`,
      C: `**Continue (+30 дней) ⚠️**\nЭто ставка против данных. По цифрам нет сигналов что модель работает. Решение основанное на интуиции, не на проверенных гипотезах.`,
    },
    adjust: {
      A1: `**Adjust** — для A1 обычно не нужен.`,
      A2: `**Adjust (+14 дней)**\nМеняем один параметр. Что именно — твой выбор. Обычно канал или угол сообщений.`,
      A3: `**Adjust (+14 дней)**\nМеняем один параметр — скорее всего канал или подход к первому контакту.`,
      B1: `**Adjust (+14 дней)**\nМеняем один параметр: канал, сегмент, или точку входа в разговор. Без изменения ниши.`,
      B2: `**Adjust (+14 дней) — рекомендуется**\nНужно понять где ломается конверсия из разговора в оплату. Меняем последний шаг воронки.`,
      C: `**Adjust (+14 дней)**\nЕсли есть конкретная гипотеза что менять — это вариант. Без гипотезы превращается в гадание.`,
    },
    stop: `**Stop**\nЭто не провал — это закрытая гипотеза с данными. У тебя теперь есть ${data.validated_experiments.length} подтверждённых паттернов, ${data.effort.active_days} дней опыта работы с каналом. Это материал для следующей попытки.`,
  }

  const sc = scenario as keyof typeof paths.continue

  return `Три пути. Я не рекомендую — даю ориентиры по тому какой путь чаще выбирают в таких ситуациях.

${paths.continue[sc]}

${paths.adjust[sc]}

${paths.stop}

---

Это не директивы. Это паттерны выбора. **Решение за тобой.**`
}

// ─────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function KillSwitchClient({
  roadmapId,
}: {
  roadmapId: string
  userId: string
}) {
  const router = useRouter()

  const [data, setData] = useState<ReviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [phase, setPhase] = useState<Phase>(1)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [userInput, setUserInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [decision, setDecision] = useState<Decision>(null)
  const [submitting, setSubmitting] = useState(false)
  const [adjustParam, setAdjustParam] = useState('')
  const [agreedWithFacts, setAgreedWithFacts] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // ── Загружаем данные ───────────────────────────────────────
  useEffect(() => {
    fetch(`/api/roadmap/kill-switch?roadmap_id=${roadmapId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        // Запускаем Фазу 1 автоматически
        setTimeout(() => startPhase1(d), 500)
      })
      .catch(() => {
        setError('Не удалось загрузить данные Review')
        setLoading(false)
      })
  }, [roadmapId])

  // ── Scroll ─────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Симулируем "печатание" Макса ──────────────────────────
  const addMaxMessage = useCallback((text: string) => {
    setIsTyping(true)
    const delay = Math.min(1200, text.length * 8)
    setTimeout(() => {
      setIsTyping(false)
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
      }])
    }, delay)
  }, [])

  // ── Фазы ──────────────────────────────────────────────────
  const startPhase1 = useCallback((d: ReviewData) => {
    addMaxMessage(buildPhase1Message(d))
  }, [addMaxMessage])

  const goToPhase2 = useCallback(() => {
    if (!data) return
    setPhase(2)
    addMaxMessage(buildPhase2Message(data))
  }, [data, addMaxMessage])

  const goToPhase3 = useCallback(() => {
    if (!data) return
    setPhase(3)
    addMaxMessage(buildPhase3Message(data))
  }, [data, addMaxMessage])

  const goToPhase4 = useCallback(() => {
    if (!data) return
    setPhase(4)
    addMaxMessage(buildPhase4Message(data))
  }, [data, addMaxMessage])

  // ── Отправка пользовательского сообщения ─────────────────
  const sendUserMessage = useCallback(() => {
    const text = userInput.trim()
    if (!text || isTyping) return

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    }])
    setUserInput('')

    // Автопрогресс по фазам
    if (phase === 1 && !agreedWithFacts) {
      setAgreedWithFacts(true)
      setTimeout(() => goToPhase2(), 600)
    } else if (phase === 2) {
      setTimeout(() => goToPhase3(), 600)
    } else if (phase === 3) {
      setTimeout(() => goToPhase4(), 600)
    } else if (phase === 4) {
      addMaxMessage('Понял. Кнопки ниже активны — выбери путь когда будешь готов.')
    }
  }, [userInput, isTyping, phase, agreedWithFacts, goToPhase2, goToPhase3, goToPhase4, addMaxMessage])

  // ── Финальное решение ─────────────────────────────────────
  const submitDecision = useCallback(async (d: 'continue' | 'adjust' | 'stop') => {
    if (!data) return
    setDecision(d)
    setSubmitting(true)

    try {
      const res = await fetch('/api/roadmap/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roadmap_id: roadmapId,
          decision: d,
          scenario: data.scenario,
          adjust_parameter: d === 'adjust' ? adjustParam : undefined,
          extend_days: d === 'continue'
            ? data.scenario.startsWith('A') ? 60 : 30
            : undefined,
        }),
      })

      const result = await res.json()

      // Финальное сообщение от Макса
      const finalMessages = {
        continue: `Продолжаем. Новый цикл начинается — цель та же, подход тот же, но с опытом этих 90 дней.\n\nПереходим к работе.`,
        adjust: `Корректируем. 14 дней — это тест, не полноценный цикл.\n\nФокус на одном изменении. Остальное — без изменений.\n\nВозвращаемся к работе.`,
        stop: `Это закрытие цикла, не провал.\n\nЧто у тебя теперь есть: реальные данные о нише, подтверждённые паттерны, опыт прямых продаж.\n\nЭто материал. Используй его.`,
      }

      addMaxMessage(finalMessages[d])

      setTimeout(() => {
        router.push(result.redirect_to || '/dashboard')
      }, 3000)

    } catch {
      setSubmitting(false)
      setDecision(null)
    }
  }, [data, roadmapId, adjustParam, router, addMaxMessage])

  // ── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner} />
        <p>Загружаем данные для Kill Switch Review...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={styles.errorScreen}>
        <i className="ti ti-alert-circle" />
        <p>{error ?? 'Что-то пошло не так'}</p>
        <button onClick={() => router.back()}>Назад</button>
      </div>
    )
  }

  const scenarioCfg = SCENARIO_CONFIG[data.scenario]
  const trendCfg = TREND_LABEL[data.trajectory.trend]

  return (
    <div className={styles.reviewLayout}>

      {/* ── LEFT: данные ──────────────────────────────────── */}
      <aside className={styles.dataPanel}>
        <div className={styles.dataHeader}>
          <div className={styles.dataTitle}>Kill Switch Review</div>
          <div className={styles.dataSub}>
            День {data.session.day_number} · {data.session.niche}
          </div>
        </div>

        <div className={styles.dataContent}>

          {/* Kill switch progress */}
          <div className={styles.dataCard}>
            <div className={styles.dataCardLabel}>Цель</div>
            <div className={styles.goalText}>{data.kill_switch.target_metric_name}</div>
            <div className={styles.progressLarge}>
              <div className={styles.progressNumbers}>
                <span className={styles.progressCurrent}>{data.kill_switch.current_value}</span>
                <span className={styles.progressSep}>/</span>
                <span className={styles.progressTarget}>{data.kill_switch.target_value}</span>
              </div>
              <div className={styles.progressBarLarge}>
                <div
                  className={styles.progressFillLarge}
                  style={{
                    width: `${data.kill_switch.progress_percent}%`,
                    background: data.kill_switch.progress_percent >= 80
                      ? 'var(--green)' : data.kill_switch.progress_percent >= 40
                      ? 'var(--amber)' : 'var(--red)',
                  }}
                />
              </div>
              <div className={styles.progressPct}>{data.kill_switch.progress_percent}%</div>
            </div>
          </div>

          {/* Trajectory */}
          <div className={styles.dataCard}>
            <div className={styles.dataCardLabel}>Тренд последних 14 дней</div>
            <div className={styles.trajectoryVal} style={{ color: trendCfg.color }}>
              {trendCfg.label}
            </div>
            <div className={styles.trajectoryMeta}>
              {data.trajectory.last_14_days_won} побед vs {data.trajectory.prev_14_days_won} ранее
            </div>
          </div>

          {/* Метрики */}
          <div className={styles.dataCard}>
            <div className={styles.dataCardLabel}>Итоговые метрики</div>
            <div className={styles.metricsList}>
              {[
                { label: 'Разговоров', val: data.metrics.conversations_held },
                { label: 'Платящих', val: data.metrics.paying_clients },
                { label: 'Гипотез ✓', val: data.metrics.validated_experiments },
                { label: 'Активных дней', val: data.effort.active_days },
                { label: 'Pipeline сейчас', val: data.pipeline.active_conversations },
              ].map(({ label, val }) => (
                <div key={label} className={styles.metricsRow}>
                  <span className={styles.metricsLabel}>{label}</span>
                  <span className={styles.metricsVal}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Сценарий */}
          <div className={styles.dataCard}>
            <div className={styles.dataCardLabel}>Классификация</div>
            <div
              className={styles.scenarioBadge}
              style={{ background: scenarioCfg.bg, color: scenarioCfg.textColor }}
            >
              <span className={styles.scenarioCode}>{data.scenario}</span>
              <span>{scenarioCfg.label}</span>
            </div>
            <div className={styles.scenarioDesc}>{scenarioCfg.desc}</div>
          </div>

          {/* Топ причины отказов */}
          {data.outcome_reasons.length > 0 && (
            <div className={styles.dataCard}>
              <div className={styles.dataCardLabel}>Причины отказов</div>
              {data.outcome_reasons.map(([reason, count]) => (
                <div key={reason} className={styles.reasonRow}>
                  <span className={styles.reasonLabel}>{reason}</span>
                  <span className={styles.reasonCount}>{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Phase indicator */}
          <div className={styles.phaseIndicator}>
            {([1, 2, 3, 4] as Phase[]).map(p => (
              <div key={p} className={`${styles.phaseStep} ${phase >= p ? styles.phaseStepDone : ''} ${phase === p ? styles.phaseStepActive : ''}`}>
                <div className={styles.phaseStepDot}>{p}</div>
                <div className={styles.phaseStepLabel}>
                  {p === 1 ? 'Факты' : p === 2 ? 'Динамика' : p === 3 ? 'Сценарий' : 'Решение'}
                </div>
              </div>
            ))}
          </div>

        </div>
      </aside>

      {/* ── RIGHT: чат с Максом ───────────────────────────── */}
      <main className={styles.chatSection}>
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <div className={styles.maxAvatar}>М</div>
            <div>
              <div className={styles.maxName}>Макс</div>
              <div className={styles.maxDesc}>Kill Switch Review · Стратег</div>
            </div>
          </div>
          <div className={styles.chatHeaderRight}>
            <span className={styles.reviewDays}>
              {data.session.days_remaining === 0 ? 'Сегодня' : `${data.session.days_remaining} дней до дедлайна`}
            </span>
          </div>
        </div>

        {/* Messages */}
        <div className={styles.chatMessages}>

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`${styles.msgRow} ${msg.role === 'user' ? styles.msgUser : ''}`}
            >
              {msg.role === 'assistant' && (
                <div className={styles.msgAvatarSmall}>М</div>
              )}
              <div className={`${styles.msgBubble} ${msg.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleAi}`}>
                {msg.content.split('\n').map((line, i) => {
                  // Простой markdown: **bold**
                  const parts = line.split(/(\*\*[^*]+\*\*)/)
                  return (
                    <span key={i}>
                      {parts.map((part, j) =>
                        part.startsWith('**') && part.endsWith('**')
                          ? <strong key={j}>{part.slice(2, -2)}</strong>
                          : <span key={j}>{part}</span>
                      )}
                      {i < msg.content.split('\n').length - 1 && <br />}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className={styles.msgRow}>
              <div className={styles.msgAvatarSmall}>М</div>
              <div className={styles.msgBubble}>
                <div className={styles.typingDots}>
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Phase navigation buttons */}
        {!isTyping && messages.length > 0 && phase < 4 && (
          <div className={styles.phaseNav}>
            {phase === 1 && !agreedWithFacts && (
              <button
                className={styles.phaseNavBtn}
                onClick={() => {
                  setAgreedWithFacts(true)
                  setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'user',
                    content: 'Да, цифры верные.',
                  }])
                  setTimeout(() => goToPhase2(), 600)
                }}
              >
                Да, данные верные → к динамике
              </button>
            )}
            {phase === 1 && !agreedWithFacts && (
              <button
                className={styles.phaseNavBtnSecondary}
                onClick={() => {
                  setMessages(prev => [...prev, {
                    id: crypto.randomUUID(),
                    role: 'user',
                    content: 'Есть расхождение в цифрах.',
                  }])
                  addMaxMessage('Хорошо. Откуда у тебя другие данные? Уточни — пересчитаем с правильными цифрами.')
                  setAgreedWithFacts(true)
                }}
              >
                Есть расхождение
              </button>
            )}
            {phase === 2 && (
              <button className={styles.phaseNavBtn} onClick={() => {
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: 'Разовых факторов не было. Это реальная картина.' }])
                setTimeout(() => goToPhase3(), 600)
              }}>
                Нет разовых факторов → к сценарию
              </button>
            )}
            {phase === 3 && (
              <button className={styles.phaseNavBtn} onClick={() => {
                setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', content: 'Понял. Смотрим варианты дальше.' }])
                setTimeout(() => goToPhase4(), 600)
              }}>
                Понял → к вариантам
              </button>
            )}
          </div>
        )}

        {/* Decision buttons — фаза 4 */}
        {phase === 4 && !decision && !isTyping && (
          <div className={styles.decisionBlock}>
            <div className={styles.decisionTitle}>Выбери путь</div>

            {data.scenario !== 'A1' && (
              <div className={styles.adjustInput}>
                <input
                  type="text"
                  placeholder="Для Adjust: что меняем? (канал, сегмент, подход...)"
                  value={adjustParam}
                  onChange={e => setAdjustParam(e.target.value)}
                  className={styles.adjustField}
                />
              </div>
            )}

            <div className={styles.decisionBtns}>
              <button
                className={`${styles.decisionBtn} ${styles.decisionContinue}`}
                onClick={() => submitDecision('continue')}
                disabled={submitting}
              >
                <i className="ti ti-arrow-right" />
                <div>
                  <div className={styles.decisionBtnLabel}>Continue</div>
                  <div className={styles.decisionBtnDesc}>
                    +{data.scenario.startsWith('A') ? '60' : '30'} дней
                  </div>
                </div>
              </button>

              <button
                className={`${styles.decisionBtn} ${styles.decisionAdjust}`}
                onClick={() => submitDecision('adjust')}
                disabled={submitting}
              >
                <i className="ti ti-adjustments" />
                <div>
                  <div className={styles.decisionBtnLabel}>Adjust</div>
                  <div className={styles.decisionBtnDesc}>+14 дней, 1 изменение</div>
                </div>
              </button>

              <button
                className={`${styles.decisionBtn} ${styles.decisionStop}`}
                onClick={() => submitDecision('stop')}
                disabled={submitting}
              >
                <i className="ti ti-square" />
                <div>
                  <div className={styles.decisionBtnLabel}>Stop</div>
                  <div className={styles.decisionBtnDesc}>Завершить цикл</div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Решение принято */}
        {decision && (
          <div className={styles.decisionMade}>
            <i className="ti ti-check" />
            Решение принято: <strong>{decision}</strong>. Переходим...
          </div>
        )}

        {/* Input */}
        {phase < 4 && (
          <div className={styles.inputArea}>
            <div className={styles.inputWrap}>
              <textarea
                ref={inputRef}
                className={styles.inputTextarea}
                placeholder="Ответить Максу..."
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendUserMessage()
                  }
                }}
                rows={1}
                disabled={isTyping}
              />
              <button
                className={styles.sendBtn}
                onClick={sendUserMessage}
                disabled={isTyping || !userInput.trim()}
              >
                <i className="ti ti-send" />
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
