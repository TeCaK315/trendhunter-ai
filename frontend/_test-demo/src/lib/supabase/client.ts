import { createBrowserClient } from '@supabase/ssr';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    // During build/prerender, env vars may not be available
    // Return a dummy client that will be replaced on hydration
    if (typeof window === 'undefined') {
      return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key');
    }
    throw new Error('Missing Supabase environment variables');
  }

  _client = createBrowserClient(url, key);
  return _client;
}
