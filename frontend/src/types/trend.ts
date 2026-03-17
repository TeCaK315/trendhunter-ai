export interface Trend {
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

  // Enrichment fields (Showcase metrics)
  competition_level?: 'low' | 'medium' | 'high';
  entry_cost_estimate?: string;
  monthly_searches?: number;
  top_players_count?: number;
  enriched_at?: string;

  // Data confidence (Phase 2.0)
  data_confidence?: 'verified' | 'estimated' | 'ai_generated';
  growth_rate_source?: 'google_trends' | 'ai_estimated';
  growth_rate_verified?: number;

  // Sentiment Snapshot (Phase 2.1)
  sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
    sample_quotes?: string[];
  };

  // Difficulty Score (Phase 2.2)
  difficulty_score?: number; // 1-10
  difficulty_reasoning?: string;

  // Quick Verdict (Phase 2.3)
  quick_verdict?: {
    decision: 'go' | 'no_go' | 'pivot' | 'more_data';
    summary: string;
  };

  // Regional data (Phase 2.5)
  region?: string; // 'global', 'us', 'eu', 'asia', 'ru', etc.
}
