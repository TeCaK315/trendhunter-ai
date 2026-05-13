'use client'

/**
 * TrendHunter AI — Кнопка перехода в Роадмап
 * src/components/strategy/OpenRoadmapButton.tsx
 *
 * Используется на финальном экране Стратегии.
 * При клике: POST /api/roadmap/activate → redirect /roadmap/[id]
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Props = {
  trendId: string
  strategySessionId?: string
  // Стили можно кастомизировать под финальный экран Стратегии
  className?: string
  label?: string
}

export default function OpenRoadmapButton({
  trendId,
  strategySessionId,
  className,
  label = 'Открыть мой Роадмап',
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleClick = async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/roadmap/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trendId,
          strategy_session_id: strategySessionId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Ошибка создания Роадмапа')
      }

      const data = await res.json()

      // Редирект на страницу Роадмапа
      router.push(data.redirect_to || `/roadmap/${data.roadmap_id}`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={className}
        style={!className ? {
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 24px',
          background: loading ? '#888' : '#18181A',
          color: '#fff',
          border: 'none',
          borderRadius: '10px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.15s',
          fontFamily: 'inherit',
        } : undefined}
      >
        {loading ? (
          <>
            <span style={{
              display: 'inline-block',
              animation: 'spin 0.9s linear infinite',
            }}>⟳</span>
            Создаём Роадмап...
          </>
        ) : (
          <>
            {label}
            <span>→</span>
          </>
        )}
      </button>

      {error && (
        <p style={{
          marginTop: '8px',
          fontSize: '13px',
          color: '#a32d2d',
        }}>
          {error}
        </p>
      )}
    </div>
  )
}
