/**
 * TrendHunter AI — Experiments Route
 * src/app/api/roadmap/experiments/route.ts
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

// GET ?roadmap_id=&status=
export async function GET(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const roadmapId = searchParams.get('roadmap_id')
  const expId = searchParams.get('id')
  const status = searchParams.get('status')

  if (!roadmapId && !expId) {
    return NextResponse.json({ error: 'roadmap_id or id required' }, { status: 400 })
  }

  const supabase = getSupabase()

  if (expId) {
    const { data, error } = await supabase
      .from('roadmap_experiments')
      .select('*')
      .eq('id', expId)
      .eq('user_id', user.id)
      .single()
    if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ experiment: data })
  }

  let query = supabase
    .from('roadmap_experiments')
    .select('*')
    .eq('roadmap_id', roadmapId!)
    .eq('user_id', user.id)

  if (status) query = query.eq('status', status)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'DB error' }, { status: 500 })

  return NextResponse.json({ experiments: data ?? [] })
}

// POST — создать эксперимент
export async function POST(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    roadmap_id: string
    hypothesis: string
    category: string
    metric: string
    metric_custom?: string
    target_value: number
    min_sample_size?: number
    duration_days?: number
    cost_hours_estimated?: number
    cost_money_estimated?: number
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.roadmap_id || !body.hypothesis || !body.category || !body.metric) {
    return NextResponse.json(
      { error: 'roadmap_id, hypothesis, category, metric required' },
      { status: 400 }
    )
  }

  const supabase = getSupabase()

  const durationDays = body.duration_days ?? 14
  const endsAt = new Date()
  endsAt.setDate(endsAt.getDate() + durationDays)

  const { data, error } = await supabase
    .from('roadmap_experiments')
    .insert({
      roadmap_id: body.roadmap_id,
      user_id: user.id,
      hypothesis: body.hypothesis,
      category: body.category,
      metric: body.metric,
      metric_custom: body.metric_custom ?? null,
      target_value: body.target_value,
      current_value: 0,
      min_sample_size: body.min_sample_size ?? 20,
      duration_days: durationDays,
      ends_at: endsAt.toISOString(),
      status: 'active',
      confidence: 'weak_signal',
      cost_hours_estimated: body.cost_hours_estimated ?? null,
      cost_money_estimated: body.cost_money_estimated ?? null,
      evidence_snapshots: [],
    })
    .select()
    .single()

  if (error || !data) {
    console.error('[Experiments POST]', error)
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 })
  }

  return NextResponse.json({ experiment: data }, { status: 201 })
}

// PATCH ?id= — обновить эксперимент или добавить evidence
export async function PATCH(req: NextRequest) {
  const user = await getStrategyAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const expId = searchParams.get('id')
  if (!expId) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = getSupabase()

  // Если добавляем evidence snapshot — специальная логика
  if (body.add_evidence) {
    const evidence = body.add_evidence as {
      observation: string
      data_point?: number
      source?: string
    }

    const { data: current } = await supabase
      .from('roadmap_experiments')
      .select('evidence_snapshots, current_value, min_sample_size')
      .eq('id', expId)
      .eq('user_id', user.id)
      .single()

    if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const snapshots = (current.evidence_snapshots as unknown[]) ?? []
    snapshots.push({
      timestamp: new Date().toISOString(),
      observation: evidence.observation,
      data_point: evidence.data_point ?? null,
      source: evidence.source ?? 'manual',
    })

    const newValue = current.current_value + 1
    const newConfidence = calculateConfidence(newValue, current.min_sample_size)

    const { data, error } = await supabase
      .from('roadmap_experiments')
      .update({
        evidence_snapshots: snapshots,
        current_value: newValue,
        confidence: newConfidence,
      })
      .eq('id', expId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ experiment: data })
  }

  // Обычное обновление полей
  const ALLOWED = [
    'status', 'confidence', 'current_value',
    'result_summary', 'why_validated', 'why_rejected', 'lesson',
    'completed_at', 'cost_hours_actual', 'cost_money_actual',
    'related_conversation_ids',
  ]

  const updates: Record<string, unknown> = {}
  for (const field of ALLOWED) {
    if (field in body) updates[field] = body[field]
  }

  if (body.status === 'validated' || body.status === 'rejected') {
    updates.completed_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('roadmap_experiments')
    .update(updates)
    .eq('id', expId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ experiment: data })
}

// ─────────────────────────────────────────────────────────────
// HELPER — вычисляем confidence по прогрессу
// Из ROADMAP_WORKSPACE_ARCHITECTURE.md раздел 3.3
// ─────────────────────────────────────────────────────────────

function calculateConfidence(
  observations: number,
  minSampleSize: number
): 'weak_signal' | 'emerging' | 'probable' | 'validated' {
  const ratio = observations / minSampleSize
  if (ratio < 0.25) return 'weak_signal'
  if (ratio < 0.5) return 'emerging'
  if (ratio < 1.0) return 'probable'
  return 'validated'
}
