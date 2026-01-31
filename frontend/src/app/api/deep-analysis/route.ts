import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse, formatErrorForUser, type OpenAIError } from '@/lib/openai';
import { checkRateLimit, getClientIP, RATE_LIMITS, createRateLimitResponse } from '@/lib/rateLimit';
import { fetchReddit, fetchHackerNews, fetchQuora, fetchStackOverflow } from '@/lib/data-fetchers';

/**
 * /api/deep-analysis — ПЕРЕРАБОТАННЫЙ
 *
 * БЫЛО: 3 агента генерируют боли из воздуха (100% галлюцинация)
 * СТАЛО:
 *   1. СНАЧАЛА собираем реальные жалобы из Reddit/HN/Quora/SO
 *   2. Передаём реальные данные в агентов (Optimist/Skeptic/Arbiter)
 *   3. Промпт обязывает ссылаться на конкретные посты
 *   4. Confidence score — по формуле, не GPT
 */

interface DeepAnalysisRequest {
  trend_title: string;
  trend_category: string;
  why_trending: string;
  existing_analysis?: {
    main_pain?: string;
    key_pain_points?: string[];
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

ПРАВИЛА:
1. Анализируй ТОЛЬКО предоставленные данные. НЕ выдумывай ничего.
2. Для каждой боли ОБЯЗАТЕЛЬНО укажи конкретный пост/вопрос как доказательство (URL или название)
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

ПРАВИЛА:
1. Анализируй ТОЛЬКО предоставленные данные. НЕ выдумывай.
2. Для каждого аргумента ссылайся на конкретный пост/вопрос
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

ПРАВИЛА:
1. Не просто усредняй — АНАЛИЗИРУЙ аргументы
2. Для каждой боли взвесь аргументы ЗА и ПРОТИВ
3. Дай уровень уверенности 1-10 для каждого вывода
4. Главная боль — та, у которой больше всего РЕАЛЬНЫХ доказательств
5. Если данных мало — confidence должен быть НИЗКИМ, не выдумывай

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

    // === STEP 0: СОБИРАЕМ РЕАЛЬНЫЕ ДАННЫЕ ===
    console.log(`[deep-analysis] Collecting real data for: ${body.trend_title}`);
    const dataStartTime = Date.now();

    const [redditData, hnData, quoraData, soData] = await Promise.all([
      fetchReddit(body.trend_title),
      fetchHackerNews(body.trend_title),
      fetchQuora(body.trend_title),
      fetchStackOverflow(body.trend_title),
    ]);

    const dataTime = Date.now() - dataStartTime;
    console.log(`[deep-analysis] Data collected in ${dataTime}ms: Reddit=${redditData.total_results}, HN=${hnData.total_results}, Quora=${quoraData.total_results}, SO=${soData.total_results}`);

    const totalSerpApiCalls = redditData.serpapi_calls_used + hnData.serpapi_calls_used + quoraData.serpapi_calls_used + soData.serpapi_calls_used;

    // Format real data for agents
    const realDataSection = `
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

    const arbiterUserPrompt = `Вот два анализа ниши "${body.trend_title}":

## АНАЛИЗ ОПТИМИСТА:
${JSON.stringify(optimistAnalysis, null, 2)}

## АНАЛИЗ СКЕПТИКА:
${JSON.stringify(skepticAnalysis, null, 2)}

## РЕАЛЬНЫЕ ДАННЫЕ (для справки):
- Reddit: ${redditData.total_results} постов (engagement: ${redditData.data.reduce((s, p) => s + p.score + p.num_comments, 0)})
- Hacker News: ${hnData.total_results} постов (points: ${hnData.data.reduce((s, p) => s + p.points, 0)})
- Quora: ${quoraData.total_results} вопросов
- Stack Overflow: ${soData.total_results} вопросов

Синтезируй эти два мнения в объективный финальный анализ.
ПОМНИ: confidence должен отражать количество реальных данных. Мало данных = низкий confidence.`;

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
    const totalDataPoints = redditData.total_results + hnData.total_results + quoraData.total_results + soData.total_results;
    const dataConfidenceFactor = totalDataPoints >= 20 ? 1.0 : totalDataPoints >= 10 ? 0.8 : totalDataPoints >= 5 ? 0.6 : 0.4;

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
      real_data_summary: {
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
        analysis_type: 'deep_parallel_arbitration_evidence_based'
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
