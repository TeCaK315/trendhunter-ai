import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const trend_id = req.nextUrl.searchParams.get('trend_id')
    if (!trend_id) return NextResponse.json({ error: 'trend_id required' }, { status: 400 })

    const supabase = getServerSupabase()

    const { data: access } = await supabase
      .from('roadmap_access')
      .select('*')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .maybeSingle()

    if (!access) return NextResponse.json({ status: 'none' })

    const now = new Date()
    let currentStatus = access.status as string
    let discountWindowUntil = access.discount_window_until as string | null

    if (
      currentStatus === 'trial' &&
      access.trial_expires_at &&
      new Date(access.trial_expires_at as string) < now
    ) {
      const dwu = new Date(access.trial_expires_at as string)
      dwu.setHours(dwu.getHours() + 48)
      discountWindowUntil = dwu.toISOString()
      currentStatus = dwu > now ? 'discount_window' : 'expired'
      await supabase
        .from('roadmap_access')
        .update({ status: currentStatus, discount_window_until: discountWindowUntil })
        .eq('id', access.id)
    }

    if (
      currentStatus === 'discount_window' &&
      discountWindowUntil &&
      new Date(discountWindowUntil) < now
    ) {
      currentStatus = 'expired'
      await supabase.from('roadmap_access').update({ status: 'expired' }).eq('id', access.id)
    }

    const { data: session } = await supabase
      .from('roadmap_sessions')
      .select('id, kill_switch_date')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .maybeSingle()

    const daysLeft = session?.kill_switch_date
      ? Math.max(0, Math.ceil((new Date(session.kill_switch_date as string).getTime() - now.getTime()) / 86400000))
      : null

    const discountHoursLeft = discountWindowUntil
      ? Math.max(0, Math.ceil((new Date(discountWindowUntil).getTime() - now.getTime()) / 3600000))
      : null

    return NextResponse.json({
      status: currentStatus,
      trial_expires_at: access.trial_expires_at,
      discount_window_until: discountWindowUntil,
      paid_until: access.paid_until,
      days_left: daysLeft,
      discount_hours_left: discountHoursLeft,
      session_id: session?.id ?? null,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap status]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
