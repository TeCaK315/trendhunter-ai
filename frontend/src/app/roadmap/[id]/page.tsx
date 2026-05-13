/**
 * TrendHunter AI — Roadmap Page
 * src/app/roadmap/[id]/page.tsx
 *
 * Основная страница Роадмапа.
 * Layout: сайдбар (220px) + дашборд (50%) + чат (50%)
 */

import { redirect } from 'next/navigation'
import { getStrategyAuthUser } from '@/lib/strategy/auth'
import { getServerSupabase } from '@/lib/supabase'
import RoadmapClient from './RoadmapClient'

// ─────────────────────────────────────────────────────────────
// Server Component — загружаем начальные данные на сервере
// ─────────────────────────────────────────────────────────────

export default async function RoadmapPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: roadmapId } = await params
  const user = await getStrategyAuthUser()
  if (!user) redirect('/auth/signin')

  const userId = user.id

  const supabase = getServerSupabase()

  // Загружаем сессию роадмапа
  const { data: roadmapSession } = await supabase
    .from('roadmap_sessions')
    .select('*')
    .eq('id', roadmapId)
    .eq('user_id', userId)
    .single()

  if (!roadmapSession) {
    redirect('/lk')
  }

  // Считаем день из 90
  const createdAt = new Date(roadmapSession.created_at)
  const now = new Date()
  const dayNumber = Math.max(
    1,
    Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  )

  const ksDate = new Date(roadmapSession.kill_switch_date)
  const daysRemaining = Math.max(
    0,
    Math.ceil((ksDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  )

  // Загружаем начальные данные для дашборда параллельно
  const [
    { data: conversations },
    { data: experiments },
    { data: recentLogs },
    { data: lastMessages },
  ] = await Promise.all([
    supabase
      .from('roadmap_conversations')
      .select('id, lead_name, lead_handle, channel, status, trajectory, next_action, next_action_due, next_action_done, outcome_reason, last_message_at')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .order('updated_at', { ascending: false }),

    supabase
      .from('roadmap_experiments')
      .select('id, hypothesis, status, confidence, current_value, min_sample_size, category')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),

    supabase
      .from('roadmap_daily_logs')
      .select('date, energy, what_blocking, blocking_to_discuss_with_max')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(7),

    supabase
      .from('roadmap_chat_messages')
      .select('id, role, ai_role, content, created_at')
      .eq('roadmap_id', roadmapId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  // Формируем начальные данные для клиента
  const initialData = {
    session: {
      ...roadmapSession,
      day_number: dayNumber,
      days_remaining: daysRemaining,
    },
    conversations: conversations ?? [],
    experiments: experiments ?? [],
    recentLogs: recentLogs ?? [],
    // Разворачиваем сообщения в хронологическом порядке
    chatHistory: [...(lastMessages ?? [])].reverse(),
  }

  return <RoadmapClient roadmapId={roadmapId} initialData={initialData} />
}
