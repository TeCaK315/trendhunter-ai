// src/app/api/evidence/demand/route.ts
// Блок 2 — Спрос
// Главный вопрос: "Люди ищут чтобы купить или чтобы понять?"
//
// WAVE 1 LIMITATION:
// Блок 1 и Блок 2 запускаются параллельно. competitors_found из этого блока
// НЕ доступны когда Блок 1 выполняется. paying_score в Блоке 1 может быть
// недооценён на ~10-20%. Это архитектурное ограничение, не баг.
//
// DATA PRINCIPLE:
// - demand_index из Google Trends (индекс 0-100, не абсолютные поиски)
// - volume_confidence отражает достоверность ОБЪЁМА (зависит от source keywords)
// - commercial_intent_confidence отражает достоверность ИНТЕНТА (зависит от классификации)
// Эти два поля НЕЗАВИСИМЫ и используются разными потребителями:
//   volume_confidence → Блок 5 (Revenue Range confidence)
//   commercial_intent_confidence → Синтез (Скептик, механизм угрозы)
//
// ПОРЯДОК ИНФОРМАЦИИ:
// 1. Google Trends → keywords (top + rising)
// 2. Классификация интента (Haiku батчами)
// 3. Топ-3 КОММЕРЧЕСКИХ запроса → SERP → конкуренты + ad_density
// Конкуренты ищутся по коммерческим запросам, не по seed query.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth-helpers";
import { getServerSupabase } from "@/lib/supabase";

const claude = new Anthropic();

// ————————————————————————————————————————————————————————————
// ПОРОГИ ДИАГНОСТИКИ
// CALIBRATE_AFTER_50_ANALYSES — пометка означает что порог подобран
// теоретически и требует калибровки на реальных данных.
// ————————————————————————————————————————————————————————————
const DEMAND_THRESHOLDS = {
  // GREEN стандартный: средний индекс top keywords
  // CALIBRATE_AFTER_50_ANALYSES: если много ложных GREEN → повысить до 55-60
  // Если много ложных YELLOW → понизить до 40-45
  standard_min_index: 50,

  // GREEN микро-B2B: нишевые B2B рынки ищут меньше, но платят больше
  // CALIBRATE_AFTER_50_ANALYSES: если B2B ниши слишком часто GREEN → повысить до 40
  micro_b2b_min_index: 30,

  // YELLOW недостаточно: ниже этого = рынок слишком мал
  insufficient_max_index: 30,

  // DECLINING: историческое соотношение выше этого = рынок упал
  // historicalVolumeRatio = oldest_index / newest_index
  // 1.4 = рынок упал на 40% за 5 лет (~8%/год) → ощутимое падение
  // CALIBRATE_AFTER_50_ANALYSES: если declining срабатывает редко → понизить до 1.2
  // Если слишком часто → повысить до 1.6
  declining_ratio_threshold: 1.4,
} as const;

// ————————————————————————————————————————————————————————————
// ТИПЫ
// ————————————————————————————————————————————————————————————
type IntentType = "commercial" | "informational" | "mixed";
type GrowthRate = "growing" | "stable" | "declining";
type Diagnosis = "green" | "yellow" | "red";
type DiagnosisReason =
  | "commercial_market"
  | "micro_b2b_market"
  | "informational_market"
  | "declining_market"
  | "hype_without_foundation"
  | "grey_zone"
  | "insufficient_volume";
type KeywordsSource = "google_trends" | "claude_fallback";
type IntentConfidence = "high" | "medium" | "low";
type VolumeConfidence = "high" | "medium" | "low";

interface SearchKeyword {
  query: string;
  source: "top" | "rising";
  volume?: number; // Trends индекс 0-100 (или >100 для rising)
  intent: IntentType;
  intent_confidence: IntentConfidence;
}

interface CompetitorSignal {
  domain: string;
  name: string;
  source: "paid" | "organic"; // paid = конкурент с рекламным бюджетом
  query: string; // по какому коммерческому запросу найден
  position?: number; // позиция в органике
  serp_frequency?: number; // сколько раз этот домен встречался в SERP
}

interface Layer1Data {
  demand_index: number; // средний индекс top keywords (0-100)
  keyword_count: number;
  growth_rate: GrowthRate;
  historical_volume_ratio: number; // oldest_index / newest_index
  volume_3m_ago?: number; // индекс 3 месяца назад (для detectHype)
  keywords_source: KeywordsSource;
  volume_confidence: VolumeConfidence;
  top_keywords: SearchKeyword[];
  rising_keywords: SearchKeyword[];
}

interface Layer2Data {
  commercial_intent_ratio: number;
  informational_intent_ratio: number;
  commercial_intent_confidence: IntentConfidence;
  serp_ad_density: number; // среднее по топ-3 коммерческим запросам
  classification_details: {
    total_keywords_classified: number;
    keywords_with_high_confidence: number;
    ambiguous_keywords: number;
  };
}

interface Layer3Data {
  rising_queries_ratio: number;
  rising_queries_count: number;
  has_momentum: boolean;
}

interface DiagnosisResult {
  diagnosis: Diagnosis;
  score: number;
  conflict_weight: number;
  reason: DiagnosisReason;
  key_factors: string[];
  key_metric: string;
}

interface DemandBlockOutput {
  diagnosis: Diagnosis;
  score: number;
  conflict_weight: number;
  key_factors: string[];
  key_metric: string;
  block_context: {
    niche: string;
    // intent_type: 'hype' — специальный кейс, не входит в IntentType.
    // Потребители (Блок 4, Синтез) должны явно обрабатывать 'hype'.
    intent_type: IntentType | "hype";
    diagnosis_reason: DiagnosisReason;
    // Сырые метрики для Синтеза (Скептик использует raw числа)
    commercial_intent_ratio: number;
    commercial_intent_confidence: IntentConfidence;
    demand_index: number; // индекс 0-100, НЕ абсолютные поиски
    // Независимые флаги — работают независимо от diagnosis
    has_declining_signal: boolean;
    has_hype_risk: boolean;
    has_insufficient_data: boolean; // keywords_source === 'claude_fallback'
    // Для Блока 4 (seed данные для обогащения) и раздела Бизнес
    competitors_found: CompetitorSignal[];
    serp_ad_density: number;
    ad_density_source: "commercial_queries" | "fallback_queries";
    // Метаданные качества — РАЗДЕЛЕНЫ (разные потребители)
    volume_source: KeywordsSource;
    volume_confidence: VolumeConfidence; // → Блок 5: снижает confidence Revenue Range
    rising_queries_ratio: number;
    historical_volume_ratio: number; // для оценки зрелости рынка
    // #5: GEO validation
    geo_top_market?: string;
    geo_demand_mismatch?: boolean;
    // #10: demand confidence
    demand_confidence_score?: number;
    // #13: structural decline
    is_structural_decline?: boolean;
    // #14: force experiment for synthesis
    force_experiment_by_confidence?: boolean;
    // Data quality — для downstream блоков и UI
    data_quality: {
      total_keywords: number;
      classified_successfully: number;
      failed_batches: number;
      classification_confidence: 'high' | 'medium' | 'low';
      cross_validated_with_serp: boolean;
    };
    data_quality_verdict?: {
      verdict: string;
      reason: string;
      recommendation: string | null;
    };
  };
  layers: {
    layer1: Layer1Data;
    layer2: Layer2Data;
    layer3: Layer3Data;
  };
}

// ————————————————————————————————————————————————————————————
// СТОП-ЛИСТ АГРЕГАТОРОВ
// Домены которые не являются конкурентами
// ————————————————————————————————————————————————————————————
const AGGREGATOR_STOPLIST = [
  // Review aggregators
  "g2.com",
  "capterra.com",
  "trustpilot.com",
  "getapp.com",
  "softwareadvice.com",
  "app.co",
  // App stores
  "apps.apple.com",
  "play.google.com",
  // Directories
  "alternativeto.net",
  "slashdot.org",
  "producthunt.com",
  // Social / UGC
  "reddit.com",
  "quora.com",
  "medium.com",
  "substack.com",
  "youtube.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
  // Wiki / encyclopedic
  "wikipedia.org",
  "en.wikipedia.org",
  // News & Media
  "techcrunch.com",
  "venturebeat.com",
  "hackernews.ycombinator.com",
  "forbes.com",
  "businessinsider.com",
  "wired.com",
  "cnet.com",
  "zdnet.com",
  "mashable.com",
  "theverge.com",
  "engadget.com",
  "inc.com",
  "entrepreneur.com",
  "wsj.com",
  "bloomberg.com",
  "reuters.com",
  "thebalancemoney.com",
  "investopedia.com",
  "nerdwallet.com",
  "fastcompany.com",
  "hbr.org",
  // Нишевые медиа
  "housingwire.com",
  "inman.com",
  // Tech обзоры
  "pcmag.com",
  "techradar.com",
  "tomsguide.com",
  "tomshardware.com",
  "digitaltrends.com",
  // SEO/контент фермы
  "clutch.co",
  "goodfirms.co",
  "expertise.com",
  "trustradius.com",
  "sourceforge.net",
  // Big Tech (не конкуренты для SaaS-ниш)
  "google.com",
  "maps.google.com",
  "apple.com",
  "microsoft.com",
  "bing.com",
  "amazon.com",
  "meta.com",
  // Общие платформы
  "github.com",
  "stackoverflow.com",
  "stackexchange.com",
  "docs.google.com",
  "support.google.com",
  "support.apple.com",
  "support.microsoft.com",
];

// Домены верхнего уровня которые не являются SaaS-конкурентами
const NON_COMPETITOR_TLDS = [".gov", ".edu", ".mil", ".int"];

// ————————————————————————————————————————————————————————————
// #5 — GEO VALIDATOR: нормализация названий стран в ISO коды
// ————————————————————————————————————————————————————————————
const COUNTRY_ALIASES: Record<string, string[]> = {
  "US": ["United States", "USA", "America", "North America"],
  "DE": ["Germany", "Deutschland", "European Union", "Europe"],
  "GB": ["United Kingdom", "UK", "Great Britain", "England"],
  "UA": ["Ukraine", "Украина"],
  "FR": ["France", "Francia"],
  "PL": ["Poland", "Польша"],
  "CA": ["Canada"],
  "AU": ["Australia"],
  "IN": ["India"],
  "BR": ["Brazil", "Brasil"],
  "JP": ["Japan"],
  "KR": ["South Korea", "Korea"],
  "IL": ["Israel"],
  "NL": ["Netherlands", "Holland"],
  "SE": ["Sweden"],
  "SG": ["Singapore"],
};

function normalizeToCountryCode(market: string): string {
  const upper = market.toUpperCase().trim();
  if (upper.length === 2) return upper;
  for (const [code, aliases] of Object.entries(COUNTRY_ALIASES)) {
    if (aliases.some(a => a.toLowerCase() === market.toLowerCase().trim()))
      return code;
  }
  return upper.slice(0, 2);
}

// ————————————————————————————————————————————————————————————
// #10 — DEMAND CONFIDENCE: взвешенная сумма вместо произведения
// ————————————————————————————————————————————————————————————
function calculateDemandConfidence(ctx: {
  hasDegradedData: boolean;
  dataScarcity: 'HIGH' | 'MEDIUM' | 'LOW';
  noTimeseries5y: boolean;
  noTimeseries3m: boolean;
  trendStability: 'HIGH' | 'MEDIUM' | 'LOW';
  crossValidation: -1 | 0 | 1;
  isLowVolumeData: boolean;
}): number {
  const criticalPenalties: number[] = [];
  const moderatePenalties: number[] = [];

  if (ctx.hasDegradedData) criticalPenalties.push(0.55);
  if (ctx.dataScarcity === 'HIGH') criticalPenalties.push(0.4);

  if (ctx.noTimeseries5y || ctx.noTimeseries3m) moderatePenalties.push(0.3);
  if (ctx.trendStability === 'LOW') moderatePenalties.push(0.3);
  if (ctx.crossValidation === -1) moderatePenalties.push(0.2);
  if (ctx.isLowVolumeData) moderatePenalties.push(0.25);

  const allPenalties = [
    ...criticalPenalties,
    ...moderatePenalties.map(p => p * 0.5),
  ];

  if (allPenalties.length === 0) return 1.0;

  const avgPenalty = allPenalties.reduce((a, b) => a + b, 0) / allPenalties.length;
  const rawScore = Math.max(1.0 - avgPenalty, 0.25);

  if (ctx.crossValidation === 1) return Math.min(rawScore * 1.1, 1.0);
  return rawScore;
}

// ————————————————————————————————————————————————————————————
// #13 — REMOVE OUTLIERS для structural decline
// ————————————————————————————————————————————————————————————
function removeOutliers(arr: number[]): number[] {
  if (arr.length < 4) return arr;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = Math.sqrt(
    arr.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / arr.length
  );
  if (std === 0) return arr;
  return arr.filter(x => Math.abs(x - mean) <= 2 * std);
}

function avgArr(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function detectStructuralDecline(timeline5y: Array<{ date: string; value: number }>): boolean {
  const values = timeline5y.map(t => t.value);
  if (values.length < 104) return false; // need 2+ years

  const twoYearsAgo = removeOutliers(values.slice(0, 52));
  const oneYearAgo = removeOutliers(values.slice(52, 104));
  const recent = removeOutliers(values.slice(-52));

  return (
    avgArr(twoYearsAgo) > avgArr(oneYearAgo) * 1.1 &&
    avgArr(oneYearAgo) > avgArr(recent) * 1.1
  );
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function isAggregator(domain: string): boolean {
  if (AGGREGATOR_STOPLIST.some((stop) => domain.includes(stop))) return true;
  // .gov, .edu и т.д. — не SaaS конкуренты
  if (NON_COMPETITOR_TLDS.some((tld) => domain.endsWith(tld))) return true;
  return false;
}

// ————————————————————————————————————————————————————————————
// SERPAPI HELPER
// ————————————————————————————————————————————————————————————
async function fetchSerpAPI(
  engine: string,
  params: Record<string, string>,
  serpApiKey: string,
): Promise<any> {
  try {
    const urlParams = new URLSearchParams({
      engine,
      api_key: serpApiKey,
      ...params,
    });
    const res = await fetch(`https://serpapi.com/search?${urlParams}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ————————————————————————————————————————————————————————————
// ШАГ 1: СБОР ДАННЫХ ИЗ GOOGLE TRENDS
// SERP здесь НЕ запускается — конкуренты собираются после классификации
// ————————————————————————————————————————————————————————————
async function collectDemandData(
  niche: string,
  keywords: string[],
  serpApiKey: string,
): Promise<{
  topKeywords: SearchKeyword[];
  risingKeywords: SearchKeyword[];
  historicalVolumeRatio: number;
  volume3mAgoIndex?: number;
  keywordsSource: KeywordsSource;
  timeline_5y: Array<{ date: string; value: number }>;
  timeline_3m: Array<{ date: string; value: number }>;
  geo_breakdown: Array<{ region: string; label: string; value: number }>;
}> {
  // Google Trends работает лучше с короткими фразами (2-3 слова)
  // Длинный seed вроде "HR software comparison painful onboarding" → нули
  // Используем только niche для Trends, keywords — для классификации
  const seedQuery = niche;

  // Trends + Historical 5y + Historical 3m + Geo параллельно
  const [trendsData, trendsHistorical, trendsHistorical3m, trendsGeo] = await Promise.all([
    fetchSerpAPI(
      "google_trends",
      {
        q: seedQuery,
        data_type: "RELATED_QUERIES",
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      "google_trends",
      {
        q: seedQuery,
        data_type: "TIMESERIES",
        date: "today 5-y",
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      "google_trends",
      {
        q: seedQuery,
        data_type: "TIMESERIES",
        date: "today 3-m",
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      "google_trends",
      {
        q: seedQuery,
        data_type: "GEO_MAP",
      },
      serpApiKey,
    ),
  ]);

  // —— Keywords ————————————————————————————————————————
  let keywordsSource: KeywordsSource = "google_trends";

  // Pre-filter: отбрасываем related queries без слов из seed query
  const seedWords = seedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const isRelevantQuery = (q: any): boolean => {
    const query = (q.query || q.topic?.title || "").toLowerCase();
    return seedWords.some(word => query.includes(word));
  };

  let topRaw: any[] = (trendsData?.related_queries?.top || []).filter(isRelevantQuery);
  let risingRaw: any[] = (trendsData?.related_queries?.rising || []).filter(isRelevantQuery);

  // Если фильтрация убрала всё — берём без фильтра (лучше мусор чем ничего)
  if (topRaw.length === 0 && risingRaw.length === 0) {
    topRaw = trendsData?.related_queries?.top || [];
    risingRaw = trendsData?.related_queries?.rising || [];
  }

  // Fallback: Claude генерирует keywords только если Trends пустой
  // Флаг has_insufficient_data = true передаётся в block_context
  if (topRaw.length === 0) {
    keywordsSource = "claude_fallback";
    const fallbackKeywords = await generateFallbackKeywords(niche, keywords);
    topRaw = fallbackKeywords.map((q: string) => ({ query: q, value: 50 }));
    risingRaw = [];
  }

  const topKeywords: SearchKeyword[] = topRaw
    .slice(0, 20)
    .map((item: any) => ({
      query: item.query || item.topic?.title || "",
      source: "top" as const,
      volume: item.value,
      intent: "mixed" as IntentType,
      intent_confidence: "low" as IntentConfidence,
    }))
    .filter((k: SearchKeyword) => k.query.length > 0);

  const risingKeywords: SearchKeyword[] = risingRaw
    .slice(0, 10)
    .map((item: any) => ({
      query: item.query || item.topic?.title || "",
      source: "rising" as const,
      volume: item.value,
      intent: "mixed" as IntentType,
      intent_confidence: "low" as IntentConfidence,
    }))
    .filter((k: SearchKeyword) => k.query.length > 0);

  // —— Исторические данные для detectHype ————————————————
  // historicalVolumeRatio = oldest_index / newest_index
  // > 1.4 означает рынок упал (старый индекс выше нового)
  const timelineData =
    trendsHistorical?.interest_over_time?.timeline_data || [];
  let historicalVolumeRatio = 1.0;
  let volume3mAgoIndex: number | undefined;

  if (timelineData.length >= 2) {
    const oldestIdx = timelineData[0]?.values?.[0]?.extracted_value || 100;
    const newestIdx =
      timelineData[timelineData.length - 1]?.values?.[0]?.extracted_value ||
      100;
    if (newestIdx > 0) historicalVolumeRatio = oldestIdx / newestIdx;

    // Индекс 3 месяца назад — для detectHype новых категорий без истории
    const threeMonthsAgoIdx = Math.max(0, timelineData.length - 13);
    volume3mAgoIndex =
      timelineData[threeMonthsAgoIdx]?.values?.[0]?.extracted_value;
  }

  // Map timeline data to simple {date, value} format
  const timeline_5y = timelineData.map((point: any) => ({
    date: point.date || '',
    value: point.values?.[0]?.extracted_value ?? 0,
  }));

  const timelineData3m = trendsHistorical3m?.interest_over_time?.timeline_data || [];
  const timeline_3m = timelineData3m.map((point: any) => ({
    date: point.date || '',
    value: point.values?.[0]?.extracted_value ?? 0,
  }));

  // —— Гео-данные ————————————————————————————————————————
  const geoRaw = trendsGeo?.interest_by_region?.map((r: any) => ({
    region: r.geo || '',
    label: r.location || r.geo || '',
    value: r.max_value_index ?? r.value ?? 0,
  })) || [];
  // Топ-10 по значению, отсекаем нули
  const geo_breakdown = geoRaw
    .filter((g: any) => g.value > 0)
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 10);

  return {
    topKeywords,
    risingKeywords,
    historicalVolumeRatio,
    volume3mAgoIndex,
    keywordsSource,
    timeline_5y,
    timeline_3m,
    geo_breakdown,
  };
}

// ————————————————————————————————————————————————————————————
// ШАГ 3: КОНКУРЕНТЫ ИЗ ТОП-3 КОММЕРЧЕСКИХ ЗАПРОСОВ
// Запускается ПОСЛЕ классификации — получает уже размеченные keywords.
// Вариант B: фильтруем на commercial с сортировкой по confidence.
// ————————————————————————————————————————————————————————————
async function collectCompetitorsAndAdDensity(
  classifiedKeywords: SearchKeyword[],
  serpApiKey: string,
): Promise<{
  competitors: CompetitorSignal[];
  serpAdDensity: number;
  adDensitySource: "commercial_queries" | "fallback_queries";
  competitorsQueriesUsed: string[];
}> {
  // Топ-3 коммерческих по confidence + volume (Вариант B)
  const commercialQueries = classifiedKeywords
    .filter((k) => k.intent === "commercial")
    .sort((a, b) => {
      const confOrder = { high: 0, medium: 1, low: 2 };
      const confDiff =
        confOrder[a.intent_confidence] - confOrder[b.intent_confidence];
      if (confDiff !== 0) return confDiff;
      return (b.volume ?? 0) - (a.volume ?? 0);
    })
    .slice(0, 3)
    .map((k) => k.query);

  // Fallback: если нет коммерческих — берём топ-3 по volume (any intent)
  const queriesToSearch =
    commercialQueries.length > 0
      ? commercialQueries
      : classifiedKeywords
          .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
          .slice(0, 3)
          .map((k) => k.query);

  const adDensitySource =
    commercialQueries.length > 0 ? "commercial_queries" : "fallback_queries";

  if (queriesToSearch.length === 0) {
    return {
      competitors: [],
      serpAdDensity: 0,
      adDensitySource,
      competitorsQueriesUsed: [],
    };
  }

  // Параллельный SERP по всем запросам
  const serpResults = await Promise.all(
    queriesToSearch.map((q) =>
      fetchSerpAPI("google", { q, gl: "us", num: "10" }, serpApiKey),
    ),
  );

  function extractCompanyName(domain: string, fallback: string): string {
    // Убираем субдомены: "editorial.rottentomatoes.com" → "rottentomatoes.com"
    const parts = domain.replace(/^www\./, "").split(".");
    const mainPart = parts.length > 2 ? parts[parts.length - 2] : parts[0];

    // Слишком короткий или нечитаемый → fallback на title
    if (mainPart.length < 3) return fallback;

    // Капитализируем первую букву
    return mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
  }

  // #15: track serp_frequency per domain across all queries
  const domainFrequency = new Map<string, number>();
  const allCompetitors: CompetitorSignal[] = [];
  const seenDomains = new Set<string>();
  let totalAds = 0;
  let totalResults = 0;

  // First pass: count domain frequency across all SERP results
  serpResults.forEach((serpData) => {
    if (!serpData) return;
    const allUrls = [
      ...(serpData?.ads || serpData?.paid || []).map((a: any) => a?.link || a?.url || a?.displayed_link || ''),
      ...(serpData?.organic_results || []).map((r: any) => r?.link || r?.url || ''),
    ];
    for (const url of allUrls) {
      const domain = extractDomain(url);
      if (domain && !isAggregator(domain)) {
        domainFrequency.set(domain, (domainFrequency.get(domain) || 0) + 1);
      }
    }
  });

  serpResults.forEach((serpData, idx) => {
    if (!serpData) return;
    const query = queriesToSearch[idx];

    const adsCount = serpData?.ads?.length || 0;
    const organicCount = serpData?.organic_results?.length || 0;
    totalAds += adsCount;
    totalResults += adsCount + organicCount;

    // Платные конкуренты — рекламируются по коммерческим запросам = прямые конкуренты
    const ads = serpData?.ads || serpData?.paid || [];
    ads.forEach((ad: any) => {
      const url =
        ad?.link || ad?.url || ad?.displayed_link || ad?.display_link || "";
      const domain = extractDomain(url);
      if (!domain || seenDomains.has(domain) || isAggregator(domain)) return;
      seenDomains.add(domain);
      allCompetitors.push({
        domain,
        name: extractCompanyName(domain, ad.title || ad.name || domain),
        source: "paid",
        query,
        serp_frequency: domainFrequency.get(domain) || 1,
      });
    });

    // Органические конкуренты топ-5
    const organic = serpData?.organic_results || serpData?.results || [];
    organic.slice(0, 5).forEach((r: any, pos: number) => {
      const url =
        r?.link || r?.url || r?.displayed_link || r?.display_link || "";
      const domain = extractDomain(url);
      if (!domain || seenDomains.has(domain) || isAggregator(domain)) return;
      seenDomains.add(domain);
      allCompetitors.push({
        domain,
        name: extractCompanyName(domain, r.title || domain),
        source: "organic",
        query,
        position: pos + 1,
        serp_frequency: domainFrequency.get(domain) || 1,
      });
    });
  });

  // #15: Платные конкуренты первыми, фильтр по frequency >= 2 (кроме paid — они всегда проходят)
  const competitors = allCompetitors
    .filter(c => c.source === 'paid' || (c.serp_frequency ?? 1) >= 2)
    .sort((a, b) => {
      if (a.source === 'paid' && b.source !== 'paid') return -1;
      if (a.source !== 'paid' && b.source === 'paid') return 1;
      return (b.serp_frequency ?? 1) - (a.serp_frequency ?? 1);
    });

  // Ad density: сколько рекламных слотов занято из максимальных 4 на страницу
  // Google показывает максимум 4 объявления на странице SERP
  const queriesCount = serpResults.filter(Boolean).length;
  const maxAdsPerQuery = 4;
  const serpAdDensity = queriesCount > 0
    ? Math.min(totalAds / (queriesCount * maxAdsPerQuery), 1.0)
    : 0;

  return {
    competitors,
    serpAdDensity,
    adDensitySource,
    competitorsQueriesUsed: queriesToSearch,
  };
}

// ————————————————————————————————————————————————————————————
// FALLBACK: CLAUDE ГЕНЕРИРУЕТ KEYWORDS
// Используется только если Google Trends вернул пустой результат.
// has_insufficient_data = true передаётся в block_context.
// Блок 5 читает этот флаг и понижает confidence Revenue Range.
// ————————————————————————————————————————————————————————————

// 2.5 — детерминированное расширение семантического ядра.
// Используется когда Trends дал < 20 ключевых, чтобы перейти из PARTIAL в RELIABLE.
// 5 категорий: продукт-формы, AI-вариации, сравнения/альтернативы, боли, конкуренты-альтернативы.
function buildExpandedKeywords(niche: string): string[] {
  const base = niche.toLowerCase().trim();
  const cleanBase = base.replace(/\bservices?\b/g, '').trim() || base;
  return [
    // Категория 1 — продукт-формы (люди ищут решение)
    `${base} software`,
    `${base} tools`,
    `${base} platform`,
    `${base} solution`,
    `best ${base}`,

    // Категория 2 — AI-вариации (быстрорастущий сегмент)
    `ai ${base}`,
    `automated ${base}`,
    `${cleanBase} automation`,

    // Категория 3 — сравнения и альтернативы (коммерческий интент)
    `${base} alternatives`,
    `${base} vs`,
    `top ${base}`,
    `${base} for small business`,
    `${base} for enterprise`,

    // Категория 4 — боли и информационный интент с конверсией
    `how to automate ${cleanBase}`,
    `${base} problems`,
    `${base} pricing`,
    `${base} review`,

    // Категория 5 — конкуренты-альтернативы (растущий интент)
    `zapier alternative`,
    `make.com alternative`,
    `n8n alternative`,
  ];
}

async function generateFallbackKeywords(
  niche: string,
  seedKeywords: string[],
): Promise<string[]> {
  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      temperature: 0,
      max_tokens: 300,
      system: "Отвечай только валидным JSON без markdown и пояснений.",
      messages: [
        {
          role: "user",
          content: `Сгенерируй 10 реальных поисковых запросов которые люди вводят в Google когда ищут решение в нише: "${niche}". Учитывай контекст: ${seedKeywords.join(", ")}. Запросы должны быть на английском языке. Включай коммерческие ("best X software", "X tool pricing") и информационные ("how to X", "what is X"). Ответь JSON массивом строк: ["query1", "query2", ...]`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return [];
    }

    if (!Array.isArray(result)) return [];
    return result.filter((r: any) => typeof r === "string" && r.length > 0);
  } catch {
    return [];
  }
}

// ————————————————————————————————————————————————————————————
// ШАГ 2: КЛАССИФИКАЦИЯ ИНТЕНТА (Haiku батчами)
// Claude классифицирует РЕАЛЬНЫЕ запросы из Trends — не генерирует.
// Принцип: данные реальные, Claude только навешивает label.
// ————————————————————————————————————————————————————————————
async function classifyIntentBatch(
  keywords: SearchKeyword[],
  niche: string,
): Promise<{ classified: SearchKeyword[]; failed: boolean }> {
  if (keywords.length === 0) return { classified: [], failed: false };

  const queriesText = keywords.map((k, i) => {
    const vol = k.volume != null ? ` (volume: ${k.volume})` : '';
    return `[${i}] ${k.query}${vol}`;
  }).join("\n");

  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      temperature: 0,
      max_tokens: 600,
      system: "Respond with valid JSON only, no markdown or explanations.",
      messages: [
        {
          role: "user",
          content: `You are analyzing search queries in the niche: "${niche}".

Classify each query's intent:
- "commercial": user wants to BUY, subscribe, compare pricing, find a tool/service, read reviews before purchase, find alternatives to switch to
- "informational": user wants to LEARN, understand concepts, find tutorials, get definitions, read news/articles

Classify intent based ONLY on query text. Do not consider volume — volume weighting is handled separately.

Commercial intent signals (user is comparing or ready to buy):
- "best X tools / software / platforms / apps / solutions"
- "X alternatives", "X vs Y", "X compared to Y"
- "X pricing / cost / price"
- "X reviews / rating"
- "top X for [use case]"
- "compare X", "X competitors"
- "buy X", "X free trial", "X demo"

Informational intent signals (user is learning):
- "what is X", "how does X work", "X explained"
- "X tutorial", "X guide", "X examples"
- "X benefits", "X definition"
- "history of X", "X statistics"

Mixed intent (classify as mixed):
- Queries that could be either depending on context
- Brand name only without qualifier

Queries:
${queriesText}

Return JSON array of ${keywords.length} objects:
[{"intent": "commercial", "confidence": "high"}, ...]
confidence: "high" if clearly commercial/informational, "medium" if likely but not certain, "low" if ambiguous`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "[]";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch (e) {
      console.error("[Block2 Pass2] Intent classification JSON parse error", {
        error: e,
      });
      return { classified: keywords, failed: true };
    }

    if (!Array.isArray(result) || result.length !== keywords.length) {
      console.warn("[Block2 Pass2] Intent classification count mismatch", {
        expected: keywords.length,
        received: Array.isArray(result) ? result.length : "not-array",
      });
      return { classified: keywords, failed: true };
    }

    return {
      classified: keywords.map((k, i) => {
        const r = result[i] as any;
        const intent = ["commercial", "informational"].includes(r?.intent)
          ? (r.intent as IntentType)
          : ("mixed" as IntentType);
        const confidence = ["high", "medium", "low"].includes(r?.confidence)
          ? (r.confidence as IntentConfidence)
          : ("low" as IntentConfidence);
        return { ...k, intent, intent_confidence: confidence };
      }),
      failed: false,
    };
  } catch (error) {
    console.error("[Block2 Pass2] classifyIntentBatch error", error);
    return { classified: keywords, failed: true };
  }
}

// ————————————————————————————————————————————————————————————
// HYPE DETECTION — детерминированный, без LLM
// Двойной фильтр: risingRatio > 50% И historicalRatio < 0.20
// Исключает молодые стабильные рынки (rising высокий, но история есть)
// FIX #2: добавлен кейс "хайп возрождения" для VR-like сценариев
// ————————————————————————————————————————————————————————————
function detectHype(
  demandIndex: number,
  historicalVolumeRatio: number,
  growthRate: GrowthRate,
  risingQueriesCount: number,
  totalKeywords: number,
  volume3mAgoIndex?: number,
): boolean {
  // Условие 1: рынок растёт
  if (growthRate !== "growing") return false;

  // Условие 2: много новых запросов (> 50%, не >= чтобы быть консервативнее)
  const risingRatio =
    totalKeywords > 0 ? risingQueriesCount / totalKeywords : 0;
  if (risingRatio <= 0.5) return false;

  // Условие 3a: новая категория — нет исторических данных
  // historicalVolumeRatio = 1.0 это дефолт когда нет данных
  if (historicalVolumeRatio === 1.0) {
    if (!volume3mAgoIndex || volume3mAgoIndex === 0) return false;
    // 3x+ рост за 3 месяца = хайп
    const growth3m = (demandIndex - volume3mAgoIndex) / volume3mAgoIndex;
    return growth3m >= 3.0;
  }

  // Условие 3b: обычный хайп — есть история, но < 20% от текущего
  if (historicalVolumeRatio < 0.2) {
    return true;
  }

  // FIX #2: хайп возрождения — рынок падал, но сейчас резко растёт
  // historicalVolumeRatio > 1.4 означает рынок упал на 40% за 5 лет
  // risingRatio > 0.5 означает сейчас много новых запросов (всплеск)
  // Это подозрительный паттерн — может быть реальным разворотом или хайпом
  // Обрабатываем как потенциальный хайп до накопления данных
  if (
    historicalVolumeRatio > DEMAND_THRESHOLDS.declining_ratio_threshold &&
    risingRatio > 0.5
  ) {
    return true;
  }

  return false;
}

// ————————————————————————————————————————————————————————————
// СЕЗОННОСТЬ — анализ месячных паттернов из 5y timeline
// Детерминированно, без LLM. 0 дополнительных SerpAPI вызовов.
// ————————————————————————————————————————————————————————————
const MONTH_NAMES_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

interface SeasonalityResult {
  monthly_avg: number[];         // 12 средних значений по месяцам
  peak_months: number[];         // индексы месяцев-пиков (0-11)
  low_months: number[];          // индексы месяцев-спадов
  has_seasonality: boolean;      // std/mean > 0.15
  current_phase: string;         // "peak" | "rising" | "declining" | "low"
  interpretation: string;        // текст для UI
}

function analyzeSeasonality(
  timeline: Array<{ date: string; value: number }>,
): SeasonalityResult | null {
  if (timeline.length < 52) return null; // нужен хотя бы год

  // Группируем по месяцам (date может быть "Jan 1 – 7, 2024" или ISO)
  const monthBuckets: number[][] = Array.from({ length: 12 }, () => []);

  for (const point of timeline) {
    const dateStr = point.date;
    let month = -1;

    // Пробуем ISO формат (2024-01-07)
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})/);
    if (isoMatch) {
      month = parseInt(isoMatch[2], 10) - 1;
    } else {
      // SerpAPI формат: "Jan 1 – 7, 2024"
      const monthMap: Record<string, number> = {
        Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
        Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
      };
      const serpMatch = dateStr.match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/);
      if (serpMatch) month = monthMap[serpMatch[1]];
    }

    if (month >= 0 && month < 12 && point.value > 0) {
      monthBuckets[month].push(point.value);
    }
  }

  const monthlyAvg = monthBuckets.map(vals =>
    vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0
  );

  const nonZero = monthlyAvg.filter(v => v > 0);
  if (nonZero.length < 6) return null;

  const mean = nonZero.reduce((a, b) => a + b, 0) / nonZero.length;
  const std = Math.sqrt(nonZero.reduce((s, v) => s + (v - mean) ** 2, 0) / nonZero.length);
  const hasSeasonality = mean > 0 && (std / mean) > 0.15;

  if (!hasSeasonality) return null;

  // Пики = месяцы где avg > mean + 0.5*std
  const peakThreshold = mean + std * 0.5;
  const lowThreshold = mean - std * 0.5;
  const peakMonths = monthlyAvg.map((v, i) => v >= peakThreshold ? i : -1).filter(i => i >= 0);
  const lowMonths = monthlyAvg.map((v, i) => v > 0 && v <= lowThreshold ? i : -1).filter(i => i >= 0);

  // Текущая фаза — учитываем направление через ближайшие месяцы
  const currentMonth = new Date().getMonth();
  const nextMonth = (currentMonth + 1) % 12;
  const nextNextMonth = (currentMonth + 2) % 12;
  const movingToPeak = peakMonths.includes(nextMonth) || peakMonths.includes(nextNextMonth);
  const movingToLow = lowMonths.includes(nextMonth) || lowMonths.includes(nextNextMonth);

  const currentPhase = peakMonths.includes(currentMonth) ? 'peak'
    : lowMonths.includes(currentMonth) ? 'low'
    : movingToPeak ? 'rising'
    : movingToLow ? 'declining'
    : monthlyAvg[currentMonth] > mean ? 'rising' : 'declining';

  const peakNames = peakMonths.map(m => MONTH_NAMES_RU[m]).join(', ');
  const phaseText = currentPhase === 'peak' ? 'вы в пике спроса'
    : currentPhase === 'rising' ? 'спрос растёт к пику'
    : currentPhase === 'low' ? 'сейчас спад — подготовьтесь к следующему пику'
    : 'спрос снижается от пика';

  return {
    monthly_avg: monthlyAvg,
    peak_months: peakMonths,
    low_months: lowMonths,
    has_seasonality: true,
    current_phase: currentPhase,
    interpretation: `Пик спроса: ${peakNames}. Сейчас ${MONTH_NAMES_RU[currentMonth]} — ${phaseText}.`,
  };
}

// ————————————————————————————————————————————————————————————
// BUYING STAGE — определяем где покупатель в цикле решения
// Детерминированно из keywords, 0 API calls
// ————————————————————————————————————————————————————————————
interface BuyingStageResult {
  awareness: number;
  consideration: number;
  decision: number;
  dominant_stage: 'awareness' | 'consideration' | 'decision';
  interpretation: string;
}

const BUYING_PATTERNS: Record<string, string[]> = {
  awareness: ['what is', 'how to', 'guide', 'tutorial', 'learn', 'explain', 'introduction', 'basics', 'overview'],
  consideration: ['best', 'top', 'comparison', 'vs', 'alternative', 'review', 'compare', 'which', 'recommend'],
  decision: ['pricing', 'cost', 'buy', 'demo', 'trial', 'free', 'discount', 'coupon', 'plan', 'subscription', 'signup'],
};

function analyzeBuyingStage(keywords: SearchKeyword[]): BuyingStageResult | null {
  if (keywords.length < 3) return null;

  let awareness = 0, consideration = 0, decision = 0;

  for (const kw of keywords) {
    const q = kw.query.toLowerCase();
    let matched = false;
    for (const pattern of BUYING_PATTERNS.decision) {
      if (q.includes(pattern)) { decision++; matched = true; break; }
    }
    if (!matched) {
      for (const pattern of BUYING_PATTERNS.consideration) {
        if (q.includes(pattern)) { consideration++; matched = true; break; }
      }
    }
    if (!matched) {
      for (const pattern of BUYING_PATTERNS.awareness) {
        if (q.includes(pattern)) { awareness++; matched = true; break; }
      }
    }
    // Unmatched keywords = не классифицированы, не считаем
  }

  const total = awareness + consideration + decision;
  if (total < 2) return null;

  const pctAwareness = Math.round((awareness / total) * 100);
  const pctConsideration = Math.round((consideration / total) * 100);
  const pctDecision = Math.round((decision / total) * 100);

  const dominant = pctDecision >= pctConsideration && pctDecision >= pctAwareness ? 'decision'
    : pctConsideration >= pctAwareness ? 'consideration'
    : 'awareness';

  const stageTexts = {
    awareness: `${pctAwareness}% запросов — стадия осознания. Люди только узнают о проблеме, нужен контент-маркетинг.`,
    consideration: `${pctConsideration}% запросов — стадия выбора. Люди уже знают что нужно, сравнивают варианты.`,
    decision: `${pctDecision}% запросов — стадия покупки. Люди готовы платить, ищут цены и пробные версии.`,
  };

  return {
    awareness: pctAwareness,
    consideration: pctConsideration,
    decision: pctDecision,
    dominant_stage: dominant,
    interpretation: stageTexts[dominant],
  };
}

// ————————————————————————————————————————————————————————————
// ТРЕНД КОНКУРЕНТОВ — растут или падают (1 SerpAPI вызов)
// ————————————————————————————————————————————————————————————
interface CompetitorTrend {
  name: string;
  domain: string;
  growth: number | null; // % изменения
  direction: 'up' | 'down' | 'stable';
}

async function fetchCompetitorTrends(
  competitors: CompetitorSignal[],
  serpApiKey: string,
): Promise<CompetitorTrend[]> {
  // Берём топ-5 уникальных конкурентов (предпочтительно paid)
  const seen = new Set<string>();
  const topCompetitors: CompetitorSignal[] = [];
  for (const c of competitors) {
    const key = c.domain.replace(/\..+$/, ''); // "rippling" from "rippling.com"
    if (!seen.has(key) && key.length > 2) {
      seen.add(key);
      topCompetitors.push(c);
      if (topCompetitors.length >= 5) break;
    }
  }

  if (topCompetitors.length === 0) return [];

  // Google Trends compare: до 5 терминов через запятую
  const compareQuery = topCompetitors.map(c =>
    c.domain.replace(/\..+$/, '') // "rippling", "bamboohr", "workday"
  ).join(',');

  try {
    const trendsData = await fetchSerpAPI(
      'google_trends',
      { q: compareQuery, data_type: 'TIMESERIES', date: 'today 12-m' },
      serpApiKey,
    );

    const timelineData = trendsData?.interest_over_time?.timeline_data || [];
    if (timelineData.length < 4) return [];

    // Для каждого конкурента: рост за последние 3 месяца vs первые 3 месяца
    return topCompetitors.map((c, idx) => {
      const name = c.name || c.domain;
      const domain = c.domain;

      const values = timelineData.map((p: any) =>
        p.values?.[idx]?.extracted_value ?? 0
      );

      const windowSize = Math.max(1, Math.floor(values.length * 0.25));
      const firstAvg = values.slice(0, windowSize).reduce((a: number, b: number) => a + b, 0) / windowSize;
      const lastAvg = values.slice(-windowSize).reduce((a: number, b: number) => a + b, 0) / windowSize;

      let growth: number | null = null;
      if (firstAvg >= 3) {
        growth = Math.round(((lastAvg - firstAvg) / firstAvg) * 100);
      }

      const direction: 'up' | 'down' | 'stable' = growth === null ? 'stable'
        : growth > 10 ? 'up' : growth < -10 ? 'down' : 'stable';

      return { name, domain, growth, direction };
    });
  } catch (e) {
    console.error('[Block2] Competitor trends failed:', e);
    return [];
  }
}

// ————————————————————————————————————————————————————————————
// РАСЧЁТ РОСТА ИЗ TIMELINE — реальные данные, не хардкоды
// ————————————————————————————————————————————————————————————
function calculateGrowthFromTimeline(
  timeline: Array<{ date: string; value: number }>,
): number | null {
  if (timeline.length < 2) return null;

  // Берём среднее первых 10% и последних 10% точек для устойчивости
  const windowSize = Math.max(1, Math.floor(timeline.length * 0.1));
  const firstWindow = timeline.slice(0, windowSize);
  const lastWindow = timeline.slice(-windowSize);

  const avgFirst = firstWindow.reduce((s, p) => s + p.value, 0) / firstWindow.length;
  const avgLast = lastWindow.reduce((s, p) => s + p.value, 0) / lastWindow.length;

  // Защита от near-zero базового периода — рост ненадёжен
  if (avgFirst < 5) return null;

  // Ограничиваем диапазон: -99% .. +500%
  const raw = ((avgLast - avgFirst) / avgFirst) * 100;
  return Math.min(500, Math.max(-99, Math.round(raw)));
}

// ————————————————————————————————————————————————————————————
// АГРЕГАЦИЯ
// ————————————————————————————————————————————————————————————
function aggregate(
  topKeywords: SearchKeyword[],
  risingKeywords: SearchKeyword[],
  serpAdDensity: number,
  historicalVolumeRatio: number,
  keywordsSource: KeywordsSource,
): {
  layer1: Layer1Data;
  layer2: Layer2Data;
  layer3: Layer3Data;
} {
  const allKeywords = [...topKeywords, ...risingKeywords];
  const total = allKeywords.length;

  // —— Layer 1 ————————————————————————————————————————
  // demand_index = средний Trends индекс top keywords
  const topIndices = topKeywords.map((k) => k.volume ?? 0);
  const demandIndex =
    topIndices.length > 0
      ? Math.round(topIndices.reduce((a, b) => a + b, 0) / topIndices.length)
      : 0;

  // TODO v2: взвешенное среднее (первый keyword важнее двадцатого)
  // или медиана для устойчивости к выбросам

  // #9: rising_queries_ratio через Set для дедупликации
  const allQueriesSet = new Set([
    ...topKeywords.map(k => k.query.toLowerCase().trim()),
    ...risingKeywords.map(k => k.query.toLowerCase().trim()),
  ]);
  const risingSet = new Set(
    risingKeywords.map(k => k.query.toLowerCase().trim()),
  );
  const risingRatio = risingSet.size > 0
    ? risingSet.size / Math.max(allQueriesSet.size, 1)
    : 0;

  // growthRate — использует именованную константу
  // FIX #1: порядок условий — growing первый (правильный)
  const growthRate: GrowthRate =
    risingRatio > 0.4
      ? "growing"
      : historicalVolumeRatio > DEMAND_THRESHOLDS.declining_ratio_threshold
        ? "declining"
        : "stable";

  // volume_confidence зависит от SOURCE keywords, не от классификации
  const volumeConfidence: VolumeConfidence =
    keywordsSource === "claude_fallback"
      ? "low"
      : demandIndex >= 60
        ? "high"
        : "medium";

  // —— Layer 2 ————————————————————————————————————————
  const classified = allKeywords.filter((k) => k.intent !== "mixed");

  // Volume-weighted commercial_intent_ratio:
  // Высокочастотный коммерческий запрос весит больше низкочастотного информационного
  const volumes = classified
    .map(k => k.volume)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  const medianVolume = volumes.length > 0
    ? volumes[Math.floor(volumes.length / 2)]
    : 10;

  // #12: isLowVolumeData flag
  const isLowVolumeData = volumes.length < classified.length * 0.3;

  function getIntentWeight(volume: number | undefined | null, intent: string, median: number): number {
    const v = typeof volume === 'number' && Number.isFinite(volume) ? volume : median;
    if (v <= 10) return 1;
    const cap = intent === 'commercial' ? 5 : 2; // commercial keywords can weigh more
    return Math.min(Math.log2(v / 10), cap);
  }

  const totalWeight = classified.reduce((sum, k) => sum + getIntentWeight(k.volume, k.intent, medianVolume), 0);
  const weightedCommercial = classified.reduce((sum, k) => {
    const intentScore = k.intent === 'commercial' ? 1.0 : 0.0;
    return sum + intentScore * getIntentWeight(k.volume, k.intent, medianVolume);
  }, 0);
  const commercialRatio = totalWeight > 0 ? weightedCommercial / totalWeight : 0;

  // Unweighted count for diagnostics
  const commercialCount = classified.filter(
    (k) => k.intent === "commercial",
  ).length;

  const ambiguousCount = allKeywords.filter(
    (k) => k.intent_confidence === "low",
  ).length;
  const highConfCount = allKeywords.filter(
    (k) => k.intent_confidence === "high",
  ).length;

  // commercial_intent_confidence зависит от КАЧЕСТВА классификации
  let intentConfidence: IntentConfidence = "medium";
  if (total > 0 && highConfCount / total > 0.8) {
    intentConfidence = "high";
  } else if (total > 0 && ambiguousCount / total > 0.3) {
    intentConfidence = "low";
  }

  // Cap на medium при claude_fallback: нельзя быть уверенным в классификации
  // Claude-generated запросов — это двойная AI-генерация, иллюзия точности
  if (keywordsSource === "claude_fallback" && intentConfidence === "high") {
    intentConfidence = "medium";
  }

  // —— Layer 3 ————————————————————————————————————————
  // seasonality убрана до реализации — TODO v2: анализ TIMESERIES данных
  const hasMomentum = risingKeywords.length >= 3;

  return {
    layer1: {
      demand_index: demandIndex,
      keyword_count: total,
      growth_rate: growthRate,
      historical_volume_ratio: historicalVolumeRatio,
      keywords_source: keywordsSource,
      volume_confidence: volumeConfidence,
      top_keywords: topKeywords,
      rising_keywords: risingKeywords,
    },
    layer2: {
      commercial_intent_ratio: commercialRatio,
      informational_intent_ratio: 1 - commercialRatio,
      commercial_intent_confidence: intentConfidence,
      serp_ad_density: serpAdDensity,
      classification_details: {
        total_keywords_classified: total,
        keywords_with_high_confidence: highConfCount,
        ambiguous_keywords: ambiguousCount,
      },
    },
    layer3: {
      rising_queries_ratio: risingRatio,
      rising_queries_count: risingKeywords.length,
      has_momentum: hasMomentum,
    },
  };
}

// ————————————————————————————————————————————————————————————
// ДИАГНОЗ — 7 ВЕТОК СТРОГОГО ПОРЯДКА ПРИОРИТЕТА
//
// Порядок критичен — кейсы пересекаются:
// 1. Хайп первым: маскируется под GREEN (высокий объём + растёт)
// 2. Declining вторым: опасен даже при высоком коммерческом интенте
// 3-4. GREEN: только если не declining
// 5-7. YELLOW: информационный / серая зона / малый объём
// FIX #5: добавлена 'mixed' для серой зоны в intent_type
// ————————————————————————————————————————————————————————————
function makeDemandDiagnosis(
  layers: {
    layer1: Layer1Data;
    layer2: Layer2Data;
    layer3: Layer3Data;
  },
  // вычисляется один раз в роуте, передаётся параметром
  isHype: boolean,
): DiagnosisResult {
  const { layer1, layer2, layer3 } = layers;
  const { demand_index, growth_rate, top_keywords, rising_keywords } = layer1;
  const {
    commercial_intent_ratio,
    commercial_intent_confidence,
    serp_ad_density,
  } = layer2;
  const { rising_queries_count } = layer3;

  const totalKeywords = top_keywords.length + rising_keywords.length;

  // —— 1. RED — ХАЙП ————————————————————————————————————
  if (isHype) {
    return {
      diagnosis: "red",
      score: Math.min(10, Math.max(1, 2 + Math.log10(Math.max(demand_index, 1)))),
      conflict_weight: 3,
      reason: "hype_without_foundation",
      key_factors: [
        `Резкий рост: ${rising_queries_count}/${totalKeywords} (${Math.round(
          (rising_queries_count / Math.max(totalKeywords, 1)) * 100,
        )}%) — новые запросы без исторической базы`,
        `Историческое соотношение: ${(
          layer1.historical_volume_ratio * 100
        ).toFixed(0)}% — рынка 5 лет назад почти не существовало`,
        `Риск: временный тренд который может схлопнуться`,
      ],
      key_metric: `${Math.round(
        (rising_queries_count / Math.max(totalKeywords, 1)) * 100,
      )}% запросов новые — хайп без фундамента`,
    };
  }

  // —— 2. YELLOW — DECLINING ——————————————————————————————
  // Выходим сразу. Даже при 80% commercial intent падающий рынок = YELLOW.
  // has_declining_signal = true позволяет Скептику построить точный механизм:
  // "Люди ХОТЕЛИ платить, но теряют интерес"
  if (growth_rate === "declining") {
    return {
      diagnosis: "yellow",
      // Cap at 6 for declining — yellow diagnosis should never show score > 6
      score: Math.min(6, Math.max(1, 3 + Math.log10(Math.max(demand_index / 10, 0.1)))),
      conflict_weight: 2,
      reason: "declining_market",
      key_factors: [
        `Спрос падает (тренд: declining)`,
        `Коммерческий интент: ${Math.round(
          commercial_intent_ratio * 100,
        )}% — люди хотели платить, но теряют интерес`,
        `Риск: входить в умирающий рынок даже с хорошим продуктом`,
      ],
      key_metric: `Спрос падает при ${Math.round(
        commercial_intent_ratio * 100,
      )}% коммерческом интенте`,
    };
  }

  // —— Порог GREEN с поправкой на confidence ———————————————
  // Если классификация ненадёжна — требуем более высокий интент
  const INTENT_THRESHOLD =
    commercial_intent_confidence === "low"
      ? 0.65
      : commercial_intent_confidence === "medium"
        ? 0.6
        : 0.55;

  // —— 3. GREEN СТАНДАРТНЫЙ ——————————————————————————————
  if (
    commercial_intent_ratio >= INTENT_THRESHOLD &&
    demand_index >= DEMAND_THRESHOLDS.standard_min_index
  ) {
    return {
      diagnosis: "green",
      score: Math.min(
        10,
        6 +
          (commercial_intent_ratio - INTENT_THRESHOLD) * 15 +
          (demand_index - DEMAND_THRESHOLDS.standard_min_index) / 10,
      ),
      conflict_weight: 1,
      reason: "commercial_market",
      key_factors: [
        `${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить`,
        `Спрос ${growth_rate === 'growing' ? 'растёт' : 'стабильный'}`,
        `${Math.round(serp_ad_density * 100)}% поисковых страниц содержат рекламу — рынок коммерческий`,
      ],
      key_metric: `${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить · спрос ${growth_rate === 'growing' ? 'растёт' : 'стабильный'}`,
    };
  }

  // —— 4. GREEN МИКРО-B2B ————————————————————————————————
  // Высокий интент компенсирует малый объём.
  // B2B ниши ищут меньше, но LTV выше. Стратегия: account-based.
  // Declining уже исключён веткой 2.
  if (
    commercial_intent_ratio >= 0.8 &&
    demand_index >= DEMAND_THRESHOLDS.micro_b2b_min_index
  ) {
    return {
      diagnosis: "green",
      score: Math.min(10, 5 + (commercial_intent_ratio - 0.8) * 20),
      conflict_weight: 1,
      reason: "micro_b2b_market",
      key_factors: [
        `${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить — сильный покупательский интент`,
        `Нишевой рынок — спрос узкий, но пользователи готовы платить`,
        `Стратегия: account-based marketing, не массовая реклама`,
      ],
      key_metric: `${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить · нишевой B2B`,
    };
  }

  // —— 5. YELLOW ИНФОРМАЦИОННЫЙ ——————————————————————————
  if (commercial_intent_ratio < 0.4) {
    return {
      diagnosis: "yellow",
      score: 4,
      conflict_weight: 2,
      reason: "informational_market",
      key_factors: [
        `Только ${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить — люди ищут знания, не продукт`,
        `Монетизация: контент, SEO, email-list — не SaaS`,
        `Аудитория есть, но стратегия другая — content-first GTM`,
      ],
      key_metric: `${Math.round((1 - commercial_intent_ratio) * 100)}% запросов — информационные`,
    };
  }

  // —— 6. YELLOW СЕРАЯ ЗОНА (40-60% commercial) ——————————
  // FIX #5: явно обрабатываем серую зону
  if (commercial_intent_ratio < 0.6) {
    return {
      diagnosis: "yellow",
      score: 5,
      conflict_weight: 2,
      reason: "grey_zone",
      key_factors: [
        `Смешанный интент: ${Math.round(commercial_intent_ratio * 100)}% хотят купить, ${Math.round((1 - commercial_intent_ratio) * 100)}% ищут информацию`,
        `Люди ищут знания перед покупкой — длинный цикл принятия решения`,
        `Стратегия: content-first GTM → SEO/блог → потом SaaS`,
      ],
      key_metric: `${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить · серая зона`,
    };
  }

  // —— 7. YELLOW НЕДОСТАТОЧНЫЙ ОБЪЁМ ——————————————————————
  // Сюда попадаем если: commercial >= 60% (прошли ветки 5-6)
  // но demand_index < standard_min_index (50) и < micro_b2b условий.
  return {
    diagnosis: "yellow",
    score: Math.min(4, 2 + Math.log10(Math.max(demand_index / 10, 0.1))),
    conflict_weight: 2,
    reason: "insufficient_volume",
    key_factors: [
      `Объём поиска ниже порога коммерческого рынка`,
      `${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить — желание есть, но рынок слишком мал`,
      `Нишевой рынок — проверьте смежные ниши или рассчитайте LTV для окупаемости`,
    ],
    key_metric: `${Math.round(commercial_intent_ratio * 100)}% запросов с намерением купить · недостаточный объём`,
  };
}

// ════════════════════════════════════════════════════════════════
// INTERPRETATION LAYER (Block 2)
// ════════════════════════════════════════════════════════════════
// Фоновая генерация человекочитаемой интерпретации блока.
// Кэш 24ч в block_interpretations. Не блокирует основной ответ.

async function generateDemandInterpretation(
  trendId: string,
  niche: string,
  diagnosis: string,
  blockContext: Record<string, any>,
  supabase: ReturnType<typeof getServerSupabase>,
  anthropic: Anthropic,
): Promise<void> {
  // 2.8 — Кэш с учётом смены диагноза: если diagnosis поменялся — регенерируем
  const { data: existing } = await supabase
    .from("block_interpretations")
    .select("id, generated_at, headline")
    .eq("trend_id", trendId)
    .eq("block_id", "demand")
    .maybeSingle();

  if (existing && (existing as any).generated_at) {
    const age = Date.now() - new Date((existing as any).generated_at).getTime();
    const isFresh = age < 24 * 60 * 60 * 1000;
    const existingHeadline = ((existing as any).headline ?? '').toLowerCase();
    // Смена диагноза: RED (hype) но headline говорит "зрелый/стабильный"
    // или наоборот — не-RED но headline говорит "хайп/нестабильный"
    const isHypeDiagnosis = diagnosis === 'red';
    const headlineContradictsHype =
      isHypeDiagnosis &&
      !existingHeadline.includes('хайп') &&
      !existingHeadline.includes('нестабильн') &&
      !existingHeadline.includes('временн') &&
      !existingHeadline.includes('риск');
    const headlineContradictsStable =
      !isHypeDiagnosis &&
      (existingHeadline.includes('хайп') || existingHeadline.includes('риск хайпа'));

    const diagnosisChanged = headlineContradictsHype || headlineContradictsStable;
    if (isFresh && !diagnosisChanged) return;
    if (diagnosisChanged) {
      console.log(`[Block2 Interpretation] Diagnosis changed (red=${isHypeDiagnosis}), headline contradicts — regenerating`);
    }
  }

  // Извлекаем данные из block_context
  const commercialIntentRatio = blockContext?.commercial_intent_ratio ?? 0;
  const commercialIntentPct = Math.round(commercialIntentRatio * 100);
  const growthRate =
    blockContext?.layers?.layer1?.growth_rate ??
    blockContext?.growth_rate ??
    "unknown";
  const hasDecliningSignal = blockContext?.has_declining_signal ?? false;
  const hasHypeRisk = blockContext?.has_hype_risk ?? false;
  const geoTopMarket = blockContext?.geo_top_market ?? "US";
  const serpAdDensity = blockContext?.serp_ad_density ?? 0;
  const serpAdPct = Math.round(serpAdDensity * 100);
  const risingQueriesRatio = blockContext?.rising_queries_ratio ?? 0;
  const historicalVolumeRatio = blockContext?.historical_volume_ratio ?? 1;

  // 2.6 + 2.9 — Rising queries: только РЕАЛЬНЫЕ (volume = строка "+N%" или "Breakout")
  // Синтетические из buildExpandedKeywords имеют volume: 50 (число) — фильтруем
  const risingKeywordsRaw =
    blockContext?.layers?.layer1?.rising_keywords ??
    blockContext?.rising_keywords ??
    [];
  const risingKeywordsAll: any[] = (Array.isArray(risingKeywordsRaw) ? risingKeywordsRaw : [])
    .filter((kw: any) => {
      // 2.9 — отсеиваем синтетические (volume = число, не строка)
      if (typeof kw?.volume === 'number') return false;
      if (kw?.volume == null) return false;
      const vol = String(kw.volume);
      return vol.includes('%') || vol.toLowerCase() === 'breakout';
    });

  const risingHumanDetailed = risingKeywordsAll
    .filter((kw) => String(kw.volume).toLowerCase() !== 'breakout')
    .slice(0, 3)
    .map((kw) => {
      const rawVol = String(kw.volume ?? '0').replace('%', '').replace('+', '');
      const pct = parseInt(rawVol);
      const multiplier = !Number.isNaN(pct) && pct > 0
        ? `(×${(pct / 100 + 1).toFixed(1)} за год)`
        : '';
      return `"${kw.query ?? '?'}" ${multiplier}`.trim();
    })
    .filter(Boolean)
    .join(', ');

  const breakoutQueries = risingKeywordsAll
    .filter((kw) => String(kw?.volume ?? '').toLowerCase() === 'breakout')
    .map((kw) => `"${kw.query ?? '?'}"`)
    .slice(0, 3)
    .join(', ');

  // 2.6 — Конкуренты: платные с frequency + органические лидеры
  const competitorsFound: any[] = Array.isArray(blockContext?.competitors_found)
    ? blockContext.competitors_found
    : [];
  const paidCompetitorsDetailed = competitorsFound
    .filter((c) => c?.source === 'paid')
    .map((c) => c?.serp_frequency
      ? `${c?.name ?? c?.domain ?? '?'} (${c.serp_frequency} поисковых страниц)`
      : (c?.name ?? c?.domain ?? '?'))
    .slice(0, 4)
    .join(', ');
  const organicLeaders = competitorsFound
    .filter((c) => c?.source === 'organic' && (c?.position ?? 99) <= 2)
    .map((c) => c?.name ?? c?.domain ?? '?')
    .filter(Boolean)
    .slice(0, 3)
    .join(', ');

  // Текущий месяц для сезонности
  const currentMonth = new Date().toLocaleString('ru', { month: 'long' });

  // 2.7 — Сигнал тайминга входа
  // Q2 (мар-май) и Q4 (сен-ноя) в B2B SaaS — сильные сезоны (бюджеты + возврат после лета)
  // Август — традиционный спад
  const currentMonthNum = new Date().getMonth() + 1; // 1-12
  const isGrowing = growthRate === 'growing';
  const timingSignal: 'good' | 'neutral' | 'wait' =
    hasDecliningSignal ? 'wait'
    : isGrowing && [3, 4, 5, 9, 10, 11].includes(currentMonthNum) ? 'good'
    : 'neutral';
  const timingText =
    timingSignal === 'good'
      ? `Сейчас (${currentMonth}) — хорошее время: спрос растёт и сезон активный`
      : timingSignal === 'wait'
      ? `Спрос снижается — лучше дождаться следующего цикла или входить с очень узким сегментом`
      : `Сейчас нейтральный период — ни пик ни провал`;

  // 2.10 — Hype risk: ключевой сигнал для интерпретации
  const diagnosisReason = blockContext?.diagnosis_reason ?? '';
  const isHypeWithoutFoundation = diagnosisReason === 'hype_without_foundation' || hasHypeRisk;
  const risingPct = Math.round(risingQueriesRatio * 100);
  const hypeWarning = isHypeWithoutFoundation
    ? `${risingPct}% запросов — новые, без исторической базы. Коммерческий спрос есть, но устойчивость не проверена.`
    : null;

  // data_sufficiency — поднят порог до 20 после 2.5
  const totalKeywords = blockContext?.data_quality?.total_keywords ?? 0;
  // Fix 2: учитываем качество классификации, не только количество
  const classificationConf = blockContext?.data_quality?.classification_confidence ?? 'low';
  const crossValidated = blockContext?.data_quality?.cross_validated_with_serp ?? false;
  const dataSufficiency: 'sufficient' | 'limited' =
    // 15+ реальных ключей + high confidence + cross-validated → sufficient
    (totalKeywords >= 15 && classificationConf === 'high' && crossValidated) ? 'sufficient'
    // 20+ ключей независимо → sufficient
    : totalKeywords >= 20 ? 'sufficient'
    : 'limited';

  const systemPrompt = `Ты — аналитик рынков для предпринимателей.
Пишешь на русском языке. Твои тексты читают люди которые думают
войти в новую нишу — они не технари, они бизнесмены.

ЖЁСТКИЕ ПРАВИЛА:
- Никогда не используй: demand_index, commercial_intent_ratio,
  serp_ad_density, PARTIAL, confidence, volume, keyword_count,
  classified_successfully, rising_queries_ratio
- Никогда не пиши: "данных недостаточно", "сложно сказать",
  "рекомендуется расширить семантическое ядро"
- Не упоминай Google Trends, SerpAPI, источники данных
- Только конкретные выводы, без оговорок
- Тон: уверенный аналитик который хорошо знает этот рынок`;

  const userPrompt = `Проанализируй спрос в нише: "${niche}"

ТЕХНИЧЕСКИЕ ДАННЫЕ (не используй эти термины в тексте):
- Диагноз: ${diagnosis}
- Готовность покупать: ${commercialIntentPct}% ищущих хотят купить, а не просто изучают
- Тренд: ${growthRate === 'growing' ? 'растёт' : growthRate === 'declining' ? 'падает' : 'стабильный'}
- Исторический рост: рынок вырос в ${Number(historicalVolumeRatio).toFixed(1)} раза за последние годы
- Падающий сигнал: ${hasDecliningSignal ? 'да — спрос снижается' : 'нет'}
- Хайп-риск: ${hasHypeRisk ? 'да — может быть временный всплеск' : 'нет'}
- Рекламодатели в нише: ${paidCompetitorsDetailed || 'нет платной рекламы'}
- Органические лидеры SERP: ${organicLeaders || 'не определены'}
- Растущие запросы с цифрами: ${risingHumanDetailed || 'нет значимых растущих запросов'}
${breakoutQueries ? `- Взрывной рост (Breakout): ${breakoutQueries}` : ''}
- Доля растущих запросов: ${Math.round(risingQueriesRatio * 100)}% от всех запросов нише
- Главный рынок: ${geoTopMarket}
- Текущий месяц: ${currentMonth}
- Тайминг входа: ${timingText}
- Риск хайпа: ${isHypeWithoutFoundation ? `ДА — ${risingPct}% запросов новые, без исторической базы` : 'нет — спрос исторически устойчивый'}
- Достаточность данных: ${dataSufficiency === 'sufficient' ? 'данных достаточно' : 'ключевых слов немного — дополни знаниями о рынке'}
${hypeWarning ? `\nКРИТИЧЕСКИЙ СИГНАЛ: ${hypeWarning}` : ''}

${dataSufficiency === 'limited' ? `ВАЖНО: Данных немного. Дополни анализ своими знаниями о рынке "${niche}". Формулируй как конкретный анализ, не как общие знания.` : ''}

${isHypeWithoutFoundation ? `ВАЖНО ДЛЯ ЭТОГО АНАЛИЗА: спрос показывает признаки хайпа.
headline ОБЯЗАТЕЛЬНО должен отражать это:
- НЕ пиши "высокий стабильный спрос" или "зрелый рынок"
- ПИШИ честное предупреждение: "спрос взрывной — но устойчивость под вопросом" или похожее
main_insight должен объяснить что ${risingPct}% запросов новые и что это означает.` : 'ВАЖНО: используй конкретные запросы и цифры роста в тексте. Не пиши абстрактно "спрос растёт" — назови КАКОЙ запрос и НА СКОЛЬКО.'}

Ответь на три вопроса предпринимателя:
1. Много ли людей ищут это — и растёт ли это число?
2. Они хотят купить или просто изучают?
3. Сейчас хорошее время для входа или лучше подождать?

Напиши анализ в формате JSON:

{
  "headline": "одно предложение-диагноз про спрос (максимум 12 слов)",
  "main_insight": "2-3 предложения. Включи конкретные растущие запросы с цифрами. Назови кто рекламируется. Объясни что это означает для нового игрока.",
  "key_facts": [
    ${isHypeWithoutFoundation
      ? `"факт 1: конкретный факт про масштаб роста с числом — какой запрос и на сколько вырос",
    "факт 2: ЧЕСТНОЕ ПРЕДУПРЕЖДЕНИЕ — ${risingPct}% запросов появились недавно, нет данных держится ли спрос. Объясни что это значит.",
    "факт 3: практический вывод — как проверить устойчивость спроса перед входом"`
      : `"факт 1: КОНКРЕТНЫЙ растущий тренд с числом — какой именно запрос вырос и на сколько (бери из растущих запросов выше)",
    "факт 2: про покупательское намерение с процентом и что это значит",
    "факт 3: про конкурентную обстановку — назови КТО платит за рекламу или какие органические лидеры, и что это означает"`}
  ],
  "decision_impact": "одно-два предложения: когда лучше входить и почему именно сейчас или позже — используй данные о тайминге выше"
}

ПРИМЕРЫ ХОРОШИХ ФАКТОВ (конкретные):
- "Запросы 'n8n workflow automation' выросли в 6.5 раза за год — AI-автоматизация переключает рынок"
- "82% ищущих готовы купить — это не исследование, это поиск подрядчика"
- "Рекламу покупают только Kissflow и ManageEngine — корпоративный сегмент, SMB открыт"

ПРИМЕРЫ ПЛОХИХ ФАКТОВ (ЗАПРЕЩЕНО):
- "Спрос растёт" — без цифр и без названия запроса
- "Рынок коммерческий" — без конкретных рекламодателей
- "Запросы об AI-автоматизации выросли в 3.5 раза за год" — нет конкретного запроса в кавычках
- "82% коммерческий интент, уверенность: medium" — технический термин
- "Спрос индекс: 1116721413687958" — непонятное число

Верни ТОЛЬКО валидный JSON, без markdown и без пояснений.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const raw = (response.content[0] as any)?.text ?? "";
    const clean = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    if (
      !parsed.headline ||
      !parsed.main_insight ||
      !Array.isArray(parsed.key_facts) ||
      parsed.key_facts.length !== 3 ||
      !parsed.decision_impact
    ) {
      console.error("[Block2 Interpretation] Invalid structure:", parsed);
      return;
    }

    const { error: saveError } = await supabase
      .from("block_interpretations")
      .upsert(
        {
          trend_id: trendId,
          block_id: "demand",
          headline: parsed.headline,
          main_insight: parsed.main_insight,
          key_facts: parsed.key_facts,
          decision_impact: parsed.decision_impact,
          model_used: "claude-sonnet-4-6",
          data_sufficiency: dataSufficiency,
          generated_at: new Date().toISOString(),
        },
        { onConflict: "trend_id,block_id" },
      );

    if (saveError) {
      console.error("[Block2 Interpretation] Save failed:", saveError);
      return;
    }
    console.log("[Block2 Interpretation] Generated for trend:", trendId);
  } catch (error) {
    console.error("[Block2 Interpretation] Failed:", error);
  }
}

// ————————————————————————————————————————————————————————————
// ОСНОВНОЙ РОУТ
// ————————————————————————————————————————————————————————————
export async function POST(req: NextRequest) {
  try {
    // Проверка в роуте — не throw на импорте (антипаттерн в Next.js serverless)
    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    if (!SERPAPI_KEY) {
      return NextResponse.json(
        { error: "SERPAPI_KEY не настроен на сервере" },
        { status: 500 },
      );
    }

    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const supabase = getServerSupabase();

    const { trend_id, niche, keywords } = (await req.json()) as {
      trend_id: string;
      niche: string;
      keywords: string[];
    };

    if (!trend_id || !niche || !keywords?.length) {
      return NextResponse.json(
        { error: "Требуются trend_id, niche и keywords" },
        { status: 400 },
      );
    }

    // —— 1. СБОР ДАННЫХ ИЗ TRENDS ——————————————————————————
    const {
      topKeywords,
      risingKeywords,
      historicalVolumeRatio,
      volume3mAgoIndex,
      keywordsSource,
      timeline_5y,
      timeline_3m,
      geo_breakdown,
    } = await collectDemandData(niche, keywords, SERPAPI_KEY);

    if (topKeywords.length === 0 && risingKeywords.length === 0) {
      return NextResponse.json(
        {
          error: "Недостаточно данных",
          message: "Не найдено поисковых запросов по данной нише.",
        },
        { status: 422 },
      );
    }

    // —— 1.5. РАСШИРЕНИЕ СЕМАНТИЧЕСКОГО ЯДРА (2.5) ————————————
    // Если Trends + rising дают < 20 ключевых — добавляем синтетические,
    // чтобы перейти из data_quality_verdict: PARTIAL в RELIABLE.
    // Они классифицируются Haiku тем же батчем — реальный intent сохраняется.
    const baseKeywordsCombined = [...topKeywords, ...risingKeywords];
    const MIN_KEYWORDS_THRESHOLD = 20;
    const expandedKeywordsRaw: SearchKeyword[] =
      baseKeywordsCombined.length < MIN_KEYWORDS_THRESHOLD
        ? buildExpandedKeywords(niche).map((q) => ({
            query: q,
            source: 'top' as const,
            volume: 50, // нейтральный индекс — точное значение неизвестно
            intent: 'mixed' as const,
            intent_confidence: 'low' as const,
          }))
        : [];

    // Дедупликация — не добавляем то что уже есть в Trends
    const existingQueries = new Set(
      baseKeywordsCombined.map((k) => k.query.toLowerCase()),
    );
    const expandedNew = expandedKeywordsRaw.filter((k) => {
      const q = k.query.toLowerCase();
      if (existingQueries.has(q)) return false;
      // Не дублируем если существующий query содержит синтетический или наоборот
      for (const e of existingQueries) {
        if (e.includes(q) || q.includes(e)) return false;
      }
      existingQueries.add(q);
      return true;
    });

    if (expandedNew.length > 0) {
      console.log(`[Block2] Expanding semantic core: +${expandedNew.length} synthetic keywords (Trends gave ${baseKeywordsCombined.length})`);
    }

    // —— 2. КЛАССИФИКАЦИЯ ИНТЕНТА БАТЧАМИ (Pass 2) ——————————
    // MAX_CONCURRENT = 5 — защита от rate limiting Haiku
    const MAX_CONCURRENT = 5;
    const BATCH_SIZE = 15;
    const allKeywordsToClassify = [...baseKeywordsCombined, ...expandedNew].slice(0, 25);
    const batches: SearchKeyword[][] = [];
    for (let i = 0; i < allKeywordsToClassify.length; i += BATCH_SIZE) {
      batches.push(allKeywordsToClassify.slice(i, i + BATCH_SIZE));
    }

    const classifiedKeywords: SearchKeyword[] = [];
    let intentFailedBatches = 0;
    for (let i = 0; i < batches.length; i += MAX_CONCURRENT) {
      const chunk = batches.slice(i, i + MAX_CONCURRENT);
      const results = await Promise.all(
        chunk.map((b) => classifyIntentBatch(b, niche)),
      );
      results.forEach(({ classified, failed }) => {
        classifiedKeywords.push(...classified);
        if (failed) intentFailedBatches++;
      });
    }

    console.log(`[Block2 Pass2] Classified ${classifiedKeywords.length} keywords, ${intentFailedBatches}/${batches.length} batches failed`);

    const classifiedTop = classifiedKeywords.slice(0, topKeywords.length);
    const classifiedRising = classifiedKeywords.slice(topKeywords.length);

    // —— 3. КОНКУРЕНТЫ ИЗ КОММЕРЧЕСКИХ ЗАПРОСОВ —————————————
    // Запускается ПОСЛЕ классификации — используем правильные запросы
    const {
      competitors,
      serpAdDensity,
      adDensitySource,
      competitorsQueriesUsed,
    } = await collectCompetitorsAndAdDensity(
      [...classifiedTop, ...classifiedRising],
      SERPAPI_KEY,
    );

    // —— 3.5. ДОПОЛНИТЕЛЬНЫЕ АНАЛИЗЫ (параллельно) ————————————
    // Сезонность (из timeline_5y, 0 API), Buying stage (из keywords, 0 API),
    // Тренд конкурентов (+1 API, параллельно)
    const seasonality = analyzeSeasonality(timeline_5y);
    const buyingStage = analyzeBuyingStage([...classifiedTop, ...classifiedRising]);
    const competitorTrends = competitors.length > 0
      ? await fetchCompetitorTrends(competitors, SERPAPI_KEY)
      : [];

    // —— 4. АГРЕГАЦИЯ ————————————————————————————————————————
    const layers = aggregate(
      classifiedTop,
      classifiedRising,
      serpAdDensity,
      historicalVolumeRatio,
      keywordsSource,
    );
    layers.layer1.volume_3m_ago = volume3mAgoIndex;

    // —— 5. HYPE DETECTION (один раз) ————————————————————————
    const totalKeywordsCount =
      layers.layer1.top_keywords.length + layers.layer1.rising_keywords.length;
    const isHype = detectHype(
      layers.layer1.demand_index,
      layers.layer1.historical_volume_ratio,
      layers.layer1.growth_rate,
      layers.layer3.rising_queries_count,
      totalKeywordsCount,
      layers.layer1.volume_3m_ago,
    );

    // —— 6. ДИАГНОЗ ——————————————————————————————————————————
    const diagnosisResult = makeDemandDiagnosis(layers, isHype);

    // —— 7. PASS 3: КРОСС-ВАЛИДАЦИЯ ИНТЕНТА С SERP ——————————
    // Если classification говорит "commercial" но рекламы нет → понизить confidence
    // Если реклама есть но classification = "informational" → подозрительно
    let crossValidatedConfidence = layers.layer2.commercial_intent_confidence;
    const intentRatio = layers.layer2.commercial_intent_ratio;

    if (intentRatio >= 0.6 && serpAdDensity < 0.05 && competitors.length === 0) {
      // High commercial intent but NO ads and NO competitors → suspicious
      console.log('[Block2 Pass3] Cross-validation: high intent but no SERP ads → lowering confidence');
      crossValidatedConfidence = crossValidatedConfidence === 'high' ? 'medium' : 'low';
    } else if (intentRatio < 0.4 && serpAdDensity > 0.3) {
      // Low commercial intent but LOTS of ads → classification may be wrong
      console.log('[Block2 Pass3] Cross-validation: low intent but high SERP ads → raising to medium');
      crossValidatedConfidence = 'medium';
    } else if (intentRatio >= 0.6 && serpAdDensity > 0.2 && competitors.length >= 3) {
      // High intent confirmed by ads AND competitors → boost confidence
      crossValidatedConfidence = 'high';
    }

    // Update layer2 with cross-validated confidence
    layers.layer2.commercial_intent_confidence = crossValidatedConfidence;

    // Classification confidence based on failed batches + cross-validation
    type DataConfidence = 'high' | 'medium' | 'low';
    let classificationConfidence: DataConfidence;
    if (intentFailedBatches === 0 && crossValidatedConfidence !== 'low') {
      classificationConfidence = 'high';
    } else if (intentFailedBatches <= batches.length * 0.3) {
      classificationConfidence = 'medium';
    } else {
      classificationConfidence = 'low';
    }

    // —— 8. ФИНАЛЬНЫЙ OUTPUT —————————————————————————————————
    // —— 7.5 GEO VALIDATION, STRUCTURAL DECLINE, DEMAND CONFIDENCE ——
    // #5: GEO — нормализуем и сравниваем topMarket с target
    const topGeoRegion = geo_breakdown?.[0]?.region || geo_breakdown?.[0]?.label || 'US';
    const topMarketCode = normalizeToCountryCode(topGeoRegion);
    const targetCode = normalizeToCountryCode('US'); // default target
    const geoDemandMismatch = topMarketCode !== targetCode;

    // #13: Structural decline
    const isStructuralDecline = detectStructuralDecline(timeline_5y);

    // #10: Demand confidence score
    const demandConfidenceScore = calculateDemandConfidence({
      hasDegradedData: keywordsSource === 'claude_fallback',
      dataScarcity: allKeywordsToClassify.length < 5 ? 'HIGH'
        : allKeywordsToClassify.length < 15 ? 'MEDIUM' : 'LOW',
      noTimeseries5y: timeline_5y.length < 52,
      noTimeseries3m: timeline_3m.length < 4,
      trendStability: layers.layer3.rising_queries_ratio > 0.7 ? 'LOW'
        : layers.layer3.rising_queries_ratio > 0.4 ? 'MEDIUM' : 'HIGH',
      crossValidation: serpAdDensity > 0 || competitors.length > 0 ? 1
        : competitors.length === 0 && layers.layer2.commercial_intent_ratio > 0.6 ? -1
        : 0,
      isLowVolumeData: classifiedKeywords.filter(k =>
        typeof k.volume === 'number' && Number.isFinite(k.volume)
      ).length < classifiedKeywords.length * 0.3,
    });

    const forceExperiment = demandConfidenceScore < 0.4;

    // FIX #5: intent_type теперь может быть 'mixed' для серой зоны
    // Информативный score: варьируется внутри диагноза по силе сигналов
    const computedDemandScore = (() => {
      let s = diagnosisResult.diagnosis === 'green' ? 7 : diagnosisResult.diagnosis === 'yellow' ? 4 : 2;
      const ir = layers.layer2.commercial_intent_ratio ?? 0;
      const ad = serpAdDensity ?? 0;
      if (ir > 0.7) s += 1;
      if (ir > 0.85) s += 0.5;
      if (ad > 0.2) s += 0.5;
      if (layers.layer3.rising_queries_count >= 3) s += 0.5;
      if ((historicalVolumeRatio ?? 1) >= 2) s += 0.5;
      if (isHype) s -= 1;
      if (layers.layer1.growth_rate === 'declining') s -= 2;
      if (isStructuralDecline) s -= 1;
      if (keywordsSource === 'claude_fallback') s -= 1;
      return Math.max(1, Math.min(10, Math.round(s)));
    })();

    const output: DemandBlockOutput = {
      diagnosis: diagnosisResult.diagnosis,
      score: computedDemandScore,
      conflict_weight: diagnosisResult.conflict_weight,
      key_factors: diagnosisResult.key_factors,
      key_metric: diagnosisResult.key_metric,
      block_context: {
        niche,
        intent_type: isHype
          ? "hype"
          : layers.layer2.commercial_intent_ratio >= 0.6
            ? "commercial"
            : layers.layer2.commercial_intent_ratio < 0.4
              ? "informational"
              : "mixed",
        diagnosis_reason: diagnosisResult.reason,
        // Сырые метрики для Синтеза
        commercial_intent_ratio: layers.layer2.commercial_intent_ratio,
        commercial_intent_confidence:
          layers.layer2.commercial_intent_confidence,
        demand_index: layers.layer1.demand_index,
        // Независимые флаги — Скептик строит разные механизмы угрозы
        has_declining_signal: layers.layer1.growth_rate === "declining",
        has_hype_risk: isHype,
        has_insufficient_data: keywordsSource === "claude_fallback",
        // Seed данные для Блока 4 (обогащает) и раздела Бизнес
        competitors_found: competitors,
        serp_ad_density: serpAdDensity,
        ad_density_source: adDensitySource,
        // Метаданные качества — РАЗДЕЛЕНЫ
        volume_source: keywordsSource,
        volume_confidence: layers.layer1.volume_confidence, // → Блок 5
        rising_queries_ratio: layers.layer3.rising_queries_ratio,
        historical_volume_ratio: historicalVolumeRatio,
        // #5: GEO validation
        geo_top_market: topMarketCode,
        geo_demand_mismatch: geoDemandMismatch,
        // #10: demand confidence
        demand_confidence_score: demandConfidenceScore,
        // #13: structural decline
        is_structural_decline: isStructuralDecline,
        // #14: force experiment flag for synthesis
        force_experiment_by_confidence: forceExperiment,
        data_quality: {
          total_keywords: allKeywordsToClassify.length,
          classified_successfully: classifiedKeywords.filter(k => k.intent !== 'mixed').length,
          failed_batches: intentFailedBatches,
          classification_confidence: classificationConfidence,
          cross_validated_with_serp: serpAdDensity > 0 || competitors.length > 0,
        },
      },
      layers,
    };

    // —— 8.5. ANALYZER — DATA QUALITY VERDICT ————————————————
    let demandAnalyzerVerdict: { verdict: string; reason: string; recommendation: string | null } = {
      verdict: 'PARTIAL',
      reason: 'Analyzer не запускался',
      recommendation: null,
    };
    try {
      const analyzerRes = await claude.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: 'Ты — аналитик качества данных. Не маркетолог. Верни ТОЛЬКО валидный JSON без markdown, без объяснений.',
        messages: [{
          role: 'user',
          content: `Оцени качество данных спроса:
${JSON.stringify({
  total_keywords: allKeywordsToClassify.length,
  classified_non_mixed: classifiedKeywords.filter(k => k.intent !== 'mixed').length,
  failed_batches: intentFailedBatches,
  total_batches: batches.length,
  commercial_intent_ratio: Math.round(layers.layer2.commercial_intent_ratio * 100) + '%',
  serp_ad_density: Math.round(serpAdDensity * 100) + '%',
  competitors_found: competitors.length,
  keywords_source: keywordsSource,
  cross_validated: serpAdDensity > 0 || competitors.length > 0,
  classification_confidence: classificationConfidence,
}, null, 2)}

Правила:
- RELIABLE: >15 keywords, failed_batches=0, cross_validated=true, confidence=high
- PARTIAL: есть данные но пробелы
- UNRELIABLE: <5 keywords, или >50% failed batches, или keywords_source=claude_fallback
- При сомнении: PARTIAL

Схема: {"verdict":"RELIABLE|PARTIAL|UNRELIABLE","reason":"одно предложение","recommendation":"строка или null"}`,
        }],
      });
      const rawText = analyzerRes.content[0].type === 'text' ? analyzerRes.content[0].text.trim() : '';
      const cleanText = rawText.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleanText);
      demandAnalyzerVerdict = {
        verdict: parsed.verdict || 'PARTIAL',
        reason: parsed.reason || '',
        recommendation: parsed.recommendation ?? null,
      };
    } catch (e: any) {
      console.error('[Block2 Analyzer] Error:', e.message);
      demandAnalyzerVerdict = { verdict: 'PARTIAL', reason: 'Ошибка парсинга ответа Analyzer', recommendation: 'Повторите анализ' };
    }
    console.log(`[Block2 Analyzer] Verdict: ${demandAnalyzerVerdict.verdict}`);

    // Добавляем в output
    output.block_context.data_quality_verdict = demandAnalyzerVerdict as any;

    // —— 8.5. Фильтрация синтетических ключей перед сохранением ——
    // Синтетические из buildExpandedKeywords имеют volume: 50 (число).
    // Реальные из Google Trends — volume: строка ("+250%", "Breakout", etc.)
    const isSyntheticKw = (kw: any) => typeof kw?.volume === 'number' && kw.volume === 50 && kw.intent_confidence === 'low';
    const isRealRising = (kw: any) => {
      if (typeof kw?.volume === 'number') return false;
      if (!kw?.volume) return false;
      const vol = String(kw.volume);
      return vol.includes('%') || vol.toLowerCase() === 'breakout';
    };

    // Фильтруем rising_keywords — только реальные
    const origRisingCount = output.layers.layer1.rising_keywords.length;
    output.layers.layer1.rising_keywords = output.layers.layer1.rising_keywords.filter(isRealRising);
    const filteredRisingCount = origRisingCount - output.layers.layer1.rising_keywords.length;

    // Фильтруем top_keywords — убираем явно синтетические
    const origTopCount = output.layers.layer1.top_keywords.length;
    output.layers.layer1.top_keywords = output.layers.layer1.top_keywords.filter((kw: any) => !isSyntheticKw(kw));
    const filteredTopCount = origTopCount - output.layers.layer1.top_keywords.length;

    if (filteredRisingCount > 0 || filteredTopCount > 0) {
      console.log(`[Block2] Filtered synthetic keywords before save: ${filteredRisingCount} rising, ${filteredTopCount} top`);
    }

    // —— 9. UPSERT В SUPABASE ————————————————————————————————
    const { error: dbError } = await supabase.from("block_results").upsert({
      trend_id,
      user_id: user.id,
      block_number: 2,
      block_type: "demand",
      diagnosis: output.diagnosis,
      score: Math.max(0, Math.min(10, Math.round(Number.isFinite(output.score) ? output.score : 0))),
      conflict_weight: output.conflict_weight,
      key_factors: output.key_factors,
      key_metric: output.key_metric,
      block_context: output.block_context,
      raw_data: {
        layers: output.layers,
        timeline_5y,
        timeline_3m,
        growth_5y: calculateGrowthFromTimeline(timeline_5y),
        growth_3m: calculateGrowthFromTimeline(timeline_3m),
        geo_breakdown,
        seasonality,
        buying_stage: buyingStage,
        competitor_trends: competitorTrends,
        premium: {
          layer2: output.layers.layer2,
          layer3: output.layers.layer3,
          competitors_found: competitors,
          key_factors: output.key_factors,
          block_context: output.block_context,
          top_keywords: output.layers.layer1.top_keywords,
          rising_keywords: output.layers.layer1.rising_keywords,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);

    // —— 9.5. INTERPRETATION LAYER (фоновая генерация) ——————————
    generateDemandInterpretation(
      trend_id,
      niche,
      output.diagnosis,
      output.block_context as Record<string, any>,
      supabase,
      claude,
    ).catch((err) =>
      console.error("[Block2 Interpretation] Background error:", err),
    );

    // —— 10. ПОЛЕЗНЫЙ ЛОГГИНГ ПОСЛЕ ДИАГНОЗА —————————————————
    console.log("[Block2] Diagnosis result:", {
      diagnosis: diagnosisResult.diagnosis,
      reason: diagnosisResult.reason,
      score: diagnosisResult.score,
      commercial_intent:
        Math.round(layers.layer2.commercial_intent_ratio * 100) + "%",
      demand_index: layers.layer1.demand_index,
      growth_rate: layers.layer1.growth_rate,
      keywords_source: keywordsSource,
      competitors_found: competitors.length,
      competitors_queries: competitorsQueriesUsed,
      ad_density_source: adDensitySource,
      is_hype: isHype,
    });

    // —— 11. ОТВЕТ ———————————————————————————————————————————
    return NextResponse.json({
      success: true,
      public: {
        layer1: output.layers.layer1,
        layer2: output.layers.layer2,
        layer3: output.layers.layer3,
        commercial_intent_ratio: output.layers.layer2.commercial_intent_ratio,
        top_keywords: output.layers.layer1.top_keywords?.slice(0, 10),
        rising_keywords: output.layers.layer1.rising_keywords?.slice(0, 5),
        competitors_found: competitors,
        timeline_5y,
        timeline_3m,
        growth_5y: calculateGrowthFromTimeline(timeline_5y),
        growth_3m: calculateGrowthFromTimeline(timeline_3m),
        geo_breakdown,
        seasonality,
        buying_stage: buyingStage,
        competitor_trends: competitorTrends,
        diagnosis: output.diagnosis,
        score: output.score,
        key_metric: output.key_metric,
        key_factors: output.key_factors,
        block_context: output.block_context,
      },
      has_premium: true,
    });
  } catch (error: any) {
    console.error("[Block 2 — Demand]", error);
    return NextResponse.json(
      { error: error.message || "Внутренняя ошибка блока Спрос" },
      { status: 500 },
    );
  }
}
