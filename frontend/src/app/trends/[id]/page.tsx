'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TrendChat from '@/components/TrendChat';
import MVPTypeSelector from '@/components/MVPTypeSelector';
import { recommendProductType, type ProductType } from '@/lib/productRecommendation';
import { MVPType, MVPGenerationContext, ProductSpecification } from '@/lib/mvp-templates';
import { useLanguage } from '@/lib/i18n';

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

// Интерфейсы для данных проекта (META-агент)
interface RoadmapPhase {
  duration?: string;
  goals: string[];
  deliverables: string[];
  success_metrics: string[];
}

interface ProjectRoadmap {
  mvp: RoadmapPhase;
  alpha: RoadmapPhase;
  beta: RoadmapPhase;
  production: RoadmapPhase;
}

interface CoreFeature {
  name: string;
  description: string;
  priority: string;
  user_story?: string;
  acceptance_criteria?: string[];
}

interface TechStackItem {
  category: string;
  recommendation: string;
  alternatives?: string[];
  reasoning?: string;
}

interface MVPSpecification {
  core_features: CoreFeature[];
  tech_stack: TechStackItem[];
  architecture?: string;
  estimated_complexity?: string;
}

interface EnhancementRecommendation {
  area: string;
  current_state: string;
  recommended_improvement: string;
  expected_impact: string;
  priority: string;
}

interface ProjectData {
  project_name: string;
  one_liner?: string;
  problem_statement?: string;
  solution_overview?: string;
  github_url?: string;
  vercel_url?: string;
  readme_content: string;
  mvp_specification: MVPSpecification;
  roadmap: ProjectRoadmap;
  enhancement_recommendations: EnhancementRecommendation[];
  business_metrics: {
    target_users_mvp?: string;
    target_revenue_mvp?: string;
    target_users_production?: string;
    target_revenue_production?: string;
    key_kpis?: string[];
  };
  created_at?: string;
}

export default function TrendPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const trendId = params.id as string;
  const { language, t } = useLanguage();

  const [trend, setTrend] = useState<Trend | null>(null);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [collectingSources, setCollectingSources] = useState(false);
  const [currentStep, setCurrentStep] = useState<FlowStep>('overview');
  const [isFavorite, setIsFavorite] = useState(false);

  // Ref для отслеживания установки tab из URL (чтобы fetchData не перезаписывал)
  const tabSetFromUrlRef = useRef(false);

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

  // Состояние для дополнительных данных из API (synthesis, strategic_positioning и т.д.)
  interface SourcesSynthesis {
    key_insights: string[];
    sentiment_summary: string;
    content_gaps: string[];
    recommended_angles: string[];
  }
  const [sourcesSynthesis, setSourcesSynthesis] = useState<SourcesSynthesis | null>(null);
  const [strategicPositioning, setStrategicPositioning] = useState<string | null>(null);
  const [differentiationOpportunities, setDifferentiationOpportunities] = useState<string[]>([]);
  const [investmentThesis, setInvestmentThesis] = useState<string | null>(null);
  const [recommendedRound, setRecommendedRound] = useState<string | null>(null);
  const [keyInvestors, setKeyInvestors] = useState<string[]>([]);

  // Состояние для проекта (META-агент)
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [githubCreated, setGithubCreated] = useState(false);
  const [isGithubAuthenticated, setIsGithubAuthenticated] = useState(false);
  const [creatingGithubRepo, setCreatingGithubRepo] = useState(false);

  // Состояние для нового MVP селектора
  const [showMVPSelector, setShowMVPSelector] = useState(false);
  const [selectedMVPType, setSelectedMVPType] = useState<MVPType | null>(null);
  const [pendingCreateWithGithub, setPendingCreateWithGithub] = useState(false);

  // Product Specification - AI гипотезы о продукте (NEW)
  const [productSpec, setProductSpec] = useState<ProductSpecification | null>(null);
  const [loadingProductSpec, setLoadingProductSpec] = useState(false);
  const [productSpecError, setProductSpecError] = useState<string | null>(null);

  // Новые состояния для расширенного создания проекта
  const [selectedProductType, setSelectedProductType] = useState<'landing' | 'saas' | 'ai-wrapper' | 'ecommerce'>('landing');
  const [autoDeploy, setAutoDeploy] = useState(false);
  const [isVercelAuthenticated, setIsVercelAuthenticated] = useState(false);
  const [vercelDeployed, setVercelDeployed] = useState(false);
  const [vercelUrl, setVercelUrl] = useState<string | null>(null);
  const [hasAutoSelectedType, setHasAutoSelectedType] = useState(false);

  // Рекомендация типа продукта на основе анализа тренда
  const productRecommendation = useMemo(() => {
    if (!trend) return null;

    return recommendProductType(
      {
        title: trend.title,
        category: trend.category,
        why_trending: trend.why_trending,
      },
      analysis ? {
        main_pain: analysis.main_pain,
        key_pain_points: analysis.key_pain_points,
        target_audience: analysis.target_audience ? {
          primary: analysis.target_audience.segments?.[0]?.name,
          segments: analysis.target_audience.segments,
        } : undefined,
      } : undefined,
      pitchDeck ? {
        company_name: pitchDeck.title,
        tagline: pitchDeck.tagline,
      } : undefined
    );
  }, [trend, analysis, pitchDeck]);

  // Автоматически устанавливаем рекомендуемый тип при первом расчёте
  useEffect(() => {
    if (productRecommendation && !hasAutoSelectedType && currentStep === 'project') {
      setSelectedProductType(productRecommendation.recommended);
      setHasAutoSelectedType(true);
    }
  }, [productRecommendation, hasAutoSelectedType, currentStep]);

  // Функция проверки GitHub авторизации
  const checkGithubAuth = useCallback(async () => {
    try {
      const githubRes = await fetch('/api/auth/github/user');
      const githubData = await githubRes.json();
      // API возвращает { authenticated: true/false, user: ... }
      const isAuth = githubData.authenticated && !!githubData.user;
      setIsGithubAuthenticated(isAuth);
      return isAuth;
    } catch {
      setIsGithubAuthenticated(false);
      return false;
    }
  }, []);

  // Проверка auth_success после редиректа с GitHub OAuth
  useEffect(() => {
    const authSuccess = searchParams.get('auth_success');
    const tabParam = searchParams.get('tab');

    if (authSuccess === 'true' && tabParam === 'project') {
      // СРАЗУ устанавливаем флаг и вкладку, чтобы fetchData не перезаписал
      tabSetFromUrlRef.current = true;
      setCurrentStep('project');

      // Перепроверяем статус GitHub авторизации асинхронно
      checkGithubAuth().then((isAuth) => {
        if (isAuth) {
          // Убираем параметры из URL без перезагрузки
          const url = new URL(window.location.href);
          url.searchParams.delete('auth_success');
          url.searchParams.delete('tab');
          router.replace(url.pathname, { scroll: false });
        }
      });
    } else if (tabParam && !authSuccess) {
      // Обработка tab параметра при прямой загрузке страницы
      const validTabs: FlowStep[] = ['overview', 'analysis', 'sources', 'competition', 'venture', 'leads', 'pitch-deck', 'project'];
      if (validTabs.includes(tabParam as FlowStep)) {
        tabSetFromUrlRef.current = true;
        setCurrentStep(tabParam as FlowStep);
      }
    }
  }, [searchParams, checkGithubAuth, router]);

  // Хелпер: Построение накопительного контекста для передачи между экспертами
  const buildAnalysisContext = () => {
    const context: Record<string, unknown> = {
      trend: {
        id: trend?.id,
        title: trend?.title,
        category: trend?.category,
        why_trending: trend?.why_trending,
      },
    };

    // Добавляем данные анализа (от эксперта по болям)
    if (analysis) {
      context.analysis = {
        main_pain: analysis.main_pain,
        key_pain_points: analysis.key_pain_points,
        target_audience: analysis.target_audience,
        opportunities: analysis.key_pain_points, // используем боли как возможности
        risks: [],
        market_readiness: analysis.sentiment_score ? Math.round(analysis.sentiment_score * 10) : undefined,
      };
    }

    // Добавляем данные из источников
    if (analysis?.real_sources) {
      context.sources = {
        reddit: analysis.real_sources.reddit,
        google_trends: analysis.real_sources.google_trends,
        youtube: analysis.real_sources.youtube,
        synthesis: sourcesSynthesis,
      };
    }

    // Добавляем конкурентный анализ
    if (competition) {
      context.competition = {
        competitors: competition.competitors,
        market_saturation: competition.market_saturation,
        blue_ocean_score: competition.blue_ocean_score,
        opportunity_areas: competition.opportunity_areas,
        strategic_positioning: strategicPositioning,
        differentiation_opportunities: differentiationOpportunities,
      };
    }

    // Добавляем инвестиционные данные
    if (ventureData) {
      context.venture = {
        total_funding_last_year: ventureData.total_funding_last_year,
        average_round_size: ventureData.average_round_size,
        funding_trend: ventureData.funding_trend,
        recent_rounds: ventureData.recent_rounds,
        active_funds: ventureData.active_funds,
        investment_hotness: ventureData.investment_hotness,
        market_signals: ventureData.market_signals,
        investment_thesis: investmentThesis,
        recommended_round: recommendedRound,
        key_investors_to_target: keyInvestors,
      };
    }

    // Добавляем данные о лидах
    if (leadsData) {
      context.leads = {
        companies: leadsData.companies,
        linkedin_queries: leadsData.linkedin_queries,
        directories: leadsData.directories,
      };
    }

    // Добавляем pitch deck
    if (pitchDeck) {
      context.pitch = {
        company_name: pitchDeck.title,
        tagline: pitchDeck.tagline,
        slides: pitchDeck.slides,
      };
    }

    // Добавляем Product Specification (AI-гипотезы о продукте)
    if (productSpec) {
      context.productSpec = productSpec;
    }

    return context;
  };

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
          // НО не перезаписываем если tab был установлен из URL (после GitHub auth)
          if (!tabSetFromUrlRef.current) {
            if (analysisData.analyses[trendId].real_sources) {
              setCurrentStep('sources');
            } else {
              setCurrentStep('analysis');
            }
          }
        }

        // Check if favorite
        const favorites = JSON.parse(localStorage.getItem('trendhunter_favorites') || '[]');
        setIsFavorite(favorites.includes(trendId));

        // Загружаем существующий проект из localStorage (если есть)
        try {
          const storedProjects = localStorage.getItem('trendhunter_projects');
          if (storedProjects) {
            const projects = JSON.parse(storedProjects);
            const existingProject = projects.find((p: { trend_id: string }) => p.trend_id === trendId);
            if (existingProject) {
              // Восстанавливаем данные проекта
              setProjectData({
                project_name: existingProject.name,
                one_liner: existingProject.description,
                problem_statement: existingProject.description,
                solution_overview: '',
                github_url: existingProject.repo_url,
                readme_content: '',
                mvp_specification: existingProject.mvp_specification || { core_features: [], tech_stack: [] },
                roadmap: existingProject.roadmap || { mvp: { goals: [], deliverables: [], success_metrics: [] }, alpha: { goals: [], deliverables: [], success_metrics: [] }, beta: { goals: [], deliverables: [], success_metrics: [] }, production: { goals: [], deliverables: [], success_metrics: [] } },
                enhancement_recommendations: [],
                business_metrics: {},
                created_at: existingProject.created_at,
              });
              if (existingProject.repo_url) {
                setGithubCreated(true);
              }
            }
          }
        } catch (storageError) {
          console.error('Error loading project from localStorage:', storageError);
        }

        // Check GitHub authentication
        await checkGithubAuth();
      } catch (error) {
        console.error('Error fetching trend:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trendId, checkGithubAuth]);

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
      // Строим контекст от предыдущего эксперта (анализ болей)
      const context = buildAnalysisContext();

      const response = await fetch('/api/collect-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trend.title,
          trend_title: trend.title,
          context, // Передаём контекст от анализа болей
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Сохраняем синтез от эксперта по источникам
        if (data.synthesis) {
          setSourcesSynthesis(data.synthesis);
        }

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

  // Fetch Product Specification (AI гипотезы о продукте) - вызывается перед созданием проекта
  const fetchProductSpec = async (): Promise<ProductSpecification | null> => {
    if (!trend || !analysis?.main_pain) {
      setProductSpecError('Необходим анализ болей перед созданием спецификации');
      return null;
    }

    // Если уже есть - возвращаем
    if (productSpec) return productSpec;

    setLoadingProductSpec(true);
    setProductSpecError(null);

    try {
      const context = buildAnalysisContext();

      const response = await fetch('/api/product-spec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend: {
            title: trend.title,
            category: trend.category,
            why_trending: trend.why_trending,
          },
          analysis: context.analysis,
          competition: context.competition,
        }),
      });

      const data = await response.json();

      if (data.success && data.product_spec) {
        setProductSpec(data.product_spec);
        console.log('[ProductSpec] Generated:', data.metadata);
        return data.product_spec;
      } else {
        setProductSpecError(data.error || 'Не удалось создать спецификацию');
        return null;
      }
    } catch (error) {
      console.error('Error fetching product spec:', error);
      setProductSpecError('Ошибка при создании спецификации продукта');
      return null;
    } finally {
      setLoadingProductSpec(false);
    }
  };

  // Fetch competition data
  const fetchCompetition = async () => {
    if (!trend || competition) return;
    setLoadingCompetition(true);

    try {
      // Строим контекст от предыдущих экспертов (анализ + источники)
      const context = buildAnalysisContext();

      const response = await fetch('/api/competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_title: trend.title,
          context, // Передаём накопленный контекст
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setCompetition(data.data);

        // Сохраняем дополнительные данные от эксперта по конкурентам
        if (data.data.strategic_positioning) {
          setStrategicPositioning(data.data.strategic_positioning);
        }
        if (data.data.differentiation_opportunities) {
          setDifferentiationOpportunities(data.data.differentiation_opportunities);
        }
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
      // Строим контекст от предыдущих экспертов (анализ + источники + конкуренты)
      const context = buildAnalysisContext();

      const response = await fetch('/api/venture-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_title: trend.title,
          context, // Передаём накопленный контекст
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setVentureData(data.data);

        // Сохраняем дополнительные данные от эксперта по инвестициям
        if (data.data.investment_thesis) {
          setInvestmentThesis(data.data.investment_thesis);
        }
        if (data.data.recommended_round) {
          setRecommendedRound(data.data.recommended_round);
        }
        if (data.data.key_investors_to_target) {
          setKeyInvestors(data.data.key_investors_to_target);
        }
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
      // Строим ПОЛНЫЙ контекст от всех предыдущих экспертов
      const context = buildAnalysisContext();

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
          context, // Передаём полный накопленный контекст от всех экспертов
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
      // Строим полный контекст от всех предыдущих экспертов
      const context = buildAnalysisContext();

      const response = await fetch('/api/find-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: trend.title,
          painPoint: analysis.main_pain,
          count: 10,
          context, // Передаём накопленный контекст
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

  // Открытие модального окна выбора MVP типа
  const handleOpenMVPSelector = (withGithub: boolean) => {
    setPendingCreateWithGithub(withGithub);
    setShowMVPSelector(true);
  };

  // Обработчик выбора MVP типа
  const handleMVPTypeSelect = async (type: MVPType) => {
    setSelectedMVPType(type);
    setShowMVPSelector(false);

    // Получаем Product Specification перед созданием проекта
    // Это даст META-агенту конкретные данные о том КАК должен работать продукт
    await fetchProductSpec();

    createProject(pendingCreateWithGithub, type);
  };

  // Создание проекта через META-агент
  const createProject = async (createGithubRepo = false, mvpType?: MVPType) => {
    if (!trend || loadingProject) return;
    setLoadingProject(true);
    setProjectError(null);

    try {
      // Сначала получаем Product Specification если ещё нет
      if (!productSpec) {
        await fetchProductSpec();
      }

      // Строим ПОЛНЫЙ контекст от ВСЕХ 7 предыдущих экспертов + productSpec
      const context = buildAnalysisContext();

      const response = await fetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trend.id,
          project_name: trend.title.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').substring(0, 50),
          context, // Передаём полный накопленный контекст от всех экспертов
          create_github_repo: createGithubRepo,
          product_type: selectedProductType, // Старый параметр для обратной совместимости
          mvp_type: mvpType, // Новый параметр: тип MVP из нового селектора
          auto_deploy: autoDeploy && isVercelAuthenticated, // Новый параметр: автодеплой
        }),
      });

      const data = await response.json();
      if (data.success && data.data) {
        setProjectData(data.data);
        setGithubCreated(data.github_created || false);

        // Обновляем Vercel статус
        if (data.vercel_deployed && data.data.vercel_url) {
          setVercelDeployed(true);
          setVercelUrl(data.data.vercel_url);
        }

        // Сохраняем проект в localStorage для синхронизации с другими страницами
        try {
          const storedProjects = localStorage.getItem('trendhunter_projects');
          const projects = storedProjects ? JSON.parse(storedProjects) : [];

          // Проверяем, существует ли уже проект с этим trend_id
          const existingIndex = projects.findIndex((p: { trend_id: string }) => p.trend_id === trend.id);

          const newProject = {
            id: `project-${Date.now()}`,
            name: data.data.project_name || trend.title,
            description: data.data.one_liner || data.data.problem_statement || '',
            repo_url: data.data.github_url || null,
            clone_url: data.data.github_url ? `${data.data.github_url}.git` : null,
            vercel_url: data.data.vercel_url || null,
            trend_id: trend.id,
            trend_title: trend.title,
            created_at: new Date().toISOString(),
            tech_stack: data.data.mvp_specification?.tech_stack?.map((t: TechStackItem) => t.recommendation) || [],
            solution_type: selectedProductType,
            product_type: selectedProductType,
            mvp_type: mvpType, // Новый тип MVP из селектора
            is_functional_mvp: data.is_functional_mvp || false, // Флаг функционального MVP
            mvp_specification: data.data.mvp_specification,
            roadmap: data.data.roadmap,
          };

          if (existingIndex >= 0) {
            projects[existingIndex] = { ...projects[existingIndex], ...newProject };
          } else {
            projects.push(newProject);
          }

          localStorage.setItem('trendhunter_projects', JSON.stringify(projects));
        } catch (storageError) {
          console.error('Error saving project to localStorage:', storageError);
        }
      } else {
        setProjectError(data.error || 'Не удалось создать проект');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setProjectError('Ошибка при создании проекта');
    } finally {
      setLoadingProject(false);
    }
  };

  // Создание GitHub репозитория для существующего проекта
  const createGithubRepoForProject = async () => {
    if (!projectData || creatingGithubRepo || githubCreated) return;
    setCreatingGithubRepo(true);

    try {
      const context = buildAnalysisContext();

      const response = await fetch('/api/create-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trend?.id,
          project_name: projectData.project_name,
          context,
          create_github_repo: true,
        }),
      });

      const data = await response.json();
      if (data.success && data.github_created && data.data.github_url) {
        setProjectData(prev => prev ? { ...prev, github_url: data.data.github_url } : null);
        setGithubCreated(true);

        // Обновляем GitHub URL в localStorage
        try {
          const storedProjects = localStorage.getItem('trendhunter_projects');
          if (storedProjects) {
            const projects = JSON.parse(storedProjects);
            const existingIndex = projects.findIndex((p: { trend_id: string }) => p.trend_id === trend?.id);

            if (existingIndex >= 0) {
              projects[existingIndex].repo_url = data.data.github_url;
              projects[existingIndex].clone_url = `${data.data.github_url}.git`;
              localStorage.setItem('trendhunter_projects', JSON.stringify(projects));
            }
          }
        } catch (storageError) {
          console.error('Error updating project in localStorage:', storageError);
        }
      } else {
        setProjectError('Не удалось создать репозиторий. Проверьте авторизацию в GitHub.');
      }
    } catch (error) {
      console.error('Error creating GitHub repo:', error);
      setProjectError('Ошибка при создании репозитория');
    } finally {
      setCreatingGithubRepo(false);
    }
  };

  // Функция сброса проекта (очистка localStorage)
  const resetProject = () => {
    if (!trend?.id) return;

    const confirmed = window.confirm(
      'Вы уверены, что хотите сбросить проект?\n\n' +
      'Это удалит данные проекта из браузера и позволит запустить анализ заново.\n' +
      'GitHub репозиторий НЕ будет удалён автоматически.'
    );

    if (!confirmed) return;

    try {
      const storedProjects = localStorage.getItem('trendhunter_projects');
      if (storedProjects) {
        const projects = JSON.parse(storedProjects);
        const filteredProjects = projects.filter((p: { trend_id: string }) => p.trend_id !== trend.id);
        localStorage.setItem('trendhunter_projects', JSON.stringify(filteredProjects));

        // Триггерим событие storage для обновления других компонентов (например, TrendCard)
        window.dispatchEvent(new Event('storage'));
      }

      // Сбрасываем локальное состояние
      setProjectData(null);
      setGithubCreated(false);
      setProjectError(null);

      // Переключаемся на первую вкладку
      setCurrentStep('overview');

    } catch (error) {
      console.error('Error resetting project:', error);
      setProjectError('Ошибка при сбросе проекта');
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
    { id: 'overview', label: t.trendDetail.tabs.overview, icon: '📊' },
    { id: 'analysis', label: t.trendDetail.tabs.analysis, icon: '🔍' },
    { id: 'sources', label: t.trendDetail.tabs.sources, icon: '📚' },
    { id: 'competition', label: t.trendDetail.tabs.competition, icon: '🏆' },
    { id: 'venture', label: t.trendDetail.tabs.venture, icon: '💰' },
    { id: 'leads', label: t.trendDetail.tabs.leads, icon: '👥' },
    { id: 'pitch-deck', label: t.trendDetail.tabs.pitchDeck, icon: '📑' },
    { id: 'project', label: t.trendDetail.tabs.project, icon: '🚀' },
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
      <div className="p-8">
        <div className="text-center py-20">
          <h1 className="text-2xl text-white mb-4">{t.trendDetail.notFound}</h1>
          <Link href="/" className="text-indigo-400 hover:text-indigo-300">
            {t.trendDetail.backToHome}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
        {/* Breadcrumbs */}
        <div className="px-6 py-4 border-b border-zinc-800/50">
          <div className="flex items-center gap-2 text-sm">
            <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
              {t.trendDetail.breadcrumbs.home}
            </Link>
            <span className="text-zinc-600">/</span>
            <Link href="/" className="text-zinc-500 hover:text-white transition-colors">
              {t.trendDetail.breadcrumbs.trends}
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-white truncate max-w-[300px]">{trend.title}</span>
          </div>
        </div>

        {/* Flow Steps */}
        <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/30">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
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
                  +{trend.growth_rate}% {t.trendDetail.overview.growth}
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
                <div className="text-xs text-zinc-500">{t.trendDetail.overview.overallScore}</div>
              </div>
            </div>
          </div>

          {/* Step Content */}
          {currentStep === 'overview' && (
            <div className="space-y-6">
              {/* Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: t.trendDetail.overview.opportunity, value: trend.opportunity_score, icon: '🎯', color: 'indigo' },
                  { label: t.trendDetail.overview.painLevel, value: trend.pain_score, icon: '🔥', color: 'red' },
                  { label: t.trendDetail.overview.feasibility, value: trend.feasibility_score, icon: '⚡', color: 'amber' },
                  { label: t.trendDetail.overview.potential, value: trend.profit_potential, icon: '💰', color: 'emerald' },
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
                  <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.overview.information}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t.trendDetail.overview.source}</span>
                      <span className="text-white">{trend.source || 'Google Trends'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t.trendDetail.overview.detected}</span>
                      <span className="text-white">
                        {new Date(trend.first_detected_at).toLocaleDateString('ru-RU')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">{t.trendDetail.overview.status}</span>
                      <span className="text-emerald-400">{trend.status}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.overview.nextStep}</h3>
                  <p className="text-zinc-400 mb-4">
                    {t.trendDetail.overview.runAnalysisDescription}
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
                        {t.trendDetail.overview.analyzing}
                      </>
                    ) : (
                      <>
                        <span>🔍</span>
                        {t.trendDetail.overview.runAnalysis}
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
                    <span>🧠</span> {t.trendDetail.analysis.deepAnalysis}
                  </span>
                  {analysisMetadata?.consensus_reached && (
                    <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full">
                      ✓ {t.trendDetail.analysis.consensusReached}
                    </span>
                  )}
                </div>
              )}

              {/* AI Agents Debate */}
              {rawAnalyses.optimist && rawAnalyses.skeptic && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-zinc-800 bg-zinc-800/30">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <span>⚔️</span> {t.trendDetail.analysis.aiDebate}
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">{t.trendDetail.analysis.aiDebateDescription}</p>
                  </div>

                  <div className="grid md:grid-cols-2 divide-x divide-zinc-800">
                    {/* Optimist */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-xl">😊</span>
                        <div>
                          <div className="font-medium text-emerald-400">{t.trendDetail.analysis.optimist}</div>
                          <div className="text-xs text-zinc-500">{t.trendDetail.analysis.optimistRole}</div>
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
                                {t.trendDetail.analysis.willingnessToPay}: {pain.willingness_to_pay}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                        <div className="text-xs text-zinc-500 mb-1">{t.trendDetail.analysis.optimistConclusion}:</div>
                        <div className="text-sm text-emerald-300">{analysisMetadata?.optimist_summary || rawAnalyses.optimist.overall_assessment}</div>
                      </div>
                    </div>

                    {/* Skeptic */}
                    <div className="p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xl">🤨</span>
                        <div>
                          <div className="font-medium text-red-400">{t.trendDetail.analysis.skeptic}</div>
                          <div className="text-xs text-zinc-500">{t.trendDetail.analysis.skepticRole}</div>
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
                                {t.trendDetail.analysis.willingnessToPay}: {pain.willingness_to_pay}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 p-3 bg-zinc-800/50 rounded-lg">
                        <div className="text-xs text-zinc-500 mb-1">{t.trendDetail.analysis.skepticConclusion}:</div>
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
                    <h3 className="text-lg font-semibold text-white">{t.trendDetail.analysis.arbiterVerdict}</h3>
                    <p className="text-sm text-zinc-400">{t.trendDetail.analysis.arbiterRole}</p>
                  </div>
                  {analysis.sentiment_score && (
                    <div className="ml-auto text-right">
                      <div className="text-2xl font-bold text-purple-400">{analysis.sentiment_score}/10</div>
                      <div className="text-xs text-zinc-500">{t.trendDetail.analysis.confidence}</div>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-zinc-800/50 rounded-lg mb-4">
                  <div className="text-xs text-purple-400 mb-1 flex items-center gap-1">
                    <span>🔥</span> {t.trendDetail.analysis.mainPain}
                  </div>
                  <p className="text-xl text-white">{analysis.main_pain}</p>
                </div>
              </div>

              {/* Key Pain Points */}
              {analysis.key_pain_points && analysis.key_pain_points.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.analysis.keyPainPoints}</h3>
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
                  <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.analysis.targetAudience}</h3>
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
                          <div>{t.trendDetail.analysis.size}: {segment.size}</div>
                          <div>{t.trendDetail.analysis.willingnessToPay}: {segment.willingness_to_pay}</div>
                          {segment.where_to_find && (
                            <div>{t.trendDetail.analysis.whereToFind}: {segment.where_to_find}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Next Step */}
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.analysis.nextStep}</h3>
                <p className="text-zinc-400 mb-4">
                  {t.trendDetail.analysis.collectSourcesDescription}
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
                      {t.trendDetail.analysis.collectingData}
                    </>
                  ) : (
                    <>
                      <span>📚</span>
                      {t.trendDetail.analysis.collectSources}
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
                          {t.trendDetail.sources.simulation}
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
                        {t.trendDetail.sources.openInGoogleTrends}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-sm text-zinc-400 mb-1">{t.trendDetail.sources.yearlyGrowth}</div>
                      <div className={`text-2xl font-bold ${
                        analysis.real_sources.google_trends.growth_rate >= 0 ? 'text-emerald-400' : 'text-red-400'
                      }`}>
                        {analysis.real_sources.google_trends.growth_rate >= 0 ? '+' : ''}
                        {analysis.real_sources.google_trends.growth_rate}%
                      </div>
                    </div>
                    <div className="p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-sm text-zinc-400 mb-1">{t.trendDetail.sources.relatedQueries}</div>
                      <div className="text-lg text-white">
                        {analysis.real_sources.google_trends.related_queries?.length || 0}
                      </div>
                    </div>
                  </div>

                  {/* Related Queries */}
                  {analysis.real_sources.google_trends.related_queries &&
                   analysis.real_sources.google_trends.related_queries.length > 0 && (
                    <div>
                      <div className="text-sm text-zinc-400 mb-3">{t.trendDetail.sources.relatedQueries}:</div>
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
                  {t.trendDetail.competition.analyzeCompetitors}
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
                  <p className="text-zinc-400">{t.trendDetail.competition.analyzingCompetitors}</p>
                </div>
              ) : competition ? (
                <>
                  {/* Competition Overview */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">{t.trendDetail.competition.marketSaturation}</div>
                      <div className={`text-2xl font-bold ${
                        competition.market_saturation === 'low' ? 'text-emerald-400' :
                        competition.market_saturation === 'medium' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {competition.market_saturation === 'low' ? t.trendDetail.competition.low :
                         competition.market_saturation === 'medium' ? t.trendDetail.competition.medium : t.trendDetail.competition.high}
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">Blue Ocean Score</div>
                      <div className="text-2xl font-bold text-indigo-400">{competition.blue_ocean_score}/10</div>
                      <div className="text-xs text-zinc-500 mt-1">{t.trendDetail.competition.blueOceanHint}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">{t.trendDetail.competition.riskLevel}</div>
                      <div className={`text-2xl font-bold ${
                        competition.risk_level === 'low' ? 'text-emerald-400' :
                        competition.risk_level === 'medium' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {competition.risk_level === 'low' ? t.trendDetail.competition.low :
                         competition.risk_level === 'medium' ? t.trendDetail.competition.medium : t.trendDetail.competition.high}
                      </div>
                    </div>
                  </div>

                  {/* Competitors */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      {t.trendDetail.competition.competitors} ({competition.competitors.length})
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
                        <span>💡</span> {t.trendDetail.competition.opportunityAreas}
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
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">{t.trendDetail.sources.dataSources}</h3>
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
                    <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.competition.nextStep}</h3>
                    <p className="text-zinc-400 mb-4">
                      {t.trendDetail.competition.ventureDescription}
                    </p>
                    <button
                      onClick={() => setCurrentStep('venture')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>💰</span>
                      {t.trendDetail.venture.ventureData}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-400">
                  {t.trendDetail.competition.loadError}
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
                  <p className="text-zinc-400">{t.trendDetail.venture.collectingData}</p>
                </div>
              ) : ventureData ? (
                <>
                  {/* Overview */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">{t.trendDetail.venture.yearlyInvestments}</div>
                      <div className="text-2xl font-bold text-emerald-400">{ventureData.total_funding_last_year}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">{t.trendDetail.venture.averageRound}</div>
                      <div className="text-2xl font-bold text-white">{ventureData.average_round_size}</div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">{t.trendDetail.venture.fundingTrend}</div>
                      <div className={`text-2xl font-bold ${
                        ventureData.funding_trend === 'growing' ? 'text-emerald-400' :
                        ventureData.funding_trend === 'stable' ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {ventureData.funding_trend === 'growing' ? `📈 ${t.trendDetail.venture.growing}` :
                         ventureData.funding_trend === 'stable' ? `➡️ ${t.trendDetail.venture.stable}` : `📉 ${t.trendDetail.venture.declining}`}
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="text-sm text-zinc-400 mb-2">{t.trendDetail.venture.investmentAttractiveness}</div>
                      <div className="text-2xl font-bold text-indigo-400">{ventureData.investment_hotness}/10</div>
                    </div>
                  </div>

                  {/* Recent Funding Rounds */}
                  {ventureData.recent_rounds.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4">
                        {t.trendDetail.venture.recentRounds} ({ventureData.recent_rounds.length})
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
                        {t.trendDetail.venture.activeFunds} ({ventureData.active_funds.length})
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
                                {t.trendDetail.venture.website}
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
                        <span>📡</span> {t.trendDetail.venture.marketSignals}
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
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">{t.trendDetail.sources.dataSources}</h3>
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
              {/* Если проект ещё не создан */}
              {!projectData && !loadingProject && (
                <>
                  {/* Выбор типа продукта */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎯</span>
                        <h3 className="text-lg font-semibold text-white">Выберите тип продукта</h3>
                      </div>
                      {productRecommendation && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                          <span className="text-emerald-400 text-sm">✨ AI рекомендует:</span>
                          <span className="text-emerald-300 text-sm font-medium">
                            {productRecommendation.recommended === 'landing' ? 'Landing' :
                             productRecommendation.recommended === 'saas' ? 'SaaS' :
                             productRecommendation.recommended === 'ai-wrapper' ? 'AI Wrapper' : 'E-commerce'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Объяснение рекомендации */}
                    {productRecommendation && productRecommendation.reasoning && (
                      <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                        <div className="flex items-start gap-3">
                          <span className="text-lg mt-0.5">💡</span>
                          <div>
                            <p className="text-sm text-emerald-300/90">{productRecommendation.reasoning}</p>
                            {selectedProductType !== productRecommendation.recommended && (
                              <p className="text-xs text-zinc-500 mt-2">
                                Вы выбрали другой тип — это тоже хороший выбор!
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4 mb-6">
                      {[
                        { id: 'landing' as const, name: 'Landing + Waitlist', icon: '🚀', desc: 'Лендинг со сбором email и Supabase', complexity: 'Легко', time: '1-2 дня' },
                        { id: 'saas' as const, name: 'SaaS Dashboard', icon: '📊', desc: 'Приложение с авторизацией и дашбордом', complexity: 'Средне', time: '1-2 недели' },
                        { id: 'ai-wrapper' as const, name: 'AI Wrapper', icon: '🤖', desc: 'Чат-интерфейс для AI с историей', complexity: 'Средне', time: '3-5 дней' },
                        { id: 'ecommerce' as const, name: 'E-commerce Lite', icon: '🛒', desc: 'Магазин с каталогом и корзиной', complexity: 'Сложно', time: '1-2 недели' },
                      ].map((type) => {
                        const isRecommended = productRecommendation?.recommended === type.id;
                        const recommendationScore = productRecommendation?.allRecommendations.find(r => r.type === type.id);
                        const isSelected = selectedProductType === type.id;

                        return (
                          <button
                            key={type.id}
                            onClick={() => setSelectedProductType(type.id)}
                            className={`relative text-left p-5 rounded-xl border-2 transition-all ${
                              isSelected
                                ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/20'
                                : isRecommended
                                  ? 'bg-emerald-500/5 border-emerald-500/40 hover:border-emerald-500/60'
                                  : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                            }`}
                          >
                            {/* Бейдж рекомендации */}
                            {isRecommended && !isSelected && (
                              <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-xs font-medium rounded-full shadow-lg">
                                Рекомендуем
                              </div>
                            )}

                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{type.icon}</span>
                                <span className={`font-semibold ${
                                  isSelected ? 'text-indigo-300' :
                                  isRecommended ? 'text-emerald-300' : 'text-white'
                                }`}>
                                  {type.name}
                                </span>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center">
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <p className="text-sm text-zinc-400 mb-2">{type.desc}</p>
                            <div className="flex items-center gap-3 text-xs">
                              <span className={`px-2 py-0.5 rounded-full ${
                                type.complexity === 'Легко' ? 'bg-green-500/20 text-green-400' :
                                type.complexity === 'Средне' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-red-500/20 text-red-400'
                              }`}>
                                {type.complexity}
                              </span>
                              <span className="text-zinc-500">{type.time}</span>
                              {/* Показываем релевантность только если есть рекомендация */}
                              {recommendationScore && recommendationScore.score > 0 && (
                                <span className={`px-2 py-0.5 rounded-full ${
                                  isRecommended ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-400'
                                }`}>
                                  {Math.min(100, Math.round(recommendationScore.score))}% match
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Auto-deploy toggle */}
                    {isGithubAuthenticated && (
                      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">▲</span>
                          <div>
                            <div className="font-medium text-white">Автодеплой на Vercel</div>
                            <div className="text-sm text-zinc-400">Продукт будет сразу доступен онлайн</div>
                          </div>
                        </div>
                        <button
                          onClick={() => setAutoDeploy(!autoDeploy)}
                          className={`relative w-12 h-6 rounded-full transition-colors ${
                            autoDeploy ? 'bg-indigo-500' : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                            autoDeploy ? 'left-7' : 'left-1'
                          }`} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* CTA блок */}
                  <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-8 text-center">
                    <h3 className="text-2xl font-bold text-white mb-4">
                      {language === 'ru' ? 'Создать рабочий MVP' : 'Create Working MVP'}
                    </h3>
                    <p className="text-zinc-400 mb-6 max-w-lg mx-auto">
                      {language === 'ru'
                        ? 'AI проанализирует тренд и предложит оптимальный тип MVP с реальной функциональностью'
                        : 'AI will analyze the trend and suggest the optimal MVP type with real functionality'}
                    </p>
                    {projectError && (
                      <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {projectError}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                      <button
                        onClick={() => handleOpenMVPSelector(false)}
                        className="px-8 py-4 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-all inline-flex items-center gap-2"
                      >
                        <span>📋</span>
                        {language === 'ru' ? 'Только спецификация' : 'Specification Only'}
                      </button>
                      {isGithubAuthenticated ? (
                        <button
                          onClick={() => handleOpenMVPSelector(true)}
                          className="px-8 py-4 rounded-xl font-medium transition-all inline-flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25"
                        >
                          <span>🚀</span>
                          {autoDeploy
                            ? (language === 'ru' ? 'Создать + GitHub + Deploy' : 'Create + GitHub + Deploy')
                            : (language === 'ru' ? 'Создать + GitHub репо' : 'Create + GitHub Repo')}
                        </button>
                      ) : (
                        <a
                          href={`/api/auth/github?returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.pathname}?tab=project` : `/trends/${params.id}?tab=project`)}`}
                          className="px-8 py-4 rounded-xl font-medium transition-all inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                        >
                          <span>🔐</span>
                          {language === 'ru' ? 'Войти в GitHub для создания репо' : 'Login to GitHub to create repo'}
                        </a>
                      )}
                    </div>
                    {!isGithubAuthenticated && (
                      <p className="mt-4 text-sm text-zinc-500">
                        {language === 'ru'
                          ? 'После авторизации вы сможете автоматически создать репозиторий с рабочим кодом'
                          : 'After authorization you can automatically create a repository with working code'}
                      </p>
                    )}
                  </div>

                  {/* Что будет создано */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Что будет сгенерировано:</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { icon: '💻', title: 'Рабочий код', desc: `Полный Next.js проект для ${selectedProductType}` },
                        { icon: '🗄️', title: 'База данных', desc: 'Supabase схема + API интеграция' },
                        { icon: '🎨', title: 'UI компоненты', desc: 'Tailwind CSS + готовые страницы' },
                        { icon: '🔐', title: selectedProductType === 'saas' ? 'Авторизация' : 'Интеграции', desc: selectedProductType === 'saas' ? 'Supabase Auth + OAuth' : 'API ключи и webhooks' },
                        { icon: '📝', title: 'Документация', desc: 'README + инструкция по настройке' },
                        { icon: autoDeploy ? '▲' : '🗺️', title: autoDeploy ? 'Live URL' : 'Roadmap', desc: autoDeploy ? 'Автоматический деплой на Vercel' : 'План развития MVP → Production' },
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
                </>
              )}

              {/* Загрузка */}
              {loadingProject && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
                  <div className="animate-spin w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">META-агент работает...</h3>
                  <p className="text-zinc-400">Анализирует данные от всех экспертов и генерирует спецификацию</p>
                </div>
              )}

              {/* Результаты */}
              {projectData && (
                <>
                  {/* Заголовок */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-indigo-500/10 border border-emerald-500/20 rounded-xl p-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-3xl">✅</span>
                          <h3 className="text-2xl font-bold text-white">{projectData.project_name}</h3>
                        </div>
                        {projectData.one_liner && (
                          <p className="text-zinc-300 mb-2">{projectData.one_liner}</p>
                        )}
                        <div className="flex flex-wrap gap-4">
                          {projectData.github_url && (
                            <a
                              href={projectData.github_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-indigo-400 hover:text-indigo-300 text-sm"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                              GitHub
                            </a>
                          )}
                          {(projectData.vercel_url || vercelUrl) && (
                            <a
                              href={projectData.vercel_url || vercelUrl || ''}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm"
                            >
                              <span className="text-base">▲</span>
                              Live Demo
                            </a>
                          )}
                        </div>
                        {!projectData.github_url && !projectData.vercel_url && !vercelUrl && (
                          <p className="text-zinc-500 text-sm">GitHub репозиторий не создан</p>
                        )}
                      </div>
                      {/* Кнопка создания GitHub репо если его нет */}
                      {!projectData.github_url && !creatingGithubRepo && (
                        <div className="flex-shrink-0">
                          {isGithubAuthenticated ? (
                            <button
                              onClick={createGithubRepoForProject}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                              Создать GitHub репо
                            </button>
                          ) : (
                            <a
                              href={`/api/auth/github?returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.pathname}?tab=project` : `/trends/${params.id}?tab=project`)}`}
                              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                              Войти в GitHub
                            </a>
                          )}
                        </div>
                      )}
                      {creatingGithubRepo && (
                        <div className="flex items-center gap-2 text-zinc-400">
                          <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                          <span className="text-sm">Создание репо...</span>
                        </div>
                      )}
                    </div>
                    {projectError && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {projectError}
                      </div>
                    )}

                    {/* Кнопка сброса проекта */}
                    <div className="mt-4 pt-4 border-t border-zinc-700/50">
                      <button
                        onClick={resetProject}
                        className="text-sm text-zinc-500 hover:text-red-400 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Сбросить проект
                      </button>
                    </div>
                  </div>

                  {/* Problem & Solution */}
                  {(projectData.problem_statement || projectData.solution_overview) && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {projectData.problem_statement && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                          <h4 className="text-sm text-red-400 mb-2 font-medium">Problem</h4>
                          <p className="text-zinc-300 text-sm">{projectData.problem_statement}</p>
                        </div>
                      )}
                      {projectData.solution_overview && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                          <h4 className="text-sm text-emerald-400 mb-2 font-medium">Solution</h4>
                          <p className="text-zinc-300 text-sm">{projectData.solution_overview}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* MVP Specification */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>⚙️</span> MVP Specification
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm text-zinc-400 mb-2">Core Features</h4>
                        <div className="space-y-2">
                          {projectData.mvp_specification?.core_features?.map((f, i) => (
                            <div key={i} className="p-3 bg-zinc-800/50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-white">{f.name}</span>
                                <span className={`text-xs px-2 py-1 rounded ${
                                  f.priority === 'must-have' || f.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                  f.priority === 'should-have' || f.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                  'bg-zinc-700 text-zinc-400'
                                }`}>{f.priority}</span>
                              </div>
                              <p className="text-sm text-zinc-400 mt-1">{f.description}</p>
                              {f.user_story && (
                                <p className="text-xs text-zinc-500 mt-2 italic">{f.user_story}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm text-zinc-400 mb-2">Tech Stack</h4>
                        <div className="space-y-2">
                          {projectData.mvp_specification?.tech_stack?.map((item, i) => (
                            <div key={i} className="p-3 bg-zinc-800/50 rounded-lg">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-zinc-500">{item.category}:</span>
                                <span className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded">{item.recommendation}</span>
                              </div>
                              {item.alternatives && item.alternatives.length > 0 && (
                                <div className="mt-1 flex gap-1">
                                  <span className="text-xs text-zinc-600">Alt:</span>
                                  {item.alternatives.map((alt, j) => (
                                    <span key={j} className="text-xs text-zinc-500">{alt}{j < item.alternatives!.length - 1 ? ',' : ''}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {projectData.mvp_specification?.architecture && (
                          <div className="mt-4 pt-4 border-t border-zinc-700">
                            <div className="text-sm">
                              <span className="text-zinc-400">Architecture:</span>
                              <span className="text-white ml-2">{projectData.mvp_specification.architecture}</span>
                            </div>
                            {projectData.mvp_specification.estimated_complexity && (
                              <div className="text-sm mt-1">
                                <span className="text-zinc-400">Complexity:</span>
                                <span className={`ml-2 ${
                                  projectData.mvp_specification.estimated_complexity === 'high' ? 'text-red-400' :
                                  projectData.mvp_specification.estimated_complexity === 'medium' ? 'text-amber-400' :
                                  'text-emerald-400'
                                }`}>{projectData.mvp_specification.estimated_complexity}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Roadmap */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>🗺️</span> Roadmap: MVP → Production
                    </h3>
                    <div className="space-y-4">
                      {[
                        { key: 'mvp', label: 'MVP', color: 'indigo' },
                        { key: 'alpha', label: 'Alpha', color: 'purple' },
                        { key: 'beta', label: 'Beta', color: 'amber' },
                        { key: 'production', label: 'Production', color: 'emerald' },
                      ].map((phase, i) => {
                        const phaseData = projectData.roadmap?.[phase.key as keyof ProjectRoadmap];
                        if (!phaseData) return null;
                        return (
                          <div key={i} className="relative pl-8 pb-4 border-l-2 border-indigo-500/30 last:border-l-transparent">
                            <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-${phase.color}-500`} style={{backgroundColor: phase.color === 'indigo' ? '#6366f1' : phase.color === 'purple' ? '#a855f7' : phase.color === 'amber' ? '#f59e0b' : '#10b981'}} />
                            <div className="flex items-center gap-3 mb-2">
                              <h4 className="font-semibold text-white">{phase.label}</h4>
                              {phaseData.duration && (
                                <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded">{phaseData.duration}</span>
                              )}
                            </div>
                            <div className="grid md:grid-cols-3 gap-4">
                              <div>
                                <span className="text-xs text-zinc-500">Goals:</span>
                                <ul className="mt-1 space-y-1">
                                  {phaseData.goals?.map((g, j) => (
                                    <li key={j} className="text-sm text-zinc-300 flex items-start gap-2">
                                      <span className="text-emerald-400">→</span> {g}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="text-xs text-zinc-500">Deliverables:</span>
                                <ul className="mt-1 space-y-1">
                                  {phaseData.deliverables?.map((d, j) => (
                                    <li key={j} className="text-sm text-zinc-300 flex items-start gap-2">
                                      <span className="text-indigo-400">✓</span> {d}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="text-xs text-zinc-500">Success Metrics:</span>
                                <ul className="mt-1 space-y-1">
                                  {phaseData.success_metrics?.map((m, j) => (
                                    <li key={j} className="text-sm text-zinc-300 flex items-start gap-2">
                                      <span className="text-amber-400">📊</span> {m}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Business Metrics */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>💰</span> Business Metrics
                    </h3>
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                        <div className="text-lg font-bold text-zinc-300">{projectData.business_metrics?.target_users_mvp || 'TBD'}</div>
                        <div className="text-xs text-zinc-500">MVP Users</div>
                      </div>
                      <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                        <div className="text-lg font-bold text-zinc-300">{projectData.business_metrics?.target_revenue_mvp || 'TBD'}</div>
                        <div className="text-xs text-zinc-500">MVP Revenue</div>
                      </div>
                      <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                        <div className="text-lg font-bold text-emerald-400">{projectData.business_metrics?.target_users_production || 'TBD'}</div>
                        <div className="text-xs text-zinc-500">Production Users</div>
                      </div>
                      <div className="p-4 bg-zinc-800/50 rounded-lg text-center">
                        <div className="text-lg font-bold text-emerald-400">{projectData.business_metrics?.target_revenue_production || 'TBD'}</div>
                        <div className="text-xs text-zinc-500">Production Revenue</div>
                      </div>
                    </div>
                    {projectData.business_metrics?.key_kpis && projectData.business_metrics.key_kpis.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-700">
                        <span className="text-xs text-zinc-500">Key KPIs:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {projectData.business_metrics.key_kpis.map((kpi, i) => (
                            <span key={i} className="px-2 py-1 bg-indigo-500/10 text-indigo-300 text-xs rounded">{kpi}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enhancement Recommendations */}
                  {projectData.enhancement_recommendations?.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💡</span> Enhancement Recommendations
                      </h3>
                      <div className="space-y-3">
                        {projectData.enhancement_recommendations.map((rec, i) => (
                          <div key={i} className="p-4 bg-zinc-800/50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-white">{rec.area}</span>
                              <span className={`text-xs px-2 py-1 rounded ${
                                rec.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                rec.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-zinc-700 text-zinc-400'
                              }`}>{rec.priority}</span>
                            </div>
                            <p className="text-sm text-zinc-400">{rec.current_state}</p>
                            <p className="text-sm text-emerald-400 mt-1">→ {rec.recommended_improvement}</p>
                            <p className="text-xs text-zinc-500 mt-1">Impact: {rec.expected_impact}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* README Preview */}
                  {projectData.readme_content && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                          <span>📝</span> README.md
                        </h3>
                        <button
                          onClick={() => navigator.clipboard.writeText(projectData.readme_content)}
                          className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded text-sm transition-colors"
                        >
                          Copy
                        </button>
                      </div>
                      <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-300 overflow-x-auto max-h-80 whitespace-pre-wrap">
                        {projectData.readme_content}
                      </pre>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-4 justify-center">
                    <button
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(projectData, null, 2))}
                      className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-colors inline-flex items-center gap-2"
                    >
                      <span>📋</span>
                      Copy Full JSON
                    </button>
                    <button
                      onClick={() => router.push(`/projects?data=${encodeURIComponent(JSON.stringify(projectData))}`)}
                      className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors inline-flex items-center gap-2"
                    >
                      <span>🚀</span>
                      Открыть в проектах
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
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

      {/* MVP Type Selector Modal */}
      {showMVPSelector && trend && (
        <MVPTypeSelector
          context={{
            trend: {
              id: trend.id,
              title: trend.title,
              category: trend.category,
              why_trending: trend.why_trending,
            },
            analysis: analysis ? {
              main_pain: analysis.main_pain,
              key_pain_points: analysis.key_pain_points,
              target_audience: analysis.target_audience,
            } : undefined,
            pitch: pitchDeck ? {
              company_name: pitchDeck.title,
              tagline: pitchDeck.tagline,
            } : undefined,
            // NEW: Передаём productSpec если уже есть
            productSpec: productSpec || undefined,
          } as MVPGenerationContext}
          onSelect={handleMVPTypeSelect}
          onCancel={() => setShowMVPSelector(false)}
          isLoading={loadingProject || loadingProductSpec}
        />
      )}
    </div>
  );
}
