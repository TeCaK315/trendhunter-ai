'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const PACKAGES = [
  {
    variantId: process.env.NEXT_PUBLIC_LS_VARIANT_5K ?? '',
    credits: 5000,
    price: '€4.99',
    label: 'Стартовый',
    description: 'Разблокировать 1 блок стратегии или роадмап',
    popular: false,
  },
  {
    variantId: process.env.NEXT_PUBLIC_LS_VARIANT_15K ?? '',
    credits: 15000,
    price: '€12.99',
    label: 'Оптимальный',
    description: 'Полный анализ ниши + стратегия + роадмап',
    popular: true,
  },
  {
    variantId: process.env.NEXT_PUBLIC_LS_VARIANT_50K ?? '',
    credits: 50000,
    price: '€34.99',
    label: 'Профессиональный',
    description: 'Несколько проектов без ограничений',
    popular: false,
  },
]

export default function CreditsPage() {
  const router = useRouter()
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => setBalance(d.balance ?? 0))
      .catch(() => setBalance(0))
  }, [])

  const handlePurchase = async (variantId: string) => {
    if (!variantId) {
      setError('Пакет временно недоступен')
      return
    }
    setLoading(variantId)
    setError(null)
    try {
      const res = await fetch('/api/payments/lemonsqueezy/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variant_id: variantId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Ошибка')
      window.location.href = data.url
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сети')
      setLoading(null)
    }
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
          Пополнить баланс
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Текущий баланс:{' '}
          <strong style={{ color: 'var(--color-text-primary)' }}>
            {balance === null ? '...' : `${balance.toLocaleString()} монет`}
          </strong>
        </p>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          color: '#f87171',
          fontSize: 14,
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {PACKAGES.map(pkg => (
          <div
            key={pkg.variantId}
            style={{
              border: pkg.popular
                ? '1.5px solid var(--blue)'
                : '1px solid var(--color-border-tertiary)',
              borderRadius: 12,
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              position: 'relative',
              background: pkg.popular
                ? 'rgba(55,138,221,0.05)'
                : 'var(--color-background-primary)',
            }}
          >
            {pkg.popular && (
              <div style={{
                position: 'absolute',
                top: -10,
                left: 20,
                background: 'var(--blue)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 10px',
                borderRadius: 20,
              }}>
                Популярный
              </div>
            )}

            <div>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                {pkg.label} — {pkg.credits.toLocaleString()} монет
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                {pkg.description}
              </div>
            </div>

            <button
              onClick={() => handlePurchase(pkg.variantId)}
              disabled={loading === pkg.variantId}
              style={{
                background: pkg.popular ? 'var(--blue)' : 'var(--color-background-secondary)',
                color: pkg.popular ? '#fff' : 'var(--color-text-primary)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 20px',
                fontWeight: 600,
                fontSize: 14,
                cursor: loading === pkg.variantId ? 'not-allowed' : 'pointer',
                opacity: loading === pkg.variantId ? 0.7 : 1,
                whiteSpace: 'nowrap',
                minWidth: 120,
              }}
            >
              {loading === pkg.variantId ? '...' : pkg.price}
            </button>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 32,
        padding: '16px 20px',
        background: 'var(--color-background-secondary)',
        borderRadius: 10,
        fontSize: 13,
        color: 'var(--color-text-secondary)',
        lineHeight: 1.6,
      }}>
        💡 Монеты используются для разблокировки блоков анализа, стратегии и роадмапа.
        Монеты не сгорают и не имеют срока действия.
      </div>
    </div>
  )
}
