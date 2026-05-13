/**
 * TrendHunter AI — S5 Route: Путь к деньгам
 * src/app/api/strategy/s5/route.ts
 *
 * Финальный блок. Не передаёт данные дальше.
 * barrierType берётся из BlockDecision S0 для timeline multiplier.
 * experiment_kill_switch_date предвычислена в buildS5Prompt.
 */

import { Research } from '@/lib/strategy/data-contract'
import { buildS5Prompt } from '@/lib/strategy/prompts/s5'
import { buildFromDecisions } from '@/lib/strategy/block-decision'
import { createStrategyRoute } from '@/lib/strategy/route-builder'

export const POST = createStrategyRoute({
  block_id: 'S5',
  max_tokens: 2200,

  buildData: ({ research, context, decisions }) => {
    const fromDecisions = buildFromDecisions(
      { S0: decisions.S0, S1: decisions.S1, S2: decisions.S2, S3: decisions.S3 },
      'S5'
    )
    return {
      strategy_context: {
        strategy_mode:    context.strategy_mode,
        current_date:     context.current_date,
        kill_switch:      context.kill_switch,
        segment:          context.segment,
        data_sufficiency: context.data_sufficiency,
      },
      research: {
        revenue_mid:             Research.revenueMid(research),
        revenue_low:             Research.revenueLow(research),
        revenue_high:            Research.revenueHigh(research),
        cac_mid:                 Research.cacMid(research),
        months_to_first_revenue: Research.monthsToFirstRevenue(research),
        experiment_budget:       Research.experimentBudget(research),
        payback_months:          Research.paybackMonths(research),
        main_economic_risk:      research.b5.main_economic_risk,
        revenue_quality:         research.b5.revenue_quality,
        price_range_median:      Research.priceMedian(research),
        price_model:             Research.priceModel(research),
        sale_cycle_days:         Research.saleCycleDays(research),
        confidence:              Research.confidence(research),
      },
      ...fromDecisions,
    }
  },

  buildPrompt: ({ dataJson, context, constraints, decisions }) => {
    const barrierType = (decisions.S0?.fields.barrier_type?.value as string) ?? 'SPEED'
    return buildS5Prompt({ dataJson, context, constraints, barrierType })
  },

  // S5 — финальный блок, не передаёт данные дальше
  extractDecision: () => ({
    block_id: 'S5',
    fields: {},
    constraints_added: [],
  }),
})
