'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getItem, setItem } from '@/lib/storage';
import ProductSpecPreview from '@/components/ProductSpecPreview';
import { ProductSpecification } from '@/lib/mvp-templates';
import { useTranslations } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

// Types
interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  num_comments: number;
  url: string;
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

interface GoogleTrendsData {
  growth_rate: number;
  related_queries: Array<{ query: string; growth: string; link?: string }>;
  interest_timeline?: Array<{ date: string; value: number }>;
  search_query?: string;
  google_trends_url?: string;
  error?: string;
}

interface SourcesData {
  reddit: {
    posts: RedditPost[];
    communities: string[];
    engagement: number;
    error?: string;
  };
  youtube: {
    videos: YouTubeVideo[];
    channels: string[];
    error?: string;
  };
  google_trends: GoogleTrendsData;
  synthesis?: {
    key_insights: string[];
    sentiment_summary: string;
    content_gaps: string[];
    recommended_angles: string[];
  };
}

interface DeepAnalysis {
  main_pain: string;
  confidence: number;
  key_pain_points: Array<{
    pain: string;
    confidence: number;
    severity: number;
    arguments_for: string[];
    arguments_against: string[];
    verdict: string;
  }>;
  target_audience: {
    primary: string;
    segments: Array<{
      name: string;
      size: string;
      willingness_to_pay: string;
      where_to_find: string;
      communication_channels: string[];
      confidence: number;
    }>;
  };
  risks: string[];
  opportunities: Array<{
    opportunity: string;
    potential_revenue: string;
    implementation_difficulty: string;
    time_to_market: string;
  }>;
  recommended_solutions: Array<{
    type: string;
    description: string;
    mvp_features: string[];
    estimated_cost: string;
    monetization: string;
  }>;
  final_recommendation: string;
  analysis_metadata: {
    optimist_summary: string;
    skeptic_summary: string;
    consensus_reached: boolean;
    analysis_depth: string;
    data_sources_used: string[];
  };
}

interface RawAnalyses {
  optimist: {
    pains: Array<{ pain: string; evidence: string[]; target_audience: string; willingness_to_pay: string; reasoning: string }>;
    overall_assessment: string;
  };
  skeptic: {
    pains: Array<{ pain: string; evidence: string[]; target_audience: string; willingness_to_pay: string; reasoning: string }>;
    overall_assessment: string;
  };
}

type AnalysisStep = 'form' | 'collecting' | 'analyzing' | 'results';
type ResultsTab = 'research' | 'business' | 'solutions';

export default function NicheResearchPage() {
  const t = useTranslations();

  // Form state
  const [niche, setNiche] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [existingProblems, setExistingProblems] = useState('');

  // Analysis state
  const [step, setStep] = useState<AnalysisStep>('form');
  const [stepProgress, setStepProgress] = useState('');
  const [sources, setSources] = useState<SourcesData | null>(null);
  const [deepAnalysis, setDeepAnalysis] = useState<DeepAnalysis | null>(null);
  const [rawAnalyses, setRawAnalyses] = useState<RawAnalyses | null>(null);
  const [error, setError] = useState('');

  // UI state
  const [resultsTab, setResultsTab] = useState<ResultsTab>('research');
  const [savedToFavorites, setSavedToFavorites] = useState(false);

  // ProductSpec state
  const [productSpec, setProductSpec] = useState<ProductSpecification | null>(null);
  const [productSpecLoading, setProductSpecLoading] = useState(false);
  const [productSpecError, setProductSpecError] = useState('');

  // Auto-save to favorites when analysis is complete
  useEffect(() => {
    if (deepAnalysis && !savedToFavorites) {
      saveToFavorites();
    }
  }, [deepAnalysis]);

  const saveToFavorites = () => {
    if (!deepAnalysis || savedToFavorites) return;

    const newTrend = {
      id: `niche-${Date.now()}`,
      title: niche,
      category: 'Custom Niche',
      popularity_score: Math.round(deepAnalysis.confidence * 10),
      growth_rate: sources?.google_trends?.growth_rate || 0,
      why_trending: description,
      opportunity_score: Math.round(deepAnalysis.confidence),
      pain_score: deepAnalysis.key_pain_points[0]?.severity || 7,
      feasibility_score: 7,
      profit_potential: 7,
      status: 'deep_analyzed',
      key_pain_points: deepAnalysis.key_pain_points.map(p => p.pain),
      target_audience: deepAnalysis.target_audience,
      main_pain: deepAnalysis.main_pain,
      market_signals: deepAnalysis.opportunities.map(o => o.opportunity),
      deep_analysis: deepAnalysis,
      raw_analyses: rawAnalyses,
      sources: sources,
      created_at: new Date().toISOString()
    };

    // Add to favorites
    const favorites = getItem<Array<{ id: string }>>('trendhunter_favorites') || [];
    if (!favorites.find((f) => f.id === newTrend.id)) {
      favorites.unshift(newTrend);
      setItem('trendhunter_favorites', favorites);
      setSavedToFavorites(true);
    }

    // Also save to niche research history
    interface NicheResearchHistoryItem {
      id: string;
      niche: string;
      description: string;
      analysis: DeepAnalysis;
      sources: SourcesData | null;
      timestamp: string;
    }
    const history = getItem<NicheResearchHistoryItem[]>('niche_research_history') || [];
    history.unshift({
      id: newTrend.id,
      niche,
      description,
      analysis: deepAnalysis,
      sources,
      timestamp: new Date().toISOString()
    });
    setItem('niche_research_history', history.slice(0, 20));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim() || !description.trim()) {
      setError(t.nicheResearch.fillNicheAndDescription);
      return;
    }

    setError('');
    setSources(null);
    setDeepAnalysis(null);
    setRawAnalyses(null);
    setSavedToFavorites(false);

    // Step 1: Collect real data
    setStep('collecting');
    setStepProgress(t.nicheResearch.collectingData);

    try {
      const sourcesResponse = await fetch('/api/niche-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          description,
          keywords: existingProblems ? existingProblems.split(',').map(k => k.trim()) : []
        })
      });

      const sourcesData = await sourcesResponse.json();

      if (!sourcesData.success) {
        // Continue even if sources fail - we can still do AI analysis
        console.warn('Sources collection warning:', sourcesData.error);
      }

      setSources(sourcesData.sources || null);

      // Step 2: Deep analysis with Optimist/Skeptic/Arbiter
      setStep('analyzing');
      setStepProgress(t.nicheResearch.expertAnalysis);

      const analysisResponse = await fetch('/api/niche-deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          description,
          targetAudience,
          existingProblems,
          sources: sourcesData.sources
        })
      });

      const analysisData = await analysisResponse.json();

      if (!analysisData.success) {
        setError(analysisData.error || t.nicheResearch.error);
        setStep('form');
        return;
      }

      setDeepAnalysis(analysisData.analysis);
      setRawAnalyses(analysisData.raw_analyses);
      setStep('results');

    } catch (err) {
      console.error('Analysis error:', err);
      setError(t.errors.networkError);
      setStep('form');
    }
  };

  const resetForm = () => {
    setStep('form');
    setNiche('');
    setDescription('');
    setTargetAudience('');
    setExistingProblems('');
    setSources(null);
    setDeepAnalysis(null);
    setRawAnalyses(null);
    setSavedToFavorites(false);
    setError('');
    setProductSpec(null);
    setProductSpecError('');
  };

  // Generate ProductSpec
  const generateProductSpec = async () => {
    if (!deepAnalysis) return;

    setProductSpecLoading(true);
    setProductSpecError('');

    try {
      const response = await fetch('/api/product-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend: {
            title: niche,
            category: 'Custom Niche',
            why_trending: description
          },
          analysis: {
            main_pain: deepAnalysis.main_pain,
            key_pain_points: deepAnalysis.key_pain_points.map(p => p.pain),
            target_audience: deepAnalysis.target_audience,
            opportunities: deepAnalysis.opportunities.map(o => o.opportunity),
            risks: deepAnalysis.risks
          }
        })
      });

      const data = await response.json();

      if (data.success && data.product_spec) {
        setProductSpec(data.product_spec);
      } else {
        setProductSpecError(data.error || t.nicheResearch.productSpecError);
      }
    } catch (err) {
      console.error('ProductSpec generation error:', err);
      setProductSpecError(t.nicheResearch.connectionError);
    } finally {
      setProductSpecLoading(false);
    }
  };

  return (
    <div className="pb-20 lg:pb-0">
      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-[var(--border-color)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">{t.nicheResearch.title}</h1>
              <p className="text-xs sm:text-sm text-[var(--text-muted)] mt-1">
                {step === 'form' && t.nicheResearch.subtitle}
                {step === 'collecting' && t.nicheResearch.collectingData}
                {step === 'analyzing' && t.nicheResearch.expertAnalysis}
                {step === 'results' && `${t.nicheResearch.analysisComplete}${savedToFavorites ? ` • ${t.nicheResearch.savedToFavorites}` : ''}`}
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              {savedToFavorites && (
                <Link
                  href="/favorites"
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl text-xs sm:text-sm text-green-400"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  <span className="hidden sm:inline">{t.nicheResearch.inFavorites}</span>
                </Link>
              )}
              <Link
                href="/"
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-xs sm:text-sm text-[var(--text-secondary)] transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                <span className="hidden sm:inline">{t.nicheResearch.backToTrends}</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Progress indicator */}
        {(step === 'collecting' || step === 'analyzing') && (
          <div className="mb-8 trend-card">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`w-3 h-3 rounded-full ${step === 'collecting' ? 'bg-indigo-500 animate-pulse' : 'bg-green-500'}`} />
                  <span className={step === 'collecting' ? 'text-[var(--text-primary)]' : 'text-green-400'}>
                    1. {t.nicheResearch.dataCollection}
                  </span>
                  <span className={`w-3 h-3 rounded-full ${step === 'analyzing' ? 'bg-indigo-500 animate-pulse' : 'bg-zinc-600'}`} />
                  <span className={step === 'analyzing' ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)]'}>
                    2. {t.trendDetail.analysis.deepAnalysis}
                  </span>
                </div>
                <p className="text-sm text-[var(--text-muted)]">{stepProgress}</p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        {step === 'form' && (
          <div className="trend-card mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm">🔍</span>
              {t.nicheResearch.describeNiche}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    {t.nicheResearch.nicheName} *
                  </label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    placeholder={t.nicheResearch.nicheNamePlaceholder}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    {t.nicheResearch.targetAudienceLabel}
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder={t.nicheResearch.targetAudiencePlaceholder}
                    className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  {t.nicheResearch.problemDescription} *
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.nicheResearch.problemDescriptionPlaceholder}
                  rows={4}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                  {t.nicheResearch.keywords}
                </label>
                <input
                  type="text"
                  value={existingProblems}
                  onChange={(e) => setExistingProblems(e.target.value)}
                  placeholder={t.nicheResearch.keywordsPlaceholder}
                  className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!niche.trim() || !description.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-white font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:shadow-none"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {t.nicheResearch.runDeepAnalysis}
              </button>

              <p className="text-xs text-center text-[var(--text-muted)]">
                {t.nicheResearch.analysisIncludes}
              </p>
            </form>
          </div>
        )}

        {/* Results */}
        {step === 'results' && deepAnalysis && (
          <div className="space-y-6 animate-fadeIn">
            {/* Confidence Score Banner */}
            <div className="trend-card bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-[var(--text-primary)]">{niche}</h2>
                  <p className="text-sm text-[var(--text-muted)] mt-1">{deepAnalysis.main_pain}</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                    {deepAnalysis.confidence.toFixed(1)}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{t.nicheResearch.confidenceScore} /10</div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-[var(--border-color)] pb-2">
              {(['research', 'business', 'solutions'] as ResultsTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setResultsTab(tab)}
                  className={`px-4 py-2 rounded-t-xl text-sm font-medium transition-all ${
                    resultsTab === tab
                      ? 'bg-indigo-500/20 text-indigo-400 border-b-2 border-indigo-500'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                  }`}
                >
                  {tab === 'research' && t.nicheResearch.tabResearch}
                  {tab === 'business' && t.nicheResearch.tabBusiness}
                  {tab === 'solutions' && t.nicheResearch.tabSolutions}
                </button>
              ))}
            </div>

            {/* Research Tab */}
            {resultsTab === 'research' && (
              <div className="space-y-6">
                {/* Sources Summary */}
                {sources && (
                  <div className="trend-card">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm">📡</span>
                      {t.nicheResearch.collectedData}
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                      {/* Reddit */}
                      <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-orange-500">🔥</span>
                          <span className="font-medium text-[var(--text-primary)]">Reddit</span>
                        </div>
                        {sources.reddit.error ? (
                          <p className="text-xs text-yellow-400">{sources.reddit.error}</p>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-[var(--text-primary)]">{sources.reddit.posts.length}</p>
                            <p className="text-xs text-[var(--text-muted)]">{t.nicheResearch.postsFound}</p>
                            {sources.reddit.communities.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {sources.reddit.communities.slice(0, 3).map((c, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 bg-orange-500/20 text-orange-400 rounded-full">
                                    r/{c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Google Trends */}
                      <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-blue-500">📈</span>
                          <span className="font-medium text-[var(--text-primary)]">Google Trends</span>
                        </div>
                        {sources.google_trends.error ? (
                          <p className="text-xs text-yellow-400">{sources.google_trends.error}</p>
                        ) : (
                          <>
                            <p className={`text-2xl font-bold ${sources.google_trends.growth_rate >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {sources.google_trends.growth_rate >= 0 ? '+' : ''}{sources.google_trends.growth_rate}%
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{t.nicheResearch.yearlyGrowth}</p>
                            {sources.google_trends.related_queries?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {sources.google_trends.related_queries.slice(0, 2).map((q, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                                    {q.query}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* YouTube */}
                      <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-red-500">▶️</span>
                          <span className="font-medium text-[var(--text-primary)]">YouTube</span>
                        </div>
                        {sources.youtube.error ? (
                          <p className="text-xs text-yellow-400">{sources.youtube.error}</p>
                        ) : (
                          <>
                            <p className="text-2xl font-bold text-[var(--text-primary)]">{sources.youtube.videos.length}</p>
                            <p className="text-xs text-[var(--text-muted)]">{t.nicheResearch.videosFound}</p>
                            {sources.youtube.channels.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {sources.youtube.channels.slice(0, 2).map((c, i) => (
                                  <span key={i} className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full truncate max-w-[100px]">
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>

                    {/* AI Synthesis */}
                    {sources.synthesis && sources.synthesis.key_insights.length > 0 && (
                      <div className="mt-4 p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
                        <h4 className="text-sm font-medium text-[var(--text-primary)] mb-2">{t.nicheResearch.aiSynthesis}:</h4>
                        <ul className="space-y-1">
                          {sources.synthesis.key_insights.map((insight, i) => (
                            <li key={i} className="text-sm text-[var(--text-secondary)] flex items-start gap-2">
                              <span className="text-indigo-400">•</span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Expert Opinions */}
                {rawAnalyses && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Optimist */}
                    <div className="trend-card border-green-500/30">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-sm">😊</span>
                        {t.nicheResearch.optimist}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">
                        {rawAnalyses.optimist.overall_assessment}
                      </p>
                      <div className="space-y-2">
                        {rawAnalyses.optimist.pains.slice(0, 2).map((pain, i) => (
                          <div key={i} className="p-2 bg-green-500/10 rounded-lg text-sm">
                            <p className="text-[var(--text-primary)] font-medium">{pain.pain}</p>
                            <p className="text-xs text-green-400 mt-1">{pain.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Skeptic */}
                    <div className="trend-card border-red-500/30">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-sm">🤔</span>
                        {t.nicheResearch.skeptic}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">
                        {rawAnalyses.skeptic.overall_assessment}
                      </p>
                      <div className="space-y-2">
                        {rawAnalyses.skeptic.pains.slice(0, 2).map((pain, i) => (
                          <div key={i} className="p-2 bg-red-500/10 rounded-lg text-sm">
                            <p className="text-[var(--text-primary)] font-medium">{pain.pain}</p>
                            <p className="text-xs text-red-400 mt-1">{pain.reasoning}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Business Tab */}
            {resultsTab === 'business' && (
              <div className="space-y-6">
                {/* Pain Points with Arguments */}
                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-sm">💢</span>
                    {t.nicheResearch.validatedPainPoints}
                  </h3>
                  <div className="space-y-4">
                    {deepAnalysis.key_pain_points.map((pain, idx) => (
                      <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                        <div className="flex items-start justify-between gap-4 mb-3">
                          <div className="flex-1">
                            <p className="text-[var(--text-primary)] font-medium">{pain.pain}</p>
                            <p className="text-sm text-[var(--text-muted)] mt-1">{pain.verdict}</p>
                          </div>
                          <div className="flex gap-2">
                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                              pain.severity >= 8 ? 'bg-red-500/20 text-red-400' :
                              pain.severity >= 5 ? 'bg-yellow-500/20 text-yellow-400' :
                              'bg-green-500/20 text-green-400'
                            }`}>
                              {pain.severity}/10
                            </div>
                            <div className="px-3 py-1 rounded-full text-sm font-medium bg-indigo-500/20 text-indigo-400">
                              {pain.confidence.toFixed(1)} {t.nicheResearch.confidence}
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="p-2 bg-green-500/10 rounded-lg">
                            <p className="text-green-400 font-medium mb-1">{t.nicheResearch.forArguments}:</p>
                            <ul className="space-y-1">
                              {pain.arguments_for.slice(0, 2).map((arg, i) => (
                                <li key={i} className="text-[var(--text-secondary)]">• {arg}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="p-2 bg-red-500/10 rounded-lg">
                            <p className="text-red-400 font-medium mb-1">{t.nicheResearch.againstArguments}:</p>
                            <ul className="space-y-1">
                              {pain.arguments_against.slice(0, 2).map((arg, i) => (
                                <li key={i} className="text-[var(--text-secondary)]">• {arg}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Target Audience */}
                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm">👥</span>
                    {t.nicheResearch.primaryAudience}: {deepAnalysis.target_audience.primary}
                  </h3>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {deepAnalysis.target_audience.segments.map((segment, idx) => (
                      <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-medium text-[var(--text-primary)]">{segment.name}</h4>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            segment.willingness_to_pay === 'high' ? 'bg-green-500/20 text-green-400' :
                            segment.willingness_to_pay === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-zinc-500/20 text-zinc-400'
                          }`}>
                            💰 {segment.willingness_to_pay === 'high' ? t.nicheResearch.high : segment.willingness_to_pay === 'medium' ? t.nicheResearch.medium : t.nicheResearch.low}
                          </span>
                        </div>
                        <div className="space-y-2 text-sm">
                          <p className="text-[var(--text-muted)]">{t.nicheResearch.segmentSize}: {segment.size}</p>
                          <p className="text-[var(--text-muted)]">{t.nicheResearch.whereToFind}: {segment.where_to_find}</p>
                          {segment.communication_channels && segment.communication_channels.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {segment.communication_channels.map((channel, i) => (
                                <span key={i} className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full">
                                  {channel}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Risks & Opportunities */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <div className="trend-card border-red-500/30">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-sm">⚠️</span>
                      {t.nicheResearch.risks}
                    </h3>
                    <ul className="space-y-2">
                      {deepAnalysis.risks.map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                          <span className="text-red-400">•</span>
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="trend-card border-green-500/30">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-sm">💡</span>
                      {t.nicheResearch.opportunities}
                    </h3>
                    <div className="space-y-3">
                      {deepAnalysis.opportunities.map((opp, idx) => (
                        <div key={idx} className="p-3 bg-green-500/10 rounded-lg">
                          <p className="text-[var(--text-primary)] font-medium text-sm">{opp.opportunity}</p>
                          <div className="flex gap-4 mt-2 text-xs text-[var(--text-muted)]">
                            <span>💰 {opp.potential_revenue}</span>
                            <span>⏱ {opp.time_to_market}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Solutions Tab */}
            {resultsTab === 'solutions' && (
              <div className="space-y-6">
                {/* Final Recommendation */}
                <div className="trend-card bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border-indigo-500/30">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm">🎯</span>
                    {t.nicheResearch.arbiterRecommendation}
                  </h3>
                  <p className="text-[var(--text-secondary)]">{deepAnalysis.final_recommendation}</p>
                </div>

                {/* Recommended Solutions */}
                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-sm">🚀</span>
                    {t.nicheResearch.recommendedSolutions}
                  </h3>
                  <div className="space-y-4">
                    {deepAnalysis.recommended_solutions.map((solution, idx) => (
                      <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-5 border border-[var(--border-color)] hover:border-indigo-500/30 transition-all">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-sm font-medium">
                            {solution.type}
                          </span>
                          <span className="text-xs text-[var(--text-muted)]">{solution.estimated_cost}</span>
                        </div>
                        <p className="text-[var(--text-primary)] mb-3">{solution.description}</p>
                        <div className="mb-3">
                          <p className="text-xs text-[var(--text-muted)] mb-2">{t.nicheResearch.mvpFeatures}:</p>
                          <div className="flex flex-wrap gap-1">
                            {solution.mvp_features.map((feature, i) => (
                              <span key={i} className="text-xs px-2 py-1 bg-[var(--bg-card)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-color)]">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-[var(--text-muted)]">
                          {t.nicheResearch.monetization}: <span className="text-green-400">{solution.monetization}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ProductSpec Section */}
                <div className="trend-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center text-sm">🧠</span>
                      AI Product Specification
                    </h3>
                    {!productSpec && !productSpecLoading && (
                      <button
                        onClick={generateProductSpec}
                        className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl text-white text-sm font-medium transition-all"
                      >
                        {t.nicheResearch.generateProductSpec}
                      </button>
                    )}
                  </div>

                  {productSpecLoading && (
                    <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-pulse">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-zinc-700" />
                        <div className="h-5 w-48 bg-zinc-700 rounded" />
                      </div>
                      <div className="space-y-3">
                        <div className="h-4 w-full bg-zinc-800 rounded" />
                        <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                        <div className="h-4 w-1/2 bg-zinc-800 rounded" />
                      </div>
                      <p className="text-sm text-[var(--text-muted)] mt-4 text-center">
                        {t.nicheResearch.generatingProductSpec}
                      </p>
                    </div>
                  )}

                  {productSpecError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {productSpecError}
                      <button
                        onClick={generateProductSpec}
                        className="ml-2 underline hover:no-underline"
                      >
                        {t.nicheResearch.tryAgain}
                      </button>
                    </div>
                  )}

                  {productSpec && (
                    <ProductSpecPreview spec={productSpec} />
                  )}

                  {!productSpec && !productSpecLoading && !productSpecError && (
                    <p className="text-sm text-[var(--text-muted)] text-center py-4">
                      {t.nicheResearch.productSpecHint}
                    </p>
                  )}
                </div>

                {/* Analysis Metadata */}
                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-500 to-zinc-600 flex items-center justify-center text-sm">📋</span>
                    {t.nicheResearch.analysisMetadata}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
                      <p className="text-xs text-[var(--text-muted)] mb-1">{t.nicheResearch.analysisDepth}</p>
                      <p className="text-[var(--text-primary)] font-medium capitalize">{deepAnalysis.analysis_metadata.analysis_depth}</p>
                    </div>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl">
                      <p className="text-xs text-[var(--text-muted)] mb-1">{t.nicheResearch.consensusReached}</p>
                      <p className={`font-medium ${deepAnalysis.analysis_metadata.consensus_reached ? 'text-green-400' : 'text-yellow-400'}`}>
                        {deepAnalysis.analysis_metadata.consensus_reached ? t.nicheResearch.yes : t.nicheResearch.partial}
                      </p>
                    </div>
                    <div className="p-3 bg-[var(--bg-secondary)] rounded-xl md:col-span-2">
                      <p className="text-xs text-[var(--text-muted)] mb-1">{t.nicheResearch.usedSources}</p>
                      <div className="flex gap-2">
                        {deepAnalysis.analysis_metadata.data_sources_used.map((source, i) => (
                          <span key={i} className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs">
                            {source}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/favorites"
                className="flex-1 flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-white font-medium transition-all text-sm sm:text-base"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                {t.nicheResearch.openInFavorites}
              </Link>
              <button
                onClick={resetForm}
                className="px-4 sm:px-6 py-3 sm:py-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] font-medium transition-all text-sm sm:text-base"
              >
                {t.nicheResearch.newResearch}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
