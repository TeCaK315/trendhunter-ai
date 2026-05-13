import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { trend_id, strategy_session_id } = await req.json()
    if (!trend_id || !strategy_session_id) {
      return NextResponse.json({ error: 'trend_id and strategy_session_id required' }, { status: 400 })
    }

    const supabase = getServerSupabase()

    const { data: stratSession } = await supabase
      .from('strategy_sessions')
      .select('id, kill_switch_date')
      .eq('id', strategy_session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!stratSession) {
      return NextResponse.json({ error: 'Strategy session not found' }, { status: 404 })
    }

    const { data: existing } = await supabase
      .from('roadmap_access')
      .select('id, status, trial_expires_at, paid_until')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ access: existing, already: true })
    }

    const now = new Date()
    const trialExpires = new Date(now)
    trialExpires.setDate(trialExpires.getDate() + 3)

    const { data: access, error: accErr } = await supabase
      .from('roadmap_access')
      .insert({
        user_id: user.id,
        trend_id,
        strategy_session_id,
        trial_started_at: now.toISOString(),
        trial_expires_at: trialExpires.toISOString(),
        status: 'trial',
      })
      .select()
      .single()
    if (accErr || !access) {
      return NextResponse.json({ error: accErr?.message ?? 'Insert failed' }, { status: 500 })
    }

    const killSwitchDate =
      (stratSession.kill_switch_date as string | null) ??
      new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]

    const { data: roadmapSession, error: sessErr } = await supabase
      .from('roadmap_sessions')
      .insert({
        user_id: user.id,
        trend_id,
        access_id: access.id,
        kill_switch_date: killSwitchDate,
      })
      .select()
      .single()
    if (sessErr || !roadmapSession) {
      return NextResponse.json({ error: sessErr?.message ?? 'Session insert failed' }, { status: 500 })
    }

    const initialMetrics = ['messages_sent', 'replies_received', 'conversations', 'paying_clients', 'mrr'].map(
      (metric_name) => ({
        session_id: roadmapSession.id,
        metric_name,
        value: 0,
        updated_via: 'manual' as const,
      })
    )
    await supabase.from('roadmap_user_metrics').insert(initialMetrics)

    await supabase.from('roadmap_in_app_banners').insert({
      session_id: roadmapSession.id,
      banner_type: 'trial_welcome',
      content: 'Добро пожаловать в Роадмап Pro! Первые 3 дня бесплатно.',
    })

    // Save email for future notifications (trial_ending / discount_*)
    if (user.email) {
      try {
        await supabase.from('user_profiles').upsert(
          { user_id: user.id, email: user.email },
          { onConflict: 'user_id' }
        )
      } catch (e) {
        console.error('[activate-trial] user_profiles upsert failed:', e)
      }
    }

    return NextResponse.json({ access, session: roadmapSession })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap activate-trial]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
