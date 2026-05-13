// src/app/api/evidence/competition/route.ts
// Блок 4 — Конкуренция
// Главный вопрос: "Где конкуренты слепые?"
//
// ЗАВИСИМОСТИ:
// Читает: Блок 2 (competitors_found), Блок 3 (budget_exists, sale_cycle, price_range)
// Передаёт: gap_type, entry_point → Блок 5, Синтез, Стратегия
//
// ПРИНЦИП ДАННЫХ:
// - G2/Trustpilot отзывы — реальные жалобы (не GPT-генерация)
// - Haiku классифицирует по 6 категориям (объём)
// - Sonnet определяет Strategic vs Execution (качество одного вывода)
// - size_estimate через иерархию прокси: G2 → LinkedIn → MRR (бонус)
//
// ПРИНЦИПИАЛЬНЫЕ ИЗМЕНЕНИЯ ОТ СКВ:
// #1 JomplaintCategory → ComplaintCategory (typo)
// #2 DiagnosisReason: добавлен 'no_competitors' как явная ветка
//    Early return при пустых конкурентах убран — диагноз обрабатывает это
// #3 block_context: добавлены top_competitor_size и top_competitor_g2_reviews для Блока 5
//
// CALIBRATE_AFTER_50_ANALYSES:
// - G2 коэффициент: 300 пользователей на 1 отзыв (enterprise ~500, SMB ~150)
// - size_estimate пороги: micro <100, small 100-1k, medium 1k-10k, large 10k+

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAuthUser } from "@/lib/auth-helpers";
import { getServerSupabase } from "@/lib/supabase";

const claude = new Anthropic();

const BLOCK_COST = { public: 0, premium: 5 } as const;

// ——————————————————————————————————————————————————————————————
// ТИПЫ
// ——————————————————————————————————————————————————————————————

type Diagnosis = "green" | "yellow" | "red";

type DiagnosisReason =
  | "no_competitors"
  | "strategic_gap"
  | "execution_gap"
  | "no_gap"
  | "insufficient_data";

type GapType = "strategic" | "execution" | "none";

// #1: ComplaintCategory (было JomplaintCategory — typo)
type ComplaintCategory =
  | "pricing_model"
  | "missing_feature"
  | "ux_bug"
  | "performance"
  | "support"
  | "integration"
  | "irrelevant";

interface CompetitorSignal {
  domain: string;
  name: string;
  source: "paid" | "organic";
  query?: string;
}

interface CompetitorSize {
  estimate: "micro" | "small" | "medium" | "large";
  confidence: "high" | "medium" | "low";
  primary_proxy: "g2" | "appstore" | "linkedin" | "mrr";
  proxies_used: number;
  raw: {
    g2_reviews?: number;
    appstore_rating_count?: number;
    linkedin_employees?: number;
    mrr_mentioned?: number;
  };
}

interface GapEvidence {
  type: "strategic" | "execution";
  complaint_category: ComplaintCategory;
  quote: string;
  source: string;
  competitor_domain: string;
  reasoning?: string;
}

interface CompetitorProfile {
  domain: string;
  name: string;
  source: "paid" | "organic";
  size: CompetitorSize;
  payment_model: string | null;
  primary_segment: "enterprise" | "smb" | "consumer" | "unknown";
  top_complaints: {
    category: ComplaintCategory;
    count: number;
    sample_quote: string;
  }[];
}

interface Layer1Data {
  competitors: CompetitorProfile[];
  total_found: number;
  paid_count: number;
  organic_count: number;
}

interface Layer2Data {
  strategic_gaps: GapEvidence[];
  execution_gaps: GapEvidence[];
  has_strategic_gap: boolean;
  top_gap_category: ComplaintCategory | null;
  classification_details: {
    total_reviews_analyzed: number;
    strategic_count: number;
    execution_count: number;
  };
}

interface Layer3Data {
  entry_point: string;
  entry_point_competitor: string;
  entry_point_reasoning: string;
  strategic_gap_summary: string | null;
  positioning_vectors: string[];
}

// #3: Добавлены поля для Блока 5
interface CompetitionBlockContext {
  gap_type: GapType;
  entry_point: string;
  top_competitor: string;
  competitor_count: number;
  has_strategic_gap: boolean;
  has_execution_gap?: boolean; // 4.8
  top_gap_category: ComplaintCategory | null;
  top_competitor_size: "micro" | "small" | "medium" | "large" | null;
  top_competitor_g2_reviews: number | null;
}

interface CompetitionBlockOutput {
  diagnosis: Diagnosis;
  score: number;
  conflict_weight: number;
  key_factors: string[];
  key_metric: string;
  block_context: CompetitionBlockContext;
  layers: {
    layer1: Layer1Data;
    layer2: Layer2Data;
    layer3: Layer3Data;
  };
}

// ——————————————————————————————————————————————————————————————
// SERPAPI HELPER
// ——————————————————————————————————————————————————————————————

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

// ——————————————————————————————————————————————————————————————
// СЛОЙ 1: КАРТОГРАФИЯ
// Размер через иерархию прокси: G2 → LinkedIn → MRR (бонус)
// ——————————————————————————————————————————————————————————————

async function estimateCompetitorSize(
  competitor: CompetitorSignal,
  serpApiKey: string,
): Promise<CompetitorSize> {
  const raw: CompetitorSize["raw"] = {};
  let proxies_used = 0;
  let primary_proxy: CompetitorSize["primary_proxy"] = "g2";

  const [g2Data, linkedinData, mrrData] = await Promise.all([
    fetchSerpAPI(
      "google",
      {
        q: `site:g2.com "${competitor.name}" reviews`,
        gl: "us",
        num: "5",
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      "google",
      {
        q: `site:linkedin.com/company "${competitor.name.split(".")[0]}" employees`,
        gl: "us",
        num: "3",
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      "google",
      {
        q: `"${competitor.domain}" MRR OR revenue OR "annual recurring" interview podcast`,
        gl: "us",
        num: "5",
      },
      serpApiKey,
    ),
  ]);

  // Прокси 1: G2 отзывы (наивысший приоритет)
  if (g2Data?.organic_results?.length) {
    // Приоритет 1: rich_snippet — точные данные из Google structured data
    for (const result of g2Data.organic_results) {
      const richReviews = result?.rich_snippet?.top?.detected_extensions?.reviews;
      if (richReviews && richReviews > 0) {
        raw.g2_reviews = richReviews;
        proxies_used++;
        primary_proxy = "g2";
        break;
      }
    }
    // Приоритет 2: fallback на snippet regex
    if (!raw.g2_reviews) {
      for (const result of g2Data.organic_results) {
        const snippet = result?.snippet || "";
        const match = snippet.match(/(\d[\d,]*)\s*(reviews?|ratings?)/i);
        if (match) {
          const count = parseInt(match[1].replace(/,/g, ""));
          if (count > 0) {
            raw.g2_reviews = count;
            proxies_used++;
            primary_proxy = "g2";
            break;
          }
        }
      }
    }
  }

  // Прокси 2: LinkedIn сотрудники
  if (linkedinData?.organic_results?.length) {
    const snippet = linkedinData.organic_results[0]?.snippet || "";
    const match = snippet.match(/(\d[\d,]+)\s*(employees?|staff|people)/i);
    if (match) {
      raw.linkedin_employees = parseInt(match[1].replace(/,/g, ""));
      proxies_used++;
      if (!raw.g2_reviews) primary_proxy = "linkedin";
    }
  }

  // Прокси 3: MRR упоминания (бонус)
  if (mrrData?.organic_results?.length) {
    const snippets = mrrData.organic_results
      .map((r: any) => r.snippet || "")
      .join(" ");
    const mrrMatch = snippets.match(/\$(\d+)k?\s*(MRR|ARR|monthly recurring)/i);
    if (mrrMatch) {
      const val = parseInt(mrrMatch[1]);
      raw.mrr_mentioned = mrrMatch[0].includes("k") ? val * 1000 : val;
      proxies_used++;
      if (!raw.g2_reviews && !raw.linkedin_employees) primary_proxy = "mrr";
    }
  }

  // 4.2 — Приоритет linkedin_employees (самый надёжный), потом g2_reviews.
  // Раньше g2_reviews стоял первым, из-за чего Kissflow (500 LinkedIn, 591 G2)
  // получал estimate "small" через 591*7 = 4137 < 5000.
  let userEstimate = 0;
  let confidence: CompetitorSize["confidence"] = "low";

  if (raw.linkedin_employees) {
    // LinkedIn employees — самый надёжный proxy
    userEstimate = raw.linkedin_employees;
    confidence = "medium";
    // Прямой маппинг по количеству сотрудников
    const estimate: CompetitorSize["estimate"] =
      raw.linkedin_employees >= 5000 ? "large"
      : raw.linkedin_employees >= 200 ? "medium"
      : raw.linkedin_employees >= 20 ? "small"
      : "micro";
    return { estimate, confidence, primary_proxy, proxies_used, raw };
  }

  if (raw.g2_reviews) {
    userEstimate = raw.g2_reviews;
    confidence = raw.g2_reviews >= 10 ? "high" : "medium";
  } else if (raw.mrr_mentioned) {
    userEstimate = raw.mrr_mentioned / 50;
    confidence = "medium";
  }

  // G2/MRR fallback — пороги по числу отзывов, не по userEstimate*7
  const estimate: CompetitorSize["estimate"] =
    raw.g2_reviews
      ? (raw.g2_reviews >= 2000 ? "large"
        : raw.g2_reviews >= 300 ? "medium"
        : raw.g2_reviews >= 50 ? "small"
        : "micro")
      : (userEstimate <= 0 ? "micro"
        : userEstimate < 500 ? "micro"
        : userEstimate < 5000 ? "small"
        : userEstimate < 50000 ? "medium"
        : "large");

  return {
    estimate,
    confidence: proxies_used === 0 ? "low" : confidence,
    primary_proxy,
    proxies_used,
    raw,
  };
}

async function buildCompetitorProfile(
  competitor: CompetitorSignal,
  serpApiKey: string,
  block3PriceRange?: any,
): Promise<CompetitorProfile> {
  const size = await estimateCompetitorSize(competitor, serpApiKey);

  let primary_segment: CompetitorProfile["primary_segment"] = "unknown";
  if (block3PriceRange?.median) {
    const price = block3PriceRange.median;
    primary_segment =
      price > 200 ? "enterprise" : price > 30 ? "smb" : "consumer";
  }

  return {
    domain: competitor.domain,
    name: competitor.name,
    source: competitor.source,
    size,
    payment_model: null,
    primary_segment,
    top_complaints: [],
  };
}

async function collectLayer1(
  competitors: CompetitorSignal[],
  serpApiKey: string,
  block3PriceRange?: any,
): Promise<Layer1Data> {
  const sorted = [...competitors].sort((a, b) =>
    a.source === "paid" && b.source === "organic" ? -1 : 1,
  );
  const top3 = sorted.slice(0, 3);

  const profiles = await Promise.all(
    top3.map((c) => buildCompetitorProfile(c, serpApiKey, block3PriceRange)),
  );

  return {
    competitors: profiles,
    total_found: competitors.length,
    paid_count: competitors.filter((c) => c.source === "paid").length,
    organic_count: competitors.filter((c) => c.source === "organic").length,
  };
}

// ——————————————————————————————————————————————————————————————
// СЛОЙ 2: GAP АНАЛИЗ
// Шаг 1: Haiku классифицирует жалобы по 6 категориям (объём)
// Шаг 2: Sonnet определяет Strategic vs Execution (качество)
// ——————————————————————————————————————————————————————————————

async function fetchReviews(
  competitor: CompetitorProfile,
  serpApiKey: string,
): Promise<{ text: string; source: string }[]> {
  const [g2Reviews, trustpilotReviews, capterraReviews] = await Promise.all([
    fetchSerpAPI(
      "google",
      {
        q: `site:g2.com "${competitor.name}" "1 star" OR "2 stars" reviews problems`,
        gl: "us",
        num: "10",
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      "google",
      {
        q: `site:trustpilot.com "${competitor.name}" "1 star" OR "2 stars" OR terrible OR awful`,
        gl: "us",
        num: "5",
      },
      serpApiKey,
    ),
    fetchSerpAPI(
      "google",
      {
        q: `site:capterra.com "${competitor.name}" reviews problems`,
        gl: "us",
        num: "8",
      },
      serpApiKey,
    ),
  ]);

  // Fix 3: мусорные паттерны — тексты самих платформ, не отзывы пользователей
  const JUNK_PATTERNS = [
    /g2 takes pride/i,
    /showing unbiased reviews/i,
    /learn more about the cost/i,
    /read verified reviews/i,
    /capterra is free/i,
    /find the best software/i,
    /compare verified reviews/i,
    /sponsored listing/i,
    /how would you rate your experience/i,
    /unsure of what to choose/i,
    /check capterra to compare/i,
    /write a review/i,
  ];

  const isJunk = (text: string) =>
    JUNK_PATTERNS.some((pattern) => pattern.test(text)) || text.length < 40;

  const reviews: { text: string; source: string }[] = [];

  g2Reviews?.organic_results?.forEach((r: any) => {
    if (r.snippet && !isJunk(r.snippet))
      reviews.push({ text: r.snippet, source: "g2" });
  });

  trustpilotReviews?.organic_results?.forEach((r: any) => {
    if (r.snippet && !isJunk(r.snippet))
      reviews.push({ text: r.snippet, source: "trustpilot" });
  });

  capterraReviews?.organic_results?.forEach((r: any) => {
    if (r.snippet && !isJunk(r.snippet))
      reviews.push({ text: r.snippet, source: "capterra" });
  });

  return reviews.slice(0, 15);
}

async function classifyComplaints(
  reviews: { text: string; source: string }[],
  _competitorDomain: string,
  niche: string,
): Promise<{ category: ComplaintCategory; quote: string; source: string; is_relevant: boolean; severity: number }[]> {
  if (reviews.length === 0) return [];

  const reviewsText = reviews
    .map((r, i) => `[${i}] (${r.source}) ${r.text.slice(0, 250)}`)
    .join("\n\n");

  try {
    const response = await claude.messages.create({
      model: "claude-haiku-4-5-20251001",
      temperature: 0,
      max_tokens: 800,
      system: "Отвечай только валидным JSON без markdown и пояснений.",
      messages: [
        {
          role: "user",
          content: `Ты анализируешь отзывы о конкурентах в нише "${niche}".
Классифицируй каждый отзыв по категории жалобы и определи релевантность к нише.

Категории:
- pricing_model: жалобы на цену, тарифы, стоимость
- missing_feature: нет нужной функции или возможности
- ux_bug: плохой UX, баги, неудобный интерфейс
- performance: медленно, падает, нестабильно
- support: плохая поддержка, нет ответов
- integration: проблемы с интеграциями, API
- irrelevant: отзыв НЕ относится к нише "${niche}" (спам, другой продукт, общие комментарии без конкретной жалобы)

Отзывы:
${reviewsText}

Верни JSON массив из ${reviews.length} объектов:
[{"category": "pricing_model", "quote": "краткая цитата 50-100 символов", "is_relevant": true, "severity": 7}, ...]

severity: 1-10, насколько серьёзна жалоба (10 = критично для пользователя).
is_relevant: false если отзыв не относится к нише или не содержит конкретной жалобы.`,
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

    if (!Array.isArray(result) || result.length !== reviews.length) return [];

    const validCategories = [
      "pricing_model",
      "missing_feature",
      "ux_bug",
      "performance",
      "support",
      "integration",
      "irrelevant",
    ];

    return result.map((r: any, i: number) => ({
      category: (validCategories.includes(r?.category)
        ? r.category
        : "ux_bug") as ComplaintCategory,
      quote: r?.quote?.slice(0, 150) || reviews[i].text.slice(0, 100),
      source: reviews[i].source,
      is_relevant: r?.is_relevant !== false,
      severity: typeof r?.severity === "number" ? Math.min(10, Math.max(1, r.severity)) : 5,
    }));
  } catch {
    return [];
  }
}

async function determineStrategicGap(
  topComplaints: {
    category: ComplaintCategory;
    count: number;
    sample_quote: string;
  }[],
  competitor: CompetitorProfile,
  businessModel: string,
): Promise<{
  is_strategic: boolean;
  gap_category: ComplaintCategory;
  reasoning: string;
} | null> {
  if (topComplaints.length === 0) return null;

  const topComplaint = topComplaints[0];

  try {
    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      system: "Отвечай только валидным JSON без markdown.",
      messages: [
        {
          role: "user",
          content: `Оцени: может ли конкурент исправить главную жалобу без ущерба для своей бизнес-модели?

Конкурент: ${competitor.domain}
Сегмент: ${competitor.primary_segment}
Бизнес-модель: ${businessModel}
Размер: ${competitor.size.estimate}

Главная жалоба (категория: ${topComplaint.category}):
"${topComplaint.sample_quote}"
Упоминается ${topComplaint.count} раз в отзывах.

Вопрос: Может ли ${competitor.domain} исправить эту проблему без потери своего главного источника дохода?

Примеры Strategic Gap (конкурент НЕ МОЖЕТ исправить):
- Slack не может убрать лимит истории сообщений из бесплатного плана — это их главный рычаг конверсии в платный
- Salesforce не может снизить цену до SMB уровня — их sales motion и поддержка стоят этих денег

Примеры Execution Gap (конкурент МОЖЕТ исправить):
- Медленная загрузка страниц — техническая проблема, исправляется за квартал
- Неудобная мобильная версия — UI/UX работа, не связана с моделью

Верни JSON:
{
  "is_strategic": true | false,
  "reasoning": "1-2 предложения почему это strategic или execution",
  "can_competitor_fix": true | false,
  "fix_cost": "easy" | "hard" | "impossible"
}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      return null;
    }

    const r = result as any;
    return {
      is_strategic: r?.is_strategic === true,
      gap_category: topComplaint.category,
      reasoning: r?.reasoning || "Недостаточно данных для определения типа gap",
    };
  } catch {
    return null;
  }
}

async function collectLayer2(
  layer1: Layer1Data,
  serpApiKey: string,
  block3Data: any,
  niche: string,
): Promise<Layer2Data> {
  if (layer1.competitors.length === 0) {
    return {
      strategic_gaps: [],
      execution_gaps: [],
      has_strategic_gap: false,
      top_gap_category: null,
      classification_details: {
        total_reviews_analyzed: 0,
        strategic_count: 0,
        execution_count: 0,
      },
    };
  }

  const strategicGaps: GapEvidence[] = [];
  const executionGaps: GapEvidence[] = [];
  let totalReviews = 0;

  const reviewsPerCompetitor = await Promise.all(
    layer1.competitors.map((competitor) =>
      fetchReviews(competitor, serpApiKey),
    ),
  );

  const classifiedPerCompetitor = await Promise.all(
    layer1.competitors.map((competitor, idx) =>
      classifyComplaints(reviewsPerCompetitor[idx], competitor.domain, niche),
    ),
  );

  // 4.1 — Enrichment: для конкурентов с пустыми жалобами — дополнительные целевые запросы.
  // Добавляем G2 "what do you dislike" + Reddit frustrations.
  for (let idx = 0; idx < layer1.competitors.length; idx++) {
    const relevant = classifiedPerCompetitor[idx].filter(c => c.category !== 'irrelevant' && c.is_relevant);
    if (relevant.length > 0) continue; // уже есть жалобы

    const comp = layer1.competitors[idx];
    // Пропускаем enrichment для медиа-доменов (если они просочились)
    const compDomainLower = (comp.domain ?? '').toLowerCase().replace(/^www\./, '');
    if (['forbes.com', 'pcmag.com', 'housingwire.com', 'g2.com', 'capterra.com', 'wikipedia.org'].some((m) => compDomainLower === m || compDomainLower.endsWith('.' + m))) {
      console.log(`[Block4] Skipping enrichment for media domain: ${comp.domain}`);
      continue;
    }
    // 4.7 — Поиск по имени И по домену (ManageEngine может быть на G2 как "manageengine")
    const domainKey = comp.domain.replace('www.', '').split('.')[0];
    const searchTerms = [...new Set([comp.name, domainKey].filter(Boolean))];

    // Крупные конкуренты (1000+ G2 reviews) — больше результатов
    const isLarge = comp.size?.estimate === 'large' || (comp.size?.raw?.g2_reviews ?? 0) > 500;
    const numResults = isLarge ? '12' : '8';

    console.log(`[Block4] Enriching complaints for ${comp.name} (domain=${domainKey}, large=${isLarge}, terms=${searchTerms.join('+')})`);

    const enrichmentQueries = searchTerms.flatMap((term) => [
      `site:g2.com "${term}" "what do you dislike"`,
      `site:g2.com "${term}" reviews pros-and-cons`,
    ]).concat([
      `site:reddit.com "${comp.name}" problem OR issue OR frustrated OR "switched from"`,
      `site:capterra.com "${comp.name}" "what could be improved" OR "cons"`,
    ]).slice(0, 5); // макс 5 запросов на конкурента

    const enrichResults = await Promise.all(
      enrichmentQueries.map((q) =>
        fetchSerpAPI('google', { q, gl: 'us', num: numResults }, serpApiKey),
      ),
    );

    const extraReviews: { text: string; source: string }[] = [];
    for (const res of enrichResults) {
      for (const r of (res?.organic_results ?? [])) {
        if (r.snippet && r.snippet.length >= 40) {
          extraReviews.push({
            text: r.snippet,
            source: r.link?.includes('g2.com') ? 'g2'
              : r.link?.includes('capterra.com') ? 'capterra'
              : r.link?.includes('reddit.com') ? 'reddit'
              : 'g2',
          });
        }
      }
    }

    if (extraReviews.length > 0) {
      console.log(`[Block4] Enrichment found ${extraReviews.length} extra reviews for ${comp.name}`);
      const extraClassified = await classifyComplaints(extraReviews.slice(0, 15), comp.domain, niche);
      classifiedPerCompetitor[idx] = [...classifiedPerCompetitor[idx], ...extraClassified];
    }
  }

  await Promise.all(
    layer1.competitors.map(async (competitor, idx) => {
      const allClassified = classifiedPerCompetitor[idx];
      const classified = allClassified.filter(c => c.category !== "irrelevant" && c.is_relevant);
      totalReviews += classified.length;

      if (classified.length === 0) return;

      const categoryCount = new Map<
        ComplaintCategory,
        { count: number; quotes: string[] }
      >();

      classified.forEach(({ category, quote }) => {
        const existing = categoryCount.get(category) || {
          count: 0,
          quotes: [],
        };
        existing.count++;
        if (existing.quotes.length < 3) existing.quotes.push(quote);
        categoryCount.set(category, existing);
      });

      const topCategories = Array.from(categoryCount.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 3)
        .map(([category, data]) => ({
          category,
          count: data.count,
          sample_quote: data.quotes[0] || "",
        }));

      competitor.top_complaints = topCategories;

      const businessModel = block3Data?.payment_model
        ? `${block3Data.payment_model}, ценовой диапазон ${block3Data.price_range?.median || "неизвестно"}/мес`
        : "подписка (данных о цене нет)";

      const gapAnalysis = await determineStrategicGap(
        topCategories,
        competitor,
        businessModel,
      );

      if (gapAnalysis) {
        const topQuotes = classified
          .filter((c) => c.category === gapAnalysis.gap_category)
          .slice(0, 3);

        const evidence: GapEvidence = {
          type: gapAnalysis.is_strategic ? "strategic" : "execution",
          complaint_category: gapAnalysis.gap_category,
          quote: topQuotes[0]?.quote || topCategories[0]?.sample_quote || "",
          source: topQuotes[0]?.source || "g2",
          competitor_domain: competitor.domain,
          reasoning: gapAnalysis.reasoning || undefined,
        };

        if (gapAnalysis.is_strategic) {
          strategicGaps.push(evidence);
        } else {
          executionGaps.push(evidence);
        }
      }
    }),
  );

  return {
    strategic_gaps: strategicGaps,
    execution_gaps: executionGaps,
    has_strategic_gap: strategicGaps.length > 0,
    top_gap_category:
      strategicGaps[0]?.complaint_category ||
      executionGaps[0]?.complaint_category ||
      null,
    classification_details: {
      total_reviews_analyzed: totalReviews,
      strategic_count: strategicGaps.length,
      execution_count: executionGaps.length,
    },
  };
}

// ——————————————————————————————————————————————————————————————
// FALLBACK HELPERS: конкретные данные вместо абстрактных заглушек
// ——————————————————————————————————————————————————————————————

function buildFallbackVectors(
  primaryCompetitor: any,
  primaryGap: any,
  layer1: Layer1Data,
  layer2: Layer2Data,
  niche: string,
): string[] {
  const vectors: string[] = [];

  // Вектор 1: из главного gap (если есть)
  if (primaryGap) {
    const gapLabel = primaryGap.type === 'strategic'
      ? `Стратегический gap у ${primaryGap.competitor_domain}: ${primaryGap.complaint_category}`
      : `Проблема UX у ${primaryGap.competitor_domain}: ${primaryGap.complaint_category}`;
    vectors.push(gapLabel);
  }

  // Вектор 2: из незакрытого сегмента (если есть несколько конкурентов)
  const segments = new Set(layer1.competitors.map(c => c.primary_segment).filter(Boolean));
  const coveredSegments = [...segments];
  const allSegments = ['smb', 'enterprise', 'consumer'] as const;
  const uncovered = allSegments.filter(s => !coveredSegments.includes(s as any));
  if (uncovered.length > 0 && coveredSegments.length > 0) {
    vectors.push(`Незакрытый сегмент: ${uncovered[0]} (конкуренты фокусируются на ${coveredSegments.join(', ')})`);
  }

  // Вектор 3: из конкретных жалоб
  const topExecGap = layer2.execution_gaps[0];
  if (topExecGap && topExecGap !== primaryGap) {
    vectors.push(`Жалоба пользователей ${topExecGap.competitor_domain}: "${topExecGap.quote?.slice(0, 80) || topExecGap.complaint_category}"`);
  }

  // Вектор 4 (резервный): ценовой
  if (vectors.length < 2) {
    const sizes = layer1.competitors.map(c => c.size.estimate).filter(Boolean);
    if (sizes.includes('large') || sizes.includes('medium')) {
      vectors.push(`Ценовая альтернатива крупным игрокам в ${niche} (${primaryCompetitor.domain})`);
    }
  }

  // Минимум 2 вектора
  if (vectors.length === 0) {
    vectors.push(`Дифференциация от ${primaryCompetitor.domain} в сегменте ${niche}`);
  }

  return vectors.slice(0, 3);
}

function buildFallbackLayer3(
  primaryCompetitor: any,
  primaryGap: any,
  layer1: Layer1Data,
  layer2: Layer2Data,
  niche: string,
): Layer3Data {
  return {
    entry_point: primaryGap
      ? `Войти через ${primaryCompetitor.domain} — ${primaryGap.complaint_category} (${primaryGap.type === 'strategic' ? 'стратегический' : 'execution'} gap)`
      : `Войти через ${primaryCompetitor.domain} — нереализованный спрос в ${niche}`,
    entry_point_competitor: primaryCompetitor.domain,
    entry_point_reasoning: primaryGap?.reasoning || `Анализ ${layer1.competitors.length} конкурентов в ${niche}`,
    strategic_gap_summary: primaryGap?.type === 'strategic'
      ? `${primaryCompetitor.domain} не может закрыть ${primaryGap.complaint_category} без изменения бизнес-модели`
      : null,
    positioning_vectors: buildFallbackVectors(primaryCompetitor, primaryGap, layer1, layer2, niche),
  };
}

// ——————————————————————————————————————————————————————————————
// СЛОЙ 3: ТОЧКА ВХОДА
// Sonnet формулирует entry_point — конкретный тезис для позиционирования
// ——————————————————————————————————————————————————————————————

async function collectLayer3(
  layer1: Layer1Data,
  layer2: Layer2Data,
  niche: string,
): Promise<Layer3Data> {
  if (layer1.competitors.length === 0) {
    return {
      entry_point: "Конкуренты не найдены — первый игрок в нише",
      entry_point_competitor: "unknown",
      entry_point_reasoning:
        "Нет данных о конкурентах. Возможность определить категорию.",
      strategic_gap_summary: null,
      positioning_vectors: [
        "First mover advantage",
        "Define the category",
        "Set the standard",
      ],
    };
  }

  const primaryGap = layer2.strategic_gaps[0] || layer2.execution_gaps[0];
  const primaryCompetitor =
    layer1.competitors.find(
      (c) => c.domain === primaryGap?.competitor_domain,
    ) || layer1.competitors[0];

  try {
    const gapContext = primaryGap
      ? `Главный gap: ${primaryGap.type === "strategic" ? "STRATEGIC" : "EXECUTION"} (${primaryGap.complaint_category})
Цитата: "${primaryGap.quote}"
${primaryGap.reasoning ? `Почему не могут исправить: ${primaryGap.reasoning}` : ""}`
      : "Gap не найден — поле занято конкурентами";

    const response = await claude.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: "Отвечай только валидным JSON без markdown.",
      messages: [
        {
          role: "user",
          content: `Сформулируй конкретную точку входа на рынок.

Ниша: ${niche}
Главный конкурент: ${primaryCompetitor.domain} (${primaryCompetitor.primary_segment}, размер: ${primaryCompetitor.size.estimate})

${gapContext}

Другие конкуренты: ${
            layer1.competitors
              .slice(1)
              .map((c) => c.domain)
              .join(", ") || "нет"
          }

Сформулируй:
1. entry_point — одно предложение: "Войти через [конкурент] потому что [конкретная причина почему не может ответить]"
2. entry_point_reasoning — 1-2 предложения обоснования
3. strategic_gap_summary — если есть strategic gap, 1-2 предложения о незащищённости; null если нет
4. positioning_vectors — 3 конкретных вектора позиционирования (не абстракции)

Верни JSON:
{
  "entry_point": "строка",
  "entry_point_reasoning": "строка",
  "strategic_gap_summary": "строка или null",
  "positioning_vectors": ["вектор 1", "вектор 2", "вектор 3"]
}`,
        },
      ],
    });

    const text =
      response.content[0].type === "text"
        ? response.content[0].text.trim()
        : "{}";
    const cleaned = text.replace(/```json|```/g, "").trim();

    let result: unknown;
    try {
      result = JSON.parse(cleaned);
    } catch {
      // JSON parse failed — собираем конкретные векторы из имеющихся данных
      return buildFallbackLayer3(primaryCompetitor, primaryGap, layer1, layer2, niche);
    }

    const r = result as any;
    const fallbackVectors = buildFallbackVectors(primaryCompetitor, primaryGap, layer1, layer2, niche);
    return {
      entry_point: r?.entry_point || `Войти через ${primaryCompetitor.domain} — ${primaryGap?.complaint_category || "нереализованный спрос"}`,
      entry_point_competitor: primaryCompetitor.domain,
      entry_point_reasoning: r?.entry_point_reasoning || primaryGap?.reasoning || "",
      strategic_gap_summary: r?.strategic_gap_summary || null,
      positioning_vectors: Array.isArray(r?.positioning_vectors) && r.positioning_vectors.length > 0
        ? r.positioning_vectors.slice(0, 3)
        : fallbackVectors,
    };
  } catch {
    return buildFallbackLayer3(primaryCompetitor, primaryGap, layer1, layer2, niche);
  }
}

// ——————————————————————————————————————————————————————————————
// ДИАГНОЗ
// 5 веток в порядке приоритета:
// no_competitors → insufficient_data → strategic_gap → execution_gap → no_gap
// ——————————————————————————————————————————————————————————————

function makeCompetitionDiagnosis(
  layer1: Layer1Data,
  layer2: Layer2Data,
  layer3: Layer3Data,
): {
  diagnosis: Diagnosis;
  score: number;
  conflict_weight: number;
  reason: DiagnosisReason;
  key_factors: string[];
  key_metric: string;
  gap_type: GapType;
} {
  // Ветка 1: Нет конкурентов
  if (layer1.competitors.length === 0) {
    return {
      diagnosis: "green",
      score: 8,
      conflict_weight: 1,
      reason: "no_competitors",
      key_factors: [
        "Конкуренты не найдены — потенциально первый игрок",
        "Нет рекламного давления в SERP",
        "Возможность определить категорию и стандарты",
      ],
      key_metric: "Открытое поле — нет конкурентов",
      gap_type: "none",
    };
  }

  // 4.8 — Ветка 2 пропускается если есть execution/strategic gaps
  // (enrichment мог найти жалобы даже при < 5 total_reviews)
  if (
    layer2.classification_details.total_reviews_analyzed < 5 &&
    !layer2.has_strategic_gap &&
    layer2.execution_gaps.length === 0
  ) {
    return {
      diagnosis: "yellow",
      score: 4,
      conflict_weight: 2,
      reason: "insufficient_data",
      key_factors: [
        `Найдено ${layer1.total_found} конкурентов на рынке`,
        `Лидер рынка: ${layer1.competitors[0]?.domain ?? 'не определён'}`,
      ],
      key_metric: `${layer1.total_found} конкурентов в нише`,
      gap_type: "none",
    };
  }

  // Ветка 3: Strategic Gap
  if (layer2.has_strategic_gap) {
    const topGap = layer2.strategic_gaps[0];
    return {
      diagnosis: "green",
      score: Math.min(10, 7 + layer2.strategic_gaps.length),
      conflict_weight: 1,
      reason: "strategic_gap",
      key_factors: [
        `Strategic Gap у ${topGap.competitor_domain}: ${topGap.complaint_category}`,
        topGap.reasoning ||
          "Конкурент не может исправить без ущерба для бизнес-модели",
        `Точка входа: ${layer3.entry_point}`,
      ],
      key_metric: `Strategic Gap: ${topGap.complaint_category} у ${topGap.competitor_domain}`,
      gap_type: "strategic",
    };
  }

  // Ветка 4: Execution Gap
  if (layer2.execution_gaps.length > 0) {
    const topGap = layer2.execution_gaps[0];
    return {
      diagnosis: "yellow",
      score: 5,
      conflict_weight: 2,
      reason: "execution_gap",
      key_factors: [
        `Execution Gap у ${topGap.competitor_domain}: ${topGap.complaint_category}`,
        topGap.reasoning || "Окно входа открыто — конкурент не исправил проблему",
        `${layer1.paid_count} платных конкурентов в SERP — высокая конкуренция`,
      ],
      key_metric: `Execution Gap: ${topGap.complaint_category}`,
      gap_type: "execution",
    };
  }

  // Ветка 5: Нет gap
  return {
    diagnosis: "red",
    score: 2,
    conflict_weight: 3,
    reason: "no_gap",
    key_factors: [
      `${layer1.total_found} конкурентов, gap не найден в отзывах`,
      "Конкуренты закрывают все основные потребности рынка",
      `${layer1.paid_count} платных игроков — высокий рекламный бюджет`,
    ],
    key_metric: `${layer1.total_found} конкурентов без gap`,
    gap_type: "none",
  };
}

// ════════════════════════════════════════════════════════════════
// INTERPRETATION LAYER (Block 4)
// ════════════════════════════════════════════════════════════════
// Фоновая генерация человекочитаемой интерпретации блока.
// Кэш 24ч в block_interpretations. Не блокирует основной ответ.

async function generateCompetitionInterpretation(
  trendId: string,
  niche: string,
  diagnosis: string,
  blockContext: Record<string, any>,
  rawData: Record<string, any>,
  supabase: ReturnType<typeof getServerSupabase>,
  anthropic: Anthropic,
): Promise<void> {
  // 4.9 — Кэш с проверкой смены top_competitor
  const { data: existing } = await supabase
    .from("block_interpretations")
    .select("id, generated_at, headline, main_insight")
    .eq("trend_id", trendId)
    .eq("block_id", "competition")
    .maybeSingle();

  if (existing && (existing as any).generated_at) {
    const age = Date.now() - new Date((existing as any).generated_at).getTime();
    const isFresh = age < 24 * 60 * 60 * 1000;

    // Проверяем что top_competitor не сменился
    const topName = String(blockContext?.top_competitor ?? '')
      .replace('.com', '').replace('www.', '').toLowerCase();
    const cachedText = (((existing as any).headline ?? '') + ((existing as any).main_insight ?? '')).toLowerCase();
    const competitorChanged = topName.length > 2 && !cachedText.includes(topName);

    if (isFresh && !competitorChanged) return;
    if (competitorChanged) {
      console.log(`[Block4 Interpretation] Top competitor changed to ${topName} — regenerating`);
    }
  }

  // Извлекаем данные
  const competitorCount = blockContext?.competitor_count ?? 0;
  const topCompetitor = blockContext?.top_competitor ?? null;
  const topCompetitorSize = blockContext?.top_competitor_size ?? "unknown";
  const topCompetitorG2 = blockContext?.top_competitor_g2_reviews ?? 0;
  const hasStrategicGap = blockContext?.has_strategic_gap ?? false;
  const topGapCategory = blockContext?.top_gap_category ?? null;
  const entryPoint = blockContext?.entry_point ?? null;

  // Конкуренты из raw_data
  const competitors: any[] =
    rawData?.layers?.layer1?.competitors ?? rawData?.competitors ?? [];

  // Есть ли реальные жалобы
  const hasRealComplaints = competitors.some(
    (c: any) => Array.isArray(c?.top_complaints) && c.top_complaints.length > 0,
  );
  const totalReviewsAnalyzed =
    rawData?.layers?.layer2?.classification_details?.total_reviews_analyzed ?? 0;

  // Размер конкурента в человеческом языке
  const sizeHuman = (size: string) =>
    size === "large" ? "крупный (10 000+ клиентов)"
    : size === "medium" ? "средний (500–10 000 клиентов)"
    : size === "small" ? "небольшой (до 500 клиентов)"
    : size === "micro" ? "маленький (стартап)"
    : "неизвестного размера";

  // Positioning vectors из layer3 как альтернатива entry_point
  const positioningVectors: string[] =
    rawData?.layers?.layer3?.positioning_vectors ??
    rawData?.premium?.layers?.layer3?.positioning_vectors ?? [];

  // 4.3 — Реальные цитаты из жалоб клиентов
  const categoryHumanMap: Record<string, string> = {
    support: 'поддержка', pricing_model: 'цены', missing_feature: 'функциональность',
    ui_ux: 'интерфейс', performance: 'производительность', onboarding: 'онбординг',
    data_migration: 'миграция', integrations: 'интеграции',
  };
  const allComplaints = competitors.flatMap((comp: any) =>
    (comp.top_complaints ?? []).map((c: any) => ({
      competitor: comp.name ?? comp.domain ?? '?',
      category: c.category ?? 'unknown',
      categoryRu: categoryHumanMap[c.category] ?? c.category ?? 'другое',
      count: c.count ?? 1,
      quote: c.sample_quote ?? '',
    })),
  );
  const topComplaints = allComplaints
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  const complaintsForPrompt = topComplaints
    .map((c) => `${c.competitor} (${c.categoryRu}): "${c.quote}"`)
    .join('\n');

  // Execution gaps с reasoning
  const executionGaps: any[] = rawData?.layers?.layer2?.execution_gaps ?? [];
  const executionGapsForPrompt = executionGaps.slice(0, 2)
    .map((g: any) => `${g.competitor_domain}: ${g.reasoning ?? g.complaint_category ?? ''}`)
    .join('\n');

  // data_sufficiency
  const dataSufficiency: "sufficient" | "limited" =
    hasRealComplaints && totalReviewsAnalyzed >= 5 ? "sufficient" : "limited";

  const systemPrompt = `Ты — аналитик рынков для предпринимателей.
Пишешь на русском языке. Твои тексты читают люди которые думают
войти в новую нишу — они не технари, они бизнесмены.

ЖЁСТКИЕ ПРАВИЛА:
- Никогда не используй: gap_type, has_strategic_gap, execution_gaps,
  strategic_gaps, top_gap_category, g2_reviews как технический термин,
  primary_proxy, proxies_used, classification_details,
  total_reviews_analyzed
- Никогда не пиши: "данных недостаточно для gap анализа",
  "рекомендуется ручное исследование", "отзывов меньше 5"
- Тон: уверенный аналитик который хорошо знает этот рынок`;

  const userPrompt = `Проанализируй конкурентную ситуацию в нише: "${niche}"

ТЕХНИЧЕСКИЕ ДАННЫЕ (не используй эти термины в тексте):
- Диагноз: ${diagnosis}
- Найдено конкурентов: ${competitorCount}
- Главный конкурент: ${topCompetitor ?? "не определён"}
- Размер: ${sizeHuman(topCompetitorSize)}
- Отзывов на G2: ${topCompetitorG2 > 0 ? Number(topCompetitorG2).toLocaleString() : 'мало данных'}
- Есть ли реальный gap: ${hasRealComplaints ? 'да — жалобы найдены' : 'нет'}
- Достаточность данных: ${dataSufficiency === "sufficient" ? "жалобы найдены — анализ на реальных данных" : "жалоб мало — дополни знаниями о рынке"}

${complaintsForPrompt ? `РЕАЛЬНЫЕ ЖАЛОБЫ КЛИЕНТОВ (используй в анализе — это настоящие слова):
${complaintsForPrompt}` : ''}

${executionGapsForPrompt ? `ОПЕРАЦИОННЫЕ СЛАБОСТИ:
${executionGapsForPrompt}` : ''}

${positioningVectors.length > 0 ? `КОНКРЕТНЫЕ УГЛЫ ВХОДА (используй в key_facts[2] — это реальные данные):
${positioningVectors.slice(0, 3).map((v: string, i: number) => `${i + 1}. ${v}`).join('\n')}` : 'Углы входа: не определены'}

${(() => {
  const gt = blockContext?.gap_type ?? 'none';
  if (gt === 'execution') return 'ВАЖНО для decision_impact: gap операционный — конкурент МОЖЕТ его закрыть. У тебя окно 6-18 месяцев. decision_impact должен отражать срочность.';
  if (gt === 'strategic') return 'ВАЖНО для decision_impact: gap стратегический — конкурент структурно не может закрыть без разрушения модели. Окно долгосрочное.';
  return '';
})()}

${dataSufficiency === "limited" ? `ВАЖНО: Реальных жалоб мало. Проанализируй конкурентов на основе:
1. Размера и позиционирования — крупные медленно реагируют на нишевые нужды
2. Знаний о типичных слабостях таких продуктов в нише "${niche}"
Формулируй как конкретный анализ, не как общие советы.` : ""}

Ответь на три вопроса предпринимателя:
1. Кто главный конкурент и в чём его конкретная слабость?
2. Есть ли реальное место для нового игрока?
3. Как конкретно войти — первый шаг?

Напиши анализ в формате JSON:

{
  "headline": "одно предложение-диагноз про конкуренцию (максимум 12 слов)",
  "main_insight": "2-3 предложения. Назови главного конкурента и его конкретную слабость СЛОВАМИ ЕГО КЛИЕНТОВ если есть цитаты выше. Есть ли место для нового игрока.",
  "key_facts": [
    "факт 1: конкретная жалоба на главного конкурента — близко к реальной цитате если есть",
    "факт 2: про количество и размер конкурентов — кто большой, кто маленький",
    "факт 3: КОНКРЕТНЫЙ угол входа из списка выше — не абстрактный совет, а первое действие с деталями"
  ],
  "decision_impact": "одно-два предложения: через что входить и почему именно так, а не иначе"
}

ПРИМЕРЫ ХОРОШИХ ФАКТОВ (конкретные):
- "Kissflow не отвечает на негативные отзывы — клиенты пишут 'prohibitive pricing' и не получают ответа"
- "6 конкурентов: два крупных (Kissflow, ManageEngine) и четыре маленьких стартапа"
- "Первый шаг: ответить на каждый негативный отзыв Kissflow на G2 с предложением попробовать альтернативу"

ПРИМЕРЫ ПЛОХИХ ФАКТОВ (ЗАПРЕЩЕНО):
- "gap_type: execution" — технический код
- "Есть слабость конкурента" — без имени и конкретики
- "Рекомендуется ручное исследование" — так не пишем

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
      console.error("[Block4 Interpretation] Invalid structure:", parsed);
      return;
    }

    const { error: saveError } = await supabase
      .from("block_interpretations")
      .upsert(
        {
          trend_id: trendId,
          block_id: "competition",
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
      console.error("[Block4 Interpretation] Save failed:", saveError);
      return;
    }
    console.log("[Block4 Interpretation] Generated for trend:", trendId);
  } catch (error) {
    console.error("[Block4 Interpretation] Failed:", error);
  }
}

// ——————————————————————————————————————————————————————————————
// ОСНОВНОЙ РОУТ
// ——————————————————————————————————————————————————————————————

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

    const { trend_id, niche } = (await req.json()) as {
      trend_id: string;
      niche: string;
    };

    if (!trend_id || !niche) {
      return NextResponse.json(
        { error: "trend_id и niche обязательны" },
        { status: 400 },
      );
    }

    const [block2Result, block3Result] = await Promise.all([
      supabase
        .from("block_results")
        .select("*")
        .eq("trend_id", trend_id)
        .eq("user_id", user.id)
        .eq("block_number", 2)
        .single(),
      supabase
        .from("block_results")
        .select("*")
        .eq("trend_id", trend_id)
        .eq("user_id", user.id)
        .eq("block_number", 3)
        .single(),
    ]);

    if (block2Result.error || !block2Result.data) {
      return NextResponse.json(
        { error: "Блок 2 не найден. Запустите анализ Спроса." },
        { status: 422 },
      );
    }

    const block2_context = block2Result.data.block_context;
    const block3_context = block3Result.data?.block_context || null;

    // Фильтруем медиа-домены (Forbes, PCMag, etc.) — могут прийти из кэшированного Block 2
    const rawCompetitors: CompetitorSignal[] = block2_context.competitors_found || [];
    const competitors = rawCompetitors.filter((c) => {
      const d = (c.domain ?? '').toLowerCase().replace(/^www\./, '');
      // Общие медиа-домены которые не продукты
      const mediaPatterns = [
        'forbes.com', 'pcmag.com', 'housingwire.com', 'inman.com',
        'businessinsider.com', 'techcrunch.com', 'cnet.com', 'zdnet.com',
        'wsj.com', 'bloomberg.com', 'wired.com', 'theverge.com',
        'techradar.com', 'tomsguide.com', 'clutch.co', 'goodfirms.co',
        'investopedia.com', 'nerdwallet.com', 'entrepreneur.com',
        'g2.com', 'capterra.com', 'getapp.com', 'softwareadvice.com',
        'trustradius.com', 'wikipedia.org', 'youtube.com', 'reddit.com',
      ];
      return !mediaPatterns.some((m) => d === m || d.endsWith('.' + m));
    });
    if (rawCompetitors.length !== competitors.length) {
      const filtered = rawCompetitors.filter((c) => !competitors.includes(c)).map((c) => c.domain);
      console.log(`[Block4] Filtered media domains from competitors: ${filtered.join(', ')}`);
    }

    if (competitors.length === 0) {
      console.log(
        "[Block4] No competitors found — proceeding with no_competitors diagnosis",
      );
    }

    // —— Слой 1: Карта поля ————————————————————————
    const layer1 = await collectLayer1(
      competitors,
      SERPAPI_KEY,
      block3_context?.price_range,
    );

    // —— Слой 2: Gap анализ —————————————————————————
    const layer2 = await collectLayer2(layer1, SERPAPI_KEY, block3_context, niche);

    // —— Слой 3: Точка входа ————————————————————————
    const layer3 = await collectLayer3(layer1, layer2, niche);

    // —— Диагноз ———————————————————————————————
    const diagnosisResult = makeCompetitionDiagnosis(layer1, layer2, layer3);

    // —— block_context с полями для Блока 5 ————————————
    const topCompetitor = layer1.competitors[0];

    const block_context: CompetitionBlockContext = {
      gap_type: diagnosisResult.gap_type,
      entry_point: layer3.entry_point,
      top_competitor: topCompetitor?.domain || "unknown",
      competitor_count: layer1.total_found,
      has_strategic_gap: layer2.has_strategic_gap,
      has_execution_gap: layer2.execution_gaps.length > 0, // 4.8
      top_gap_category: layer2.top_gap_category,
      top_competitor_size: topCompetitor?.size.estimate || null,
      top_competitor_g2_reviews: topCompetitor?.size.raw.g2_reviews || null,
    };

    // Информативный score: варьируется внутри диагноза
    const computedCompScore = (() => {
      let s = diagnosisResult.diagnosis === 'green' ? 7 : diagnosisResult.diagnosis === 'yellow' ? 4 : 2;
      if (layer2.has_strategic_gap) s += 2;
      if (layer2.execution_gaps.length > 0 && !layer2.has_strategic_gap) s += 1;
      if (layer2.classification_details.total_reviews_analyzed >= 10) s += 0.5;
      if (layer1.total_found >= 3 && layer1.total_found <= 8) s += 0.5;
      if (layer1.total_found === 0) s -= 1;
      if (layer1.total_found > 20) s -= 1;
      if (diagnosisResult.gap_type === 'none' && layer2.execution_gaps.length === 0) s -= 1;
      return Math.max(1, Math.min(10, Math.round(s)));
    })();

    const output: CompetitionBlockOutput = {
      diagnosis: diagnosisResult.diagnosis,
      score: computedCompScore,
      conflict_weight: diagnosisResult.conflict_weight,
      key_factors: diagnosisResult.key_factors,
      key_metric: diagnosisResult.key_metric,
      block_context,
      layers: { layer1, layer2, layer3 },
    };

    const { error: dbError } = await supabase.from("block_results").upsert({
      trend_id,
      user_id: user.id,
      block_number: 4,
      block_type: "competition",
      diagnosis: output.diagnosis,
      score: Math.max(0, Math.min(10, Math.round(Number.isFinite(output.score) ? output.score : 0))),
      conflict_weight: output.conflict_weight,
      key_factors: output.key_factors,
      key_metric: output.key_metric,
      block_context: output.block_context,
      raw_data: {
        layers: output.layers,
        premium: {
          gap_type: diagnosisResult.gap_type,
          entry_point: layer3.entry_point,
          strategic_gaps: layer2.strategic_gaps,
          execution_gaps: layer2.execution_gaps,
          positioning_vectors: layer3.positioning_vectors,
          competitors: layer1.competitors,
          key_factors: output.key_factors,
          block_context: output.block_context,
          layers: output.layers,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);

    // ── Interpretation Layer (фоновая генерация, не блокирует ответ) ──
    generateCompetitionInterpretation(
      trend_id,
      niche,
      output.diagnosis,
      output.block_context as Record<string, any>,
      { layers: output.layers } as Record<string, any>,
      supabase,
      claude,
    ).catch((err) =>
      console.error("[Block4 Interpretation] Background error:", err),
    );

    console.log("[Block4] Competition diagnosis:", {
      diagnosis: output.diagnosis,
      reason: diagnosisResult.reason,
      gap_type: diagnosisResult.gap_type,
      strategic_gaps: layer2.strategic_gaps.length,
      execution_gaps: layer2.execution_gaps.length,
      total_reviews: layer2.classification_details.total_reviews_analyzed,
      entry_point: layer3.entry_point,
      top_competitor: topCompetitor?.domain,
      top_competitor_size: topCompetitor?.size.estimate,
    });

    return NextResponse.json({
      success: true,
      _cost: BLOCK_COST,
      public: {
        diagnosis: output.diagnosis,
        score: output.score,
        key_metric: output.key_metric,
        key_factors: output.key_factors,
        block_context: output.block_context,
        has_strategic_gap: layer2.has_strategic_gap,
        competitor_count: layer1.total_found,
        gap_type: diagnosisResult.gap_type,
        entry_point: layer3.entry_point,
        strategic_gaps: layer2.strategic_gaps,
        execution_gaps: layer2.execution_gaps,
        positioning_vectors: layer3.positioning_vectors,
        competitors: layer1.competitors,
        layers: output.layers,
      },
      has_premium: true,
    });
  } catch (error: any) {
    console.error("[Block 4 — Competition]", error);
    return NextResponse.json(
      { error: error.message || "Внутренняя ошибка блока Конкуренция" },
      { status: 500 },
    );
  }
}
