import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens, escapeJsx } from '../design-injector';

const ICON_NAMES = ['Zap', 'Target', 'LineChart', 'Shield', 'Lightbulb', 'Globe', 'Gauge', 'FileSearch', 'Users', 'BarChart'];

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;
  const spec = ctx.product_spec;

  // ─── Hero content ───
  const headline = ctx.safe.headline
    || ctx.safe.projectDescription
    || 'Automate Your Workflow with ' + name;

  const timeToValue = spec?.user_flow?.total_time_to_value
    ? escapeJsx(spec.user_flow.total_time_to_value)
    : '';
  // Subtitle — never duplicate headline, always use a different text
  const heroSubtitle = timeToValue
    ? `Get your ${ctx.safe.primaryOutput || 'result'} in ${timeToValue}. Save time, reduce errors.`
    : 'Save time, reduce errors, and focus on what matters most.';

  const primaryOutput = ctx.safe.primaryOutput || 'result';

  // ─── Features from derived_features ───
  const derivedFeatures = (ctx.derived_features || [])
    .filter(f => f.priority !== 'nice_to_have')
    .slice(0, 6);

  const features = derivedFeatures.length > 0
    ? derivedFeatures.map((f, i) => ({
        icon: ICON_NAMES[i % ICON_NAMES.length],
        title: f.feature_name,
        description: f.solution,
      }))
    : [
        { icon: 'Zap', title: 'Lightning Fast', description: 'Get results in seconds, not hours. Our engine processes your data instantly.' },
        { icon: 'Shield', title: 'Secure & Private', description: 'Your data stays yours. Enterprise-grade security with end-to-end encryption.' },
        { icon: 'BarChart', title: 'Actionable Insights', description: 'Not just data — clear recommendations you can act on immediately.' },
        { icon: 'Target', title: 'Smart Automation', description: 'Set it once and let AI handle the rest. Save hours every week.' },
      ];

  const featuresJson = JSON.stringify(features, null, 2);

  // ─── How it Works ───
  const steps = (spec?.user_flow?.steps || []).slice(0, 3).map(s => ({
    step: s.step_number,
    action: s.action,
    detail: s.user_sees,
  }));
  if (steps.length === 0) {
    steps.push(
      { step: 1, action: 'Enter your data', detail: 'Fill in the simple form with your information' },
      { step: 2, action: 'AI processes it', detail: 'Our engine analyzes and generates your output' },
      { step: 3, action: 'Get your result', detail: 'Download, export, or share your professional result' },
    );
  }
  const stepsJson = JSON.stringify(steps, null, 2);

  // ─── Pain points ───
  const painQuotes = derivedFeatures
    .filter(f => f.pain_quote && f.pain_quote.length > 10)
    .slice(0, 3)
    .map(f => ({ quote: f.pain_quote, source: f.pain_source }));
  const painQuotesJson = JSON.stringify(painQuotes, null, 2);
  const hasPainQuotes = painQuotes.length > 0;

  // ─── Pricing ───
  let plans = ctx.stripe?.plans?.length
    ? [...ctx.stripe.plans]
    : [
        { name: 'Starter', price: 0, features: [`5 ${primaryOutput}s/month`, 'Basic export', 'Email support'] },
        { name: 'Pro', price: 19, features: [`Unlimited ${primaryOutput}s`, 'PDF export', 'Priority support', 'Custom branding'] },
        { name: 'Business', price: 49, features: ['Everything in Pro', 'Team collaboration', 'API access', 'Dedicated support', 'Analytics dashboard'] },
      ];
  if (plans.length === 1) {
    const existing = plans[0];
    plans = [
      { name: 'Starter', price: 0, features: ['Limited access', 'Basic features'] },
      existing,
      { name: 'Business', price: (existing.price || 19) * 3, features: Array.from(new Set([...(existing.features || []), 'API access', 'Team collaboration', 'Dedicated support'])) },
    ];
  }
  const plansJson = JSON.stringify(plans, null, 2);

  // Icons
  const usedIcons = Array.from(new Set(features.map(f => f.icon)));
  const iconImports = usedIcons.join(', ');

  return {
    'src/app/page.tsx': `'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { Sparkles, Check, ArrowRight, Menu, X, Star, ChevronRight, ${iconImports} } from 'lucide-react';
import { useT } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

const PLANS = ${plansJson};
const FEATURES = ${featuresJson};
const STEPS = ${stepsJson};
${hasPainQuotes ? `const PAIN_POINTS = ${painQuotesJson};` : ''}

function FeatureIcon({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const icons: Record<string, any> = { ${usedIcons.join(', ')} };
  const Icon = icons[name] || Sparkles;
  return <Icon className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />;
}

/* ─── Animated counter ─── */
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const duration = 1800;
    const step = Math.max(1, Math.floor(target / (duration / 16)));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <>{count.toLocaleString()}{suffix}</>;
}

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = useT();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: '${t.bg}', color: '${t.text}' }}>

      {/* ═══════════ HEADER — glass morphism ═══════════ */}
      <header
        className="sticky top-0 z-50 transition-all duration-500"
        style={{
          background: scrolled ? '${t.bg}cc' : 'transparent',
          backdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(24px) saturate(1.4)' : 'none',
          borderBottom: scrolled ? '1px solid ${t.primary}12' : '1px solid transparent',
          boxShadow: scrolled ? '0 4px 30px ${t.primary}08' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
              style={{ background: '${t.gradientPrimary}', boxShadow: '0 0 20px ${t.primary}40' }}
            >
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'${t.headingFont}', sans-serif" }}>
              ${name}
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {[
              { key: 'landing.features', anchor: 'features' },
              { key: 'landing.howItWorks', anchor: 'how-it-works' },
              { key: 'landing.pricing', anchor: 'pricing' },
            ].map(item => (
              <a
                key={item.anchor}
                href={\`#\${item.anchor}\`}
                className="px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:bg-white/[0.06]"
                style={{ color: '${t.text70}' }}
              >
                {t(item.key)}
              </a>
            ))}
            <LanguageSwitcher compact />
            <div className="w-px h-5 mx-3" style={{ background: '${t.primary}15' }} />
            <Link href="/login" className="px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:bg-white/[0.06]" style={{ color: '${t.text70}' }}>{t('nav.signIn')}</Link>
            <Link
              href="/dashboard"
              className="ml-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-300 hover:scale-[1.03]"
              style={{ background: '${t.gradientPrimary}', boxShadow: '0 0 24px ${t.primary}30' }}
            >
              {t('nav.getStarted')}
            </Link>
          </nav>

          <button
            className="md:hidden p-2 rounded-lg"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{ color: '${t.text}' }}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden px-6 py-4 space-y-1" style={{ background: '${t.bg}f0', backdropFilter: 'blur(20px)', borderTop: '1px solid ${t.primary}10' }}>
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm" style={{ color: '${t.text70}' }}>{t('landing.features')}</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm" style={{ color: '${t.text70}' }}>{t('landing.howItWorks')}</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2.5 rounded-lg text-sm" style={{ color: '${t.text70}' }}>{t('landing.pricing')}</a>
            <div className="py-2"><LanguageSwitcher /></div>
            <div className="pt-2 flex flex-col gap-2">
              <Link href="/login" className="px-3 py-2.5 rounded-lg text-sm text-center" style={{ color: '${t.text70}' }}>{t('nav.signIn')}</Link>
              <Link href="/dashboard" className="px-3 py-2.5 rounded-xl text-sm font-semibold text-white text-center" style={{ background: '${t.gradientPrimary}' }}>{t('nav.getStarted')}</Link>
            </div>
          </div>
        )}
      </header>

      {/* ═══════════ HERO — dramatic glow + gradient text ═══════════ */}
      <section className="relative overflow-hidden">
        {/* Ambient orbs — visible this time */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-30%] right-[-5%] w-[800px] h-[800px] rounded-full" style={{ background: 'radial-gradient(circle, ${t.primary}18 0%, transparent 70%)', filter: 'blur(80px)' }} />
          <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, ${t.accent}12 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute top-[20%] left-[50%] w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, ${t.secondary}10 0%, transparent 70%)', filter: 'blur(100px)' }} />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(${t.primary}06 1px, transparent 1px), linear-gradient(90deg, ${t.primary}06 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 100%)',
        }} />

        <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-20 md:pt-40 md:pb-32 text-center">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-10 transition-all duration-300 hover:scale-105 cursor-default"
            style={{
              background: '${t.primary}10',
              color: '${t.primary}',
              border: '1px solid ${t.primary}20',
              boxShadow: '0 0 20px ${t.primary}10',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            ${timeToValue || 'Fast, accurate, professional'}
          </div>

          {/* Gradient headline */}
          <h1
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold leading-[1.05] tracking-tight mb-8"
            style={{
              fontFamily: "'${t.headingFont}', sans-serif",
              background: 'linear-gradient(135deg, ${t.text} 0%, ${t.text} 40%, ${t.primary} 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ${headline}
          </h1>

          <p className="text-lg sm:text-xl md:text-2xl mb-14 max-w-2xl mx-auto leading-relaxed font-light" style={{ color: '${t.text60}' }}>
            ${heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="group w-full sm:w-auto px-8 py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 transition-all duration-300 hover:scale-[1.03]"
              style={{ background: '${t.gradientPrimary}', boxShadow: '0 0 40px ${t.primary}30, 0 8px 32px ${t.primary}20' }}
            >
              {t('landing.getStartedFree')}
              <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
            <a
              href="#how-it-works"
              className="group w-full sm:w-auto px-8 py-4 rounded-2xl font-semibold transition-all duration-300 hover:bg-white/[0.06] text-center flex items-center justify-center gap-2"
              style={{ border: '1px solid ${t.primary}20', color: '${t.text}' }}
            >
              {t('landing.seeHowItWorks')}
              <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-0.5" style={{ color: '${t.text50}' }} />
            </a>
          </div>
        </div>
      </section>

      {/* Social proof / stats bar removed — hardcoded numbers undermine trust on day-1 launch.
          Add back when real metrics exist (e.g. via product_spec.metrics.active_users). */}

${hasPainQuotes ? `      {/* ═══════════ PROBLEM — glassmorphism quotes ═══════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: '${t.primary}' }}>{t('landing.sectionProblem')}</p>
            <h2
              className="text-3xl md:text-5xl font-bold"
              style={{ fontFamily: "'${t.headingFont}', sans-serif" }}
            >
              {t('landing.soundFamiliar')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PAIN_POINTS.map((p: any, i: number) => (
              <div
                key={i}
                className="rounded-2xl p-7 transition-all duration-300 hover:translate-y-[-4px]"
                style={{
                  background: '${t.surface1}',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid ${t.primary}12',
                  boxShadow: '${t.shadowSm}',
                }}
              >
                <div className="text-4xl mb-4 leading-none" style={{ color: '${t.primary}', opacity: 0.6 }}>&ldquo;</div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: '${t.text80}' }}>
                  {p.quote}
                </p>
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full" style={{ background: '${t.primary}' }} />
                  <span className="text-[11px] uppercase tracking-wider font-semibold" style={{ color: '${t.text40}' }}>
                    {p.source.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
` : ''}

      {/* ═══════════ FEATURES — bento grid ═══════════ */}
      <section id="features" className="py-24 md:py-32 px-6 relative">
        {/* Section glow */}
        <div className="absolute right-0 top-[20%] w-[500px] h-[500px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, ${t.primary}08 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: '${t.primary}' }}>{t('landing.sectionFeatures')}</p>
            <h2
              className="text-3xl md:text-5xl font-bold mb-5"
              style={{ fontFamily: "'${t.headingFont}', sans-serif" }}
            >
              {t('${derivedFeatures.length > 0 ? 'landing.builtToSolve' : 'landing.everythingYouNeed'}')}
            </h2>
            <p className="text-base md:text-lg max-w-xl mx-auto" style={{ color: '${t.text50}' }}>
              {t('${derivedFeatures.length > 0 ? 'landing.everyFeature' : 'landing.powerfulTools'}')}
            </p>
          </div>

          {/* Bento grid: first 2 large, rest normal */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((feature: any, i: number) => {
              const isLarge = i < 2 && FEATURES.length >= 4;
              return (
                <div
                  key={i}
                  className={\`group relative rounded-2xl p-7 transition-all duration-500 hover:translate-y-[-4px] overflow-hidden\${isLarge ? ' sm:col-span-1 lg:col-span-1 lg:row-span-1' : ''}\`}
                  style={{
                    background: '${t.surface1}',
                    border: '1px solid ${t.primary}10',
                    boxShadow: '${t.shadowSm}',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '${t.shadowMd}, 0 0 40px ${t.primary}08';
                    e.currentTarget.style.borderColor = '${t.primary}25';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '${t.shadowSm}';
                    e.currentTarget.style.borderColor = '${t.primary}10';
                  }}
                >
                  {/* Hover glow */}
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                    style={{ background: 'radial-gradient(circle at 50% 0%, ${t.primary}08, transparent 70%)' }}
                  />
                  <div className="relative">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110"
                      style={{ background: '${t.primary}15', color: '${t.primary}' }}
                    >
                      <FeatureIcon name={feature.icon} />
                    </div>
                    <h3 className="text-base font-semibold mb-2.5" style={{ fontFamily: "'${t.headingFont}', sans-serif" }}>
                      {feature.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: '${t.text50}' }}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ HOW IT WORKS — connected steps ═══════════ */}
      <section id="how-it-works" className="py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: '${t.primary}' }}>{t('landing.sectionHowItWorks')}</p>
            <h2
              className="text-3xl md:text-5xl font-bold mb-5"
              style={{ fontFamily: "'${t.headingFont}', sans-serif" }}
            >
              {t('landing.threeSteps')}
            </h2>
            <p className="text-base md:text-lg" style={{ color: '${t.text50}' }}>
              ${timeToValue ? `{t('landing.fromStartToFinish')}` : `{t('landing.fromStartToFinish')}`}
            </p>
          </div>
          <div className="relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-[52px] left-[16.6%] right-[16.6%] h-px" style={{ background: 'linear-gradient(90deg, transparent, ${t.primary}30, ${t.primary}30, transparent)' }} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map((step: any, i: number) => (
                <div key={i} className="relative text-center group">
                  {/* Step number orb */}
                  <div className="relative inline-flex mb-8">
                    <div
                      className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-xl font-bold text-white transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: '${t.gradientPrimary}',
                        boxShadow: '0 0 30px ${t.primary}30, 0 8px 24px ${t.primary}15',
                      }}
                    >
                      {step.step}
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold mb-3" style={{ fontFamily: "'${t.headingFont}', sans-serif" }}>
                    {step.action}
                  </h3>
                  <p className="text-sm leading-relaxed max-w-[260px] mx-auto" style={{ color: '${t.text50}' }}>
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ PRICING — glass cards + featured glow ═══════════ */}
      <section id="pricing" className="py-24 md:py-32 px-6 relative">
        {/* Section glow */}
        <div className="absolute left-[10%] top-[30%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, ${t.primary}08 0%, transparent 70%)', filter: 'blur(60px)' }} />

        <div className="relative max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-4" style={{ color: '${t.primary}' }}>{t('landing.sectionPricing')}</p>
            <h2
              className="text-3xl md:text-5xl font-bold mb-5"
              style={{ fontFamily: "'${t.headingFont}', sans-serif" }}
            >
              {t('landing.startFree')}
            </h2>
            <p className="text-base md:text-lg" style={{ color: '${t.text50}' }}>
              {t('landing.noCreditCard')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
            {PLANS.map((plan: any, i: number) => {
              const isPro = i === 1;
              return (
                <div
                  key={i}
                  className={\`relative rounded-2xl p-8 flex flex-col transition-all duration-500 hover:translate-y-[-4px]\${isPro ? ' md:scale-[1.05] md:z-10' : ''}\`}
                  style={{
                    background: isPro ? '${t.surface2}' : '${t.surface1}',
                    border: isPro ? '1px solid ${t.primary}30' : '1px solid ${t.primary}10',
                    boxShadow: isPro
                      ? '${t.shadowLg}, 0 0 60px ${t.primary}15, 0 0 120px ${t.primary}08'
                      : '${t.shadowSm}',
                  }}
                >
                  {isPro && (
                    <div
                      className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold text-white tracking-wide uppercase"
                      style={{ background: '${t.gradientPrimary}', boxShadow: '0 0 20px ${t.primary}30' }}
                    >
                      {t('landing.mostPopular')}
                    </div>
                  )}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold mb-2" style={{ fontFamily: "'${t.headingFont}', sans-serif" }}>
                      {plan.name}
                    </h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-extrabold tracking-tight">
                        {plan.price === 0 ? t('landing.free') : \`$\${plan.price}\`}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-sm font-medium" style={{ color: '${t.text40}' }}>{t('landing.perMonth')}</span>
                      )}
                    </div>
                  </div>
                  <ul className="space-y-3.5 mb-10 flex-1">
                    {plan.features.map((f: string, j: number) => (
                      <li key={j} className="flex items-start gap-3">
                        <div className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '${t.accent}18' }}>
                          <Check className="w-3 h-3" style={{ color: '${t.accent}' }} />
                        </div>
                        <span className="text-sm" style={{ color: '${t.text70}' }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/dashboard"
                    className="w-full py-3.5 rounded-xl font-semibold text-sm text-center block transition-all duration-300 hover:scale-[1.02]"
                    style={{
                      background: isPro ? '${t.gradientPrimary}' : 'transparent',
                      color: isPro ? 'white' : '${t.text}',
                      border: isPro ? 'none' : '1px solid ${t.primary}18',
                      boxShadow: isPro ? '0 0 30px ${t.primary}25' : 'none',
                    }}
                  >
                    {plan.price === 0 ? t('nav.getStarted') : t('landing.startFreeTrial')}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ CTA — prominent glow section ═══════════ */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="relative overflow-hidden rounded-3xl p-14 md:p-20"
            style={{
              background: '${t.surface1}',
              border: '1px solid ${t.primary}15',
              boxShadow: '${t.shadowLg}, 0 0 80px ${t.primary}10',
            }}
          >
            {/* Multiple background glows */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute top-[-60%] left-[10%] w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, ${t.primary}12 0%, transparent 70%)', filter: 'blur(60px)' }} />
              <div className="absolute bottom-[-40%] right-[10%] w-[400px] h-[400px] rounded-full" style={{ background: 'radial-gradient(circle, ${t.accent}08 0%, transparent 70%)', filter: 'blur(60px)' }} />
            </div>
            <div className="relative">
              <h2
                className="text-3xl md:text-5xl font-bold mb-5"
                style={{ fontFamily: "'${t.headingFont}', sans-serif" }}
              >
                {t('landing.readyToStart')}
              </h2>
              <p className="text-base md:text-lg mb-10" style={{ color: '${t.text50}' }}>
                {t('landing.joinUsers')}
              </p>
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2.5 px-10 py-4 rounded-2xl font-semibold text-white text-lg transition-all duration-300 hover:scale-[1.03]"
                style={{ background: '${t.gradientPrimary}', boxShadow: '0 0 40px ${t.primary}30, 0 8px 32px ${t.primary}20' }}
              >
                {t('landing.createFirst')} ${primaryOutput}
                <ArrowRight className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ FOOTER ═══════════ */}
      <footer className="py-12 px-6" style={{ borderTop: '1px solid ${t.primary}08' }}>
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '${t.gradientPrimary}' }}>
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold">${name}</span>
          </div>
          <div className="flex items-center gap-6 text-xs" style={{ color: '${t.text50}' }}>
            <Link href="/privacy" className="hover:opacity-80 transition-opacity">{t('legal.privacyPolicy')}</Link>
            <Link href="/terms" className="hover:opacity-80 transition-opacity">{t('legal.termsOfService')}</Link>
            <Link href="/about" className="hover:opacity-80 transition-opacity">{t('legal.aboutUs')}</Link>
            <Link href="/faq" className="hover:opacity-80 transition-opacity">{t('legal.faq')}</Link>
          </div>
          <p className="text-xs" style={{ color: '${t.text40}' }}>
            &copy; {new Date().getFullYear()} ${name}
          </p>
        </div>
      </footer>
    </div>
  );
}
`,
  };
}
