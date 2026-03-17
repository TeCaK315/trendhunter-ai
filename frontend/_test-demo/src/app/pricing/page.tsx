'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Zap, ArrowRight } from 'lucide-react';

const plans = [{"name":"Free","price":0,"features":["5 analyses/month","Basic reports"],"limits":{}},{"name":"Pro","price":29,"features":["100 analyses/month","Advanced reports","API access"],"limits":{}},{"name":"Enterprise","price":99,"features":["Unlimited","Custom reports","Team access"],"limits":{}}];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="min-h-screen py-16 px-6" style={{ background: '#0f0f23' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-heading font-bold mb-4" style={{ color: '#e2e8f0' }}>
            Тарифные планы
          </h1>
          <p className="text-lg mb-6" style={{ color: '#e2e8f070' }}>
            Выберите план, который подходит вашим задачам
          </p>

          {/* Annual toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-xl" style={{ background: '#6366f110' }}>
            <button
              onClick={() => setAnnual(false)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: !annual ? '#6366f1' : 'transparent',
                color: !annual ? 'white' : '#e2e8f070',
              }}
            >
              Ежемесячно
            </button>
            <button
              onClick={() => setAnnual(true)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: annual ? '#6366f1' : 'transparent',
                color: annual ? 'white' : '#e2e8f070',
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
                className={`rounded-2xl border p-8 relative transition-all hover:scale-[1.02] ${isPopular ? 'ring-2' : ''}`}
                style={{
                  borderColor: isPopular ? '#6366f1' : '#6366f140',
                  ...(isPopular ? { boxShadow: '0 0 0 2px #6366f1' } : {}),
                }}
              >
                {isPopular && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                  >
                    Популярный
                  </div>
                )}

                <h3 className="text-xl font-heading font-bold mb-2" style={{ color: '#e2e8f0' }}>
                  {plan.name}
                </h3>

                <div className="mb-6">
                  <span className="text-4xl font-bold" style={{ color: '#e2e8f0' }}>
                    {price === 0 ? 'Бесплатно' : `$${price}`}
                  </span>
                  {price > 0 && (
                    <span className="text-sm ml-1" style={{ color: '#e2e8f050' }}>/мес</span>
                  )}
                </div>

                <ul className="space-y-3 mb-8">
                  {(plan.features || []).map((feature: string, fi: number) => (
                    <li key={fi} className="flex items-center gap-2 text-sm" style={{ color: '#e2e8f080' }}>
                      <Check className="w-4 h-4 flex-shrink-0" style={{ color: '#22c55e' }} />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link
                  href={price === 0 ? '/signup' : '/dashboard/billing'}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90"
                  style={{
                    background: isPopular ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#6366f110',
                    color: isPopular ? 'white' : '#e2e8f0',
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
