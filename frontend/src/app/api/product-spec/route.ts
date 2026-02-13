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
const PRODUCT_SPEC_PROMPT = `Ты Senior Product Manager с 15+ лет опыта в стартапах. Твоя задача - создать ПОЛНУЮ СПЕЦИФИКАЦИЮ ПРОДУКТА на основе РЕАЛЬНЫХ ДАННЫХ анализа.

## КРИТИЧЕСКИ ВАЖНО: FEATURE EXTRACTION
Ты получаешь РЕАЛЬНЫЕ данные из анализа рынка:
- **complaints** - реальные жалобы пользователей с Reddit/Quora/HackerNews
- **negative_reviews** - негативные отзывы о конкурентах
- **unmet_needs** - неудовлетворённые потребности рынка
- **pricing_data** - цены конкурентов

ТВОЯ ГЛАВНАЯ ЗАДАЧА: Извлечь из этих данных КОНКРЕТНЫЕ ФИЧИ для MVP!

Пример логики:
- Жалоба: "SonarQube слишком сложный для малых команд" → Фича: "Simple Mode - 3 клика до первого сканирования"
- Негативный отзыв: "CodeClimate не поддерживает Python 3.12" → Фича: "Поддержка Python 3.12 из коробки"
- Unmet need: "Хочу интеграцию с GitLab" → Фича: "Нативная интеграция GitLab + GitHub"
- Pricing: "Конкуренты берут $30/user" → Pricing: "$5/user или freemium"

ПРАВИЛА:
1. user_output - ЧТО КОНКРЕТНО получает пользователь? Не абстрактно "решение", а конкретный артефакт
2. user_input - ЧТО КОНКРЕТНО вводит пользователь? Какие поля, какой формат?
3. user_flow - ПОШАГОВО что видит пользователь от открытия до получения ценности
4. magic_location - ГДЕ происходит магия? AI анализ? Формула? Агрегация данных?
5. technical_requirements - Какие API нужны? Нужна ли БД? Нужна ли авторизация?
6. monetization - Freemium или платно? СМОТРИ НА ЦЕНЫ КОНКУРЕНТОВ и выбирай конкурентную стратегию
7. current_user_solution - Как люди решают эту проблему СЕЙЧАС? Используй complaints!
8. derived_features - НОВОЕ ПОЛЕ: список фич, выведенных из конкретных болей

ВАЖНО:
- Каждая фича должна РЕШАТЬ конкретную боль из данных
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
  "derived_features": [
    {
      "feature_name": "Название фичи",
      "pain_source": "Откуда пришла боль (complaint/review/need)",
      "pain_quote": "Цитата из данных",
      "solution": "Как мы решаем",
      "priority": "must_have|should_have|nice_to_have",
      "implementation_hint": "Как реализовать технически"
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
---

## ТВОЯ ЗАДАЧА

1. Проанализируй ВСЕ данные выше
2. Выведи из каждой жалобы/отзыва/потребности КОНКРЕТНУЮ ФИЧУ
3. Заполни derived_features массив с указанием источника боли
4. Используй цены конкурентов для конкурентного pricing
5. Создай MVP который РЕШАЕТ выявленные боли, а не generic шаблон

${body.evidence?.complaints?.length || body.evidence?.negative_reviews?.length ?
  'У тебя есть РЕАЛЬНЫЕ данные - используй их для создания УНИКАЛЬНОГО продукта!' :
  'Данные Evidence не переданы - создай спецификацию на основе анализа.'}
${body.design_analysis?.generated_design ? 'ВАЖНО: Используй УКАЗАННУЮ выше дизайн-систему в своей спецификации.' : ''}
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
          extractedFeatures.push({
            feature_name: `Решение боли #${i + 1}`,
            pain_source: 'complaint',
            pain_quote: complaint.title,
            solution: `Функционал для решения: ${complaint.title.substring(0, 100)}`,
            priority: i === 0 ? 'must_have' : 'should_have',
            implementation_hint: `Based on ${complaint.source} feedback - needs real implementation`,
          });
        });
      }

      // 2. Извлекаем из негативных отзывов о конкурентах
      if (body.evidence?.negative_reviews?.length) {
        body.evidence.negative_reviews.slice(0, 2).forEach((review) => {
          extractedFeatures.push({
            feature_name: `Преимущество над ${review.competitor}`,
            pain_source: 'negative_review',
            pain_quote: review.review,
            solution: `Сделать лучше чем ${review.competitor}: ${review.review.substring(0, 80)}`,
            priority: 'should_have',
            implementation_hint: `Competitive advantage feature - real API/integration needed`,
          });
        });
      }

      // 3. Извлекаем из неудовлетворённых потребностей
      if (body.evidence?.unmet_needs?.length) {
        body.evidence.unmet_needs.slice(0, 2).forEach((need) => {
          extractedFeatures.push({
            feature_name: `Рыночная потребность`,
            pain_source: 'unmet_need',
            pain_quote: need.need,
            solution: `Реализовать: ${need.need}`,
            priority: need.frequency === 'high' ? 'must_have' : 'should_have',
            implementation_hint: `Market demand feature - ${need.source || 'analysis based'}`,
          });
        });
      }

      // 4. Если ничего нет — создаём из основного анализа
      if (extractedFeatures.length === 0 && body.analysis) {
        extractedFeatures.push({
          feature_name: 'Решение главной боли',
          pain_source: 'synthesis',
          pain_quote: body.analysis.main_pain,
          solution: productSpec.user_output?.value_proposition || `Инструмент для: ${body.analysis.main_pain}`,
          priority: 'must_have',
          implementation_hint: 'Core value proposition - requires real working implementation',
        });

        // Добавляем из key_pain_points
        body.analysis.key_pain_points?.slice(0, 2).forEach((pain, i) => {
          extractedFeatures.push({
            feature_name: `Дополнительная фича ${i + 1}`,
            pain_source: 'synthesis',
            pain_quote: pain,
            solution: `Функционал для: ${pain}`,
            priority: 'should_have',
            implementation_hint: 'Supporting feature with data persistence',
          });
        });
      }

      productSpec.derived_features = extractedFeatures;
      console.log(`[product-spec] Extracted ${extractedFeatures.length} features from Evidence data`);
    } else {
      console.log(`[product-spec] AI generated ${productSpec.derived_features.length} derived_features`);
    }

    // Валидация: derived_features ДОЛЖНЫ быть заполнены
    if (!productSpec.derived_features || productSpec.derived_features.length === 0) {
      console.warn('[product-spec] WARNING: No derived_features after all extraction attempts!');
      // Создаём минимальную фичу чтобы система работала
      productSpec.derived_features = [{
        feature_name: 'Core Functionality',
        pain_source: 'synthesis',
        pain_quote: body.analysis.main_pain,
        solution: 'Main product functionality solving the core pain',
        priority: 'must_have',
        implementation_hint: 'Implement with real API calls, no mocks or placeholders',
      }];
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
