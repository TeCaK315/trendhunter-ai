import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { amount, type, description, trend_id } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    // Проверяем баланс
    const { data: credits } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()

    const currentBalance = credits?.balance ?? 0
    if (currentBalance < amount) {
      return NextResponse.json(
        { error: 'Insufficient balance', balance: currentBalance },
        { status: 402 }
      )
    }

    // Списываем
    const newBalance = currentBalance - amount
    const { error: updateError } = await supabase
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)

    if (updateError) {
      throw new Error(`Update error: ${updateError.message}`)
    }

    // Записываем транзакцию
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: -amount,
      type: type || 'block_unlock',
      description: description || `Spent ${amount} coins`,
      trend_id: trend_id || null,
    })

    // Записываем unlock если это разблокировка блока
    if (type === 'block_unlock' && trend_id) {
      const blockName = description?.replace('Разблокировка блока: ', '') || 'unknown'
      try {
        await supabase.from('user_unlocks').upsert({
          user_id: user.id,
          trend_id,
          block_name: blockName,
          coins_spent: amount,
          unlocked_at: new Date().toISOString(),
        }, { onConflict: 'user_id,trend_id,block_name' })
      } catch {
        // user_unlocks table may not exist yet — non-critical
      }
    }

    return NextResponse.json({
      success: true,
      new_balance: newBalance,
      spent: amount,
    })
  } catch (error: any) {
    console.error('[Credits spend]', error)
    return NextResponse.json(
      { error: error.message || 'Internal error' },
      { status: 500 }
    )
  }
}
