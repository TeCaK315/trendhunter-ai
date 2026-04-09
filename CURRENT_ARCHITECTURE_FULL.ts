/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           TRENDHUNTER AI — CURRENT ARCHITECTURE                 ║
 * ║           Полная документация текущей архитектуры                ║
 * ║           Дата: 2026-03-24                                      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Этот файл содержит полное описание текущей архитектуры TrendHunter AI:
 * все типы, API-роуты, библиотеки, компоненты, пайплайны данных.
 *
 * СТРУКТУРА ФАЙЛА:
 * ═══════════════
 * ЧАСТЬ 1: ТИПЫ И ИНТЕРФЕЙСЫ           (строки ~30–500)
 * ЧАСТЬ 2: CORE БИБЛИОТЕКИ             (строки ~500–1100)
 * ЧАСТЬ 3: API ROUTES — TRENDS & AUTH   (строки ~1100–1600)
 * ЧАСТЬ 4: API ROUTES — EVIDENCE        (строки ~1600–2800)
 * ЧАСТЬ 5: API ROUTES — SYNTHESIS       (строки ~2800–3200)
 * ЧАСТЬ 6: API ROUTES — GENERATION      (строки ~3200–3700)
 * ЧАСТЬ 7: BLOCK ASSEMBLY SYSTEM        (строки ~3700–4400)
 * ЧАСТЬ 8: PAGES & COMPONENTS           (строки ~4400–4900)
 * ЧАСТЬ 9: CONFIG & INFRASTRUCTURE      (строки ~4900–5100)
 * ЧАСТЬ 10: DATA FLOW & PIPELINES       (строки ~5100–5400)
 *
 * TECH STACK:
 * ═══════════
 * - Frontend/Backend: Next.js 16 (App Router)
 * - Language: TypeScript
 * - Styling: Tailwind CSS v4
 * - Database: Supabase (PostgreSQL)
 * - Cache: Vercel KV (Redis)
 * - Auth: NextAuth.js (Google OAuth)
 * - AI: OpenAI (GPT-4o, GPT-4o-mini, Claude Haiku)
 * - Search: SerpAPI, Google Trends API
 * - Hosting: Vercel (Hobby plan, 10s function timeout)
 * - Code Generation: Anthropic Claude API
 */

// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 1: ТИПЫ И ИНТЕРФЕЙСЫ                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: src/types/trend.ts (46 строк)
// Описание: Базовая структура тренда
// ─────────────────────────────────────────────

export interface Trend {
  id: string;                    // Формат: "trend-{timestamp}-{index}"
  title: string;
  category: string;              // Нормализуется в один из 9 валидных: AI & ML, SaaS, FinTech, EdTech, HealthTech, E-commerce, Technology, Business, Mobile Apps
  popularity_score: number;
  growth_rate: number;
  why_trending: string;
  why_trending_en?: string;
  status: string;
  first_detected_at: string;
  source?: string;               // "google_trends" | "manual"
  source_query?: string;         // Исходный поисковый запрос

  // Enrichment fields (Showcase метрики)
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
  difficulty_score?: number;     // 1-10
  difficulty_reasoning?: string;

  // Quick Verdict (Phase 2.3)
  quick_verdict?: {
    decision: 'go' | 'no_go' | 'pivot' | 'more_data';
    summary: string;
  };

  // Regional data (Phase 2.5)
  region?: string;               // 'global', 'us', 'eu', 'asia', 'ru'
}

// ─────────────────────────────────────────────
// Файл: src/types/analysis.ts (68 строк)
// Описание: Типы для 6-блочной системы Evidence + AI Synthesis
// ─────────────────────────────────────────────

export type ConflictType =
  | "existential"   // Рыночное противоречие, убивающее бизнес
  | "operational"   // Серьёзная проблема, но решаемая
  | "manageable"    // Незначительное противоречие
  | "none";

/**
 * BlockOutput — универсальный выход КАЖДОГО Evidence-блока.
 * Все 6 блоков возвращают эту структуру для единообразия.
 */
export interface BlockOutput {
  block_number: number;          // 1-6
  block_type: string;            // "problem" | "demand" | "sellability" | "market_occupation" | "economics" | "tech"
  diagnosis: "green" | "yellow" | "red";  // Светофорная оценка
  score: number;                 // 0-10
  conflict_weight: number;       // Вес конфликта для Synthesis
  key_factors: string[];         // Ключевые факторы решения
  key_metric: string;            // Главная метрика блока
  block_context: Record<string, unknown>;  // Детальные данные блока (layers)
}

/**
 * Conflict — обнаруженное противоречие между блоками.
 * Пример: Block 1 говорит "боль острая", Block 3 говорит "никто не платит"
 */
export interface Conflict {
  weight: number;
  type: ConflictType;
  pair: string;                  // "Block1 vs Block3"
  mechanism: string;             // Описание противоречия
  blocks_involved: number[];
}

/**
 * SkepticOutput — результат работы Скептика.
 * Два режима: анализ конфликтов ИЛИ поиск слепых зон.
 */
export interface SkepticOutput {
  // Mode 1: Когда найдены реальные конфликты
  points?: Array<{
    conflict_pair: string;
    mechanism: string;
    severity: "existential" | "operational" | "manageable";
  }>;
  // Mode 2: Когда конфликтов нет — ищет скрытые риски
  blind_spots?: Array<{
    category: "regulatory" | "technological" | "cultural";
    risk: string;
    timeline: string;
  }>;
}

/**
 * OptimistOutput — результат работы Оптимиста.
 * Для каждого конфликта предлагает нейтрализацию.
 */
export interface OptimistOutput {
  neutralizations: Array<{
    addresses_conflict: string;
    condition: string;           // При каком условии конфликт снимается
    type: "pricing_model" | "strategic_gap" | "pivot" | "partnership" | "sequencing";
  }>;
}

/**
 * ArbitratorOutput — финальный вердикт Арбитра.
 * Синтезирует позиции Скептика и Оптимиста.
 */
export interface ArbitratorOutput {
  verdict_type: "go_if" | "no_go_until" | "experiment_if";
  verdict_condition: string;     // Условие для входа на рынок
  verdict_reasoning: string;
  priority_actions: Array<{
    order: number;
    action: string;
    timeline: string;
    addresses: string;           // Какой конфликт решает
  }>;
  confidence: number;            // 0-100
}

// ─────────────────────────────────────────────
// Файл: src/types/analysis-context.ts (386 строк)
// Описание: Накопительный контекст анализа тренда (8 этапов)
// ─────────────────────────────────────────────

/**
 * AnalysisContext — центральная структура данных проекта.
 *
 * Поток данных (кумулятивный):
 * 1. Обзор    → trend (базовая информация)
 * 2. Анализ   → + analysis (боли, аудитория)
 * 3. Источники → + sources (Reddit, YouTube, Google Trends)
 * 4. Конкуренты → + competition
 * 5. Инвестиции → + venture
 * 6. Клиенты   → + leads
 * 7. Pitch Deck → + pitch
 * 8. Проект    → ПОЛНЫЙ КОНТЕКСТ → GitHub Export
 */

export interface TrendContext {
  id: string;
  title: string;
  category: string;
  why_trending: string;
  created_at?: string;
}

export interface TargetSegment {
  name: string;
  size: string;
  willingness_to_pay: 'low' | 'medium' | 'high';
  key_characteristics: string[];
}

export interface AnalysisData {
  main_pain: string;
  confidence: number;            // 0-100
  key_pain_points: string[];
  target_audience: {
    primary: string;
    segments: TargetSegment[];
  };
  risks: string[];
  opportunities: string[];
  market_readiness: number;      // 0-10
}

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
  interest_over_time: number;    // 0-100
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
    average_sentiment: number;   // -1 to 1
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
  typical_check_size: string;
  portfolio_relevant: string[];
  contact_info?: string;
}

export interface VentureData {
  recent_rounds: FundingRound[];
  active_funds: ActiveFund[];
  total_funding_in_space: string;
  investment_hotness: number;    // 0-10
  market_signals: string[];
  recommended_round_size: string;
  recommended_valuation_range: string;
}

export interface Lead {
  company_name: string;
  website: string;
  email?: string;
  industry: string;
  size: string;
  location: string;
  relevance_score: number;       // 0-10
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
  key_metrics: { tam: string; sam: string; som: string };
  ask_amount: string;
  use_of_funds: Array<{ category: string; percentage: number }>;
}

export interface MVPFeature {
  name: string;
  description: string;
  priority: 'must-have' | 'should-have' | 'nice-to-have';
  complexity: 'low' | 'medium' | 'high';
  user_story: string;
}

export interface ProjectData {
  project_name: string;
  one_liner: string;
  problem_statement: string;
  solution_overview: string;
  mvp_features: MVPFeature[];
  tech_stack: Array<{
    category: string;
    recommendation: string;
    alternatives: string[];
    reasoning: string;
  }>;
  architecture_overview: string;
  milestones: Array<{
    phase: 'mvp' | 'alpha' | 'beta' | 'production';
    name: string;
    description: string;
    deliverables: string[];
    success_metrics: string[];
  }>;
  enhancement_recommendations: Array<{
    area: string;
    current_state: string;
    recommended_improvement: string;
    expected_impact: string;
  }>;
  success_metrics: Array<{
    metric: string;
    mvp_target: string;
    production_target: string;
  }>;
}

/**
 * AnalysisContext — полный кумулятивный контекст.
 * Каждый этап добавляет свою секцию.
 */
export interface AnalysisContext {
  trend: TrendContext;
  analysis?: AnalysisData;       // Этап 2
  sources?: SourcesData;         // Этап 3
  competition?: CompetitionData; // Этап 4
  venture?: VentureData;         // Этап 5
  leads?: LeadsData;             // Этап 6
  pitch?: PitchData;             // Этап 7
  project?: ProjectData;         // Этап 8
  last_updated: string;
  completed_stages: number[];    // [1, 2, 3, ...] — какие этапы завершены
}

// Вспомогательные функции (analysis-context.ts):
// - createInitialContext(trend) → начальный контекст
// - isStageCompleted(context, stage) → boolean
// - getNextStage(context) → number | null
// - formatContextForPrompt(context) → string (для AI промптов)


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 2: CORE БИБЛИОТЕКИ                                       ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: src/lib/supabase.ts (84 строки)
// Описание: Supabase клиент с lazy initialization
// ─────────────────────────────────────────────

/**
 * АРХИТЕКТУРНОЕ РЕШЕНИЕ: Proxy-паттерн для Supabase клиента.
 *
 * Проблема: Vercel build падает если env vars не заданы на этапе сборки.
 * Решение: createClient() вызывается ТОЛЬКО при первом обращении к свойству.
 *
 * import { supabase } from '@/lib/supabase';
 * const { data } = await supabase.from('users').select(); // createClient() here
 */

// Экспорты:
// - supabase: Proxy<SupabaseClient>            — браузер/клиент (anon key)
// - getServerSupabase(): SupabaseClient         — сервер (service role key)
// - isSupabaseConfigured(): boolean             — проверка наличия env vars

// DB Types:
interface DbUser {
  id: string;                    // UUID (SHA-256 от email)
  email: string | null;
  github_username: string | null;
  name: string | null;
  avatar_url: string | null;
  provider: 'google' | 'github';
  created_at: string;
  last_login_at: string;
  is_admin: boolean;
}

interface DbUserUsage {
  id: string;
  user_id: string;
  date: string;                  // YYYY-MM-DD
  ideas_generated: number;
  projects_created: number;
  analyses_run: number;
  created_at: string;
  updated_at: string;
}

interface DbIdea {
  id: string;
  user_id: string;
  trend_id: string;              // "trend-{timestamp}-{index}"
  title: string;
  category: string;
  created_at: string;
  data: Record<string, unknown>;
}

interface DbProject {
  id: string;
  user_id: string;
  idea_id: string | null;
  name: string;
  description: string | null;
  status: 'draft' | 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
  data: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Файл: src/lib/auth-helpers.ts (48 строк)
// Описание: Аутентификация через NextAuth
// ─────────────────────────────────────────────

/**
 * АРХИТЕКТУРНОЕ РЕШЕНИЕ: NextAuth.js + Google OAuth.
 *
 * user_id = SHA-256(email) → UUID формат.
 * Это НЕ Supabase Auth — используется NextAuth + manual UUID generation.
 *
 * Функции:
 * - getAuthUser() → { id: string, email: string } | null
 * - emailToUuid(email) → string (детерминированный UUID v5-like)
 */

// ─────────────────────────────────────────────
// Файл: src/lib/ai.ts (254 строки)
// Описание: Unified AI модуль (OpenAI integration)
// ─────────────────────────────────────────────

/**
 * Единая точка входа для AI-вызовов.
 *
 * Экспорты:
 * - isAIConfigured() → boolean
 * - callAI(options) → AIResponse<string>
 * - callAIJson<T>(options) → AIResponse<T>
 *
 * Специализированные функции:
 * - analyzePainPoints(trend, context) → pain points, segments, risks
 * - researchNiche(niche) → keywords, subreddits, search queries, hypothesis
 *
 * ВАЖНО: generatePitchDeck, analyzeCompetitors УДАЛЕНЫ —
 * они генерировали галлюцинации без реальных источников.
 */

interface AIOptions {
  model?: string;                // default: gpt-4o-mini
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  systemPrompt: string;
  userPrompt: string;
}

interface AIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// ─────────────────────────────────────────────
// Файл: src/lib/openai.ts (341 строка)
// Описание: OpenAI API wrapper с retry logic
// ─────────────────────────────────────────────

/**
 * Низкоуровневый OpenAI клиент:
 * - Exponential backoff (до 3 retry, 60s timeout/request)
 * - Error classification (rate_limit, quota, invalid_key, context_length, server, timeout, network)
 * - JSON response parsing (включая markdown code blocks)
 *
 * Экспорты:
 * - callOpenAI(messages, config) → string
 * - callAgent(systemPrompt, userPrompt) → string
 * - parseJSONResponse<T>(response) → T
 * - classifyError(error) → OpenAIError
 * - formatErrorForUser(error) → string
 */

// ─────────────────────────────────────────────
// Файл: src/lib/data-fetchers.ts (1516 строк)
// Описание: Слой сбора данных из РЕАЛЬНЫХ API
// ─────────────────────────────────────────────

/**
 * КЛЮЧЕВОЙ ПРИНЦИП: ВСЕ данные из реальных API, НИКАКИХ галлюцинаций.
 *
 * Источники данных:
 * ┌─────────────────┬────────────────┬──────────────────┐
 * │ Источник        │ API            │ SerpAPI calls    │
 * ├─────────────────┼────────────────┼──────────────────┤
 * │ Reddit          │ SerpAPI        │ 1                │
 * │ HackerNews      │ Algolia (FREE) │ 0                │
 * │ StackOverflow   │ StackExchange  │ 0                │
 * │ Twitter/X       │ SerpAPI        │ 1                │
 * │ Quora           │ SerpAPI        │ 1                │
 * │ G2 Reviews      │ SerpAPI        │ 1                │
 * │ Capterra        │ SerpAPI        │ 1                │
 * │ Trustpilot      │ SerpAPI        │ 1                │
 * │ ProductHunt     │ SerpAPI        │ 1                │
 * │ YouTube         │ YouTube API    │ 0                │
 * │ GitHub          │ GitHub API     │ 0                │
 * │ IndieHackers    │ SerpAPI        │ 1                │
 * │ Google News     │ SerpAPI        │ 1                │
 * │ Google Trends   │ Google API     │ 0                │
 * └─────────────────┴────────────────┴──────────────────┘
 *
 * Каждый fetcher возвращает:
 * {
 *   data: T[],
 *   source: string,
 *   query_used: string,
 *   fetched_at: string,
 *   serpapi_calls_used: number    // Для бюджетирования
 * }
 *
 * Внутренние хелперы:
 * - serpApiSearch(params) → raw results (10s timeout)
 * - parseResultDate(dateStr) → Date (парсит "3 days ago", "Jan 15, 2024", ISO)
 * - isResultFresh(date, maxDaysAgo=365) → boolean
 * - isResultRelevant(text, stopWords) → boolean
 *
 * Специализированные fetcher-ы:
 * - fetchGoogleTrends(query) → interest_timeline, growth_rate, related_queries
 * - fetchGoogleAutocomplete(query) → suggestions[]
 * - fetchCompetitorPricing(competitor) → plans с ценами
 * - discoverCompetitors(niche) → GPT-4o-mini извлекает имена из SERP
 * - fetchComplaints(niche) → multi-source с engagement scoring
 * - fetchNegativeReviews(competitor) → G2 + Capterra негативные отзывы
 *
 * Batch:
 * - fetchAllSources(query) → параллельный fetch из 14 источников
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 3: API ROUTES — TRENDS & AUTH                             ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: src/app/api/auth/[...nextauth]/route.ts (34 строки)
// Описание: NextAuth.js — Google OAuth
// ─────────────────────────────────────────────

/**
 * Аутентификация через NextAuth.js с Google Provider.
 *
 * ENV VARS:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - NEXTAUTH_SECRET
 *
 * Callbacks:
 * - session: добавляет user.id = token.sub
 * - jwt: сохраняет access_token из OAuth
 *
 * Custom pages:
 * - signIn: '/auth/signin'
 *
 * Экспорт: GET, POST (оба = handler)
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/trends/route.ts (422 строки)
// Описание: CRUD для трендов (Vercel KV + file fallback)
// ─────────────────────────────────────────────

/**
 * ХРАНЕНИЕ ТРЕНДОВ:
 * ┌──────────────────────────────────────────────────────┐
 * │ Production: Vercel KV (Redis)                        │
 * │ Key: "trendhunter:trends"                            │
 * │ Value: { trends: Trend[], lastUpdated: string }      │
 * │                                                      │
 * │ Fallback: data/trends.json (файловая система)        │
 * │ Local dev: in-memory + file persist                  │
 * └──────────────────────────────────────────────────────┘
 *
 * МЕТОДЫ:
 *
 * GET /api/trends
 * → Читает тренды из KV, при пустом KV → seed из data/trends.json
 *
 * POST /api/trends
 * → Добавляет новые тренды С ДЕДУПЛИКАЦИЕЙ:
 *   - normalizeTitle(): убирает generic suffixes/modifiers
 *   - getSignificantWords(): извлекает значимые слова (EN + RU)
 *   - isDuplicate(): 5 проверок:
 *     1. Exact normalized title match
 *     2. Substring match (70%+ length ratio)
 *     3. source_query word-set similarity (≥0.7 Jaccard)
 *     4. Title word-set similarity (≥0.5 Jaccard)
 *     5. Same category + subset match
 *   - normalizeCategory(): маппинг произвольных категорий → 9 валидных
 *
 * PUT /api/trends
 * → Полная замена трендов (используется enrichment pipeline)
 *
 * DELETE /api/trends?id=xxx | DELETE /api/trends?clear=true
 * → Удаление одного тренда или очистка всех
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/cron/scan/route.ts (36 строк)
// Описание: Cron job — ежедневное сканирование трендов
// ─────────────────────────────────────────────

/**
 * Запускается Vercel Cron: "0 6 * * *" (ежедневно в 6:00 UTC)
 *
 * Логика:
 * 1. Проверяет CRON_SECRET для авторизации
 * 2. Вызывает POST /api/scan-trends с { auto: true }
 * 3. scan-trends запускает Google Trends API для 69 направлений в 8 нишах
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/scan-trends/route.ts
// Описание: Сканирование Google Trends (69 направлений × 8 ниш)
// ─────────────────────────────────────────────

/**
 * Основной пайплайн сканирования:
 * 1. Загружает список из 69 ниш (8 категорий)
 * 2. Для каждой ниши → Google Trends API (related queries + interest)
 * 3. AI (GPT-4o-mini) анализирует результаты → формирует Trend objects
 * 4. POST в /api/trends с дедупликацией
 *
 * ОГРАНИЧЕНИЯ:
 * - Vercel Hobby: 10s function timeout
 * - SerpAPI: лимит по кол-ву вызовов в месяц
 * - Batching: запросы разбиваются на batch-и
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 4: API ROUTES — EVIDENCE (6 блоков)                       ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * OVERVIEW: Evidence Pipeline
 * ═══════════════════════════
 *
 * 6 последовательных блоков анализа, каждый углубляет понимание ниши:
 *
 * Block 1: Problem   → "Существует ли проблема?" (жалобы, боли)
 * Block 2: Demand    → "Есть ли спрос?" (Google Trends, коммерческие запросы)
 * Block 3: Sellability → "Можно ли продать?" (цены, каналы, цикл сделки)
 * Block 4: Market Occupation → "Насколько занят рынок?" (конкуренты, gaps)
 * Block 5: Economics → "Экономика сходится?" (IN DEVELOPMENT)
 * Block 6: Design Analysis → "Дизайн конкурентов" (фоновый блок)
 *
 * Каждый блок возвращает:
 * - diagnosis: green/yellow/red (светофор)
 * - score: 0-10
 * - layers: 3 уровня данных (Layer1 = факты, Layer2 = паттерны, Layer3 = контекст)
 * - block_context: детальные данные для downstream блоков
 *
 * Зависимости:
 * Block 1 → независимый
 * Block 2 → независимый
 * Block 3 → ТРЕБУЕТ Block 1 + Block 2
 * Block 4 → использует данные Block 2 (competitors)
 * Block 5 → IN DEVELOPMENT
 * Block 6 → фоновый, запускается параллельно с Block 4
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/evidence/problem/route.ts (851 строка)
// Описание: Block 1 — "Существует ли проблема?"
// ─────────────────────────────────────────────

/**
 * ВХОД: { title, category, why_trending, source_query }
 * ВЫХОД: { diagnosis, score, layers, block_context }
 *
 * ═══ СБОР ДАННЫХ ═══
 *
 * collectPosts(): Собирает жалобы из 6 источников:
 * ┌────────────────┬──────────────────────────────────┐
 * │ Reddit         │ SerpAPI: site:reddit.com         │
 * │ Quora          │ SerpAPI: site:quora.com          │
 * │ G2             │ SerpAPI: site:g2.com             │
 * │ Trustpilot     │ SerpAPI: site:trustpilot.com     │
 * │ HackerNews     │ Algolia API (FREE, no SerpAPI)   │
 * │ StackExchange  │ StackExchange API (FREE)         │
 * └────────────────┴──────────────────────────────────┘
 *
 * Fallback: Если native API падают → SerpAPI site:news.ycombinator.com
 *
 * ═══ КЛАССИФИКАЦИЯ ═══
 *
 * detectPayingUser(text): Эвристика определения платящего пользователя:
 * - HIGH signals: "I pay", "subscription", "our team uses", "enterprise"
 * - MEDIUM signals: "pricing", "free plan", "trial"
 * - LOW signals: "looking for", "alternative"
 *
 * classifyBatch(posts): Claude Haiku классифицирует посты:
 * - no_solution: "Нет решения вообще" (нужно образовывать рынок)
 * - bad_solution: "Решение есть, но плохое" (можно красть пользователей)
 * - expensive_solution: "Дорого" (можно предложить дешевле)
 * - Batching: 10 постов/batch, max 5 concurrent
 *
 * ═══ АГРЕГАЦИЯ (3 LAYER) ═══
 *
 * Layer 1 (Факты):
 * - total_complaints: общее кол-во
 * - by_source: { reddit: N, quora: N, g2: N, ... }
 * - dynamics: growing | stable | declining (анализ дат)
 * - date_confidence: high | medium | low
 *
 * Layer 2 (Паттерны):
 * - distribution: { no_solution: 30%, bad_solution: 50%, expensive: 20% }
 * - top_quotes: по 1 цитате на категорию
 *
 * Layer 3 (Контекст):
 * - paying_score: 0-100 (% платящих пользователей)
 * - paying_ratio: сырой процент
 * - B2B / B2C context detection
 *
 * ═══ ДИАГНОСТИКА ═══
 *
 * GREEN: 60%+ bad_solution + paying_score ≥ 40 + ≥ 50 complaints
 *   → "Кража рынка" — пользователи платят, но недовольны
 *
 * RED: Declining dynamics + paying_score < 15
 *   → "Рынок умирает"
 *
 * YELLOW: Все остальные случаи
 *   → high no_solution = "нужно образовывать рынок"
 *   → insufficient data = "мало данных"
 *   → mixed signals = "неоднозначные сигналы"
 *
 * ═══ ВЫХОД ═══
 *
 * Public (бесплатно): diagnosis, score, distribution, 1 цитата/категорию
 * Premium (платно): все цитаты, layer3 контекст, raw data
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/evidence/demand/route.ts (1152 строки)
// Описание: Block 2 — "Есть ли спрос?"
// ─────────────────────────────────────────────

/**
 * ВХОД: { title, category, why_trending, source_query }
 * ВЫХОД: { diagnosis, score, layers, competitors_found, block_context }
 *
 * ═══ СБОР ДАННЫХ ═══
 *
 * collectDemandData():
 * - Google Trends API: RELATED_QUERIES + TIMESERIES (5-year history)
 * - Fallback: Claude Haiku генерирует ключевые слова если Trends пуст
 *
 * ═══ КЛАССИФИКАЦИЯ ИНТЕНТА ═══
 *
 * classifyIntentBatch(): Claude Haiku классифицирует ключевые слова:
 * - "best CRM software" → commercial (confidence: 0.9)
 * - "what is CRM" → informational (confidence: 0.95)
 * - Batching: 15 keywords/batch, max 5 concurrent
 *
 * ═══ ОБНАРУЖЕНИЕ КОНКУРЕНТОВ ═══
 *
 * collectCompetitorsAndAdDensity():
 * - Берёт top-3 коммерческих запроса (by confidence × volume)
 * - Google SERP через SerpAPI
 * - Фильтрует агрегаторы: G2, Capterra, Reddit, ProductHunt, Wikipedia
 * - Считает: paid competitors (из рекламы) + organic top-5
 * - SERP ad density = ads / total_results
 *
 * ═══ ДЕТЕКЦИЯ ХАЙПА ═══
 *
 * detectHype():
 * - Rising ratio > 50% AND (historical_ratio < 0.2 OR 3x growth in 3m)
 * - Ловит "пузыри" — резкий рост без исторической базы
 *
 * ═══ АГРЕГАЦИЯ ═══
 *
 * Layer 1: demand_index (avg Trends value), keyword_count, growth_rate
 * Layer 2: commercial_intent_ratio, serp_ad_density, confidence
 * Layer 3: rising_queries_ratio, has_momentum
 *
 * ═══ ДИАГНОСТИКА (7 веток) ═══
 *
 * 1. RED:    Хайп обнаружен (пузырь)
 * 2. YELLOW: Falling market (даже с 80%+ commercial intent)
 * 3. GREEN:  ≥55% commercial + ≥50 demand_index (здоровый рынок)
 * 4. GREEN:  ≥80% commercial (микро-B2B, min 30 demand_index)
 * 5. YELLOW: <40% commercial (информационный рынок)
 * 6. YELLOW: 40-60% commercial (серая зона)
 * 7. YELLOW: <50 demand_index (недостаточный объём)
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/evidence/sellability/route.ts (1171 строка)
// Описание: Block 3 — "Можно ли продать?"
// ЗАВИСИМОСТИ: ТРЕБУЕТ Block 1 (Problem) + Block 2 (Demand)
// ─────────────────────────────────────────────

/**
 * ВХОД: { title, category, source_query, problem_data, demand_data }
 * ВЫХОД: { diagnosis, score, layers, block_context }
 *
 * ═══ LAYER 1: ГОТОВНОСТЬ ПЛАТИТЬ ═══
 *
 * fetchCompetitorPricing(competitors):
 * - SERP: "{competitor} pricing" для каждого из 5 конкурентов
 * - Claude Haiku извлекает: prices[], payment_model, has_trial
 * - Parallel Promise.all (fix #1)
 * - Расчёт: median_price, psychological_threshold (9, 19, 29...)
 * - first_payment_friction: триал снижает барьер
 *
 * Reddit budget analysis:
 * - Поиск упоминаний бюджетов
 * - Sentiment: complaint / neutral / satisfaction
 *
 * ═══ LAYER 2: БАРЬЕР ПОКУПКИ ═══
 *
 * inferDealCycle(): Расчёт цикла сделки (дни):
 * - B2B: +14d, B2B2C: +7d, B2C: +2d
 * - bad_solution from Block 1: ×0.5 (легче переключить)
 * - no_solution: ×2.0 (нужно образовывать рынок)
 * - Trial: -3d
 * - Complex onboarding: +7d
 * - No budget category: +14d
 * - Multiple decision makers: +5d each
 *
 * purchase_urgency_score (1-10):
 * - Факторы: paying_ratio, pain_scale, budget_exists, deal_cycle
 *
 * ═══ LAYER 3: КАНАЛЫ ═══
 *
 * collectLayer3():
 * - Reddit communities через поиск конкурентов
 * - Дедупликация, сортировка по mentioned_frequency
 * - traffic_interception_points: problem_search, community, alternative_search, education
 *
 * ═══ ДИАГНОСТИКА ═══
 *
 * GREEN: easy_to_sell
 *   → competitors + budget + channel + short cycle + clear pain
 *
 * YELLOW: needs_work
 *   → long cycle (14-90d) — продажа возможна, но дольше
 *
 * YELLOW: channel_not_found
 *   → market signals OK, но нет communities
 *
 * RED: hard_to_sell
 *   → no competitors OR no budget OR cycle > 90d
 *
 * block_context: sale_cycle_bucket (minutes/days/weeks/months), market_readiness_score (1-10)
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/evidence/market-occupation/route.ts (405 строк)
// Описание: Block 4 — "Насколько занят рынок?"
// ─────────────────────────────────────────────

/**
 * ВХОД: { title, category, source_query, competitors_from_demand }
 * ВЫХОД: { verdict, analysis, design_analysis_result }
 *
 * ═══ ПАРАЛЛЕЛЬНЫЙ СБОР ДАННЫХ ═══
 *
 * Promise.all([
 *   fetchNegativeReviews()      — G2/Capterra через SerpAPI
 *   fetchFeatureGapReddit()     — Reddit: "missing features", "wish", "alternative"
 *   fetchTrustpilot()           — Trustpilot reviews
 *   triggerDesignAnalysis()     — Background: анализ дизайна конкурентов
 *   fetchCompetitorComplaints() — Reddit complaints для top-3 конкурентов
 * ])
 *
 * ═══ GPT-4o АНАЛИЗ ═══
 *
 * GPT-4o получает собранные данные и генерирует:
 * - Feature gap matrix: 5-8 фич × boolean per competitor
 * - Pricing benchmark: plans + prices + trial
 * - Traffic sources: SEO% / Ads% / Social% / Direct% (estimates)
 * - Complaints: категоризация по UX/Pricing/Support/Bugs/Performance/Features
 *
 * ═══ РАСЧЁТ VERDICT (0-10) ═══
 *
 * Логика:
 * - 0 competitors = 3 (рискованно — рынка может не быть)
 * - ≤3 competitors + >2 negative reviews = 9 (идеальная точка входа)
 * - ≤5 competitors + some negatives = 7 (хорошо)
 * - >7 competitors + few gaps = 3-5 (тесно)
 * - >7 competitors, no gaps = 3 (красный океан)
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/evidence/design-analysis/route.ts (366 строк)
// Описание: Block 6 — Анализ дизайна конкурентов (фоновый)
// ─────────────────────────────────────────────

/**
 * Запускается ПАРАЛЛЕЛЬНО с Block 4 (Market Occupation).
 * Результат используется в META Agent для генерации уникального дизайна.
 *
 * ВХОД: { competitors: [{ name, website }] }
 * ВЫХОД: { generated_design, competitor_designs, differentiation_score }
 *
 * ═══ PIPELINE ═══
 *
 * 1. analyzeCompetitorWebsite(url):
 *    - fetch HTML (10s timeout)
 *    - extractColorsFromCSS(): regex (hex, rgb, hsl, named)
 *    - extractFontsFromCSS(): font-family + Google Fonts links
 *    - Результат: { colors[], fonts[], layout_style, ui_patterns[] }
 *
 * 2. Параллельно для ≤5 сайтов
 *
 * 3. generateUniqueDesign(competitor_designs):
 *    - GPT-4o-mini API
 *    - Input: все цвета и шрифты конкурентов
 *    - Output: УНИКАЛЬНАЯ палитра, отличная от конкурентов
 *    - color_palette: { primary, secondary, accent, background, text }
 *    - typography: { headings, body, mono }
 *    - unique_elements: ["glassmorphism", "gradient cards", ...]
 *
 * differentiation_score = 5 + number_of_analyzed_competitors
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/evidence/economics/route.ts
// Описание: Block 5 — Unit Economics
// Статус: IN DEVELOPMENT (работает некорректно)
// ─────────────────────────────────────────────

/**
 * TODO: Планируется реализация:
 * - CAC (Customer Acquisition Cost)
 * - Market Size Indicators (налоговые отчёты конкурентов)
 * - User count estimation (revenue / avg price)
 * - Scalability research (прогнозы 5-10 лет)
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 5: API ROUTES — AI SYNTHESIS                              ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: src/app/api/deep-analysis/route.ts (653 строки)
// Описание: 3 AI-агента — Оптимист / Скептик / Арбитр
// ─────────────────────────────────────────────

/**
 * ВХОД: { title, category, why_trending, source_query, evidence_data? }
 * ВЫХОД: { arbitrationResult }
 *
 * ═══ ИСТОЧНИКИ ДАННЫХ (приоритет) ═══
 *
 * 1. Evidence blocks (если загружены):
 *    - problem.who_hurts.complaints[]
 *    - occupation.why_gaps_exist.negative_reviews[]
 *    - occupation.why_gaps_exist.unmet_needs[]
 *
 * 2. Fallback (если Evidence не загружен):
 *    - Direct fetch: Reddit, HN, Quora, StackOverflow
 *
 * ═══ 3 АГЕНТА (ПАРАЛЛЕЛЬНО) ═══
 *
 * Promise.all([
 *   OPTIMIST: {
 *     role: "Видит потенциал",
 *     input: все данные + жалобы + тренды,
 *     output: доказательства каждой боли,
 *     model: "gpt-4o-mini"
 *   },
 *   SKEPTIC: {
 *     role: "Ищет контраргументы",
 *     input: все данные + risk analysis,
 *     output: конфликты и слепые зоны,
 *     model: "gpt-4o-mini"
 *   },
 *   ARBITER: {
 *     role: "Синтезирует и решает",
 *     input: Optimist + Skeptic результаты,
 *     output: verdict + priority_actions + confidence,
 *     model: "gpt-4o-mini"
 *   }
 * ])
 *
 * ═══ КОРРЕКЦИЯ УВЕРЕННОСТИ ═══
 *
 * Confidence Factor (зависит от количества данных):
 * - ≥25 data points → 1.0x (полная уверенность)
 * - ≥15 data points → 0.85-0.95x
 * - ≥8 data points  → 0.7-0.8x
 * - <8 data points  → 0.5x (низкая уверенность)
 *
 * Data points counting:
 * - Evidence: complaints + (negative_reviews × 2) + (unmet_needs × 1.5)
 * - Direct: reddit + hn + quora + stackoverflow
 *
 * ═══ ВЫХОД ═══
 *
 * arbitrationResult: {
 *   main_pain: string,
 *   key_pain_points: [{ point, confidence }],
 *   target_audience: { primary, segments[] },
 *   risks: string[],
 *   opportunities: string[]
 * }
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 6: API ROUTES — PRODUCT SPEC & CODE GENERATION            ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: src/app/api/product-spec/route.ts (824 строки)
// Описание: Генерация спецификации MVP
// ─────────────────────────────────────────────

/**
 * ВХОД: { trend, analysis, evidence_data?, design_analysis?, differentiation? }
 * ВЫХОД: { product_spec: ProductSpecification }
 *
 * ═══ КОНТЕКСТ ═══
 *
 * Получает ПОЛНЫЙ контекст из всех предыдущих этапов:
 * - complaints (жалобы с Reddit/Quora/HN)
 * - negative_reviews (негативные отзывы конкурентов)
 * - unmet_needs (неудовлетворённые потребности)
 * - pricing_data (цены конкурентов)
 * - ai_synthesis (консенсус 3 агентов)
 * - design_analysis (палитра, типография)
 * - differentiation (USP, Blue Ocean)
 *
 * ═══ AI ГЕНЕРАЦИЯ ═══
 *
 * Модель: GPT-4o-mini
 * CRITICAL RULE: ALL output in ENGLISH
 *
 * ═══ FEATURE EXTRACTOR (встроен) ═══
 *
 * Из реальных болей → конкретные фичи:
 * {
 *   pain_source: "G2 reviews",
 *   pain_quote: "Setup takes 3 hours",
 *   solution: "3-step onboarding wizard",
 *   implementation_hint: "Multi-step form with progress bar",
 *   priority: "must_have"
 * }
 *
 * Fallback: если AI не генерирует → алгоритмическое извлечение
 *
 * ═══ ВЫХОД: ProductSpecification ═══
 *
 * {
 *   user_output: "Invoice" | "Quiz" | "Report" | ...,
 *   user_input: { required_fields, optional_fields },
 *   user_flow: [{ step, action, time_estimate }],
 *   magic_location: "Where AI/formula/aggregation happens",
 *   technical_requirements: { apis[], database, auth, stack },
 *   monetization: { model, pricing_tiers[] },
 *   current_user_solution: { how_solved_now, switching_costs },
 *   derived_features: Feature[],        // 4+ фич из реальных болей
 *   design_system: DesignSystem,         // Из design_analysis
 *   confidence_score: 1-10,
 *   mvp_complexity: "simple" | "medium" | "complex"
 * }
 *
 * KEY PRINCIPLES:
 * - Каждая фича РЕШАЕТ конкретную боль из данных
 * - value_proposition: MAX 6-8 слов
 * - primary_output: 1-3 слова (label кнопки)
 * - Нет fake statistics
 * - Цены на основе competitor data
 * - Фичи приоритизированы: must_have / should_have / nice_to_have
 */

// ─────────────────────────────────────────────
// Файл: src/app/api/generate-code/route.ts (287 строк)
// Описание: Генерация кода MVP проекта
// ─────────────────────────────────────────────

/**
 * ВХОД: { spec, github_repo?, auto_deploy?, mode, product_spec }
 * ВЫХОД: { files[], github_url?, deployment_status? }
 *
 * ═══ ДВА РЕЖИМА ═══
 *
 * MODE: "blocks" (FAST — ~30 секунд)
 * - assembleProject(product_spec) → собирает из 150+ готовых блоков
 * - Topological sort → dependency resolution
 * - Gap filler: Claude заполняет пропуски
 * - Result: ~50 файлов (Next.js + Supabase + Stripe)
 *
 * MODE: "claude" (SLOW — ~50 минут)
 * - generateCodeWithClaude(spec) → полная генерация через Claude
 * - Более персонализированный код
 * - Deprecated в пользу blocks
 *
 * ═══ GITHUB DEPLOY ═══
 *
 * addFilesToGitHub(files, repo, token):
 * - Git Data API pipeline:
 *   1. Create blobs (file content → SHA)
 *   2. Create tree (file structure)
 *   3. Create commit (tree → commit object)
 *   4. Update ref (main branch → new commit)
 *
 * getGitHubUsername(token):
 * - Validates token via GitHub API
 *
 * ═══ POST-PROCESSING ═══
 *
 * sanitizeImports(files):
 * - Убирает невалидные import paths
 * - Фиксит относительные импорты
 *
 * Опционально: deploy на Vercel
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 7: BLOCK ASSEMBLY SYSTEM                                  ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: src/lib/blocks/types.ts (181 строка)
// Описание: Типы блочной системы
// ─────────────────────────────────────────────

/**
 * CORE TYPES:
 *
 * DesignSystem {
 *   color_palette: { primary, secondary, accent, background, text }
 *   typography: { headings, body, mono? }
 *   unique_elements: string[]
 * }
 *
 * ProjectType: 'saas' | 'marketplace' | 'pwa'
 *
 * ContentProfile {
 *   entityName/Plural/Prefix     — что продукт создаёт ("Invoice", "Quiz")
 *   tracksMoney/Status/Score/Count — что отображается на dashboard
 *   formType                      — архетип формы ввода
 *   hasLineItems/Currency/PaymentTerms — финансовые поля
 *   settingsTabs                  — какие вкладки в настройках
 * }
 *
 * BlockContext {
 *   project_name, project_slug, project_description, project_type
 *   design: DesignSystem
 *   derived_features: Feature[]
 *   supabase: { required, tables[] }
 *   stripe: { required, plans[] }
 *   auth: { required, providers[], protected_routes[] }
 *   product_spec: ProductSpecification
 *   safe: { escaped strings for JSX }
 *   contentProfile: ContentProfile
 *   env_vars: Map<string, { example, description }>
 *   dependencies: Map<string, string>
 *   devDependencies: Map<string, string>
 *   migrations: string[]
 *   generated_paths: Set<string>
 * }
 *
 * BlockFunction: (ctx: BlockContext) => Record<string, string>
 *   // path → content
 *
 * BlockManifestEntry {
 *   id, name, category, description
 *   depends_on: string[]           — зависимости (topological sort)
 *   project_types: ProjectType[]   — для каких типов проектов
 *   feature_triggers: string[]     — ключевые слова из derived_features
 *   tech_triggers: string[]        — "auth", "stripe", "supabase"
 *   produces_files: string[]
 *   requires_env, requires_packages, requires_migrations
 * }
 */

// ─────────────────────────────────────────────
// Файл: src/lib/blocks/block-assembler.ts (624 строки)
// Описание: Оркестратор сборки проектов из блоков
// ─────────────────────────────────────────────

/**
 * ГЛАВНАЯ ФУНКЦИЯ: assembleProject(input) → AssemblyOutput
 *
 * ═══ PIPELINE (6 шагов) ═══
 *
 * Step 1: BUILD CONTEXT
 * - Создаёт BlockContext из ProductSpecification
 * - buildContentProfile(spec): определяет entityName, formType, tracksMoney...
 * - inferProjectType(spec): 'marketplace' | 'pwa' | 'saas'
 *
 * Step 2: SELECT BLOCKS
 * - selectBlocks(ctx, manifest) → BlockManifestEntry[]
 * - Проверяет:
 *   a) project_type compatibility
 *   b) tech_triggers (auth? → auth blocks, stripe? → payment blocks)
 *   c) feature_triggers (keyword match vs derived_features)
 *   d) Auto-includes: foundation, core UI, core pages, core APIs
 *
 * Step 3: TOPOLOGICAL SORT
 * - Алгоритм Кана (Kahn's algorithm)
 * - Resolves depends_on chains
 * - Aggregator blocks (package.json, env) → в конец
 *
 * Step 4: EXECUTE BLOCKS
 * - Последовательная загрузка и выполнение каждого блока
 * - Static import map: ~140 блоков
 * - ctx.generated_paths.add(path) для каждого файла
 *
 * Step 5: FIND GAPS
 * - Анализирует derived_features
 * - Находит фичи без покрытия блоками
 *
 * Step 6: GAP FILLER
 * - Claude генерирует код для непокрытых фич
 * - Только если есть реальные пропуски
 *
 * ═══ БЛОКИ ПО КАТЕГОРИЯМ ═══
 *
 * foundation/    — package.json, tsconfig, tailwind, env, readme
 * auth/          — supabase auth, middleware, login/register pages
 * database/      — supabase client, migrations, types
 * ui/            — components (button, card, modal, table, chart, ...)
 * features/      — i18n, dark mode, notifications, search, export, ...
 * pages/         — dashboard, create, settings, landing, pricing, ...
 * api/           — CRUD routes, webhooks, stripe, ...
 * project-types/ — marketplace-specific, pwa-specific blocks
 *
 * TOTAL: ~150 блоков → ~50 файлов на выходе
 */

// ─────────────────────────────────────────────
// Блоки (src/lib/blocks/) — Полная карта
// ─────────────────────────────────────────────

/**
 * ═══ FOUNDATION (всегда включены) ═══
 * package-json.block.ts       — package.json с аккумулированными зависимостями
 * tsconfig.block.ts           — TypeScript config
 * tailwind-config.block.ts    — Tailwind с кастомными цветами из DesignSystem
 * env-example.block.ts        — .env.example из аккумулированных env_vars
 * readme.block.ts             — README.md проекта
 * next-config.block.ts        — next.config.ts
 * postcss.block.ts            — PostCSS config
 * globals-css.block.ts        — Global CSS с DesignSystem
 *
 * ═══ AUTH ═══
 * supabase-auth.block.ts      — Auth client + middleware
 * login-page.block.ts         — Login/Register page
 * auth-callback.block.ts      — OAuth callback handler
 *
 * ═══ DATABASE ═══
 * supabase-client.block.ts    — createClient helpers
 * supabase-types.block.ts     — Database types from schema
 * migrations.block.ts         — SQL migrations from ctx.migrations
 *
 * ═══ UI COMPONENTS ═══
 * button.block.ts, card.block.ts, modal.block.ts, table.block.ts
 * chart.block.ts, sidebar.block.ts, header.block.ts, footer.block.ts
 * form-*.block.ts             — Input, Select, Textarea, Checkbox
 * toast.block.ts, loading.block.ts, empty-state.block.ts
 *
 * ═══ FEATURES ═══
 * multi-language.block.ts     — i18n (636 ключей: universal + conditional)
 * dark-mode.block.ts          — Theme toggle
 * notifications.block.ts      — Toast system
 * search.block.ts             — Search + filter
 * export.block.ts             — PDF/CSV export
 * stripe-integration.block.ts — Stripe Checkout + Webhooks
 *
 * ═══ PAGES ═══
 * dashboard-page.block.ts     — Stats cards, chart, recent items
 * create-page.block.ts        — 3 архетипа: sender-recipient, single-input, data-entry
 * settings-page.block.ts      — Business, Defaults, Payment tabs
 * landing-page.block.ts       — Hero, features, pricing, CTA
 * pricing-page.block.ts       — Stripe plans
 *
 * ═══ API ═══
 * crud-api.block.ts           — CRUD routes for main entity
 * stripe-webhook.block.ts     — Stripe webhook handler
 * ai-api.block.ts             — AI processing endpoint
 *
 * ═══ PROJECT TYPES ═══
 * marketplace-*.block.ts      — Marketplace-specific blocks
 * pwa-*.block.ts              — PWA manifest, service worker
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 8: PAGES & COMPONENTS                                     ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: src/app/page.tsx (~33 строки)
// Описание: Главная страница (Landing / Showcase)
// ─────────────────────────────────────────────

/**
 * Server Component.
 *
 * Загрузка трендов:
 * - loadTrendsFromFile() → читает data/trends.json напрямую
 * - НЕ fetch('/api/trends') — избегает self-fetch deadlock в dev
 *
 * Рендеринг:
 * - <ShowcaseClient initialTrends={trends} lastUpdated={lastUpdated} />
 * - Client component: фильтры по категориям, поиск, карточки трендов
 *
 * SEO:
 * - title: "TrendHunter AI — Discover Profitable Niches"
 * - description: "Browse 69+ trending niches across 9 categories..."
 */

// ─────────────────────────────────────────────
// Файл: src/app/trends/[id]/page.tsx (2000+ строк)
// Описание: Детальная страница тренда — ГЛАВНАЯ СТРАНИЦА ПРИЛОЖЕНИЯ
// ─────────────────────────────────────────────

/**
 * Client Component. Самый сложный файл в проекте.
 *
 * ═══ НАВИГАЦИЯ (FlowStep) ═══
 *
 * type FlowStep = 'overview' | 'evidence' | 'action-plan' | 'monitoring' | 'research' | 'business' | 'project'
 *
 * Каждый FlowStep имеет sub-tabs:
 *
 * evidence:
 *   type EvidenceSubTab = 'analysis' | 'problem' | 'demand' | 'sellability' | 'occupation' | 'economics' | 'tech'
 *
 * action-plan:
 *   type ActionPlanSubTab = 'plan' | 'calculator' | 'scenarios' | 'survey' | 'gtm' | 'differentiation' | 'report'
 *
 * business:
 *   type BusinessSubTab = 'venture' | 'leads'
 *
 * ═══ КОМПОНЕНТЫ (импорты) ═══
 *
 * Evidence блоки:
 * - RealProblemBlock     — визуализация Block 1 (Problem)
 * - DemandGrowthBlock    — визуализация Block 2 (Demand)
 * - SellabilityBlock     — визуализация Block 3 (Sellability)
 * - MarketOccupationBlock — визуализация Block 4 (Market Occupation)
 *
 * Business:
 * - VentureBlock         — инвестиции в нише
 * - LeadsBlock           — потенциальные клиенты
 *
 * Action Plan:
 * - MarketingPlan        — GTM стратегия
 * - DifferentiationBlock — USP и Blue Ocean
 *
 * Project:
 * - ProjectIterateChat   — чат с AI для итерации проекта
 *
 * ═══ STATE MANAGEMENT ═══
 *
 * Основные state variables:
 * - trend: Trend | null
 * - analysis: TrendAnalysis | null
 * - competitionData: CompetitionData | null
 * - ventureData: VentureData | null
 * - leadsData: LeadsData | null
 * - activeFlowStep: FlowStep
 * - evidenceSubTab: EvidenceSubTab
 * - isLoading: boolean
 *
 * ═══ DATA FLOW ═══
 *
 * 1. Загрузка тренда: GET /api/trends → find by id
 * 2. Пользователь нажимает "Evidence" → загрузка блоков
 * 3. Каждый блок: POST /api/evidence/{block} → рендеринг результата
 * 4. AI Synthesis: POST /api/deep-analysis → 3 агента
 * 5. Business: POST /api/business/{venture|clients}
 * 6. Project: POST /api/product-spec → POST /api/generate-code
 */

// ─────────────────────────────────────────────
// Остальные страницы
// ─────────────────────────────────────────────

/**
 * src/app/admin/page.tsx          — Админ панель (управление трендами, пользователями)
 * src/app/projects/page.tsx       — Список проектов пользователя
 * src/app/projects/[id]/page.tsx  — Детали проекта
 * src/app/favorites/page.tsx      — Избранные тренды
 * src/app/niche-research/page.tsx — Ручное исследование ниши
 * src/app/survey/page.tsx         — Опросы пользователей
 */

// ─────────────────────────────────────────────
// Компоненты (src/components/)
// ─────────────────────────────────────────────

/**
 * ═══ LAYOUT ═══
 * Header.tsx            — Навигация, auth status
 * Sidebar.tsx           — Боковая панель (mobile)
 * Footer.tsx            — Подвал
 *
 * ═══ AUTH ═══
 * AuthProvider.tsx       — NextAuth SessionProvider
 * LoginButton.tsx        — Google Sign In
 * UserMenu.tsx           — Dropdown с аватаром
 *
 * ═══ SHOWCASE (главная) ═══
 * ShowcaseClient.tsx     — Карточки трендов с фильтрами
 * TrendCard.tsx          — Карточка одного тренда
 * CategoryFilter.tsx     — Фильтр по категориям
 * SearchBar.tsx          — Поиск по трендам
 *
 * ═══ EVIDENCE BLOCKS ═══
 * blocks/RealProblemBlock.tsx     — Block 1 визуализация
 * blocks/DemandGrowthBlock.tsx    — Block 2 визуализация
 * blocks/SellabilityBlock.tsx     — Block 3 визуализация
 * blocks/MarketOccupationBlock.tsx — Block 4 визуализация
 *
 * ═══ UTILITY ═══
 * TrendChat.tsx          — AI чат на странице тренда
 * ProjectIterateChat.tsx — AI чат для итерации проекта
 * LoadingSpinner.tsx     — Индикатор загрузки
 * ErrorBoundary.tsx      — Обработка ошибок
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 9: CONFIG & INFRASTRUCTURE                                ║
// ╚══════════════════════════════════════════════════════════════════╝

// ─────────────────────────────────────────────
// Файл: next.config.ts (19 строк)
// ─────────────────────────────────────────────

/**
 * Минимальная конфигурация:
 * - images.remotePatterns:
 *   - lh3.googleusercontent.com (Google avatars)
 *   - avatars.githubusercontent.com (GitHub avatars)
 */

// ─────────────────────────────────────────────
// Файл: vercel.json (8 строк)
// ─────────────────────────────────────────────

/**
 * Cron jobs:
 * - /api/cron/scan → "0 6 * * *" (ежедневно в 6:00 UTC)
 */

// ─────────────────────────────────────────────
// Environment Variables
// ─────────────────────────────────────────────

/**
 * ═══ ОБЯЗАТЕЛЬНЫЕ ═══
 *
 * OPENAI_API_KEY            — GPT-4o / GPT-4o-mini для анализа
 * ANTHROPIC_API_KEY          — Claude для генерации кода
 * SERPAPI_API_KEY             — SerpAPI для сбора данных
 * GOOGLE_CLIENT_ID            — Google OAuth
 * GOOGLE_CLIENT_SECRET        — Google OAuth
 * NEXTAUTH_SECRET             — NextAuth session encryption
 * NEXTAUTH_URL                — Base URL (http://localhost:3000 / https://...)
 *
 * ═══ ОПЦИОНАЛЬНЫЕ ═══
 *
 * KV_REST_API_URL             — Vercel KV (Redis) URL
 * KV_REST_API_TOKEN           — Vercel KV token
 * NEXT_PUBLIC_SUPABASE_URL    — Supabase project URL
 * NEXT_PUBLIC_SUPABASE_ANON_KEY — Supabase anonymous key
 * SUPABASE_SERVICE_ROLE_KEY   — Supabase admin key
 * CRON_SECRET                 — Secret для cron job auth
 * YOUTUBE_API_KEY             — YouTube Data API
 *
 * ═══ БУДУЩИЕ ═══
 *
 * STRIPE_SECRET_KEY           — Stripe payments (для генерируемых проектов)
 * GITHUB_TOKEN                — GitHub API для project export
 */

// ─────────────────────────────────────────────
// Файловая структура данных
// ─────────────────────────────────────────────

/**
 * frontend/
 * ├── data/
 * │   └── trends.json             — Seed data (69+ трендов)
 * │                                  Формат: { trends: Trend[], lastUpdated: string }
 * │
 * ├── src/
 * │   ├── app/
 * │   │   ├── page.tsx            — Landing (ShowcaseClient)
 * │   │   ├── layout.tsx          — Root layout (AuthProvider, Header)
 * │   │   ├── admin/page.tsx      — Admin panel
 * │   │   ├── projects/           — Project management
 * │   │   ├── favorites/          — Bookmarked trends
 * │   │   ├── niche-research/     — Manual niche research
 * │   │   ├── survey/             — User surveys
 * │   │   ├── trends/[id]/page.tsx — Trend detail (MAIN PAGE)
 * │   │   └── api/                — 73 API routes
 * │   │       ├── auth/[...nextauth]/
 * │   │       ├── trends/
 * │   │       ├── scan-trends/
 * │   │       ├── cron/scan/
 * │   │       ├── evidence/       — 6 Evidence blocks
 * │   │       │   ├── problem/
 * │   │       │   ├── demand/
 * │   │       │   ├── sellability/
 * │   │       │   ├── market-occupation/
 * │   │       │   ├── economics/
 * │   │       │   └── design-analysis/
 * │   │       ├── deep-analysis/  — AI Synthesis (3 agents)
 * │   │       ├── product-spec/   — MVP specification
 * │   │       ├── generate-code/  — Code generation
 * │   │       ├── github/         — GitHub integration
 * │   │       │   ├── repos/
 * │   │       │   └── issues/
 * │   │       ├── admin/          — Admin endpoints
 * │   │       └── ...             — Other API routes
 * │   │
 * │   ├── components/             — 45+ React components
 * │   │   ├── blocks/             — Evidence block visualizations
 * │   │   ├── layout/             — Header, Sidebar, Footer
 * │   │   ├── auth/               — Auth components
 * │   │   └── showcase/           — Landing page components
 * │   │
 * │   ├── lib/                    — 140+ library files
 * │   │   ├── ai.ts               — AI unified module
 * │   │   ├── openai.ts           — OpenAI wrapper
 * │   │   ├── supabase.ts         — Supabase client
 * │   │   ├── auth-helpers.ts     — Auth utilities
 * │   │   ├── data-fetchers.ts    — Data collection (1516 lines)
 * │   │   ├── blocks/             — Block assembly system
 * │   │   │   ├── types.ts        — Core types
 * │   │   │   ├── block-assembler.ts — Orchestrator (624 lines)
 * │   │   │   ├── foundation/     — Foundation blocks
 * │   │   │   ├── auth/           — Auth blocks
 * │   │   │   ├── database/       — Database blocks
 * │   │   │   ├── ui/             — UI component blocks
 * │   │   │   ├── features/       — Feature blocks
 * │   │   │   ├── pages/          — Page blocks
 * │   │   │   ├── api/            — API blocks
 * │   │   │   └── project-types/  — Project-type-specific blocks
 * │   │   └── mvp-templates/      — MVP template types
 * │   │
 * │   └── types/                  — Type definitions
 * │       ├── trend.ts            — Trend interface (46 lines)
 * │       ├── analysis.ts         — BlockOutput, Conflict, Agent types (68 lines)
 * │       └── analysis-context.ts — Cumulative context (386 lines)
 * │
 * ├── next.config.ts              — Next.js config
 * ├── vercel.json                 — Cron jobs
 * ├── tailwind.config.ts          — Tailwind config
 * └── package.json                — Dependencies
 */


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ЧАСТЬ 10: DATA FLOW & PIPELINES                                 ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * ═══════════════════════════════════════════
 * PIPELINE 1: TREND DISCOVERY
 * ═══════════════════════════════════════════
 *
 * Vercel Cron (6:00 UTC daily)
 *   └→ /api/cron/scan
 *       └→ /api/scan-trends
 *           ├→ Google Trends API (69 queries × 8 niches)
 *           ├→ GPT-4o-mini (formatting + classification)
 *           └→ POST /api/trends (deduplicated merge)
 *               └→ Vercel KV + data/trends.json
 *
 *
 * ═══════════════════════════════════════════
 * PIPELINE 2: EVIDENCE ANALYSIS
 * ═══════════════════════════════════════════
 *
 * User clicks "Подробнее" on trend card
 *   └→ trends/[id]/page.tsx loads
 *       └→ User navigates to "Evidence" tab
 *
 * Block 1: Problem ────────────────────────┐
 *   ├→ collectPosts() (6 sources)          │
 *   ├→ classifyBatch() (Haiku)             │ PARALLEL
 *   └→ diagnosis + layers                  │
 *                                          │
 * Block 2: Demand ─────────────────────────┤
 *   ├→ Google Trends (5yr history)         │
 *   ├→ classifyIntentBatch() (Haiku)       │
 *   ├→ collectCompetitorsAndAdDensity()    │
 *   └→ diagnosis + competitors_found       │
 *                                          │
 * ──────────── WAIT FOR 1 & 2 ────────────┘
 *                                          │
 * Block 3: Sellability ◄──── Block1 + Block2
 *   ├→ fetchCompetitorPricing() (5 competitors)
 *   ├→ inferDealCycle()
 *   └→ diagnosis + channels + sale_cycle
 *
 * Block 4: Market Occupation ◄──── Block2 competitors
 *   ├→ fetchNegativeReviews()
 *   ├→ fetchFeatureGaps()
 *   ├→ GPT-4o analysis
 *   └→ verdict (0-10)
 *
 * Block 6: Design Analysis (BACKGROUND) ◄──── Block4 competitors
 *   ├→ analyzeCompetitorWebsite() × 5
 *   ├→ generateUniqueDesign() (GPT-4o-mini)
 *   └→ DesignSystem { palette, typography }
 *
 *
 * ═══════════════════════════════════════════
 * PIPELINE 3: AI SYNTHESIS
 * ═══════════════════════════════════════════
 *
 * All Evidence blocks loaded
 *   └→ /api/deep-analysis
 *       ├→ OPTIMIST (GPT-4o-mini) ─────┐
 *       ├→ SKEPTIC  (GPT-4o-mini) ─────┤ PARALLEL
 *       └→ ARBITER  (GPT-4o-mini) ◄────┘
 *           └→ verdict + priority_actions + confidence
 *
 *
 * ═══════════════════════════════════════════
 * PIPELINE 4: MVP GENERATION
 * ═══════════════════════════════════════════
 *
 * User clicks "Создать проект"
 *   └→ /api/product-spec
 *       ├→ Input: trend + analysis + evidence + design_analysis
 *       ├→ GPT-4o-mini generates ProductSpecification
 *       ├→ Feature Extractor: pains → features
 *       └→ ProductSpecification { user_flow, features, design, monetization }
 *
 *   └→ /api/generate-code (mode: "blocks")
 *       ├→ assembleProject(product_spec)
 *       │   ├→ buildContentProfile() → ContentProfile
 *       │   ├→ selectBlocks() → ~40 relevant blocks
 *       │   ├→ topologicalSort() → ordered execution
 *       │   ├→ executeBlocks() → ~50 files
 *       │   └→ gapFiller() → Claude fills missing features
 *       │
 *       ├→ sanitizeImports()
 *       │
 *       └→ OPTIONAL: addFilesToGitHub()
 *           ├→ Create blobs → tree → commit → update ref
 *           └→ Deploy to Vercel
 *
 *
 * ═══════════════════════════════════════════
 * PIPELINE 5: BUSINESS INTELLIGENCE
 * ═══════════════════════════════════════════
 *
 * User navigates to "Business" tab
 *   ├→ Venture: /api/business/investments
 *   │   ├→ SerpAPI: funding rounds in niche
 *   │   ├→ Active VCs investing in space
 *   │   └→ investment_hotness (0-10)
 *   │
 *   └→ Leads: /api/business/clients
 *       ├→ Companies in niche open to partnerships
 *       ├→ Decision makers + LinkedIn
 *       └→ Outreach sequences
 *
 *
 * ═══════════════════════════════════════════
 * STORAGE ARCHITECTURE
 * ═══════════════════════════════════════════
 *
 * ┌─────────────────┬──────────────────────┬─────────────────────┐
 * │ Data            │ Storage              │ Access              │
 * ├─────────────────┼──────────────────────┼─────────────────────┤
 * │ Trends          │ Vercel KV (Redis)    │ /api/trends         │
 * │                 │ + data/trends.json   │                     │
 * │ Users           │ Supabase (users)     │ auth-helpers.ts     │
 * │ Usage tracking  │ Supabase (user_usage)│ /api/admin/usage    │
 * │ Saved ideas     │ Supabase (ideas)     │ /api/admin/ideas    │
 * │ Projects        │ Supabase (projects)  │ /api/projects       │
 * │ Sessions        │ NextAuth (JWT)       │ Cookies             │
 * │ Evidence results│ Client state         │ React state         │
 * │ Generated code  │ GitHub               │ Git Data API        │
 * └─────────────────┴──────────────────────┴─────────────────────┘
 *
 * ВАЖНО: Evidence results НЕ персистятся в БД.
 * Каждый раз при открытии тренда данные загружаются заново.
 * Это дизайн-решение (не баг) — данные должны быть свежими.
 *
 *
 * ═══════════════════════════════════════════
 * API BUDGET (SerpAPI calls per full analysis)
 * ═══════════════════════════════════════════
 *
 * Block 1 (Problem):    ~6 calls (Reddit, Quora, G2, Trustpilot, AppStore + fallbacks)
 * Block 2 (Demand):     ~4 calls (Google Trends + competitor SERP × 3)
 * Block 3 (Sellability): ~6 calls (pricing × 5 + Reddit budget)
 * Block 4 (Occupation):  ~5 calls (negative reviews + feature gaps + complaints)
 * Block 6 (Design):      0 calls (direct HTTP fetch)
 * Deep Analysis:         0-4 calls (0 if Evidence loaded, 4 if fallback)
 *
 * TOTAL: ~21-25 SerpAPI calls per full trend analysis
 *
 *
 * ═══════════════════════════════════════════
 * KNOWN LIMITATIONS
 * ═══════════════════════════════════════════
 *
 * 1. Vercel Hobby: 10s function timeout
 *    → Evidence blocks use streaming where possible
 *    → Heavy analysis batched with throttling
 *
 * 2. Evidence results not persisted
 *    → Re-fetched on each page load
 *    → TODO: Cache in Supabase (block_results table)
 *
 * 3. Block 5 (Economics) not working correctly
 *    → CAC, market size calculations incomplete
 *
 * 4. No middleware.ts
 *    → Auth check happens in individual routes
 *    → TODO: Add middleware for protected routes
 *
 * 5. Trend ID format: "trend-{timestamp}-{index}"
 *    → Not UUID, not compatible with Supabase FK
 *    → Works for current KV-based storage
 */


// ═══════════════════════════════════════════
// END OF ARCHITECTURE DOCUMENTATION
// ═══════════════════════════════════════════

/**
 * FILE STATISTICS:
 * ────────────────
 * Total API routes:     73
 * Total pages:          8
 * Total lib files:      140+
 * Total components:     45+
 * Total block files:    150+
 * Total type files:     3
 *
 * KEY FILES BY SIZE:
 * ──────────────────
 * data-fetchers.ts:             1516 lines
 * evidence/demand/route.ts:     1152 lines
 * evidence/sellability/route.ts: 1171 lines
 * evidence/problem/route.ts:    851 lines
 * product-spec/route.ts:        824 lines
 * deep-analysis/route.ts:       653 lines
 * block-assembler.ts:           624 lines
 * trends/route.ts:              422 lines
 * market-occupation/route.ts:   405 lines
 * analysis-context.ts:          386 lines
 * design-analysis/route.ts:     366 lines
 * openai.ts:                    341 lines
 * generate-code/route.ts:       287 lines
 * ai.ts:                        254 lines
 * blocks/types.ts:              181 lines
 *
 * TOTAL CODEBASE: ~15,000+ lines of TypeScript
 */
