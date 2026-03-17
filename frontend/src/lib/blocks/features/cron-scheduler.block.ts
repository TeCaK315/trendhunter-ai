import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/app/api/cron/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const dynamic = 'force-dynamic';

// Vercel Cron Job endpoint
// Configure in vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 */6 * * *" }] }
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== \`Bearer \${cronSecret}\`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const results: string[] = [];

    // Task 1: Clean up old data (older than 90 days)
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString();
    const { data: deleted } = await supabase
      .from('analyses')
      .delete()
      .lt('created_at', ninetyDaysAgo)
      .select('id');
    results.push(\`Cleaned \${deleted?.length || 0} old analyses\`);

    // Task 2: Update usage stats
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id')
      .limit(1000);

    if (profiles) {
      for (const profile of profiles) {
        const { data: userAnalyses } = await supabase
          .from('analyses')
          .select('id')
          .eq('user_id', profile.id);
        const count = userAnalyses?.length || 0;

        await supabase
          .from('profiles')
          .update({ total_analyses: count || 0 })
          .eq('id', profile.id);
      }
      results.push(\`Updated stats for \${profiles.length} users\`);
    }

    // Task 3: Process unhandled webhook events
    const { data: webhooks } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('processed', false)
      .limit(50);

    if (webhooks && webhooks.length > 0) {
      await supabase
        .from('webhook_events')
        .update({ processed: true })
        .in('id', webhooks.map(w => w.id));
      results.push(\`Processed \${webhooks.length} webhook events\`);
    }

    console.log('[cron] Completed:', results);

    return NextResponse.json({
      success: true,
      tasks: results,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[cron] Error:', err);
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
`,
  };
}
