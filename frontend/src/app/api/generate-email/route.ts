import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface GenerateEmailRequest {
  company: {
    name: string;
    website: string;
    email: string;
    industry: string;
    size?: string;
    pain_match?: string;
    outreach_angle?: string;
  };
  niche: string;
  painPoint: string;
  senderName: string;
  senderCompany?: string;
  senderContact?: string;
  tone?: 'formal' | 'friendly' | 'professional';
  language?: 'ru' | 'en';
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateEmailRequest = await request.json();

    if (!body.company || !body.niche || !body.painPoint || !body.senderName) {
      return NextResponse.json(
        { success: false, error: 'Компания, ниша, боль и имя отправителя обязательны' },
        { status: 400 }
      );
    }

    const tone = body.tone || 'professional';
    const language = body.language || 'ru';

    const toneDescriptions = {
      formal: 'формальный, деловой стиль с использованием "Вы"',
      friendly: 'дружелюбный, но профессиональный стиль',
      professional: 'профессиональный стиль, сбалансированный между формальным и дружелюбным'
    };

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
            content: `Ты эксперт по B2B cold email копирайтингу с 10+ лет опыта.

Твоя задача - написать персонализированное деловое письмо потенциальному клиенту.

ПРАВИЛА:
1. Письмо должно быть коротким (150-250 слов)
2. Начни с конкретной боли/проблемы компании
3. Покажи понимание их бизнеса
4. Предложи конкретное решение без излишней саморекламы
5. Закончи одним четким call-to-action
6. Стиль: ${toneDescriptions[tone]}
7. Язык: ${language === 'ru' ? 'Русский' : 'English'}

КРИТИЧЕСКИ ВАЖНО - НЕ ЛГИ:
- НЕ выдумывай кейсы, клиентов, цифры или достижения
- НЕ пиши "мы помогли X компаниям сэкономить Y%" если это не указано в данных
- НЕ упоминай несуществующие награды, сертификаты, партнёрства
- НЕ приписывай отправителю опыт или экспертизу которой у него может не быть
- Вместо выдуманных доказательств используй:
  * Логические аргументы почему решение поможет
  * Предложение показать демо или провести бесплатный аудит
  * Вопросы для выявления текущей ситуации клиента

СТРУКТУРА ПИСЬМА:
- Subject: Цепляющая тема (5-10 слов, без кликбейта)
- Hook: Персонализированное начало про их компанию/боль
- Value: Как мы можем помочь решить эту проблему
- CTA: Один конкретный следующий шаг (звонок, демо, аудит)

Верни JSON:
{
  "subject": "Тема письма",
  "body": "Текст письма",
  "follow_up_subject": "Тема для follow-up письма",
  "follow_up_body": "Текст follow-up письма (короче, 50-100 слов)",
  "tips": ["Совет по отправке 1", "Совет 2"]
}`
          },
          {
            role: 'user',
            content: `Напиши деловое письмо для:

**Компания-получатель:**
- Название: ${body.company.name}
- Сайт: ${body.company.website}
- Email: ${body.company.email}
- Отрасль: ${body.company.industry}
${body.company.size ? `- Размер: ${body.company.size}` : ''}
${body.company.pain_match ? `- Почему им это нужно: ${body.company.pain_match}` : ''}
${body.company.outreach_angle ? `- Угол подхода: ${body.company.outreach_angle}` : ''}

**Что мы предлагаем:**
- Ниша: ${body.niche}
- Решаем проблему: ${body.painPoint}

**Отправитель:**
- Имя: ${body.senderName}
${body.senderCompany ? `- Компания: ${body.senderCompany}` : ''}
${body.senderContact ? `- Контакт: ${body.senderContact}` : ''}

Напиши персонализированное письмо, которое покажет понимание их бизнеса и предложит реальную ценность.`
          }
        ],
        temperature: 0.8,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      console.error('OpenAI API error');
      return NextResponse.json(
        { success: false, error: 'Ошибка генерации письма' },
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
          company: body.company.name,
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
    console.error('Generate email error:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
