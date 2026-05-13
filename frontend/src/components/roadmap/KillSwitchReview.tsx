'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface ScenarioOption {
  id: string
  label: string
  description: string
  action: string
}

interface ScenarioData {
  title: string
  subtitle: string
  color: string
  options: readonly ScenarioOption[]
}

interface MetricsSummary {
  paying_clients: number
  mrr: number
  messages_sent: number
  conversations: number
  replies_received: number
}

interface Props {
  daysToKillSwitch: number
  scenario: 'success' | 'semi_success' | 'failure'
  scenarioData: ScenarioData
  metricsSummary: MetricsSummary
  onDismiss: () => void
  onOption: (action: string) => void
}

export default function KillSwitchReview({ daysToKillSwitch, scenarioData, metricsSummary, onDismiss, onOption }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  if (!mounted) return null

  const content = (
    <div className="paywall-overlay" onClick={onDismiss}>
      <div className="strategy-partner-ui paywall-scope" onClick={(e) => e.stopPropagation()}>
        <div className="paywall-card" style={{ maxWidth: 560 }}>
          <div
            style={{
              fontSize: 11, fontWeight: 500, letterSpacing: '.12em',
              color: '#6E6E6B', textTransform: 'uppercase', marginBottom: 16,
            }}
          >
            Kill Switch Review · {daysToKillSwitch <= 0 ? 'Дата наступила' : `Осталось ${daysToKillSwitch} дн.`}
          </div>

          <h2 className="paywall-title" style={{ color: scenarioData.color }}>{scenarioData.title}</h2>
          <p className="paywall-subtitle">{scenarioData.subtitle}</p>

          <div className="numbers" style={{ marginBottom: 24 }}>
            <div className="numbers-grid">
              <div className="num-row">
                <div className="num-metric" style={{ color: metricsSummary.paying_clients > 0 ? '#5DCAA5' : '#F09595' }}>
                  {metricsSummary.paying_clients}
                </div>
                <div className="num-translation"><strong>платящих клиентов</strong></div>
                <div className="num-compare">${metricsSummary.mrr} MRR</div>
              </div>
              <div className="num-row">
                <div className="num-metric">{metricsSummary.messages_sent}</div>
                <div className="num-translation"><strong>сообщений отправлено</strong></div>
                <div className="num-compare">{metricsSummary.replies_received} ответов</div>
              </div>
              <div className="num-row">
                <div className="num-metric">{metricsSummary.conversations}</div>
                <div className="num-translation"><strong>разговоров проведено</strong></div>
                <div className="num-compare" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {scenarioData.options.map((option) => (
              <button
                key={option.id}
                className="section-card"
                onClick={() => onOption(option.action)}
                type="button"
                style={{
                  textAlign: 'left', cursor: 'pointer',
                  border: '0.5px solid rgba(255,255,255,0.1)',
                  background: 'transparent', width: '100%', padding: '14px 18px',
                  fontFamily: 'inherit', color: 'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 500, color: '#F5F5F4', marginBottom: 4 }}>
                  {option.label}
                </div>
                <div style={{ fontSize: 12.5, color: '#A3A3A1' }}>{option.description}</div>
              </button>
            ))}
          </div>

          <button
            onClick={onDismiss}
            type="button"
            style={{
              display: 'block', margin: '0 auto', background: 'none',
              border: 'none', color: '#6E6E6B', fontSize: 12, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Напомни завтра
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
