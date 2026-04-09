import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

// Маппинг block_type → block_number (как в API роутах)
const BLOCK_MAP: Record<string, { number: number; cost: number }> = {
  problem: { number: 1, cost: 5 },
  demand: { number: 2, cost: 5 },
  sellability: { number: 3, cost: 5 },
  occupation: { number: 4, cost: 8 },
  economics: { number: 5, cost: 8 },
  tech: { number: 6, cost: 5 },
}

// Маппинг block_type клиента → block_type в Supabase
const BLOCK_TYPE_MAP: Record<string, string> = {
  problem: 'problem',
  demand: 'demand',
  sellability: 'sellability',
  occupation: 'competition',
  economics: 'revenue_sizing',
  tech: 'blind_spots',
}

/**
 * POST /api/evidence/unlock
 *
 * 1. Списывает монеты (если ещё не оплачено)
 * 2. Возвращает premium данные из block_results.raw_data.premium
 *
 * Body: { trend_id: string, block: string }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { trend_id, block } = await req.json()

    if (!trend_id || !block) {
      return NextResponse.json({ error: 'trend_id and block required' }, { status: 400 })
    }

    const blockInfo = BLOCK_MAP[block]
    if (!blockInfo) {
      return NextResponse.json({ error: 'Invalid block type' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    // Проверяем, не разблокирован ли уже этот блок
    const { data: existingUnlock } = await supabase
      .from('user_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .eq('block_name', block)
      .maybeSingle()

    if (!existingUnlock) {
      // Ещё не оплачено — списываем монеты
      const { data: credits } = await supabase
        .from('user_credits')
        .select('balance')
        .eq('user_id', user.id)
        .single()

      const currentBalance = credits?.balance ?? 0
      if (currentBalance < blockInfo.cost) {
        return NextResponse.json(
          { error: 'Insufficient balance', balance: currentBalance },
          { status: 402 }
        )
      }

      const newBalance = currentBalance - blockInfo.cost

      const { error: updateError } = await supabase
        .from('user_credits')
        .update({ balance: newBalance })
        .eq('user_id', user.id)

      if (updateError) {
        throw new Error(`Balance update error: ${updateError.message}`)
      }

      // Записываем транзакцию
      await supabase.from('credit_transactions').insert({
        user_id: user.id,
        amount: -blockInfo.cost,
        type: 'block_unlock',
        description: `Разблокировка блока: ${block}`,
        trend_id,
      })

      // Записываем unlock
      try {
        await supabase.from('user_unlocks').upsert({
          user_id: user.id,
          trend_id,
          block_name: block,
          coins_spent: blockInfo.cost,
          unlocked_at: new Date().toISOString(),
        }, { onConflict: 'user_id,trend_id,block_name' })
      } catch {
        // user_unlocks table may not exist — non-critical
      }
    }

    // Получаем premium данные из block_results
    const { data: blockResult, error: fetchError } = await supabase
      .from('block_results')
      .select('raw_data')
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)
      .eq('block_number', blockInfo.number)
      .single()

    if (fetchError || !blockResult) {
      return NextResponse.json(
        { error: 'Block data not found. Run analysis first.' },
        { status: 404 }
      )
    }

    // v1 blocks store premium in raw_data.premium
    // v2 blocks store everything in raw_data directly (no .premium wrapper)
    const premiumData = blockResult.raw_data?.premium || blockResult.raw_data
    if (!premiumData) {
      return NextResponse.json(
        { error: 'Premium data not available for this block' },
        { status: 404 }
      )
    }

    // Получаем обновлённый баланс
    const { data: updatedCredits } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    return NextResponse.json({
      success: true,
      premium: premiumData,
      new_balance: updatedCredits?.balance ?? null,
    })
  } catch (error: any) {
    console.error('[Evidence unlock]', error)
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    )
  }
}
