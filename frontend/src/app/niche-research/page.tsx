'use client';

import { useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { getItem, setItem } from '@/lib/storage';

interface NicheAnalysis {
  niche_analysis: {
    market_size: string;
    growth_trend: string;
    competition_level: string;
    entry_barriers: string;
  };
  pain_points: Array<{
    pain: string;
    severity: number;
    frequency: string;
  }>;
  target_segments: Array<{
    name: string;
    size: string;
    willingness_to_pay: string;
    where_to_find: string;
    communication_channels: string[];
  }>;
  opportunities: Array<{
    opportunity: string;
    potential_revenue: string;
    implementation_difficulty: string;
    time_to_market: string;
  }>;
  competitors: Array<{
    name: string;
    website?: string;
    strengths: string[];
    weaknesses: string[];
    pricing: string;
  }>;
  recommended_solutions: Array<{
    type: string;
    description: string;
    mvp_features: string[];
    estimated_cost: string;
    monetization: string;
  }>;
  keywords_for_research: string[];
  subreddits: string[];
  overall_score: {
    opportunity: number;
    pain_severity: number;
    feasibility: number;
    profit_potential: number;
  };
}

export default function NicheResearchPage() {
  const [niche, setNiche] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [existingProblems, setExistingProblems] = useState('');
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<NicheAnalysis | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !description.trim()) {
      setError('Заполните название ниши и описание');
      return;
    }

    setLoading(true);
    setError('');
    setAnalysis(null);

    try {
      const response = await fetch('/api/niche-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          description,
          targetAudience,
          existingProblems
        })
      });

      const data = await response.json();

      if (data.success) {
        setAnalysis(data.analysis);

        // Save to history in localStorage
        const history = getItem<Array<{ id: string; niche: string; description: string; analysis: NicheAnalysis; timestamp: string }>>('niche_research_history') || [];
        history.unshift({
          id: Date.now().toString(),
          niche,
          description,
          analysis: data.analysis,
          timestamp: data.timestamp
        });
        setItem('niche_research_history', history.slice(0, 20));
      } else {
        setError(data.error || 'Ошибка анализа');
      }
    } catch (err) {
      setError('Ошибка соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  const getGrowthColor = (trend: string) => {
    if (trend.toLowerCase().includes('раст')) return 'text-green-400';
    if (trend.toLowerCase().includes('пад')) return 'text-red-400';
    return 'text-yellow-400';
  };

  const getCompetitionColor = (level: string) => {
    if (level.toLowerCase().includes('низк')) return 'text-green-400';
    if (level.toLowerCase().includes('высок')) return 'text-red-400';
    return 'text-yellow-400';
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <div className="lg:ml-64 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 glass border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Исследование ниши</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  Опишите нишу заказчика для глубокого AI-анализа
                </p>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-secondary)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                К трендам
              </Link>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Input Form */}
          <div className="trend-card mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm">🔍</span>
              Опишите нишу для исследования
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Название ниши *
                  </label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder="Например: Стоматологические клиники в Москве"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Целевая аудитория (опционально)
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="Например: Владельцы клиник, пациенты 25-45 лет"
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Описание бизнеса/проблемы заказчика *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Опишите бизнес заказчика, с какими проблемами он сталкивается, что хочет улучшить. Чем подробнее - тем точнее анализ."
                  rows={4}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  Известные проблемы (опционально)
                </label>
                <textarea
                  value={existingProblems}
                  onChange={(e) => setExistingProblems(e.target.value)}
                  placeholder="Если заказчик уже озвучил конкретные проблемы - укажите их здесь"
                  rows={2}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !niche.trim() || !description.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-white font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Анализирую нишу...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Исследовать нишу
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Results */}
          {analysis && (
            <div className="space-y-6 animate-fadeIn">
              {/* Overall Scores */}
              <div className="trend-card">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-sm">📊</span>
                  Общая оценка: {niche}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)]">
                    <div className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                      {analysis.overall_score.opportunity}/10
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Возможность</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)]">
                    <div className="text-3xl font-bold text-red-400">
                      {analysis.overall_score.pain_severity}/10
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Острота боли</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)]">
                    <div className="text-3xl font-bold text-green-400">
                      {analysis.overall_score.feasibility}/10
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Выполнимость</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)]">
                    <div className="text-3xl font-bold text-yellow-400">
                      {analysis.overall_score.profit_potential}/10
                    </div>
                    <div className="text-xs text-[var(--text-muted)] mt-1">Прибыльность</div>
                  </div>
                </div>
              </div>

              {/* Market Analysis */}
              <div className="trend-card">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm">📈</span>
                  Анализ рынка
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1">Размер рынка</div>
                    <div className="text-[var(--text-primary)]">{analysis.niche_analysis.market_size}</div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1">Тренд роста</div>
                    <div className={getGrowthColor(analysis.niche_analysis.growth_trend)}>
                      {analysis.niche_analysis.growth_trend}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1">Уровень конкуренции</div>
                    <div className={getCompetitionColor(analysis.niche_analysis.competition_level)}>
                      {analysis.niche_analysis.competition_level}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                    <div className="text-xs text-[var(--text-muted)] mb-1">Барьеры входа</div>
                    <div className="text-[var(--text-primary)]">{analysis.niche_analysis.entry_barriers}</div>
                  </div>
                </div>
              </div>

              {/* Pain Points */}
              <div className="trend-card">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-sm">💢</span>
                  Болевые точки ({analysis.pain_points.length})
                </h3>
                <div className="space-y-3">
                  {analysis.pain_points.map((pain, idx) => (
                    <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-[var(--text-primary)]">{pain.pain}</p>
                          <p className="text-xs text-[var(--text-muted)] mt-1">Частота: {pain.frequency}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          pain.severity >= 8 ? 'bg-red-500/20 text-red-400' :
                          pain.severity >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {pain.severity}/10
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Target Segments */}
              <div className="trend-card">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm">👥</span>
                  Целевые сегменты ({analysis.target_segments.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysis.target_segments.map((segment, idx) => (
                    <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-[var(--text-primary)]">{segment.name}</h4>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          segment.willingness_to_pay === 'high' ? 'bg-green-500/20 text-green-400' :
                          segment.willingness_to_pay === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-zinc-500/20 text-zinc-400'
                        }`}>
                          💰 {segment.willingness_to_pay === 'high' ? 'Высокая' : segment.willingness_to_pay === 'medium' ? 'Средняя' : 'Низкая'}
                        </span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <p className="text-[var(--text-muted)]">Размер: {segment.size}</p>
                        <p className="text-[var(--text-muted)]">Где найти: {segment.where_to_find}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {segment.communication_channels.map((channel, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
                              {channel}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Opportunities */}
              <div className="trend-card">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm">💡</span>
                  Возможности ({analysis.opportunities.length})
                </h3>
                <div className="space-y-3">
                  {analysis.opportunities.map((opp, idx) => (
                    <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                      <p className="text-[var(--text-primary)] font-medium mb-2">{opp.opportunity}</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-[var(--text-muted)]">Доход: </span>
                          <span className="text-green-400">{opp.potential_revenue}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">Сложность: </span>
                          <span className="text-[var(--text-secondary)]">{opp.implementation_difficulty}</span>
                        </div>
                        <div>
                          <span className="text-[var(--text-muted)]">TTM: </span>
                          <span className="text-[var(--text-secondary)]">{opp.time_to_market}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Competitors */}
              {analysis.competitors.length > 0 && (
                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-500 to-zinc-600 flex items-center justify-center text-sm">🏢</span>
                    Конкуренты ({analysis.competitors.length})
                  </h3>
                  <div className="space-y-3">
                    {analysis.competitors.map((comp, idx) => (
                      <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium text-[var(--text-primary)]">{comp.name}</h4>
                          {comp.website && (
                            <a href={comp.website.startsWith('http') ? comp.website : `https://${comp.website}`} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-400 hover:text-indigo-300">
                              {comp.website}
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mb-2">Цены: {comp.pricing}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-green-400">+ </span>
                            {comp.strengths.join(', ')}
                          </div>
                          <div>
                            <span className="text-red-400">- </span>
                            {comp.weaknesses.join(', ')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommended Solutions */}
              <div className="trend-card">
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm">🚀</span>
                  Рекомендуемые решения
                </h3>
                <div className="space-y-4">
                  {analysis.recommended_solutions.map((solution, idx) => (
                    <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] hover:border-indigo-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm font-medium">
                          {solution.type}
                        </span>
                        <span className="text-xs text-[var(--text-muted)]">{solution.estimated_cost}</span>
                      </div>
                      <p className="text-[var(--text-primary)] mb-3">{solution.description}</p>
                      <div className="mb-3">
                        <p className="text-xs text-[var(--text-muted)] mb-2">MVP фичи:</p>
                        <div className="flex flex-wrap gap-1">
                          {solution.mvp_features.map((feature, i) => (
                            <span key={i} className="text-xs px-2 py-1 bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-color)]">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-muted)]">
                        Монетизация: <span className="text-green-400">{solution.monetization}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Keywords & Subreddits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-sm">🔑</span>
                    Ключевые слова для исследования
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.keywords_for_research.map((keyword, idx) => (
                      <span key={idx} className="px-3 py-1.5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-secondary)]">
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm">🔥</span>
                    Reddit сообщества
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {analysis.subreddits.map((sub, idx) => (
                      <a
                        key={idx}
                        href={`https://reddit.com/r/${sub}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-xl text-sm text-orange-400 hover:bg-orange-500/20 transition-all"
                      >
                        r/{sub}
                      </a>
                    ))}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    const newTrend = {
                      id: Date.now().toString(),
                      title: niche,
                      category: 'Technology',
                      popularity_score: (analysis.overall_score.opportunity + analysis.overall_score.pain_severity) * 5,
                      growth_rate: 0,
                      why_trending: description,
                      opportunity_score: analysis.overall_score.opportunity,
                      pain_score: analysis.overall_score.pain_severity,
                      feasibility_score: analysis.overall_score.feasibility,
                      profit_potential: analysis.overall_score.profit_potential,
                      status: 'analyzed',
                      key_pain_points: analysis.pain_points.map(p => p.pain),
                      target_audience: {
                        segments: analysis.target_segments
                      },
                      main_pain: analysis.pain_points[0]?.pain || '',
                      market_signals: analysis.opportunities.map(o => o.opportunity)
                    };

                    // Add to favorites
                    const favorites = getItem<Array<{id: string}>>('trendhunter_favorites') || [];
                    if (!favorites.find((f) => f.id === newTrend.id)) {
                      favorites.push(newTrend);
                      setItem('trendhunter_favorites', favorites);
                      alert('Добавлено в избранное!');
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white font-medium transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  Добавить в избранное
                </button>
                <button
                  onClick={() => {
                    setAnalysis(null);
                    setNiche('');
                    setDescription('');
                    setTargetAudience('');
                    setExistingProblems('');
                  }}
                  className="px-6 py-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] font-medium transition-all"
                >
                  Новое исследование
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
