/**
 * TrendHunter AI — Morning View Route
 * src/app/api/roadmap/morning-view/route.ts
 *
 * GET ?roadmap_id= → данные для утреннего экрана при первом входе за день
 *
 * Показывается если:
 * - Первый вход за календарный день
 * - Есть данные для показа (блокер/stalled/эксперименты готовые)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStrategyAuthUser } from '@/lib/strategy/auth'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const roadmapId = searchParams.get('roadmap_id')

  if (!roadmapId) {
    return NextResponse.json({ error: 'roadmap_id required' }, { status: 400 })
  }

  const supabase = getSupabase()
  const now = new Date()
  const today = now.toISOString().split('T')[0]

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  // Загружаем всё параллельно
  const [
    { data: todayLog },
    { data: yesterdayLog },
    { data: stalledConvs },
    { data: readyExperiments },
    { data: pendingDecisions },
  ] = await Promise.all([
    // Лог за сегодня (проверяем — есть ли)
    supabase
      .from('roadmap_daily_logs')
      .select('id, what_done')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)
      .eq('date', today)
      .single(),

    // Лог за вчера (для блокера)
    supabase
      .from('roadmap_daily_logs')
      .select('what_blocking, blocking_to_discuss_with_max, small_win')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)
      .eq('date', yesterdayStr)
      .single(),

    // Stalled разговоры с просроченным действием
    supabase
      .from('roadmap_conversations')
      .select('id, lead_name, lead_handle, next_action, next_action_due, channel')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)
      .in('status', ['hot', 'active', 'stalled'])
      .eq('next_action_done', false)
      .not('next_action_due', 'is', null)
      .lt('next_action_due', today)
      .order('next_action_due', { ascending: true })
      .limit(3),

    // Эксперименты готовые к решению (>= min_sample_size)
    supabase
      .from('roadmap_experiments')
      .select('id, hypothesis, current_value, min_sample_size')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('current_value', { ascending: false })
      .limit(2),

    // Pending significant decisions из Daily Log
    supabase
      .from('roadmap_daily_logs')
      .select('date, decision')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', user.id)
      .eq('has_significant_decision', true)
      .not('decision', 'is', null)
      .limit(5),
  ])

  // ── Вычисляем что показывать ──────────────────────────────

  const hasLogToday = !!todayLog?.id

  // Блокер из вчерашнего лога
  const blockerToDiscuss = yesterdayLog?.blocking_to_discuss_with_max
    ? yesterdayLog.what_blocking
    : null

  // Stalled разговоры
  const overdueConversations = (stalledConvs ?? []).map(c => {
    const dueDate = new Date(c.next_action_due!)
    const daysOverdue = Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    return {
      id: c.id,
      lead_name: c.lead_handle ?? c.lead_name,
      channel: c.channel,
      next_action: c.next_action,
      days_overdue: daysOverdue,
    }
  })

  // Эксперименты готовые к решению
  const experimentsReadyForDecision = (readyExperiments ?? [])
    .filter(e => e.current_value >= e.min_sample_size)
    .map(e => ({
      id: e.id,
      hypothesis: e.hypothesis,
      progress: `${e.current_value}/${e.min_sample_size}`,
    }))

  // Решения которые требуют follow-up сегодня
  const decisionsToFollowUp = (pendingDecisions ?? [])
    .filter(log => {
      const decision = log.decision as {
        follow_up_date?: string
        followed_up?: boolean
      } | null
      if (!decision || decision.followed_up) return false
      if (!decision.follow_up_date) return false
      return decision.follow_up_date <= today
    })
    .map(log => {
      const decision = log.decision as {
        decision_text: string
        expected_outcome: string
        follow_up_date: string
      }
      return {
        date_made: log.date,
        decision_text: decision.decision_text,
        expected_outcome: decision.expected_outcome,
        follow_up_date: decision.follow_up_date,
      }
    })

  // ── Определяем нужно ли показывать Morning View ───────────
  const hasContent = !!(
    blockerToDiscuss ||
    overdueConversations.length > 0 ||
    experimentsReadyForDecision.length > 0 ||
    decisionsToFollowUp.length > 0
  )

  // Morning View показывается если:
  // 1. Первый вход за день (нет лога за сегодня)
  // 2. Есть что показать
  const shouldShow = !hasLogToday && hasContent

  return NextResponse.json({
    should_show: shouldShow,
    has_log_today: hasLogToday,
    data: {
      blocker_to_discuss: blockerToDiscuss,
      yesterday_win: yesterdayLog?.small_win ?? null,
      overdue_conversations: overdueConversations,
      experiments_ready_for_decision: experimentsReadyForDecision,
      decisions_to_follow_up: decisionsToFollowUp,
    },
  })
}
