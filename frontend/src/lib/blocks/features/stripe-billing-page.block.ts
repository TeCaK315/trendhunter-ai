import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  const plans = ctx.stripe?.plans?.length
    ? ctx.stripe.plans
    : [
        {
          name: 'Free',
          price: 0,
          features: ['5 analyses per month', 'Basic reports', 'Email support'],
        },
        {
          name: 'Pro',
          price: 29,
          features: ['100 analyses per month', 'Advanced reports', 'Priority support', 'API access'],
        },
        {
          name: 'Enterprise',
          price: 99,
          features: ['Unlimited analyses', 'Custom reports', 'Dedicated support', 'API access', 'Team collaboration'],
        },
      ];

  const plansJson = JSON.stringify(plans, null, 2);

  return {
    'src/app/dashboard/billing/page.tsx': `'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PricingCard from '@/components/PricingCard';
import { CreditCard, Check, Loader2 } from 'lucide-react';

const PLANS = ${plansJson};

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>}>
      <BillingContent />
    </Suspense>
  );
}

function BillingContent() {
  const [currentTier, setCurrentTier] = useState('free');
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const success = searchParams.get('success');
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single();

      if (profile) {
        setCurrentTier(profile.subscription_tier || 'free');
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleUpgrade = async (planName: string) => {
    setCheckoutLoading(planName);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planName }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
    } finally {
      setCheckoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '${t.bg}' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <CreditCard className="w-8 h-8" style={{ color: '${t.primary}' }} />
          <h1 className="text-3xl font-heading font-bold" style={{ color: '${t.text}' }}>
            Billing & Plans
          </h1>
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-xl border flex items-center gap-3"
               style={{ background: '${t.primary}10', borderColor: '${t.primary}40' }}>
            <Check className="w-5 h-5" style={{ color: '${t.primary}' }} />
            <p style={{ color: '${t.text}' }}>
              Payment successful! Your plan has been upgraded.
            </p>
          </div>
        )}

        {canceled && (
          <div className="mb-6 p-4 rounded-xl border"
               style={{ background: '#ef444410', borderColor: '#ef444440' }}>
            <p style={{ color: '${t.text}' }}>
              Payment was canceled. No changes were made.
            </p>
          </div>
        )}

        <div className="mb-8 p-6 rounded-2xl border"
             style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
          <p className="text-sm mb-1" style={{ color: '${t.text70}' }}>Current Plan</p>
          <p className="text-2xl font-heading font-bold capitalize" style={{ color: '${t.text}' }}>
            {currentTier}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan: any) => (
            <PricingCard
              key={plan.name}
              plan={plan}
              isCurrentPlan={currentTier.toLowerCase() === plan.name.toLowerCase()}
              onUpgrade={() => handleUpgrade(plan.name)}
              loading={checkoutLoading === plan.name}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
`,

    'src/components/PricingCard.tsx': `'use client';

import { Check, Loader2 } from 'lucide-react';

interface PricingPlan {
  name: string;
  price: number;
  features: string[];
}

interface PricingCardProps {
  plan: PricingPlan;
  isCurrentPlan: boolean;
  onUpgrade: () => void;
  loading?: boolean;
  highlighted?: boolean;
}

export default function PricingCard({ plan, isCurrentPlan, onUpgrade, loading, highlighted }: PricingCardProps) {
  const isPro = plan.name.toLowerCase() === 'pro';

  return (
    <div
      className={\`relative rounded-2xl border p-6 flex flex-col transition-all hover:scale-[1.02] \${
        isPro || highlighted ? 'ring-2' : ''
      }\`}
      style={{
        background: '${t.bg}',
        borderColor: isPro || highlighted ? '${t.primary}' : '${t.primary40}',
        ...(isPro || highlighted ? { boxShadow: '0 0 30px ${t.primary}20' } : {}),
      }}
    >
      {(isPro || highlighted) && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
          style={{ background: '${t.gradientPrimary}' }}
        >
          POPULAR
        </div>
      )}

      <h3 className="text-xl font-heading font-bold mb-2" style={{ color: '${t.text}' }}>
        {plan.name}
      </h3>

      <div className="mb-6">
        <span className="text-4xl font-bold" style={{ color: '${t.text}' }}>
          \${plan.price === 0 ? 'Free' : \`$\${plan.price}\`}
        </span>
        {plan.price > 0 && (
          <span className="text-sm ml-1" style={{ color: '${t.text70}' }}>/month</span>
        )}
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feature: string, i: number) => (
          <li key={i} className="flex items-start gap-2">
            <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '${t.primary}' }} />
            <span className="text-sm" style={{ color: '${t.text80}' }}>{feature}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={onUpgrade}
        disabled={isCurrentPlan || loading}
        className="w-full py-3 rounded-xl font-semibold transition-all disabled:opacity-50"
        style={{
          background: isCurrentPlan ? '${t.primary20}' : '${t.primary}',
          color: isCurrentPlan ? '${t.text70}' : 'white',
        }}
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin mx-auto" />
        ) : isCurrentPlan ? (
          'Current Plan'
        ) : plan.price === 0 ? (
          'Downgrade'
        ) : (
          'Upgrade'
        )}
      </button>
    </div>
  );
}
`,
  };
}
