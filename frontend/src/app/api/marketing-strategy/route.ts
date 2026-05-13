import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface MarketingStrategyRequest {
  budget: number;
  project_name: string;
  target_audience: string;
  segments: Array<{ name: string; size: string; willingness_to_pay?: string }>;
  main_pain: string;
  competitors: Array<{ name: string; website?: string }>;
}

interface MarketingChannel {
  name: string;
  budget: string;
  roi: string;
  priority: string;
  tactics: string[];
}

interface MarketingStrategy {
  channels: MarketingChannel[];
  timeline: string;
  keyMetrics: string[];
  recommendations: string[];
  totalBudget: string;
  expectedResults: string;
}

async function generateMarketingStrategy(input: MarketingStrategyRequest): Promise<MarketingStrategy> {
  const { budget, project_name, target_audience, segments, main_pain, competitors } = input;

  // Если нет API ключа, возвращаем дефолтную стратегию
  if (!OPENAI_API_KEY) {
    return getDefaultStrategy(budget);
  }

  const budgetTier = budget <= 100 ? 'micro' : budget <= 500 ? 'small' : budget <= 2000 ? 'medium' : 'large';

  const prompt = `Ты эксперт по маркетингу для стартапов. Создай маркетинговую стратегию для проекта.

ВХОДНЫЕ ДАННЫЕ:
- Название проекта: ${project_name}
- Месячный бюджет: $${budget}
- Бюджетная категория: ${budgetTier}
- Целевая аудитория: ${target_audience}
- Сегменты: ${segments.map(s => `${s.name} (${s.size})`).join(', ') || 'не определены'}
- Главная боль: ${main_pain}
- Конкуренты: ${competitors.map(c => c.name).join(', ') || 'нет данных'}

ВАЖНО:
1. Стратегия должна быть реалистичной для бюджета $${budget}/мес
2. Для маленьких бюджетов (<$500) фокус на органике и бесплатных каналах
3. Для средних ($500-2000) добавь платную рекламу
4. Для больших (>$2000) полноценный медиа-микс
5. Приоритизируй каналы по ROI для этого типа аудитории

Верни JSON:
{
  "channels": [
    {
      "name": "Название канала",
      "budget": "$X/мес",
      "roi": "Ожидаемый ROI (например: 3x)",
      "priority": "high/medium/low",
      "tactics": ["Конкретная тактика 1", "Тактика 2"]
    }
  ],
  "timeline": "Описание временной шкалы запуска",
  "keyMetrics": ["Метрика 1", "Метрика 2"],
  "recommendations": ["Рекомендация 1", "Рекомендация 2"],
  "totalBudget": "$${budget}/мес",
  "expectedResults": "Ожидаемые результаты за первые 3 месяца"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return getDefaultStrategy(budget);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Marketing strategy generation error:', error);
  }

  return getDefaultStrategy(budget);
}

function getDefaultStrategy(budget: number): MarketingStrategy {
  if (budget <= 100) {
    return {
      channels: [
        {
          name: 'Content Marketing',
          budget: '$0',
          roi: '5x (долгосрочно)',
          priority: 'high',
          tactics: ['SEO-оптимизированный блог', 'Guest posting', 'LinkedIn статьи'],
        },
        {
          name: 'Community Building',
          budget: '$0',
          roi: '3x',
          priority: 'high',
          tactics: ['Reddit участие', 'Discord/Slack communities', 'Twitter/X engagement'],
        },
        {
          name: 'Email Marketing',
          budget: '$0-50',
          roi: '4x',
          priority: 'medium',
          tactics: ['Mailchimp free tier', 'Lead magnets', 'Welcome sequence'],
        },
      ],
      timeline: 'Месяц 1: Контент + Community. Месяц 2-3: Email + SEO результаты',
      keyMetrics: ['Органический трафик', 'Email подписчики', 'Community engagement'],
      recommendations: [
        'Фокус на 1-2 каналах максимум',
        'Использовать бесплатные инструменты',
        'Личный бренд основателя как главный актив',
      ],
      totalBudget: `$${budget}/мес`,
      expectedResults: '100-500 посетителей/мес, 50-100 email подписчиков',
    };
  }

  if (budget <= 500) {
    return {
      channels: [
        {
          name: 'Content Marketing',
          budget: '$100',
          roi: '5x',
          priority: 'high',
          tactics: ['SEO-контент', 'Video content', 'Инфографики'],
        },
        {
          name: 'Social Media Ads',
          budget: '$200',
          roi: '2-3x',
          priority: 'high',
          tactics: ['Facebook/Instagram ads', 'LinkedIn ads (B2B)', 'Ретаргетинг'],
        },
        {
          name: 'Email Marketing',
          budget: '$50',
          roi: '4x',
          priority: 'medium',
          tactics: ['ConvertKit/Mailchimp', 'Автоматические воронки', 'A/B тесты'],
        },
        {
          name: 'Influencer Outreach',
          budget: '$150',
          roi: '3x',
          priority: 'medium',
          tactics: ['Micro-influencers', 'Product seeding', 'Affiliate deals'],
        },
      ],
      timeline: 'Месяц 1: Ads тесты. Месяц 2: Масштабирование работающего. Месяц 3: Influencer кампания',
      keyMetrics: ['CAC (Customer Acquisition Cost)', 'CTR', 'Conversion rate', 'LTV/CAC ratio'],
      recommendations: [
        'Тестировать разные аудитории в рекламе',
        'Создать 3-5 вариантов креативов',
        'Установить пиксели ретаргетинга с первого дня',
      ],
      totalBudget: `$${budget}/мес`,
      expectedResults: '500-2000 посетителей/мес, 50-200 лидов, 5-20 клиентов',
    };
  }

  // $500+
  return {
    channels: [
      {
        name: 'Paid Social',
        budget: `$${Math.round(budget * 0.35)}`,
        roi: '2.5-4x',
        priority: 'high',
        tactics: ['Facebook/Instagram', 'LinkedIn (B2B)', 'TikTok (молодая аудитория)', 'Lookalike audiences'],
      },
      {
        name: 'Google Ads',
        budget: `$${Math.round(budget * 0.25)}`,
        roi: '3-5x',
        priority: 'high',
        tactics: ['Search ads', 'Display remarketing', 'YouTube pre-roll'],
      },
      {
        name: 'Content + SEO',
        budget: `$${Math.round(budget * 0.15)}`,
        roi: '5x (долгосрочно)',
        priority: 'medium',
        tactics: ['Контент-план', 'Link building', 'Technical SEO'],
      },
      {
        name: 'Influencer Marketing',
        budget: `$${Math.round(budget * 0.15)}`,
        roi: '2-4x',
        priority: 'medium',
        tactics: ['Sponsored posts', 'Product reviews', 'Affiliate partnerships'],
      },
      {
        name: 'Email & CRM',
        budget: `$${Math.round(budget * 0.1)}`,
        roi: '4-6x',
        priority: 'high',
        tactics: ['Automation flows', 'Segmentation', 'Win-back campaigns'],
      },
    ],
    timeline: 'Месяц 1: Запуск всех каналов. Месяц 2: Оптимизация на основе данных. Месяц 3: Масштабирование топ-каналов',
    keyMetrics: ['ROAS', 'CAC', 'LTV', 'MRR from marketing', 'Attribution по каналам'],
    recommendations: [
      'Внедрить multi-touch attribution',
      'A/B тестировать landing pages',
      'Создать контент-календарь на 3 месяца',
      'Настроить ежедневный мониторинг метрик',
    ],
    totalBudget: `$${budget}/мес`,
    expectedResults: `${Math.round(budget * 5)}-${Math.round(budget * 15)} посетителей/мес, ${Math.round(budget * 0.5)}-${Math.round(budget * 2)} лидов, ${Math.round(budget * 0.05)}-${Math.round(budget * 0.2)} клиентов`,
  };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { budget, project_name, target_audience, segments, main_pain, competitors } = body;

    if (!budget || budget < 0) {
      return NextResponse.json(
        { success: false, error: 'Valid budget is required' },
        { status: 400 }
      );
    }

    console.log(`Generating marketing strategy for ${project_name} with budget $${budget}/month`);

    const strategy = await generateMarketingStrategy({
      budget,
      project_name: project_name || 'MVP Project',
      target_audience: target_audience || '',
      segments: segments || [],
      main_pain: main_pain || '',
      competitors: competitors || [],
    });

    return NextResponse.json({
      success: true,
      strategy,
    });
  } catch (error) {
    console.error('Marketing strategy API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
