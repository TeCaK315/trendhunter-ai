import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/app/api/webhooks/incoming/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const source = req.headers.get('x-webhook-source') || 'unknown';
    const signature = req.headers.get('x-webhook-signature') || '';

    // Validate webhook secret if configured
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (webhookSecret && signature !== webhookSecret) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Store webhook event
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      await supabase.from('webhook_events').insert({
        source,
        event_type: body.type || body.event || 'unknown',
        payload: body,
        processed: false,
      });
    }

    // Process webhook based on source/type
    console.log('[webhook] Received:', source, body.type || body.event);

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[webhook] Error:', err);
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}
`,

    'src/lib/webhook-handler.ts': `import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _sb;
}

interface WebhookEvent {
  id: string;
  source: string;
  event_type: string;
  payload: any;
  processed: boolean;
  created_at: string;
}

type WebhookHandler = (event: WebhookEvent) => Promise<void>;

const handlers: Map<string, WebhookHandler> = new Map();

export function registerWebhookHandler(eventType: string, handler: WebhookHandler) {
  handlers.set(eventType, handler);
}

export async function processUnhandledWebhooks() {
  const supabase = getSupabase();
  const { data: events } = await supabase
    .from('webhook_events')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })
    .limit(50);

  if (!events) return;

  for (const event of events) {
    const handler = handlers.get(event.event_type);
    if (handler) {
      try {
        await handler(event);
        await supabase.from('webhook_events').update({ processed: true }).eq('id', event.id);
      } catch (err) {
        console.error('[webhook] Handler error:', event.event_type, err);
      }
    }
  }
}
`,
  };
}
