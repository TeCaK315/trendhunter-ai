import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse, formatErrorForUser, type OpenAIError } from '@/lib/openai';

interface NicheDeepAnalysisRequest {
  niche: string;
  description: string;
  targetAudience?: string;
  existingProblems?: string;
  sources?: {
    reddit?: {
      posts: Array<{ title: string; subreddit: string; score: number; selftext?: string }>;
      communities: string[];
    };
    youtube?: {
      videos: Array<{ title: string; channel: string; description: string }>;
    };
    google_trends?: {
      growth_rate: number;
      related_queries: Array<{ query: string; growth: string }>;
    };
    synthesis?: {
      key_insights: string[];
      sentiment_summary: string;
      content_gaps: string[];
      recommended_angles: string[];
    };
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
    severity: number;
    arguments_for: string[];
    arguments_against: string[];
    verdict: string;
  }>;
  target_audience: {
    primary: string;
    segments: Array<{
      name: string;
      size: string;
      willingness_to_pay: string;
      where_to_find: string;
      communication_channels: string[];
      confidence: number;
    }>;
  };
  risks: string[];
  opportunities: Array<{
    opportunity: string;
    potential_revenue: string;
    implementation_difficulty: string;
    time_to_market: string;
  }>;
  recommended_solutions: Array<{
    type: string;
    description: string;
    mvp_features: string[];
    estimated_cost: string;
    monetization: string;
  }>;
  final_recommendation: string;
  analysis_metadata: {
    optimist_summary: string;
    skeptic_summary: string;
    consensus_reached: boolean;
    analysis_depth: 'deep';
    data_sources_used: string[];
  };
}

// Optimist agent prompt
const OPTIMIST_PROMPT = `Ты опытный предприниматель и венчурный аналитик, который ВЕРИТ в потенциал этой ниши.

Твоя задача - найти РЕАЛЬНЫЕ боли которые люди ГОТОВЫ ОПЛАТИТЬ.

ПРАВИЛА:
1. Ищи боли с позиции "почему это СРАБОТАЕТ"
2. Если даны реальные данные (Reddit, YouTube, Google Trends) - используй их как доказательства
3. Фокусируйся на болях где люди УЖЕ тратят деньги на неидеальные решения
4. Оценивай готовность платить реалистично

Верни JSON:
{
  "pains": [
    {
      "pain": "Описание боли",
      "evidence": ["Доказательство 1 (из данных или логики)", "Доказательство 2"],
      "target_audience": "Кто испытывает эту боль",
      "willingness_to_pay": "high/medium/low с обоснованием",
      "reasoning": "Почему эта боль реальна и решаема"
    }
  ],
  "overall_assessment": "Общая оценка потенциала ниши с позиции оптимиста"
}`;

// Skeptic agent prompt
const SKEPTIC_PROMPT = `Ты опытный инвестор который видел 1000+ провальных стартапов. Ты СКЕПТИК.

Твоя задача - найти боли, но для КАЖДОЙ указать почему предыдущие решения НЕ сработали.

ПРАВИЛА:
1. Ищи боли с позиции "что может пойти НЕ ТАК"
2. Если даны реальные данные - ищи противоречия и слабые места
3. Для каждой боли укажи: почему существующие решения не справляются?
4. Ищи скрытые проблемы: регуляции, конкуренция, unit economics
5. Оценивай реалистично - многие "боли" на самом деле не критичны

Верни JSON:
{
  "pains": [
    {
      "pain": "Описание боли",
      "evidence": ["Почему это проблема", "Но вот контраргумент"],
      "target_audience": "Кто испытывает + почему они могут НЕ платить",
      "willingness_to_pay": "high/medium/low с критическим обоснованием",
      "reasoning": "Почему предыдущие решения провалились и что может пойти не так"
    }
  ],
  "overall_assessment": "Критическая оценка ниши - главные риски и почему 90% стартапов тут провалятся"
}`;

// Arbiter agent prompt
const ARBITER_PROMPT = `Ты Senior Product Strategist с 20+ лет опыта. Тебе дали два анализа одной ниши:

1. ОПТИМИСТ видит потенциал
2. СКЕПТИК видит риски

Твоя задача - СИНТЕЗИРОВАТЬ оба мнения в объективный анализ и дать конкретные рекомендации по решениям.

ПРАВИЛА:
1. Не просто усредняй - АНАЛИЗИРУЙ аргументы
2. Для каждой боли взвесь аргументы ЗА и ПРОТИВ
3. Дай уровень уверенности 1-10 для каждого вывода
4. Предложи конкретные решения (SaaS, приложение, автоматизация и т.д.)
5. Укажи что нужно проверить перед запуском

Верни JSON:
{
  "main_pain": "Главная боль с наивысшей уверенностью",
  "confidence": 8.5,
  "key_pain_points": [
    {
      "pain": "Боль",
      "confidence": 7.5,
      "severity": 8,
      "arguments_for": ["Аргумент оптимиста 1", "Аргумент 2"],
      "arguments_against": ["Контраргумент скептика 1", "Контраргумент 2"],
      "verdict": "Финальный вердикт по этой боли"
    }
  ],
  "target_audience": {
    "primary": "Основная целевая аудитория",
    "segments": [
      {
        "name": "Сегмент",
        "size": "Размер рынка",
        "willingness_to_pay": "high/medium/low",
        "where_to_find": "Где искать этих людей",
        "communication_channels": ["канал1", "канал2"],
        "confidence": 8.0
      }
    ]
  },
  "risks": ["Главный риск 1", "Риск 2"],
  "opportunities": [
    {
      "opportunity": "Возможность",
      "potential_revenue": "Потенциальный доход",
      "implementation_difficulty": "легко/средне/сложно",
      "time_to_market": "Время до запуска"
    }
  ],
  "recommended_solutions": [
    {
      "type": "SaaS/мобильное приложение/автоматизация/консалтинг",
      "description": "Описание решения",
      "mvp_features": ["фича1", "фича2", "фича3"],
      "estimated_cost": "Примерная стоимость разработки",
      "monetization": "Модель монетизации"
    }
  ],
  "final_recommendation": "Итоговая рекомендация: стоит ли заходить в эту нишу и как",
  "analysis_metadata": {
    "optimist_summary": "Краткое резюме позиции оптимиста",
    "skeptic_summary": "Краткое резюме позиции скептика",
    "consensus_reached": true,
    "data_sources_used": ["Reddit", "Google Trends", "YouTube"]
  }
}`;

// Wrapper for callAgent with error handling
async function runAgent(systemPrompt: string, userPrompt: string): Promise<{ success: true; content: string } | { success: false; error: OpenAIError }> {
  return callAgent(systemPrompt, userPrompt, { maxRetries: 3, retryDelayMs: 1000 });
}

// Format sources data for prompts
function formatSourcesForPrompt(sources?: NicheDeepAnalysisRequest['sources']): string {
  if (!sources) return 'Реальные данные не предоставлены.';

  const parts: string[] = [];

  if (sources.reddit?.posts?.length) {
    parts.push(`\n## Данные из Reddit (${sources.reddit.posts.length} постов):
${sources.reddit.posts.slice(0, 5).map(p => `- "${p.title}" (${p.score} upvotes, r/${p.subreddit})${p.selftext ? `\n  Контекст: ${p.selftext.slice(0, 200)}...` : ''}`).join('\n')}
Сообщества: ${sources.reddit.communities.join(', ')}`);
  }

  if (sources.google_trends?.growth_rate !== undefined) {
    parts.push(`\n## Данные Google Trends:
- Рост за год: ${sources.google_trends.growth_rate}%
- Связанные запросы: ${sources.google_trends.related_queries?.slice(0, 5).map(q => q.query).join(', ') || 'нет данных'}`);
  }

  if (sources.youtube?.videos?.length) {
    parts.push(`\n## YouTube видео (${sources.youtube.videos.length}):
${sources.youtube.videos.slice(0, 3).map(v => `- "${v.title}" (${v.channel})`).join('\n')}`);
  }

  if (sources.synthesis?.key_insights?.length) {
    parts.push(`\n## Предварительный AI-синтез данных:
Инсайты: ${sources.synthesis.key_insights.join('; ')}
Настроение аудитории: ${sources.synthesis.sentiment_summary}
Пробелы в контенте: ${sources.synthesis.content_gaps?.join('; ') || 'не выявлены'}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'Реальные данные не предоставлены.';
}

export async function POST(request: NextRequest) {
  try {
    const body: NicheDeepAnalysisRequest = await request.json();

    if (!body.niche) {
      return NextResponse.json(
        { success: false, error: 'Название ниши обязательно' },
        { status: 400 }
      );
    }

    const sourcesText = formatSourcesForPrompt(body.sources);

    const userPrompt = `Проанализируй нишу:

**Ниша:** ${body.niche}
**Описание:** ${body.description || 'Не указано'}
${body.targetAudience ? `**Целевая аудитория:** ${body.targetAudience}` : ''}
${body.existingProblems ? `**Известные проблемы:** ${body.existingProblems}` : ''}

${sourcesText}

Проведи глубокий анализ болей в этой нише.`;

    // Step 1: Run Optimist and Skeptic in PARALLEL
    console.log('Starting parallel analysis: Optimist + Skeptic');
    const startTime = Date.now();

    const [optimistResult, skepticResult] = await Promise.all([
      runAgent(OPTIMIST_PROMPT, userPrompt),
      runAgent(SKEPTIC_PROMPT, userPrompt)
    ]);

    const parallelTime = Date.now() - startTime;
    console.log(`Parallel analysis completed in ${parallelTime}ms`);

    // Check for errors
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

    // Step 2: Run Arbiter with both analyses
    console.log('Starting arbitration');
    const arbiterStartTime = Date.now();

    const arbiterUserPrompt = `Вот два анализа ниши "${body.niche}":

## АНАЛИЗ ОПТИМИСТА:
${JSON.stringify(optimistAnalysis, null, 2)}

## АНАЛИЗ СКЕПТИКА:
${JSON.stringify(skepticAnalysis, null, 2)}

## ИСХОДНЫЕ ДАННЫЕ:
${sourcesText}

Синтезируй эти два мнения в объективный финальный анализ с конкретными рекомендациями по решениям.`;

    const arbiterResult = await runAgent(ARBITER_PROMPT, arbiterUserPrompt);
    const arbiterTime = Date.now() - arbiterStartTime;
    console.log(`Arbitration completed in ${arbiterTime}ms`);

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

    // Add metadata
    const dataSourcesUsed: string[] = [];
    if (body.sources?.reddit?.posts?.length) dataSourcesUsed.push('Reddit');
    if (body.sources?.google_trends?.growth_rate !== undefined) dataSourcesUsed.push('Google Trends');
    if (body.sources?.youtube?.videos?.length) dataSourcesUsed.push('YouTube');

    arbitrationResult.analysis_metadata = {
      ...arbitrationResult.analysis_metadata,
      analysis_depth: 'deep',
      data_sources_used: dataSourcesUsed
    };

    const totalTime = Date.now() - startTime;
    console.log(`Total deep analysis time: ${totalTime}ms`);

    return NextResponse.json({
      success: true,
      analysis: arbitrationResult,
      raw_analyses: {
        optimist: optimistAnalysis,
        skeptic: skepticAnalysis
      },
      metadata: {
        parallel_time_ms: parallelTime,
        arbitration_time_ms: arbiterTime,
        total_time_ms: totalTime,
        analysis_type: 'niche_deep_parallel_arbitration'
      },
      niche: body.niche,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Niche deep analysis error:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка глубокого анализа ниши' },
      { status: 500 }
    );
  }
}
