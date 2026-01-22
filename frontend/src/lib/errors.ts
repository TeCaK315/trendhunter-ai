/**
 * User-friendly error messages for the application
 */

export type ErrorCode =
  | 'RATE_LIMIT_EXCEEDED'
  | 'API_KEY_MISSING'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'TIMEOUT'
  | 'UNKNOWN';

interface ErrorMessages {
  ru: string;
  en: string;
}

const ERROR_MESSAGES: Record<ErrorCode, ErrorMessages> = {
  RATE_LIMIT_EXCEEDED: {
    ru: 'Слишком много запросов. Пожалуйста, подождите немного и попробуйте снова.',
    en: 'Too many requests. Please wait a moment and try again.'
  },
  API_KEY_MISSING: {
    ru: 'Сервис временно недоступен. Попробуйте позже.',
    en: 'Service temporarily unavailable. Please try again later.'
  },
  NETWORK_ERROR: {
    ru: 'Ошибка сети. Проверьте подключение к интернету.',
    en: 'Network error. Please check your internet connection.'
  },
  SERVER_ERROR: {
    ru: 'Произошла ошибка на сервере. Мы уже работаем над её исправлением.',
    en: 'A server error occurred. We are already working on fixing it.'
  },
  VALIDATION_ERROR: {
    ru: 'Пожалуйста, проверьте введённые данные.',
    en: 'Please check the entered data.'
  },
  NOT_FOUND: {
    ru: 'Запрашиваемый ресурс не найден.',
    en: 'The requested resource was not found.'
  },
  UNAUTHORIZED: {
    ru: 'Необходима авторизация для выполнения этого действия.',
    en: 'Authorization required to perform this action.'
  },
  TIMEOUT: {
    ru: 'Превышено время ожидания. Попробуйте ещё раз.',
    en: 'Request timed out. Please try again.'
  },
  UNKNOWN: {
    ru: 'Произошла непредвиденная ошибка. Попробуйте ещё раз.',
    en: 'An unexpected error occurred. Please try again.'
  }
};

/**
 * Get user-friendly error message based on error code
 */
export function getErrorMessage(code: ErrorCode, language: 'ru' | 'en' = 'ru'): string {
  return ERROR_MESSAGES[code]?.[language] || ERROR_MESSAGES.UNKNOWN[language];
}

/**
 * Parse API response error to user-friendly message
 */
export function parseApiError(error: unknown, language: 'ru' | 'en' = 'ru'): string {
  // Check if it's a fetch error
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return getErrorMessage('NETWORK_ERROR', language);
  }

  // Check if it's an API response with error details
  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;

    // Check for rate limit
    if (errorObj.status === 429 || errorObj.retryAfter) {
      return getErrorMessage('RATE_LIMIT_EXCEEDED', language);
    }

    // Check for specific error messages
    if (typeof errorObj.error === 'string') {
      const errorStr = errorObj.error.toLowerCase();

      if (errorStr.includes('rate limit') || errorStr.includes('too many')) {
        return getErrorMessage('RATE_LIMIT_EXCEEDED', language);
      }
      if (errorStr.includes('api key') || errorStr.includes('unauthorized')) {
        return getErrorMessage('API_KEY_MISSING', language);
      }
      if (errorStr.includes('not found')) {
        return getErrorMessage('NOT_FOUND', language);
      }
      if (errorStr.includes('timeout')) {
        return getErrorMessage('TIMEOUT', language);
      }
    }

    // Check HTTP status codes
    if (typeof errorObj.status === 'number') {
      if (errorObj.status === 401 || errorObj.status === 403) {
        return getErrorMessage('UNAUTHORIZED', language);
      }
      if (errorObj.status === 404) {
        return getErrorMessage('NOT_FOUND', language);
      }
      if (errorObj.status >= 500) {
        return getErrorMessage('SERVER_ERROR', language);
      }
    }
  }

  return getErrorMessage('UNKNOWN', language);
}

/**
 * Toast notification types for consistent styling
 */
export interface ToastConfig {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

/**
 * Create toast configuration from API response
 */
export function createErrorToast(error: unknown, language: 'ru' | 'en' = 'ru'): ToastConfig {
  return {
    type: 'error',
    message: parseApiError(error, language),
    duration: 5000
  };
}

/**
 * Create success toast
 */
export function createSuccessToast(message: string): ToastConfig {
  return {
    type: 'success',
    message,
    duration: 3000
  };
}
