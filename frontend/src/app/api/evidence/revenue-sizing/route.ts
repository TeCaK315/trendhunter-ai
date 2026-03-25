// src/app/api/evidence/revenue-sizing/route.ts
// Блок 5 — Размер выручки
// Главный вопрос: "Сколько денег возможно сделать?"
//
// DATA PRINCIPLE:
// - Метод 1 (Competitor-based): g2_reviews → fallback top_competitor_size
// - Метод 2 (Demand-based): только confidence modifier, не число
// - Метод 3 (Deal Cycle): months_to_first_revenue = sale_cycle_days / 30
// - CAC из serp_ad_density, не из 15% хардкода
// - Нет GPT-генерации цифел. Все допущения явно помечены.
//
// ПРАВКИ:
// #1 Fallback для Метода 1 через top_competitor_size когда нет g2_reviews
// #2 months_to_first_revenue из sale_cycle_days вместо break_even_customers = 10
// #3 CAC из serp_ad_density вместо 15% хардкода
//
// CALIBRATE_AFTER_50_ANALYSES:
// - GREEN порог revenue_mid > $100K (может быть $50K или $150K)
// - Коэффициенты micro/small/medium/large для fallback

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-helpers";
import { getServerSupabase } from "@/lib/supabase";

const BLOCK_COST = { public: 0, premium: 8 } as const;

type Confidence = "high" | "medium" | "low";
type GapType = "strategic" | "execution" | "none";
type CompetitorSizeEstimate = "micro" | "small" | "medium" | "large";

interface Method1Result {
  name: "competitor_based";
  competitor_domain: string;
  data_source: "g2_reviews" | "competitor_size_fallback";
  competitor_customers: number;
  competitor_revenue_annual: number;
  market_share_percent: number;
  revenue_estimate: number;
  confidence: Confidence;
  reasoning: string;
}

interface Method2Result {
  name: "demand_signal";
  commercial_intent_ratio: number;
  has_declining_signal: boolean;
  confidence_modifier: "boost" | "neutral" | "reduce";
  reasoning: string;
}

interface Method3Result {
  name: "deal_cycle";
  sale_cycle_days: number;
  months_to_first_revenue: number;
  confidence: Confidence;
  reasoning: string;
}

interface RevenueRangeEstimate {
  revenue_low: number | null;
  revenue_mid: number | null;
  revenue_high: number | null;
  confidence: Confidence;
  confidence_detail: {
    method_1_base: Confidence;
    method_2_modifier: "boost" | "neutral" | "reduce";
    method_3_signal: Confidence;
  };
  methods_applied: string[];
  data_quality_score: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}

interface RevenueDataQuality {
  upstream_block2_confidence: Confidence | "unknown";
  upstream_block3_confidence: Confidence | "unknown";
  upstream_block4_confidence: Confidence | "unknown";
  methods_with_data: number;       // сколько методов имели входные данные
  revenue_cross_validated: boolean; // method1 + method2 не противоречат
  overall_confidence: Confidence;
}

interface RevenueBlockContext {
  revenue_low: number | null;
  revenue_mid: number | null;
  revenue_high: number | null;
  monthly_revenue_low: number | null;
  monthly_revenue_mid: number | null;
  monthly_revenue_high: number | null;
  confidence: Confidence;
  months_to_first_revenue: number | null;
  cac_estimate: number | null;
  cac_source: "serp_ad_density" | "unknown";
  gross_margin_assumption: "standard_saas_70pct";
  revenue_viability: "viable" | "marginal" | "not_viable";
  data_quality_score: number;
  data_quality: RevenueDataQuality; // Multi-Pass
}

interface RevenueBlockOutput {
  diagnosis: "green" | "yellow" | "red";
  score: number;
  conflict_weight: number;
  key_factors: string[];
  key_metric: string;
  block_context: RevenueBlockContext;
  layers: {
    method_1: Method1Result | null;
    method_2: Method2Result | null;
    method_3: Method3Result | null;
    revenue_range: RevenueRangeEstimate;
  };
}

// CALIBRATE_AFTER_50_ANALYSES: коэффициенты размера требуют калибровки
function sizeEstimateToCustomerCount(
  sizeEstimate: CompetitorSizeEstimate,
): number {
  switch (sizeEstimate) {
    case "micro":
      return 50;
    case "small":
      return 500;
    case "medium":
      return 3000;
    case "large":
      return 15000;
    default:
      return 100;
  }
}

function calculateMethod1(
  topCompetitorG2Reviews: number | null,
  topCompetitorSize: CompetitorSizeEstimate | null,
  pricingMedian: number | null,
  gapType: GapType,
): Method1Result | null {
  if (!pricingMedian) return null;

  let competitorCustomers = 0;
  let dataSource: "g2_reviews" | "competitor_size_fallback";

  if (topCompetitorG2Reviews && topCompetitorG2Reviews > 0) {
    competitorCustomers = topCompetitorG2Reviews * 300;
    dataSource = "g2_reviews";
  } else if (topCompetitorSize) {
    competitorCustomers = sizeEstimateToCustomerCount(topCompetitorSize);
    dataSource = "competitor_size_fallback";
  } else {
    return null;
  }

  const competitorRevenueAnnual = competitorCustomers * pricingMedian * 12;
  const marketShare =
    gapType === "strategic" ? 0.15 : gapType === "execution" ? 0.05 : 0.02;
  const revenueEstimate = competitorRevenueAnnual * marketShare;

  const confidence: Confidence =
    dataSource === "g2_reviews"
      ? topCompetitorG2Reviews! >= 100
        ? "high"
        : topCompetitorG2Reviews! >= 20
          ? "medium"
          : "low"
      : "medium";

  return {
    name: "competitor_based",
    competitor_domain: "via_market_proxy",
    data_source: dataSource,
    competitor_customers: competitorCustomers,
    competitor_revenue_annual: competitorRevenueAnnual,
    market_share_percent: marketShare * 100,
    revenue_estimate: revenueEstimate,
    confidence,
    reasoning:
      dataSource === "g2_reviews"
        ? `G2: ${topCompetitorG2Reviews} reviews = ~${competitorCustomers.toLocaleString()} customers. Annual: ${competitorRevenueAnnual.toLocaleString("en-US", { style: "currency", currency: "USD" })}. Your ${marketShare * 100}%: ${revenueEstimate.toLocaleString("en-US", { style: "currency", currency: "USD" })}. Confidence: ${confidence.toUpperCase()}.`
        : `Size fallback (${topCompetitorSize}): ~${competitorCustomers.toLocaleString()} customers. Annual: ${competitorRevenueAnnual.toLocaleString("en-US", { style: "currency", currency: "USD" })}. Your ${marketShare * 100}%: ${revenueEstimate.toLocaleString("en-US", { style: "currency", currency: "USD" })}. Confidence: MEDIUM (size-based estimate).`,
  };
}

function calculateMethod2(
  commercialIntentRatio: number | null,
  hasDeclinedSignal: boolean,
): Method2Result | null {
  if (commercialIntentRatio === null) return null;

  let modifier: "boost" | "neutral" | "reduce" = "neutral";
  let reasoning = "";

  if (hasDeclinedSignal) {
    modifier = "reduce";
    reasoning =
      "Спрос ПАДАЕТ (has_declining_signal). Confidence методов СНИЖАЕТСЯ.";
  } else if (commercialIntentRatio > 0.7) {
    modifier = "boost";
    reasoning = `Высокий коммерческий intent (${(commercialIntentRatio * 100).toFixed(0)}%). Confidence методов ПОВЫШАЕТСЯ.`;
  } else if (commercialIntentRatio > 0.4) {
    modifier = "neutral";
    reasoning = `Средний коммерческий intent (${(commercialIntentRatio * 100).toFixed(0)}%). Confidence без изменений.`;
  } else {
    modifier = "reduce";
    reasoning = `Низкий коммерческий intent (${(commercialIntentRatio * 100).toFixed(0)}%). Confidence методов СНИЖАЕТСЯ.`;
  }

  return {
    name: "demand_signal",
    commercial_intent_ratio: commercialIntentRatio,
    has_declining_signal: hasDeclinedSignal,
    confidence_modifier: modifier,
    reasoning,
  };
}

function calculateMethod3(
  saleCycleDays: number,
  budgetCategoryExists: boolean,
): Method3Result {
  // Честный сигнал: когда ожидать первую выручку
  const monthsToFirstRevenue = saleCycleDays / 30;
  const confidence: Confidence = budgetCategoryExists ? "medium" : "low";

  return {
    name: "deal_cycle",
    sale_cycle_days: saleCycleDays,
    months_to_first_revenue: monthsToFirstRevenue,
    confidence,
    reasoning: `Sale cycle: ${saleCycleDays} дней → Первая выручка через ~${monthsToFirstRevenue.toFixed(1)} мес. Budget exists: ${budgetCategoryExists}. Confidence: ${confidence.toUpperCase()}.`,
  };
}

function applyConfidenceModifiers(
  method1Confidence: Confidence,
  method2Modifier: "boost" | "neutral" | "reduce" | null,
  method3Confidence: Confidence,
): Confidence {
  let final = method1Confidence;

  if (method2Modifier === "boost") final = final === "low" ? "medium" : "high";
  else if (method2Modifier === "reduce")
    final = final === "high" ? "medium" : "low";

  if (method3Confidence === "low" && final === "high") final = "medium";

  return final;
}

// CAC из serp_ad_density — не из 15% хардкода
function estimateCAC(
  serpAdDensity: number | null,
  pricingMedian: number | null,
): { cac: number | null; source: "serp_ad_density" | "unknown" } {
  if (!pricingMedian || serpAdDensity === null)
    return { cac: null, source: "unknown" };

  const pct = serpAdDensity > 0.3 ? 0.5 : serpAdDensity > 0.1 ? 0.2 : 0.05;

  return { cac: Math.round(pricingMedian * pct), source: "serp_ad_density" };
}

function calculateRevenueRange(
  method1: Method1Result | null,
  method2: Method2Result | null,
  method3: Method3Result | null,
): RevenueRangeEstimate {
  const methodsApplied: string[] = [];
  let dataQualityScore = 0;

  if (!method1) {
    return {
      revenue_low: null,
      revenue_mid: null,
      revenue_high: null,
      confidence: "low",
      confidence_detail: {
        method_1_base: "low",
        method_2_modifier: "neutral",
        method_3_signal: "low",
      },
      methods_applied: [],
      data_quality_score: 1,
    };
  }

  methodsApplied.push("method_1_competitor_based");
  dataQualityScore += 3;

  const base = method1.revenue_estimate;
  let finalConfidence = method1.confidence;
  let method2Modifier: "boost" | "neutral" | "reduce" = "neutral";

  if (method2) {
    methodsApplied.push("method_2_demand_signal");
    dataQualityScore += 2;
    method2Modifier = method2.confidence_modifier;
    finalConfidence = applyConfidenceModifiers(
      finalConfidence,
      method2Modifier,
      method3?.confidence || "low",
    );
  }

  if (method3) {
    methodsApplied.push("method_3_deal_cycle");
    dataQualityScore += 2;
    if (method3.months_to_first_revenue > 12 && finalConfidence === "low")
      finalConfidence = "low";
  }

  return {
    revenue_low: Math.round(base * 0.7),
    revenue_mid: Math.round(base),
    revenue_high: Math.round(base * 1.3),
    confidence: finalConfidence,
    confidence_detail: {
      method_1_base: method1.confidence,
      method_2_modifier: method2Modifier,
      method_3_signal: method3?.confidence || "low",
    },
    methods_applied: methodsApplied,
    data_quality_score: Math.min(
      10,
      dataQualityScore,
    ) as RevenueRangeEstimate["data_quality_score"],
  };
}

function makeRevenueDiagnosis(
  revenueRange: RevenueRangeEstimate,
  monthsToFirstRevenue: number | null,
  hasDeclinedSignal: boolean,
): {
  diagnosis: "green" | "yellow" | "red";
  score: number;
  conflict_weight: number;
  reason: string;
  viability: "viable" | "marginal" | "not_viable";
} {
  // CALIBRATE_AFTER_50_ANALYSES: порог $100K подобран теоретически
  if (
    revenueRange.revenue_mid &&
    revenueRange.revenue_mid > 100000 &&
    revenueRange.confidence === "high" &&
    monthsToFirstRevenue !== null &&
    monthsToFirstRevenue < 12 &&
    !hasDeclinedSignal
  ) {
    return {
      diagnosis: "green",
      score: 8,
      conflict_weight: 1,
      reason: "strong_revenue_potential",
      viability: "viable",
    };
  }

  if (
    revenueRange.revenue_mid &&
    revenueRange.revenue_mid > 50000 &&
    (revenueRange.confidence === "medium" ||
      (monthsToFirstRevenue !== null && monthsToFirstRevenue < 24))
  ) {
    return {
      diagnosis: "yellow",
      score: 5,
      conflict_weight: 2,
      reason: "uncertain_revenue_potential",
      viability: "marginal",
    };
  }

  return {
    diagnosis: "red",
    score: 2,
    conflict_weight: 3,
    reason: "insufficient_revenue_signals",
    viability: "not_viable",
  };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const supabase = getServerSupabase();

    const { trend_id } = (await req.json()) as { trend_id: string };
    if (!trend_id)
      return NextResponse.json({ error: "trend_id required" }, { status: 400 });

    const [block2Result, block3Result, block4Result] = await Promise.all([
      supabase
        .from("block_results")
        .select("*")
        .eq("trend_id", trend_id)
        .eq("user_id", user.id)
        .eq("block_number", 2)
        .single(),
      supabase
        .from("block_results")
        .select("*")
        .eq("trend_id", trend_id)
        .eq("user_id", user.id)
        .eq("block_number", 3)
        .single(),
      supabase
        .from("block_results")
        .select("*")
        .eq("trend_id", trend_id)
        .eq("user_id", user.id)
        .eq("block_number", 4)
        .single(),
    ]);

    if (block2Result.error || !block2Result.data)
      return NextResponse.json({ error: "Block 2 not found" }, { status: 422 });
    if (block3Result.error || !block3Result.data)
      return NextResponse.json({ error: "Block 3 not found" }, { status: 422 });
    if (block4Result.error || !block4Result.data)
      return NextResponse.json({ error: "Block 4 not found" }, { status: 422 });

    const b2 = block2Result.data.block_context;
    const b3 = block3Result.data.block_context;
    const b4 = block4Result.data.block_context;

    const method1 = calculateMethod1(
      b4.top_competitor_g2_reviews,
      b4.top_competitor_size,
      b3.price_range?.median,
      b4.gap_type,
    );
    const method2 = calculateMethod2(
      b2.commercial_intent_ratio,
      b2.has_declining_signal,
    );
    const method3 = calculateMethod3(b3.sale_cycle_days, b3.budget_exists);

    const { cac, source: cacSource } = estimateCAC(
      b2.serp_ad_density,
      b3.price_range?.median,
    );

    const revenueRange = calculateRevenueRange(method1, method2, method3);

    const diagnosisResult = makeRevenueDiagnosis(
      revenueRange,
      method3?.months_to_first_revenue ?? null,
      b2.has_declining_signal,
    );

    // Multi-Pass 3: upstream data quality
    const upstreamB2Confidence: Confidence | "unknown" = b2?.data_quality?.classification_confidence || "unknown";
    const upstreamB3Confidence: Confidence | "unknown" = b3?.data_quality?.overall_data_confidence || "unknown";
    const upstreamB4Confidence: Confidence | "unknown" = b4?.data_quality?.overall_confidence || "unknown";

    const methodsWithData = [method1, method2, method3].filter(Boolean).length;

    // Кросс-валидация: method1 (competitor revenue) и method2 (demand signal) не противоречат
    const revenueCrossValidated = !!(
      method1 && method2 &&
      !(method1.revenue_estimate > 100000 && method2.confidence_modifier === "reduce") // высокая выручка но падающий спрос = противоречие
    );

    const revenueOverallConfidence: Confidence =
      methodsWithData >= 3 && revenueCrossValidated ? "high"
      : methodsWithData >= 2 ? "medium"
      : "low";

    const revenueDataQuality: RevenueDataQuality = {
      upstream_block2_confidence: upstreamB2Confidence,
      upstream_block3_confidence: upstreamB3Confidence,
      upstream_block4_confidence: upstreamB4Confidence,
      methods_with_data: methodsWithData,
      revenue_cross_validated: revenueCrossValidated,
      overall_confidence: revenueOverallConfidence,
    };

    const block_context: RevenueBlockContext = {
      revenue_low: revenueRange.revenue_low,
      revenue_mid: revenueRange.revenue_mid,
      revenue_high: revenueRange.revenue_high,
      monthly_revenue_low: revenueRange.revenue_low
        ? Math.round(revenueRange.revenue_low / 12)
        : null,
      monthly_revenue_mid: revenueRange.revenue_mid
        ? Math.round(revenueRange.revenue_mid / 12)
        : null,
      monthly_revenue_high: revenueRange.revenue_high
        ? Math.round(revenueRange.revenue_high / 12)
        : null,
      confidence: revenueRange.confidence,
      months_to_first_revenue: method3?.months_to_first_revenue ?? null,
      cac_estimate: cac,
      cac_source: cacSource,
      gross_margin_assumption: "standard_saas_70pct",
      revenue_viability: diagnosisResult.viability,
      data_quality_score: revenueRange.data_quality_score,
      data_quality: revenueDataQuality,
    };

    const output: RevenueBlockOutput = {
      diagnosis: diagnosisResult.diagnosis,
      score: diagnosisResult.score,
      conflict_weight: diagnosisResult.conflict_weight,
      key_factors: [
        method1
          ? `Market leader: ${method1.competitor_revenue_annual.toLocaleString("en-US", { style: "currency", currency: "USD" })}/yr (${method1.data_source})`
          : "No competitor data",
        `Your potential (${method1?.market_share_percent || 0}% share): ${revenueRange.revenue_mid?.toLocaleString("en-US", { style: "currency", currency: "USD" }) || "unknown"}/yr`,
        `First revenue in: ${method3?.months_to_first_revenue?.toFixed(1) || "unknown"} months`,
        `CAC estimate: ${cac?.toLocaleString("en-US", { style: "currency", currency: "USD" }) || "unknown"} (${cacSource})`,
      ],
      key_metric: revenueRange.revenue_mid
        ? `$${(revenueRange.revenue_mid / 1000).toFixed(0)}K/year potential (${revenueRange.confidence.toUpperCase()} confidence)`
        : "Insufficient data for revenue estimate",
      block_context,
      layers: {
        method_1: method1,
        method_2: method2,
        method_3: method3,
        revenue_range: revenueRange,
      },
    };

    const { error: dbError } = await supabase.from("block_results").upsert({
      trend_id,
      user_id: user.id,
      block_number: 5,
      block_type: "revenue_sizing",
      diagnosis: output.diagnosis,
      score: output.score,
      conflict_weight: output.conflict_weight,
      key_factors: output.key_factors,
      key_metric: output.key_metric,
      block_context: output.block_context,
      raw_data: {
        layers: output.layers,
        premium: {
          revenue_range: {
            low: revenueRange.revenue_low,
            mid: revenueRange.revenue_mid,
            high: revenueRange.revenue_high,
          },
          monthly_revenue: {
            low: block_context.monthly_revenue_low,
            mid: block_context.monthly_revenue_mid,
            high: block_context.monthly_revenue_high,
          },
          confidence_detail: revenueRange.confidence_detail,
          months_to_first_revenue: block_context.months_to_first_revenue,
          cac_estimate: block_context.cac_estimate,
          cac_source: block_context.cac_source,
          gross_margin_assumption: block_context.gross_margin_assumption,
          revenue_viability: block_context.revenue_viability,
          methods: {
            method_1: method1,
            method_2: method2,
            method_3: method3,
          },
          key_factors: output.key_factors,
          block_context: output.block_context,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);

    console.log("[Block5] Revenue sizing:", {
      diagnosis: output.diagnosis,
      revenue_mid: block_context.revenue_mid,
      confidence: revenueRange.confidence,
      methods_applied: revenueRange.methods_applied,
      data_source_method1: method1?.data_source,
      months_to_first_revenue: block_context.months_to_first_revenue,
      cac_estimate: block_context.cac_estimate,
      data_quality_score: revenueRange.data_quality_score,
    });

    return NextResponse.json({
      success: true,
      _cost: BLOCK_COST,
      public: {
        diagnosis: output.diagnosis,
        score: output.score,
        key_metric: output.key_metric,
        key_factors: output.key_factors,
        block_context: output.block_context,
        confidence: revenueRange.confidence,
        data_quality_score: revenueRange.data_quality_score,
        revenue_range: {
          low: revenueRange.revenue_low,
          mid: revenueRange.revenue_mid,
          high: revenueRange.revenue_high,
        },
        monthly_revenue: {
          low: block_context.monthly_revenue_low,
          mid: block_context.monthly_revenue_mid,
          high: block_context.monthly_revenue_high,
        },
        months_to_first_revenue: block_context.months_to_first_revenue,
        cac_estimate: block_context.cac_estimate,
        cac_source: block_context.cac_source,
        revenue_viability: block_context.revenue_viability,
        methods: {
          method_1: method1,
          method_2: method2,
          method_3: method3,
        },
      },
      has_premium: true,
    });
  } catch (error: any) {
    console.error("[Block 5 — Revenue Sizing]", error);
    return NextResponse.json(
      { error: error.message || "Internal error" },
      { status: 500 },
    );
  }
}
