import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'
import { syncSessionBanners } from '@/lib/roadmap/banners'

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const trend_id = req.nextUrl.searchParams.get('trend_id')
    if (!trend_id) return NextResponse.json({ error: 'trend_id required' }, { status: 400 })

    const supabase = getServerSupabase()

    const { data: access } = await supabase
      .from('roadmap_access')
      .select('id, strategy_session_id, status, trial_expires_at, discount_window_until, paid_until')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .maybeSingle()
    if (!access || access.status === 'expired' || access.status === 'churned') {
      return NextResponse.json({ error: 'No active access' }, { status: 403 })
    }

    let { data: roadmapSession } = await supabase
      .from('roadmap_sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('trend_id', trend_id)
      .maybeSingle()

    if (!roadmapSession) {
      const { data: stratSession } = await supabase
        .from('strategy_sessions')
        .select('kill_switch_date')
        .eq('id', access.strategy_session_id)
        .maybeSingle()
      const killSwitchDate =
        (stratSession?.kill_switch_date as string | null) ??
        new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0]
      const { data: newSession, error: newErr } = await supabase
        .from('roadmap_sessions')
        .insert({
          user_id: user.id,
          trend_id,
          access_id: access.id,
          kill_switch_date: killSwitchDate,
          last_active_at: new Date().toISOString(),
        })
        .select()
        .single()
      if (newErr || !newSession) {
        return NextResponse.json({ error: newErr?.message ?? 'Insert failed' }, { status: 500 })
      }
      roadmapSession = newSession
    } else {
      await supabase
        .from('roadmap_sessions')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', roadmapSession.id)
    }

    // Auto-create banners (kill switch warnings, milestones, proactive return)
    try {
      await syncSessionBanners({
        id: roadmapSession.id,
        kill_switch_date: roadmapSession.kill_switch_date,
        created_at: roadmapSession.created_at,
        last_active_at: roadmapSession.last_active_at,
      })
    } catch {}

    const today = new Date().toISOString().split('T')[0]
    const [metricsRes, dailyActionRes, triggersRes, bannersRes, strategyContextRes] = await Promise.all([
      supabase
        .from('roadmap_user_metrics')
        .select('metric_name, value, updated_via, updated_at')
        .eq('session_id', roadmapSession.id),
      supabase
        .from('roadmap_daily_actions')
        .select('action_text, generated_by_role, generated_at')
        .eq('session_id', roadmapSession.id)
        .eq('date', today)
        .maybeSingle(),
      supabase
        .from('roadmap_triggers')
        .select('*')
        .eq('session_id', roadmapSession.id)
        .order('generated_at', { ascending: false })
        .limit(5),
      supabase
        .from('roadmap_in_app_banners')
        .select('*')
        .eq('session_id', roadmapSession.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('block_decisions')
        .select('block_id, translated_output')
        .eq('session_id', access.strategy_session_id)
        .in('block_id', ['S0', 'S1', 'S3', 'S5']),
    ])

    const strategy_context: Record<string, unknown> = {}
    for (const block of (strategyContextRes.data ?? []) as Array<{ block_id: string; translated_output: unknown }>) {
      strategy_context[block.block_id] = block.translated_output
    }

    return NextResponse.json({
      session: roadmapSession,
      access: {
        status: access.status,
        trial_expires_at: access.trial_expires_at,
        discount_window_until: access.discount_window_until,
        paid_until: access.paid_until,
      },
      dashboard: {
        metrics: metricsRes.data ?? [],
        daily_action: dailyActionRes.data ?? null,
        triggers: triggersRes.data ?? [],
        banners: bannersRes.data ?? [],
      },
      strategy_context,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap session]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
