import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  const plans = ctx.stripe?.plans?.length
    ? ctx.stripe.plans
    : [
        {
          name: 'Free',
          price: 0,
          features: ['5 analyses per month', 'Basic reports', 'Email support'],
          limits: { analyses: 5, exports: 2 },
        },
        {
          name: 'Pro',
          price: 29,
          features: ['100 analyses per month', 'Advanced reports', 'Priority support', 'API access'],
          limits: { analyses: 100, exports: 50 },
        },
        {
          name: 'Enterprise',
          price: 99,
          features: ['Unlimited analyses', 'Custom reports', 'Dedicated support', 'API access', 'Team collaboration'],
          limits: { analyses: -1, exports: -1 },
        },
      ];

  const plansJson = JSON.stringify(plans, null, 2);

  return {
    'src/lib/stripe.ts': `import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/**
 * Get Stripe server instance.
 * Reads key from:
 * 1. process.env.STRIPE_SECRET_KEY (from .env)
 * 2. If not found, throws — owner must configure via Settings or .env
 */
export function getStripeServer(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('Missing STRIPE_SECRET_KEY — configure in Settings > Payment or .env');
    }
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

/**
 * Get Stripe server using a key from DB (for dynamic configuration).
 * Called by admin settings API after owner saves keys.
 */
export async function getStripeWithKey(secretKey: string): Promise<Stripe> {
  return new Stripe(secretKey, { typescript: true });
}

/** Try to get Stripe, returns null if not configured */
export function getStripeOptional(): Stripe | null {
  try {
    return getStripeServer();
  } catch {
    return null;
  }
}

/** @deprecated Use getStripeServer() instead */
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripeServer() as any)[prop];
  },
});

export const PLANS = ${plansJson} as const;

export type PlanName = (typeof PLANS)[number]['name'];

export function getPlanByName(name: string) {
  return PLANS.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

export function getPlanLimit(planName: string, limitKey: string): number {
  const plan = getPlanByName(planName);
  if (!plan) return 0;
  const limit = plan.limits[limitKey as keyof typeof plan.limits];
  return typeof limit === 'number' ? limit : 0;
}
`,

    'src/lib/stripe-client.ts': `import { loadStripe, type Stripe } from '@stripe/stripe-js';

let stripePromise: Promise<Stripe | null>;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
`,

    'src/app/api/admin/stripe/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Admin API for Stripe configuration.
 * Only the first registered user (admin/owner) can access.
 *
 * GET — check if Stripe is configured (returns masked key)
 * POST — save Stripe keys to app_settings table
 * DELETE — remove Stripe keys
 */

async function isAdmin(supabase: any): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  // Check if user is the first registered (admin)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1);

  return profiles?.[0]?.id === user.id;
}

export async function GET() {
  try {
    const supabase = await createClient();

    if (!(await isAdmin(supabase))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Check .env first
    const envKey = process.env.STRIPE_SECRET_KEY;
    const envPubKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

    if (envKey) {
      return NextResponse.json({
        configured: true,
        source: 'env',
        publishable_key_masked: envPubKey ? envPubKey.slice(0, 7) + '...' + envPubKey.slice(-4) : '',
        secret_key_masked: 'sk_....' + envKey.slice(-4),
      });
    }

    // Check DB
    const { data: settings } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['stripe_publishable_key', 'stripe_secret_key']);

    const dbKeys: Record<string, string> = {};
    for (const s of settings || []) {
      dbKeys[s.key] = s.value;
    }

    if (dbKeys.stripe_secret_key) {
      return NextResponse.json({
        configured: true,
        source: 'database',
        publishable_key_masked: dbKeys.stripe_publishable_key
          ? dbKeys.stripe_publishable_key.slice(0, 7) + '...' + dbKeys.stripe_publishable_key.slice(-4)
          : '',
        secret_key_masked: 'sk_....' + dbKeys.stripe_secret_key.slice(-4),
      });
    }

    return NextResponse.json({ configured: false });
  } catch (error: any) {
    return NextResponse.json({ configured: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    if (!(await isAdmin(supabase))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { publishable_key, secret_key } = await req.json();

    if (!secret_key || !secret_key.startsWith('sk_')) {
      return NextResponse.json(
        { error: 'Invalid secret key. Must start with sk_' },
        { status: 400 }
      );
    }

    if (publishable_key && !publishable_key.startsWith('pk_')) {
      return NextResponse.json(
        { error: 'Invalid publishable key. Must start with pk_' },
        { status: 400 }
      );
    }

    // Test the connection
    try {
      const Stripe = (await import('stripe')).default;
      const testStripe = new Stripe(secret_key, { typescript: true });
      await testStripe.balance.retrieve();
    } catch (stripeErr: any) {
      return NextResponse.json(
        { error: 'Invalid Stripe key: ' + (stripeErr.message || 'connection failed') },
        { status: 400 }
      );
    }

    // Save to app_settings (upsert)
    const keys = [
      { key: 'stripe_secret_key', value: secret_key },
      { key: 'stripe_publishable_key', value: publishable_key || '' },
    ];

    for (const item of keys) {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: item.key, value: item.value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        );
      if (error) {
        console.error('Failed to save setting:', item.key, error);
        return NextResponse.json({ error: 'Failed to save: ' + error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      publishable_key_masked: publishable_key
        ? publishable_key.slice(0, 7) + '...' + publishable_key.slice(-4)
        : '',
      secret_key_masked: 'sk_....' + secret_key.slice(-4),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to save keys' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient();

    if (!(await isAdmin(supabase))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await supabase
      .from('app_settings')
      .delete()
      .in('key', ['stripe_secret_key', 'stripe_publishable_key']);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
`,
  };
}
