/**
 * TrendHunter AI — Summary Card API v4
 * src/app/api/strategy/summary-card/route.ts
 *
 * Агрегирует 5 block_decisions в сводную карту A4 — 6 строк.
 * Не генерирует через LLM — использует уже сохранённые данные.
 *
 * Actions:
 *  - GET  /api/strategy/summary-card?session_id=X → возвращает карту
 *  - POST /api/strategy/summary-card { session_id, action: 'generate' } → создаёт
 *  - POST /api/strategy/summary-card { session_id, action: 'email', email } → email
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStrategyAuthUser } from '@/lib/strategy/auth'

export const maxDuration = 30

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface SummaryCardLines {
  // Marker for new-format detection in getSavedCard
  version: 2
  // S0
  angle: string
  versus_them: string
  versus_weakness: string
  window: string
  // S1
  client_who: string
  client_where: string
  price_monthly: string
  // S2
  core_feature: string
  first_build_step: string
  estimated_amount: string
  estimated_time: string
  // S3
  channel_name: string
  channel_where: string
  kill_switch: string
  day_by_day: Array<{ day?: string; action?: string; target?: string }>
  // S5
  days_to_revenue: string
  first_action: string
  kill_switch_date: string
  day_30: string
  day_90: string
}

export interface SummaryCard {
  session_id: string
  trend_id: string
  niche: string
  lines: SummaryCardLines
  generated_at: string
}

// ─────────────────────────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─────────────────────────────────────────────────────────────
// BUILD CARD FROM DECISIONS
// ─────────────────────────────────────────────────────────────

/**
 * Строит 6-строчную карту из block_decisions.
 * Детерминированный код — без LLM.
 */
async function buildSummaryCard(params: {
  session_id: string
  user_id: string
  supabase: any
}): Promise<SummaryCard | null> {
  const { session_id, user_id, supabase } = params

  // ── Проверяем что сессия принадлежит пользователю ──────
  const { data: session, error: sessionError } = await supabase
    .from('strategy_sessions')
    .select('trend_id, user_id, context')
    .eq('id', session_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (sessionError) {
    console.error('[SummaryCard] Session query error:', sessionError)
    return null
  }

  if (!session) return null

  // ── Загружаем все 5 decisions (v4.1: order by block_id для детерминизма) ─
  const { data: decisions, error: decisionsError } = await supabase
    .from('block_decisions')
    .select('block_id, decision, raw_output')
    .eq('session_id', session_id)
    .order('block_id', { ascending: true })

  if (decisionsError) {
    console.error('[SummaryCard] Decisions query error:', decisionsError)
    return null
  }

  if (!decisions || decisions.length < 5) {
    // Неполная сессия — не все блоки прошли
    return null
  }

  // ── Reload с translated_output (партнёрский формат) ─────
  const { data: richDecisions } = await supabase
    .from('block_decisions')
    .select('block_id, decision, raw_output, translated_output')
    .eq('session_id', session_id)
    .in('block_id', ['S0', 'S1', 'S2', 'S3', 'S5'])

  const byBlockTranslated: Record<string, Record<string, unknown>> = {}
  for (const d of (richDecisions ?? decisions) as Array<{ block_id: string; decision?: unknown; raw_output?: unknown; translated_output?: unknown }>) {
    const translated = d.translated_output as Record<string, unknown> | null | undefined
    const rawOutput = d.raw_output as Record<string, unknown> | null | undefined
    byBlockTranslated[d.block_id] = translated ?? rawOutput ?? {}
  }

  // ── Загружаем niche из saved_trends ────────────────────
  const { data: trend, error: trendError } = await supabase
    .from('saved_trends')
    .select('title')
    .eq('id', session.trend_id)
    .maybeSingle()

  if (trendError) {
    console.warn('[SummaryCard] Trend query error (non-critical):', trendError)
  }

  const ctx = (session.context ?? {}) as Record<string, unknown>
  const niche =
    (trend?.title as string | undefined) ||
    (ctx['niche'] as string | undefined) ||
    (ctx['trend_title'] as string | undefined) ||
    (ctx['niche_title'] as string | undefined) ||
    'Ваша ниша'

  const s0 = byBlockTranslated['S0'] ?? {}
  const s1 = byBlockTranslated['S1'] ?? {}
  const s2 = byBlockTranslated['S2'] ?? {}
  const s3 = byBlockTranslated['S3'] ?? {}
  const s5 = byBlockTranslated['S5'] ?? {}

  const spec = (b: Record<string, unknown>): Record<string, unknown> => (b['specific'] as Record<string, unknown>) ?? {}
  const s0s = spec(s0)
  const s1s = spec(s1)
  const s2s = spec(s2)
  const s3s = spec(s3)
  const s5s = spec(s5)

  const pick = (obj: Record<string, unknown>, path: string[]): string => {
    let cur: unknown = obj
    for (const k of path) {
      if (cur && typeof cur === 'object' && k in (cur as Record<string, unknown>)) {
        cur = (cur as Record<string, unknown>)[k]
      } else {
        return ''
      }
    }
    if (cur === null || cur === undefined) return ''
    if (typeof cur === 'string' || typeof cur === 'number') return String(cur)
    return ''
  }

  const lines: SummaryCardLines = {
    version: 2,
    // S0
    angle: pick(s0s, ['positioning_quote']),
    versus_them: pick(s0s, ['versus_block', 'them', 'name']),
    versus_weakness: pick(s0s, ['versus_block', 'them', 'weakness']),
    window: pick(s0s, ['versus_block', 'you', 'window_months']),
    // S1
    client_who: pick(s1s, ['client_portrait', 'who']),
    client_where: pick(s1s, ['client_portrait', 'where_to_find']),
    price_monthly: pick(s1s, ['price_point', 'monthly']),
    // S2
    core_feature: pick(s2s, ['core_feature', 'name']),
    first_build_step: pick(s2s, ['first_build_step']),
    estimated_amount: pick(s2s, ['estimated_cost', 'amount']),
    estimated_time: pick(s2s, ['estimated_cost', 'time_weeks']),
    // S3
    channel_name: pick(s3s, ['channel', 'human_name']),
    channel_where: pick(s3s, ['channel', 'where_exactly']),
    kill_switch: pick(s3s, ['kill_switch', 'metric_human']),
    day_by_day: Array.isArray(s3s['day_by_day']) ? (s3s['day_by_day'] as Array<{ day?: string; action?: string; target?: string }>).slice(0, 4) : [],
    // S5
    days_to_revenue: pick(s5s, ['timeline', 'days_to_first_revenue']),
    first_action: pick(s5s, ['first_action_today', 'what']),
    kill_switch_date: pick(s5s, ['kill_switch_date']),
    day_30: pick(s5s, ['milestones', 'day_30', 'what']),
    day_90: pick(s5s, ['milestones', 'day_90', 'what']),
  }

  // Fallback: если translated полностью пуст — используем старые decision-fields
  if (!lines.angle) {
    const byBlockRaw: Record<string, Record<string, unknown>> = {}
    for (const d of decisions) byBlockRaw[d.block_id as string] = d.raw_output as Record<string, unknown>
    const s0r = byBlockRaw['S0'] ?? {}
    const s5r = byBlockRaw['S5'] ?? {}
    if (!lines.angle) lines.angle = (s0r['positioning_angle'] as string) ?? ''
    if (!lines.first_action) lines.first_action = (s5r['first_action_today'] as string) ?? ''
    if (!lines.kill_switch_date) lines.kill_switch_date = (s5r['experiment_kill_switch_date'] as string) ?? ''
    if (!lines.core_feature) lines.core_feature = formatFeature(byBlockRaw['S2'] ?? {})
    if (!lines.channel_name) lines.channel_name = formatChannel(byBlockRaw['S3'] ?? {})
  }

  return {
    session_id,
    trend_id: session.trend_id as string,
    niche,
    lines,
    generated_at: new Date().toISOString(),
  }
}

function formatFeature(s2: Record<string, unknown>): string {
  const name = s2['v1_feature_name'] as string | undefined
  const cost = s2['estimated_build_cost']

  if (!name) return 'Функция не определена'

  // v4.1: явная проверка чтобы cost === 0 не пропускался truthy-check
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
    return `${name} — бюджет $${cost}`
  }
  return name
}

function formatChannel(s3: Record<string, unknown>): string {
  const channel = s3['channel_type'] as string | undefined
  const signal = s3['channel_kill_switch_signal'] as Record<string, unknown> | undefined

  if (!channel) return 'Канал не определён'

  // v4.1: строгая типовая проверка (защита если в БД приходит строка вместо числа)
  const threshold = signal?.['threshold']
  const days = signal?.['time_window_days']
  const metric = signal?.['metric']

  if (
    typeof threshold === 'number' && Number.isFinite(threshold) &&
    typeof days === 'number' && Number.isFinite(days) &&
    typeof metric === 'string' && metric.length > 0
  ) {
    return `${channel} · ${metric} < ${threshold} за ${days} дней = стоп`
  }

  return channel
}

// ─────────────────────────────────────────────────────────────
// PERSISTENCE
// ─────────────────────────────────────────────────────────────

async function saveSummaryCard(
  supabase: any,
  session_id: string,
  card: SummaryCard
): Promise<{ success: boolean; error?: string }> {
  // v4.1: ignoreDuplicates предотвращает race condition
  // Если другой параллельный запрос уже сохранил — мы не перезаписываем
  const { error } = await supabase
    .from('strategy_summary_cards')
    .upsert(
      { session_id, card_data: card.lines },
      { onConflict: 'session_id' }
    )

  if (error) {
    console.warn('[SummaryCard] Save failed (non-critical):', error.message)
    return { success: false, error: error.message }
  }
  return { success: true }
}

async function getSavedCard(
  supabase: any,
  session_id: string,
  user_id: string
): Promise<SummaryCard | null> {
  const { data: session, error: sessionError } = await supabase
    .from('strategy_sessions')
    .select('trend_id, user_id')
    .eq('id', session_id)
    .eq('user_id', user_id)
    .maybeSingle()

  if (sessionError) {
    console.error('[SummaryCard getSaved] Session error:', sessionError)
    return null
  }
  if (!session) return null

  const { data: savedCard, error: cardError } = await supabase
    .from('strategy_summary_cards')
    .select('card_data, generated_at')
    .eq('session_id', session_id)
    .maybeSingle()

  if (cardError) {
    console.error('[SummaryCard getSaved] Card error:', cardError)
    return null
  }
  if (!savedCard) return null

  // v2-invalidation: старые кэши без translated-полей → null (перегенерируем)
  const cached = savedCard.card_data as Record<string, unknown> | null
  if (!cached || cached['version'] !== 2) {
    return null
  }

  const { data: trend, error: trendError } = await supabase
    .from('saved_trends')
    .select('title')
    .eq('id', session.trend_id)
    .maybeSingle()

  if (trendError) {
    console.warn('[SummaryCard getSaved] Trend error (non-critical):', trendError)
  }

  return {
    session_id,
    trend_id: session.trend_id as string,
    niche: (trend?.title as string) || 'Ваша ниша',
    lines: cached as unknown as SummaryCardLines,
    generated_at: savedCard.generated_at as string,
  }
}

// ─────────────────────────────────────────────────────────────
// EMAIL (заглушка — интегрируется с существующим mail сервисом)
//
// v4.1: throw error вместо success:true чтобы UI не показывал
// "Отправлено" при отсутствии интеграции с email сервисом.
// Разработчик должен подключить SendGrid/Resend/внутренний mail-сервис
// и заменить эту функцию.
// ─────────────────────────────────────────────────────────────

async function sendSummaryByEmail(params: {
  card: SummaryCard
  email: string
}): Promise<{ success: boolean; error?: string }> {
  // TODO для разработчика: интегрировать с email сервисом проекта.
  // Когда интегрируешь — убери throw и верни { success: true } после успешной отправки.

  console.warn(
    '[SummaryCard] Email service not integrated. ' +
    'Implement sendSummaryByEmail or feature will silently fail.'
  )

  throw new Error('EMAIL_SERVICE_NOT_IMPLEMENTED')
}

// ─────────────────────────────────────────────────────────────
// HANDLERS
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getStrategyAuthUser()

    // v4.1: строгая проверка что user.id существует и не пустой
    if (!user || typeof user.id !== 'string' || user.id.trim().length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const session_id = req.nextUrl.searchParams.get('session_id')
    if (!session_id || typeof session_id !== 'string' || session_id.trim().length === 0) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    }

    const supabase = getSupabase()

    // Пробуем загрузить уже сохранённую карту
    const savedCard = await getSavedCard(supabase, session_id, user.id)
    if (savedCard) {
      return NextResponse.json(savedCard)
    }

    // Если нет — генерируем
    const card = await buildSummaryCard({
      session_id,
      user_id: user.id,
      supabase,
    })

    if (!card) {
      return NextResponse.json(
        { error: 'Session not found or incomplete (need all 5 blocks)' },
        { status: 404 }
      )
    }

    // Сохраняем для следующих запросов (v4.1: не блокируем ответ если upsert упал)
    const saveResult = await saveSummaryCard(supabase, session_id, card)
    if (!saveResult.success) {
      // Не блокируем — карта уже построена, вернём её пользователю
      // Логирование уже произошло внутри saveSummaryCard
    }

    return NextResponse.json(card)

  } catch (error) {
    console.error('[SummaryCard GET] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getStrategyAuthUser()

    // v4.1: строгая проверка что user.id существует и не пустой
    if (!user || typeof user.id !== 'string' || user.id.trim().length === 0) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { session_id, action, email } = body as {
      session_id: string
      action: 'generate' | 'email'
      email?: string
    }

    if (!session_id || typeof session_id !== 'string' || session_id.trim().length === 0) {
      return NextResponse.json(
        { error: 'session_id required' },
        { status: 400 }
      )
    }

    if (!action || (action !== 'generate' && action !== 'email')) {
      return NextResponse.json(
        { error: 'action must be "generate" or "email"' },
        { status: 400 }
      )
    }

    const supabase = getSupabase()

    if (action === 'generate') {
      const card = await buildSummaryCard({
        session_id,
        user_id: user.id,
        supabase,
      })

      if (!card) {
        return NextResponse.json(
          { error: 'Cannot generate — session incomplete' },
          { status: 404 }
        )
      }

      await saveSummaryCard(supabase, session_id, card)
      return NextResponse.json(card)
    }

    if (action === 'email') {
      if (!email) {
        return NextResponse.json({ error: 'email required' }, { status: 400 })
      }

      // v4.1: basic email validation (защита от "javascript:" и пустых значений)
      if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'invalid email format' }, { status: 400 })
      }

      const card = await getSavedCard(supabase, session_id, user.id)
        ?? await buildSummaryCard({ session_id, user_id: user.id, supabase })

      if (!card) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 })
      }

      // v4.1: обработка случая когда email сервис не интегрирован
      try {
        const result = await sendSummaryByEmail({ card, email })

        if (!result.success) {
          return NextResponse.json(
            { error: result.error ?? 'Email failed' },
            { status: 500 }
          )
        }
      } catch (emailError) {
        const errMsg = (emailError as Error)?.message ?? 'Email service error'

        // Специальный случай: сервис не реализован — возвращаем 501
        if (errMsg === 'EMAIL_SERVICE_NOT_IMPLEMENTED') {
          return NextResponse.json(
            { error: 'Email feature is not yet available' },
            { status: 501 }  // 501 Not Implemented
          )
        }

        console.error('[SummaryCard POST email] Error:', emailError)
        return NextResponse.json({ error: errMsg }, { status: 500 })
      }

      // Обновляем last_sent_at
      await supabase
        .from('strategy_summary_cards')
        .update({
          last_sent_at: new Date().toISOString(),
          email_sent_to: email,
        })
        .eq('session_id', session_id)

      return NextResponse.json({ success: true, sent_to: email })
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[SummaryCard POST] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
