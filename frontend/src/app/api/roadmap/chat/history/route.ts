import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session_id = req.nextUrl.searchParams.get('session_id')
    const before = req.nextUrl.searchParams.get('before')
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    const supabase = getServerSupabase()
    const { data: ownership } = await supabase
      .from('roadmap_sessions')
      .select('id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    let query = supabase
      .from('roadmap_chat_messages')
      .select('id, role, ai_role, content, created_at')
      .eq('session_id', session_id)
      .order('created_at', { ascending: false })
      .limit(20)
    if (before) query = query.lt('created_at', before)

    const { data } = await query

    return NextResponse.json({
      messages: (data ?? []).reverse(),
      has_more: (data ?? []).length === 20,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap chat history]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
