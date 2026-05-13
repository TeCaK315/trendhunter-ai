import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { banner_id } = await req.json()
    if (!banner_id) return NextResponse.json({ error: 'banner_id required' }, { status: 400 })

    const supabase = getServerSupabase()

    const { data: banner } = await supabase
      .from('roadmap_in_app_banners')
      .select('id, session_id')
      .eq('id', banner_id)
      .maybeSingle()
    if (!banner) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: ownership } = await supabase
      .from('roadmap_sessions')
      .select('id')
      .eq('id', banner.session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabase
      .from('roadmap_in_app_banners')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', banner_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap banner dismiss]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
