import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/lib/usage.ts': `import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
`,

    'src/app/api/usage/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUsage } from '@/lib/usage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const metric = searchParams.get('metric') || 'analyses';

    const usage = await getUsage(user.id, metric);

    return NextResponse.json(usage);
  } catch (error: any) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}
`,

    'src/components/UsageCard.tsx': `'use client';

import { useState, useEffect } from 'react';
import { BarChart3, Loader2 } from 'lucide-react';

interface UsageInfo {
  used: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  percentage: number;
}

interface UsageCardProps {
  metric?: string;
  label?: string;
}

export default function UsageCard({ metric = 'analyses', label = 'Analyses' }: UsageCardProps) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch(\`/api/usage?metric=\${metric}\`);
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch (err) {
        console.error('Failed to fetch usage:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, [metric]);

  if (loading) {
    return (
      <div className="rounded-2xl border p-6 flex items-center justify-center"
           style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  if (!usage) return null;

  const isNearLimit = !usage.isUnlimited && usage.percentage >= 80;
  const isAtLimit = !usage.isUnlimited && usage.percentage >= 100;

  return (
    <div className="rounded-2xl border p-6"
         style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" style={{ color: '${t.primary}' }} />
          <h3 className="font-heading font-semibold" style={{ color: '${t.text}' }}>
            {label} Usage
          </h3>
        </div>
        <span className="text-sm" style={{ color: '${t.text70}' }}>
          {usage.isUnlimited
            ? \`\${usage.used} used (unlimited)\`
            : \`\${usage.used} / \${usage.limit}\`}
        </span>
      </div>

      {!usage.isUnlimited && (
        <>
          <div className="w-full h-3 rounded-full overflow-hidden mb-2"
               style={{ background: '${t.primary20}' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: \`\${Math.min(100, usage.percentage)}%\`,
                background: isAtLimit ? '#ef4444' : isNearLimit ? '#f59e0b' : '${t.gradientPrimary}',
              }}
            />
          </div>
          <p className="text-sm" style={{ color: isAtLimit ? '#ef4444' : '${t.text70}' }}>
            {isAtLimit
              ? 'Limit reached — upgrade for more'
              : \`\${usage.remaining} remaining this month\`}
          </p>
        </>
      )}
    </div>
  );
}
`,
  };
}
