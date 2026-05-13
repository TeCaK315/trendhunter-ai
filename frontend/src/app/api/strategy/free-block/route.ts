/**
 * TrendHunter AI — Free Block Route v4 (финальная)
 * src/app/api/strategy/free-block/route.ts
 *
 * Изменения v4:
 * - assembleResearchOutput() заменена реальным адаптером из research-adapter.ts
 * - user_id передаётся в адаптер (нужен для RLS запросов)
 * - Убран импорт getRerunCount (не используется напрямую)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

import { validateResearchData } from '@/lib/strategy/data-contract'
import {
  computeStrategyContext,
  EXPERIMENT_BUDGET_FLOOR,
  type UserInputs,
  type StrategyContext,
} from '@/lib/strategy/block0'
import {
  getOrCreateSession,
  updateSessionContext,
  recordRerun,
} from '@/lib/strategy/persistence'
import { MAX_RERUNS } from '@/lib/strategy/rule-engine'
import { getStrategyAuthUser } from '@/lib/strategy/auth'
import { assembleResearchOutput } from '@/lib/strategy/research-adapter'

export const maxDuration = 300

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

interface FreeBlockRequest {
  trend_id: string
  user_inputs: UserInputs
  rerun?: boolean
  rerun_choice?: 'path_a' | 'path_b'
}

interface FreeBlockResponse {
  status: 'green' | 'yellow' | 'red' | 'nogo_exit'
  strategy_mode: string
  segment: string
  preview?: {
    angle_hint: string
    channel_hint: string
    kill_switch_days: number
    experiment_budget: number
    ai_stack_cost: number
  }
  hard_stop?: {
    rule: string
    reason: string
    path_a: { label: string; description: string; action: string }
    path_b: { label: string; description: string; action: string }
    reruns_remaining: number
  }
  nogo_exit?: {
    reason: string
    alternative_niches: AlternativeNiche[]
  }
  instant_feedback: InstantFeedback
  session_id?: string
  data_warnings?: string[]
}

interface InstantFeedback {
  budget_vs_floor: {
    user_budget: number
    floor: number
    status: 'ok' | 'below_floor' | 'zero'
    message: string
  }
  horizon_vs_cycle: {
    horizon_days: number
    sale_cycle_days: number
    status: 'ok' | 'tight' | 'impossible'
    message: string
  }
  team_note: string | null
  advantage_notes: string[]
}

interface AlternativeNiche {
  name: string
  reason: string
}

// ─────────────────────────────────────────────────────────────
// SUPABASE
// ─────────────────────────────────────────────────────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─────────────────────────────────────────────────────────────
// MAIN HANDLER
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as FreeBlockRequest
    const { trend_id, user_inputs, rerun = false, rerun_choice } = body

    // ── Auth через NextAuth ───────────────────────────────────
    const user = await getStrategyAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ── Валидация rerun_choice ────────────────────────────────
    const VALID_RERUN_CHOICES = ['path_a', 'path_b'] as const
    if (rerun && rerun_choice && !(VALID_RERUN_CHOICES as readonly string[]).includes(rerun_choice)) {
      return NextResponse.json(
        { error: 'Invalid rerun_choice', valid: VALID_RERUN_CHOICES },
        { status: 400 }
      )
    }

    // ── Загружаем Research через адаптер ─────────────────────
    const supabase = getSupabase()
    const assembled = await assembleResearchOutput(trend_id, user.id, supabase as any)

    if (!assembled) {
      return NextResponse.json(
        {
          error: 'Research data not found',
          message: 'Сначала необходимо завершить раздел Исследование для этой ниши',
        },
        { status: 404 }
      )
    }

    // ── Валидируем через Zod schema ───────────────────────────
    const validationResult = validateResearchData(assembled.data)

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Research data invalid',
          reason: validationResult.reason,
          action: 'restart_research',
          message: 'Для этой ниши необходимо перезапустить Исследование',
        },
        { status: 422 }
      )
    }

    const research = validationResult.data
    const niche    = assembled.niche

    if (validationResult.warnings.length > 0) {
      console.warn(`[FreeBlock] Research warnings for ${trend_id}:`, validationResult.warnings)
    }

    // ── Block 0: StrategyContext ──────────────────────────────
    const block0Result = computeStrategyContext({
      research,
      inputs: user_inputs,
      niche,
      trend_id,
    })

    const { context, hard_stop, warnings: block0Warnings } = block0Result

    if (block0Warnings.length > 0) {
      console.warn('[FreeBlock] Block 0 warnings:', block0Warnings)
    }

    const instant_feedback = buildInstantFeedback(user_inputs, research, context)

    // ── nogo_exit ─────────────────────────────────────────────
    if (!context.strategy_available) {
      return NextResponse.json({
        status: 'nogo_exit',
        strategy_mode: 'nogo_exit',
        segment: context.segment,
        nogo_exit: {
          reason: 'При текущих параметрах и данных вход в эту нишу нецелесообразен.',
          alternative_niches: findAlternativeNiches(),
        },
        instant_feedback,
        data_warnings: validationResult.warnings,
      } satisfies FreeBlockResponse)
    }

    // ── Session создаётся ДО rerun check ─────────────────────
    const session = await getOrCreateSession({
      trend_id,
      user_id: user.id,
      context,
      research_snapshot: research,
    })

    // ── HARD_STOP ─────────────────────────────────────────────
    if (hard_stop) {
      let reruns_remaining = MAX_RERUNS

      if (rerun && rerun_choice) {
        try {
          const rerunRecord = await recordRerun({
            session_id:    session.id,
            rule_violated: hard_stop.rule,
            user_choice:   rerun_choice,
            new_params:    user_inputs as unknown as Record<string, unknown>,
          })
          reruns_remaining = Math.max(0, MAX_RERUNS - rerunRecord.rerun_number)
        } catch (rerunErr) {
          console.error('[FreeBlock] recordRerun failed:', rerunErr)
        }
      }

      return NextResponse.json({
        status: 'red',
        strategy_mode: context.strategy_mode,
        segment:       context.segment,
        hard_stop: {
          rule:            hard_stop.rule,
          reason:          hard_stop.reason,
          path_a:          hard_stop.path_a,
          path_b:          hard_stop.path_b,
          reruns_remaining,
        },
        instant_feedback,
        session_id:    session.id,
        data_warnings: validationResult.warnings,
      } satisfies FreeBlockResponse)
    }

    // ── Rerun: обновляем контекст ─────────────────────────────
    if (rerun) {
      await updateSessionContext(session.id, context)
    }

    // ── Green / Yellow ────────────────────────────────────────
    const status  = context.strategy_mode === 'go_mode' ? 'green' : 'yellow'
    const preview = buildPreview(context, research)

    return NextResponse.json({
      status,
      strategy_mode: context.strategy_mode,
      segment:       context.segment,
      preview,
      instant_feedback,
      session_id:    session.id,
      data_warnings: validationResult.warnings,
    } satisfies FreeBlockResponse)

  } catch (error) {
    console.error('[FreeBlock] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function buildInstantFeedback(
  inputs: UserInputs,
  research: any,
  context: StrategyContext
): InstantFeedback {
  const floor = EXPERIMENT_BUDGET_FLOOR[context.segment]

  const budgetStatus =
    inputs.budget_actual === 0 ? 'zero' :
    inputs.budget_actual < floor ? 'below_floor' : 'ok'

  const budgetMessage =
    budgetStatus === 'ok'
      ? `✓ Бюджет покрывает минимальный эксперимент для ${context.segment}`
      : budgetStatus === 'below_floor'
        ? `⚠ Стратегия будет построена под бесплатные каналы`
        : `Возможно если умеете писать код или есть аудитория`

  const horizonDays    = inputs.horizon_months * 30
  const saleCycleDays  = research.b3.sale_cycle_days

  const horizonStatus =
    horizonDays < saleCycleDays * 0.5 ? 'impossible' :
    horizonDays < saleCycleDays       ? 'tight'      : 'ok'

  const horizonMessage =
    horizonStatus === 'ok'
      ? `✓ За ${inputs.horizon_months} мес успеете получить первых платящих`
      : horizonStatus === 'tight'
        ? `⚠ Цикл сделки — ${saleCycleDays} дней. Успеете проверить спрос`
        : `⚠ Цикл сделки — ${saleCycleDays} дней. За ${inputs.horizon_months} мес сигнал сложно получить`

  const teamNote = inputs.team_size === 'solo'
    ? 'Стратегия не потребует найма. AI инструменты заменят команду.'
    : null

  const advantageNotes: string[] = []
  if (inputs.can_code)     advantageNotes.push('Снижает стоимость входа в 3-5 раз')
  if (inputs.has_audience) advantageNotes.push('Первые клиенты обойдутся почти бесплатно')
  if (inputs.has_partner)  advantageNotes.push('Канал привлечения уже есть')

  return {
    budget_vs_floor: {
      user_budget: inputs.budget_actual,
      floor,
      status:  budgetStatus,
      message: budgetMessage,
    },
    horizon_vs_cycle: {
      horizon_days: horizonDays,
      sale_cycle_days: saleCycleDays,
      status:  horizonStatus,
      message: horizonMessage,
    },
    team_note:       teamNote,
    advantage_notes: advantageNotes,
  }
}

function buildPreview(
  context: StrategyContext,
  research: any
): FreeBlockResponse['preview'] {
  const topGap    = research.b4.gap_map?.[0]
  const angleHint = topGap
    ? `Незакрытая боль: "${topGap.pain}" — ${Math.round(topGap.paying_ratio * 100)}% готовы платить`
    : research.b6.first_spot_teaser ?? 'Нестандартный угол входа на основе слепых пятен рынка'

  const channelHint = context.available_channels.length > 0
    ? `Доступные каналы: ${context.available_channels.slice(0, 2).join(', ')}`
    : 'Канал подбирается под ваши параметры'

  return {
    angle_hint:        angleHint,
    channel_hint:      channelHint,
    kill_switch_days:  context.kill_switch.experiment_days,
    experiment_budget: context.experiment_budget,
    ai_stack_cost:     context.can_code ? 0 : 165,
  }
}

function findAlternativeNiches(): AlternativeNiche[] {
  // TODO: подключить к реальной базе ниш после MVP тестирования
  return [
    { name: 'Смежная ниша с более низким CAC',    reason: 'Похожий рынок, ниже барьер входа' },
    { name: 'Нишевый сегмент текущего рынка',      reason: 'Узкая специализация, меньше конкуренции' },
    { name: 'B2B версия текущей идеи',             reason: 'Выше чек, меньше клиентов для окупаемости' },
  ]
}
