import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = getServerSupabase()

    const { data: trigger } = await supabase
      .from('roadmap_triggers')
      .select('id, session_id')
      .eq('id', id)
      .maybeSingle()
    if (!trigger) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: ownership } = await supabase
      .from('roadmap_sessions')
      .select('id')
      .eq('id', trigger.session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase
      .from('roadmap_triggers')
      .update({ acted_upon: true })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap trigger acted]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
