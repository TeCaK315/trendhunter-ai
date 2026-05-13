import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

async function assertSessionOwnership(supabase: ReturnType<typeof getServerSupabase>, sessionId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('roadmap_sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('user_id', userId)
    .maybeSingle()
  return !!data
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session_id = req.nextUrl.searchParams.get('session_id')
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    const supabase = getServerSupabase()
    if (!(await assertSessionOwnership(supabase, session_id, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data } = await supabase
      .from('roadmap_user_metrics')
      .select('metric_name, value, updated_via, updated_at')
      .eq('session_id', session_id)

    return NextResponse.json({ metrics: data ?? [] })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap metrics GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { session_id, metric_name, value, updated_via } = await req.json()
    if (!session_id || !metric_name || typeof value !== 'number') {
      return NextResponse.json({ error: 'session_id, metric_name, value required' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    if (!(await assertSessionOwnership(supabase, session_id, user.id))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await supabase
      .from('roadmap_user_metrics')
      .upsert(
        {
          session_id,
          metric_name,
          value,
          updated_via: updated_via === 'ai_dialog' ? 'ai_dialog' : 'manual',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,metric_name' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap metrics POST]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
