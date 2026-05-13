import { NextRequest, NextResponse } from 'next/server'
import { sendRoadmapEmail, type EmailTriggerType, APP_URL } from '@/lib/email/resend'
import { getAuthUser } from '@/lib/auth-helpers'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev only' }, { status: 403 })
  }
  const to = req.nextUrl.searchParams.get('to')
  const trigger = (req.nextUrl.searchParams.get('trigger') ?? 'discount_open') as EmailTriggerType
  const trendId = req.nextUrl.searchParams.get('trend_id')
  if (!to) {
    return NextResponse.json({ error: 'to query param required' }, { status: 400 })
  }
  const roadmapUrl = trendId
    ? `${APP_URL}/lk/roadmap?trend_id=${encodeURIComponent(trendId)}`
    : `${APP_URL}/lk/roadmap`
  const result = await sendRoadmapEmail({
    to,
    triggerType: trigger,
    data: {
      niche_title: 'Сервисы автоматизации процессов',
      hours_left: 24,
      discount_percent: 30,
      roadmap_url: roadmapUrl,
      unsubscribe_url: `${APP_URL}/api/unsubscribe?user_id=test`,
    },
  })
  return NextResponse.json(result)
}
