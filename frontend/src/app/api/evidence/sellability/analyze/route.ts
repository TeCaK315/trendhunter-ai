// /api/evidence/sellability/analyze — Intelligence Layer для Block 3
// Sonnet интерпретирует данные Block 3 и генерирует аналитику на языке предпринимателя
// GET ?trend_id=xxx — читает block_results, кэширует результат

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

const claude = new Anthropic()

// ══════════════════════════════════════════════════════════════
// ТИПЫ
// ══════════════════════════════════════════════════════════════

interface SellabilityIntelligenceInput {
  niche: string
  diagnosis: string
  score: number
  reason: string

  // Ценообразование (Layer 1)
  price_min: number | null
  price_max: number | null
  price_median: number | null
  price_premium: number | null
  payment_model: string
  has_trial_period: boolean | null
  psychological_threshold: number | null

  // Цикл сделки (Layer 2)
  sale_cycle_days: number
  sale_cycle: string // minutes | days | weeks | months
  deal_cycle_reasoning: string
  deal_cycle_confidence: string
  market_type: string // B2B | B2C | B2B2C
  pain_type: string
  budget_exists: boolean
  budget_signals: {
    competitors_are_paid: boolean
    commercial_intent_high: boolean
    reddit_mentions_budget: boolean
    signal_count: number
  }

  // Каналы (Layer 3)
  primary_channel: string | null
  secondary_channels: string[]
  communities_count: number
  traffic_points_count: number

  // Диагноз
  main_barrier: string
  market_readiness_score: number
  path_to_first_payment: string
  time_to_first_revenue_days: number
  key_factors: string[]
}

// ══════════════════════════════════════════════════════════════
// SONNET ПРОМПТ
// ══════════════════════════════════════════════════════════════

function buildPrompt(input: SellabilityIntelligenceInput): string {
  const priceStr = input.price_min != null && input.price_max != null
    ? `$${input.price_min}–$${input.price_max} (медиана: $${input.price_median ?? '?'})`
    : 'данные о ценах недоступны'

  const premiumStr = input.price_premium != null
    ? `$${input.price_premium}`
    : 'нет данных'

  const trialStr = input.has_trial_period === true
    ? 'Да'
    : input.has_trial_period === false
      ? 'Нет'
      : 'Нет данных'

  const thresholdStr = input.psychological_threshold != null
    ? `$${input.psychological_threshold}`
    : 'не определён'

  const budgetSignalsStr = [
    input.budget_signals.competitors_are_paid ? 'платные конкуренты ✓' : 'платные конкуренты ✗',
    input.budget_signals.commercial_intent_high ? 'коммерческий интент >60% ✓' : 'коммерческий интент ≤60% ✗',
    input.budget_signals.reddit_mentions_budget ? 'Reddit бюджеты ✓' : 'Reddit бюджеты ✗',
  ].join(', ')

  const channelsStr = input.primary_channel
    ? `Основной: ${input.primary_channel}` + (input.secondary_channels.length > 0
        ? `. Дополнительные: ${input.secondary_channels.join(', ')}`
        : '')
    : 'Каналы не определены'

  return `Ты аналитик продаж. Интерпретируй данные продаваемости для нетехнического предпринимателя.

СТРОГИЕ ПРАВИЛА:
- Только то что следует из переданных данных. Никаких домыслов.
- Все текстовые поля на русском языке
- Соблюдай лимиты длины
- Если данных по секции нет — верни пустую строку для соответствующего поля

ДАННЫЕ:
Ниша: ${input.niche}
Диагноз: ${input.diagnosis} (${input.score}/10)
Причина диагноза: ${input.reason}
Ключевые факторы: ${input.key_factors.join('; ')}

ЦЕНООБРАЗОВАНИЕ:
Диапазон цен конкурентов: ${priceStr}
Premium уровень: ${premiumStr}
Модель оплаты: ${input.payment_model}
Trial период: ${trialStr}
Психологический порог: ${thresholdStr}

ЦИКЛ СДЕЛКИ:
Расчётный цикл: ${input.sale_cycle_days} дней (${input.sale_cycle})
Логика расчёта: ${input.deal_cycle_reasoning}
Уверенность: ${input.deal_cycle_confidence}
Тип рынка: ${input.market_type}
Тип боли: ${input.pain_type}

БЮДЖЕТ:
Бюджетная категория существует: ${input.budget_exists ? 'Да' : 'Нет'} (${input.budget_signals.signal_count}/3 сигналов)
Сигналы: ${budgetSignalsStr}

КАНАЛЫ:
${channelsStr}
Сообществ найдено: ${input.communities_count}
Точек перехвата трафика: ${input.traffic_points_count}

ПУТЬ К ДЕНЬГАМ:
Основной барьер: ${input.main_barrier}
Готовность рынка: ${input.market_readiness_score}/10
Путь к первой оплате: ${input.path_to_first_payment}
Время до первого дохода: ${input.time_to_first_revenue_days} дней

Верни СТРОГО валидный JSON без markdown:

{
  "verdict_phrase": "Главный вывод о продаваемости одной фразой. Макс 12 слов.",
  "verdict_sub": "Подзаголовок с контекстом. Макс 20 слов.",

  "price_interpretation": "Что значит текущий ценовой диапазон и модель оплаты для входа на рынок. Макс 30 слов.",

  "cycle_interpretation": "Что значит цикл сделки ${input.sale_cycle_days} дней для стартапа. Какие последствия для кэшфлоу. Макс 30 слов.",

  "channel_interpretation": "${input.primary_channel ? 'Почему ' + input.primary_channel + ' — лучший канал и как его использовать для первых продаж. Макс 30 слов.' : ''}",

  "barrier_interpretation": "Что значит барьер '${input.main_barrier}' и как его преодолеть. Макс 25 слов.",

  "first_money_interpretation": "Реалистичная оценка пути к первым деньгам. Что нужно сделать. Макс 30 слов.",

  "budget_interpretation": "${input.budget_exists ? 'Почему наличие бюджетной категории облегчает продажи. Макс 20 слов.' : 'Почему отсутствие бюджетной категории усложняет продажи и что с этим делать. Макс 25 слов.'}",

  "key_factors": [
    "Фактор 1 который определил диагноз продаваемости. Макс 15 слов.",
    "Фактор 2. Макс 15 слов.",
    "Фактор 3. Макс 15 слов."
  ],

  "block5_connection": "Как данные продаваемости влияют на юнит-экономику в Блоке 5. Макс 25 слов.",

  "conclusion_green": "Итог если GREEN. Как использовать лёгкость продаж. Макс 35 слов.",
  "conclusion_yellow": "Итог если YELLOW. Что доработать для увеличения конверсии. Макс 35 слов.",
  "conclusion_red": "Итог если RED. Главные риски и что сохранил пользователь. Макс 35 слов."
}`
}

// ══════════════════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const trend_id = searchParams.get('trend_id')
  const nicheFromQuery = searchParams.get('niche') || ''

  if (!trend_id) {
    return NextResponse.json({ error: 'trend_id required' }, { status: 400 })
  }

  const user = await getAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getServerSupabase()

  // Читаем block_results для Block 3 + Block 2 (для niche)
  const [block3Result, block2Result] = await Promise.all([
    supabase
      .from('block_results')
      .select('*')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .eq('block_number', 3)
      .maybeSingle(),
    supabase
      .from('block_results')
      .select('block_context')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .eq('block_number', 2)
      .maybeSingle(),
  ])

  if (block3Result.error || !block3Result.data) {
    return NextResponse.json(
      { error: 'Block 3 данные не найдены. Сначала запустите анализ продаваемости.' },
      { status: 404 }
    )
  }

  const blockResult = block3Result.data

  // Проверяем кэш — если intelligence_output уже есть, возвращаем
  if (blockResult.intelligence_output) {
    return NextResponse.json({
      cached: true,
      data: blockResult.intelligence_output,
    })
  }

  // ── Собираем input из block_context + raw_data ──
  const ctx = blockResult.block_context || {}
  const rawData = blockResult.raw_data || {}
  const layers = rawData.layers || {}
  const layer1 = layers.layer1 || {}
  const layer2 = layers.layer2 || {}
  const layer3 = layers.layer3 || {}

  // Niche: query param (primary) → Block 2 context (fallback) → Block 3 main_barrier (last resort)
  const niche = nicheFromQuery
    || block2Result.data?.block_context?.niche
    || ctx.main_barrier
    || ''

  const input: SellabilityIntelligenceInput = {
    niche,
    diagnosis: blockResult.diagnosis || 'yellow',
    score: blockResult.score ?? 5,
    reason: ctx.reason || '',

    // Layer 1: Pricing
    price_min: layer1.price_range?.min ?? ctx.price_range?.min ?? null,
    price_max: layer1.price_range?.max ?? ctx.price_range?.max ?? null,
    price_median: layer1.price_range?.median ?? ctx.price_range?.median ?? null,
    price_premium: layer1.price_range?.premium ?? null,
    payment_model: ctx.payment_model || layer1.payment_model || 'subscription',
    has_trial_period: layer1.has_trial_period ?? null,
    psychological_threshold: layer1.psychological_threshold ?? ctx.psychological_threshold ?? null,

    // Layer 2: Deal cycle
    sale_cycle_days: ctx.sale_cycle_days ?? layer2.deal_cycle_days ?? 14,
    sale_cycle: ctx.sale_cycle || 'days',
    deal_cycle_reasoning: layer2.deal_cycle_reasoning || '',
    deal_cycle_confidence: layer2.deal_cycle_confidence || 'medium',
    market_type: layer2.market_type || 'B2C',
    pain_type: layer2.pain_type || 'bad_solution',
    budget_exists: ctx.budget_exists ?? layer2.budget_category_exists ?? false,
    budget_signals: layer2.budget_signals || {
      competitors_are_paid: false,
      commercial_intent_high: false,
      reddit_mentions_budget: false,
      signal_count: 0,
    },

    // Layer 3: Channels
    primary_channel: ctx.primary_channel || layer3.primary_channel?.channel || null,
    secondary_channels: (ctx.secondary_channels || layer3.secondary_channels || [])
      .map((ch: any) => typeof ch === 'string' ? ch : ch?.channel || '').filter(Boolean),
    communities_count: (layer3.communities || []).length,
    traffic_points_count: (layer3.traffic_interception_points || ctx.traffic_interception_points || []).length,

    // Diagnosis
    main_barrier: ctx.main_barrier || '',
    market_readiness_score: ctx.market_readiness_score ?? 5,
    path_to_first_payment: ctx.path_to_first_payment || '',
    time_to_first_revenue_days: ctx.time_to_first_revenue_days ?? 30,
    key_factors: blockResult.key_factors || ctx.key_factors || [],
  }

  // Проверка минимума данных
  if (!input.niche) {
    return NextResponse.json(
      { error: 'Niche не найдена в Block 2. Перезапустите анализ.' },
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
    console.error('[Intelligence Layer Block 3]', error)

    // Fallback — не крашим UI, возвращаем 200 с флагом
    return NextResponse.json({
      error: 'Intelligence Layer unavailable',
      fallback: true,
      message: error.message || 'Sonnet analysis failed',
    })
  }
}
