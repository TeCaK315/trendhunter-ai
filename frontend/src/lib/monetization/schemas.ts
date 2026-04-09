// lib/monetization/schemas.ts — Zod schemas + types for Block 3

import { z } from "zod";

// ─── TYPES ──────────────────────────────────────────────────

export type MonetizationVerdict = "CLEAR" | "PARTIAL" | "UNCLEAR" | "NONE";
export type UnclearReason = "UNPROVEN" | "NO_DATA" | "INSUFFICIENT_EVIDENCE";
export type LivenessLevel = "NONE" | "WEAK" | "PRESENT" | "STRONG";

export type MonetizationArchetype =
  | "SELF_SERVICE_SUBSCRIPTION"
  | "USAGE_BASED"
  | "MARKETPLACE"
  | "SALES_LED"
  | "ENTERPRISE_ONLY"
  | "AGENCY_CONSULTING"
  | "ONE_TIME_LICENSE"
  | "ONE_TIME_PURCHASE"
  | "FREEMIUM_LED"
  | "UNKNOWN";

export type MonetizationQuality = "FRAGILE" | "STABLE" | "SCALABLE";
export type FrictionScore = "LOW" | "MEDIUM" | "HIGH";
export type PriceTier = "budget" | "mid_market" | "premium" | "enterprise";
export type BillingModel = "subscription" | "one_time" | "usage_based" | "hybrid";

export interface RiskFactor {
  code: string;
  message: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
}

export interface CompetitorMonetization {
  name: string;
  archetype: MonetizationArchetype;
  price_usd: number | null;
  has_freemium: boolean;
  has_trial: boolean;
  requires_sales: boolean;
}

export interface Block3Output {
  monetization_verdict: MonetizationVerdict;
  unclear_reason?: UnclearReason;
  monetization_confidence: number;
  monetization_archetype: MonetizationArchetype;
  monetization_archetype_secondary: MonetizationArchetype | null;
  price_tier: PriceTier;
  entry_price_usd: number | null;
  billing_model: BillingModel;
  scalability_multiplier: 0.3 | 1.0 | 3.0;
  friction_score: FrictionScore;
  has_freemium: boolean;
  has_free_trial: boolean;
  requires_sales_contact: boolean;
  competitor_monetization: CompetitorMonetization[];
  monetization_risks: RiskFactor[];
  monetization_quality: MonetizationQuality;
  false_positive_market: boolean;
  liveness_signal_strength: number;
  monetization_diagnosis: string;
}

// ─── INPUT INTERFACES ───────────────────────────────────────

export interface ContextObject {
  category_type: "B2B" | "B2C" | "Hybrid";
  actors: {
    economic_buyer: string;
    end_user: string;
    buyer_fear: string;
  };
  buying_triggers: string[];
  maturity_level: "Emerging" | "Growing" | "Saturated" | "Declining";
  stop_words_contextual: string[];
}

export interface Block1Input {
  paying_ratio: number;
  pain_type: string;
  clusters: Array<{ theme: string; count: number }>;
  verdict: "RELIABLE" | "PARTIAL" | "UNRELIABLE";
}

export interface Block2Input {
  competitors_found: Array<{
    name: string;
    domain: string;
    type: "DIRECT" | "ADJACENT" | "ENTERPRISE";
    serp_frequency: number;
  }>;
  commercial_intent_ratio: number;
  demand_strength_score: number;
  serp_ad_density: number;
  data_sufficiency: "SUFFICIENT" | "LIMITED" | "INSUFFICIENT";
  market_stage: "Emerging" | "Growing" | "Saturated" | "Declining";
}

// ─── ZOD SCHEMAS ────────────────────────────────────────────

export const PricingPageSchema = z.object({
  has_freemium: z.boolean().default(false),
  has_trial: z.boolean().default(false),
  trial_days: z.number().nullable().default(null),
  requires_sales: z.boolean().default(false),
  has_self_service_checkout: z.boolean().default(false),
  has_public_prices: z.boolean().default(false),
  has_enterprise_plan: z.boolean().default(false),
  has_value_based_limits: z.boolean().default(false),
  has_upgrade_path: z.boolean().default(false),
  entry_price_usd: z.number().nullable().default(null),
  billing_period: z
    .enum(["monthly", "yearly", "one_time", "usage"])
    .nullable()
    .default(null),
  cta_primary: z.string().default(""),
});

export type PricingPageParsed = z.infer<typeof PricingPageSchema>;

// ─── INTERNAL INTERFACES ────────────────────────────────────

export interface PricingPageData {
  competitorName: string;
  domain: string;
  hasPricingPage: boolean;
  hasFreemium: boolean;
  hasTrial: boolean;
  trialDays: number | null;
  requiresSales: boolean;
  hasSelfServiceCheckout: boolean;
  hasPublicPrices: boolean;
  hasEnterpriseplan: boolean;
  hasValueBasedLimits: boolean;
  hasUpgradePath: boolean;
  entryPriceUsd: number | null;
  billingPeriod: "monthly" | "yearly" | "one_time" | "usage" | null;
  detectedArchetype: MonetizationArchetype;
  rawText: string;
}

export interface BinarySignals {
  hasPricingPage: boolean;
  hasSelfService: boolean;
  hasContactSales: boolean;
  hasFreemium: boolean;
  hasFreeTrial: boolean;
  hasPublicPrices: boolean;
  hasEnterpriseMention: boolean;
  hasCheckout: boolean;
  mentionsSubscription: boolean;
  mentionsApiUsage: boolean;
  hasValueBasedLimits: boolean;
  hasUpgradePath: boolean;
  pricingPagesCount: number;
}

export interface ArchetypeCandidate {
  type: MonetizationArchetype;
  score: number;
  reasoning: string;
}

export interface ArchetypeResult {
  primary: MonetizationArchetype;
  secondary: MonetizationArchetype | null;
  confidence: number;
  reasoning: string;
}

export interface LivenessResult {
  level: LivenessLevel;
  strengthScore: number;
  signals: string[];
}

export interface ConsistencyResult {
  consistencyScore: number;
  falsePositiveMarket: boolean;
  inconsistencyReason: string | null;
}

export interface PricingProfile {
  tier: PriceTier;
  entryPrice: number | null;
  billingModel: BillingModel;
}

// ─── HELPER CLIENT INTERFACES ───────────────────────────────

export interface SerpApiClient {
  search(query: string): Promise<{
    organic_results?: Array<{ title: string; link: string; snippet: string }>;
  }>;
}

export interface HaikuClient {
  complete(prompt: string): Promise<string>;
}
