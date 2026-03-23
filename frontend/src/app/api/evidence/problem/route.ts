// src/app/api/evidence/problem/route.ts
// Блок 1 — Проблема
// Главный вопрос: "Решений нет или решения плохие?"
// Версия: финальная — все правки + code review исправления

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

interface RawPost {
  source: 'reddit' | 'quora' | 'g2' | 'appstore' | 'trustpilot' | 'hackernews' | 'stackoverflow'
  text: string
  link: string
  upvotes: number
  date: string
}

interface ClassifiedPost extends RawPost {
  category: PainCategory
  is_paying: boolean
  paying_confidence: PayingConfidence
  paying_weight: number
}

interface Layer1Data {
  total_complaints: number
  by_source: Record<string, number>
  dynamics: Dynamics
  has_date_confidence: boolean      // #6: флаг достаточности дат для динамики
  posts_with_dates_count: number    // #6: сколько постов имели реальные даты
}

interface Layer2Data {
  distribution: Record<PainCategory, number>   // проценты 0-100
  top_quotes: Record<PainCategory, Quote[]>
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
    classification_confidence: 'high' | 'low'   // #5: флаг качества классификации
  }
  layers: {
    layer1: Layer1Data
    layer2: Layer2Data
    layer3: Layer3Data
  }
  raw_data: { posts: ClassifiedPost[] }
}

// ══════════════════════════════════════════════════════════════
// СБОР ДАННЫХ
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

/**
 * HackerNews Algolia API — бесплатный, без ключей, без лимитов
 * Поиск по stories и comments. Возвращает до 100 результатов за запрос.
 * Документация: https://hn.algolia.com/api
 */
async function fetchHackerNewsNative(
  queries: string[],
  maxResults: number = 50
): Promise<RawPost[]> {
  const posts: RawPost[] = []
  const seen = new Set<string>()

  // Два типа поиска: story (заголовки) и comment (глубокие жалобы в комментах)
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

      // story: title + optional comment_text. comment: comment_text
      const text = hit.comment_text
        ? hit.comment_text.replace(/<[^>]*>/g, '').slice(0, 500) // strip HTML tags
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

/**
 * StackExchange API — бесплатный без ключа (300 запросов/день), 10k с ключом.
 * Поиск вопросов по тегам и тексту.
 * Фильтр: вопросы с >= 1 ответом (validated pain).
 */
async function fetchStackExchangeNative(
  queries: string[],
  maxResults: number = 40
): Promise<RawPost[]> {
  const posts: RawPost[] = []
  const seen = new Set<string>()

  const keyParam = process.env.STACKEXCHANGE_KEY
    ? `&key=${process.env.STACKEXCHANGE_KEY}`
    : ''

  // Поиск по каждому запросу
  const fetches = queries.map((q) =>
    fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(q)}&answers=1&pagesize=30&site=stackoverflow&filter=withbody${keyParam}`,
      { headers: { 'Accept-Encoding': 'gzip' } }
    )
      .then(async (r) => {
        // StackExchange возвращает gzip — fetch обрабатывает автоматически
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

      // body содержит HTML — стрипаем теги, берём первые 500 символов
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
// СБОР ДАННЫХ — КОМБО: нативные API + SerpAPI
// ══════════════════════════════════════════════════════════════

async function collectPosts(
  niche: string,
  keywords: string[],
  serpApiKey: string
): Promise<RawPost[]> {
  // Генерируем несколько вариаций поисковых запросов
  const painKeywords = ['problem', 'issue', 'frustrating', 'broken', 'hate', 'alternative', 'bad experience', 'looking for']
  const baseQuery = `${niche} ${keywords.slice(0, 2).join(' ')}`

  // SerpAPI запросы — расширенные (3 месяца вместо 1, больше вариаций)
  const serpQueries = {
    // Reddit: 2 запроса с разными формулировками, 3 месяца
    reddit1: `site:reddit.com ${baseQuery} ${painKeywords[0]} OR ${painKeywords[1]} OR ${painKeywords[2]}`,
    reddit2: `site:reddit.com ${baseQuery} ${painKeywords[5]} OR ${painKeywords[6]} OR ${painKeywords[7]}`,
    // Quora: 2 запроса
    quora1: `site:quora.com ${baseQuery} problem OR issue OR frustrated`,
    quora2: `site:quora.com ${niche} alternative OR better OR replacement`,
    // G2 + Trustpilot: review sites (без ограничения по времени)
    g2: `site:g2.com ${niche} reviews "1 star" OR "2 stars" OR "worst"`,
    trustpilot: `site:trustpilot.com ${niche} review`,
  }

  // Нативные API запросы
  const nativeQueries = {
    hn: [
      `${niche} problem`,
      `${niche} frustrating`,
      `${niche} alternative`,
      `${keywords[0] || niche} issue`,
    ],
    so: [
      `${niche} error problem`,
      `${keywords[0] || niche} issue not working`,
    ],
  }

  // Параллельный запуск ВСЕХ источников
  const [
    reddit1, reddit2,
    quora1, quora2,
    g2Results, trustpilotResults,
    hnPosts, soPosts,
  ] = await Promise.all([
    // SerpAPI (6 запросов, расширенное окно 3 месяца)
    fetchFromSource(serpQueries.reddit1, 'google', serpApiKey, { tbs: 'qdr:3m', num: '20' }),
    fetchFromSource(serpQueries.reddit2, 'google', serpApiKey, { tbs: 'qdr:3m', num: '20' }),
    fetchFromSource(serpQueries.quora1, 'google', serpApiKey, { tbs: 'qdr:3m', num: '20' }),
    fetchFromSource(serpQueries.quora2, 'google', serpApiKey, { tbs: 'qdr:3m', num: '20' }),
    fetchFromSource(serpQueries.g2, 'google', serpApiKey, { num: '20' }),
    fetchFromSource(serpQueries.trustpilot, 'google', serpApiKey, { num: '20' }),
    // Нативные API (0 SerpAPI calls)
    fetchHackerNewsNative(nativeQueries.hn, 50),
    fetchStackExchangeNative(nativeQueries.so, 40),
  ])

  const posts: RawPost[] = []
  const seen = new Set<string>()

  function addPost(result: any, source: RawPost['source']) {
    const url = result.link || result.url || ''
    if (!url || seen.has(url)) return
    seen.add(url)
    posts.push({
      source,
      text: result.snippet || result.description || '',
      link: url,
      upvotes: result.upvotes || 0,
      date: result.date || '',
    })
  }

  // SerpAPI результаты
  reddit1.forEach((r) => addPost(r, 'reddit'))
  reddit2.forEach((r) => addPost(r, 'reddit'))
  quora1.forEach((r) => addPost(r, 'quora'))
  quora2.forEach((r) => addPost(r, 'quora'))
  g2Results.forEach((r) => addPost(r, 'g2'))
  trustpilotResults.forEach((r) => addPost(r, 'trustpilot'))

  // Нативные API результаты (уже в формате RawPost, но дедупликация по URL)
  for (const post of hnPosts) {
    if (!seen.has(post.link)) {
      seen.add(post.link)
      posts.push(post)
    }
  }
  for (const post of soPosts) {
    if (!seen.has(post.link)) {
      seen.add(post.link)
      posts.push(post)
    }
  }

  return posts.slice(0, 200) // увеличен лимит: было 100
}

// ══════════════════════════════════════════════════════════════
// ЭВРИСТИКА ПЛАТЯЩЕГО ПОЛЬЗОВАТЕЛЯ
// ══════════════════════════════════════════════════════════════

function detectPayingUser(
  text: string,
  competitors?: string[]
): { is_paying: boolean; confidence: PayingConfidence; weight: number } {
  // #2: Ограничиваем длину текста для защиты от медленных RegExp на длинных строках
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

  // #2: Regex паттерны для общих сигналов, indexOf для конкурентов — типобезопасно
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

  // #2: Конкуренты проверяются через includes — без RegExp, типобезопасно
  const isMedium =
    regexMediumSignals.some((r) => r.test(SAFE_TEXT)) ||
    competitorSignals.some((c) => lowerText.includes(c))

  const isLow = lowSignals.some((r) => r.test(SAFE_TEXT))

  if (isHigh) return { is_paying: true, confidence: 'high', weight: 10 }
  if (isMedium && !isLow) return { is_paying: true, confidence: 'medium', weight: 5 }
  return { is_paying: false, confidence: 'low', weight: 1 }
}

// ══════════════════════════════════════════════════════════════
// КЛАССИФИКАЦИЯ БАТЧАМИ (Haiku)
// ══════════════════════════════════════════════════════════════

async function classifyBatch(posts: RawPost[]): Promise<PainCategory[]> {
  const postsText = posts
    .map((p, i) => `[${i}] ${p.text.slice(0, 300)}`)
    .join('\n\n')

  try {
    const response = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system: 'Отвечай только валидным JSON без markdown и пояснений.',
      messages: [
        {
          role: 'user',
          content: `Классифицируй каждый пост по категории боли пользователя.

Категории:
- no_solution: жалуется что решения не существует вообще
- bad_solution: решение есть но плохо реализовано (баги, плохой UX, медленно, неудобно)
- expensive_solution: решение есть но слишком дорогое или недоступное

Посты:
${postsText}

Ответь JSON массивом из ${posts.length} строк:
["bad_solution", "no_solution", ...]`,
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const cleaned = text.replace(/```json|```/g, '').trim()

    // #3: Валидация JSON — отдельный try-catch + проверка длины массива
    let result: unknown
    try {
      result = JSON.parse(cleaned)
    } catch (parseError) {
      console.error('[Block1] JSON parse error', { cleaned, error: parseError })
      return posts.map(() => 'bad_solution' as PainCategory)
    }

    if (!Array.isArray(result) || result.length !== posts.length) {
      console.warn('[Block1] Classification count mismatch', {
        expected: posts.length,
        received: Array.isArray(result) ? result.length : 'not-array',
      })
      return posts.map(() => 'bad_solution' as PainCategory)
    }

    return result.map((r: any) =>
      ['no_solution', 'bad_solution', 'expensive_solution'].includes(r)
        ? (r as PainCategory)
        : ('bad_solution' as PainCategory)
    )
  } catch (error) {
    console.error('[Block1] classifyBatch error', error)
    return posts.map(() => 'bad_solution' as PainCategory)
  }
}

// ══════════════════════════════════════════════════════════════
// АГРЕГАЦИЯ
// ══════════════════════════════════════════════════════════════

function aggregate(
  posts: ClassifiedPost[],
  classificationFailedBatches: number
): {
  layer1: Layer1Data
  layer2: Layer2Data
  layer3: Layer3Data
  classificationConfidence: 'high' | 'low'
} {
  const total = posts.length

  // ── Layer 1: масштаб ──────────────────────────────────────
  const bySource = posts.reduce(
    (acc, p) => {
      acc[p.source] = (acc[p.source] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // #6: Флаг достаточности дат для расчёта динамики
  const postsWithDates = posts.filter((p) => p.date && p.date.trim() !== '')
  const has_date_confidence = postsWithDates.length >= 10

  const dynamics: Dynamics = !has_date_confidence
    ? 'stable'
    : (() => {
        const now = Date.now()
        const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000
        const recent = postsWithDates.filter(
          (p) => new Date(p.date).getTime() > twoWeeksAgo
        ).length
        const older = postsWithDates.length - recent
        return recent > older * 1.3 ? 'growing' : recent < older * 0.7 ? 'declining' : 'stable'
      })()

  // ── Layer 2: природа боли ─────────────────────────────────
  const counts = { no_solution: 0, bad_solution: 0, expensive_solution: 0 }
  posts.forEach((p) => counts[p.category]++)

  const distribution: Record<PainCategory, number> = {
    no_solution: Math.round((counts.no_solution / total) * 100),
    bad_solution: Math.round((counts.bad_solution / total) * 100),
    expensive_solution: Math.round((counts.expensive_solution / total) * 100),
  }

  const categories: PainCategory[] = ['no_solution', 'bad_solution', 'expensive_solution']
  const top_quotes: Record<PainCategory, Quote[]> = {
    no_solution: [],
    bad_solution: [],
    expensive_solution: [],
  }
  categories.forEach((cat) => {
    top_quotes[cat] = posts
      .filter((p) => p.category === cat)
      .sort((a, b) => b.upvotes - a.upvotes)
      .slice(0, 3)
      .map((p) => ({
        text: p.text.slice(0, 200),
        link: p.link,
        upvotes: p.upvotes,
        source: p.source,
      }))
  })

  // ── Layer 3: контекст ─────────────────────────────────────
  const payingPosts = posts.filter((p) => p.is_paying)
  const paying_score = payingPosts.reduce((sum, p) => sum + p.paying_weight, 0)

  // #10: Защита от деления на 0
  const paying_ratio = total > 0 ? Math.round((payingPosts.length / total) * 100) : 0

  const b2bCount = posts.filter((p) =>
    /(team|company|enterprise|business|org|organization|employee|staff)/i.test(p.text)
  ).length
  const context: Context =
    b2bCount / total > 0.6 ? 'b2b' : b2bCount / total < 0.2 ? 'b2c' : 'mixed'

  // #5: Уверенность классификации — низкая если были проваленные батчи
  const classificationConfidence: 'high' | 'low' =
    classificationFailedBatches === 0 ? 'high' : 'low'

  return {
    layer1: {
      total_complaints: total,
      by_source: bySource,
      dynamics,
      has_date_confidence,
      posts_with_dates_count: postsWithDates.length,
    },
    layer2: { distribution, top_quotes },
    layer3: { paying_score, paying_ratio, context },
    classificationConfidence,
  }
}

// ══════════════════════════════════════════════════════════════
// ДИАГНОЗ — ПРАВИЛЬНЫЙ ПОРЯДОК ВЕТОК
// ══════════════════════════════════════════════════════════════

function makeDiagnosis(layers: {
  layer1: Layer1Data
  layer2: Layer2Data
  layer3: Layer3Data
}): DiagnosisResult {
  const { layer1, layer2, layer3 } = layers

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

  // ── 1. GREEN — stealing the market ───────────────────────
  // #7: Добавлен total_complaints >= 50 — при малой выборке GREEN недостоверен
  if (
    layer2.distribution.bad_solution >= 60 &&
    layer3.paying_score >= 40 &&
    layer1.total_complaints >= 50
  ) {
    return {
      diagnosis: 'green',
      score: Math.min(
        10,
        6 +
          (layer2.distribution.bad_solution - 60) / 20 +
          (layer3.paying_score - 40) / 50
      ),
      conflict_weight: 1,
      key_factors: [
        `${layer2.distribution.bad_solution}% жалуются на плохую реализацию`,
        `Paying score: ${layer3.paying_score} (${layer3.paying_ratio}% платящие)`,
        `Контекст: ${layer3.context.toUpperCase()}`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 2. RED — рынок угасает ────────────────────────────────
  // Для RED не требуем >= 50 постов: угасающий рынок с низким paying_score
  // важно показать даже при малой выборке — это предупреждение.
  if (layer1.dynamics === 'declining' && layer3.paying_score < 15) {
    return {
      diagnosis: 'red',
      score: Math.max(1, 2 + layer1.total_complaints / 200),
      conflict_weight: 3,
      key_factors: [
        `Динамика падает + paying score ${layer3.paying_score}`,
        'Рынок угасает — боль ситуативная или временная',
        `${layer1.total_complaints} жалоб но без платящих пользователей`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 3. YELLOW — educate the market ───────────────────────
  // Высокий % no_solution = рынок не занят, но это другая стратегия.
  if (layer2.distribution.no_solution >= 60) {
    return {
      diagnosis: 'yellow',
      score: 6,
      conflict_weight: 2,
      key_factors: [
        `${layer2.distribution.no_solution}% говорят что решений нет`,
        'Рынок не занят — но требует educate the market',
        `Paying score: ${layer3.paying_score} — люди ещё не платят за решение`,
      ],
      key_metric,
      pain_type: painType,
    }
  }

  // ── 4. YELLOW — данных мало ───────────────────────────────
  if (layer1.total_complaints < 50 || layer3.paying_score < 20) {
    return {
      diagnosis: 'yellow',
      score: Math.min(5, 4 + layer1.total_complaints / 100),
      conflict_weight: 2,
      key_factors: [
        `Только ${layer1.total_complaints} жалоб за 30 дней`,
        `Низкий paying score: ${layer3.paying_score}`,
        `Динамика: ${layer1.dynamics}`,
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
      `${layer1.total_complaints} жалоб, смешанная картина`,
      `Paying score: ${layer3.paying_score}`,
      `Преобладает: ${painType}`,
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
    // #9: Проверка SERPAPI_KEY внутри роута — не антипаттерн throw на импорте
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

    // ── 1. СБОР ДАННЫХ ────────────────────────────────────
    const rawPosts = await collectPosts(niche, keywords, SERPAPI_KEY)

    if (rawPosts.length === 0) {
      return NextResponse.json(
        {
          error: 'Недостаточно данных',
          message: 'Не найдено постов по данной нише. Попробуйте расширить ключевые слова.',
        },
        { status: 422 }
      )
    }

    // ── 2. КЛАССИФИКАЦИЯ БАТЧАМИ С THROTTLING ─────────────
    // #4: MAX_CONCURRENT = 5 — не более 5 параллельных запросов к Haiku
    // При 100 постах = 10 батчей → 2 итерации × 5 параллельных
    const BATCH_SIZE = 10
    const MAX_CONCURRENT = 5

    const batches: RawPost[][] = []
    for (let i = 0; i < rawPosts.length; i += BATCH_SIZE) {
      batches.push(rawPosts.slice(i, i + BATCH_SIZE))
    }

    const allCategories: PainCategory[] = []
    let failedBatchCount = 0

    for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
      const chunk = batches.slice(i, i + MAX_CONCURRENT)
      const results = await Promise.all(chunk.map((b) => classifyBatch(b)))

      // #5: Считаем проваленные батчи для classification_confidence
      // Вариант 1: считаем любой батч где 100% fallback — независимо от размера
      results.forEach((result) => {
        const allFallback = result.every((r) => r === 'bad_solution')
        if (allFallback) {
          failedBatchCount++
        }
        allCategories.push(...result)
      })
    }

    // Логируем проваленные батчи — помогает отследить когда Haiku нестабилен
    if (failedBatchCount > 0) {
      console.warn('[Block1] Classification: some batches failed', {
        totalBatches: batches.length,
        failedBatches: failedBatchCount,
        totalPosts: rawPosts.length,
        confidence: 'low',
      })
    }

    // ── 3. ЭВРИСТИКА + СБОРКА CLASSIFIED POSTS ────────────
    const classifiedPosts: ClassifiedPost[] = rawPosts.map((post, i) => {
      const { is_paying, confidence, weight } = detectPayingUser(post.text, competitors)
      return {
        ...post,
        category: allCategories[i] || 'bad_solution',
        is_paying,
        paying_confidence: confidence,
        paying_weight: weight,
      }
    })

    // ── 4. АГРЕГАЦИЯ ──────────────────────────────────────
    const { layer1, layer2, layer3, classificationConfidence } = aggregate(
      classifiedPosts,
      failedBatchCount
    )
    const layers = { layer1, layer2, layer3 }

    // ── 5. ДИАГНОЗ ────────────────────────────────────────
    const diagnosisResult = makeDiagnosis(layers)

    // ── 6. ФИНАЛЬНЫЙ OUTPUT ───────────────────────────────
    const output: ProblemBlockOutput = {
      diagnosis: diagnosisResult.diagnosis,
      score: diagnosisResult.score,
      conflict_weight: diagnosisResult.conflict_weight,
      key_factors: diagnosisResult.key_factors,
      key_metric: diagnosisResult.key_metric,
      block_context: {
        pain_type: diagnosisResult.pain_type,
        pain_scale: layer1.total_complaints,
        paying_users_ratio: layer3.paying_ratio,
        classification_confidence: classificationConfidence, // #5
      },
      layers,
      raw_data: { posts: classifiedPosts },
    }

    // ── 7. UPSERT В SUPABASE ──────────────────────────────
    // unique(trend_id, user_id, block_number) гарантирует upsert без дублей
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
          layer3: output.layers.layer3,
          key_factors: output.key_factors,
          block_context: output.block_context,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' })

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`)

    // ── 8. ОТВЕТ — PUBLIC + PREVIEW ДАННЫЕ ────────────────
    // Public: достаточно для рендера всех секций (preview)
    // Premium (через /api/evidence/unlock): полные данные + все цитаты

    // Preview: 1 цитата на категорию (вместо 3) — показать что данные есть
    const previewQuotes: Record<string, Quote[]> = {}
    for (const [cat, quotes] of Object.entries(output.layers.layer2.top_quotes)) {
      previewQuotes[cat] = (quotes as Quote[]).slice(0, 1)
    }

    return NextResponse.json({
      success: true,
      public: {
        layer1: output.layers.layer1,
        distribution: output.layers.layer2.distribution,
        top_quotes: previewQuotes,
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
