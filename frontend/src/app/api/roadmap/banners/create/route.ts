import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'
import { createBannerIfFresh, type BannerType } from '@/lib/roadmap/banners'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { session_id, banner_type, content } = (await req.json()) as {
      session_id?: string
      banner_type?: BannerType
      content?: string
    }
    if (!session_id || !banner_type || !content) {
      return NextResponse.json({ error: 'session_id, banner_type, content required' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const { data: ownership } = await supabase
      .from('roadmap_sessions')
      .select('id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!ownership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const created = await createBannerIfFresh({ session_id, banner_type, content })
    return NextResponse.json(created ? { created: true } : { skipped: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap banners create]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
