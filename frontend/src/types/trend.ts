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
}
