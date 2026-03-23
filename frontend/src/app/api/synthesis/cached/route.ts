import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const trendId = req.nextUrl.searchParams.get('trend_id')
    if (!trendId) {
      return NextResponse.json({ error: 'trend_id required' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const { data, error } = await supabase
      .from('synthesis_results')
      .select('conflicts, skeptic, optimist, arbitrator, is_blind_spot, created_at')
      .eq('trend_id', trendId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json({ result: null })
    }

    return NextResponse.json({
      result: {
        conflicts: data.conflicts || [],
        skeptic: data.skeptic || {},
        optimist: data.optimist || {},
        arbitrator: data.arbitrator || {},
      },
      is_blind_spot: data.is_blind_spot,
      created_at: data.created_at,
    })
  } catch (error: any) {
    console.error('[Synthesis cached]', error)
    return NextResponse.json({ result: null })
  }
}
