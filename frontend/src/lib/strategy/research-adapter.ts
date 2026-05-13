/**
 * TrendHunter AI — Research Adapter (FIXED)
 * src/lib/strategy/research-adapter.ts
 *
 * Собирает ResearchOutput из трёх таблиц раздела Исследование.
 * Маппинг верифицирован по реальной схеме БД (10.04.2026).
 * FIX: cac_scenarios.recommended читается из правильного места
 * FIX: market_type_resolved как приоритетный источник market_type
 */

import { createClient } from '@supabase/supabase-js'

interface BlockRow {
  block_number: number; block_type: string; diagnosis: 'green' | 'yellow' | 'red'
  score: number; conflict_weight: number; key_metric: string | null
  key_factors: string[]; block_context: Record<string, unknown>
}

interface SynthesisRow {
  arbitrator: {
    verdict_type: 'go_if' | 'experiment_if' | 'no_go_until'; confidence: number
    verdict_condition: string | null; verdict_reasoning: string | null
    priority_actions: { order: number; action: string; timeline: string; addresses: string }[]
    confidence_factors: string[]; bridge_text: string | null
  } | null
  conflicts: { pair: string; type: string; weight: number; mechanism: string; blocks_involved: number[] }[] | null
  strategic_delta: {
    show: boolean
    standard_path: { revenue_annual: number; months_to_revenue: number; success_probability: number; main_trap: string }
    strategic_path: { revenue_annual: number; months_to_revenue: number; success_probability: number; is_locked: boolean }
    delta_revenue: number; delta_months: number; delta_probability: number; uplift_multiplier: number
    gap_drivers: { title: string; source: string }[]; verdict_frame: string; cta_text: string
  } | null
  sales_text: string | null; bridge_text: string | null
}

function n(val: unknown, fallback = 0): number { const v = Number(val); return isNaN(v) ? fallback : v }
function str(val: unknown, fallback = ''): string { return typeof val === 'string' ? val : fallback }
function bool(val: unknown, fallback = false): boolean { return typeof val === 'boolean' ? val : fallback }
function arr(val: unknown): string[] { return Array.isArray(val) ? val.filter(x => typeof x === 'string') : [] }
function clamp(val: number, min: number, max: number): number { return Math.min(max, Math.max(min, val)) }

function deriveCompetitionIntensity(competitorCount: number, gapType: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'SATURATED' {
  if (gapType === 'none' && competitorCount > 20) return 'SATURATED'
  if (competitorCount > 15) return 'HIGH'
  if (competitorCount > 7) return 'MEDIUM'
  return 'LOW'
}

function mapPriceModel(archetype: string): 'subscription' | 'one_time' | 'usage' | 'hybrid' {
  if (archetype?.includes('USAGE_BASED')) return 'usage'
  return 'subscription'
}

function mapAcquisitionType(archetype: string): 'PLG' | 'SALES_LED' | 'SEO_LED' | 'COMMUNITY' {
  if (archetype?.includes('SELF_SERVICE') || archetype?.includes('FREEMIUM')) return 'PLG'
  return 'SALES_LED'
}

function mapDemandStrength(diagnosis: string, hasDeclineSignal: boolean, hasHypeRisk: boolean): 'STRONG' | 'MEDIUM' | 'LOW' | 'DECLINING' {
  if (hasDeclineSignal) return 'DECLINING'
  if (diagnosis === 'green') return hasHypeRisk ? 'MEDIUM' : 'STRONG'
  if (diagnosis === 'yellow') return 'MEDIUM'
  return 'LOW'
}

function mapSwitchingCost(requiresSalesContact: boolean, priceUsd: number | null, archetype: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (archetype?.includes('ENTERPRISE') || requiresSalesContact) return 'HIGH'
  if ((priceUsd ?? 0) > 500) return 'HIGH'
  if ((priceUsd ?? 0) > 100) return 'MEDIUM'
  return 'LOW'
}

function mapSaleCycleDays(archetype: string, requiresSalesContact: boolean, priceUsd: number | null): number {
  if (archetype?.includes('ENTERPRISE') || requiresSalesContact) return (priceUsd ?? 0) > 5000 ? 90 : 45
  if (archetype?.includes('SELF_SERVICE') || archetype?.includes('FREEMIUM')) return 7
  if ((priceUsd ?? 0) > 100) return 21
  return 14
}

export interface AssembledResearch { data: Record<string, unknown>; niche: string }

export async function buildResearchOutput(
  trendId: string, userId: string, supabase: ReturnType<typeof createClient>
): Promise<AssembledResearch | null> {
  const [blocksRes, synthRes, interpsRes] = await Promise.all([
    supabase.from('block_results').select('block_number, block_type, diagnosis, score, conflict_weight, key_metric, key_factors, block_context').eq('trend_id', trendId).eq('user_id', userId).order('block_number'),
    supabase.from('synthesis_results').select('arbitrator, conflicts, strategic_delta, sales_text, bridge_text').eq('trend_id', trendId).eq('user_id', userId).maybeSingle(),
    supabase.from('block_interpretations').select('block_id, headline, main_insight, key_facts, decision_impact').eq('trend_id', trendId),
  ])

  if (blocksRes.error || !blocksRes.data || blocksRes.data.length === 0) return null

  const blocks = blocksRes.data as BlockRow[]
  const synth = synthRes.data as SynthesisRow | null
  const block = (num: number): Record<string, unknown> => (blocks.find(b => b.block_number === num)?.block_context ?? {})

  const b1ctx = block(1); const b2ctx = block(2); const b3ctx = block(3)
  const b4ctx = block(4); const b5ctx = block(5); const b6ctx = block(6)
  const b1row = blocks.find(b => b.block_number === 1)
  const b2row = blocks.find(b => b.block_number === 2)
  const b4row = blocks.find(b => b.block_number === 4)

  const niche = str(b1ctx['niche'], 'Unknown niche')

  const payingRatioRaw = n(b1ctx['paying_users_ratio'], 0)
  const paying_ratio = clamp(payingRatioRaw > 1 ? payingRatioRaw / 100 : payingRatioRaw, 0, 1)

  // FIX: market_type_resolved as priority source
  const market_type_raw = str((b5ctx['market_type_resolved'] ?? b5ctx['market_type'] ?? 'B2B') as unknown, 'B2B')
  const market_type = (['B2C', 'B2B', 'mixed'].includes(market_type_raw) ? market_type_raw : 'B2B') as 'B2C' | 'B2B' | 'mixed'

  const dynamics_raw = str(b1ctx['dynamics'], 'stable')
  const dynamics = (['growing', 'stable', 'declining'].includes(dynamics_raw) ? dynamics_raw : 'stable') as 'growing' | 'stable' | 'declining'
  const pain_type_raw = str(b1ctx['pain_type'], 'bad_solution')
  const pain_type = (['bad_solution', 'no_solution', 'expensive_solution'].includes(pain_type_raw) ? pain_type_raw : 'bad_solution') as 'bad_solution' | 'no_solution' | 'expensive_solution'
  const classification_confidence_raw = str(b1ctx['classification_confidence'], 'medium')
  const classification_confidence = (['high', 'medium', 'low'].includes(classification_confidence_raw) ? classification_confidence_raw : 'medium') as 'high' | 'medium' | 'low'

  const demand_index = n(b2ctx['demand_index'], 0)
  const commercial_intent_ratio = clamp(n(b2ctx['commercial_intent_ratio'], 0.3), 0, 1)
  const has_declining_signal = bool(b2ctx['has_declining_signal'])
  const has_hype_risk = bool(b2ctx['has_hype_risk'])
  const demand_strength = mapDemandStrength(str(b2row?.diagnosis, 'yellow'), has_declining_signal, has_hype_risk)

  const archetype = str(b3ctx['monetization_archetype'], 'UNKNOWN')
  const requires_sales_contact = bool(b3ctx['requires_sales_contact'])
  const entry_price = b3ctx['entry_price_usd'] != null ? n(b3ctx['entry_price_usd']) : null
  const compMono = Array.isArray(b3ctx['competitor_monetization']) ? b3ctx['competitor_monetization'] as { price_usd?: number }[] : []
  const prices = compMono.map(c => c.price_usd).filter((p): p is number => typeof p === 'number' && p > 0)
  const price_range_median = entry_price ?? (prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : null)

  const friction_score_raw = str(b3ctx['friction_score'], 'MEDIUM')
  const friction_score = (['HIGH', 'MEDIUM', 'LOW'].includes(friction_score_raw) ? friction_score_raw : 'MEDIUM') as 'HIGH' | 'MEDIUM' | 'LOW'
  const monetization_quality_raw = str(b3ctx['monetization_quality'], 'STABLE')
  const monetization_quality = (['SCALABLE', 'STABLE', 'FRAGILE'].includes(monetization_quality_raw) ? monetization_quality_raw : 'STABLE') as 'SCALABLE' | 'STABLE' | 'FRAGILE'

  const gap_type_raw = str(b4ctx['gap_type'], 'none')
  const gap_type = (['execution', 'strategic', 'none'].includes(gap_type_raw) ? gap_type_raw : 'none') as 'execution' | 'strategic' | 'none'
  const top_gap_category = b4ctx['top_gap_category'] as string | null
  const gap_map = top_gap_category && gap_type !== 'none' ? [{ pain: top_gap_category, paying_ratio, status: 'open' as const, category: top_gap_category }] : []
  const competitor_count = n(b4ctx['competitor_count'], 0)

  // FIX: cac_scenarios.recommended lives INSIDE cac_scenarios, not at top-level b5ctx
  const cacScenarios = b5ctx['cac_scenarios'] as Record<string, { low: number; mid: number; high: number } | string> | null
  const recommendedChannel = str(cacScenarios?.['recommended'] as unknown, 'plg').toLowerCase()
  const cac_mid = cacScenarios ? ((cacScenarios[recommendedChannel] as { mid?: number })?.mid ?? (cacScenarios['plg'] as { mid?: number })?.mid ?? null) : null

  const cac_scenarios = cacScenarios ? {
    plg: { low: n((cacScenarios['plg'] as any)?.low), mid: n((cacScenarios['plg'] as any)?.mid), high: n((cacScenarios['plg'] as any)?.high) },
    seo_led: { low: n((cacScenarios['seo_led'] as any)?.low), mid: n((cacScenarios['seo_led'] as any)?.mid), high: n((cacScenarios['seo_led'] as any)?.high) },
    community_led: { low: n((cacScenarios['community_led'] as any)?.low), mid: n((cacScenarios['community_led'] as any)?.mid), high: n((cacScenarios['community_led'] as any)?.high) },
    sales_led: { low: n((cacScenarios['sales_led'] as any)?.low), mid: n((cacScenarios['sales_led'] as any)?.mid), high: n((cacScenarios['sales_led'] as any)?.high) },
    recommended: (['PLG', 'SALES_LED', 'SEO_LED', 'COMMUNITY'].includes(str(cacScenarios?.['recommended'] as unknown).toUpperCase()) ? str(cacScenarios?.['recommended'] as unknown).toUpperCase() : 'PLG') as 'PLG' | 'SALES_LED' | 'SEO_LED' | 'COMMUNITY',
  } : null

  const revenue_confidence_raw = str(b5ctx['revenue_confidence'], 'LOW')
  const revenue_confidence = (['HIGH', 'MEDIUM', 'LOW'].includes(revenue_confidence_raw) ? revenue_confidence_raw : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW'
  const revenue_quality_raw = str(b5ctx['revenue_quality'], 'LOW')
  const revenue_quality = (['HIGH', 'MEDIUM', 'LOW'].includes(revenue_quality_raw) ? revenue_quality_raw : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW'

  const blind_spots_impact_raw = str(b6ctx['blind_spots_impact'], 'NONE')
  const blind_spots_impact = (['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(blind_spots_impact_raw) ? blind_spots_impact_raw : 'NONE') as 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  const data_quality_confidence_raw = str(b6ctx['data_quality_confidence'], 'LOW')
  const data_quality_confidence = (['HIGH', 'MEDIUM', 'LOW'].includes(data_quality_confidence_raw) ? data_quality_confidence_raw : 'LOW') as 'HIGH' | 'MEDIUM' | 'LOW'

  const arb = synth?.arbitrator ?? null
  const verdict_raw = str(arb?.verdict_type, 'no_go_until')
  const verdict = (['go_if', 'experiment_if', 'no_go_until'].includes(verdict_raw) ? verdict_raw : 'no_go_until') as 'go_if' | 'experiment_if' | 'no_go_until'
  const confidence = clamp(n(arb?.confidence, 0.5), 0.1, 0.95)
  const priority_actions = (arb?.priority_actions ?? []).sort((a, b) => a.order - b.order).map(p => p.action)
  const bridge_text = synth?.bridge_text ?? arb?.bridge_text ?? null
  const strategic_delta = synth?.strategic_delta
  const asymmetric_advantage = strategic_delta?.show && strategic_delta?.gap_drivers?.[0] ? strategic_delta.gap_drivers[0].title : null
  const strategy_mode_recommendation = verdict === 'go_if' ? 'go_mode' : verdict === 'experiment_if' ? 'experiment_mode' : null

  const assembled: Record<string, unknown> = {
    version: '1.0',
    normalized: { currency: 'USD', revenue_unit: 'annual', time_unit: 'days', amounts_unit: 'absolute', normalization_applied: [] },
    b1: { paying_ratio, pain_clusters: arr(b1row?.key_factors), top_complaints: arr(b1row?.key_factors), dynamics, pain_type, market_type, classification_confidence },
    b2: { search_volume: Math.round(demand_index * 1000), commercial_intent_ratio, rising_queries: arr(b2row?.key_factors).slice(0, 5), demand_strength, has_seasonality: has_hype_risk, geo_top_market: null },
    b3: { price_range_median, price_range_min: prices.length > 0 ? Math.min(...prices) : null, price_range_max: prices.length > 0 ? Math.max(...prices) : null, price_model: mapPriceModel(archetype), sale_cycle_days: clamp(mapSaleCycleDays(archetype, requires_sales_contact, entry_price), 0.5, 730), friction_score, has_free_tier: bool(b3ctx['has_freemium']) || bool(b3ctx['has_free_trial']), monetization_quality, monetization_confidence: clamp(n(b3ctx['monetization_confidence'], 0.5), 0, 1) },
    b4: { gap_type, gap_map, competition_intensity: deriveCompetitionIntensity(competitor_count, gap_type), acquisition_type: mapAcquisitionType(archetype), avg_switching_cost: mapSwitchingCost(requires_sales_contact, entry_price, archetype), substitute_strength: deriveCompetitionIntensity(competitor_count, gap_type) === 'SATURATED' || deriveCompetitionIntensity(competitor_count, gap_type) === 'HIGH' ? 'HIGH' : deriveCompetitionIntensity(competitor_count, gap_type) === 'MEDIUM' ? 'MEDIUM' : 'LOW', top_complaints: arr(b4row?.key_factors), competitor_count, top_competitor_g2_reviews: typeof b4ctx['top_competitor_g2_reviews'] === 'number' ? Math.round(b4ctx['top_competitor_g2_reviews'] as number) : null, entry_point: (b4ctx['entry_point'] as string | null) ?? null, blue_ocean_score: gap_type === 'strategic' ? 75 : gap_type === 'execution' ? 50 : 25 },
    b5: { revenue_mid: n(b5ctx['revenue_mid']) > 0 ? n(b5ctx['revenue_mid']) : null, revenue_low: n(b5ctx['revenue_low']) >= 0 ? n(b5ctx['revenue_low']) : null, revenue_high: n(b5ctx['revenue_high']) > 0 ? n(b5ctx['revenue_high']) : null, cac_mid: cac_mid ?? null, cac_scenarios, months_to_first_revenue: clamp(n(b5ctx['months_to_first_revenue'], 6), 0, 36), experiment_budget: n(b5ctx['experiment_budget'], 0), payback_months: typeof b5ctx['payback_months'] === 'number' && (b5ctx['payback_months'] as number) > 0 ? b5ctx['payback_months'] : null, revenue_confidence, revenue_quality, cac_spread_flag: bool(b5ctx['cac_spread_flag']), leaky_bucket_flag: bool(b5ctx['leaky_bucket_flag']), high_entry_barrier_flag: bool(b5ctx['high_entry_barrier_flag']), long_payback_flag: bool(b5ctx['long_payback_flag']), main_economic_risk: str(b5ctx['main_economic_risk'], 'Недостаточно данных для оценки риска'), monthly_burn_estimate: n(b5ctx['monthly_burn_estimate']) > 0 ? n(b5ctx['monthly_burn_estimate']) : null },
    b6: { blind_spots_count: n(b6ctx['blind_spots_count'], 0), blind_spots_impact, blind_spots_types: arr(b6ctx['blind_spots_types']), first_spot_teaser: (b6ctx['first_spot_teaser'] as string | null) ?? null, has_revenue_multiplier: bool(b6ctx['has_revenue_multiplier']), unknown_mode: bool(b6ctx['unknown_mode']), conflict_weight: clamp(n(b6ctx['conflict_weight'], 1), 1, 3), data_quality_confidence },
    b7: { verdict, confidence, priority_actions, bridge_text, asymmetric_advantage, strategy_mode_recommendation },
  }

  return { data: assembled, niche }
}

export async function assembleResearchOutput(
  trend_id: string, user_id: string, supabase: ReturnType<typeof createClient>
): Promise<{ data: unknown; niche: string } | null> {
  return buildResearchOutput(trend_id, user_id, supabase)
}
