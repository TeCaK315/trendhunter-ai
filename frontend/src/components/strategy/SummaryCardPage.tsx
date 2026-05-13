'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import SummaryCard from './blocks/SummaryCard'
import OpenRoadmapButton from '@/components/strategy/OpenRoadmapButton'

interface PersistedState {
  sessionId: string | null
  freeBlockResult: unknown
  blockResults: Record<string, unknown>
}

function loadSessionId(trendId: string): string | null {
  try {
    const raw = localStorage.getItem(`strategy_${trendId}`)
    if (!raw) return null
    const st = JSON.parse(raw) as PersistedState
    return st.sessionId ?? null
  } catch { return null }
}

interface Props {
  trendId: string
  onNavigateSubTab: (subTab: string) => void
}

interface SummaryData {
  niche?: string
  lines?: Record<string, string>
}

export default function SummaryCardPage({ trendId, onNavigateSubTab }: Props) {
  const router = useRouter()
  const handleOpenRoadmap = useCallback(() => {
    router.push(`/lk/roadmap?trend_id=${encodeURIComponent(trendId)}`)
  }, [router, trendId])

  const [sessionId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return loadSessionId(trendId)
  })
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fetched, setFetched] = useState(false)

  useEffect(() => {
    if (!sessionId) { setFetched(true); return }
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/strategy/summary-card?session_id=${encodeURIComponent(sessionId)}`)
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (res.ok && json && json.lines) {
          setData(json)
        }
      } catch {
        /* swallow — show generate button */
      } finally {
        if (!cancelled) { setLoading(false); setFetched(true) }
      }
    }
    load()
    return () => { cancelled = true }
  }, [sessionId])

  const handleGenerate = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/strategy/summary-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, action: 'generate' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Не удалось сформировать карту')
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  if (!sessionId) {
    return (
      <div className="text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
        <p>Сначала пройди «Оценку шансов» и блоки стратегии S0-S5.</p>
        <button onClick={() => onNavigateSubTab('free')} className="text-xs text-indigo-400 hover:text-indigo-300">
          ← Перейти к оценке
        </button>
      </div>
    )
  }

  if (!fetched || loading) {
    return <div className="text-sm text-zinc-500 py-10 text-center">Загрузка сводной карты...</div>
  }

  if (data && data.lines) {
    return (
      <div>
        <SummaryCard data={data} onRoadmap={handleOpenRoadmap} />
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
          <OpenRoadmapButton trendId={trendId} strategySessionId={sessionId} />
        </div>
      </div>
    )
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center space-y-4">
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-white">Сводная карта ещё не сформирована</h3>
        <p className="text-sm text-zinc-400">Пройди все 5 блоков стратегии и сгенерируй итоговую A4-карту.</p>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-lg px-5 py-2.5 text-sm font-medium transition-colors"
      >
        {loading ? 'Формируем...' : 'Сгенерировать'}
      </button>
    </div>
  )
}
