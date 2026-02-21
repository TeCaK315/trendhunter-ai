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

// generatePitchDeck, analyzeCompetitors, findPotentialClients — УДАЛЕНЫ
// generateVentureData, generateOutreachEmail, synthesizeInsights — УДАЛЕНЫ
// Причина: генерировали 100% галлюцинированные данные без реальных источников
// Реальные данные: /api/competition (SerpAPI), /api/find-companies (SerpAPI), /api/venture-data (SerpAPI)

/**
 * Исследование ниши — генерирует ТОЛЬКО подсказки для дальнейшего исследования.
 * НЕ генерирует фейковые скоры, конкурентов, размеры рынка или revenue.
 * Реальные данные собираются через Evidence блоки и SerpAPI.
 */
export async function researchNiche(
  niche: string,
  description: string,
  targetAudience?: string,
  existingProblems?: string
): Promise<AIResponse<{
  keywords_for_research: string[];
  subreddits: string[];
  search_queries: string[];
  hypothesis: string;
}>> {
  const systemPrompt = `Ты помощник по исследованию ниш. Твоя задача — помочь пользователю НАЧАТЬ исследование.

ВАЖНО: Ты НЕ генерируешь данные о рынке, конкурентах или revenue. Ты только предлагаешь:
1. Ключевые слова для поиска
2. Subreddit'ы где обсуждают эту тему
3. Поисковые запросы для Google/SerpAPI
4. Краткую гипотезу (1-2 предложения) что исследовать

Верни JSON:
{
  "keywords_for_research": ["ключевое слово 1", "ключевое слово 2"],
  "subreddits": ["subreddit1", "subreddit2"],
  "search_queries": ["запрос для поиска конкурентов", "запрос для поиска болей"],
  "hypothesis": "Краткая гипотеза что можно проверить через Evidence"
}

НЕ включай: competitors, market_size, overall_score, revenue, pain_points со severity, target_segments.
Все эти данные пользователь получит через реальные API (SerpAPI, Reddit, Google Trends).`;

  const userMessage = `Ниша: ${niche}
Описание: ${description}
${targetAudience ? `Аудитория: ${targetAudience}` : ''}
${existingProblems ? `Известные проблемы: ${existingProblems}` : ''}`;

  return callAIJson(systemPrompt, userMessage, {
    temperature: 0.5,
    maxTokens: 1000
  });
}
