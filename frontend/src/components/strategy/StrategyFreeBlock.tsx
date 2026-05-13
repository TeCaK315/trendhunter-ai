'use client'

import { useState } from 'react'

interface FreeBlockResponse {
  status: 'green' | 'yellow' | 'red' | 'nogo_exit'
  strategy_mode: string
  segment: string
  session_id?: string
  preview?: { angle_hint: string; channel_hint: string; kill_switch_days: number; experiment_budget: number; ai_stack_cost: number }
  hard_stop?: { rule: string; reason: string; path_a: { label: string; description: string }; path_b: { label: string; description: string }; reruns_remaining: number }
  nogo_exit?: { reason: string; alternative_niches: { name: string; reason: string }[] }
  instant_feedback: {
    budget_vs_floor: { user_budget: number; floor: number; status: string; message: string }
    horizon_vs_cycle: { horizon_days: number; sale_cycle_days: number; status: string; message: string }
    team_note: string | null
    advantage_notes: string[]
  }
  data_warnings?: string[]
}

interface Props {
  trendId: string
  onSessionCreated: (sessionId: string, response: FreeBlockResponse) => void
}

const HORIZON_OPTIONS = [
  { value: 3, label: '3 мес' },
  { value: 6, label: '6 мес' },
  { value: 12, label: '12 мес' },
] as const

const TEAM_OPTIONS = [
  { value: 'solo', label: 'Один' },
  { value: 'small', label: '2-3 чел' },
  { value: 'team', label: 'Команда' },
] as const

export default function StrategyFreeBlock({ trendId, onSessionCreated }: Props) {
  const [budget, setBudget] = useState(2000)
  const [horizon, setHorizon] = useState<1 | 2 | 3 | 6>(3)
  const [teamSize, setTeamSize] = useState<'solo' | 'small' | 'team'>('solo')
  const [canCode, setCanCode] = useState(true)
  const [hasAudience, setHasAudience] = useState(false)
  const [hasPartner, setHasPartner] = useState(false)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<FreeBlockResponse | null>(null)

  const submit = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/strategy/free-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trendId,
          user_inputs: { budget_actual: budget, horizon_months: horizon, team_size: teamSize, can_code: canCode, has_audience: hasAudience, has_partner: hasPartner },
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || data.message || 'Ошибка'); return }
      setResult(data)
      if (data.session_id) onSessionCreated(data.session_id, data)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const statusConfig = {
    green:     { color: 'bg-green-500/10 border-green-500/30 text-green-400', label: 'Готов к запуску', icon: '🟢' },
    yellow:    { color: 'bg-amber-500/10 border-amber-500/30 text-amber-400', label: 'Экспериментальный режим', icon: '🟡' },
    red:       { color: 'bg-red-500/10 border-red-500/30 text-red-400', label: 'Вход заблокирован', icon: '🔴' },
    nogo_exit: { color: 'bg-red-500/10 border-red-500/30 text-red-400', label: 'Стратегия недоступна', icon: '🔴' },
  }

  if (result) {
    const cfg = statusConfig[result.status]
    const fb = result.instant_feedback
    return (
      <div className="space-y-4">
        <div className={`${cfg.color} border rounded-xl p-5`}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xl">{cfg.icon}</span>
            <div>
              <h3 className="text-base font-bold">{cfg.label}</h3>
              <p className="text-xs opacity-70">{result.segment} · {result.strategy_mode}</p>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p>{fb.budget_vs_floor.message}</p>
            <p>{fb.horizon_vs_cycle.message}</p>
            {fb.team_note && <p>{fb.team_note}</p>}
            {fb.advantage_notes.map((n, i) => <p key={i} className="text-green-400">✓ {n}</p>)}
          </div>
        </div>

        {result.preview && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2 text-sm">
            <p className="text-zinc-300">{result.preview.angle_hint}</p>
            <p className="text-zinc-400">{result.preview.channel_hint}</p>
            <div className="flex gap-4 text-xs text-zinc-500">
              <span>Kill switch: {result.preview.kill_switch_days} дней</span>
              <span>AI стек: ${result.preview.ai_stack_cost}/мес</span>
            </div>
          </div>
        )}

        {result.hard_stop && (
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 space-y-3">
            <p className="text-sm text-red-400">{result.hard_stop.reason}</p>
            <div className="grid grid-cols-2 gap-3">
              <button className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-3 text-left transition-colors">
                <p className="text-sm font-medium text-white">{result.hard_stop.path_a.label}</p>
                <p className="text-xs text-zinc-400 mt-1">{result.hard_stop.path_a.description}</p>
              </button>
              <button className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg p-3 text-left transition-colors">
                <p className="text-sm font-medium text-white">{result.hard_stop.path_b.label}</p>
                <p className="text-xs text-zinc-400 mt-1">{result.hard_stop.path_b.description}</p>
              </button>
            </div>
            <p className="text-xs text-zinc-500">Попыток осталось: {result.hard_stop.reruns_remaining}</p>
          </div>
        )}

        {result.nogo_exit && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
            <p className="text-sm text-zinc-400">{result.nogo_exit.reason}</p>
            <p className="text-xs text-zinc-500 font-medium mt-2">Альтернативные ниши:</p>
            {result.nogo_exit.alternative_niches.map((n, i) => (
              <div key={i} className="text-xs text-zinc-400">• {n.name} — <span className="text-zinc-500">{n.reason}</span></div>
            ))}
          </div>
        )}

        {(result.status === 'green' || result.status === 'yellow') && result.session_id && (
          <button onClick={() => onSessionCreated(result.session_id!, result)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl py-3 font-medium transition-colors">
            Начать стратегию →
          </button>
        )}

        <button onClick={() => setResult(null)} className="w-full text-zinc-500 hover:text-zinc-400 text-sm py-2 transition-colors">
          ← Изменить параметры
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-white">Параметры входа</h2>
        <p className="text-sm text-zinc-400 mt-1">Ответьте на 4 вопроса — система мгновенно оценит ваши шансы</p>
      </div>

      <div className="space-y-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <label className="text-sm text-zinc-300 block mb-2">Бюджет на проверку ниши: <span className="text-white font-medium">${budget.toLocaleString()}</span></label>
          <input type="range" min={0} max={50000} step={500} value={budget} onChange={e => setBudget(Number(e.target.value))}
            className="w-full accent-indigo-500" />
          <div className="flex justify-between text-xs text-zinc-500 mt-1"><span>$0</span><span>$50,000</span></div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <label className="text-sm text-zinc-300 block mb-2">Через сколько месяцев нужны первые признаки?</label>
          <div className="flex gap-2">
            {HORIZON_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setHorizon(o.value as any)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${horizon === o.value ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <label className="text-sm text-zinc-300 block mb-2">Вы строите один или с командой?</label>
          <div className="flex gap-2">
            {TEAM_OPTIONS.map(o => (
              <button key={o.value} onClick={() => setTeamSize(o.value as any)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${teamSize === o.value ? 'bg-indigo-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
          <label className="text-sm text-zinc-300 block">Есть ли у вас преимущество?</label>
          {[
            { label: 'Умею писать код', value: canCode, set: setCanCode },
            { label: 'Есть аудитория', value: hasAudience, set: setHasAudience },
            { label: 'Есть партнёр', value: hasPartner, set: setHasPartner },
          ].map(t => (
            <button key={t.label} onClick={() => t.set(!t.value)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${t.value ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700/50'}`}>
              <span>{t.label}</span>
              <span>{t.value ? '✓' : ''}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button onClick={submit} disabled={loading}
        className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-xl py-3 font-medium transition-colors flex items-center justify-center gap-2">
        {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {loading ? 'Анализируем...' : 'Оценить шансы'}
      </button>
    </div>
  )
}
