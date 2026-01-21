import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse, formatErrorForUser, type OpenAIError } from '@/lib/openai';

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

  // Метаданные
  confidence_score: number;
  generation_approach: 'ai-tool' | 'calculator' | 'dashboard' | 'automation' | 'marketplace' | 'content-platform';
  mvp_complexity: 'simple' | 'medium' | 'complex';
}

// System prompt для генерации Product Specification
const PRODUCT_SPEC_PROMPT = `Ты Senior Product Manager с 15+ лет опыта в стартапах. Твоя задача - создать ПОЛНУЮ СПЕЦИФИКАЦИЮ ПРОДУКТА на основе анализа тренда и болей.

Ты должен ДУМАТЬ КАК ИНЖЕНЕР: конкретно, технически, с примерами.

ПРАВИЛА:
1. user_output - ЧТО КОНКРЕТНО получает пользователь? Не абстрактно "решение", а конкретный артефакт
2. user_input - ЧТО КОНКРЕТНО вводит пользователь? Какие поля, какой формат?
3. user_flow - ПОШАГОВО что видит пользователь от открытия до получения ценности
4. magic_location - ГДЕ происходит магия? AI анализ? Формула? Агрегация данных?
5. technical_requirements - Какие API нужны? Нужна ли БД? Нужна ли авторизация?
6. monetization - Freemium или платно? Почему?
7. current_user_solution - Как люди решают эту проблему СЕЙЧАС?

ВАЖНО:
- Будь КОНКРЕТЕН. "Отчёт на 3 страницы с графиками" вместо "результат анализа"
- Думай о МИНИМАЛЬНОМ MVP - что можно сделать за 1-2 недели?
- Учитывай бюджет $0-100/мес на инфраструктуру
- generation_approach должен точно соответствовать типу продукта

Верни ТОЛЬКО JSON без markdown:
{
  "user_output": {
    "primary_output": "Конкретное описание что получает пользователь",
    "output_format": "text|report|score|list|visualization|recommendation|action",
    "example": "Пример конкретного output",
    "value_proposition": "Почему это ценно для пользователя"
  },
  "user_input": {
    "primary_input": "Описание главного ввода",
    "input_type": "text|url|file|form|selection|voice|image",
    "required_fields": [
      {
        "name": "field_name",
        "type": "string|number|url|email|file",
        "description": "Для чего это поле",
        "example": "Пример значения"
      }
    ],
    "optional_fields": []
  },
  "user_flow": {
    "steps": [
      {
        "step_number": 1,
        "action": "Что делает пользователь",
        "user_sees": "Что видит на экране",
        "time_to_complete": "~30 сек"
      }
    ],
    "total_time_to_value": "< 2 минут",
    "aha_moment": "Момент когда пользователь понимает ценность"
  },
  "magic_location": {
    "type": "ai_analysis|ai_generation|formula_calculation|data_aggregation|api_orchestration|pattern_matching",
    "description": "Где происходит основная ценность",
    "technical_approach": "Как это реализовать технически",
    "ai_prompt_hint": "Примерный prompt для AI если используется"
  },
  "technical_requirements": {
    "apis_needed": [
      {
        "name": "OpenAI API",
        "purpose": "Для чего",
        "free_tier_available": true,
        "estimated_cost": "$5-20/мес"
      }
    ],
    "database_required": false,
    "database_reason": "Причина если нужна",
    "auth_required": false,
    "auth_reason": "Причина если нужна",
    "recommended_stack": {
      "frontend": "Next.js + Tailwind",
      "backend": "Next.js API Routes",
      "database": "PostgreSQL если нужна",
      "ai_provider": "OpenAI если нужен"
    }
  },
  "monetization": {
    "model": "freemium|subscription|pay_per_use|one_time|free_with_ads|enterprise",
    "free_tier_limits": "5 запросов/день",
    "pricing_tiers": [
      {
        "name": "Pro",
        "price": "$9.99/мес",
        "features": ["Безлимитные запросы", "Экспорт"]
      }
    ],
    "reasoning": "Почему такая модель"
  },
  "current_user_solution": {
    "how_they_solve_now": "Как решают проблему сейчас",
    "pain_points_with_current": ["Боль 1", "Боль 2"],
    "our_advantage": "Наше преимущество",
    "switching_cost": "low|medium|high"
  },
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

---

На основе этих данных создай ПОЛНУЮ спецификацию продукта.
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

    const totalTime = Date.now() - startTime;
    console.log(`[product-spec] Completed in ${totalTime}ms`);

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
