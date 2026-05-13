'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  status: 'trial_ending' | 'discount_window'
  discountHoursLeft?: number | null
  userBalance: number
  trendId: string
  closable?: boolean
  onSuccess: () => void
  onClose: () => void
}

const FULL_PRICE = 5000
const DISCOUNT_PRICE = 3500

const FEATURES = [
  'AI Стратег, Билдер и Директор — 3 роли',
  'Дашборд с метриками и прогрессом',
  'Actionable triggers из твоей ниши',
  'Kill switch review checkpoint',
  '90 дней поддержки до kill switch date',
]

export default function PaywallModal({
  status,
  discountHoursLeft,
  userBalance,
  trendId,
  closable = true,
  onSuccess,
  onClose,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const isDiscount = status === 'discount_window'
  const requiredAmount = isDiscount ? DISCOUNT_PRICE : FULL_PRICE
  const enough = userBalance >= requiredAmount

  const handlePurchase = async () => {
    if (!enough || loading) return
    setLoading(true)
    setErr('')
    try {
      const res = await fetch('/api/roadmap/access/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend_id: trendId, use_discount: isDiscount }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Не удалось оформить')
      if (typeof json.new_balance === 'number') {
        window.dispatchEvent(new CustomEvent('credits:updated', { detail: { balance: json.new_balance } }))
      }
      onSuccess()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
      setLoading(false)
    }
  }

  if (!mounted) return null

  const modalContent = (
    <div
      className="paywall-overlay"
      onClick={() => closable && onClose()}
    >
      <div className="strategy-partner-ui paywall-scope" onClick={(e) => e.stopPropagation()}>
        <div className="paywall-card">
          {isDiscount ? (
            <>
              <div className="trial-badge" style={{ marginBottom: 12, display: 'inline-block' }}>СКИДКА -30%</div>
              <h2 className="paywall-title">Триал закончился</h2>
              <p className="paywall-subtitle">
                Скидка действует ещё{' '}
                <strong style={{ color: '#FAC775' }}>{discountHoursLeft ?? 0} ч.</strong>
              </p>
            </>
          ) : (
            <>
              <h2 className="paywall-title">Продолжить Роадмап Pro</h2>
              <p className="paywall-subtitle">Доступ на 90 дней — до kill switch date</p>
            </>
          )}

          <div className="paywall-price-block">
            {isDiscount ? (
              <>
                <div className="paywall-price-old">{FULL_PRICE.toLocaleString('ru-RU')} монет</div>
                <div className="paywall-price-current">{DISCOUNT_PRICE.toLocaleString('ru-RU')} монет</div>
              </>
            ) : (
              <div className="paywall-price-current">{FULL_PRICE.toLocaleString('ru-RU')} монет</div>
            )}
            <div className="paywall-balance">
              Твой баланс:{' '}
              <strong style={{ color: enough ? '#5DCAA5' : '#F09595' }}>
                {userBalance.toLocaleString('ru-RU')} монет
              </strong>
            </div>
          </div>

          <div className="paywall-features">
            {FEATURES.map((f) => (
              <div className="paywall-feature-item" key={f}>
                <span style={{ color: '#5DCAA5' }}>✓</span>
                <span>{f}</span>
              </div>
            ))}
          </div>

          {err && (
            <p style={{ fontSize: 13, color: '#F09595', textAlign: 'center', marginBottom: 12 }}>{err}</p>
          )}

          {enough ? (
            <button
              className="cta-btn"
              onClick={handlePurchase}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}
              type="button"
            >
              {loading ? 'Оформляем...' : `Разблокировать за ${requiredAmount.toLocaleString('ru-RU')} монет →`}
            </button>
          ) : (
            <>
              <button
                className="cta-btn"
                disabled
                style={{ width: '100%', justifyContent: 'center', opacity: 0.4, cursor: 'not-allowed' }}
                type="button"
              >
                Недостаточно монет
              </button>
              <p style={{ textAlign: 'center', fontSize: 12, color: '#A3A3A1', marginTop: 8 }}>
                Не хватает {(requiredAmount - userBalance).toLocaleString('ru-RU')} монет. Монеты начисляются за активность на сайте.
              </p>
            </>
          )}

          {closable && (
            <button
              onClick={onClose}
              type="button"
              style={{
                display: 'block', margin: '12px auto 0', background: 'none',
                border: 'none', color: '#6E6E6B', fontSize: 12, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
