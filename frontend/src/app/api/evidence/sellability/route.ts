// src/app/api/evidence/sellability/route.ts
// Блок 3 — Продаваемость
// Главный вопрос: "Есть ли путь к первым деньгам?"
//
// DATA PRINCIPLE:
// - Нет GPT-генерации цифер. Каждое число из реальных сигналов.
// - deal_cycle_days из явных факторов (trial, complexity, decision makers).
// - psychological_threshold из реальной медианы конкурентов.
// - Диагноз только из верифицированных сигналов.
// - has_trial_period из Claude парсинга pricing (явно отделён от freemium).
// - null как третий вариант вместо false-по-умолчанию.
//
// FIXES APPLIED:
// #1 — Promise.all для конкурентов (было sequential, 20-30 сек → ~5 сек)
// #2 — has_trial_period из Claude парсинга с null как третьим вариантом
// #3 — 'community' добавлен в union type TrafficInterceptionPoint
// #4 — communities сортируются по mentioned_frequency перед выбором primary
// #5 — priceRange fallback явно помечается data_available: false
// #6 — непокрытая комбинация: есть рынок но нет канала → YELLOW channel_not_found
// #7 — user_id добавлен в запросы к Supabase при чтении блоков 1-2
//
// MONETIZATION HOOK:
// - BLOCK_COST константа для middleware (будет подключена отдельно).
// - Никакой логики списания монет в этом файле.

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth-helpers";
import { getServerSupabase } from "@/lib/supabase";

const claude = new Anthropic();

// ————————————————————————————————————————————————————————————
// МОНЕТИЗАЦИЯ: константа для middleware
// ————————————————————————————————————————————————————————————
const BLOCK_COST = { public: 0, premium: 5 } as const;

// ————————————————————————————————————————————————————————————
// ТИПЫ
// ————————————————————————————————————————————————————————————
type Diagnosis = "green" | "yellow" | "red";

type DiagnosisReason =
  | "easy_to_sell"
  | "needs_work"
  | "hard_to_sell"
  | "channel_not_found" // есть рынок но канал не найден — не RED
  | "unclear_signals";

interface CompetitorSignal {
  domain: string;
  name: string;
  source: "paid" | "organic";
}

interface PriceRange {
  minimum: number | null; // null если нет данных
  median: number | null;
  premium: number | null;
  currency: string;
  sources: string[];
  confidence: "high" | "medium" | "low";
  data_available: boolean; // явный флаг наличия данных
}

interface Layer1_WillingnessToPay {
  price_range: PriceRange;
  payment_model:
    | "subscription"
    | "onetime"
    | "freemium"
    | "usage_based"
    | "mixed";
  billing_period: "monthly" | "annual" | "both" | "flexible";
  has_trial_period: boolean | null; // null = нет информации, false = нет trial (не freemium)
  psychological_threshold: number | null; // null если нет данных о ценах
  first_payment_friction: "high" | "medium" | "low";
  what_customers_pay_for: {
    feature: string;
    mentioned_count: number;
    price_elasticity: "core_feature" | "nice_to_have";
  }[]; // TODO v2: extract from real pricing data
  competitor_average_price: number | null;
  competitor_pricing_count: number;
  reddit_budget_mentions: {
    subreddit: string;
    price_mentioned?: number;
    sentiment: "complaint" | "neutral" | "satisfaction";
    comment_count: number;
  }[];
}

interface Layer2_BarrierToPurchase {
  market_type: "B2B" | "B2C" | "B2B2C";
  deal_cycle_days: number;
  deal_cycle_reasoning: string;
  deal_cycle_confidence: "high" | "medium" | "low";
  decision_maker_count: "single" | "small_team_2-3" | "large_org_5+";
  decision_maker_type: "individual" | "manager" | "committee";
  budget_category_exists: boolean;
  budget_signals: {
    competitors_are_paid: boolean;
    commercial_intent_high: boolean;
    reddit_mentions_budget: boolean;
    signal_count: number;
  };
  typical_purchase_trigger: string;
  purchase_urgency_score: number; // 1-10
  time_to_first_revenue_days: number;
}

interface Community {
  competitor_domain?: string;
  channel_type:
    | "subreddit"
    | "slack"
    | "linkedin"
    | "discord"
    | "newsletter"
    | "other";
  community_name: string;
  url: string;
  activity_level: "high" | "medium" | "low";
  member_count: number;
  trust_score: number; // 1-10
  mentioned_frequency: number;
}

interface TrafficInterceptionPoint {
  // #3 FIX: добавлен 'community' в union type
  type:
    | "comparison_search"
    | "education"
    | "alternative_search"
    | "problem_search"
    | "community";
  keyword: string;
  monthly_volume_estimate?: number;
  difficulty: "easy" | "medium" | "hard";
  tactics: string[];
}

interface Layer3_ChannelsAndTouchpoints {
  communities_via_competitors: Community[];
  communities_via_keywords: Community[];
  traffic_interception_points: TrafficInterceptionPoint[];
  primary_channel: {
    channel: string;
    reasoning: string;
  } | null;
  secondary_channels: string[];
}

interface SellabilityDataQuality {
  competitors_queried: number;
  pricing_extracted_successfully: number;
  failed_extractions: number;
  price_cross_validated: boolean;       // цены подтверждены из 2+ источников
  pricing_confidence: "high" | "medium" | "low";
  reddit_budget_mentions_found: number;
  reddit_extraction_failed: boolean;
  overall_data_confidence: "high" | "medium" | "low";
}

interface SellabilityBlockContext {
  // Для Синтеза
  diagnosis: Diagnosis;
  score: number;
  conflict_weight: number;
  reason: DiagnosisReason;
  path_to_first_payment: string;
  key_factors: string[];
  key_metric: string;

  // Layer 1 (для Синтеза)
  price_range: PriceRange;
  payment_model: string;
  psychological_threshold: number | null;

  // Layer 2 (для Блока 5 + GTM)
  sale_cycle_days: number;
  sale_cycle: "minutes" | "days" | "weeks" | "months"; // для Синтеза (типизированный)
  budget_exists: boolean;
  time_to_first_revenue_days: number;

  // Layer 3 (для GTM стратегии)
  primary_channel: string | null;
  secondary_channels: string[];
  traffic_interception_points: TrafficInterceptionPoint[];

  // Для Синтеза
  main_barrier: string;
  market_readiness_score: number; // 1-10

  // Multi-Pass: качество данных для downstream блоков
  data_quality: SellabilityDataQuality;
}

interface SellabilityBlockOutput {
  diagnosis: Diagnosis;
  score: number;
  conflict_weight: number;
  key_factors: string[];
  key_metric: string;
  block_context: SellabilityBlockContext;
  layers: {
    layer1: Layer1_WillingnessToPay;
    layer2: Layer2_BarrierToPurchase;
    layer3: Layer3_ChannelsAndTouchpoints;
  };
}

// ————————————————————————————————————————————————————————————
// HELPER: SERPAPI
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
// СЛОЙ 1: WILLINGNESS TO PAY
// #1 FIX: Promise.all по конкурентам (было sequential)
// #2 FIX: has_trial_period из Claude парсинга с null
// #5 FIX: явный data_available флаг в priceRange
// ————————————————————————————————————————————————————————————
async function fetchCompetitorPricing(
  competitor: CompetitorSignal,
  niche: string,
  serpApiKey: string,
): Promise<{
  prices: number[];
  payment_model: string | null;
  has_trial: boolean | null;
  source: string;
  failed: boolean; // Multi-Pass: трекинг ошибок вместо silent skip
}> {
  const pricingSearch = await fetchSerpAPI(
    "google",
    {
      q: `${competitor.domain} pricing plans`,
      gl: "us",
      num: "5",
    },
    serpApiKey,
  );

  if (!pricingSearch?.organic_results?.length) {
    return { prices: [], payment_model: null, has_trial: null, source: competitor.domain, failed: false };
  }

  try {
    // Multi-Pass 2: нишевый контекст в промпте — Haiku проверяет, что цены
    // относятся именно к продукту в НАШЕЙ нише, а не случайное упоминание
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      temperature: 0,
      max_tokens: 400,
      system: "Отвечай только валидным JSON без markdown.",
      messages: [
        {
          role: "user",
          content: `Ты анализируешь ценообразование в нише: "${niche}".
Конкурент: ${competitor.domain} (${competitor.name}).

Из этих SERP результатов извлеки ценовую информацию ТОЛЬКО если она относится к продукту ${competitor.domain} в нише "${niche}": ${JSON.stringify(
            pricingSearch.organic_results.slice(0, 3).map((r: any) => ({
              title: r.title,
              snippet: r.snippet,
            })),
          )}

Верни JSON:
{
  "is_relevant": true/false,
  "relevance_reason": "почему эта цена относится/не относится к нише",
  "prices": [число, число],
  "payment_model": "subscription"|"onetime"|"freemium"|"mixed"|null,
  "billing": "monthly"|"annual"|"both"|null,
  "has_trial": true|false|null
}

Правила:
- is_relevant: false если цены относятся к другому продукту компании или другой нише
- has_trial: true если "free trial"/"X-day trial"; false если только "free plan"/"freemium"; null если нет данных
- Если цены не найти или не относятся к нише — верни is_relevant: false, prices: []`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();

    try {
      const parsed = JSON.parse(cleaned);

      // Multi-Pass 2: отбрасываем нерелевантные цены
      if (parsed.is_relevant === false) {
        console.log(`[Block3] Pricing for ${competitor.domain} not relevant to niche "${niche}": ${parsed.relevance_reason}`);
        return { prices: [], payment_model: null, has_trial: null, source: competitor.domain, failed: false };
      }

      return {
        prices: Array.isArray(parsed.prices)
          ? parsed.prices.filter((p: any) => typeof p === "number")
          : [],
        payment_model: parsed.payment_model || null,
        has_trial:
          typeof parsed.has_trial === "boolean" ? parsed.has_trial : null,
        source: competitor.domain,
        failed: false,
      };
    } catch {
      console.warn(`[Block3] JSON parse failed for ${competitor.domain} pricing`);
      return { prices: [], payment_model: null, has_trial: null, source: competitor.domain, failed: true };
    }
  } catch (err) {
    console.warn(`[Block3] Claude API failed for ${competitor.domain} pricing:`, err);
    return { prices: [], payment_model: null, has_trial: null, source: competitor.domain, failed: true };
  }
}

async function collectLayer1(
  competitors: CompetitorSignal[],
  niche: string,
  serpApiKey: string,
): Promise<Layer1_WillingnessToPay & { _data_quality: { competitors_queried: number; pricing_extracted_successfully: number; failed_extractions: number; price_cross_validated: boolean; pricing_confidence: "high" | "medium" | "low"; reddit_budget_mentions_found: number; reddit_extraction_failed: boolean } }> {
  // #1 FIX: Promise.all вместо sequential цикла
  const competitorsToQuery = competitors.slice(0, 5);
  const pricingData = await Promise.all(
    competitorsToQuery.map((c) => fetchCompetitorPricing(c, niche, serpApiKey)),
  );

  const pricingResults: { price: number; source: string }[] = [];
  const paymentModels: Set<string> = new Set();
  const trialSignals: (boolean | null)[] = [];

  // Multi-Pass: трекинг ошибок
  let failedExtractions = 0;
  let successfulExtractions = 0;

  pricingData.forEach((data) => {
    if (data.failed) {
      failedExtractions++;
      return; // не добавляем данные из failed extractions
    }
    if (data.prices.length > 0) successfulExtractions++;
    data.prices.forEach((p) =>
      pricingResults.push({ price: p, source: data.source }),
    );
    if (data.payment_model) paymentModels.add(data.payment_model);
    trialSignals.push(data.has_trial);
  });

  // —— Статистика по ценам ———————————————————————————
  const prices = pricingResults.map((r) => r.price).sort((a, b) => a - b);
  const dataAvailable = prices.length > 0;

  // Multi-Pass 3: кросс-валидация цен между источниками
  // Группируем цены по источникам, проверяем совпадение диапазонов
  const uniqueSources = [...new Set(pricingResults.map((r) => r.source))];
  const pricesBySource = new Map<string, number[]>();
  pricingResults.forEach((r) => {
    if (!pricesBySource.has(r.source)) pricesBySource.set(r.source, []);
    pricesBySource.get(r.source)!.push(r.price);
  });

  // Цены "подтверждены" если 2+ источника дают пересекающиеся диапазоны
  let priceCrossValidated = false;
  if (uniqueSources.length >= 2) {
    const sourceMedians = uniqueSources.map((src) => {
      const srcPrices = pricesBySource.get(src)!.sort((a, b) => a - b);
      return srcPrices[Math.floor(srcPrices.length / 2)];
    });
    // Если медианы разных источников в пределах 3x друг от друга — подтверждение
    const minMedian = Math.min(...sourceMedians);
    const maxMedian = Math.max(...sourceMedians);
    if (minMedian > 0 && maxMedian / minMedian <= 3) {
      priceCrossValidated = true;
    }
  }

  // Multi-Pass 3: confidence на основе кросс-валидации
  // high = 2+ источника с подтверждёнными ценами
  // medium = 1 источник (concentrated niche — не отбрасываем!)
  // low = нет данных или все extractions failed
  const pricingConfidence: "high" | "medium" | "low" =
    priceCrossValidated ? "high"
    : uniqueSources.length === 1 ? "medium"  // concentrated niche rule
    : dataAvailable ? "medium"
    : "low";

  // Фильтр per-seat цен: если есть хотя бы одна цена >= $15,
  // исключаем мелкие per-employee/per-user цены из расчёта медианы
  const accountPrices = prices.filter((p) => p >= 15);
  const pricesToUse = accountPrices.length > 0 ? accountPrices : prices;

  // #5 FIX: явный data_available, null если нет данных
  const priceRange: PriceRange = {
    minimum: dataAvailable ? pricesToUse[0] : null,
    median: dataAvailable ? pricesToUse[Math.floor(pricesToUse.length / 2)] : null,
    premium: dataAvailable ? pricesToUse[pricesToUse.length - 1] : null,
    currency: "USD",
    sources: uniqueSources.slice(0, 3),
    confidence: pricingConfidence, // Multi-Pass 3: из кросс-валидации
    data_available: dataAvailable,
  };

  // #2 FIX: psychological_threshold из реальной медианы, null если нет данных
  let psychological_threshold: number | null = null;
  if (priceRange.median !== null) {
    const psychologicalLevels = [
      9, 19, 29, 49, 79, 99, 199, 299, 499, 999, 2999,
    ];
    psychological_threshold = psychologicalLevels.reduce((prev, curr) =>
      Math.abs(curr - priceRange.median!) < Math.abs(prev - priceRange.median!)
        ? curr
        : prev,
    );
  }

  // #2 FIX: has_trial_period — агрегируем сигналы
  // true если хоть один конкурент имеет trial
  // null если нет информации ни об одном
  // false если явно нет trial ни у кого
  const hasTrueSignal = trialSignals.some((s) => s === true);
  const allNull = trialSignals.every((s) => s === null);
  const has_trial_period: boolean | null = hasTrueSignal
    ? true
    : allNull
      ? null
      : false;

  // —— Reddit: budget mentions ————————————————————————
  const redditSearch = await fetchSerpAPI(
    "google",
    {
      q: `site:reddit.com "${niche}" ("how much" OR "price" OR "cost" OR "pay") pricing budget`,
      gl: "us",
      num: "10",
    },
    serpApiKey,
  );

  const redditMentions: Layer1_WillingnessToPay["reddit_budget_mentions"] = [];
  let redditExtractionFailed = false;

  if (redditSearch?.organic_results?.length) {
    try {
      // Multi-Pass 2: нишевый контекст для Reddit budget mentions
      const response = await claude.messages.create({
        model: "claude-haiku-4-5-20251001",
      temperature: 0,
        max_tokens: 400,
        system: "Отвечай только валидным JSON.",
        messages: [
          {
            role: "user",
            content: `Ты анализируешь обсуждения бюджетов в нише: "${niche}".

Проанализируй эти Reddit результаты и найди упоминания бюджетов ТОЛЬКО если они относятся к нише "${niche}": ${JSON.stringify(
              redditSearch.organic_results
                .slice(0, 5)
                .map((r: any) => ({ title: r.title, snippet: r.snippet })),
            )}

Верни JSON array:
[{"subreddit": "r/...", "is_relevant": true/false, "price_mentioned": число или null, "sentiment": "complaint"|"neutral"|"satisfaction"}]

Правила:
- is_relevant: false если обсуждение о другой нише/продукте
- sentiment: complaint если ругают цену, satisfaction если довольны, neutral если нейтрально
- Верни пустой массив [] если ни один результат не относится к нише`,
          },
        ],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "[]";
      const cleaned = text.replace(/```json|```/g, "").trim();

      try {
        const mentions = JSON.parse(cleaned);
        if (Array.isArray(mentions)) {
          // Multi-Pass 2: фильтруем только релевантные
          mentions
            .filter((m: any) => m.is_relevant !== false)
            .forEach((m: any) => {
              redditMentions.push({
                subreddit: m.subreddit || "unknown",
                price_mentioned: m.price_mentioned,
                sentiment: m.sentiment || "neutral",
                comment_count: 1,
              });
            });
        }
      } catch {
        console.warn("[Block3] JSON parse failed for Reddit budget mentions");
        redditExtractionFailed = true;
      }
    } catch (err) {
      console.warn("[Block3] Claude API failed for Reddit budget mentions:", err);
      redditExtractionFailed = true;
    }
  }

  const dominantModel =
    paymentModels.size > 0
      ? (Array.from(
          paymentModels,
        )[0] as Layer1_WillingnessToPay["payment_model"])
      : "subscription";

  return {
    price_range: priceRange,
    payment_model: dominantModel,
    billing_period: "monthly",
    has_trial_period,
    psychological_threshold,
    first_payment_friction:
      psychological_threshold === null
        ? "medium"
        : psychological_threshold < 50
          ? "low"
          : psychological_threshold < 200
            ? "medium"
            : "high",
    what_customers_pay_for: [], // TODO v2: extract from real pricing data
    competitor_average_price:
      prices.length > 0
        ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        : null,
    competitor_pricing_count: prices.length,
    reddit_budget_mentions: redditMentions,
    // Multi-Pass: data quality для downstream
    _data_quality: {
      competitors_queried: competitorsToQuery.length,
      pricing_extracted_successfully: successfulExtractions,
      failed_extractions: failedExtractions,
      price_cross_validated: priceCrossValidated,
      pricing_confidence: pricingConfidence,
      reddit_budget_mentions_found: redditMentions.length,
      reddit_extraction_failed: redditExtractionFailed,
    },
  };
}

// ————————————————————————————————————————————————————————————
// СЛОЙ 2: BARRIER TO PURCHASE
// deal_cycle из реальных сигналов, не из констант
// has_trial_period из Layer1 (из реального парсинга)
// ————————————————————————————————————————————————————————————
function inferDealCycle(signals: {
  market_type: "B2B" | "B2C" | "B2B2C";
  pain_type: string;
  has_trial_period: boolean | null;
  onboarding_complexity: "simple" | "moderate" | "complex";
  budget_category_exists: boolean;
  decision_maker_count: number;
}): {
  estimated_days: number;
  reasoning: string;
  confidence: "high" | "medium" | "low";
} {
  let days = 0;
  const signals_list: string[] = [];

  // Сигнал 1: рыночный контекст
  if (signals.market_type === "B2B") {
    days += 14;
    signals_list.push("B2B context (+14д)");
  } else if (signals.market_type === "B2B2C") {
    days += 7;
    signals_list.push("B2B2C context (+7д)");
  } else {
    days += 2;
    signals_list.push("B2C context (+2д)");
  }

  // Сигнал 2: тип боли
  if (signals.pain_type === "bad_solution") {
    days = Math.round(days * 0.5);
    signals_list.push("Bad solution → быстрое переключение (×0.5)");
  } else if (signals.pain_type === "no_solution") {
    days = Math.round(days * 2.0);
    signals_list.push("No solution → нужна эдукация (×2.0)");
  }
  // manual_process — без множителя

  // Сигнал 3: trial (ТОЛЬКО настоящий trial, не freemium)
  // has_trial_period из реального Claude-парсинга
  if (signals.has_trial_period === true) {
    days = Math.max(1, days - 3);
    signals_list.push("Trial доступен → дедлайн ускоряет конверсию (-3д)");
  } else if (signals.has_trial_period === null) {
    // Нет данных — не меняем
    signals_list.push("Trial: нет данных");
  }
  // false — без изменений

  // Сигнал 4: сложность onboarding
  if (signals.onboarding_complexity === "complex") {
    days += 7;
    signals_list.push("Сложный onboarding (+7д)");
  }

  // Сигнал 5: бюджетная категория
  if (!signals.budget_category_exists) {
    days += 14;
    signals_list.push("Нет бюджетной категории → нужно обосновывать (+14д)");
  }

  // Сигнал 6: decision makers
  if (signals.decision_maker_count > 1) {
    const extra = (signals.decision_maker_count - 1) * 5;
    days += extra;
    signals_list.push(
      `${signals.decision_maker_count} decision makers (+${extra}д)`,
    );
  }

  // Уверенность: больше сигналов = выше уверенность
  const confidence: "high" | "medium" | "low" =
    signals_list.length >= 4
      ? "high"
      : signals_list.length >= 2
        ? "medium"
        : "low";

  return {
    estimated_days: Math.max(1, Math.round(days)),
    reasoning: signals_list.join(" → "),
    confidence,
  };
}

// Конвертируем дни в типизированный sale_cycle для Синтеза
function toCycleBucket(days: number): "minutes" | "days" | "weeks" | "months" {
  if (days < 1) return "minutes";
  if (days <= 7) return "days";
  if (days <= 30) return "weeks";
  return "months";
}

async function collectLayer2(
  block1_context: any,
  block2_context: any,
  layer1: Layer1_WillingnessToPay,
): Promise<Layer2_BarrierToPurchase> {
  const market_type: "B2B" | "B2C" | "B2B2C" =
    (block2_context.commercial_intent_ratio || 0) >= 0.6 ? "B2B" : "B2C";
  const pain_type: string = block1_context.pain_type || "bad_solution";

  // —— Budget signals из верифицированных данных —————
  const competitors_are_paid = (block2_context.competitors_found || []).some(
    (c: CompetitorSignal) => c.source === "paid",
  );
  const commercial_intent_high =
    (block2_context.commercial_intent_ratio || 0) > 0.6;
  const reddit_mentions_budget = layer1.reddit_budget_mentions.length > 0;

  const budget_signals = {
    competitors_are_paid,
    commercial_intent_high,
    reddit_mentions_budget,
    signal_count: [
      competitors_are_paid,
      commercial_intent_high,
      reddit_mentions_budget,
    ].filter(Boolean).length,
  };

  const budget_category_exists = budget_signals.signal_count >= 2;

  // —— Deal cycle из сигналов ————————————————————————
  const onboarding_complexity =
    layer1.first_payment_friction === "high" ? "complex" : "simple";
  const decision_maker_count = market_type === "B2B" ? 3 : 1;

  const dealCycle = inferDealCycle({
    market_type,
    pain_type,
    has_trial_period: layer1.has_trial_period, // из реального парсинга
    onboarding_complexity,
    budget_category_exists,
    decision_maker_count,
  });

  // —— Purchase trigger ——————————————————————————————
  const typical_purchase_trigger =
    market_type === "B2B"
      ? "Квартальное планирование или ревью вендоров"
      : "Немедленная потребность";

  // —— Urgency из реальных полей Блока 1 ——————————————
  const paying_ratio = block1_context.paying_users_ratio || 0;
  const total_complaints = block1_context.pain_scale || 0;
  const urgency_score = Math.min(
    10,
    (paying_ratio > 0.5 ? 3 : 0) +
      (total_complaints > 50 ? 3 : total_complaints > 20 ? 2 : 0) +
      (budget_category_exists ? 2 : 0) +
      (dealCycle.estimated_days <= 7 ? 2 : 0),
  );

  return {
    market_type,
    deal_cycle_days: dealCycle.estimated_days,
    deal_cycle_reasoning: dealCycle.reasoning,
    deal_cycle_confidence: dealCycle.confidence,
    decision_maker_count:
      decision_maker_count === 1
        ? "single"
        : decision_maker_count <= 3
          ? "small_team_2-3"
          : "large_org_5+",
    decision_maker_type: market_type === "B2B" ? "committee" : "individual",
    budget_category_exists,
    budget_signals,
    typical_purchase_trigger,
    purchase_urgency_score: Math.max(1, urgency_score),
    time_to_first_revenue_days: dealCycle.estimated_days + 7,
  };
}

// ————————————————————————————————————————————————————————————
// СЛОЙ 3: CHANNELS TO PURCHASER
// #4 FIX: сортировка по mentioned_frequency перед primary
// ————————————————————————————————————————————————————————————
function getActivityLevel(
  mentionedFrequency: number,
): "high" | "medium" | "low" {
  if (mentionedFrequency >= 10) return "high";
  if (mentionedFrequency >= 3) return "medium";
  return "low";
}

async function collectLayer3(
  competitors: CompetitorSignal[],
  niche: string,
  keywords: string[],
  serpApiKey: string,
): Promise<Layer3_ChannelsAndTouchpoints> {
  const mentionCounts = new Map<string, number>();
  const allCommunities: Community[] = [];

  // —— Communities via competitors (параллельно) —————
  const competitorSearches = await Promise.all(
    competitors.slice(0, 3).map((competitor) =>
      fetchSerpAPI(
        "google",
        {
          q: `site:reddit.com "${competitor.domain}" OR "${competitor.name.split(".")[0]}"`,
          gl: "us",
          num: "10",
        },
        serpApiKey,
      ).then((data) => ({ competitor, data })),
    ),
  );

  competitorSearches.forEach(({ competitor, data }) => {
    if (!data?.organic_results?.length) return;

    const urls: string[] = data.organic_results.map((r: any) => r.link);
    const subreddits = new Set<string>();

    urls.forEach((url: string) => {
      const match = url.match(/reddit\.com\/r\/([^/]+)/);
      if (match) {
        const sub = `r/${match[1]}`;
        subreddits.add(sub);
        mentionCounts.set(sub, (mentionCounts.get(sub) || 0) + 1);
      }
    });

    subreddits.forEach((subreddit) => {
      const freq = mentionCounts.get(subreddit) || 1;
      allCommunities.push({
        competitor_domain: competitor.domain,
        channel_type: "subreddit",
        community_name: subreddit,
        url: `https://www.reddit.com/${subreddit}`,
        activity_level: getActivityLevel(freq),
        member_count: 0,
        trust_score: 7,
        mentioned_frequency: freq,
      });
    });
  });

  // —— Communities via keywords ———————————————————————
  if (keywords.length > 0) {
    const keywordQuery = keywords.slice(0, 2).join(" OR ");
    const keywordSearch = await fetchSerpAPI(
      "google",
      {
        q: `site:reddit.com (${keywordQuery}) community discussion`,
        gl: "us",
        num: "5",
      },
      serpApiKey,
    );

    if (keywordSearch?.organic_results?.length) {
      const urls: string[] = keywordSearch.organic_results.map(
        (r: any) => r.link,
      );
      const subreddits = new Set<string>();

      urls.forEach((url: string) => {
        const match = url.match(/reddit\.com\/r\/([^/]+)/);
        if (match) {
          const sub = `r/${match[1]}`;
          subreddits.add(sub);
          mentionCounts.set(sub, (mentionCounts.get(sub) || 0) + 1);
        }
      });

      subreddits.forEach((subreddit) => {
        // Дедупликация: если суббреддит уже найден через конкурента —
        // не добавляем повторно. communities_via_keywords может быть пустым
        // если keywords и конкуренты ведут в одни и те же суббреддиты.
        // Это ожидаемое поведение — лучше меньше но без дублей.
        if (!allCommunities.find((c) => c.community_name === subreddit)) {
          const freq = mentionCounts.get(subreddit) || 1;
          allCommunities.push({
            channel_type: "subreddit",
            community_name: subreddit,
            url: `https://www.reddit.com/${subreddit}`,
            activity_level: getActivityLevel(freq),
            member_count: 0,
            trust_score: 8,
            mentioned_frequency: freq,
          });
        }
      });
    }
  }

  // #5 FIX: фильтруем нерелевантные subreddit'ы — r/Scams, r/LegalAdvice и т.д.
  // Эти subreddit'ы часто упоминают бренды конкурентов в контексте жалоб/мошенничества,
  // но НЕ являются каналами для привлечения покупателей
  const IRRELEVANT_SUBREDDITS = new Set([
    'scams', 'legaladvice', 'personalfinance', 'jobs',
    'recruiting', 'antiwork', 'askreddit', 'outoftheloop',
    'nostupidquestions', 'explainlikeimfive', 'todayilearned',
    'news', 'worldnews', 'technology', 'futurology',
  ]);

  const filteredCommunities = allCommunities.filter((c) => {
    const subName = c.community_name.replace(/^r\//, '').toLowerCase();
    return !IRRELEVANT_SUBREDDITS.has(subName);
  });

  // #4 FIX: сортируем по mentioned_frequency — самый упоминаемый = primary
  filteredCommunities.sort((a, b) => b.mentioned_frequency - a.mentioned_frequency);

  // —— Traffic interception points ————————————————————
  const interceptionPoints: TrafficInterceptionPoint[] = [
    {
      type: "problem_search",
      keyword: `${niche} solution`,
      difficulty: "medium",
      tactics: ["SEO", "Content marketing"],
    },
  ];

  if (filteredCommunities.length > 0) {
    interceptionPoints.push({
      type: "community", // #3 FIX: теперь валидный тип
      keyword: keywords[0] || niche,
      difficulty: "easy",
      tactics: [
        "Community engagement",
        "Honest recommendations",
        "Value-first posts",
      ],
    });
  }

  // Точка перехвата: люди ищут альтернативы конкурентам
  if (competitors.length > 0) {
    interceptionPoints.push({
      type: "alternative_search",
      keyword: `${competitors[0].name.split(".")[0]} alternative`,
      difficulty: "easy",
      tactics: ["SEO", "Comparison page", "G2 listing"],
    });
  }

  // #4 FIX: primary — первый после сортировки (самый упоминаемый)
  const primaryChannel =
    filteredCommunities.length > 0
      ? {
          channel: filteredCommunities[0].community_name,
          reasoning: `Наибольшая частота упоминаний: ${filteredCommunities[0].mentioned_frequency}. Activity: ${filteredCommunities[0].activity_level}. Trust score: ${filteredCommunities[0].trust_score}/10`,
        }
      : null;

  return {
    communities_via_competitors: filteredCommunities.filter(
      (c) => c.competitor_domain,
    ),
    communities_via_keywords: filteredCommunities.filter(
      (c) => !c.competitor_domain,
    ),
    traffic_interception_points: interceptionPoints,
    primary_channel: primaryChannel,
    secondary_channels: filteredCommunities.slice(1, 3).map((c) => c.community_name),
  };
}

// ————————————————————————————————————————————————————————————
// ДИАГНОЗ: из верифицированных сигналов
// #6 FIX: добавлена ветка channel_not_found (не RED при хорошем рынке)
// ————————————————————————————————————————————————————————————
function makeSellabilityDiagnosis(
  layers: {
    layer1: Layer1_WillingnessToPay;
    layer2: Layer2_BarrierToPurchase;
    layer3: Layer3_ChannelsAndTouchpoints;
  },
  block1_context: any,
  block2_context: any,
): {
  diagnosis: Diagnosis;
  score: number;
  conflict_weight: number;
  reason: DiagnosisReason;
  path_to_first_payment: string;
  key_factors: string[];
  key_metric: string;
  main_barrier: string;
  market_readiness_score: number;
} {
  const signals = {
    competitors_found: (block2_context.competitors_found || []).length > 0,
    pricing_data: layers.layer1.price_range.data_available,
    budget_exists: layers.layer2.budget_category_exists,
    primary_channel_found: layers.layer3.primary_channel !== null,
    pain_is_clear:
      (block1_context.paying_users_ratio || 0) > 0.5 ||
      (block1_context.pain_scale || 0) > 20,
  };

  // —— 1. GREEN: Лёгкая продажа ———————————————————————
  if (
    signals.competitors_found &&
    signals.budget_exists &&
    signals.primary_channel_found &&
    layers.layer2.deal_cycle_days <= 14 &&
    signals.pain_is_clear
  ) {
    return {
      diagnosis: "green",
      score: Math.min(10, 7 + (layers.layer2.purchase_urgency_score / 10) * 3),
      conflict_weight: 1,
      reason: "easy_to_sell",
      path_to_first_payment: `Чёткая боль (${Math.round((block1_context.paying_users_ratio || 0.3) * 100)}% платящих). Люди уже платят конкурентам. Выход через ${layers.layer3.primary_channel?.channel} за ${layers.layer2.deal_cycle_days} дней.`,
      key_factors: [
        `Тип боли: ${block1_context.pain_type} → готовы переключиться`,
        `Бюджет есть (${layers.layer2.budget_signals.signal_count}/3 сигнала)`,
        `Канал: ${layers.layer3.primary_channel?.channel}`,
        `Цикл сделки: ${layers.layer2.deal_cycle_days} дней`,
      ],
      key_metric: `${layers.layer2.deal_cycle_days} дней до первого платежа`,
      main_barrier: "Нет критичных барьеров — рынок готов",
      market_readiness_score: 9,
    };
  }

  // —— 2. YELLOW: Рынок есть, цикл длиннее ——————————————
  if (
    signals.competitors_found &&
    layers.layer2.deal_cycle_days > 14 &&
    layers.layer2.deal_cycle_days <= 90 &&
    signals.primary_channel_found
  ) {
    return {
      diagnosis: "yellow",
      score: 5,
      conflict_weight: 2,
      reason: "needs_work",
      path_to_first_payment: `Рынок есть, но требует усилий. Цикл: ${layers.layer2.deal_cycle_days} дней. Фокус на ${layers.layer3.primary_channel?.channel} для раннего трекшна.`,
      key_factors: [
        `Цикл сделки: ${layers.layer2.deal_cycle_days} дней`,
        `Бюджет: ${layers.layer2.budget_category_exists ? "есть" : "нужно обосновывать"}`,
        `Канал: ${layers.layer3.primary_channel?.channel}`,
        `Главный барьер: ${!layers.layer2.budget_category_exists ? "обоснование бюджета" : "длинный цикл решения"}`,
      ],
      key_metric: `${layers.layer2.deal_cycle_days}-дневный цикл сделки`,
      main_barrier: !layers.layer2.budget_category_exists
        ? "Бюджетная категория не существует"
        : "Длинный цикл принятия решения",
      market_readiness_score: 6,
    };
  }

  // —— 3. YELLOW: Рынок есть но канал не найден —————
  // #6 FIX: непокрытая комбинация — не RED если есть конкуренты + бюджет
  // Только при deal_cycle <= 90: если цикл > 90 → RED правильнее
  if (
    signals.competitors_found &&
    signals.budget_exists &&
    !signals.primary_channel_found &&
    layers.layer2.deal_cycle_days <= 90
  ) {
    return {
      diagnosis: "yellow",
      score: 4,
      conflict_weight: 2,
      reason: "channel_not_found",
      path_to_first_payment:
        "Рыночные сигналы позитивные но канал привлечения не найден автоматически. Требуется ручное исследование communities.",
      key_factors: [
        `Конкуренты найдены: ${(block2_context.competitors_found || []).length}`,
        `Бюджет есть (${layers.layer2.budget_signals.signal_count}/3 сигнала)`,
        `Канал: не определён автоматически`,
        `Цикл: ${layers.layer2.deal_cycle_days} дней`,
      ],
      key_metric: "Канал не найден — нужно ручное исследование",
      main_barrier: "Канал привлечения покупателей не найден",
      market_readiness_score: 5,
    };
  }

  // —— 4. RED: Сложная продажа ———————————————————————
  if (
    !signals.competitors_found ||
    !signals.budget_exists ||
    layers.layer2.deal_cycle_days > 90
  ) {
    return {
      diagnosis: "red",
      score: 2,
      conflict_weight: 3,
      reason: "hard_to_sell",
      path_to_first_payment: `Нет чёткого пути к деньгам. ${!signals.competitors_found ? "Нет валидации рынка." : ""} ${!signals.budget_exists ? "Нет бюджетной категории." : ""} ${layers.layer2.deal_cycle_days > 90 ? `Цикл ${layers.layer2.deal_cycle_days} дней.` : ""}`,
      key_factors: [
        `Конкуренты: ${signals.competitors_found ? "найдены" : "не найдены"}`,
        `Бюджет: ${signals.budget_exists ? "есть" : "не существует"}`,
        `Цикл сделки: ${layers.layer2.deal_cycle_days} дней`,
        `Каналы: ${signals.primary_channel_found ? "найдены" : "не найдены"}`,
      ],
      key_metric: "Высокий риск — недостаточно рыночных сигналов",
      main_barrier: !signals.competitors_found
        ? "Нет валидации рынка"
        : layers.layer2.deal_cycle_days > 90
          ? "Очень длинный цикл продажи (90+ дней)"
          : "Нет бюджетной категории",
      market_readiness_score: 2,
    };
  }

  // —— 5. Default YELLOW —————————————————————————————
  return {
    diagnosis: "yellow",
    score: 4,
    conflict_weight: 2,
    reason: "unclear_signals",
    path_to_first_payment:
      "Недостаточно данных. Соберите больше информации о конкурентах.",
    key_factors: ["Неполные сигналы"],
    key_metric: "Неопределённые сигналы",
    main_barrier: "Недостаточно рыночных данных",
    market_readiness_score: 3,
  };
}

// ————————————————————————————————————————————————————————————
// ОСНОВНОЙ РОУТ
// #7 FIX: user_id добавлен в запросы чтения из Supabase
// ————————————————————————————————————————————————————————————
export async function POST(req: NextRequest) {
  try {
    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    if (!SERPAPI_KEY) {
      return NextResponse.json(
        { error: "SERPAPI_KEY не настроен" },
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
      keywords?: string[];
    };

    if (!trend_id || !niche) {
      return NextResponse.json(
        { error: "trend_id и niche обязательны" },
        { status: 400 },
      );
    }

    // —— Читаем Блоки 1 и 2 из Supabase ——————————————
    // #7 FIX: user_id в фильтрах — защита от чтения чужих данных
    const [block1Result, block2Result] = await Promise.all([
      supabase
        .from("block_results")
        .select("*")
        .eq("trend_id", trend_id)
        .eq("user_id", user.id) // #7 FIX
        .eq("block_number", 1)
        .single(),
      supabase
        .from("block_results")
        .select("*")
        .eq("trend_id", trend_id)
        .eq("user_id", user.id) // #7 FIX
        .eq("block_number", 2)
        .single(),
    ]);

    if (block1Result.error || !block1Result.data) {
      return NextResponse.json(
        { error: "Блок 1 не найден. Запустите анализ Проблемы." },
        { status: 422 },
      );
    }

    if (block2Result.error || !block2Result.data) {
      return NextResponse.json(
        { error: "Блок 2 не найден. Запустите анализ Спроса." },
        { status: 422 },
      );
    }

    const block1_context = block1Result.data.block_context;
    const block2_context = block2Result.data.block_context;
    const competitors: CompetitorSignal[] =
      block2_context.competitors_found || [];

    // —— Слой 1: Willingness to Pay ——————————————————
    const layer1WithQuality = await collectLayer1(competitors, niche, SERPAPI_KEY);
    const { _data_quality: layer1Quality, ...layer1 } = layer1WithQuality;

    // —— Слой 2: Barrier to Purchase —————————————————
    const layer2 = await collectLayer2(block1_context, block2_context, layer1);

    // —— Слой 3: Channels to Purchaser ———————————————
    const layer3 = await collectLayer3(
      competitors,
      niche,
      keywords || [],
      SERPAPI_KEY,
    );

    // —— Multi-Pass 3: overall data confidence ————————
    // Агрегируем confidence по всем слоям
    const overallConfidence: "high" | "medium" | "low" =
      layer1Quality.pricing_confidence === "high" && layer1Quality.failed_extractions === 0
        ? "high"
        : layer1Quality.pricing_confidence === "low" || layer1Quality.failed_extractions > layer1Quality.competitors_queried / 2
          ? "low"
          : "medium";

    const dataQuality: SellabilityDataQuality = {
      competitors_queried: layer1Quality.competitors_queried,
      pricing_extracted_successfully: layer1Quality.pricing_extracted_successfully,
      failed_extractions: layer1Quality.failed_extractions,
      price_cross_validated: layer1Quality.price_cross_validated,
      pricing_confidence: layer1Quality.pricing_confidence,
      reddit_budget_mentions_found: layer1Quality.reddit_budget_mentions_found,
      reddit_extraction_failed: layer1Quality.reddit_extraction_failed,
      overall_data_confidence: overallConfidence,
    };

    // —— Диагноз —————————————————————————————————————
    const diagnosis = makeSellabilityDiagnosis(
      { layer1, layer2, layer3 },
      block1_context,
      block2_context,
    );

    // —— Типизированный sale_cycle для Синтеза ————————
    const sale_cycle = toCycleBucket(layer2.deal_cycle_days);

    // —— Финальный output ————————————————————————————
    const output: SellabilityBlockOutput = {
      diagnosis: diagnosis.diagnosis,
      score: diagnosis.score,
      conflict_weight: diagnosis.conflict_weight,
      key_factors: diagnosis.key_factors,
      key_metric: diagnosis.key_metric,
      block_context: {
        diagnosis: diagnosis.diagnosis,
        score: diagnosis.score,
        conflict_weight: diagnosis.conflict_weight,
        reason: diagnosis.reason,
        path_to_first_payment: diagnosis.path_to_first_payment,
        key_factors: diagnosis.key_factors,
        key_metric: diagnosis.key_metric,
        price_range: layer1.price_range,
        payment_model: layer1.payment_model,
        psychological_threshold: layer1.psychological_threshold,
        sale_cycle_days: layer2.deal_cycle_days,
        sale_cycle, // типизированный для Синтеза
        budget_exists: layer2.budget_category_exists,
        time_to_first_revenue_days: layer2.time_to_first_revenue_days,
        primary_channel: layer3.primary_channel?.channel || null,
        secondary_channels: layer3.secondary_channels,
        traffic_interception_points: layer3.traffic_interception_points,
        main_barrier: diagnosis.main_barrier,
        market_readiness_score: diagnosis.market_readiness_score,
        data_quality: dataQuality, // Multi-Pass: качество данных для downstream
      },
      layers: { layer1, layer2, layer3 },
    };

    // —— UPSERT в Supabase ———————————————————————————
    const { error: dbError } = await supabase.from("block_results").upsert({
      trend_id,
      user_id: user.id,
      block_number: 3,
      block_type: "sellability",
      diagnosis: output.diagnosis,
      score: Math.max(0, Math.min(10, Math.round(Number.isFinite(output.score) ? output.score : 0))),
      conflict_weight: output.conflict_weight,
      key_factors: output.key_factors,
      key_metric: output.key_metric,
      block_context: output.block_context,
      raw_data: {
        layers: output.layers,
        premium: {
          price_range: layer1.price_range,
          payment_model: layer1.payment_model,
          psychological_threshold: layer1.psychological_threshold,
          has_trial_period: layer1.has_trial_period,
          sale_cycle_days: layer2.deal_cycle_days,
          budget_category_exists: layer2.budget_category_exists,
          primary_channel: layer3.primary_channel,
          secondary_channels: layer3.secondary_channels,
          traffic_interception_points: layer3.traffic_interception_points,
          key_factors: output.key_factors,
          block_context: output.block_context,
          layers: output.layers,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);

    // —— Логирование ——————————————————————————————————
    console.log("[Block3] Sellability diagnosis:", {
      diagnosis: output.diagnosis,
      score: output.score,
      deal_cycle_days: layer2.deal_cycle_days,
      sale_cycle,
      budget_exists: layer2.budget_category_exists,
      has_trial_period: layer1.has_trial_period,
      primary_channel: layer3.primary_channel?.channel,
      pricing_data_available: layer1.price_range.data_available,
      competitors_processed: competitors.length,
      // Multi-Pass: data quality
      data_quality: dataQuality,
    });

    // —— Ответ ——————————————————————————————————————————
    return NextResponse.json({
      success: true,
      _cost: BLOCK_COST,
      public: {
        diagnosis: output.diagnosis,
        score: output.score,
        key_metric: output.key_metric,
        key_factors: output.key_factors,
        block_context: output.block_context,
        path_to_first_payment: output.block_context.path_to_first_payment,
        sale_cycle,
        sale_cycle_days: layer2.deal_cycle_days,
        budget_category_exists: layer2.budget_category_exists,
        price_range: layer1.price_range,
        payment_model: layer1.payment_model,
        psychological_threshold: layer1.psychological_threshold,
        has_trial_period: layer1.has_trial_period,
        primary_channel: layer3.primary_channel?.channel || null,
        secondary_channels: layer3.secondary_channels,
        traffic_interception_points: layer3.traffic_interception_points,
        layers: output.layers,
      },
      has_premium: true,
    });
  } catch (error: any) {
    console.error("[Block 3 — Sellability]", error);
    return NextResponse.json(
      { error: error.message || "Внутренняя ошибка блока Продаваемость" },
      { status: 500 },
    );
  }
}
