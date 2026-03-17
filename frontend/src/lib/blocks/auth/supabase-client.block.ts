import type { BlockContext, BlockResult } from '../types';

export default function generate(_ctx: BlockContext): BlockResult {
  return {
    'src/lib/supabase/client.ts': `import { createBrowserClient } from '@supabase/ssr';

let _client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !key) {
    // Supabase not configured — return a placeholder client
    // App works without Supabase (demo mode), auth features degrade gracefully
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-key');
  }

  _client = createBrowserClient(url, key);
  return _client;
}
`,

    'src/lib/supabase/server.ts': `import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  const cookieStore = await cookies();

  return createServerClient(
    url || 'https://placeholder.supabase.co',
    key || 'placeholder-key',
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookies in middleware
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle cookies in middleware
          }
        },
      },
    }
  );
}
`,
  };
}
