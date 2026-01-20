import { NextRequest, NextResponse } from 'next/server';
import { callAgent, parseJSONResponse, formatErrorForUser, type OpenAIError } from '@/lib/openai';

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

// Agent prompts
const OPTIMIST_PROMPT = `Ты опытный предприниматель и венчурный аналитик, который ВЕРИТ в потенциал этой ниши.

Твоя задача - найти РЕАЛЬНЫЕ боли которые люди ГОТОВЫ ОПЛАТИТЬ.

ПРАВИЛА:
1. Ищи боли с позиции "почему это СРАБОТАЕТ"
2. Приводи конкретные доказательства: цитаты с Reddit, отзывы, форумы, тренды
3. Фокусируйся на болях где люди УЖЕ тратят деньги на неидеальные решения
4. Оценивай готовность платить реалистично

Верни JSON:
{
  "pains": [
    {
      "pain": "Описание боли",
      "evidence": ["Доказательство 1 (источник)", "Доказательство 2"],
      "target_audience": "Кто испытывает эту боль",
      "willingness_to_pay": "high/medium/low с обоснованием",
      "reasoning": "Почему эта боль реальна и решаема"
    }
  ],
  "overall_assessment": "Общая оценка потенциала ниши с позиции оптимиста"
}`;

const SKEPTIC_PROMPT = `Ты опытный инвестор который видел 1000+ провальных стартапов. Ты СКЕПТИК.

Твоя задача - найти боли, но для КАЖДОЙ указать почему предыдущие решения НЕ сработали.

ПРАВИЛА:
1. Ищи боли с позиции "что может пойти НЕ ТАК"
2. Для каждой боли укажи: почему существующие решения не справляются?
3. Ищи скрытые проблемы: регуляции, конкуренция, unit economics
4. Оценивай реалистично - многие "боли" на самом деле не критичны

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

const ARBITER_PROMPT = `Ты Senior Product Strategist с 20+ лет опыта. Тебе дали два анализа одной ниши:

1. ОПТИМИСТ видит потенциал
2. СКЕПТИК видит риски

Твоя задача - СИНТЕЗИРОВАТЬ оба мнения в объективный анализ.

ПРАВИЛА:
1. Не просто усредняй - АНАЛИЗИРУЙ аргументы
2. Для каждой боли взвесь аргументы ЗА и ПРОТИВ
3. Дай уровень уверенности 1-10 для каждого вывода
4. Укажи что нужно проверить перед запуском

Верни JSON:
{
  "main_pain": "Главная боль с наивысшей уверенностью",
  "confidence": 8.5,
  "key_pain_points": [
    {
      "pain": "Боль",
      "confidence": 7.5,
      "arguments_for": ["Аргумент оптимиста 1", "Аргумент 2"],
      "arguments_against": ["Контраргумент скептика 1", "Контраргумент 2"],
      "verdict": "Финальный вердикт по этой боли"
    }
  ],
  "target_audience": {
    "segments": [
      {
        "name": "Сегмент",
        "size": "Размер рынка",
        "willingness_to_pay": "high/medium/low",
        "where_to_find": "Где искать этих людей",
        "confidence": 8.0
      }
    ]
  },
  "risks": ["Главный риск 1", "Риск 2"],
  "opportunities": ["Возможность 1", "Возможность 2"],
  "final_recommendation": "Итоговая рекомендация: стоит ли заходить в эту нишу и как",
  "analysis_metadata": {
    "optimist_summary": "Краткое резюме позиции оптимиста",
    "skeptic_summary": "Краткое резюме позиции скептика",
    "consensus_reached": true
  }
}`;

// Wrapper для callAgent с обработкой ошибок
async function runAgent(systemPrompt: string, userPrompt: string): Promise<{ success: true; content: string } | { success: false; error: OpenAIError }> {
  return callAgent(systemPrompt, userPrompt, { maxRetries: 3, retryDelayMs: 1000 });
}

export async function POST(request: NextRequest) {
  try {
    const body: DeepAnalysisRequest = await request.json();

    if (!body.trend_title) {
      return NextResponse.json(
        { success: false, error: 'Название тренда обязательно' },
        { status: 400 }
      );
    }

    const userPrompt = `Проанализируй нишу/тренд:

**Название:** ${body.trend_title}
**Категория:** ${body.trend_category || 'Не указана'}
**Почему актуально:** ${body.why_trending || 'Не указано'}

${body.existing_analysis?.main_pain ? `**Предварительный анализ боли:** ${body.existing_analysis.main_pain}` : ''}
${body.existing_analysis?.key_pain_points?.length ? `**Выявленные боли:** ${body.existing_analysis.key_pain_points.join(', ')}` : ''}

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

    // Проверяем ошибки от агентов
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

    const arbiterUserPrompt = `Вот два анализа ниши "${body.trend_title}":

## АНАЛИЗ ОПТИМИСТА:
${JSON.stringify(optimistAnalysis, null, 2)}

## АНАЛИЗ СКЕПТИКА:
${JSON.stringify(skepticAnalysis, null, 2)}

Синтезируй эти два мнения в объективный финальный анализ.`;

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

    // Add analysis depth marker
    arbitrationResult.analysis_metadata = {
      ...arbitrationResult.analysis_metadata,
      analysis_depth: 'deep'
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
        analysis_type: 'deep_parallel_arbitration'
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
