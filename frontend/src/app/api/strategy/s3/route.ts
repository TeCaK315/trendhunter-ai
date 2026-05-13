/**
 * TrendHunter AI — S3 Route: Первые 10 клиентов
 * src/app/api/strategy/s3/route.ts
 *
 * ВАЖНО: channel_type валидируется против available_channels.
 * buildS3Prompt динамически инжектирует только доступные каналы.
 */

import { Research } from '@/lib/strategy/data-contract'
import { buildS3Prompt } from '@/lib/strategy/prompts/s3'
import { extractS3Decision, buildFromDecisions } from '@/lib/strategy/block-decision'
import { createStrategyRoute } from '@/lib/strategy/route-builder'

export const POST = createStrategyRoute({
  block_id: 'S3',
  max_tokens: 2000,

  buildData: ({ research, context, decisions }) => {
    const fromDecisions = buildFromDecisions(
      { S0: decisions.S0, S1: decisions.S1, S2: decisions.S2 },
      'S3'
    )
    return {
      strategy_context: {
        strategy_mode:      context.strategy_mode,
        segment:            context.segment,
        kill_switch:        context.kill_switch,
        available_channels: context.available_channels,
        data_sufficiency:   context.data_sufficiency,
      },
      research: {
        search_volume:           Research.searchVolume(research),
        commercial_intent_ratio: Research.commercialIntentRatio(research),
        sale_cycle_days:         Research.saleCycleDays(research),
        acquisition_type:        Research.acquisitionType(research),
        cac_mid:                 Research.cacMid(research),
        cac_spread_flag:         Research.cacSpreadFlag(research),
        experiment_budget:       Research.experimentBudget(research),
      },
      ...fromDecisions,
    }
  },

  buildPrompt: ({ dataJson, context, constraints }) =>
    buildS3Prompt({ dataJson, context, constraints }),

  extractDecision: (output) => extractS3Decision(output),
})
