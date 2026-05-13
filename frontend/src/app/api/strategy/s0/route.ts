/**
 * TrendHunter AI — S0 Route v3: Угол атаки
 * src/app/api/strategy/s0/route.ts
 */

import { Research } from '@/lib/strategy/data-contract'
import { buildS0Prompt } from '@/lib/strategy/prompts/s0'
import { extractS0Decision } from '@/lib/strategy/block-decision'
import { createStrategyRoute, maxDuration as _maxDuration } from '@/lib/strategy/route-builder'

// Vercel Pro: 300s для SSE
export const maxDuration = _maxDuration

export const POST = createStrategyRoute({
  block_id: 'S0',
  max_tokens: 1500,

  buildData: ({ research, context }) => ({
    strategy_context: {
      strategy_mode:      context.strategy_mode,
      resource_profile:   context.resource_profile,
      segment:            context.segment,
      condition:          context.condition,
      kill_switch:        context.kill_switch,
      data_sufficiency:   context.data_sufficiency,
      available_channels: context.available_channels,
      current_date:       context.current_date,
    },
    research: {
      gap_map:               Research.gapMap(research),
      gap_type:              Research.gapType(research),
      competition_intensity: Research.competitionIntensity(research),
      acquisition_type:      Research.acquisitionType(research),
      avg_switching_cost:    Research.avgSwitchingCost(research),
      paying_ratio:          Research.payingRatio(research),
      pain_clusters:         Research.painClusters(research),
      blind_spots_count:     Research.blindSpotsCount(research),
      blind_spots_impact:    Research.blindSpotsImpact(research),
      first_spot_teaser:     Research.firstSpotTeaser(research),
      has_revenue_multiplier: Research.hasRevenueMultiplier(research),
      asymmetric_advantage:  Research.asymmetricAdvantage(research),
    },
  }),

  buildPrompt: ({ dataJson, context, constraints }) =>
    buildS0Prompt({ dataJson, context, constraints }),

  extractDecision: (output) =>
    extractS0Decision(output, output['is_hypothesis'] as boolean),
})
