/**
 * AnalysisContext - накопительный контекст анализа тренда
 *
 * Каждый эксперт получает данные от всех предыдущих экспертов
 * и добавляет свою экспертизу в общий контекст.
 *
 * Поток данных:
 * 1. Обзор → trend
 * 2. Анализ → + analysis
 * 3. Источники → + sources
 * 4. Конкуренты → + competition
 * 5. Инвестиции → + venture
 * 6. Клиенты → + leads
 * 7. Pitch Deck → + pitch
 * 8. Проект → ПОЛНЫЙ КОНТЕКСТ → GitHub Export
 */

// === БАЗОВЫЕ ТИПЫ ===

export interface TrendContext {
  id: string;
  title: string;
  category: string;
  why_trending: string;
  created_at?: string;
}

// === ЭТАП 2: АНАЛИЗ БОЛЕЙ ===

export interface TargetSegment {
  name: string;
  size: string;
  willingness_to_pay: 'low' | 'medium' | 'high';
  key_characteristics: string[];
}

export interface AnalysisData {
  main_pain: string;
  confidence: number; // 0-100
  key_pain_points: string[];
  target_audience: {
    primary: string;
    segments: TargetSegment[];
  };
  risks: string[];
  opportunities: string[];
  market_readiness: number; // 0-10
}

// === ЭТАП 3: ИСТОЧНИКИ ===

export interface RedditSource {
  subreddit: string;
  post_title: string;
  upvotes: number;
  comments: number;
  url: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  key_quotes: string[];
}

export interface GoogleTrendsSource {
  query: string;
  interest_over_time: number; // 0-100
  growth_percentage: number;
  related_queries: string[];
  geographic_interest: Array<{ region: string; interest: number }>;
}

export interface YouTubeSource {
  title: string;
  channel: string;
  views: number;
  url: string;
  published_at: string;
}

export interface SourcesData {
  reddit: {
    posts: RedditSource[];
    total_mentions: number;
    average_sentiment: number; // -1 to 1
    top_subreddits: string[];
  };
  google_trends: GoogleTrendsSource;
  youtube: {
    videos: YouTubeSource[];
    total_views: number;
    top_channels: string[];
  };
  collected_at: string;
}

// === ЭТАП 4: КОНКУРЕНТЫ ===

export interface Competitor {
  name: string;
  website: string;
  description: string;
  funding?: string;
  strengths: string[];
  weaknesses: string[];
  pricing?: string;
  target_market: string;
}

export interface CompetitionData {
  competitors: Competitor[];
  market_gaps: string[];
  our_positioning: string;
  competitive_advantages: string[];
  barriers_to_entry: string[];
  market_concentration: 'fragmented' | 'moderate' | 'concentrated';
}

// === ЭТАП 5: ИНВЕСТИЦИИ ===

export interface FundingRound {
  company: string;
  amount: string;
  round_type: string;
  date: string;
  investors: string[];
  source_url: string;
}

export interface ActiveFund {
  name: string;
  focus_areas: string[];
  typical_check_size: string;
  portfolio_relevant: string[];
  contact_info?: string;
}

export interface VentureData {
  recent_rounds: FundingRound[];
  active_funds: ActiveFund[];
  total_funding_in_space: string;
  investment_hotness: number; // 0-10
  market_signals: string[];
  recommended_round_size: string;
  recommended_valuation_range: string;
}

// === ЭТАП 6: КЛИЕНТЫ/ЛИДЫ ===

export interface Lead {
  company_name: string;
  website: string;
  email?: string;
  industry: string;
  size: string;
  location: string;
  relevance_score: number; // 0-10
  pain_match: string;
  decision_makers: Array<{
    role: string;
    likely_email_format: string;
  }>;
  outreach_angle: string;
}

export interface LeadsData {
  companies: Lead[];
  linkedin_queries: string[];
  directories: Array<{
    name: string;
    url: string;
    description: string;
  }>;
  total_addressable_companies: number;
  recommended_outreach_sequence: string[];
}

// === ЭТАП 7: PITCH DECK ===

export interface PitchSlide {
  number: number;
  title: string;
  type: 'title' | 'problem' | 'solution' | 'market' | 'product' | 'business-model' | 'traction' | 'competition' | 'team' | 'ask';
  content: string[];
  speaker_notes: string;
  visual_suggestion: string;
}

export interface PitchData {
  company_name: string;
  tagline: string;
  slides: PitchSlide[];
  key_metrics: {
    tam: string;
    sam: string;
    som: string;
  };
  ask_amount: string;
  use_of_funds: Array<{ category: string; percentage: number }>;
}

// === ЭТАП 8: ПРОЕКТ (ФИНАЛЬНЫЙ ЭКСПОРТ) ===

export interface MVPFeature {
  name: string;
  description: string;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  complexity: 'low' | 'medium' | 'high';
  user_story: string;
}

export interface TechStackRecommendation {
  category: string;
  recommendation: string;
  alternatives: string[];
  reasoning: string;
}

export interface Milestone {
  phase: 'mvp' | 'alpha' | 'beta' | 'production';
  name: string;
  description: string;
  deliverables: string[];
  success_metrics: string[];
}

export interface ProjectData {
  // Мета-информация
  project_name: string;
  one_liner: string;
  problem_statement: string;
  solution_overview: string;

  // Техническое задание для MVP
  mvp_features: MVPFeature[];
  tech_stack: TechStackRecommendation[];
  architecture_overview: string;

  // Roadmap развития
  milestones: Milestone[];

  // Рекомендации по улучшению
  enhancement_recommendations: Array<{
    area: string;
    current_state: string;
    recommended_improvement: string;
    expected_impact: string;
  }>;

  // Метрики успеха
  success_metrics: Array<{
    metric: string;
    mvp_target: string;
    production_target: string;
  }>;
}

// === ПОЛНЫЙ КОНТЕКСТ АНАЛИЗА ===

export interface AnalysisContext {
  // Этап 1: Базовая информация о тренде
  trend: TrendContext;

  // Этап 2: Анализ болей (опционально, заполняется после анализа)
  analysis?: AnalysisData;

  // Этап 3: Данные из источников
  sources?: SourcesData;

  // Этап 4: Конкурентный анализ
  competition?: CompetitionData;

  // Этап 5: Инвестиционные данные
  venture?: VentureData;

  // Этап 6: Потенциальные клиенты
  leads?: LeadsData;

  // Этап 7: Pitch Deck
  pitch?: PitchData;

  // Этап 8: Проект (финальная компиляция)
  project?: ProjectData;

  // Мета-данные
  last_updated: string;
  completed_stages: number[]; // [1, 2, 3, ...] - какие этапы завершены
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Создаёт начальный контекст анализа из данных тренда
 */
export function createInitialContext(trend: TrendContext): AnalysisContext {
  return {
    trend,
    last_updated: new Date().toISOString(),
    completed_stages: [1],
  };
}

/**
 * Проверяет, завершён ли определённый этап анализа
 */
export function isStageCompleted(context: AnalysisContext, stage: number): boolean {
  return context.completed_stages.includes(stage);
}

/**
 * Возвращает следующий незавершённый этап
 */
export function getNextStage(context: AnalysisContext): number | null {
  for (let i = 1; i <= 8; i++) {
    if (!context.completed_stages.includes(i)) {
      return i;
    }
  }
  return null; // Все этапы завершены
}

/**
 * Форматирует контекст для передачи в AI промпт
 */
export function formatContextForPrompt(context: AnalysisContext): string {
  const parts: string[] = [];

  // Всегда включаем информацию о тренде
  parts.push(`## Тренд
Название: ${context.trend.title}
Категория: ${context.trend.category}
Почему трендит: ${context.trend.why_trending}`);

  // Добавляем данные анализа, если есть
  if (context.analysis) {
    parts.push(`
## Анализ болей
Главная боль: ${context.analysis.main_pain}
Уверенность: ${context.analysis.confidence}%
Ключевые боли: ${context.analysis.key_pain_points.join(', ')}
Целевая аудитория: ${context.analysis.target_audience.primary}
Сегменты: ${context.analysis.target_audience.segments.map(s => s.name).join(', ')}
Риски: ${context.analysis.risks.join(', ')}
Возможности: ${context.analysis.opportunities.join(', ')}`);
  }

  // Добавляем данные из источников, если есть
  if (context.sources) {
    parts.push(`
## Данные из источников
Reddit: ${context.sources.reddit.total_mentions} упоминаний, средний sentiment: ${context.sources.reddit.average_sentiment}
Топ сабреддиты: ${context.sources.reddit.top_subreddits.join(', ')}
Google Trends: интерес ${context.sources.google_trends.interest_over_time}/100, рост ${context.sources.google_trends.growth_percentage}%
Связанные запросы: ${context.sources.google_trends.related_queries.join(', ')}
YouTube: ${context.sources.youtube.total_views} просмотров по теме`);
  }

  // Добавляем конкурентный анализ, если есть
  if (context.competition) {
    parts.push(`
## Конкуренты
${context.competition.competitors.map(c => `- ${c.name}: ${c.description}`).join('\n')}
Рыночные ниши: ${context.competition.market_gaps.join(', ')}
Наше позиционирование: ${context.competition.our_positioning}
Конкурентные преимущества: ${context.competition.competitive_advantages.join(', ')}`);
  }

  // Добавляем инвестиционные данные, если есть
  if (context.venture) {
    parts.push(`
## Инвестиции в нише
Общий объём: ${context.venture.total_funding_in_space}
Горячесть рынка: ${context.venture.investment_hotness}/10
Последние раунды: ${context.venture.recent_rounds.map(r => `${r.company} - ${r.amount} (${r.round_type})`).join(', ')}
Активные фонды: ${context.venture.active_funds.map(f => f.name).join(', ')}
Рекомендуемый размер раунда: ${context.venture.recommended_round_size}`);
  }

  // Добавляем данные о лидах, если есть
  if (context.leads) {
    parts.push(`
## Потенциальные клиенты
Всего компаний в сегменте: ${context.leads.total_addressable_companies}
Топ лиды: ${context.leads.companies.slice(0, 5).map(l => `${l.company_name} (${l.industry})`).join(', ')}
LinkedIn запросы: ${context.leads.linkedin_queries.join(', ')}`);
  }

  return parts.join('\n\n');
}
