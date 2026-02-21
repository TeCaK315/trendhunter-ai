/**
 * /api/scan-trends — Variant A: Real Google Trends-Based Trend Discovery
 *
 * Pipeline:
 * 1. Scan seed niches → SerpAPI google_trends RELATED_QUERIES → rising queries
 * 2. Filter noise (non-product queries)
 * 3. GPT classify: "can this be a product/SaaS?"
 * 4. Enrich with timeline data (growth_rate)
 * 5. GPT generate final Trend objects
 * 6. Deduplicate against existing trends
 * 7. Save to /api/trends
 *
 * Budget: ~80 SerpAPI calls per scan cycle (5000/month plan → ~2 cycles/day)
 */

import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const SCAN_SECRET = process.env.SCAN_SECRET || '';

// Category → seed niches for scanning
const CATEGORY_NICHES: Record<string, string[]> = {
  'AI & ML': [
    'AI chatbot', 'AI writing', 'AI code review', 'AI customer service',
    'AI voice assistant', 'AI image generation', 'AI data analysis',
    'AI automation', 'machine learning platform', 'AI agent',
  ],
  'SaaS': [
    'CRM software', 'invoice automation', 'HR software', 'sales automation',
    'marketing automation', 'email automation', 'subscription management',
    'project management', 'workflow automation', 'team collaboration',
  ],
  'FinTech': [
    'cryptocurrency trading', 'personal finance app', 'investment platform',
    'payment processing', 'expense tracking', 'financial planning',
    'tax automation', 'banking API', 'budgeting app',
  ],
  'EdTech': [
    'online learning platform', 'AI tutoring', 'language learning',
    'skill assessment', 'course creation', 'student engagement',
    'education technology', 'coding bootcamp',
  ],
  'HealthTech': [
    'mental health app', 'fitness tracking', 'telemedicine',
    'health monitoring', 'medical scheduling', 'wellness app',
    'patient engagement', 'health data',
  ],
  'E-commerce': [
    'dropshipping', 'inventory management', 'product recommendation',
    'price tracking', 'ecommerce analytics', 'cart abandonment',
    'marketplace platform', 'social commerce',
  ],
  'Technology': [
    'no code', 'API integration', 'developer tools', 'cloud platform',
    'cybersecurity', 'DevOps', 'browser extension', 'productivity tool',
  ],
  'Business': [
    'business analytics', 'supply chain management', 'franchise software',
    'competitive intelligence', 'business process automation', 'consulting tools',
    'market research tool', 'lead generation',
  ],
};

// Words indicating a query is NOT a product opportunity
const NOISE_PATTERNS = [
  // Questions (not product opportunities)
  /^(what is|what are|who is|where is|when is|why is|how to|how do|how does|can i|should i)\b/i,
  // News & Updates
  /\b(news|breaking|update|updates|today|latest|roadmap|announcement)\b/i,
  // People & celebrities
  /\b(biography|net worth|wife|husband|age|death|born|celebrity)\b/i,
  // News events
  /\b(election|scandal|arrested|war|earthquake|hurricane|flood)\b/i,
  // Entertainment
  /\b(movie|film|episode|season|lyrics|song|album|concert|trailer|actress|actor)\b/i,
  // Sports
  /\b(score|game result|championship|nfl|nba|fifa|olympics|match)\b/i,
  // Recipes / food
  /\b(recipe|how to cook|calories in)\b/i,
  // Generic navigational
  /\b(login|sign in|download|free|coupon|discount code|promo)\b/i,
  // Already specific brands (not opportunities)
  /^(google|facebook|amazon|apple|microsoft|netflix|tiktok|instagram|youtube|twitter)\b/i,
  // Too generic informational
  /^(market|industry|sector|economy|global|world|international)\s+(news|report|data|statistics|trends)$/i,
];

// Words suggesting a product/SaaS opportunity
const PRODUCT_SIGNAL_WORDS = [
  'software', 'tool', 'platform', 'app', 'saas', 'automation',
  'api', 'dashboard', 'analytics', 'management', 'tracking',
  'builder', 'generator', 'monitor', 'integration', 'solution',
  'service', 'bot', 'assistant', 'agent', 'ai', 'cloud',
];

interface RisingQuery {
  query: string;
  growth: string; // "Breakout" or "+4200%"
  growthValue: number; // numeric: 999999 for Breakout, else extracted
  sourceNiche: string;
  sourceCategory: string;
}

interface EnrichedQuery extends RisingQuery {
  timelineGrowthRate: number;
  googleTrendsUrl: string;
}

interface ScanResult {
  success: boolean;
  newTrendsCount: number;
  totalScanned: number;
  filteredOut: number;
  gptFiltered: number;
  enriched: number;
  duplicatesSkipped: number;
  serpApiCallsUsed: number;
  scanDurationMs: number;
  categories: string[];
  error?: string;
}

// ==========================================
// Step 1: Fetch Rising Queries from Google Trends
// ==========================================
async function fetchRisingQueries(
  niche: string,
  category: string,
): Promise<{ queries: RisingQuery[]; callsUsed: number }> {
  if (!SERPAPI_KEY) return { queries: [], callsUsed: 0 };

  const params = new URLSearchParams({
    engine: 'google_trends',
    q: niche,
    data_type: 'RELATED_QUERIES',
    date: 'today 12-m',
    api_key: SERPAPI_KEY,
  });

  try {
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) return { queries: [], callsUsed: 1 };

    const data = await response.json();
    if (data.error) return { queries: [], callsUsed: 1 };

    const relatedQueries = data.related_queries as {
      rising?: Array<{ query: string; value?: string; extracted_value?: number }>;
    } | undefined;

    const rising = relatedQueries?.rising || [];

    const queries: RisingQuery[] = rising.map(item => {
      const isBreakout = item.value === 'Breakout';
      return {
        query: item.query,
        growth: item.value || '0',
        growthValue: isBreakout ? 999999 : (item.extracted_value || 0),
        sourceNiche: niche,
        sourceCategory: category,
      };
    });

    return { queries, callsUsed: 1 };
  } catch {
    return { queries: [], callsUsed: 1 };
  }
}

// ==========================================
// Step 2: Basic Noise Filter (no API calls)
// ==========================================
function filterNoise(queries: RisingQuery[]): RisingQuery[] {
  return queries.filter(q => {
    const text = q.query.toLowerCase();

    // Skip very short queries (usually too generic)
    if (text.length < 4) return false;

    // Skip noise patterns
    for (const pattern of NOISE_PATTERNS) {
      if (pattern.test(text)) return false;
    }

    // Prefer queries with product signals (but don't require — GPT will decide)
    // Only skip queries that are purely navigational single words
    if (text.split(/\s+/).length === 1 && !PRODUCT_SIGNAL_WORDS.some(w => text.includes(w))) {
      // Single word without product signals — skip unless growth is massive
      if (q.growthValue < 500) return false;
    }

    return true;
  });
}

// ==========================================
// Step 3: Deduplicate across niches (exact + semantic)
// ==========================================

// Stop-words to ignore when comparing query meanings
const QUERY_STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'must',
  'for', 'of', 'in', 'on', 'at', 'to', 'from', 'by', 'with', 'about',
  'and', 'or', 'but', 'not', 'no', 'so', 'if', 'than', 'too', 'very',
  'this', 'that', 'these', 'those', 'it', 'its',
  'how', 'what', 'which', 'who', 'when', 'where', 'why',
  'vs', 'versus', 'comparison', 'compare', 'review', 'reviews',
  'best', 'top', 'new', 'free', 'online',
  'tool', 'tools', 'software', 'platform', 'app', 'apps', 'service',
  'ai', 'ml', 'saas',
]);

function getSignificantWords(query: string): Set<string> {
  return new Set(
    query.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
      .filter(w => w.length > 2 && !QUERY_STOP_WORDS.has(w))
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) { if (b.has(w)) intersection++; }
  return intersection / (a.size + b.size - intersection);
}

function deduplicateQueries(queries: RisingQuery[]): RisingQuery[] {
  const result: RisingQuery[] = [];

  for (const q of queries) {
    const qWords = getSignificantWords(q.query);
    let isDup = false;

    for (const existing of result) {
      // 1. Exact match
      if (q.query.toLowerCase().trim() === existing.query.toLowerCase().trim()) {
        // Keep higher growth
        if (q.growthValue > existing.growthValue) {
          const idx = result.indexOf(existing);
          result[idx] = q;
        }
        isDup = true;
        break;
      }

      // 2. Word-set similarity (Jaccard >= 0.7 = semantic duplicate)
      const existingWords = getSignificantWords(existing.query);
      if (jaccardSimilarity(qWords, existingWords) >= 0.7) {
        // Keep higher growth
        if (q.growthValue > existing.growthValue) {
          const idx = result.indexOf(existing);
          result[idx] = q;
        }
        isDup = true;
        break;
      }

      // 3. One is a subset of the other (all significant words match)
      if (qWords.size > 0 && existingWords.size > 0) {
        const smallerSet = qWords.size <= existingWords.size ? qWords : existingWords;
        const largerSet = qWords.size <= existingWords.size ? existingWords : qWords;
        let allMatch = true;
        for (const w of smallerSet) { if (!largerSet.has(w)) { allMatch = false; break; } }
        if (allMatch && smallerSet.size >= 2) {
          if (q.growthValue > existing.growthValue) {
            const idx = result.indexOf(existing);
            result[idx] = q;
          }
          isDup = true;
          break;
        }
      }
    }

    if (!isDup) {
      result.push(q);
    }
  }

  return result;
}

// ==========================================
// Step 4: GPT Classification — batch filter
// ==========================================
async function callOpenAI(
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.3,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

async function gptClassifyQueries(
  queries: RisingQuery[],
): Promise<RisingQuery[]> {
  if (!OPENAI_API_KEY || queries.length === 0) return queries;

  // Process in batches of 30
  const batchSize = 30;
  const results: RisingQuery[] = [];

  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const queryList = batch.map((q, idx) =>
      `${idx + 1}. "${q.query}" (рост: ${q.growth}, ниша: ${q.sourceNiche})`
    ).join('\n');

    try {
      const content = await callOpenAI([
        {
          role: 'system',
          content: `Ты строгий аналитик SaaS/Tech стартапов. Тебе дан список растущих поисковых запросов из Google Trends.

Для каждого запроса определи: можно ли создать КОНКРЕТНЫЙ SaaS-продукт, инструмент, платформу или мобильное приложение?

Ответь ТОЛЬКО JSON массивом номеров запросов, которые подходят. Пример: [1, 3, 7]

✅ ПОДХОДЯТ только если:
- Запрос указывает на КОНКРЕТНУЮ ПРОБЛЕМУ пользователей
- Явно нужен программный инструмент/сервис для решения
- Есть чёткая целевая аудитория
- Можно монетизировать через подписку/продажу

❌ НЕ ПОДХОДЯТ (отклонить):
- Вопросы: "what is X", "how to X", "why X"
- Новости и обновления: "X news", "X updates", "X today", "X roadmap"
- Знаменитости, события, развлечения
- Конкретные бренды ("openai", "n8n") - это не проблемы!
- Слишком общие термины: "housing market", "personal finance", "business analytics"
- Образовательные запросы без явной проблемы
- Концепции вместо проблем: "vibe coding", "devops roadmap"

Будь ОЧЕНЬ строгим. Если сомневаешься - НЕ включай в список.`,
        },
        {
          role: 'user',
          content: queryList,
        },
      ], 0.1);

      // Parse JSON array from response
      const match = content.match(/\[[\d,\s]*\]/);
      if (match) {
        const indices: number[] = JSON.parse(match[0]);
        for (const idx of indices) {
          if (idx >= 1 && idx <= batch.length) {
            results.push(batch[idx - 1]);
          }
        }
      }
    } catch (err) {
      console.error('GPT classification error:', err);
      // On error, pass all through (don't lose data)
      results.push(...batch);
    }
  }

  return results;
}

// ==========================================
// Step 4.5: GPT Semantic Deduplication
// ==========================================
async function gptDeduplicateQueries(
  queries: RisingQuery[],
): Promise<RisingQuery[]> {
  if (!OPENAI_API_KEY || queries.length <= 5) return queries;

  // Process all at once (should be < 50 after classification)
  const queryList = queries.map((q, idx) =>
    `${idx + 1}. "${q.query}"`
  ).join('\n');

  try {
    const content = await callOpenAI([
      {
        role: 'system',
        content: `Тебе дан список поисковых запросов. Найди группы запросов, которые означают ОДНО И ТО ЖЕ (одна и та же идея/продукт, просто слова переставлены или слегка изменены).

Примеры дубликатов:
- "CRM comparison tool" и "compare CRM features" и "CRM features comparison" — это ОДНА идея
- "AI email writer" и "email writing AI" и "ai tool for writing emails" — это ОДНА идея
- "invoice automation" и "automated invoicing" и "auto invoice generator" — это ОДНА идея

НО: "CRM comparison" и "CRM integration" — это РАЗНЫЕ идеи!

Для каждой группы дубликатов оставь ОДИН лучший запрос (наиболее конкретный и понятный).

Верни JSON массив номеров запросов, которые нужно ОСТАВИТЬ. Уникальные запросы (без дубликатов) тоже включи.

Пример: если из 10 запросов, 2+3+4 — одна группа (оставляем 2), 7+8 — другая группа (оставляем 7), остальные уникальны:
[1, 2, 5, 6, 7, 9, 10]`,
      },
      {
        role: 'user',
        content: queryList,
      },
    ], 0.1);

    const match = content.match(/\[[\d,\s]*\]/);
    if (match) {
      const keepIndices: number[] = JSON.parse(match[0]);
      const kept = keepIndices
        .filter(idx => idx >= 1 && idx <= queries.length)
        .map(idx => queries[idx - 1]);
      if (kept.length > 0) {
        return kept;
      }
    }
  } catch (err) {
    console.error('GPT deduplication error:', err);
  }

  return queries;
}

// ==========================================
// Step 5: Enrich with Timeline Data
// ==========================================
async function enrichWithTimeline(
  queries: RisingQuery[],
  maxEnrich: number = 25,
): Promise<{ enriched: EnrichedQuery[]; callsUsed: number }> {
  if (!SERPAPI_KEY) return { enriched: [], callsUsed: 0 };

  // Sort by growth (highest first), take top N
  const sorted = [...queries].sort((a, b) => b.growthValue - a.growthValue);
  const toEnrich = sorted.slice(0, maxEnrich);
  let callsUsed = 0;

  const enriched: EnrichedQuery[] = [];

  // Process in parallel batches of 5 to avoid rate limits
  const parallelBatch = 5;
  for (let i = 0; i < toEnrich.length; i += parallelBatch) {
    const batch = toEnrich.slice(i, i + parallelBatch);
    const promises = batch.map(async (q): Promise<EnrichedQuery | null> => {
      const params = new URLSearchParams({
        engine: 'google_trends',
        q: q.query,
        date: 'today 12-m',
        api_key: SERPAPI_KEY,
      });

      try {
        const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
        callsUsed++;
        if (!response.ok) return null;

        const data = await response.json();
        const timelineData = data.interest_over_time?.timeline_data || [];
        if (timelineData.length < 6) return null;

        // Calculate growth rate from timeline
        const values = timelineData.slice(-13, -1).map((point: { values?: Array<{ extracted_value?: number; value?: string }> }) => {
          const vals = point.values || [];
          return vals[0]?.extracted_value ?? parseInt(vals[0]?.value || '0') ?? 0;
        });

        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        const avgOld = firstHalf.reduce((s: number, v: number) => s + v, 0) / firstHalf.length || 1;
        const avgNew = secondHalf.reduce((s: number, v: number) => s + v, 0) / secondHalf.length || 0;
        const timelineGrowthRate = Math.round(((avgNew - avgOld) / avgOld) * 100);

        const searchMetadata = data.search_metadata as { google_trends_url?: string } | undefined;

        return {
          ...q,
          timelineGrowthRate,
          googleTrendsUrl: searchMetadata?.google_trends_url ||
            `https://trends.google.com/trends/explore?q=${encodeURIComponent(q.query)}&date=today%2012-m`,
        };
      } catch {
        callsUsed++;
        return null;
      }
    });

    const results = await Promise.all(promises);
    enriched.push(...results.filter((r): r is EnrichedQuery => r !== null));
  }

  return { enriched, callsUsed };
}

// ==========================================
// Step 6: GPT Generate Final Trend Objects
// ==========================================
async function gptGenerateTrends(
  queries: EnrichedQuery[],
): Promise<Array<{
  title: string;
  category: string;
  popularity_score: number;
  growth_rate: number;
  why_trending: string;
  source_query?: string;
}>> {
  if (!OPENAI_API_KEY || queries.length === 0) return [];

  const queryData = queries.map((q, i) =>
    `${i + 1}. Запрос: "${q.query}" | Рост: ${q.growth} | Timeline рост: ${q.timelineGrowthRate}% | Ниша: ${q.sourceNiche} | Категория: ${q.sourceCategory} | Google Trends: ${q.googleTrendsUrl}`
  ).join('\n');

  try {
    const content = await callOpenAI([
      {
        role: 'system',
        content: `Ты аналитик SaaS/Tech рынка. На основе растущих поисковых запросов из Google Trends, сформулируй конкретные ПРОДУКТОВЫЕ ИДЕИ.

Для каждого запроса создай одну идею SaaS/инструмента. Ответь JSON массивом.

Каждый элемент:
{
  "source_query": "оригинальный запрос",
  "title": "Название продукта на русском (3-7 слов, конкретное и понятное, БЕЗ кавычек)",
  "category": "одна из: AI & ML, SaaS, FinTech, EdTech, HealthTech, E-commerce, Technology, Business, Mobile Apps",
  "why_trending": "2-3 предложения на русском: почему этот тренд растёт и какую проблему решает продукт. Укажи реальные данные из Google Trends."
}

ВАЖНО:
- title СТРОГО на русском языке, без кавычек, без скобок
- title должен описывать ПРОДУКТ, а не поисковый запрос
- why_trending должен опираться на данные Google Trends (рост X%)
- Не придумывай статистику — используй только данные из запроса
- Если несколько запросов про одну тему — объедини в одну идею`,
      },
      {
        role: 'user',
        content: queryData,
      },
    ], 0.3);

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    // Build a lookup map: source_query → enriched query data
    const queryMap = new Map<string, EnrichedQuery>();
    for (const q of queries) {
      queryMap.set(q.query.toLowerCase(), q);
    }

    // Calculate scores from real data, not GPT hallucinations
    return parsed.map((item: { title?: string; category?: string; why_trending?: string; source_query?: string }) => {
      const sourceQuery = item.source_query?.toLowerCase() || '';
      const enriched = queryMap.get(sourceQuery);

      // Calculate popularity_score from real growthValue (log scale 50-100)
      const growthValue = enriched?.growthValue || 100;
      const calculatedPopularity = Math.min(100, Math.round(50 + Math.log10(Math.max(1, growthValue)) * 12));

      // Use real timeline growth rate
      const calculatedGrowthRate = enriched?.timelineGrowthRate || 0;

      // Clean title: remove quotes and ensure no wrapping punctuation
      let cleanTitle = (item.title || '').replace(/^["«»""]|["«»""]$/g, '').trim();
      cleanTitle = cleanTitle.replace(/^['']|['']$/g, '').trim();

      return {
        title: cleanTitle,
        category: item.category || 'Technology',
        popularity_score: calculatedPopularity,
        growth_rate: calculatedGrowthRate,
        why_trending: item.why_trending || '',
        source_query: item.source_query,
      };
    });
  } catch (err) {
    console.error('GPT trend generation error:', err);
    return [];
  }
}

// ==========================================
// Main Scan Handler
// ==========================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Parse body once
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // empty body is OK
  }

  // Optional auth protection
  if (SCAN_SECRET) {
    const authHeader = request.headers.get('authorization');
    const secret = (body.secret as string) || authHeader?.replace('Bearer ', '');
    if (secret !== SCAN_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const categories = (body.categories as string[]) || Object.keys(CATEGORY_NICHES);
  const maxNichesPerCategory = (body.maxNichesPerCategory as number) || 5;
  const maxEnrich = (body.maxEnrich as number) || 25;
  const dryRun = (body.dryRun as boolean) || false;

  let totalSerpApiCalls = 0;

  // --- Step 1: Scan Rising Queries ---
  console.log(`[scan-trends] Starting scan for categories: ${categories.join(', ')}`);
  const allRisingQueries: RisingQuery[] = [];

  for (const category of categories) {
    const niches = CATEGORY_NICHES[category];
    if (!niches) continue;

    // Pick random subset of niches to conserve API budget
    const selectedNiches = [...niches]
      .sort(() => Math.random() - 0.5)
      .slice(0, maxNichesPerCategory);

    // Fetch in parallel per category
    const fetchPromises = selectedNiches.map(niche =>
      fetchRisingQueries(niche, category)
    );
    const results = await Promise.all(fetchPromises);

    for (const result of results) {
      allRisingQueries.push(...result.queries);
      totalSerpApiCalls += result.callsUsed;
    }
  }

  console.log(`[scan-trends] Found ${allRisingQueries.length} rising queries (${totalSerpApiCalls} API calls)`);

  // --- Step 2: Filter Noise ---
  const filtered = filterNoise(allRisingQueries);
  const filteredOut = allRisingQueries.length - filtered.length;
  console.log(`[scan-trends] After noise filter: ${filtered.length} (removed ${filteredOut})`);

  // --- Step 3: Deduplicate ---
  const deduplicated = deduplicateQueries(filtered);
  console.log(`[scan-trends] After dedup: ${deduplicated.length}`);

  // --- Step 4: GPT Classification ---
  const classified = await gptClassifyQueries(deduplicated);
  const gptFiltered = deduplicated.length - classified.length;
  console.log(`[scan-trends] After GPT filter: ${classified.length} (GPT removed ${gptFiltered})`);

  // --- Step 4.5: GPT Semantic Dedup ---
  const semanticDeduped = await gptDeduplicateQueries(classified);
  const semanticRemoved = classified.length - semanticDeduped.length;
  if (semanticRemoved > 0) {
    console.log(`[scan-trends] After semantic dedup: ${semanticDeduped.length} (removed ${semanticRemoved} semantic duplicates)`);
  }

  // --- Step 5: Enrich with Timeline ---
  const { enriched, callsUsed: enrichCalls } = await enrichWithTimeline(semanticDeduped, maxEnrich);
  totalSerpApiCalls += enrichCalls;
  console.log(`[scan-trends] Enriched: ${enriched.length} (${enrichCalls} API calls)`);

  // --- Step 6: GPT Generate Trend Objects ---
  const generatedTrends = await gptGenerateTrends(enriched);
  console.log(`[scan-trends] Generated ${generatedTrends.length} trend objects`);

  // --- Step 7: Save to /api/trends ---
  let savedCount = 0;
  let duplicatesSkipped = 0;

  if (!dryRun && generatedTrends.length > 0) {
    const trendsToSave = generatedTrends.map((trend, index) => ({
      id: `trend-${Date.now()}-${index}`,
      title: trend.title,
      category: trend.category,
      popularity_score: Math.min(100, Math.max(0, trend.popularity_score)),
      growth_rate: trend.growth_rate,
      why_trending: trend.why_trending,
      source: 'Google Trends',
      status: 'active',
      first_detected_at: new Date().toISOString(),
      source_query: trend.source_query,
    }));

    // POST to internal /api/trends endpoint
    try {
      const baseUrl = request.nextUrl.origin;
      const saveResponse = await fetch(`${baseUrl}/api/trends`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trendsToSave),
      });

      if (saveResponse.ok) {
        const saveResult = await saveResponse.json();
        savedCount = saveResult.count || 0;
        duplicatesSkipped = saveResult.duplicatesSkipped || 0;
      }
    } catch (err) {
      console.error('[scan-trends] Error saving trends:', err);
    }
  }

  const scanDurationMs = Date.now() - startTime;

  const result: ScanResult = {
    success: true,
    newTrendsCount: dryRun ? generatedTrends.length : savedCount,
    totalScanned: allRisingQueries.length,
    filteredOut,
    gptFiltered,
    enriched: enriched.length,
    duplicatesSkipped,
    serpApiCallsUsed: totalSerpApiCalls,
    scanDurationMs,
    categories,
  };

  console.log(`[scan-trends] Complete: ${result.newTrendsCount} new trends, ${totalSerpApiCalls} API calls, ${scanDurationMs}ms`);

  return NextResponse.json(result);
}

// GET — scan status / info
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    categories: Object.keys(CATEGORY_NICHES),
    totalNiches: Object.values(CATEGORY_NICHES).flat().length,
    description: 'POST to this endpoint to scan Google Trends for rising product opportunities',
    params: {
      categories: 'string[] — categories to scan (default: all)',
      maxNichesPerCategory: 'number — niches per category (default: 5)',
      maxEnrich: 'number — max queries to enrich with timeline (default: 25)',
      dryRun: 'boolean — if true, don\'t save to trends (default: false)',
      secret: 'string — auth secret (if SCAN_SECRET env is set)',
    },
    budget: {
      estimatedCallsPerScan: '~80 SerpAPI calls',
      monthlyBudget: '5000 calls ($75 plan)',
      maxScansPerMonth: '~62 scans',
      maxScansPerDay: '~2 scans',
    },
  });
}
