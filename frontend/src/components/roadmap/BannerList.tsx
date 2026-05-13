'use client'

interface Banner {
  id: string
  banner_type: string
  content: string
  created_at?: string
}

interface Props {
  banners: Banner[]
  onDismiss: (id: string) => void
}

const BANNER_ICONS: Record<string, string> = {
  kill_switch_30: '⏳',
  kill_switch_14: '⚠️',
  kill_switch_7: '🔴',
  new_trigger: '💡',
  milestone_30: '🎯',
  milestone_90: '🏁',
  proactive_return: '👋',
  weekly_summary: '📊',
  trial_welcome: '🚀',
}

function bannerBackground(type: string): string {
  if (type.startsWith('kill_switch')) return 'rgba(240,149,149,0.08)'
  if (type === 'new_trigger') return 'rgba(93,202,165,0.08)'
  if (type.startsWith('milestone')) return 'rgba(55,138,221,0.08)'
  return 'rgba(250,199,117,0.08)'
}

function bannerBorder(type: string): string {
  if (type.startsWith('kill_switch')) return 'rgba(240,149,149,0.25)'
  if (type === 'new_trigger') return 'rgba(93,202,165,0.25)'
  if (type.startsWith('milestone')) return 'rgba(55,138,221,0.25)'
  return 'rgba(250,199,117,0.25)'
}

export default function BannerList({ banners, onDismiss }: Props) {
  if (!banners || banners.length === 0) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {banners.map((banner) => (
        <div
          key={banner.id}
          className="roadmap-trial-banner"
          style={{
            background: bannerBackground(banner.banner_type),
            borderColor: bannerBorder(banner.banner_type),
          }}
        >
          <span style={{ fontSize: 16 }}>{BANNER_ICONS[banner.banner_type] ?? '📌'}</span>
          <span style={{ flex: 1, fontSize: 13.5 }}>{banner.content}</span>
          <button
            onClick={() => onDismiss(banner.id)}
            style={{
              background: 'none', border: 'none', color: '#6E6E6B',
              cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
              fontFamily: 'inherit',
            }}
            type="button"
            aria-label="dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
