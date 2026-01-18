import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface FindCompaniesRequest {
  niche: string;
  painPoint: string;
  location?: string;
  companySize?: string;
  count?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: FindCompaniesRequest = await request.json();

    if (!body.niche || !body.painPoint) {
      return NextResponse.json(
        { success: false, error: 'Ниша и боль обязательны' },
        { status: 400 }
      );
    }

    const count = body.count || 10;

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
            content: `Ты эксперт по B2B продажам и lead generation.
Твоя задача - найти реальные компании, которые потенциально могут быть заинтересованы в решении указанной проблемы.

ВАЖНО:
1. Верни ТОЛЬКО JSON без markdown форматирования
2. Предлагай РЕАЛЬНЫЕ компании, которые существуют
3. Если точный email неизвестен, предложи шаблон (например: info@company.com или формат firstname@company.com)
4. Приоритизируй компании по вероятности конверсии

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
      "pain_match": "Почему эта компания испытывает указанную боль",
      "decision_makers": [
        {
          "role": "CEO/CTO/Marketing Director",
          "likely_email_format": "firstname@company.com"
        }
      ],
      "outreach_angle": "Рекомендация как обратиться",
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
  ]
}`
          },
          {
            role: 'user',
            content: `Найди ${count} потенциальных клиентов (компаний) для следующего предложения:

**Ниша:** ${body.niche}
**Проблема, которую мы решаем:** ${body.painPoint}
${body.location ? `**Локация:** ${body.location}` : ''}
${body.companySize ? `**Размер компании:** ${body.companySize}` : ''}

Найди реальные компании, которые:
1. Работают в этой нише
2. Вероятно испытывают эту боль
3. Имеют бюджет на решение
4. Принимают решения относительно быстро

Приоритизируй компании по вероятности конверсии.`
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
          niche: body.niche,
          painPoint: body.painPoint,
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
