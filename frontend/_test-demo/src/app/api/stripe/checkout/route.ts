import { NextRequest, NextResponse } from 'next/server';
import { stripe, getPlanByName } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planName, priceId } = await req.json();

    if (!planName && !priceId) {
      return NextResponse.json({ error: 'planName or priceId is required' }, { status: 400 });
    }

    const plan = planName ? getPlanByName(planName) : null;

    if (planName && !plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    const origin = req.headers.get('origin') || 'http://localhost:3000';

    const sessionParams: Record<string, unknown> = {
      customer_email: user.email,
      mode: 'subscription' as const,
      success_url: `${origin}/dashboard/billing?success=true`,
      cancel_url: `${origin}/dashboard/billing?canceled=true`,
      metadata: {
        user_id: user.id,
        plan_name: planName || '',
      },
    };

    if (priceId) {
      sessionParams.line_items = [{ price: priceId, quantity: 1 }];
    } else {
      sessionParams.line_items = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${plan!.name} Plan`,
              description: plan!.features.join(', '),
            },
            unit_amount: plan!.price * 100,
            recurring: { interval: 'month' },
          },
          quantity: 1,
        },
      ];
    }

    const session = await stripe.checkout.sessions.create(sessionParams as any);

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
