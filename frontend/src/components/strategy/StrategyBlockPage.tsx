'use client'

import { useCallback, useEffect, useState } from 'react'
import StrategyBlock from './StrategyBlock'
import PaywallOverlay from './PaywallOverlay'

type BlockId = 'S0' | 'S1' | 'S2' | 'S3' | 'S5'

const BLOCK_META: Record<BlockId, { title: string; cost: number; nextId: BlockId | null; nextSubTab: string | null }> = {
  S0: { title: 'Угол атаки', cost: 0, nextId: 'S1', nextSubTab: 's1' },
  S1: { title: 'Первый клиент', cost: 500, nextId: 'S2', nextSubTab: 's2' },
  S2: { title: 'Продукт v1', cost: 500, nextId: 'S3', nextSubTab: 's3' },
  S3: { title: 'Первые 10 клиентов', cost: 500, nextId: 'S5', nextSubTab: 's5' },
  S5: { title: 'Путь к деньгам', cost: 500, nextId: null, nextSubTab: 'summary' },
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
  try {
    console.log('[saveState] saving blockResults keys:', Object.keys(state.blockResults ?? {}))
    const s1 = (state.blockResults ?? {})['S1'] as { translated?: unknown; output?: unknown } | undefined
    if (s1) {
      console.log('[saveState] S1 has translated:', !!s1.translated)
      console.log('[saveState] S1 has output:', !!s1.output)
    }
    localStorage.setItem(`strategy_${trendId}`, JSON.stringify(state))
  } catch (e) {
    console.error('[saveState] failed:', e)
  }
}

interface Props {
  blockId: BlockId
  trendId: string
  nicheTitle: string
  onNavigateSubTab: (subTab: string) => void
}

export default function StrategyBlockPage({ blockId, trendId, nicheTitle, onNavigateSubTab }: Props) {
  const meta = BLOCK_META[blockId]

  const initialState = (typeof window !== 'undefined' ? loadState(trendId) : null)
  const [sessionId, setSessionId] = useState<string | null>(initialState?.sessionId ?? null)
  const [freeBlockResult, setFreeBlockResult] = useState<{ status?: string; segment?: string; preview?: { angle_hint?: string } } | null>(
    (initialState?.freeBlockResult as { status?: string; segment?: string; preview?: { angle_hint?: string } } | null) ?? null,
  )
  const [blockResults, setBlockResults] = useState<Record<string, unknown>>(initialState?.blockResults ?? {})

  const [unlockedSet, setUnlockedSet] = useState<Set<string>>(new Set())
  const [unlockedLoaded, setUnlockedLoaded] = useState(false)
  const [balance, setBalance] = useState(0)
  const [paywallClosed, setPaywallClosed] = useState(false)

  useEffect(() => {
    const st = loadState(trendId)
    if (st) {
      if (st.sessionId !== sessionId) setSessionId(st.sessionId)
      if (st.freeBlockResult) setFreeBlockResult(st.freeBlockResult as typeof freeBlockResult)
      if (st.blockResults) setBlockResults(st.blockResults)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendId])

  useEffect(() => {
    saveState(trendId, { sessionId, freeBlockResult, blockResults })
  }, [trendId, sessionId, freeBlockResult, blockResults])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [unlocksRes, balanceRes] = await Promise.all([
          fetch(`/api/strategy/unlocks?trend_id=${encodeURIComponent(trendId)}`),
          fetch('/api/credits/balance'),
        ])
        const unlocksJson = await unlocksRes.json().catch(() => ({ unlocked: [] }))
        const balanceJson = await balanceRes.json().catch(() => ({ balance: 0 }))
        if (cancelled) return
        setUnlockedSet(new Set<string>(unlocksJson.unlocked ?? []))
        setBalance(Number(balanceJson.balance ?? 0))
      } catch {
        if (!cancelled) setUnlockedSet(new Set<string>())
      } finally {
        if (!cancelled) setUnlockedLoaded(true)
      }
    }
    load()
    return () => { cancelled = true }
  }, [trendId, blockId])

  useEffect(() => {
    setPaywallClosed(false)
  }, [blockId])

  const handleBlockComplete = useCallback((result: unknown) => {
    const r = result as { translated?: unknown; output?: unknown } | null
    console.log('[handleBlockComplete] blockId:', blockId)
    console.log('[handleBlockComplete] has translated:', !!r?.translated)
    console.log('[handleBlockComplete] translated keys:', r?.translated ? Object.keys(r.translated as object) : 'null')
    console.log('[handleBlockComplete] has output:', !!r?.output)
    setBlockResults((prev) => {
      const next = { ...prev, [blockId]: result }
      saveState(trendId, { sessionId, freeBlockResult, blockResults: next })
      return next
    })
  }, [blockId, trendId, sessionId, freeBlockResult])

  const handleUnlock = useCallback(async () => {
    const res = await fetch('/api/strategy/unlock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trend_id: trendId, block_id: blockId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Не удалось разблокировать')
    setUnlockedSet((prev) => {
      const next = new Set(prev)
      next.add(blockId)
      return next
    })
    if (typeof json.new_balance === 'number') {
      setBalance(json.new_balance)
      window.dispatchEvent(new CustomEvent('credits:updated', { detail: { balance: json.new_balance } }))
    }
    setPaywallClosed(true)
  }, [blockId, trendId])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ balance?: number }>).detail
      if (detail && typeof detail.balance === 'number') setBalance(detail.balance)
    }
    window.addEventListener('credits:updated', handler)
    return () => window.removeEventListener('credits:updated', handler)
  }, [])

  const savedResult = blockResults[blockId] as { translated?: unknown; output?: unknown } | undefined
  const hasSavedResult = !!(savedResult && (savedResult.translated || savedResult.output))

  const isFree = meta.cost === 0
  const isUnlocked = isFree || unlockedSet.has(blockId) || paywallClosed || hasSavedResult

  if (!unlockedLoaded && !hasSavedResult) {
    return <div className="text-sm text-zinc-500 py-10 text-center">Загрузка...</div>
  }

  if (!sessionId) {
    return (
      <div className="text-sm text-zinc-400 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center space-y-3">
        <p>Сначала пройди «Оценку шансов» — там создаётся сессия стратегии.</p>
        <button onClick={() => onNavigateSubTab('free')} className="text-xs text-indigo-400 hover:text-indigo-300">
          ← Перейти к оценке
        </button>
      </div>
    )
  }

  if (!isUnlocked) {
    return (
      <PaywallOverlay
        blockId={blockId}
        blockName={meta.title}
        cost={meta.cost}
        userBalance={balance}
        onUnlock={handleUnlock}
        onBack={() => {
          const prevMap: Record<BlockId, string> = { S0: 's0', S1: 's0', S2: 's1', S3: 's2', S5: 's3' }
          onNavigateSubTab(prevMap[blockId])
        }}
      />
    )
  }

  return (
    <div className="space-y-4">
      {freeBlockResult && blockId === 'S0' && (
        <div className={`text-xs px-3 py-2 rounded-lg border ${
          freeBlockResult.status === 'green' ? 'bg-green-500/10 border-green-500/20 text-green-400'
          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
        }`}>
          {freeBlockResult.status === 'green' ? '🟢 Go Mode' : '🟡 Experiment Mode'} · {freeBlockResult.segment}
          {freeBlockResult.preview?.angle_hint && ` · ${freeBlockResult.preview.angle_hint}`}
        </div>
      )}

      <StrategyBlock
        blockId={blockId}
        sessionId={sessionId!}
        niche_title={nicheTitle}
        initialResult={(blockResults[blockId] as Parameters<typeof StrategyBlock>[0]['initialResult']) ?? null}
        onComplete={handleBlockComplete}
        onAdvance={meta.nextSubTab ? () => onNavigateSubTab(meta.nextSubTab!) : undefined}
      />
    </div>
  )
}
