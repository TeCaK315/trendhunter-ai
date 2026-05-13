/**
 * TrendHunter AI — Conversations Route
 * src/app/api/roadmap/conversations/route.ts
 *
 * CRUD для Conversations Tracker.
 * Все запросы привязаны к roadmap_id + user_id — изоляция данных.
 *
 * GET    ?roadmap_id=&status=  → список разговоров
 * POST                         → создать разговор
 * PATCH  ?id=                  → обновить разговор
 * DELETE ?id=                  → удалить разговор
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

// ─────────────────────────────────────────────────────────────
// GET — список разговоров
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const roadmapId = searchParams.get('roadmap_id')
  const status = searchParams.get('status')      // фильтр по статусу
  const convId = searchParams.get('id')          // одна карточка

  if (!roadmapId && !convId) {
    return NextResponse.json({ error: 'roadmap_id or id required' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Одна карточка (для Marcus — передаём active_conversation_id)
  if (convId) {
    const { data, error } = await supabase
      .from('roadmap_conversations')
      .select('*')
      .eq('id', convId)
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.json({ conversation: data })
  }

  // Список с фильтрами
  let query = supabase
    .from('roadmap_conversations')
    .select(`
      id, lead_name, lead_handle, channel, status, trajectory,
      first_contact_at, last_message_at, next_action, next_action_due,
      next_action_done, outcome_reason, promoted_to_personal,
      created_at, updated_at
    `)
    .eq('roadmap_id', roadmapId!)
    .eq('user_id', user.id)

  if (status) {
    query = query.eq('status', status)
  }

  // Сортировка: hot → active → stalled, внутри по next_action_due
  query = query
    .order('status', { ascending: true })
    .order('next_action_due', { ascending: true, nullsFirst: false })
    .order('last_message_at', { ascending: false })

  const { data, error } = await query

  if (error) {
    console.error('[Conversations GET]', error)
    return NextResponse.json({ error: 'DB error' }, { status: 500 })
  }

  // Агрегаты для дашборда
  const now = new Date()
  const stats = {
    total: data?.length ?? 0,
    hot: data?.filter(c => c.status === 'hot').length ?? 0,
    active: data?.filter(c => c.status === 'active').length ?? 0,
    stalled: data?.filter(c => c.status === 'stalled').length ?? 0,
    won: data?.filter(c => c.status === 'won').length ?? 0,
    lost: data?.filter(c => c.status === 'lost').length ?? 0,
    overdue: data?.filter(c =>
      !c.next_action_done &&
      c.next_action_due &&
      new Date(c.next_action_due) < now
    ).length ?? 0,
  }

  return NextResponse.json({ conversations: data ?? [], stats })
}

// ─────────────────────────────────────────────────────────────
// POST — создать разговор
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    roadmap_id: string
    lead_name: string
    channel: string
    channel_other?: string
    lead_handle?: string
    first_contact_at?: string
    notes?: string
    next_action?: string
    next_action_due?: string
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { roadmap_id, lead_name, channel } = body

  if (!roadmap_id || !lead_name || !channel) {
    return NextResponse.json(
      { error: 'roadmap_id, lead_name, channel required' },
      { status: 400 }
    )
  }

  const supabase = getSupabase()

  // Проверяем что roadmap принадлежит пользователю
  const { data: session } = await supabase
    .from('roadmap_sessions')
    .select('id')
    .eq('id', roadmap_id)
    .eq('user_id', user.id)
    .single()

  if (!session) {
    return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('roadmap_conversations')
    .insert({
      roadmap_id,
      user_id: user.id,
      lead_name: body.lead_name,
      lead_handle: body.lead_handle ?? null,
      channel: body.channel,
      channel_other: body.channel_other ?? null,
      status: 'active',
      first_contact_at: body.first_contact_at ?? new Date().toISOString(),
      notes: body.notes ?? null,
      next_action: body.next_action ?? null,
      next_action_due: body.next_action_due ?? null,
      message_history: [],
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[Conversations POST]', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }

  return NextResponse.json({ conversation: data }, { status: 201 })
}

// ─────────────────────────────────────────────────────────────
// PATCH — обновить разговор
// Поддерживает частичное обновление — только переданные поля
// ─────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const convId = searchParams.get('id')
  if (!convId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Список разрешённых полей для обновления
  const ALLOWED_FIELDS = [
    'lead_name', 'lead_handle', 'channel', 'channel_other',
    'status', 'trajectory',
    'last_message_at', 'last_user_action_at',
    'next_action', 'next_action_due', 'next_action_done',
    'message_history', 'notes',
    'outcome_reason', 'outcome_reason_detail',
    'related_experiment_ids', 'used_templates',
    'promoted_to_personal', 'pre_adjust', 'post_adjust',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) {
      updates[field] = body[field]
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Автоматически двигаем в stalled если просрочен next_action_due
  if (
    updates.status === undefined &&
    updates.next_action_due === undefined
  ) {
    const { data: current } = await supabase
      .from('roadmap_conversations')
      .select('status, next_action_due, next_action_done')
      .eq('id', convId)
      .eq('user_id', user.id)
      .single()

    if (
      current &&
      !current.next_action_done &&
      current.next_action_due &&
      new Date(current.next_action_due) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) && // 3+ дня просрочено
      current.status === 'active'
    ) {
      updates.status = 'stalled'
    }
  }

  const { data, error } = await supabase
    .from('roadmap_conversations')
    .update(updates)
    .eq('id', convId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error || !data) {
    console.error('[Conversations PATCH]', error)
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ conversation: data })
}

// ─────────────────────────────────────────────────────────────
// DELETE — удалить разговор
// ─────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const convId = searchParams.get('id')
  if (!convId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = getSupabase()

  const { error } = await supabase
    .from('roadmap_conversations')
    .delete()
    .eq('id', convId)
    .eq('user_id', user.id)  // Защита — нельзя удалить чужое

  if (error) {
    console.error('[Conversations DELETE]', error)
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
