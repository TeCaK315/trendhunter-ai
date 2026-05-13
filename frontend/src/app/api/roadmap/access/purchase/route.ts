import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

const FULL_PRICE = 5000
const DISCOUNT_PRICE = 3500

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { trend_id, use_discount } = (await req.json()) as { trend_id?: string; use_discount?: boolean }
    if (!trend_id) return NextResponse.json({ error: 'trend_id required' }, { status: 400 })

    const supabase = getServerSupabase()

    const { data: access } = await supabase
      .from('roadmap_access')
      .select('id, status, strategy_session_id, trial_expires_at, discount_window_until')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .maybeSingle()
    if (!access) {
      return NextResponse.json({ error: 'Access record not found' }, { status: 404 })
    }
    if (access.status === 'paid') {
      return NextResponse.json({ error: 'Already paid', status: 'paid' }, { status: 409 })
    }

    const now = new Date()
    const inDiscountWindow =
      access.status === 'discount_window' &&
      access.discount_window_until &&
      new Date(access.discount_window_until as string) > now

    const cost = use_discount && inDiscountWindow ? DISCOUNT_PRICE : FULL_PRICE
    const discountApplied = use_discount && !!inDiscountWindow

    // Проверяем баланс
    const { data: creditsRow } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single()
    const currentBalance = creditsRow?.balance ?? 0
    if (currentBalance < cost) {
      return NextResponse.json(
        { error: 'Insufficient credits', required: cost, current: currentBalance },
        { status: 402 }
      )
    }

    // Списываем монеты
    const newBalance = currentBalance - cost
    const { error: updErr } = await supabase
      .from('user_credits')
      .update({ balance: newBalance })
      .eq('user_id', user.id)
    if (updErr) {
      return NextResponse.json({ error: `Balance update failed: ${updErr.message}` }, { status: 500 })
    }

    // Транзакция
    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      amount: -cost,
      type: 'roadmap_unlock',
      description: `Роадмап Pro — ${trend_id}${discountApplied ? ' (-30%)' : ''}`,
      trend_id,
    })

    // user_unlocks (для совместимости — используем реальную схему block_name + coins_spent)
    try {
      await supabase.from('user_unlocks').upsert(
        {
          user_id: user.id,
          trend_id,
          block_name: 'roadmap_pro',
          coins_spent: cost,
          unlocked_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,trend_id,block_name' }
      )
    } catch {
      /* non-critical */
    }

    // paid_until из strategy_sessions.kill_switch_date
    const { data: stratSession } = await supabase
      .from('strategy_sessions')
      .select('kill_switch_date')
      .eq('id', access.strategy_session_id)
      .maybeSingle()
    const paid_until =
      (stratSession?.kill_switch_date as string | null) ??
      new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]

    const { error: accErr } = await supabase
      .from('roadmap_access')
      .update({ status: 'paid', paid_until })
      .eq('id', access.id)
    if (accErr) {
      return NextResponse.json({ error: `Access update failed: ${accErr.message}` }, { status: 500 })
    }

    // Синхронизируем статус в roadmap_sessions
    await supabase
      .from('roadmap_sessions')
      .update({ status: 'paid', paid_until })
      .eq('trend_id', trend_id)
      .eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      paid_until,
      cost_spent: cost,
      discount_applied: discountApplied,
      new_balance: newBalance,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap purchase]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
