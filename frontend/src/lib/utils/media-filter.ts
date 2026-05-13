/**
 * Фильтр медиа-доменов, агрегаторов и review-платформ
 * которые не являются реальными конкурентами-продуктами.
 *
 * Forbes, PCMag, Housingwire ранжируются в топе органики
 * по коммерческим запросам (статьи «лучшие X для Y»).
 * Система ошибочно принимает их за конкурентов.
 */

const MEDIA_DOMAINS = new Set([
  // Медиа и издания
  'forbes.com', 'businessinsider.com', 'techcrunch.com', 'venturebeat.com',
  'wired.com', 'cnet.com', 'zdnet.com', 'mashable.com', 'theverge.com',
  'engadget.com', 'inc.com', 'entrepreneur.com', 'wsj.com', 'bloomberg.com',
  'reuters.com', 'thebalancemoney.com', 'investopedia.com', 'nerdwallet.com',
  'fastcompany.com', 'hbr.org', 'medium.com',

  // Нишевые медиа
  'housingwire.com', 'inman.com',

  // Обзорные агрегаторы
  'g2.com', 'capterra.com', 'getapp.com', 'softwareadvice.com',
  'trustradius.com', 'sourceforge.net', 'alternativeto.net', 'producthunt.com',

  // Tech обзоры
  'pcmag.com', 'techradar.com', 'tomsguide.com', 'tomshardware.com',
  'digitaltrends.com',

  // SEO/контент фермы
  'clutch.co', 'goodfirms.co', 'expertise.com',

  // Wikipedia и энциклопедии
  'wikipedia.org', 'wikihow.com',

  // YouTube и соцсети
  'youtube.com', 'linkedin.com', 'reddit.com', 'twitter.com',
  'facebook.com', 'instagram.com', 'tiktok.com',
]);

/**
 * Возвращает true если домен — медиа/агрегатор, а не реальный конкурент-продукт.
 */
export function isMediaDomain(domain: string): boolean {
  if (!domain) return false;

  const normalized = domain.toLowerCase().replace(/^www\./, '').trim();

  // Прямое совпадение
  if (MEDIA_DOMAINS.has(normalized)) return true;

  // Субдомены медиа (blog.forbes.com и т.п.)
  for (const mediaDomain of MEDIA_DOMAINS) {
    if (normalized.endsWith('.' + mediaDomain)) return true;
  }

  return false;
}

/**
 * Фильтрует массив объектов с полем domain, убирая медиа-домены.
 */
export function filterMediaCompetitors<T extends { domain?: string }>(
  competitors: T[],
): T[] {
  return competitors.filter((c) => !isMediaDomain(c.domain ?? ''));
}
