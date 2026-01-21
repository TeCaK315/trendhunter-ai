'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { getItem, setItem } from '@/lib/storage';

interface Trend {
  id: string;
  title: string;
  category: string;
  popularity_score: number;
  opportunity_score: number;
  pain_score: number;
  feasibility_score: number;
  profit_potential: number;
  growth_rate: number;
  why_trending: string;
  status: string;
  first_detected_at: string;
  source?: string;
}

interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  num_comments: number;
  url: string;
  created: string;
  selftext?: string;
}

interface YouTubeVideo {
  title: string;
  channel: string;
  description: string;
  videoId: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

// Deep Analysis types (from multi-agent system)
interface DeepAnalysisPainPoint {
  pain: string;
  confidence: number;
  arguments_for: string[];
  arguments_against: string[];
  verdict: string;
}

interface DeepAnalysisSegment {
  name: string;
  size: string;
  willingness_to_pay: string;
  where_to_find: string;
  confidence: number;
}

interface DeepAnalysisMetadata {
  optimist_summary: string;
  skeptic_summary: string;
  consensus_reached: boolean;
  analysis_depth: 'deep';
}

interface DeepAnalysisResult {
  main_pain: string;
  confidence: number;
  key_pain_points: DeepAnalysisPainPoint[];
  target_audience: {
    segments: DeepAnalysisSegment[];
  };
  risks: string[];
  opportunities: string[];
  final_recommendation: string;
  analysis_metadata: DeepAnalysisMetadata;
}

interface TrendAnalysis {
  trend_id: string;
  trend_title: string;
  main_pain: string;
  key_pain_points: string[];
  target_audience: {
    segments: Array<{
      name: string;
      size: string;
      willingness_to_pay: string;
      where_to_find?: string;
      confidence?: number;
    }>;
  };
  sources_analysis?: {
    reddit?: { sentiment: string; key_discussions: string[]; top_subreddits: string[] };
    youtube?: { content_type: string; top_channels: string[] };
    google_trends?: { trend_direction: string; related_topics: string[] };
    facebook?: { community_size: string; engagement: string };
  };
  real_sources: {
    reddit: {
      posts: RedditPost[];
      communities: string[];
      engagement: number;
    };
    youtube: {
      videos: YouTubeVideo[];
      channels: string[];
    };
    google_trends: {
      growth_rate: number;
      related_queries: Array<{ query: string; growth: string }>;
    };
    facebook: {
      pages: Array<{
        name: string;
        category: string;
        fan_count: number;
        about: string;
        url: string;
      }>;
      reach: number;
    };
  };
  sentiment_score: number;
  market_signals?: string[];
  status: string;
  analyzed_at: string;
  // Deep analysis fields
  deep_analysis?: DeepAnalysisResult;
  analysis_type?: 'basic' | 'deep';
}

const categoryConfig: Record<string, { icon: string; color: string }> = {
  'SaaS': { icon: '💻', color: 'from-blue-500/20 to-cyan-500/20' },
  'E-commerce': { icon: '🛒', color: 'from-emerald-500/20 to-green-500/20' },
  'Mobile Apps': { icon: '📱', color: 'from-violet-500/20 to-purple-500/20' },
  'EdTech': { icon: '🎓', color: 'from-amber-500/20 to-yellow-500/20' },
  'HealthTech': { icon: '💚', color: 'from-green-500/20 to-emerald-500/20' },
  'AI/ML': { icon: '🤖', color: 'from-indigo-500/20 to-violet-500/20' },
  'AI & ML': { icon: '🤖', color: 'from-indigo-500/20 to-violet-500/20' },
  'FinTech': { icon: '💰', color: 'from-yellow-500/20 to-orange-500/20' },
  'Technology': { icon: '⚙️', color: 'from-slate-500/20 to-zinc-500/20' },
  'Business': { icon: '📊', color: 'from-blue-500/20 to-indigo-500/20' },
  'Healthcare': { icon: '🏥', color: 'from-red-500/20 to-rose-500/20' },
  'Finance': { icon: '💵', color: 'from-green-500/20 to-emerald-500/20' },
  'Education': { icon: '📚', color: 'from-orange-500/20 to-amber-500/20' },
};

function getOverallScore(trend: Trend): number {
  return Number(((trend.opportunity_score + trend.pain_score + trend.feasibility_score + trend.profit_potential) / 4).toFixed(1));
}

function getScoreColor(score: number): string {
  if (score >= 8.5) return 'from-green-500 to-emerald-500';
  if (score >= 7) return 'from-indigo-500 to-purple-500';
  if (score >= 5) return 'from-yellow-500 to-orange-500';
  return 'from-red-500 to-rose-500';
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Trend[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, TrendAnalysis>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTrend, setSelectedTrend] = useState<Trend | null>(null);
  const [analyzingTrends, setAnalyzingTrends] = useState<Set<string>>(new Set());

  const loadAnalyses = useCallback(async () => {
    try {
      const response = await fetch('/api/trends/analyze');
      if (response.ok) {
        const data = await response.json();
        setAnalyses(data.analyses || {});
      }
    } catch (error) {
      console.error('Error loading analyses:', error);
    }
  }, []);

  useEffect(() => {
    loadFavorites();
    loadAnalyses();
  }, [loadAnalyses]);

  const loadFavorites = () => {
    try {
      const favoriteTrends = getItem<Trend[]>('trendhunter_favorites_data');
      if (favoriteTrends) {
        setFavorites(favoriteTrends);
        if (favoriteTrends.length > 0) {
          setSelectedTrend(favoriteTrends[0]);
        }
      }
    } catch (error) {
      console.error('Error loading favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerAnalysis = async (trend: Trend) => {
    if (analyzingTrends.has(trend.id)) return;

    setAnalyzingTrends(prev => new Set(prev).add(trend.id));

    try {
      // Step 1: Collect real data from sources (Reddit, YouTube, Google Trends) in parallel with AI analysis
      const [sourcesResponse, analysisResponse] = await Promise.all([
        fetch('/api/collect-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trend_title: trend.title }),
        }),
        fetch('/api/deep-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trend_title: trend.title,
            trend_category: trend.category,
            why_trending: trend.why_trending,
          }),
        }),
      ]);

      // Parse sources data
      let realSources = {
        reddit: { posts: [] as RedditPost[], communities: [] as string[], engagement: 0 },
        youtube: { videos: [] as YouTubeVideo[], channels: [] as string[] },
        google_trends: { growth_rate: trend.growth_rate || 0, related_queries: [] as Array<{ query: string; growth: string }>, interest_timeline: [] as Array<{ date: string; value: number }> },
        facebook: { pages: [] as Array<{ name: string; category: string; fan_count: number; about: string; url: string }>, reach: 0 },
      };

      if (sourcesResponse.ok) {
        const sourcesResult = await sourcesResponse.json();
        if (sourcesResult.success && sourcesResult.sources) {
          realSources = sourcesResult.sources;
        }
      }

      // Parse AI analysis
      if (analysisResponse.ok) {
        const analysisResult = await analysisResponse.json();

        if (analysisResult.success && analysisResult.analysis) {
          const deepAnalysis = analysisResult.analysis as DeepAnalysisResult;

          // Save to analysis storage with both AI analysis and real sources
          await fetch('/api/trends/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trend_id: trend.id,
              trend_title: trend.title,
              main_pain: deepAnalysis.main_pain,
              key_pain_points: deepAnalysis.key_pain_points.map(p => p.pain),
              target_audience: deepAnalysis.target_audience,
              sentiment_score: deepAnalysis.confidence / 10,
              real_sources: realSources,
              status: 'analyzed',
              analyzed_at: new Date().toISOString(),
              deep_analysis: deepAnalysis,
              analysis_type: 'deep',
            }),
          });

          // Reload analyses to show updated data
          await loadAnalyses();
        }
      }
    } catch (error) {
      console.error('Error triggering deep analysis:', error);
    } finally {
      setAnalyzingTrends(prev => {
        const next = new Set(prev);
        next.delete(trend.id);
        return next;
      });
    }
  };

  const handleRemoveFavorite = (id: string) => {
    const updatedFavorites = favorites.filter(t => t.id !== id);
    setItem('trendhunter_favorites_data', updatedFavorites);
    const favoriteIds = updatedFavorites.map(t => t.id);
    setItem('trendhunter_favorites', favoriteIds);
    setFavorites(updatedFavorites);
    if (selectedTrend?.id === id) {
      setSelectedTrend(updatedFavorites[0] || null);
    }
  };

  const downloadResearch = (trend: Trend, analysis: TrendAnalysis | null) => {
    const overallScore = getOverallScore(trend);

    let content = `# ${trend.title}

## Общая информация
- **Категория:** ${trend.category}
- **Общий рейтинг:** ${overallScore}/10
- **Рост:** ${analysis?.real_sources?.google_trends?.growth_rate || trend.growth_rate || 0}%
- **Дата обнаружения:** ${new Date(trend.first_detected_at).toLocaleDateString('ru-RU')}
- **Дата анализа:** ${analysis ? new Date(analysis.analyzed_at).toLocaleDateString('ru-RU') : 'Не проанализирован'}
- **Тип анализа:** ${analysis?.analysis_type === 'deep' ? 'Глубокий (3 агента: Оптимист + Скептик + Арбитр)' : 'Базовый'}

## Почему это трендит
${trend.why_trending}

## Метрики
- Возможность рынка: ${trend.opportunity_score}/10
- Острота боли: ${trend.pain_score}/10
- Выполнимость: ${trend.feasibility_score}/10
- Потенциальная выгода: ${trend.profit_potential}/10
`;

    if (analysis) {
      const deepAnalysis = analysis.deep_analysis;

      content += `
## Анализ болевых точек (AI)

### Главная боль${deepAnalysis ? ` (уверенность: ${deepAnalysis.confidence}/10)` : ''}
${analysis.main_pain}
`;

      if (deepAnalysis) {
        content += `
### Ключевые проблемы (с аргументацией)
${deepAnalysis.key_pain_points.map(p => `
#### ${p.pain} (уверенность: ${p.confidence}/10)
**Вердикт:** ${p.verdict}

**Аргументы ЗА:**
${p.arguments_for.map(a => `- ${a}`).join('\n')}

**Аргументы ПРОТИВ:**
${p.arguments_against.map(a => `- ${a}`).join('\n')}
`).join('\n')}

### Риски
${deepAnalysis.risks.map(r => `- ${r}`).join('\n')}

### Возможности
${deepAnalysis.opportunities.map(o => `- ${o}`).join('\n')}

### Финальная рекомендация
${deepAnalysis.final_recommendation}

### Позиции агентов
**Оптимист:** ${deepAnalysis.analysis_metadata.optimist_summary}

**Скептик:** ${deepAnalysis.analysis_metadata.skeptic_summary}

**Консенсус достигнут:** ${deepAnalysis.analysis_metadata.consensus_reached ? 'Да' : 'Нет'}
`;
      } else {
        content += `
### Ключевые проблемы
${analysis.key_pain_points.map(p => `- ${p}`).join('\n')}
`;
      }

      content += `
### Целевая аудитория
${analysis.target_audience.segments.map(s => `- **${s.name}** (${s.size}) - Готовность платить: ${s.willingness_to_pay}${s.where_to_find ? ` - Где найти: ${s.where_to_find}` : ''}${s.confidence ? ` (уверенность: ${s.confidence}/10)` : ''}`).join('\n')}
`;
    }

    content += `
---
*Сгенерировано TrendHunter AI - ${new Date().toLocaleString('ru-RU')}*
`;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${trend.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}_research.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const analyzedCount = favorites.filter(f => analyses[f.id]).length;

  return (
    <div>
        {/* Header */}
        <header className="sticky top-0 z-30 glass border-b border-zinc-800/50">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Избранное</h1>
                <p className="text-sm text-zinc-500 mt-1">
                  {favorites.length} идей • {analyzedCount} проанализировано
                </p>
              </div>
              <Link
                href="/"
                className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-sm text-white transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Добавить идеи
              </Link>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="p-6">
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="flex items-center gap-3 text-zinc-500">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Загрузка избранного...</span>
              </div>
            </div>
          ) : favorites.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-24 h-24 bg-zinc-800/50 rounded-full flex items-center justify-center mb-6">
                <span className="text-5xl">⭐</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Пока пусто</h2>
              <p className="text-zinc-400 max-w-md mb-6">
                Добавьте интересные идеи в избранное, чтобы анализировать их и создавать проекты
              </p>
              <Link
                href="/"
                className="btn-primary flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Смотреть идеи
              </Link>
            </div>
          ) : (
            <div className="flex gap-6">
              {/* Left sidebar - favorites list */}
              <div className="w-80 flex-shrink-0">
                <div className="sticky top-24 space-y-3 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
                  {favorites.map((trend) => {
                    const hasAnalysis = !!analyses[trend.id];
                    const isAnalyzing = analyzingTrends.has(trend.id);
                    const isSelected = selectedTrend?.id === trend.id;
                    const config = categoryConfig[trend.category] || { icon: '📌', color: 'from-zinc-500/20 to-zinc-600/20' };
                    const score = getOverallScore(trend);

                    return (
                      <div
                        key={trend.id}
                        onClick={() => setSelectedTrend(trend)}
                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 group ${
                          isSelected
                            ? 'bg-indigo-500/15 border border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                            : 'bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{config.icon}</span>
                            <span className="text-xs text-zinc-500">{trend.category}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`text-sm font-bold px-2 py-0.5 rounded-lg bg-gradient-to-r ${getScoreColor(score)} text-white`}>
                              {score}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFavorite(trend.id);
                              }}
                              className="text-yellow-400 hover:text-yellow-300 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Убрать из избранного"
                            >
                              ★
                            </button>
                          </div>
                        </div>
                        <h3 className="text-sm font-medium text-white line-clamp-2 mb-2">{trend.title}</h3>
                        <div className="flex items-center gap-2">
                          {hasAnalysis ? (
                            <span className={`badge text-xs ${analyses[trend.id]?.analysis_type === 'deep' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'badge-success'}`}>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {analyses[trend.id]?.analysis_type === 'deep' ? 'Глубокий анализ' : 'Проанализирован'}
                            </span>
                          ) : isAnalyzing ? (
                            <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs animate-pulse">
                              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              3 агента...
                            </span>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerAnalysis(trend);
                              }}
                              className="text-xs px-2.5 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/20 transition-all"
                            >
                              Глубокий анализ
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right content - selected trend details */}
              <div className="flex-1 min-w-0">
                {selectedTrend ? (
                  <TrendDetailView
                    trend={selectedTrend}
                    analysis={analyses[selectedTrend.id] || null}
                    isAnalyzing={analyzingTrends.has(selectedTrend.id)}
                    onAnalyze={() => triggerAnalysis(selectedTrend)}
                    onDownload={() => downloadResearch(selectedTrend, analyses[selectedTrend.id] || null)}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 text-center border border-dashed border-zinc-800 rounded-2xl">
                    <span className="text-4xl mb-4">👈</span>
                    <p className="text-zinc-400">Выберите идею из списка слева</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
    </div>
  );
}

function TrendDetailView({
  trend,
  analysis,
  isAnalyzing,
  onAnalyze,
  onDownload,
}: {
  trend: Trend;
  analysis: TrendAnalysis | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  onDownload: () => void;
}) {
  const overallScore = getOverallScore(trend);
  const config = categoryConfig[trend.category] || { icon: '📌', color: 'from-zinc-500/20 to-zinc-600/20' };

  const metrics = [
    { label: 'Возможность', value: trend.opportunity_score, icon: '🎯' },
    { label: 'Боль', value: trend.pain_score, icon: '🔥' },
    { label: 'Выполнимость', value: trend.feasibility_score, icon: '⚡' },
    { label: 'Выгода', value: trend.profit_potential, icon: '💰' },
  ];

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Card */}
      <div className={`bg-gradient-to-br ${config.color} rounded-2xl p-6 border border-zinc-800`}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{config.icon}</span>
              <span className="text-sm text-zinc-400">{trend.category}</span>
              {analysis && (
                <span className="badge badge-success ml-2">
                  Проанализирован {new Date(analysis.analyzed_at).toLocaleDateString('ru-RU')}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-white">{trend.title}</h2>
          </div>
          <div className={`score-badge bg-gradient-to-br ${getScoreColor(overallScore)} text-white text-3xl`}>
            {overallScore}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {!isAnalyzing && (
            <button
              onClick={onAnalyze}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                analysis
                  ? 'bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300'
                  : 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-500/30'
              }`}
            >
              <span>🔍</span>
              <span>{analysis ? 'Переанализировать' : 'Анализировать'}</span>
            </button>
          )}
          {isAnalyzing && (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/20 rounded-xl text-sm font-medium animate-pulse text-purple-300 border border-purple-500/30">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Глубокий анализ (3 агента)...</span>
            </div>
          )}
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800/50 hover:bg-zinc-700/50 rounded-xl text-sm font-medium text-white transition-all"
          >
            <span>📥</span>
            <span>Скачать отчёт</span>
          </button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
            <div className="text-2xl mb-1">{metric.icon}</div>
            <div className="text-2xl font-bold text-white">{metric.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{metric.label}</div>
          </div>
        ))}
      </div>

      {/* Why Trending */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <span>💡</span>
          Почему это трендит
        </h3>
        <p className="text-zinc-400">{trend.why_trending}</p>
      </div>

      {/* AI Analysis Results */}
      {analysis && (
        <>
          {/* Deep Analysis Badge */}
          {analysis.analysis_type === 'deep' && analysis.deep_analysis && (
            <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/30 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🧠</span>
                  <div>
                    <div className="text-white font-semibold">Глубокий анализ</div>
                    <div className="text-xs text-zinc-400">Оптимист + Скептик + Арбитр</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{analysis.deep_analysis.confidence.toFixed(1)}</div>
                    <div className="text-xs text-zinc-500">уверенность</div>
                  </div>
                  {analysis.deep_analysis.analysis_metadata.consensus_reached && (
                    <span className="badge badge-success">✓ Консенсус</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Main Pain with Confidence */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-red-400 font-semibold flex items-center gap-2">
                <span>🎯</span>
                Главная боль
              </h3>
              {analysis.deep_analysis && (
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                      style={{ width: `${analysis.deep_analysis.confidence * 10}%` }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400">{analysis.deep_analysis.confidence}/10</span>
                </div>
              )}
            </div>
            <p className="text-white">{analysis.main_pain}</p>
          </div>

          {/* Deep Analysis: Pain Points with Arguments */}
          {analysis.deep_analysis ? (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span>⚡</span>
                Ключевые проблемы (с аргументацией)
              </h3>
              <div className="space-y-4">
                {analysis.deep_analysis.key_pain_points.map((painPoint, idx) => (
                  <div key={idx} className="bg-zinc-800/30 rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="text-white font-medium">{painPoint.pain}</div>
                        <div className="text-xs text-zinc-500 mt-1">{painPoint.verdict}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="h-2 w-16 bg-zinc-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              painPoint.confidence >= 7 ? 'bg-green-500' :
                              painPoint.confidence >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${painPoint.confidence * 10}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 w-8">{painPoint.confidence}/10</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                        <div className="text-xs text-green-400 font-medium mb-2 flex items-center gap-1">
                          <span>✓</span> Аргументы ЗА
                        </div>
                        <ul className="space-y-1">
                          {painPoint.arguments_for.map((arg, argIdx) => (
                            <li key={argIdx} className="text-xs text-zinc-400">• {arg}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                        <div className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1">
                          <span>✗</span> Аргументы ПРОТИВ
                        </div>
                        <ul className="space-y-1">
                          {painPoint.arguments_against.map((arg, argIdx) => (
                            <li key={argIdx} className="text-xs text-zinc-400">• {arg}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span>⚡</span>
                Ключевые проблемы
              </h3>
              <div className="space-y-2">
                {analysis.key_pain_points.map((pain, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-zinc-800/30 rounded-lg">
                    <span className="text-indigo-400 mt-0.5">•</span>
                    <span className="text-zinc-300">{pain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Target Audience with Confidence */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span>👥</span>
              Целевая аудитория
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {analysis.target_audience.segments.map((segment, idx) => (
                <div key={idx} className="bg-zinc-800/30 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-medium text-white">{segment.name}</div>
                    {segment.confidence && (
                      <span className="text-xs text-zinc-500">{segment.confidence}/10</span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-500 mb-2">Размер: {segment.size}</div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`badge ${
                      segment.willingness_to_pay === 'high' ? 'badge-success' :
                      segment.willingness_to_pay === 'medium' ? 'badge-warning' : 'badge-info'
                    }`}>
                      {segment.willingness_to_pay === 'high' ? 'Высокая' : segment.willingness_to_pay === 'medium' ? 'Средняя' : 'Низкая'} готовность платить
                    </span>
                  </div>
                  {segment.where_to_find && (
                    <div className="text-xs text-zinc-500 mt-3">📍 {segment.where_to_find}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Risks & Opportunities (Deep Analysis Only) */}
          {analysis.deep_analysis && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                <h3 className="text-red-400 font-semibold mb-4 flex items-center gap-2">
                  <span>⚠️</span>
                  Риски
                </h3>
                <ul className="space-y-2">
                  {analysis.deep_analysis.risks.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="text-red-400 mt-0.5">•</span>
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-5">
                <h3 className="text-green-400 font-semibold mb-4 flex items-center gap-2">
                  <span>🚀</span>
                  Возможности
                </h3>
                <ul className="space-y-2">
                  {analysis.deep_analysis.opportunities.map((opp, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                      <span className="text-green-400 mt-0.5">•</span>
                      {opp}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Final Recommendation (Deep Analysis Only) */}
          {analysis.deep_analysis && (
            <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-5">
              <h3 className="text-indigo-400 font-semibold mb-3 flex items-center gap-2">
                <span>💡</span>
                Финальная рекомендация
              </h3>
              <p className="text-white">{analysis.deep_analysis.final_recommendation}</p>
            </div>
          )}

          {/* Agent Perspectives (Deep Analysis Only) */}
          {analysis.deep_analysis && analysis.deep_analysis.analysis_metadata && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <span>🎭</span>
                Позиции агентов
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">😊</span>
                    <span className="text-green-400 font-medium">Оптимист</span>
                  </div>
                  <p className="text-sm text-zinc-400">{analysis.deep_analysis.analysis_metadata.optimist_summary}</p>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">🤔</span>
                    <span className="text-red-400 font-medium">Скептик</span>
                  </div>
                  <p className="text-sm text-zinc-400">{analysis.deep_analysis.analysis_metadata.skeptic_summary}</p>
                </div>
              </div>
            </div>
          )}

          {/* Real Sources */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <span>🌐</span>
              Реальные источники данных
            </h3>
            <div className="grid grid-cols-2 gap-4">
              {/* Reddit */}
              <SourceCard
                icon="🔴"
                title="Reddit"
                subtitle={`${analysis.real_sources.reddit.engagement} engagement`}
                items={analysis.real_sources.reddit.posts.slice(0, 3).map(p => ({
                  title: p.title,
                  url: p.url,
                  meta: `r/${p.subreddit} • ⬆️ ${p.score}`
                }))}
                tags={analysis.real_sources.reddit.communities.map(c => `r/${c}`)}
                tagColor="bg-orange-500/20 text-orange-300"
              />

              {/* YouTube */}
              <SourceCard
                icon="📺"
                title="YouTube"
                subtitle={`${analysis.real_sources.youtube.videos.length} видео`}
                items={analysis.real_sources.youtube.videos.slice(0, 3).map(v => ({
                  title: v.title,
                  url: v.url,
                  meta: v.channel
                }))}
              />

              {/* Google Trends */}
              <div className="bg-zinc-800/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">📈</span>
                  <span className="font-medium text-white">Google Trends</span>
                  <span className={`badge ${analysis.real_sources.google_trends.growth_rate > 0 ? 'badge-success' : 'badge-error'}`}>
                    {analysis.real_sources.google_trends.growth_rate > 0 ? '+' : ''}
                    {analysis.real_sources.google_trends.growth_rate}%
                  </span>
                </div>
                <div className="space-y-2">
                  {analysis.real_sources.google_trends.related_queries.slice(0, 5).map((query, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">{query.query}</span>
                      <span className="text-green-400 text-xs">+{query.growth}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Facebook */}
              <SourceCard
                icon="📘"
                title="Facebook"
                subtitle={`${analysis.real_sources.facebook.reach.toLocaleString()} охват`}
                items={analysis.real_sources.facebook.pages.slice(0, 3).map(p => ({
                  title: p.name,
                  url: p.url,
                  meta: `${p.category} • 👥 ${p.fan_count.toLocaleString()}`
                }))}
                emptyMessage="Требуется Facebook API ключ"
              />
            </div>
          </div>
        </>
      )}

      {/* Action button */}
      <div className="pt-4">
        <Link
          href={`/trends/${trend.id}?tab=project`}
          className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
        >
          <span>🚀</span>
          <span>Перейти к проекту</span>
        </Link>
      </div>
    </div>
  );
}

function SourceCard({
  icon,
  title,
  subtitle,
  items,
  tags,
  tagColor = 'bg-zinc-700 text-zinc-300',
  emptyMessage,
}: {
  icon: string;
  title: string;
  subtitle: string;
  items: Array<{ title: string; url: string; meta: string }>;
  tags?: string[];
  tagColor?: string;
  emptyMessage?: string;
}) {
  return (
    <div className="bg-zinc-800/30 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <span className="font-medium text-white">{title}</span>
        <span className="text-xs text-zinc-500">({subtitle})</span>
      </div>

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {tags.map((tag, idx) => (
            <span key={idx} className={`text-xs px-2 py-0.5 rounded-full ${tagColor}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-zinc-900/50 rounded-lg hover:bg-zinc-900 transition-colors"
            >
              <div className="text-sm text-white line-clamp-1">{item.title}</div>
              <div className="text-xs text-zinc-500 mt-1">{item.meta}</div>
            </a>
          ))}
        </div>
      ) : (
        <div className="text-center py-4 text-xs text-zinc-500">
          {emptyMessage || 'Нет данных'}
        </div>
      )}
    </div>
  );
}
