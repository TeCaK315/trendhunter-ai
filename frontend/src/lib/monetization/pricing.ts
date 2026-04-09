// lib/monetization/pricing.ts — Pricing data collection for Block 3

import type {
  PricingPageData, Block2Input, SerpApiClient, HaikuClient,
  MonetizationArchetype, PricingProfile, PriceTier, BillingModel,
  BinarySignals,
} from './schemas';
import { PricingPageSchema } from './schemas';
import { detectArchetypeFromPage } from './archetypes';

function buildEmptyPricingData(
  competitor: Block2Input["competitors_found"][0]
): PricingPageData {
  return {
    competitorName: competitor.name, domain: competitor.domain,
    hasPricingPage: false, hasFreemium: false, hasTrial: false,
    trialDays: null, requiresSales: false, hasSelfServiceCheckout: false,
    hasPublicPrices: false, hasEnterpriseplan: false, hasValueBasedLimits: false,
    hasUpgradePath: false, entryPriceUsd: null, billingPeriod: null,
    detectedArchetype: "UNKNOWN", rawText: "",
  };
}

function getPricingQueries(domain: string, categoryType: string): string[] {
  if (categoryType === "B2B") {
    return [
      `site:${domain} pricing`,
      `site:${domain} "contact sales"`,
      `site:${domain} enterprise`,
      `site:${domain} "request demo"`,
    ];
  }
  return [
    `site:${domain} pricing`,
    `site:${domain} subscribe`,
    `site:${domain} plans`,
    `site:${domain} billing`,
  ];
}

export async function collectPricingData(
  competitors: Block2Input["competitors_found"],
  serpApi: SerpApiClient,
  haiku: HaikuClient,
  categoryType: "B2B" | "B2C" | "Hybrid"
): Promise<PricingPageData[]> {
  const results: PricingPageData[] = [];

  for (const competitor of competitors) {
    try {
      const queries = getPricingQueries(competitor.domain, categoryType);
      let topResult: { title: string; link: string; snippet: string } | undefined;

      for (const query of queries) {
        const search = await serpApi.search(query);
        if ((search.organic_results?.length ?? 0) > 0) {
          topResult = search.organic_results![0];
          break;
        }
      }

      if (!topResult) { results.push(buildEmptyPricingData(competitor)); continue; }

      const rawResponse = await haiku.complete(`
        Analyze this pricing page content and return ONLY valid JSON (no markdown):
        {
          "has_freemium": boolean,
          "has_trial": boolean,
          "trial_days": number | null,
          "requires_sales": boolean,
          "has_self_service_checkout": boolean,
          "has_public_prices": boolean,
          "has_enterprise_plan": boolean,
          "has_value_based_limits": boolean,
          "has_upgrade_path": boolean,
          "entry_price_usd": number | null,
          "billing_period": "monthly" | "yearly" | "one_time" | "usage" | null,
          "cta_primary": string
        }

        has_value_based_limits = true if page mentions: "up to N users",
        "N API calls", "N GB storage", "N seats" — any volume-based limits.

        has_upgrade_path = true if there is a visible button/link to upgrade
        from a free plan to a paid plan on the same page.

        Content: ${topResult.snippet || ""}
        URL: ${topResult.link || ""}
        Title: ${topResult.title || ""}
      `);

      let parsed;
      try {
        const clean = rawResponse.replace(/```json|```/g, "").trim();
        parsed = PricingPageSchema.parse(JSON.parse(clean));
      } catch (e) {
        console.warn(`[Block3] Haiku parse error for ${competitor.name}:`, e);
        parsed = PricingPageSchema.parse({});
      }

      const detected = detectArchetypeFromPage(parsed);

      results.push({
        competitorName: competitor.name, domain: competitor.domain,
        hasPricingPage: true, hasFreemium: parsed.has_freemium,
        hasTrial: parsed.has_trial, trialDays: parsed.trial_days,
        requiresSales: parsed.requires_sales,
        hasSelfServiceCheckout: parsed.has_self_service_checkout,
        hasPublicPrices: parsed.has_public_prices,
        hasEnterpriseplan: parsed.has_enterprise_plan,
        hasValueBasedLimits: parsed.has_value_based_limits,
        hasUpgradePath: parsed.has_upgrade_path,
        entryPriceUsd: parsed.entry_price_usd,
        billingPeriod: parsed.billing_period,
        detectedArchetype: detected, rawText: topResult.snippet || "",
      });
    } catch (e) {
      console.error(`[Block3] Error collecting pricing for ${competitor.name}:`, e);
      results.push(buildEmptyPricingData(competitor));
    }
  }

  return results;
}

export function extractBinarySignals(pricingData: PricingPageData[]): BinarySignals {
  return {
    hasPricingPage: pricingData.some(p => p.hasPricingPage),
    hasSelfService: pricingData.some(p => p.hasSelfServiceCheckout),
    hasContactSales: pricingData.some(p => p.requiresSales),
    hasFreemium: pricingData.some(p => p.hasFreemium),
    hasFreeTrial: pricingData.some(p => p.hasTrial),
    hasPublicPrices: pricingData.some(p => p.hasPublicPrices),
    hasEnterpriseMention: pricingData.some(p => p.hasEnterpriseplan),
    hasCheckout: pricingData.some(p => p.hasSelfServiceCheckout),
    mentionsSubscription: pricingData.some(p =>
      p.billingPeriod === "monthly" || p.billingPeriod === "yearly"),
    mentionsApiUsage: pricingData.some(p => p.billingPeriod === "usage"),
    hasValueBasedLimits: pricingData.some(p => p.hasValueBasedLimits),
    hasUpgradePath: pricingData.some(p => p.hasUpgradePath),
    pricingPagesCount: pricingData.filter(p => p.hasPricingPage).length,
  };
}

export function extractPricingProfile(
  pricingData: PricingPageData[], archetype: MonetizationArchetype,
): PricingProfile {
  const prices = pricingData
    .map(p => p.entryPriceUsd)
    .filter((p): p is number => p !== null && p > 0);

  const entryPrice = prices.length > 0 ? Math.min(...prices) : null;

  const tier: PriceTier =
    !entryPrice ? "enterprise" :
    entryPrice < 30 ? "budget" :
    entryPrice < 100 ? "mid_market" :
    entryPrice < 500 ? "premium" : "enterprise";

  const billingModel: BillingModel =
    archetype === "ONE_TIME_PURCHASE" || archetype === "ONE_TIME_LICENSE" ? "one_time" :
    archetype === "USAGE_BASED" ? "usage_based" :
    archetype === "MARKETPLACE" ? "hybrid" : "subscription";

  return { tier, entryPrice, billingModel };
}
