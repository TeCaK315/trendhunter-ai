'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import EvidenceBadge from '../EvidenceBadge';

interface LandingStats {
  landing_id: string;
  total_views: number;
  unique_views: number;
  total_signups: number;
  total_cta_clicks: number;
  conversion_rate: number;
  pmf_verdict: 'confirmed' | 'promising' | 'needs_work' | 'insufficient_data';
  signups: Array<{ email: string; timestamp: string }>;
  daily_stats: Array<{ date: string; views: number; signups: number }>;
}

interface LandingConfig {
  tagline: string;
  value_proposition: string;
  pain_points: string[];
  features: Array<{ title: string; description: string }>;
  pricing_enabled: boolean;
  pricing_tiers: Array<{ name: string; price: string; features: string }>;
  cta_text: string;
}

interface Props {
  trendId: string;
  trendTitle: string;
  evidenceData: Record<string, any>;
}

export default function LandingPageGenerator({ trendId, trendTitle, evidenceData }: Props) {
  const [mode, setMode] = useState<'editor' | 'preview' | 'deploying' | 'dashboard'>('editor');
  const [config, setConfig] = useState<LandingConfig | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [landingUrl, setLandingUrl] = useState<string | null>(null);
  const [stats, setStats] = useState<LandingStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Extract defaults from evidence data
  const defaults = useMemo(() => {
    const complaints = evidenceData?.problem?.who_hurts?.complaints || [];
    const painTexts = complaints.map((c: any) => c.text?.substring(0, 120) || '').filter(Boolean);

    const competitors = evidenceData?.occupation?.competitors_exist?.competitors || [];
    const derivedFeatures = competitors.slice(0, 3).map((c: any) => ({
      title: c.name || 'Solution',
      description: `Better than ${c.name}: ${c.description?.substring(0, 80) || 'improved approach'}`,
    }));

    // Try GTM data if available
    const gtmPositioning = evidenceData?.gtm_plan?.positioning;
    const gtmPricing = evidenceData?.gtm_plan?.pricing_strategy;

    const tagline = gtmPositioning?.tagline || `${trendTitle} — a better way`;
    const valueProp = gtmPositioning?.value_proposition ||
      `Solving the #1 pain point in ${trendTitle}. Join the waitlist for early access.`;

    const pricingTiers = gtmPricing?.tiers?.map((t: any) => ({
      name: t.name || 'Plan',
      price: t.price || '$0',
      features: t.features || '',
    })) || [];

    // Features from product spec or evidence
    const productFeatures = evidenceData?.product_spec?.derived_features?.map((f: any) => ({
      title: f.feature_name || 'Feature',
      description: f.solution || f.implementation_hint || '',
    })) || [];

    const features = productFeatures.length > 0 ? productFeatures.slice(0, 6) : [
      ...derivedFeatures,
      { title: 'Fast & Simple', description: 'Get started in minutes, not days' },
      { title: 'Data-Driven', description: 'Built on real market research and user feedback' },
      { title: 'Affordable', description: 'Pricing that makes sense for your business' },
    ].slice(0, 6);

    return { tagline, valueProp, painTexts, features, pricingTiers };
  }, [evidenceData, trendTitle]);

  // Initialize config from defaults
  useEffect(() => {
    if (!config) {
      setConfig({
        tagline: defaults.tagline,
        value_proposition: defaults.valueProp,
        pain_points: defaults.painTexts.slice(0, 5),
        features: defaults.features,
        pricing_enabled: defaults.pricingTiers.length > 0,
        pricing_tiers: defaults.pricingTiers,
        cta_text: 'Get Early Access',
      });
    }
  }, [defaults, config]);

  // Check for existing landing
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const res = await fetch(`/api/landing-analytics?landing_id=${trendId}`);
        const data = await res.json();
        if (data.landing_info?.landing_url) {
          setLandingUrl(data.landing_info.landing_url);
          setStats(data);
          setMode('dashboard');
        }
      } catch { /* no existing landing */ }
    };
    checkExisting();
  }, [trendId]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/landing-analytics?landing_id=${trendId}`);
      const data = await res.json();
      setStats(data);
    } catch { /* ignore */ }
  }, [trendId]);

  const handleDeploy = async () => {
    if (!config) return;
    setDeploying(true);
    setError(null);
    setMode('deploying');

    try {
      const analyticsEndpoint = `${window.location.origin}/api/landing-analytics`;
      const res = await fetch('/api/generate-landing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trendId,
          trend_title: trendTitle,
          positioning: {
            tagline: config.tagline,
            value_proposition: config.value_proposition,
          },
          pain_points: config.pain_points,
          features: config.features,
          pricing: config.pricing_enabled ? {
            model: 'subscription',
            tiers: config.pricing_tiers,
          } : undefined,
          cta_text: config.cta_text,
          analytics_endpoint: analyticsEndpoint,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Deploy failed');
      }

      setLandingUrl(data.landing_url);
      setMode('dashboard');
      // Fetch initial stats after short delay
      setTimeout(fetchStats, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setMode('editor');
    } finally {
      setDeploying(false);
    }
  };

  const generatePreview = () => {
    if (!config) return;
    // Simple inline preview
    setPreviewHtml(`
      <div style="font-family:system-ui;background:#0a0a0f;color:#e4e4e7;padding:40px;min-height:400px">
        <div style="text-align:center;padding:60px 20px">
          <h1 style="font-size:2rem;font-weight:800;color:#fff;margin-bottom:16px">${config.tagline}</h1>
          <p style="color:#a1a1aa;font-size:1.1rem;max-width:500px;margin:0 auto 30px">${config.value_proposition}</p>
          <div style="display:inline-block;padding:14px 36px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;border-radius:12px;font-weight:600">${config.cta_text}</div>
        </div>
        ${config.pain_points.length > 0 ? `
          <div style="padding:40px 20px;background:#0c0c14;border-radius:12px;margin:20px 0">
            <h2 style="text-align:center;color:#fff;margin-bottom:24px">The Problem</h2>
            ${config.pain_points.slice(0, 3).map(p => `<div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:16px;margin-bottom:12px;color:#a1a1aa;font-size:0.9rem">⚠️ ${p}</div>`).join('')}
          </div>
        ` : ''}
        ${config.features.length > 0 ? `
          <div style="padding:40px 20px">
            <h2 style="text-align:center;color:#fff;margin-bottom:24px">How We Solve It</h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">
              ${config.features.slice(0, 4).map(f => `<div style="background:#18181b;border:1px solid #27272a;border-radius:8px;padding:20px"><h3 style="color:#fff;margin-bottom:8px;font-size:0.95rem">${f.title}</h3><p style="color:#a1a1aa;font-size:0.85rem">${f.description}</p></div>`).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `);
    setMode('preview');
  };

  const copyUrl = () => {
    if (landingUrl) {
      navigator.clipboard.writeText(landingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!config) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Landing Page Validation</h2>
          <p className="text-zinc-400 text-sm mt-1">
            Быстрый лендинг для проверки спроса — деплой за 30 секунд
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'dashboard' && <EvidenceBadge type="real_data" label="Live данные" />}
          <EvidenceBadge type="ai_synthesis" label="Auto-generated" />
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Mode tabs */}
      {landingUrl && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMode('editor')}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${mode === 'editor' ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-400 hover:text-zinc-300'}`}
          >
            Редактор
          </button>
          <button
            onClick={() => { setMode('dashboard'); fetchStats(); }}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${mode === 'dashboard' ? 'bg-indigo-500/20 text-indigo-300' : 'text-zinc-400 hover:text-zinc-300'}`}
          >
            Dashboard
          </button>
        </div>
      )}

      {/* ─── Editor Mode ─── */}
      {mode === 'editor' && (
        <div className="space-y-4">
          {/* Tagline */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <label className="text-xs text-zinc-500 mb-1 block">Tagline (заголовок)</label>
            <input
              value={config.tagline}
              onChange={e => setConfig({ ...config, tagline: e.target.value })}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Value Proposition */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <label className="text-xs text-zinc-500 mb-1 block">Value Proposition (подзаголовок)</label>
            <textarea
              value={config.value_proposition}
              onChange={e => setConfig({ ...config, value_proposition: e.target.value })}
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Pain Points */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs text-zinc-500">Pain Points (боли пользователей)</label>
              <span className="text-xs text-zinc-600">{config.pain_points.length} выбрано</span>
            </div>
            {defaults.painTexts.length > 0 ? (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {defaults.painTexts.slice(0, 8).map((pain: string, i: number) => (
                  <label key={i} className="flex items-start gap-2 text-sm cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={config.pain_points.includes(pain)}
                      onChange={e => {
                        if (e.target.checked) {
                          setConfig({ ...config, pain_points: [...config.pain_points, pain].slice(0, 5) });
                        } else {
                          setConfig({ ...config, pain_points: config.pain_points.filter(p => p !== pain) });
                        }
                      }}
                      className="mt-1 accent-indigo-500"
                    />
                    <span className="text-zinc-400 group-hover:text-zinc-300 transition-colors">{pain}</span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-xs text-zinc-600">Нет данных — запустите блок "Проблема" в Evidence</p>
            )}
          </div>

          {/* Features */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <label className="text-xs text-zinc-500 mb-3 block">Features ({config.features.length})</label>
            <div className="space-y-2">
              {config.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={f.title}
                    onChange={e => {
                      const features = [...config.features];
                      features[i] = { ...features[i], title: e.target.value };
                      setConfig({ ...config, features });
                    }}
                    className="w-40 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="Title"
                  />
                  <input
                    value={f.description}
                    onChange={e => {
                      const features = [...config.features];
                      features[i] = { ...features[i], description: e.target.value };
                      setConfig({ ...config, features });
                    }}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-indigo-500"
                    placeholder="Description"
                  />
                  <button
                    onClick={() => setConfig({ ...config, features: config.features.filter((_, idx) => idx !== i) })}
                    className="text-zinc-600 hover:text-red-400 text-xs"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Text */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <label className="text-xs text-zinc-500 mb-2 block">CTA кнопка</label>
            <div className="flex gap-2 flex-wrap">
              {['Get Early Access', 'Join Waitlist', 'Get Started Free', 'Request Access'].map(text => (
                <button
                  key={text}
                  onClick={() => setConfig({ ...config, cta_text: text })}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    config.cta_text === text
                      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing toggle */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-zinc-500">Показать Pricing секцию</span>
                {config.pricing_tiers.length === 0 && (
                  <span className="text-[10px] text-zinc-600 ml-2">(нет данных из GTM)</span>
                )}
              </div>
              <button
                onClick={() => setConfig({ ...config, pricing_enabled: !config.pricing_enabled })}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  config.pricing_enabled ? 'bg-indigo-500' : 'bg-zinc-700'
                }`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  config.pricing_enabled ? 'left-5' : 'left-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={generatePreview}
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Предпросмотр
            </button>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            >
              {deploying && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Задеплоить на Vercel
            </button>
          </div>
        </div>
      )}

      {/* ─── Preview Mode ─── */}
      {mode === 'preview' && previewHtml && (
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Предпросмотр лендинга</span>
              <div className="flex items-center gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/50" />
              </div>
            </div>
            <div
              className="max-h-[500px] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setMode('editor')}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm transition-colors"
            >
              Изменить
            </button>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-2"
            >
              Задеплоить на Vercel
            </button>
          </div>
        </div>
      )}

      {/* ─── Deploying ─── */}
      {mode === 'deploying' && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8 text-center">
          <span className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin inline-block mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Деплоим на Vercel...</h3>
          <p className="text-sm text-zinc-400">Генерация HTML + деплой. Обычно ~15-30 секунд.</p>
        </div>
      )}

      {/* ─── Dashboard ─── */}
      {mode === 'dashboard' && (
        <div className="space-y-4">
          {/* Landing URL */}
          {landingUrl && (
            <div className="bg-zinc-900/50 border border-indigo-500/20 rounded-xl p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-green-400">●</span>
                  <span className="text-sm text-zinc-300">Лендинг активен:</span>
                  <a
                    href={landingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:text-indigo-300 underline"
                  >
                    {landingUrl}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={copyUrl}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors"
                  >
                    {copied ? 'Скопировано!' : 'Копировать URL'}
                  </button>
                  <button
                    onClick={fetchStats}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors"
                  >
                    Обновить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* PMF Verdict */}
          {stats && (
            <PMFVerdict stats={stats} />
          )}

          {/* Metrics cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Visitors" value={stats.unique_views} />
              <MetricCard label="Signups" value={stats.total_signups} />
              <MetricCard label="CR%" value={`${stats.conversion_rate}%`} />
              <MetricCard label="CTA Clicks" value={stats.total_cta_clicks} />
            </div>
          )}

          {/* Daily chart */}
          {stats && stats.daily_stats.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <h3 className="font-semibold text-white text-sm">Visitors & Signups по дням</h3>
              </div>
              <div className="p-4">
                <DailyChart dailyStats={stats.daily_stats} />
              </div>
            </div>
          )}

          {/* Signups list */}
          {stats && stats.signups.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-sm">Waitlist Signups</h3>
                  <span className="text-xs text-zinc-500">{stats.signups.length} email(s)</span>
                </div>
              </div>
              <div className="divide-y divide-zinc-800/50">
                {stats.signups.map((s, i) => (
                  <div key={i} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-zinc-300">{s.email}</span>
                    <span className="text-xs text-zinc-600">
                      {new Date(s.timestamp).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No data yet */}
          {stats && stats.unique_views === 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 text-center">
              <div className="text-3xl mb-3">📊</div>
              <p className="text-sm text-zinc-400 mb-2">
                Пока нет данных. Поделитесь ссылкой на лендинг для сбора трафика.
              </p>
              <p className="text-xs text-zinc-600">
                Рекомендация: минимум 50 уникальных посетителей для корректной оценки CR%.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function PMFVerdict({ stats }: { stats: LandingStats }) {
  const verdictConfig = {
    confirmed: {
      label: 'Спрос подтверждён',
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
      icon: '✅',
      detail: 'CR > 3% — продукт вызывает реальный интерес. Можно переходить к разработке MVP.',
    },
    promising: {
      label: 'Перспективно',
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10 border-yellow-500/20',
      icon: '🟡',
      detail: 'CR 1-3% — интерес есть, но нужно больше данных или улучшить positioning.',
    },
    needs_work: {
      label: 'Необходимо пересмотреть positioning',
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      icon: '🔴',
      detail: 'CR < 1% — текущее позиционирование не резонирует. Пересмотрите tagline, pain points и CTA.',
    },
    insufficient_data: {
      label: 'Недостаточно данных',
      color: 'text-zinc-400',
      bg: 'bg-zinc-800/50 border-zinc-700/50',
      icon: '⏳',
      detail: `${stats.unique_views} из 50 необходимых visitors. Продолжайте привлекать трафик.`,
    },
  };

  const v = verdictConfig[stats.pmf_verdict];

  return (
    <div className={`border rounded-xl p-5 ${v.bg}`}>
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{v.icon}</span>
        <div>
          <h3 className={`font-semibold ${v.color}`}>{v.label}</h3>
          <p className="text-xs text-zinc-400 mt-1">{v.detail}</p>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

function DailyChart({ dailyStats }: { dailyStats: Array<{ date: string; views: number; signups: number }> }) {
  const maxViews = Math.max(...dailyStats.map(d => d.views)) || 1;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-4 text-[10px] text-zinc-500 mb-2">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-indigo-500 inline-block" /> Views</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Signups</span>
      </div>
      <div className="flex items-end gap-1 h-20">
        {dailyStats.slice(-14).map((d, i) => {
          const viewHeight = Math.max(4, (d.views / maxViews) * 100);
          const signupHeight = d.signups > 0 ? Math.max(8, (d.signups / maxViews) * 100) : 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.views} views, ${d.signups} signups`}>
              <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '100%', justifyContent: 'flex-end' }}>
                {signupHeight > 0 && (
                  <div className="w-full bg-green-500/50 rounded-t" style={{ height: `${signupHeight}%`, minHeight: '4px' }} />
                )}
                <div className="w-full bg-indigo-500/40 rounded-t" style={{ height: `${viewHeight}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {dailyStats.slice(-14).map((d, i) => (
          <div key={i} className="flex-1 text-center">
            <span className="text-[8px] text-zinc-600">
              {new Date(d.date).toLocaleDateString('ru-RU', { day: 'numeric' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
