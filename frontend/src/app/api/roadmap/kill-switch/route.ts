/**
 * TrendHunter AI — Kill Switch Review Route
 * src/app/api/roadmap/kill-switch/route.ts
 *
 * GET  ?roadmap_id= → данные для Kill Switch Review (метрики, trajectory, pipeline)
 * POST             → зафиксировать решение (continue / adjust / stop)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'
import { getStrategyAuthUser } from '@/lib/strategy/auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient<Database>(url, key)
}

// ─────────────────────────────────────────────────────────────
// GET — собираем все данные для Review
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const roadmapId = searchParams.get('roadmap_id')
  if (!roadmapId) return NextResponse.json({ error: 'roadmap_id required' }, { status: 400 })

  const supabase = getSupabase()

  // Загружаем сессию
  const { data: session } = await supabase
    .from('roadmap_sessions')
    .select('*')
    .eq('id', roadmapId)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Параллельная загрузка всех данных
  const [
    { data: conversations },
    { data: experiments },
    { data: allLogs },
    { data: memory },
    { data: prevReview },
  ] = await Promise.all([
    supabase
      .from('roadmap_conversations')
      .select('status, outcome_reason, first_contact_at, last_message_at')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id),

    supabase
      .from('roadmap_experiments')
      .select('status, hypothesis, category, completed_at, lesson')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id),

    supabase
      .from('roadmap_daily_logs')
      .select('date, energy')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)
      .order('date', { ascending: true }),

    supabase
      .from('roadmap_user_memory')
      .select('milestones, decisions_made, hypotheses_tested')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)
      .single(),

    supabase
      .from('roadmap_kill_switch_history')
      .select('scenario, decision, created_at')
      .eq('roadmap_id', roadmapId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ])

  const now = new Date()

  // ── Метрики ───────────────────────────────────────────────
  const convList = conversations ?? []
  const expList = experiments ?? []
  const logList = allLogs ?? []

  const metrics = {
    messages_sent: convList.length,
    conversations_held: convList.filter(c => !['hot'].includes(c.status)).length,
    paying_clients: convList.filter(c => c.status === 'won').length,
    validated_experiments: expList.filter(e => e.status === 'validated').length,
    active_conversations: convList.filter(c => ['hot','active'].includes(c.status)).length,
    stalled_conversations: convList.filter(c => c.status === 'stalled').length,
    lost_conversations: convList.filter(c => c.status === 'lost').length,
  }

  // ── Kill switch прогресс ──────────────────────────────────
  const ksDate = new Date(session.kill_switch_date)
  const daysRemaining = Math.max(
    0, Math.ceil((ksDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  )
  const daysUsed = session.day_number

  // Парсим kill_switch_metric — извлекаем число если есть
  const targetMatch = session.kill_switch_metric?.match(/(\d+)/)
  const targetValue = targetMatch ? parseInt(targetMatch[1]) : 5
  const currentValue = metrics.paying_clients

  // ── Trajectory (тренд последних 14 дней) ─────────────────
  const last14 = convList.filter(c => {
    if (!c.last_message_at) return false
    const d = new Date(c.last_message_at)
    return (now.getTime() - d.getTime()) < 14 * 24 * 60 * 60 * 1000
  })
  const prevPeriod = convList.filter(c => {
    if (!c.last_message_at) return false
    const d = new Date(c.last_message_at)
    const ms = now.getTime() - d.getTime()
    return ms >= 14 * 24 * 60 * 60 * 1000 && ms < 28 * 24 * 60 * 60 * 1000
  })

  const recentWon = last14.filter(c => c.status === 'won').length
  const prevWon = prevPeriod.filter(c => c.status === 'won').length
  const trend: 'accelerating' | 'flat' | 'declining' =
    recentWon > prevWon + 0 ? 'accelerating' :
    recentWon < prevWon ? 'declining' : 'flat'

  // ── Pipeline ──────────────────────────────────────────────
  const pipeline = {
    active_conversations: metrics.active_conversations,
    high_intent_leads: convList.filter(c => c.status === 'hot').length,
    stalled: metrics.stalled_conversations,
  }

  // ── Effort (активность) ───────────────────────────────────
  const activeDays = logList.length
  const effort = {
    active_days: activeDays,
    consistency_score: (daysUsed ?? 0) > 0 ? Math.round((activeDays / (daysUsed ?? 1)) * 100) : 0,
  }

  // ── Outcome reasons ───────────────────────────────────────
  const reasonCounts: Record<string, number> = {}
  convList.filter(c => c.outcome_reason).forEach(c => {
    reasonCounts[c.outcome_reason!] = (reasonCounts[c.outcome_reason!] || 0) + 1
  })
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  // ── Классификация сценария ────────────────────────────────
  const scenario = classifyScenario(currentValue, targetValue, trend, pipeline)

  // ── Validated experiments для Review ─────────────────────
  const validatedExps = expList
    .filter(e => e.status === 'validated')
    .map(e => ({ hypothesis: e.hypothesis, lesson: e.lesson }))

  const rejectedExps = expList
    .filter(e => e.status === 'rejected')
    .map(e => ({ hypothesis: e.hypothesis, lesson: e.lesson }))

  return NextResponse.json({
    session: {
      id: session.id,
      niche: session.niche,
      kill_switch_date: session.kill_switch_date,
      kill_switch_metric: session.kill_switch_metric,
      day_number: daysUsed,
      days_remaining: daysRemaining,
    },
    kill_switch: {
      target_metric_name: session.kill_switch_metric,
      target_value: targetValue,
      current_value: currentValue,
      progress_percent: Math.min(100, Math.round((currentValue / targetValue) * 100)),
    },
    metrics,
    trajectory: {
      trend,
      last_14_days_won: recentWon,
      prev_14_days_won: prevWon,
      confidence: activeDays >= 30 ? 'high' : activeDays >= 15 ? 'medium' : 'low',
    },
    pipeline,
    effort,
    outcome_reasons: topReasons,
    validated_experiments: validatedExps,
    rejected_experiments: rejectedExps,
    milestones: (memory?.milestones as string[]) ?? [],
    scenario,
    previous_review: prevReview ?? null,
  })
}

// ─────────────────────────────────────────────────────────────
// POST — фиксируем решение
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    roadmap_id: string
    decision: 'continue' | 'adjust' | 'stop'
    scenario: string
    decision_context?: string
    extend_days?: number
    adjust_parameter?: string
  }

  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { roadmap_id, decision, scenario, decision_context, extend_days, adjust_parameter } = body

  if (!roadmap_id || !decision || !scenario) {
    return NextResponse.json({ error: 'roadmap_id, decision, scenario required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Загружаем текущие метрики для snapshot
  const { data: session } = await supabase
    .from('roadmap_sessions')
    .select('*')
    .eq('id', roadmap_id)
    .eq('user_id', user.id)
    .single()

  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Сохраняем в историю
  await supabase.from('roadmap_kill_switch_history').insert({
    roadmap_id,
    user_id: user.id,
    scenario,
    decision,
    decision_context: decision_context ?? null,
    metrics_snapshot: { day_number: session.day_number },
  })

  // Применяем решение
  if (decision === 'continue') {
    const days = extend_days ?? (scenario.startsWith('A') ? 60 : 30)
    const newKsDate = new Date(session.kill_switch_date)
    newKsDate.setDate(newKsDate.getDate() + days)

    await supabase
      .from('roadmap_sessions')
      .update({
        kill_switch_date: newKsDate.toISOString().split('T')[0],
        status: 'paid',
        day_number: 1,
      })
      .eq('id', roadmap_id)

    return NextResponse.json({
      success: true,
      decision: 'continue',
      new_kill_switch_date: newKsDate.toISOString().split('T')[0],
      extend_days: days,
      redirect_to: `/roadmap/${roadmap_id}`,
    })
  }

  if (decision === 'adjust') {
    const newKsDate = new Date()
    newKsDate.setDate(newKsDate.getDate() + 14)

    await supabase
      .from('roadmap_sessions')
      .update({
        kill_switch_date: newKsDate.toISOString().split('T')[0],
        status: 'paid',
      })
      .eq('id', roadmap_id)

    if (adjust_parameter) {
      await supabase.from('roadmap_experiments').insert({
        roadmap_id,
        user_id: user.id,
        hypothesis: `Adjust эксперимент: ${adjust_parameter}`,
        category: 'other',
        metric: 'reply_rate',
        target_value: 20,
        min_sample_size: 10,
        status: 'active',
        confidence: 'weak_signal',
        evidence_snapshots: [],
      })
    }

    return NextResponse.json({
      success: true,
      decision: 'adjust',
      new_kill_switch_date: newKsDate.toISOString().split('T')[0],
      adjust_days: 14,
      redirect_to: `/roadmap/${roadmap_id}`,
    })
  }

  // STOP
  await supabase
    .from('roadmap_sessions')
    .update({ status: 'expired' })
    .eq('id', roadmap_id)

  return NextResponse.json({
    success: true,
    decision: 'stop',
    message: 'Роадмап завершён. Данные сохранены.',
    redirect_to: '/dashboard',
  })
}

// ─────────────────────────────────────────────────────────────
// HELPER — классификация сценария
// Из KILL_SWITCH_AND_AFTER_FLOW_v2.md
// ─────────────────────────────────────────────────────────────

function classifyScenario(
  current: number,
  target: number,
  trend: 'accelerating' | 'flat' | 'declining',
  pipeline: { active_conversations: number; high_intent_leads: number }
): 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C' {
  const ratio = current / target

  // Сценарий A — работает (≥80% + тренд)
  if (ratio >= 1.0 || (ratio >= 0.8 && trend === 'accelerating')) {
    if (trend === 'accelerating') return 'A1'
    if (trend === 'flat') return 'A2'
    return 'A3'
  }

  // Сценарий B — пограничный
  if (current > 0 || pipeline.active_conversations >= 2) {
    if (current === 0 && pipeline.active_conversations >= 2) return 'B2'
    return 'B1'
  }

  // Сценарий C — не работает
  return 'C'
}
