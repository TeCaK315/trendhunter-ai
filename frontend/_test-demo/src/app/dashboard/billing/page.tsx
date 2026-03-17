'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import PricingCard from '@/components/PricingCard';
import { CreditCard, Check, Loader2 } from 'lucide-react';

const PLANS = [
  {
    "name": "Free",
    "price": 0,
    "features": [
      "5 analyses/month",
      "Basic reports"
    ],
    "limits": {}
  },
  {
    "name": "Pro",
    "price": 29,
    "features": [
      "100 analyses/month",
      "Advanced reports",
      "API access"
    ],
    "limits": {}
  },
  {
    "name": "Enterprise",
    "price": 99,
    "features": [
      "Unlimited",
      "Custom reports",
      "Team access"
    ],
    "limits": {}
  }
];

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f23' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#0f0f23' }}>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <CreditCard className="w-8 h-8" style={{ color: '#6366f1' }} />
          <h1 className="text-3xl font-heading font-bold" style={{ color: '#e2e8f0' }}>
            Billing & Plans
          </h1>
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-xl border flex items-center gap-3"
               style={{ background: '#6366f110', borderColor: '#6366f140' }}>
            <Check className="w-5 h-5" style={{ color: '#6366f1' }} />
            <p style={{ color: '#e2e8f0' }}>
              Payment successful! Your plan has been upgraded.
            </p>
          </div>
        )}

        {canceled && (
          <div className="mb-6 p-4 rounded-xl border"
               style={{ background: '#ef444410', borderColor: '#ef444440' }}>
            <p style={{ color: '#e2e8f0' }}>
              Payment was canceled. No changes were made.
            </p>
          </div>
        )}

        <div className="mb-8 p-6 rounded-2xl border"
             style={{ background: '#6366f110', borderColor: '#6366f140' }}>
          <p className="text-sm mb-1" style={{ color: '#e2e8f070' }}>Current Plan</p>
          <p className="text-2xl font-heading font-bold capitalize" style={{ color: '#e2e8f0' }}>
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
