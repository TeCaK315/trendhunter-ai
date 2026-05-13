import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'
import { createBannerIfFresh } from '@/lib/roadmap/banners'

export const maxDuration = 300

interface PainSource { source?: string; text?: string; url?: string }

function extractData(blockData: Record<string, unknown> | null | undefined): Record<string, unknown> {
  if (!blockData) return {}
  // V1 blocks store data in raw_data.premium, V2 — directly
  const premium = (blockData.premium as Record<string, unknown>) ?? null
  if (premium) return premium
  return blockData
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { session_id } = (await req.json()) as { session_id?: string }
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    const supabase = getServerSupabase()

    const { data: roadmapSession } = await supabase
      .from('roadmap_sessions')
      .select('id, user_id, trend_id, access_id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!roadmapSession) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Research data — block_results stores raw_data per block_number
    // Try generic select to be schema-flexible
    const { data: blockResults } = await supabase
      .from('block_results')
      .select('*')
      .eq('trend_id', roadmapSession.trend_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!blockResults || blockResults.length === 0) {
      return NextResponse.json(
        { error: 'No research data found for this niche. Run analysis first.' },
        { status: 404 }
      )
    }

    type BlockRow = { block_id?: string; block_type?: string; block_number?: number; raw_data?: Record<string, unknown> }
    const findBlock = (matchers: Array<{ id?: string; num?: number }>): Record<string, unknown> | null => {
      for (const m of matchers) {
        const r = (blockResults as BlockRow[]).find((b) => {
          if (m.id && (b.block_id === m.id || b.block_type === m.id)) return true
          if (m.num !== undefined && b.block_number === m.num) return true
          return false
        })
        if (r) return extractData(r.raw_data ?? null)
      }
      return null
    }

    const problem = findBlock([{ id: 'problem' }, { num: 1 }]) ?? {}
    const competition = findBlock([{ id: 'competition' }, { id: 'occupation' }, { num: 4 }]) ?? {}

    const painClusters = (problem.pain_clusters as Array<{ sources?: PainSource[] }> | undefined) ?? []
    const competitorWeaknesses =
      (competition.positioning_vectors as string[] | undefined) ??
      (competition.weaknesses as string[] | undefined) ??
      []

    const painSources: PainSource[] = painClusters
      .flatMap((c) => c.sources ?? [])
      .filter((s) => s.url && s.text)
      .slice(0, 10)

    // Strategy context
    const { data: access } = await supabase
      .from('roadmap_access')
      .select('strategy_session_id')
      .eq('id', roadmapSession.access_id)
      .maybeSingle()

    const { data: strategyBlocks } = await supabase
      .from('block_decisions')
      .select('block_id, translated_output')
      .eq('session_id', access?.strategy_session_id ?? '')
      .in('block_id', ['S0', 'S1', 'S3'])

    type Spec = { specific?: Record<string, unknown> }
    const strategy: Record<string, Spec> = {}
    for (const b of (strategyBlocks ?? []) as Array<{ block_id: string; translated_output: Spec }>) {
      strategy[b.block_id] = b.translated_output
    }

    const s0 = strategy.S0?.specific ?? {}
    const s1 = strategy.S1?.specific ?? {}
    const s3 = strategy.S3?.specific ?? {}

    const positioning = (s0.positioning_quote as string) ?? ''
    const clientWho = ((s1.client_portrait as { who?: string })?.who) ?? ''
    const channel = ((s3.channel as { human_name?: string; where_exactly?: string })?.human_name) ?? 'Reddit'
    const channelWhere = ((s3.channel as { human_name?: string; where_exactly?: string })?.where_exactly) ?? ''

    const sourcesText = painSources
      .map((s, i) => `${i + 1}. [${s.source ?? 'unknown'}] ${(s.text ?? '').slice(0, 300)}${s.url ? `\nURL: ${s.url}` : ''}`)
      .join('\n\n')

    const weaknessesText = competitorWeaknesses.slice(0, 5).map((w: string) => `- ${w}`).join('\n')

    if (!sourcesText && !weaknessesText) {
      return NextResponse.json(
        { error: 'Research data does not contain pain sources or competitor weaknesses. Re-run analysis.' },
        { status: 404 }
      )
    }

    const prompt = `Ты эксперт по поиску клиентов для B2B SaaS стартапов.

КОНТЕКСТ ПРОДУКТА:
- Позиция: ${positioning || 'не определена'}
- Целевой клиент: ${clientWho || 'не определён'}
- Канал привлечения: ${channel}
- Где именно: ${channelWhere || 'не определено'}

СЛАБОСТИ КОНКУРЕНТОВ:
${weaknessesText || 'нет данных'}

РЕАЛЬНЫЕ ЖАЛОБЫ ПОЛЬЗОВАТЕЛЕЙ (свежие):
${sourcesText || 'нет данных'}

ЗАДАЧА: Создай 3-5 actionable triggers — конкретных возможностей для контакта с потенциальными клиентами прямо сейчас.

Для каждого trigger:
1. trigger_type — платформа: reddit / g2 / hackernews / capterra / general_pain
2. search_query — конкретный поисковый запрос которым можно НАЙТИ похожие свежие посты прямо сейчас. Используй site:-операторы где уместно.
   Пример reddit: "site:reddit.com/r/zapier webhook configuration slow"
   Пример g2: "site:g2.com automation tool integration limited"
   Пример hackernews: "site:news.ycombinator.com low-code automation slow"
3. raw_content — дословная цитата из жалобы (150-200 символов из предоставленных данных)
4. actionable_text — краткое описание возможности (1 предложение)
5. suggested_action — готовое сообщение для отправки (2-3 предложения, мягкий вход, упоминай конкретную проблему из raw_content, не продающий)
6. source_url — всегда null (у нас нет прямых URL — пользователь будет искать через search_query)

Отвечай ТОЛЬКО в JSON формате:
{
  "triggers": [
    {
      "trigger_type": "reddit",
      "search_query": "site:reddit.com/r/zapier webhook configuration slow",
      "raw_content": "дословная цитата из жалобы из предоставленных данных",
      "actionable_text": "краткое описание возможности",
      "suggested_action": "Видел подобную проблему — [конкретная деталь из цитаты]. У нас была похожая ситуация, решили...",
      "source_url": null
    }
  ]
}

Язык: русский. Тон сообщений: помогающий, не продающий. Не придумывай источники — основывайся только на жалобах что я предоставил.`

    const anthropic = new Anthropic({ timeout: 90_000 })
    let triggersData: Array<Record<string, unknown>> = []

    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = response.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { text: string }).text)
        .join('')
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      const parsed = JSON.parse(text) as { triggers?: Array<Record<string, unknown>> }
      triggersData = parsed.triggers ?? []
    } catch (err) {
      console.error('[triggers/refresh] Claude error:', err)
      return NextResponse.json({ error: 'Failed to generate triggers' }, { status: 500 })
    }

    if (triggersData.length === 0) {
      return NextResponse.json({ error: 'No triggers generated' }, { status: 500 })
    }

    // Replace stale unworked triggers
    await supabase.from('roadmap_triggers').delete().eq('session_id', session_id).eq('acted_upon', false)

    const toInsert = triggersData.map((t) => ({
      session_id,
      trigger_type: (t.trigger_type as string) ?? 'general_pain',
      source_url: null, // нет реальных URL в источниках; используем search_query из context
      raw_content: (t.raw_content as string) ?? null,
      actionable_text: (t.actionable_text as string) ?? '',
      suggested_action: (t.suggested_action as string) ?? null,
      context: t.search_query ? { search_query: t.search_query } : null,
      generated_at: new Date().toISOString(),
    }))

    const { error: insErr } = await supabase.from('roadmap_triggers').insert(toInsert)
    if (insErr) {
      return NextResponse.json({ error: `Insert failed: ${insErr.message}` }, { status: 500 })
    }

    await createBannerIfFresh({
      session_id,
      banner_type: 'new_trigger',
      content: `Найдено ${triggersData.length} новых возможностей для контакта с клиентами`,
    })

    return NextResponse.json({
      success: true,
      triggers_created: triggersData.length,
      generated_at: new Date().toISOString(),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[triggers/refresh]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
