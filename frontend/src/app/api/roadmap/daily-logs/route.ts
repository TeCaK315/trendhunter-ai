/**
 * TrendHunter AI — Daily Log Route
 * src/app/api/roadmap/daily-logs/route.ts
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

// GET ?roadmap_id=&date= или ?roadmap_id=&range=last_7
export async function GET(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const roadmapId = searchParams.get('roadmap_id')
  const date = searchParams.get('date')         // конкретная дата YYYY-MM-DD
  const range = searchParams.get('range')       // last_7, last_30

  if (!roadmapId) return NextResponse.json({ error: 'roadmap_id required' }, { status: 400 })

  const supabase = getSupabase()

  let query = supabase
    .from('roadmap_daily_logs')
    .select('*')
    .eq('roadmap_id', roadmapId)
    .eq('user_id', user.id)

  if (date) {
    query = query.eq('date', date)
  } else if (range === 'last_7') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    query = query.gte('date', d.toISOString().split('T')[0])
  } else if (range === 'last_30') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    query = query.gte('date', d.toISOString().split('T')[0])
  }

  const { data, error } = await query.order('date', { ascending: false })

  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}

// POST — создать или обновить лог за день (upsert по date)
export async function POST(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    roadmap_id: string
    date?: string
    what_done?: string
    what_learned?: string
    what_blocking?: string
    energy?: number
    blocking_to_discuss_with_max?: boolean
    has_significant_decision?: boolean
    small_win?: string
    decision?: Record<string, unknown>
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.roadmap_id) {
    return NextResponse.json({ error: 'roadmap_id required' }, { status: 400 })
  }

  const today = body.date ?? new Date().toISOString().split('T')[0]

  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('roadmap_daily_logs')
    .upsert({
      roadmap_id: body.roadmap_id,
      user_id: user.id,
      date: today,
      what_done: body.what_done ?? null,
      what_learned: body.what_learned ?? null,
      what_blocking: body.what_blocking ?? null,
      energy: body.energy ?? null,
      blocking_to_discuss_with_max: body.blocking_to_discuss_with_max ?? false,
      has_significant_decision: body.has_significant_decision ?? false,
      small_win: body.small_win ?? null,
      decision: body.decision ?? null,
    }, { onConflict: 'user_id,roadmap_id,date' })
    .select()
    .single()

  if (error || !data) {
    console.error('[Daily Log POST]', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ log: data }, { status: 201 })
}
