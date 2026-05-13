'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import AILeverageCard from './AILeverageCard'
import type { TranslatedBlockOutput } from '@/types/strategy-translated'
import S0Block from './blocks/S0Block'
import S1Block from './blocks/S1Block'
import S2Block from './blocks/S2Block'
import S3Block from './blocks/S3Block'
import S5Block from './blocks/S5Block'

type BlockStep = 'idle' | 'init' | 'generating' | 'validating' | 'repairing' | 'saving' | 'interpreting' | 'ai_leverage' | 'complete' | 'error'

const STEP_LABELS: Record<string, string> = {
  init: 'Инициализация...',
  generating: 'Генерация стратегии...',
  validating: 'Проверка качества...',
  repairing: 'Улучшение ответа...',
  saving: 'Сохранение...',
  interpreting: 'Интерпретация...',
  ai_leverage: 'Подбор AI инструментов...',
}

const BLOCK_TITLES: Record<string, { title: string; description: string }> = {
  S0: { title: 'Угол атаки', description: 'Как войти в нишу умнее конкурентов' },
  S1: { title: 'Первый клиент', description: 'Кто заплатит первым и почему' },
  S2: { title: 'Продукт v1', description: 'Что строить в первой версии' },
  S3: { title: 'Первые 10 клиентов', description: 'Через какой канал и с каким скриптом' },
  S5: { title: 'Путь к деньгам', description: 'Таймлайн и метрики до первой выручки' },
}

interface Interpretation {
  headline: string; main_insight: string; key_facts: string[]; decision_impact: string; ai_leverage_hint: string
}

interface BlockResult {
  block_id: string
  output: Record<string, unknown>
  interpretation: Interpretation
  ai_leverage: { cards: any[] } | null
  is_degraded: boolean
  translated?: TranslatedBlockOutput | null
}

interface Props {
  blockId: string
  sessionId: string
  locked?: boolean
  niche_title: string
  initialResult?: BlockResult | null
  onComplete: (result: BlockResult) => void
  onAdvance?: () => void
}

function parseSSE(chunk: string): { event: string; data: any }[] {
  const events: { event: string; data: any }[] = []
  const parts = chunk.split('\n\n')
  for (const part of parts) {
    const lines = part.trim().split('\n')
    let event = ''; let data = ''
    for (const line of lines) {
      if (line.startsWith('event: ')) event = line.slice(7)
      if (line.startsWith('data: ')) data = line.slice(6)
    }
    if (event && data) {
      try { events.push({ event, data: JSON.parse(data) }) } catch {}
    }
  }
  return events
}

export default function StrategyBlock({ blockId, sessionId, locked = false, niche_title, initialResult = null, onComplete, onAdvance }: Props) {
  const [step, setStep] = useState<BlockStep>(initialResult ? 'complete' : 'idle')
  const [result, setResult] = useState<BlockResult | null>(initialResult)
  const [translated, setTranslated] = useState<TranslatedBlockOutput | null>(initialResult?.translated ?? null)
  const [errorMsg, setErrorMsg] = useState('')
  const blockRef = useRef<HTMLDivElement>(null)
  const meta = BLOCK_TITLES[blockId] || { title: blockId, description: '' }

  useEffect(() => {
    if (step === 'complete' || step === 'init') {
      blockRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [step])

  const run = useCallback(async () => {
    setStep('init')
    setErrorMsg('')
    try {
      const response = await fetch(`/api/strategy/${blockId.toLowerCase()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      if (!response.body) { setErrorMsg('Нет ответа от сервера'); setStep('error'); return }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = parseSSE(buffer)
        buffer = ''

        for (const ev of events) {
          if (ev.event === 'status') {
            setStep(ev.data.step as BlockStep)
          } else if (ev.event === 'result') {
            setResult(ev.data as BlockResult)
            setTranslated((ev.data?.translated ?? null) as TranslatedBlockOutput | null)
            setStep('complete')
            onComplete(ev.data as BlockResult)
          } else if (ev.event === 'error') {
            setErrorMsg(ev.data.message || ev.data.code || 'Ошибка')
            setStep('error')
          }
        }
      }
    } catch (e) {
      setErrorMsg((e as Error).message)
      setStep('error')
    }
  }, [blockId, sessionId, onComplete])

  const isWorking = !['idle', 'complete', 'error'].includes(step)
  const progressSteps = ['init', 'generating', 'validating', 'saving', 'interpreting', 'ai_leverage']
  const progressIndex = progressSteps.indexOf(step)
  const progressPct = isWorking ? Math.max(5, ((progressIndex + 1) / progressSteps.length) * 100) : 0

  return (
    <div ref={blockRef} className="bg-zinc-900/30 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${step === 'complete' ? 'bg-green-500' : step === 'error' ? 'bg-red-500' : isWorking ? 'bg-amber-500 animate-pulse' : 'bg-zinc-600'}`} />
            <h3 className="text-base font-bold text-white">{meta.title}</h3>
          </div>
          {step === 'complete' && <span className="text-xs text-green-400">✓ Готово</span>}
          {result?.is_degraded && <span className="text-xs text-amber-400">⚠ Ограниченное качество</span>}
        </div>
        <p className="text-sm text-zinc-500 ml-4">{meta.description}</p>
      </div>

      {isWorking && (
        <div className="px-5 pb-4 space-y-2">
          <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-500 h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-xs text-zinc-400">{STEP_LABELS[step] || step}</p>
        </div>
      )}

      {step === 'idle' && !locked && (
        <div className="px-5 pb-5">
          <button onClick={run} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
            Начать анализ
          </button>
        </div>
      )}

      {step === 'idle' && locked && (
        <div className="px-5 pb-5">
          <div className="w-full bg-zinc-800 text-zinc-500 rounded-lg py-2.5 text-sm text-center">
            Завершите предыдущий блок
          </div>
        </div>
      )}

      {step === 'error' && (
        <div className="px-5 pb-5 space-y-2">
          <p className="text-sm text-red-400">{errorMsg}</p>
          <button onClick={run} className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-4 py-2 text-sm transition-colors">
            Попробовать снова
          </button>
        </div>
      )}

      {step === 'complete' && result && translated && (
        <div className="border-t border-zinc-800">
          {blockId === 'S0' && <S0Block translated={translated} niche_title={niche_title} onNext={onAdvance ?? (() => {})} />}
          {blockId === 'S1' && <S1Block translated={translated} niche_title={niche_title} onNext={onAdvance ?? (() => {})} />}
          {blockId === 'S2' && <S2Block translated={translated} niche_title={niche_title} onNext={onAdvance ?? (() => {})} />}
          {blockId === 'S3' && <S3Block translated={translated} niche_title={niche_title} onNext={onAdvance ?? (() => {})} />}
          {blockId === 'S5' && <S5Block translated={translated} niche_title={niche_title} onNext={onAdvance ?? (() => {})} />}
        </div>
      )}

      {step === 'complete' && result && !translated && (
        <div className="border-t border-zinc-800 p-5 space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">{result.interpretation.headline}</h4>
            <p className="text-sm text-zinc-400">{result.interpretation.main_insight}</p>
          </div>

          {result.interpretation.key_facts.length > 0 && (
            <div className="space-y-1">
              {result.interpretation.key_facts.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span className="text-zinc-300">{f}</span>
                </div>
              ))}
            </div>
          )}

          {result.interpretation.decision_impact && (
            <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-3">
              <p className="text-sm text-indigo-300">{result.interpretation.decision_impact}</p>
            </div>
          )}

          {result.ai_leverage && result.ai_leverage.cards.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 font-medium">⚡ AI инструменты для этого шага</p>
              <div className="grid gap-2">
                {result.ai_leverage.cards.map((card: any, i: number) => (
                  <AILeverageCard key={i} card={card} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
