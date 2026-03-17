import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PLANS, getPlanByName } from '@/lib/stripe';

let _supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabaseAdmin;
}

export interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  percentage: number;
}

export async function getUsage(userId: string, metric: string = 'analyses'): Promise<UsageInfo> {
  // Get user profile for tier
  const { data: profile } = await getSupabaseAdmin()
    .from('profiles')
    .select('subscription_tier')
    .eq('id', userId)
    .single();

  const tier = profile?.subscription_tier || 'free';
  const plan = getPlanByName(tier);
  const limit: number = plan?.limits?.[metric as keyof typeof plan.limits] ?? 5;
  const isUnlimited = limit === -1;

  // Get current month usage
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count } = await getSupabaseAdmin()
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('metric', metric)
    .gte('created_at', startOfMonth);

  const used = count || 0;

  return {
    used,
    limit: isUnlimited ? -1 : (limit as number),
    remaining: isUnlimited ? -1 : Math.max(0, (limit as number) - used),
    isUnlimited,
    percentage: isUnlimited ? 0 : Math.min(100, (used / (limit as number)) * 100),
  };
}

export async function checkUsageLimit(userId: string, metric: string = 'analyses'): Promise<boolean> {
  const usage = await getUsage(userId, metric);
  if (usage.isUnlimited) return true;
  return usage.remaining > 0;
}

export async function incrementUsage(userId: string, metric: string = 'analyses'): Promise<void> {
  await getSupabaseAdmin()
    .from('usage_logs')
    .insert({
      user_id: userId,
      metric,
      created_at: new Date().toISOString(),
    });
}
