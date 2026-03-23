import { createClient } from '@supabase/supabase-js';

// Lazy initialization — не создаём клиент на уровне модуля
// чтобы билд на Vercel не падал при отсутствии env vars
let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}
function getSupabaseAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}

// Client for browser usage (lazy)
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
    }
    return (_supabase as any)[prop];
  },
});

// Server client with service role (for admin operations)
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key');
    return supabase;
  }
  return createClient(getSupabaseUrl(), serviceRoleKey);
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseAnonKey());
}

// Types for database tables
export interface DbUser {
  id: string;
  email: string | null;
  github_username: string | null;
  name: string | null;
  avatar_url: string | null;
  provider: 'google' | 'github';
  created_at: string;
  last_login_at: string;
  is_admin: boolean;
}

export interface DbUserUsage {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  ideas_generated: number;
  projects_created: number;
  analyses_run: number;
  created_at: string;
  updated_at: string;
}

export interface DbIdea {
  id: string;
  user_id: string;
  trend_id: string;
  title: string;
  category: string;
  created_at: string;
  data: Record<string, unknown>;
}

export interface DbProject {
  id: string;
  user_id: string;
  idea_id: string | null;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
}
