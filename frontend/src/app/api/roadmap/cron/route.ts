/**
 * TrendHunter AI — Cron Workers
 * src/app/api/roadmap/cron/route.ts
 *
 * Запускается через Vercel Cron Jobs.
 * Два воркера в одном роуте:
 *
 * 1. Kill Switch Reminder — уведомление когда до дедлайна ≤ 7 дней
 * 2. Weekly Snapshot — еженедельный snapshot прогресса
 *
 * Vercel Cron config (vercel.json):
 * {
 *   "crons": [
 *     { "path": "/api/roadmap/cron", "schedule": "0 9 * * *" }
 *   ]
 * }
 *
 * Запускается каждый день в 9:00 UTC.
 * Каждый воркер проверяет свои условия и пропускает если не нужно.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import Anthropic from '@anthropic-ai/sdk'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient<Database>(url, key)
}

// Защита cron endpoint от случайных вызовов
function verifyCronSecret(req: NextRequest): boolean {
  const secret = req.headers.get('x-cron-secret')
  return secret === process.env.CRON_SECRET
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Vercel Cron Jobs добавляет Authorization header автоматически
  // Для ручного вызова нужен X-Cron-Secret
  const isVercelCron = req.headers.get('authorization') ===
    `Bearer ${process.env.CRON_SECRET}`
  const isManualCall = verifyCronSecret(req)

  if (!isVercelCron && !isManualCall) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabase()
  const results = {
    kill_switch_reminders: 0,
    weekly_snapshots: 0,
    errors: [] as string[],
  }

  // Запускаем оба воркера параллельно
  const [ksResult, snapshotResult] = await Promise.allSettled([
    runKillSwitchReminders(supabase),
    runWeeklySnapshots(supabase),
  ])

  if (ksResult.status === 'fulfilled') {
    results.kill_switch_reminders = ksResult.value
  } else {
    results.errors.push(`KillSwitch: ${String(ksResult.reason)}`)
    console.error('[Cron] KillSwitch worker error:', ksResult.reason)
  }

  if (snapshotResult.status === 'fulfilled') {
    results.weekly_snapshots = snapshotResult.value
  } else {
    results.errors.push(`Snapshot: ${String(snapshotResult.reason)}`)
    console.error('[Cron] Snapshot worker error:', snapshotResult.reason)
  }

  console.log('[Cron] Results:', results)
  return NextResponse.json({ success: true, ...results })
}

// ─────────────────────────────────────────────────────────────
// WORKER 1 — KILL SWITCH REMINDER
// Уведомление когда осталось ≤ 7 дней до kill switch date
// ─────────────────────────────────────────────────────────────

async function runKillSwitchReminders(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<number> {
  const today = new Date()
  const sevenDaysFromNow = new Date(today)
  sevenDaysFromNow.setDate(today.getDate() + 7)

  const todayStr = today.toISOString().split('T')[0]
  const sevenDaysStr = sevenDaysFromNow.toISOString().split('T')[0]

  // Все активные сессии у которых kill switch через 1-7 дней
  const { data: sessions } = await supabase
    .from('roadmap_sessions')
    .select('id, user_id, niche, kill_switch_date, kill_switch_metric, day_number')
    .in('status', ['trial', 'paid'])
    .gte('kill_switch_date', todayStr)
    .lte('kill_switch_date', sevenDaysStr)

  if (!sessions?.length) return 0

  let sent = 0

  for (const session of sessions) {
    // Проверяем не было ли уже отправлено уведомление за последние 7 дней
    const { data: recent } = await supabase
      .from('roadmap_trigger_history')
      .select('id')
      .eq('user_id', session.user_id)
      .eq('roadmap_id', session.id)
      .eq('trigger_type', 'kill_switch_reminder')
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1)
      .single()

    if (recent) continue // Уже отправляли

    const daysLeft = Math.ceil(
      (new Date(session.kill_switch_date).getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24)
    )

    // Загружаем метрики для контекста уведомления
    const { data: metrics } = await supabase
      .from('roadmap_conversations')
      .select('status')
      .eq('roadmap_id', session.id)
      .eq('user_id', session.user_id)

    const wonCount = metrics?.filter(c => c.status === 'won').length ?? 0
    const activeCount = metrics?.filter(c =>
      ['hot', 'active'].includes(c.status)
    ).length ?? 0

    // Записываем trigger в историю
    await supabase
      .from('roadmap_trigger_history')
      .insert({
        user_id: session.user_id,
        roadmap_id: session.id,
        trigger_type: 'kill_switch_reminder',
        content: JSON.stringify({
          days_left: daysLeft,
          kill_switch_date: session.kill_switch_date,
          kill_switch_metric: session.kill_switch_metric,
          won_clients: wonCount,
          active_leads: activeCount,
          niche: session.niche,
        }),
        confidence: 'high',
      })

    // TODO: здесь подключить email/Telegram уведомление
    // Сейчас — только запись в trigger_history
    // При наличии email сервиса (Resend, SendGrid):
    //   await sendKillSwitchEmail(session.user_id, { daysLeft, ... })
    console.log(
      `[KillSwitch] Reminder logged for session ${session.id}, ${daysLeft} days left`
    )

    sent++
  }

  return sent
}

// ─────────────────────────────────────────────────────────────
// WORKER 2 — WEEKLY SNAPSHOT
// Создаёт snapshot прогресса каждую неделю (в воскресенье)
// ─────────────────────────────────────────────────────────────

async function runWeeklySnapshots(
  supabase: ReturnType<typeof createClient<Database>>
): Promise<number> {
  const today = new Date()
  // Запускаем только по воскресеньям (день 0)
  if (today.getDay() !== 0) return 0

  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - 6)
  const weekEnd = today

  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  // Все активные сессии
  const { data: sessions } = await supabase
    .from('roadmap_sessions')
    .select('id, user_id, niche, day_number, kill_switch_date, kill_switch_metric')
    .in('status', ['trial', 'paid'])

  if (!sessions?.length) return 0

  let created = 0
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 30_000,
  })

  for (const session of sessions) {
    // Проверяем нет ли уже snapshot за эту неделю
    const weekNumber = Math.ceil((session.day_number ?? 1) / 7)

    const { data: existingSnapshot } = await supabase
      .from('roadmap_weekly_snapshots')
      .select('id')
      .eq('roadmap_id', session.id)
      .eq('week_number', weekNumber)
      .single()

    if (existingSnapshot) continue

    // Загружаем данные за неделю параллельно
    const [
      { data: logs },
      { data: conversations },
      { data: experiments },
      { data: messages },
    ] = await Promise.all([
      supabase
        .from('roadmap_daily_logs')
        .select('date, energy, what_done, what_blocking, small_win, has_significant_decision')
        .eq('roadmap_id', session.id)
        .eq('user_id', session.user_id)
        .gte('date', weekStartStr)
        .lte('date', weekEndStr)
        .order('date', { ascending: true }),

      supabase
        .from('roadmap_conversations')
        .select('status, lead_name, outcome_reason, last_message_at')
        .eq('roadmap_id', session.id)
        .eq('user_id', session.user_id),

      supabase
        .from('roadmap_experiments')
        .select('hypothesis, status, current_value, target_value, category')
        .eq('roadmap_id', session.id)
        .eq('user_id', session.user_id)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase
        .from('roadmap_chat_messages')
        .select('content, ai_role, created_at')
        .eq('roadmap_id', session.id)
        .eq('user_id', session.user_id)
        .eq('role', 'assistant')
        .gte('created_at', weekStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
    ])

    // Собираем snapshot_data
    const wonThisWeek = conversations?.filter(c => c.status === 'won').length ?? 0
    const activeLeads = conversations?.filter(c =>
      ['hot', 'active'].includes(c.status)
    ).length ?? 0
    const avgEnergy = logs?.length
      ? Math.round(
          logs.reduce((s, l) => s + (l.energy ?? 3), 0) / logs.length * 10
        ) / 10
      : null
    const daysWorked = logs?.length ?? 0
    const smallWins = logs?.filter(l => l.small_win).length ?? 0

    const snapshotData = {
      week_number: weekNumber,
      week_start: weekStartStr,
      week_end: weekEndStr,
      day_range: { from: (session.day_number ?? 1) - 6, to: (session.day_number ?? 1) },
      metrics: {
        won_clients: wonThisWeek,
        active_leads: activeLeads,
        days_worked: daysWorked,
        avg_energy: avgEnergy,
        small_wins: smallWins,
      },
      experiments_summary: experiments?.map(e => ({
        hypothesis: e.hypothesis,
        status: e.status,
        category: e.category,
        progress: e.current_value && e.target_value
          ? Math.round((e.current_value / e.target_value) * 100)
          : null,
      })) ?? [],
      conversations_status: {
        won: wonThisWeek,
        active: activeLeads,
        stalled: conversations?.filter(c => c.status === 'stalled').length ?? 0,
      },
    }

    // Генерируем AI summary через Haiku (дёшево)
    let aiSummary = ''
    try {
      const ksDate = new Date(session.kill_switch_date)
      const daysToKs = Math.ceil(
        (ksDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        temperature: 0.4,
        messages: [{
          role: 'user',
          content: `Ты пишешь еженедельный summary прогресса для solo-founder.
Ниша: ${session.niche}
Неделя ${weekNumber} из 13 (90 дней)
До kill switch: ${daysToKs} дней
Kill switch метрика: ${session.kill_switch_metric}

Данные недели:
- Дней работы: ${daysWorked}/7
- Средняя энергия: ${avgEnergy ?? 'нет данных'}/5
- Новых клиентов: ${wonThisWeek}
- Активных лидов: ${activeLeads}
- Малых побед: ${smallWins}

Напиши краткий (2-3 предложения) честный summary недели на русском.
Без пафоса. Конкретно что произошло и что важно на следующей неделе.`,
        }],
      })

      aiSummary = response.content
        .filter(b => b.type === 'text')
        .map(b => b.type === 'text' ? b.text : '')
        .join('')
        .trim()
    } catch (err) {
      console.error(`[Snapshot] Haiku error for session ${session.id}:`, err)
      // Не фейлим snapshot если Haiku упал
    }

    // Сохраняем snapshot
    const { error } = await supabase
      .from('roadmap_weekly_snapshots')
      .insert({
        roadmap_id: session.id,
        user_id: session.user_id,
        week_number: weekNumber,
        week_start: weekStartStr,
        week_end: weekEndStr,
        snapshot_data: snapshotData,
        ai_summary: aiSummary || null,
      })

    if (!error) {
      created++
      console.log(`[Snapshot] Created week ${weekNumber} for session ${session.id}`)
    } else {
      console.error(`[Snapshot] Error for session ${session.id}:`, error)
    }
  }

  return created
}
