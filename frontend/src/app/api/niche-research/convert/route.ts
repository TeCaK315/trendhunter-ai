import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

interface PainPoint { pain?: string; severity?: string | number }

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { research_id, niche, description, analysis } = (await req.json()) as {
      research_id?: string
      niche?: string
      description?: string
      analysis?: {
        main_pain?: string
        confidence?: number
        key_pain_points?: Array<PainPoint | string>
        target_audience?: unknown
      }
    }
    if (!niche || !analysis) {
      return NextResponse.json({ error: 'niche and analysis required' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const trend_id = `trend-${Date.now()}-custom`

    const main_pain = analysis.main_pain ?? niche
    const key_pain_points = (analysis.key_pain_points ?? []).map((p) =>
      typeof p === 'string' ? p : (p.pain ?? '')
    )
    const score = typeof analysis.confidence === 'number' ? analysis.confidence : 5

    // ── Подтянуть real sources из custom_niche_research чтобы передать
    //    в triggers refresh реальные посты Reddit/YouTube с URL ──
    interface RedditP { title?: string; selftext?: string; url?: string }
    interface YouTubeP { title?: string; description?: string; url?: string }
    let redditPosts: RedditP[] = []
    let youtubePosts: YouTubeP[] = []
    if (research_id) {
      try {
        const { data: researchData } = await supabase
          .from('custom_niche_research')
          .select('sources')
          .eq('id', research_id)
          .eq('user_id', user.id)
          .maybeSingle()
        const srcs = (researchData?.sources ?? null) as { reddit?: { posts?: RedditP[] }; youtube?: { videos?: YouTubeP[] } } | null
        redditPosts = srcs?.reddit?.posts ?? []
        youtubePosts = srcs?.youtube?.videos ?? []
        console.log('[niche-research/convert] sources structure:', JSON.stringify({
          reddit_count: redditPosts.length,
          youtube_count: youtubePosts.length,
          first_reddit: redditPosts[0] ? { title: redditPosts[0].title?.slice(0, 60), has_url: !!redditPosts[0].url } : null,
        }, null, 2))
      } catch (e) {
        console.warn('[niche-research/convert] failed to load sources from research_id:', e)
      }
    }

    // 1. block_results — чтобы /lk/research увидел нишу + triggers refresh имел реальные посты
    const POSTS_PER_CLUSTER = 3
    const painClusters = (analysis.key_pain_points ?? []).map((p, index) => {
      const painStr = typeof p === 'string' ? p : (p.pain ?? '')
      const sev = typeof p === 'object' && p !== null ? p.severity ?? 'medium' : 'medium'

      const offset = index * POSTS_PER_CLUSTER
      const slice = redditPosts.slice(offset, offset + POSTS_PER_CLUSTER)
      const sources: Array<{ source: string; text: string; url: string }> = slice
        .map((post) => ({
          source: 'reddit',
          text: (post.title ?? '') + (post.selftext ? ' — ' + post.selftext.slice(0, 200) : ''),
          url: post.url ?? '',
        }))
        .filter((s) => s.text && s.url)

      // Fallback на YouTube если Reddit не дал результатов для этого кластера
      if (sources.length === 0) {
        const yt = youtubePosts[index]
        if (yt && yt.url) {
          sources.push({
            source: 'youtube',
            text: (yt.title ?? '') + (yt.description ? ' — ' + yt.description.slice(0, 200) : ''),
            url: yt.url,
          })
        }
      }

      // Финальный fallback — хотя бы pain string как text без url
      // (triggers refresh отфильтрует по url, поэтому такой кластер просто пропустится в Claude prompt,
      //  но запись в БД останется консистентной)
      if (sources.length === 0) {
        sources.push({ source: 'niche_research', text: painStr, url: '' })
      }

      return { pain: painStr, sources, severity: sev }
    })

    try {
      await supabase.from('block_results').insert({
        user_id: user.id,
        trend_id,
        block_number: 0,
        block_type: 'custom_niche',
        diagnosis: 'custom',
        score,
        block_context: {
          niche,
          description,
          main_pain,
          key_pain_points,
          target_audience: analysis.target_audience ?? null,
          source: 'niche_research',
        },
        raw_data: { premium: { pain_clusters: painClusters } },
      })
    } catch (e) {
      console.warn('[niche-research/convert] block_results insert failed (non-critical):', e)
    }

    // 2. custom_trends — мета для lookupTrendTitle
    const { error: ctErr } = await supabase
      .from('custom_trends')
      .upsert({
        trend_id,
        user_id: user.id,
        title: niche,
        category: 'Custom',
        description: description ?? null,
        score,
        source: 'niche_research',
      })
    if (ctErr) {
      console.error('[niche-research/convert] custom_trends upsert failed:', ctErr)
      return NextResponse.json({ error: ctErr.message }, { status: 500 })
    }

    // 3. update research record with trend_id
    if (research_id) {
      await supabase
        .from('custom_niche_research')
        .update({ trend_id })
        .eq('id', research_id)
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true, trend_id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[niche-research/convert]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
