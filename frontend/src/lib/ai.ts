/**
 * Unified AI Module
 *
 * Единый модуль для всех AI вызовов в приложении.
 * Уменьшает дублирование кода и упрощает поддержку.
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export interface AIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
}

export interface AIResponse<T = string> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Проверяет наличие API ключа
 */
export function isAIConfigured(): boolean {
  return !!OPENAI_API_KEY;
}

/**
 * Универсальная функция для вызова OpenAI API
 */
export async function callAI(
  systemPrompt: string,
  userMessage: string,
  options: AIOptions = {}
): Promise<AIResponse> {
  if (!OPENAI_API_KEY) {
    return {
      success: false,
      error: 'API ключ не настроен. Добавьте OPENAI_API_KEY в Environment Variables.'
    };
  }

  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 4000,
    responseFormat = 'text'
  } = options;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ],
        temperature,
        max_tokens: maxTokens,
        ...(responseFormat === 'json' && { response_format: { type: 'json_object' } })
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error?.message || `API error: ${response.status}`
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return {
      success: true,
      data: content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Вызов AI с автоматическим парсингом JSON ответа
 */
export async function callAIJson<T = Record<string, unknown>>(
  systemPrompt: string,
  userMessage: string,
  options: Omit<AIOptions, 'responseFormat'> = {}
): Promise<AIResponse<T>> {
  const result = await callAI(systemPrompt, userMessage, {
    ...options,
    responseFormat: 'json'
  });

  if (!result.success || !result.data) {
    return result as AIResponse<T>;
  }

  try {
    // Пытаемся найти JSON в ответе
    let jsonStr = result.data;

    // Если ответ содержит markdown code block
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr) as T;
    return {
      success: true,
      data: parsed,
      usage: result.usage
    };
  } catch {
    // Если не удалось распарсить как JSON, пробуем извлечь JSON из текста
    try {
      const jsonMatch = result.data.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as T;
        return {
          success: true,
          data: parsed,
          usage: result.usage
        };
      }
    } catch {
      // Игнорируем ошибку парсинга
    }

    return {
      success: false,
      error: 'Failed to parse AI response as JSON'
    };
  }
}

// ============================================
// Специализированные AI функции для разных задач
// ============================================

/**
 * Анализ болевых точек тренда
 */
export async function analyzeTPainPoints(
  trendTitle: string,
  trendDescription: string,
  category?: string
): Promise<AIResponse<{
  main_pain: string;
  key_pain_points: string[];
  target_audience: {
    primary: string;
    segments: Array<{
      name: string;
      size: string;
      willingness_to_pay: string;
      where_to_find: string;
    }>;
  };
  opportunities: string[];
  risks: string[];
}>> {
  const systemPrompt = `Ты - эксперт по анализу рынка и выявлению болевых точек клиентов.
Проанализируй тренд и определи:
1. Главную боль (main_pain) - одно предложение
2. Ключевые болевые точки (key_pain_points) - 3-5 пунктов
3. Целевую аудиторию с сегментами
4. Возможности (opportunities) - 3-5 пунктов
5. Риски (risks) - 2-3 пункта

Отвечай на русском языке. Верни JSON.`;

  const userMessage = `Тренд: ${trendTitle}
${category ? `Категория: ${category}` : ''}
Описание: ${trendDescription}`;

  return callAIJson(systemPrompt, userMessage, { temperature: 0.7 });
}

/**
 * Генерация питч-дека
 */
export async function generatePitchDeck(
  trendTitle: string,
  mainPain: string,
  targetAudience: string,
  keyPainPoints: string[]
): Promise<AIResponse<{
  title: string;
  tagline: string;
  problem: string;
  solution: string;
  uniqueValue: string;
  marketSize: string;
  businessModel: string;
  goToMarket: string;
  team: string;
  askAmount: string;
}>> {
  const systemPrompt = `Ты - эксперт по созданию питч-деков для стартапов.
Создай убедительный питч-дек на основе анализа тренда.
Каждый раздел должен быть конкретным и убедительным.
Отвечай на русском языке. Верни JSON.`;

  const userMessage = `Тренд: ${trendTitle}
Главная боль: ${mainPain}
Целевая аудитория: ${targetAudience}
Ключевые болевые точки:
${keyPainPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}`;

  return callAIJson(systemPrompt, userMessage, { temperature: 0.8 });
}

/**
 * Анализ конкурентов
 */
export async function analyzeCompetitors(
  trendTitle: string,
  mainPain: string,
  competitors: Array<{ name: string; description?: string }>
): Promise<AIResponse<{
  competitive_landscape: string;
  our_positioning: string;
  differentiation_opportunities: string[];
  competitor_analysis: Array<{
    name: string;
    strengths: string[];
    weaknesses: string[];
    pricing?: string;
  }>;
}>> {
  const systemPrompt = `Ты - эксперт по конкурентному анализу.
Проанализируй конкурентов и определи возможности для дифференциации.
Отвечай на русском языке. Верни JSON.`;

  const userMessage = `Тренд: ${trendTitle}
Главная боль которую решаем: ${mainPain}
Конкуренты:
${competitors.map(c => `- ${c.name}${c.description ? `: ${c.description}` : ''}`).join('\n')}`;

  return callAIJson(systemPrompt, userMessage, { temperature: 0.7 });
}

/**
 * Поиск потенциальных клиентов/компаний
 */
export async function findPotentialClients(
  trendTitle: string,
  mainPain: string,
  targetSegments: string[]
): Promise<AIResponse<{
  companies: Array<{
    name: string;
    industry: string;
    size: string;
    relevance_score: number;
    pain_match: string;
    contact_approach: string;
  }>;
  outreach_strategy: string;
}>> {
  const systemPrompt = `Ты - эксперт по B2B продажам и поиску клиентов.
Определи потенциальных клиентов которые могут быть заинтересованы в решении данной проблемы.
Отвечай на русском языке. Верни JSON.`;

  const userMessage = `Тренд/Решение: ${trendTitle}
Боль которую решаем: ${mainPain}
Целевые сегменты: ${targetSegments.join(', ')}`;

  return callAIJson(systemPrompt, userMessage, { temperature: 0.7 });
}

/**
 * Генерация данных о венчурных инвестициях
 */
export async function generateVentureData(
  trendTitle: string,
  category: string,
  mainPain: string
): Promise<AIResponse<{
  market_overview: {
    total_funding: string;
    deal_count: string;
    avg_deal_size: string;
    growth_rate: string;
  };
  recent_deals: Array<{
    company: string;
    amount: string;
    stage: string;
    investors: string[];
    date: string;
  }>;
  key_investors: Array<{
    name: string;
    type: string;
    focus_areas: string[];
    notable_investments: string[];
  }>;
  investment_thesis: string;
  recommendations: string[];
}>> {
  const systemPrompt = `Ты - эксперт по венчурным инвестициям.
Проанализируй инвестиционный ландшафт для данного тренда/ниши.
Предоставь реалистичные данные о рынке, сделках и инвесторах.
Отвечай на русском языке. Верни JSON.`;

  const userMessage = `Тренд: ${trendTitle}
Категория: ${category}
Проблема: ${mainPain}`;

  return callAIJson(systemPrompt, userMessage, { temperature: 0.7 });
}

/**
 * Генерация email для outreach
 */
export async function generateOutreachEmail(
  companyName: string,
  contactRole: string,
  productDescription: string,
  painPoint: string
): Promise<AIResponse<{
  subject: string;
  body: string;
  followUp: string;
}>> {
  const systemPrompt = `Ты - эксперт по cold outreach и B2B продажам.
Напиши персонализированное письмо для первого контакта.
Письмо должно быть коротким (3-4 абзаца), конкретным и с чётким CTA.
Отвечай на русском языке. Верни JSON.`;

  const userMessage = `Компания: ${companyName}
Роль контакта: ${contactRole}
Наш продукт: ${productDescription}
Боль которую решаем: ${painPoint}`;

  return callAIJson(systemPrompt, userMessage, { temperature: 0.8 });
}

/**
 * Синтез инсайтов из собранных данных
 */
export async function synthesizeInsights(
  trendTitle: string,
  redditData: { posts: number; communities: string[]; topTopics: string[] },
  youtubeData: { videos: number; channels: string[] },
  googleTrendsData: { growth: string; relatedQueries: string[] }
): Promise<AIResponse<{
  key_insights: string[];
  content_gaps: string[];
  audience_sentiment: string;
  recommended_angles: string[];
  action_items: string[];
}>> {
  const systemPrompt = `Ты - эксперт по анализу данных и выявлению инсайтов.
Синтезируй данные из разных источников и выдели ключевые инсайты.
Отвечай на русском языке. Верни JSON.`;

  const userMessage = `Тренд: ${trendTitle}

Reddit:
- Постов проанализировано: ${redditData.posts}
- Сообщества: ${redditData.communities.join(', ')}
- Топ темы: ${redditData.topTopics.join(', ')}

YouTube:
- Видео найдено: ${youtubeData.videos}
- Каналы: ${youtubeData.channels.join(', ')}

Google Trends:
- Рост: ${googleTrendsData.growth}
- Связанные запросы: ${googleTrendsData.relatedQueries.join(', ')}`;

  return callAIJson(systemPrompt, userMessage, { temperature: 0.7 });
}

/**
 * Исследование ниши
 */
export async function researchNiche(
  niche: string,
  description: string,
  targetAudience?: string,
  existingProblems?: string
): Promise<AIResponse<{
  niche_analysis: {
    market_size: string;
    growth_trend: string;
    competition_level: string;
    entry_barriers: string;
  };
  pain_points: Array<{
    pain: string;
    severity: number;
    frequency: string;
  }>;
  target_segments: Array<{
    name: string;
    size: string;
    willingness_to_pay: string;
    where_to_find: string;
    communication_channels: string[];
  }>;
  opportunities: Array<{
    opportunity: string;
    potential_revenue: string;
    implementation_difficulty: string;
    time_to_market: string;
  }>;
  competitors: Array<{
    name: string;
    website?: string;
    strengths: string[];
    weaknesses: string[];
    pricing?: string;
  }>;
  recommended_solutions: Array<{
    type: string;
    description: string;
    mvp_features: string[];
    estimated_cost: string;
    monetization: string;
  }>;
  keywords_for_research: string[];
  subreddits: string[];
  overall_score: {
    opportunity: number;
    pain_severity: number;
    feasibility: number;
    profit_potential: number;
  };
}>> {
  const systemPrompt = `Ты эксперт по анализу рынка и выявлению бизнес-возможностей.
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
}`;

  const userMessage = `Проанализируй нишу:

**Ниша:** ${niche}

**Описание проблемы/бизнеса заказчика:** ${description}

${targetAudience ? `**Целевая аудитория:** ${targetAudience}` : ''}

${existingProblems ? `**Известные проблемы:** ${existingProblems}` : ''}

Проведи глубокий анализ этой ниши. Найди реальные боли, потенциальных клиентов, конкурентов и возможности. Дай конкретные рекомендации по решениям.`;

  return callAIJson(systemPrompt, userMessage, {
    temperature: 0.7,
    maxTokens: 4000
  });
}
