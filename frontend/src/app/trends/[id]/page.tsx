'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import TrendChat from '@/components/TrendChat';

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

interface AnalysisSegment {
  name: string;
  size: string;
  willingness_to_pay: string;
  where_to_find?: string;
  confidence?: number;
}

interface TrendAnalysis {
  trend_id: string;
  trend_title: string;
  main_pain: string;
  key_pain_points: string[];
  target_audience: {
    segments: AnalysisSegment[];
  };
  real_sources?: {
    reddit?: {
      posts: Array<{
        title: string;
        subreddit: string;
        score: number;
        num_comments: number;
        url: string;
        created: string;
      }>;
      communities: string[];
      engagement: number;
    };
    youtube?: {
      videos: Array<{
        title: string;
        channel: string;
        videoId: string;
        url: string;
        publishedAt: string;
        thumbnail: string;
      }>;
      channels: string[];
    };
    google_trends?: {
      growth_rate: number;
      related_queries: Array<{ query: string; growth: string; link?: string }>;
      interest_timeline?: Array<{ date: string; value: number }>;
      google_trends_url?: string;
      is_mock_data?: boolean;
    };
  };
  sentiment_score?: number;
  status: string;
  analyzed_at: string;
  analysis_type?: 'basic' | 'deep';
}

type FlowStep = 'overview' | 'analysis' | 'sources' | 'competition' | 'venture' | 'leads' | 'pitch-deck' | 'project';

interface DecisionMaker {
  role: string;
  likely_email_format: string;
}

interface PotentialCompany {
  name: string;
  website: string;
  email: string;
  email_pattern?: string;
  industry: string;
  size?: string;
  location?: string;
  relevance_score: number;
  pain_match: string;
  decision_makers?: DecisionMaker[];
  outreach_angle?: string;
  linkedin_search_query?: string;
}

interface LeadsData {
  companies: PotentialCompany[];
  search_tips?: string[];
  linkedin_queries?: string[];
  directories?: Array<{ name: string; url: string; description: string }>;
}

interface GeneratedEmail {
  subject: string;
  body: string;
  follow_up_subject?: string;
  follow_up_body?: string;
  tips?: string[];
}

interface Competitor {
  name: string;
  website: string;
  description: string;
  source: string;
  source_url: string;
}

interface CompetitionData {
  competitors: Competitor[];
  market_saturation: 'low' | 'medium' | 'high';
  blue_ocean_score: number;
  opportunity_areas: string[];
  risk_level: 'low' | 'medium' | 'high';
  sources: Array<{ name: string; url: string; accessed_at: string }>;
}

interface FundingRound {
  company: string;
  amount: string;
  round_type: string;
  date: string;
  investors: string[];
  source_url: string;
}

interface ActiveFund {
  name: string;
  focus_areas: string[];
  typical_check_size: string;
  website: string;
  crunchbase_url: string;
}

interface VentureData {
  niche: string;
  total_funding_last_year: string;
  average_round_size: string;
  funding_trend: 'growing' | 'stable' | 'declining';
  recent_rounds: FundingRound[];
  active_funds: ActiveFund[];
  investment_hotness: number;
  market_signals: string[];
  sources: Array<{ name: string; url: string; accessed_at: string }>;
}

interface PitchSlide {
  number: number;
  title: string;
  type: string;
  content: string[];
  speaker_notes: string;
  visual_suggestion: string;
}

interface PitchDeck {
  title: string;
  tagline: string;
  slides: PitchSlide[];
  sources: Array<{ name: string; url: string }>;
  export_formats: {
    google_slides_template: string;
    figma_template: string;
    canva_template: string;
  };
}

export default function TrendPage() {
  const params = useParams();
  const router = useRouter();
  const trendId = params.id as string;

  const [trend, setTrend] = useState<Trend | null>(null);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [collectingSources, setCollectingSources] = useState(false);
  const [currentStep, setCurrentStep] = useState<FlowStep>('overview');
  const [isFavorite, setIsFavorite] = useState(false);

  // Deep analysis states (3 agents debate)
  interface AgentAnalysis {
    pains: Array<{
      pain: string;
      evidence: string[];
      target_audience: string;
      willingness_to_pay: string;
      reasoning: string;
    }>;
    overall_assessment: string;
  }
  const [rawAnalyses, setRawAnalyses] = useState<{
    optimist: AgentAnalysis | null;
    skeptic: AgentAnalysis | null;
  }>({ optimist: null, skeptic: null });
  const [analysisMetadata, setAnalysisMetadata] = useState<{
    optimist_summary?: string;
    skeptic_summary?: string;
    consensus_reached?: boolean;
  } | null>(null);

  // New data states
  const [competition, setCompetition] = useState<CompetitionData | null>(null);
  const [loadingCompetition, setLoadingCompetition] = useState(false);
  const [ventureData, setVentureData] = useState<VentureData | null>(null);
  const [loadingVenture, setLoadingVenture] = useState(false);
  const [pitchDeck, setPitchDeck] = useState<PitchDeck | null>(null);
  const [loadingPitch, setLoadingPitch] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);

  // Leads & Email states
  const [leadsData, setLeadsData] = useState<LeadsData | null>(null);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<PotentialCompany | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailTone, setEmailTone] = useState<'formal' | 'friendly' | 'professional'>('professional');
  const [senderName, setSenderName] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);

  // Fetch trend data
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch trend
        const trendsRes = await fetch('/api/trends');
        const trendsData = await trendsRes.json();
        const foundTrend = trendsData.trends?.find((t: Trend) => t.id === trendId);
        if (foundTrend) {
          setTrend(foundTrend);
        }

        // Fetch analysis if exists
        const analysisRes = await fetch('/api/trends/analyze');
        const analysisData = await analysisRes.json();
        if (analysisData.analyses?.[trendId]) {
          setAnalysis(analysisData.analyses[trendId]);
          // If analysis exists, we can show more steps
          if (analysisData.analyses[trendId].real_sources) {
            setCurrentStep('sources');
          } else {
            setCurrentStep('analysis');
          }
        }

        // Check if favorite
        const favorites = JSON.parse(localStorage.getItem('trendhunter_favorites') || '[]');
        setIsFavorite(favorites.includes(trendId));
      } catch (error) {
        console.error('Error fetching trend:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trendId]);

  const handleFavorite = () => {
    const favorites = JSON.parse(localStorage.getItem('trendhunter_favorites') || '[]');
    const favoritesData = JSON.parse(localStorage.getItem('trendhunter_favorites_data') || '[]');

    if (isFavorite) {
      const newFavorites = favorites.filter((id: string) => id !== trendId);
      const newFavoritesData = favoritesData.filter((t: Trend) => t.id !== trendId);
      localStorage.setItem('trendhunter_favorites', JSON.stringify(newFavorites));
      localStorage.setItem('trendhunter_favorites_data', JSON.stringify(newFavoritesData));
      setIsFavorite(false);
    } else {
      favorites.push(trendId);
      if (trend) favoritesData.push(trend);
      localStorage.setItem('trendhunter_favorites', JSON.stringify(favorites));
      localStorage.setItem('trendhunter_favorites_data', JSON.stringify(favoritesData));
      setIsFavorite(true);
    }
  };

  const runAnalysis = async () => {
    if (!trend) return;
    setAnalyzing(true);

    try {
      const response = await fetch('/api/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trend.id,
          trend_title: trend.title,
          trend_category: trend.category,
          why_trending: trend.why_trending,
        }),
      });

      const data = await response.json();
      if (data.success && data.analysis) {
        // Save the arbitration result as analysis
        setAnalysis({
          trend_id: trend.id,
          trend_title: trend.title,
          main_pain: data.analysis.main_pain,
          key_pain_points: data.analysis.key_pain_points?.map((p: { pain: string }) => p.pain) || [],
          target_audience: data.analysis.target_audience,
          sentiment_score: data.analysis.confidence,
          status: 'analyzed',
          analyzed_at: data.timestamp || new Date().toISOString(),
          analysis_type: 'deep',
        });

        // Save raw analyses from Optimist and Skeptic
        if (data.raw_analyses) {
          setRawAnalyses({
            optimist: data.raw_analyses.optimist,
            skeptic: data.raw_analyses.skeptic,
          });
        }

        // Save metadata
        if (data.analysis.analysis_metadata) {
          setAnalysisMetadata(data.analysis.analysis_metadata);
        }

        setCurrentStep('analysis');
      }
    } catch (error) {
      console.error('Error running analysis:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  const collectSources = async () => {
    if (!trend) return;
    setCollectingSources(true);

    try {
      const response = await fetch('/api/collect-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trend.title,
          trend_title: trend.title,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update analysis with sources
        const updatedAnalysis = {
          ...analysis,
          trend_id: trend.id,
          trend_title: trend.title,
          real_sources: data.sources,
          status: 'sources_collected',
          analyzed_at: new Date().toISOString(),
        } as TrendAnalysis;

        setAnalysis(updatedAnalysis);
        setCurrentStep('sources');

        // Save to API
        await fetch('/api/trends/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedAnalysis),
        });
      }
    } catch (error) {
      console.error('Error collecting sources:', error);
    } finally {
      setCollectingSources(false);
    }
  };

  const getOverallScore = (t: Trend) => {
    return ((t.opportunity_score + t.pain_score + t.feasibility_score + t.profit_potential) / 4).toFixed(1);
  };

  // Fetch competition data
  const fetchCompetition = async () => {
    if (!trend || competition) return;
    setLoadingCompetition(true);

    try {
      const response = await fetch('/api/competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend_title: trend.title }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setCompetition(data.data);
      }
    } catch (error) {
      console.error('Error fetching competition:', error);
    } finally {
      setLoadingCompetition(false);
    }
  };

  // Fetch venture data
  const fetchVentureData = async () => {
    if (!trend || ventureData) return;
    setLoadingVenture(true);

    try {
      const response = await fetch('/api/venture-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend_title: trend.title }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setVentureData(data.data);
      }
    } catch (error) {
      console.error('Error fetching venture data:', error);
    } finally {
      setLoadingVenture(false);
    }
  };

  // Generate pitch deck
  const generatePitchDeck = async () => {
    if (!trend || pitchDeck) return;
    setLoadingPitch(true);

    try {
      const response = await fetch('/api/pitch-deck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_data: {
            title: trend.title,
            category: trend.category,
            why_trending: trend.why_trending,
            key_pain_points: analysis?.key_pain_points,
            target_audience: analysis?.target_audience?.segments?.map(s => s.name).join(', '),
            competitors: competition?.competitors,
          },
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setPitchDeck(data.data);
      }
    } catch (error) {
      console.error('Error generating pitch deck:', error);
    } finally {
      setLoadingPitch(false);
    }
  };

  // Fetch potential leads/companies
  const fetchLeads = async () => {
    if (!trend || !analysis?.main_pain || leadsData) return;
    setLoadingLeads(true);

    try {
      const response = await fetch('/api/find-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: trend.title,
          painPoint: analysis.main_pain,
          count: 10,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setLeadsData({
          companies: data.companies || [],
          search_tips: data.search_tips,
          linkedin_queries: data.linkedin_queries,
          directories: data.directories,
        });
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Generate email for selected company
  const generateEmail = async () => {
    if (!selectedCompany || !trend || !analysis?.main_pain || !senderName) return;
    setLoadingEmail(true);

    try {
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: selectedCompany,
          niche: trend.title,
          painPoint: analysis.main_pain,
          senderName,
          senderCompany,
          tone: emailTone,
          language: 'ru',
        }),
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedEmail({
          subject: data.subject,
          body: data.body,
          follow_up_subject: data.follow_up_subject,
          follow_up_body: data.follow_up_body,
          tips: data.tips,
        });
      }
    } catch (error) {
      console.error('Error generating email:', error);
    } finally {
      setLoadingEmail(false);
    }
  };

  // Auto-fetch data when switching to relevant tabs
  useEffect(() => {
    if (currentStep === 'competition' && !competition && !loadingCompetition) {
      fetchCompetition();
    } else if (currentStep === 'venture' && !ventureData && !loadingVenture) {
      fetchVentureData();
    } else if (currentStep === 'leads' && !leadsData && !loadingLeads && analysis?.main_pain) {
      fetchLeads();
    } else if (currentStep === 'pitch-deck' && !pitchDeck && !loadingPitch) {
      generatePitchDeck();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  const flowSteps = [
    { id: 'overview', label: 'Обзор', icon: '📊' },
    { id: 'analysis', label: 'Анализ', icon: '🔍' },
    { id: 'sources', label: 'Источники', icon: '📚' },
    { id: 'competition', label: 'Конкуренты', icon: '🏆' },
    { id: 'venture', label: 'Инвестиции', icon: '💰' },
    { id: 'leads', label: 'Клиенты', icon: '👥' },
    { id: 'pitch-deck', label: 'Pitch Deck', icon: '📑' },
    { id: 'project', label: 'Проект', icon: '🚀' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!trend) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <Sidebar />
        <div className="lg:ml-64 p-8">
          <div className="text-center py-20">
            <h1 className="text-2xl text-white mb-4">Тренд не найден</h1>
            <Link href="/" className="text-indigo-400 hover:text-indigo-300">
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Sidebar />

      <div className="lg:ml-64 min-h-screen">
        {/* Breadcrumbs */}
        <div className="px-6 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
              Главная
            </Link>
            <span className="text-zinc-600">/</span>
            <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
              Тренды
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-white truncate max-w-[300px]">{trend.title}</span>
          </div>
        </div>

        {/* Flow Steps */}
        <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/30">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {flowSteps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isPast = flowSteps.findIndex(s => s.id === currentStep) > index;
              const isClickable = isPast || step.id === 'overview' ||
                (step.id === 'analysis' && analysis) ||
                (step.id === 'sources' && analysis?.real_sources) ||
                (step.id === 'competition' && analysis?.real_sources) ||
                (step.id === 'venture' && analysis?.real_sources) ||
                (step.id === 'leads' && analysis?.main_pain) ||
                (step.id === 'pitch-deck' && analysis) ||
                (step.id === 'project' && analysis?.real_sources);

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => isClickable && setCurrentStep(step.id as FlowStep)}
                    disabled={!isClickable}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isPast
                        ? 'bg-zinc-800 text-white'
                        : isClickable
                        ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <span>{step.icon}</span>
                    <span className="whitespace-nowrap">{step.label}</span>
                  </button>
                  {index < flowSteps.length - 1 && (
                    <div className={`w-8 h-0.5 mx-1 ${isPast ? 'bg-indigo-500' : 'bg-zinc-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-sm">
                  {trend.category}
                </span>
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm">
                  +{trend.growth_rate}% рост
                </span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-3">{trend.title}</h1>
              <p className="text-zinc-400 max-w-2xl">{trend.why_trending}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleFavorite}
                className={`p-3 rounded-xl transition-all ${
                  isFavorite
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'bg-zinc-800 text-zinc-400 hover:text-amber-400'
                }`}
              >
                <svg className="w-6 h-6" fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
              <div className="text-right">
                <div className="text-3xl font-bold text-white">{getOverallScore(trend)}</div>
                <div className="text-xs text-zinc-500">Общая оценка</div>
              </div>
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 'overview' && (
            <div className="space-y-6">
              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Возможность', value: trend.opportunity_score, icon: '🎯', color: 'indigo' },
                  { label: 'Острота боли', value: trend.pain_score, icon: '🔥', color: 'red' },
                  { label: 'Выполнимость', value: trend.feasibility_score, icon: '⚡', color: 'amber' },
                  { label: 'Потенциал', value: trend.profit_potential, icon: '💰', color: 'emerald' },
                ].map((metric) => (
                  <div key={metric.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{metric.icon}</span>
                      <span className="text-sm text-zinc-400">{metric.label}</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{metric.value}</div>
                    <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-${metric.color}-500 rounded-full`}
                        style={{ width: `${metric.value * 10}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Info */}
              <div className="grid lg:grid-cols-2 gap-6">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Информация</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Источник</span>
                      <span className="text-white">{trend.source || 'Google Trends'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Обнаружен</span>
                      <span className="text-white">
                        {new Date(trend.first_detected_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Статус</span>
                      <span className="text-emerald-400">{trend.status}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Следующий шаг</h3>
                  <p className="text-zinc-400 mb-4">
                    Запустите AI-анализ для выявления болевых точек и целевой аудитории.
                  </p>
                  <button
                    onClick={runAnalysis}
                    disabled={analyzing}
                    className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      analyzing
                        ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {analyzing ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        Анализирую...
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        Запустить анализ
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {currentStep === 'analysis' && analysis && (
            <div className="space-y-6">
              {/* Analysis Type Badge */}
              {analysis.analysis_type === 'deep' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full flex items-center gap-1">
                    <span>🧠</span> Глубокий анализ: 3 AI-агента
                  </span>
                  {analysisMetadata?.consensus_reached && (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full">
                      ✓ Консенсус достигнут
                    </span>
                  )}
                </div>
              )}

              {/* AI Agents Debate */}
              {rawAnalyses.optimist && rawAnalyses.skeptic && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <span>⚔️</span> Дебаты AI-агентов
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">Два агента спорят о потенциале ниши, третий выносит вердикт</p>
                  </div>

                  <div className="grid md:grid-cols-2 divide-x divide-zinc-800">
                    {/* Optimist */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl">😊</span>
                        <div>
                          <div className="font-medium text-emerald-400">Оптимист</div>
                          <div className="text-xs text-zinc-500">Венчурный аналитик</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {rawAnalyses.optimist.pains.slice(0, 3).map((pain, i) => (
                          <div key={i} className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                            <div className="text-sm font-medium text-white mb-1">{pain.pain}</div>
                            <div className="text-xs text-zinc-400">{pain.reasoning}</div>
                            <div className="mt-2 flex items-center gap-1">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                pain.willingness_to_pay === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                                pain.willingness_to_pay === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-zinc-500/20 text-zinc-300'
                              }`}>
                                Готовность платить: {pain.willingness_to_pay}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                        <div className="text-xs text-zinc-500 mb-1">Вывод оптимиста:</div>
                        <div className="text-sm text-emerald-300">{analysisMetadata?.optimist_summary || rawAnalyses.optimist.overall_assessment}</div>
                      </div>
                    </div>

                    {/* Skeptic */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xl">🤨</span>
                        <div>
                          <div className="font-medium text-red-400">Скептик</div>
                          <div className="text-xs text-zinc-500">Опытный инвестор</div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {rawAnalyses.skeptic.pains.slice(0, 3).map((pain, i) => (
                          <div key={i} className="p-3 bg-red-500/5 border border-red-500/20 rounded-lg">
                            <div className="text-sm font-medium text-white mb-1">{pain.pain}</div>
                            <div className="text-xs text-zinc-400">{pain.reasoning}</div>
                            <div className="mt-2 flex items-center gap-1">
                              <span className={`text-xs px-2 py-0.5 rounded ${
                                pain.willingness_to_pay === 'high' ? 'bg-emerald-500/20 text-emerald-300' :
                                pain.willingness_to_pay === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                                'bg-zinc-500/20 text-zinc-300'
                              }`}>
                                Готовность платить: {pain.willingness_to_pay}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                        <div className="text-xs text-zinc-500 mb-1">Вывод скептика:</div>
                        <div className="text-sm text-red-300">{analysisMetadata?.skeptic_summary || rawAnalyses.skeptic.overall_assessment}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Arbiter Verdict - Main Pain */}
              <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center text-2xl">⚖️</span>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Вердикт Арбитра</h3>
                    <p className="text-sm text-zinc-400">Senior Product Strategist с 20+ лет опыта</p>
                  </div>
                  {analysis.sentiment_score && (
                    <div className="ml-auto text-right">
                      <div className="text-2xl font-bold text-purple-400">{analysis.sentiment_score}/10</div>
                      <div className="text-xs text-zinc-500">Уверенность</div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-zinc-800/50 rounded-lg mb-4">
                  <div className="text-xs text-purple-400 mb-1 flex items-center gap-1">
                    <span>🔥</span> ГЛАВНАЯ БОЛЬ
                  </div>
                  <p className="text-xl text-white">{analysis.main_pain}</p>
                </div>
              </div>

              {/* Key Pain Points */}
              {analysis.key_pain_points && analysis.key_pain_points.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Ключевые болевые точки (после арбитража)</h3>
                  <div className="space-y-3">
                    {analysis.key_pain_points.map((pain, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <span className="text-red-400">•</span>
                        <span className="text-zinc-300">{typeof pain === 'string' ? pain : (pain as { pain?: string }).pain || JSON.stringify(pain)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Audience */}
              {analysis.target_audience?.segments && analysis.target_audience.segments.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Целевая аудитория</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {analysis.target_audience.segments.map((segment, index) => (
                      <div key={index} className="p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium text-white">{segment.name}</div>
                          {segment.confidence && (
                            <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded">
                              {segment.confidence}/10
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-400 space-y-1">
                          <div>Размер: {segment.size}</div>
                          <div>Готовность платить: {segment.willingness_to_pay}</div>
                          {segment.where_to_find && (
                            <div>Где найти: {segment.where_to_find}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Step */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Следующий шаг</h3>
                <p className="text-zinc-400 mb-4">
                  Соберите реальные данные из Reddit, YouTube и Google Trends для подтверждения анализа.
                </p>
                <button
                  onClick={collectSources}
                  disabled={collectingSources}
                  className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                    collectingSources
                      ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                >
                  {collectingSources ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                      Собираю данные...
                    </>
                  ) : (
                    <>
                      <span>📚</span>
                      Собрать источники
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {currentStep === 'sources' && analysis?.real_sources && (
            <div className="space-y-6">
              {/* Google Trends */}
              {analysis.real_sources.google_trends && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <span>📈</span> Google Trends
                      {analysis.real_sources.google_trends.is_mock_data && (
                        <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">
                          Симуляция
                        </span>
                      )}
                    </h3>
                    {analysis.real_sources.google_trends.google_trends_url && (
                      <a
                        href={analysis.real_sources.google_trends.google_trends_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        Открыть в Google Trends
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-sm text-zinc-400 mb-1">Рост за год</div>
                      <div className={`text-2xl font-bold ${
                        analysis.real_sources.google_trends.growth_rate >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {analysis.real_sources.google_trends.growth_rate >= 0 ? '+' : ''}
                        {analysis.real_sources.google_trends.growth_rate}%
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-sm text-zinc-400 mb-1">Связанные запросы</div>
                      <div className="text-lg text-white">
                        {analysis.real_sources.google_trends.related_queries?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Related Queries */}
                  {analysis.real_sources.google_trends.related_queries &&
                   analysis.real_sources.google_trends.related_queries.length > 0 && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-3">Связанные запросы:</div>
                      <div className="space-y-2">
                        {analysis.real_sources.google_trends.related_queries.slice(0, 8).map((q, i) => {
                          // Parse growth value - can be "100", "+150%", "Breakout", etc.
                          const growthValue = q.growth || '0';
                          const isBreakout = growthValue.toLowerCase() === 'breakout';
                          const numValue = parseInt(growthValue.replace(/[^0-9-]/g, '')) || 0;

                          return (
                            <a
                              key={i}
                              href={q.link || `https://trends.google.com/trends/explore?q=${encodeURIComponent(q.query)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors group"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-zinc-500 text-sm w-6">{i + 1}.</span>
                                <span className="text-zinc-200 group-hover:text-white">{q.query}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {isBreakout ? (
                                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs font-medium">
                                    🔥 Взрыв
                                  </span>
                                ) : numValue > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <div className="w-16 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-emerald-500 rounded-full"
                                        style={{ width: `${Math.min(100, numValue)}%` }}
                                      />
                                    </div>
                                    <span className="text-emerald-400 text-xs w-8">{numValue}</span>
                                  </div>
                                ) : (
                                  <span className="text-zinc-500 text-xs">{growthValue}</span>
                                )}
                                <svg className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Reddit */}
              {analysis.real_sources.reddit && analysis.real_sources.reddit.posts.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span>💬</span> Reddit
                    <span className="text-sm font-normal text-zinc-400">
                      ({analysis.real_sources.reddit.posts.length} постов)
                    </span>
                  </h3>

                  <div className="space-y-3">
                    {analysis.real_sources.reddit.posts.slice(0, 5).map((post, index) => (
                      <a
                        key={index}
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-white font-medium mb-1 line-clamp-2">{post.title}</div>
                            <div className="flex items-center gap-3 text-sm text-zinc-400">
                              <span className="text-orange-400">r/{post.subreddit}</span>
                              <span>⬆️ {post.score}</span>
                              <span>💬 {post.num_comments}</span>
                            </div>
                          </div>
                          <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </div>
                      </a>
                    ))}
                  </div>

                  {analysis.real_sources.reddit.communities.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-zinc-700">
                      <div className="text-sm text-zinc-400 mb-2">Активные сообщества:</div>
                      <div className="flex flex-wrap gap-2">
                        {analysis.real_sources.reddit.communities.map((community, i) => (
                          <a
                            key={i}
                            href={`https://reddit.com/r/${community}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-orange-500/20 text-orange-300 rounded-lg text-sm hover:bg-orange-500/30 transition-colors"
                          >
                            r/{community}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* YouTube */}
              {analysis.real_sources.youtube && analysis.real_sources.youtube.videos.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span>🎬</span> YouTube
                    <span className="text-sm font-normal text-zinc-400">
                      ({analysis.real_sources.youtube.videos.length} видео)
                    </span>
                  </h3>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {analysis.real_sources.youtube.videos.slice(0, 6).map((video, index) => (
                      <a
                        key={index}
                        href={video.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-zinc-800/50 rounded-lg overflow-hidden hover:bg-zinc-800 transition-colors"
                      >
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          className="w-full aspect-video object-cover"
                        />
                        <div className="p-3">
                          <div className="text-white text-sm font-medium line-clamp-2 mb-1">{video.title}</div>
                          <div className="text-zinc-400 text-xs">{video.channel}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Step */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Следующий шаг</h3>
                <p className="text-zinc-400 mb-4">
                  Изучите конкурентов и инвестиционный ландшафт.
                </p>
                <button
                  onClick={() => setCurrentStep('competition')}
                  className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <span>🏆</span>
                  Анализ конкурентов
                </button>
              </div>
            </div>
          )}

          {/* Competition Tab */}
          {currentStep === 'competition' && (
            <div className="space-y-6">
              {loadingCompetition ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mb-4" />
                  <p className="text-zinc-400">Анализируем конкурентов...</p>
                </div>
              ) : competition ? (
                <>
                  {/* Competition Overview */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Насыщенность рынка</div>
                      <div className={`text-2xl font-bold ${
                        competition.market_saturation === 'low' ? 'text-emerald-400' :
                        competition.market_saturation === 'medium' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {competition.market_saturation === 'low' ? 'Низкая' :
                         competition.market_saturation === 'medium' ? 'Средняя' : 'Высокая'}
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Blue Ocean Score</div>
                      <div className="text-2xl font-bold text-indigo-400">{competition.blue_ocean_score}/10</div>
                      <div className="text-xs text-zinc-500 mt-1">Чем выше - тем меньше конкуренция</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Уровень риска</div>
                      <div className={`text-2xl font-bold ${
                        competition.risk_level === 'low' ? 'text-emerald-400' :
                        competition.risk_level === 'medium' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {competition.risk_level === 'low' ? 'Низкий' :
                         competition.risk_level === 'medium' ? 'Средний' : 'Высокий'}
                      </div>
                    </div>
                  </div>

                  {/* Competitors */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Конкуренты ({competition.competitors.length})
                    </h3>
                    <div className="space-y-3">
                      {competition.competitors.map((comp, index) => (
                        <a
                          key={index}
                          href={comp.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="text-white font-medium mb-1">{comp.name}</div>
                              <div className="text-sm text-zinc-400 line-clamp-2">{comp.description}</div>
                              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                                <span className="px-2 py-0.5 bg-zinc-700 rounded">{comp.source}</span>
                              </div>
                            </div>
                            <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Opportunity Areas */}
                  {competition.opportunity_areas.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💡</span> Области возможностей
                      </h3>
                      <div className="space-y-2">
                        {competition.opportunity_areas.map((area, index) => (
                          <div key={index} className="flex items-start gap-2 text-emerald-300">
                            <span>•</span>
                            <span>{area}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sources */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Источники данных</h3>
                    <div className="flex flex-wrap gap-2">
                      {competition.sources.map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors flex items-center gap-1"
                        >
                          {source.name}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Next Step */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Следующий шаг</h3>
                    <p className="text-zinc-400 mb-4">
                      Изучите инвестиционный ландшафт и активные фонды в этой нише.
                    </p>
                    <button
                      onClick={() => setCurrentStep('venture')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>💰</span>
                      Венчурные данные
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-400">
                  Не удалось загрузить данные о конкурентах
                </div>
              )}
            </div>
          )}

          {/* Venture Tab */}
          {currentStep === 'venture' && (
            <div className="space-y-6">
              {loadingVenture ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mb-4" />
                  <p className="text-zinc-400">Собираем данные об инвестициях...</p>
                </div>
              ) : ventureData ? (
                <>
                  {/* Overview */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Инвестиции за год</div>
                      <div className="text-2xl font-bold text-emerald-400">{ventureData.total_funding_last_year}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Средний раунд</div>
                      <div className="text-2xl font-bold text-white">{ventureData.average_round_size}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Тренд финансирования</div>
                      <div className={`text-2xl font-bold ${
                        ventureData.funding_trend === 'growing' ? 'text-emerald-400' :
                        ventureData.funding_trend === 'stable' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {ventureData.funding_trend === 'growing' ? '📈 Растёт' :
                         ventureData.funding_trend === 'stable' ? '➡️ Стабильно' : '📉 Падает'}
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Инвест. привлекательность</div>
                      <div className="text-2xl font-bold text-indigo-400">{ventureData.investment_hotness}/10</div>
                    </div>
                  </div>

                  {/* Recent Funding Rounds */}
                  {ventureData.recent_rounds.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Недавние раунды ({ventureData.recent_rounds.length})
                      </h3>
                      <div className="space-y-3">
                        {ventureData.recent_rounds.map((round, index) => (
                          <a
                            key={index}
                            href={round.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-medium">{round.company}</div>
                                <div className="text-sm text-zinc-400">
                                  {round.round_type} • {round.date}
                                  {round.investors.length > 0 && (
                                    <span> • {round.investors.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                              <div className="text-emerald-400 font-bold text-lg">{round.amount}</div>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Funds */}
                  {ventureData.active_funds.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        Активные фонды ({ventureData.active_funds.length})
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4">
                        {ventureData.active_funds.map((fund, index) => (
                          <div key={index} className="p-4 bg-zinc-800/50 rounded-lg">
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-white font-medium">{fund.name}</div>
                              <div className="text-sm text-emerald-400">{fund.typical_check_size}</div>
                            </div>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {fund.focus_areas.map((area, i) => (
                                <span key={i} className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded text-xs">
                                  {area}
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <a
                                href={fund.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-400 hover:text-indigo-300"
                              >
                                Сайт
                              </a>
                              <a
                                href={fund.crunchbase_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-400 hover:text-indigo-300"
                              >
                                Crunchbase
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Signals */}
                  {ventureData.market_signals.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>📡</span> Рыночные сигналы
                      </h3>
                      <div className="space-y-2">
                        {ventureData.market_signals.map((signal, index) => (
                          <div key={index} className="flex items-start gap-2 text-amber-300">
                            <span>•</span>
                            <span>{signal}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sources */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Источники данных</h3>
                    <div className="flex flex-wrap gap-2">
                      {ventureData.sources.map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors flex items-center gap-1"
                        >
                          {source.name}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Next Step */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Следующий шаг</h3>
                    <p className="text-zinc-400 mb-4">
                      Найдите потенциальных клиентов с контактами для outreach.
                    </p>
                    <button
                      onClick={() => setCurrentStep('leads')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>👥</span>
                      Найти клиентов
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-400">
                  Не удалось загрузить венчурные данные
                </div>
              )}
            </div>
          )}

          {/* Leads Tab */}
          {currentStep === 'leads' && (
            <div className="space-y-6">
              {loadingLeads ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mb-4" />
                  <p className="text-zinc-400">Ищем потенциальных клиентов...</p>
                </div>
              ) : leadsData && leadsData.companies.length > 0 ? (
                <>
                  {/* Overview */}
                  <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <span>👥</span> Потенциальные клиенты
                    </h2>
                    <p className="text-zinc-400">
                      Найдено {leadsData.companies.length} компаний, которые могут быть заинтересованы в решении проблемы &quot;{analysis?.main_pain}&quot;
                    </p>
                  </div>

                  {/* Companies List */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Компании ({leadsData.companies.length})
                    </h3>
                    <div className="space-y-4">
                      {leadsData.companies.map((company, index) => (
                        <div key={index} className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-white font-medium text-lg">{company.name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  company.relevance_score >= 8 ? 'bg-emerald-500/20 text-emerald-300' :
                                  company.relevance_score >= 6 ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-zinc-500/20 text-zinc-300'
                                }`}>
                                  {company.relevance_score}/10 релевантность
                                </span>
                              </div>
                              <p className="text-sm text-zinc-400 mb-3">{company.pain_match}</p>

                              <div className="flex flex-wrap gap-2 mb-3">
                                <span className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded text-xs">
                                  {company.industry}
                                </span>
                                {company.size && (
                                  <span className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded text-xs">
                                    {company.size}
                                  </span>
                                )}
                                {company.location && (
                                  <span className="px-2 py-1 bg-zinc-700 text-zinc-300 rounded text-xs">
                                    📍 {company.location}
                                  </span>
                                )}
                              </div>

                              {/* Contact Info */}
                              <div className="flex flex-wrap gap-3 text-sm">
                                <a
                                  href={company.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  🌐 Сайт
                                </a>
                                <a
                                  href={`mailto:${company.email}`}
                                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  ✉️ {company.email}
                                </a>
                                {company.linkedin_search_query && (
                                  <a
                                    href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.linkedin_search_query)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                  >
                                    💼 LinkedIn
                                  </a>
                                )}
                              </div>

                              {/* Decision Makers */}
                              {company.decision_makers && company.decision_makers.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-zinc-700">
                                  <div className="text-xs text-zinc-500 mb-1">ЛПР для связи:</div>
                                  <div className="flex flex-wrap gap-2">
                                    {company.decision_makers.map((dm, i) => (
                                      <span key={i} className="px-2 py-1 bg-indigo-500/20 text-indigo-300 rounded text-xs">
                                        {dm.role}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <button
                              onClick={() => {
                                setSelectedCompany(company);
                                setGeneratedEmail(null);
                                setShowEmailModal(true);
                              }}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              ✉️ Письмо
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LinkedIn Queries */}
                  {leadsData.linkedin_queries && leadsData.linkedin_queries.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💼</span> Запросы для LinkedIn Sales Navigator
                      </h3>
                      <div className="space-y-2">
                        {leadsData.linkedin_queries.map((query, index) => (
                          <a
                            key={index}
                            href={`https://www.linkedin.com/sales/search/people?query=${encodeURIComponent(query)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block p-3 bg-zinc-800/50 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors"
                          >
                            {query}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Directories */}
                  {leadsData.directories && leadsData.directories.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>📂</span> Каталоги для поиска
                      </h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        {leadsData.directories.map((dir, index) => (
                          <a
                            key={index}
                            href={dir.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                          >
                            <div className="text-white font-medium mb-1">{dir.name}</div>
                            <div className="text-sm text-zinc-400">{dir.description}</div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Search Tips */}
                  {leadsData.search_tips && leadsData.search_tips.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💡</span> Советы по поиску
                      </h3>
                      <div className="space-y-2">
                        {leadsData.search_tips.map((tip, index) => (
                          <div key={index} className="flex items-start gap-2 text-amber-300">
                            <span>•</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Next Step */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Следующий шаг</h3>
                    <p className="text-zinc-400 mb-4">
                      Сгенерируйте Pitch Deck на 10 слайдов для презентации инвесторам.
                    </p>
                    <button
                      onClick={() => setCurrentStep('pitch-deck')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>📑</span>
                      Создать Pitch Deck
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <p className="text-zinc-400 mb-4">
                    {!analysis?.main_pain
                      ? 'Сначала запустите анализ тренда для выявления болей'
                      : 'Не удалось найти потенциальных клиентов'}
                  </p>
                  {!analysis?.main_pain && (
                    <button
                      onClick={() => setCurrentStep('overview')}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                    >
                      Перейти к анализу
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Email Modal */}
          {showEmailModal && selectedCompany && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-zinc-800">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold text-white">
                      Письмо для {selectedCompany.name}
                    </h3>
                    <button
                      onClick={() => setShowEmailModal(false)}
                      className="p-2 text-zinc-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {/* Sender Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Ваше имя *</label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        placeholder="Иван Иванов"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">Компания</label>
                      <input
                        type="text"
                        value={senderCompany}
                        onChange={(e) => setSenderCompany(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        placeholder="Название вашей компании"
                      />
                    </div>
                  </div>

                  {/* Tone Selection */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">Тон письма</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'formal', label: 'Формальный', icon: '👔' },
                        { id: 'professional', label: 'Профессиональный', icon: '💼' },
                        { id: 'friendly', label: 'Дружелюбный', icon: '😊' },
                      ].map((tone) => (
                        <button
                          key={tone.id}
                          onClick={() => setEmailTone(tone.id as 'formal' | 'friendly' | 'professional')}
                          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            emailTone === tone.id
                              ? 'bg-indigo-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {tone.icon} {tone.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate Button */}
                  <button
                    onClick={generateEmail}
                    disabled={loadingEmail || !senderName}
                    className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
                      loadingEmail || !senderName
                        ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                    }`}
                  >
                    {loadingEmail ? (
                      <>
                        <div className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                        Генерирую письмо...
                      </>
                    ) : (
                      <>
                        ✨ Сгенерировать письмо
                      </>
                    )}
                  </button>

                  {/* Generated Email */}
                  {generatedEmail && (
                    <div className="space-y-4 pt-4 border-t border-zinc-800">
                      {/* Subject */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm text-zinc-400">Тема письма</label>
                          <button
                            onClick={() => navigator.clipboard.writeText(generatedEmail.subject)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            Копировать
                          </button>
                        </div>
                        <div className="p-3 bg-zinc-800 rounded-lg text-white">
                          {generatedEmail.subject}
                        </div>
                      </div>

                      {/* Body */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm text-zinc-400">Текст письма</label>
                          <button
                            onClick={() => navigator.clipboard.writeText(generatedEmail.body)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            Копировать
                          </button>
                        </div>
                        <div className="p-3 bg-zinc-800 rounded-lg text-zinc-300 whitespace-pre-wrap text-sm">
                          {generatedEmail.body}
                        </div>
                      </div>

                      {/* Follow-up */}
                      {generatedEmail.follow_up_body && (
                        <div className="pt-4 border-t border-zinc-700">
                          <h4 className="text-sm font-medium text-white mb-3">Follow-up письмо (через 3-5 дней)</h4>
                          <div className="mb-2">
                            <label className="text-xs text-zinc-500">Тема:</label>
                            <div className="p-2 bg-zinc-800/50 rounded text-zinc-300 text-sm">
                              {generatedEmail.follow_up_subject}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-zinc-500">Текст:</label>
                            <div className="p-2 bg-zinc-800/50 rounded text-zinc-400 text-sm whitespace-pre-wrap">
                              {generatedEmail.follow_up_body}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tips */}
                      {generatedEmail.tips && generatedEmail.tips.length > 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <div className="text-xs text-amber-400 mb-2">💡 Советы по отправке:</div>
                          <div className="space-y-1">
                            {generatedEmail.tips.map((tip, i) => (
                              <div key={i} className="text-sm text-amber-300">• {tip}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <a
                          href={`mailto:${selectedCompany.email}?subject=${encodeURIComponent(generatedEmail.subject)}&body=${encodeURIComponent(generatedEmail.body)}`}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-center font-medium transition-colors"
                        >
                          📧 Открыть в почте
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`Тема: ${generatedEmail.subject}\n\n${generatedEmail.body}`);
                          }}
                          className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
                        >
                          📋 Копировать всё
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Pitch Deck Tab */}
          {currentStep === 'pitch-deck' && (
            <div className="space-y-6">
              {loadingPitch ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mb-4" />
                  <p className="text-zinc-400">Генерируем Pitch Deck...</p>
                </div>
              ) : pitchDeck ? (
                <>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-2">{pitchDeck.title}</h2>
                    <p className="text-zinc-400">{pitchDeck.tagline}</p>
                  </div>

                  {/* Slide Viewer */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    {/* Slide Navigation */}
                    <div className="flex items-center gap-1 p-2 border-b border-zinc-800 overflow-x-auto">
                      {pitchDeck.slides.map((slide, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentSlide(index)}
                          className={`px-3 py-1.5 rounded text-sm whitespace-nowrap transition-colors ${
                            currentSlide === index
                              ? 'bg-indigo-600 text-white'
                              : 'bg-zinc-800 text-zinc-400 hover:text-white'
                          }`}
                        >
                          {slide.number}. {slide.title.substring(0, 15)}...
                        </button>
                      ))}
                    </div>

                    {/* Current Slide */}
                    <div className="p-8">
                      <div className="max-w-2xl mx-auto">
                        <div className="text-xs text-zinc-500 mb-2">
                          Слайд {pitchDeck.slides[currentSlide].number} / {pitchDeck.slides.length}
                          <span className="ml-2 px-2 py-0.5 bg-zinc-800 rounded">
                            {pitchDeck.slides[currentSlide].type}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-6">
                          {pitchDeck.slides[currentSlide].title}
                        </h3>

                        <div className="space-y-3 mb-8">
                          {pitchDeck.slides[currentSlide].content.map((point, index) => (
                            <div key={index} className="flex items-start gap-3 text-lg text-zinc-300">
                              <span className="text-indigo-400 mt-1">•</span>
                              <span>{point}</span>
                            </div>
                          ))}
                        </div>

                        {/* Speaker Notes */}
                        <div className="p-4 bg-zinc-800/50 rounded-lg mb-4">
                          <div className="text-xs text-zinc-500 mb-1">📝 Заметки спикера:</div>
                          <p className="text-sm text-zinc-400">{pitchDeck.slides[currentSlide].speaker_notes}</p>
                        </div>

                        {/* Visual Suggestion */}
                        <div className="p-4 bg-zinc-800/50 rounded-lg">
                          <div className="text-xs text-zinc-500 mb-1">🎨 Рекомендация по визуалу:</div>
                          <p className="text-sm text-zinc-400">{pitchDeck.slides[currentSlide].visual_suggestion}</p>
                        </div>
                      </div>
                    </div>

                    {/* Navigation */}
                    <div className="flex items-center justify-between p-4 border-t border-zinc-800">
                      <button
                        onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                        disabled={currentSlide === 0}
                        className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                      >
                        ← Назад
                      </button>
                      <span className="text-zinc-400">
                        {currentSlide + 1} / {pitchDeck.slides.length}
                      </span>
                      <button
                        onClick={() => setCurrentSlide(prev => Math.min(pitchDeck.slides.length - 1, prev + 1))}
                        disabled={currentSlide === pitchDeck.slides.length - 1}
                        className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                      >
                        Вперёд →
                      </button>
                    </div>
                  </div>

                  {/* Export Options */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Экспорт презентации</h3>

                    {/* Copy/Download Actions */}
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      <button
                        onClick={() => {
                          const text = pitchDeck.slides.map(slide =>
                            `## Слайд ${slide.number}: ${slide.title}\n\n${slide.content.map(c => `• ${c}`).join('\n')}\n\n📝 Заметки: ${slide.speaker_notes}\n🎨 Визуал: ${slide.visual_suggestion}`
                          ).join('\n\n---\n\n');
                          navigator.clipboard.writeText(text);
                          alert('Контент скопирован! Вставьте в любой редактор.');
                        }}
                        className="p-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-center"
                      >
                        <div className="text-2xl mb-2">📋</div>
                        <div className="text-white font-medium">Копировать текст</div>
                        <div className="text-xs text-indigo-200">Для вставки в редактор</div>
                      </button>
                      <button
                        onClick={() => {
                          const data = {
                            title: pitchDeck.title,
                            tagline: pitchDeck.tagline,
                            slides: pitchDeck.slides,
                            generated_at: new Date().toISOString()
                          };
                          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `pitch-deck-${pitchDeck.title.toLowerCase().replace(/\s+/g, '-')}.json`;
                          a.click();
                        }}
                        className="p-4 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors text-center"
                      >
                        <div className="text-2xl mb-2">💾</div>
                        <div className="text-white font-medium">Скачать JSON</div>
                        <div className="text-xs text-emerald-200">Полные данные презентации</div>
                      </button>
                    </div>

                    {/* Template Links */}
                    <div className="mb-4">
                      <h4 className="text-sm text-zinc-400 mb-3">Выберите шаблон и вставьте контент:</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <a
                          href={pitchDeck.export_formats.google_slides_template}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-center group"
                        >
                          <div className="text-2xl mb-2">📊</div>
                          <div className="text-white font-medium">Google Slides</div>
                          <div className="text-xs text-zinc-400 group-hover:text-zinc-300">Открыть шаблоны →</div>
                        </a>
                        <a
                          href={pitchDeck.export_formats.figma_template}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-center group"
                        >
                          <div className="text-2xl mb-2">🎨</div>
                          <div className="text-white font-medium">Figma</div>
                          <div className="text-xs text-zinc-400 group-hover:text-zinc-300">Открыть шаблоны →</div>
                        </a>
                        <a
                          href={pitchDeck.export_formats.canva_template}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-center group"
                        >
                          <div className="text-2xl mb-2">🖼️</div>
                          <div className="text-white font-medium">Canva</div>
                          <div className="text-xs text-zinc-400 group-hover:text-zinc-300">Открыть шаблоны →</div>
                        </a>
                      </div>
                    </div>

                    {/* Instructions - Two columns */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Text Instructions */}
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <div className="text-sm text-amber-300">
                          <strong>📋 Через текст (быстро):</strong>
                          <ol className="mt-2 space-y-1 list-decimal list-inside text-amber-200">
                            <li>Нажмите &quot;Копировать текст&quot;</li>
                            <li>Откройте шаблон (Slides/Figma/Canva)</li>
                            <li>Создайте копию шаблона</li>
                            <li>Вставьте контент в слайды</li>
                          </ol>
                        </div>
                      </div>

                      {/* JSON Instructions */}
                      <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                        <div className="text-sm text-indigo-300">
                          <strong>📥 Через JSON (для автоматизации):</strong>
                          <ol className="mt-2 space-y-1 list-decimal list-inside text-indigo-200">
                            <li>Скачайте JSON файл</li>
                            <li>Используйте с AI (ChatGPT/Claude): &quot;Создай презентацию из этого JSON&quot;</li>
                            <li>Или импортируйте в <a href="https://gamma.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-100">Gamma.app</a>, <a href="https://tome.app" target="_blank" rel="noopener noreferrer" className="underline hover:text-indigo-100">Tome.app</a></li>
                            <li>Или используйте Google Slides API для автоматического создания</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sources */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">Полезные материалы</h3>
                    <div className="flex flex-wrap gap-2">
                      {pitchDeck.sources.map((source, index) => (
                        <a
                          key={index}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors flex items-center gap-1"
                        >
                          {source.name}
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Next Step */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Следующий шаг</h3>
                    <p className="text-zinc-400 mb-4">
                      Создайте проект с GitHub репозиторием и планом разработки.
                    </p>
                    <button
                      onClick={() => setCurrentStep('project')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>🚀</span>
                      Перейти к созданию проекта
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-400">
                  Не удалось сгенерировать Pitch Deck
                </div>
              )}
            </div>
          )}

          {currentStep === 'project' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-8 text-center">
                <h3 className="text-2xl font-bold text-white mb-4">Создать проект</h3>
                <p className="text-zinc-400 mb-6 max-w-lg mx-auto">
                  На основе анализа тренда &quot;{trend.title}&quot; система создаст GitHub репозиторий
                  с README, планом на 4 недели и задачами.
                </p>
                <button
                  onClick={() => router.push(`/projects?create=${trend.id}`)}
                  className="px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-all inline-flex items-center gap-2"
                >
                  <span>🚀</span>
                  Создать проект в GitHub
                </button>
              </div>

              {/* What will be created */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Что будет создано:</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { icon: '📁', title: 'GitHub Repository', desc: 'Приватный репозиторий с базовой структурой' },
                    { icon: '📝', title: 'README.md', desc: 'Описание проекта, tech stack, инструкции' },
                    { icon: '📋', title: 'Issues', desc: 'Задачи на 4 недели разработки' },
                    { icon: '🤖', title: 'AI Агенты', desc: 'Developer, Marketing, Sales ассистенты' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3 p-4 bg-zinc-800/50 rounded-lg">
                      <span className="text-2xl">{item.icon}</span>
                      <div>
                        <div className="font-medium text-white">{item.title}</div>
                        <div className="text-sm text-zinc-400">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat with context */}
      <TrendChat
        trendContext={{
          title: trend.title,
          category: trend.category,
          why_trending: trend.why_trending,
          analysis: analysis ? {
            main_pain: analysis.main_pain,
            key_pain_points: analysis.key_pain_points,
            target_audience: analysis.target_audience,
            real_sources: analysis.real_sources,
          } : undefined,
        }}
      />
    </div>
  );
}
