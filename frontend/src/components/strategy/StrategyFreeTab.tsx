'use client'

import { useCallback, useEffect, useState } from 'react'
import StrategyFreeBlock from './StrategyFreeBlock'

interface Props {
  trendId: string
  onSessionReady: () => void
}

interface PersistedState {
  sessionId: string | null
  freeBlockResult: unknown
  blockResults: Record<string, unknown>
}

function loadState(trendId: string): PersistedState | null {
  try {
    const raw = localStorage.getItem(`strategy_${trendId}`)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function saveState(trendId: string, state: PersistedState) {
  try { localStorage.setItem(`strategy_${trendId}`, JSON.stringify(state)) } catch {}
}

export default function StrategyFreeTab({ trendId, onSessionReady }: Props) {
  const [existingSessionId, setExistingSessionId] = useState<string | null | undefined>(undefined)

  useEffect(() => {
    const st = loadState(trendId)
    setExistingSessionId(st?.sessionId ?? null)
  }, [trendId])

  const handleSessionCreated = useCallback((sid: string, response: unknown) => {
    const prev = loadState(trendId)
    saveState(trendId, {
      sessionId: sid,
      freeBlockResult: response,
      blockResults: prev?.blockResults ?? {},
    })
    onSessionReady()
  }, [trendId, onSessionReady])

  if (existingSessionId === undefined) {
    return <div className="text-sm text-zinc-500 py-10 text-center">Загрузка...</div>
  }

  if (existingSessionId) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 text-sm text-zinc-400 space-y-3">
        <p>Оценка шансов уже пройдена — сессия стратегии активна.</p>
        <button onClick={onSessionReady} className="text-xs text-indigo-400 hover:text-indigo-300">
          Перейти к S0 · Угол атаки →
        </button>
      </div>
    )
  }

  return <StrategyFreeBlock trendId={trendId} onSessionCreated={handleSessionCreated} />
}
