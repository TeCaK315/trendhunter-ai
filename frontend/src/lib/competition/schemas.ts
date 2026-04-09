// lib/competition/schemas.ts
// ALL Zod schemas for Block 4 v2 Competition Analysis

import { z } from 'zod';

// ─── TYPES ──────────────────────────────────────────────────

export type CompetitorType = 'DIRECT' | 'INDIRECT' | 'SUBSTITUTE';
export type EntryVerdict = 'GO' | 'EXPERIMENT' | 'HARD';
export type CompetitionIntensity = 'LOW' | 'MEDIUM' | 'HIGH' | 'SATURATED';

export interface Competitor {
  name: string;
  domain: string;
  url: string;
  type: CompetitorType;
  serp_frequency: number;
}

export interface CompetitorAnalysis {
  name: string;
  type: CompetitorType;
  size?: 'micro' | 'small' | 'medium' | 'large';
  p1?: Class1Output;
  p2?: Class2Output;
  p3?: Class3Output;
  p4?: Class4Output;
  p5?: Class5Output;
  mappedPains?: import('./pain-matching').MappedPain[];
}

export interface CompetitorReliability {
  missing_classes: number[];
  overall_confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  class1_success: boolean;
  class2_success: boolean;
  class3_success: boolean;
  class4_success: boolean;
  class5_success: boolean;
}

// ─── ZOD SCHEMAS ────────────────────────────────────────────

export const Class1Schema = z.object({
  positioning_type: z.enum(['LOW_COST', 'PREMIUM', 'NICHE', 'ALL_IN_ONE', 'BEST_OF_BREED']),
  ideal_customer_profile: z.string().nullable().default(null),
  core_promise: z.string().nullable().default(null),
  messaging_tone: z.enum(['EMOTIONAL', 'RATIONAL', 'TRUST_DRIVEN', 'TECHNICAL', 'URGENT']).default('RATIONAL'),
});
export type Class1Output = z.infer<typeof Class1Schema>;

export const Class2Schema = z.object({
  core_features: z.array(z.string()).default(['insufficient_data']),
  product_complexity: z.enum(['SIMPLE', 'MODERATE', 'COMPLEX']).default('MODERATE'),
  switching_cost: z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  integrations_depth: z.enum(['none', 'basic', 'deep', 'ecosystem']).default('basic'),
});
export type Class2Output = z.infer<typeof Class2Schema>;

export const Class3Schema = z.object({
  price_model: z.enum(['subscription', 'one_time', 'usage', 'hybrid']).nullable().default(null),
  // .preprocess: Claude иногда возвращает "$50" (строку) вместо 50 (числа)
  entry_price: z.preprocess(
    (v) => (typeof v === 'string' ? parseFloat(v.replace(/[^0-9.]/g, '')) || null : v),
    z.number().nullable()
  ).default(null),
  is_starting_price: z.boolean().default(false),
  has_free_tier: z.boolean().default(false),
  upsell_logic: z.enum(['feature_gating', 'volume', 'support', 'compliance']).nullable().default(null),
  buyer_vs_user: z.enum(['same', 'different']).default('different'),
});
export type Class3Output = z.infer<typeof Class3Schema>;

export const Class4Schema = z.object({
  evidence_weaknesses: z.array(z.object({
    weakness: z.string(),
    evidence_type: z.enum(['DIRECT_REVIEW', 'LOGICAL_DEDUCTION']),
    evidence_quote: z.string().nullable().default(null),
    is_fixable: z.boolean(),
    fixable_reason: z.string(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  })).default([]),
  structural_weakness: z.object({
    weakness: z.string(),
    why_unfixable: z.string(),
    confidence: z.enum(['MEDIUM', 'LOW']),
  }).nullable().default(null),
  pain_point_gaps: z.array(z.object({
    pain: z.string(),
    status: z.enum(['FULLY', 'PARTIALLY', 'NOT_AT_ALL', 'UNKNOWN']),
    evidence: z.string(),
    confidence: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  })).default([]),
  summary: z.object({
    core_failure: z.string(),
    who_will_struggle: z.string(),
    can_enter: z.enum(['EASY', 'MODERATE', 'HARD']),
  }).nullable().default(null),
});
export type Class4Output = z.infer<typeof Class4Schema>;

export const Class5Schema = z.object({
  acquisition_type: z.enum(['SALES_LED', 'PLG', 'SEO_LED', 'COMMUNITY_LED', 'UNKNOWN']).default('UNKNOWN'),
  growth_signals: z.enum(['positive', 'negative', 'stable']).default('stable'),
  content_strategy: z.enum(['technical', 'case_studies', 'comparison', 'educational', 'unknown']).default('unknown'),
  velocity: z.enum(['NEW', 'GROWING', 'MATURE', 'LEGACY']).default('MATURE'),
});
export type Class5Output = z.infer<typeof Class5Schema>;

export const Class6Schema = z.object({
  gap_map: z.array(z.object({
    pain: z.string(),
    status: z.enum(['closed', 'partial', 'open', 'unknown']),
    paying_ratio: z.number(),
  })),
  competition_intensity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'SATURATED']),
  positioning_map: z.array(z.object({
    name: z.string(),
    x: z.number(),
    y: z.number(),
    positioning_type: z.string(),
    is_x_estimated: z.boolean(),
  })),
  main_opportunity: z.string(),
  open_pain_ratio: z.number(),
  high_value_gap_count: z.number(),
  dominant_player_present: z.boolean(),
  avg_switching_cost: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  substitute_strength: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  positioning_distribution: z.object({
    LOW_COST: z.number(),
    PREMIUM: z.number(),
    NICHE: z.number(),
    ALL_IN_ONE: z.number(),
    BEST_OF_BREED: z.number(),
  }),
});
export type Class6Output = z.infer<typeof Class6Schema>;

export const SubstituteSchema = z.object({
  solution_method: z.enum(['manual_spreadsheets', 'pen_and_paper', 'outsourcing', 'ignoring', 'generic_software', 'homegrown']),
  switching_cost_from_substitute: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  typical_frustrations: z.array(z.string()),
  why_they_would_upgrade: z.string(),
  coverage_strength: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  is_free_substitute: z.boolean(),
  upgrade_urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});
export type SubstituteOutput = z.infer<typeof SubstituteSchema>;

export const NarrativeSchema = z.object({
  narrative_intro: z.string(),
  narrative_outro: z.string(),
});
export type NarrativeOutput = z.infer<typeof NarrativeSchema>;
