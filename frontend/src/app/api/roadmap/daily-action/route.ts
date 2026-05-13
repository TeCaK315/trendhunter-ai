import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export const maxDuration = 60

type Phase = 'outreach' | 'engaging' | 'converting' | 'scaling'

const PHASE_CONTEXT: Record<Phase, string> = {
  outreach: 'Пользователь только начинает — нужно первое касание с потенциальными клиентами',
  engaging: 'Есть отправленные сообщения — нужно развивать диалоги',
  converting: 'Есть разговоры — нужно переводить их в продажи',
  scaling: 'Есть платящие клиенты — нужно масштабировать',
}

function determinePhase(metrics: Record<string, number>): Phase {
  if ((metrics.paying_clients ?? 0) > 0) return 'scaling'
  if ((metrics.conversations ?? 0) >= 3) return 'converting'
  if ((metrics.messages_sent ?? 0) >= 5) return 'engaging'
  return 'outreach'
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
      .select('id, user_id, trend_id, access_id')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const today = new Date().toISOString().split('T')[0]

    const { data: existing } = await supabase
      .from('roadmap_daily_actions')
      .select('action_text, generated_by_role, generated_at')
      .eq('session_id', session_id)
      .eq('date', today)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ daily_action: existing })
    }

    const { data: access } = await supabase
      .from('roadmap_access')
      .select('strategy_session_id')
      .eq('id', session.access_id)
      .maybeSingle()

    const [metricsRes, strategyRes, historyRes] = await Promise.all([
      supabase.from('roadmap_user_metrics').select('metric_name, value').eq('session_id', session_id),
      supabase
        .from('block_decisions')
        .select('block_id, translated_output')
        .eq('session_id', access?.strategy_session_id ?? '')
        .in('block_id', ['S0', 'S1', 'S2', 'S3', 'S5']),
      supabase
        .from('roadmap_daily_actions')
        .select('action_text, date')
        .eq('session_id', session_id)
        .order('date', { ascending: false })
        .limit(7),
    ])

    const metrics: Record<string, number> = Object.fromEntries(
      ((metricsRes.data ?? []) as Array<{ metric_name: string; value: number }>).map((m) => [m.metric_name, Number(m.value) || 0])
    )

    const strategy: Record<string, { specific?: Record<string, unknown> }> = {}
    for (const b of (strategyRes.data ?? []) as Array<{ block_id: string; translated_output: { specific?: Record<string, unknown> } }>) {
      strategy[b.block_id] = b.translated_output
    }

    const recentActions = (historyRes.data ?? [])
      .map((a: { action_text: string; date: string }) => `${a.date}: ${a.action_text}`)
      .join('\n')

    const phase = determinePhase(metrics)

    const s0 = strategy.S0?.specific as Record<string, unknown> | undefined
    const s1 = strategy.S1?.specific as Record<string, unknown> | undefined
    const s3 = strategy.S3?.specific as Record<string, unknown> | undefined

    const positioning = (s0?.positioning_quote as string) ?? 'не определена'
    const versusName = ((s0?.versus_block as { them?: { name?: string } })?.them?.name) ?? '—'
    const clientWho = ((s1?.client_portrait as { who?: string })?.who) ?? 'не определён'
    const channelName = ((s3?.channel as { human_name?: string; where_exactly?: string })?.human_name) ?? 'не определён'
    const channelWhere = ((s3?.channel as { human_name?: string; where_exactly?: string })?.where_exactly) ?? 'не определено'

    const prompt = `Ты AI Стратег — ментор solo-founder.

НИША: ${session.trend_id}
ПОЗИЦИЯ: ${positioning}
КОНКУРЕНТ: ${versusName}
ПЕРВЫЙ КЛИЕНТ: ${clientWho}
КАНАЛ: ${channelName}
ГДЕ ИМЕННО: ${channelWhere}

ТЕКУЩИЕ МЕТРИКИ:
- Сообщений отправлено: ${metrics.messages_sent ?? 0}
- Разговоров: ${metrics.conversations ?? 0}
- Платящих клиентов: ${metrics.paying_clients ?? 0}
- MRR: $${metrics.mrr ?? 0}

ФАЗА: ${PHASE_CONTEXT[phase]}

ПОСЛЕДНИЕ 7 ДЕЙСТВИЙ (не повторять):
${recentActions || 'нет предыдущих действий'}

ЗАДАЧА: Сформулируй ОДНО конкретное действие на сегодня. Требования:
- Одно действие, не список
- Конкретное: где именно, что написать/сделать
- Выполнимо за 30-60 минут
- Соответствует текущей фазе
- Не повторяет предыдущие действия
- На русском языке
- Максимум 2-3 предложения

Формат ответа — только текст действия, без заголовков и вступления.`

    const anthropic = new Anthropic({ timeout: 30_000 })
    let actionText = ''
    let attempt = 0
    while (attempt < 3 && !actionText) {
      try {
        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }],
        })
        actionText = response.content
          .filter((b) => b.type === 'text')
          .map((b) => (b as { text: string }).text)
          .join('')
          .trim()
      } catch (err: unknown) {
        const status = (err as { status?: number })?.status
        if (status === 429 && attempt < 2) {
          attempt++
          await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)))
        } else throw err
      }
    }

    if (!actionText) {
      return NextResponse.json({ error: 'Не удалось сгенерировать' }, { status: 500 })
    }

    const generated_at = new Date().toISOString()
    await supabase.from('roadmap_daily_actions').insert({
      session_id,
      date: today,
      action_text: actionText,
      generated_by_role: 'strategist',
      context: { phase, metrics_snapshot: metrics, strategy_niche: session.trend_id },
    })

    return NextResponse.json({
      daily_action: { action_text: actionText, generated_by_role: 'strategist', generated_at },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[Roadmap daily-action]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
