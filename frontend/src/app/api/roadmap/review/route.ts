import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

interface Metric { metric_name: string; value: number }

const SCENARIO_DATA = {
  success: {
    title: 'Есть результат',
    subtitle: 'Ты получил платящих клиентов — это главное',
    color: '#5DCAA5',
    options: [
      { id: 'scale', label: 'Продолжить и масштабировать', description: 'Фокус на росте MRR и новых клиентах', action: 'extend' },
    ],
  },
  semi_success: {
    title: 'Прогресс есть, клиентов пока нет',
    subtitle: 'Ты двигаешься — первые клиенты часто приходят на втором цикле',
    color: '#FAC775',
    options: [
      { id: 'extend', label: 'Продолжить ещё 30 дней', description: '+ 2000 монет за дополнительный месяц', action: 'extend_30' },
      { id: 'pivot', label: 'Попробовать другую нишу', description: 'Начать новое Исследование со скидкой', action: 'new_research' },
    ],
  },
  failure: {
    title: 'Эта ниша не сработала',
    subtitle: 'Это ценная информация — ты исключил один вариант',
    color: '#F09595',
    options: [
      { id: 'pivot', label: 'Исследовать другую нишу', description: 'Скидка 20% на новое Исследование', action: 'new_research' },
    ],
  },
} as const

function getMetric(metrics: Metric[], name: string): number {
  const m = metrics.find((x) => x.metric_name === name)
  return m ? Number(m.value) || 0 : 0
}

function determineReviewScenario(metrics: Metric[]): keyof typeof SCENARIO_DATA {
  const payingClients = getMetric(metrics, 'paying_clients')
  const mrr = getMetric(metrics, 'mrr')
  const messagesSent = getMetric(metrics, 'messages_sent')
  const conversations = getMetric(metrics, 'conversations')
  if (payingClients > 0 || mrr > 0) return 'success'
  if (conversations >= 3 || messagesSent >= 10) return 'semi_success'
  return 'failure'
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const session_id = req.nextUrl.searchParams.get('session_id')
    if (!session_id) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

    const supabase = getServerSupabase()
    const { data: session } = await supabase
      .from('roadmap_sessions')
      .select('id, user_id, kill_switch_date')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const daysToKillSwitch = Math.ceil(
      (new Date(session.kill_switch_date as string).getTime() - Date.now()) / 86400000
    )
    const isReviewTime = daysToKillSwitch <= 7

    if (!isReviewTime) {
      return NextResponse.json({ review_available: false, days_to_kill_switch: daysToKillSwitch })
    }

    const { data: metricsData } = await supabase
      .from('roadmap_user_metrics')
      .select('metric_name, value')
      .eq('session_id', session_id)
    const metrics = (metricsData ?? []) as Metric[]

    const scenario = determineReviewScenario(metrics)

    return NextResponse.json({
      review_available: true,
      days_to_kill_switch: daysToKillSwitch,
      scenario,
      scenario_data: SCENARIO_DATA[scenario],
      metrics_summary: {
        paying_clients: getMetric(metrics, 'paying_clients'),
        mrr: getMetric(metrics, 'mrr'),
        messages_sent: getMetric(metrics, 'messages_sent'),
        conversations: getMetric(metrics, 'conversations'),
        replies_received: getMetric(metrics, 'replies_received'),
      },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap review]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
