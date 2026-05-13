import Link from 'next/link'
import fs from 'fs'
import path from 'path'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

interface ResearchEntry {
  trend_id: string
  title: string
  category?: string | null
  created_at?: string | null
  score?: number | null
  growth_rate?: number | null
  is_custom?: boolean
}

interface GlobalTrend {
  id: string
  title?: string
  category?: string
  popularity_score?: number
  growth_rate?: number
}

function loadGlobalTrends(): Map<string, GlobalTrend> {
  try {
    const filePath = path.join(process.cwd(), 'data', 'trends.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const list = (parsed.trends ?? []) as GlobalTrend[]
    const map = new Map<string, GlobalTrend>()
    for (const t of list) if (t.id) map.set(t.id, t)
    return map
  } catch {
    return new Map()
  }
}

async function loadResearch(userId: string): Promise<ResearchEntry[]> {
  const supabase = getServerSupabase()
  const trendInfoByCreated = new Map<string, string>() // trend_id → earliest created_at

  const collect = (rows: Array<{ trend_id?: string | null; created_at?: string | null }>) => {
    for (const r of rows) {
      const tid = r.trend_id
      if (!tid) continue
      const cur = trendInfoByCreated.get(tid)
      if (!cur || (r.created_at && r.created_at < cur)) {
        trendInfoByCreated.set(tid, r.created_at ?? cur ?? '')
      }
    }
  }

  try {
    const { data } = await supabase
      .from('strategy_sessions')
      .select('trend_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    collect((data ?? []) as Array<{ trend_id?: string | null; created_at?: string | null }>)
  } catch {}

  try {
    const { data } = await supabase
      .from('block_results')
      .select('trend_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    collect((data ?? []) as Array<{ trend_id?: string | null; created_at?: string | null }>)
  } catch {}

  // Также подтягиваем custom_trends (создаются из /niche-research через convert)
  const customTrendsMap = new Map<string, { title: string; category?: string | null; description?: string | null; score?: number | null; created_at?: string | null }>()
  try {
    const { data } = await supabase
      .from('custom_trends')
      .select('trend_id, title, category, description, score, created_at')
      .eq('user_id', userId)
    for (const t of (data ?? []) as Array<{ trend_id: string; title: string; category?: string | null; description?: string | null; score?: number | null; created_at?: string | null }>) {
      customTrendsMap.set(t.trend_id, t)
      if (!trendInfoByCreated.has(t.trend_id)) {
        trendInfoByCreated.set(t.trend_id, t.created_at ?? '')
      }
    }
  } catch {}

  const globalTrends = loadGlobalTrends()
  const entries: ResearchEntry[] = []
  for (const [trend_id, created_at] of trendInfoByCreated.entries()) {
    const custom = customTrendsMap.get(trend_id)
    if (custom) {
      entries.push({
        trend_id,
        title: custom.title,
        category: custom.category ?? 'Custom',
        created_at: created_at || custom.created_at || null,
        score: typeof custom.score === 'number' ? custom.score : null,
        growth_rate: null,
        is_custom: true,
      })
      continue
    }
    const meta = globalTrends.get(trend_id)
    entries.push({
      trend_id,
      title: meta?.title ?? trend_id,
      category: meta?.category ?? null,
      created_at: created_at || null,
      score: typeof meta?.popularity_score === 'number' ? Math.round(meta.popularity_score / 10) : null,
      growth_rate: typeof meta?.growth_rate === 'number' ? meta.growth_rate : null,
    })
  }

  entries.sort((a, b) => {
    const ad = a.created_at ?? ''
    const bd = b.created_at ?? ''
    return bd.localeCompare(ad)
  })

  return entries
}

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

function formatDate(s?: string | null): string {
  if (!s) return ''
  try {
    return new Date(s).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return '' }
}

function scoreColor(score: number): string {
  if (score >= 7) return '#5DCAA5'
  if (score >= 5) return '#FAC775'
  return '#F09595'
}

export default async function LKResearchPage() {
  const user = await getAuthUser()
  if (!user) {
    return (
      <div className="strategy-partner-ui">
        <div style={{ padding: 40, textAlign: 'center', color: '#A3A3A1' }}>
          Войди чтобы увидеть свои исследования.
        </div>
      </div>
    )
  }

  const trends = await loadResearch(user.id)

  return (
    <div className="strategy-partner-ui">
      <div style={{ padding: 32, maxWidth: 900, margin: '0 auto' }}>
        <section className="hero" style={{ marginBottom: 32 }}>
          <div className="hero-meta">
            <span className="meta-chip framework">Личный кабинет</span>
          </div>
          <h1 className="hero-title">Мои исследования</h1>
          <p className="hero-story">
            {trends.length} {plural(trends.length, 'ниша', 'ниши', 'ниш')} проанализировано
          </p>
        </section>

        {trends.length === 0 ? (
          <div className="honest">
            <div className="honest-body">
              Ты ещё не анализировал ниши.{' '}
              <Link href="/" style={{ color: '#5DCAA5', marginLeft: 8 }}>
                Начать исследование →
              </Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {trends.map((trend) => (
              <Link
                key={trend.trend_id}
                href={`/lk/research/${encodeURIComponent(trend.trend_id)}`}
                style={{ textDecoration: 'none' }}
              >
                <div className="niche-card">
                  <div className="niche-card-left">
                    <div className="niche-card-title">{trend.title}</div>
                    <div className="niche-card-meta">
                      {trend.is_custom && (
                        <span
                          className="meta-chip"
                          style={{
                            color: '#7F77DD',
                            background: 'rgba(127,119,221,0.1)',
                            border: '0.5px solid rgba(127,119,221,0.3)',
                          }}
                        >
                          Своя ниша
                        </span>
                      )}
                      {trend.category && <span className="meta-chip framework">{trend.category}</span>}
                      <span style={{ fontSize: 12, color: '#6E6E6B' }}>
                        {formatDate(trend.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="niche-card-right">
                    {typeof trend.score === 'number' && (
                      <div className="niche-score">
                        <span style={{ fontSize: 20, fontWeight: 600, color: scoreColor(trend.score) }}>
                          {trend.score}
                        </span>
                        <span style={{ fontSize: 11, color: '#6E6E6B' }}>/10</span>
                      </div>
                    )}
                    {typeof trend.growth_rate === 'number' && (
                      <div style={{ fontSize: 12, color: '#5DCAA5', marginTop: 4 }}>
                        +{trend.growth_rate}% рост
                      </div>
                    )}
                    <div style={{ color: '#5DCAA5', fontSize: 18, marginTop: 8 }}>→</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
