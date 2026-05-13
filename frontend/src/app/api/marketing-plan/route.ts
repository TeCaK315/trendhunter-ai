import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse, formatErrorForUser, type OpenAIError } from '@/lib/openai';
import { checkRateLimit, getClientIP, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';
import { getAuthUser } from '@/lib/auth-helpers'

/**
 * /api/marketing-plan
 *
 * Генерирует маркетинговый план на основе ВСЕХ собранных Evidence данных.
 * Вызывается ПОСЛЕ генерации проекта в разделе "Проект".
 *
 * Входные данные: Evidence (problem, demand, sellability, economics, occupation),
 * ProductSpec (derived_features, monetization, user_output), Differentiation (USP, Blue Ocean).
 *
 * Выходные данные: Структурированный маркетинговый план с ЦА, болями, каналами, текстами.
 */

export interface MarketingPlanResult {
  target_audience: {
    primary_segment: string;
    segment_type: string; // B2B, B2C, SMB, Enterprise
    demographic: string;
    psychographic: string;
    where_they_hang_out: string[]; // Конкретные площадки
    estimated_size: string;
  };
  pain_messaging: Array<{
    pain: string;       // Реальная боль из Evidence
    source: string;     // Откуда (Reddit, HackerNews и т.д.)
    hook: string;       // Рекламный заголовок, цепляющий эту боль
    description: string; // Развёрнутое описание для рекламы
  }>;
  positioning: {
    usp: string;
    one_liner: string;
    elevator_pitch: string; // 30 сек pitch
    vs_competitors: Array<{
      competitor: string;
      their_weakness: string;
      our_advantage: string;
    }>;
  };
  pricing_strategy: {
    recommended_model: string;
    entry_price: string;
    reasoning: string;
    competitor_benchmark: string;
    free_tier_hook: string; // Что давать бесплатно для привлечения
  };
  channels: Array<{
    channel: string;     // Instagram, LinkedIn, TikTok и т.д.
    priority: 'high' | 'medium' | 'low';
    why: string;         // Почему этот канал
    content_type: string; // Что постить
    estimated_cac: string; // Примерный CAC
    first_steps: string[]; // Конкретные первые шаги
  }>;
  ad_copies: Array<{
    platform: string;    // Под какую площадку
    headline: string;
    body: string;
    cta: string;
    target_pain: string; // Какую боль цепляет
  }>;
  launch_checklist: Array<{
    step: string;
    description: string;
    priority: 'critical' | 'important' | 'nice_to_have';
  }>;
}

interface MarketingPlanRequest {
  trend_title: string;
  trend_category?: string;
  // From Evidence
  evidence: {
    complaints?: Array<{ source: string; title: string; engagement?: number }>;
    negative_reviews?: Array<{ competitor: string; review: string }>;
    unmet_needs?: Array<{ need: string; frequency: string }>;
    pricing_data?: Array<{ competitor: string; plans?: Array<{ name: string; price: string; features?: string[] }> }>;
    demand_growth?: {
      growth_rate_12m?: number;
      search_intent?: { commercial_percent: number; intent_type: string };
      new_players_count?: number;
    };
    sellability?: {
      market_segment?: string;
      median_price?: number | null;
      competitor_prices?: Array<{ competitor: string; price: string; plan_type: string }>;
      sales_cycle?: string;
    };
    economics?: {
      estimated_cac?: number;
      ltv_cac_ratio?: number;
      business_model?: string;
    };
  };
  // From Analysis
  analysis?: {
    main_pain: string;
    key_pain_points?: string[];
    target_audience?: {
      primary: string;
      segments?: Array<{ name: string; size: string; willingness_to_pay?: string }>;
    };
  };
  // From ProductSpec
  product_spec?: {
    user_output?: { primary_output: string; value_proposition: string };
    monetization?: { model: string; pricing_tiers?: Array<{ name: string; price: string; features: string[] }> };
    derived_features?: Array<{ feature_name: string; pain_source: string; pain_quote: string; priority: string }>;
  };
  // From Differentiation
  differentiation?: {
    usp?: { full_usp: string; for_whom: string; what_does: string; how_different: string };
    competitor_weaknesses?: Array<{ competitor: string; weakness: string; opportunity: string }>;
    blue_ocean_strategy?: { create: string[]; raise: string[] };
  };
  // Project info
  project_name?: string;
  project_url?: string;
}

const MARKETING_PLAN_SYSTEM_PROMPT = `Ты Senior Marketing Strategist с 15+ лет опыта в digital marketing для стартапов и SaaS-продуктов. Твоя задача — создать КОНКРЕТНЫЙ, ДЕЙСТВЕННЫЙ маркетинговый план, который основатель стартапа может СРАЗУ начать выполнять.

## КРИТИЧЕСКИ ВАЖНО

Ты получаешь РЕАЛЬНЫЕ данные из глубокого анализа рынка:
- **Жалобы пользователей** — настоящие боли из Reddit/Quora/HackerNews
- **Негативные отзывы о конкурентах** — их слабости = наши возможности
- **Данные о спросе** — рост рынка, коммерческий интерес
- **Экономика** — CAC, цены конкурентов, медианная цена
- **Сегмент рынка** — B2B/B2C/SMB/Enterprise
- **USP и дифференциация** — уникальное позиционирование

## ПРАВИЛА

1. **pain_messaging** — КАЖДЫЙ hook ДОЛЖЕН быть основан на РЕАЛЬНОЙ жалобе из данных. Не выдумывай боли.
2. **channels** — рекомендуй каналы на основе СЕГМЕНТА РЫНКА:
   - B2B/Enterprise → LinkedIn, холодные письма, вебинары
   - B2C → Instagram, TikTok, Facebook, YouTube
   - SMB → LinkedIn + Facebook, комьюнити
   - Разработчики → Twitter/X, HackerNews, Dev.to, Reddit
3. **ad_copies** — пиши на языке целевой аудитории. Если продукт для русскоговорящих — пиши по-русски. Если международный — по-английски.
4. **pricing_strategy** — основывай на РЕАЛЬНЫХ ценах конкурентов и CAC. Не выдумывай.
5. **launch_checklist** — конкретные действия, не абстракции. "Создать аккаунт в LinkedIn и опубликовать 3 поста" вместо "настроить социальные сети".
6. **first_steps в channels** — 3-5 конкретных действий для ПЕРВОЙ НЕДЕЛИ.

## АНТИГАЛЛЮЦИНАЦИЯ
- Если данных по каналу НЕТ — честно напиши "Требует тестирования" в estimated_cac
- Не придумывай статистику, конверсии или размеры рынка
- pain_messaging.source ДОЛЖЕН соответствовать реальному источнику из данных

Верни ТОЛЬКО JSON без markdown:
{
  "target_audience": {
    "primary_segment": "Кто именно (конкретно)",
    "segment_type": "B2B|B2C|SMB|Enterprise",
    "demographic": "Возраст, должность, доход",
    "psychographic": "Мотивации, страхи, ценности",
    "where_they_hang_out": ["Площадка 1", "Площадка 2"],
    "estimated_size": "Оценка размера аудитории"
  },
  "pain_messaging": [
    {
      "pain": "Реальная боль",
      "source": "Reddit/HackerNews/etc",
      "hook": "Цепляющий рекламный заголовок",
      "description": "Текст для рекламы на 2-3 предложения"
    }
  ],
  "positioning": {
    "usp": "Уникальное торговое предложение в 1 предложение",
    "one_liner": "Продукт в 1 строку для bio/header",
    "elevator_pitch": "30 сек pitch",
    "vs_competitors": [
      {
        "competitor": "Имя",
        "their_weakness": "Их слабость",
        "our_advantage": "Наше преимущество"
      }
    ]
  },
  "pricing_strategy": {
    "recommended_model": "Модель ценообразования",
    "entry_price": "Цена входа",
    "reasoning": "Почему именно такая",
    "competitor_benchmark": "Ориентир по конкурентам",
    "free_tier_hook": "Что даём бесплатно"
  },
  "channels": [
    {
      "channel": "Название канала",
      "priority": "high|medium|low",
      "why": "Почему этот канал для нашей ЦА",
      "content_type": "Какой контент постить",
      "estimated_cac": "$X или Требует тестирования",
      "first_steps": ["Шаг 1", "Шаг 2", "Шаг 3"]
    }
  ],
  "ad_copies": [
    {
      "platform": "Площадка",
      "headline": "Заголовок",
      "body": "Текст объявления",
      "cta": "Призыв к действию",
      "target_pain": "Какую боль цепляет"
    }
  ],
  "launch_checklist": [
    {
      "step": "Действие",
      "description": "Подробнее",
      "priority": "critical|important|nice_to_have"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`marketing:${clientIP}`, RATE_LIMITS.analysis);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body: MarketingPlanRequest = await request.json();

    if (!body.trend_title) {
      return NextResponse.json(
        { success: false, error: 'Название тренда обязательно' },
        { status: 400 }
      );
    }

    console.log(`[marketing-plan] Starting for: ${body.trend_title}`);
    const startTime = Date.now();

    // Build user prompt with all available data
    const userPrompt = `Создай маркетинговый план для продукта:

## ПРОДУКТ
- **Название:** ${body.project_name || body.trend_title}
- **Категория:** ${body.trend_category || 'Technology'}
${body.product_spec?.user_output ? `- **Что делает:** ${body.product_spec.user_output.primary_output}
- **Ценность:** ${body.product_spec.user_output.value_proposition}` : ''}
${body.project_url ? `- **URL:** ${body.project_url}` : ''}

## ГЛАВНАЯ БОЛЬ РЫНКА
${body.analysis?.main_pain || 'Не определена'}
${body.analysis?.key_pain_points?.length ? `\n**Ключевые боли:**\n${body.analysis.key_pain_points.map(p => `- ${p}`).join('\n')}` : ''}

## ЦЕЛЕВАЯ АУДИТОРИЯ (из анализа)
${body.analysis?.target_audience?.primary ? `- **Основная:** ${body.analysis.target_audience.primary}` : ''}
${body.analysis?.target_audience?.segments?.length ? `- **Сегменты:**\n${body.analysis.target_audience.segments.map(s =>
  `  - ${s.name} (${s.size}, готовность платить: ${s.willingness_to_pay || 'не оценена'})`
).join('\n')}` : ''}

${body.evidence?.complaints?.length ? `## РЕАЛЬНЫЕ ЖАЛОБЫ ПОЛЬЗОВАТЕЛЕЙ
${body.evidence.complaints.slice(0, 8).map((c, i) =>
  `${i + 1}. [${c.source}] "${c.title}" (engagement: ${c.engagement || 'N/A'})`
).join('\n')}

Используй эти жалобы для pain_messaging — каждый hook должен цеплять РЕАЛЬНУЮ боль!
` : ''}
${body.evidence?.negative_reviews?.length ? `## СЛАБОСТИ КОНКУРЕНТОВ
${body.evidence.negative_reviews.slice(0, 6).map((r, i) =>
  `${i + 1}. ${r.competitor}: "${r.review}"`
).join('\n')}

Используй для vs_competitors в positioning!
` : ''}
${body.evidence?.unmet_needs?.length ? `## НЕУДОВЛЕТВОРЁННЫЕ ПОТРЕБНОСТИ
${body.evidence.unmet_needs.slice(0, 6).map((n, i) =>
  `${i + 1}. "${n.need}" (частота: ${n.frequency})`
).join('\n')}
` : ''}
${body.evidence?.sellability ? `## СЕГМЕНТ РЫНКА
- **Тип:** ${body.evidence.sellability.market_segment || 'Не определён'}
- **Медианная цена:** ${body.evidence.sellability.median_price != null ? `$${body.evidence.sellability.median_price}/мес` : 'нет данных'}
- **Цикл продаж:** ${body.evidence.sellability.sales_cycle || 'не определён'}
${body.evidence.sellability.competitor_prices?.length ? `- **Цены конкурентов:**\n${body.evidence.sellability.competitor_prices.slice(0, 5).map(p =>
  `  - ${p.competitor}: ${p.price} (${p.plan_type})`
).join('\n')}` : ''}

КРИТИЧНО: Используй сегмент для выбора каналов! B2B → LinkedIn. B2C → Instagram/TikTok.
` : ''}
${body.evidence?.economics ? `## ЭКОНОМИКА
- **CAC:** ${body.evidence.economics.estimated_cac != null ? `$${body.evidence.economics.estimated_cac}` : 'нет данных'}
- **LTV/CAC:** ${body.evidence.economics.ltv_cac_ratio || 'нет данных'}
- **Бизнес-модель рынка:** ${body.evidence.economics.business_model || 'не определена'}
` : ''}
${body.evidence?.demand_growth ? `## ДИНАМИКА СПРОСА
- **Рост за 12 мес:** ${body.evidence.demand_growth.growth_rate_12m != null ? `${body.evidence.demand_growth.growth_rate_12m}%` : 'нет данных'}
${body.evidence.demand_growth.search_intent ? `- **Коммерческий интерес:** ${body.evidence.demand_growth.search_intent.commercial_percent}% (тип: ${body.evidence.demand_growth.search_intent.intent_type})` : ''}
- **Новые игроки:** ${body.evidence.demand_growth.new_players_count ?? 'нет данных'}
` : ''}
${body.evidence?.pricing_data?.length ? `## ЦЕНООБРАЗОВАНИЕ КОНКУРЕНТОВ
${body.evidence.pricing_data.map(p =>
  `**${p.competitor}:**\n${p.plans?.map(plan =>
    `  - ${plan.name}: ${plan.price}${plan.features?.length ? ` (${plan.features.slice(0, 3).join(', ')})` : ''}`
  ).join('\n') || '  - Цены не найдены'}`
).join('\n\n')}
` : ''}
${body.differentiation?.usp ? `## USP (Уникальное Торговое Предложение)
- **Для кого:** ${body.differentiation.usp.for_whom}
- **Что делает:** ${body.differentiation.usp.what_does}
- **Чем отличается:** ${body.differentiation.usp.how_different}
- **Полный USP:** ${body.differentiation.usp.full_usp}
` : ''}
${body.differentiation?.competitor_weaknesses?.length ? `## СЛАБОСТИ КОНКУРЕНТОВ → НАШИ ВОЗМОЖНОСТИ
${body.differentiation.competitor_weaknesses.map((w, i) =>
  `${i + 1}. ${w.competitor}: "${w.weakness}" → **${w.opportunity}**`
).join('\n')}
` : ''}
${body.differentiation?.blue_ocean_strategy ? `## BLUE OCEAN — ЧТО СОЗДАТЬ НОВОГО
${body.differentiation.blue_ocean_strategy.create.map(c => `- СОЗДАТЬ: ${c}`).join('\n')}
${body.differentiation.blue_ocean_strategy.raise.map(r => `- УСИЛИТЬ: ${r}`).join('\n')}
` : ''}
${body.product_spec?.monetization ? `## МОДЕЛЬ МОНЕТИЗАЦИИ (из ProductSpec)
- **Модель:** ${body.product_spec.monetization.model}
${body.product_spec.monetization.pricing_tiers?.length ? `- **Тарифы:**\n${body.product_spec.monetization.pricing_tiers.map(t =>
  `  - ${t.name}: ${t.price} (${t.features.slice(0, 3).join(', ')})`
).join('\n')}` : ''}
` : ''}
${body.product_spec?.derived_features?.length ? `## КЛЮЧЕВЫЕ ФИЧИ ПРОДУКТА
${body.product_spec.derived_features.slice(0, 8).map((f, i) =>
  `${i + 1}. [${f.priority}] ${f.feature_name} — решает: "${f.pain_quote}"`
).join('\n')}
` : ''}

## ЗАДАЧА
Создай КОНКРЕТНЫЙ маркетинговый план. Не абстрактный — а такой, который человек может открыть завтра утром и начать выполнять по пунктам.

- pain_messaging: минимум 3-5 hooks, каждый из РЕАЛЬНОЙ жалобы
- channels: минимум 3-4 канала с приоритетами, КОНКРЕТНЫЕ первые шаги на первую неделю
- ad_copies: минимум 3 готовых объявления под разные площадки
- launch_checklist: 8-12 конкретных действий в порядке приоритета

${body.evidence?.complaints?.length || body.evidence?.negative_reviews?.length ?
  'У тебя есть РЕАЛЬНЫЕ данные — используй их!' :
  'Evidence данных мало — будь честен и помечай что "требует тестирования".'}`;

    const result = await callAgent(MARKETING_PLAN_SYSTEM_PROMPT, userPrompt, {
      maxRetries: 3,
      retryDelayMs: 1000,
      model: 'gpt-4o-mini',
    });

    if (!result.success) {
      console.error('[marketing-plan] Agent error:', result.error);
      return NextResponse.json(
        {
          success: false,
          error: formatErrorForUser(result.error),
          errorCode: result.error.code,
        },
        { status: 500 }
      );
    }

    const marketingPlan = parseJSONResponse<MarketingPlanResult>(result.content);

    if (!marketingPlan) {
      console.error('[marketing-plan] Failed to parse response:', result.content.substring(0, 500));
      return NextResponse.json(
        { success: false, error: 'Не удалось распознать ответ AI. Попробуйте ещё раз.' },
        { status: 500 }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`[marketing-plan] Completed in ${totalTime}ms, channels: ${marketingPlan.channels?.length}, ad_copies: ${marketingPlan.ad_copies?.length}`);

    return NextResponse.json({
      success: true,
      marketing_plan: marketingPlan,
      metadata: {
        total_time_ms: totalTime,
        trend_title: body.trend_title,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[marketing-plan] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка генерации маркетингового плана' },
      { status: 500 }
    );
  }
}
