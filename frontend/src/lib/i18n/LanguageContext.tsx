'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { Language, translations, Translations } from './translations';

// Типы для перевода контента
interface TranslateContentOptions {
  fields?: string[];
  cacheKey?: string;
}

interface TranslateContentResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'trendhunter_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('ru');
  const [mounted, setMounted] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved && (saved === 'ru' || saved === 'en')) {
      setLanguageState(saved);
    } else {
      // Try to detect browser language
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === 'en') {
        setLanguageState('en');
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
    // Update html lang attribute
    document.documentElement.lang = lang;
  };

  // Get translations for current language
  const t = translations[language];

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ language: 'ru', setLanguage, t: translations.ru }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Shorthand hook for translations only
export function useTranslations() {
  const { t } = useLanguage();
  return t;
}

// Кэш для переведённого контента
const contentCache = new Map<string, Record<string, unknown>>();

/**
 * Hook для перевода динамического контента (данных из API/БД)
 * Автоматически переводит при смене языка
 */
export function useTranslateContent<T extends Record<string, unknown>>(
  content: T | null,
  options: TranslateContentOptions = {}
): TranslateContentResult<T> {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { fields, cacheKey } = options;

  // Генерируем ключ для кэша
  const getCacheKeyForContent = useCallback((content: T) => {
    if (cacheKey) return `${language}:${cacheKey}`;
    const contentStr = JSON.stringify(content);
    return `${language}:${contentStr.slice(0, 50)}:${contentStr.length}`;
  }, [language, cacheKey]);

  useEffect(() => {
    if (!content) {
      setTranslated(null);
      return;
    }

    // Для русского языка - возвращаем как есть (данные уже на русском)
    if (language === 'ru') {
      setTranslated(content);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Проверяем кэш
    const key = getCacheKeyForContent(content);
    const cached = contentCache.get(key);
    if (cached) {
      setTranslated(cached as T);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Делаем запрос на перевод
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        targetLang: language,
        fields
      }),
      signal: controller.signal
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const result = data.translated as T;
          setTranslated(result);
          // Сохраняем в кэш
          contentCache.set(key, result);
        } else {
          setError(data.error || 'Translation failed');
          setTranslated(content); // Возвращаем оригинал при ошибке
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Translation error:', err);
          setError('Ошибка перевода');
          setTranslated(content); // Возвращаем оригинал при ошибке
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [content, language, fields, getCacheKeyForContent]);

  return { data: translated, isLoading, error };
}

/**
 * Hook для batch перевода нескольких объектов
 */
export function useTranslateContentBatch<T extends Record<string, unknown>>(
  items: T[] | null,
  options: TranslateContentOptions = {}
): { data: T[] | null; isLoading: boolean; error: string | null } {
  const { language } = useLanguage();
  const [translated, setTranslated] = useState<T[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { fields } = options;

  useEffect(() => {
    if (!items || items.length === 0) {
      setTranslated(items);
      return;
    }

    // Для русского языка - возвращаем как есть
    if (language === 'ru') {
      setTranslated(items);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Проверяем кэш для каждого элемента
    const cachedResults: (T | null)[] = items.map(item => {
      const key = `${language}:batch:${JSON.stringify(item).slice(0, 50)}`;
      return (contentCache.get(key) as T) || null;
    });

    // Если все элементы в кэше
    if (cachedResults.every(r => r !== null)) {
      setTranslated(cachedResults as T[]);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Отменяем предыдущий запрос
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);

    fetch('/api/translate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        targetLang: language,
        fields
      }),
      signal: controller.signal
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          const results = data.translated as T[];
          setTranslated(results);
          // Сохраняем каждый элемент в кэш
          results.forEach((item, i) => {
            const key = `${language}:batch:${JSON.stringify(items[i]).slice(0, 50)}`;
            contentCache.set(key, item);
          });
        } else {
          setError(data.error || 'Translation failed');
          setTranslated(items);
        }
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Batch translation error:', err);
          setError('Ошибка перевода');
          setTranslated(items);
        }
      })
      .finally(() => {
        setIsLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [items, language, fields]);

  return { data: translated, isLoading, error };
}

/**
 * Функция для очистки кэша переводов (например, при обновлении данных)
 */
export function clearTranslationCache() {
  contentCache.clear();
}
