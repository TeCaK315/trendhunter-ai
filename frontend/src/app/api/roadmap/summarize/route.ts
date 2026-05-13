/**
 * TrendHunter AI — Summarization Route
 * src/app/api/roadmap/summarize/route.ts
 *
 * Вызывается async ПОСЛЕ ответа Claude (не блокирует пользователя).
 * Haiku сжимает историю чата и обновляет структурированную память.
 *
 * Триггеры запуска (из chat/route.ts):
 *   - каждые 20 сообщений
 *   - при re-entry после 7+ дней отсутствия (sync режим)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getStrategyAuthUser } from '@/lib/strategy/auth'
// Используем общую логику суммаризации
import { runSummarization } from '@/lib/roadmap/summarization'

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

// Токен для internal server-to-server вызовов (без user session)
// Используется когда summarize вызывается из другого API route
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN


export async function POST(req: NextRequest) {
  const supabase = getSupabase()

  // ── Auth — два режима: user session ИЛИ internal token ────
  let userId: string

  const internalToken = req.headers.get('x-internal-token')
  if (internalToken) {
    // Internal server-to-server вызов (из другого API route)
    if (!INTERNAL_SERVICE_TOKEN || internalToken !== INTERNAL_SERVICE_TOKEN) {
      return NextResponse.json({ error: 'Invalid internal token' }, { status: 401 })
    }
    // userId придёт в body при internal вызове
    let tempBody: { roadmap_id: string; user_id: string; force?: boolean }
    try {
      tempBody = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
    if (!tempBody.user_id || !tempBody.roadmap_id) {
      return NextResponse.json({ error: 'roadmap_id and user_id required' }, { status: 400 })
    }
    const result = await runSummarization(tempBody.roadmap_id, tempBody.user_id, supabase)
    return NextResponse.json(result)
  }

  // Стандартный user-session auth
  const user = await getStrategyAuthUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  userId = user.id

  let body: {
    roadmap_id: string
    force?: boolean  // принудительный запуск (например при re-entry)
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { roadmap_id, force = false } = body

  if (!roadmap_id) {
    return NextResponse.json({ error: 'roadmap_id required' }, { status: 400 })
  }

  // ── При force=true — запускаем напрямую ───────────────────
  if (force) {
    const result = await runSummarization(roadmap_id, userId, supabase)
    return NextResponse.json(result)
  }

  // ── Проверяем нужна ли summarization (для ручного вызова) ─
  const { data: sess } = await supabase
    .from('roadmap_sessions')
    .select('message_count')
    .eq('id', roadmap_id)
    .eq('user_id', userId)
    .single()

  const messageCount = (sess?.message_count as number) ?? 0

  // Запускаем только каждые 20 сообщений или принудительно
  if (messageCount % 20 !== 0) {
    return NextResponse.json({
      skipped: true,
      reason: 'Not yet needed',
      message_count: messageCount,
    })
  }

  // ── Делегируем логику в runSummarization ────────────────
  // Вся логика (Haiku, memory updates) в src/lib/roadmap/summarization.ts
  const result = await runSummarization(roadmap_id, userId, supabase)

  return NextResponse.json({
    success: result.success,
    reason: result.reason,
    message_count: messageCount,
  })
}
