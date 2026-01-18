import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface NicheResearchRequest {
  niche: string;
  description: string;
  targetAudience?: string;
  existingProblems?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: NicheResearchRequest = await request.json();

    if (!body.niche || !body.description) {
      return NextResponse.json(
        { success: false, error: 'Ниша и описание обязательны' },
        { status: 400 }
      );
    }

    // Call OpenAI to analyze the niche
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
            content: `Ты эксперт по анализу рынка и выявлению бизнес-возможностей.
Проанализируй указанную нишу и верни детальный анализ.

ВАЖНО: Верни ответ ТОЛЬКО в формате JSON без markdown форматирования.

Формат ответа:
{
  "niche_analysis": {
    "market_size": "описание размера рынка",
    "growth_trend": "растущий/стабильный/падающий",
    "competition_level": "низкий/средний/высокий",
    "entry_barriers": "описание барьеров входа"
  },
  "pain_points": [
    {
      "pain": "описание боли",
      "severity": 8,
      "frequency": "часто/иногда/редко"
    }
  ],
  "target_segments": [
    {
      "name": "название сегмента",
      "size": "размер аудитории",
      "willingness_to_pay": "high/medium/low",
      "where_to_find": "где найти этих клиентов",
      "communication_channels": ["канал1", "канал2"]
    }
  ],
  "opportunities": [
    {
      "opportunity": "описание возможности",
      "potential_revenue": "потенциальный доход",
      "implementation_difficulty": "легко/средне/сложно",
      "time_to_market": "срок выхода на рынок"
    }
  ],
  "competitors": [
    {
      "name": "название конкурента",
      "website": "сайт если известен",
      "strengths": ["сильная сторона"],
      "weaknesses": ["слабая сторона"],
      "pricing": "ценообразование"
    }
  ],
  "recommended_solutions": [
    {
      "type": "SaaS/мобильное приложение/автоматизация/консалтинг",
      "description": "описание решения",
      "mvp_features": ["фича1", "фича2"],
      "estimated_cost": "примерная стоимость разработки",
      "monetization": "модель монетизации"
    }
  ],
  "keywords_for_research": ["ключевое слово 1", "ключевое слово 2"],
  "subreddits": ["subreddit1", "subreddit2"],
  "overall_score": {
    "opportunity": 8,
    "pain_severity": 7,
    "feasibility": 6,
    "profit_potential": 7
  }
}`
          },
          {
            role: 'user',
            content: `Проанализируй нишу:

**Ниша:** ${body.niche}

**Описание проблемы/бизнеса заказчика:** ${body.description}

${body.targetAudience ? `**Целевая аудитория:** ${body.targetAudience}` : ''}

${body.existingProblems ? `**Известные проблемы:** ${body.existingProblems}` : ''}

Проведи глубокий анализ этой ниши. Найди реальные боли, потенциальных клиентов, конкурентов и возможности. Дай конкретные рекомендации по решениям.`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error');
      return NextResponse.json(
        { success: false, error: 'Ошибка AI анализа' },
        { status: 500 }
      );
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || '';

    try {
      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);

        // Save to localStorage via response (client will handle)
        return NextResponse.json({
          success: true,
          analysis,
          niche: body.niche,
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
    console.error('Niche research error:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
