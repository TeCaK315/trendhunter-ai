'use client'

import { useState } from 'react'

const FIELDS: Array<{ name: string; label: string; step?: number }> = [
  { name: 'messages_sent', label: 'Сообщений отправлено клиентам' },
  { name: 'replies_received', label: 'Ответов получено' },
  { name: 'conversations', label: 'Разговоров проведено' },
  { name: 'paying_clients', label: 'Платящих клиентов' },
  { name: 'mrr', label: 'MRR ($)', step: 1 },
]

interface Props {
  sessionId: string
  initial: Record<string, number>
  onClose: () => void
  onSaved: () => void
}

export default function ManualMetricsModal({ sessionId, initial, onClose, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {}
    for (const f of FIELDS) out[f.name] = String(initial[f.name] ?? 0)
    return out
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setSaving(true)
    setErr('')
    try {
      for (const f of FIELDS) {
        const v = Number(values[f.name])
        if (!Number.isFinite(v)) continue
        const res = await fetch('/api/roadmap/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, metric_name: f.name, value: v, updated_via: 'manual' }),
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || `Не удалось сохранить ${f.label}`)
        }
      }
      onSaved()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(9,9,11,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 460, width: '100%', background: '#111', border: '0.5px solid rgba(255,255,255,0.1)',
          borderRadius: 16, padding: 24,
        }}
      >
        <h3 style={{ fontSize: 17, fontWeight: 500, color: '#F5F5F4', marginBottom: 4 }}>Внести метрики</h3>
        <p style={{ fontSize: 12.5, color: '#A3A3A1', marginBottom: 18 }}>Текущие значения за всю сессию</p>

        <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
          {FIELDS.map((f) => (
            <label key={f.name} style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11, color: '#6E6E6B', letterSpacing: '.05em', textTransform: 'uppercase' }}>{f.label}</span>
              <input
                type="number"
                min="0"
                step={f.step ?? 1}
                value={values[f.name]}
                onChange={(e) => setValues((p) => ({ ...p, [f.name]: e.target.value }))}
                style={{
                  background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '10px 12px', color: '#E5E5E4', fontSize: 14, outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </label>
          ))}
        </div>

        {err && <p style={{ fontSize: 13, color: '#F09595', marginBottom: 12 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
              border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#A3A3A1',
              fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Отмена
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 14px',
              background: saving ? 'rgba(93,202,165,0.2)' : 'linear-gradient(135deg,#1D9E75,#0F6E56)',
              border: 'none', borderRadius: 10, color: '#fff', fontSize: 13, fontWeight: 500,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? 'Сохраняем...' : 'Сохранить'}
          </button>
        </div>
      </div>
    </div>
  )
}
