'use client';

import Link from 'next/link';
import { Sparkles, Check, ArrowRight, Zap, Target, LineChart, Shield, Lightbulb, Globe } from 'lucide-react';

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

const FEATURES = [
  {
    "icon": "Zap",
    "title": "Product Catalog",
    "description": "catalog каталог товары магазин"
  },
  {
    "icon": "Target",
    "title": "Shopping Cart",
    "description": "cart корзина покупка"
  },
  {
    "icon": "LineChart",
    "title": "AI Chatbot",
    "description": "chatbot чатбот"
  },
  {
    "icon": "Shield",
    "title": "Data Charts",
    "description": "charts analytics графики"
  },
  {
    "icon": "Lightbulb",
    "title": "Dark Mode",
    "description": "dark mode тёмная тема"
  },
  {
    "icon": "Globe",
    "title": "Search",
    "description": "search поиск"
  }
];

const STEPS = [
  {
    "step": 1,
    "action": "Enter your market query",
    "detail": "Input form"
  },
  {
    "step": 2,
    "action": "Review analysis",
    "detail": "Results dashboard"
  }
];

const PAIN_POINTS = [
  {
    "quote": "catalog shop store",
    "source": "unmet_need"
  },
  {
    "quote": "cart checkout",
    "source": "unmet_need"
  }
];

function FeatureIcon({ name }: { name: string }) {
  const icons: Record<string, any> = { Zap, Target, LineChart, Shield, Lightbulb, Globe };
  const Icon = icons[name] || Sparkles;
  return <Icon className="w-6 h-6" />;
}

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0f0f23', color: '#e2e8f0', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <header className="border-b" style={{ borderColor: '#6366f120' }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>
              MaxTest App
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm transition-colors hover:opacity-80" style={{ color: '#e2e8f070' }}>Возможности</a>
            <a href="#how-it-works" className="text-sm transition-colors hover:opacity-80" style={{ color: '#e2e8f070' }}>Как это работает</a>
            <a href="#pricing" className="text-sm transition-colors hover:opacity-80" style={{ color: '#e2e8f070' }}>Тарифы</a>
            <Link href="/login" className="text-sm transition-colors hover:opacity-80" style={{ color: '#e2e8f070' }}>Войти</Link>
            <Link
              href="/signup"
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: '#6366f1' }}
            >
              Начать
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-8"
            style={{ background: '#6366f110', color: '#6366f1' }}
          >
            <Sparkles className="w-4 h-4" />
            <span>На базе ИИ</span>
          </div>
          <h1
            className="text-4xl md:text-6xl font-bold leading-tight mb-6"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            Get instant AI market analysis with actionable insights
          </h1>
          <p className="text-lg md:text-xl mb-10 max-w-2xl mx-auto" style={{ color: '#e2e8f070' }}>
            AI-powered market analysis report. 3 minutes.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/signup"
              className="px-8 py-4 rounded-xl font-semibold text-white text-lg flex items-center gap-2 transition-all hover:opacity-90 hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              Начать бесплатно <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="#features"
              className="px-8 py-4 rounded-xl font-semibold text-lg border transition-all hover:bg-white/5"
              style={{ borderColor: '#6366f140', color: '#e2e8f0' }}
            >
              Подробнее
            </Link>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
            Проблема
          </h2>
          <p className="text-lg mb-12" style={{ color: '#e2e8f070' }}>
            Реальные отзывы пользователей о существующих решениях
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PAIN_POINTS.map((p: any, i: number) => (
              <div
                key={i}
                className="rounded-2xl border p-6 text-left"
                style={{ background: '#6366f110', borderColor: '#6366f120' }}
              >
                <p className="text-lg italic mb-3" style={{ color: '#e2e8f080' }}>
                  &ldquo;{p.quote}&rdquo;
                </p>
                <span className="text-xs uppercase tracking-wider" style={{ color: '#e2e8f050' }}>
                  Источник: {p.source.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6" style={{ background: '#6366f110' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Наше решение
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: '#e2e8f070' }}>
              Функции, созданные на основе реальных потребностей пользователей.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {FEATURES.map((feature: any, i: number) => (
              <div
                key={i}
                className="rounded-2xl border p-8 transition-all hover:scale-[1.02]"
                style={{ background: '#0f0f23', borderColor: '#6366f140' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ background: '#6366f120', color: '#6366f1' }}
                >
                  <FeatureIcon name={feature.icon} />
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {feature.title}
                </h3>
                <p style={{ color: '#e2e8f070' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Как это работает
            </h2>
            <p className="text-lg" style={{ color: '#e2e8f070' }}>
              Результат за 3 minutes
            </p>
          </div>
          <div className="space-y-8">
            {STEPS.map((step: any, i: number) => (
              <div key={i} className="flex items-start gap-6">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  {step.step}
                </div>
                <div className="pt-2">
                  <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {step.action}
                  </h3>
                  <p style={{ color: '#e2e8f070' }}>
                    {step.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: 'Inter, sans-serif' }}>
              Простые и понятные тарифы
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: '#e2e8f070' }}>
              Начните бесплатно, расширяйте по мере роста.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {PLANS.map((plan: any, i: number) => {
              const isPro = plan.name.toLowerCase() === 'pro';
              return (
                <div
                  key={i}
                  className={`relative rounded-2xl border p-8 flex flex-col ${isPro ? 'ring-2' : ''}`}
                  style={{
                    background: '#0f0f23',
                    borderColor: isPro ? '#6366f1' : '#6366f140',
                    ...(isPro ? { boxShadow: '0 0 40px #6366f115' } : {}),
                  }}
                >
                  {isPro && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                    >
                      ПОПУЛЯРНЫЙ
                    </div>
                  )}
                  <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'Inter, sans-serif' }}>
                    {plan.name}
                  </h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold">
                      {plan.price === 0 ? 'Бесплатно' : `$${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm ml-1" style={{ color: '#e2e8f070' }}>/мес</span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f: string, j: number) => (
                      <li key={j} className="flex items-start gap-2">
                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#6366f1' }} />
                        <span className="text-sm" style={{ color: '#e2e8f080' }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className="w-full py-3 rounded-xl font-semibold text-center block transition-all hover:opacity-90"
                    style={{
                      background: isPro ? '#6366f1' : '#6366f120',
                      color: isPro ? 'white' : '#e2e8f0',
                    }}
                  >
                    {plan.price === 0 ? 'Начать' : 'Попробовать'}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-6" style={{ borderColor: '#6366f120' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>
              MaxTest App
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm" style={{ color: '#e2e8f050' }}>
            <a href="#" className="hover:opacity-80 transition-colors">Конфиденциальность</a>
            <a href="#" className="hover:opacity-80 transition-colors">Условия</a>
            <a href="#" className="hover:opacity-80 transition-colors">Контакты</a>
          </div>
          <p className="text-sm" style={{ color: '#e2e8f050' }}>
            &copy; {new Date().getFullYear()} MaxTest App. Все права защищены.
          </p>
        </div>
      </footer>
    </div>
  );
}
