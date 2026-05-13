import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ unlocked: [] })
    }
    const trendId = req.nextUrl.searchParams.get('trend_id')
    if (!trendId) {
      return NextResponse.json({ error: 'trend_id required' }, { status: 400 })
    }
    const supabase = getServerSupabase()
    const { data } = await supabase
      .from('user_unlocks')
      .select('block_name')
      .eq('user_id', user.id)
      .eq('trend_id', trendId)

    const unlocked = (data ?? [])
      .map((r: { block_name: string }) => r.block_name)
      .filter((n) => n.startsWith('strategy_'))
      .map((n) => n.replace(/^strategy_/, '').toUpperCase())

    return NextResponse.json({ unlocked })
  } catch {
    return NextResponse.json({ unlocked: [] })
  }
}
