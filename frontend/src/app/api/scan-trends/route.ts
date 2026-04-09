/**
 * /api/scan-trends — Real Google Trends-Based Trend Discovery
 *
 * TWO MODES in one scan:
 *
 * MODE 1 — "Растущий рынок" (Established Growth):
 *   12-month window, annual growth ≥ 100%, full pipeline with enrich
 *   Pipeline: seeds → rising queries → filter → dedup → GPT classify → semantic dedup
 *            → Topic→Product → timeline enrich → GPT generate → save + enrich-trend
 *
 * MODE 2 — "🔥 BREAKOUT" (Fresh Signals):
 *   3-month window, Breakout OR monthly growth > 150%, simplified pipeline
 *   Pipeline: seeds → rising queries → filter → dedup → GPT classify
 *            → simplified describe → GPT generate → save (NO enrich-trend)
 *
 * Budget: ~41 SerpAPI calls per combined scan
 *   Mode 1: 6 seed + 12 timeline + 10 enrich = ~28
 *   Mode 2: 8 seed + ~5 timeline = ~13
 *   5000/month → ~4 scans/day
 */

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const SCAN_SECRET = process.env.SCAN_SECRET || '';

// ==========================================
// Scan Memory: track seen queries across scans
// ==========================================
const SCAN_MEMORY_KEY = 'trendhunter:scan_memory';
const SCAN_MEMORY_MAX_AGE_DAYS = 14; // forget queries older than 2 weeks

interface ScanMemoryEntry {
  query: string;
  seenAt: string; // ISO date
}

function normalizeQueryForMemory(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

async function loadScanMemory(): Promise<Map<string, ScanMemoryEntry>> {
  const isKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!isKV) return new Map();

  try {
    const entries = await kv.get<ScanMemoryEntry[]>(SCAN_MEMORY_KEY);
    if (!entries) return new Map();

    const cutoff = Date.now() - SCAN_MEMORY_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    const map = new Map<string, ScanMemoryEntry>();
    for (const entry of entries) {
      if (new Date(entry.seenAt).getTime() > cutoff) {
        map.set(normalizeQueryForMemory(entry.query), entry);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

async function saveScanMemory(memory: Map<string, ScanMemoryEntry>): Promise<void> {
  const isKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  if (!isKV) return;

  try {
    const entries = Array.from(memory.values());
    await kv.set(SCAN_MEMORY_KEY, entries);
  } catch (err) {
    console.error('[scan-memory] Save error:', err);
  }
}

// Category → seed niches for scanning
// Mode 1 seeds: 6 verified seeds (12-month window)
const CATEGORY_NICHES: Record<string, string[]> = {
  'SaaS': [
    'CRM software', 'marketing automation', 'HR software',
    'accounting software', 'project management', 'workflow automation',
  ],
};

// Mode 2 seeds: same 6 + 2 exclusive (3-month window, Breakout signals)
const MODE2_EXTRA_SEEDS: Record<string, string[]> = {
  'SaaS': [
    'AI tools for business', 'AI automation',
  ],
};

// Mode 2 gate thresholds
const MODE2_BREAKOUT_VALUE = 999999;  // growthValue for Breakout status
const MODE2_HIGH_GROWTH_THRESHOLD = 500; // % — non-Breakout but still explosive (was 5000, lowered based on real data)

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

// Hard filters: technically incompatible with META agent (Next.js web app generator)
// These aren't business judgments — these are architecture constraints.
// A browser extension, mobile app, or hardware product cannot be generated as a Next.js project.
const INCOMPATIBLE_PRODUCT_PATTERNS = [
  // Browser extensions — different architecture entirely (manifest.json, content scripts)
  /\b(browser extension|chrome extension|firefox extension|safari extension)\b/i,
  /\bextension\b/i,
  // Mobile apps — requires React Native/Flutter/Swift, not Next.js
  /\b(mobile app|ios app|android app|native app)\b/i,
  // Hardware / physical products
  /\b(hardware|device|sensor|wearable|robot|drone|printer|scanner)\b/i,
  // Closed/proprietary APIs that can't be integrated
  /\b(grok\s+ai|grok\s+automation)\b/i,
  // WordPress/Shopify plugins — different ecosystem
  /\b(wordpress plugin|shopify app|woocommerce plugin)\b/i,
];

function isIncompatibleProduct(query: string): boolean {
  return INCOMPATIBLE_PRODUCT_PATTERNS.some(pattern => pattern.test(query));
}

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
  mode1_trends: number;
  mode2_breakouts: number;
  error?: string;
}

// ==========================================
// Step 1: Fetch Rising Queries from Google Trends
// period: 'today 12-m' (Mode 1) or 'today 3-m' (Mode 2)
// ==========================================
async function fetchRisingQueries(
  niche: string,
  category: string,
  period: string = 'today 12-m',
): Promise<{ queries: RisingQuery[]; callsUsed: number }> {
  if (!SERPAPI_KEY) return { queries: [], callsUsed: 0 };

  const params = new URLSearchParams({
    engine: 'google_trends',
    q: niche,
    data_type: 'RELATED_QUERIES',
    date: period,
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

    // Hard filter: technically incompatible with META agent (Next.js)
    if (isIncompatibleProduct(q.query)) return false;

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

// ==========================================
// Step 5.5: Discover relevant subreddits for Block 1
// Called once per card at scan time — 0 extra cost at analysis time
// ==========================================

async function getRelevantSubreddits(sourceQuery: string): Promise<string[]> {
  if (!OPENAI_API_KEY || !sourceQuery) return [];

  try {
    const raw = await callOpenAI([{
      role: 'user',
      content: `For the niche "${sourceQuery}", find 3-5 most relevant subreddits where people discuss problems with tools and software in this area.

Rules:
- Only real, existing subreddits
- Where people complain about tools, not just discuss the topic
- No generic ones (entrepreneur, smallbusiness) — niche-specific only
- Return ONLY a JSON array of strings without "r/" prefix

Example for "HR software comparison": ["humanresources", "recruiting", "hris", "peopleops"]

Respond with JSON array only: ["sub1", "sub2", "sub3"]`
    }], 0.3);

    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed)
      ? parsed.filter((s: unknown): s is string => typeof s === 'string').slice(0, 5)
      : [];
  } catch (e) {
    console.warn('[scan-trends] getRelevantSubreddits failed:', e);
    return [];
  }
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
        content: `Тебе дан список поисковых запросов. Найди НАСТОЯЩИЕ дубликаты — запросы которые приведут к созданию ИДЕНТИЧНОГО продукта для ИДЕНТИЧНОЙ аудитории.

КРИТЕРИЙ ДУБЛИКАТА — оба условия одновременно:
1. Решают ОДНУ И ТУ ЖЕ проблему для ОДНОЙ И ТОЙ ЖЕ целевой аудитории
2. Имеют одинаковую core-функцию продукта

Разная целевая аудитория = РАЗНЫЙ продукт, даже если используется одно слово.

Примеры ДУБЛЕЙ (убирать):
- "best marketing automation platforms" и "top marketing automation tools" — одна аудитория, одна функция, разные формулировки
- "AI email writer" и "email writing AI" — идентичный продукт
- "accounting software solutions" и "best accounting software" — общие запросы без конкретной аудитории

Примеры НЕ-ДУБЛЕЙ (оставлять оба):
- "restaurant accounting software" и "accounting software for builders" — разная аудитория, разные требования
- "ai accounting software" и "property management accounting software" — разная технология, разная аудитория
- "HR payroll software" и "HR recruiting tool" — разные функции
- "CRM comparison" и "CRM integration" — разные задачи
- "ai for project management" и "ai accounting software" — разные домены

ВАЖНО: вертикальные ниши (для ресторанов, строителей, недвижимости, SMB) — это РАЗНЫЕ продукты!

Для каждой группы дублей оставь ОДИН лучший (наиболее конкретный).

Верни JSON массив номеров запросов, которые нужно ОСТАВИТЬ:
[1, 3, 4, 5, 6, 7, 8, 9, 10]`,
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
// Step 5: Topic → Product Transformation
// Ключевой фильтр: темы трансформируются в конкретные продукты
// ==========================================

interface ProductNiche extends RisingQuery {
  originalQuery: string;      // оригинальный запрос из Google Trends (для timeline enrichment)
  productTitle: string;       // "Автоматический аудит кибербезопасности для SMB"
  productFormat: string;      // "SaaS", "API + дашборд", "мобильное приложение"
  targetAudience: string;     // "малый бизнес", "HR-менеджеры", "фрилансеры"
  userOutcome: string;        // "отчёт об уязвимостях за 10 минут"
  wasTransformed: boolean;    // true если исходный запрос был темой
}

async function transformToProductNiches(
  queries: RisingQuery[],
): Promise<ProductNiche[]> {
  if (!OPENAI_API_KEY || queries.length === 0) {
    return queries.map(q => ({
      ...q,
      originalQuery: q.query,
      productTitle: q.query,
      productFormat: 'unknown',
      targetAudience: 'unknown',
      userOutcome: 'unknown',
      wasTransformed: false,
    }));
  }

  const queryList = queries.map((q, i) =>
    `${i + 1}. "${q.query}" (рост: ${q.growth}, категория: ${q.sourceCategory})`
  ).join('\n');

  try {
    const content = await callOpenAI([
      {
        role: 'system',
        content: `Ты эксперт по SaaS-продуктам. Тебе дан список растущих поисковых запросов из Google Trends.

Каждый запрос — это либо ТЕМА (информационный контент), либо ПРОДУКТ (конкретный инструмент).

ТЕМА (нельзя монетизировать напрямую):
- "Советы по кибербезопасности" — нет конкретного результата
- "Здоровое питание" — нет формата продукта
- "Удалённая работа" — нет платящей аудитории
- "cryptocurrency trading" — слишком общий термин

ПРОДУКТ (можно построить и продать):
- "Автоматический аудит кибербезопасности для SMB" — есть результат (отчёт), формат (SaaS), аудитория (малый бизнес)
- "AI code review tool" — есть результат (review), формат (SaaS), аудитория (разработчики)

Для КАЖДОГО запроса:
1. Определи: это ТЕМА или ПРОДУКТ?
2. Если ТЕМА → придумай 1-2 КОНКРЕТНЫХ продукта, которые можно построить на этом тренде
3. Если ПРОДУКТ → оставь как есть (1 продукт)

Три критерия ПРОДУКТА:
✅ Есть конкретный результат для пользователя (отчёт, план, аудит, дашборд, автоматизация)
✅ Есть понятный формат (SaaS / API / мобильное приложение / маркетплейс / браузерное расширение)
✅ Есть платящая аудитория (кто конкретно платит: SMB, фрилансеры, HR-менеджеры, e-commerce)

Ответь JSON массивом:
[
  {
    "source_index": 1,
    "is_topic": true,
    "products": [
      {
        "title_en": "Automated cybersecurity audit for SMB",
        "title_ru": "Автоматический аудит кибербезопасности для малого бизнеса",
        "product_format": "SaaS",
        "target_audience": "малый бизнес",
        "user_outcome": "отчёт об уязвимостях за 10 минут"
      }
    ]
  }
]

ВАЖНО:
- Для тем: 1-2 продукта МАКСИМУМ. Каждый продукт должен быть из РАЗНОЙ ниши применения.
- Для продуктов: 1 продукт (исходный запрос, немного уточнённый).
- title_en — краткое название продукта на английском (для Google Trends поиска)
- title_ru — название на русском (для отображения)
- Не придумывай абстракции. Каждый продукт должен решать КОНКРЕТНУЮ проблему.`,
      },
      {
        role: 'user',
        content: queryList,
      },
    ], 0.3);

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return queries.map(q => ({
        ...q,
        originalQuery: q.query,
        productTitle: q.query,
        productFormat: 'unknown',
        targetAudience: 'unknown',
        userOutcome: 'unknown',
        wasTransformed: false,
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return queries.map(q => ({
        ...q,
        originalQuery: q.query,
        productTitle: q.query,
        productFormat: 'unknown',
        targetAudience: 'unknown',
        userOutcome: 'unknown',
        wasTransformed: false,
      }));
    }

    const result: ProductNiche[] = [];
    for (const item of parsed) {
      const idx = (item.source_index || 1) - 1;
      if (idx < 0 || idx >= queries.length) continue;
      const sourceQuery = queries[idx];
      const products = item.products || [];

      for (const product of products) {
        result.push({
          ...sourceQuery,
          // ВАЖНО: НЕ меняем query — он используется для Google Trends timeline enrichment
          // Оригинальный запрос ("cybersecurity tips") имеет данные в Google Trends,
          // а трансформированный ("Automated cybersecurity audit for SMB") — нет.
          query: sourceQuery.query,
          originalQuery: sourceQuery.query,
          productTitle: product.title_ru || product.title_en || sourceQuery.query,
          productFormat: product.product_format || 'SaaS',
          targetAudience: product.target_audience || 'unknown',
          userOutcome: product.user_outcome || 'unknown',
          wasTransformed: item.is_topic === true,
        });
      }
    }

    // Если GPT не вернул ничего полезного, fallback
    if (result.length === 0) {
      return queries.map(q => ({
        ...q,
        originalQuery: q.query,
        productTitle: q.query,
        productFormat: 'unknown',
        targetAudience: 'unknown',
        userOutcome: 'unknown',
        wasTransformed: false,
      }));
    }

    return result;
  } catch (err) {
    console.error('GPT topic→product transformation error:', err);
    return queries.map(q => ({
      ...q,
      originalQuery: q.query,
      productTitle: q.query,
      productFormat: 'unknown',
      targetAudience: 'unknown',
      userOutcome: 'unknown',
      wasTransformed: false,
    }));
  }
}

// ==========================================
// Step 6: Enrich with Timeline Data
// ==========================================
async function enrichWithTimeline(
  queries: RisingQuery[],
  maxEnrich: number = 12,
): Promise<{ enriched: EnrichedQuery[]; callsUsed: number }> {
  if (!SERPAPI_KEY) return { enriched: [], callsUsed: 0 };

  // Gate: only enrich queries with annual growth >= 100% (saves SerpAPI calls on weak signals)
  const MIN_ANNUAL_GROWTH = 100;
  const qualified = queries.filter(q => q.growthValue >= MIN_ANNUAL_GROWTH);
  if (qualified.length < queries.length) {
    console.log(`[scan-trends] Growth gate: ${queries.length - qualified.length} queries below ${MIN_ANNUAL_GROWTH}% annual growth removed`);
  }

  // Sort by growth (highest first), take top N
  const sorted = [...qualified].sort((a, b) => b.growthValue - a.growthValue);
  const toEnrich = sorted.slice(0, maxEnrich);
  let callsUsed = 0;

  const enriched: EnrichedQuery[] = [];

  // Process in parallel batches of 5 to avoid rate limits
  const parallelBatch = 5;
  for (let i = 0; i < toEnrich.length; i += parallelBatch) {
    const batch = toEnrich.slice(i, i + parallelBatch);
    const promises = batch.map(async (q): Promise<EnrichedQuery | null> => {
      // Use last 1 month (daily resolution) to compare week-over-week
      const params = new URLSearchParams({
        engine: 'google_trends',
        q: q.query,
        date: 'today 1-m',
        api_key: SERPAPI_KEY,
      });

      try {
        const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
        callsUsed++;
        if (!response.ok) return null;

        const data = await response.json();
        const timelineData = data.interest_over_time?.timeline_data || [];
        // Need at least some data for growth comparison
        if (timelineData.length < 4) {
          console.log(`[scan-trends] Timeline skip: "${q.query}" — only ${timelineData.length} data points`);
          return null;
        }

        // Extract daily values
        const values = timelineData.map((point: { values?: Array<{ extracted_value?: number; value?: string }> }) => {
          const vals = point.values || [];
          return vals[0]?.extracted_value ?? parseInt(vals[0]?.value || '0') ?? 0;
        });

        // Growth comparison: split data into recent half vs older half
        const mid = Math.floor(values.length / 2);
        const recentHalf = values.slice(mid);
        const olderHalf = values.slice(0, mid);

        const avgRecent = recentHalf.reduce((s: number, v: number) => s + v, 0) / recentHalf.length || 0;
        const avgOlder = olderHalf.reduce((s: number, v: number) => s + v, 0) / olderHalf.length || 1;
        const timelineGrowthRate = Math.round(((avgRecent - avgOlder) / Math.max(avgOlder, 1)) * 100);

        const searchMetadata = data.search_metadata as { google_trends_url?: string } | undefined;

        return {
          ...q,
          timelineGrowthRate,
          googleTrendsUrl: searchMetadata?.google_trends_url ||
            `https://trends.google.com/trends/explore?q=${encodeURIComponent(q.query)}&date=today%201-m`,
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
// Step 7: GPT Generate Final Trend Objects
// Использует ProductNiche (уже продуктовые запросы) + timeline данные
// ==========================================

interface EnrichedProductNiche extends ProductNiche {
  timelineGrowthRate: number;
  googleTrendsUrl: string;
}

async function gptGenerateTrends(
  queries: EnrichedProductNiche[],
  signalType: 'growing' | 'breakout' = 'growing',
): Promise<Array<{
  title: string;
  category: string;
  popularity_score: number;
  growth_rate: number;
  growth_rate_monthly: number;
  why_trending: string;
  source_query?: string;
  source_growth?: string;
  product_format?: string;
  target_audience?: string;
  user_outcome?: string;
  was_transformed?: boolean;
  signal_type: 'growing' | 'breakout';
}>> {
  if (!OPENAI_API_KEY || queries.length === 0) return [];

  const queryData = queries.map((q, i) =>
    `${i + 1}. Продукт: "${q.productTitle}" | Запрос: "${q.query}" | Формат: ${q.productFormat} | Аудитория: ${q.targetAudience} | Результат: ${q.userOutcome} | Годовой рост: ${q.growth} | Месячная динамика: ${q.timelineGrowthRate}% | Ниша: ${q.sourceNiche} | Категория: ${q.sourceCategory}`
  ).join('\n');

  try {
    const content = await callOpenAI([
      {
        role: 'system',
        content: `Ты аналитик SaaS/Tech рынка. Тебе даны продуктовые идеи из Google Trends с реальными данными о росте.

Для каждого продукта создай финальное описание. Ответь JSON массивом.

Каждый элемент:
{
  "source_index": 1,
  "title": "Название продукта на русском (3-7 слов, конкретное и понятное, БЕЗ кавычек)",
  "category": "одна из: AI & ML, SaaS, FinTech, EdTech, HealthTech, E-commerce, Technology, Business, Mobile Apps",
  "why_trending": "Одно предложение на русском."
}

ПРАВИЛА:
- Создай описание для КАЖДОГО продукта. Не пропускай ни одного.
- title СТРОГО на русском, без кавычек. Должен описывать КОНКРЕТНЫЙ ПРОДУКТ, не тему.
- why_trending — ОДНО предложение. Пиши ТОЛЬКО то, что можно вывести из запроса и его роста:
  ✅ "Спрос на бухгалтерские инструменты для ресторанов вырос на 250% за год — ниша специализированного учёта активно растёт."
  ✅ "AI-инструменты для бухгалтерии выросли на 600% — бизнес ищет автоматизацию рутинного учёта."
  ❌ "Рестораны массово переходят на цифровой учёт после изменений в налоговом законодательстве." (откуда ты это знаешь?)
  ❌ "Позволяет экономить время и ресурсы" (общие слова без данных)
- Используй ТОЛЬКО годовой рост из данных. НЕ ПРИДУМЫВАЙ причин, законов, событий.
- Если несколько продуктов из ОДНОЙ предметной области с ОДИНАКОВОЙ аудиторией — оставь ОДИН лучший.`,
      },
      {
        role: 'user',
        content: queryData,
      },
    ], 0.3);

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[scan-trends] GPT generate: no JSON array found in response:', content.slice(0, 500));
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      console.error('[scan-trends] GPT generate: parsed result is not array');
      return [];
    }

    console.log(`[scan-trends] GPT generate: parsed ${parsed.length} items`);

    // Calculate scores from real data, not GPT hallucinations
    return parsed.map((item: { source_index?: number; title?: string; category?: string; why_trending?: string }) => {
      const idx = (item.source_index || 1) - 1;
      const source = idx >= 0 && idx < queries.length ? queries[idx] : null;

      // Calculate popularity_score from real growthValue (log scale 50-100)
      const growthValue = source?.growthValue || 100;
      const calculatedPopularity = Math.min(100, Math.round(50 + Math.log10(Math.max(1, growthValue)) * 12));

      // Use real timeline growth rate
      const calculatedGrowthRate = source?.timelineGrowthRate || 0;

      // Clean title: remove quotes and ensure no wrapping punctuation
      let cleanTitle = (item.title || '').replace(/^["«»""]|["«»""]$/g, '').trim();
      cleanTitle = cleanTitle.replace(/^['']|['']$/g, '').trim();

      return {
        title: cleanTitle,
        category: item.category || source?.sourceCategory || 'Technology',
        popularity_score: calculatedPopularity,
        growth_rate: growthValue, // Annual growth from Google Trends (primary)
        growth_rate_monthly: calculatedGrowthRate, // Monthly timeline trend (secondary context)
        why_trending: item.why_trending || '',
        source_query: source?.query || '',
        source_growth: source?.growth || '', // Original growth label ("Breakout", "+1,700%")
        product_format: source?.productFormat,
        target_audience: source?.targetAudience,
        user_outcome: source?.userOutcome,
        was_transformed: source?.wasTransformed,
        signal_type: signalType,
      };
    });
  } catch (err) {
    console.error('GPT trend generation error:', err);
    return [];
  }
}

// ==========================================
// Mode 2: Breakout Gate — only keep explosive signals
// ==========================================
// Additional noise patterns for Mode 2 (3-month window has more SEO spam)
const MODE2_NOISE_PATTERNS = [
  // Domain-specific spam (seo spam with embedded URLs)
  /\.(com|in|net|org|io)\b/i,
  // Non-English queries (Hindi, German UI searches etc.)
  /\b(kaise|kare|kya|hai)\b/i,
  // Vehicle/phone reviews (common Breakout noise)
  /\b(review|brezza|innova|hycross|phone\s+\d|car\s+\d)\b/i,
  // Near me / location queries
  /\bnear me\b/i,
  // Specific retail brands
  /^(lidl|walmart|costco|target|aldi|ikea)\b/i,
];

// Product signal words — if a Breakout query contains one, it auto-passes GPT classify
const MODE2_PRODUCT_SIGNALS = [
  'software', 'tool', 'platform', 'automation',
  'system', 'solution', 'saas', 'ai for', 'tracker',
  'manager', 'dashboard', 'integration', 'api integration',
  // Note: 'extension' and 'app' removed — hard filter catches incompatible product types
  // before this check runs. Any 'extension' or 'mobile app' is already filtered out.
];

function filterBreakoutSignals(queries: RisingQuery[]): RisingQuery[] {
  return queries.filter(q => {
    // Must pass growth threshold
    const passesGrowth = q.growthValue >= MODE2_BREAKOUT_VALUE || q.growthValue >= MODE2_HIGH_GROWTH_THRESHOLD;
    if (!passesGrowth) return false;

    // Extra noise filter for Mode 2 spam
    const text = q.query.toLowerCase();
    for (const pattern of MODE2_NOISE_PATTERNS) {
      if (pattern.test(text)) return false;
    }

    return true;
  });
}

function hasProductSignal(query: string): boolean {
  const text = query.toLowerCase();
  return MODE2_PRODUCT_SIGNALS.some(signal => text.includes(signal));
}

// ==========================================
// Mode 2: Simplified Describe (no Topic→Product invention)
// Describes what the signal IS, doesn't invent a product
// ==========================================
async function describeBreakoutSignals(
  queries: RisingQuery[],
): Promise<ProductNiche[]> {
  if (!OPENAI_API_KEY || queries.length === 0) {
    return queries.map(q => ({
      ...q,
      originalQuery: q.query,
      productTitle: q.query,
      productFormat: 'unknown',
      targetAudience: 'unknown',
      userOutcome: 'unknown',
      wasTransformed: false,
    }));
  }

  const queryList = queries.map((q, i) =>
    `${i + 1}. "${q.query}" (рост: ${q.growth}, категория: ${q.sourceCategory})`
  ).join('\n');

  try {
    const content = await callOpenAI([
      {
        role: 'system',
        content: `Тебе даны BREAKOUT-запросы из Google Trends (взрывной рост за 3 месяца).

Для каждого запроса — кратко опиши, ЧТО это за сигнал и КАКОЙ продукт можно построить.

НЕ ПРИДУМЫВАЙ сложных трансформаций. Просто:
1. Если запрос УЖЕ описывает продукт/инструмент → оставь как есть
2. Если запрос — тема → опиши 1 ОЧЕВИДНЫЙ продукт на базе этого тренда

Ответь JSON массивом:
[
  {
    "source_index": 1,
    "title_en": "краткое название продукта (English)",
    "title_ru": "краткое название продукта (Russian)",
    "product_format": "SaaS / API / browser extension / mobile app",
    "target_audience": "кто будет платить",
    "user_outcome": "что получит пользователь"
  }
]

ВАЖНО: Один вход = один выход. Не множь продукты. Краткость и конкретность.`,
      },
      {
        role: 'user',
        content: queryList,
      },
    ], 0.2);

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return queries.map(q => ({
        ...q,
        originalQuery: q.query,
        productTitle: q.query,
        productFormat: 'unknown',
        targetAudience: 'unknown',
        userOutcome: 'unknown',
        wasTransformed: false,
      }));
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return queries.map(q => ({
        ...q,
        originalQuery: q.query,
        productTitle: q.query,
        productFormat: 'unknown',
        targetAudience: 'unknown',
        userOutcome: 'unknown',
        wasTransformed: false,
      }));
    }

    const result: ProductNiche[] = [];
    for (const item of parsed) {
      const idx = (item.source_index || 1) - 1;
      if (idx < 0 || idx >= queries.length) continue;
      const sourceQuery = queries[idx];

      result.push({
        ...sourceQuery,
        query: sourceQuery.query,
        originalQuery: sourceQuery.query,
        productTitle: item.title_ru || item.title_en || sourceQuery.query,
        productFormat: item.product_format || 'SaaS',
        targetAudience: item.target_audience || 'unknown',
        userOutcome: item.user_outcome || 'unknown',
        wasTransformed: false, // Mode 2 doesn't "transform" — it describes
      });
    }

    if (result.length === 0) {
      return queries.map(q => ({
        ...q,
        originalQuery: q.query,
        productTitle: q.query,
        productFormat: 'unknown',
        targetAudience: 'unknown',
        userOutcome: 'unknown',
        wasTransformed: false,
      }));
    }

    return result;
  } catch (err) {
    console.error('GPT describeBreakoutSignals error:', err);
    return queries.map(q => ({
      ...q,
      originalQuery: q.query,
      productTitle: q.query,
      productFormat: 'unknown',
      targetAudience: 'unknown',
      userOutcome: 'unknown',
      wasTransformed: false,
    }));
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
  const maxEnrich = (body.maxEnrich as number) || 12;
  const dryRun = (body.dryRun as boolean) || false;
  // Allow disabling specific modes via body params (default: both enabled)
  const enableMode1 = (body.mode1 as boolean) !== false;
  const enableMode2 = (body.mode2 as boolean) !== false;

  let totalSerpApiCalls = 0;
  let mode1TrendsCount = 0;
  let mode2TrendsCount = 0;

  // --- Load scan memory (seen queries from previous scans) ---
  const scanMemory = await loadScanMemory();
  console.log(`[scan-trends] Scan memory: ${scanMemory.size} queries from last ${SCAN_MEMORY_MAX_AGE_DAYS} days`);

  // Debug info for dryRun mode
  const debug: Record<string, unknown> = {};

  // Collect all generated trends from both modes
  type GeneratedTrend = {
    title: string;
    category: string;
    popularity_score: number;
    growth_rate: number;
    growth_rate_monthly: number;
    why_trending: string;
    source_query?: string;
    source_growth?: string;
    product_format?: string;
    target_audience?: string;
    user_outcome?: string;
    was_transformed?: boolean;
    signal_type: 'growing' | 'breakout';
  };
  const allGeneratedTrends: GeneratedTrend[] = [];
  let filteredOut = 0;
  let gptFiltered = 0;
  const allUnseenQueries: RisingQuery[] = []; // for scan memory update

  // =============================================
  // MODE 1: "Растущий рынок" (12-month, full pipeline)
  // =============================================
  if (enableMode1) {
    console.log(`[scan-trends] === MODE 1: Растущий рынок (12-month) ===`);
    const mode1Rising: RisingQuery[] = [];

    for (const category of categories) {
      const niches = CATEGORY_NICHES[category];
      if (!niches) continue;

      const fetchPromises = niches.map(niche =>
        fetchRisingQueries(niche, category, 'today 12-m')
      );
      const results = await Promise.all(fetchPromises);

      for (const result of results) {
        mode1Rising.push(...result.queries);
        totalSerpApiCalls += result.callsUsed;
      }
    }

    console.log(`[scan-trends] M1: Found ${mode1Rising.length} rising queries`);

    // Filter noise
    const m1Filtered = filterNoise(mode1Rising);
    filteredOut += mode1Rising.length - m1Filtered.length;
    console.log(`[scan-trends] M1: After noise filter: ${m1Filtered.length}`);

    // Filter already-seen
    const m1Unseen = m1Filtered.filter(q => !scanMemory.has(normalizeQueryForMemory(q.query)));
    const m1MemoryFiltered = m1Filtered.length - m1Unseen.length;
    if (m1MemoryFiltered > 0) {
      console.log(`[scan-trends] M1: Scan memory filtered: ${m1MemoryFiltered} (${m1Unseen.length} remaining)`);
    }
    allUnseenQueries.push(...m1Unseen);

    // Deduplicate
    const m1Deduped = deduplicateQueries(m1Unseen);
    console.log(`[scan-trends] M1: After dedup: ${m1Deduped.length}`);

    // GPT Classification
    const m1Classified = await gptClassifyQueries(m1Deduped);
    gptFiltered += m1Deduped.length - m1Classified.length;
    console.log(`[scan-trends] M1: After GPT filter: ${m1Classified.length}`);

    // Semantic Dedup
    const m1SemDeduped = await gptDeduplicateQueries(m1Classified);
    if (m1Classified.length - m1SemDeduped.length > 0) {
      console.log(`[scan-trends] M1: After semantic dedup: ${m1SemDeduped.length}`);
    }

    // Topic → Product Transformation
    const m1Products = await transformToProductNiches(m1SemDeduped);
    console.log(`[scan-trends] M1: Topic→Product: ${m1Products.length} products`);

    // Enrich with Timeline
    const { enriched: m1Enriched, callsUsed: m1EnrichCalls } = await enrichWithTimeline(m1Products, maxEnrich);
    totalSerpApiCalls += m1EnrichCalls;
    console.log(`[scan-trends] M1: Enriched: ${m1Enriched.length} (${m1EnrichCalls} API calls)`);

    // GPT Generate
    const m1EnrichedProducts: EnrichedProductNiche[] = m1Enriched.map(e => ({
      ...(e as unknown as ProductNiche),
      timelineGrowthRate: e.timelineGrowthRate,
      googleTrendsUrl: e.googleTrendsUrl,
      originalQuery: (e as unknown as ProductNiche).originalQuery || e.query,
      productTitle: (e as unknown as ProductNiche).productTitle || e.query,
      productFormat: (e as unknown as ProductNiche).productFormat || 'unknown',
      targetAudience: (e as unknown as ProductNiche).targetAudience || 'unknown',
      userOutcome: (e as unknown as ProductNiche).userOutcome || 'unknown',
      wasTransformed: (e as unknown as ProductNiche).wasTransformed || false,
    }));

    const m1Generated = await gptGenerateTrends(m1EnrichedProducts, 'growing');
    const m1Capped = m1Generated.slice(0, 10);
    mode1TrendsCount = m1Capped.length;
    allGeneratedTrends.push(...m1Capped);
    console.log(`[scan-trends] M1: Generated ${m1Capped.length} trends`);
  }

  // =============================================
  // MODE 2: "🔥 BREAKOUT" (3-month, simplified pipeline)
  // =============================================
  if (enableMode2) {
    console.log(`[scan-trends] === MODE 2: 🔥 BREAKOUT (3-month) ===`);
    const mode2Rising: RisingQuery[] = [];

    for (const category of categories) {
      // Mode 2 uses same seeds + extra seeds
      const baseNiches = CATEGORY_NICHES[category] || [];
      const extraNiches = MODE2_EXTRA_SEEDS[category] || [];
      const allNiches = [...baseNiches, ...extraNiches];

      const fetchPromises = allNiches.map(niche =>
        fetchRisingQueries(niche, category, 'today 3-m')
      );
      const results = await Promise.all(fetchPromises);

      for (const result of results) {
        mode2Rising.push(...result.queries);
        totalSerpApiCalls += result.callsUsed;
      }
    }

    console.log(`[scan-trends] M2: Found ${mode2Rising.length} rising queries (3-month window)`);

    // Filter noise
    const m2Filtered = filterNoise(mode2Rising);
    filteredOut += mode2Rising.length - m2Filtered.length;

    // Filter already-seen
    const m2Unseen = m2Filtered.filter(q => !scanMemory.has(normalizeQueryForMemory(q.query)));
    allUnseenQueries.push(...m2Unseen);

    // Deduplicate (also against Mode 1 queries to avoid overlap)
    const m2Deduped = deduplicateQueries(m2Unseen);
    console.log(`[scan-trends] M2: After filter+dedup: ${m2Deduped.length}`);

    // Collect debug data BEFORE gate
    if (dryRun) {
      debug.mode2_all_queries = m2Deduped.map(q => {
        const passesGrowth = q.growthValue >= MODE2_BREAKOUT_VALUE || q.growthValue >= MODE2_HIGH_GROWTH_THRESHOLD;
        const text = q.query.toLowerCase();
        const blockedByNoise = MODE2_NOISE_PATTERNS.some(p => p.test(text));
        const isBreakout = q.growthValue >= MODE2_BREAKOUT_VALUE;
        const productSignal = hasProductSignal(q.query);
        return {
          query: q.query,
          growth: q.growth,
          growthValue: q.growthValue,
          sourceNiche: q.sourceNiche,
          isBreakout,
          passesGrowth,
          blockedByNoise,
          passesGate: passesGrowth && !blockedByNoise,
          autoPassClassify: productSignal, // product signal = auto-pass classify
          hasProductSignal: productSignal,
        };
      });
      debug.mode2_total_rising = mode2Rising.length;
      debug.mode2_after_noise = m2Filtered.length;
      debug.mode2_after_memory = m2Unseen.length;
      debug.mode2_after_dedup = m2Deduped.length;
    }

    // BREAKOUT GATE — only keep explosive signals
    const m2Breakouts = filterBreakoutSignals(m2Deduped);
    console.log(`[scan-trends] M2: After Breakout gate: ${m2Breakouts.length} (from ${m2Deduped.length})`);

    if (dryRun) {
      debug.mode2_after_gate = m2Breakouts.length;
    }

    if (m2Breakouts.length > 0) {
      // Split: product signal queries auto-pass classify, rest → GPT classify
      // Rationale: if a query already contains "software", "tool", "platform" etc.,
      // it's clearly a product search — no need for GPT to verify
      const autoPass: RisingQuery[] = [];
      const needClassify: RisingQuery[] = [];
      for (const q of m2Breakouts) {
        if (hasProductSignal(q.query)) {
          autoPass.push(q);
          console.log(`[scan-trends] M2: Auto-pass (product signal): "${q.query}" (${q.growth})`);
        } else {
          needClassify.push(q);
        }
      }

      // GPT classify only the uncertain ones
      const gptClassified = needClassify.length > 0
        ? await gptClassifyQueries(needClassify)
        : [];
      gptFiltered += needClassify.length - gptClassified.length;

      const m2Classified = [...autoPass, ...gptClassified];
      console.log(`[scan-trends] M2: After classify: ${m2Classified.length} (${autoPass.length} auto-pass + ${gptClassified.length} GPT-approved)`);

      // Simplified describe (no full Topic→Product transformation)
      const m2Products = await describeBreakoutSignals(m2Classified);
      console.log(`[scan-trends] M2: Described ${m2Products.length} breakout signals`);

      // Timeline enrich (shorter budget — max 5)
      const { enriched: m2Enriched, callsUsed: m2EnrichCalls } = await enrichWithTimeline(m2Products, 5);
      totalSerpApiCalls += m2EnrichCalls;
      console.log(`[scan-trends] M2: Enriched: ${m2Enriched.length} (${m2EnrichCalls} API calls)`);

      // GPT Generate (same function, but with 'breakout' signal_type)
      const m2EnrichedProducts: EnrichedProductNiche[] = m2Enriched.map(e => ({
        ...(e as unknown as ProductNiche),
        timelineGrowthRate: e.timelineGrowthRate,
        googleTrendsUrl: e.googleTrendsUrl,
        originalQuery: (e as unknown as ProductNiche).originalQuery || e.query,
        productTitle: (e as unknown as ProductNiche).productTitle || e.query,
        productFormat: (e as unknown as ProductNiche).productFormat || 'unknown',
        targetAudience: (e as unknown as ProductNiche).targetAudience || 'unknown',
        userOutcome: (e as unknown as ProductNiche).userOutcome || 'unknown',
        wasTransformed: (e as unknown as ProductNiche).wasTransformed || false,
      }));

      const m2Generated = await gptGenerateTrends(m2EnrichedProducts, 'breakout');
      const m2Capped = m2Generated.slice(0, 5); // Max 5 breakout cards per scan
      mode2TrendsCount = m2Capped.length;
      allGeneratedTrends.push(...m2Capped);
      console.log(`[scan-trends] M2: Generated ${m2Capped.length} breakout trends`);
    }
  }

  // =============================================
  // SAVE & ENRICH (combined for both modes)
  // =============================================

  // Hard limit: max 15 ideas per combined scan (10 growing + 5 breakout)
  const generatedTrends = allGeneratedTrends.slice(0, 15);
  console.log(`[scan-trends] Combined: ${generatedTrends.length} trends (${mode1TrendsCount} growing + ${mode2TrendsCount} breakout)`);

  // Update scan memory with all queries we processed
  const now = new Date().toISOString();
  for (const q of allUnseenQueries) {
    scanMemory.set(normalizeQueryForMemory(q.query), { query: q.query, seenAt: now });
  }
  await saveScanMemory(scanMemory);
  console.log(`[scan-trends] Scan memory updated: ${scanMemory.size} total entries`);

  // Step 5.5: Discover relevant subreddits for Block 1 (parallel for all trends)
  // One GPT-4o-mini call per trend — runs once at scan time, not at analysis time
  const subredditMap = new Map<string, string[]>();
  if (!dryRun && generatedTrends.length > 0) {
    console.log(`[scan-trends] Discovering subreddits for ${generatedTrends.length} trends...`);
    const subredditPromises = generatedTrends.map(async (trend) => {
      const query = trend.source_query || trend.title;
      if (!subredditMap.has(query)) {
        const subs = await getRelevantSubreddits(query);
        subredditMap.set(query, subs);
      }
    });
    await Promise.all(subredditPromises);
    console.log(`[scan-trends] Subreddits discovered for ${subredditMap.size} unique queries`);
  }

  // Save to /api/trends
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
      source_growth: trend.source_growth,
      product_format: trend.product_format,
      target_audience: trend.target_audience,
      user_outcome: trend.user_outcome,
      was_topic_transformed: trend.was_transformed,
      signal_type: trend.signal_type, // 'growing' | 'breakout'
      relevant_subreddits: subredditMap.get(trend.source_query || trend.title) || [],
    }));

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

  // Enrich new trends with competition & entry cost
  // ONLY for Mode 1 ('growing') trends — Breakout cards skip enrichment
  let enrichedCount = 0;
  if (!dryRun && savedCount > 0) {
    const baseUrl = request.nextUrl.origin;
    const MAX_ENRICH_PER_SCAN = 10;

    try {
      const trendsResponse = await fetch(`${baseUrl}/api/trends`);
      if (trendsResponse.ok) {
        const trendsData = await trendsResponse.json();
        // Only enrich 'growing' type trends (skip 'breakout')
        const unenriched = (trendsData.trends || [])
          .filter((t: { enriched_at?: string; signal_type?: string }) =>
            !t.enriched_at && t.signal_type !== 'breakout'
          )
          .slice(0, MAX_ENRICH_PER_SCAN);

        for (let i = 0; i < unenriched.length; i += 3) {
          const batch = unenriched.slice(i, i + 3);
          const enrichPromises = batch.map(async (trend: { id: string; title: string; category: string; growth_rate?: number; source_query?: string; source_growth?: string }) => {
            try {
              const enrichRes = await fetch(`${baseUrl}/api/enrich-trend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: trend.title,
                  category: trend.category,
                  growth_rate: trend.growth_rate,
                  source_query: trend.source_query,
                  source_growth: trend.source_growth,
                }),
              });
              if (enrichRes.ok) {
                const enrichData = await enrichRes.json();
                return { id: trend.id, ...enrichData };
              }
            } catch { /* skip failed enrichment */ }
            return null;
          });

          const results = await Promise.all(enrichPromises);
          const successfulEnrichments = results.filter(Boolean);
          enrichedCount += successfulEnrichments.length;
          totalSerpApiCalls += successfulEnrichments.length;

          if (successfulEnrichments.length > 0) {
            const currentData = await fetch(`${baseUrl}/api/trends`).then(r => r.json());
            const updatedTrends = (currentData.trends || []).map((t: Record<string, unknown>) => {
              const enrichment = successfulEnrichments.find((e: Record<string, unknown> | null) => e && e.id === t.id);
              if (enrichment) {
                return {
                  ...t,
                  competition_level: enrichment.competition_level,
                  entry_cost_estimate: enrichment.entry_cost_estimate,
                  top_players_count: enrichment.top_players_count,
                  monthly_searches: enrichment.monthly_searches,
                  enriched_at: enrichment.enriched_at,
                  data_confidence: enrichment.data_confidence,
                  growth_rate_source: enrichment.growth_rate_source,
                  growth_rate_verified: enrichment.growth_rate_verified,
                  sentiment: enrichment.sentiment,
                  difficulty_score: enrichment.difficulty_score,
                  difficulty_reasoning: enrichment.difficulty_reasoning,
                  quick_verdict: enrichment.quick_verdict,
                };
              }
              return t;
            });

            await fetch(`${baseUrl}/api/trends`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ trends: updatedTrends, lastUpdated: currentData.lastUpdated }),
            });
          }
        }
      }
    } catch (err) {
      console.error('[scan-trends] Enrichment step error:', err);
    }

    if (enrichedCount > 0) {
      console.log(`[scan-trends] Enriched ${enrichedCount} growing trends (breakout cards skip enrichment)`);
    }
  }

  const scanDurationMs = Date.now() - startTime;

  const result: ScanResult = {
    success: true,
    newTrendsCount: dryRun ? generatedTrends.length : savedCount,
    totalScanned: allGeneratedTrends.length,
    filteredOut,
    gptFiltered,
    enriched: enrichedCount,
    duplicatesSkipped,
    serpApiCallsUsed: totalSerpApiCalls,
    scanDurationMs,
    categories,
    mode1_trends: mode1TrendsCount,
    mode2_breakouts: mode2TrendsCount,
  };

  console.log(`[scan-trends] Complete: ${result.newTrendsCount} new (${mode1TrendsCount} growing + ${mode2TrendsCount} breakout), ${enrichedCount} enriched, ${totalSerpApiCalls} API calls, ${scanDurationMs}ms`);

  // Include debug info and generated trends in dryRun response
  if (dryRun) {
    return NextResponse.json({
      ...result,
      debug,
      generatedTrends: allGeneratedTrends,
    });
  }

  return NextResponse.json(result);
}

// GET — scan status / info
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    categories: Object.keys(CATEGORY_NICHES),
    totalNiches: Object.values(CATEGORY_NICHES).flat().length,
    mode2ExtraSeeds: Object.values(MODE2_EXTRA_SEEDS).flat().length,
    description: 'POST to this endpoint to scan Google Trends. Runs Mode 1 (12-month growing) + Mode 2 (3-month breakout) in one scan.',
    params: {
      categories: 'string[] — categories to scan (default: all)',
      maxEnrich: 'number — max queries to enrich with timeline (default: 12)',
      dryRun: 'boolean — if true, don\'t save to trends (default: false)',
      mode1: 'boolean — enable Mode 1 growing scan (default: true)',
      mode2: 'boolean — enable Mode 2 breakout scan (default: true)',
      secret: 'string — auth secret (if SCAN_SECRET env is set)',
    },
    budget: {
      mode1: '~28 SerpAPI calls (6 seed + 12 timeline + 10 enrich)',
      mode2: '~13 SerpAPI calls (8 seed + 5 timeline, no enrich)',
      combined: '~41 SerpAPI calls per scan',
      monthlyBudget: '5000 calls ($75 plan)',
      maxScansPerDay: '~4 scans',
    },
  });
}
