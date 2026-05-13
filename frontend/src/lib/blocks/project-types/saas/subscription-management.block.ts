import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  // Stripe deps already declared by feature/stripe-setup block via manifest

  ctx.migrations.push(`
-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');
`);

  const plans = ctx.stripe.plans.length > 0
    ? ctx.stripe.plans
    : [
        { name: 'Free', price: 0, features: ['Basic access'], limits: { requests: 100 } },
        { name: 'Pro', price: 29, features: ['Unlimited access', 'Priority support'], limits: { requests: 10000 } },
        { name: 'Enterprise', price: 99, features: ['Everything in Pro', 'Custom integrations', 'Dedicated support'], limits: { requests: 100000 } },
      ];

  const plansArray = JSON.stringify(plans, null, 2);

  return {
    'src/lib/subscription.ts': `import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { typescript: true });
  }
  return _stripe;
}

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

// ─── Plan Definitions ───

export const PLANS = ${plansArray};

export type PlanName = (typeof PLANS)[number]['name'];

// ─── Types ───

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Get Subscription ───

export async function getSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No subscription found — create a free one
      const { data: newSub, error: createError } = await getSupabaseAdmin()
        .from('subscriptions')
        .insert({ user_id: userId, plan: 'Free', status: 'active' })
        .select()
        .single();

      if (createError) throw createError;
      return newSub;
    }
    throw error;
  }

  return data;
}

// ─── Cancel Subscription ───

export async function cancelSubscription(userId: string): Promise<Subscription> {
  const sub = await getSubscription(userId);
  if (!sub) throw new Error('No subscription found');

  if (sub.stripe_subscription_id) {
    // Cancel at period end in Stripe
    await getStripe().subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true,
    });
  }

  const { data, error } = await getSupabaseAdmin()
    .from('subscriptions')
    .update({
      cancel_at_period_end: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ─── Change Subscription (upgrade / downgrade) ───

export async function changeSubscription(
  userId: string,
  newPlan: string
): Promise<Subscription> {
  const sub = await getSubscription(userId);
  if (!sub) throw new Error('No subscription found');

  const targetPlan = PLANS.find((p) => p.name === newPlan);
  if (!targetPlan) throw new Error(\`Unknown plan: \${newPlan}\`);

  // Free plan — cancel Stripe subscription if exists
  if (targetPlan.price === 0) {
    if (sub.stripe_subscription_id) {
      await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
    }

    const { data, error } = await getSupabaseAdmin()
      .from('subscriptions')
      .update({
        plan: newPlan,
        stripe_subscription_id: null,
        cancel_at_period_end: false,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Paid plan — create or update Stripe subscription
  let customerId = sub.stripe_customer_id;

  if (!customerId) {
    // Fetch user email from Supabase auth
    const { data: userData } = await getSupabaseAdmin().auth.admin.getUserById(userId);
    const customer = await getStripe().customers.create({
      email: userData.user?.email || undefined,
      metadata: { user_id: userId },
    });
    customerId = customer.id;

    await getSupabaseAdmin()
      .from('subscriptions')
      .update({ stripe_customer_id: customerId })
      .eq('user_id', userId);
  }

  if (sub.stripe_subscription_id) {
    // Update existing subscription (prorate)
    const stripeSub = await getStripe().subscriptions.retrieve(sub.stripe_subscription_id);
    await getStripe().subscriptions.update(sub.stripe_subscription_id, {
      items: [
        {
          id: stripeSub.items.data[0].id,
          price_data: {
            currency: 'usd',
            product_data: { name: newPlan },
            unit_amount: targetPlan.price * 100,
            recurring: { interval: 'month' },
          } as any,
        },
      ],
      proration_behavior: 'create_prorations',
      cancel_at_period_end: false,
    });
  } else {
    // Create new subscription
    const stripeSub = await getStripe().subscriptions.create({
      customer: customerId,
      items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: newPlan },
            unit_amount: targetPlan.price * 100,
            recurring: { interval: 'month' },
          } as any,
        },
      ],
    });

    await getSupabaseAdmin()
      .from('subscriptions')
      .update({
        stripe_subscription_id: stripeSub.id,
        current_period_start: new Date(stripeSub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(stripeSub.current_period_end * 1000).toISOString(),
      })
      .eq('user_id', userId);
  }

  const { data, error } = await getSupabaseAdmin()
    .from('subscriptions')
    .update({
      plan: newPlan,
      cancel_at_period_end: false,
      status: 'active',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
`,
  };
}
