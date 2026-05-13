/**
 * TrendHunter AI — Strategy → Roadmap Bridge
 * src/app/api/roadmap/activate/route.ts
 *
 * Вызывается с финального экрана Стратегии когда пользователь
 * нажимает "Открыть мой роадмап".
 *
 * Читает данные S0-S5 из block_decisions → создаёт roadmap_session.
 * Если сессия уже существует — возвращает существующую.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { getStrategyAuthUser } from '@/lib/strategy/auth'

// Нормализация email: уже сделана в getStrategyAuthUser() через SHA-256(email.toLowerCase())
// user.id = SHA-256(email.toLowerCase().trim()) — гарантировано нормализован

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function POST(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────
  const user = await getStrategyAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { trend_id: string; strategy_session_id?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { trend_id, strategy_session_id } = body
  if (!trend_id) {
    return NextResponse.json({ error: 'trend_id required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // ── Проверяем существующую сессию роадмапа ────────────────
  const { data: existing } = await supabase
    .from('roadmap_sessions')
    .select('id, status, day_number')
    .eq('user_id', user.id)
    .eq('trend_id', trend_id)
    .single()

  if (existing) {
    return NextResponse.json({
      roadmap_id: existing.id,
      status: existing.status,
      day_number: existing.day_number,
      already_exists: true,
      redirect_to: `/roadmap/${existing.id}`,
    })
  }

  // ── Читаем данные стратегии ───────────────────────────────
  // Находим strategy_session если не передан
  let stratSessionId = strategy_session_id

  if (!stratSessionId) {
    const { data: stratSession } = await supabase
      .from('strategy_sessions')
      .select('id')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    stratSessionId = stratSession?.id
  }

  // Читаем block_decisions для S0, S1, S3, S5
  let niche = 'ваша ниша'
  let killSwitchDate = ''
  let killSwitchMetric = '5 платящих клиентов'
  let channelType = ''
  let strategySummary = ''
  let positioningQuote = ''
  let firstActionToday = ''

  if (stratSessionId) {
    const { data: decisions } = await supabase
      .from('block_decisions')
      .select('block_id, decision')
      .eq('session_id', stratSessionId)
      .in('block_id', ['S0', 'S1', 'S3', 'S5'])

    if (decisions) {
      const byBlock: Record<string, Record<string, unknown>> = {}
      decisions.forEach(d => { byBlock[d.block_id] = d.decision as Record<string, unknown> })

      // S0 — позиционирование
      const s0 = byBlock['S0']
      if (s0) {
        positioningQuote = (s0.positioning_quote as string) ||
                           (s0.positioning_statement as string) || ''
        niche = (s0.niche as string) ||
                (s0.target_segment as string) || niche
      }

      // S1 — клиент (для summary)
      const s1 = byBlock['S1']

      // S3 — канал
      const s3 = byBlock['S3']
      if (s3) {
        channelType = (s3.primary_channel as string) ||
                      (s3.channel as string) ||
                      (s3.channel_type as string) || ''
      }

      // S5 — kill switch + первое действие
      const s5 = byBlock['S5']
      if (s5) {
        // Kill switch дата
        const ksDateRaw = (s5.experiment_kill_switch_date as string) ||
                          (s5.kill_switch_date as string) || ''

        if (ksDateRaw) {
          // Если уже DATE формат — используем
          // Если days — считаем от сегодня
          if (ksDateRaw.includes('-')) {
            killSwitchDate = ksDateRaw.split('T')[0]
          } else {
            const days = parseInt(ksDateRaw) || 90
            const date = new Date()
            date.setDate(date.getDate() + days)
            killSwitchDate = date.toISOString().split('T')[0]
          }
        } else {
          // Fallback: 90 дней от сегодня
          const date = new Date()
          date.setDate(date.getDate() + 90)
          killSwitchDate = date.toISOString().split('T')[0]
        }

        // Kill switch метрика
        killSwitchMetric = (s5.success_metric_90 as string) ||
                           (s5.kill_switch_description as string) ||
                           (s5.milestone_90_days as string) ||
                           '5 платящих клиентов'

        // Первое действие
        firstActionToday = (s5.first_action_today as string) || ''
      }

      // Собираем краткое резюме стратегии для AI контекста
      strategySummary = buildStrategySummary({
        niche,
        positioningQuote,
        channelType,
        killSwitchMetric,
        killSwitchDate,
        firstActionToday,
        s0, s1: s1 as Record<string, unknown>,
        s3: s3 as Record<string, unknown>,
        s5: s5 as Record<string, unknown>,
      })
    }
  }

  // Fallback если не удалось получить данные стратегии
  if (!killSwitchDate) {
    const date = new Date()
    date.setDate(date.getDate() + 90)
    killSwitchDate = date.toISOString().split('T')[0]
  }

  if (!niche && trend_id) {
    // Пробуем получить нишу из saved_trends
    const { data: trend } = await supabase
      .from('saved_trends')
      .select('title, description')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .single()

    if (trend) {
      niche = trend.title || niche
    }
  }

  // ── Создаём сессию роадмапа ───────────────────────────────
  const trialStartedAt = new Date()
  const trialExpiresAt = new Date()
  trialExpiresAt.setDate(trialExpiresAt.getDate() + 3) // Trial 3 дня

  // ── Создать roadmap_access (нужен access_id для сессии) ──
  if (!stratSessionId) {
    return NextResponse.json(
      { error: 'strategy_session_id required — complete strategy first' },
      { status: 400 }
    )
  }

  const accessExpiresAt = new Date(trialExpiresAt)
  const { data: newAccess, error: accessError } = await supabase
    .from('roadmap_access')
    .insert({
      user_id: user.id,
      trend_id,
      strategy_session_id: stratSessionId,
      trial_started_at: trialStartedAt.toISOString(),
      trial_expires_at: accessExpiresAt.toISOString(),
      status: 'trial',
    })
    .select('id')
    .single()

  if (accessError || !newAccess) {
    console.error('[activate] roadmap_access insert error:', accessError)
    return NextResponse.json({ error: 'Failed to create access record' }, { status: 500 })
  }

  const { data: newSession, error } = await supabase
    .from('roadmap_sessions')
    .insert({
      user_id: user.id,
      trend_id,
      niche,
      strategy_summary: strategySummary,
      kill_switch_date: killSwitchDate,
      kill_switch_metric: killSwitchMetric,
      channel_type: channelType || null,
      active_role: 'max',
      status: 'trial',
      day_number: 1,
      message_count: 0,
      access_id: newAccess.id,
      trial_started_at: trialStartedAt.toISOString(),
      trial_expires_at: trialExpiresAt.toISOString(),
    })
    .select('id')
    .single()

  if (error || !newSession) {
    console.error('[Roadmap Activate]', error)
    return NextResponse.json(
      { error: 'Failed to create roadmap session' },
      { status: 500 }
    )
  }

  // ── Создаём пустую память ────────────────────────────────
  await supabase.from('roadmap_user_memory').insert({
    roadmap_id: newSession.id,
    user_id: user.id,
  })

  // ── Создаём начальное состояние пользователя ──────────────
  await supabase
    .from('roadmap_user_states')
    .upsert({
      user_id: user.id,
      state: 'active',
      last_active_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  // ── Начальные метрики ──────────────────────────────────────
  await supabase.from('roadmap_user_metrics').insert([
    { roadmap_id: newSession.id, user_id: user.id, metric_name: 'revenue', value: 0 },
    { roadmap_id: newSession.id, user_id: user.id, metric_name: 'users', value: 0 },
    { roadmap_id: newSession.id, user_id: user.id, metric_name: 'mrr', value: 0 },
    { roadmap_id: newSession.id, user_id: user.id, metric_name: 'churn', value: 0 },
    { roadmap_id: newSession.id, user_id: user.id, metric_name: 'nps', value: 0 },
  ]).then(() => {}, err => console.error('[activate] metrics insert:', err))

  // ── Welcome banner ─────────────────────────────────────────
  await supabase.from('roadmap_in_app_banners').insert({
    roadmap_id: newSession.id,
    user_id: user.id,
    type: 'welcome',
    title: 'Добро пожаловать в Роадмап Pro',
    body: 'AI-команда готова помочь. Начни с вопроса Максу.',
    cta_label: 'Начать',
    cta_url: null,
  }).then(() => {}, err => console.error('[activate] banner insert:', err))

  return NextResponse.json({
    roadmap_id: newSession.id,
    status: 'trial',
    trial_expires_at: trialExpiresAt.toISOString(),
    already_exists: false,
    niche,
    kill_switch_date: killSwitchDate,
    kill_switch_metric: killSwitchMetric,
    redirect_to: `/roadmap/${newSession.id}`,
  }, { status: 201 })
}

// ─────────────────────────────────────────────────────────────
// HELPER — собираем краткое резюме стратегии
// Передаётся AI агентам как контекст
// ─────────────────────────────────────────────────────────────

function buildStrategySummary(data: {
  niche: string
  positioningQuote: string
  channelType: string
  killSwitchMetric: string
  killSwitchDate: string
  firstActionToday: string
  s0?: Record<string, unknown>
  s1?: Record<string, unknown>
  s3?: Record<string, unknown>
  s5?: Record<string, unknown>
}): string {
  const parts: string[] = []

  parts.push(`Ниша: ${data.niche}`)

  if (data.positioningQuote) {
    parts.push(`Позиционирование: "${data.positioningQuote}"`)
  }

  if (data.channelType) {
    parts.push(`Основной канал: ${data.channelType}`)
  }

  // Целевой клиент из S1
  if (data.s1) {
    const portrait = data.s1.client_portrait ||
                     data.s1.target_client ||
                     data.s1.ideal_client
    if (portrait) {
      parts.push(`Целевой клиент: ${portrait}`)
    }
  }

  // Цена из S3
  if (data.s3) {
    const price = data.s3.price_point || data.s3.price || data.s3.monthly_price
    if (price) {
      parts.push(`Цена: ${price}`)
    }
  }

  parts.push(`Kill switch: ${data.killSwitchMetric} до ${data.killSwitchDate}`)

  if (data.firstActionToday) {
    parts.push(`Первое действие: ${data.firstActionToday}`)
  }

  return parts.join('\n')
}
