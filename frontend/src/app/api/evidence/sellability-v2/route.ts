// app/api/evidence/sellability-v2/route.ts
// Блок 3 v2 — Продаваемость (Monetization Model Detection)
// Читает данные из Блоков 0, 1, 2, 4 (конкуренция)
//
// WAVE ORDER:
// Wave 1: Block 1 (Problem) + Block 2 (Demand) — parallel
// Wave 2: Block 4 (Competition) — waits for Wave 1
// Wave 3: Block 3 (Sellability) — waits for Block 4 ← THIS FILE
// Wave 4: Block 5 (Economics) — waits for Blocks 2+3+4
// Wave 5: Block 6 (Blind Spots) — waits for all 1-5
// Wave 6: Block 7 (AI Synthesis) — manual trigger

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser } from '@/lib/auth-helpers';
import { getServerSupabase } from '@/lib/supabase';

import type {
  Block3Output, ContextObject, Block1Input, Block2Input,
  MonetizationVerdict, MonetizationArchetype, MonetizationQuality,
  FrictionScore, BinarySignals, ArchetypeResult, ConsistencyResult,
  RiskFactor, LivenessLevel, PricingPageData,
  SerpApiClient, HaikuClient,
} from '@/lib/monetization/schemas';

import { checkLiveness } from '@/lib/monetization/liveness';
import { collectPricingData, extractBinarySignals, extractPricingProfile } from '@/lib/monetization/pricing';
import { preClassify, getBaseQuality, getScalabilityMultiplier, VALID_ARCHETYPES } from '@/lib/monetization/archetypes';
import { calculateFrictionScore } from '@/lib/monetization/friction';

const claude = new Anthropic();

// ─── SerpAPI + Haiku adapters ───────────────────────────────

function createSerpApiClient(apiKey: string): SerpApiClient {
  return {
    async search(query: string) {
      try {
        const params = new URLSearchParams({
          engine: 'google', q: query, api_key: apiKey, num: '10',
        });
        const res = await fetch(`https://serpapi.com/search?${params}`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return { organic_results: [] };
        return await res.json();
      } catch {
        return { organic_results: [] };
      }
    },
  };
}

function createHaikuClient(): HaikuClient {
  return {
    async complete(prompt: string) {
      const response = await claude.messages.create({
        model: 'claude-haiku-4-5-20251001',
        temperature: 0,
        max_tokens: 800,
        system: 'Respond with valid JSON only, no markdown or explanations.',
        messages: [{ role: 'user', content: prompt }],
      });
      return response.content[0].type === 'text' ? response.content[0].text : '{}';
    },
  };
}

// ─── Haiku Arbitration ──────────────────────────────────────

async function arbitrateArchetype(
  candidates: ReturnType<typeof preClassify>,
  signals: BinarySignals,
  ctx: ContextObject,
  haiku: HaikuClient,
): Promise<ArchetypeResult> {
  if (candidates.length === 1 || candidates[0].score > 0.8) {
    return {
      primary: candidates[0].type,
      secondary: candidates[1]?.score > 0.3 ? candidates[1].type : null,
      confidence: candidates[0].score,
      reasoning: candidates[0].reasoning,
    };
  }

  const topCandidates = candidates.slice(0, 3);
  const response = await haiku.complete(`
    You are a monetization model arbiter.
    Choose the best model from the pre-classified candidates.
    Do NOT invent new models. Return ONLY valid JSON (no markdown).

    Context:
    - Market type: ${ctx.category_type}
    - Economic buyer: ${ctx.actors.economic_buyer}
    - Buyer fear: ${ctx.actors.buyer_fear}

    Binary signals: ${JSON.stringify(signals)}
    Candidates: ${JSON.stringify(topCandidates)}

    Return: { "primary": string, "secondary": string | null, "confidence": number, "reasoning": string }
  `);

  try {
    const clean = response.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    const isValidPrimary =
      VALID_ARCHETYPES.has(parsed.primary as MonetizationArchetype) &&
      (candidates.some(c => c.type === parsed.primary) || parsed.primary === 'UNKNOWN');
    if (!isValidPrimary) throw new Error(`Invalid archetype: ${parsed.primary}`);

    const secondary = parsed.secondary && VALID_ARCHETYPES.has(parsed.secondary as MonetizationArchetype)
      ? (parsed.secondary as MonetizationArchetype) : null;

    return {
      primary: parsed.primary as MonetizationArchetype,
      secondary,
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0, 0), 1),
      reasoning: parsed.reasoning || candidates[0].reasoning,
    };
  } catch (e) {
    console.error('[Block3] Haiku arbitration failed:', e);
    return {
      primary: candidates[0].type,
      secondary: candidates[1]?.score > 0.3 ? candidates[1].type : null,
      confidence: candidates[0].score * 0.7,
      reasoning: `Arbitration failed. Default: ${candidates[0].reasoning}`,
    };
  }
}

// ─── Consistency Check ──────────────────────────────────────

function checkConsistency(params: {
  monetizationArchetype: MonetizationArchetype;
  payingRatio: number;
  commercialIntent: number;
  livenessLevel: LivenessLevel;
}): ConsistencyResult {
  let consistencyScore = 1.0;
  let falsePositiveMarket = false;
  let inconsistencyReason: string | null = null;

  if (
    params.monetizationArchetype !== 'UNKNOWN' &&
    params.monetizationArchetype !== 'ENTERPRISE_ONLY' &&
    params.payingRatio < 0.1 &&
    params.commercialIntent > 0.6
  ) {
    consistencyScore *= 0.5;
    falsePositiveMarket = true;
    inconsistencyReason = 'High commercial intent but very low paying ratio. Possible hype market.';
  }

  if (params.monetizationArchetype === 'UNKNOWN' && params.payingRatio > 0.3) {
    consistencyScore *= 0.6;
    inconsistencyReason = 'Paying behavior detected but no clear monetization model found.';
  }

  if (params.monetizationArchetype === 'UNKNOWN' && params.commercialIntent > 0.6) {
    consistencyScore *= 0.7;
    inconsistencyReason = 'High commercial intent but monetization model unclear.';
  }

  if (params.livenessLevel === 'STRONG' && params.payingRatio > 0.3) {
    consistencyScore = Math.min(consistencyScore * 1.1, 1.0);
  }

  return {
    consistencyScore: Math.max(consistencyScore, 0.5),
    falsePositiveMarket,
    inconsistencyReason,
  };
}

// ─── Quality, Confidence, Verdict, Risks ────────────────────

function determineQuality(params: {
  archetype: MonetizationArchetype;
  binarySignals: BinarySignals;
  payingRatio: number;
  falsePositiveMarket: boolean;
}): MonetizationQuality {
  if (params.falsePositiveMarket) return 'FRAGILE';
  let quality = getBaseQuality(params.archetype, params.binarySignals);
  if (params.payingRatio < 0.1 && quality === 'SCALABLE') quality = 'FRAGILE';
  else if (params.payingRatio < 0.15 && quality === 'STABLE') quality = 'FRAGILE';
  return quality;
}

function calculateMonetizationConfidence(params: {
  competitorsAnalyzed: number;
  hasPricingPagesRatio: number;
  livenessLevel: LivenessLevel;
  dataSufficiency: string;
  consistencyScore: number;
}): number {
  let score = 1.0;
  if (params.competitorsAnalyzed === 0) score *= 0.3;
  else if (params.competitorsAnalyzed < 2) score *= 0.6;
  else if (params.competitorsAnalyzed < 3) score *= 0.8;
  if (params.hasPricingPagesRatio < 0.3) score *= 0.5;
  else if (params.hasPricingPagesRatio < 0.6) score *= 0.7;
  if (params.livenessLevel === 'NONE') score *= 0.3;
  else if (params.livenessLevel === 'WEAK') score *= 0.6;
  if (params.dataSufficiency === 'INSUFFICIENT') score *= 0.5;
  else if (params.dataSufficiency === 'LIMITED') score *= 0.7;
  score *= params.consistencyScore;
  return Math.min(score, 1.0);
}

function determineVerdict(params: {
  livenessLevel: LivenessLevel;
  archetypeResult: ArchetypeResult;
  monetizationConfidence: number;
  consistency: ConsistencyResult;
  demandStrength: number;
  payingRatio: number;
}): { verdict: MonetizationVerdict; unclearReason?: 'UNPROVEN' | 'NO_DATA' | 'INSUFFICIENT_EVIDENCE' } {
  if (params.monetizationConfidence < 0.35) {
    return params.archetypeResult.primary === 'UNKNOWN'
      ? { verdict: 'UNCLEAR', unclearReason: 'NO_DATA' }
      : { verdict: 'UNCLEAR', unclearReason: 'INSUFFICIENT_EVIDENCE' };
  }
  if (params.livenessLevel === 'NONE' && params.payingRatio < 0.05) {
    return { verdict: 'NONE' };
  }
  if (params.archetypeResult.primary === 'UNKNOWN' && params.demandStrength > 0.4) {
    return { verdict: 'UNCLEAR', unclearReason: 'UNPROVEN' };
  }
  if (params.archetypeResult.primary === 'UNKNOWN') {
    return { verdict: 'UNCLEAR', unclearReason: 'INSUFFICIENT_EVIDENCE' };
  }
  if (params.consistency.falsePositiveMarket || params.livenessLevel === 'WEAK') {
    return { verdict: 'PARTIAL' };
  }
  if (params.monetizationConfidence >= 0.6 && params.livenessLevel === 'PRESENT') {
    return { verdict: 'CLEAR' };
  }
  return { verdict: 'PARTIAL' };
}

function generateRisks(params: {
  quality: MonetizationQuality; archetype: MonetizationArchetype;
  binarySignals: BinarySignals; consistency: ConsistencyResult;
  frictionScore: FrictionScore; isB2B: boolean;
  pricingData: PricingPageData[]; marketStage?: string;
}): RiskFactor[] {
  const codes = new Set<string>();
  const risks: RiskFactor[] = [];
  const add = (code: string, message: string, severity: 'HIGH' | 'MEDIUM' | 'LOW') => {
    if (!codes.has(code)) { codes.add(code); risks.push({ code, message, severity }); }
  };

  if (params.marketStage === 'Declining')
    add('MARKET_CONTRACTION', 'Рынок сжимается. Модели монетизации могут быть нежизнеспособны.', 'HIGH');
  if (params.quality === 'FRAGILE') {
    add('FRAGILE_MONETIZATION', 'Хрупкая монетизация. Доход не удерживается без постоянного притока новых клиентов.', 'HIGH');
    add('NO_RETENTION_MODEL', 'Отсутствие повторных платежей создаёт высокую зависимость от маркетингового бюджета.', 'MEDIUM');
  }
  if (params.quality === 'STABLE')
    add('SCALING_CEILING', 'Предсказуемый доход, но потолок роста.', 'MEDIUM');
  if (params.quality === 'SCALABLE') {
    add('HIGH_CAC_SENSITIVITY', 'Масштабируемые модели чувствительны к CAC.', 'MEDIUM');
    add('WINNER_TAKES_ALL_DYNAMICS', 'Масштабируемые рынки склонны к монополизации.', 'MEDIUM');
  }
  if (params.archetype === 'FREEMIUM_LED' && (!params.binarySignals.hasValueBasedLimits || !params.binarySignals.hasUpgradePath))
    add('FREEMIUM_TRAP', 'Freemium без чётких лимитов или пути апгрейда. Конверсия будет низкой.', 'HIGH');
  if (params.archetype === 'ENTERPRISE_ONLY')
    add('ENTERPRISE_ONLY_RISK', 'Только enterprise контракты. Self-service невозможен.', 'HIGH');
  if (params.archetype === 'ONE_TIME_PURCHASE')
    add('ONE_TIME_ONLY_REVENUE', 'Разовые покупки без рекуррентного дохода.', 'MEDIUM');
  if (params.consistency.falsePositiveMarket)
    add('FALSE_POSITIVE_MARKET', 'Модели монетизации существуют, но paying_ratio очень низкий.', 'HIGH');
  if (params.frictionScore === 'HIGH' && !params.isB2B)
    add('HIGH_FRICTION_B2C', 'Высокое трение при покупке в B2C снижает конверсию.', 'MEDIUM');

  const prices = params.pricingData.map(p => p.entryPriceUsd).filter((p): p is number => p !== null && p > 0);
  if (prices.length >= 2) {
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(prices.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / prices.length);
    const cv = mean > 0 ? stdDev / mean : 0;
    if (cv > 0.5) add('PRICING_VOLATILITY', `Цены сильно варьируются (CV=${Math.round(cv * 100)}%).`, 'MEDIUM');
  }

  const hasZeroDollar = params.pricingData.some(p => p.hasFreemium && p.entryPriceUsd === null && !p.hasUpgradePath);
  if (hasZeroDollar)
    add('ZERO_DOLLAR_STARTER', 'Freemium без пути апгрейда. Возможная free forever ловушка.', 'HIGH');

  return risks;
}

function buildDiagnosis(verdict: MonetizationVerdict, archetype: MonetizationArchetype, quality: MonetizationQuality, friction: FrictionScore): string {
  if (verdict === 'NONE') return 'Устоявшейся модели монетизации в нише не обнаружено.';
  if (verdict === 'UNCLEAR') return 'Модель монетизации не определена. Данных недостаточно.';
  const aNames: Record<MonetizationArchetype, string> = {
    SELF_SERVICE_SUBSCRIPTION: 'Self-service подписка', USAGE_BASED: 'Оплата за использование',
    MARKETPLACE: 'Маркетплейс', SALES_LED: 'Продажи через менеджеров',
    ENTERPRISE_ONLY: 'Только enterprise', AGENCY_CONSULTING: 'Агентские услуги',
    ONE_TIME_LICENSE: 'Разовая лицензия', ONE_TIME_PURCHASE: 'Разовая покупка',
    FREEMIUM_LED: 'Freemium', UNKNOWN: 'Не определена',
  };
  const qDesc: Record<MonetizationQuality, string> = { FRAGILE: 'Деньги есть, но не удерживаются', STABLE: 'Деньги предсказуемы', SCALABLE: 'Деньги растут с масштабом' };
  const fDesc: Record<FrictionScore, string> = { LOW: 'Купить можно онлайн', MEDIUM: 'Нужен trial/онбординг', HIGH: 'Требуется sales цикл' };
  return `${aNames[archetype]}. ${qDesc[quality]}. Трение: ${fDesc[friction]}.`;
}

function buildNoneOutput(liveness: { strengthScore: number }): Block3Output {
  return {
    monetization_verdict: 'NONE', monetization_confidence: 0.25,
    monetization_archetype: 'UNKNOWN', monetization_archetype_secondary: null,
    price_tier: 'budget', entry_price_usd: null, billing_model: 'subscription',
    scalability_multiplier: 0.3, friction_score: 'HIGH',
    has_freemium: false, has_free_trial: false, requires_sales_contact: false,
    competitor_monetization: [],
    monetization_risks: [{ code: 'NO_MONETIZATION_MODEL', message: 'В нише не обнаружено признаков монетизации.', severity: 'HIGH' }],
    monetization_quality: 'FRAGILE', false_positive_market: false,
    liveness_signal_strength: liveness.strengthScore,
    monetization_diagnosis: 'Монетизация отсутствует.',
  };
}

function verdictToScore(verdict: MonetizationVerdict): number {
  switch (verdict) {
    case 'CLEAR': return 8;
    case 'PARTIAL': return 5;
    case 'UNCLEAR': return 3;
    case 'NONE': return 1;
  }
}

// ─── Map block_context to input interfaces ──────────────────

function mapContextObject(ctx: any): ContextObject {
  return {
    category_type: ctx?.market_identity?.b2b_b2c === 'b2b' ? 'B2B'
      : ctx?.market_identity?.b2b_b2c === 'b2c' ? 'B2C' : 'Hybrid',
    actors: {
      economic_buyer: ctx?.actors?.economic_buyer || '',
      end_user: ctx?.actors?.end_user || '',
      buyer_fear: '',
    },
    buying_triggers: ctx?.signal_vocabulary?.buying_intent_signals || [],
    maturity_level: (ctx?.market_identity?.maturity_level || 'Growing') as any,
    stop_words_contextual: ctx?.stop_words_contextual || [],
  };
}

function mapBlock1(bc: any): Block1Input {
  const payingRatio = bc?.paying_users_ratio ?? 0;
  return {
    paying_ratio: payingRatio > 1 ? payingRatio / 100 : payingRatio,
    pain_type: bc?.pain_type || 'operational',
    clusters: (bc?.data_quality?.cross_validated_clusters || 0) > 0
      ? [{ theme: 'main', count: bc.data_quality.cross_validated_clusters }]
      : [],
    verdict: bc?.data_quality_verdict?.verdict || 'PARTIAL',
  };
}

function mapBlock2(bc: any): Block2Input {
  // paid конкуренты = всегда DIRECT (они платят за рекламу в нише)
  // organic конкуренты с frequency >= 2 = тоже DIRECT (стабильно в SERP)
  // остальные organic = ADJACENT
  const competitors = (bc?.competitors_found || []).map((c: any) => ({
    name: c.name || c.domain,
    domain: c.domain,
    type: (c.source === 'paid' || (c.serp_frequency ?? 1) >= 2)
      ? 'DIRECT' as const
      : 'ADJACENT' as const,
    serp_frequency: c.serp_frequency ?? 1,
  }));
  const totalKw = bc?.data_quality?.total_keywords ?? 0;
  return {
    competitors_found: competitors,
    commercial_intent_ratio: bc?.commercial_intent_ratio ?? 0,
    demand_strength_score: bc?.demand_confidence_score ?? 0.5,
    serp_ad_density: bc?.serp_ad_density ?? 0,
    data_sufficiency: totalKw >= 15 ? 'SUFFICIENT' : totalKw >= 5 ? 'LIMITED' : 'INSUFFICIENT',
    market_stage: bc?.is_structural_decline ? 'Declining' : 'Growing',
  };
}

// ════════════════════════════════════════════════════════════════
// INTERPRETATION LAYER (Block 3)
// ════════════════════════════════════════════════════════════════
// Фоновая генерация человекочитаемой интерпретации блока.
// Кэш 24ч в block_interpretations. Не блокирует основной ответ.

async function generateSellabilityInterpretation(
  trendId: string,
  niche: string,
  diagnosis: string,
  blockContext: Record<string, any>,
  supabase: ReturnType<typeof getServerSupabase>,
  anthropic: Anthropic,
  forceRegenerate: boolean = false,
): Promise<void> {
  if (forceRegenerate) {
    console.log('[Block3 Interpretation] forceRegenerate=true, skipping cache check');
  } else {
    // 3.4 — Кэш с проверкой смены архетипа (SALES_LED ↔ SELF_SERVICE)
    const { data: existing } = await supabase
      .from('block_interpretations')
      .select('id, generated_at, headline, decision_impact')
      .eq('trend_id', trendId)
      .eq('block_id', 'sellability')
      .maybeSingle();

    if (existing && (existing as any).generated_at) {
      const age = Date.now() - new Date((existing as any).generated_at).getTime();
      const isFresh = age < 24 * 60 * 60 * 1000;

      const currentArchetype = blockContext?.monetization_archetype ?? '';
      const isSalesLed = currentArchetype === 'SALES_LED' || currentArchetype === 'ENTERPRISE_ONLY';
      const isSelfService = currentArchetype === 'SELF_SERVICE_SUBSCRIPTION' || currentArchetype === 'FREEMIUM';
      const cachedText = (((existing as any).headline ?? '') + ((existing as any).decision_impact ?? '')).toLowerCase();

      const archetypeMismatch =
        (isSalesLed && (cachedText.includes('без продавца') || cachedText.includes('самообслуживание') || cachedText.includes('онлайн покупк')))
        || (isSelfService && (cachedText.includes('через менеджер') || cachedText.includes('через продавц')));

      if (isFresh && !archetypeMismatch) return;
      if (archetypeMismatch) {
        console.log(`[Block3 Interpretation] Archetype changed (${currentArchetype}), headline contradicts — regenerating`);
      }
    }
  }

  // Извлекаем данные из block_context
  const archetype = blockContext?.monetization_archetype ?? 'unknown';
  const quality = blockContext?.monetization_quality ?? 'STABLE';
  const frictionScore = blockContext?.friction_score ?? 'MEDIUM';
  const billingModel = blockContext?.billing_model ?? 'subscription';
  const hasFreeTrial = blockContext?.has_free_trial ?? false;
  const hasFreemium = blockContext?.has_freemium ?? false;
  const requiresSalesContact = blockContext?.requires_sales_contact ?? false;
  const entryPriceUsd = blockContext?.entry_price_usd ?? null;
  const priceTier = blockContext?.price_tier ?? 'unknown';
  const monetizationConfidence = blockContext?.monetization_confidence ?? 0.5;

  // Риски монетизации (в block_context их нет — берём из raw_data если есть)
  const monetizationRisks: string[] = Array.isArray(blockContext?.monetization_risks)
    ? blockContext.monetization_risks.map((r: any) => r?.message).filter(Boolean)
    : [];

  // 3.2 — Обогащённые конкуренты (с ростом из Блока 2)
  const enrichedCompetitors: any[] = Array.isArray(blockContext?.enriched_competitor_monetization)
    ? blockContext.enriched_competitor_monetization
    : Array.isArray(blockContext?.competitor_monetization)
    ? blockContext.competitor_monetization
    : [];

  function archHumanShort(a: string): string {
    switch (a) {
      case 'ENTERPRISE_ONLY': return 'продаёт только через менеджеров';
      case 'SELF_SERVICE_SUBSCRIPTION': return 'самообслуживание онлайн';
      case 'SALES_LED': return 'через менеджеров';
      case 'FREEMIUM': return 'бесплатный вход';
      case 'USAGE_BASED': return 'оплата за использование';
      default: return 'смешанная модель';
    }
  }

  // Детальное описание каждого конкурента
  const competitorDetails = enrichedCompetitors.slice(0, 4).map((c: any) => {
    const parts = [
      archHumanShort(c?.archetype ?? ''),
      c?.has_trial ? 'есть trial' : 'нет trial',
      c?.has_freemium ? 'есть бесплатный план' : '',
      c?.growth_pct != null
        ? c.growth_direction === 'up' ? `растёт +${c.growth_pct}%`
          : c.growth_direction === 'stable' ? 'стабильный'
          : ''
        : '',
    ].filter(Boolean).join(', ');
    return `${c?.name ?? '?'}: ${parts}`;
  }).join('\n');

  // Самый быстрорастущий конкурент — key signal
  const fastestGrowing = enrichedCompetitors
    .filter((c: any) => c?.growth_pct != null && c.growth_direction === 'up')
    .sort((a: any, b: any) => (b.growth_pct ?? 0) - (a.growth_pct ?? 0))[0] ?? null;

  const fastestGrowingInsight = fastestGrowing
    ? `Самый быстрорастущий конкурент — ${fastestGrowing.name} (+${fastestGrowing.growth_pct}%): ${
        fastestGrowing.archetype === 'SELF_SERVICE_SUBSCRIPTION'
          ? 'работает по модели самообслуживания — рынок принимает онлайн-покупку без менеджера'
          : fastestGrowing.archetype === 'ENTERPRISE_ONLY'
          ? 'растёт через корпоративный сегмент с длинным циклом'
          : 'растёт со смешанной моделью'
      }`
    : '';

  // 3.5 — Вторичный архетип (растущий тренд рынка)
  const secondaryArchetype = blockContext?.monetization_archetype_secondary ?? null;
  const secondaryArchetypeHuman =
    secondaryArchetype === 'USAGE_BASED' ? 'оплата за использование (usage-based)'
    : secondaryArchetype === 'FREEMIUM' ? 'freemium с платными функциями'
    : secondaryArchetype === 'SELF_SERVICE_SUBSCRIPTION' ? 'самообслуживание онлайн'
    : null;
  const marketDirectionSignal = secondaryArchetypeHuman
    ? `Рынок начинает двигаться к модели "${secondaryArchetypeHuman}" — ранний вход через неё может создать преимущество`
    : null;

  // 3.6 — Trial/freemium coverage: структурный сигнал
  const competitorsWithTrial = enrichedCompetitors.filter((c: any) => c?.has_trial === true).length;
  const competitorsWithFreemium = enrichedCompetitors.filter((c: any) => c?.has_freemium === true).length;
  const totalCompetitorsCount = enrichedCompetitors.length;
  const noFreeEntrySignal = totalCompetitorsCount >= 2 && competitorsWithTrial === 0 && competitorsWithFreemium === 0;
  const trialInsight = noFreeEntrySignal
    ? `Ни один конкурент не предлагает trial или freemium — рынок продаёт только через менеджеров. Первый игрок с trial создаёт значимую дифференциацию.`
    : (totalCompetitorsCount >= 2 && (competitorsWithTrial + competitorsWithFreemium) < totalCompetitorsCount && (competitorsWithTrial > 0 || competitorsWithFreemium > 0))
      ? `${competitorsWithTrial} из ${totalCompetitorsCount} конкурентов предлагают trial — рынок начинает открываться для самообслуживания`
      : null;

  // Перевод технических терминов в человеческий язык
  const archetypeHuman =
    archetype === 'SELF_SERVICE_SUBSCRIPTION' ? 'подписка без продавцов'
    : archetype === 'ENTERPRISE_ONLY' ? 'продажи через менеджеров'
    : archetype === 'SALES_LED' ? 'продажи через менеджеров'
    : archetype === 'FREEMIUM' ? 'бесплатный вход с платными функциями'
    : archetype === 'USAGE_BASED' ? 'оплата за использование'
    : 'смешанная модель';

  const qualityHuman =
    quality === 'SCALABLE' ? 'выручка растёт с масштабом без пропорционального роста затрат'
    : quality === 'STABLE' ? 'предсказуемая стабильная выручка'
    : 'нестабильная или разовая выручка';

  const frictionHuman =
    frictionScore === 'LOW' ? 'низкое — клиент может купить быстро без демо и переговоров'
    : frictionScore === 'MEDIUM' ? 'среднее — нужен trial или онбординг перед покупкой'
    : 'высокое — длинный цикл переговоров и согласований';

  // data_sufficiency на основе confidence
  const dataSufficiency: 'sufficient' | 'limited' = monetizationConfidence >= 0.7 ? 'sufficient' : 'limited';

  const systemPrompt = `Ты — аналитик рынков для предпринимателей.
Пишешь на русском языке. Твои тексты читают люди которые думают
войти в новую нишу — они не технари, они бизнесмены.

ЖЁСТКИЕ ПРАВИЛА:
- Никогда не используй: monetization_archetype, friction_score,
  SCALABLE, SELF_SERVICE_SUBSCRIPTION, ENTERPRISE_ONLY, SALES_LED,
  PARTIAL, monetization_confidence, liveness_signal_strength,
  scalability_multiplier, HIGH_CAC_SENSITIVITY, WINNER_TAKES_ALL
- Никогда не пиши: "данных недостаточно", "PARTIAL статус",
  "confidence", "архетип", "вердикт монетизации"
- Тон: уверенный аналитик который хорошо знает этот рынок`;

  const userPrompt = `Проанализируй монетизацию в нише: "${niche}"

ТЕХНИЧЕСКИЕ ДАННЫЕ (не используй эти термины в тексте):
- Диагноз: ${diagnosis}
- Модель монетизации рынка: ${archetypeHuman}
- Качество выручки: ${qualityHuman}
- Трение при продаже: ${frictionHuman}
- Модель оплаты: ${billingModel === 'subscription' ? 'подписка' : billingModel}
- Есть trial: ${hasFreeTrial ? 'да' : 'нет'}
- Ценовой сегмент: ${priceTier === 'enterprise' ? 'enterprise (дорогой)' : priceTier === 'smb' ? 'SMB (средний чек)' : priceTier}
- Достаточность данных: ${dataSufficiency === 'sufficient' ? 'данных достаточно' : 'данных немного — дополни знаниями о рынке'}
${secondaryArchetypeHuman ? `- Вторичная модель монетизации (растущий тренд): ${secondaryArchetypeHuman}` : ''}
${trialInsight ? `- Сигнал по trial/freemium: ${trialInsight}` : ''}

ДЕТАЛЬНОЕ СРАВНЕНИЕ КОНКУРЕНТОВ (используй в анализе — называй конкретные имена):
${competitorDetails || 'данных о конкурентах нет'}
${fastestGrowingInsight ? `\nКЛЮЧЕВОЙ СИГНАЛ: ${fastestGrowingInsight}` : ''}
${marketDirectionSignal ? `\nНАПРАВЛЕНИЕ РЫНКА: ${marketDirectionSignal}` : ''}

Риски монетизации: ${monetizationRisks.join('; ') || 'не выявлены'}

${dataSufficiency === 'limited' ? `ВАЖНО: Данных о ценах немного. Дополни анализ знаниями о типичной монетизации "${niche}". Формулируй как конкретный анализ этой ниши.` : ''}

${secondaryArchetypeHuman ? `ВАЖНО: рынок показывает признаки перехода к ${secondaryArchetypeHuman}. Упомяни это в main_insight как стратегическую возможность: входить с этой моделью сейчас значит быть готовым к тому куда рынок движется.` : ''}
${noFreeEntrySignal ? `ВАЖНО: ни один конкурент не предлагает trial/freemium. Обязательно укажи это как ключевую возможность для дифференциации.` : ''}

Ответь на три вопроса предпринимателя:
1. Какая модель монетизации работает в этой нише?
2. Насколько легко продать — какой путь к деньгам?
3. Кто из конкурентов растёт быстрее и почему — что это говорит о рынке?

Напиши анализ в формате JSON:

{
  "headline": "одно предложение-диагноз про монетизацию (максимум 12 слов)",
  "main_insight": "2-3 предложения. Какая модель победила. Назови КОНКРЕТНОГО конкурента который растёт быстрее всех и его модель. Что это означает для нового игрока.",
  "key_facts": [
    "факт 1: КОНКРЕТНЫЙ растущий конкурент — название + рост% + его модель продаж",
    "факт 2: про лёгкость или сложность первой продажи (trial, онбординг, менеджер)",
    "факт 3: ${secondaryArchetypeHuman ? `про направление рынка — вторичный архетип ${secondaryArchetypeHuman} и что это означает для входа сейчас` : noFreeEntrySignal ? 'про отсутствие trial у всех конкурентов как стратегическую возможность' : 'про главный риск или структурное преимущество для нового игрока'}"
  ],
  "decision_impact": "одно-два предложения: какую модель выбрать для старта и почему — используй данные о том кто растёт быстрее"
}

ПРИМЕРЫ ХОРОШИХ ФАКТОВ (конкретные):
- "Gumloop растёт на +133% со self-service моделью — рынок принимает онлайн-покупку без менеджера"
- "У двух крупных конкурентов есть trial, но оба требуют звонка — барьер средний"
- "Никто из конкурентов не предлагает freemium — вход через бесплатный план создаст дифференциацию"

ПРИМЕРЫ ПЛОХИХ ФАКТОВ (ЗАПРЕЩЕНО):
- "Архетип: SELF_SERVICE_SUBSCRIPTION" — технический код
- "Конкурент растёт" — без имени и цифры
- "friction_score: MEDIUM" — технический код
- "Рынок чувствителен к CAC" — абстрактный риск без конкретики

Верни ТОЛЬКО валидный JSON, без markdown и без пояснений.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const raw = (response.content[0] as any)?.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    if (
      !parsed.headline ||
      !parsed.main_insight ||
      !Array.isArray(parsed.key_facts) ||
      parsed.key_facts.length !== 3 ||
      !parsed.decision_impact
    ) {
      console.error('[Block3 Interpretation] Invalid structure:', parsed);
      return;
    }

    const { error: saveError } = await supabase
      .from('block_interpretations')
      .upsert(
        {
          trend_id: trendId,
          block_id: 'sellability',
          headline: parsed.headline,
          main_insight: parsed.main_insight,
          key_facts: parsed.key_facts,
          decision_impact: parsed.decision_impact,
          model_used: 'claude-sonnet-4-6',
          data_sufficiency: dataSufficiency,
          generated_at: new Date().toISOString(),
        },
        { onConflict: 'trend_id,block_id' },
      );

    if (saveError) {
      console.error('[Block3 Interpretation] Save failed:', saveError);
      return;
    }
    console.log('[Block3 Interpretation] Generated for trend:', trendId);
  } catch (error) {
    console.error('[Block3 Interpretation] Failed:', error);
  }
}

// ─── MAIN ROUTE ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const SERPAPI_KEY = process.env.SERPAPI_KEY;
    if (!SERPAPI_KEY) return NextResponse.json({ error: 'SERPAPI_KEY не настроен' }, { status: 500 });

    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabase = getServerSupabase();
    const { trend_id, niche } = await req.json();
    if (!trend_id || !niche) return NextResponse.json({ error: 'trend_id и niche обязательны' }, { status: 400 });

    console.log(`[Block3v2] Starting for "${niche}"...`);

    // Load upstream data in parallel (Blocks 0, 1, 2, 4)
    const [ctxRes, b1Res, b2Res, b4Res] = await Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/block0/context`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niche }),
      }).then(r => r.ok ? r.json() : null).catch(() => null),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 1).single(),
      supabase.from('block_results').select('block_context, raw_data')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 2).single(),
      supabase.from('block_results').select('block_context')
        .eq('trend_id', trend_id).eq('user_id', user.id).eq('block_number', 4).maybeSingle(),
    ]);

    const ctx = mapContextObject(ctxRes?.context_object);
    const block1 = mapBlock1(b1Res.data?.block_context);
    const block2 = mapBlock2(b2Res.data?.block_context);
    const block4Context = b4Res.data?.block_context ?? null;

    // 3.1 — competitor_trends из Блока 2 (raw_data) для обогащения конкурентов
    const competitorTrends: Array<{ name: string; domain: string; growth: number | null; direction: string }> =
      b2Res.data?.raw_data?.competitor_trends ??
      b2Res.data?.raw_data?.premium?.competitor_trends ??
      [];

    console.log(`[Block3v2] Context: ${ctx.category_type}, B1 paying: ${block1.paying_ratio}, B2 competitors: ${block2.competitors_found.length}, B4: ${block4Context ? 'loaded' : 'null'}`);

    const serpApi = createSerpApiClient(SERPAPI_KEY);
    const haiku = createHaikuClient();
    const isB2B = ctx.category_type === 'B2B';

    // ── STEP 1: LIVENESS
    const directCompetitors = block2.competitors_found
      .filter(c => c.type === 'DIRECT')
      .slice(0, 3);

    const livenessResult = await checkLiveness({
      directCompetitors, serpAdDensity: block2.serp_ad_density,
      payingRatio: block1.paying_ratio, nicheInput: niche,
      serpApi, isB2B,
    });

    // Block 4 enrichment: крупные конкуренты = рынок живой
    const b4CompetitorSize = block4Context?.top_competitor_size;
    if (b4CompetitorSize === 'medium' || b4CompetitorSize === 'large') {
      livenessResult.strengthScore = Math.min(livenessResult.strengthScore + 0.2, 1.0);
      livenessResult.signals.push('block4_large_competitor');
      // Recalculate level
      livenessResult.level = livenessResult.strengthScore >= 0.7 ? 'STRONG'
        : livenessResult.strengthScore >= 0.4 ? 'PRESENT'
        : livenessResult.strengthScore >= 0.15 ? 'WEAK' : 'NONE';
    }

    console.log(`[Block3v2] Liveness: ${livenessResult.level} (${livenessResult.strengthScore})`);

    if (livenessResult.level === 'NONE' && block2.demand_strength_score < 0.4) {
      const noneResult = buildNoneOutput(livenessResult);
      await saveResult(supabase, trend_id, user.id, noneResult);
      return NextResponse.json({ success: true, public: noneResult });
    }

    // ── STEP 2: PRICING DATA
    const pricingData = await collectPricingData(directCompetitors, serpApi, haiku, ctx.category_type);

    // Block 4 enrichment: добавить ценовые данные от конкурентов из Блока 4
    if (block4Context?.competitors?.length > 0 || block4Context?.top_competitor_size) {
      const existingDomains = new Set(pricingData.map(p => p.domain));
      const b4Competitors = block4Context.competitors || [];
      for (const comp of b4Competitors) {
        const domain = comp.domain || '';
        if (domain && !existingDomains.has(domain) && comp.pricing_median) {
          pricingData.push({
            competitorName: comp.name || domain,
            domain,
            hasPricingPage: true,
            hasFreemium: comp.has_freemium ?? false,
            hasTrial: comp.has_trial ?? false,
            trialDays: null,
            requiresSales: comp.requires_sales ?? false,
            hasSelfServiceCheckout: !comp.requires_sales,
            hasPublicPrices: true,
            hasEnterpriseplan: comp.has_enterprise ?? false,
            hasValueBasedLimits: false,
            hasUpgradePath: comp.has_freemium ?? false,
            entryPriceUsd: comp.pricing_median ?? null,
            billingPeriod: 'monthly',
            detectedArchetype: 'UNKNOWN' as const,
            rawText: `Block 4 data: ${comp.name}`,
          });
          existingDomains.add(domain);
        }
      }
    }

    console.log(`[Block3v2] Pricing: ${pricingData.filter(p => p.hasPricingPage).length}/${directCompetitors.length} pages found (incl. Block 4 enrichment)`);

    // ── STEP 3-5: SIGNALS → CANDIDATES → ARBITRATION
    const binarySignals = extractBinarySignals(pricingData);
    const candidates = preClassify(binarySignals, ctx, block1);
    const archetypeResult = await arbitrateArchetype(candidates, binarySignals, ctx, haiku);

    // ── STEP 6-11: FRICTION → CONSISTENCY → QUALITY → CONFIDENCE → VERDICT → RISKS
    const frictionScore = calculateFrictionScore(binarySignals, ctx, isB2B);
    const consistency = checkConsistency({
      monetizationArchetype: archetypeResult.primary,
      payingRatio: block1.paying_ratio,
      commercialIntent: block2.commercial_intent_ratio,
      livenessLevel: livenessResult.level,
    });
    const quality = determineQuality({
      archetype: archetypeResult.primary, binarySignals,
      payingRatio: block1.paying_ratio, falsePositiveMarket: consistency.falsePositiveMarket,
    });
    const rawConfidence = calculateMonetizationConfidence({
      competitorsAnalyzed: directCompetitors.length,
      hasPricingPagesRatio: pricingData.filter(p => p.hasPricingPage).length / Math.max(directCompetitors.length, 1),
      livenessLevel: livenessResult.level,
      dataSufficiency: block2.data_sufficiency,
      consistencyScore: consistency.consistencyScore,
    });
    const monetizationConfidence = Math.max(rawConfidence, 0.25);

    const { verdict, unclearReason } = determineVerdict({
      livenessLevel: livenessResult.level, archetypeResult, monetizationConfidence,
      consistency, demandStrength: block2.demand_strength_score, payingRatio: block1.paying_ratio,
    });

    const monetizationRisks = generateRisks({
      quality, archetype: archetypeResult.primary, binarySignals, consistency,
      frictionScore, isB2B, pricingData, marketStage: block2.market_stage,
    });

    const pricingProfile = extractPricingProfile(pricingData, archetypeResult.primary);

    const result: Block3Output = {
      monetization_verdict: verdict,
      ...(unclearReason && { unclear_reason: unclearReason }),
      monetization_confidence: monetizationConfidence,
      monetization_archetype: archetypeResult.primary,
      monetization_archetype_secondary: archetypeResult.secondary,
      price_tier: pricingProfile.tier,
      entry_price_usd: pricingProfile.entryPrice,
      billing_model: pricingProfile.billingModel,
      scalability_multiplier: getScalabilityMultiplier(quality),
      friction_score: frictionScore,
      has_freemium: binarySignals.hasFreemium,
      has_free_trial: binarySignals.hasFreeTrial,
      requires_sales_contact: binarySignals.hasContactSales,
      competitor_monetization: pricingData.map(p => ({
        name: p.competitorName, archetype: p.detectedArchetype,
        price_usd: p.entryPriceUsd, has_freemium: p.hasFreemium,
        has_trial: p.hasTrial, requires_sales: p.requiresSales,
      })),
      monetization_risks: monetizationRisks,
      monetization_quality: quality,
      false_positive_market: consistency.falsePositiveMarket,
      liveness_signal_strength: livenessResult.strengthScore,
      monetization_diagnosis: buildDiagnosis(verdict, archetypeResult.primary, quality, frictionScore),
    };

    // 3.1 — Обогащаем competitor_monetization данными о росте из Блока 2
    const enrichedCompetitorMonetization = result.competitor_monetization.map((comp) => {
      const trend = competitorTrends.find(
        (t) =>
          t.name?.toLowerCase() === comp.name?.toLowerCase() ||
          (t.domain && comp.name && t.domain.toLowerCase().includes(comp.name.toLowerCase())),
      );
      return {
        ...comp,
        growth_pct: trend?.growth ?? null,
        growth_direction: trend?.direction ?? 'unknown',
      };
    });
    // Заменяем оригинальный массив обогащённым — попадёт и в raw_data и в block_context
    (result as any).enriched_competitor_monetization = enrichedCompetitorMonetization;

    console.log(`[Block3v2] Result: ${verdict} / ${archetypeResult.primary} / ${quality} / confidence=${monetizationConfidence.toFixed(2)}`);

    const diagnosis = result.monetization_verdict === 'CLEAR' ? 'green'
      : result.monetization_verdict === 'PARTIAL' ? 'yellow' : 'red';

    // Информативный score: варьируется внутри диагноза
    const score = (() => {
      let s = diagnosis === 'green' ? 7 : diagnosis === 'yellow' ? 4 : 2;
      if (frictionScore === 'LOW') s += 1;
      if (result.has_free_trial) s += 0.5;
      if (result.has_freemium) s += 0.5;
      if (quality === 'SCALABLE') s += 1;
      if ((result.scalability_multiplier ?? 1) >= 3) s += 0.5;
      if (!result.requires_sales_contact) s += 0.5;
      if (frictionScore === 'HIGH') s -= 1.5;
      if (consistency.falsePositiveMarket) s -= 2;
      if (result.monetization_verdict === 'PARTIAL' && monetizationConfidence < 0.5) s -= 1;
      return Math.max(1, Math.min(10, Math.round(s)));
    })();

    await saveResult(supabase, trend_id, user.id, result, score);

    // ── Interpretation Layer (фоновая генерация, не блокирует ответ) ──
    generateSellabilityInterpretation(
      trend_id,
      niche,
      diagnosis,
      result as unknown as Record<string, any>,
      supabase,
      claude,
      true,
    ).catch((err) =>
      console.error('[Block3 Interpretation] Background error:', err),
    );

    return NextResponse.json({ success: true, public: { ...result, score, diagnosis, pain_type: block1.pain_type }, has_premium: true });
  } catch (error: any) {
    console.error('[Block3v2] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function saveResult(supabase: any, trendId: string, userId: string, result: Block3Output, computedScore?: number) {
  const { error } = await supabase.from('block_results').upsert({
    trend_id: trendId,
    user_id: userId,
    block_number: 3,
    block_type: 'sellability_v2',
    diagnosis: result.monetization_verdict === 'CLEAR' ? 'green'
      : result.monetization_verdict === 'PARTIAL' ? 'yellow' : 'red',
    score: computedScore ?? verdictToScore(result.monetization_verdict),
    conflict_weight: result.monetization_verdict === 'NONE' ? 3
      : result.monetization_verdict === 'UNCLEAR' ? 2 : 1,
    key_factors: [
      `Архетип: ${result.monetization_archetype}`,
      `Качество: ${result.monetization_quality}`,
      `Трение: ${result.friction_score}`,
      `Confidence: ${Math.round(result.monetization_confidence * 100)}%`,
    ],
    key_metric: result.monetization_diagnosis,
    block_context: {
      monetization_verdict: result.monetization_verdict,
      monetization_confidence: result.monetization_confidence,
      monetization_archetype: result.monetization_archetype,
      price_tier: result.price_tier,
      entry_price_usd: result.entry_price_usd,
      billing_model: result.billing_model,
      scalability_multiplier: result.scalability_multiplier,
      friction_score: result.friction_score,
      has_freemium: result.has_freemium,
      has_free_trial: result.has_free_trial,
      requires_sales_contact: result.requires_sales_contact,
      monetization_quality: result.monetization_quality,
      false_positive_market: result.false_positive_market,
      liveness_signal_strength: result.liveness_signal_strength,
      competitor_monetization: result.competitor_monetization,
      // 3.1 — обогащённые данные конкурентов (с growth_pct из Блока 2)
      enriched_competitor_monetization: (result as any).enriched_competitor_monetization ?? null,
    },
    raw_data: result,
    intelligence_output: null,
    intelligence_updated_at: null,
  }, { onConflict: 'trend_id,user_id,block_number' });

  if (error) console.error('[Block3v2] Supabase error:', error.message);
}
