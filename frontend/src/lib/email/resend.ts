import { Resend } from 'resend'
import { buildEmailTemplate, type EmailTemplateData, type EmailTriggerType } from './templates'

export type { EmailTriggerType, EmailTemplateData }

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev'
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://trendhunter.ai'

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null

// Намеренно any — supabase server client типы не тянем.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any

export async function isUserUnsubscribed(supabase: Supa, userId: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from('email_unsubscribes')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle()
    return !!data
  } catch {
    return false
  }
}

export async function wasEmailSent(
  supabase: Supa,
  userId: string,
  triggerType: EmailTriggerType,
  sessionId?: string | null
): Promise<boolean> {
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString()
    let query = supabase
      .from('roadmap_email_notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('trigger_type', triggerType)
      .gte('sent_at', since)
    if (sessionId) query = query.eq('session_id', sessionId)
    const { data } = await query.maybeSingle()
    return !!data
  } catch {
    return false
  }
}

export async function recordEmailSent(
  supabase: Supa,
  userId: string,
  triggerType: EmailTriggerType,
  sessionId?: string | null
): Promise<void> {
  try {
    await supabase.from('roadmap_email_notifications').insert({
      user_id: userId,
      session_id: sessionId ?? null,
      trigger_type: triggerType,
    })
  } catch (e) {
    console.error('[email] recordEmailSent failed:', e)
  }
}

export async function sendRoadmapEmail(params: {
  to: string
  triggerType: EmailTriggerType
  data: EmailTemplateData
}): Promise<{ success: boolean; error?: string }> {
  if (!resend) {
    console.warn('[email] RESEND_API_KEY not set, skipping send')
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }
  try {
    const template = buildEmailTemplate(params.triggerType, params.data)
    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: template.subject,
      html: template.html,
    })
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[email] Failed to send ${params.triggerType}:`, msg)
    return { success: false, error: msg }
  }
}

/**
 * Композитный helper: проверяет отписку + дедуп, отправляет, записывает.
 */
export async function dispatchRoadmapEmail(params: {
  supabase: Supa
  userId: string
  email: string
  triggerType: EmailTriggerType
  sessionId?: string | null
  data: EmailTemplateData
}): Promise<{ sent: boolean; reason?: string; error?: string }> {
  const { supabase, userId, email, triggerType, sessionId, data } = params
  if (await isUserUnsubscribed(supabase, userId)) {
    return { sent: false, reason: 'unsubscribed' }
  }
  if (await wasEmailSent(supabase, userId, triggerType, sessionId)) {
    return { sent: false, reason: 'already_sent_within_7d' }
  }
  const sent = await sendRoadmapEmail({ to: email, triggerType, data })
  if (!sent.success) return { sent: false, reason: 'send_failed', error: sent.error }
  await recordEmailSent(supabase, userId, triggerType, sessionId)
  return { sent: true }
}
