import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Client for browser usage
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server client with service role (for admin operations)
export function getServerSupabase() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!serviceRoleKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set, using anon key');
    return supabase;
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && supabaseAnonKey);
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
