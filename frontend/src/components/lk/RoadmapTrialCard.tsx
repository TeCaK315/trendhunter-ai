'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  trendId: string
  strategySessionId: string
}

export default function RoadmapTrialCard({ trendId, strategySessionId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const onClick = async () => {
    if (loading) return
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/roadmap/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend_id: trendId, strategy_session_id: strategySessionId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Не удалось активировать trial')
      router.push(json.redirect_to ?? `/roadmap/${json.roadmap_id}`)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
      setLoading(false)
    }
  }

  return (
    <div className="strategy-partner-ui">
      <div className="section-card">
        <div className="section-card-header">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span className="summary-card-id">MAP</span>
            <span style={{ fontSize: 16, fontWeight: 500, color: '#F5F5F4' }}>Роадмап Pro</span>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: '#5DCAA5',
              background: 'rgba(93,202,165,0.1)',
              padding: '3px 10px',
              borderRadius: 20,
              letterSpacing: '.06em',
            }}
          >
            Доступен
          </span>
        </div>

        <p style={{ fontSize: 13.5, color: '#A3A3A1', margin: '10px 0 16px', lineHeight: 1.5 }}>
          Первые 3 дня бесплатно. AI-помощник на 90 дней — дашборд, чат, метрики.
        </p>

        {err && <p style={{ fontSize: 13, color: '#F09595', marginBottom: 12 }}>{err}</p>}

        <button
          onClick={onClick}
          disabled={loading}
          type="button"
          className="trial-upgrade-btn"
          style={{
            fontSize: 13,
            padding: '8px 16px',
            opacity: loading ? 0.6 : 1,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Активируем trial...' : 'Попробовать бесплатно →'}
        </button>
      </div>
    </div>
  )
}
