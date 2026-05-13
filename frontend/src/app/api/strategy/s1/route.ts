/**
 * TrendHunter AI — S1 Route v3: Первый клиент
 * src/app/api/strategy/s1/route.ts
 */

import { Research } from '@/lib/strategy/data-contract'
import { buildS1Prompt } from '@/lib/strategy/prompts/s1'
import { extractS1Decision, buildFromDecisions } from '@/lib/strategy/block-decision'
import { createStrategyRoute } from '@/lib/strategy/route-builder'

export const maxDuration = 300

export const POST = createStrategyRoute({
  block_id: 'S1',
  max_tokens: 1800,

  buildData: ({ research, context, decisions }) => {
    const fromDecisions = buildFromDecisions({ S0: decisions.S0 }, 'S1')
    return {
      strategy_context: {
        strategy_mode:      context.strategy_mode,
        segment:            context.segment,
        condition:          context.condition,
        data_sufficiency:   context.data_sufficiency,
        kill_switch:        context.kill_switch,
        available_channels: context.available_channels,
      },
      research: {
        paying_ratio:       Research.payingRatio(research),
        pain_clusters:      Research.painClusters(research),
        top_complaints:     Research.topComplaints(research),
        gap_map:            Research.gapMap(research),
        avg_switching_cost: Research.avgSwitchingCost(research),
        first_spot_teaser:  Research.firstSpotTeaser(research),
        blind_spots_impact: Research.blindSpotsImpact(research),
        price_range_median: Research.priceMedian(research),
        sale_cycle_days:    Research.saleCycleDays(research),
        market_type:        Research.marketType(research),
      },
      ...fromDecisions,
    }
  },

  buildPrompt: ({ dataJson, context, constraints }) =>
    buildS1Prompt({ dataJson, context, constraints }),

  extractDecision: (output) => extractS1Decision(output),
})
