/**
 * Evidence-Based Data Types
 *
 * Каждый кусок данных в системе помечен типом:
 * - real_data: Реальные данные из внешних API (SerpAPI, YouTube и т.д.)
 * - calculated: Рассчитано по детерминированной формуле
 * - ai_synthesis: AI-синтез на основе реальных данных (с обязательными ссылками)
 * - ai_hypothesis: AI-гипотеза (единственное допущение — ключевая боль)
 */

// === БАЗОВЫЕ ТИПЫ ===

export type DataType = 'real_data' | 'calculated' | 'ai_synthesis' | 'ai_hypothesis';

export type SourceName =
  | 'reddit'
  | 'hacker_news'
  | 'twitter'
  | 'quora'
  | 'stackoverflow'
  | 'g2'
  | 'capterra'
  | 'trustpilot'
  | 'producthunt'
  | 'google_trends'
  | 'youtube'
  | 'google_news'
  | 'google_search'
  | 'techcrunch'
  | 'crunchbase'
  | 'linkedin';

export interface EvidenceItem {
  data_type: DataType;
  source: SourceName;
  source_url: string;
  text: string;
  extracted_at: string;
  engagement?: number; // upvotes, likes, comments и т.д.
  metadata?: Record<string, unknown>;
}

// === РЕЗУЛЬТАТЫ ПОИСКА ПО ИСТОЧНИКАМ ===

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: SourceName;
  date?: string;
}

export interface RedditResult extends SearchResult {
  source: 'reddit';
  subreddit: string;
  score: number;
  num_comments: number;
}

export interface HackerNewsResult extends SearchResult {
  source: 'hacker_news';
  points: number;
}

export interface TwitterResult extends SearchResult {
  source: 'twitter';
}

export interface QuoraResult extends SearchResult {
  source: 'quora';
}

export interface StackOverflowResult extends SearchResult {
  source: 'stackoverflow';
  votes: number;
  answers: number;
}

export interface G2Result extends SearchResult {
  source: 'g2';
  rating?: number;
}

export interface CapterraResult extends SearchResult {
  source: 'capterra';
  rating?: number;
}

export interface TrustpilotResult extends SearchResult {
  source: 'trustpilot';
  rating?: number;
}

export interface ProductHuntResult extends SearchResult {
  source: 'producthunt';
  upvotes: number;
}

export interface GoogleTrendsTimeline {
  date: string;
  value: number;
}

export interface GoogleTrendsResult {
  search_query: string;
  original_query?: string;
  growth_rate: number;
  interest_timeline: GoogleTrendsTimeline[];
  related_queries: Array<{ query: string; growth: string; link?: string }>;
  google_trends_url: string;
  fetched_at: string;
  error?: string;
}

export interface YouTubeResult {
  title: string;
  channel: string;
  description: string;
  videoId: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

export interface FundingNewsResult extends SearchResult {
  company: string;
  amount: string;
  round_type: string;
  investors: string[];
}

export interface CompanySearchResult extends SearchResult {
  company_name: string;
  website: string;
  description: string;
  linkedin_url?: string;
}

// === ОБЩИЙ ФОРМАТ ОТВЕТА ФЕТЧЕРА ===

export interface FetcherResponse<T> {
  data: T[];
  total_results: number;
  source: SourceName;
  query_used: string;
  fetched_at: string;
  error?: string;
  serpapi_calls_used: number;
}

// === EVIDENCE-BASED SCORING ===

export interface EvidenceScore {
  value: number;        // Числовой score
  data_type: DataType;  // Как получен
  formula?: string;     // Формула расчёта (для calculated)
  inputs?: string[];    // Входные данные
  confidence: number;   // 0-100, насколько уверены
}

// === БЛОКИ EVIDENCE ===

export interface RealProblemEvidence {
  who_hurts: {
    complaints: EvidenceItem[];
    total_complaints: number;
    sources_count: number;
  };
  how_often: {
    google_trends: GoogleTrendsResult | null;
    reddit_post_count: number;
    so_question_count: number;
    frequency_score: EvidenceScore;
  };
  current_solutions: {
    reviews: EvidenceItem[];
    competitor_mentions: EvidenceItem[];
  };
  willingness_to_pay: {
    pricing_data: EvidenceItem[];
    paid_solution_count: number;
  };
  verdict: EvidenceScore;
}

export interface DemandGrowthEvidence {
  growing_or_dying: {
    trends_12m: GoogleTrendsResult | null;
    trends_3m: GoogleTrendsResult | null;
    growth_comparison: EvidenceScore;
  };
  hype_or_stable: {
    stability_score: EvidenceScore;
    std_deviation: number;
  };
  new_players: {
    producthunt_launches: EvidenceItem[];
    show_hn_posts: EvidenceItem[];
    funding_news: EvidenceItem[];
    new_entrants_count: number;
  };
  verdict: EvidenceScore;
}

export interface MarketSellabilityEvidence {
  who_pays: {
    buyer_discussions: EvidenceItem[];
    buyer_profiles: EvidenceItem[];
  };
  market_segment: {
    segment_type: 'B2C' | 'B2B' | 'SMB' | 'Enterprise' | 'Mixed';
    evidence: EvidenceItem[];
    confidence: number;
  };
  average_ticket: {
    competitor_prices: Array<{
      competitor: string;
      price: string;
      url: string;
      plan_type: string;
    }>;
    median_price: number | null;
  };
  sales_cycle: {
    complexity: 'simple' | 'moderate' | 'complex';
    evidence: EvidenceItem[];
  };
  verdict: EvidenceScore;
}

export interface MarketOccupationEvidence {
  competitors_exist: {
    count: number;
    competitors: EvidenceItem[];
    no_competitors_is_bad: boolean;
  };
  why_gaps_exist: {
    negative_reviews: EvidenceItem[];
    unmet_needs: EvidenceItem[];
  };
  differentiation: {
    feature_gaps: EvidenceItem[];
    positioning_opportunities: string[];
  };
  red_ocean: {
    saturation_score: EvidenceScore;
    blue_ocean_score: EvidenceScore;
  };
  verdict: EvidenceScore;
}

export interface UnitEconomicsEvidence {
  cac: {
    keyword_cpc: Array<{
      keyword: string;
      cpc: number;
      currency: string;
      volume: number;
      source_url: string;
    }>;
    estimated_cac: EvidenceScore;
  };
  ltv: {
    competitor_prices: Array<{
      competitor: string;
      monthly_price: number;
      annual_price?: number;
    }>;
    estimated_ltv: EvidenceScore;
  };
  ltv_cac_ratio: EvidenceScore;
  repeat_sales: {
    business_model: 'subscription' | 'one-time' | 'freemium' | 'marketplace' | 'unknown';
    evidence: EvidenceItem[];
  };
  scalability: {
    market_size_signals: EvidenceItem[];
    scalability_score: EvidenceScore;
  };
  verdict: EvidenceScore;
}

// === ПОЛНЫЙ EVIDENCE КОНТЕКСТ ===

export interface EvidenceContext {
  real_problem?: RealProblemEvidence;
  demand_growth?: DemandGrowthEvidence;
  market_sellability?: MarketSellabilityEvidence;
  market_occupation?: MarketOccupationEvidence;
  unit_economics?: UnitEconomicsEvidence;
  last_updated: string;
}
