import { getServerSupabase } from '@/lib/supabase'

const BANNER_TYPES = [
  'kill_switch_30', 'kill_switch_14', 'kill_switch_7',
  'new_trigger', 'milestone_30', 'milestone_90',
  'proactive_return', 'weekly_summary', 'trial_welcome',
] as const

export type BannerType = typeof BANNER_TYPES[number]

/**
 * Создаёт баннер если не было активного баннера этого типа за последние 24ч.
 * Возвращает true если баннер создан, false если пропущен из-за дедупа.
 */
export async function createBannerIfFresh(params: {
  session_id: string
  banner_type: BannerType
  content: string
}): Promise<boolean> {
  const supabase = getServerSupabase()
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('roadmap_in_app_banners')
      .select('id')
      .eq('session_id', params.session_id)
      .eq('banner_type', params.banner_type)
      .is('dismissed_at', null)
      .gte('created_at', since)
      .maybeSingle()
    if (existing) return false

    await supabase
      .from('roadmap_in_app_banners')
      .insert({
        session_id: params.session_id,
        banner_type: params.banner_type,
        content: params.content,
      })
    return true
  } catch {
    return false
  }
}

/**
 * Авто-создание баннеров для сессии исходя из её состояния.
 * Вызывается при каждом GET /api/roadmap/session.
 */
export async function syncSessionBanners(session: {
  id: string
  kill_switch_date: string
  created_at?: string | null
  last_active_at?: string | null
}): Promise<void> {
  const now = new Date()
  const killSwitch = new Date(session.kill_switch_date)
  const daysLeft = Math.ceil((killSwitch.getTime() - now.getTime()) / 86400000)

  if (daysLeft > 0 && daysLeft <= 7) {
    await createBannerIfFresh({
      session_id: session.id,
      banner_type: 'kill_switch_7',
      content: `До kill switch date осталось ${daysLeft} дн. Пора подвести итоги.`,
    })
  } else if (daysLeft > 7 && daysLeft <= 14) {
    await createBannerIfFresh({
      session_id: session.id,
      banner_type: 'kill_switch_14',
      content: `До kill switch date осталось ${daysLeft} дн.`,
    })
  } else if (daysLeft > 14 && daysLeft <= 30) {
    await createBannerIfFresh({
      session_id: session.id,
      banner_type: 'kill_switch_30',
      content: `До kill switch date осталось ${daysLeft} дн. Проверь прогресс.`,
    })
  }

  if (session.created_at) {
    const daysSinceStart = Math.floor((now.getTime() - new Date(session.created_at).getTime()) / 86400000)
    if (daysSinceStart >= 30 && daysSinceStart < 32) {
      await createBannerIfFresh({
        session_id: session.id,
        banner_type: 'milestone_30',
        content: 'Прошло 30 дней работы. Сверься с метриками — как ты относительно плана?',
      })
    }
    if (daysSinceStart >= 90 && daysSinceStart < 92) {
      await createBannerIfFresh({
        session_id: session.id,
        banner_type: 'milestone_90',
        content: 'Прошло 90 дней. Это финальная точка — время Review.',
      })
    }
  }

  if (session.last_active_at) {
    const daysSilent = Math.floor((now.getTime() - new Date(session.last_active_at).getTime()) / 86400000)
    if (daysSilent >= 3) {
      await createBannerIfFresh({
        session_id: session.id,
        banner_type: 'proactive_return',
        content: `Ты не заходил ${daysSilent} дн. Что происходит? AI Стратег готов помочь.`,
      })
    }
  }
}
