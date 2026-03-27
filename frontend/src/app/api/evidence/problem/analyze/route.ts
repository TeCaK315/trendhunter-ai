// /api/evidence/problem/analyze — Intelligence Layer для Block 1
// Sonnet интерпретирует данные Block 1 и генерирует аналитику на языке предпринимателя
// GET ?trend_id=xxx — читает block_results, кэширует результат

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

const claude = new Anthropic()

// ══════════════════════════════════════════════════════════════
// SONNET ПРОМПТ
// ══════════════════════════════════════════════════════════════

function buildPrompt(input: IntelligenceInput): string {
  const clustersBlock = input.pain_clusters.length > 0
    ? input.pain_clusters.slice(0, 5).map((c, i) =>
        `${i + 1}. "${c.pain_summary}" — ${c.mention_count} упоминаний, ${c.source_count} источников, confidence: ${c.confidence}`
      ).join('\n')
    : 'Кластеров не обнаружено'

  const topQuoteText = input.top_quote_text || 'нет данных'
  const topQuoteSource = input.top_quote_source || ''

  const clustersJsonTemplate = input.pain_clusters.slice(0, 5).map(c => `{
      "cluster_name": "${c.pain_summary.slice(0, 50).replace(/"/g, '\\"')}",
      "strategic_meaning": "Что это значит для бизнеса. Макс 20 слов.",
      "block4_connection": "→ Блок 4 проверит: [конкретный вопрос про конкурентов]. Макс 15 слов."
    }`).join(',\n    ')

  const conclusionInstruction = input.diagnosis === 'green'
    ? 'Что это значит для стратегии входа. Мост к следующим блокам.'
    : input.diagnosis === 'yellow'
    ? 'Почему слабый сигнал и что делать дальше.'
    : 'Что сохранил пользователь и какие смежные ниши стоит проверить.'

  return `Ты аналитик рынка. Тебе переданы реальные данные из исследования ниши.
Твоя задача: интерпретировать данные и дать выводы на языке предпринимателя.

СТРОГИЕ ПРАВИЛА:
- Только то что следует из переданных данных. Никаких домыслов.
- Если данных недостаточно для вывода — пиши "Недостаточно данных"
- Все текстовые поля — на русском языке
- Соблюдай лимиты длины для каждого поля

ДАННЫЕ ДЛЯ АНАЛИЗА:
Ниша: ${input.niche}
Диагноз: ${input.diagnosis} (${input.score}/10)
Тип боли: ${input.pain_type}
Динамика: ${input.dynamics}
Хроническая боль: ${input.pain_is_chronic}

Распределение жалоб:
- Плохая реализация: ${input.distribution.bad_solution ?? 0}%
- Нет решения: ${input.distribution.no_solution ?? 0}%
- Слишком дорого: ${input.distribution.expensive_solution ?? 0}%

Сигнал боли:
- Взвешенный счёт: ${input.weighted_complaints_score}
- Paying score: ${input.paying_score}
- Validated жалоб: ${input.data_quality.validated_relevant} из ${input.data_quality.total_collected} собранных

Кластеры боли (топ):
${clustersBlock}

Топ цитата: "${topQuoteText}" (${topQuoteSource})

Верни СТРОГО валидный JSON без markdown, без пояснений:

{
  "analysis_summary": "2 предложения что делалось. Макс 40 слов.",

  "verdict_phrase": "Живая фраза-вывод. Макс 12 слов.",
  "verdict_sub": "Подзаголовок с контекстом. Макс 20 слов.",
  "key_factors": [
    "Фактор 1 который определил диагноз. Макс 15 слов.",
    "Фактор 2. Макс 15 слов.",
    "Фактор 3. Макс 15 слов."
  ],
  "counterfact": "Что могло сделать диагноз хуже но не сделало. Макс 20 слов.",

  "card_signal": {
    "label": "Высокий" | "Средний" | "Низкий",
    "explanation": "Почему такой уровень сигнала. Макс 30 слов.",
    "source_breakdown": "Откуда данные без формул. Пример: из 15 постов 8 с G2 и Trustpilot. Макс 20 слов."
  },

  "card_dynamics": {
    "label": "Растёт" | "Хроническая" | "Падает" | "Стабильная",
    "explanation": "Почему такая динамика. Макс 30 слов.",
    "is_chronic": ${input.pain_is_chronic},
    "chronic_explanation": "${input.pain_is_chronic ? 'Что хроническая боль значит для входа на рынок.' : ''}"
  },

  "card_paying": {
    "label": "Платящие покупатели" | "Смешанная аудитория" | "Случайные пользователи",
    "explanation": "Кто жалуется и почему это важно. Макс 30 слов.",
    "context": "B2B или B2C контекст и что это значит для цикла продажи. Макс 20 слов."
  },

  "pain_types_analysis": {
    "dominant_type": "${input.pain_type}",
    "dominant_strategy": "Стратегический смысл доминирующего типа для входа на рынок. Макс 25 слов.",
    "other_types_note": "Про остальные типы боли коротко. Макс 20 слов."
  },

  "clusters_enriched": [
    ${clustersJsonTemplate || ''}
  ],

  "conclusion_${input.diagnosis}": "Итоговый вывод под текущий диагноз. ${conclusionInstruction} Макс 40 слов.",

  "analytical_context": "Почему эта боль существует исходя из данных кластеров. Психотип покупателя если следует из данных. Только из переданных данных. Макс 80 слов.",

  "top_quote": "Скопируй сюда самую яркую цитату из данных выше без изменений. Макс 150 символов.",
  "top_quote_source": "Источник цитаты (reddit, g2, hackernews и т.д.)"
}`
}

// ══════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════

interface PainClusterInput {
  pain_summary: string
  mention_count: number
  source_count: number
  confidence: string
  category: string
}

interface IntelligenceInput {
  niche: string
  diagnosis: string
  score: number
  pain_type: string
  dynamics: string
  pain_is_chronic: boolean
  distribution: {
    bad_solution?: number
    no_solution?: number
    expensive_solution?: number
  }
  weighted_complaints_score: number
  paying_score: number
  data_quality: {
    total_collected: number
    validated_relevant: number
  }
  pain_clusters: PainClusterInput[]
  top_quote_text: string
  top_quote_source: string
}

// ══════════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const trend_id = searchParams.get('trend_id')

  if (!trend_id) {
    return NextResponse.json({ error: 'trend_id required' }, { status: 400 })
  }

  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServerSupabase()

  // Читаем block_results для Block 1
  const { data: blockResult, error: dbErr } = await supabase
    .from('block_results')
    .select('*')
    .eq('trend_id', trend_id)
    .eq('user_id', user.id)
    .eq('block_number', 1)
    .maybeSingle()

  if (dbErr || !blockResult) {
    return NextResponse.json(
      { error: 'Block 1 данные не найдены. Сначала запустите анализ проблемы.' },
      { status: 404 }
    )
  }

  // Проверяем кэш — если intelligence_output уже есть, возвращаем
  if (blockResult.intelligence_output) {
    return NextResponse.json({
      cached: true,
      data: blockResult.intelligence_output,
    })
  }

  // ── Собираем input из block_context (плоское) + raw_data (clusters/quotes) ──
  const ctx = blockResult.block_context || {}
  const premium = blockResult.raw_data?.premium || {}

  // Извлекаем top quote из top_quotes (Record<PainCategory, Quote[]>)
  let topQuoteText = ''
  let topQuoteSource = ''
  if (premium.top_quotes) {
    for (const quotes of Object.values(premium.top_quotes)) {
      if (Array.isArray(quotes) && quotes.length > 0) {
        const q = (quotes as any[])[0]
        topQuoteText = q.text || ''
        topQuoteSource = q.source || ''
        break
      }
    }
  }

  const input: IntelligenceInput = {
    niche: ctx.niche || '',
    diagnosis: blockResult.diagnosis || 'yellow',
    score: blockResult.score ?? 5,
    pain_type: ctx.pain_type || 'bad_solution',
    dynamics: ctx.dynamics || 'stable',
    pain_is_chronic: ctx.pain_is_chronic || false,
    distribution: ctx.distribution || {},
    weighted_complaints_score: ctx.weighted_complaints_score || 0,
    paying_score: ctx.paying_score || 0,
    data_quality: {
      total_collected: ctx.data_quality?.total_collected || 0,
      validated_relevant: ctx.data_quality?.validated_relevant || 0,
    },
    pain_clusters: (premium.pain_clusters || []).slice(0, 5),
    top_quote_text: topQuoteText,
    top_quote_source: topQuoteSource,
  }

  // Проверка минимума данных
  if (!input.niche) {
    return NextResponse.json(
      { error: 'block_context.niche отсутствует. Перезапустите анализ Block 1.' },
      { status: 422 }
    )
  }

  // ── Sonnet анализ ──
  try {
    const prompt = buildPrompt(input)

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2500,
      system: 'Respond with valid JSON only, no markdown, no code blocks, no explanations.',
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const cleaned = text.replace(/```json|```/g, '').trim()
    const intelligenceOutput = JSON.parse(cleaned)

    // Сохраняем в кэш
    await supabase
      .from('block_results')
      .update({
        intelligence_output: intelligenceOutput,
        intelligence_updated_at: new Date().toISOString(),
      })
      .eq('id', blockResult.id)

    return NextResponse.json({ cached: false, data: intelligenceOutput })
  } catch (error: any) {
    console.error('[Intelligence Layer Block 1]', error)

    // Fallback — не крашим UI, возвращаем 200 с флагом
    return NextResponse.json({
      error: 'Intelligence Layer unavailable',
      fallback: true,
      message: error.message || 'Sonnet analysis failed',
    })
  }
}
