import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse, formatErrorForUser, type OpenAIError } from '@/lib/openai';
import { checkRateLimit, getClientIP, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';
import { fetchReddit, fetchHackerNews, fetchQuora, fetchStackOverflow } from '@/lib/data-fetchers';

/**
 * /api/deep-analysis — ПЕРЕРАБОТАННЫЙ v2
 *
 * БЫЛО: 3 агента генерируют боли из воздуха (100% галлюцинация)
 * СТАЛО v1:
 *   1. СНАЧАЛА собираем реальные жалобы из Reddit/HN/Quora/SO
 *   2. Передаём реальные данные в агентов (Optimist/Skeptic/Arbiter)
 *   3. Промпт обязывает ссылаться на конкретные посты
 *   4. Confidence score — по формуле, не GPT
 *
 * СТАЛО v2 (ОПТИМИЗАЦИЯ):
 *   1. Используем ГОТОВЫЕ данные из Evidence блоков (problem + occupation)
 *   2. Добавляем negative_reviews и unmet_needs из Market Occupation
 *   3. Используем severity_score и frequency_score уже рассчитанные
 *   4. Fallback на старый подход если Evidence данных нет
 */

// Типы для Evidence данных
interface EvidenceComplaint {
  text: string;
  source: string;
  source_url: string;
  engagement: number;
}

interface EvidenceNegativeReview {
  title: string;
  url: string;
  snippet?: string;
  source: string;
}

interface EvidenceUnmetNeed {
  title: string;
  url: string;
  subreddit?: string;
  score?: number;
}

interface EvidenceProblemData {
  who_hurts?: {
    complaints: EvidenceComplaint[];
    total_complaints: number;
    severity_score?: { value: number };
  };
  how_often?: {
    google_trends?: { growth_rate: number };
    reddit_post_count: number;
    so_question_count: number;
    frequency_score?: { value: number };
  };
  ai_summary?: { text: string };
}

interface EvidenceOccupationData {
  why_gaps_exist?: {
    negative_reviews: EvidenceNegativeReview[];
    unmet_needs: EvidenceUnmetNeed[];
    total_signals: number;
  };
  differentiation?: {
    positioning_opportunities: string[];
  };
  competitors_exist?: {
    count: number;
    competitors: Array<{ name: string; website?: string }>;
  };
}

interface DeepAnalysisRequest {
  trend_title: string;
  trend_category: string;
  why_trending: string;
  source_query?: string;
  existing_analysis?: {
    main_pain?: string;
    key_pain_points?: string[];
  };
  // NEW: Evidence данные из предыдущих блоков
  evidence_data?: {
    problem?: EvidenceProblemData;
    occupation?: EvidenceOccupationData;
  };
}

interface AgentResponse {
  pains: Array<{
    pain: string;
    evidence: string[];
    target_audience: string;
    willingness_to_pay: string;
    reasoning: string;
  }>;
  overall_assessment: string;
}

interface ArbitrationResult {
  main_pain: string;
  confidence: number;
  key_pain_points: Array<{
    pain: string;
    confidence: number;
    arguments_for: string[];
    arguments_against: string[];
    verdict: string;
  }>;
  target_audience: {
    segments: Array<{
      name: string;
      size: string;
      willingness_to_pay: string;
      where_to_find: string;
      confidence: number;
    }>;
  };
  risks: string[];
  opportunities: string[];
  final_recommendation: string;
  analysis_metadata: {
    optimist_summary: string;
    skeptic_summary: string;
    consensus_reached: boolean;
    analysis_depth: 'deep';
  };
}

// Agent prompts — теперь ОБЯЗАНЫ ссылаться на реальные данные
const OPTIMIST_PROMPT = `Ты опытный предприниматель и венчурный аналитик, который ВЕРИТ в потенциал этой ниши.

Тебе предоставлены РЕАЛЬНЫЕ данные из Reddit, Hacker News, Quora и StackOverflow.

КРИТИЧЕСКОЕ ПРАВИЛО: Ты ОБЯЗАН работать ТОЛЬКО с предоставленными данными.
- Каждая боль ДОЛЖНА ссылаться на конкретный пост/URL из данных выше.
- Если боль нельзя подтвердить конкретным постом — НЕ включай её.
- НЕ ПРИДУМЫВАЙ посты, URL, цитаты, статистику или источники.
- Количество болей в ответе НЕ МОЖЕТ превышать количество УНИКАЛЬНЫХ тем в данных.

ПРАВИЛА:
1. Анализируй ТОЛЬКО предоставленные данные. НЕ выдумывай ничего.
2. Для каждой боли ОБЯЗАТЕЛЬНО укажи конкретный пост/вопрос как доказательство (URL или название из данных)
3. Если данных недостаточно — скажи честно, а не придумывай
4. Фокусируйся на болях где люди УЖЕ тратят деньги на неидеальные решения

Верни JSON:
{
  "pains": [
    {
      "pain": "Описание боли НА ОСНОВЕ реальных постов",
      "evidence": ["Пост/вопрос 1 (r/subreddit или HN)", "Пост/вопрос 2"],
      "target_audience": "Кто жалуется в этих постах",
      "willingness_to_pay": "high/medium/low — на основе того что люди пишут о деньгах",
      "reasoning": "Вывод на основе данных — почему это реальная боль"
    }
  ],
  "overall_assessment": "Оценка потенциала ниши НА ОСНОВЕ реальных обсуждений"
}`;

const SKEPTIC_PROMPT = `Ты опытный инвестор который видел 1000+ провальных стартапов. Ты СКЕПТИК.

Тебе предоставлены РЕАЛЬНЫЕ данные из Reddit, Hacker News, Quora и StackOverflow.

КРИТИЧЕСКОЕ ПРАВИЛО: Ты ОБЯЗАН работать ТОЛЬКО с предоставленными данными.
- Каждый аргумент ДОЛЖЕН ссылаться на конкретный пост/URL из данных выше.
- НЕ ПРИДУМЫВАЙ посты, URL, цитаты, статистику или источники.
- Если в данных нет контраргументов — так и скажи, а не выдумывай их.

ПРАВИЛА:
1. Анализируй ТОЛЬКО предоставленные данные. НЕ выдумывай.
2. Для каждого аргумента ссылайся на конкретный пост/вопрос из предоставленных данных
3. Ищи КОНТРАРГУМЕНТЫ в тех же данных — может быть люди уже нашли решение?
4. Если постов мало — это сам по себе красный флаг

Верни JSON:
{
  "pains": [
    {
      "pain": "Описание боли (из данных)",
      "evidence": ["Почему это проблема (пост)", "Но вот контраргумент (другой пост)"],
      "target_audience": "Кто жалуется + почему они могут НЕ платить",
      "willingness_to_pay": "high/medium/low — с критическим обоснованием",
      "reasoning": "Почему предыдущие решения провалились (из данных)"
    }
  ],
  "overall_assessment": "Критическая оценка — главные риски и что может пойти не так"
}`;

const ARBITER_PROMPT = `Ты Senior Product Strategist с 20+ лет опыта. Тебе дали два анализа одной ниши:

1. ОПТИМИСТ видит потенциал
2. СКЕПТИК видит риски

Оба анализа основаны на РЕАЛЬНЫХ данных из Reddit, HN, Quora, SO.

КРИТИЧЕСКОЕ ПРАВИЛО:
- НЕ добавляй новые боли, которых нет в анализах оптимиста и скептика.
- НЕ ПРИДУМЫВАЙ размеры рынка, метрики, статистику или источники.
- Если оптимист и скептик ссылаются на одни и те же посты — это СИЛЬНЫЙ сигнал.
- Поле "size" в target_audience ДОЛЖНО быть "Требует валидации" если нет реальных данных о размере.

ПРАВИЛА:
1. Не просто усредняй — АНАЛИЗИРУЙ аргументы
2. Для каждой боли взвесь аргументы ЗА и ПРОТИВ
3. Дай уровень уверенности 1-10 для каждого вывода
4. Главная боль — та, у которой больше всего РЕАЛЬНЫХ доказательств
5. Если данных мало — confidence должен быть НИЗКИМ (1-3), не выдумывай

Верни JSON:
{
  "main_pain": "Главная боль с наивысшей уверенностью (на основе данных)",
  "confidence": 7.5,
  "key_pain_points": [
    {
      "pain": "Боль",
      "confidence": 7.5,
      "arguments_for": ["Аргумент оптимиста (с ссылкой на данные)"],
      "arguments_against": ["Контраргумент скептика (с ссылкой)"],
      "verdict": "Финальный вердикт"
    }
  ],
  "target_audience": {
    "segments": [
      {
        "name": "Сегмент",
        "size": "Размер рынка (ЕСЛИ есть данные, иначе 'Требует валидации')",
        "willingness_to_pay": "high/medium/low",
        "where_to_find": "Где искать (из реальных источников: r/subreddit, HN)",
        "confidence": 7.0
      }
    ]
  },
  "risks": ["Риск на основе данных"],
  "opportunities": ["Возможность на основе данных"],
  "final_recommendation": "Итоговая рекомендация",
  "analysis_metadata": {
    "optimist_summary": "Краткое резюме оптимиста",
    "skeptic_summary": "Краткое резюме скептика",
    "consensus_reached": true
  }
}`;

async function runAgent(systemPrompt: string, userPrompt: string): Promise<{ success: true; content: string } | { success: false; error: OpenAIError }> {
  return callAgent(systemPrompt, userPrompt, { maxRetries: 3, retryDelayMs: 1000 });
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    const rateLimitResult = checkRateLimit(`analysis:${clientIP}`, RATE_LIMITS.analysis);

    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }

    const body: DeepAnalysisRequest = await request.json();

    if (!body.trend_title) {
      return NextResponse.json(
        { success: false, error: 'Название тренда обязательно' },
        { status: 400 }
      );
    }

    // === STEP 0: ПОЛУЧАЕМ ДАННЫЕ (из Evidence или собираем сами) ===
    console.log(`[deep-analysis] Starting for: ${body.trend_title}`);
    const dataStartTime = Date.now();

    // Проверяем есть ли готовые Evidence данные
    const complaintsLength = body.evidence_data?.problem?.who_hurts?.complaints?.length ?? 0;
    const negativeReviewsLength = body.evidence_data?.occupation?.why_gaps_exist?.negative_reviews?.length ?? 0;
    const unmetNeedsLength = body.evidence_data?.occupation?.why_gaps_exist?.unmet_needs?.length ?? 0;
    const hasEvidenceData = complaintsLength > 0;
    const hasOccupationData = negativeReviewsLength > 0 || unmetNeedsLength > 0;

    let complaints: EvidenceComplaint[] = [];
    let negativeReviews: EvidenceNegativeReview[] = [];
    let unmetNeeds: EvidenceUnmetNeed[] = [];
    let severityScore = 0;
    let frequencyScore = 0;
    let totalSerpApiCalls = 0;
    let dataSource: 'evidence_blocks' | 'direct_fetch' = 'direct_fetch';

    // Данные для совместимости со старым форматом
    let redditData = { total_results: 0, data: [] as Array<{ title: string; subreddit: string; score: number; num_comments: number; url: string; snippet?: string }>, serpapi_calls_used: 0 };
    let hnData = { total_results: 0, data: [] as Array<{ title: string; points: number; url: string; snippet?: string }>, serpapi_calls_used: 0 };
    let quoraData = { total_results: 0, data: [] as Array<{ title: string; url: string; snippet?: string }>, serpapi_calls_used: 0 };
    let soData = { total_results: 0, data: [] as Array<{ title: string; url: string; votes: number; answers: number }>, serpapi_calls_used: 0 };

    if (hasEvidenceData) {
      // === ИСПОЛЬЗУЕМ ГОТОВЫЕ EVIDENCE ДАННЫЕ ===
      console.log(`[deep-analysis] Using Evidence data (problem + occupation)`);
      dataSource = 'evidence_blocks';

      // Из блока "Проблема"
      complaints = body.evidence_data!.problem!.who_hurts!.complaints;
      severityScore = body.evidence_data!.problem!.who_hurts!.severity_score?.value || 5;
      frequencyScore = body.evidence_data!.problem!.how_often?.frequency_score?.value || 5;

      // Из блока "Рынок" (если есть)
      if (hasOccupationData) {
        negativeReviews = body.evidence_data!.occupation!.why_gaps_exist!.negative_reviews || [];
        unmetNeeds = body.evidence_data!.occupation!.why_gaps_exist!.unmet_needs || [];
        console.log(`[deep-analysis] + Occupation data: ${negativeReviews.length} negative reviews, ${unmetNeeds.length} unmet needs`);
      }

      console.log(`[deep-analysis] Evidence data loaded: ${complaints.length} complaints, severity=${severityScore}, frequency=${frequencyScore}`);

    } else {
      // === FALLBACK: Собираем данные сами (старый подход) ===
      console.log(`[deep-analysis] No Evidence data, falling back to direct fetch`);

      const searchTerm = body.source_query || body.trend_title;
      const [fetchedReddit, fetchedHn, fetchedQuora, fetchedSo] = await Promise.all([
        fetchReddit(searchTerm),
        fetchHackerNews(searchTerm),
        fetchQuora(searchTerm),
        fetchStackOverflow(searchTerm),
      ]);

      redditData = fetchedReddit;
      hnData = fetchedHn;
      quoraData = fetchedQuora;
      soData = fetchedSo;

      totalSerpApiCalls = redditData.serpapi_calls_used + hnData.serpapi_calls_used + quoraData.serpapi_calls_used + soData.serpapi_calls_used;

      // Конвертируем в формат complaints для совместимости
      complaints = [
        ...redditData.data.map(p => ({
          text: p.title,
          source: 'reddit',
          source_url: p.url,
          engagement: p.score + p.num_comments,
        })),
        ...hnData.data.map(p => ({
          text: p.title,
          source: 'hacker_news',
          source_url: p.url,
          engagement: p.points,
        })),
        ...quoraData.data.map(p => ({
          text: p.title,
          source: 'quora',
          source_url: p.url,
          engagement: 0,
        })),
        ...soData.data.map(p => ({
          text: p.title,
          source: 'stackoverflow',
          source_url: p.url,
          engagement: p.votes,
        })),
      ];
    }

    const dataTime = Date.now() - dataStartTime;
    console.log(`[deep-analysis] Data ready in ${dataTime}ms: ${complaints.length} complaints, ${negativeReviews.length} negative reviews, ${unmetNeeds.length} unmet needs (source: ${dataSource})`);

    // Для совместимости со старым кодом
    if (!hasEvidenceData) {
      console.log(`[deep-analysis] Direct fetch stats: Reddit=${redditData.total_results}, HN=${hnData.total_results}, Quora=${quoraData.total_results}, SO=${soData.total_results}`);
    }

    // === GUARD: Минимум данных для анализа ===
    const totalRealSignals = complaints.length + negativeReviews.length + unmetNeeds.length;
    if (totalRealSignals < 3) {
      console.log(`[deep-analysis] Insufficient data: only ${totalRealSignals} signals. Skipping AI agents.`);
      return NextResponse.json({
        success: true,
        insufficient_data: true,
        analysis: null,
        message: `Недостаточно реальных данных для глубокого анализа. Найдено сигналов: ${totalRealSignals} (минимум: 3). Попробуйте сначала собрать Evidence данные.`,
        real_data_summary: {
          data_source: dataSource,
          complaints_count: complaints.length,
          negative_reviews_count: negativeReviews.length,
          unmet_needs_count: unmetNeeds.length,
          total_signals: totalRealSignals,
        },
        metadata: {
          data_collection_time_ms: dataTime,
          skipped_reason: 'insufficient_data',
        },
        timestamp: new Date().toISOString()
      });
    }

    // Format real data for agents
    let realDataSection = '';

    if (hasEvidenceData) {
      // === НОВЫЙ ФОРМАТ: Данные из Evidence блоков ===
      realDataSection = `
## РЕАЛЬНЫЕ ДАННЫЕ ИЗ EVIDENCE БЛОКОВ (используй ТОЛЬКО их):

### Жалобы пользователей (${complaints.length} найдено, severity: ${severityScore}/10, frequency: ${frequencyScore}/10):
${complaints.length > 0
  ? complaints.slice(0, 15).map((c, i) =>
    `${i + 1}. [${c.source}] "${c.text}" (engagement: ${c.engagement})
   URL: ${c.source_url}`
  ).join('\n\n')
  : 'Нет данных о жалобах'}

### ⚠️ НЕГАТИВНЫЕ ОТЗЫВЫ о конкурентах (${negativeReviews.length} найдено) — КЛЮЧЕВОЙ ИСТОЧНИК:
${negativeReviews.length > 0
  ? negativeReviews.slice(0, 10).map((r, i) =>
    `${i + 1}. [${r.source}] "${r.title}"
   URL: ${r.url}
   ${r.snippet ? `Отрывок: ${r.snippet}` : ''}`
  ).join('\n\n')
  : 'Нет негативных отзывов (это может означать высокую удовлетворённость или отсутствие данных)'}

### 🎯 ЧТО ХОЧЕТ РЫНОК — Unmet Needs (${unmetNeeds.length} найдено):
${unmetNeeds.length > 0
  ? unmetNeeds.slice(0, 10).map((u, i) =>
    `${i + 1}. [Reddit${u.subreddit ? ` r/${u.subreddit}` : ''}] "${u.title}" ${u.score ? `(${u.score} upvotes)` : ''}
   URL: ${u.url}`
  ).join('\n\n')
  : 'Нет данных о недостающих функциях'}`;

    } else {
      // === СТАРЫЙ ФОРМАТ: Fallback на прямые данные ===
      realDataSection = `
## РЕАЛЬНЫЕ ДАННЫЕ ИЗ ИСТОЧНИКОВ (используй ТОЛЬКО их):

### Reddit (${redditData.total_results} постов найдено):
${redditData.data.length > 0
  ? redditData.data.slice(0, 10).map((p, i) =>
    `${i + 1}. "${p.title}" (r/${p.subreddit}, ${p.score} upvotes, ${p.num_comments} comments)
   URL: ${p.url}
   Текст: ${p.snippet || 'N/A'}`
  ).join('\n\n')
  : 'Нет данных (ни одного поста не найдено)'}

### Hacker News (${hnData.total_results} постов):
${hnData.data.length > 0
  ? hnData.data.slice(0, 7).map((p, i) =>
    `${i + 1}. "${p.title}" (${p.points} points)
   URL: ${p.url}
   Текст: ${p.snippet || 'N/A'}`
  ).join('\n\n')
  : 'Нет данных'}

### Quora (${quoraData.total_results} вопросов):
${quoraData.data.length > 0
  ? quoraData.data.slice(0, 5).map((p, i) =>
    `${i + 1}. "${p.title}"
   URL: ${p.url}
   Отрывок: ${p.snippet || 'N/A'}`
  ).join('\n\n')
  : 'Нет данных'}

### Stack Overflow (${soData.total_results} вопросов):
${soData.data.length > 0
  ? soData.data.slice(0, 5).map((p, i) =>
    `${i + 1}. "${p.title}" (${p.votes} votes, ${p.answers} answers)
   URL: ${p.url}`
  ).join('\n\n')
  : 'Нет данных'}`;
    }

    const userPrompt = `Проанализируй нишу/тренд:

**Название:** ${body.trend_title}
**Категория:** ${body.trend_category || 'Не указана'}
**Почему актуально:** ${body.why_trending || 'Не указано'}

${body.existing_analysis?.main_pain ? `**Предварительный анализ боли:** ${body.existing_analysis.main_pain}` : ''}
${body.existing_analysis?.key_pain_points?.length ? `**Выявленные боли:** ${body.existing_analysis.key_pain_points.join(', ')}` : ''}

${realDataSection}

Проведи глубокий анализ болей в этой нише, ОПИРАЯСЬ ИСКЛЮЧИТЕЛЬНО на предоставленные данные выше.`;

    // === STEP 1: Run Optimist and Skeptic in PARALLEL ===
    console.log('[deep-analysis] Starting parallel analysis: Optimist + Skeptic (with real data)');
    const startTime = Date.now();

    const [optimistResult, skepticResult] = await Promise.all([
      runAgent(OPTIMIST_PROMPT, userPrompt),
      runAgent(SKEPTIC_PROMPT, userPrompt)
    ]);

    const parallelTime = Date.now() - startTime;
    console.log(`[deep-analysis] Parallel analysis completed in ${parallelTime}ms`);

    if (!optimistResult.success) {
      return NextResponse.json(
        { success: false, error: formatErrorForUser(optimistResult.error), errorCode: optimistResult.error.code },
        { status: 500 }
      );
    }
    if (!skepticResult.success) {
      return NextResponse.json(
        { success: false, error: formatErrorForUser(skepticResult.error), errorCode: skepticResult.error.code },
        { status: 500 }
      );
    }

    const optimistAnalysis = parseJSONResponse<AgentResponse>(optimistResult.content);
    const skepticAnalysis = parseJSONResponse<AgentResponse>(skepticResult.content);

    if (!optimistAnalysis || !skepticAnalysis) {
      return NextResponse.json(
        { success: false, error: 'Не удалось распознать ответ AI. Попробуйте ещё раз.' },
        { status: 500 }
      );
    }

    // === STEP 2: Run Arbiter with both analyses ===
    console.log('[deep-analysis] Starting arbitration');
    const arbiterStartTime = Date.now();

    // Формируем промпт для арбитра с учётом источника данных
    let arbiterDataSummary = '';
    if (hasEvidenceData) {
      arbiterDataSummary = `
## РЕАЛЬНЫЕ ДАННЫЕ ИЗ EVIDENCE (для справки):
- Жалобы пользователей: ${complaints.length} (severity: ${severityScore}/10, frequency: ${frequencyScore}/10)
- Общий engagement: ${complaints.reduce((s, c) => s + c.engagement, 0)}
- ⚠️ Негативные отзывы о конкурентах: ${negativeReviews.length} — ЭТО КЛЮЧЕВОЙ ИНДИКАТОР!
- 🎯 Unmet needs (чего хочет рынок): ${unmetNeeds.length}
- Источник данных: Evidence блоки (pre-analyzed)`;
    } else {
      arbiterDataSummary = `
## РЕАЛЬНЫЕ ДАННЫЕ (для справки):
- Reddit: ${redditData.total_results} постов (engagement: ${redditData.data.reduce((s, p) => s + p.score + p.num_comments, 0)})
- Hacker News: ${hnData.total_results} постов (points: ${hnData.data.reduce((s, p) => s + p.points, 0)})
- Quora: ${quoraData.total_results} вопросов
- Stack Overflow: ${soData.total_results} вопросов
- Источник данных: Direct fetch`;
    }

    const arbiterUserPrompt = `Вот два анализа ниши "${body.trend_title}":

## АНАЛИЗ ОПТИМИСТА:
${JSON.stringify(optimistAnalysis, null, 2)}

## АНАЛИЗ СКЕПТИКА:
${JSON.stringify(skepticAnalysis, null, 2)}
${arbiterDataSummary}

Синтезируй эти два мнения в объективный финальный анализ.
ПОМНИ:
- confidence должен отражать количество реальных данных. Мало данных = низкий confidence.
- Негативные отзывы о конкурентах — СИЛЬНЫЙ сигнал о реальной боли!
- Unmet needs показывают что РЕАЛЬНО хочет рынок.`;

    const arbiterResult = await runAgent(ARBITER_PROMPT, arbiterUserPrompt);
    const arbiterTime = Date.now() - arbiterStartTime;
    console.log(`[deep-analysis] Arbitration completed in ${arbiterTime}ms`);

    if (!arbiterResult.success) {
      return NextResponse.json(
        { success: false, error: formatErrorForUser(arbiterResult.error), errorCode: arbiterResult.error.code },
        { status: 500 }
      );
    }

    const arbitrationResult = parseJSONResponse<ArbitrationResult>(arbiterResult.content);

    if (!arbitrationResult) {
      return NextResponse.json(
        { success: false, error: 'Не удалось синтезировать анализ. Попробуйте ещё раз.' },
        { status: 500 }
      );
    }

    // === STEP 3: Adjust confidence based on data volume ===
    let totalDataPoints: number;
    let dataConfidenceFactor: number;

    if (hasEvidenceData) {
      // Для Evidence данных учитываем все источники + бонус за negative reviews
      totalDataPoints = complaints.length + negativeReviews.length * 2 + unmetNeeds.length * 1.5;
      // Negative reviews и unmet needs повышают уверенность
      const hasStrongSignals = negativeReviews.length >= 3 || unmetNeeds.length >= 3;
      dataConfidenceFactor = totalDataPoints >= 25 ? 1.0 :
                             totalDataPoints >= 15 ? (hasStrongSignals ? 0.95 : 0.85) :
                             totalDataPoints >= 8 ? (hasStrongSignals ? 0.8 : 0.7) :
                             0.5;
    } else {
      totalDataPoints = redditData.total_results + hnData.total_results + quoraData.total_results + soData.total_results;
      dataConfidenceFactor = totalDataPoints >= 20 ? 1.0 : totalDataPoints >= 10 ? 0.8 : totalDataPoints >= 5 ? 0.6 : 0.4;
    }

    // Корректируем confidence на основе реального объёма данных
    arbitrationResult.confidence = Math.round(arbitrationResult.confidence * dataConfidenceFactor * 10) / 10;
    for (const point of arbitrationResult.key_pain_points) {
      point.confidence = Math.round(point.confidence * dataConfidenceFactor * 10) / 10;
    }

    arbitrationResult.analysis_metadata = {
      ...arbitrationResult.analysis_metadata,
      analysis_depth: 'deep'
    };

    const totalTime = Date.now() - startTime;
    console.log(`[deep-analysis] Total time: ${totalTime}ms, SerpAPI calls: ${totalSerpApiCalls}`);

    return NextResponse.json({
      success: true,
      analysis: arbitrationResult,
      raw_analyses: {
        optimist: optimistAnalysis,
        skeptic: skepticAnalysis
      },
      real_data_summary: hasEvidenceData ? {
        // Новый формат для Evidence данных
        data_source: 'evidence_blocks',
        complaints_count: complaints.length,
        negative_reviews_count: negativeReviews.length,
        unmet_needs_count: unmetNeeds.length,
        severity_score: severityScore,
        frequency_score: frequencyScore,
        total_data_points: totalDataPoints,
        confidence_factor: dataConfidenceFactor,
        serpapi_calls_used: 0, // Данные уже собраны ранее
      } : {
        // Старый формат для direct fetch
        data_source: 'direct_fetch',
        reddit_posts: redditData.total_results,
        hn_posts: hnData.total_results,
        quora_questions: quoraData.total_results,
        so_questions: soData.total_results,
        total_data_points: totalDataPoints,
        confidence_factor: dataConfidenceFactor,
        serpapi_calls_used: totalSerpApiCalls,
      },
      metadata: {
        data_collection_time_ms: dataTime,
        parallel_time_ms: parallelTime,
        arbitration_time_ms: arbiterTime,
        total_time_ms: totalTime,
        analysis_type: hasEvidenceData ? 'deep_parallel_arbitration_evidence_v2' : 'deep_parallel_arbitration_evidence_based',
        used_evidence_blocks: hasEvidenceData,
        used_occupation_data: hasOccupationData,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Deep analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка глубокого анализа' },
      { status: 500 }
    );
  }
}
