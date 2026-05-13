import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { session_id, metric_name, value } = await req.json()
    if (!session_id || !metric_name || typeof value !== 'number') {
      return NextResponse.json({ error: 'session_id, metric_name, value required' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const { data: ownership } = await supabase
      .from('roadmap_sessions')
      .select('id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase
      .from('roadmap_user_metrics')
      .upsert(
        {
          session_id,
          metric_name,
          value,
          updated_via: 'ai_dialog',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'session_id,metric_name' }
      )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap metrics update]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
