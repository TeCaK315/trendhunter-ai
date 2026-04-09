// lib/competition/formula.ts
// Deterministic functions for Block 4 v2 Competition Analysis
// All math is in code — NOT in Claude prompts

import { z } from 'zod';
import {
  type EntryVerdict,
  type Competitor,
  type CompetitorType,
  type CompetitorReliability,
  type Class1Output,
  type Class3Output,
  type SubstituteOutput,
  Class1Schema,
  Class2Schema,
  Class3Schema,
  Class4Schema,
  Class5Schema,
  SubstituteSchema,
} from './schemas';

// ─── ENTRY VERDICT FORMULA ────────────────────────────────────
// Математика в коде Next.js — не в промпте Claude

const intensityNumeric: Record<string, number> = {
  LOW: 0.1, MEDIUM: 0.3, HIGH: 0.6, SATURATED: 1.0,
};
const switchingNumeric: Record<string, number> = {
  LOW: 0.1, MEDIUM: 0.3, HIGH: 0.6,
};

export function calculateEntryVerdict(data: {
  gapMap: Array<{ status: string }>;
  competitionIntensity: string;
  avgSwitchingCost: string;
  directCompetitorCount: number;
  substituteData: SubstituteOutput | null;
}): EntryVerdict {
  const total   = data.gapMap.length;
  const open    = data.gapMap.filter(g => g.status === 'open').length;
  const partial = data.gapMap.filter(g => g.status === 'partial').length;
  const unknown = data.gapMap.filter(g => g.status === 'unknown').length;

  const intensity = intensityNumeric[data.competitionIntensity] ?? 0.3;
  const switching = switchingNumeric[data.avgSwitchingCost] ?? 0.3;

  let score = (open * 0.3) + (partial * 0.15) + (unknown * 0.05)
            - (intensity * 0.25) - (switching * 0.2);

  // Substitute штрафы (применяются последовательно):
  if (data.substituteData) {
    let penalty = 1.0;
    if (data.substituteData.coverage_strength === 'HIGH' &&
        data.substituteData.switching_cost_from_substitute === 'HIGH') {
      // Если нет SaaS конкурентов — substitute не является барьером, только легкий штраф
      penalty *= data.directCompetitorCount > 0 ? 0.7 : 0.9;
    }
    if (data.substituteData.is_free_substitute &&
        data.substituteData.upgrade_urgency !== 'HIGH') {
      penalty *= 0.8;
    }
    score *= penalty;
  }

  // Жёсткие правила (применяются ПОСЛЕ score + substitute штрафов):

  // Substitute override: Excel доминирует И есть SaaS конкуренты И рынок закрыт
  if (
    data.substituteData?.coverage_strength === 'HIGH' &&
    data.substituteData?.switching_cost_from_substitute === 'HIGH' &&
    data.directCompetitorCount >= 2 &&
    total > 0 && (open / total) < 0.3
  ) return 'HARD';

  if (data.competitionIntensity === 'SATURATED' && total > 0 && (open / total) < 0.2)
    return 'HARD';
  if (data.competitionIntensity === 'LOW' && open >= 2)
    return 'GO';
  if (unknown > open)
    score -= 0.15;

  if (score >= 0.5) return 'GO';
  if (score >= 0.2) return 'EXPERIMENT';
  return 'HARD';
}

// ─── AGGREGATE CONFIDENCE ────────────────────────────────────

export function calculateAggregateConfidence(data: {
  demandConfidence: number;
  monetizationConfidence: number;
  dataCoverageRatio: number;
  gapMapUnknownRatio: number;
}): { score: number; level: 'HIGH' | 'MEDIUM' | 'LOW' } {
  let score = (data.demandConfidence * 0.3)
            + (data.monetizationConfidence * 0.3)
            + (data.dataCoverageRatio * 0.2)
            + ((1 - data.gapMapUnknownRatio) * 0.2);

  // Hard floor: если мало данных по конкурентам → не может быть HIGH
  if (data.dataCoverageRatio < 0.5) {
    score = Math.min(score, 0.64);
  }

  const level: 'HIGH' | 'MEDIUM' | 'LOW' =
    score >= 0.65 ? 'HIGH' :
    score >= 0.40 ? 'MEDIUM' : 'LOW';

  return { score, level };
}

// ─── NARRATIVE MODE SELECTOR ──────────────────────────────────

export function selectNarrativeMode(
  entryVerdict: EntryVerdict,
  confidence: { level: 'HIGH' | 'MEDIUM' | 'LOW' },
  gapMapUnknownRatio: number,
  dataCoverageRatio: number
): 'РЕЖИМ_1' | 'РЕЖИМ_2' | 'РЕЖИМ_3' {
  // Приоритет 1: РЕЖИМ_3
  if (confidence.level === 'LOW' || entryVerdict === 'HARD') {
    return 'РЕЖИМ_3';
  }

  // Приоритет 2: РЕЖИМ_1 (все условия одновременно)
  if (
    (entryVerdict === 'GO' || entryVerdict === 'EXPERIMENT') &&
    confidence.level === 'HIGH' &&
    gapMapUnknownRatio <= 0.25 &&
    dataCoverageRatio >= 0.6
  ) {
    return 'РЕЖИМ_1';
  }

  // Приоритет 3: РЕЖИМ_2 (всё остальное)
  return 'РЕЖИМ_2';
}

// ─── SCHEMA SAFE DEFAULTS ────────────────────────────────────
// Универсальная версия через Zod рефлексию

export function getSchemaDefaults(schema: z.ZodType<any>): any {
  if (schema instanceof z.ZodObject) {
    const defaults: any = {};
    for (const [key, field] of Object.entries(schema.shape as Record<string, z.ZodType<any>>)) {
      if (field instanceof z.ZodDefault) {
        defaults[key] = (field as any)._def.defaultValue();
      } else if (field instanceof z.ZodOptional || field instanceof z.ZodNullable) {
        defaults[key] = null;
      } else if (field instanceof z.ZodArray) {
        defaults[key] = [];
      } else if (field instanceof z.ZodBoolean) {
        defaults[key] = false;
      } else if (field instanceof z.ZodNumber) {
        defaults[key] = 0;
      } else if (field instanceof z.ZodString) {
        defaults[key] = '';
      } else if (field instanceof z.ZodEnum) {
        defaults[key] = (field as any)._def.values[0];
      }
    }
    return defaults;
  }
  // Явные дефолты как запасной вариант
  if (schema === Class1Schema) return { positioning_type: 'BEST_OF_BREED', ideal_customer_profile: null, core_promise: null, messaging_tone: 'RATIONAL' };
  if (schema === Class2Schema) return { core_features: ['insufficient_data'], product_complexity: 'MODERATE', switching_cost: 'MEDIUM', integrations_depth: 'basic' };
  if (schema === Class3Schema) return { price_model: null, entry_price: null, is_starting_price: false, has_free_tier: false, upsell_logic: null, buyer_vs_user: 'different' };
  if (schema === Class4Schema) return { evidence_weaknesses: [], structural_weakness: null, pain_point_gaps: [], summary: null };
  if (schema === Class5Schema) return { acquisition_type: 'UNKNOWN', growth_signals: 'stable', content_strategy: 'unknown', velocity: 'MATURE' };
  if (schema === SubstituteSchema) return { solution_method: 'ignoring', switching_cost_from_substitute: 'MEDIUM', typical_frustrations: [], why_they_would_upgrade: '', coverage_strength: 'LOW', is_free_substitute: false, upgrade_urgency: 'MEDIUM' };
  return {};
}

// ─── PIPELINE HELPERS ────────────────────────────────────────

// Type-safe: TypeScript не позволит передать SUBSTITUTE сюда
export function getClassesByType(type: Exclude<CompetitorType, 'SUBSTITUTE'>): number[] {
  if (type === 'DIRECT')   return [1, 2, 3, 4, 5];
  if (type === 'INDIRECT') return [1, 3, 4];
  // TypeScript exhaustiveness check
  const _exhaustive: never = type;
  return [];
}

// Дедупликация — "Jira" и "JIRA" и "jira" = один конкурент
export function deduplicateCompetitors(competitors: Competitor[]): Competitor[] {
  const seen = new Map<string, Competitor>();
  for (const comp of competitors) {
    const key = comp.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!seen.has(key)) seen.set(key, comp);
    else console.warn(`[Block4] Duplicate competitor skipped: "${comp.name}"`);
  }
  return Array.from(seen.values());
}

// Валидация домена — skip невалидных вместо throw
export function validateCompetitors(competitors: Competitor[]): Competitor[] {
  return competitors.map(c => {
    const domain = c.domain
      .trim().toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '');
    if (!domain.includes('.') || domain.includes(' ')) {
      console.warn(`[Block4] Invalid domain skipped: "${c.domain}" for "${c.name}"`);
      return null;
    }
    return { ...c, domain };
  }).filter((c): c is Competitor => c !== null);
}

// Детальная надёжность данных по конкуренту
export function calculateReliability(missingClasses: number[]): CompetitorReliability {
  const successRate = (5 - missingClasses.length) / 5;
  return {
    missing_classes: missingClasses,
    overall_confidence: successRate >= 0.8 ? 'HIGH' : successRate >= 0.6 ? 'MEDIUM' : 'LOW',
    class1_success: !missingClasses.includes(1),
    class2_success: !missingClasses.includes(2),
    class3_success: !missingClasses.includes(3),
    class4_success: !missingClasses.includes(4),
    class5_success: !missingClasses.includes(5),
  };
}

// Обогащение данными из Block 3 — не замена, а дополнение
export function mergeWithBlock3Prices(
  localClass3: Class3Output,
  block3Data: { price_usd?: number; billing_model?: string; has_freemium?: boolean; requires_sales?: boolean } | undefined
): Class3Output {
  if (!block3Data || localClass3.entry_price !== null) return localClass3;
  return {
    ...localClass3,
    price_model: (block3Data.billing_model as any) ?? localClass3.price_model,
    entry_price: block3Data.price_usd ?? null,
    has_free_tier: block3Data.has_freemium ?? localClass3.has_free_tier,
    buyer_vs_user: block3Data.requires_sales ? 'different' : localClass3.buyer_vs_user,
  };
}

// Template → prompt substitution
export function buildPrompt(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return typeof val === 'object' ? JSON.stringify(val) : String(val ?? '');
  });
}
