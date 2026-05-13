import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import { notFound } from 'next/navigation'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'
import RoadmapTrialCard from '@/components/lk/RoadmapTrialCard'

interface SavedTrend {
  trend_id: string
  title: string
  category?: string | null
  score?: number | null
  created_at?: string | null
}

interface GlobalTrend {
  id: string
  title?: string
  category?: string
  popularity_score?: number
}

function loadGlobalTrend(trendId: string): GlobalTrend | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'trends.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const list = (parsed.trends ?? []) as GlobalTrend[]
    return list.find((t) => t.id === trendId) ?? null
  } catch {
    return null
  }
}

interface StrategyRow {
  id: string
  status?: string | null
  context?: { segment?: string; strategy_mode?: string } | null
  created_at?: string | null
  kill_switch_date?: string | null
}

interface RoadmapAccessRow {
  id: string
  status: string
  trial_expires_at: string | null
  discount_window_until: string | null
  paid_until: string | null
}

type SectionStatus = 'completed' | 'in_progress' | 'trial' | 'available' | 'not_started' | 'expired' | 'locked'

const STATUS_STYLES: Record<SectionStatus, { color: string; bg: string }> = {
  completed: { color: '#5DCAA5', bg: 'rgba(93,202,165,0.1)' },
  in_progress: { color: '#FAC775', bg: 'rgba(250,199,117,0.1)' },
  trial: { color: '#378ADD', bg: 'rgba(55,138,221,0.1)' },
  available: { color: '#5DCAA5', bg: 'rgba(93,202,165,0.1)' },
  not_started: { color: '#6E6E6B', bg: 'rgba(255,255,255,0.05)' },
  expired: { color: '#F09595', bg: 'rgba(240,149,149,0.1)' },
  locked: { color: '#6E6E6B', bg: 'rgba(255,255,255,0.03)' },
}

function formatDate(s?: string | null): string {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '' }
}

function SectionCard({
  label, blockId, status, statusText, description, cta, href,
}: {
  label: string
  blockId: string
  status: SectionStatus
  statusText: string
  description: string
  cta: string | null
  href: string | null
}) {
  const s = STATUS_STYLES[status]
  return (
    <div className="section-card" style={{ opacity: status === 'locked' ? 0.6 : 1 }}>
      <div className="section-card-header">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="summary-card-id">{blockId}</span>
          <span style={{ fontSize: 16, fontWeight: 500, color: '#F5F5F4' }}>{label}</span>
        </div>
        <span
          style={{
            fontSize: 11, fontWeight: 500, color: s.color, background: s.bg,
            padding: '3px 10px', borderRadius: 20, letterSpacing: '.06em',
          }}
        >
          {statusText}
        </span>
      </div>
      <p style={{ fontSize: 13.5, color: '#A3A3A1', margin: '10px 0 16px', lineHeight: 1.5 }}>{description}</p>
      {cta && href && (
        <Link href={href} style={{ textDecoration: 'none' }}>
          <button className="trial-upgrade-btn" type="button" style={{ fontSize: 13, padding: '8px 16px' }}>
            {cta} →
          </button>
        </Link>
      )}
    </div>
  )
}

export default async function NicheDetailPage({
  params,
}: {
  params: Promise<{ trend_id: string }>
}) {
  const { trend_id } = await params
  const user = await getAuthUser()
  if (!user) {
    return (
      <div className="strategy-partner-ui">
        <div style={{ padding: 40, textAlign: 'center', color: '#A3A3A1' }}>
          Войди чтобы увидеть нишу.
        </div>
      </div>
    )
  }

  const supabase = getServerSupabase()

  // Проверяем что пользователь работал с этим trend_id (Strategy или Block_results)
  let userTouchedTrend = false
  let earliestCreatedAt: string | null = null
  try {
    const { data } = await supabase
      .from('strategy_sessions')
      .select('trend_id, created_at')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
    if (data && data.length > 0) {
      userTouchedTrend = true
      earliestCreatedAt = (data[0].created_at as string) ?? null
    }
  } catch {}
  if (!userTouchedTrend) {
    try {
      const { data } = await supabase
        .from('block_results')
        .select('trend_id, created_at')
        .eq('trend_id', trend_id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
      if (data && data.length > 0) {
        userTouchedTrend = true
        earliestCreatedAt = (data[0].created_at as string) ?? null
      }
    } catch {}
  }

  if (!userTouchedTrend) notFound()

  // Meta из глобального списка, с fallback на custom_trends
  const meta = loadGlobalTrend(trend_id)
  let customTitle: string | null = null
  let customCategory: string | null = null
  let customScore: number | null = null
  if (!meta) {
    try {
      const { data } = await supabase
        .from('custom_trends')
        .select('title, category, score')
        .eq('trend_id', trend_id)
        .maybeSingle()
      if (data) {
        customTitle = (data.title as string) ?? null
        customCategory = (data.category as string) ?? 'Custom'
        customScore = typeof data.score === 'number' ? data.score : null
      }
    } catch {}
  }
  const trend: SavedTrend = {
    trend_id,
    title: meta?.title ?? customTitle ?? trend_id,
    category: meta?.category ?? customCategory,
    score: typeof meta?.popularity_score === 'number' ? Math.round(meta.popularity_score / 10) : customScore,
    created_at: earliestCreatedAt,
  }

  // Strategy
  let strategy: StrategyRow | null = null
  try {
    const { data } = await supabase
      .from('strategy_sessions')
      .select('id, status, context, created_at, kill_switch_date')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    strategy = (data as StrategyRow) ?? null
  } catch {}

  // Roadmap access
  let roadmapAccess: RoadmapAccessRow | null = null
  try {
    const { data } = await supabase
      .from('roadmap_access')
      .select('id, status, trial_expires_at, discount_window_until, paid_until')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .maybeSingle()
    roadmapAccess = (data as RoadmapAccessRow) ?? null
  } catch {}

  // Strategy blocks count
  let strategyBlocksCount = 0
  if (strategy) {
    try {
      const { count } = await supabase
        .from('block_decisions')
        .select('id', { count: 'exact', head: true })
        .eq('session_id', strategy.id)
      strategyBlocksCount = count ?? 0
    } catch {}
  }

  return (
    <div className="strategy-partner-ui">
      <div style={{ padding: 32, maxWidth: 800, margin: '0 auto' }}>
        <Link
          href="/lk/research"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#6E6E6B', textDecoration: 'none', marginBottom: 24,
          }}
        >
          ← Все исследования
        </Link>

        <section className="hero" style={{ marginBottom: 32 }}>
          <div className="hero-meta">
            {trend.category && <span className="meta-chip framework">{trend.category}</span>}
            {typeof trend.score === 'number' && <span className="meta-chip niche">{trend.score}/10</span>}
          </div>
          <h1 className="hero-title">{trend.title}</h1>
          <p className="hero-story">Исследование от {formatDate(trend.created_at)}</p>
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <SectionCard
            label="Исследование"
            blockId="RES"
            status="completed"
            statusText="Завершено"
            description="6 блоков анализа + AI синтез"
            cta="Открыть исследование"
            href={`/trends/${encodeURIComponent(trend_id)}`}
          />

          {strategy ? (
            <SectionCard
              label="Стратегия"
              blockId="STR"
              status={strategyBlocksCount >= 5 ? 'completed' : 'in_progress'}
              statusText={
                strategyBlocksCount >= 5
                  ? `Завершена · ${strategyBlocksCount}/5 блоков`
                  : `В процессе · ${strategyBlocksCount}/5 блоков`
              }
              description={
                strategy.context?.segment
                  ? `Сегмент: ${strategy.context.segment}${strategy.context.strategy_mode ? ` · ${strategy.context.strategy_mode}` : ''}`
                  : 'Анализ стратегии входа в нишу'
              }
              cta="Открыть стратегию"
              href={`/trends/${encodeURIComponent(trend_id)}?tab=action-plan&subtab=s0`}
            />
          ) : (
            <SectionCard
              label="Стратегия"
              blockId="STR"
              status="not_started"
              statusText="Не начата"
              description="5 блоков: угол атаки, клиент, продукт, канал, деньги"
              cta="Начать стратегию"
              href={`/trends/${encodeURIComponent(trend_id)}?tab=action-plan&subtab=free`}
            />
          )}

          {roadmapAccess ? (
            <SectionCard
              label="Роадмап Pro"
              blockId="MAP"
              status={
                roadmapAccess.status === 'paid'
                  ? 'completed'
                  : roadmapAccess.status === 'trial'
                    ? 'trial'
                    : 'expired'
              }
              statusText={
                roadmapAccess.status === 'paid'
                  ? `Активен · до ${formatDate(roadmapAccess.paid_until)}`
                  : roadmapAccess.status === 'trial'
                    ? `Trial · до ${formatDate(roadmapAccess.trial_expires_at)}`
                    : 'Истёк'
              }
              description="AI-помощник на 90 дней · дашборд + чат"
              cta="Открыть роадмап"
              href={`/lk/roadmap?trend_id=${encodeURIComponent(trend_id)}`}
            />
          ) : strategy && strategyBlocksCount >= 5 ? (
            <RoadmapTrialCard trendId={trend_id} strategySessionId={strategy.id} />
          ) : (
            <SectionCard
              label="Роадмап Pro"
              blockId="MAP"
              status="locked"
              statusText="Заблокирован"
              description="Завершите Стратегию чтобы открыть"
              cta={null}
              href={null}
            />
          )}
        </div>
      </div>
    </div>
  )
}
