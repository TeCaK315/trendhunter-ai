'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TrendChat from '@/components/TrendChat';
import ProjectIterateChat from '@/components/ProjectIterateChat';
import MarketingPlan from '@/components/MarketingPlan';
import type { MarketingPlanResult } from '@/app/api/marketing-plan/route';
import MVPTypeSelector from '@/components/MVPTypeSelector';
import { recommendProductType, type ProductType } from '@/lib/productRecommendation';
import { MVPType, MVPGenerationContext, ProductSpecification } from '@/lib/mvp-templates';
import { useLanguage, useTranslateContent } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import RealProblemBlock from '@/components/blocks/RealProblemBlock';
import DemandGrowthBlock from '@/components/blocks/DemandGrowthBlock';
import DemandBlock from '@/components/blocks/DemandBlock';
import MarketSellabilityBlock from '@/components/blocks/MarketSellabilityBlock';
import SellabilityBlock from '@/components/blocks/SellabilityBlock';
import MarketOccupationBlock from '@/components/blocks/MarketOccupationBlock';
import CompetitionBlock from '@/components/blocks/CompetitionBlock';
import UnitEconomicsBlock from '@/components/blocks/UnitEconomicsBlock';
import EconomicsBlock from '@/components/blocks/EconomicsBlock';
import TechFeasibilityBlock from '@/components/blocks/TechFeasibilityBlock';
import BlindSpotsBlock from '@/components/blocks/BlindSpotsBlock';
import SynthesisPanel from '@/components/blocks/SynthesisPanel';
import { adaptBlockData } from '@/lib/evidence-adapters';
import PremiumOverlay from '@/components/PremiumOverlay';
import EvidenceBadge from '@/components/EvidenceBadge';
import ActionPlanBlock from '@/components/blocks/ActionPlanBlock';
import FinancialCalculator from '@/components/blocks/FinancialCalculator';
import ExecutiveSummary from '@/components/blocks/ExecutiveSummary';
import ScenarioComparison from '@/components/blocks/ScenarioComparison';
import SurveyGenerator from '@/components/blocks/SurveyGenerator';
import GtmPlanGenerator from '@/components/blocks/GtmPlanGenerator';
import MonitoringDashboard from '@/components/blocks/MonitoringDashboard';
import LandingPageGenerator from '@/components/blocks/LandingPageGenerator';
import DashboardSidebar from '@/components/layout/DashboardSidebar';
import DifferentiationBlock from '@/components/blocks/DifferentiationBlock';
import OverviewDashboard from '@/components/blocks/OverviewDashboard';

interface Trend {
  id: string;
  title: string;
  category: string;
  popularity_score: number;
  growth_rate: number;
  why_trending: string;
  why_trending_en?: string;
  status: string;
  first_detected_at: string;
  source?: string;
  source_query?: string;
  relevant_subreddits?: string[];
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

// Оптимизированный flow: 4 основных шага вместо 8
// Каждый шаг содержит подразделы с полным контентом
type FlowStep = 'overview' | 'evidence' | 'action-plan' | 'monitoring' | 'research' | 'business' | 'project';

// Подразделы внутри каждого шага
type BusinessSubTab = 'venture' | 'leads';
type ActionPlanSubTab = 'plan' | 'calculator' | 'scenarios' | 'survey' | 'gtm' | 'report' | 'differentiation';
type EvidenceSubTab = 'analysis' | 'problem' | 'demand' | 'sellability' | 'occupation' | 'economics' | 'tech';

interface PotentialCompany {
  name: string;
  website: string;
  description?: string;
  linkedin_url?: string;
  source?: string;
  source_url?: string;
  pain_match?: string;
  outreach_angle?: string;
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
  typical_check_size: string;
  website: string;
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

  // === localStorage cache helpers ===
  const cacheKey = (key: string) => `th_${trendId}_${key}`;

  const saveToCache = useCallback((key: string, data: unknown) => {
    try {
      localStorage.setItem(cacheKey(key), JSON.stringify(data));
    } catch { /* ignore quota errors */ }
  }, [trendId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadFromCache = useCallback(<T,>(key: string): T | null => {
    try {
      const stored = localStorage.getItem(cacheKey(key));
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  }, [trendId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [trend, setTrend] = useState<Trend | null>(null);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [collectingSources, setCollectingSources] = useState(false);
  const [currentStep, setCurrentStep] = useState<FlowStep>('overview');
  const [businessSubTab, setBusinessSubTab] = useState<BusinessSubTab>('venture');
  const [actionPlanSubTab, setActionPlanSubTab] = useState<ActionPlanSubTab>('plan');
  const [evidenceSubTab, setEvidenceSubTab] = useState<EvidenceSubTab>('problem'); // Default to first Evidence tab
  const [isFavorite, setIsFavorite] = useState(false);
  const [dashboardCollapsed, setDashboardCollapsed] = useState(false);
  const [coinBalance, setCoinBalance] = useState<number | null>(null);

  // Evidence block data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [evidenceData, setEvidenceData] = useState<Record<string, any>>({});
  const [evidenceLoading, setEvidenceLoading] = useState<Record<string, boolean>>({});
  const [evidenceErrors, setEvidenceErrors] = useState<Record<string, string>>({});
  // Which blocks have premium unlocked (premium data fetched from server after payment)
  const [unlockedBlocks, setUnlockedBlocks] = useState<Record<string, boolean>>({});

  // Action Plan data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [actionPlanData, setActionPlanData] = useState<any>(null);
  const [actionPlanLoading, setActionPlanLoading] = useState(false);
  const [actionPlanError, setActionPlanError] = useState('');

  // Differentiation data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [differentiationData, setDifferentiationData] = useState<any>(null);
  const [differentiationLoading, setDifferentiationLoading] = useState(false);
  const [differentiationError, setDifferentiationError] = useState('');

  // Translation hooks for dynamic content
  const trendForTranslation = trend ? {
    why_trending: trend.why_trending,
  } : null;

  const { data: translatedTrend, isLoading: translatingTrend } = useTranslateContent(
    language === 'en' && trend && !trend.why_trending_en ? trendForTranslation : null,
    { cacheKey: trend ? `trend-${trend.id}` : undefined, fields: ['why_trending'] }
  );

  const analysisForTranslation = analysis ? {
    main_pain: analysis.main_pain,
    key_pain_points: analysis.key_pain_points,
    // Target audience segments
    target_segments: analysis.target_audience?.segments?.map(s => ({
      name: s.name,
      size: s.size,
      willingness_to_pay: s.willingness_to_pay,
      where_to_find: s.where_to_find || '',
    })) || [],
  } : null;

  const { data: translatedAnalysis, isLoading: translatingAnalysis } = useTranslateContent(
    language === 'en' && analysis ? analysisForTranslation : null,
    { cacheKey: analysis ? `analysis-${analysis.trend_id}` : undefined, fields: ['main_pain', 'key_pain_points', 'target_segments'] }
  );

  // Computed translated values
  const displayWhyTrending = trend ? (
    language === 'en'
      ? (trend.why_trending_en || translatedTrend?.why_trending || trend.why_trending)
      : trend.why_trending
  ) : '';

  const displayMainPain = analysis ? (
    language === 'en'
      ? (translatedAnalysis?.main_pain || analysis.main_pain)
      : analysis.main_pain
  ) : '';

  const displayKeyPainPoints = analysis?.key_pain_points ? (
    language === 'en'
      ? (translatedAnalysis?.key_pain_points || analysis.key_pain_points)
      : analysis.key_pain_points
  ) : [];

  const displayTargetSegments = analysis?.target_audience?.segments ? (
    language === 'en'
      ? ((translatedAnalysis?.target_segments as typeof analysis.target_audience.segments) || analysis.target_audience.segments)
      : analysis.target_audience.segments
  ) : [];

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

  // Translation for rawAnalyses (Optimist/Skeptic debate)
  const rawAnalysesForTranslation = (rawAnalyses.optimist && rawAnalyses.skeptic) ? {
    optimist_pains: rawAnalyses.optimist.pains.map(p => ({ pain: p.pain, reasoning: p.reasoning })),
    skeptic_pains: rawAnalyses.skeptic.pains.map(p => ({ pain: p.pain, reasoning: p.reasoning })),
    optimist_conclusion: analysisMetadata?.optimist_summary || rawAnalyses.optimist.overall_assessment,
    skeptic_conclusion: analysisMetadata?.skeptic_summary || rawAnalyses.skeptic.overall_assessment,
  } : null;

  const { data: translatedRawAnalyses, isLoading: translatingRawAnalyses } = useTranslateContent(
    language === 'en' && rawAnalysesForTranslation ? rawAnalysesForTranslation : null,
    { cacheKey: analysis ? `raw-analyses-${analysis.trend_id}` : undefined }
  );

  // Computed translated raw analyses
  const displayOptimistPains = rawAnalyses.optimist?.pains ? (
    language === 'en' && translatedRawAnalyses?.optimist_pains
      ? rawAnalyses.optimist.pains.map((p, i) => ({
          ...p,
          pain: (translatedRawAnalyses.optimist_pains as Array<{pain: string; reasoning: string}>)[i]?.pain || p.pain,
          reasoning: (translatedRawAnalyses.optimist_pains as Array<{pain: string; reasoning: string}>)[i]?.reasoning || p.reasoning,
        }))
      : rawAnalyses.optimist.pains
  ) : [];

  const displaySkepticPains = rawAnalyses.skeptic?.pains ? (
    language === 'en' && translatedRawAnalyses?.skeptic_pains
      ? rawAnalyses.skeptic.pains.map((p, i) => ({
          ...p,
          pain: (translatedRawAnalyses.skeptic_pains as Array<{pain: string; reasoning: string}>)[i]?.pain || p.pain,
          reasoning: (translatedRawAnalyses.skeptic_pains as Array<{pain: string; reasoning: string}>)[i]?.reasoning || p.reasoning,
        }))
      : rawAnalyses.skeptic.pains
  ) : [];

  const displayOptimistConclusion = language === 'en' && translatedRawAnalyses?.optimist_conclusion
    ? (translatedRawAnalyses.optimist_conclusion as string)
    : (analysisMetadata?.optimist_summary || rawAnalyses.optimist?.overall_assessment || '');

  const displaySkepticConclusion = language === 'en' && translatedRawAnalyses?.skeptic_conclusion
    ? (translatedRawAnalyses.skeptic_conclusion as string)
    : (analysisMetadata?.skeptic_summary || rawAnalyses.skeptic?.overall_assessment || '');

  // New data states
  const [competition, setCompetition] = useState<CompetitionData | null>(null);
  const [loadingCompetition, setLoadingCompetition] = useState(false);
  const [ventureData, setVentureData] = useState<VentureData | null>(null);
  const [loadingVenture, setLoadingVenture] = useState(false);
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

  // Translation hooks for competition data
  const competitionForTranslation = competition ? {
    competitors: competition.competitors.map(c => ({ description: c.description })),
    opportunity_areas: competition.opportunity_areas,
  } : null;

  const { data: translatedCompetition, isLoading: translatingCompetition } = useTranslateContent(
    language === 'en' && competition ? competitionForTranslation : null,
    { cacheKey: analysis ? `competition-${analysis.trend_id}` : undefined }
  );

  // Translation hooks for venture data
  const ventureForTranslation = ventureData ? {
    market_signals: ventureData.market_signals,
  } : null;

  const { data: translatedVenture, isLoading: translatingVenture } = useTranslateContent(
    language === 'en' && ventureData ? ventureForTranslation : null,
    { cacheKey: analysis ? `venture-${analysis.trend_id}` : undefined }
  );

  // Translation hooks for leads data
  const leadsForTranslation = leadsData ? {
    companies: leadsData.companies.map(c => ({
      pain_match: c.pain_match,
    })),
    search_tips: leadsData.search_tips,
    directories: leadsData.directories?.map(d => ({
      description: d.description,
    })),
  } : null;

  const { data: translatedLeads, isLoading: translatingLeads } = useTranslateContent(
    language === 'en' && leadsData ? leadsForTranslation : null,
    { cacheKey: analysis ? `leads-${analysis.trend_id}` : undefined }
  );

  // Computed translated leads values
  const displayCompanies = leadsData?.companies ? (
    language === 'en' && translatedLeads?.companies
      ? leadsData.companies.map((c, i) => ({
          ...c,
          pain_match: (translatedLeads.companies as Array<{pain_match: string}>)[i]?.pain_match || c.pain_match,
        }))
      : leadsData.companies
  ) : [];

  const displaySearchTips = leadsData?.search_tips ? (
    language === 'en'
      ? ((translatedLeads?.search_tips as string[]) || leadsData.search_tips)
      : leadsData.search_tips
  ) : [];

  const displayDirectories = leadsData?.directories ? (
    language === 'en' && translatedLeads?.directories
      ? leadsData.directories.map((d, i) => ({
          ...d,
          description: (translatedLeads.directories as Array<{description: string}>)[i]?.description || d.description,
        }))
      : leadsData.directories
  ) : [];

  // Computed translated competition values
  const displayCompetitors = competition?.competitors ? (
    language === 'en' && translatedCompetition?.competitors
      ? competition.competitors.map((c, i) => ({
          ...c,
          description: (translatedCompetition.competitors as Array<{description: string}>)[i]?.description || c.description,
        }))
      : competition.competitors
  ) : [];

  const displayOpportunityAreas = competition?.opportunity_areas ? (
    language === 'en'
      ? ((translatedCompetition?.opportunity_areas as string[]) || competition.opportunity_areas)
      : competition.opportunity_areas
  ) : [];

  // Computed translated venture values
  const displayMarketSignals = ventureData?.market_signals ? (
    language === 'en'
      ? ((translatedVenture?.market_signals as string[]) || ventureData.market_signals)
      : ventureData.market_signals
  ) : [];

  // Translation hooks for strategic data
  const strategicForTranslation = (strategicPositioning || differentiationOpportunities.length > 0) ? {
    strategic_positioning: strategicPositioning,
    differentiation_opportunities: differentiationOpportunities,
  } : null;

  const { data: translatedStrategic, isLoading: translatingStrategic } = useTranslateContent(
    language === 'en' && strategicForTranslation ? strategicForTranslation : null,
    { cacheKey: analysis ? `strategic-${analysis.trend_id}` : undefined }
  );

  // Translation hooks for investment data
  const investmentForTranslation = (investmentThesis || recommendedRound || keyInvestors.length > 0) ? {
    investment_thesis: investmentThesis,
    recommended_round: recommendedRound,
    key_investors: keyInvestors,
  } : null;

  const { data: translatedInvestment, isLoading: translatingInvestment } = useTranslateContent(
    language === 'en' && investmentForTranslation ? investmentForTranslation : null,
    { cacheKey: analysis ? `investment-${analysis.trend_id}` : undefined }
  );

  // Computed translated strategic values
  const displayStrategicPositioning = strategicPositioning ? (
    language === 'en'
      ? ((translatedStrategic?.strategic_positioning as string) || strategicPositioning)
      : strategicPositioning
  ) : '';

  const displayDifferentiationOpportunities = differentiationOpportunities.length > 0 ? (
    language === 'en'
      ? ((translatedStrategic?.differentiation_opportunities as string[]) || differentiationOpportunities)
      : differentiationOpportunities
  ) : [];

  // Computed translated investment values
  const displayInvestmentThesis = investmentThesis ? (
    language === 'en'
      ? ((translatedInvestment?.investment_thesis as string) || investmentThesis)
      : investmentThesis
  ) : '';

  const displayRecommendedRound = recommendedRound ? (
    language === 'en'
      ? ((translatedInvestment?.recommended_round as string) || recommendedRound)
      : recommendedRound
  ) : '';

  const displayKeyInvestors = keyInvestors.length > 0 ? (
    language === 'en'
      ? ((translatedInvestment?.key_investors as string[]) || keyInvestors)
      : keyInvestors
  ) : [];

  // Состояние для проекта (META-агент)
  const [projectMode, setProjectMode] = useState<'landing' | 'full-mvp' | null>(null);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [projectGenStep, setProjectGenStep] = useState(0);
  const [projectGenStartTime, setProjectGenStartTime] = useState<number | null>(null);
  const [projectGenElapsed, setProjectGenElapsed] = useState(0);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [marketingPlan, setMarketingPlan] = useState<MarketingPlanResult | null>(null);
  const [loadingMarketingPlan, setLoadingMarketingPlan] = useState(false);
  const [marketingPlanError, setMarketingPlanError] = useState<string | null>(null);
  const [githubCreated, setGithubCreated] = useState(false);
  const [isGithubAuthenticated, setIsGithubAuthenticated] = useState(false);
  const [creatingGithubRepo, setCreatingGithubRepo] = useState(false);

  // Состояние для нового MVP селектора
  // showMVPSelector removed - META agent now auto-selects type
  const [selectedMVPType, setSelectedMVPType] = useState<MVPType | null>(null);
  // pendingCreateWithGithub removed - auto-flow doesn't need it

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
  const [showVercelTokenInput, setShowVercelTokenInput] = useState(false);
  const [vercelTokenValue, setVercelTokenValue] = useState('');
  const [vercelConnecting, setVercelConnecting] = useState(false);
  const [hasAutoSelectedType, setHasAutoSelectedType] = useState(false);

  // Маркетинговая стратегия
  const [marketingBudget, setMarketingBudget] = useState<string>('');
  const [marketingStrategy, setMarketingStrategy] = useState<{
    channels: Array<{ name: string; budget: string; roi: string; priority: string; tactics?: string[] }>;
    timeline: string;
    keyMetrics: string[];
    recommendations: string[];
    totalBudget?: string;
    expectedResults?: string;
  } | null>(null);
  const [loadingMarketing, setLoadingMarketing] = useState(false);

  // Выбор стиля/дизайна проекта
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [customStylePrompt, setCustomStylePrompt] = useState<string>('');
  const [generatedTheme, setGeneratedTheme] = useState<{
    name: string;
    cssVariables: Record<string, string>;
    preview: { primary: string; secondary: string; accent: string; background: string; text: string };
  } | null>(null);
  const [loadingTheme, setLoadingTheme] = useState(false);

  // Генерация кода через Claude API
  const [generatingCode, setGeneratingCode] = useState(false);
  const [codeGenerationError, setCodeGenerationError] = useState<string | null>(null);
  const [generatedCodeFiles, setGeneratedCodeFiles] = useState<string[]>([]);

  // Translation hooks for project data
  const projectForTranslation = projectData ? {
    problem_statement: projectData.problem_statement,
    solution_overview: projectData.solution_overview,
    one_liner: projectData.one_liner,
    core_features: projectData.mvp_specification?.core_features?.map(f => ({
      name: f.name,
      description: f.description,
      user_story: f.user_story,
    })) || [],
    tech_stack: projectData.mvp_specification?.tech_stack?.map(t => ({
      recommendation: t.recommendation,
      reasoning: t.reasoning,
    })) || [],
    roadmap_mvp_goals: projectData.roadmap?.mvp?.goals || [],
    roadmap_mvp_deliverables: projectData.roadmap?.mvp?.deliverables || [],
    roadmap_mvp_success_metrics: projectData.roadmap?.mvp?.success_metrics || [],
    roadmap_alpha_goals: projectData.roadmap?.alpha?.goals || [],
    roadmap_alpha_deliverables: projectData.roadmap?.alpha?.deliverables || [],
    roadmap_alpha_success_metrics: projectData.roadmap?.alpha?.success_metrics || [],
    roadmap_beta_goals: projectData.roadmap?.beta?.goals || [],
    roadmap_beta_deliverables: projectData.roadmap?.beta?.deliverables || [],
    roadmap_beta_success_metrics: projectData.roadmap?.beta?.success_metrics || [],
    roadmap_production_goals: projectData.roadmap?.production?.goals || [],
    roadmap_production_deliverables: projectData.roadmap?.production?.deliverables || [],
    roadmap_production_success_metrics: projectData.roadmap?.production?.success_metrics || [],
    enhancements: projectData.enhancement_recommendations?.map(e => ({
      area: e.area,
      current_state: e.current_state,
      recommended_improvement: e.recommended_improvement,
      expected_impact: e.expected_impact,
    })) || [],
    key_kpis: projectData.business_metrics?.key_kpis || [],
  } : null;

  const { data: translatedProject, isLoading: translatingProject } = useTranslateContent(
    language === 'en' && projectData ? projectForTranslation : null,
    { cacheKey: projectData ? `project-${projectData.project_name}` : undefined }
  );

  // Computed translated project values
  const displayProblemStatement = projectData?.problem_statement ? (
    language === 'en'
      ? ((translatedProject?.problem_statement as string) || projectData.problem_statement)
      : projectData.problem_statement
  ) : '';

  const displaySolutionOverview = projectData?.solution_overview ? (
    language === 'en'
      ? ((translatedProject?.solution_overview as string) || projectData.solution_overview)
      : projectData.solution_overview
  ) : '';

  const displayOneLiner = projectData?.one_liner ? (
    language === 'en'
      ? ((translatedProject?.one_liner as string) || projectData.one_liner)
      : projectData.one_liner
  ) : '';

  const displayCoreFeatures = projectData?.mvp_specification?.core_features ? (
    language === 'en' && translatedProject?.core_features
      ? projectData.mvp_specification.core_features.map((f, i) => ({
          ...f,
          name: (translatedProject.core_features as Array<{name: string; description: string; user_story?: string}>)[i]?.name || f.name,
          description: (translatedProject.core_features as Array<{name: string; description: string; user_story?: string}>)[i]?.description || f.description,
          user_story: (translatedProject.core_features as Array<{name: string; description: string; user_story?: string}>)[i]?.user_story || f.user_story,
        }))
      : projectData.mvp_specification.core_features
  ) : [];

  const displayTechStack = projectData?.mvp_specification?.tech_stack ? (
    language === 'en' && translatedProject?.tech_stack
      ? projectData.mvp_specification.tech_stack.map((t, i) => ({
          ...t,
          recommendation: (translatedProject.tech_stack as Array<{recommendation: string; reasoning?: string}>)[i]?.recommendation || t.recommendation,
          reasoning: (translatedProject.tech_stack as Array<{recommendation: string; reasoning?: string}>)[i]?.reasoning || t.reasoning,
        }))
      : projectData.mvp_specification.tech_stack
  ) : [];

  const displayRoadmapMvpGoals = projectData?.roadmap?.mvp?.goals ? (
    language === 'en'
      ? ((translatedProject?.roadmap_mvp_goals as string[]) || projectData.roadmap.mvp.goals)
      : projectData.roadmap.mvp.goals
  ) : [];

  const displayRoadmapMvpDeliverables = projectData?.roadmap?.mvp?.deliverables ? (
    language === 'en'
      ? ((translatedProject?.roadmap_mvp_deliverables as string[]) || projectData.roadmap.mvp.deliverables)
      : projectData.roadmap.mvp.deliverables
  ) : [];

  const displayRoadmapAlphaGoals = projectData?.roadmap?.alpha?.goals ? (
    language === 'en'
      ? ((translatedProject?.roadmap_alpha_goals as string[]) || projectData.roadmap.alpha.goals)
      : projectData.roadmap.alpha.goals
  ) : [];

  const displayRoadmapAlphaDeliverables = projectData?.roadmap?.alpha?.deliverables ? (
    language === 'en'
      ? ((translatedProject?.roadmap_alpha_deliverables as string[]) || projectData.roadmap.alpha.deliverables)
      : projectData.roadmap.alpha.deliverables
  ) : [];

  const displayRoadmapBetaGoals = projectData?.roadmap?.beta?.goals ? (
    language === 'en'
      ? ((translatedProject?.roadmap_beta_goals as string[]) || projectData.roadmap.beta.goals)
      : projectData.roadmap.beta.goals
  ) : [];

  const displayRoadmapBetaDeliverables = projectData?.roadmap?.beta?.deliverables ? (
    language === 'en'
      ? ((translatedProject?.roadmap_beta_deliverables as string[]) || projectData.roadmap.beta.deliverables)
      : projectData.roadmap.beta.deliverables
  ) : [];

  const displayRoadmapProductionGoals = projectData?.roadmap?.production?.goals ? (
    language === 'en'
      ? ((translatedProject?.roadmap_production_goals as string[]) || projectData.roadmap.production.goals)
      : projectData.roadmap.production.goals
  ) : [];

  const displayRoadmapProductionDeliverables = projectData?.roadmap?.production?.deliverables ? (
    language === 'en'
      ? ((translatedProject?.roadmap_production_deliverables as string[]) || projectData.roadmap.production.deliverables)
      : projectData.roadmap.production.deliverables
  ) : [];

  const displayRoadmapMvpSuccessMetrics = projectData?.roadmap?.mvp?.success_metrics ? (
    language === 'en'
      ? ((translatedProject?.roadmap_mvp_success_metrics as string[]) || projectData.roadmap.mvp.success_metrics)
      : projectData.roadmap.mvp.success_metrics
  ) : [];

  const displayRoadmapAlphaSuccessMetrics = projectData?.roadmap?.alpha?.success_metrics ? (
    language === 'en'
      ? ((translatedProject?.roadmap_alpha_success_metrics as string[]) || projectData.roadmap.alpha.success_metrics)
      : projectData.roadmap.alpha.success_metrics
  ) : [];

  const displayRoadmapBetaSuccessMetrics = projectData?.roadmap?.beta?.success_metrics ? (
    language === 'en'
      ? ((translatedProject?.roadmap_beta_success_metrics as string[]) || projectData.roadmap.beta.success_metrics)
      : projectData.roadmap.beta.success_metrics
  ) : [];

  const displayRoadmapProductionSuccessMetrics = projectData?.roadmap?.production?.success_metrics ? (
    language === 'en'
      ? ((translatedProject?.roadmap_production_success_metrics as string[]) || projectData.roadmap.production.success_metrics)
      : projectData.roadmap.production.success_metrics
  ) : [];

  const displayEnhancements = projectData?.enhancement_recommendations ? (
    language === 'en' && translatedProject?.enhancements
      ? projectData.enhancement_recommendations.map((e, i) => ({
          ...e,
          area: (translatedProject.enhancements as Array<{area: string; current_state: string; recommended_improvement: string; expected_impact: string}>)[i]?.area || e.area,
          current_state: (translatedProject.enhancements as Array<{area: string; current_state: string; recommended_improvement: string; expected_impact: string}>)[i]?.current_state || e.current_state,
          recommended_improvement: (translatedProject.enhancements as Array<{area: string; current_state: string; recommended_improvement: string; expected_impact: string}>)[i]?.recommended_improvement || e.recommended_improvement,
          expected_impact: (translatedProject.enhancements as Array<{area: string; current_state: string; recommended_improvement: string; expected_impact: string}>)[i]?.expected_impact || e.expected_impact,
        }))
      : projectData.enhancement_recommendations
  ) : [];

  const displayKeyKpis = projectData?.business_metrics?.key_kpis ? (
    language === 'en'
      ? ((translatedProject?.key_kpis as string[]) || projectData.business_metrics.key_kpis)
      : projectData.business_metrics.key_kpis
  ) : [];

  // Translation hooks for generated email
  const emailForTranslation = generatedEmail ? {
    subject: generatedEmail.subject,
    body: generatedEmail.body,
    follow_up_subject: generatedEmail.follow_up_subject,
    follow_up_body: generatedEmail.follow_up_body,
    tips: generatedEmail.tips,
  } : null;

  const { data: translatedEmail, isLoading: translatingEmail } = useTranslateContent(
    language === 'en' && generatedEmail ? emailForTranslation : null,
    { cacheKey: selectedCompany ? `email-${selectedCompany.name}` : undefined }
  );

  // Computed translated email values
  const displayEmailSubject = generatedEmail?.subject ? (
    language === 'en'
      ? ((translatedEmail?.subject as string) || generatedEmail.subject)
      : generatedEmail.subject
  ) : '';

  const displayEmailBody = generatedEmail?.body ? (
    language === 'en'
      ? ((translatedEmail?.body as string) || generatedEmail.body)
      : generatedEmail.body
  ) : '';

  const displayFollowUpSubject = generatedEmail?.follow_up_subject ? (
    language === 'en'
      ? ((translatedEmail?.follow_up_subject as string) || generatedEmail.follow_up_subject)
      : generatedEmail.follow_up_subject
  ) : '';

  const displayFollowUpBody = generatedEmail?.follow_up_body ? (
    language === 'en'
      ? ((translatedEmail?.follow_up_body as string) || generatedEmail.follow_up_body)
      : generatedEmail.follow_up_body
  ) : '';

  const displayEmailTips = generatedEmail?.tips ? (
    language === 'en'
      ? ((translatedEmail?.tips as string[]) || generatedEmail.tips)
      : generatedEmail.tips
  ) : [];

  // Прогресс сбора Evidence данных
  const evidenceProgress = useMemo(() => {
    const blocks = ['problem', 'demand', 'sellability', 'occupation', 'economics', 'tech'] as const;
    const done = blocks.filter(b => evidenceData[b]).length;
    const loading = blocks.some(b => evidenceLoading[b]);
    return { done, total: 6, percent: Math.round((done / 6) * 100), loading };
  }, [evidenceData, evidenceLoading]);

  // Определение статуса шага
  const getStepStatus = useCallback((stepId: string): 'completed' | 'active' | 'pending' => {
    if (stepId === currentStep) return 'active';
    switch (stepId) {
      case 'overview': return 'completed'; // всегда "done" после первого визита
      case 'evidence': return evidenceProgress.done > 0 ? 'completed' : 'pending';
      case 'action-plan': return actionPlanData ? 'completed' : 'pending';
      case 'monitoring': return 'pending';
      case 'business': return 'pending';
      case 'project': return 'pending';
      default: return 'pending';
    }
  }, [currentStep, evidenceProgress.done, actionPlanData]);

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
      undefined
    );
  }, [trend, analysis]);

  // Автоматически устанавливаем рекомендуемый тип при первом расчёте
  useEffect(() => {
    if (productRecommendation && !hasAutoSelectedType && currentStep === 'project') {
      setSelectedProductType(productRecommendation.recommended);
      setHasAutoSelectedType(true);
    }
  }, [productRecommendation, hasAutoSelectedType, currentStep]);

  // === Загрузка баланса монет ===
  useEffect(() => {
    fetch('/api/credits/balance')
      .then(r => r.json())
      .then(d => setCoinBalance(d.balance ?? 0))
      .catch(() => setCoinBalance(0));
  }, []);

  // === Сохранение данных в localStorage при изменении ===
  useEffect(() => { if (analysis) saveToCache('analysis', analysis); }, [analysis, saveToCache]);
  useEffect(() => { if (Object.keys(evidenceData).length > 0) saveToCache('evidenceData', evidenceData); }, [evidenceData, saveToCache]);
  useEffect(() => { if (rawAnalyses.optimist || rawAnalyses.skeptic) saveToCache('rawAnalyses', rawAnalyses); }, [rawAnalyses, saveToCache]);
  useEffect(() => { if (analysisMetadata) saveToCache('analysisMetadata', analysisMetadata); }, [analysisMetadata, saveToCache]);
  useEffect(() => { if (competition) saveToCache('competition', competition); }, [competition, saveToCache]);
  useEffect(() => { if (ventureData) saveToCache('ventureData', ventureData); }, [ventureData, saveToCache]);
  useEffect(() => { if (leadsData) saveToCache('leadsData', leadsData); }, [leadsData, saveToCache]);
  useEffect(() => { if (productSpec) saveToCache('productSpec', productSpec); }, [productSpec, saveToCache]);
  useEffect(() => { if (sourcesSynthesis) saveToCache('sourcesSynthesis', sourcesSynthesis); }, [sourcesSynthesis, saveToCache]);
  useEffect(() => { if (strategicPositioning) saveToCache('strategicPositioning', strategicPositioning); }, [strategicPositioning, saveToCache]);
  useEffect(() => { if (projectData) saveToCache('projectData', projectData); }, [projectData, saveToCache]);
  useEffect(() => {
    if (currentStep !== 'overview') saveToCache('currentStep', currentStep);
  }, [currentStep, saveToCache]);

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

  // Функция проверки Vercel авторизации
  const checkVercelAuth = useCallback(async () => {
    try {
      const vercelRes = await fetch('/api/auth/vercel/user');
      const vercelData = await vercelRes.json();
      const isAuth = vercelData.authenticated && !!vercelData.user;
      setIsVercelAuthenticated(isAuth);
      return isAuth;
    } catch {
      setIsVercelAuthenticated(false);
      return false;
    }
  }, []);

  // Auto-generate ProductSpec when Evidence data is available
  // This ensures derived_features are based on REAL data, not empty arrays
  useEffect(() => {
    // Only trigger if we have analysis AND at least one Evidence block loaded
    const hasAnalysis = analysis?.main_pain;
    const hasEvidenceData = evidenceData.problem?.who_hurts?.complaints?.length > 0 ||
                            evidenceData.occupation?.negative_reviews?.length > 0 ||
                            evidenceData.occupation?.unmet_needs?.length > 0;

    // Only auto-generate if we don't have productSpec yet AND we have data
    if (hasAnalysis && hasEvidenceData && !productSpec && !loadingProductSpec) {
      console.log('[ProductSpec] Evidence data ready, triggering generation with context');
      fetchProductSpec();
    }
  }, [analysis, evidenceData.problem, evidenceData.occupation, productSpec, loadingProductSpec]);

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
      // Маппинг старых табов на новые
      const tabMapping: Record<string, { step: FlowStep; subTab?: EvidenceSubTab | BusinessSubTab }> = {
        'overview': { step: 'overview' },
        'analysis': { step: 'evidence', subTab: 'analysis' },
        'venture': { step: 'business', subTab: 'venture' },
        'leads': { step: 'business', subTab: 'leads' },

        'project': { step: 'project' },
        // Новые табы
        'business': { step: 'business' },
        'evidence': { step: 'evidence' },
      };

      const mapping = tabMapping[tabParam];
      if (mapping) {
        tabSetFromUrlRef.current = true;
        setCurrentStep(mapping.step);
        if (mapping.subTab) {
          if (['analysis', 'problem', 'demand', 'sellability', 'occupation', 'economics'].includes(mapping.subTab)) {
            setEvidenceSubTab(mapping.subTab as EvidenceSubTab);
          } else {
            setBusinessSubTab(mapping.subTab as BusinessSubTab);
          }
        }
      }
    }
  }, [searchParams, checkGithubAuth, router]);

  // Connect Vercel via Personal Access Token
  const connectVercelToken = useCallback(async () => {
    if (!vercelTokenValue.trim()) return;
    setVercelConnecting(true);
    try {
      const res = await fetch('/api/auth/vercel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: vercelTokenValue.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setIsVercelAuthenticated(true);
        setShowVercelTokenInput(false);
        setVercelTokenValue('');
      }
    } catch { /* ignore */ }
    finally { setVercelConnecting(false); }
  }, [vercelTokenValue]);

  // Timer and step progression for project generation
  useEffect(() => {
    if (!loadingProject) {
      setProjectGenStartTime(null);
      setProjectGenElapsed(0);
      setProjectGenStep(0);
      return;
    }
    if (!projectGenStartTime) {
      setProjectGenStartTime(Date.now());
    }
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - (projectGenStartTime || Date.now())) / 1000);
      setProjectGenElapsed(elapsed);
      // Auto-advance steps based on time (block assembler ~2 min total)
      if (elapsed >= 100) setProjectGenStep(4);
      else if (elapsed >= 60) setProjectGenStep(3);
      else if (elapsed >= 30) setProjectGenStep(2);
      else if (elapsed >= 8) setProjectGenStep(1);
    }, 1000);
    return () => clearInterval(timer);
  }, [loadingProject, projectGenStartTime]);

  // Хелпер: Построение накопительного контекста для передачи между экспертами
  const buildAnalysisContext = () => {
    const context: Record<string, unknown> = {
      trend: {
        id: trend?.id,
        title: trend?.title,
        category: trend?.category,
        why_trending: trend?.why_trending,
        source_query: trend?.source_query,
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
        // === Восстанавливаем кешированные данные из localStorage ===
        const cachedAnalysis = loadFromCache<TrendAnalysis>('analysis');
        if (cachedAnalysis) setAnalysis(cachedAnalysis);

        const cachedEvidence = loadFromCache<Record<string, unknown>>('evidenceData');
        if (cachedEvidence && Object.keys(cachedEvidence).length > 0) setEvidenceData(cachedEvidence);

        const cachedRawAnalyses = loadFromCache<{ optimist: AgentAnalysis | null; skeptic: AgentAnalysis | null }>('rawAnalyses');
        if (cachedRawAnalyses) setRawAnalyses(cachedRawAnalyses);

        const cachedMetadata = loadFromCache<{ optimist_summary?: string; skeptic_summary?: string; consensus_reached?: boolean }>('analysisMetadata');
        if (cachedMetadata) setAnalysisMetadata(cachedMetadata);

        const cachedCompetition = loadFromCache<CompetitionData>('competition');
        if (cachedCompetition) setCompetition(cachedCompetition);

        const cachedVenture = loadFromCache<VentureData>('ventureData');
        if (cachedVenture) setVentureData(cachedVenture);

        const cachedLeads = loadFromCache<LeadsData>('leadsData');
        if (cachedLeads) setLeadsData(cachedLeads);

        const cachedProductSpec = loadFromCache<ProductSpecification>('productSpec');
        if (cachedProductSpec) setProductSpec(cachedProductSpec);

        const cachedSources = loadFromCache<SourcesSynthesis>('sourcesSynthesis');
        if (cachedSources) setSourcesSynthesis(cachedSources);

        const cachedPositioning = loadFromCache<string>('strategicPositioning');
        if (cachedPositioning) setStrategicPositioning(cachedPositioning);

        const cachedProjectData = loadFromCache<ProjectData>('projectData');
        if (cachedProjectData) {
          setProjectData(cachedProjectData);
          if (cachedProjectData.github_url) setGithubCreated(true);
        }

        const cachedStep = loadFromCache<FlowStep>('currentStep');
        if (cachedStep) setCurrentStep(cachedStep);

        // Fetch trend from API
        let foundTrend: Trend | null = null;
        try {
          const trendsRes = await fetch('/api/trends');
          const trendsData = await trendsRes.json();
          foundTrend = trendsData.trends?.find((t: Trend) => t.id === trendId) || null;
        } catch {
          console.warn('[fetchData] API /api/trends failed, trying localStorage');
        }

        // Fallback: restore trend from localStorage (home page cache)
        if (!foundTrend) {
          try {
            const cachedTrends = localStorage.getItem('th_trends');
            if (cachedTrends) {
              const parsed = JSON.parse(cachedTrends);
              foundTrend = parsed.trends?.find((t: Trend) => t.id === trendId) || null;
            }
          } catch { /* ignore */ }
        }

        // Fallback: restore from favorites
        if (!foundTrend) {
          try {
            const favData = localStorage.getItem('trendhunter_favorites_data');
            if (favData) {
              const favTrends = JSON.parse(favData);
              foundTrend = favTrends.find((t: Trend) => t.id === trendId) || null;
            }
          } catch { /* ignore */ }
        }

        if (foundTrend) {
          setTrend(foundTrend);
          // Re-save to API so it persists on server side too
          try {
            await fetch('/api/trends', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(foundTrend),
            });
          } catch { /* ignore */ }
        }

        // Fetch analysis if exists (обновляем кеш если есть серверные данные)
        const analysisRes = await fetch('/api/trends/analyze');
        const analysisData = await analysisRes.json();
        if (analysisData.analyses?.[trendId]) {
          setAnalysis(analysisData.analyses[trendId]);
        }

        // Check if favorite
        const favorites = JSON.parse(localStorage.getItem('trendhunter_favorites') || '[]');
        setIsFavorite(favorites.includes(trendId));

        // Загружаем существующий проект из localStorage (если есть и не восстановлен из кеша)
        if (!cachedProjectData) {
          try {
            const storedProjects = localStorage.getItem('trendhunter_projects');
            if (storedProjects) {
              const projects = JSON.parse(storedProjects);
              const existingProject = projects.find((p: { trend_id: string }) => p.trend_id === trendId);
              if (existingProject) {
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
        }

        // Check GitHub and Vercel authentication
        await checkGithubAuth();
        await checkVercelAuth();
      } catch (error) {
        console.error('Error fetching trend:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trendId, checkGithubAuth, checkVercelAuth, loadFromCache]);

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

    // Переключаемся на Evidence и запускаем ТОЛЬКО 5 блоков параллельно
    // Deep-analysis (3 AI агента) запускается ОТДЕЛЬНО пользователем после сбора Evidence
    setCurrentStep('evidence');
    console.log('[runAnalysis] Starting 5 Evidence blocks (deep-analysis will be manual)');
    await runAllEvidenceBlocks();
    setAnalyzing(false);
  };

  // Отдельный запуск Deep Analysis (3 AI агента: Оптимист, Скептик, Арбитр)
  // Вызывается вручную ПОСЛЕ сбора Evidence данных
  const runDeepAnalysis = async () => {
    if (!trend) return;
    setAnalyzing(true);

    try {
      // Передаём собранные Evidence данные как контекст для 3 агентов
      const evidencePayload = {
        problem: evidenceData.problem || undefined,
        demand: evidenceData.demand || undefined,
        sellability: evidenceData.sellability || undefined,
        occupation: evidenceData.occupation || undefined,
        economics: evidenceData.economics || undefined,
      };
      const hasEvidence = Object.values(evidencePayload).some(v => v !== undefined);

      console.log(`[runDeepAnalysis] Starting 3 AI agents with${hasEvidence ? '' : 'out'} Evidence context`);

      const response = await fetch('/api/deep-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trend.id,
          trend_title: trend.title,
          trend_category: trend.category,
          why_trending: trend.why_trending,
          source_query: trend.source_query,
          evidence_data: hasEvidence ? evidencePayload : undefined,
        }),
      });

      const data = await response.json();
      if (data.success && data.analysis) {
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

        if (data.raw_analyses) {
          setRawAnalyses({
            optimist: data.raw_analyses.optimist,
            skeptic: data.raw_analyses.skeptic,
          });
        }

        if (data.analysis.analysis_metadata) {
          setAnalysisMetadata(data.analysis.analysis_metadata);
        }
      }
    } catch (error) {
      console.error('Error running deep-analysis:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  // Запуск всех 6 Evidence блоков параллельно (новая архитектура: 6 блоков + слепые пятна)
  const runAllEvidenceBlocks = async () => {
    if (!trend) return;

    // Новые роуты (Блоки 1-6)
    const newBlockEndpoints: Record<string, string> = {
      problem: '/api/evidence/problem',
      demand: '/api/evidence/demand',
      sellability: '/api/evidence/sellability-v2',
      occupation: '/api/evidence/competition',
      economics: '/api/evidence/revenue-sizing-v2',
      tech: '/api/evidence/blind-spots-v2',
    };

    // Старые роуты (fallback — пока новые UI компоненты не готовы)
    const oldBlockEndpoints: Record<string, string> = {
      problem: '/api/evidence/real-problem',
      demand: '/api/evidence/demand-growth',
      sellability: '/api/evidence/market-sellability',
      occupation: '/api/evidence/market-occupation',
      economics: '/api/evidence/unit-economics',
      tech: '/api/evidence/tech-feasibility',
    };

    // Используем новые роуты — данные сохраняются в Supabase для синтеза
    const blockEndpoints = newBlockEndpoints;

    const blocks = Object.keys(blockEndpoints) as EvidenceSubTab[];

    // Установить loading для всех блоков
    const loadingState: Record<string, boolean> = {};
    const errorState: Record<string, string> = {};
    for (const block of blocks) {
      loadingState[block] = true;
      errorState[block] = '';
    }
    setEvidenceLoading(prev => ({ ...prev, ...loadingState }));
    setEvidenceErrors(prev => ({ ...prev, ...errorState }));

    // Извлекаем niche и keywords для новых роутов
    // Fix A: source_query (английский) как основной поисковый термин, не русский title/category
    const niche = trend.source_query || trend.title;
    const keywords = analysis?.key_pain_points?.slice(0, 5) || [trend.source_query || trend.title];
    const trendId = trend.id || `trend-${Date.now()}`;

    // Хелпер для запуска одного блока
    const runBlock = async (block: EvidenceSubTab) => {
      try {
        const res = await fetch(blockEndpoints[block], {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trend_id: trendId,
            niche,
            keywords,
            relevant_subreddits: trend.relevant_subreddits,
            competitors: competition?.competitors?.map(c => c.name) || [],
          }),
        });

        const data = await res.json();
        if (data.success) {
          // Адаптируем только public данные — premium НИКОГДА не приходит с сервера
          // Premium данные получаются через /api/evidence/unlock после оплаты
          const adapted = adaptBlockData(block, data.public);
          adapted._has_premium = !!data.has_premium;
          adapted._is_unlocked = !!unlockedBlocks[block];
          adapted._raw_public = data.public; // сохраняем для мержа при unlock
          setEvidenceData(prev => ({ ...prev, [block]: adapted }));

          // Intelligence Layer — вызываем Sonnet анализ после Block 1 и Block 2
          // Ждём 1.5с чтобы Supabase upsert гарантированно закоммитился
          if (block === 'problem') {
            (async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const intelRes = await fetch(`/api/evidence/problem/analyze?trend_id=${encodeURIComponent(trendId)}`);
                const intel = await intelRes.json();
                if (intel.data && !intel.fallback) {
                  setEvidenceData(prev => ({
                    ...prev,
                    problem: { ...(prev.problem || {}), intelligence: intel.data },
                  }));
                }
              } catch (e) {
                console.error('[Intelligence Layer Block 1] ❌ Fetch failed:', e);
              }
            })();
          }
          if (block === 'demand') {
            (async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const intelRes = await fetch(`/api/evidence/demand/analyze?trend_id=${encodeURIComponent(trendId)}`);
                const intel = await intelRes.json();
                if (intel.data && !intel.fallback) {
                  setEvidenceData(prev => ({
                    ...prev,
                    demand: { ...(prev.demand || {}), intelligence: intel.data },
                  }));
                }
              } catch (e) {
                console.error('[Intelligence Layer Block 2] ❌ Fetch failed:', e);
              }
            })();
          }
          if (block === 'sellability') {
            (async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const intelRes = await fetch(`/api/evidence/sellability/analyze?trend_id=${encodeURIComponent(trendId)}&niche=${encodeURIComponent(niche)}`);
                const intel = await intelRes.json();
                if (intel.data && !intel.fallback) {
                  setEvidenceData(prev => ({
                    ...prev,
                    sellability: { ...(prev.sellability || {}), intelligence: intel.data },
                  }));
                }
              } catch (e) {
                console.error('[Intelligence Layer Block 3] ❌ Fetch failed:', e);
              }
            })();
          }
          if (block === 'occupation') {
            (async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const intelRes = await fetch(`/api/evidence/competition/analyze?trend_id=${encodeURIComponent(trendId)}&niche=${encodeURIComponent(niche)}`);
                const intel = await intelRes.json();
                if (intel.data && !intel.fallback) {
                  setEvidenceData(prev => ({
                    ...prev,
                    occupation: { ...(prev.occupation || {}), intelligence: intel.data },
                  }));
                }
              } catch (e) {
                console.error('[Intelligence Layer Block 4] ❌ Fetch failed:', e);
              }
            })();
          }
          if (block === 'economics') {
            (async () => {
              try {
                await new Promise(resolve => setTimeout(resolve, 1500));
                const intelRes = await fetch(`/api/evidence/revenue-sizing-v2/narrative?trend_id=${encodeURIComponent(trendId)}`);
                const intel = await intelRes.json();
                if (intel.data) {
                  setEvidenceData(prev => ({
                    ...prev,
                    economics: { ...(prev.economics || {}), intelligence_output: intel.data },
                  }));
                }
              } catch (e) {
                console.error('[Intelligence Layer Block 5] ❌ Fetch failed:', e);
              }
            })();
          }
        } else {
          setEvidenceErrors(prev => ({ ...prev, [block]: data.error || 'Error' }));
        }
      } catch (e) {
        setEvidenceErrors(prev => ({ ...prev, [block]: (e as Error).message }));
      } finally {
        setEvidenceLoading(prev => ({ ...prev, [block]: false }));
      }
    };

    // Функция разблокировки premium данных блока
    // (вызывается из UI при клике на "Разблокировать")

    // Волновое выполнение — блоки зависят друг от друга:
    // Wave 1: problem (блок 1) + demand (блок 2) — без зависимостей
    // Wave 2: occupation (блок 4) — зависит от 1+2
    // Wave 3: sellability (блок 3) — зависит от блока 4 (реальные цены конкурентов)
    // Wave 4: economics (блок 5) — зависит от 2,3,4
    // Wave 5: tech/blind-spots (блок 6) — зависит от 1-5
    await Promise.allSettled([runBlock('problem'), runBlock('demand')]);
    await runBlock('occupation');
    await runBlock('sellability');
    await runBlock('economics');
    await runBlock('tech');
  };

  // Стоимость разблокировки premium данных по блокам
  const BLOCK_COSTS: Record<string, number> = {
    problem: 5,
    demand: 5,
    sellability: 5,
    occupation: 8,
    economics: 8,
    tech: 5,
  };

  // Разблокировать premium данные блока за монеты
  // Premium данные получаются с сервера (из Supabase) — НИКОГДА не хранятся на клиенте до оплаты
  const unlockBlock = async (block: string) => {
    const cost = BLOCK_COSTS[block] || 5;
    if ((coinBalance ?? 0) < cost) return;

    try {
      // Единый эндпоинт: списывает монеты + возвращает premium из Supabase
      const res = await fetch('/api/evidence/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trend?.id,
          block,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error('Unlock failed:', data.error);
        return;
      }

      const data = await res.json();
      if (data.new_balance !== null) {
        setCoinBalance(data.new_balance);
      }

      // Мержим текущие public данные + полученные premium и переадаптируем
      setUnlockedBlocks(prev => ({ ...prev, [block]: true }));
      const currentPublic = evidenceData[block]?._raw_public || {};
      const combined = { ...currentPublic, ...data.premium };
      const adapted = adaptBlockData(block as any, combined);
      adapted._has_premium = true;
      adapted._is_unlocked = true;
      setEvidenceData(prev => ({ ...prev, [block]: adapted }));
    } catch (e) {
      console.error('Unlock error:', e);
    }
  };

  // Generate Action Plan from collected Evidence data
  const generateActionPlan = async () => {
    if (!trend) return;
    setActionPlanLoading(true);
    setActionPlanError('');

    try {
      const response = await fetch('/api/action-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trend.source_query || trend.title,
          evidenceData: {
            problem: evidenceData.problem || null,
            demand: evidenceData.demand || null,
            sellability: evidenceData.sellability || null,
            occupation: evidenceData.occupation || null,
            economics: evidenceData.economics || null,
          },
          competition: competition || null,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setActionPlanData(data.data);
      } else {
        setActionPlanError(data.error || 'Error generating action plan');
      }
    } catch (e) {
      setActionPlanError((e as Error).message);
    } finally {
      setActionPlanLoading(false);
    }
  };

  const generateDifferentiation = async () => {
    if (!trend) return;
    setDifferentiationLoading(true);
    setDifferentiationError('');

    try {
      const response = await fetch('/api/differentiation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trend.source_query || trend.title,
          evidenceData: {
            occupation: evidenceData.occupation || null,
            problem: evidenceData.problem || null,
            sellability: evidenceData.sellability || null,
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setDifferentiationData(data.data);
      } else {
        setDifferentiationError(data.error || 'Error generating differentiation');
      }
    } catch (e) {
      setDifferentiationError((e as Error).message);
    } finally {
      setDifferentiationLoading(false);
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
          query: trend.source_query || trend.title,
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
        // Competition tab removed - staying on current step

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


  // Fetch Product Specification (AI гипотезы о продукте) - вызывается перед созданием проекта
  const fetchProductSpec = async (): Promise<ProductSpecification | null> => {
    if (!trend || !analysis?.main_pain) {
      setProductSpecError(language === 'ru' ? 'Необходим анализ болей перед созданием спецификации' : 'Pain analysis required before creating specification');
      return null;
    }

    // Если уже есть - возвращаем
    if (productSpec) return productSpec;

    setLoadingProductSpec(true);
    setProductSpecError(null);

    try {
      const context = buildAnalysisContext();

      // Get design analysis from occupation evidence (runs in background)
      const designAnalysis = evidenceData.occupation?.design_analysis || null;

      // Build evidence object from collected data
      const evidence = {
        // Block 1: Real Problem - complaints from forums
        complaints: evidenceData.problem?.who_hurts?.complaints || [],
        // Block 4: Market Occupation - competitor issues
        negative_reviews: evidenceData.occupation?.negative_reviews || [],
        unmet_needs: evidenceData.occupation?.unmet_needs || [],
        // Pricing data from real problem block
        pricing_data: evidenceData.problem?.willingness_to_pay?.pricing_data || [],
        // AI Synthesis from deep analysis (3 agents debate result)
        ai_synthesis: analysis?.main_pain ? {
          consensus: analysis.main_pain,
          key_insights: analysis.key_pain_points || [],
        } : undefined,

        // Block 2: Demand Growth — рост спроса, коммерческий интерес, новые игроки
        demand_growth: evidenceData.demand ? {
          growth_rate_12m: evidenceData.demand.growing_or_dying?.trends_12m?.growth_rate ?? null,
          growth_rate_3m: evidenceData.demand.growing_or_dying?.trends_3m?.growth_rate ?? null,
          stability_score: evidenceData.demand.hype_or_stable?.stability_score?.value ?? null,
          search_intent: evidenceData.demand.search_intent || null,
          new_players_count: evidenceData.demand.new_players?.new_entrants_count ?? null,
          geo_top_regions: evidenceData.demand.geo_breakdown?.slice(0, 5) || [],
        } : undefined,

        // Block 3: Market Sellability — сегмент, медианная цена, цикл продаж
        sellability: evidenceData.sellability ? {
          market_segment: evidenceData.sellability.market_segment?.segment_type || null,
          segment_confidence: evidenceData.sellability.market_segment?.confidence ?? null,
          median_price: evidenceData.sellability.average_ticket?.median_price ?? null,
          competitor_prices: evidenceData.sellability.average_ticket?.competitor_prices?.slice(0, 6)?.map((p: any) => ({
            competitor: p.competitor,
            price: p.price,
            plan_type: p.plan_type || 'unknown',
          })) || [],
          sales_cycle: evidenceData.sellability.sales_cycle?.complexity || null,
        } : undefined,

        // Block 5: Unit Economics — CAC, LTV, бизнес-модель
        economics: evidenceData.economics ? {
          estimated_cac: evidenceData.economics.cac?.estimated_cac?.value ?? null,
          ltv_cac_ratio: evidenceData.economics.ltv_cac_ratio?.value ?? null,
          business_model: evidenceData.economics.repeat_sales?.business_model || null,
          market_size_revenue: evidenceData.economics.market_size_indicators?.total_market_revenue ?? null,
          scalability_score: evidenceData.economics.scalability?.scalability_score?.value ?? null,
        } : undefined,

        // Block 6: Tech Feasibility — сложность, стек, регуляторика
        tech_feasibility: evidenceData.tech ? {
          complexity_level: evidenceData.tech.complexity?.level || null,
          complexity_score: evidenceData.tech.complexity?.score ?? null,
          stack_recommendations: evidenceData.tech.stack_recommendations || null,
          regulatory_blockers: evidenceData.tech.regulatory?.has_blockers || false,
          regulatory_checks: evidenceData.tech.regulatory?.checks?.filter((r: any) => r.applies) || [],
          mvp_weeks: evidenceData.tech.mvp_timeline?.weeks ?? null,
        } : undefined,
      };

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
          design_analysis: designAnalysis, // Pass design data from background analysis
          evidence, // NEW: Pass Evidence data for contextual feature extraction
          differentiation: differentiationData || null, // Differentiation strategy (USP, Blue Ocean, positioning)
        }),
      });

      const data = await response.json();

      if (data.success && data.product_spec) {
        setProductSpec(data.product_spec);
        console.log('[ProductSpec] Generated:', data.metadata);
        console.log('[ProductSpec] Full spec:', data.product_spec);
        console.log('[ProductSpec] derived_features:', data.product_spec.derived_features);
        return data.product_spec;
      } else {
        setProductSpecError(data.error || (language === 'ru' ? 'Не удалось создать спецификацию' : 'Failed to create specification'));
        return null;
      }
    } catch (error) {
      console.error('Error fetching product spec:', error);
      setProductSpecError(language === 'ru' ? 'Ошибка при создании спецификации продукта' : 'Error creating product specification');
      return null;
    } finally {
      setLoadingProductSpec(false);
    }
  };

  // Fetch Marketing Plan — вызывается после генерации проекта
  const fetchMarketingPlan = async () => {
    if (!trend || marketingPlan) return;
    setLoadingMarketingPlan(true);
    setMarketingPlanError(null);

    try {
      const response = await fetch('/api/marketing-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_title: trend.title,
          trend_category: trend.category,
          evidence: {
            complaints: evidenceData.problem?.who_hurts?.complaints || [],
            negative_reviews: evidenceData.occupation?.negative_reviews || [],
            unmet_needs: evidenceData.occupation?.unmet_needs || [],
            pricing_data: evidenceData.problem?.willingness_to_pay?.pricing_data || [],
            demand_growth: evidenceData.demand ? {
              growth_rate_12m: evidenceData.demand.growing_or_dying?.trends_12m?.growth_rate ?? null,
              search_intent: evidenceData.demand.search_intent || null,
              new_players_count: evidenceData.demand.new_players?.new_entrants_count ?? null,
            } : undefined,
            sellability: evidenceData.sellability ? {
              market_segment: evidenceData.sellability.market_segment?.segment_type || null,
              median_price: evidenceData.sellability.average_ticket?.median_price ?? null,
              competitor_prices: evidenceData.sellability.average_ticket?.competitor_prices?.slice(0, 6)?.map((p: any) => ({
                competitor: p.competitor,
                price: p.price,
                plan_type: p.plan_type || 'unknown',
              })) || [],
              sales_cycle: evidenceData.sellability.sales_cycle?.complexity || null,
            } : undefined,
            economics: evidenceData.economics ? {
              estimated_cac: evidenceData.economics.cac?.estimated_cac?.value ?? null,
              ltv_cac_ratio: evidenceData.economics.ltv_cac_ratio?.value ?? null,
              business_model: evidenceData.economics.repeat_sales?.business_model || null,
            } : undefined,
          },
          analysis: analysis ? {
            main_pain: analysis.main_pain,
            key_pain_points: analysis.key_pain_points || [],
            target_audience: analysis.target_audience,
          } : undefined,
          product_spec: productSpec ? {
            user_output: productSpec.user_output,
            monetization: productSpec.monetization,
            derived_features: productSpec.derived_features,
          } : undefined,
          differentiation: differentiationData || undefined,
          project_name: projectData?.project_name,
          project_url: projectData?.vercel_url || vercelUrl || undefined,
        }),
      });

      const data = await response.json();

      if (data.success && data.marketing_plan) {
        setMarketingPlan(data.marketing_plan);
        console.log('[MarketingPlan] Generated:', data.metadata);
      } else {
        setMarketingPlanError(data.error || (language === 'ru' ? 'Не удалось создать маркетинговый план' : 'Failed to create marketing plan'));
      }
    } catch (error) {
      console.error('Error fetching marketing plan:', error);
      setMarketingPlanError(language === 'ru' ? 'Ошибка при создании маркетингового плана' : 'Error creating marketing plan');
    } finally {
      setLoadingMarketingPlan(false);
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
          niche: trend.source_query || trend.title,
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

  // Автоматическое создание проекта на основе ProductSpec
  // META агент сам определяет тип проекта из анализа болей и контекста
  const handleCreateProjectAuto = async (withGithub: boolean) => {
    if (!trend || loadingProject) return;

    // Получаем ProductSpec если ещё нет — он определит оптимальный тип
    let spec = productSpec;
    if (!spec) {
      console.log('[handleCreateProjectAuto] Fetching ProductSpec to determine MVP type...');
      spec = await fetchProductSpec();
    }

    // Маппинг generation_approach → MVPType
    // META агент анализирует боли и выбирает подход
    const approachToMvpType: Record<string, MVPType> = {
      'ai-tool': 'ai-tool',
      'calculator': 'calculator',
      'dashboard': 'dashboard',
      'automation': 'ai-tool',      // AI automation → AI tool
      'marketplace': 'dashboard',    // marketplace → dashboard-like
      'content-platform': 'landing-waitlist',
    };

    const mvpType = spec?.generation_approach
      ? approachToMvpType[spec.generation_approach] || 'ai-tool'
      : 'ai-tool'; // fallback

    console.log(`[handleCreateProjectAuto] META agent chose: ${spec?.generation_approach} → MVP type: ${mvpType}`);
    console.log(`[handleCreateProjectAuto] derived_features: ${spec?.derived_features?.length || 0}`);

    setSelectedMVPType(mvpType);
    createProject(withGithub, mvpType);
  };

  // Создание проекта через META-агент
  const createProject = async (createGithubRepo = false, mvpType?: MVPType) => {
    if (!trend || loadingProject) return;
    setLoadingProject(true);
    setProjectError(null);
    setProjectGenStep(0);
    setProjectGenStartTime(Date.now());

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

        // Если генерация кода частично провалилась — показываем предупреждение
        if (data.data.code_generation_error) {
          setCodeGenerationError(
            language === 'ru'
              ? `Генерация кода не удалась: ${data.data.code_generation_error}. Репозиторий создан с минимальным шаблоном.`
              : `Code generation failed: ${data.data.code_generation_error}. Repository created with minimal template.`
          );
        }

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
        setProjectError(data.error || (language === 'ru' ? 'Не удалось создать проект' : 'Failed to create project'));
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setProjectError(language === 'ru' ? 'Ошибка при создании проекта' : 'Error creating project');
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
        setProjectError(language === 'ru' ? 'Не удалось создать репозиторий. Проверьте авторизацию в GitHub.' : 'Failed to create repository. Check your GitHub authorization.');
      }
    } catch (error) {
      console.error('Error creating GitHub repo:', error);
      setProjectError(language === 'ru' ? 'Ошибка при создании репозитория' : 'Error creating repository');
    } finally {
      setCreatingGithubRepo(false);
    }
  };

  // Функция сброса проекта (очистка localStorage)
  const resetProject = () => {
    if (!trend?.id) return;

    const confirmMessage = language === 'ru'
      ? 'Вы уверены, что хотите сбросить проект?\n\nЭто удалит данные проекта из браузера и позволит запустить анализ заново.\nGitHub репозиторий НЕ будет удалён автоматически.'
      : 'Are you sure you want to reset the project?\n\nThis will delete project data from browser and allow you to run analysis again.\nGitHub repository will NOT be deleted automatically.';

    const confirmed = window.confirm(confirmMessage);

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
      setProjectError(language === 'ru' ? 'Ошибка при сбросе проекта' : 'Error resetting project');
    }
  };

  // Генерация рабочего кода через Claude API
  const generateCode = async () => {
    if (!projectData || generatingCode) return;
    setGeneratingCode(true);
    setCodeGenerationError(null);

    try {
      // Формируем спецификацию для Claude
      const spec = {
        project_name: projectData.project_name,
        one_liner: projectData.one_liner || '',
        problem_statement: projectData.problem_statement || '',
        solution_overview: projectData.solution_overview || '',
        target_audience: analysis?.target_audience?.segments?.[0]?.name || '',
        main_pain: analysis?.main_pain || projectData.problem_statement || '',
        mvp_specification: projectData.mvp_specification,
        // NEW: Pass design system from product spec
        design_system: productSpec?.design_system || undefined,
        // NEW: Pass derived features for contextual code generation
        derived_features: productSpec?.derived_features || undefined,
      };

      const genMode = productSpec ? 'blocks' : 'claude';
      console.log(`[GenerateCode] Mode: ${genMode}, productSpec available: ${!!productSpec}`);
      console.log('[GenerateCode] Spec being sent:', spec);
      console.log('[GenerateCode] derived_features:', spec.derived_features);
      console.log('[GenerateCode] design_system:', spec.design_system);

      const response = await fetch('/api/generate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec,
          mode: productSpec ? 'blocks' : 'claude',
          product_spec: productSpec || undefined,
          github_repo: projectData.github_url, // Если есть - добавляем файлы туда
          auto_deploy: autoDeploy && isVercelAuthenticated,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setGeneratedCodeFiles(data.files_list || []);

        // Обновляем URL'ы если были созданы
        if (data.github_url && !projectData.github_url) {
          setProjectData(prev => prev ? { ...prev, github_url: data.github_url } : null);
          setGithubCreated(true);
        }
        if (data.vercel_url) {
          setVercelUrl(data.vercel_url);
          setVercelDeployed(true);
        }

        // Показываем успех
        const modeLabel = data.mode === 'blocks' ? 'Block Assembler' : 'Claude Pipeline';
        const blocksInfo = data.blocks_used ? `\nBlocks: ${data.blocks_used.length}, Claude calls: ${data.claude_calls || 0}` : '';
        alert(language === 'ru'
          ? `✅ Код сгенерирован! ${data.files_generated} файлов (${modeLabel}).${blocksInfo}${data.github_url ? `\n\nGitHub: ${data.github_url}` : ''}${data.vercel_url ? `\nVercel: ${data.vercel_url}` : ''}`
          : `✅ Code generated! ${data.files_generated} files (${modeLabel}).${blocksInfo}${data.github_url ? `\n\nGitHub: ${data.github_url}` : ''}${data.vercel_url ? `\nVercel: ${data.vercel_url}` : ''}`
        );
      } else {
        setCodeGenerationError(data.error || (language === 'ru' ? 'Не удалось сгенерировать код' : 'Failed to generate code'));
      }
    } catch (error) {
      console.error('Error generating code:', error);
      setCodeGenerationError(language === 'ru' ? 'Ошибка при генерации кода' : 'Error generating code');
    } finally {
      setGeneratingCode(false);
    }
  };

  // Генерация маркетинговой стратегии на основе бюджета
  const generateMarketingStrategy = async () => {
    if (!marketingBudget || !projectData || loadingMarketing) return;

    setLoadingMarketing(true);
    try {
      const response = await fetch('/api/marketing-strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget: parseInt(marketingBudget) || 0,
          project_name: projectData.project_name,
          target_audience: analysis?.target_audience?.segments?.[0]?.name || '',
          segments: analysis?.target_audience?.segments || [],
          main_pain: analysis?.main_pain || '',
          competitors: competition?.competitors?.slice(0, 3) || [],
        }),
      });

      const data = await response.json();
      if (data.success && data.strategy) {
        setMarketingStrategy(data.strategy);
      }
    } catch (error) {
      console.error('Error generating marketing strategy:', error);
    } finally {
      setLoadingMarketing(false);
    }
  };

  // Генерация цветовой темы на основе стиля
  const generateTheme = async (styleInput: string) => {
    if (!styleInput || loadingTheme) return;

    setLoadingTheme(true);
    try {
      const response = await fetch('/api/generate-theme', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          style: styleInput,
          project_name: projectData?.project_name || trend?.title || 'MVP Project',
          target_audience: analysis?.target_audience?.segments?.[0]?.name || '',
        }),
      });

      const data = await response.json();
      if (data.success && data.theme) {
        setGeneratedTheme(data.theme);
      }
    } catch (error) {
      console.error('Error generating theme:', error);
    } finally {
      setLoadingTheme(false);
    }
  };

  // Auto-fetch data when switching to relevant tabs/subtabs
  useEffect(() => {
    // Business subtabs
    if (currentStep === 'business') {
      if (businessSubTab === 'venture' && !ventureData && !loadingVenture) {
        fetchVentureData();
      } else if (businessSubTab === 'leads' && !leadsData && !loadingLeads && analysis?.main_pain) {
        fetchLeads();
      }
    }
    // Action Plan auto-fetch: generate plan when tab clicked and there is evidence data
    if (currentStep === 'action-plan' && !actionPlanData && !actionPlanLoading) {
      const hasEvidence = Object.values(evidenceData).filter(v => v).length >= 2;
      if (hasEvidence) {
        generateActionPlan();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, businessSubTab]);

  // Оптимизированный flow: 4 основных шага
  const flowSteps = [
    { id: 'overview', label: t.trendDetail.tabs.overview, icon: '📊', description: language === 'ru' ? 'Обзор тренда' : 'Trend Overview' },
    { id: 'evidence', label: language === 'ru' ? 'Исследование' : 'Research', icon: '🔎', description: language === 'ru' ? '5 блоков: проблема, спрос, продаваемость, конкуренция, экономика' : '5 blocks: problem, demand, sellability, competition, economics' },
    { id: 'action-plan', label: language === 'ru' ? 'Стратегия' : 'Strategy', icon: '📋', description: language === 'ru' ? 'GO/NO GO вердикт, финансы, GTM план' : 'GO/NO GO verdict, financials, GTM plan' },
    { id: 'monitoring', label: language === 'ru' ? 'Мониторинг' : 'Monitoring', icon: '📡', description: language === 'ru' ? 'Отслеживание трендов, конкурентов и цен' : 'Track trends, competitors and prices' },
    { id: 'business', label: language === 'ru' ? 'Бизнес' : 'Business', icon: '💼', description: language === 'ru' ? 'Инвестиции и клиенты' : 'Venture & Leads' },
    { id: 'project', label: t.trendDetail.tabs.project, icon: '🚀', description: language === 'ru' ? 'Создать проект' : 'Create Project' },
  ];

  // Подразделы для Business
  const businessSubTabs = [
    { id: 'venture', label: t.trendDetail.tabs.venture, icon: '💰' },
    { id: 'leads', label: t.trendDetail.tabs.leads, icon: '👥' },
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
          <div className="flex items-center justify-between">
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
            <LanguageSwitcher />
          </div>
        </div>

        {/* Mobile Flow Steps - visible only on small screens */}
        <div className="lg:hidden px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {flowSteps.map((step) => {
              const isActive = step.id === currentStep;
              const stepStatus = getStepStatus(step.id);
              const isClickable = step.id === 'overview' ||
                step.id === 'evidence' ||
                step.id === 'action-plan' ||
                step.id === 'business' ||
                step.id === 'monitoring' ||
                (step.id === 'project' && !!analysis);

              return (
                <button
                  key={step.id}
                  onClick={() => isClickable && setCurrentStep(step.id as FlowStep)}
                  disabled={!isClickable}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap text-xs ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : stepStatus === 'completed'
                      ? 'bg-zinc-800 text-white'
                      : isClickable
                      ? 'bg-zinc-800/50 text-zinc-400'
                      : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <span>{stepStatus === 'completed' && !isActive ? '✓' : step.icon}</span>
                  <span className="font-medium">{step.label}</span>
                </button>
              );
            })}
          </div>
          {/* Mobile sub-tabs for evidence */}
          {currentStep === 'evidence' && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/50 overflow-x-auto scrollbar-hide">
              {[
                { id: 'problem', label: language === 'ru' ? 'Проблема' : 'Problem', icon: '🎯' },
                { id: 'demand', label: language === 'ru' ? 'Спрос' : 'Demand', icon: '📈' },
                { id: 'sellability', label: language === 'ru' ? 'Продажи' : 'Sales', icon: '💳' },
                { id: 'occupation', label: language === 'ru' ? 'Рынок' : 'Market', icon: '🏟️' },
                { id: 'economics', label: language === 'ru' ? 'Эконом.' : 'Econ.', icon: '📊' },
                { id: 'tech', label: language === 'ru' ? 'Слепые пятна' : 'Blind Spots', icon: '🔍' },
                { id: 'analysis', label: 'AI', icon: '🧠' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setEvidenceSubTab(tab.id as EvidenceSubTab)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-all whitespace-nowrap ${
                    evidenceSubTab === tab.id
                      ? 'bg-green-500/20 text-green-300'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {evidenceLoading[tab.id] && (
                    <span className="w-2 h-2 border border-green-400 border-t-transparent rounded-full animate-spin" />
                  )}
                  {!evidenceLoading[tab.id] && evidenceData[tab.id] && (
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                  )}
                </button>
              ))}
            </div>
          )}
          {/* Mobile sub-tabs for action-plan */}
          {currentStep === 'action-plan' && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/50 overflow-x-auto scrollbar-hide">
              {[
                { id: 'plan', label: language === 'ru' ? 'План' : 'Plan', icon: '📋' },
                { id: 'differentiation', label: language === 'ru' ? 'Диф.' : 'Diff.', icon: '🎯' },
                { id: 'calculator', label: language === 'ru' ? 'Калк.' : 'Calc.', icon: '🧮' },
                { id: 'scenarios', label: language === 'ru' ? 'Сцен.' : 'Scen.', icon: '🔀' },
                { id: 'survey', label: language === 'ru' ? 'Опрос' : 'Survey', icon: '📝' },
                { id: 'gtm', label: 'GTM', icon: '🚀' },
                { id: 'report', label: language === 'ru' ? 'Отчёт' : 'Report', icon: '📄' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActionPlanSubTab(tab.id as ActionPlanSubTab)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-all whitespace-nowrap ${
                    actionPlanSubTab === tab.id
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}
          {/* Mobile sub-tabs for business */}
          {currentStep === 'business' && (
            <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-zinc-800/50 overflow-x-auto scrollbar-hide">
              {businessSubTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBusinessSubTab(tab.id as BusinessSubTab)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-all whitespace-nowrap ${
                    businessSubTab === tab.id
                      ? 'bg-indigo-500/20 text-indigo-300'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dashboard: Sidebar + Content */}
        <div className="flex flex-1 min-h-0">
          {/* Desktop Sidebar */}
          <DashboardSidebar
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
            evidenceSubTab={evidenceSubTab}
            setEvidenceSubTab={setEvidenceSubTab}
            actionPlanSubTab={actionPlanSubTab}
            setActionPlanSubTab={setActionPlanSubTab}
            businessSubTab={businessSubTab}
            setBusinessSubTab={setBusinessSubTab}
            getStepStatus={getStepStatus}
            evidenceProgress={evidenceProgress}
            evidenceData={evidenceData}
            evidenceLoading={evidenceLoading}
            evidenceErrors={evidenceErrors}
            analysis={analysis}
            language={language}
            collapsed={dashboardCollapsed}
            onToggleCollapse={() => setDashboardCollapsed(!dashboardCollapsed)}
          />

          {/* Content */}
          <div className="flex-1 min-w-0 p-6">
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
              <p className="text-zinc-400 max-w-2xl">
                {translatingTrend && (
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                )}
                {displayWhyTrending}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Баланс монет */}
              {coinBalance !== null && (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                  <span className="text-amber-400 text-lg font-bold">{coinBalance}</span>
                  <span className="text-amber-400/60 text-xs">{language === 'ru' ? 'монет' : 'coins'}</span>
                </div>
              )}
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
                <div className="text-3xl font-bold text-emerald-400">+{trend.growth_rate}%</div>
                <div className="text-xs text-zinc-500">{t.trendDetail.overview.growth}</div>
              </div>
            </div>
          </div>

          {/* Evidence Content */}
          {currentStep === 'evidence' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {language === 'ru' ? 'Evidence-Based анализ' : 'Evidence-Based Analysis'}
                  </h2>
                  <p className="text-zinc-400 text-sm mt-1">
                    {language === 'ru'
                      ? 'Все данные из реальных источников. Каждый score рассчитан по формуле.'
                      : 'All data from real sources. Every score calculated by formula.'}
                  </p>
                </div>
                <button
                  onClick={() => runAllEvidenceBlocks()}
                  disabled={Object.values(evidenceLoading).some(v => v)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {Object.values(evidenceLoading).some(v => v) && (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  {language === 'ru' ? 'Анализировать все' : 'Analyze All'}
                </button>
              </div>

              {/* Evidence block content */}
              {evidenceSubTab === 'problem' && (
                <PremiumOverlay
                  isLocked={!!(evidenceData.problem?._has_premium && !evidenceData.problem?._is_unlocked)}
                  cost={BLOCK_COSTS.problem}
                  coinBalance={coinBalance}
                  onUnlock={() => unlockBlock('problem')}
                  label="Цитаты + контекст платящих"
                >
                  <RealProblemBlock
                    data={evidenceData.problem}
                    loading={evidenceLoading.problem}
                    error={evidenceErrors.problem}
                  />
                </PremiumOverlay>
              )}
              {evidenceSubTab === 'demand' && (
                <PremiumOverlay
                  isLocked={!!(evidenceData.demand?._has_premium && !evidenceData.demand?._is_unlocked)}
                  cost={BLOCK_COSTS.demand}
                  coinBalance={coinBalance}
                  onUnlock={() => unlockBlock('demand')}
                  label="Детали интента + ключевые слова"
                >
                  <DemandBlock
                    data={evidenceData.demand}
                    loading={evidenceLoading.demand}
                    error={evidenceErrors.demand}
                  />
                </PremiumOverlay>
              )}
              {evidenceSubTab === 'sellability' && (
                <PremiumOverlay
                  isLocked={!!(evidenceData.sellability?._has_premium && !evidenceData.sellability?._is_unlocked)}
                  cost={BLOCK_COSTS.sellability}
                  coinBalance={coinBalance}
                  onUnlock={() => unlockBlock('sellability')}
                  label="Барьеры + каналы продаж"
                >
                  <SellabilityBlock
                    data={evidenceData.sellability}
                    loading={evidenceLoading.sellability}
                    error={evidenceErrors.sellability}
                    trendTitle={trend?.title}
                  />
                </PremiumOverlay>
              )}
              {evidenceSubTab === 'occupation' && (
                <PremiumOverlay
                  isLocked={!!(evidenceData.occupation?._has_premium && !evidenceData.occupation?._is_unlocked)}
                  cost={BLOCK_COSTS.occupation}
                  coinBalance={coinBalance}
                  onUnlock={() => unlockBlock('occupation')}
                  label="Gap анализ + точка входа"
                >
                  <CompetitionBlock
                    data={evidenceData.occupation}
                    loading={evidenceLoading.occupation}
                    error={evidenceErrors.occupation}
                  />
                </PremiumOverlay>
              )}
              {evidenceSubTab === 'economics' && (
                <PremiumOverlay
                  isLocked={!!(evidenceData.economics?._has_premium && !evidenceData.economics?._is_unlocked)}
                  cost={BLOCK_COSTS.economics}
                  coinBalance={coinBalance}
                  onUnlock={() => unlockBlock('economics')}
                  label="Unit-экономика + Runway"
                >
                  <EconomicsBlock
                    data={evidenceData.economics}
                    loading={evidenceLoading.economics}
                    error={evidenceErrors.economics}
                  />
                </PremiumOverlay>
              )}
              {evidenceSubTab === 'tech' && (
                <BlindSpotsBlock
                  data={evidenceData.tech}
                  loading={evidenceLoading.tech}
                  error={evidenceErrors.tech}
                />
              )}

              {/* Banner: all data collected, suggest AI Synthesis */}
              {evidenceProgress.done === 6 && !analysis && !evidenceProgress.loading && evidenceSubTab !== 'analysis' && (
                <div className="mt-6 bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🧠</span>
                    <div>
                      <p className="text-sm font-medium text-white">{t.trendDetail.overview.allDataReady}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {language === 'ru' ? '3 AI-агента проанализируют все собранные данные' : '3 AI agents will analyze all collected data'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEvidenceSubTab('analysis')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {language === 'ru' ? 'AI Синтез →' : 'AI Synthesis →'}
                  </button>
                </div>
              )}

              {/* NextStepCard: after analysis done */}
              {analysis && (
                <div className="mt-6 bg-gradient-to-r from-indigo-500/10 to-blue-500/10 border border-indigo-500/20 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📋</span>
                    <div>
                      <p className="text-xs text-indigo-400 font-medium">{t.trendDetail.overview.nextStepHint}</p>
                      <p className="text-sm font-medium text-white">{t.trendDetail.overview.nextStepStrategy}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {language === 'ru' ? 'GO/NO GO вердикт, финансовый калькулятор, GTM план' : 'GO/NO GO verdict, financial calculator, GTM plan'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setCurrentStep('action-plan')}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    {t.trendDetail.overview.nextStepStrategy} →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Plan Content */}
          {currentStep === 'action-plan' && (
            <div className="space-y-6">
              {/* Strategy sub-tab */}
              {actionPlanSubTab === 'plan' && (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {language === 'ru' ? 'План действий' : 'Action Plan'}
                      </h2>
                      <p className="text-zinc-400 text-sm mt-1">
                        {language === 'ru'
                          ? 'Стратегия на основе собранных Evidence данных. Все рекомендации подкреплены источниками.'
                          : 'Strategy based on collected Evidence data. All recommendations backed by sources.'}
                      </p>
                    </div>
                    <button
                      onClick={() => generateActionPlan()}
                      disabled={actionPlanLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {actionPlanLoading && (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      {actionPlanData
                        ? (language === 'ru' ? 'Обновить план' : 'Refresh Plan')
                        : (language === 'ru' ? 'Сгенерировать план' : 'Generate Plan')}
                    </button>
                  </div>

                  {/* Evidence readiness indicator */}
                  {!actionPlanData && !actionPlanLoading && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                      <p className="text-sm text-zinc-400 mb-3">
                        {language === 'ru' ? 'Собранные Evidence данные:' : 'Collected Evidence data:'}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {[
                          { key: 'problem', label: language === 'ru' ? 'Проблема' : 'Problem', icon: '🎯' },
                          { key: 'demand', label: language === 'ru' ? 'Спрос' : 'Demand', icon: '📈' },
                          { key: 'sellability', label: language === 'ru' ? 'Продажи' : 'Sales', icon: '💳' },
                          { key: 'occupation', label: language === 'ru' ? 'Рынок' : 'Market', icon: '🏟️' },
                          { key: 'economics', label: language === 'ru' ? 'Экономика' : 'Economics', icon: '📊' },
                        ].map((block) => (
                          <div
                            key={block.key}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                              evidenceData[block.key]
                                ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                : 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50'
                            }`}
                          >
                            <span>{block.icon}</span>
                            <span>{block.label}</span>
                            {evidenceData[block.key] && <span className="ml-auto">✓</span>}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-zinc-500 mt-3">
                        {language === 'ru'
                          ? 'Минимум 2 блока для генерации плана. Чем больше данных — тем точнее рекомендации.'
                          : 'Minimum 2 blocks needed. More data = better recommendations.'}
                      </p>
                    </div>
                  )}

                  <ActionPlanBlock
                    data={actionPlanData}
                    loading={actionPlanLoading}
                    error={actionPlanError}
                  />
                </>
              )}

              {/* Differentiation sub-tab */}
              {actionPlanSubTab === 'differentiation' && (
                <DifferentiationBlock
                  data={differentiationData}
                  loading={differentiationLoading}
                  error={differentiationError}
                  onGenerate={generateDifferentiation}
                  hasEvidenceData={!!(evidenceData.occupation || evidenceData.problem)}
                />
              )}

              {/* Financial Calculator sub-tab */}
              {actionPlanSubTab === 'calculator' && (
                <>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {language === 'ru' ? 'Финансовый калькулятор' : 'Financial Calculator'}
                    </h2>
                    <p className="text-zinc-400 text-sm mt-1">
                      {language === 'ru'
                        ? 'Интерактивные расчёты unit-экономики. Двигайте ползунки — результат обновляется мгновенно.'
                        : 'Interactive unit economics. Adjust sliders — results update instantly.'}
                    </p>
                  </div>
                  <FinancialCalculator
                    trendId={trend.id}
                    defaults={{
                      monthlyPrice: evidenceData.sellability?.average_ticket?.median_price || undefined,
                      estimatedCac: evidenceData.economics?.cac?.estimated_cac?.value || undefined,
                      businessModel: evidenceData.economics?.repeat_sales?.business_model || undefined,
                    }}
                  />
                </>
              )}

              {/* Scenario Comparison sub-tab */}
              {actionPlanSubTab === 'scenarios' && (
                <ScenarioComparison
                  trendId={trend.id}
                  baseInputs={(() => {
                    // Try to load saved calculator inputs from localStorage
                    const storageKey = `th_calc_${trend.id}`;
                    try {
                      const saved = localStorage.getItem(storageKey);
                      if (saved) return JSON.parse(saved);
                    } catch { /* ignore */ }
                    // Fallback to defaults from Evidence
                    return {
                      monthlyPrice: evidenceData.sellability?.average_ticket?.median_price || 49,
                      annualDiscount: 20,
                      monthlyChurnRate: 5,
                      cac: evidenceData.economics?.cac?.estimated_cac?.value || 150,
                      monthlyFixedCosts: 3000,
                      initialInvestment: 10000,
                      customersMonth1: 10,
                      monthlyGrowthRate: 15,
                    };
                  })()}
                />
              )}

              {/* Survey Generator sub-tab */}
              {actionPlanSubTab === 'survey' && (
                <SurveyGenerator
                  trendTitle={trend.source_query || trend.title}
                  evidenceData={evidenceData}
                />
              )}

              {/* GTM Plan sub-tab */}
              {actionPlanSubTab === 'gtm' && (
                <GtmPlanGenerator
                  trendTitle={trend.source_query || trend.title}
                  evidenceData={evidenceData}
                />
              )}

              {/* Executive Summary sub-tab */}
              {actionPlanSubTab === 'report' && (
                <ExecutiveSummary
                  data={actionPlanData}
                  trendTitle={trend.title}
                  evidenceData={evidenceData}
                />
              )}

              {/* NextStepCard: after action plan */}
              {actionPlanData && (
                <div className="mt-6 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">📡</span>
                    <div>
                      <p className="text-xs text-emerald-400 font-medium">{t.trendDetail.overview.nextStepHint}</p>
                      <p className="text-sm font-medium text-white">
                        {language === 'ru' ? 'Мониторинг или Проект' : 'Monitoring or Project'}
                      </p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        {language === 'ru'
                          ? 'Настройте отслеживание тренда или создайте проект для запуска'
                          : 'Set up trend tracking or create a project to launch'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentStep('monitoring')}
                      className="px-3 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      📡 {t.trendDetail.overview.nextStepMonitoring}
                    </button>
                    <button
                      onClick={() => setCurrentStep('project')}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                    >
                      🚀 {t.trendDetail.overview.nextStepProject}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Monitoring Step */}
          {currentStep === 'monitoring' && (
            <MonitoringDashboard
              trendId={trend.id}
              trendTitle={trend.source_query || trend.title}
              evidenceData={evidenceData}
            />
          )}

          {/* Step Content */}
          {currentStep === 'overview' && (
            <OverviewDashboard
              evidenceData={evidenceData}
              evidenceProgress={evidenceProgress}
              analysis={analysis}
              coinBalance={coinBalance ?? 0}
              language={language as 'ru' | 'en'}
              onNavigate={(step, subTab) => {
                setCurrentStep(step as FlowStep);
                if (subTab) {
                  if (['problem', 'demand', 'sellability', 'occupation', 'economics', 'tech', 'analysis'].includes(subTab)) {
                    setEvidenceSubTab(subTab as EvidenceSubTab);
                  } else if (['plan', 'differentiation', 'calculator', 'scenarios', 'survey', 'gtm', 'landing', 'report'].includes(subTab)) {
                    setActionPlanSubTab(subTab as ActionPlanSubTab);
                  }
                }
              }}
              onRunAnalysis={runAnalysis}
              analyzing={analyzing}
            />
          )}

          {/* Evidence - Analysis subtab: No analysis yet */}
          {currentStep === 'evidence' && evidenceSubTab === 'analysis' && !analysis && (
            <SynthesisPanel
              trendId={trend?.id || ''}
              niche={trend?.category || trend?.title || ''}
              coinBalance={coinBalance}
              onBalanceUpdate={(b) => setCoinBalance(b)}
              language={language}
              trendTitle={trend?.title}
              evidenceData={evidenceData}
            />
          )}

          {/* Evidence - Analysis subtab: Has analysis */}
          {currentStep === 'evidence' && evidenceSubTab === 'analysis' && analysis && (
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
                      <EvidenceBadge type="ai_synthesis" label={language === 'ru' ? 'AI-синтез на основе Evidence' : 'AI synthesis from Evidence'} />
                      {translatingRawAnalyses && (
                        <span className="inline-block w-4 h-4 ml-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </h3>
                    <p className="text-sm text-zinc-400 mt-1">{t.trendDetail.analysis.aiDebateDescription}</p>
                  </div>

                  <div className="grid md:grid-cols-2 divide-x divide-zinc-800 relative">
                    {/* VS badge */}
                    <div className="hidden md:flex absolute left-1/2 top-6 -translate-x-1/2 z-10 w-10 h-10 rounded-full bg-zinc-700 border-2 border-zinc-600 items-center justify-center">
                      <span className="text-xs font-bold text-zinc-300">VS</span>
                    </div>
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
                        {displayOptimistPains.slice(0, 3).map((pain, i) => (
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
                        <div className="text-sm text-emerald-300">{displayOptimistConclusion}</div>
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
                        {displaySkepticPains.slice(0, 3).map((pain, i) => (
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
                        <div className="text-sm text-red-300">{displaySkepticConclusion}</div>
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
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      {t.trendDetail.analysis.arbiterVerdict}
                      <EvidenceBadge type="ai_synthesis" />
                    </h3>
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
                    {translatingAnalysis && (
                      <span className="inline-block w-3 h-3 ml-2 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </div>
                  <p className="text-xl text-white">{displayMainPain}</p>
                </div>
              </div>

              {/* Key Pain Points */}
              {displayKeyPainPoints && displayKeyPainPoints.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    {t.trendDetail.analysis.keyPainPoints}
                    {translatingAnalysis && (
                      <span className="inline-block w-3 h-3 ml-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </h3>
                  <div className="space-y-3">
                    {displayKeyPainPoints.map((pain, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-zinc-800/50 rounded-lg">
                        <span className="text-red-400">•</span>
                        <span className="text-zinc-300">{typeof pain === 'string' ? pain : (pain as { pain?: string }).pain || JSON.stringify(pain)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target Audience */}
              {displayTargetSegments && displayTargetSegments.length > 0 && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4">
                    {t.trendDetail.analysis.targetAudience}
                    {translatingAnalysis && (
                      <span className="inline-block w-3 h-3 ml-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    )}
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {displayTargetSegments.map((segment, index) => (
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

              {/* ProductSpec Status */}
              {(loadingProductSpec || productSpec) && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    {loadingProductSpec ? (
                      <>
                        <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                        <div>
                          <h3 className="text-sm font-medium text-white">
                            {language === 'ru' ? 'Генерация спецификации продукта...' : 'Generating product specification...'}
                          </h3>
                          <p className="text-xs text-zinc-500">
                            {language === 'ru' ? 'Это может занять 10-15 секунд' : 'This may take 10-15 seconds'}
                          </p>
                        </div>
                      </>
                    ) : productSpec && (
                      <>
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                          <span className="text-emerald-400">✓</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-medium text-white">
                            {language === 'ru' ? 'Спецификация продукта готова' : 'Product specification ready'}
                          </h3>
                          <p className="text-xs text-zinc-500">
                            {productSpec.generation_approach} • {productSpec.mvp_complexity}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded">
                          {language === 'ru' ? 'Готово для проекта' : 'Ready for project'}
                        </span>
                      </>
                    )}
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

          {/* Venture Tab */}
          {currentStep === 'business' && businessSubTab === 'venture' && (
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
                                  {round.round_type}
                                  {round.date && round.date !== 'DATE_UNKNOWN' && round.date !== 'Дата неизвестна' && (
                                    <span> • {round.date}</span>
                                  )}
                                  {round.investors.length > 0 && (
                                    <span> • {round.investors.join(', ')}</span>
                                  )}
                                </div>
                              </div>
                              {round.amount && round.amount !== 'Undisclosed' && (
                                <div className="text-emerald-400 font-bold text-lg">{round.amount}</div>
                              )}
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
                            <div className="flex gap-2 mt-2">
                              <a
                                href={fund.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-indigo-400 hover:text-indigo-300"
                              >
                                {t.trendDetail.venture.website}
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Market Signals */}
                  {displayMarketSignals.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>📡</span> {t.trendDetail.venture.marketSignals}
                        {translatingVenture && (
                          <span className="inline-block w-4 h-4 ml-2 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </h3>
                      <div className="space-y-2">
                        {displayMarketSignals.map((signal, index) => (
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
                    <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.venture.nextStep}</h3>
                    <p className="text-zinc-400 mb-4">
                      {t.trendDetail.venture.findLeadsDescription}
                    </p>
                    <button
                      onClick={() => setBusinessSubTab('leads')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>👥</span>
                      {language === 'ru' ? 'Найти клиентов' : 'Find Clients'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-400">
                  {language === 'ru' ? 'Не удалось загрузить венчурные данные' : 'Failed to load venture data'}
                </div>
              )}
            </div>
          )}

          {/* Leads Tab */}
          {currentStep === 'business' && businessSubTab === 'leads' && (
            <div className="space-y-6">
              {loadingLeads ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mb-4" />
                  <p className="text-zinc-400">{t.trendDetail.leads.searchingClients}</p>
                </div>
              ) : leadsData && leadsData.companies.length > 0 ? (
                <>
                  {/* Overview */}
                  <div className="bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-xl p-6">
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <span>👥</span> {t.trendDetail.leads.title}
                    </h2>
                    <p className="text-zinc-400">
                      {t.trendDetail.leads.foundCompanies} {leadsData.companies.length}, {t.trendDetail.leads.interestedInSolving} &quot;{displayMainPain || analysis?.main_pain}&quot;
                    </p>
                  </div>

                  {/* Companies List */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      {t.trendDetail.leads.companies} ({leadsData.companies.length})
                    </h3>
                    <div className="space-y-4">
                      {displayCompanies.map((company, index) => (
                        <div key={index} className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-white font-medium text-lg">{company.name}</span>
                              {company.source && (
                                <span className="px-2 py-0.5 rounded text-xs bg-zinc-500/20 text-zinc-300">
                                  {company.source.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            {company.description && (
                              <p className="text-sm text-zinc-400 mb-3">{company.description}</p>
                            )}
                            {company.pain_match && (
                              <div className="text-sm text-zinc-300 mb-3">
                                <span className="text-zinc-500">{language === 'ru' ? 'Совпадение боли:' : 'Pain match:'}</span> {company.pain_match}
                                <EvidenceBadge type="ai_synthesis" className="ml-2" />
                              </div>
                            )}
                            {company.outreach_angle && (
                              <div className="text-sm text-zinc-300 mb-3">
                                <span className="text-zinc-500">{language === 'ru' ? 'Подход:' : 'Approach:'}</span> {company.outreach_angle}
                                <EvidenceBadge type="ai_synthesis" className="ml-2" />
                              </div>
                            )}

                            {/* Links */}
                            <div className="flex flex-wrap gap-3 text-sm">
                              {company.website && (
                                <a
                                  href={company.website}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  🌐 {t.trendDetail.leads.website}
                                </a>
                              )}
                              {company.linkedin_url && (
                                <a
                                  href={company.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  💼 LinkedIn
                                </a>
                              )}
                              {company.source_url && company.source_url !== company.website && (
                                <a
                                  href={company.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                                >
                                  🔗 {language === 'ru' ? 'Источник' : 'Source'}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* LinkedIn Queries */}
                  {leadsData.linkedin_queries && leadsData.linkedin_queries.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💼</span> {t.trendDetail.leads.linkedinQueries}
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
                  {displayDirectories.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>📂</span> {t.trendDetail.leads.directories}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        {displayDirectories.map((dir, index) => (
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
                  {displaySearchTips.length > 0 && (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💡</span> {t.trendDetail.leads.searchTips}
                      </h3>
                      <div className="space-y-2">
                        {displaySearchTips.map((tip, index) => (
                          <div key={index} className="flex items-start gap-2 text-amber-300">
                            <span>•</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </>
              ) : (
                <div className="text-center py-20">
                  <p className="text-zinc-400 mb-4">
                    {!analysis?.main_pain
                      ? (language === 'ru' ? 'Сначала запустите анализ тренда для выявления болей' : 'First run trend analysis to identify pain points')
                      : (language === 'ru' ? 'Не удалось найти потенциальных клиентов' : 'Could not find potential clients')}
                  </p>
                  {!analysis?.main_pain && (
                    <button
                      onClick={() => { setCurrentStep('research'); setEvidenceSubTab('analysis'); }}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
                    >
                      {language === 'ru' ? 'Перейти к анализу' : 'Go to analysis'}
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
                      {language === 'ru' ? 'Письмо для' : 'Email for'} {selectedCompany.name}
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
                      <label className="block text-sm text-zinc-400 mb-1">{language === 'ru' ? 'Ваше имя *' : 'Your Name *'}</label>
                      <input
                        type="text"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        placeholder={language === 'ru' ? 'Иван Иванов' : 'John Doe'}
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-zinc-400 mb-1">{language === 'ru' ? 'Компания' : 'Company'}</label>
                      <input
                        type="text"
                        value={senderCompany}
                        onChange={(e) => setSenderCompany(e.target.value)}
                        className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-indigo-500"
                        placeholder={language === 'ru' ? 'Название вашей компании' : 'Your company name'}
                      />
                    </div>
                  </div>

                  {/* Tone Selection */}
                  <div>
                    <label className="block text-sm text-zinc-400 mb-2">{language === 'ru' ? 'Тон письма' : 'Email Tone'}</label>
                    <div className="flex gap-2">
                      {[
                        { id: 'formal', label: language === 'ru' ? 'Формальный' : 'Formal', icon: '👔' },
                        { id: 'professional', label: language === 'ru' ? 'Профессиональный' : 'Professional', icon: '💼' },
                        { id: 'friendly', label: language === 'ru' ? 'Дружелюбный' : 'Friendly', icon: '😊' },
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
                          <label className="text-sm text-zinc-400">{language === 'ru' ? 'Тема письма' : 'Email Subject'}</label>
                          <button
                            onClick={() => navigator.clipboard.writeText(displayEmailSubject)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            {language === 'ru' ? 'Копировать' : 'Copy'}
                          </button>
                        </div>
                        <div className="p-3 bg-zinc-800 rounded-lg text-white">
                          {displayEmailSubject}
                        </div>
                      </div>

                      {/* Body */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-sm text-zinc-400">{language === 'ru' ? 'Текст письма' : 'Email Body'}</label>
                          <button
                            onClick={() => navigator.clipboard.writeText(displayEmailBody)}
                            className="text-xs text-indigo-400 hover:text-indigo-300"
                          >
                            {language === 'ru' ? 'Копировать' : 'Copy'}
                          </button>
                        </div>
                        <div className="p-3 bg-zinc-800 rounded-lg text-zinc-300 whitespace-pre-wrap text-sm">
                          {displayEmailBody}
                        </div>
                      </div>

                      {/* Follow-up */}
                      {displayFollowUpBody && (
                        <div className="pt-4 border-t border-zinc-700">
                          <h4 className="text-sm font-medium text-white mb-3">{language === 'ru' ? 'Follow-up письмо (через 3-5 дней)' : 'Follow-up email (in 3-5 days)'}</h4>
                          <div className="mb-2">
                            <label className="text-xs text-zinc-500">{language === 'ru' ? 'Тема:' : 'Subject:'}</label>
                            <div className="p-2 bg-zinc-800/50 rounded text-zinc-300 text-sm">
                              {displayFollowUpSubject}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-zinc-500">{language === 'ru' ? 'Текст:' : 'Body:'}</label>
                            <div className="p-2 bg-zinc-800/50 rounded text-zinc-400 text-sm whitespace-pre-wrap">
                              {displayFollowUpBody}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Tips */}
                      {displayEmailTips.length > 0 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                          <div className="text-xs text-amber-400 mb-2">💡 {language === 'ru' ? 'Советы по отправке:' : 'Sending tips:'}</div>
                          <div className="space-y-1">
                            {displayEmailTips.map((tip, i) => (
                              <div key={i} className="text-sm text-amber-300">• {tip}</div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-3">
                        <a
                          href={`mailto:?subject=${encodeURIComponent(displayEmailSubject)}&body=${encodeURIComponent(displayEmailBody)}`}
                          className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-center font-medium transition-colors"
                        >
                          📧 {language === 'ru' ? 'Открыть в почте' : 'Open in Mail'}
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${language === 'ru' ? 'Тема' : 'Subject'}: ${displayEmailSubject}\n\n${displayEmailBody}`);
                          }}
                          className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg font-medium transition-colors"
                        >
                          📋 {language === 'ru' ? 'Копировать всё' : 'Copy All'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {currentStep === 'project' && (
            <div className="space-y-6">
              {/* Выбор режима: Landing Page vs Full MVP */}
              {projectMode === null && !projectData && !loadingProject && (
                <div className="space-y-6">
                  <div className="text-center mb-2">
                    <h2 className="text-2xl font-bold text-white">
                      {language === 'ru' ? 'Создать проект' : 'Create Project'}
                    </h2>
                    <p className="text-zinc-400 text-sm mt-2">
                      {language === 'ru' ? 'Выберите тип проекта для создания' : 'Choose project type to create'}
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Landing Page option */}
                    <button
                      onClick={() => setProjectMode('landing')}
                      className="text-left bg-zinc-900/50 border border-zinc-800 hover:border-indigo-500/40 rounded-xl p-6 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">🎯</span>
                        <div>
                          <h3 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">Landing Page</h3>
                          <span className="text-xs text-zinc-500">~30 сек</span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 mb-4">
                        {language === 'ru'
                          ? 'Быстрая валидация спроса: лендинг с waitlist формой, деплой на Vercel, встроенная аналитика CR%.'
                          : 'Quick demand validation: landing page with waitlist form, Vercel deploy, built-in CR% analytics.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">HTML page</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">Vercel deploy</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300">PMF validation</span>
                      </div>
                    </button>
                    {/* Full MVP option */}
                    <button
                      onClick={() => setProjectMode('full-mvp')}
                      className="text-left bg-zinc-900/50 border border-zinc-800 hover:border-purple-500/40 rounded-xl p-6 transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-3xl">💻</span>
                        <div>
                          <h3 className="text-lg font-semibold text-white group-hover:text-purple-300 transition-colors">
                            {language === 'ru' ? 'Полный MVP' : 'Full MVP'}
                          </h3>
                          <span className="text-xs text-zinc-500">~30-60 сек</span>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-400 mb-4">
                        {language === 'ru'
                          ? 'Сборка из готовых блоков: 47 модулей (auth, payments, UI, API). Уникальный дизайн из анализа конкурентов.'
                          : 'Assembled from pre-built blocks: 47 modules (auth, payments, UI, API). Unique design from competitor analysis.'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">Next.js</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">Supabase</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">Stripe</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300">GitHub</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Landing Page Mode */}
              {projectMode === 'landing' && !projectData && !loadingProject && (
                <div className="space-y-4">
                  <button
                    onClick={() => setProjectMode(null)}
                    className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    ← {language === 'ru' ? 'Назад к выбору' : 'Back to selection'}
                  </button>
                  <LandingPageGenerator
                    trendId={trend.id}
                    trendTitle={trend.source_query || trend.title}
                    evidenceData={evidenceData}
                  />
                </div>
              )}

              {/* Full MVP Mode - existing code */}
              {projectMode === 'full-mvp' && !projectData && !loadingProject && (
                <>
                  <button
                    onClick={() => setProjectMode(null)}
                    className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1"
                  >
                    ← {language === 'ru' ? 'Назад к выбору' : 'Back to selection'}
                  </button>
                  {/* META Agent Auto Mode */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🤖</span>
                        <h3 className="text-lg font-semibold text-white">
                          {language === 'ru' ? 'META Агент создаст проект' : 'META Agent will create project'}
                        </h3>
                      </div>
                      {productSpec && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-full">
                          <span className="text-indigo-400 text-sm">✨</span>
                          <span className="text-indigo-300 text-sm font-medium">
                            {productSpec.generation_approach === 'ai-tool' ? 'AI Tool' :
                             productSpec.generation_approach === 'calculator' ? 'Calculator' :
                             productSpec.generation_approach === 'dashboard' ? 'Dashboard' :
                             productSpec.generation_approach === 'automation' ? 'Automation' :
                             productSpec.generation_approach === 'marketplace' ? 'Marketplace' :
                             'Content Platform'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Объяснение автоматического режима */}
                    <div className="mb-6 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
                      <div className="flex items-start gap-3">
                        <span className="text-lg mt-0.5">💡</span>
                        <div>
                          <p className="text-sm text-indigo-300/90">
                            {language === 'ru'
                              ? 'META агент проанализировал боли пользователей и определит оптимальный тип проекта автоматически. Код будет генерироваться на основе реальных потребностей рынка.'
                              : 'META agent analyzed user pain points and will automatically determine the optimal project type. Code will be generated based on real market needs.'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Показываем derived_features если есть */}
                    {productSpec?.derived_features && productSpec.derived_features.length > 0 && (
                      <div className="mb-6 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-lg">🎯</span>
                          <span className="text-sm font-medium text-emerald-400">
                            {language === 'ru' ? `${productSpec.derived_features.length} фич из анализа болей:` : `${productSpec.derived_features.length} features from pain analysis:`}
                          </span>
                        </div>
                        <ul className="space-y-2">
                          {productSpec.derived_features.slice(0, 3).map((f, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className={`px-1.5 py-0.5 rounded text-xs ${
                                f.priority === 'must_have' ? 'bg-red-500/20 text-red-400' :
                                f.priority === 'should_have' ? 'bg-yellow-500/20 text-yellow-400' :
                                'bg-zinc-700 text-zinc-400'
                              }`}>
                                {f.priority === 'must_have' ? '!' : f.priority === 'should_have' ? '~' : '?'}
                              </span>
                              <span className="text-zinc-300">{f.feature_name}</span>
                            </li>
                          ))}
                          {productSpec.derived_features.length > 3 && (
                            <li className="text-xs text-zinc-500 pl-6">
                              + {productSpec.derived_features.length - 3} {language === 'ru' ? 'ещё...' : 'more...'}
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Загрузка ProductSpec */}
                    {loadingProductSpec && (
                      <div className="mb-6 p-4 bg-zinc-800/50 rounded-lg flex items-center gap-3">
                        <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                        <span className="text-sm text-zinc-400">
                          {language === 'ru' ? 'Анализируем боли и определяем оптимальный тип проекта...' : 'Analyzing pain points and determining optimal project type...'}
                        </span>
                      </div>
                    )}

                    {/* Auto-deploy toggle */}
                    {isGithubAuthenticated && (
                      <div className="flex items-center justify-between p-4 bg-zinc-800/50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">▲</span>
                          <div>
                            <div className="font-medium text-white">{language === 'ru' ? 'Автодеплой на Vercel' : 'Auto-deploy to Vercel'}</div>
                            <div className="text-sm text-zinc-400">
                              {isVercelAuthenticated
                                ? (language === 'ru' ? 'Продукт будет сразу доступен онлайн' : 'Product will be available online immediately')
                                : (language === 'ru' ? 'Подключите Vercel для автодеплоя' : 'Connect Vercel for auto-deploy')
                              }
                            </div>
                          </div>
                        </div>
                        {isVercelAuthenticated ? (
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
                        ) : (
                          <button
                            onClick={() => setShowVercelTokenInput(!showVercelTokenInput)}
                            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors inline-flex items-center gap-2"
                          >
                            <span>▲</span>
                            {language === 'ru' ? 'Подключить' : 'Connect'}
                          </button>
                        )}
                      </div>
                    )}
                    {showVercelTokenInput && !isVercelAuthenticated && isGithubAuthenticated && (
                      <div className="p-4 bg-zinc-800/50 rounded-lg space-y-3">
                        <div className="text-sm text-zinc-400">
                          {language === 'ru'
                            ? 'Вставьте Personal Access Token от Vercel:'
                            : 'Paste your Vercel Personal Access Token:'}
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={vercelTokenValue}
                            onChange={(e) => setVercelTokenValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && connectVercelToken()}
                            placeholder="xxxxxxxxxxxxxxxx"
                            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                            autoFocus
                          />
                          <button
                            onClick={connectVercelToken}
                            disabled={vercelConnecting || !vercelTokenValue.trim()}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
                          >
                            {vercelConnecting ? '...' : 'OK'}
                          </button>
                        </div>
                        <a
                          href="https://vercel.com/account/tokens"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          {language === 'ru' ? 'Создать токен на vercel.com' : 'Create token at vercel.com'} →
                        </a>
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
                        onClick={() => createProject(false)}
                        disabled={loadingProject}
                        className={`px-8 py-4 rounded-xl font-medium transition-all inline-flex items-center gap-2 ${
                          loadingProject
                            ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                            : 'bg-zinc-700 hover:bg-zinc-600 text-white'
                        }`}
                      >
                        {loadingProject ? (
                          <>
                            <div className="animate-spin w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full" />
                            {language === 'ru' ? 'Генерируем спецификацию...' : 'Generating specification...'}
                          </>
                        ) : (
                          <>
                            <span>📋</span>
                            {language === 'ru' ? 'Только спецификация' : 'Specification Only'}
                          </>
                        )}
                      </button>
                      {isGithubAuthenticated ? (
                        <button
                          onClick={() => handleCreateProjectAuto(true)}
                          disabled={loadingProject}
                          className={`px-8 py-4 rounded-xl font-medium transition-all inline-flex items-center gap-2 ${
                            loadingProject
                              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                          }`}
                        >
                          {loadingProject ? (
                            <>
                              <div className="animate-spin w-5 h-5 border-2 border-zinc-500 border-t-transparent rounded-full" />
                              {language === 'ru' ? 'Генерируем проект...' : 'Generating project...'}
                            </>
                          ) : (
                            <>
                              <span>🚀</span>
                              {autoDeploy
                                ? (language === 'ru' ? 'Создать + GitHub + Deploy' : 'Create + GitHub + Deploy')
                                : (language === 'ru' ? 'Создать + GitHub репо' : 'Create + GitHub Repo')}
                            </>
                          )}
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
                    <h3 className="text-lg font-semibold text-white mb-4">{language === 'ru' ? 'Что будет сгенерировано:' : 'What will be generated:'}</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {[
                        { icon: '💻', title: language === 'ru' ? 'Рабочий код' : 'Working code', desc: language === 'ru' ? `Полный Next.js проект для ${selectedProductType}` : `Full Next.js project for ${selectedProductType}` },
                        { icon: '🗄️', title: language === 'ru' ? 'База данных' : 'Database', desc: 'Supabase schema + API integration' },
                        { icon: '🎨', title: 'UI components', desc: 'Tailwind CSS + ready pages' },
                        { icon: '🔐', title: selectedProductType === 'saas' ? (language === 'ru' ? 'Авторизация' : 'Authorization') : (language === 'ru' ? 'Интеграции' : 'Integrations'), desc: selectedProductType === 'saas' ? 'Supabase Auth + OAuth' : 'API keys and webhooks' },
                        { icon: '📝', title: language === 'ru' ? 'Документация' : 'Documentation', desc: 'README + setup instructions' },
                        { icon: autoDeploy ? '▲' : '🗺️', title: autoDeploy ? 'Live URL' : 'Roadmap', desc: autoDeploy ? (language === 'ru' ? 'Автоматический деплой на Vercel' : 'Auto deploy to Vercel') : (language === 'ru' ? 'План развития MVP → Production' : 'Development plan MVP → Production') },
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
              {loadingProject && (() => {
                const steps = language === 'ru'
                  ? ['Анализ данных тренда', 'Генерация спецификации', 'Сборка блоков и инжекция дизайна', 'Загрузка в GitHub', 'Финализация проекта']
                  : ['Analyzing trend data', 'Generating specification', 'Assembling blocks & injecting design', 'Pushing to GitHub', 'Finalizing project'];
                const stepIcons = ['📊', '📝', '🧩', '📤', '✅'];
                const progressPercent = Math.min(((projectGenStep + 1) / steps.length) * 100, 100);
                const minutes = Math.floor(projectGenElapsed / 60);
                const seconds = projectGenElapsed % 60;
                const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

                return (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                    {/* Timer */}
                    <div className="flex items-center justify-center gap-3 mb-6">
                      <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full" />
                      <span className="text-2xl font-mono font-bold text-white">{timeStr}</span>
                    </div>

                    <h3 className="text-xl font-semibold text-white text-center mb-2">{t.trendDetail.project.generating}</h3>
                    <p className="text-zinc-400 text-center text-sm mb-6">
                      {language === 'ru' ? 'Сборка проекта из 47 готовых блоков с уникальным дизайном' : 'Assembling project from 47 pre-built blocks with unique design'}
                    </p>

                    {/* Progress bar */}
                    <div className="w-full bg-zinc-800 rounded-full h-2 mb-6">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    {/* Steps */}
                    <div className="space-y-3">
                      {steps.map((step, i) => (
                        <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-500 ${
                          i === projectGenStep
                            ? 'bg-indigo-500/10 border border-indigo-500/30'
                            : i < projectGenStep
                            ? 'bg-emerald-500/5 border border-emerald-500/20'
                            : 'bg-zinc-800/30 border border-transparent'
                        }`}>
                          <span className="text-lg">{i < projectGenStep ? '✅' : stepIcons[i]}</span>
                          <span className={`text-sm font-medium ${
                            i === projectGenStep ? 'text-indigo-300' : i < projectGenStep ? 'text-emerald-400' : 'text-zinc-500'
                          }`}>
                            {step}
                          </span>
                          {i === projectGenStep && (
                            <div className="ml-auto flex gap-1">
                              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

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
                        {displayOneLiner && (
                          <p className="text-zinc-300 mb-2">{displayOneLiner}</p>
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
                          <p className="text-zinc-500 text-sm">{language === 'ru' ? 'GitHub репозиторий не создан' : 'GitHub repository not created'}</p>
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
                              {t.trendDetail.project.createWithGithub}
                            </button>
                          ) : (
                            <a
                              href={`/api/auth/github?returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.pathname}?tab=project` : `/trends/${params.id}?tab=project`)}`}
                              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                              {language === 'ru' ? 'Войти в GitHub' : 'Login to GitHub'}
                            </a>
                          )}
                        </div>
                      )}
                      {creatingGithubRepo && (
                        <div className="flex items-center gap-2 text-zinc-400">
                          <div className="animate-spin w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full" />
                          <span className="text-sm">{language === 'ru' ? 'Создание репо...' : 'Creating repo...'}</span>
                        </div>
                      )}
                    </div>
                    {projectError && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {projectError}
                      </div>
                    )}
                    {codeGenerationError && (
                      <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                        {codeGenerationError}
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
                        {language === 'ru' ? 'Сбросить проект' : 'Reset project'}
                      </button>
                    </div>

                    {/* META Agent — итеративная доработка проекта */}
                    {projectData.github_url && isGithubAuthenticated && (
                      <ProjectIterateChat
                        repoUrl={projectData.github_url}
                        projectName={projectData.project_name || ''}
                        language={language}
                      />
                    )}
                  </div>

                  {/* Problem & Solution */}
                  {(displayProblemStatement || displaySolutionOverview) && (
                    <div className="grid md:grid-cols-2 gap-4">
                      {displayProblemStatement && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                          <h4 className="text-sm text-red-400 mb-2 font-medium">{t.trendDetail.project.problemStatement}</h4>
                          <p className="text-zinc-300 text-sm">{displayProblemStatement}</p>
                        </div>
                      )}
                      {displaySolutionOverview && (
                        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                          <h4 className="text-sm text-emerald-400 mb-2 font-medium">{t.trendDetail.project.solutionOverview}</h4>
                          <p className="text-zinc-300 text-sm">{displaySolutionOverview}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* === SECTION 2: Deploy Guide === */}
                  <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <span>🚀</span> {language === 'ru' ? 'Как запустить проект' : 'How to Deploy'}
                      </h3>
                    </div>

                    {/* Если нет GitHub репо - показываем кнопку создания */}
                    {!projectData.github_url && (
                      <div className="mb-6 p-4 bg-zinc-800/50 rounded-lg border border-amber-500/20">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">⚠️</span>
                          <div className="flex-1">
                            <h4 className="font-medium text-amber-400 mb-1">
                              {language === 'ru' ? 'Шаг 1: Создайте GitHub репозиторий' : 'Step 1: Create GitHub Repository'}
                            </h4>
                            <p className="text-sm text-zinc-400 mb-3">
                              {language === 'ru'
                                ? 'Для деплоя на Vercel сначала нужно загрузить код в GitHub'
                                : 'To deploy on Vercel, you first need to upload the code to GitHub'}
                            </p>
                            {isGithubAuthenticated ? (
                              <button
                                onClick={createGithubRepoForProject}
                                disabled={creatingGithubRepo}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
                              >
                                {creatingGithubRepo ? (
                                  <>
                                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                    {language === 'ru' ? 'Создаём...' : 'Creating...'}
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                    </svg>
                                    {language === 'ru' ? 'Загрузить на GitHub' : 'Upload to GitHub'}
                                  </>
                                )}
                              </button>
                            ) : (
                              <a
                                href={`/api/auth/github?returnUrl=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.pathname}?tab=project` : `/trends/${params.id}?tab=project`)}`}
                                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-all inline-flex items-center gap-2"
                              >
                                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                                {language === 'ru' ? 'Войти в GitHub' : 'Login to GitHub'}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Инструкция по деплою на Vercel */}
                    <div className="space-y-4">
                      <div className={`p-4 rounded-lg ${projectData.github_url ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-zinc-800/50'}`}>
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${projectData.github_url ? 'bg-emerald-500 text-white' : 'bg-zinc-700 text-zinc-400'}`}>
                            {projectData.github_url ? '✓' : '1'}
                          </div>
                          <div className="flex-1">
                            <h4 className={`font-medium mb-1 ${projectData.github_url ? 'text-emerald-400' : 'text-zinc-400'}`}>
                              {language === 'ru' ? 'GitHub репозиторий' : 'GitHub Repository'}
                            </h4>
                            {projectData.github_url ? (
                              <a href={projectData.github_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-400 hover:text-indigo-300 underline">
                                {projectData.github_url}
                              </a>
                            ) : (
                              <p className="text-sm text-zinc-500">{language === 'ru' ? 'Создайте репозиторий выше' : 'Create repository above'}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg ${projectData.github_url ? 'bg-zinc-800/50' : 'bg-zinc-900/50 opacity-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">2</div>
                          <div className="flex-1">
                            <h4 className="font-medium text-white mb-1">{language === 'ru' ? 'Откройте Vercel' : 'Open Vercel'}</h4>
                            <p className="text-sm text-zinc-400 mb-2">
                              {language === 'ru'
                                ? 'Перейдите на vercel.com и нажмите "Add New Project"'
                                : 'Go to vercel.com and click "Add New Project"'}
                            </p>
                            <a
                              href="https://vercel.com/new"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"
                            >
                              <span>▲</span> vercel.com/new
                            </a>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg ${projectData.github_url ? 'bg-zinc-800/50' : 'bg-zinc-900/50 opacity-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">3</div>
                          <div className="flex-1">
                            <h4 className="font-medium text-white mb-1">{language === 'ru' ? 'Импортируйте репозиторий' : 'Import Repository'}</h4>
                            <p className="text-sm text-zinc-400">
                              {language === 'ru'
                                ? 'Выберите ваш GitHub репозиторий из списка и нажмите "Import"'
                                : 'Select your GitHub repository from the list and click "Import"'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg ${projectData.github_url ? 'bg-zinc-800/50' : 'bg-zinc-900/50 opacity-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">4</div>
                          <div className="flex-1">
                            <h4 className="font-medium text-white mb-1">{language === 'ru' ? 'Настройте переменные окружения' : 'Configure Environment Variables'}</h4>
                            <p className="text-sm text-zinc-400 mb-2">
                              {language === 'ru'
                                ? 'В разделе "Environment Variables" добавьте необходимые ключи:'
                                : 'In the "Environment Variables" section, add the required keys:'}
                            </p>
                            <div className="bg-zinc-900 rounded p-2 text-xs text-zinc-400 font-mono space-y-1">
                              <div>NEXT_PUBLIC_SUPABASE_URL=your_supabase_url</div>
                              <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key</div>
                              <div>OPENAI_API_KEY=your_openai_key</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={`p-4 rounded-lg ${projectData.github_url ? 'bg-zinc-800/50' : 'bg-zinc-900/50 opacity-50'}`}>
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center text-sm font-bold text-zinc-400">5</div>
                          <div className="flex-1">
                            <h4 className="font-medium text-white mb-1">{language === 'ru' ? 'Деплой!' : 'Deploy!'}</h4>
                            <p className="text-sm text-zinc-400">
                              {language === 'ru'
                                ? 'Нажмите "Deploy" и через 1-2 минуты ваш проект будет доступен онлайн!'
                                : 'Click "Deploy" and in 1-2 minutes your project will be live!'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Если Vercel уже задеплоен */}
                    {(projectData.vercel_url || vercelUrl) && (
                      <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">✅</span>
                          <div>
                            <h4 className="font-medium text-emerald-400">{language === 'ru' ? 'Проект уже онлайн!' : 'Project is live!'}</h4>
                            <a
                              href={projectData.vercel_url || vercelUrl || ''}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-emerald-300 hover:text-emerald-200 underline"
                            >
                              {projectData.vercel_url || vercelUrl}
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

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
                      {language === 'ru' ? 'Открыть в проектах' : 'Open in Projects'}
                    </button>
                  </div>

                  {/* === MARKETING PLAN SECTION === */}
                  {!marketingPlan && !loadingMarketingPlan && (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-8 text-center">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <span className="text-3xl">📋</span>
                        <h3 className="text-2xl font-bold text-white">
                          {language === 'ru' ? 'Маркетинговый план' : 'Marketing Plan'}
                        </h3>
                      </div>
                      <p className="text-zinc-400 mb-6 max-w-lg mx-auto">
                        {language === 'ru'
                          ? 'AI создаст план продвижения на основе собранных данных: целевая аудитория, каналы, готовые рекламные тексты и чеклист запуска'
                          : 'AI will create a promotion plan based on collected data: target audience, channels, ready ad copies and launch checklist'}
                      </p>
                      {marketingPlanError && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                          {marketingPlanError}
                        </div>
                      )}
                      <button
                        onClick={fetchMarketingPlan}
                        className="px-8 py-4 rounded-xl font-medium transition-all inline-flex items-center gap-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-lg shadow-amber-500/25"
                      >
                        <span>📢</span>
                        {language === 'ru' ? 'Создать маркетинговый план' : 'Generate Marketing Plan'}
                      </button>
                    </div>
                  )}

                  {loadingMarketingPlan && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="animate-spin w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full" />
                        <h3 className="text-xl font-semibold text-white">
                          {language === 'ru' ? 'Создаём маркетинговый план...' : 'Generating marketing plan...'}
                        </h3>
                      </div>
                      <p className="text-zinc-400 text-center text-sm">
                        {language === 'ru'
                          ? 'AI анализирует данные из всех предыдущих этапов и создаёт конкретный план действий'
                          : 'AI is analyzing data from all previous stages to create a concrete action plan'}
                      </p>
                    </div>
                  )}

                  {marketingPlan && (
                    <MarketingPlan plan={marketingPlan} language={language} />
                  )}
                </>
              )}
            </div>
          )}
        </div>
        </div>{/* End Dashboard: Sidebar + Content */}

      {/* Chat with context — disabled
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
        language={language}
      />
      */}

      {/* MVP Type Selector Modal - REMOVED
          META агент теперь автоматически определяет тип проекта
          на основе ProductSpec.generation_approach и derived_features
      */}
    </div>
  );
}
