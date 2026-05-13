'use client'

import { useState } from 'react'

interface PaywallOverlayProps {
  blockName: string
  blockId: string
  cost: number
  userBalance: number
  onUnlock: () => void
  onBack: () => void
}

export default function PaywallOverlay({ blockName, blockId, cost, userBalance, onUnlock, onBack }: PaywallOverlayProps) {
  const [processing, setProcessing] = useState(false)
  const [err, setErr] = useState('')
  const enough = userBalance >= cost

  const handleClick = async () => {
    if (!enough || processing) return
    setProcessing(true)
    setErr('')
    try {
      await onUnlock()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка разблокировки')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="relative">
      <div className="absolute inset-0 z-10 flex items-center justify-center p-6" style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(9,9,11,0.55)' }}>
        <div className="max-w-md w-full bg-zinc-900/90 border border-zinc-700 rounded-2xl p-7 shadow-2xl space-y-5">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-mono tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-md px-2.5 py-1">
              <span>🔒</span>
              <span>{blockId}</span>
            </div>
            <h3 className="text-xl font-semibold text-white">{blockName}</h3>
            <p className="text-sm text-zinc-400">
              Следующий блок стратегии. Оплати разблокировку и запусти генерацию.
            </p>
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-zinc-950/60 border border-zinc-800 rounded-lg">
            <span className="text-sm text-zinc-400">Стоимость</span>
            <span className="text-base font-semibold text-emerald-400">{cost} монет</span>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-950/40 border border-zinc-800/70 rounded-lg">
            <span className="text-xs text-zinc-500">Твой баланс</span>
            <span className={`text-sm font-medium ${enough ? 'text-zinc-200' : 'text-amber-400'}`}>{userBalance} монет</span>
          </div>

          {err && <p className="text-sm text-red-400 text-center">{err}</p>}

          <button
            onClick={handleClick}
            disabled={!enough || processing}
            className={`w-full py-3 rounded-xl text-sm font-medium transition-all ${
              enough && !processing
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            {processing ? 'Списание...' : enough ? `Разблокировать за ${cost} монет` : 'Недостаточно монет'}
          </button>

          <button
            onClick={onBack}
            className="w-full text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            ← Назад к предыдущему блоку
          </button>
        </div>
      </div>

      <div className="pointer-events-none select-none opacity-40 filter blur-sm">
        <div className="h-96 rounded-xl bg-gradient-to-br from-zinc-900/60 to-zinc-950/80 border border-zinc-800" />
      </div>
    </div>
  )
}
