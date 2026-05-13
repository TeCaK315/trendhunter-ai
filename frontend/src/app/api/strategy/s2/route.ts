/**
 * TrendHunter AI — S2 Route: v1 Продукт
 * src/app/api/strategy/s2/route.ts
 */

import { Research } from '@/lib/strategy/data-contract'
import { buildS2Prompt } from '@/lib/strategy/prompts/s2'
import { extractS2Decision, buildFromDecisions } from '@/lib/strategy/block-decision'
import { createStrategyRoute } from '@/lib/strategy/route-builder'

export const POST = createStrategyRoute({
  block_id: 'S2',
  max_tokens: 1800,

  buildData: ({ research, context, decisions }) => {
    const fromDecisions = buildFromDecisions(
      { S0: decisions.S0, S1: decisions.S1 },
      'S2'
    )
    return {
      strategy_context: {
        strategy_mode:     context.strategy_mode,
        segment:           context.segment,
        data_sufficiency:  context.data_sufficiency,
        resource_profile:  context.resource_profile,
        experiment_budget: context.experiment_budget,
      },
      research: {
        gap_map:             Research.gapMap(research),
        acquisition_type:    Research.acquisitionType(research),
        avg_switching_cost:  Research.avgSwitchingCost(research),
        substitute_strength: research.b4.substitute_strength,
        price_model:         Research.priceModel(research),
        friction_score:      Research.frictionScore(research),
        sale_cycle_days:     Research.saleCycleDays(research),
        experiment_budget:   Research.experimentBudget(research),
        priority_actions:    Research.priorityActions(research),
      },
      ...fromDecisions,
    }
  },

  buildPrompt: ({ dataJson, context, constraints }) =>
    buildS2Prompt({ dataJson, context, constraints }),

  extractDecision: (output) => extractS2Decision(output),
})
