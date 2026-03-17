import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const plans = ctx.stripe.plans || [];

  const plansJson = JSON.stringify(plans.length > 0 ? plans : [
    { name: 'Free', price: 0, features: ['5 analyses/month', 'Basic features', 'Email support'] },
    { name: 'Pro', price: 29, features: ['Unlimited analyses', 'PDF export', 'Priority support', 'API access'] },
    { name: 'Enterprise', price: 99, features: ['Everything in Pro', 'Team management', 'Custom integrations', 'SLA guarantee'] },
  ]);

  return {
    'src/app/pricing/page.tsx': `'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Zap, ArrowRight } from 'lucide-react';

const plans = ${plansJson};

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen py-16 px-6" style={{ background: '${t.bg}' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-heading font-bold mb-4" style={{ color: '${t.text}' }}>
            Тарифные планы
          </h1>
          <p className="text-lg mb-6" style={{ color: '${t.text70}' }}>
            Выберите план, который подходит вашим задачам
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-xl" style={{ background: '${t.primary10}' }}>
            <button
              onClick={() => setAnnual(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: !annual ? '${t.primary}' : 'transparent',
                color: !annual ? 'white' : '${t.text70}',
              }}
            >
              Ежемесячно
            </button>
            <button
              onClick={() => setAnnual(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: annual ? '${t.primary}' : 'transparent',
                color: annual ? 'white' : '${t.text70}',
              }}
            >
              Ежегодно (-20%)
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan: any, i: number) => {
            const isPopular = i === 1;
            const price = annual ? Math.round(plan.price * 0.8) : plan.price;

            return (
              <div
                key={plan.name}
                className={\`rounded-2xl border p-8 relative transition-all hover:scale-[1.02] \${isPopular ? 'ring-2' : ''}\`}
                style={{
                  borderColor: isPopular ? '${t.primary}' : '${t.primary40}',
                  ...(isPopular ? { boxShadow: '0 0 0 2px ${t.primary}' } : {}),
                }}
              >
                {isPopular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: '${t.gradientPrimary}' }}
                  >
                    Популярный
                  </div>
                )}

                <h3 className="text-xl font-heading font-bold mb-2" style={{ color: '${t.text}' }}>
                  {plan.name}
                </h3>

                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ color: '${t.text}' }}>
                    {price === 0 ? 'Бесплатно' : \`$\${price}\`}
                  </span>
                  {price > 0 && (
                    <span className="text-sm ml-1" style={{ color: '${t.text50}' }}>/мес</span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {(plan.features || []).map((feature: string, fi: number) => (
                    <li key={fi} className="flex items-center gap-2 text-sm" style={{ color: '${t.text80}' }}>
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={price === 0 ? '/signup' : '/dashboard/billing'}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                  style={{
                    background: isPopular ? '${t.gradientPrimary}' : '${t.primary10}',
                    color: isPopular ? 'white' : '${t.text}',
                  }}
                >
                  {price === 0 ? 'Начать бесплатно' : 'Выбрать план'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
`,
  };
}
