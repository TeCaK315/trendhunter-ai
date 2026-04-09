// lib/monetization/archetypes.ts — Archetype logic for Block 3

import type {
  MonetizationArchetype, MonetizationQuality, BinarySignals,
  PricingPageParsed, ArchetypeCandidate, ContextObject, Block1Input,
} from './schemas';

export const VALID_ARCHETYPES = new Set<MonetizationArchetype>([
  "SELF_SERVICE_SUBSCRIPTION", "USAGE_BASED", "MARKETPLACE", "SALES_LED",
  "ENTERPRISE_ONLY", "AGENCY_CONSULTING", "ONE_TIME_LICENSE",
  "ONE_TIME_PURCHASE", "FREEMIUM_LED", "UNKNOWN",
]);

export const ARCHETYPE_PRIORITY: Record<MonetizationArchetype, number> = {
  SELF_SERVICE_SUBSCRIPTION: 1, USAGE_BASED: 2, MARKETPLACE: 3,
  SALES_LED: 4, ENTERPRISE_ONLY: 5, ONE_TIME_LICENSE: 6,
  AGENCY_CONSULTING: 7, FREEMIUM_LED: 8, ONE_TIME_PURCHASE: 9, UNKNOWN: 100,
};

export function isRealFreemium(parsed: PricingPageParsed): boolean {
  return parsed.has_freemium && parsed.has_value_based_limits && parsed.has_upgrade_path;
}

export function isZeroDollarStarter(parsed: PricingPageParsed): boolean {
  return parsed.has_freemium && parsed.entry_price_usd === null && !parsed.has_upgrade_path;
}

export function detectArchetypeFromPage(parsed: PricingPageParsed): MonetizationArchetype {
  if (isZeroDollarStarter(parsed)) return "UNKNOWN";
  if (!parsed.has_public_prices && parsed.requires_sales && parsed.has_enterprise_plan)
    return "ENTERPRISE_ONLY";
  if (parsed.has_self_service_checkout && parsed.billing_period === "usage")
    return "USAGE_BASED";
  if (parsed.has_self_service_checkout &&
      (parsed.billing_period === "monthly" || parsed.billing_period === "yearly"))
    return "SELF_SERVICE_SUBSCRIPTION";
  if (parsed.requires_sales && !parsed.has_self_service_checkout)
    return "SALES_LED";
  if (isRealFreemium(parsed)) return "FREEMIUM_LED";
  if (parsed.has_freemium) return "FREEMIUM_LED";
  if (parsed.billing_period === "one_time") return "ONE_TIME_PURCHASE";
  return "UNKNOWN";
}

export function preClassify(
  signals: BinarySignals, ctx: ContextObject, _block1: Block1Input,
): ArchetypeCandidate[] {
  const candidates: ArchetypeCandidate[] = [];

  if (signals.hasCheckout && signals.hasPricingPage && signals.mentionsSubscription) {
    let s = 0.6;
    if (signals.hasPublicPrices) s += 0.2;
    if (!signals.hasContactSales) s += 0.1;
    candidates.push({ type: "SELF_SERVICE_SUBSCRIPTION", score: s,
      reasoning: "Checkout + pricing page + subscription signals" });
  }

  if (signals.hasContactSales) {
    let s = 0.5;
    if (signals.hasEnterpriseMention) s += 0.2;
    if (!signals.hasSelfService) s += 0.15;
    if (ctx.category_type === "B2B") s += 0.1;
    candidates.push({ type: "SALES_LED", score: s,
      reasoning: "Contact sales present, limited self-service" });
  }

  if (!signals.hasPublicPrices && signals.hasContactSales && signals.hasEnterpriseMention) {
    candidates.push({ type: "ENTERPRISE_ONLY", score: 0.7,
      reasoning: "No public prices + enterprise signals" });
  }

  if (signals.mentionsApiUsage || signals.hasValueBasedLimits) {
    let s = 0.5;
    if (signals.mentionsApiUsage) s += 0.2;
    candidates.push({ type: "USAGE_BASED", score: s,
      reasoning: "API usage or volume-based pricing" });
  }

  if (signals.hasFreemium) {
    let s = 0.4;
    if (signals.hasValueBasedLimits && signals.hasUpgradePath) s += 0.3;
    else s -= 0.1;
    candidates.push({ type: "FREEMIUM_LED", score: s,
      reasoning: signals.hasValueBasedLimits && signals.hasUpgradePath
        ? "Real freemium: limits + upgrade path"
        : "Freemium without clear upgrade (possible trap)" });
  }

  if (!signals.mentionsSubscription && signals.hasPublicPrices && !signals.hasContactSales) {
    candidates.push({ type: "ONE_TIME_PURCHASE", score: 0.4,
      reasoning: "Public prices, no subscription model" });
  }

  if (candidates.length === 0) {
    candidates.push({ type: "UNKNOWN", score: 0.1, reasoning: "Insufficient signals" });
  }

  return candidates.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    return (ARCHETYPE_PRIORITY[a.type] ?? 999) - (ARCHETYPE_PRIORITY[b.type] ?? 999);
  });
}

export function getBaseQuality(archetype: MonetizationArchetype, signals: BinarySignals): MonetizationQuality {
  switch (archetype) {
    case "SELF_SERVICE_SUBSCRIPTION": return "SCALABLE";
    case "USAGE_BASED": return "SCALABLE";
    case "MARKETPLACE": return "SCALABLE";
    case "FREEMIUM_LED":
      return signals.hasValueBasedLimits && signals.hasUpgradePath ? "SCALABLE" : "FRAGILE";
    case "SALES_LED": return "STABLE";
    case "ENTERPRISE_ONLY": return "STABLE";
    case "AGENCY_CONSULTING": return "STABLE";
    case "ONE_TIME_LICENSE": return "STABLE";
    case "ONE_TIME_PURCHASE": return "FRAGILE";
    default: return "FRAGILE";
  }
}

export function getScalabilityMultiplier(quality: MonetizationQuality): 0.3 | 1.0 | 3.0 {
  return quality === "FRAGILE" ? 0.3 : quality === "STABLE" ? 1.0 : 3.0;
}
