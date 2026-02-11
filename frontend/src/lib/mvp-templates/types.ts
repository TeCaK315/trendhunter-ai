/**
 * MVP Template Types
 *
 * Типы и интерфейсы для системы генерации рабочих MVP
 */

// Типы MVP на основе анализа боли
export type MVPType = 'ai-tool' | 'calculator' | 'dashboard' | 'landing-waitlist';

export interface MVPTypeDefinition {
  id: MVPType;
  name: string;
  nameRu: string;
  description: string;
  descriptionRu: string;
  icon: string;
  keywords: string[]; // Ключевые слова для автоматического определения
  features: string[];
  techStack: string[];
  complexity: 'low' | 'medium' | 'high';
  generationTime: string; // Примерное время генерации
}

/**
 * Product Specification - AI-сгенерированные гипотезы о продукте
 * Создаётся ПОСЛЕ анализа болей и ПЕРЕД генерацией кода
 */
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

  // Design System (from background analysis)
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

  // NEW: Features derived from real pain data (complaints, reviews, unmet needs)
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

// Полный контекст анализа для генерации MVP
export interface MVPGenerationContext {
  trend: {
    id?: string;
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
        where_to_find?: string;
      }>;
    };
    opportunities?: string[];
    risks?: string[];
  };
  sources?: {
    reddit?: {
      communities?: string[];
    };
    google_trends?: {
      related_queries?: Array<{ query: string }>;
    };
    synthesis?: {
      key_insights?: string[];
      content_gaps?: string[];
    };
  };
  competition?: {
    competitors?: Array<{
      name: string;
      website?: string;
      description?: string;
    }>;
    strategic_positioning?: string;
    differentiation_opportunities?: string[];
  };
  pitch?: {
    company_name?: string;
    tagline?: string;
  };
  // NEW: Product Specification - AI-гипотезы о продукте
  productSpec?: ProductSpecification;
}

// Результат генерации MVP
export interface MVPGenerationResult {
  mvpType: MVPType;
  projectName: string;
  files: Record<string, string>;
  readme: string;
  envExample: string;
  features: string[];
  setupInstructions: string[];
}

// Конфигурация для AI Tool MVP
export interface AIToolConfig {
  toolName: string;
  toolDescription: string;
  inputType: 'text' | 'url' | 'file' | 'form';
  inputPlaceholder: string;
  systemPrompt: string;
  outputFormat: 'text' | 'json' | 'list' | 'table';
  exampleInput?: string;
  exampleOutput?: string;
}

// Конфигурация для Calculator MVP
export interface CalculatorConfig {
  calculatorName: string;
  calculatorDescription: string;
  fields: Array<{
    name: string;
    label: string;
    type: 'number' | 'select' | 'text' | 'range';
    placeholder?: string;
    options?: string[]; // Для select
    min?: number;
    max?: number;
    defaultValue?: string | number;
  }>;
  formula?: string; // Описание логики расчёта
  resultFields: Array<{
    name: string;
    label: string;
    format: 'currency' | 'percent' | 'number' | 'text';
  }>;
}

// Конфигурация для Dashboard MVP
export interface DashboardConfig {
  dashboardName: string;
  dashboardDescription: string;
  dataSources: Array<{
    name: string;
    type: 'api' | 'scrape' | 'rss' | 'manual';
    url?: string;
    refreshInterval?: number; // в минутах
  }>;
  metrics: Array<{
    name: string;
    label: string;
    type: 'number' | 'chart' | 'list' | 'status';
  }>;
  filters?: Array<{
    name: string;
    label: string;
    type: 'select' | 'date' | 'search';
    options?: string[];
  }>;
}

// Конфигурация для Landing + Waitlist MVP
export interface LandingConfig {
  productName: string;
  tagline: string;
  problemStatement: string;
  solutionBenefits: string[];
  ctaText: string;
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
}

// Все определения типов MVP
export const mvpTypeDefinitions: MVPTypeDefinition[] = [
  {
    id: 'ai-tool',
    name: 'AI Tool',
    nameRu: 'AI Инструмент',
    description: 'Interactive AI-powered tool with text/URL input and intelligent analysis',
    descriptionRu: 'Интерактивный AI-инструмент с вводом текста/URL и интеллектуальным анализом',
    icon: '🤖',
    keywords: [
      'анализ', 'analysis', 'текст', 'text', 'отзывы', 'reviews', 'feedback',
      'генерация', 'generation', 'summary', 'саммари', 'обработка', 'processing',
      'sentiment', 'тональность', 'extraction', 'извлечение', 'ai', 'ml',
      'nlp', 'классификация', 'classification', 'рекомендации', 'recommendations'
    ],
    features: [
      'AI-обработка входных данных',
      'Парсинг URL (Reddit, Product Hunt, etc.)',
      'Структурированный вывод результатов',
      'История запросов',
      'Экспорт результатов'
    ],
    techStack: ['Next.js', 'OpenAI API', 'Tailwind CSS', 'Cheerio'],
    complexity: 'medium',
    generationTime: '2-3 минуты'
  },
  {
    id: 'calculator',
    name: 'Calculator',
    nameRu: 'Калькулятор',
    description: 'Interactive calculator with form inputs and instant calculations',
    descriptionRu: 'Интерактивный калькулятор с формой ввода и мгновенными расчётами',
    icon: '🧮',
    keywords: [
      'расчёт', 'calculation', 'калькулятор', 'calculator', 'сравнение', 'comparison',
      'стоимость', 'cost', 'цена', 'price', 'бюджет', 'budget', 'roi', 'окупаемость',
      'оценка', 'estimate', 'прогноз', 'forecast', 'конверсия', 'conversion'
    ],
    features: [
      'Форма с валидацией',
      'Мгновенные расчёты',
      'Визуализация результатов',
      'Сохранение сценариев',
      'Сравнение вариантов'
    ],
    techStack: ['Next.js', 'React Hook Form', 'Tailwind CSS', 'Chart.js'],
    complexity: 'low',
    generationTime: '1-2 минуты'
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    nameRu: 'Дашборд',
    description: 'Data aggregation dashboard with visualization and filtering',
    descriptionRu: 'Дашборд агрегации данных с визуализацией и фильтрацией',
    icon: '📊',
    keywords: [
      'мониторинг', 'monitoring', 'трекинг', 'tracking', 'агрегация', 'aggregation',
      'дашборд', 'dashboard', 'визуализация', 'visualization', 'метрики', 'metrics',
      'статистика', 'statistics', 'отчёт', 'report', 'аналитика', 'analytics'
    ],
    features: [
      'Агрегация данных из источников',
      'Интерактивные графики',
      'Фильтры и поиск',
      'Автообновление данных',
      'Экспорт отчётов'
    ],
    techStack: ['Next.js', 'Recharts', 'Tailwind CSS', 'SWR'],
    complexity: 'medium',
    generationTime: '2-3 минуты'
  },
  {
    id: 'landing-waitlist',
    name: 'Landing + Waitlist',
    nameRu: 'Лендинг + Waitlist',
    description: 'Landing page with email collection for idea validation',
    descriptionRu: 'Лендинг со сбором email для валидации идеи',
    icon: '🚀',
    keywords: [
      'валидация', 'validation', 'waitlist', 'лист ожидания', 'early access',
      'ранний доступ', 'запуск', 'launch', 'подписка', 'subscription'
    ],
    features: [
      'Привлекательный лендинг',
      'Форма сбора email',
      'Социальные доказательства',
      'Интеграция с email-сервисами',
      'Аналитика конверсий'
    ],
    techStack: ['Next.js', 'Tailwind CSS', 'Supabase', 'Resend'],
    complexity: 'low',
    generationTime: '1-2 минуты'
  }
];

/**
 * Определяет оптимальный тип MVP на основе анализа боли
 */
export function detectMVPType(context: MVPGenerationContext): MVPType {
  const painText = [
    context.analysis?.main_pain || '',
    ...(context.analysis?.key_pain_points || []),
    context.trend.title,
    context.trend.why_trending || ''
  ].join(' ').toLowerCase();

  // Подсчитываем совпадения ключевых слов для каждого типа
  const scores: Record<MVPType, number> = {
    'ai-tool': 0,
    'calculator': 0,
    'dashboard': 0,
    'landing-waitlist': 0
  };

  for (const definition of mvpTypeDefinitions) {
    for (const keyword of definition.keywords) {
      if (painText.includes(keyword.toLowerCase())) {
        scores[definition.id] += 1;
      }
    }
  }

  // Находим тип с максимальным score
  let maxScore = 0;
  let bestType: MVPType = 'landing-waitlist'; // По умолчанию

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = type as MVPType;
    }
  }

  // Если score слишком низкий, возвращаем landing-waitlist для валидации
  if (maxScore < 2) {
    return 'landing-waitlist';
  }

  return bestType;
}

/**
 * Получает определение типа MVP
 */
export function getMVPTypeDefinition(type: MVPType): MVPTypeDefinition | undefined {
  return mvpTypeDefinitions.find(d => d.id === type);
}
