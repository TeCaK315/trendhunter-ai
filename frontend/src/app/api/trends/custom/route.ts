import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

/**
 * GET /api/trends/custom?trend_id=X
 *
 * Возвращает custom-тренд (созданный из /niche-research через convert)
 * в формате совместимом с обычным Trend (для использования в /trends/[id]).
 *
 * Источники: custom_trends (мета) + block_results (Evidence-данные).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const trend_id = req.nextUrl.searchParams.get('trend_id')
    if (!trend_id) return NextResponse.json({ error: 'trend_id required' }, { status: 400 })

    const supabase = getServerSupabase()

    const { data: customTrend } = await supabase
      .from('custom_trends')
      .select('trend_id, title, category, description, score, source, created_at')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!customTrend) {
      return NextResponse.json({ trend: null }, { status: 404 })
    }

    // Подтягиваем main_pain из block_results если есть (для why_trending)
    let why_trending = customTrend.description ?? ''
    try {
      const { data: br } = await supabase
        .from('block_results')
        .select('block_context')
        .eq('trend_id', trend_id)
        .eq('user_id', user.id)
        .eq('block_type', 'custom_niche')
        .maybeSingle()
      const ctx = br?.block_context as { main_pain?: string } | null | undefined
      if (ctx?.main_pain) why_trending = `${why_trending} · Главная боль: ${ctx.main_pain}`.trim()
    } catch {}

    // Возвращаем в формате Trend (совместимом с тем что отдаёт /api/trends)
    const trend = {
      id: customTrend.trend_id as string,
      title: customTrend.title as string,
      category: (customTrend.category as string) ?? 'Custom',
      popularity_score: typeof customTrend.score === 'number' ? customTrend.score * 10 : 50,
      growth_rate: 0,
      why_trending,
      source: (customTrend.source as string) ?? 'niche_research',
      source_query: customTrend.title as string,
      first_detected_at: (customTrend.created_at as string) ?? new Date().toISOString(),
      data_confidence: 'ai_generated' as const,
      growth_rate_source: 'ai_estimated' as const,
      status: 'custom' as const,
    }

    return NextResponse.json({ trend })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[trends/custom]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
