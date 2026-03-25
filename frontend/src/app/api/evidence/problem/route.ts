// src/app/api/evidence/problem/route.ts
// Блок 1 — Проблема (Multi-Pass Validation v2)
// Pass 1: Найти релевантные источники → Pass 2: Валидация + классификация → Pass 3: Кросс-валидация кластерами
// Главный вопрос: "Решений нет или решения плохие?"

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

const claude = new Anthropic()

// ══════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════

type PainCategory = 'no_solution' | 'bad_solution' | 'expensive_solution'
type PayingConfidence = 'high' | 'medium' | 'low'
type Dynamics = 'growing' | 'stable' | 'declining'
type Diagnosis = 'green' | 'yellow' | 'red'
type Context = 'b2b' | 'b2c' | 'mixed'
type DataConfidence = 'high' | 'medium' | 'low'

interface RawPost {
  source: 'reddit' | 'quora' | 'g2' | 'appstore' | 'trustpilot' | 'hackernews' | 'stackoverflow'
  text: string
  link: string
  upvotes: number
  date: string
}

/** Post after Pass 2 — validated as relevant + classified */
interface ValidatedPost extends RawPost {
  is_relevant: boolean
  category: PainCategory
  pain_summary: string  // 1-sentence summary of the actual pain
  mentioned_product: string  // which product/service is mentioned
  is_paying: boolean
  paying_confidence: PayingConfidence
  paying_weight: number
}

/** Pain cluster from Pass 3 — cross-validated across sources */
interface PainCluster {
  id: string
  pain_summary: string
  category: PainCategory
  sources: string[]          // unique source types (reddit, g2, quora, ...)
  source_count: number       // how many different source TYPES confirmed
  mention_count: number      // total posts mentioning this pain
  confidence: DataConfidence // high=3+ sources, medium=2, low=1
  top_quotes: Quote[]
  mentioned_products: string[]
}

interface Layer1Data {
  total_complaints: number
  validated_complaints: number  // after relevance filtering
  by_source: Record<string, number>
  dynamics: Dynamics
  has_date_confidence: boolean
  posts_with_dates_count: number
}

interface Layer2Data {
  distribution: Record<PainCategory, number>
  top_quotes: Record<PainCategory, Quote[]>
  pain_clusters: PainCluster[]  // NEW: cross-validated clusters
}

interface Layer3Data {
  paying_score: number
  paying_ratio: number
  context: Context
}

interface Quote {
  text: string
  link: string
  upvotes: number
  source: string
}

interface DiagnosisResult {
  diagnosis: Diagnosis
  score: number
  conflict_weight: number
  key_factors: string[]
  key_metric: string
  pain_type: PainCategory
}

interface ProblemBlockOutput {
  diagnosis: Diagnosis
  score: number
  conflict_weight: number
  key_factors: string[]
  key_metric: string
  block_context: {
    pain_type: PainCategory
    pain_scale: number
    paying_users_ratio: number
    classification_confidence: DataConfidence
    data_quality: {
      total_collected: number
      validated_relevant: number
      relevance_rate: number        // % of posts that were actually about the niche
      cross_validated_clusters: number
      high_confidence_clusters: number
    }
  }
  layers: {
    layer1: Layer1Data
    layer2: Layer2Data
    layer3: Layer3Data
  }
  raw_data: { posts: ValidatedPost[] }
}

// ══════════════════════════════════════════════════════════════
// SERPAPI FETCH
// ══════════════════════════════════════════════════════════════

async function fetchFromSource(
  query: string,
  engine: string,
  serpApiKey: string,
  extra: Record<string, string> = {}
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      engine,
      api_key: serpApiKey,
      num: '20',
      ...extra,
    })
    const res = await fetch(`https://serpapi.com/search?${params}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.organic_results || data.results || []
  } catch {
    return []
  }
}

// ══════════════════════════════════════════════════════════════
// НАТИВНЫЕ API (бесплатные, без SerpAPI)
// ══════════════════════════════════════════════════════════════

async function fetchHackerNewsNative(
  queries: string[],
  maxResults: number = 50
): Promise<RawPost[]> {
  const posts: RawPost[] = []
  const seen = new Set<string>()

  const fetches = queries.flatMap((q) => [
    fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=story&hitsPerPage=30`)
      .then((r) => r.json())
      .catch(() => ({ hits: [] })),
    fetch(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(q)}&tags=comment&hitsPerPage=30`)
      .then((r) => r.json())
      .catch(() => ({ hits: [] })),
  ])

  const results = await Promise.all(fetches)

  for (const data of results) {
    for (const hit of data.hits || []) {
      const url = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`
      if (seen.has(url)) continue
      seen.add(url)

      const text = hit.comment_text
        ? hit.comment_text.replace(/<[^>]*>/g, '').slice(0, 500)
        : hit.title || ''

      if (!text || text.length < 15) continue

      posts.push({
        source: 'hackernews',
        text,
        link: url,
        upvotes: hit.points || hit.num_comments || 0,
        date: hit.created_at || '',
      })
    }
  }

  return posts.slice(0, maxResults)
}

async function fetchStackExchangeNative(
  queries: string[],
  maxResults: number = 40
): Promise<RawPost[]> {
  const posts: RawPost[] = []
  const seen = new Set<string>()

  const keyParam = process.env.STACKEXCHANGE_KEY
    ? `&key=${process.env.STACKEXCHANGE_KEY}`
    : ''

  const fetches = queries.map((q) =>
    fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(q)}&answers=1&pagesize=30&site=stackoverflow&filter=withbody${keyParam}`,
      { headers: { 'Accept-Encoding': 'gzip' } }
    )
      .then(async (r) => {
        const data = await r.json()
        return data
      })
      .catch(() => ({ items: [] }))
  )

  const results = await Promise.all(fetches)

  for (const data of results) {
    for (const item of data.items || []) {
      const url = item.link || ''
      if (!url || seen.has(url)) continue
      seen.add(url)

      const bodyText = item.body
        ? item.body.replace(/<[^>]*>/g, '').slice(0, 500)
        : ''
      const text = item.title + (bodyText ? `. ${bodyText}` : '')

      posts.push({
        source: 'stackoverflow',
        text,
        link: url,
        upvotes: item.score || 0,
        date: item.creation_date
          ? new Date(item.creation_date * 1000).toISOString()
          : '',
      })
    }
  }

  return posts.slice(0, maxResults)
}

// ══════════════════════════════════════════════════════════════
// PASS 1 — ПОИСК РЕЛЕВАНТНЫХ ИСТОЧНИКОВ
// Сначала находим ГДЕ обсуждают нишу, потом ищем ТАМ
// ══════════════════════════════════════════════════════════════

interface DiscoveredSource {
  type: 'subreddit' | 'forum' | 'review_site'
  name: string       // e.g. "r/SaaS", "g2.com"
  relevance: number  // 1-10 from Haiku
  query: string      // refined search query for this source
}

/**
 * Pass 1a: Discover which subreddits/forums discuss this niche
 * Uses 1 SerpAPI query to find discussion hubs
 */
async function discoverSources(
  niche: string,
  keywords: string[],
  serpApiKey: string
): Promise<{ sources: DiscoveredSource[]; serpCalls: number }> {
  const kw = keywords.slice(0, 3).join(' ')

  // One discovery query to find WHERE people discuss this niche
  const discoveryResults = await fetchFromSource(
    `${niche} ${kw} site:reddit.com`,
    'google',
    serpApiKey,
    { num: '30' }
  )

  // Extract unique subreddits from URLs
  const subredditCounts = new Map<string, number>()
  for (const r of discoveryResults) {
    const url = r.link || ''
    const match = url.match(/reddit\.com\/r\/([^/]+)/)
    if (match) {
      const sub = match[1].toLowerCase()
      subredditCounts.set(sub, (subredditCounts.get(sub) || 0) + 1)
    }
  }

  // Sort by frequency — more mentions = more relevant
  const subreddits = Array.from(subredditCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  // Validate subreddit relevance with Haiku (1 call)
  let validatedSources: DiscoveredSource[] = []

  if (subreddits.length > 0) {
    try {
      const response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: 'Respond with valid JSON only, no markdown.',
        messages: [{
          role: 'user',
          content: `Rate relevance of these subreddits for the niche "${niche}" (${kw}).

Subreddits: ${subreddits.map(([s, count]) => `r/${s} (${count} mentions)`).join(', ')}

For each, rate 1-10: is this where users of ${niche} products actually discuss problems?
Respond as JSON array: [{"name": "r/subreddit", "relevance": 8}, ...]`
        }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
      const cleaned = text.replace(/```json|```/g, '').trim()
      const parsed = JSON.parse(cleaned)

      if (Array.isArray(parsed)) {
        validatedSources = parsed
          .filter((s: any) => s.relevance >= 5)
          .map((s: any) => ({
            type: 'subreddit' as const,
            name: s.name,
            relevance: s.relevance,
            query: `site:reddit.com/${s.name} ${niche} problem OR issue OR frustrating OR alternative`,
          }))
      }
    } catch (e) {
      console.warn('[Block1 Pass1] Haiku source validation failed, using frequency-based fallback')
    }
  }

  // Fallback: if Haiku failed or no subreddits, use top by frequency
  if (validatedSources.length === 0 && subreddits.length > 0) {
    validatedSources = subreddits.slice(0, 3).map(([sub]) => ({
      type: 'subreddit' as const,
      name: `r/${sub}`,
      relevance: 6,
      query: `site:reddit.com/r/${sub} ${niche} problem OR issue OR frustrating OR alternative`,
    }))
  }

  // Always include review sites — no discovery needed
  const reviewSources: DiscoveredSource[] = [
    { type: 'review_site', name: 'g2.com', relevance: 9, query: `site:g2.com ${niche} reviews` },
    { type: 'review_site', name: 'trustpilot.com', relevance: 7, query: `site:trustpilot.com ${niche} review` },
  ]

  // Quora — general but filtered in Pass 2
  const generalSources: DiscoveredSource[] = [
    { type: 'forum', name: 'quora.com', relevance: 6, query: `site:quora.com ${niche} problem OR alternative OR better` },
  ]

  return {
    sources: [...validatedSources, ...reviewSources, ...generalSources],
    serpCalls: 1, // discovery query
  }
}

/**
 * Pass 1b: Collect posts from validated sources + native APIs
 */
async function collectFromSources(
  sources: DiscoveredSource[],
  niche: string,
  keywords: string[],
  serpApiKey: string
): Promise<{ posts: RawPost[]; serpCalls: number }> {
  const posts: RawPost[] = []
  const seen = new Set<string>()

  // SerpAPI: search within discovered sources (max 5 queries)
  const serpQueries = sources.slice(0, 5)
  const serpResults = await Promise.all(
    serpQueries.map(s =>
      fetchFromSource(s.query, 'google', serpApiKey, { tbs: 'qdr:3m', num: '20' })
    )
  )

  for (let i = 0; i < serpResults.length; i++) {
    const source = serpQueries[i]
    for (const r of serpResults[i]) {
      const url = r.link || r.url || ''
      if (!url || seen.has(url)) continue
      seen.add(url)

      const sourceType = source.name.includes('reddit') ? 'reddit'
        : source.name.includes('g2') ? 'g2'
        : source.name.includes('trustpilot') ? 'trustpilot'
        : source.name.includes('quora') ? 'quora'
        : 'reddit'

      posts.push({
        source: sourceType as RawPost['source'],
        text: r.snippet || r.description || '',
        link: url,
        upvotes: r.upvotes || 0,
        date: r.date || '',
      })
    }
  }

  // Native APIs (0 SerpAPI calls)
  const kw = keywords.slice(0, 2)
  const [hnPosts, soPosts] = await Promise.all([
    fetchHackerNewsNative([
      `${niche} problem`,
      `${niche} frustrating`,
      `${niche} alternative`,
      `${kw[0] || niche} issue`,
    ], 50),
    fetchStackExchangeNative([
      `${niche} error problem`,
      `${kw[0] || niche} issue not working`,
    ], 40),
  ])

  for (const post of [...hnPosts, ...soPosts]) {
    if (!seen.has(post.link)) {
      seen.add(post.link)
      posts.push(post)
    }
  }

  return {
    posts: posts.slice(0, 200),
    serpCalls: serpQueries.length,
  }
}

// ══════════════════════════════════════════════════════════════
// PASS 2 — ВАЛИДАЦИЯ РЕЛЕВАНТНОСТИ + КЛАССИФИКАЦИЯ
// Haiku получает контекст ниши и проверяет каждый пост
// ══════════════════════════════════════════════════════════════

interface ValidationResult {
  is_relevant: boolean
  category: PainCategory
  pain_summary: string
  mentioned_product: string
}

/**
 * Pass 2: Validate relevance AND classify in one call
 * Key difference from v1: AI knows the niche, checks relevance BEFORE classifying
 */
async function validateAndClassifyBatch(
  posts: RawPost[],
  niche: string,
  competitors: string[]
): Promise<{ results: ValidationResult[]; failed: boolean }> {
  const postsText = posts
    .map((p, i) => `[${i}] [${p.source}] ${p.text.slice(0, 400)}`)
    .join('\n\n')

  const competitorsStr = competitors.length > 0
    ? `Known competitors in this niche: ${competitors.join(', ')}.`
    : ''

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: 'Respond with valid JSON only, no markdown or explanations.',
      messages: [{
        role: 'user',
        content: `You are analyzing user complaints in the niche: "${niche}".
${competitorsStr}

For each post below, determine:
1. is_relevant: Is this post ACTUALLY about a problem/complaint in the "${niche}" niche? (true/false)
   - false if: off-topic, general discussion, positive review, news article, self-promotion
   - true if: user expressing frustration, asking for alternatives, reporting bugs, complaining about price
2. category: If relevant, classify the pain type:
   - "no_solution": user says no solution exists for their need
   - "bad_solution": solution exists but poorly implemented (bugs, bad UX, slow, unreliable)
   - "expensive_solution": solution exists but too expensive or inaccessible
3. pain_summary: One sentence describing the specific pain (empty string if not relevant)
4. mentioned_product: Name of the product/service mentioned (empty string if none)

Posts:
${postsText}

Respond as JSON array of ${posts.length} objects:
[{"is_relevant": true, "category": "bad_solution", "pain_summary": "User frustrated with slow loading times in X", "mentioned_product": "ProductX"}, ...]`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const cleaned = text.replace(/```json|```/g, '').trim()

    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      console.error('[Block1 Pass2] JSON parse error', { cleaned: cleaned.slice(0, 200) })
      return { results: [], failed: true }
    }

    if (!Array.isArray(parsed) || parsed.length !== posts.length) {
      console.warn('[Block1 Pass2] Count mismatch', {
        expected: posts.length,
        received: Array.isArray(parsed) ? parsed.length : 'not-array',
      })
      return { results: [], failed: true }
    }

    const validCategories: PainCategory[] = ['no_solution', 'bad_solution', 'expensive_solution']

    return {
      results: parsed.map((r: any) => ({
        is_relevant: r.is_relevant === true,
        category: validCategories.includes(r.category) ? r.category : 'bad_solution',
        pain_summary: typeof r.pain_summary === 'string' ? r.pain_summary : '',
        mentioned_product: typeof r.mentioned_product === 'string' ? r.mentioned_product : '',
      })),
      failed: false,
    }
  } catch (error) {
    console.error('[Block1 Pass2] Haiku error', error)
    return { results: [], failed: true }
  }
}

// ══════════════════════════════════════════════════════════════
// ЭВРИСТИКА ПЛАТЯЩЕГО ПОЛЬЗОВАТЕЛЯ
// ══════════════════════════════════════════════════════════════

function detectPayingUser(
  text: string,
  competitors?: string[]
): { is_paying: boolean; confidence: PayingConfidence; weight: number } {
  const SAFE_TEXT = text.slice(0, 1000)
  const lowerText = SAFE_TEXT.toLowerCase()

  const highSignals = [
    /я (использую|использовал|платил|подписан|купил|плачу)/i,
    /мой (аккаунт|тариф|план|подписка)/i,
    /после (обновления|перехода на|миграции с)/i,
    /\$\d+.*(месяц|год|mo|yr|month|year)/i,
    /(отменил|отписался|ушёл с|перешёл с|switched from|cancelled)/i,
    /(i (use|used|pay|paid|subscribed|bought))/i,
    /(my (account|plan|subscription|tier))/i,
  ]

  const regexMediumSignals = [
    /(баг|глюк|не работает|сломали|bug|broken|doesn't work)/i,
    /(поддержка|саппорт|support) (не отвечает|игнорирует|useless|awful)/i,
    /(после обновления|after update|since the update)/i,
  ]

  const competitorSignals = competitors?.map((c) => c.toLowerCase()) || []

  const lowSignals = [
    /(слышал|читал|говорят|heard|read|they say)/i,
    /(думаю попробовать|considering|thinking about|looking for alternative)/i,
  ]

  const isHigh = highSignals.some((r) => r.test(SAFE_TEXT))
  const isMedium =
    regexMediumSignals.some((r) => r.test(SAFE_TEXT)) ||
    competitorSignals.some((c) => lowerText.includes(c))
  const isLow = lowSignals.some((r) => r.test(SAFE_TEXT))

  if (isHigh) return { is_paying: true, confidence: 'high', weight: 10 }
  if (isMedium && !isLow) return { is_paying: true, confidence: 'medium', weight: 5 }
  return { is_paying: false, confidence: 'low', weight: 1 }
}

// ══════════════════════════════════════════════════════════════
// PASS 3 — КРОСС-ВАЛИДАЦИЯ: КЛАСТЕРИЗАЦИЯ БОЛЕЙ
// Одна жалоба = шум. Та же жалоба из 3+ источников = сигнал.
// ══════════════════════════════════════════════════════════════

async function clusterPains(
  posts: ValidatedPost[],
  niche: string
): Promise<PainCluster[]> {
  // Only cluster relevant posts
  const relevantPosts = posts.filter(p => p.is_relevant && p.pain_summary)

  if (relevantPosts.length === 0) return []
  if (relevantPosts.length <= 3) {
    // Too few posts for meaningful clustering — return each as its own cluster
    return relevantPosts.map((p, i) => ({
      id: `cluster-${i}`,
      pain_summary: p.pain_summary,
      category: p.category,
      sources: [p.source],
      source_count: 1,
      mention_count: 1,
      confidence: 'low' as DataConfidence,
      top_quotes: [{ text: p.text.slice(0, 200), link: p.link, upvotes: p.upvotes, source: p.source }],
      mentioned_products: p.mentioned_product ? [p.mentioned_product] : [],
    }))
  }

  // Send pain summaries to Haiku for clustering
  const summaries = relevantPosts
    .map((p, i) => `[${i}] [${p.source}] ${p.pain_summary} (product: ${p.mentioned_product || 'none'})`)
    .join('\n')

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: 'Respond with valid JSON only, no markdown or explanations.',
      messages: [{
        role: 'user',
        content: `Group these user pain points from the "${niche}" niche into clusters of SAME or VERY SIMILAR complaints.

Pain points:
${summaries}

Rules:
- Group posts that describe the SAME underlying problem (even if worded differently)
- Each cluster gets a clear summary of the shared pain
- Return post indices in each cluster

Respond as JSON:
[{"summary": "Slow performance and loading times", "post_indices": [0, 3, 7]}, ...]`
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const cleaned = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)

    if (!Array.isArray(parsed)) return []

    const clusters: PainCluster[] = parsed.map((cluster: any, idx: number) => {
      const indices: number[] = Array.isArray(cluster.post_indices) ? cluster.post_indices : []
      const clusterPosts = indices
        .filter(i => i >= 0 && i < relevantPosts.length)
        .map(i => relevantPosts[i])

      if (clusterPosts.length === 0) return null

      // Determine unique sources
      const uniqueSources = [...new Set(clusterPosts.map(p => p.source))]

      // Determine dominant category
      const catCounts: Record<string, number> = {}
      clusterPosts.forEach(p => { catCounts[p.category] = (catCounts[p.category] || 0) + 1 })
      const dominantCategory = (Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'bad_solution') as PainCategory

      // Confidence based on source diversity
      const confidence: DataConfidence =
        uniqueSources.length >= 3 ? 'high' :
        uniqueSources.length === 2 ? 'medium' : 'low'

      // Top quotes by upvotes
      const topQuotes = clusterPosts
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, 3)
        .map(p => ({ text: p.text.slice(0, 200), link: p.link, upvotes: p.upvotes, source: p.source }))

      // Mentioned products
      const products = [...new Set(clusterPosts.map(p => p.mentioned_product).filter(Boolean))]

      return {
        id: `cluster-${idx}`,
        pain_summary: cluster.summary || clusterPosts[0].pain_summary,
        category: dominantCategory,
        sources: uniqueSources,
        source_count: uniqueSources.length,
        mention_count: clusterPosts.length,
        confidence,
        top_quotes: topQuotes,
        mentioned_products: products,
      }
    }).filter(Boolean) as PainCluster[]

    // Sort: high confidence first, then by mention count
    clusters.sort((a, b) => {
      const confOrder = { high: 3, medium: 2, low: 1 }
      const confDiff = confOrder[b.confidence] - confOrder[a.confidence]
      return confDiff !== 0 ? confDiff : b.mention_count - a.mention_count
    })

    return clusters
  } catch (error) {
    console.error('[Block1 Pass3] Clustering error', error)
    // Fallback: no clustering, each post is its own "cluster"
    return relevantPosts.slice(0, 10).map((p, i) => ({
      id: `cluster-${i}`,
      pain_summary: p.pain_summary,
      category: p.category,
      sources: [p.source],
      source_count: 1,
      mention_count: 1,
      confidence: 'low' as DataConfidence,
      top_quotes: [{ text: p.text.slice(0, 200), link: p.link, upvotes: p.upvotes, source: p.source }],
      mentioned_products: p.mentioned_product ? [p.mentioned_product] : [],
    }))
  }
}

// ══════════════════════════════════════════════════════════════
// АГРЕГАЦИЯ (обновлённая — учитывает validated posts + clusters)
// ══════════════════════════════════════════════════════════════

function aggregate(
  posts: ValidatedPost[],
  clusters: PainCluster[],
  failedBatchCount: number,
  totalBatches: number
): {
  layer1: Layer1Data
  layer2: Layer2Data
  layer3: Layer3Data
  classificationConfidence: DataConfidence
} {
  const relevantPosts = posts.filter(p => p.is_relevant)
  const total = relevantPosts.length

  // ── Layer 1: масштаб ──────────────────────────────────────
  const bySource = relevantPosts.reduce(
    (acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const postsWithDates = relevantPosts.filter((p) => p.date && p.date.trim() !== '')
  const has_date_confidence = postsWithDates.length >= 10

  const dynamics: Dynamics = !has_date_confidence
    ? 'stable'
    : (() => {
        const now = Date.now()
        const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000  // 4 weeks instead of 2
        const recent = postsWithDates.filter(
          (p) => new Date(p.date).getTime() > fourWeeksAgo
        ).length
        const older = postsWithDates.length - recent
        return recent > older * 1.3 ? 'growing' : recent < older * 0.7 ? 'declining' : 'stable'
      })()

  // ── Layer 2: природа боли (from VALIDATED posts only) ─────
  const counts = { no_solution: 0, bad_solution: 0, expensive_solution: 0 }
  if (total > 0) {
    relevantPosts.forEach((p) => counts[p.category]++)
  }

  const distribution: Record<PainCategory, number> = {
    no_solution: total > 0 ? Math.round((counts.no_solution / total) * 100) : 0,
    bad_solution: total > 0 ? Math.round((counts.bad_solution / total) * 100) : 0,
    expensive_solution: total > 0 ? Math.round((counts.expensive_solution / total) * 100) : 0,
  }

  // Top quotes — prefer from high-confidence clusters
  const categories: PainCategory[] = ['no_solution', 'bad_solution', 'expensive_solution']
  const top_quotes: Record<PainCategory, Quote[]> = {
    no_solution: [],
    bad_solution: [],
    expensive_solution: [],
  }

  // First try cluster quotes (cross-validated), then individual posts
  for (const cat of categories) {
    const catClusters = clusters.filter(c => c.category === cat)
    const fromClusters = catClusters.flatMap(c => c.top_quotes)

    if (fromClusters.length >= 3) {
      top_quotes[cat] = fromClusters.slice(0, 3)
    } else {
      // Supplement with individual post quotes
      const individualQuotes = relevantPosts
        .filter(p => p.category === cat)
        .sort((a, b) => b.upvotes - a.upvotes)
        .slice(0, 3)
        .map(p => ({ text: p.text.slice(0, 200), link: p.link, upvotes: p.upvotes, source: p.source }))
      top_quotes[cat] = [...fromClusters, ...individualQuotes].slice(0, 3)
    }
  }

  // ── Layer 3: контекст ─────────────────────────────────────
  const payingPosts = relevantPosts.filter((p) => p.is_paying)
  const paying_score = payingPosts.reduce((sum, p) => sum + p.paying_weight, 0)
  const paying_ratio = total > 0 ? Math.round((payingPosts.length / total) * 100) : 0

  const b2bCount = relevantPosts.filter((p) =>
    /(team|company|enterprise|business|org|organization|employee|staff)/i.test(p.text)
  ).length
  const context: Context =
    total > 0
      ? b2bCount / total > 0.6 ? 'b2b' : b2bCount / total < 0.2 ? 'b2c' : 'mixed'
      : 'mixed'

  // Classification confidence — 3-level instead of binary
  let classificationConfidence: DataConfidence
  if (failedBatchCount === 0) {
    classificationConfidence = 'high'
  } else if (failedBatchCount <= totalBatches * 0.3) {
    classificationConfidence = 'medium'
  } else {
    classificationConfidence = 'low'
  }

  return {
    layer1: {
      total_complaints: posts.length,  // all collected
      validated_complaints: total,      // after relevance filter
      by_source: bySource,
      dynamics,
      has_date_confidence,
      posts_with_dates_count: postsWithDates.length,
    },
    layer2: { distribution, top_quotes, pain_clusters: clusters },
    layer3: { paying_score, paying_ratio, context },
    classificationConfidence,
  }
}

// ══════════════════════════════════════════════════════════════
// ДИАГНОЗ (обновлённый — учитывает кластеры и confidence)
// ══════════════════════════════════════════════════════════════

function makeDiagnosis(
  layers: { layer1: Layer1Data; layer2: Layer2Data; layer3: Layer3Data },
  classificationConfidence: DataConfidence
): DiagnosisResult {
  const { layer1, layer2, layer3 } = layers
  const validTotal = layer1.validated_complaints

  const painType = (Object.entries(layer2.distribution) as [PainCategory, number][]).sort(
    (a, b) => b[1] - a[1]
  )[0][0]

  const key_metric = `${layer2.distribution[painType]}% — ${
    painType === 'bad_solution'
      ? 'плохая реализация'
      : painType === 'no_solution'
      ? 'решений нет'
      : 'слишком дорого'
  }`

  // Count high-confidence clusters (cross-validated from 3+ sources)
  const highConfClusters = layer2.pain_clusters.filter(c => c.confidence === 'high').length
  const medConfClusters = layer2.pain_clusters.filter(c => c.confidence === 'medium').length

  // ── 1. GREEN — stealing the market ───────────────────────
  // Requires: strong bad_solution signal + paying users + sufficient data + cross-validated
  if (
    layer2.distribution.bad_solution >= 55 &&
    layer3.paying_score >= 40 &&
    validTotal >= 30 &&
    (highConfClusters >= 1 || medConfClusters >= 2)
  ) {
    // Adjust score based on classification confidence
    const confBonus = classificationConfidence === 'high' ? 0.5 : classificationConfidence === 'medium' ? 0 : -0.5
    return {
      diagnosis: 'green',
      score: Math.min(10, 6 +
        (layer2.distribution.bad_solution - 55) / 20 +
        (layer3.paying_score - 40) / 50 +
        highConfClusters * 0.3 +
        confBonus
      ),
      conflict_weight: 1,
      key_factors: [
        `${layer2.distribution.bad_solution}% жалуются на плохую реализацию`,
        `Paying score: ${layer3.paying_score} (${layer3.paying_ratio}% платящие)`,
        `${highConfClusters} подтверждённых кластеров болей (3+ источника)`,
        `Контекст: ${layer3.context.toUpperCase()}`,
        `Качество данных: ${classificationConfidence}`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 2. RED — рынок угасает ────────────────────────────────
  if (layer1.dynamics === 'declining' && layer3.paying_score < 15) {
    return {
      diagnosis: 'red',
      score: Math.max(1, 2 + validTotal / 200),
      conflict_weight: 3,
      key_factors: [
        `Динамика падает + paying score ${layer3.paying_score}`,
        'Рынок угасает — боль ситуативная или временная',
        `${validTotal} валидных жалоб из ${layer1.total_complaints} собранных`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 3. YELLOW — educate the market ───────────────────────
  if (layer2.distribution.no_solution >= 55) {
    return {
      diagnosis: 'yellow',
      score: 6,
      conflict_weight: 2,
      key_factors: [
        `${layer2.distribution.no_solution}% говорят что решений нет`,
        'Рынок не занят — но требует educate the market',
        `${highConfClusters + medConfClusters} подтверждённых кластеров`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 4. YELLOW — данных мало ───────────────────────────────
  if (validTotal < 20 || layer3.paying_score < 20) {
    return {
      diagnosis: 'yellow',
      score: Math.min(5, 4 + validTotal / 100),
      conflict_weight: 2,
      key_factors: [
        `Только ${validTotal} валидных жалоб (из ${layer1.total_complaints} собранных)`,
        `Низкий paying score: ${layer3.paying_score}`,
        `Динамика: ${layer1.dynamics}`,
        `Качество данных: ${classificationConfidence}`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 5. YELLOW — серая зона ────────────────────────────────
  return {
    diagnosis: 'yellow',
    score: 5,
    conflict_weight: 2,
    key_factors: [
      `${validTotal} валидных жалоб, смешанная картина`,
      `Paying score: ${layer3.paying_score}`,
      `Преобладает: ${painType}`,
      `${highConfClusters} кластеров high / ${medConfClusters} medium`,
    ],
    key_metric,
    pain_type: painType,
  }
}

// ══════════════════════════════════════════════════════════════
// ОСНОВНОЙ РОУТ
// ══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const SERPAPI_KEY = process.env.SERPAPI_KEY
    if (!SERPAPI_KEY) {
      return NextResponse.json(
        { error: 'SERPAPI_KEY не настроен на сервере' },
        { status: 500 }
      )
    }

    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const supabase = getServerSupabase()

    const { trend_id, niche, keywords, competitors } = (await req.json()) as {
      trend_id: string
      niche: string
      keywords: string[]
      competitors?: string[]
    }

    if (!trend_id || !niche || !keywords?.length) {
      return NextResponse.json(
        { error: 'Требуются trend_id, niche и keywords' },
        { status: 400 }
      )
    }

    const competitorsList = competitors || []

    // ══════════════════════════════════════════════════════════
    // PASS 1 — НАЙТИ ИСТОЧНИКИ
    // ══════════════════════════════════════════════════════════
    console.log(`[Block1 Pass1] Discovering sources for "${niche}"...`)
    const { sources, serpCalls: discoveryCalls } = await discoverSources(niche, keywords, SERPAPI_KEY)
    console.log(`[Block1 Pass1] Found ${sources.length} sources (${discoveryCalls} SerpAPI calls)`)

    // Collect posts from validated sources
    const { posts: rawPosts, serpCalls: collectCalls } = await collectFromSources(sources, niche, keywords, SERPAPI_KEY)
    console.log(`[Block1 Pass1] Collected ${rawPosts.length} posts (${collectCalls} SerpAPI calls)`)

    if (rawPosts.length === 0) {
      return NextResponse.json(
        {
          error: 'Недостаточно данных',
          message: 'Не найдено постов по данной нише. Попробуйте расширить ключевые слова.',
        },
        { status: 422 }
      )
    }

    // ══════════════════════════════════════════════════════════
    // PASS 2 — ВАЛИДАЦИЯ РЕЛЕВАНТНОСТИ + КЛАССИФИКАЦИЯ
    // ══════════════════════════════════════════════════════════
    console.log(`[Block1 Pass2] Validating relevance of ${rawPosts.length} posts...`)

    const BATCH_SIZE = 10
    const MAX_CONCURRENT = 5

    const batches: RawPost[][] = []
    for (let i = 0; i < rawPosts.length; i += BATCH_SIZE) {
      batches.push(rawPosts.slice(i, i + BATCH_SIZE))
    }

    const allValidationResults: ValidationResult[] = []
    let failedBatchCount = 0

    for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
      const chunk = batches.slice(i, i + MAX_CONCURRENT)
      const results = await Promise.all(
        chunk.map(b => validateAndClassifyBatch(b, niche, competitorsList))
      )

      for (const { results: batchResults, failed } of results) {
        if (failed) {
          failedBatchCount++
          // DON'T silently default to bad_solution — mark as not validated
          // These posts will be excluded from analysis
        } else {
          allValidationResults.push(...batchResults)
        }
      }
    }

    // Build validated posts (only from successful batches)
    const validatedPosts: ValidatedPost[] = []
    let validationIdx = 0

    for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
      const batch = batches[batchIdx]
      // Check if this batch was successfully validated
      // Results are sequential — first successful batch maps to first results
      for (const post of batch) {
        if (validationIdx < allValidationResults.length) {
          const validation = allValidationResults[validationIdx]
          const { is_paying, confidence, weight } = detectPayingUser(post.text, competitorsList)

          validatedPosts.push({
            ...post,
            is_relevant: validation.is_relevant,
            category: validation.category,
            pain_summary: validation.pain_summary,
            mentioned_product: validation.mentioned_product,
            is_paying: validation.is_relevant ? is_paying : false,
            paying_confidence: confidence,
            paying_weight: validation.is_relevant ? weight : 0,
          })
          validationIdx++
        }
        // Posts from failed batches are simply not included
      }
    }

    const relevantCount = validatedPosts.filter(p => p.is_relevant).length
    const relevanceRate = validatedPosts.length > 0
      ? Math.round((relevantCount / validatedPosts.length) * 100)
      : 0
    console.log(`[Block1 Pass2] ${relevantCount}/${validatedPosts.length} posts relevant (${relevanceRate}%), ${failedBatchCount} batches failed`)

    // ══════════════════════════════════════════════════════════
    // PASS 3 — КРОСС-ВАЛИДАЦИЯ КЛАСТЕРАМИ
    // ══════════════════════════════════════════════════════════
    console.log(`[Block1 Pass3] Clustering ${relevantCount} relevant pains...`)
    const clusters = await clusterPains(validatedPosts, niche)
    const highConfClusters = clusters.filter(c => c.confidence === 'high').length
    const medConfClusters = clusters.filter(c => c.confidence === 'medium').length
    console.log(`[Block1 Pass3] ${clusters.length} clusters: ${highConfClusters} high, ${medConfClusters} medium confidence`)

    // ══════════════════════════════════════════════════════════
    // АГРЕГАЦИЯ + ДИАГНОЗ
    // ══════════════════════════════════════════════════════════
    const { layer1, layer2, layer3, classificationConfidence } = aggregate(
      validatedPosts,
      clusters,
      failedBatchCount,
      batches.length
    )
    const layers = { layer1, layer2, layer3 }
    const diagnosisResult = makeDiagnosis(layers, classificationConfidence)

    // ══════════════════════════════════════════════════════════
    // ФИНАЛЬНЫЙ OUTPUT
    // ══════════════════════════════════════════════════════════
    const output: ProblemBlockOutput = {
      diagnosis: diagnosisResult.diagnosis,
      score: diagnosisResult.score,
      conflict_weight: diagnosisResult.conflict_weight,
      key_factors: diagnosisResult.key_factors,
      key_metric: diagnosisResult.key_metric,
      block_context: {
        pain_type: diagnosisResult.pain_type,
        pain_scale: layer1.validated_complaints,
        paying_users_ratio: layer3.paying_ratio,
        classification_confidence: classificationConfidence,
        data_quality: {
          total_collected: rawPosts.length,
          validated_relevant: relevantCount,
          relevance_rate: relevanceRate,
          cross_validated_clusters: clusters.length,
          high_confidence_clusters: highConfClusters,
        },
      },
      layers,
      raw_data: { posts: validatedPosts },
    }

    // ══════════════════════════════════════════════════════════
    // UPSERT В SUPABASE
    // ══════════════════════════════════════════════════════════
    const { error: dbError } = await supabase.from('block_results').upsert({
      trend_id,
      user_id: user.id,
      block_number: 1,
      block_type: 'problem',
      diagnosis: output.diagnosis,
      score: output.score,
      conflict_weight: output.conflict_weight,
      key_factors: output.key_factors,
      key_metric: output.key_metric,
      block_context: output.block_context,
      raw_data: {
        ...output.raw_data,
        premium: {
          top_quotes: output.layers.layer2.top_quotes,
          pain_clusters: output.layers.layer2.pain_clusters,
          layer3: output.layers.layer3,
          key_factors: output.key_factors,
          block_context: output.block_context,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' })

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`)

    // ══════════════════════════════════════════════════════════
    // ОТВЕТ — PUBLIC + PREVIEW ДАННЫЕ
    // ══════════════════════════════════════════════════════════
    const previewQuotes: Record<string, Quote[]> = {}
    for (const [cat, quotes] of Object.entries(output.layers.layer2.top_quotes)) {
      previewQuotes[cat] = (quotes as Quote[]).slice(0, 1)
    }

    // Preview clusters — show top 3 with summary only
    const previewClusters = clusters.slice(0, 3).map(c => ({
      pain_summary: c.pain_summary,
      source_count: c.source_count,
      mention_count: c.mention_count,
      confidence: c.confidence,
      category: c.category,
    }))

    return NextResponse.json({
      success: true,
      public: {
        layer1: output.layers.layer1,
        distribution: output.layers.layer2.distribution,
        top_quotes: previewQuotes,
        pain_clusters_preview: previewClusters,
        layer3: {
          paying_ratio: output.layers.layer3.paying_ratio,
          context: output.layers.layer3.context,
          paying_score: output.layers.layer3.paying_score,
        },
        diagnosis: output.diagnosis,
        score: output.score,
        key_metric: output.key_metric,
        key_factors: output.key_factors,
        block_context: output.block_context,
      },
      has_premium: true,
    })
  } catch (error: any) {
    console.error('[Block 1 — Problem]', error)
    return NextResponse.json(
      { error: error.message || 'Внутренняя ошибка блока Проблема' },
      { status: 500 }
    )
  }
}
