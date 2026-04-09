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

    // Load synthesis + block timestamps in parallel
    const [synthesisRes, blocksRes] = await Promise.all([
      supabase
        .from('synthesis_results')
        .select('conflicts, skeptic, optimist, arbitrator, is_blind_spot, created_at')
        .eq('trend_id', trendId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from('block_results')
        .select('block_number, updated_at, created_at')
        .eq('trend_id', trendId)
        .eq('user_id', user.id),
    ])

    if (synthesisRes.error || !synthesisRes.data) {
      return NextResponse.json({ result: null })
    }

    const data = synthesisRes.data

    // Staleness check: any block updated AFTER synthesis was created?
    let is_stale = false
    let stale_blocks: number[] = []
    if (blocksRes.data && data.created_at) {
      const synthesisTime = new Date(data.created_at).getTime()
      for (const block of blocksRes.data) {
        const blockTime = block.updated_at || block.created_at
        if (blockTime && new Date(blockTime).getTime() > synthesisTime) {
          is_stale = true
          stale_blocks.push(block.block_number)
        }
      }
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
      is_stale,
      stale_blocks: stale_blocks.sort((a, b) => a - b),
    })
  } catch (error: any) {
    console.error('[Synthesis cached]', error)
    return NextResponse.json({ result: null })
  }
}
