import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session_id = req.nextUrl.searchParams.get('session_id')
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    const supabase = getServerSupabase()
    const { data: ownership } = await supabase
      .from('roadmap_sessions')
      .select('id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data } = await supabase
      .from('roadmap_triggers')
      .select('*')
      .eq('session_id', session_id)
      .order('generated_at', { ascending: false })
      .limit(10)

    await supabase
      .from('roadmap_triggers')
      .update({ seen_by_user: true })
      .eq('session_id', session_id)
      .eq('seen_by_user', false)

    return NextResponse.json({ triggers: data ?? [] })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap triggers GET]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
