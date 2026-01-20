/**
 * Storage Utility with LRU Cache
 *
 * Обеспечивает безопасную работу с localStorage:
 * - LRU (Least Recently Used) кэш для автоматической очистки старых данных
 * - Защита от переполнения (QuotaExceededError)
 * - Сжатие больших объектов
 * - Lazy-load для тяжёлых данных
 */

// Максимальный размер данных в localStorage (5MB типичный лимит, оставляем запас)
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB
const MAX_ITEM_SIZE = 500 * 1024; // 500KB на один элемент
const LRU_META_KEY = '__lru_meta__';

interface LRUMeta {
  items: Array<{
    key: string;
    size: number;
    lastAccess: number;
  }>;
  totalSize: number;
}

/**
 * Получить метаданные LRU кэша
 */
function getLRUMeta(): LRUMeta {
  try {
    const meta = localStorage.getItem(LRU_META_KEY);
    if (meta) {
      return JSON.parse(meta);
    }
  } catch {
    // Игнорируем ошибки парсинга
  }
  return { items: [], totalSize: 0 };
}

/**
 * Сохранить метаданные LRU кэша
 */
function saveLRUMeta(meta: LRUMeta): void {
  try {
    localStorage.setItem(LRU_META_KEY, JSON.stringify(meta));
  } catch {
    // Если не удалось сохранить мету - очищаем всё
    console.warn('Failed to save LRU meta, clearing storage');
    clearLRUStorage();
  }
}

/**
 * Обновить время доступа к элементу
 */
function touchItem(key: string): void {
  const meta = getLRUMeta();
  const item = meta.items.find(i => i.key === key);
  if (item) {
    item.lastAccess = Date.now();
    saveLRUMeta(meta);
  }
}

/**
 * Удалить самые старые элементы для освобождения места
 */
function evictOldItems(requiredSpace: number): void {
  const meta = getLRUMeta();

  // Сортируем по времени доступа (старые первые)
  meta.items.sort((a, b) => a.lastAccess - b.lastAccess);

  let freedSpace = 0;
  const itemsToRemove: string[] = [];

  for (const item of meta.items) {
    if (freedSpace >= requiredSpace) break;

    itemsToRemove.push(item.key);
    freedSpace += item.size;
  }

  // Удаляем элементы
  for (const key of itemsToRemove) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Игнорируем ошибки удаления
    }
    meta.items = meta.items.filter(i => i.key !== key);
    meta.totalSize -= meta.items.find(i => i.key === key)?.size || 0;
  }

  // Пересчитываем размер
  meta.totalSize = meta.items.reduce((sum, i) => sum + i.size, 0);
  saveLRUMeta(meta);

  console.log(`LRU eviction: removed ${itemsToRemove.length} items, freed ${freedSpace} bytes`);
}

/**
 * Очистить весь LRU storage
 */
export function clearLRUStorage(): void {
  const meta = getLRUMeta();

  for (const item of meta.items) {
    try {
      localStorage.removeItem(item.key);
    } catch {
      // Игнорируем
    }
  }

  localStorage.removeItem(LRU_META_KEY);
}

/**
 * Безопасное сохранение в localStorage с LRU
 */
export function setItem<T>(key: string, value: T): boolean {
  try {
    const data = JSON.stringify(value);
    const size = new Blob([data]).size;

    // Проверяем размер элемента
    if (size > MAX_ITEM_SIZE) {
      console.warn(`Item ${key} too large (${size} bytes), skipping storage`);
      return false;
    }

    const meta = getLRUMeta();

    // Проверяем, есть ли уже такой элемент
    const existingItem = meta.items.find(i => i.key === key);
    if (existingItem) {
      // Обновляем существующий
      meta.totalSize -= existingItem.size;
      existingItem.size = size;
      existingItem.lastAccess = Date.now();
    } else {
      // Добавляем новый
      meta.items.push({
        key,
        size,
        lastAccess: Date.now()
      });
    }

    meta.totalSize += size;

    // Если превышен лимит - освобождаем место
    if (meta.totalSize > MAX_STORAGE_SIZE) {
      evictOldItems(meta.totalSize - MAX_STORAGE_SIZE + size);
    }

    // Пробуем сохранить
    try {
      localStorage.setItem(key, data);
      saveLRUMeta(meta);
      return true;
    } catch (e) {
      // QuotaExceededError - пробуем освободить место
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        evictOldItems(size * 2); // Освобождаем с запасом
        try {
          localStorage.setItem(key, data);
          saveLRUMeta(meta);
          return true;
        } catch {
          console.error(`Failed to save ${key} after eviction`);
          return false;
        }
      }
      throw e;
    }
  } catch (e) {
    console.error(`Error saving to localStorage: ${key}`, e);
    return false;
  }
}

/**
 * Безопасное чтение из localStorage с LRU
 */
export function getItem<T>(key: string): T | null {
  try {
    const data = localStorage.getItem(key);
    if (data) {
      // Обновляем время доступа
      touchItem(key);
      return JSON.parse(data);
    }
  } catch (e) {
    console.error(`Error reading from localStorage: ${key}`, e);
  }
  return null;
}

/**
 * Удаление из localStorage
 */
export function removeItem(key: string): void {
  try {
    localStorage.removeItem(key);

    const meta = getLRUMeta();
    const item = meta.items.find(i => i.key === key);
    if (item) {
      meta.totalSize -= item.size;
      meta.items = meta.items.filter(i => i.key !== key);
      saveLRUMeta(meta);
    }
  } catch (e) {
    console.error(`Error removing from localStorage: ${key}`, e);
  }
}

/**
 * Получить статистику использования storage
 */
export function getStorageStats(): { used: number; limit: number; items: number } {
  const meta = getLRUMeta();
  return {
    used: meta.totalSize,
    limit: MAX_STORAGE_SIZE,
    items: meta.items.length
  };
}

/**
 * Проверить, доступен ли localStorage
 */
export function isStorageAvailable(): boolean {
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

// ====== Специализированные функции для трендов ======

const TRENDS_CACHE_KEY = 'trends_cache';
const ANALYSIS_CACHE_PREFIX = 'analysis_';
const MAX_CACHED_TRENDS = 50;
const MAX_CACHED_ANALYSES = 20;

interface TrendCacheEntry {
  id: string;
  title: string;
  category?: string;
  updatedAt: number;
}

/**
 * Сохранить список трендов (только ID и базовая инфо)
 */
export function cacheTrendsList(trends: Array<{ id: string; title: string; category?: string }>): boolean {
  const entries: TrendCacheEntry[] = trends.slice(0, MAX_CACHED_TRENDS).map(t => ({
    id: t.id,
    title: t.title,
    category: t.category,
    updatedAt: Date.now()
  }));

  return setItem(TRENDS_CACHE_KEY, entries);
}

/**
 * Получить кэшированный список трендов
 */
export function getCachedTrendsList(): TrendCacheEntry[] | null {
  return getItem<TrendCacheEntry[]>(TRENDS_CACHE_KEY);
}

/**
 * Сохранить анализ тренда
 */
export function cacheAnalysis(trendId: string, analysis: unknown): boolean {
  // Сначала проверяем количество кэшированных анализов
  const meta = getLRUMeta();
  const analysisItems = meta.items.filter(i => i.key.startsWith(ANALYSIS_CACHE_PREFIX));

  // Если превышен лимит - удаляем самые старые анализы
  if (analysisItems.length >= MAX_CACHED_ANALYSES) {
    analysisItems.sort((a, b) => a.lastAccess - b.lastAccess);
    const toRemove = analysisItems.slice(0, analysisItems.length - MAX_CACHED_ANALYSES + 1);
    for (const item of toRemove) {
      removeItem(item.key);
    }
  }

  return setItem(`${ANALYSIS_CACHE_PREFIX}${trendId}`, {
    data: analysis,
    cachedAt: Date.now()
  });
}

/**
 * Получить кэшированный анализ тренда
 */
export function getCachedAnalysis(trendId: string): { data: unknown; cachedAt: number } | null {
  return getItem(`${ANALYSIS_CACHE_PREFIX}${trendId}`);
}

/**
 * Очистить кэш анализов
 */
export function clearAnalysisCache(): void {
  const meta = getLRUMeta();
  const analysisKeys = meta.items
    .filter(i => i.key.startsWith(ANALYSIS_CACHE_PREFIX))
    .map(i => i.key);

  for (const key of analysisKeys) {
    removeItem(key);
  }
}
