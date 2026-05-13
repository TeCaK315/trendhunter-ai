'use client'

import { useState, useCallback, useEffect } from 'react'
import StrategyFreeBlock from './StrategyFreeBlock'
import StrategyBlock from './StrategyBlock'

const BLOCKS = ['S0', 'S1', 'S2', 'S3', 'S5'] as const

interface Props {
  trendId: string
  nicheTitle?: string
}

interface PersistedState {
  sessionId: string | null
  freeBlockResult: any
  completedBlocks: string[]
  blockResults: Record<string, any>
  phase: 'free-block' | 'blocks' | 'final'
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

export default function StrategyFlow({ trendId, nicheTitle = '' }: Props) {
  const saved = loadState(trendId)

  const [sessionId, setSessionId] = useState<string | null>(saved?.sessionId ?? null)
  const [freeBlockResult, setFreeBlockResult] = useState<any>(saved?.freeBlockResult ?? null)
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set(saved?.completedBlocks ?? []))
  const [blockResults, setBlockResults] = useState<Record<string, any>>(saved?.blockResults ?? {})
  const [phase, setPhase] = useState<'free-block' | 'blocks' | 'final'>(saved?.phase ?? 'free-block')

  useEffect(() => {
    saveState(trendId, {
      sessionId, freeBlockResult,
      completedBlocks: Array.from(completedBlocks),
      blockResults, phase,
    })
  }, [trendId, sessionId, freeBlockResult, completedBlocks, blockResults, phase])

  const handleSessionCreated = useCallback((sid: string, response: any) => {
    setSessionId(sid)
    setFreeBlockResult(response)
    if (response.status === 'green' || response.status === 'yellow') {
      setPhase('blocks')
    }
  }, [])

  const handleBlockComplete = useCallback((blockId: string, result: any) => {
    setCompletedBlocks(prev => {
      const next = new Set(prev)
      next.add(blockId)
      return next
    })
    setBlockResults(prev => ({ ...prev, [blockId]: result }))
  }, [])

  const handleReset = useCallback(() => {
    setSessionId(null)
    setFreeBlockResult(null)
    setCompletedBlocks(new Set())
    setBlockResults({})
    setPhase('free-block')
    try { localStorage.removeItem(`strategy_${trendId}`) } catch {}
  }, [trendId])

  const currentBlockIndex = BLOCKS.findIndex(b => !completedBlocks.has(b))

  return (
    <div className="space-y-6">
      {phase !== 'free-block' && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            <StepDot label="Оценка" done active={false} status={freeBlockResult?.status} />
            {BLOCKS.map((b, i) => (
              <StepDot key={b} label={b} done={completedBlocks.has(b)} active={i === currentBlockIndex && phase === 'blocks'} />
            ))}
            <StepDot label="Итог" done={phase === 'final'} active={phase === 'final'} />
          </div>
          <button onClick={handleReset} className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors shrink-0 ml-3">
            Сбросить
          </button>
        </div>
      )}

      {phase === 'free-block' && (
        <StrategyFreeBlock trendId={trendId} onSessionCreated={handleSessionCreated} />
      )}

      {phase === 'blocks' && sessionId && (
        <div className="space-y-4">
          {freeBlockResult && (
            <div className={`text-xs px-3 py-2 rounded-lg border ${
              freeBlockResult.status === 'green' ? 'bg-green-500/10 border-green-500/20 text-green-400'
              : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              {freeBlockResult.status === 'green' ? '🟢 Go Mode' : '🟡 Experiment Mode'} · {freeBlockResult.segment}
              {freeBlockResult.preview?.angle_hint && ` · ${freeBlockResult.preview.angle_hint}`}
            </div>
          )}

          {BLOCKS.map((blockId, index) => (
            <StrategyBlock
              key={blockId}
              blockId={blockId}
              sessionId={sessionId}
              niche_title={nicheTitle}
              locked={index > 0 && !completedBlocks.has(BLOCKS[index - 1])}
              initialResult={blockResults[blockId] ?? null}
              onComplete={(result) => handleBlockComplete(blockId, result)}
            />
          ))}

          {completedBlocks.has('S5') && (
            <button onClick={() => setPhase('final')}
              className="w-full bg-green-600 hover:bg-green-500 text-white rounded-xl py-3 font-medium transition-colors">
              Готово — перейти к итогу →
            </button>
          )}
        </div>
      )}

      {phase === 'final' && (
        <div className="bg-zinc-900/50 border border-green-500/20 rounded-xl p-6 text-center space-y-3">
          <div className="text-3xl">🎯</div>
          <h3 className="text-lg font-bold text-white">Стратегия сформирована</h3>
          <p className="text-sm text-zinc-400">
            Все 5 блоков завершены. Ваша персональная стратегия входа в нишу готова.
          </p>
          <button onClick={() => setPhase('blocks')} className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Вернуться к блокам
          </button>
        </div>
      )}
    </div>
  )
}

function StepDot({ label, done, active, status }: { label: string; done: boolean; active?: boolean; status?: string }) {
  const dotColor = done
    ? status === 'yellow' ? 'bg-amber-500' : 'bg-green-500'
    : active ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-700'

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span className={`text-xs ${done ? 'text-zinc-300' : active ? 'text-white font-medium' : 'text-zinc-600'}`}>{label}</span>
      <div className="w-3 h-px bg-zinc-800 last:hidden" />
    </div>
  )
}
