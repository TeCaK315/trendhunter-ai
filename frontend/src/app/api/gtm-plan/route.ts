import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse } from '@/lib/openai';

/**
 * GTM Plan Generator
 *
 * Генерирует Go-to-Market стратегию на основе ВСЕХ Evidence данных.
 * Один AI вызов с жёстким промптом: каждое утверждение ОБЯЗАНО ссылаться на реальные данные.
 * Не делает внешних API запросов — работает только с тем, что уже собрано.
 */

interface GtmPlanResponse {
  positioning: {
    tagline: string;
    value_proposition: string;
    differentiators: Array<{
      point: string;
      vs_competitor: string;
      evidence: string;
    }>;
    target_icp: string;
  };
  acquisition_channels: {
    tier1_free: AcquisitionChannel[];
    tier2_paid: AcquisitionChannel[];
    tier3_scale: AcquisitionChannel[];
  };
  pricing_strategy: {
    model: string;
    recommended_price: string;
    reasoning: string;
    tiers: Array<{
      name: string;
      price: string;
      features: string;
      target: string;
    }>;
  };
  metrics: {
    north_star: string;
    month1: MetricTarget;
    month3: MetricTarget;
    month6: MetricTarget;
  };
  launch_phases: Array<{
    phase: string;
    duration: string;
    actions: string[];
    success_criteria: string;
  }>;
  evidence_used: {
    complaints: number;
    competitors: number;
    prices: number;
    channels: number;
    cpc_keywords: number;
  };
  generated_at: string;
}

interface AcquisitionChannel {
  channel: string;
  strategy: string;
  evidence: string;
  estimated_cac: string;
  estimated_monthly_leads: string;
  priority: 'high' | 'medium' | 'low';
}

interface MetricTarget {
  users: string;
  mrr: string;
  churn: string;
  key_action: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, evidenceData } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const problem = evidenceData?.problem || null;
    const demand = evidenceData?.demand || null;
    const sellability = evidenceData?.sellability || null;
    const occupation = evidenceData?.occupation || null;
    const economics = evidenceData?.economics || null;

    // Count available evidence
    const complaints = problem?.who_hurts?.complaints || [];
    const competitors = occupation?.competitors_exist?.competitors || [];
    const prices = sellability?.average_ticket?.competitor_prices || [];
    const cpcKeywords = economics?.cac?.keyword_cpc || [];
    const segment = sellability?.market_segment?.segment_type || 'Mixed';
    const medianPrice = sellability?.average_ticket?.median_price || null;
    const businessModel = economics?.repeat_sales?.business_model || null;
    const cacEstimate = economics?.cac?.estimated_cac?.value || null;
    const trendScore = demand?.trend_dynamics?.google_trends_interest || null;
    const growthDirection = demand?.trend_dynamics?.growth_direction || null;
    const showHnPosts = demand?.new_players?.show_hn_posts || [];
    const phLaunches = demand?.new_players?.producthunt_launches || [];

    // Build evidence summary for AI
    const evidenceSummary = buildEvidenceSummary({
      query, segment, complaints, competitors, prices, cpcKeywords,
      medianPrice, businessModel, cacEstimate, trendScore,
      growthDirection, showHnPosts, phLaunches, demand, problem,
    });

    // Check minimum evidence
    const hasComplaints = complaints.length > 0;
    const hasCompetitors = competitors.length > 0;
    const hasPricing = prices.length > 0;
    const evidenceCount = [hasComplaints, hasCompetitors, hasPricing].filter(Boolean).length;

    if (evidenceCount < 1) {
      return NextResponse.json({
        insufficient_data: true,
        message: 'Недостаточно Evidence данных для генерации GTM плана. Запустите блоки: Проблема, Конкуренция, Продажи.',
        evidence_available: { complaints: 0, competitors: 0, prices: 0 },
      });
    }

    const systemPrompt = `Ты — стратегический консультант по Go-to-Market стратегиям для SaaS/tech продуктов.

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Ты получаешь РЕАЛЬНЫЕ данные из исследования рынка. Каждое утверждение ОБЯЗАНО ссылаться на конкретные данные из Evidence.
2. ЗАПРЕЩЕНО выдумывать факты, цифры, названия компаний или рынков, которых нет в предоставленных данных.
3. Если данных недостаточно для конкретной рекомендации — напиши "Недостаточно данных" вместо галлюцинации.
4. Все каналы привлечения ДОЛЖНЫ быть обоснованы реальными данными (жалобы на платформе → канал на этой платформе).
5. Ценообразование ДОЛЖНО быть привязано к реальным ценам конкурентов, не выдумано.
6. Формат ответа: строго JSON, без markdown.`;

    const userPrompt = `Создай Go-to-Market план для продукта "${query}" на основе следующих РЕАЛЬНЫХ данных:

${evidenceSummary}

Верни СТРОГО JSON в формате:
{
  "positioning": {
    "tagline": "Короткий слоган (до 10 слов)",
    "value_proposition": "Одно предложение: что делает, для кого, почему лучше",
    "differentiators": [
      {
        "point": "Конкретное преимущество",
        "vs_competitor": "Имя конкурента из Evidence",
        "evidence": "Ссылка на конкретную жалобу/данные"
      }
    ],
    "target_icp": "Описание идеального клиента на основе сегмента и жалоб"
  },
  "acquisition_channels": {
    "tier1_free": [
      {
        "channel": "Название",
        "strategy": "Конкретная тактика",
        "evidence": "Почему этот канал — ссылка на Evidence данные",
        "estimated_cac": "$0",
        "estimated_monthly_leads": "Оценка",
        "priority": "high/medium/low"
      }
    ],
    "tier2_paid": [...],
    "tier3_scale": [...]
  },
  "pricing_strategy": {
    "model": "Модель: freemium/subscription/usage-based/etc",
    "recommended_price": "Рекомендуемая цена с обоснованием",
    "reasoning": "Почему — ссылка на медиану конкурентов и WTP данные",
    "tiers": [
      {
        "name": "Free/Starter/Pro/Enterprise",
        "price": "$X/мес",
        "features": "Ключевые фичи",
        "target": "Для кого"
      }
    ]
  },
  "metrics": {
    "north_star": "Ключевая метрика роста",
    "month1": { "users": "X", "mrr": "$X", "churn": "X%", "key_action": "Главное действие" },
    "month3": { "users": "X", "mrr": "$X", "churn": "X%", "key_action": "Главное действие" },
    "month6": { "users": "X", "mrr": "$X", "churn": "X%", "key_action": "Главное действие" }
  },
  "launch_phases": [
    {
      "phase": "Название фазы",
      "duration": "X недель",
      "actions": ["Действие 1", "Действие 2"],
      "success_criteria": "Критерий успеха"
    }
  ]
}

ВАЖНО:
- differentiators: ТОЛЬКО на основе реальных конкурентов и их слабостей из данных
- acquisition_channels: tier1_free — только бесплатные каналы (контент, community, SEO); tier2_paid — платные (ads, sponsorship); tier3_scale — масштабирование (партнёрства, marketplace)
- pricing_strategy: цены ТОЛЬКО на основе медианы конкурентов ($${medianPrice || 'нет данных'}/мес)
- metrics: реалистичные цели, не "10K users за месяц"
- Если данных мало — лучше меньше пунктов, но обоснованных`;

    const aiResult = await callAgent(systemPrompt, userPrompt, {
      maxTokens: 4000,
      temperature: 0.4,
    });

    if (!aiResult.success) {
      throw new Error(aiResult.error.message);
    }

    const gtmPlan = parseJSONResponse<any>(aiResult.content);
    if (!gtmPlan) {
      console.error('[gtm-plan] Failed to parse JSON from:', aiResult.content.substring(0, 200));
      throw new Error('Failed to parse AI response as JSON');
    }

    const result: GtmPlanResponse = {
      positioning: gtmPlan.positioning || { tagline: '', value_proposition: '', differentiators: [], target_icp: '' },
      acquisition_channels: {
        tier1_free: gtmPlan.acquisition_channels?.tier1_free || [],
        tier2_paid: gtmPlan.acquisition_channels?.tier2_paid || [],
        tier3_scale: gtmPlan.acquisition_channels?.tier3_scale || [],
      },
      pricing_strategy: gtmPlan.pricing_strategy || { model: '', recommended_price: '', reasoning: '', tiers: [] },
      metrics: gtmPlan.metrics || { north_star: '', month1: {}, month3: {}, month6: {} },
      launch_phases: gtmPlan.launch_phases || [],
      evidence_used: {
        complaints: complaints.length,
        competitors: competitors.length,
        prices: prices.length,
        channels: [
          complaints.some((c: any) => c.source === 'reddit'),
          complaints.some((c: any) => c.source === 'hacker_news'),
          showHnPosts.length > 0,
          phLaunches.length > 0,
        ].filter(Boolean).length,
        cpc_keywords: cpcKeywords.length,
      },
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[gtm-plan] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate GTM plan' },
      { status: 500 }
    );
  }
}

function buildEvidenceSummary(data: {
  query: string;
  segment: string;
  complaints: any[];
  competitors: any[];
  prices: any[];
  cpcKeywords: any[];
  medianPrice: number | null;
  businessModel: string | null;
  cacEstimate: number | null;
  trendScore: number | null;
  growthDirection: string | null;
  showHnPosts: any[];
  phLaunches: any[];
  demand: any;
  problem: any;
}): string {
  const parts: string[] = [];

  parts.push(`ПРОДУКТ: "${data.query}"`);
  parts.push(`СЕГМЕНТ: ${data.segment}`);

  // Complaints
  if (data.complaints.length > 0) {
    parts.push(`\n--- ЖАЛОБЫ ПОЛЬЗОВАТЕЛЕЙ (${data.complaints.length} шт) ---`);
    for (const c of data.complaints.slice(0, 10)) {
      const src = c.source || 'unknown';
      const eng = c.engagement > 0 ? ` [${c.engagement} реакций]` : '';
      parts.push(`- [${src}]${eng}: "${c.text?.substring(0, 150) || ''}"`);
    }
  }

  // Competitors
  if (data.competitors.length > 0) {
    parts.push(`\n--- КОНКУРЕНТЫ (${data.competitors.length} шт) ---`);
    for (const c of data.competitors.slice(0, 8)) {
      const price = c.pricing ? ` | Цена: ${c.pricing}` : '';
      const features = c.features ? ` | Фичи: ${c.features.slice(0, 3).join(', ')}` : '';
      parts.push(`- ${c.name}: ${c.description?.substring(0, 100) || 'нет описания'}${price}${features}`);
    }
  }

  // Pricing
  if (data.prices.length > 0) {
    parts.push(`\n--- ЦЕНЫ КОНКУРЕНТОВ ---`);
    for (const p of data.prices.slice(0, 8)) {
      parts.push(`- ${p.name || p.competitor}: $${p.price || p.amount}/мес`);
    }
    if (data.medianPrice) {
      parts.push(`МЕДИАНА: $${data.medianPrice}/мес`);
    }
  }

  // CPC / Ads data
  if (data.cpcKeywords.length > 0) {
    parts.push(`\n--- CPC ДАННЫЕ (${data.cpcKeywords.length} ключевых слов) ---`);
    for (const k of data.cpcKeywords.slice(0, 5)) {
      parts.push(`- "${k.keyword}": CPC $${k.cpc}`);
    }
  }

  // Economics
  if (data.businessModel) {
    parts.push(`\nБИЗНЕС-МОДЕЛЬ: ${data.businessModel}`);
  }
  if (data.cacEstimate) {
    parts.push(`ESTIMATED CAC: $${data.cacEstimate}`);
  }

  // Trend dynamics
  if (data.trendScore !== null) {
    parts.push(`\nTREND SCORE (Google Trends): ${data.trendScore}/100, direction: ${data.growthDirection || 'unknown'}`);
  }

  // New players
  if (data.showHnPosts.length > 0) {
    parts.push(`\nShow HN проектов: ${data.showHnPosts.length}`);
  }
  if (data.phLaunches.length > 0) {
    parts.push(`Product Hunt запусков: ${data.phLaunches.length}`);
  }

  // Complaint sources (for channel detection)
  const sources: Record<string, number> = {};
  for (const c of data.complaints) {
    const src = c.source?.toLowerCase() || 'unknown';
    sources[src] = (sources[src] || 0) + 1;
  }
  if (Object.keys(sources).length > 0) {
    parts.push(`\n--- ИСТОЧНИКИ ЖАЛОБ ---`);
    for (const [src, count] of Object.entries(sources)) {
      parts.push(`- ${src}: ${count} постов`);
    }
  }

  // WTP data
  const wtpData = data.problem?.willingness_to_pay;
  if (wtpData) {
    parts.push(`\n--- ГОТОВНОСТЬ ПЛАТИТЬ ---`);
    if (wtpData.pricing_data?.length > 0) {
      for (const p of wtpData.pricing_data.slice(0, 5)) {
        parts.push(`- ${p.source || 'user'}: $${p.price || p.amount}`);
      }
    }
    if (wtpData.willingness_score) {
      parts.push(`Willingness score: ${wtpData.willingness_score}/10`);
    }
  }

  return parts.join('\n');
}
