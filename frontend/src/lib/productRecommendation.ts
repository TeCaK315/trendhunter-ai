/**
 * Product Type Recommendation System
 *
 * Анализирует тренд и рекомендует наиболее подходящий тип продукта
 */

import { type ProductType } from './templates';

// Re-export для удобства использования
export type { ProductType };

interface TrendContext {
  title: string;
  category?: string;
  why_trending?: string;
}

interface AnalysisContext {
  main_pain?: string;
  key_pain_points?: string[];
  target_audience?: {
    primary?: string;
    segments?: Array<{ name: string; size?: string }>;
  };
}

interface PitchContext {
  company_name?: string;
  tagline?: string;
}

interface RecommendationResult {
  recommended: ProductType;
  scores: Record<ProductType, number>;
  reasoning: string;
  allRecommendations: Array<{
    type: ProductType;
    score: number;
    reason: string;
  }>;
}

// Ключевые слова для каждого типа продукта
const productKeywords: Record<ProductType, string[]> = {
  'landing': [
    'waitlist', 'pre-launch', 'validate', 'idea', 'coming soon',
    'email list', 'early access', 'beta', 'interest', 'signup',
    'новый продукт', 'валидация', 'mvp', 'запуск'
  ],
  'saas': [
    'dashboard', 'analytics', 'management', 'platform', 'tool',
    'automation', 'workflow', 'productivity', 'team', 'collaboration',
    'subscription', 'b2b', 'enterprise', 'crm', 'erp', 'hr',
    'project management', 'tracking', 'reporting', 'monitoring',
    'автоматизация', 'управление', 'платформа', 'сервис', 'инструмент',
    'бизнес', 'команда', 'аналитика', 'отчёты'
  ],
  'ai-wrapper': [
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'gpt',
    'chatbot', 'assistant', 'nlp', 'natural language', 'generative',
    'content generation', 'writing', 'copywriting', 'summarization',
    'translation', 'voice', 'speech', 'image generation', 'vision',
    'recommendation', 'personalization', 'prediction', 'analysis',
    'mental health', 'therapy', 'coaching', 'counseling', 'wellness',
    'meditation', 'mindfulness', 'self-help', 'personal development',
    'education', 'tutoring', 'learning', 'teaching', 'course',
    'customer support', 'help desk', 'faq', 'knowledge base',
    'ии', 'искусственный интеллект', 'чат-бот', 'ассистент',
    'генерация', 'помощник', 'консультант', 'психология', 'здоровье',
    'образование', 'обучение', 'коучинг', 'ментор'
  ],
  'ecommerce': [
    'shop', 'store', 'marketplace', 'commerce', 'retail',
    'product', 'inventory', 'order', 'shipping', 'payment',
    'cart', 'checkout', 'catalog', 'price', 'discount',
    'dropshipping', 'wholesale', 'b2c', 'consumer', 'goods',
    'fashion', 'clothing', 'electronics', 'food', 'delivery',
    'магазин', 'товары', 'продажа', 'доставка', 'заказы',
    'каталог', 'корзина', 'оплата', 'склад', 'розница'
  ]
};

// Категории трендов и их соответствие типам продуктов
const categoryMapping: Record<string, ProductType[]> = {
  'Technology': ['saas', 'ai-wrapper', 'landing'],
  'AI & ML': ['ai-wrapper', 'saas', 'landing'],
  'Business': ['saas', 'landing', 'ecommerce'],
  'Healthcare': ['ai-wrapper', 'saas', 'landing'],
  'Finance': ['saas', 'ai-wrapper', 'landing'],
  'E-commerce': ['ecommerce', 'saas', 'landing'],
  'Education': ['ai-wrapper', 'saas', 'landing'],
  'Marketing': ['saas', 'ai-wrapper', 'landing'],
  'Productivity': ['saas', 'ai-wrapper', 'landing'],
  'Social': ['saas', 'landing', 'ai-wrapper'],
  'Entertainment': ['landing', 'saas', 'ai-wrapper'],
  'Lifestyle': ['ai-wrapper', 'landing', 'ecommerce'],
  'Travel': ['saas', 'ecommerce', 'landing'],
  'Food & Beverage': ['ecommerce', 'saas', 'landing'],
  'Real Estate': ['saas', 'landing', 'ai-wrapper'],
  'Sports & Fitness': ['ai-wrapper', 'saas', 'landing'],
  'Gaming': ['saas', 'landing', 'ai-wrapper'],
};

// Специфические паттерны для определённых типов проблем
const problemPatterns: Array<{
  patterns: RegExp[];
  recommendedType: ProductType;
  boost: number;
  reason: string;
}> = [
  {
    patterns: [
      /mental\s*health/i,
      /psych(ology|ological)/i,
      /therap(y|ist)/i,
      /anxiety|depression|stress/i,
      /wellness|wellbeing/i,
      /coach(ing)?|mentor/i,
      /self[- ]help|personal\s*development/i,
      /meditation|mindfulness/i,
      /психолог|терап|тревог|стресс|депресс/i,
      /коуч|ментор|саморазвит/i,
    ],
    recommendedType: 'ai-wrapper',
    boost: 40,
    reason: 'AI-ассистент идеален для персонализированной поддержки и консультаций'
  },
  {
    patterns: [
      /customer\s*support|help\s*desk/i,
      /faq|knowledge\s*base/i,
      /chatbot|virtual\s*assistant/i,
      /поддержк|помощ|консульт/i,
    ],
    recommendedType: 'ai-wrapper',
    boost: 35,
    reason: 'AI-ассистент отлично справляется с поддержкой клиентов 24/7'
  },
  {
    patterns: [
      /content\s*(creation|generation|writing)/i,
      /copywriting|blog|article/i,
      /marketing\s*copy|social\s*media\s*post/i,
      /контент|копирайт|статьи|посты/i,
    ],
    recommendedType: 'ai-wrapper',
    boost: 35,
    reason: 'AI-wrapper идеален для генерации контента'
  },
  {
    patterns: [
      /education|learning|teaching|tutor/i,
      /course|lesson|training/i,
      /skill|knowledge/i,
      /обучен|образован|курс|урок/i,
    ],
    recommendedType: 'ai-wrapper',
    boost: 30,
    reason: 'AI-тьютор обеспечивает персонализированное обучение'
  },
  {
    patterns: [
      /analytic|dashboard|report|metric/i,
      /tracking|monitoring|kpi/i,
      /business\s*intelligence|bi\b/i,
      /аналитик|дашборд|отчёт|метрик/i,
    ],
    recommendedType: 'saas',
    boost: 35,
    reason: 'SaaS с дашбордом идеален для аналитики и отчётности'
  },
  {
    patterns: [
      /team|collaboration|project\s*management/i,
      /workflow|process|automation/i,
      /команд|совместн|проект|процесс/i,
    ],
    recommendedType: 'saas',
    boost: 30,
    reason: 'SaaS платформа лучше всего подходит для командной работы'
  },
  {
    patterns: [
      /sell|buy|purchase|order/i,
      /product|goods|inventory/i,
      /shop|store|marketplace/i,
      /продаж|покуп|заказ|товар|магазин/i,
    ],
    recommendedType: 'ecommerce',
    boost: 40,
    reason: 'E-commerce платформа оптимальна для продажи товаров'
  },
  {
    patterns: [
      /validate|test\s*idea|mvp/i,
      /early\s*access|waitlist|pre-launch/i,
      /landing\s*page|sign\s*up/i,
      /валидац|тест.*иде|ранний\s*доступ/i,
    ],
    recommendedType: 'landing',
    boost: 35,
    reason: 'Landing page идеален для валидации идеи и сбора аудитории'
  },
];

/**
 * Подсчитывает количество совпадений ключевых слов в тексте
 */
function countKeywordMatches(text: string, keywords: string[]): number {
  const lowerText = text.toLowerCase();
  let count = 0;

  for (const keyword of keywords) {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches) {
      count += matches.length;
    }
  }

  return count;
}

/**
 * Проверяет специфические паттерны в тексте
 */
function checkPatterns(text: string): Array<{ type: ProductType; boost: number; reason: string }> {
  const results: Array<{ type: ProductType; boost: number; reason: string }> = [];

  for (const pattern of problemPatterns) {
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        results.push({
          type: pattern.recommendedType,
          boost: pattern.boost,
          reason: pattern.reason
        });
        break; // Только один буст на паттерн
      }
    }
  }

  return results;
}

/**
 * Главная функция рекомендации типа продукта
 */
export function recommendProductType(
  trend: TrendContext,
  analysis?: AnalysisContext,
  pitch?: PitchContext
): RecommendationResult {
  // Собираем весь текст для анализа
  const textParts: string[] = [
    trend.title,
    trend.category || '',
    trend.why_trending || '',
    analysis?.main_pain || '',
    ...(analysis?.key_pain_points || []),
    analysis?.target_audience?.primary || '',
    ...(analysis?.target_audience?.segments?.map(s => s.name) || []),
    pitch?.company_name || '',
    pitch?.tagline || '',
  ];

  const fullText = textParts.join(' ');

  // Инициализируем счётчики для каждого типа
  const scores: Record<ProductType, number> = {
    'landing': 10, // Базовый балл (всегда можно сделать landing)
    'saas': 0,
    'ai-wrapper': 0,
    'ecommerce': 0,
  };

  const reasons: Record<ProductType, string[]> = {
    'landing': ['Универсальный вариант для начала'],
    'saas': [],
    'ai-wrapper': [],
    'ecommerce': [],
  };

  // 1. Анализ по ключевым словам
  for (const [type, keywords] of Object.entries(productKeywords)) {
    const matches = countKeywordMatches(fullText, keywords);
    if (matches > 0) {
      scores[type as ProductType] += matches * 5;
      if (matches >= 2) {
        reasons[type as ProductType].push(`Найдено ${matches} релевантных ключевых слов`);
      }
    }
  }

  // 2. Анализ по категории тренда
  if (trend.category && categoryMapping[trend.category]) {
    const preferredTypes = categoryMapping[trend.category];
    preferredTypes.forEach((type, index) => {
      const categoryBoost = (preferredTypes.length - index) * 8;
      scores[type] += categoryBoost;
      if (index === 0) {
        reasons[type].push(`Категория "${trend.category}" обычно связана с этим типом продукта`);
      }
    });
  }

  // 3. Проверка специфических паттернов
  const patternMatches = checkPatterns(fullText);
  for (const match of patternMatches) {
    scores[match.type] += match.boost;
    if (!reasons[match.type].includes(match.reason)) {
      reasons[match.type].push(match.reason);
    }
  }

  // 4. Анализ целевой аудитории
  if (analysis?.target_audience?.segments) {
    const segments = analysis.target_audience.segments;

    // B2B сигналы → SaaS
    const b2bSignals = segments.some(s =>
      /business|company|enterprise|team|organization|компани|бизнес|команд/i.test(s.name)
    );
    if (b2bSignals) {
      scores['saas'] += 15;
      reasons['saas'].push('Целевая аудитория включает бизнес-клиентов');
    }

    // B2C сигналы → Landing или AI-wrapper
    const b2cSignals = segments.some(s =>
      /individual|personal|consumer|user|пользовател|личн|потребител/i.test(s.name)
    );
    if (b2cSignals) {
      scores['ai-wrapper'] += 10;
      scores['landing'] += 5;
    }
  }

  // 5. Анализ болевых точек
  if (analysis?.key_pain_points) {
    const painText = analysis.key_pain_points.join(' ');

    // Боли, связанные с персонализацией → AI
    if (/personali|individual|unique|custom|персонал|индивидуал|уникальн/i.test(painText)) {
      scores['ai-wrapper'] += 15;
      reasons['ai-wrapper'].push('Проблема требует персонализированного подхода');
    }

    // Боли, связанные с эффективностью → SaaS
    if (/efficien|productiv|time|automat|эффектив|продуктив|врем|автомат/i.test(painText)) {
      scores['saas'] += 10;
    }
  }

  // Находим тип с максимальным счётом
  let recommended: ProductType = 'landing';
  let maxScore = scores['landing'];

  for (const [type, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      recommended = type as ProductType;
    }
  }

  // Формируем итоговые рекомендации
  const allRecommendations = Object.entries(scores)
    .map(([type, score]) => ({
      type: type as ProductType,
      score,
      reason: reasons[type as ProductType].length > 0
        ? reasons[type as ProductType][0]
        : 'Возможный вариант'
    }))
    .sort((a, b) => b.score - a.score);

  // Главная причина рекомендации
  const mainReason = reasons[recommended].length > 0
    ? reasons[recommended][0]
    : `Наиболее подходящий тип для "${trend.title}"`;

  return {
    recommended,
    scores,
    reasoning: mainReason,
    allRecommendations
  };
}

/**
 * Получить описание почему рекомендуется определённый тип
 */
export function getRecommendationExplanation(type: ProductType, context: string): string {
  const explanations: Record<ProductType, string> = {
    'landing': 'Landing page позволяет быстро валидировать идею и собрать заинтересованную аудиторию перед полноценной разработкой.',
    'saas': 'SaaS платформа с дашбордом идеальна для B2B решений, требующих управления данными, аналитики и командной работы.',
    'ai-wrapper': 'AI-ассистент обеспечивает персонализированный опыт, 24/7 доступность и способен обрабатывать уникальные запросы каждого пользователя.',
    'ecommerce': 'E-commerce платформа оптимальна для продажи физических или цифровых товаров с каталогом, корзиной и оплатой.',
  };

  return explanations[type];
}
