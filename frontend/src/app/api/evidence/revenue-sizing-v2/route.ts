// app/api/evidence/revenue-sizing-v2/route.ts
// Block 5 v2 — Economics (Revenue Range + Unit Economics)
// Reads data from Blocks 1, 2, 3, 4
//
// WAVE ORDER:
// Wave 1: Block 1 (Problem) + Block 2 (Demand) — parallel
// Wave 2: Block 4 (Competition) — waits for Wave 1
// Wave 3: Block 3 (Sellability) — waits for Block 4
// Wave 4: Block 5 (Economics) — waits for Blocks 2+3+4 ← THIS FILE
// Wave 5: Block 6 (Blind Spots) — waits for all 1-5
// Wave 6: Block 7 (AI Synthesis) — manual trigger

import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { getServerSupabase } from '@/lib/supabase';
import { runBlock5Pipeline, type Block5Input } from '@/lib/economics/Block5_Economics_FINAL';

// ─── Map block_context fields to Block5Input ───────────────

function mapBlock5Input(
  bc1: any,
  bc2: any,
  bc3: any,
  bc4: any,
): Block5Input {
  // Block 1: paying_ratio (normalize >1 → /100)
  const rawPaying = bc1?.paying_users_ratio ?? 0;
  const paying_ratio = rawPaying > 1 ? rawPaying / 100 : rawPaying;

  // Block 2: commercial intent, demand strength, search volume proxy
  const commercial_intent_ratio = bc2?.commercial_intent_ratio ?? 0;
  const demandScore = bc2?.demand_confidence_score ?? 0.5;
  const demand_strength = demandScore >= 0.7 ? 'STRONG' as const
    : demandScore >= 0.4 ? 'MEDIUM' as const
    : demandScore >= 0.2 ? 'LOW' as const
    : 'DECLINING' as const;
  const search_volume = bc2?.serp_ad_density ?? 0; // proxy

  // Block 3: monetization data
  const priceTier = bc3?.price_tier ?? 'budget';
  const priceMedianMap: Record<string, number> = {
    budget: 29, mid: 99, premium: 299, enterprise: 999,
  };
  const price_range_median = bc3?.entry_price_usd ?? priceMedianMap[priceTier] ?? 49;
  const friction_score = bc3?.friction_score ?? 'MEDIUM';
  const price_model = bc3?.billing_model ?? 'subscription';
  const monetization_quality = bc3?.monetization_quality ?? 'STABLE';
  const has_free_tier_competitors = bc3?.has_free_trial ?? bc3?.has_freemium ?? false;

  // Block 4: competition data
  const gapType = bc4?.gap_type ?? 'unknown';
  const entry_verdict = gapType === 'none' ? 'HARD' as const
    : gapType === 'execution' ? 'EXPERIMENT' as const
    : gapType === 'strategic' ? 'GO' as const
    : 'EXPERIMENT' as const;

  const competition_intensity = bc4?.competition_intensity ?? 'MEDIUM';
  const avg_switching_cost = bc4?.avg_switching_cost ?? 'MEDIUM';
  const top_competitor_g2_reviews = bc4?.top_competitor_g2_reviews ?? null;
  const top_competitor_size = bc4?.top_competitor_size ?? undefined;
  const substitute_strength = bc4?.substitute_strength ?? 'MEDIUM';

  // Gap map from Block 4
  const gap_map = (bc4?.gap_map || []).map((g: any) => ({
    pain: g.pain || '',
    status: g.status || 'unknown',
    paying_ratio: g.paying_ratio ?? 0,
  }));

  // Acquisition type inference
  const requiresSales = bc3?.requires_sales_contact ?? false;
  const hasFreemium = bc3?.has_freemium ?? false;
  const acquisition_type = requiresSales ? 'SALES_LED' as const
    : hasFreemium ? 'PLG' as const
    : 'SEO_LED' as const;

  // Market type from Block 4 or inferred
  const market_type = bc4?.market_type ?? undefined;

  // Sale cycle days estimation
  const sale_cycle_days = friction_score === 'HIGH' ? 30
    : friction_score === 'MEDIUM' ? 14
    : 7;

  // Open pain ratio from Block 4
  const open_pain_ratio = bc4?.open_pain_ratio ?? 0.3;

  return {
    paying_ratio,
    commercial_intent_ratio,
    search_volume,
    demand_strength,
    price_range_median,
    sale_cycle_days,
    monetization_quality,
    price_model,
    friction_score,
    market_type,
    entry_verdict,
    gap_map,
    competition_intensity,
    avg_switching_cost,
    open_pain_ratio,
    acquisition_type,
    substitute_strength,
    top_competitor_g2_reviews,
    top_competitor_size,
    has_free_tier_competitors,
  };
}

function diagnosisToColor(d: string): 'green' | 'yellow' | 'red' {
  if (d === 'GREEN') return 'green';
  if (d === 'YELLOW') return 'yellow';
  return 'red';
}

function diagnosisToScore(d: string): number {
  if (d === 'GREEN') return 8;
  if (d === 'YELLOW') return 5;
  return 2;
}

// ─── MAIN ROUTE ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getServerSupabase();
    const { trend_id, niche } = await req.json();
    if (!trend_id || !niche) return NextResponse.json({ error: 'trend_id и niche обязательны' }, { status: 400 });

    console.log(`[Block5v2] Starting for "${niche}"...`);

    // Load upstream data (Blocks 1, 2, 3, 4)
    const [b1Res, b2Res, b3Res, b4Res] = await Promise.all([
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 1).single(),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 2).single(),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 3).single(),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 4).maybeSingle(),
    ]);

    const bc1 = b1Res.data?.block_context;
    const bc2 = b2Res.data?.block_context;
    const bc3 = b3Res.data?.block_context;
    const bc4 = b4Res.data?.block_context ?? null;

    console.log(`[Block5v2] Loaded blocks: B1=${!!bc1}, B2=${!!bc2}, B3=${!!bc3}, B4=${!!bc4}`);

    // Map to Block5Input and run pipeline
    const input = mapBlock5Input(bc1, bc2, bc3, bc4);
    const result = runBlock5Pipeline(input);

    console.log(`[Block5v2] Result: ${result.diagnosis} / confidence=${result.economics_confidence} / revenue_mid=${result.revenue_mid}`);

    // Save to block_results
    const { error: saveError } = await supabase.from('block_results').upsert({
      trend_id,
      user_id: user.id,
      block_number: 5,
      block_type: 'economics_v2',
      diagnosis: diagnosisToColor(result.diagnosis),
      score: diagnosisToScore(result.diagnosis),
      conflict_weight: result.diagnosis === 'RED' ? 3
        : result.diagnosis === 'YELLOW' ? 2 : 1,
      key_factors: [
        `Revenue: $${result.revenue_mid ? Math.round(result.revenue_mid).toLocaleString() : 'N/A'}/год`,
        `Качество: ${result.revenue_quality}`,
        `CAC mid: $${result.cac_scenarios.recommended ? Math.round(result.cac_scenarios[result.cac_scenarios.recommended === 'PLG' ? 'plg' : result.cac_scenarios.recommended === 'SEO_LED' ? 'seo_led' : result.cac_scenarios.recommended === 'COMMUNITY_LED' ? 'community_led' : 'sales_led']?.mid ?? 0) : 'N/A'}`,
        `Confidence: ${result.economics_confidence}`,
      ],
      key_metric: result.main_economic_risk,
      block_context: {
        revenue_low: result.revenue_low,
        revenue_mid: result.revenue_mid,
        revenue_high: result.revenue_high,
        monthly_revenue_low: result.monthly_revenue_low,
        monthly_revenue_mid: result.monthly_revenue_mid,
        monthly_revenue_high: result.monthly_revenue_high,
        revenue_confidence: result.revenue_confidence,
        revenue_quality: result.revenue_quality,
        churn_level: result.churn_level,
        cac_scenarios: result.cac_scenarios,
        cac_spread_flag: result.cac_spread_flag,
        months_to_first_revenue: result.months_to_first_revenue,
        experiment_budget: result.experiment_budget,
        min_valid_clients: result.min_valid_clients,
        monthly_burn_estimate: result.monthly_burn_estimate,
        payback_months: result.payback_months,
        payback_status: result.payback_status,
        break_even_clients: result.break_even_clients,
        break_even_warning: result.break_even_warning,
        cumulative_timeline: result.cumulative_timeline,
        high_entry_barrier_flag: result.high_entry_barrier_flag,
        leaky_bucket_flag: result.leaky_bucket_flag,
        long_payback_flag: result.long_payback_flag,
        no_market_validation: result.no_market_validation,
        freemium_flag: result.freemium_flag,
        data_conflict_flag: result.data_conflict_flag,
        revenue_method_agreement: result.revenue_method_agreement,
        data_quality_score: result.data_quality_score,
        main_economic_risk: result.main_economic_risk,
      },
      raw_data: result,
      intelligence_output: null,
      intelligence_updated_at: null,
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (saveError) console.error('[Block5v2] Supabase error:', saveError.message);

    // Map to format expected by EconomicsBlock.tsx
    const publicData = {
      diagnosis: diagnosisToColor(result.diagnosis),
      score: diagnosisToScore(result.diagnosis),
      key_metric: result.main_economic_risk,
      key_factors: [
        `Revenue: $${result.revenue_mid ? Math.round(result.revenue_mid).toLocaleString() : 'N/A'}/год`,
        `Качество: ${result.revenue_quality}`,
        `Confidence: ${result.economics_confidence}`,
        `Payback: ${result.payback_months ?? 'N/A'} мес`,
      ],
      confidence: result.economics_confidence.toLowerCase() as 'high' | 'medium' | 'low',
      data_quality_score: result.data_quality_score,
      revenue_range: {
        low: result.revenue_low,
        mid: result.revenue_mid,
        high: result.revenue_high,
      },
      monthly_revenue: {
        low: result.monthly_revenue_low,
        mid: result.monthly_revenue_mid,
        high: result.monthly_revenue_high,
      },
      months_to_first_revenue: result.months_to_first_revenue,
      cac_estimate: (() => {
        // Show the recommended CAC, but if it's extreme (>$1000), also provide the cheapest alternative
        const recKey = result.cac_scenarios.recommended === 'PLG' ? 'plg'
          : result.cac_scenarios.recommended === 'SEO_LED' ? 'seo_led'
          : result.cac_scenarios.recommended === 'COMMUNITY_LED' ? 'community_led'
          : 'sales_led';
        return result.cac_scenarios[recKey]?.mid ?? null;
      })(),
      cac_best: (() => {
        // Find cheapest available channel for UI display
        const channels = ['plg', 'community_led', 'seo_led', 'sales_led'] as const;
        let best: { mid: number; channel: string } | null = null;
        for (const ch of channels) {
          const s = result.cac_scenarios[ch];
          if (s && (!best || s.mid < best.mid)) best = { mid: s.mid, channel: ch };
        }
        return best;
      })(),
      cac_source: result.cac_scenarios.recommended || 'UNKNOWN',
      revenue_viability: result.diagnosis === 'GREEN' ? 'viable' as const
        : result.diagnosis === 'YELLOW' ? 'marginal' as const
        : 'not_viable' as const,
      methods: {
        method_1: result.method_a_result != null ? {
          competitor_customers: result.method_a_result,
          competitor_revenue_annual: result.method_a_result,
          market_share_percent: 2,
          reasoning: result.method_a_note || 'Method A: по конкурентам',
          data_source: 'g2_reviews',
        } : null,
        method_2: result.method_b_result != null ? {
          commercial_intent_ratio: input.commercial_intent_ratio,
          has_declining_signal: input.demand_strength === 'DECLINING',
          confidence_modifier: 'neutral' as const,
          reasoning: 'Method B: по поисковому спросу',
        } : null,
        method_3: result.months_to_first_revenue > 0 ? {
          sale_cycle_days: input.sale_cycle_days,
          months_to_first_revenue: result.months_to_first_revenue,
          reasoning: `Цикл продажи ${input.sale_cycle_days}д → ${result.months_to_first_revenue} мес до выручки`,
        } : null,
      },
      // Pass through block_context for downstream
      block_context: {
        revenue_quality: result.revenue_quality,
        high_entry_barrier_flag: result.high_entry_barrier_flag,
        leaky_bucket_flag: result.leaky_bucket_flag,
        cac_spread_flag: result.cac_spread_flag,
        long_payback_flag: result.long_payback_flag,
        no_market_validation: result.no_market_validation,
        revenue_method_agreement: result.revenue_method_agreement,
      },
    };

    return NextResponse.json({ success: true, public: publicData });
  } catch (error: any) {
    console.error('[Block5v2] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
