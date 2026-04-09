// /api/evidence/demand/analyze — Intelligence Layer для Block 2
// Sonnet интерпретирует данные Block 2 и генерирует аналитику на языке предпринимателя
// GET ?trend_id=xxx — читает block_results, кэширует результат

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

const claude = new Anthropic()

// ══════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════

interface DemandIntelligenceInput {
  niche: string
  diagnosis: string
  score: number
  diagnosis_reason: string
  commercial_intent_ratio: number
  demand_index: number
  trend_direction: string
  growth_12m: number | null
  growth_3m: number | null
  has_hype_risk: boolean
  has_declining_signal: boolean
  serp_ad_density: number
  competitors_count: number
  paid_count: number
  rising_queries_ratio: number
  // Новые данные для полной картины
  seasonality: {
    peak_months: number[]
    low_months: number[]
    is_seasonal: boolean
    current_month_index: number // 1-12
  }
  buying_stage: {
    dominant: string | null
    awareness_pct: number
    consideration_pct: number
    decision_pct: number
  }
  competitor_trends: Array<{
    name: string
    growth: number | null
    direction: 'up' | 'down' | 'stable'
  }>
}

// ══════════════════════════════════════════════════════════════
// SONNET ПРОМПТ
// ══════════════════════════════════════════════════════════════

const MONTH_NAMES_RU = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
]

function buildPrompt(input: DemandIntelligenceInput): string {
  const growth12mStr = input.growth_12m != null ? `${input.growth_12m}%` : 'недостаточно данных'
  const growth3mStr = input.growth_3m != null ? `${input.growth_3m}%` : 'недостаточно данных'

  // Сезонность
  const seasonalityStr = input.seasonality.is_seasonal
    ? `Сезонный рынок. Пик: ${input.seasonality.peak_months.map(m => MONTH_NAMES_RU[m] || m).join(', ')}. Спад: ${input.seasonality.low_months.map(m => MONTH_NAMES_RU[m] || m).join(', ')}. Сейчас месяц ${input.seasonality.current_month_index} (${MONTH_NAMES_RU[input.seasonality.current_month_index - 1] || ''}).`
    : 'Равномерный спрос без выраженной сезонности.'

  // Buying stage
  const buyingStageStr = input.buying_stage.dominant
    ? `Доминирующая стадия: ${input.buying_stage.dominant} (awareness ${input.buying_stage.awareness_pct}% / consideration ${input.buying_stage.consideration_pct}% / decision ${input.buying_stage.decision_pct}%)`
    : 'Стадия покупки не определена.'

  // Competitor trends
  const competitorTrendsStr = input.competitor_trends.length > 0
    ? input.competitor_trends.map(c => `${c.name}: ${c.direction} (${c.growth != null ? c.growth + '%' : 'нет данных'})`).join('\n')
    : 'Нет данных'

  return `Ты аналитик рынка. Интерпретируй данные спроса для нетехнического предпринимателя.

СТРОГИЕ ПРАВИЛА:
- Только то что следует из переданных данных. Никаких домыслов.
- Все текстовые поля на русском языке
- Соблюдай лимиты длины
- Если данных по секции нет — верни пустую строку для соответствующего поля

ДАННЫЕ:
Ниша: ${input.niche}
Диагноз: ${input.diagnosis} (${input.score}/10)
Причина диагноза: ${input.diagnosis_reason}
Коммерческий интент: ${Math.round(input.commercial_intent_ratio * 100)}%
Информационный интент: ${Math.round((1 - input.commercial_intent_ratio) * 100)}%
Demand index: ${input.demand_index} (относительный, 0-100)
Динамика: ${input.trend_direction} (growth_12m: ${growth12mStr}, growth_3m: ${growth3mStr})
Hype риск: ${input.has_hype_risk}
Declining сигнал: ${input.has_declining_signal}
SERP реклама: ${Math.round(input.serp_ad_density * 100)}% платных результатов
Конкуренты найдены: ${input.competitors_count} (платных: ${input.paid_count})
Rising запросы: ${Math.round(input.rising_queries_ratio * 100)}% от всех

Сезонность: ${seasonalityStr}

Стадия покупки: ${buyingStageStr}

Тренды конкурентов:
${competitorTrendsStr}

Верни СТРОГО валидный JSON без markdown:

{
  "verdict_phrase": "Главный вывод одной фразой. Макс 12 слов.",
  "verdict_sub": "Подзаголовок с контекстом. Макс 20 слов.",

  "intent_interpretation": "Что значит это соотношение коммерческого/информационного интента для входа на рынок. Макс 30 слов.",

  "ad_density_interpretation": "Что значит текущая рекламная активность конкурентов. Макс 25 слов.",

  "trend_interpretation": "Что значит текущая динамика для момента входа. Макс 25 слов.",

  "competitors_interpretation": "Что значит наличие/отсутствие платных конкурентов. Макс 20 слов.",

  "seasonality_interpretation": "${input.seasonality.is_seasonal ? 'Что означает текущий момент в сезоне для входа на рынок. Макс 25 слов.' : ''}",

  "buying_stage_interpretation": "${input.buying_stage.dominant ? 'Что означает доминирующая стадия покупки для GTM стратегии. Макс 25 слов.' : ''}",

  "competitor_trend_interpretation": "${input.competitor_trends.length > 0 ? 'Кто из конкурентов растёт или падает и что это значит для входа. Макс 25 слов.' : ''}",

  "key_factors": [
    "Фактор 1 который определил диагноз. Макс 15 слов.",
    "Фактор 2. Макс 15 слов.",
    "Фактор 3. Макс 15 слов."
  ],

  "block3_connection": "Как данные спроса влияют на цикл сделки в Блоке 3. Макс 25 слов.",

  "conclusion_green": "Итог если GREEN. Что это значит для стратегии. Макс 35 слов.",
  "conclusion_yellow": "Итог если YELLOW. Что делать дальше. Макс 35 слов.",
  "conclusion_red": "Итог если RED. Что сохранил пользователь. Макс 35 слов.",

  "hype_warning": "${input.has_hype_risk ? 'Почему это опасно и когда вернуться к анализу. Макс 25 слов.' : ''}"
}`
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

  // Читаем block_results для Block 2
  const { data: blockResult, error: dbErr } = await supabase
    .from('block_results')
    .select('*')
    .eq('trend_id', trend_id)
    .eq('user_id', user.id)
    .eq('block_number', 2)
    .maybeSingle()

  if (dbErr || !blockResult) {
    return NextResponse.json(
      { error: 'Block 2 данные не найдены. Сначала запустите анализ спроса.' },
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

  // ── Собираем input из block_context ──
  const ctx = blockResult.block_context || {}
  const rawData = blockResult.raw_data || {}
  const competitors = ctx.competitors_found || []

  const seasonalityRaw = rawData.seasonality
  const buyingStageRaw = rawData.buying_stage
  const competitorTrendsRaw = rawData.competitor_trends || []

  const input: DemandIntelligenceInput = {
    niche: ctx.niche || '',
    diagnosis: blockResult.diagnosis || 'yellow',
    score: blockResult.score ?? 5,
    diagnosis_reason: ctx.diagnosis_reason || '',
    commercial_intent_ratio: ctx.commercial_intent_ratio ?? 0,
    demand_index: ctx.demand_index ?? 0,
    trend_direction: ctx.trend_direction || rawData.layers?.layer1?.growth_rate || 'stable',
    growth_12m: rawData.growth_5y ?? null,
    growth_3m: rawData.growth_3m ?? null,
    has_hype_risk: ctx.has_hype_risk || false,
    has_declining_signal: ctx.has_declining_signal || false,
    serp_ad_density: ctx.serp_ad_density ?? 0,
    competitors_count: competitors.length,
    paid_count: competitors.filter((c: any) => c.source === 'paid').length,
    rising_queries_ratio: ctx.rising_queries_ratio ?? 0,
    seasonality: {
      peak_months: seasonalityRaw?.peak_months || [],
      low_months: seasonalityRaw?.low_months || [],
      is_seasonal: seasonalityRaw?.has_seasonality || false,
      current_month_index: new Date().getMonth() + 1,
    },
    buying_stage: {
      dominant: buyingStageRaw?.dominant_stage || null,
      awareness_pct: buyingStageRaw?.awareness || 0,
      consideration_pct: buyingStageRaw?.consideration || 0,
      decision_pct: buyingStageRaw?.decision || 0,
    },
    competitor_trends: competitorTrendsRaw
      .slice(0, 3)
      .map((c: any) => ({
        name: c.name || '',
        growth: c.growth ?? null,
        direction: c.direction || 'stable',
      })),
  }

  // Проверка минимума данных
  if (!input.niche) {
    return NextResponse.json(
      { error: 'block_context.niche отсутствует. Перезапустите анализ Block 2.' },
      { status: 422 }
    )
  }

  // ── Sonnet анализ ──
  try {
    const prompt = buildPrompt(input)

    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
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
    console.error('[Intelligence Layer Block 2]', error)

    // Fallback — не крашим UI, возвращаем 200 с флагом
    return NextResponse.json({
      error: 'Intelligence Layer unavailable',
      fallback: true,
      message: error.message || 'Sonnet analysis failed',
    })
  }
}
