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
    // Data quality — для downstream блоков и UI
    data_quality: {
      total_keywords: number;
      classified_successfully: number;
      failed_batches: number;
      classification_confidence: 'high' | 'medium' | 'low';
      cross_validated_with_serp: boolean;
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
  // Wiki / encyclopedic
  "wikipedia.org",
  "en.wikipedia.org",
  // News
  "techcrunch.com",
  "venturebeat.com",
  "hackernews.ycombinator.com",
];

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function isAggregator(domain: string): boolean {
  return AGGREGATOR_STOPLIST.some((stop) => domain.includes(stop));
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
}> {
  const seedQuery = `${niche} ${keywords[0] || ""}`;

  // Trends + Historical параллельно
  const [trendsData, trendsHistorical] = await Promise.all([
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
  ]);

  // —— Keywords ————————————————————————————————————————
  let keywordsSource: KeywordsSource = "google_trends";
  let topRaw: any[] = trendsData?.related_queries?.top || [];
  let risingRaw: any[] = trendsData?.related_queries?.rising || [];

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

  return {
    topKeywords,
    risingKeywords,
    historicalVolumeRatio,
    volume3mAgoIndex,
    keywordsSource,
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

  const allCompetitors: CompetitorSignal[] = [];
  const seenDomains = new Set<string>();
  let totalAds = 0;
  let totalResults = 0;

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
        name: ad.title || ad.name || domain,
        source: "paid",
        query,
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
        name: r.title || domain,
        source: "organic",
        query,
        position: pos + 1,
      });
    });
  });

  // Платные конкуренты первыми — они важнее для Блока 4
  const competitors = allCompetitors.sort((a, b) =>
    a.source === "paid" && b.source === "organic" ? -1 : 1,
  );

  // Средняя ad density по всем коммерческим запросам
  const serpAdDensity = totalResults > 0 ? totalAds / totalResults : 0;

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
async function generateFallbackKeywords(
  niche: string,
  seedKeywords: string[],
): Promise<string[]> {
  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
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

  const queriesText = keywords.map((k, i) => `[${i}] ${k.query}`).join("\n");

  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      system: "Respond with valid JSON only, no markdown or explanations.",
      messages: [
        {
          role: "user",
          content: `You are analyzing search queries in the niche: "${niche}".

Classify each query's intent:
- "commercial": user wants to BUY, subscribe, compare pricing, find a tool/service, read reviews before purchase, find alternatives to switch to
- "informational": user wants to LEARN, understand concepts, find tutorials, get definitions, read news/articles

Context matters: "best ${niche} tools" = commercial (comparing to buy), "what is ${niche}" = informational (learning).

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

  const risingRatio = total > 0 ? risingKeywords.length / total : 0;

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
  const commercialCount = classified.filter(
    (k) => k.intent === "commercial",
  ).length;
  const commercialRatio =
    classified.length > 0 ? commercialCount / classified.length : 0;

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
      score: Math.max(1, 2 + Math.log10(Math.max(demand_index, 1))),
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
      score: Math.max(1, 3 + Math.log10(Math.max(demand_index / 10, 0.1))),
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
        `${Math.round(
          commercial_intent_ratio * 100,
        )}% запросов коммерческие (уверенность: ${commercial_intent_confidence})`,
        `Спрос индекс: ${demand_index} (тренд: ${growth_rate})`,
        `${Math.round(
          serp_ad_density * 100,
        )}% SERP с рекламой — конкуренты платят за трафик`,
      ],
      key_metric: `${Math.round(
        commercial_intent_ratio * 100,
      )}% коммерческий интент, индекс ${demand_index}`,
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
        `${Math.round(
          commercial_intent_ratio * 100,
        )}% коммерческих запросов — сильный покупательский интент`,
        `Индекс ${demand_index} — нишевой рынок, но пользователи готовы платить`,
        `Стратегия: account-based marketing, не массовая реклама`,
      ],
      key_metric: `${Math.round(
        commercial_intent_ratio * 100,
      )}% коммерческий интент — микро-B2B`,
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
        `${Math.round(
          commercial_intent_ratio * 100,
        )}% запросов коммерческие — люди ищут знания, не продукт`,
        `Монетизация: контент, SEO, email-list — не SaaS`,
        `Спрос индекс: ${demand_index} — аудитория есть, стратегия другая`,
      ],
      key_metric: `${Math.round(
        (1 - commercial_intent_ratio) * 100,
      )}% информационный интент`,
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
        `Смешанный интент: ${Math.round(
          commercial_intent_ratio * 100,
        )}% коммерческие, ${Math.round(
          (1 - commercial_intent_ratio) * 100,
        )}% информационные`,
        `Люди ищут знания перед покупкой — длинный цикл принятия решения`,
        `Стратегия: content-first GTM → SEO/блог → потом SaaS`,
      ],
      key_metric: `${Math.round(
        commercial_intent_ratio * 100,
      )}% коммерческий интент — серая зона`,
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
      `Индекс ${demand_index} — ниже порога ${DEMAND_THRESHOLDS.standard_min_index} для коммерческого рынка`,
      `Коммерческий интент: ${Math.round(
        commercial_intent_ratio * 100,
      )}% — желание есть, рынок слишком мал`,
      `Нишевой рынок — проверьте смежные ниши или рассчитайте LTV для окупаемости`,
    ],
    key_metric: `Индекс ${demand_index} — недостаточный объём`,
  };
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

    // —— 2. КЛАССИФИКАЦИЯ ИНТЕНТА БАТЧАМИ (Pass 2) ——————————
    // MAX_CONCURRENT = 5 — защита от rate limiting Haiku
    const MAX_CONCURRENT = 5;
    const BATCH_SIZE = 15;
    const allKeywordsToClassify = [...topKeywords, ...risingKeywords];
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
    // FIX #5: intent_type теперь может быть 'mixed' для серой зоны
    const output: DemandBlockOutput = {
      diagnosis: diagnosisResult.diagnosis,
      score: diagnosisResult.score,
      conflict_weight: diagnosisResult.conflict_weight,
      key_factors: diagnosisResult.key_factors,
      key_metric: diagnosisResult.key_metric,
      block_context: {
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

    // —— 9. UPSERT В SUPABASE ————————————————————————————————
    const { error: dbError } = await supabase.from("block_results").upsert({
      trend_id,
      user_id: user.id,
      block_number: 2,
      block_type: "demand",
      diagnosis: output.diagnosis,
      score: Number.isFinite(output.score) ? output.score : 0,
      conflict_weight: output.conflict_weight,
      key_factors: output.key_factors,
      key_metric: output.key_metric,
      block_context: output.block_context,
      raw_data: {
        layers: output.layers,
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
