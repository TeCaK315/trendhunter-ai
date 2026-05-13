'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  title: string
  subtitle?: string
  cta: string
  trendId: string
  strategySessionId: string
}

export default function TryRoadmapButton({ title, subtitle, cta, trendId, strategySessionId }: Props) {
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
    <div className="max-w-md w-full mx-auto bg-zinc-900/60 border border-zinc-800 rounded-2xl p-7 shadow-xl space-y-5">
      <div className="space-y-1.5 text-center">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-zinc-400">{subtitle}</p>}
      </div>
      {err && <p className="text-sm text-red-400 text-center">{err}</p>}
      <button
        onClick={onClick}
        disabled={loading}
        className={`block w-full py-3 rounded-xl text-sm font-medium text-center transition-colors ${
          loading
            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }`}
      >
        {loading ? 'Активируем trial...' : cta}
      </button>
    </div>
  )
}
