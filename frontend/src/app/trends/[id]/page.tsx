'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TrendChat from '@/components/TrendChat';
import MVPTypeSelector from '@/components/MVPTypeSelector';
import { recommendProductType, type ProductType } from '@/lib/productRecommendation';
import { MVPType, MVPGenerationContext, ProductSpecification } from '@/lib/mvp-templates';
import { useLanguage, useTranslateContent } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';

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
  why_trending_en?: string;
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

// Оптимизированный flow: 4 основных шага вместо 8
// Каждый шаг содержит подразделы с полным контентом
type FlowStep = 'overview' | 'research' | 'business' | 'project';

// Подразделы внутри каждого шага
type ResearchSubTab = 'analysis' | 'sources' | 'competition';
type BusinessSubTab = 'venture' | 'leads' | 'pitch';

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
  const [researchSubTab, setResearchSubTab] = useState<ResearchSubTab>('analysis');
  const [businessSubTab, setBusinessSubTab] = useState<BusinessSubTab>('venture');
  const [isFavorite, setIsFavorite] = useState(false);

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

  // Translation hooks for pitch deck
  const pitchForTranslation = pitchDeck ? {
    tagline: pitchDeck.tagline,
    slides: pitchDeck.slides.map(s => ({
      title: s.title,
      content: s.content,
      speaker_notes: s.speaker_notes,
      visual_suggestion: s.visual_suggestion,
    })),
  } : null;

  const { data: translatedPitch, isLoading: translatingPitch } = useTranslateContent(
    language === 'en' && pitchDeck ? pitchForTranslation : null,
    { cacheKey: analysis ? `pitch-${analysis.trend_id}` : undefined }
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

  // Computed translated pitch values
  const displayPitchTagline = pitchDeck ? (
    language === 'en'
      ? ((translatedPitch?.tagline as string) || pitchDeck.tagline)
      : pitchDeck.tagline
  ) : '';

  const displayPitchSlides = pitchDeck?.slides ? (
    language === 'en' && translatedPitch?.slides
      ? pitchDeck.slides.map((s, i) => ({
          ...s,
          title: (translatedPitch.slides as Array<{title: string; content: string[]; speaker_notes: string; visual_suggestion: string}>)[i]?.title || s.title,
          content: (translatedPitch.slides as Array<{title: string; content: string[]; speaker_notes: string; visual_suggestion: string}>)[i]?.content || s.content,
          speaker_notes: (translatedPitch.slides as Array<{title: string; content: string[]; speaker_notes: string; visual_suggestion: string}>)[i]?.speaker_notes || s.speaker_notes,
          visual_suggestion: (translatedPitch.slides as Array<{title: string; content: string[]; speaker_notes: string; visual_suggestion: string}>)[i]?.visual_suggestion || s.visual_suggestion,
        }))
      : pitchDeck.slides
  ) : [];

  // Translation hooks for sources synthesis
  const sourcesForTranslation = sourcesSynthesis ? {
    key_insights: sourcesSynthesis.key_insights,
    sentiment_summary: sourcesSynthesis.sentiment_summary,
    content_gaps: sourcesSynthesis.content_gaps,
    recommended_angles: sourcesSynthesis.recommended_angles,
  } : null;

  const { data: translatedSources, isLoading: translatingSources } = useTranslateContent(
    language === 'en' && sourcesSynthesis ? sourcesForTranslation : null,
    { cacheKey: analysis ? `sources-${analysis.trend_id}` : undefined }
  );

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

  // Computed translated sources values
  const displayKeyInsights = sourcesSynthesis?.key_insights ? (
    language === 'en'
      ? ((translatedSources?.key_insights as string[]) || sourcesSynthesis.key_insights)
      : sourcesSynthesis.key_insights
  ) : [];

  const displaySentimentSummary = sourcesSynthesis?.sentiment_summary ? (
    language === 'en'
      ? ((translatedSources?.sentiment_summary as string) || sourcesSynthesis.sentiment_summary)
      : sourcesSynthesis.sentiment_summary
  ) : '';

  const displayContentGaps = sourcesSynthesis?.content_gaps ? (
    language === 'en'
      ? ((translatedSources?.content_gaps as string[]) || sourcesSynthesis.content_gaps)
      : sourcesSynthesis.content_gaps
  ) : [];

  const displayRecommendedAngles = sourcesSynthesis?.recommended_angles ? (
    language === 'en'
      ? ((translatedSources?.recommended_angles as string[]) || sourcesSynthesis.recommended_angles)
      : sourcesSynthesis.recommended_angles
  ) : [];

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
      // Маппинг старых табов на новые
      const tabMapping: Record<string, { step: FlowStep; subTab?: ResearchSubTab | BusinessSubTab }> = {
        'overview': { step: 'overview' },
        'analysis': { step: 'research', subTab: 'analysis' },
        'sources': { step: 'research', subTab: 'sources' },
        'competition': { step: 'research', subTab: 'competition' },
        'venture': { step: 'business', subTab: 'venture' },
        'leads': { step: 'business', subTab: 'leads' },
        'pitch-deck': { step: 'business', subTab: 'pitch' },
        'project': { step: 'project' },
        // Новые табы
        'research': { step: 'research' },
        'business': { step: 'business' },
      };

      const mapping = tabMapping[tabParam];
      if (mapping) {
        tabSetFromUrlRef.current = true;
        setCurrentStep(mapping.step);
        if (mapping.subTab) {
          if (['analysis', 'sources', 'competition'].includes(mapping.subTab)) {
            setResearchSubTab(mapping.subTab as ResearchSubTab);
          } else {
            setBusinessSubTab(mapping.subTab as BusinessSubTab);
          }
        }
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
              setCurrentStep('research');
              setResearchSubTab('sources');
            } else {
              setCurrentStep('research');
              setResearchSubTab('analysis');
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

        setCurrentStep('research');
        setResearchSubTab('analysis');

        // Автоматически генерируем ProductSpec после анализа болей
        // Это позволяет иметь спецификацию продукта раньше в flow
        setTimeout(() => {
          fetchProductSpec();
        }, 500);
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
        setCurrentStep('research');
        setResearchSubTab('sources');

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
      setProductSpecError(language === 'ru' ? 'Необходим анализ болей перед созданием спецификации' : 'Pain analysis required before creating specification');
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

  // Auto-fetch data when switching to relevant tabs/subtabs
  useEffect(() => {
    // Research subtabs
    if (currentStep === 'research' && researchSubTab === 'competition' && !competition && !loadingCompetition) {
      fetchCompetition();
    }
    // Business subtabs
    if (currentStep === 'business') {
      if (businessSubTab === 'venture' && !ventureData && !loadingVenture) {
        fetchVentureData();
      } else if (businessSubTab === 'leads' && !leadsData && !loadingLeads && analysis?.main_pain) {
        fetchLeads();
      } else if (businessSubTab === 'pitch' && !pitchDeck && !loadingPitch) {
        generatePitchDeck();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, researchSubTab, businessSubTab]);

  // Оптимизированный flow: 4 основных шага
  const flowSteps = [
    { id: 'overview', label: t.trendDetail.tabs.overview, icon: '📊', description: language === 'ru' ? 'Обзор тренда' : 'Trend Overview' },
    { id: 'research', label: language === 'ru' ? 'Исследование' : 'Research', icon: '🔬', description: language === 'ru' ? 'Анализ, источники, конкуренты' : 'Analysis, Sources, Competition' },
    { id: 'business', label: language === 'ru' ? 'Бизнес' : 'Business', icon: '💼', description: language === 'ru' ? 'Инвестиции, клиенты, питч' : 'Venture, Leads, Pitch' },
    { id: 'project', label: t.trendDetail.tabs.project, icon: '🚀', description: language === 'ru' ? 'Создать проект' : 'Create Project' },
  ];

  // Подразделы для Research
  const researchSubTabs = [
    { id: 'analysis', label: t.trendDetail.tabs.analysis, icon: '🔍' },
    { id: 'sources', label: t.trendDetail.tabs.sources, icon: '📚' },
    { id: 'competition', label: t.trendDetail.tabs.competition, icon: '🏆' },
  ];

  // Подразделы для Business
  const businessSubTabs = [
    { id: 'venture', label: t.trendDetail.tabs.venture, icon: '💰' },
    { id: 'leads', label: t.trendDetail.tabs.leads, icon: '👥' },
    { id: 'pitch', label: t.trendDetail.tabs.pitchDeck, icon: '📑' },
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

        {/* Flow Steps - Оптимизированная навигация */}
        <div className="px-6 py-4 border-b border-zinc-800/50 bg-zinc-900/30">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
            {flowSteps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isPast = flowSteps.findIndex(s => s.id === currentStep) > index;
              const isClickable = isPast || step.id === 'overview' ||
                (step.id === 'research' && analysis) ||
                (step.id === 'business' && analysis?.real_sources) ||
                (step.id === 'project' && analysis?.real_sources);

              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => isClickable && setCurrentStep(step.id as FlowStep)}
                    disabled={!isClickable}
                    className={`flex flex-col items-center gap-1 px-5 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : isPast
                        ? 'bg-zinc-800 text-white'
                        : isClickable
                        ? 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                        : 'bg-zinc-900/50 text-zinc-600 cursor-not-allowed'
                    }`}
                  >
                    <span className="text-xl">{step.icon}</span>
                    <span className="whitespace-nowrap font-medium">{step.label}</span>
                  </button>
                  {index < flowSteps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-2 ${isPast ? 'bg-indigo-500' : 'bg-zinc-700'}`} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Подразделы для Research */}
          {currentStep === 'research' && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800/50">
              {researchSubTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setResearchSubTab(tab.id as ResearchSubTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    researchSubTab === tab.id
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Подразделы для Business */}
          {currentStep === 'business' && (
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-zinc-800/50">
              {businessSubTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setBusinessSubTab(tab.id as BusinessSubTab)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all ${
                    businessSubTab === tab.id
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          )}
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
              <p className="text-zinc-400 max-w-2xl">
                {translatingTrend && (
                  <span className="inline-block w-4 h-4 mr-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                )}
                {displayWhyTrending}
              </p>
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
                  {
                    label: t.trendDetail.overview.opportunity,
                    value: trend.opportunity_score,
                    icon: '🎯',
                    colorClass: 'bg-indigo-500',
                    description: language === 'ru'
                      ? 'Оценка рыночных возможностей: размер рынка, растущий спрос, незанятые ниши'
                      : 'Market opportunity: market size, growing demand, untapped niches'
                  },
                  {
                    label: t.trendDetail.overview.painLevel,
                    value: trend.pain_score,
                    icon: '🔥',
                    colorClass: 'bg-red-500',
                    description: language === 'ru'
                      ? 'Острота боли: насколько сильно проблема беспокоит пользователей'
                      : 'Pain severity: how strongly the problem affects users'
                  },
                  {
                    label: t.trendDetail.overview.feasibility,
                    value: trend.feasibility_score,
                    icon: '⚡',
                    colorClass: 'bg-amber-500',
                    description: language === 'ru'
                      ? 'Выполнимость: техническая сложность, доступность ресурсов, время до MVP'
                      : 'Feasibility: technical complexity, resource availability, time to MVP'
                  },
                  {
                    label: t.trendDetail.overview.potential,
                    value: trend.profit_potential,
                    icon: '💰',
                    colorClass: 'bg-emerald-500',
                    description: language === 'ru'
                      ? 'Потенциальная выгода: готовность платить, LTV, маржинальность'
                      : 'Profit potential: willingness to pay, LTV, profit margins'
                  },
                ].map((metric) => (
                  <div key={metric.label} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 group relative">
                    <div className="flex items-center gap-2 mb-2">
                      <span>{metric.icon}</span>
                      <span className="text-sm text-zinc-400">{metric.label}</span>
                      <span className="text-zinc-600 cursor-help" title={metric.description}>ⓘ</span>
                    </div>
                    <div className="text-2xl font-bold text-white">{metric.value}</div>
                    <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${metric.colorClass} rounded-full transition-all`}
                        style={{ width: `${metric.value * 10}%` }}
                      />
                    </div>
                    {/* Tooltip on hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-[220px] text-center">
                      {metric.description}
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

          {/* Research - Analysis subtab: No analysis yet */}
          {currentStep === 'research' && researchSubTab === 'analysis' && !analysis && (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center mb-6">
                <span className="text-4xl">🔍</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {language === 'ru' ? 'Анализ ещё не выполнен' : 'Analysis not performed yet'}
              </h3>
              <p className="text-zinc-400 text-center max-w-md mb-6">
                {t.trendDetail.overview.runAnalysisDescription}
              </p>
              <button
                onClick={runAnalysis}
                disabled={analyzing}
                className={`px-8 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
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
          )}

          {/* Research - Analysis subtab: Has analysis */}
          {currentStep === 'research' && researchSubTab === 'analysis' && analysis && (
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
                      {translatingRawAnalyses && (
                        <span className="inline-block w-4 h-4 ml-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      )}
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

          {currentStep === 'research' && researchSubTab === 'sources' && analysis?.real_sources && (
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
                      ({analysis.real_sources.reddit.posts.length} {language === 'ru' ? 'постов' : 'posts'})
                    </span>
                  </h3>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {analysis.real_sources.reddit.posts.map((post, index) => (
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
                              {post.score > 0 && <span>⬆️ {post.score}</span>}
                              {post.num_comments > 0 && <span>💬 {post.num_comments}</span>}
                              {post.score === 0 && post.num_comments === 0 && (
                                <span className="text-zinc-500 text-xs">{language === 'ru' ? 'Метрики недоступны через поиск' : 'Metrics unavailable via search'}</span>
                              )}
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
                      <div className="text-sm text-zinc-400 mb-2">{language === 'ru' ? 'Активные сообщества:' : 'Active communities:'}</div>
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
                      ({analysis.real_sources.youtube.videos.length} {language === 'ru' ? 'видео' : 'videos'})
                    </span>
                  </h3>

                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[800px] overflow-y-auto">
                    {analysis.real_sources.youtube.videos.map((video, index) => (
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
                <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.analysis.nextStep}</h3>
                <p className="text-zinc-400 mb-4">
                  {t.trendDetail.analysis.collectSourcesDescription}
                </p>
                <button
                  onClick={() => setResearchSubTab('competition')}
                  className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                >
                  <span>🏆</span>
                  {t.trendDetail.competition.analyzeCompetitors}
                </button>
              </div>
            </div>
          )}

          {/* Sources Empty State */}
          {currentStep === 'research' && researchSubTab === 'sources' && !analysis?.real_sources && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                <span className="text-3xl">🔗</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                {language === 'ru' ? 'Источники не собраны' : 'Sources not collected'}
              </h3>
              <p className="text-zinc-400 mb-6 max-w-md">
                {language === 'ru'
                  ? 'Сначала запустите сбор источников, чтобы получить данные из Google Trends, Reddit и YouTube.'
                  : 'Run source collection first to get data from Google Trends, Reddit and YouTube.'}
              </p>
              {collectingSources ? (
                <div className="flex items-center gap-3 text-zinc-400">
                  <div className="animate-spin w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full" />
                  <span>{language === 'ru' ? 'Сбор источников...' : 'Collecting sources...'}</span>
                </div>
              ) : (
                <button
                  onClick={collectSources}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium flex items-center gap-2"
                >
                  <span>🔍</span>
                  {language === 'ru' ? 'Собрать источники' : 'Collect Sources'}
                </button>
              )}
            </div>
          )}

          {/* Competition Tab */}
          {currentStep === 'research' && researchSubTab === 'competition' && (
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
                      {t.trendDetail.competition.competitors} ({displayCompetitors.length})
                      {translatingCompetition && (
                        <span className="inline-block w-4 h-4 ml-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </h3>
                    <div className="space-y-3">
                      {displayCompetitors.map((comp, index) => (
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
                  {displayOpportunityAreas.length > 0 && (
                    <div className="bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💡</span> {t.trendDetail.competition.opportunityAreas}
                      </h3>
                      <div className="space-y-2">
                        {displayOpportunityAreas.map((area, index) => (
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
                      onClick={() => { setCurrentStep('business'); setBusinessSubTab('venture'); }}
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
                                  {round.round_type} • {round.date === 'DATE_UNKNOWN' ? t.trendDetail.venture.dateUnknown : round.date}
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
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-white font-medium text-lg">{company.name}</span>
                                <span className={`px-2 py-0.5 rounded text-xs ${
                                  company.relevance_score >= 8 ? 'bg-emerald-500/20 text-emerald-300' :
                                  company.relevance_score >= 6 ? 'bg-amber-500/20 text-amber-300' :
                                  'bg-zinc-500/20 text-zinc-300'
                                }`}>
                                  {company.relevance_score}/10 {t.trendDetail.leads.relevance}
                                  {translatingLeads && <span className="inline-block w-3 h-3 ml-1 border border-indigo-500 border-t-transparent rounded-full animate-spin" />}
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
                                  🌐 {t.trendDetail.leads.website}
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
                                  <div className="text-xs text-zinc-500 mb-1">{t.trendDetail.leads.decisionMakers}:</div>
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
                              ✉️ {language === 'ru' ? 'Письмо' : 'Email'}
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

                  {/* Next Step */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.leads.nextStep}</h3>
                    <p className="text-zinc-400 mb-4">
                      {t.trendDetail.leads.generatePitchDescription}
                    </p>
                    <button
                      onClick={() => setBusinessSubTab('pitch')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>📑</span>
                      {t.trendDetail.leads.createPitchDeck}
                    </button>
                  </div>
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
                      onClick={() => { setCurrentStep('research'); setResearchSubTab('analysis'); }}
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
                          href={`mailto:${selectedCompany.email}?subject=${encodeURIComponent(displayEmailSubject)}&body=${encodeURIComponent(displayEmailBody)}`}
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

          {/* Pitch Deck Tab */}
          {currentStep === 'business' && businessSubTab === 'pitch' && (
            <div className="space-y-6">
              {loadingPitch ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mb-4" />
                  <p className="text-zinc-400">{t.trendDetail.pitch.generating}</p>
                </div>
              ) : pitchDeck ? (
                <>
                  {/* Header */}
                  <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl p-6">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      {pitchDeck.title}
                      {translatingPitch && (
                        <span className="inline-block w-4 h-4 ml-2 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </h2>
                    <p className="text-zinc-400">{displayPitchTagline}</p>
                  </div>

                  {/* Slide Viewer */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    {/* Slide Navigation */}
                    <div className="flex items-center gap-1 p-2 border-b border-zinc-800 overflow-x-auto">
                      {displayPitchSlides.map((slide, index) => (
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
                          {t.trendDetail.pitch.slide} {displayPitchSlides[currentSlide]?.number || 1} / {displayPitchSlides.length}
                          <span className="ml-2 px-2 py-0.5 bg-zinc-800 rounded">
                            {displayPitchSlides[currentSlide]?.type}
                          </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-6">
                          {displayPitchSlides[currentSlide]?.title}
                        </h3>

                        <div className="space-y-3 mb-8">
                          {displayPitchSlides[currentSlide]?.content?.map((point, index) => (
                            <div key={index} className="flex items-start gap-3 text-lg text-zinc-300">
                              <span className="text-indigo-400 mt-1">•</span>
                              <span>{point}</span>
                            </div>
                          ))}
                        </div>

                        {/* Speaker Notes */}
                        <div className="p-4 bg-zinc-800/50 rounded-lg mb-4">
                          <div className="text-xs text-zinc-500 mb-1">📝 {t.trendDetail.pitch.speakerNotes}:</div>
                          <p className="text-sm text-zinc-400">{displayPitchSlides[currentSlide]?.speaker_notes}</p>
                        </div>

                        {/* Visual Suggestion */}
                        <div className="p-4 bg-zinc-800/50 rounded-lg">
                          <div className="text-xs text-zinc-500 mb-1">🎨 {t.trendDetail.pitch.visualRecommendation}:</div>
                          <p className="text-sm text-zinc-400">{displayPitchSlides[currentSlide]?.visual_suggestion}</p>
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
                        ← {t.trendDetail.pitch.back}
                      </button>
                      <span className="text-zinc-400">
                        {currentSlide + 1} / {displayPitchSlides.length}
                      </span>
                      <button
                        onClick={() => setCurrentSlide(prev => Math.min(displayPitchSlides.length - 1, prev + 1))}
                        disabled={currentSlide === displayPitchSlides.length - 1}
                        className="px-4 py-2 bg-zinc-800 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
                      >
                        {t.trendDetail.pitch.next} →
                      </button>
                    </div>
                  </div>

                  {/* Export Options */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.pitch.exportPresentation}</h3>

                    {/* Copy/Download Actions */}
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                      <button
                        onClick={() => {
                          const slideLabel = language === 'ru' ? 'Слайд' : 'Slide';
                          const notesLabel = language === 'ru' ? 'Заметки' : 'Notes';
                          const visualLabel = language === 'ru' ? 'Визуал' : 'Visual';
                          const text = pitchDeck.slides.map(slide =>
                            `## ${slideLabel} ${slide.number}: ${slide.title}\n\n${slide.content.map(c => `• ${c}`).join('\n')}\n\n📝 ${notesLabel}: ${slide.speaker_notes}\n🎨 ${visualLabel}: ${slide.visual_suggestion}`
                          ).join('\n\n---\n\n');
                          navigator.clipboard.writeText(text);
                          alert(language === 'ru' ? 'Контент скопирован! Вставьте в любой редактор.' : 'Content copied! Paste into any editor.');
                        }}
                        className="p-4 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors text-center"
                      >
                        <div className="text-2xl mb-2">📋</div>
                        <div className="text-white font-medium">{t.trendDetail.pitch.copyText}</div>
                        <div className="text-xs text-indigo-200">{t.trendDetail.pitch.copyTextDescription}</div>
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
                        <div className="text-white font-medium">{t.trendDetail.pitch.downloadJson}</div>
                        <div className="text-xs text-emerald-200">{t.trendDetail.pitch.downloadJsonDescription}</div>
                      </button>
                    </div>

                    {/* Template Links */}
                    <div className="mb-4">
                      <h4 className="text-sm text-zinc-400 mb-3">{t.trendDetail.pitch.selectTemplate}</h4>
                      <div className="grid md:grid-cols-3 gap-4">
                        <a
                          href={pitchDeck.export_formats.google_slides_template}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-center group"
                        >
                          <div className="text-2xl mb-2">📊</div>
                          <div className="text-white font-medium">Google Slides</div>
                          <div className="text-xs text-zinc-400 group-hover:text-zinc-300">{t.trendDetail.pitch.openTemplates}</div>
                        </a>
                        <a
                          href={pitchDeck.export_formats.figma_template}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-center group"
                        >
                          <div className="text-2xl mb-2">🎨</div>
                          <div className="text-white font-medium">Figma</div>
                          <div className="text-xs text-zinc-400 group-hover:text-zinc-300">{t.trendDetail.pitch.openTemplates}</div>
                        </a>
                        <a
                          href={pitchDeck.export_formats.canva_template}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-4 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-center group"
                        >
                          <div className="text-2xl mb-2">🖼️</div>
                          <div className="text-white font-medium">Canva</div>
                          <div className="text-xs text-zinc-400 group-hover:text-zinc-300">{t.trendDetail.pitch.openTemplates}</div>
                        </a>
                      </div>
                    </div>

                    {/* Instructions - Two columns */}
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Text Instructions */}
                      <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <div className="text-sm text-amber-300">
                          <strong>📋 {t.trendDetail.pitch.viaTextFast}</strong>
                          <ol className="mt-2 space-y-1 list-decimal list-inside text-amber-200">
                            <li>{t.trendDetail.pitch.viaTextStep1}</li>
                            <li>{t.trendDetail.pitch.viaTextStep2}</li>
                            <li>{t.trendDetail.pitch.viaTextStep3}</li>
                            <li>{t.trendDetail.pitch.viaTextStep4}</li>
                          </ol>
                        </div>
                      </div>

                      {/* JSON Instructions */}
                      <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
                        <div className="text-sm text-indigo-300">
                          <strong>📥 {t.trendDetail.pitch.viaJsonAuto}</strong>
                          <ol className="mt-2 space-y-1 list-decimal list-inside text-indigo-200">
                            <li>{t.trendDetail.pitch.viaJsonStep1}</li>
                            <li>{t.trendDetail.pitch.viaJsonStep2}</li>
                            <li>{t.trendDetail.pitch.viaJsonStep3}</li>
                            <li>{t.trendDetail.pitch.viaJsonStep4}</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Sources */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-sm font-medium text-zinc-400 mb-3">{language === 'ru' ? 'Полезные материалы' : 'Useful resources'}</h3>
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
                    <h3 className="text-lg font-semibold text-white mb-4">{t.trendDetail.pitch.nextStep}</h3>
                    <p className="text-zinc-400 mb-4">
                      {t.trendDetail.pitch.createProjectDescription}
                    </p>
                    <button
                      onClick={() => setCurrentStep('project')}
                      className="w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      <span>🚀</span>
                      {t.trendDetail.project.createProject}
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center py-20 text-zinc-400">
                  {language === 'ru' ? 'Не удалось сгенерировать Pitch Deck' : 'Failed to generate Pitch Deck'}
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
                        <h3 className="text-lg font-semibold text-white">{t.trendDetail.project.selectMvpType}</h3>
                      </div>
                      {productRecommendation && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
                          <span className="text-emerald-400 text-sm">✨ {language === 'ru' ? 'AI рекомендует:' : 'AI recommends:'}</span>
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
                                {language === 'ru' ? 'Вы выбрали другой тип — это тоже хороший выбор!' : 'You chose a different type — that\'s also a good choice!'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-4 mb-6">
                      {[
                        { id: 'landing' as const, name: 'Landing + Waitlist', icon: '🚀', desc: language === 'ru' ? 'Лендинг со сбором email и Supabase' : 'Landing page with email collection and Supabase', complexity: language === 'ru' ? 'Легко' : 'Easy', time: language === 'ru' ? '1-2 дня' : '1-2 days' },
                        { id: 'saas' as const, name: 'SaaS Dashboard', icon: '📊', desc: language === 'ru' ? 'Приложение с авторизацией и дашбордом' : 'App with auth and dashboard', complexity: language === 'ru' ? 'Средне' : 'Medium', time: language === 'ru' ? '1-2 недели' : '1-2 weeks' },
                        { id: 'ai-wrapper' as const, name: 'AI Wrapper', icon: '🤖', desc: language === 'ru' ? 'Чат-интерфейс для AI с историей' : 'Chat interface for AI with history', complexity: language === 'ru' ? 'Средне' : 'Medium', time: language === 'ru' ? '3-5 дней' : '3-5 days' },
                        { id: 'ecommerce' as const, name: 'E-commerce Lite', icon: '🛒', desc: language === 'ru' ? 'Магазин с каталогом и корзиной' : 'Shop with catalog and cart', complexity: language === 'ru' ? 'Сложно' : 'Hard', time: language === 'ru' ? '1-2 недели' : '1-2 weeks' },
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
                                {language === 'ru' ? 'Рекомендуем' : 'Recommended'}
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
                                type.complexity === 'Легко' || type.complexity === 'Easy' ? 'bg-green-500/20 text-green-400' :
                                type.complexity === 'Средне' || type.complexity === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
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
                            <div className="font-medium text-white">{language === 'ru' ? 'Автодеплой на Vercel' : 'Auto-deploy to Vercel'}</div>
                            <div className="text-sm text-zinc-400">{language === 'ru' ? 'Продукт будет сразу доступен онлайн' : 'Product will be available online immediately'}</div>
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
              {loadingProject && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-12 text-center">
                  <div className="animate-spin w-12 h-12 border-3 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">{t.trendDetail.project.generating}</h3>
                  <p className="text-zinc-400">{language === 'ru' ? 'Анализирует данные от всех экспертов и генерирует спецификацию' : 'Analyzing data from all experts and generating specification'}</p>
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

                  {/* MVP Specification */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <span>⚙️</span> MVP Specification
                    </h3>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm text-zinc-400 mb-2">{t.trendDetail.project.coreFeatures}</h4>
                        <div className="space-y-2">
                          {displayCoreFeatures.map((f, i) => (
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
                        <h4 className="text-sm text-zinc-400 mb-2">{t.trendDetail.project.techStack}</h4>
                        <div className="space-y-2">
                          {displayTechStack.map((item, i) => (
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
                              <span className="text-zinc-400">{t.trendDetail.project.architecture}:</span>
                              <span className="text-white ml-2">{projectData.mvp_specification.architecture}</span>
                            </div>
                            {projectData.mvp_specification.estimated_complexity && (
                              <div className="text-sm mt-1">
                                <span className="text-zinc-400">{t.trendDetail.project.complexity}:</span>
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
                      <span>🗺️</span> {t.trendDetail.project.roadmap}
                    </h3>
                    <div className="space-y-4">
                      {[
                        { key: 'mvp', label: 'MVP', color: 'indigo', goals: displayRoadmapMvpGoals, deliverables: displayRoadmapMvpDeliverables, success_metrics: displayRoadmapMvpSuccessMetrics },
                        { key: 'alpha', label: 'Alpha', color: 'purple', goals: displayRoadmapAlphaGoals, deliverables: displayRoadmapAlphaDeliverables, success_metrics: displayRoadmapAlphaSuccessMetrics },
                        { key: 'beta', label: 'Beta', color: 'amber', goals: displayRoadmapBetaGoals, deliverables: displayRoadmapBetaDeliverables, success_metrics: displayRoadmapBetaSuccessMetrics },
                        { key: 'production', label: 'Production', color: 'emerald', goals: displayRoadmapProductionGoals, deliverables: displayRoadmapProductionDeliverables, success_metrics: displayRoadmapProductionSuccessMetrics },
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
                                <span className="text-xs text-zinc-500">{t.trendDetail.project.goals}:</span>
                                <ul className="mt-1 space-y-1">
                                  {phase.goals.map((g, j) => (
                                    <li key={j} className="text-sm text-zinc-300 flex items-start gap-2">
                                      <span className="text-emerald-400">→</span> {g}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="text-xs text-zinc-500">{t.trendDetail.project.deliverables}:</span>
                                <ul className="mt-1 space-y-1">
                                  {phase.deliverables.map((d, j) => (
                                    <li key={j} className="text-sm text-zinc-300 flex items-start gap-2">
                                      <span className="text-indigo-400">✓</span> {d}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="text-xs text-zinc-500">{t.trendDetail.project.successMetrics}:</span>
                                <ul className="mt-1 space-y-1">
                                  {phase.success_metrics.map((m, j) => (
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
                    {displayKeyKpis.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-zinc-700">
                        <span className="text-xs text-zinc-500">Key KPIs:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {displayKeyKpis.map((kpi, i) => (
                            <span key={i} className="px-2 py-1 bg-indigo-500/10 text-indigo-300 text-xs rounded">{kpi}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Enhancement Recommendations */}
                  {displayEnhancements.length > 0 && (
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <span>💡</span> Enhancement Recommendations
                      </h3>
                      <div className="space-y-3">
                        {displayEnhancements.map((rec, i) => (
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
                      {language === 'ru' ? 'Открыть в проектах' : 'Open in Projects'}
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
        language={language}
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
