import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Полный контекст от всех предыдущих экспертов
interface FullContext {
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
      segments?: Array<{ name: string; size: string; willingness_to_pay?: string }>;
    };
    opportunities?: string[];
  };
  sources?: {
    reddit?: {
      communities: string[];
    };
    synthesis?: {
      key_insights: string[];
      recommended_angles: string[];
    };
  };
  competition?: {
    competitors: Array<{ name: string; target_market?: string }>;
    strategic_positioning?: string;
    differentiation_opportunities?: string[];
  };
  venture?: {
    investment_hotness: number;
    investment_thesis?: string;
    recommended_round?: string;
  };
}

interface FindCompaniesRequest {
  niche: string;
  painPoint: string;
  location?: string;
  companySize?: string;
  count?: number;
  context?: FullContext;
}

export async function POST(request: NextRequest) {
  try {
    const body: FindCompaniesRequest = await request.json();

    // Получаем данные из контекста или из прямых параметров
    const context = body.context;
    const niche = body.niche || context?.trend?.title;
    const painPoint = body.painPoint || context?.analysis?.main_pain;

    if (!niche || !painPoint) {
      return NextResponse.json(
        { success: false, error: 'Ниша и боль обязательны' },
        { status: 400 }
      );
    }

    console.log(`Finding companies for: ${niche}`);
    console.log(`Context received:`, context?.venture ? 'full context' : 'partial');

    const count = body.count || 10;

    // Формируем контекст от всех предыдущих экспертов
    let contextSection = '';

    if (context?.analysis) {
      contextSection += `
## Контекст от эксперта по анализу:
- Главная боль: ${context.analysis.main_pain}
- Дополнительные боли: ${context.analysis.key_pain_points?.join(', ') || 'не определены'}
- Целевая аудитория: ${context.analysis.target_audience?.primary || 'не определена'}
- Сегменты: ${context.analysis.target_audience?.segments?.map(s => `${s.name} (${s.size}, готовность платить: ${s.willingness_to_pay || 'не оценена'})`).join('; ') || 'не определены'}
`;
    }

    if (context?.sources?.synthesis) {
      contextSection += `
## Инсайты из источников:
- Ключевые находки: ${context.sources.synthesis.key_insights?.join('; ') || 'нет'}
- Рекомендуемые углы подхода: ${context.sources.synthesis.recommended_angles?.join('; ') || 'нет'}
- Активные сообщества: ${context.sources.reddit?.communities?.join(', ') || 'нет данных'}
`;
    }

    if (context?.competition) {
      contextSection += `
## Контекст от эксперта по конкурентам:
- Наше позиционирование: ${context.competition.strategic_positioning || 'не определено'}
- Возможности для дифференциации: ${context.competition.differentiation_opportunities?.join('; ') || 'нет'}
- Целевые рынки конкурентов: ${context.competition.competitors?.map(c => c.target_market).filter(Boolean).join(', ') || 'нет данных'}
`;
    }

    if (context?.venture) {
      contextSection += `
## Контекст от эксперта по инвестициям:
- Горячесть рынка: ${context.venture.investment_hotness}/10
- Инвестиционный тезис: ${context.venture.investment_thesis || 'нет'}
`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Ты эксперт по B2B продажам и lead generation с доступом к полному контексту анализа рынка.

Твоя задача - найти РЕАЛЬНЫЕ компании, которые идеально подходят под профиль клиента на основе всех данных от предыдущих экспертов.
${contextSection}
ВАЖНО:
1. Верни ТОЛЬКО JSON без markdown форматирования
2. Предлагай РЕАЛЬНЫЕ компании, которые существуют
3. Используй контекст от предыдущих экспертов для таргетинга
4. Приоритизируй компании из сегментов с высокой готовностью платить
5. Используй рекомендуемые углы подхода из анализа источников
6. Учитывай позиционирование относительно конкурентов

Формат ответа:
{
  "companies": [
    {
      "name": "Название компании",
      "website": "https://company.com",
      "email": "contact@company.com",
      "email_pattern": "firstname.lastname@company.com",
      "industry": "Отрасль",
      "size": "10-50 сотрудников",
      "location": "Город, Страна",
      "relevance_score": 9,
      "pain_match": "Почему эта компания испытывает указанную боль (на основе контекста)",
      "segment_match": "Какому сегменту из анализа соответствует",
      "decision_makers": [
        {
          "role": "CEO/CTO/Marketing Director",
          "likely_email_format": "firstname@company.com"
        }
      ],
      "outreach_angle": "Рекомендация как обратиться (из контекста источников)",
      "differentiation_pitch": "Почему мы лучше конкурентов для этой компании",
      "linkedin_search_query": "Запрос для поиска ЛПР в LinkedIn"
    }
  ],
  "search_tips": [
    "Совет по поиску дополнительных компаний"
  ],
  "linkedin_queries": [
    "Запрос для LinkedIn Sales Navigator"
  ],
  "directories": [
    {
      "name": "Название каталога",
      "url": "Ссылка",
      "description": "Описание"
    }
  ],
  "outreach_sequence": [
    "Шаг 1: ...",
    "Шаг 2: ..."
  ]
}`
          },
          {
            role: 'user',
            content: `Найди ${count} потенциальных клиентов (компаний) для следующего предложения:

**Ниша:** ${niche}
**Проблема, которую мы решаем:** ${painPoint}
${body.location ? `**Локация:** ${body.location}` : ''}
${body.companySize ? `**Размер компании:** ${body.companySize}` : ''}

Используй весь контекст от предыдущих экспертов для точного таргетинга.
Приоритизируй компании из сегментов с высокой готовностью платить.`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error');
      return NextResponse.json(
        { success: false, error: 'Ошибка AI поиска' },
        { status: 500 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);

        return NextResponse.json({
          success: true,
          ...data,
          niche,
          painPoint,
          context_received: !!context?.venture,
          timestamp: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Failed to parse AI response:', e);
    }

    return NextResponse.json(
      { success: false, error: 'Не удалось обработать ответ AI' },
      { status: 500 }
    );

  } catch (error) {
    console.error('Find companies error:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
