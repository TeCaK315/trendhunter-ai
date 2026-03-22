import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse, formatErrorForUser, type OpenAIError } from '@/lib/openai';
import { checkRateLimit, getClientIP, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';

/**
 * /api/product-spec
 *
 * Генерирует Product Specification - AI гипотезы о том КАК должен работать продукт.
 * Этот этап идёт ПОСЛЕ анализа болей и ПЕРЕД генерацией кода.
 *
 * На основе тренда, болей и целевой аудитории определяет:
 * 1. Что пользователь получает на выходе (user_output)
 * 2. Что пользователь вводит на входе (user_input)
 * 3. User flow (3-5 шагов)
 * 4. Где происходит "магия" (AI/формула/агрегация)
 * 5. Какие API нужны
 * 6. Нужна ли БД и авторизация
 * 7. Модель монетизации
 * 8. Как пользователь решает проблему сейчас
 */

interface ProductSpecRequest {
  trend: {
    title: string;
    category?: string;
    why_trending?: string;
  };
  analysis?: {
    main_pain: string;
    key_pain_points?: string[];
    target_audience?: {
      primary: string;
      segments?: Array<{
        name: string;
        size: string;
        willingness_to_pay?: string;
      }>;
    };
    opportunities?: string[];
    risks?: string[];
  };
  competition?: {
    competitors?: Array<{
      name: string;
      website?: string;
      description?: string;
    }>;
    strategic_positioning?: string;
  };
  // Design data from background analysis
  design_analysis?: {
    generated_design?: {
      color_palette: {
        primary: string;
        secondary: string;
        accent: string;
        background: string;
        text: string;
      };
      typography: {
        headings: string;
        body: string;
        mono?: string;
      };
      unique_elements: string[];
      design_rationale: string;
    };
    competitors_analyzed?: Array<{
      name: string;
      colors: string[];
      fonts: string[];
    }>;
  };
  // NEW: Full Evidence data for contextual feature generation
  evidence?: {
    // Block 1: Real Problem (who_hurts)
    complaints?: Array<{
      source: string;
      title: string;
      engagement?: number;
      url?: string;
    }>;
    // Block 4: Market Occupation
    negative_reviews?: Array<{
      competitor: string;
      review: string;
      source?: string;
    }>;
    unmet_needs?: Array<{
      need: string;
      frequency: string;
      source?: string;
    }>;
    // Pricing analysis
    pricing_data?: Array<{
      competitor: string;
      plans?: Array<{
        name: string;
        price: string;
        features?: string[];
      }>;
    }>;
    // AI Synthesis from 3 agents
    ai_synthesis?: {
      consensus?: string;
      key_insights?: string[];
    };
    // Block 2: Demand Growth
    demand_growth?: {
      growth_rate_12m?: number;
      growth_rate_3m?: number;
      stability_score?: number;
      search_intent?: {
        commercial_percent: number;
        informational_percent: number;
        intent_type: string;
      };
      new_players_count?: number;
      geo_top_regions?: Array<{ region: string; growth_rate: number | null }>;
    };
    // Block 3: Market Sellability
    sellability?: {
      market_segment?: string; // B2B, B2C, SMB, Enterprise, Mixed
      segment_confidence?: number;
      median_price?: number | null;
      competitor_prices?: Array<{
        competitor: string;
        price: string;
        plan_type: string;
      }>;
      sales_cycle?: string; // simple, moderate, complex
    };
    // Block 5: Unit Economics
    economics?: {
      estimated_cac?: number;
      ltv_cac_ratio?: number;
      business_model?: string; // subscription, one-time, freemium, marketplace
      market_size_revenue?: number | null;
      scalability_score?: number;
    };
    // Block 6: Tech Feasibility
    tech_feasibility?: {
      complexity_level?: string; // low, medium, high
      complexity_score?: number;
      stack_recommendations?: {
        frontend: string;
        backend: string;
        database: string;
        hosting: string;
      };
      regulatory_blockers?: boolean;
      regulatory_checks?: Array<{
        regulation: string;
        applies: boolean;
        severity: string;
      }>;
      mvp_weeks?: number;
    };
  };
  // Differentiation strategy (USP, Blue Ocean, positioning vectors)
  differentiation?: {
    usp?: {
      for_whom: string;
      what_does: string;
      how_different: string;
      full_usp: string;
    };
    blue_ocean_strategy?: {
      eliminate: string[];
      reduce: string[];
      raise: string[];
      create: string[];
    };
    positioning_vectors?: Array<{
      vector: string;
      description: string;
      target_audience: string;
      effort: string;
    }>;
    competitor_weaknesses?: Array<{
      competitor: string;
      weakness: string;
      opportunity: string;
    }>;
    blue_ocean_score?: number;
  };
}

// Результат - Product Specification
export interface ProductSpecification {
  // Что пользователь получает
  user_output: {
    primary_output: string;
    output_format: 'text' | 'report' | 'score' | 'list' | 'visualization' | 'recommendation' | 'action';
    example: string;
    value_proposition: string;
  };

  // Что пользователь вводит
  user_input: {
    primary_input: string;
    input_type: 'text' | 'url' | 'file' | 'form' | 'selection' | 'voice' | 'image';
    required_fields: Array<{
      name: string;
      type: string;
      description: string;
      example?: string;
    }>;
    optional_fields?: Array<{
      name: string;
      type: string;
      description: string;
    }>;
  };

  // User flow
  user_flow: {
    steps: Array<{
      step_number: number;
      action: string;
      user_sees: string;
      time_to_complete: string;
    }>;
    total_time_to_value: string;
    aha_moment: string;
  };

  // Где происходит магия
  magic_location: {
    type: 'ai_analysis' | 'ai_generation' | 'formula_calculation' | 'data_aggregation' | 'api_orchestration' | 'pattern_matching';
    description: string;
    technical_approach: string;
    ai_prompt_hint?: string;
  };

  // Технические требования
  technical_requirements: {
    apis_needed: Array<{
      name: string;
      purpose: string;
      free_tier_available: boolean;
      estimated_cost?: string;
    }>;
    database_required: boolean;
    database_reason?: string;
    auth_required: boolean;
    auth_reason?: string;
    recommended_stack: {
      frontend: string;
      backend: string;
      database?: string;
      ai_provider?: string;
    };
  };

  // Монетизация
  monetization: {
    model: 'freemium' | 'subscription' | 'pay_per_use' | 'one_time' | 'free_with_ads' | 'enterprise';
    free_tier_limits?: string;
    pricing_tiers?: Array<{
      name: string;
      price: string;
      features: string[];
    }>;
    reasoning: string;
  };

  // Текущее решение пользователя
  current_user_solution: {
    how_they_solve_now: string;
    pain_points_with_current: string[];
    our_advantage: string;
    switching_cost: 'low' | 'medium' | 'high';
  };

  // Design System (from background analysis or generated)
  design_system?: {
    color_palette: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    typography: {
      headings: string;
      body: string;
      mono?: string;
    };
    unique_elements: string[];
    design_rationale: string;
  };

  // NEW: Features derived from real pain data
  derived_features?: Array<{
    feature_name: string;
    pain_source: 'complaint' | 'negative_review' | 'unmet_need' | 'pricing' | 'synthesis';
    pain_quote: string;
    solution: string;
    priority: 'must_have' | 'should_have' | 'nice_to_have';
    implementation_hint: string;
  }>;

  // Метаданные
  confidence_score: number;
  generation_approach: 'ai-tool' | 'calculator' | 'dashboard' | 'automation' | 'marketplace' | 'content-platform';
  mvp_complexity: 'simple' | 'medium' | 'complex';
}

// System prompt для генерации Product Specification
const PRODUCT_SPEC_PROMPT = `You are a Senior Product Manager with 15+ years of startup experience. Your task is to create a FULL PRODUCT SPECIFICATION based on REAL market analysis data.

ABSOLUTE RULE: ALL output text MUST be in ENGLISH. No Russian, no other languages. Every string value in the JSON must be English.

## CRITICAL: FEATURE EXTRACTION
You receive REAL market analysis data:
- **complaints** — real user complaints from Reddit/Quora/HackerNews
- **negative_reviews** — negative reviews of competitors
- **unmet_needs** — unmet market needs
- **pricing_data** — competitor pricing
- **demand_growth** — demand growth/decline, commercial vs informational interest, new players
- **sellability** — market segment (B2B/B2C/SMB), median price, sales cycle
- **economics** — CAC, LTV/CAC ratio, business model, scalability
- **tech_feasibility** — technical complexity, recommended stack, regulatory requirements

YOUR MAIN TASK: Extract SPECIFIC FEATURES for the MVP from this data!

Example logic:
- Complaint: "SonarQube is too complex for small teams" → Feature: "Simple Mode — 3 clicks to first scan"
- Negative review: "CodeClimate doesn't support Python 3.12" → Feature: "Python 3.12 support out of the box"
- Unmet need: "I want GitLab integration" → Feature: "Native GitLab + GitHub integration"
- Pricing: "Competitors charge $30/user" → Pricing: "$5/user or freemium"

RULES:
1. user_output — WHAT EXACTLY does the user receive? Not abstract "solution", but a concrete artifact SPECIFIC TO THIS NICHE (e.g. for fitness: "personalized 4-week workout plan with progress tracking", for SEO: "detailed site audit report with actionable fixes")
2. user_input — WHAT EXACTLY does the user enter? What fields, what format?
3. user_flow — STEP BY STEP what the user sees from opening to getting value
4. magic_location — WHERE does the magic happen? AI analysis? Formula? Data aggregation?
5. technical_requirements — What APIs are needed? Database? Auth? If tech_feasibility exists — use recommended stack!
6. monetization — Use sellability (median price, segment) and economics (CAC, business model) for realistic pricing!
7. current_user_solution — How do people solve this problem NOW? Use complaints!
8. derived_features — features extracted from specific pains. If regulatory blockers exist — add compliance features!
9. confidence_score — factor in demand_growth: if growth > 30% and commercial_intent > 50% → higher confidence
10. mvp_complexity — factor in tech_feasibility.complexity_level if available

CRITICAL RULES:
- Each feature in derived_features MUST reference a specific complaint/review/need from the provided data.
- pain_quote MUST be a REAL QUOTE from the data, not an invented phrase.
- If no Evidence data (complaints, negative_reviews, unmet_needs) exists — still generate at least 3 derived_features based on logical user pains for this niche.
- DO NOT invent market sizes, revenues, or statistics.
- pricing_tiers: if no competitor pricing_data — use reasonable estimates based on the niche.

MINIMUM FEATURE REQUIREMENTS:
- derived_features MUST contain AT LEAST 4 features (ideally 5-6)
- At least 2 must be "must_have" priority
- If Evidence data has fewer than 4 pain points, INFER additional features from:
  1. Common pain points in this niche (usability, speed, cost, integration)
  2. Competitive gaps mentioned in negative_reviews
  3. Industry-standard expectations for this product type
- Each inferred feature should still have a realistic pain_quote (mark pain_source as "synthesis")

IMPORTANT:
- Each feature must SOLVE a specific pain from the data
- Be SPECIFIC. "3-page report with charts" instead of "analysis result"
- Think MINIMUM MVP — what can be built in 1-2 weeks?
- Budget: $0-100/month for infrastructure
- generation_approach must match the product type accurately
- value_proposition must be a SHORT, punchy English tagline (max 6-8 words). It is used as the HERO HEADLINE on the landing page. Examples: "AI-Powered Code Reviews", "Smart Meal Planning Made Easy", "Your Personal Fitness Coach". NEVER a full sentence or long description! Must be SPECIFIC to the niche — not generic!
- primary_output must be 1-3 WORDS ONLY — it's used as a button label (e.g. "New Report", "New Analysis"). Examples: "Report", "Analysis", "Business Plan", "Quiz", "Workout Plan". NEVER a full sentence or description!

CRITICAL LANGUAGE RULE — EVERY SINGLE VALUE IN THE JSON MUST BE IN ENGLISH:
- ALL string values (primary_output, value_proposition, example, steps, feature names, descriptions, pain_quotes, solutions, aha_moment, etc.) MUST be written in English
- Even if the input trend name or evidence data is in Russian/Chinese/any other language — TRANSLATE everything to English
- This is critical because the generated website will be deployed publicly and must be in English
- If you write ANY non-English characters (Cyrillic, Chinese, Arabic, etc.) in ANY field, the build will FAIL
- Field labels, button text, form placeholders — everything in the JSON output must be English
- value_proposition is displayed as a large H1 headline — keep it SHORT (6-8 words max) and in ENGLISH

REMINDER: ALL values must be in ENGLISH ONLY. Any non-ASCII characters will cause build failure. Return JSON only, no markdown:
{
  "user_output": {
    "primary_output": "SHORT 1-3 word noun for what user creates, e.g. Report, Analysis, Quiz, Workout Plan, Audit — NEVER a full sentence",
    "output_format": "text|report|score|list|visualization|recommendation|action",
    "example": "Specific example of the output user receives",
    "value_proposition": "Short punchy tagline, max 10 words, in English"
  },
  "user_input": {
    "primary_input": "Description of the main user input",
    "input_type": "text|url|file|form|selection|voice|image",
    "required_fields": [
      {
        "name": "field_name",
        "type": "string|number|url|email|file",
        "description": "What this field is for",
        "example": "Example value"
      }
    ],
    "optional_fields": []
  },
  "user_flow": {
    "steps": [
      {
        "step_number": 1,
        "action": "What the user does",
        "user_sees": "What appears on screen",
        "time_to_complete": "~30 sec"
      }
    ],
    "total_time_to_value": "< 2 minutes",
    "aha_moment": "The moment user realizes the value"
  },
  "magic_location": {
    "type": "ai_analysis|ai_generation|formula_calculation|data_aggregation|api_orchestration|pattern_matching",
    "description": "Where the core value is created",
    "technical_approach": "How to implement this technically",
    "ai_prompt_hint": "Approximate AI prompt if used"
  },
  "technical_requirements": {
    "apis_needed": [
      {
        "name": "OpenAI API",
        "purpose": "What for",
        "free_tier_available": true,
        "estimated_cost": "$5-20/mo"
      }
    ],
    "database_required": false,
    "database_reason": "Reason if needed",
    "auth_required": false,
    "auth_reason": "Reason if needed",
    "recommended_stack": {
      "frontend": "Next.js + Tailwind",
      "backend": "Next.js API Routes",
      "database": "PostgreSQL if needed",
      "ai_provider": "OpenAI if needed"
    }
  },
  "monetization": {
    "model": "freemium|subscription|pay_per_use|one_time|free_with_ads|enterprise",
    "free_tier_limits": "5 requests/day",
    "pricing_tiers": [
      {
        "name": "Pro",
        "price": "$9.99/mo",
        "features": ["Unlimited requests", "Export"]
      }
    ],
    "reasoning": "Why this model"
  },
  "current_user_solution": {
    "how_they_solve_now": "How users solve the problem today",
    "pain_points_with_current": ["Pain point 1", "Pain point 2"],
    "our_advantage": "Our advantage",
    "switching_cost": "low|medium|high"
  },
  "derived_features": [
    {
      "feature_name": "Feature name in English",
      "pain_source": "Where the pain came from (complaint/review/need)",
      "pain_quote": "Quote from the data (translated to English)",
      "solution": "How we solve it",
      "priority": "must_have|should_have|nice_to_have",
      "implementation_hint": "How to implement technically"
    }
  ],
  "confidence_score": 8.5,
  "generation_approach": "ai-tool|calculator|dashboard|automation|marketplace|content-platform",
  "mvp_complexity": "simple|medium|complex"
}`;

// Wrapper для callAgent с обработкой ошибок
async function runProductSpecAgent(
  systemPrompt: string,
  userPrompt: string
): Promise<{ success: true; content: string } | { success: false; error: OpenAIError }> {
  return callAgent(systemPrompt, userPrompt, {
    maxRetries: 3,
    retryDelayMs: 1000,
    model: 'gpt-4o-mini', // Используем mini для скорости, достаточно умный для этой задачи
  });
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - uses GPT-4o
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`analysis:${clientIP}`, RATE_LIMITS.analysis);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body: ProductSpecRequest = await request.json();

    if (!body.trend?.title) {
      return NextResponse.json(
        { success: false, error: 'Название тренда обязательно' },
        { status: 400 }
      );
    }

    if (!body.analysis?.main_pain) {
      return NextResponse.json(
        { success: false, error: 'Необходим анализ болей (analysis.main_pain)' },
        { status: 400 }
      );
    }

    console.log(`[product-spec] Starting for trend: ${body.trend.title}`);
    const startTime = Date.now();

    // Формируем user prompt с полным контекстом
    const userPrompt = `Создай Product Specification для решения следующей боли:

## ТРЕНД
- **Название:** ${body.trend.title}
- **Категория:** ${body.trend.category || 'Technology'}
- **Почему трендит:** ${body.trend.why_trending || 'Растущий спрос'}

## АНАЛИЗ БОЛЕЙ
- **Главная боль:** ${body.analysis.main_pain}
- **Дополнительные боли:** ${body.analysis.key_pain_points?.join(', ') || 'Не определены'}

## ЦЕЛЕВАЯ АУДИТОРИЯ
- **Основная:** ${body.analysis.target_audience?.primary || 'Не определена'}
- **Сегменты:** ${body.analysis.target_audience?.segments?.map(s =>
    `${s.name} (${s.size}, готовность платить: ${s.willingness_to_pay || 'не оценена'})`
  ).join('; ') || 'Не определены'}

## ВОЗМОЖНОСТИ И РИСКИ
- **Возможности:** ${body.analysis.opportunities?.join(', ') || 'Не определены'}
- **Риски:** ${body.analysis.risks?.join(', ') || 'Не определены'}

## КОНКУРЕНТЫ
${body.competition?.competitors?.map(c =>
  `- ${c.name}: ${c.description || 'нет описания'} (${c.website || 'нет сайта'})`
).join('\n') || 'Конкуренты не проанализированы'}

**Позиционирование:** ${body.competition?.strategic_positioning || 'Не определено'}

${body.evidence?.complaints?.length ? `## РЕАЛЬНЫЕ ЖАЛОБЫ ПОЛЬЗОВАТЕЛЕЙ (из Reddit/Quora/HackerNews)
${body.evidence.complaints.slice(0, 10).map((c, i) =>
  `${i + 1}. [${c.source}] "${c.title}" (engagement: ${c.engagement || 'N/A'})`
).join('\n')}

ВАЖНО: Используй эти жалобы для вывода КОНКРЕТНЫХ фич!
` : ''}
${body.evidence?.negative_reviews?.length ? `## НЕГАТИВНЫЕ ОТЗЫВЫ О КОНКУРЕНТАХ
${body.evidence.negative_reviews.slice(0, 8).map((r, i) =>
  `${i + 1}. ${r.competitor}: "${r.review}" (${r.source || 'review'})`
).join('\n')}

ВАЖНО: Каждый негативный отзыв = возможность для нашего продукта!
` : ''}
${body.evidence?.unmet_needs?.length ? `## НЕУДОВЛЕТВОРЁННЫЕ ПОТРЕБНОСТИ РЫНКА
${body.evidence.unmet_needs.slice(0, 8).map((n, i) =>
  `${i + 1}. "${n.need}" (частота: ${n.frequency}, источник: ${n.source || 'analysis'})`
).join('\n')}

ВАЖНО: Это то, что рынок ХОЧЕТ, но не получает от конкурентов!
` : ''}
${body.evidence?.pricing_data?.length ? `## ЦЕНООБРАЗОВАНИЕ КОНКУРЕНТОВ
${body.evidence.pricing_data.map(p =>
  `**${p.competitor}:**\n${p.plans?.map(plan =>
    `  - ${plan.name}: ${plan.price}${plan.features?.length ? ` (${plan.features.slice(0, 3).join(', ')})` : ''}`
  ).join('\n') || '  - Цены не найдены'}`
).join('\n\n')}

ВАЖНО: Используй для конкурентного ценообразования!
` : ''}
${body.evidence?.ai_synthesis?.consensus ? `## AI СИНТЕЗ (консенсус 3 агентов)
**Консенсус:** ${body.evidence.ai_synthesis.consensus}
${body.evidence.ai_synthesis.key_insights?.length ? `**Ключевые инсайты:**\n${body.evidence.ai_synthesis.key_insights.map(i => `- ${i}`).join('\n')}` : ''}
` : ''}
${body.evidence?.demand_growth ? `## РЫНОЧНЫЙ СПРОС (Evidence: Demand Growth)
- **Рост за 12 мес:** ${body.evidence.demand_growth.growth_rate_12m != null ? `${body.evidence.demand_growth.growth_rate_12m}%` : 'нет данных'}
- **Рост за 3 мес:** ${body.evidence.demand_growth.growth_rate_3m != null ? `${body.evidence.demand_growth.growth_rate_3m}%` : 'нет данных'}
- **Стабильность интереса:** ${body.evidence.demand_growth.stability_score != null ? `${body.evidence.demand_growth.stability_score}/10` : 'нет данных'}
${body.evidence.demand_growth.search_intent ? `- **Тип интереса:** ${body.evidence.demand_growth.search_intent.intent_type} (коммерческий: ${body.evidence.demand_growth.search_intent.commercial_percent}%, информационный: ${body.evidence.demand_growth.search_intent.informational_percent}%)` : ''}
- **Новые игроки на рынке:** ${body.evidence.demand_growth.new_players_count ?? 'нет данных'}
${body.evidence.demand_growth.geo_top_regions?.length ? `- **Топ регионы:** ${body.evidence.demand_growth.geo_top_regions.slice(0, 5).map(r => `${r.region}${r.growth_rate != null ? ` (${r.growth_rate}%)` : ''}`).join(', ')}` : ''}

ВАЖНО: Используй данные о спросе для оценки mvp_complexity и confidence_score!
Если commercial_percent > 60% — рынок готов платить, pricing может быть агрессивнее.
Если рост отрицательный — учти это в рисках и выбери conservative pricing.
` : ''}
${body.evidence?.sellability ? `## ПРОДАВАЕМОСТЬ (Evidence: Market Sellability)
- **Сегмент рынка:** ${body.evidence.sellability.market_segment || 'не определён'}${body.evidence.sellability.segment_confidence ? ` (уверенность: ${Math.round(body.evidence.sellability.segment_confidence * 100)}%)` : ''}
- **Медианная цена конкурентов:** ${body.evidence.sellability.median_price != null ? `$${body.evidence.sellability.median_price}/мес` : 'нет данных'}
- **Цикл продаж:** ${body.evidence.sellability.sales_cycle || 'не определён'}
${body.evidence.sellability.competitor_prices?.length ? `- **Цены конкурентов:**\n${body.evidence.sellability.competitor_prices.slice(0, 6).map(p =>
  `  - ${p.competitor}: ${p.price} (${p.plan_type})`
).join('\n')}` : ''}

КРИТИЧЕСКИ ВАЖНО для pricing_tiers:
- Если сегмент B2B/Enterprise — цены выше, но нужен sales cycle support
- Если B2C — нужен freemium/low price entry point
- Медианная цена конкурентов = ориентир для нашего pricing (чуть ниже для входа на рынок)
` : ''}
${body.evidence?.economics ? `## ЭКОНОМИКА ПРОДУКТА (Evidence: Unit Economics)
- **Ориентировочный CAC:** ${body.evidence.economics.estimated_cac != null ? `$${body.evidence.economics.estimated_cac}` : 'нет данных'}
- **LTV/CAC ratio:** ${body.evidence.economics.ltv_cac_ratio != null ? body.evidence.economics.ltv_cac_ratio : 'нет данных'}
- **Бизнес-модель рынка:** ${body.evidence.economics.business_model || 'не определена'}
- **Масштабируемость:** ${body.evidence.economics.scalability_score != null ? `${body.evidence.economics.scalability_score}/10` : 'нет данных'}
${body.evidence.economics.market_size_revenue != null ? `- **Общий revenue рынка:** ~$${(body.evidence.economics.market_size_revenue / 1000000).toFixed(1)}M` : ''}

ВАЖНО для monetization:
- business_model рынка ДОЛЖЕН влиять на выбор модели монетизации
- Если CAC высокий — нужна high-value подписка, не freemium
- Если LTV/CAC < 3 — модель нежизнеспособна, предложи альтернативу
` : ''}
${body.evidence?.tech_feasibility ? `## ТЕХНИЧЕСКАЯ ОСУЩЕСТВИМОСТЬ (Evidence: Tech Feasibility)
- **Сложность:** ${body.evidence.tech_feasibility.complexity_level || 'не оценена'}${body.evidence.tech_feasibility.complexity_score != null ? ` (${body.evidence.tech_feasibility.complexity_score}/10)` : ''}
${body.evidence.tech_feasibility.stack_recommendations ? `- **Рекомендуемый стек:** ${body.evidence.tech_feasibility.stack_recommendations.frontend} + ${body.evidence.tech_feasibility.stack_recommendations.backend} + ${body.evidence.tech_feasibility.stack_recommendations.database}` : ''}
${body.evidence.tech_feasibility.mvp_weeks != null ? `- **Время на MVP:** ~${body.evidence.tech_feasibility.mvp_weeks} недель` : ''}
${body.evidence.tech_feasibility.regulatory_blockers ? `- **⚠️ РЕГУЛЯТОРНЫЕ БЛОКЕРЫ:** Есть критические требования!` : ''}
${body.evidence.tech_feasibility.regulatory_checks?.filter(r => r.applies).length ? `- **Регуляторные требования:**\n${body.evidence.tech_feasibility.regulatory_checks.filter(r => r.applies).map(r =>
  `  - [${r.severity}] ${r.regulation}: ${(r as any).description || ''}`
).join('\n')}` : ''}

ВАЖНО для technical_requirements:
- Используй рекомендуемый стек если он предоставлен
- Если есть регуляторные блокеры — ОБЯЗАТЕЛЬНО включи compliance фичи в derived_features
- complexity_level влияет на mvp_complexity в ответе
` : ''}
${body.design_analysis?.generated_design ? `## ДИЗАЙН СИСТЕМА (УЖЕ ПРОАНАЛИЗИРОВАНА)
**Цветовая палитра:**
- Primary: ${body.design_analysis.generated_design.color_palette.primary}
- Secondary: ${body.design_analysis.generated_design.color_palette.secondary}
- Accent: ${body.design_analysis.generated_design.color_palette.accent}
- Background: ${body.design_analysis.generated_design.color_palette.background}
- Text: ${body.design_analysis.generated_design.color_palette.text}

**Типографика:**
- Headings: ${body.design_analysis.generated_design.typography.headings}
- Body: ${body.design_analysis.generated_design.typography.body}
${body.design_analysis.generated_design.typography.mono ? `- Mono: ${body.design_analysis.generated_design.typography.mono}` : ''}

**Уникальные элементы:** ${body.design_analysis.generated_design.unique_elements.join(', ')}

**Обоснование:** ${body.design_analysis.generated_design.design_rationale}
` : ''}
${body.differentiation?.usp ? `## СТРАТЕГИЯ ДИФФЕРЕНЦИАЦИИ

### USP (Уникальное Торговое Предложение)
- **Для кого:** ${body.differentiation.usp.for_whom}
- **Что делает:** ${body.differentiation.usp.what_does}
- **Чем отличается:** ${body.differentiation.usp.how_different}
- **Полный USP:** ${body.differentiation.usp.full_usp}
` : ''}
${body.differentiation?.blue_ocean_strategy ? `### Blue Ocean Strategy (ERRC)
**УБРАТЬ** (то, что конкуренты делают зря):
${body.differentiation.blue_ocean_strategy.eliminate.map(e => `- ${e}`).join('\n')}

**СНИЗИТЬ** (то, на чём конкуренты перестарались):
${body.differentiation.blue_ocean_strategy.reduce.map(r => `- ${r}`).join('\n')}

**УСИЛИТЬ** (то, что конкуренты делают слабо):
${body.differentiation.blue_ocean_strategy.raise.map(r => `- ${r}`).join('\n')}

**СОЗДАТЬ** (то, чего нет ни у кого):
${body.differentiation.blue_ocean_strategy.create.map(c => `- ${c}`).join('\n')}

КРИТИЧЕСКИ ВАЖНО: Пункты из СОЗДАТЬ — это must-have фичи! Пункты из УБРАТЬ — НЕ включай в MVP!
` : ''}
${body.differentiation?.positioning_vectors?.length ? `### Векторы позиционирования
${body.differentiation.positioning_vectors.map((v, i) =>
  `${i + 1}. **${v.vector}** — ${v.description} (аудитория: ${v.target_audience}, усилие: ${v.effort})`
).join('\n')}
` : ''}
${body.differentiation?.competitor_weaknesses?.length ? `### Слабости конкурентов → Наши возможности
${body.differentiation.competitor_weaknesses.map((w, i) =>
  `${i + 1}. ${w.competitor}: "${w.weakness}" → **${w.opportunity}**`
).join('\n')}
` : ''}
---

## ТВОЯ ЗАДАЧА

1. Проанализируй ВСЕ данные выше
2. Выведи из каждой жалобы/отзыва/потребности КОНКРЕТНУЮ ФИЧУ
3. Заполни derived_features массив с указанием источника боли
4. Используй цены конкурентов для конкурентного pricing
5. Создай MVP который РЕШАЕТ выявленные боли, а не generic шаблон
${body.differentiation?.blue_ocean_strategy ? `6. Blue Ocean СОЗДАТЬ → это must-have фичи для derived_features (priority: must_have)
7. Blue Ocean УБРАТЬ → НЕ включай эти фичи в MVP (экономия ресурсов)
8. Blue Ocean УСИЛИТЬ → это should-have фичи (приоритет выше конкурентов)
9. USP должно отражаться в value_proposition и позиционировании` : ''}

${body.evidence?.complaints?.length || body.evidence?.negative_reviews?.length ?
  'У тебя есть РЕАЛЬНЫЕ данные - используй их для создания УНИКАЛЬНОГО продукта!' :
  'Данные Evidence не переданы - создай спецификацию на основе анализа.'}
${body.design_analysis?.generated_design ? 'ВАЖНО: Используй УКАЗАННУЮ выше дизайн-систему в своей спецификации.' : ''}
${body.differentiation?.usp ? 'ВАЖНО: USP уже определён — value_proposition продукта ДОЛЖЕН отражать его!' : ''}
Помни: это должен быть РАБОЧИЙ MVP, который можно сделать за 1-2 недели с бюджетом $0-100/мес.`;

    // Запускаем AI агента
    const result = await runProductSpecAgent(PRODUCT_SPEC_PROMPT, userPrompt);

    if (!result.success) {
      console.error('[product-spec] Agent error:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: formatErrorForUser(result.error),
          errorCode: result.error.code,
        },
        { status: 500 }
      );
    }

    // Парсим JSON ответ
    const productSpec = parseJSONResponse<ProductSpecification>(result.content);

    if (!productSpec) {
      console.error('[product-spec] Failed to parse response:', result.content.substring(0, 500));
      return NextResponse.json(
        { success: false, error: 'Не удалось распознать ответ AI. Попробуйте ещё раз.' },
        { status: 500 }
      );
    }

    // Inject design_system from background analysis if available
    if (body.design_analysis?.generated_design && !productSpec.design_system) {
      productSpec.design_system = body.design_analysis.generated_design;
    }

    // ========== ГАРАНТИРУЕМ ЗАПОЛНЕНИЕ derived_features ==========
    // Если AI не сгенерировал derived_features — создаём из Evidence данных
    if (!productSpec.derived_features || productSpec.derived_features.length === 0) {
      console.log('[product-spec] AI did not generate derived_features, extracting from Evidence...');

      const extractedFeatures: ProductSpecification['derived_features'] = [];

      // 1. Извлекаем из жалоб пользователей (complaints)
      if (body.evidence?.complaints?.length) {
        body.evidence.complaints.slice(0, 3).forEach((complaint, i) => {
          const title = typeof complaint?.title === 'string' ? complaint.title : '';
          if (!title) return;
          extractedFeatures.push({
            feature_name: `Решение боли #${i + 1}`,
            pain_source: 'complaint',
            pain_quote: title,
            solution: `Функционал для решения: ${title.substring(0, 100)}`,
            priority: i === 0 ? 'must_have' : 'should_have',
            implementation_hint: `Based on ${complaint.source || 'user'} feedback - needs real implementation`,
          });
        });
      }

      // 2. Извлекаем из негативных отзывов о конкурентах
      if (body.evidence?.negative_reviews?.length) {
        body.evidence.negative_reviews.slice(0, 2).forEach((review) => {
          const reviewText = typeof review?.review === 'string' ? review.review : '';
          if (!reviewText) return;
          extractedFeatures.push({
            feature_name: `Преимущество над ${review.competitor || 'конкурентом'}`,
            pain_source: 'negative_review',
            pain_quote: reviewText,
            solution: `Сделать лучше чем ${review.competitor || 'конкурент'}: ${reviewText.substring(0, 80)}`,
            priority: 'should_have',
            implementation_hint: `Competitive advantage feature - real API/integration needed`,
          });
        });
      }

      // 3. Извлекаем из неудовлетворённых потребностей
      if (body.evidence?.unmet_needs?.length) {
        body.evidence.unmet_needs.slice(0, 2).forEach((need) => {
          const needText = typeof need?.need === 'string' ? need.need : '';
          if (!needText) return;
          extractedFeatures.push({
            feature_name: `Рыночная потребность`,
            pain_source: 'unmet_need',
            pain_quote: needText,
            solution: `Реализовать: ${needText}`,
            priority: need.frequency === 'high' ? 'must_have' : 'should_have',
            implementation_hint: `Market demand feature - ${need.source || 'analysis based'}`,
          });
        });
      }

      // 4. Если Evidence данных нет — НЕ генерируем шаблонные фичи
      if (extractedFeatures.length === 0) {
        console.log('[product-spec] No Evidence data available — derived_features will be empty');
      }

      productSpec.derived_features = extractedFeatures;
      console.log(`[product-spec] Extracted ${extractedFeatures.length} features from Evidence data`);
    } else {
      console.log(`[product-spec] AI generated ${productSpec.derived_features.length} derived_features`);
    }

    // Если derived_features пуст — это нормально, значит нет Evidence данных
    if (!productSpec.derived_features || productSpec.derived_features.length === 0) {
      console.log('[product-spec] No derived_features — Evidence данные не были предоставлены');
      productSpec.derived_features = [];
    }

    const totalTime = Date.now() - startTime;
    console.log(`[product-spec] Completed in ${totalTime}ms, derived_features: ${productSpec.derived_features.length}`);

    return NextResponse.json({
      success: true,
      product_spec: productSpec,
      metadata: {
        total_time_ms: totalTime,
        trend_title: body.trend.title,
        main_pain: body.analysis.main_pain,
        generation_approach: productSpec.generation_approach,
        mvp_complexity: productSpec.mvp_complexity,
        confidence: productSpec.confidence_score,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[product-spec] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка генерации Product Specification' },
      { status: 500 }
    );
  }
}
