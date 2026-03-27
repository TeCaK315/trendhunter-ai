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
// ВЕСА ИСТОЧНИКОВ И ВЕРОЯТНОСТИ
// ══════════════════════════════════════════════════════════════

/** Вес источника: G2 review >> random Quora question */
const SOURCE_WEIGHT: Record<string, number> = {
  g2: 5,
  trustpilot: 4,
  hackernews: 3,
  reddit: 2,
  stackoverflow: 2,
  quora: 1,
}

/** Базовая вероятность что автор — платящий пользователь (по типу площадки) */
const SOURCE_PAYING_PROBABILITY: Record<string, number> = {
  g2: 0.95,        // пишут только пользователи продуктов
  trustpilot: 0.80, // большинство пишут после покупки
  reddit: 0.20,     // смесь пользователей и любопытных
  hackernews: 0.15,  // в основном обсуждают, не обязательно платят
  stackoverflow: 0.10, // техническая помощь, не про покупку
  quora: 0.10,      // общие вопросы
}

/** Источники где upvotes имеют смысл для engagement bonus */
const SOURCES_WITH_ENGAGEMENT = new Set(['reddit', 'hackernews', 'stackoverflow'])

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
  collection_period?: 'recent' | 'historical'  // qdr:3m vs qdr:y
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
  weighted_score: number          // sourceWeight × (1 + engagementBonus)
  collection_period?: 'recent' | 'historical'
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
  weighted_complaints_score: number  // ΣsourceWeight × (1 + engagementBonus)
  by_source: Record<string, number>
  dynamics: Dynamics
  dynamics_ratio: number             // last3m / prev3m from Google Trends
  pain_is_chronic: boolean           // historical > recent × 2
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
      pre_filter_dropped: number    // posts dropped before Haiku (no niche keywords)
      sent_to_validation: number    // posts sent to Haiku
      validated_relevant: number
      relevance_rate: number        // % of posts that were actually about the niche
      cross_validated_clusters: number
      high_confidence_clusters: number
      // Диагностика воронки
      queries_used: string[]        // какие запросы делались в SerpAPI
      subreddits_used: string[]     // какие subreddits использовались
      pre_filter_keywords: string[] // какие слова использовал pre-filter
    }
    // Intelligence Layer — плоские поля для Sonnet промпта
    niche: string
    dynamics: Dynamics
    pain_is_chronic: boolean
    distribution: Record<PainCategory, number>
    weighted_complaints_score: number
    paying_score: number
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
  serpApiKey: string,
  presetSubreddits?: string[]
): Promise<{ sources: DiscoveredSource[]; serpCalls: number }> {
  const kw = keywords.slice(0, 3).join(' ')
  let validatedSources: DiscoveredSource[] = []
  let serpCalls = 0

  // ── Fix B: Если subreddits переданы из карточки — 0 SerpAPI, 0 Haiku ──
  // Умные кавычки: для коротких фраз (1-2 слова) — кавычки, для длинных — разбиваем
  // НЕ выбрасываем нишевые аббревиатуры (hr, ai, crm, erp, ux) — используем STOP_WORDS
  const QUERY_STOP_WORDS = new Set(['the','and','for','its','are','was','has','had','but','not','you','all','can','her','his','how','may','new','now','old','our','own','she','too','two','use','way','who','why','did','get','got','let','put','run','set','try','say','any','few','per','via','yet','nor','off','out','yes'])
  const nicheQueryPart = niche.split(/\s+/).length <= 2
    ? `"${niche}"`
    : niche.split(/\s+/).filter(w => w.length > 1 && !QUERY_STOP_WORDS.has(w.toLowerCase())).join(' ')

  if (presetSubreddits && presetSubreddits.length > 0) {
    console.log(`[Block1 Pass1] Using preset subreddits: ${presetSubreddits.join(', ')}`)
    validatedSources = presetSubreddits.map(sub => ({
      type: 'subreddit' as const,
      name: `r/${sub}`,
      relevance: 8,
      // НЕ добавляем pain words (complaints/frustrated) — пусть Google ищет ВСЁ про нишу
      // в этом сабреддите, а Haiku потом фильтрует релевантность
      query: `site:reddit.com/r/${sub} ${nicheQueryPart}`,
    }))
  } else {
    // Fallback: discovery через SerpAPI + Haiku (для старых карточек без subreddits)
    const discoveryResults = await fetchFromSource(
      `${nicheQueryPart} ${kw} site:reddit.com`,
      'google',
      serpApiKey,
      { num: '30' }
    )
    serpCalls = 1

    const subredditCounts = new Map<string, number>()
    for (const r of discoveryResults) {
      const url = r.link || ''
      const match = url.match(/reddit\.com\/r\/([^/]+)/)
      if (match) {
        const sub = match[1].toLowerCase()
        subredditCounts.set(sub, (subredditCounts.get(sub) || 0) + 1)
      }
    }

    const subreddits = Array.from(subredditCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

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
              query: `site:reddit.com/${s.name} ${nicheQueryPart}`,
            }))
        }
      } catch (e) {
        console.warn('[Block1 Pass1] Haiku source validation failed, using frequency-based fallback')
      }
    }

    if (validatedSources.length === 0 && subreddits.length > 0) {
      validatedSources = subreddits.slice(0, 3).map(([sub]) => ({
        type: 'subreddit' as const,
        name: `r/${sub}`,
        relevance: 6,
        query: `site:reddit.com/r/${sub} ${nicheQueryPart} complaints OR frustrated OR "looking for alternative"`,
      }))
    }
  }

  // Review sites — без pain words, G2/Trustpilot и так содержат отзывы
  const reviewSources: DiscoveredSource[] = [
    { type: 'review_site', name: 'g2.com', relevance: 9, query: `site:g2.com ${nicheQueryPart}` },
    { type: 'review_site', name: 'trustpilot.com', relevance: 7, query: `site:trustpilot.com ${nicheQueryPart}` },
  ]

  // Quora — убираем pain words
  const generalSources: DiscoveredSource[] = [
    { type: 'forum', name: 'quora.com', relevance: 6, query: `site:quora.com ${nicheQueryPart}` },
  ]

  return {
    sources: [...validatedSources, ...reviewSources, ...generalSources],
    serpCalls,
  }
}

/**
 * Pass 1b: Collect posts from validated sources + native APIs
 */
async function collectFromSources(
  sources: DiscoveredSource[],
  niche: string,
  keywords: string[],
  serpApiKey: string,
  tbs: string = 'qdr:3m',
  collectionPeriod: 'recent' | 'historical' = 'recent',
  competitors: string[] = []
): Promise<{ posts: RawPost[]; serpCalls: number }> {
  const posts: RawPost[] = []
  const seen = new Set<string>()

  // ── 1. Site-specific queries (до 8 источников, по 30 результатов) ──
  const serpQueries = sources.slice(0, 8)
  const serpResults = await Promise.all(
    serpQueries.map(s =>
      fetchFromSource(s.query, 'google', serpApiKey, { tbs, num: '30' })
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
        collection_period: collectionPeriod,
      })
    }
  }

  // ── 2. Широкие запросы без site: — ловят блоги, форумы, Medium, etc. ──
  const nicheQueryPart = niche.split(/\s+/).length <= 2
    ? `"${niche}"`
    : niche.split(/\s+/).filter(w => w.length > 2).join(' ')

  const broadQueries: string[] = [
    // Широкий поиск по нише + общие review/problem сигналы
    `${nicheQueryPart} review OR problem OR alternative OR switching`,
  ]

  // Если есть конкуренты — запрос по их именам (самые ценные данные)
  if (competitors.length > 0) {
    const topCompetitors = competitors.slice(0, 5).map(c => `"${c}"`).join(' OR ')
    broadQueries.push(`${topCompetitors} problem OR issue OR alternative OR switching OR vs`)
  }

  // Ещё один запрос с keywords
  const kw = keywords.slice(0, 3)
  if (kw.length > 0) {
    broadQueries.push(`${kw.join(' ')} review OR frustrating OR alternative`)
  }

  const broadResults = await Promise.all(
    broadQueries.map(q =>
      fetchFromSource(q, 'google', serpApiKey, { tbs, num: '30' })
    )
  )

  for (const results of broadResults) {
    for (const r of results) {
      const url = r.link || r.url || ''
      if (!url || seen.has(url)) continue
      seen.add(url)

      // Определяем source по URL
      const urlLower = url.toLowerCase()
      const sourceType = urlLower.includes('reddit.com') ? 'reddit'
        : urlLower.includes('g2.com') ? 'g2'
        : urlLower.includes('trustpilot.com') ? 'trustpilot'
        : urlLower.includes('quora.com') ? 'quora'
        : urlLower.includes('news.ycombinator.com') ? 'hackernews'
        : urlLower.includes('stackoverflow.com') ? 'stackoverflow'
        : 'quora' // fallback — низкий вес для неизвестных источников

      posts.push({
        source: sourceType as RawPost['source'],
        text: r.snippet || r.description || '',
        link: url,
        upvotes: r.upvotes || 0,
        date: r.date || '',
        collection_period: collectionPeriod,
      })
    }
  }

  // ── 3. Native APIs (0 SerpAPI calls) ──
  const kwNative = keywords.slice(0, 2)
  const [hnPosts, soPosts] = await Promise.all([
    fetchHackerNewsNative([
      `${niche} problem`,
      `${niche} frustrating`,
      `${niche} alternative`,
      `${kwNative[0] || niche} issue`,
    ], 50),
    fetchStackExchangeNative([
      `${niche} error problem`,
      `${kwNative[0] || niche} issue not working`,
    ], 40),
  ])

  for (const post of [...hnPosts, ...soPosts]) {
    if (!seen.has(post.link)) {
      seen.add(post.link)
      posts.push({ ...post, collection_period: collectionPeriod })
    }
  }

  return {
    posts: posts.slice(0, 300),
    serpCalls: serpQueries.length + broadQueries.length,
  }
}

// ══════════════════════════════════════════════════════════════
// PASS 2 — ВАЛИДАЦИЯ РЕЛЕВАНТНОСТИ + КЛАССИФИКАЦИЯ
// Haiku получает контекст ниши и проверяет каждый пост
// ══════════════════════════════════════════════════════════════

type ValidationCategory = PainCategory | 'irrelevant'

interface ValidationResult {
  is_relevant: boolean
  category: PainCategory
  pain_summary: string
  mentioned_product: string
  failed?: boolean
}

/**
 * Pass 2: Validate relevance AND classify in one call
 * Haiku знает нишу, конкурентов и конкретные критерии is_relevant
 */
async function validateAndClassifyBatch(
  posts: RawPost[],
  niche: string,
  competitors: string[]
): Promise<{ results: ValidationResult[]; failed: boolean }> {
  if (posts.length === 0) return { results: [], failed: false }

  const competitorsList = competitors.length > 0
    ? `Известные продукты/конкуренты в нише: ${competitors.slice(0, 10).join(', ')}`
    : ''

  const postsText = posts
    .map((p, i) => `[${i}] [${p.source}] ${p.text.slice(0, 400)}`)
    .join('\n\n')

  // Извлекаем ключевые слова ниши для контекста (без стоп-слов вроде "comparison", "best", "top")
  const NICHE_NOISE_WORDS = new Set(['comparison','best','top','review','reviews','list','guide','vs','versus','alternative','alternatives','software','tool','tools','app','apps','platform','platforms','solution','solutions'])
  const nicheCore = niche.split(/\s+/).filter(w => !NICHE_NOISE_WORDS.has(w.toLowerCase())).join(' ') || niche

  const prompt = `Ты анализируешь посты из интернета для исследования рынка.

РЫНОК/НИША: "${nicheCore}" (полный запрос: "${niche}")
${competitorsList}

ЗАДАЧА: Для каждого поста определи — содержит ли он реальную проблему, жалобу или неудовлетворённость
связанную с продуктами, инструментами или процессами в области "${nicheCore}".

ВАЖНО: Мы ищем ЛЮБЫЕ боли пользователей в этой области. Пост не обязан точно
совпадать с формулировкой "${niche}" — достаточно что он про ту же предметную область.

КРИТЕРИИ is_relevant = true (достаточно ОДНОГО):
- Упоминает конкретный продукт/инструмент из этой области с негативом или проблемой
- Описывает боль/задачу которую должны решать продукты в этой области
- Ищет альтернативу существующему решению
- Жалуется на процесс который автоматизируют продукты в этой области
- Сравнивает продукты с негативом хотя бы об одном
- Описывает неудовлетворённость ценой, качеством или функционалом

КРИТЕРИИ is_relevant = false:
- Пост вообще не связан с областью "${nicheCore}"
- Чисто позитивный отзыв без единой проблемы
- Реклама или спам
- Новостная статья без личного опыта пользователя
- Общий вопрос вроде "what is the best X?" без описания проблемы

КАТЕГОРИИ (выбери одну):
- "bad_solution" — решение существует но плохое (баги, неудобно, медленно, дорого)
- "no_solution" — решения не существует или не нашли подходящего
- "expensive_solution" — решение есть но недоступно по цене
- "irrelevant" — пост не релевантен нише (когда is_relevant = false)

ПОСТЫ ДЛЯ АНАЛИЗА:
${postsText}

Верни СТРОГО валидный JSON массив из ровно ${posts.length} объектов.
Без markdown, без пояснений, только JSON:

[
  {
    "is_relevant": true,
    "category": "bad_solution",
    "pain_summary": "Краткое описание боли на русском, макс 10 слов. Пустая строка если irrelevant.",
    "mentioned_product": "Название продукта если упомянут. Пустая строка если нет."
  }
]`

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      system: 'Отвечай только валидным JSON без markdown и пояснений.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : '[]'
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

    const validCategories: ValidationCategory[] = ['no_solution', 'bad_solution', 'expensive_solution', 'irrelevant']
    const painCategories: PainCategory[] = ['no_solution', 'bad_solution', 'expensive_solution']

    return {
      results: parsed.map((r: any) => {
        const rawCategory = validCategories.includes(r?.category) ? r.category : 'irrelevant'
        const isRelevant = r?.is_relevant === true && rawCategory !== 'irrelevant'
        return {
          is_relevant: isRelevant,
          category: painCategories.includes(rawCategory) ? rawCategory as PainCategory : 'bad_solution',
          pain_summary: typeof r?.pain_summary === 'string' ? r.pain_summary.slice(0, 100) : '',
          mentioned_product: typeof r?.mentioned_product === 'string' ? r.mentioned_product.slice(0, 50) : '',
        }
      }),
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
  source: string,
  competitors?: string[]
): { is_paying: boolean; confidence: PayingConfidence; weight: number } {
  const SAFE_TEXT = text.slice(0, 1000)
  const lowerText = SAFE_TEXT.toLowerCase()

  // ── Regex-based boost ──────────────────────────────────────
  const highSignals = [
    /я (использую|использовал|платил|подписан|купил|плачу)/i,
    /мой (аккаунт|тариф|план|подписка)/i,
    /после (обновления|перехода на|миграции с)/i,
    /\$\d+.*(месяц|год|mo|yr|month|year)/i,
    /(отменил|отписался|ушёл с|перешёл с|switched from|cancelled)/i,
    /(i (use|used|pay|paid|subscribed|bought))/i,
    /(my (account|plan|subscription|tier))/i,
  ]

  const mediumSignals = [
    /(баг|глюк|не работает|сломали|bug|broken|doesn't work)/i,
    /(поддержка|саппорт|support) (не отвечает|игнорирует|useless|awful)/i,
    /(после обновления|after update|since the update)/i,
  ]

  const competitorSignals = competitors?.map((c) => c.toLowerCase()) || []

  const isHigh = highSignals.some((r) => r.test(SAFE_TEXT))
  const isMedium =
    mediumSignals.some((r) => r.test(SAFE_TEXT)) ||
    competitorSignals.some((c) => lowerText.includes(c))

  // Regex boost: 0.9 (high), 0.5 (medium), 0.0 (none)
  const regexBoost = isHigh ? 0.9 : isMedium ? 0.5 : 0.0

  // ── Combined score: Math.max(sourceBase, regexBoost) ───────
  const sourceBase = SOURCE_PAYING_PROBABILITY[source] ?? 0.10
  const combinedScore = Math.max(sourceBase, regexBoost)

  // Map combined score to confidence levels
  if (combinedScore >= 0.7) return { is_paying: true, confidence: 'high', weight: 10 }
  if (combinedScore >= 0.4) return { is_paying: true, confidence: 'medium', weight: 5 }
  return { is_paying: false, confidence: 'low', weight: 1 }
}

// ══════════════════════════════════════════════════════════════
// GOOGLE TRENDS — СОБСТВЕННЫЙ ЗАПРОС БЛОКА 1
// Block 1 не может читать Block 2 (параллельный запуск в Wave 1)
// Поэтому делаем свой запрос: today 12-m, сравниваем last 3m vs prev 3m
// ══════════════════════════════════════════════════════════════

interface TrendsDynamics {
  dynamics: Dynamics
  ratio: number            // last3m_avg / prev3m_avg
  last3m_avg: number
  prev3m_avg: number
  has_data: boolean
}

async function fetchGoogleTrendsDynamics(
  niche: string,
  keywords: string[],
  serpApiKey: string
): Promise<{ result: TrendsDynamics; serpCalls: number }> {
  const query = `${niche} ${keywords.slice(0, 2).join(' ')}`.trim()
  const fallback: TrendsDynamics = { dynamics: 'stable', ratio: 1.0, last3m_avg: 0, prev3m_avg: 0, has_data: false }

  try {
    const params = new URLSearchParams({
      engine: 'google_trends',
      q: query,
      data_type: 'TIMESERIES',
      date: 'today 12-m',
      api_key: serpApiKey,
    })

    const res = await fetch(`https://serpapi.com/search?${params}`)
    if (!res.ok) return { result: fallback, serpCalls: 1 }

    const data = await res.json()
    const timelineData = data.interest_over_time?.timeline_data

    if (!Array.isArray(timelineData) || timelineData.length < 12) {
      return { result: fallback, serpCalls: 1 }
    }

    // Каждый элемент = ~1 неделя, 52 недели в году
    // last 3 months ≈ последние 13 точек, prev 3 months ≈ 13 точек до них
    const values = timelineData.map((t: any) => {
      const val = t.values?.[0]?.extracted_value
      return typeof val === 'number' ? val : 0
    })

    const last3mValues = values.slice(-13)
    const prev3mValues = values.slice(-26, -13)

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0

    const last3m_avg = avg(last3mValues)
    const prev3m_avg = avg(prev3mValues)

    // Ratio: >1.2 = growing, <0.8 = declining, else stable
    const ratio = prev3m_avg > 0 ? last3m_avg / prev3m_avg : 1.0

    const dynamics: Dynamics = ratio > 1.2 ? 'growing' : ratio < 0.8 ? 'declining' : 'stable'

    return {
      result: { dynamics, ratio: Math.round(ratio * 100) / 100, last3m_avg, prev3m_avg, has_data: true },
      serpCalls: 1,
    }
  } catch (error) {
    console.warn('[Block1 Trends] Google Trends fetch failed:', error)
    return { result: fallback, serpCalls: 1 }
  }
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
  totalBatches: number,
  trendsDynamics: TrendsDynamics,
  painIschronic: boolean
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

  // Взвешенный скор: sourceWeight × (1 + engagementBonus)
  const weightedComplaintsScore = relevantPosts.reduce((sum, p) => sum + p.weighted_score, 0)

  const postsWithDates = relevantPosts.filter((p) => p.date && p.date.trim() !== '')
  const has_date_confidence = postsWithDates.length >= 10

  // Динамика — приоритет Google Trends, fallback на даты постов
  const dynamics: Dynamics = trendsDynamics.has_data
    ? trendsDynamics.dynamics
    : (!has_date_confidence
      ? 'stable'
      : (() => {
          const now = Date.now()
          const fourWeeksAgo = now - 28 * 24 * 60 * 60 * 1000
          const recent = postsWithDates.filter(
            (p) => new Date(p.date).getTime() > fourWeeksAgo
          ).length
          const older = postsWithDates.length - recent
          return recent > older * 1.3 ? 'growing' : recent < older * 0.7 ? 'declining' : 'stable'
        })()
    )

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
      weighted_complaints_score: Math.round(weightedComplaintsScore * 10) / 10,
      by_source: bySource,
      dynamics,
      dynamics_ratio: trendsDynamics.ratio,
      pain_is_chronic: painIschronic,
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
  const wScore = layer1.weighted_complaints_score

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

  // Хроническая боль как бонус
  const chronicBonus = layer1.pain_is_chronic ? 0.5 : 0

  // Динамика как фактор
  const dynamicsLabel = layer1.dynamics === 'growing'
    ? `📈 Растёт (×${layer1.dynamics_ratio})`
    : layer1.dynamics === 'declining'
    ? `📉 Падает (×${layer1.dynamics_ratio})`
    : `➡️ Стабильно (×${layer1.dynamics_ratio})`

  // ── 1. GREEN — stealing the market ───────────────────────
  // Requires: strong bad_solution signal + paying users + sufficient weighted data + cross-validated
  if (
    layer2.distribution.bad_solution >= 55 &&
    layer3.paying_score >= 40 &&
    wScore >= 60 &&  // weighted score вместо validTotal >= 30
    (highConfClusters >= 1 || medConfClusters >= 2)
  ) {
    const confBonus = classificationConfidence === 'high' ? 0.5 : classificationConfidence === 'medium' ? 0 : -0.5
    const growthBonus = layer1.dynamics === 'growing' ? 0.5 : 0
    return {
      diagnosis: 'green',
      score: Math.min(10, 6 +
        (layer2.distribution.bad_solution - 55) / 20 +
        (layer3.paying_score - 40) / 50 +
        highConfClusters * 0.3 +
        confBonus +
        growthBonus +
        chronicBonus
      ),
      conflict_weight: 1,
      key_factors: [
        `${layer2.distribution.bad_solution}% жалуются на плохую реализацию`,
        `Paying score: ${layer3.paying_score} (${layer3.paying_ratio}% платящие)`,
        `Взвешенный масштаб: ${wScore} (${validTotal} жалоб из ${Object.keys(layer1.by_source).length} источников)`,
        `${highConfClusters} подтверждённых кластеров болей (3+ источника)`,
        dynamicsLabel,
        layer1.pain_is_chronic ? '🔁 Хроническая боль — проблема существует давно' : '',
        `Контекст: ${layer3.context.toUpperCase()} | Качество данных: ${classificationConfidence}`,
      ].filter(Boolean),
      key_metric,
      pain_type: painType,
    }
  }

  // ── 2. RED — рынок угасает ────────────────────────────────
  if (layer1.dynamics === 'declining' && layer3.paying_score < 15) {
    return {
      diagnosis: 'red',
      score: Math.max(1, 2 + wScore / 200),
      conflict_weight: 3,
      key_factors: [
        `${dynamicsLabel} + paying score ${layer3.paying_score}`,
        'Рынок угасает — боль ситуативная или временная',
        `${validTotal} валидных жалоб (взвешенный скор: ${wScore})`,
        layer1.pain_is_chronic ? '⚠️ Боль хроническая, но интерес падает' : '',
      ].filter(Boolean),
      key_metric,
      pain_type: painType,
    }
  }

  // ── 3. YELLOW — educate the market ───────────────────────
  if (layer2.distribution.no_solution >= 55) {
    return {
      diagnosis: 'yellow',
      score: 6 + chronicBonus,
      conflict_weight: 2,
      key_factors: [
        `${layer2.distribution.no_solution}% говорят что решений нет`,
        'Рынок не занят — но требует educate the market',
        `${highConfClusters + medConfClusters} подтверждённых кластеров`,
        dynamicsLabel,
        layer1.pain_is_chronic ? '🔁 Хроническая боль — рынок давно ждёт решения' : '',
      ].filter(Boolean),
      key_metric,
      pain_type: painType,
    }
  }

  // ── 4. YELLOW — данных мало ───────────────────────────────
  if (wScore < 40 || layer3.paying_score < 20) {
    return {
      diagnosis: 'yellow',
      score: Math.min(5, 4 + wScore / 100),
      conflict_weight: 2,
      key_factors: [
        `Слабый сигнал: ${validTotal} жалоб, взвешенный скор ${wScore}`,
        `Низкий paying score: ${layer3.paying_score}`,
        dynamicsLabel,
        `Качество данных: ${classificationConfidence}`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 5. YELLOW — серая зона ────────────────────────────────
  return {
    diagnosis: 'yellow',
    score: 5 + chronicBonus,
    conflict_weight: 2,
    key_factors: [
      `${validTotal} валидных жалоб (взвешенный скор: ${wScore}), смешанная картина`,
      `Paying score: ${layer3.paying_score}`,
      `Преобладает: ${painType}`,
      `${highConfClusters} кластеров high / ${medConfClusters} medium`,
      dynamicsLabel,
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

    const { trend_id, niche, keywords, competitors, relevant_subreddits } = (await req.json()) as {
      trend_id: string
      niche: string
      keywords: string[]
      competitors?: string[]
      relevant_subreddits?: string[]
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
    const { sources, serpCalls: discoveryCalls } = await discoverSources(niche, keywords, SERPAPI_KEY, relevant_subreddits)
    console.log(`[Block1 Pass1] Found ${sources.length} sources (${discoveryCalls} SerpAPI calls)`)

    // ── Двухпериодный сбор + Google Trends параллельно ──────
    const [recentResult, historicalResult, trendsResult] = await Promise.all([
      collectFromSources(sources, niche, keywords, SERPAPI_KEY, 'qdr:3m', 'recent', competitorsList),
      collectFromSources(sources, niche, keywords, SERPAPI_KEY, 'qdr:y', 'historical', competitorsList),
      fetchGoogleTrendsDynamics(niche, keywords, SERPAPI_KEY),
    ])

    const collectCalls = recentResult.serpCalls + historicalResult.serpCalls + trendsResult.serpCalls

    // Дедупликация: recent имеет приоритет
    const seenUrls = new Set<string>()
    const rawPosts: RawPost[] = []

    for (const post of recentResult.posts) {
      seenUrls.add(post.link)
      rawPosts.push(post)
    }
    for (const post of historicalResult.posts) {
      if (!seenUrls.has(post.link)) {
        seenUrls.add(post.link)
        rawPosts.push(post)
      }
    }

    // pain_is_chronic: historical-only постов больше чем recent × 2
    const recentOnlyCount = recentResult.posts.length
    const historicalOnlyCount = historicalResult.posts.filter(p => !recentResult.posts.some(r => r.link === p.link)).length
    const painIsChronic = historicalOnlyCount > recentOnlyCount * 2

    console.log(`[Block1 Pass1] Collected ${rawPosts.length} posts (recent: ${recentOnlyCount}, historical-only: ${historicalOnlyCount}, chronic: ${painIsChronic}) (${collectCalls} SerpAPI calls)`)
    console.log(`[Block1 Trends] Dynamics: ${trendsResult.result.dynamics} (ratio: ${trendsResult.result.ratio})`)

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
    // FIX C — ДЕШЁВЫЙ PRE-FILTER ДО HAIKU
    // Если в тексте поста нет НИ ОДНОГО ключевого слова ниши — выбрасываем.
    // Экономит Haiku-токены на явном мусоре (Stripe Webhooks, PayPal for SaaS и т.д.)
    // ══════════════════════════════════════════════════════════
    // Fix C v3: Умный pre-filter — аббревиатуры + названия конкурентов
    const nicheTokens = niche.split(/\s+/)
    const keywordTokens = keywords.flatMap(k => k.split(/\s+/))
    // Конкуренты добавляются как filter words — посты про "Workday sucks" не должны выбрасываться
    const competitorTokens = competitorsList.flatMap(c => c.split(/\s+/))
    const allTokens = [...nicheTokens, ...keywordTokens, ...competitorTokens]

    // Короткие слова (2-3 буквы) — оставляем, если НЕ стоп-слово
    // "hr", "ai", "crm", "erp", "ux" проходят; "the", "and", "for" нет
    const STOP_WORDS = new Set(['the','and','for','its','are','was','has','had','but','not','you','all','can','her','his','how','may','new','now','old','our','own','she','too','two','use','way','who','why','did','get','got','let','put','run','set','try','say','any','few','per','via','yet','nor','off','out','yes'])
    const filterWords = allTokens
      .filter(w => {
        if (w.length <= 1) return false
        if (w.length <= 3) return !STOP_WORDS.has(w.toLowerCase())
        return true
      })
      .map(w => w.toLowerCase())

    // Добавляем keywords и конкурентов целиком для составных вхождений
    const filterPhrases = [...keywords, ...competitorsList]
      .filter(k => k.includes(' '))
      .map(k => k.toLowerCase())

    const allFilterWords = [...new Set(filterWords)]

    const preFilteredPosts = (allFilterWords.length > 0 || filterPhrases.length > 0)
      ? rawPosts.filter(post => {
          const text = (post.text || '').toLowerCase()
          // Пост должен содержать хотя бы одно ключевое слово ИЛИ фразу
          return allFilterWords.some(word => text.includes(word))
            || filterPhrases.some(phrase => text.includes(phrase))
        })
      : rawPosts

    const preFilterDropped = rawPosts.length - preFilteredPosts.length
    console.log(`[Block1 PreFilter] Keywords: [${allFilterWords.join(', ')}] Phrases: [${filterPhrases.join(', ')}]`)
    if (preFilterDropped > 0) {
      console.log(`[Block1 PreFilter] Dropped ${preFilterDropped}/${rawPosts.length} irrelevant posts (no niche keywords in text)`)
    }

    // ══════════════════════════════════════════════════════════
    // PASS 2 — ВАЛИДАЦИЯ РЕЛЕВАНТНОСТИ + КЛАССИФИКАЦИЯ
    // ══════════════════════════════════════════════════════════
    console.log(`[Block1 Pass2] Validating relevance of ${preFilteredPosts.length} posts...`)

    const BATCH_SIZE = 10
    const MAX_CONCURRENT = 5

    const batches: RawPost[][] = []
    for (let i = 0; i < preFilteredPosts.length; i += BATCH_SIZE) {
      batches.push(preFilteredPosts.slice(i, i + BATCH_SIZE))
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
          const { is_paying, confidence, weight } = detectPayingUser(post.text, post.source, competitorsList)

          // Weighted score: sourceWeight × (1 + engagementBonus)
          const sw = SOURCE_WEIGHT[post.source] ?? 1
          const engagementBonus = SOURCES_WITH_ENGAGEMENT.has(post.source)
            ? Math.log10(post.upvotes + 1)
            : 0
          const weightedScore = sw * (1 + engagementBonus)

          validatedPosts.push({
            ...post,
            is_relevant: validation.is_relevant,
            category: validation.category,
            pain_summary: validation.pain_summary,
            mentioned_product: validation.mentioned_product,
            is_paying: validation.is_relevant ? is_paying : false,
            paying_confidence: confidence,
            paying_weight: validation.is_relevant ? weight : 0,
            weighted_score: validation.is_relevant ? weightedScore : 0,
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
      batches.length,
      trendsResult.result,
      painIsChronic
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
          pre_filter_dropped: preFilterDropped,
          sent_to_validation: preFilteredPosts.length,
          validated_relevant: relevantCount,
          relevance_rate: relevanceRate,
          cross_validated_clusters: clusters.length,
          high_confidence_clusters: highConfClusters,
          queries_used: sources.map(s => s.query),
          subreddits_used: sources.filter(s => s.type === 'subreddit').map(s => s.name),
          pre_filter_keywords: [...allFilterWords, ...filterPhrases],
        },
        // Intelligence Layer — плоские поля для Sonnet промпта
        niche,
        dynamics: layer1.dynamics,
        pain_is_chronic: painIsChronic,
        distribution: layers.layer2.distribution,
        weighted_complaints_score: layer1.weighted_complaints_score,
        paying_score: layer3.paying_score,
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
      score: Math.max(0, Math.min(10, Math.round(Number.isFinite(output.score) ? output.score : 0))),
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

    // ── Fix D: Отдельные массивы для UI ─────────────────────
    // paying_signals — посты платящих пользователей (для "Текущие решения")
    const relevantValidated = validatedPosts.filter(p => p.is_relevant)
    const payingSignals = relevantValidated
      .filter(p => p.is_paying)
      .sort((a, b) => b.paying_weight - a.paying_weight)
      .slice(0, 10)
      .map(p => ({
        text: p.text.slice(0, 300),
        source: p.source,
        link: p.link,
        paying_confidence: p.paying_confidence,
        mentioned_product: p.mentioned_product,
        upvotes: p.upvotes,
      }))

    // competitor_mentions — агрегация упоминаний конкурентов
    const competitorCounts = new Map<string, { count: number; negativeCount: number }>()
    for (const post of relevantValidated) {
      if (post.mentioned_product) {
        const product = post.mentioned_product.toLowerCase()
        const existing = competitorCounts.get(product) || { count: 0, negativeCount: 0 }
        existing.count++
        if (post.category === 'bad_solution' || post.category === 'expensive_solution') {
          existing.negativeCount++
        }
        competitorCounts.set(product, existing)
      }
    }

    const competitorMentions = Array.from(competitorCounts.entries())
      .filter(([, v]) => v.count >= 2) // минимум 2 упоминания
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([competitor, { count, negativeCount }]) => ({
        competitor,
        mention_count: count,
        sentiment: (negativeCount > count * 0.5 ? 'negative' : 'neutral') as 'negative' | 'neutral',
      }))

    return NextResponse.json({
      success: true,
      public: {
        layer1: output.layers.layer1,
        distribution: output.layers.layer2.distribution,
        top_quotes: previewQuotes,
        pain_clusters_preview: previewClusters,
        // Fix D: отдельные массивы для UI
        paying_signals: payingSignals,
        competitor_mentions: competitorMentions,
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
