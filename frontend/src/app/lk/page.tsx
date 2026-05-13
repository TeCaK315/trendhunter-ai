import fs from 'fs'
import path from 'path'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'
import CardCTA from '@/components/lk/CardCTA'
import Link from 'next/link'

interface GlobalTrend { id: string; title?: string }
type SupaClient = ReturnType<typeof getServerSupabase>

function lookupTrendTitleSync(trendId: string): string | null {
  try {
    const filePath = path.join(process.cwd(), 'data', 'trends.json')
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    const list = (parsed.trends ?? []) as GlobalTrend[]
    const found = list.find((t) => t.id === trendId)
    return found?.title ?? null
  } catch { return null }
}

async function lookupTrendTitle(trendId: string, supabase: SupaClient): Promise<string> {
  const fromFile = lookupTrendTitleSync(trendId)
  if (fromFile) return fromFile
  try {
    const { data } = await supabase
      .from('custom_trends')
      .select('title')
      .eq('trend_id', trendId)
      .maybeSingle()
    if (data?.title) return data.title as string
  } catch {}
  return trendId
}

interface ActiveRoadmap {
  trend_id: string
  trend_title: string
  paid_until: string | null
  status: string
}

interface RecentStrategy {
  id: string
  trend_id: string
  trend_title: string
}

interface RecentResearch {
  id: string
  trend_id: string
  title: string
}

async function loadDashboardData(userId: string) {
  const supabase = getServerSupabase()
  const out: {
    activeRoadmap: ActiveRoadmap | null
    latestStrategy: RecentStrategy | null
    latestResearch: RecentResearch | null
  } = { activeRoadmap: null, latestStrategy: null, latestResearch: null }

  // Active roadmap (table may not exist yet)
  try {
    const { data } = await supabase
      .from('roadmap_access')
      .select('trend_id, paid_until, status')
      .eq('user_id', userId)
      .in('status', ['trial', 'paid'])
      .order('paid_until', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      out.activeRoadmap = {
        trend_id: data.trend_id as string,
        trend_title: await lookupTrendTitle(data.trend_id as string, supabase),
        paid_until: data.paid_until as string | null,
        status: data.status as string,
      }
    }
  } catch {
    /* table not created — fine */
  }

  // Latest strategy
  try {
    const { data } = await supabase
      .from('strategy_sessions')
      .select('id, trend_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      out.latestStrategy = {
        id: data.id as string,
        trend_id: data.trend_id as string,
        trend_title: await lookupTrendTitle(data.trend_id as string, supabase),
      }
    }
  } catch {}

  // Latest research — берём из block_results (Evidence-блоки),
  // т.к. таблицы saved_trends нет
  try {
    const { data } = await supabase
      .from('block_results')
      .select('trend_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      out.latestResearch = {
        id: data.trend_id as string,
        trend_id: data.trend_id as string,
        title: await lookupTrendTitle(data.trend_id as string, supabase),
      }
    }
  } catch {}

  return out
}

export default async function LKHomePage() {
  const user = await getAuthUser()

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <CardCTA
          title="Войди чтобы открыть ЛК"
          subtitle="Здесь хранятся твои исследования, стратегии и роадмапы"
          cta="Войти"
          href="/api/auth/signin"
        />
      </div>
    )
  }

  const { activeRoadmap, latestStrategy, latestResearch } = await loadDashboardData(user.id)

  let card: React.ReactNode

  if (activeRoadmap) {
    const daysLeft = activeRoadmap.paid_until
      ? Math.max(0, Math.ceil((new Date(activeRoadmap.paid_until).getTime() - Date.now()) / 86400000))
      : null
    card = (
      <CardCTA
        title="Продолжить работу"
        subtitle={`Ниша: ${activeRoadmap.trend_title}`}
        metric={daysLeft !== null ? `${daysLeft} дней до kill switch` : undefined}
        cta="Открыть Роадмап"
        href={`/lk/roadmap?trend_id=${encodeURIComponent(activeRoadmap.trend_id)}`}
      />
    )
  } else if (latestStrategy) {
    card = (
      <CardCTA
        title="Ты завершил Стратегию"
        subtitle={`Ниша: ${latestStrategy.trend_title}. Первые 3 дня Роадмапа бесплатно.`}
        cta="Открыть нишу"
        href={`/lk/research/${encodeURIComponent(latestStrategy.trend_id)}`}
      />
    )
  } else if (latestResearch) {
    card = (
      <CardCTA
        title="Следующий шаг — Стратегия"
        subtitle={`Ниша: ${latestResearch.title}`}
        cta="Открыть Стратегию"
        href={`/trends/${encodeURIComponent(latestResearch.trend_id)}`}
      />
    )
  } else {
    card = (
      <CardCTA
        title="Начни с анализа ниши"
        subtitle="6 блоков исследования + AI синтез"
        cta="Начать исследование"
        href="/"
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8">
      <div className="text-center space-y-1">
        <p className="text-xs uppercase tracking-wider text-zinc-500">Личный кабинет</p>
        <h1 className="text-2xl font-semibold text-white">Привет, {user.email.split('@')[0]}</h1>
      </div>
      {card}
      <div className="flex gap-3 text-xs text-zinc-500">
        <Link href="/lk/research" className="hover:text-zinc-300">Исследования</Link>
        <span>·</span>
        <Link href="/lk/strategies" className="hover:text-zinc-300">Стратегии</Link>
        <span>·</span>
        <Link href="/lk/roadmap" className="hover:text-zinc-300">Роадмап Pro</Link>
        <span>·</span>
        <Link href="/lk/projects" className="hover:text-zinc-300">Проекты</Link>
      </div>
    </div>
  )
}
