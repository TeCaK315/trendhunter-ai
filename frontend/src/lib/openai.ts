/**
 * OpenAI API Utility with Retry Logic and Error Handling
 *
 * Обеспечивает надёжную работу с OpenAI API:
 * - Автоматические повторные попытки при временных ошибках
 * - Понятные сообщения об ошибках для пользователя
 * - Экспоненциальная задержка между попытками
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  retryDelayMs?: number;
}

export interface OpenAIError {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  statusCode?: number;
}

// Типы ошибок OpenAI
const ERROR_MESSAGES: Record<string, { userMessage: string; retryable: boolean }> = {
  'rate_limit_exceeded': {
    userMessage: 'Слишком много запросов. Подождите минуту и попробуйте снова.',
    retryable: true
  },
  'insufficient_quota': {
    userMessage: 'Исчерпан лимит API. Обратитесь к администратору.',
    retryable: false
  },
  'invalid_api_key': {
    userMessage: 'Ошибка конфигурации сервера. Обратитесь к администратору.',
    retryable: false
  },
  'model_not_found': {
    userMessage: 'Модель AI временно недоступна. Попробуйте позже.',
    retryable: false
  },
  'context_length_exceeded': {
    userMessage: 'Слишком длинный запрос. Попробуйте сократить текст.',
    retryable: false
  },
  'server_error': {
    userMessage: 'Сервер OpenAI временно недоступен. Попробуйте через минуту.',
    retryable: true
  },
  'timeout': {
    userMessage: 'Превышено время ожидания. Попробуйте ещё раз.',
    retryable: true
  },
  'network_error': {
    userMessage: 'Ошибка сети. Проверьте интернет-соединение.',
    retryable: true
  },
  'unknown': {
    userMessage: 'Произошла ошибка. Попробуйте ещё раз.',
    retryable: true
  }
};

/**
 * Определяет тип ошибки по response от OpenAI
 */
function classifyError(statusCode: number, errorBody?: { error?: { code?: string; type?: string; message?: string } }): OpenAIError {
  const errorCode = errorBody?.error?.code || errorBody?.error?.type || '';
  const errorMessage = errorBody?.error?.message || 'Unknown error';

  // Rate limiting
  if (statusCode === 429) {
    return {
      code: 'rate_limit_exceeded',
      message: errorMessage,
      ...ERROR_MESSAGES['rate_limit_exceeded'],
      statusCode
    };
  }

  // Authentication errors
  if (statusCode === 401) {
    return {
      code: 'invalid_api_key',
      message: errorMessage,
      ...ERROR_MESSAGES['invalid_api_key'],
      statusCode
    };
  }

  // Quota exceeded
  if (statusCode === 402 || errorCode === 'insufficient_quota') {
    return {
      code: 'insufficient_quota',
      message: errorMessage,
      ...ERROR_MESSAGES['insufficient_quota'],
      statusCode
    };
  }

  // Not found (model)
  if (statusCode === 404) {
    return {
      code: 'model_not_found',
      message: errorMessage,
      ...ERROR_MESSAGES['model_not_found'],
      statusCode
    };
  }

  // Context length
  if (errorCode === 'context_length_exceeded' || errorMessage.includes('maximum context length')) {
    return {
      code: 'context_length_exceeded',
      message: errorMessage,
      ...ERROR_MESSAGES['context_length_exceeded'],
      statusCode
    };
  }

  // Server errors
  if (statusCode >= 500) {
    return {
      code: 'server_error',
      message: errorMessage,
      ...ERROR_MESSAGES['server_error'],
      statusCode
    };
  }

  // Default
  return {
    code: 'unknown',
    message: errorMessage,
    ...ERROR_MESSAGES['unknown'],
    statusCode
  };
}

/**
 * Задержка с экспоненциальным backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Вызов OpenAI API с retry logic
 */
export async function callOpenAI(
  messages: OpenAIMessage[],
  config: OpenAIConfig = {}
): Promise<{ success: true; content: string } | { success: false; error: OpenAIError }> {
  const {
    model = 'gpt-4o-mini',
    temperature = 0.7,
    maxTokens = 3000,
    maxRetries = 3,
    retryDelayMs = 1000
  } = config;

  if (!OPENAI_API_KEY) {
    return {
      success: false,
      error: {
        code: 'invalid_api_key',
        message: 'API key not configured',
        userMessage: 'Сервис временно недоступен. Обратитесь к администратору.',
        retryable: false
      }
    };
  }

  let lastError: OpenAIError | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorBody;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = {};
        }

        const error = classifyError(response.status, errorBody);
        lastError = error;

        // Если ошибка не retryable или последняя попытка - возвращаем ошибку
        if (!error.retryable || attempt === maxRetries) {
          console.error(`OpenAI API error (attempt ${attempt}/${maxRetries}):`, error);
          return { success: false, error };
        }

        // Экспоненциальная задержка перед повтором
        const delay = retryDelayMs * Math.pow(2, attempt - 1);
        console.log(`OpenAI API error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(delay);
        continue;
      }

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;

      if (!content) {
        lastError = {
          code: 'empty_response',
          message: 'Empty response from OpenAI',
          userMessage: 'Получен пустой ответ. Попробуйте ещё раз.',
          retryable: true
        };

        if (attempt === maxRetries) {
          return { success: false, error: lastError };
        }

        await sleep(retryDelayMs);
        continue;
      }

      return { success: true, content };

    } catch (err) {
      // Network/timeout errors
      const isTimeout = err instanceof Error && err.name === 'AbortError';
      const isNetworkError = err instanceof TypeError && err.message.includes('fetch');

      if (isTimeout) {
        lastError = {
          code: 'timeout',
          message: 'Request timeout',
          ...ERROR_MESSAGES['timeout']
        };
      } else if (isNetworkError) {
        lastError = {
          code: 'network_error',
          message: err.message,
          ...ERROR_MESSAGES['network_error']
        };
      } else {
        lastError = {
          code: 'unknown',
          message: err instanceof Error ? err.message : 'Unknown error',
          ...ERROR_MESSAGES['unknown']
        };
      }

      if (attempt === maxRetries) {
        console.error(`OpenAI API error (final attempt):`, lastError);
        return { success: false, error: lastError };
      }

      const delay = retryDelayMs * Math.pow(2, attempt - 1);
      console.log(`OpenAI API error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
      await sleep(delay);
    }
  }

  // Shouldn't reach here, but just in case
  return {
    success: false,
    error: lastError || {
      code: 'unknown',
      message: 'Max retries exceeded',
      ...ERROR_MESSAGES['unknown']
    }
  };
}

/**
 * Вызов агента (системный промпт + пользовательский запрос)
 */
export async function callAgent(
  systemPrompt: string,
  userPrompt: string,
  config: OpenAIConfig = {}
): Promise<{ success: true; content: string } | { success: false; error: OpenAIError }> {
  return callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], config);
}

/**
 * Парсинг JSON из ответа (часто ответы содержат markdown)
 */
export function parseJSONResponse<T>(content: string): T | null {
  try {
    // Пробуем найти JSON в ответе
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Пробуем найти JSON array
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse JSON response:', e);
  }
  return null;
}

/**
 * Создание понятного сообщения об ошибке для frontend
 */
export function formatErrorForUser(error: OpenAIError): string {
  return error.userMessage;
}
