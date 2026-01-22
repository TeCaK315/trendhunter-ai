import { NextRequest, NextResponse } from 'next/server';
import { callAIJson, isAIConfigured } from '@/lib/ai';

interface GenerateImprovementsRequest {
  trend_title: string;
  trend_category: string;
  main_pain: string;
  key_pain_points: string[];
  target_audience: string;
  why_trending?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateImprovementsRequest = await request.json();

    if (!body.trend_title || !body.main_pain) {
      return NextResponse.json(
        { success: false, error: 'Название тренда и боль обязательны' },
        { status: 400 }
      );
    }

    if (!isAIConfigured()) {
      return NextResponse.json(
        { success: false, error: 'API ключ не настроен. Добавьте OPENAI_API_KEY в Environment Variables.' },
        { status: 500 }
      );
    }

    const systemPrompt = `Ты Senior Product Manager и Full-Stack Developer с 15+ лет опыта создания успешных стартапов.

Твоя задача - создать детальный план улучшений для MVP, который можно скопировать в Claude Code для реализации.

ВАЖНО: Верни ТОЛЬКО JSON без markdown форматирования.

Формат ответа:
{
  "product_vision": {
    "one_liner": "Краткое описание продукта в одном предложении",
    "value_proposition": "Уникальное ценностное предложение",
    "success_metrics": ["метрика 1", "метрика 2", "метрика 3"]
  },
  "functionality_improvements": [
    {
      "title": "Название улучшения",
      "description": "Описание что нужно сделать",
      "priority": "high|medium|low",
      "complexity": "simple|medium|complex",
      "user_story": "Как [роль], я хочу [действие], чтобы [результат]",
      "acceptance_criteria": ["критерий 1", "критерий 2"],
      "claude_prompt": "Готовый промпт для Claude Code чтобы реализовать это улучшение"
    }
  ],
  "ux_improvements": [
    {
      "title": "UX улучшение",
      "current_problem": "Текущая проблема",
      "proposed_solution": "Предлагаемое решение",
      "impact": "high|medium|low",
      "claude_prompt": "Промпт для Claude Code"
    }
  ],
  "ai_agent_prompts": {
    "customer_support": {
      "name": "Support Agent",
      "description": "Агент для поддержки клиентов",
      "system_prompt": "Полный system prompt для AI агента",
      "example_interactions": ["пример 1", "пример 2"]
    },
    "sales_assistant": {
      "name": "Sales Agent",
      "description": "Агент для продаж",
      "system_prompt": "Полный system prompt",
      "example_interactions": ["пример 1", "пример 2"]
    },
    "content_generator": {
      "name": "Content Agent",
      "description": "Агент для генерации контента",
      "system_prompt": "Полный system prompt",
      "example_interactions": ["пример 1", "пример 2"]
    }
  },
  "technical_improvements": [
    {
      "area": "Backend|Frontend|Database|DevOps",
      "title": "Техническое улучшение",
      "description": "Описание",
      "claude_prompt": "Промпт для реализации"
    }
  ],
  "monetization_suggestions": [
    {
      "model": "freemium|subscription|one-time|usage-based",
      "price_points": [{"tier": "Free", "price": "$0", "features": []}, ...],
      "implementation_prompt": "Промпт для Claude Code"
    }
  ],
  "quick_wins": [
    {
      "title": "Быстрая победа",
      "time_estimate": "1-2 часа",
      "impact": "high|medium",
      "claude_prompt": "Промпт"
    }
  ],
  "full_implementation_prompt": "Большой промпт который можно скопировать в Claude Code для полной реализации всех улучшений"
}`;

    const userMessage = `Создай детальный план улучшений для MVP проекта:

**Название:** ${body.trend_title}
**Категория:** ${body.trend_category}
**Главная проблема:** ${body.main_pain}
**Боли пользователей:** ${body.key_pain_points?.join(', ') || body.main_pain}
**Целевая аудитория:** ${body.target_audience || 'Не указана'}
${body.why_trending ? `**Почему актуально:** ${body.why_trending}` : ''}

Сфокусируйся на:
1. Функциональных улучшениях которые решают реальные боли
2. UX улучшениях для повышения конверсии
3. AI агентах которые автоматизируют рутину
4. Технических улучшениях для масштабирования
5. Промптах для Claude Code которые можно сразу использовать

Каждый промпт должен быть детальным и готовым к использованию.`;

    const result = await callAIJson(systemPrompt, userMessage, {
      temperature: 0.8,
      maxTokens: 6000
    });

    if (!result.success || !result.data) {
      return NextResponse.json(
        { success: false, error: result.error || 'Ошибка генерации плана' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      improvements: result.data,
      trend_title: body.trend_title,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Generate improvements error:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
