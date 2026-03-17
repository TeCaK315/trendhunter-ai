import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const cacheName = `${ctx.project_slug}-cache-v1`;

  return {
    'public/sw.js': `// Service Worker for ${ctx.safe.projectName}
// Cache-first for static assets, Network-first for API calls

const CACHE_NAME = '${cacheName}';

const STATIC_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
];

// ─── Install: Pre-cache static assets ───

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─── Activate: Clean up old caches ───

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

// ─── Fetch: Strategy-based caching ───

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Network-first for Next.js data fetches
  if (url.pathname.startsWith('/_next/data/')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.match(/\\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|eot)$/)
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network-first for HTML pages
  event.respondWith(networkFirst(request));
});

// ─── Cache-first strategy ───

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }
    throw error;
  }
}

// ─── Network-first strategy ───

async function networkFirst(request) {
  try {
    const response = await fetch(request);

    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    // Try cache fallback
    const cached = await caches.match(request);
    if (cached) return cached;

    // Offline fallback for navigation
    if (request.mode === 'navigate') {
      return caches.match('/offline');
    }

    throw error;
  }
}

// ─── Background Sync (for future use) ───

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('[SW] Background sync triggered');
  }
});

// ─── Push Notifications (for future use) ───

self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: data.url ? { url: data.url } : undefined,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '${ctx.safe.projectName}', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.notification.data?.url) {
    event.waitUntil(clients.openWindow(event.notification.data.url));
  }
});
`,
  };
}
