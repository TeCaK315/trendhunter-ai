import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

const STRATEGY_BLOCK_COST: Record<string, number> = {
  S0: 0,
  S1: 500,
  S2: 500,
  S3: 500,
  S5: 500,
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { trend_id, block_id } = await req.json()
    if (!trend_id || !block_id) {
      return NextResponse.json({ error: 'trend_id and block_id required' }, { status: 400 })
    }
    const cost = STRATEGY_BLOCK_COST[block_id]
    if (cost === undefined) {
      return NextResponse.json({ error: 'Invalid block_id' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const blockName = `strategy_${block_id.toLowerCase()}`

    const { data: existing } = await supabase
      .from('user_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .eq('block_name', blockName)
      .maybeSingle()

    if (existing) {
      const { data: creditsRow } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()
      return NextResponse.json({
        success: true,
        already_unlocked: true,
        new_balance: creditsRow?.balance ?? 0,
      })
    }

    if (cost > 0) {
      const { data: creditsRow } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()
      const currentBalance = creditsRow?.balance ?? 0
      if (currentBalance < cost) {
        return NextResponse.json(
          { error: 'Insufficient balance', balance: currentBalance },
          { status: 402 }
        )
      }
      const { error: upErr } = await supabase
        .from('user_credits')
        .update({ balance: currentBalance - cost })
        .eq('user_id', user.id)
      if (upErr) throw new Error(`Balance update error: ${upErr.message}`)

      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: -cost,
        type: 'block_unlock',
        description: `Разблокировка блока стратегии: ${block_id}`,
        trend_id,
      })
    }

    await supabase.from('user_unlocks').upsert({
      user_id: user.id,
      trend_id,
      block_name: blockName,
      coins_spent: cost,
      unlocked_at: new Date().toISOString(),
    }, { onConflict: 'user_id,trend_id,block_name' })

    const { data: updated } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      already_unlocked: false,
      new_balance: updated?.balance ?? 0,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Strategy unlock]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
