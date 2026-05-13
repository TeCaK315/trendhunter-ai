import type { ReactNode } from 'react'
import type {
  TranslatedWhatYouDo,
  TranslatedNumberRow,
  TranslatedAgentCard,
} from '@/types/strategy-translated'
import BlockProgress from './BlockProgress'

export function TopNav({ blockId, blockName, current, total }: {
  blockId: string
  blockName: string
  current: number
  total: number
}) {
  return (
    <header className="topnav">
      <div className="nav-left">
        <div className="brand">
          <div className="brand-mark">TH</div>
          <span>TrendHunter AI</span>
        </div>
        <div className="nav-separator" />
        <div className="block-location">
          <span className="block-id">{blockId}</span>
          <span className="block-name">{blockName}</span>
        </div>
      </div>
      <div className="nav-right">
        <BlockProgress current={current} total={total} />
      </div>
    </header>
  )
}

export function Hero({ framework, niche, title, story }: {
  framework: string
  niche: string
  title: string
  story: string
}) {
  return (
    <section className="hero visible">
      <div className="hero-meta">
        <span className="meta-chip framework">{framework}</span>
        <span className="meta-chip niche">{niche}</span>
      </div>
      <h1 className="hero-title">{title}</h1>
      <p className="hero-story">{story}</p>
    </section>
  )
}

export function Section({ label, dot = '', children }: {
  label: string
  dot?: '' | 'mid' | 'warn' | 'purple'
  children: ReactNode
}) {
  return (
    <section className="section visible">
      <div className="s-label">
        <span className={`s-dot ${dot}`} />
        <span>{label}</span>
        <span className="s-label-bar" />
      </div>
      {children}
    </section>
  )
}

export function WhatYouDoBlock({ head, sub, data }: {
  head: string
  sub?: string
  data: TranslatedWhatYouDo
}) {
  return (
    <div className="action">
      <div className="action-head">{head}</div>
      {sub && <div className="action-sub">{sub}</div>}
      <div className="action-grid">
        <ActionItem kind="do" icon="1" label="Твоя задача" text={data.action} />
        <ActionItem kind="goal" icon="2" label="Что получить" text={data.goal} />
        <ActionItem kind="check" icon="3" label="Как поймёшь что работает" text={data.success_criterion} />
        <ActionItem kind="fallback" icon="4" label="Если не работает" text={data.fallback_if_not} />
      </div>
    </div>
  )
}

export function ActionItem({ kind, icon, label, text, children }: {
  kind: 'do' | 'goal' | 'check' | 'fallback'
  icon: string
  label: string
  text?: string
  children?: ReactNode
}) {
  return (
    <div className={`action-item ${kind}`}>
      <div className="action-icon">{icon}</div>
      <div className="action-content">
        <div className="action-label">{label}</div>
        <div className="action-text">{text}{children}</div>
      </div>
    </div>
  )
}

export function NumbersBlock({ head, sub, rows }: {
  head: string
  sub?: string
  rows: TranslatedNumberRow[]
}) {
  return (
    <div className="numbers">
      <div className="numbers-head">{head}</div>
      {sub && <div className="numbers-sub">{sub}</div>}
      <div className="numbers-grid">
        {rows.map((row, i) => (
          <div key={i} className="num-row">
            <div className="num-metric">{row.metric_name}</div>
            <div className="num-translation">{row.human_translation}</div>
            <div className="num-compare">{row.comparison}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentCard({ data }: { data: TranslatedAgentCard }) {
  return (
    <div className="agent">
      <div className="agent-head">
        <div className="agent-avatar">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 3v18M3 12h18" opacity="0.4" />
            <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.3" />
          </svg>
        </div>
        <div className="agent-info">
          <div className="agent-role">{data.role}</div>
          <div className="agent-name">{data.role}</div>
          <div className="agent-replaces">{data.replaces_job}</div>
        </div>
      </div>
      <div className="agent-body">{data.what_for_niche}</div>
      <div className="agent-saves">
        <div className="agent-saves-icon">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8" cy="8" r="6.5" />
            <path d="M8 4.5v3.5l2.5 1.5" strokeLinecap="round" />
          </svg>
        </div>
        <div className="agent-saves-text">{data.hours_saved}</div>
      </div>
      <div className="agent-status">
        <span className="status-dot" />
        <span>Готов к работе — <strong>активируется в Роадмапе</strong></span>
      </div>
    </div>
  )
}

export function HonestBlock({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="honest">
      <div className="honest-head">
        <div className="honest-icon">!</div>
        <div className="honest-title">{title}</div>
      </div>
      <div className="honest-body">{body}</div>
    </div>
  )
}

export function BridgeBlock({ label, nextTitle, body }: {
  label: string
  nextTitle: string
  body: string
}) {
  return (
    <div className="bridge">
      <div className="bridge-head">
        <div className="bridge-arrow">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9h12M10 4l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="bridge-label-wrap">
          <div className="bridge-label">{label}</div>
          <div className="bridge-next-title">{nextTitle}</div>
        </div>
      </div>
      <div className="bridge-body">{body}</div>
    </div>
  )
}

export function CtaButton({ helper, text, meta, onClick }: {
  helper: string
  text: string
  meta?: string[]
  onClick: () => void
}) {
  return (
    <div className="cta-wrap">
      <div className="cta-helper">{helper}</div>
      <button type="button" className="cta-btn" onClick={onClick}>
        {text}
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {meta && meta.length > 0 && (
        <div className="cta-meta">
          {meta.map((m, i) => (
            <span key={i} style={{ display: 'contents' }}>
              <span>{m}</span>
              {i < meta.length - 1 && <span className="cta-meta-dot" />}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
