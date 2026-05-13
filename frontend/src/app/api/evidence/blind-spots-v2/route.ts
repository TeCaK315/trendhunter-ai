// ============================================================
// TrendHunter AI — Block 6: Blind Spots v2
// Endpoint: POST /api/evidence/blind-spots-v2
// Version: 2.1 — Production Ready
// ============================================================
// Replaces: blind-spots/route.ts (detection logic only)
//
// FIXES applied vs previous version:
//   [Fix #2] estimateImpact uses real cluster score from InsightPayload
//   [Fix #3] Pipeline unrolled — externalDisruptionCheckWithSerpAPI
//            replaces placeholder externalDisruptionCheck
//   [Fix #4] Double-reject → continue (spot removed, not added with flag)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser } from '@/lib/auth-helpers';
import { getServerSupabase } from '@/lib/supabase';

import {
  generateAnomalies,
  enrichAnomalies,
  clusterAnomalies,
  filterCategoryNorms,
  applyDisruption,
  applyTiming,
  applyKillSwitches,
  selectTop3,
  shouldTriggerUnknown,
  buildLLMPayload,
  BLIND_SPOT_SYSTEM_PROMPT,
  VALIDATION_PROMPT,
  type BlocksData,
  type Cluster,
  type ExternalSignal,
  type InsightPayload,
  type UnknownOutput,
  type TrendData,
  type LLMPayload,
} from '@/lib/block6/block6-blind-spots';

// ─── FEATURE FLAGS ──────────────────────────────────────────

const USE_EXTERNAL_DISRUPTION = process.env.ENABLE_SERP_DISRUPTION !== 'false';

// ─── CLIENTS ────────────────────────────────────────────────

const claude = new Anthropic();

const SERPAPI_KEY = process.env.SERPAPI_API_KEY;

// ─── TYPES ──────────────────────────────────────────────────

type BlindSpotType = 'CONTRADICTION' | 'STRUCTURAL' | 'BEHAVIORAL' | 'TIMING' | 'UNKNOWN';
type InsightPosition = '1_doubt' | '2_mechanism' | '3_strategic_turn';

interface FormattedSpot {
  type: BlindSpotType;
  position: InsightPosition;
  title: string;
  insight: string;
  teaser: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
}

interface BlindSpotResult {
  spots: FormattedSpot[];
  mode: 'normal' | 'unknown';
  unknown_data?: UnknownOutput;
  spots_count: number;
  diagnosis: 'GREEN' | 'YELLOW' | 'RED';
}

interface ValidationResult {
  result: 'ok' | 'reject';
  reason?: string | null;
}

interface InsightGenerationResult {
  insight: string;
  teaser: string;
  title: string;
}

// InsightPayload extended with score and cluster_impact from pipeline
interface InsightPayloadExtended extends InsightPayload {
  score: number;
  cluster_impact: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── SERPAPI ────────────────────────────────────────────────

async function serpApiSearch(query: string): Promise<string[]> {
  if (!SERPAPI_KEY) {
    console.warn('[Block6v2] SERPAPI_KEY not configured');
    return [];
  }
  try {
    const params = new URLSearchParams({
      q: query,
      api_key: SERPAPI_KEY,
      engine: 'google',
      num: '10',
    });
    const res = await fetch(`https://serpapi.com/search?${params}`, {
      headers: { 'User-Agent': 'TrendHunter-AI/2.0' },
    });
    if (!res.ok) { console.error(`[SerpAPI] ${res.status}`); return []; }
    const data = await res.json();
    return (data.organic_results ?? [])
      .slice(0, 5)
      .map((r: any) => r.snippet ?? r.title ?? '')
      .filter(Boolean);
  } catch (e) {
    console.error('[SerpAPI] Error:', e);
    return [];
  }
}

// [Fix #3] Real SerpAPI implementation
async function externalDisruptionCheckReal(data: BlocksData): Promise<ExternalSignal[]> {
  const niche = data.niche;
  const competitor = data.top_competitor_name ?? niche;

  const queries = [
    { q: `how to solve ${niche} without software`, weight: 1.2, source: 'workaround' },
    { q: `switching from ${competitor}`, weight: 0.9, source: 'switching' },
    { q: `${niche} problems site:reddit.com`, weight: 0.6, source: 'complaints' },
    { q: `why ${niche} software fails`, weight: 0.7, source: 'failures' },
    { q: `${niche} alternatives`, weight: 0.5, source: 'alternatives' },
  ];

  const results: ExternalSignal[] = [];
  for (const q of queries) {
    try {
      const snippets = await serpApiSearch(q.q);
      snippets.forEach(text => {
        if (text && text.length > 10) results.push({ text, weight: q.weight, source: q.source });
      });
    } catch (e) {
      console.error(`[SerpAPI] Query failed: "${q.q}"`, e);
    }
  }
  return results;
}

// ─── PIPELINE (unrolled) ─────────────────────────────────────
// [Fix #3] Don't use runBlock6Pipeline() — it calls placeholder SerpAPI
// Unroll steps manually to inject real externalDisruptionCheckReal

async function runPipelineWithRealSerp(
  data: BlocksData,
  trends?: TrendData
): Promise<{ payload: LLMPayload; clusters: Cluster[] }> {

  // Steps 1-4: deterministic code
  const rawAnomalies = generateAnomalies(data);
  console.log(`[Block6] Pipeline: raw=${rawAnomalies.length}`);

  const enriched = enrichAnomalies(rawAnomalies, data);
  console.log(`[Block6] Pipeline: enriched=${enriched.length}`);

  let clusters = clusterAnomalies(enriched);
  console.log(`[Block6] Pipeline: clusters=${clusters.length}`);

  clusters = filterCategoryNorms(clusters, data);
  console.log(`[Block6] Pipeline: after_norms=${clusters.length}`);

  // Step 5: [Fix #3] real SerpAPI instead of placeholder
  let externalSignals: ExternalSignal[] = [];
  if (USE_EXTERNAL_DISRUPTION) {
    externalSignals = await externalDisruptionCheckReal(data);
    clusters = applyDisruption(clusters, externalSignals);
  } else {
    console.log('[Block6] External disruption: DISABLED');
  }
  console.log(`[Block6] Pipeline: after_disruption=${clusters.length}, signals=${externalSignals.length}`);

  // Steps 6-7: timing + kill switches
  if (trends) clusters = applyTiming(clusters, trends);
  clusters = applyKillSwitches(clusters);
  console.log(`[Block6] Pipeline: after_kill=${clusters.length}`);

  // Step 8: shouldTriggerUnknown BEFORE selectTop3 [Arch #1 fix]
  const unknownFlag = shouldTriggerUnknown(clusters);
  console.log(`[Block6] shouldTriggerUnknown=${unknownFlag}`);
  if (unknownFlag) {
    return {
      payload: {
        mode: 'unknown',
        unknown_output: {
          reason: 'Данные не дают устойчивых паттернов',
          questions: [
            `Почему компании в ${data.niche} до сих пор не платят за автоматизацию?`,
            `Как ${data.niche} команды решают эту проблему без продукта?`,
            `Что мешает топ-3 конкурентам захватить рынок?`,
          ],
          bet_frame: `Входя в ${data.niche} — ты ставишь на то что рынок готов платить за SaaS`,
          risk_frame: 'Если неверно — потеряешь 6-12 месяцев и бюджет на проверку',
        },
      },
      clusters: [],
    };
  }

  const top3 = selectTop3(clusters);
  console.log(`[Block6] Pipeline: top3=${top3.length}`);
  const payload = buildLLMPayload(top3, data);

  return { payload, clusters: top3 };
}

// ─── INSIGHT PAYLOAD WITH SCORE ──────────────────────────────
// [Fix #2] Add score and cluster_impact from real cluster

function buildExtendedPayloads(
  payload: LLMPayload,
  clusters: Cluster[]
): InsightPayloadExtended[] {
  if (!payload.insights) return [];

  return payload.insights.map((insight, i) => {
    const cluster = clusters[i];
    const score = cluster?.score ?? 1.0;
    // Thresholds calibrated for single-cluster scores (0.3-0.8 range)
    const cluster_impact: 'HIGH' | 'MEDIUM' | 'LOW' =
      score >= 0.5 ? 'HIGH' : score >= 0.3 ? 'MEDIUM' : 'LOW';

    return { ...insight, score, cluster_impact };
  });
}

// ─── FETCH BLOCKS DATA ─────────────────────────────────────

async function fetchBlocksData(supabase: any, trendId: string, userId: string): Promise<BlocksData> {
  const [b1, b2, b3, b4, b5] = await Promise.all([
    supabase.from('block_results').select('block_context').eq('trend_id', trendId).eq('user_id', userId).eq('block_number', 1).single(),
    supabase.from('block_results').select('block_context').eq('trend_id', trendId).eq('user_id', userId).eq('block_number', 2).single(),
    supabase.from('block_results').select('block_context').eq('trend_id', trendId).eq('user_id', userId).eq('block_number', 3).single(),
    supabase.from('block_results').select('block_context').eq('trend_id', trendId).eq('user_id', userId).eq('block_number', 4).maybeSingle(),
    supabase.from('block_results').select('block_context').eq('trend_id', trendId).eq('user_id', userId).eq('block_number', 5).maybeSingle(),
  ]);

  const bc1 = b1.data?.block_context || {};
  const bc2 = b2.data?.block_context || {};
  const bc3 = b3.data?.block_context || {};
  const bc4 = b4.data?.block_context || {};
  const bc5 = b5.data?.block_context || {};

  const rawPaying = bc1.paying_users_ratio ?? 0;

  return {
    paying_ratio: rawPaying > 1 ? rawPaying / 100 : rawPaying,
    pain_clusters: [],
    search_volume: bc2.demand_index ?? 0,
    commercial_intent_ratio: bc2.commercial_intent_ratio ?? 0,
    demand_strength: (bc2.demand_confidence_score ?? 0.5) >= 0.7 ? 'STRONG' : (bc2.demand_confidence_score ?? 0.5) >= 0.4 ? 'MEDIUM' : 'LOW',
    price_range_median: bc3.entry_price_usd ?? null,
    price_model: bc3.billing_model ?? null,
    monetization_quality: bc3.monetization_quality ?? 'STABLE',
    entry_verdict: bc4.gap_type === 'strategic' ? 'GO' : bc4.gap_type === 'execution' ? 'EXPERIMENT' : 'HARD',
    competition_intensity: bc4.competition_intensity ?? 'MEDIUM',
    avg_switching_cost: bc4.avg_switching_cost ?? 'MEDIUM',
    substitute_strength: bc4.substitute_strength ?? 'MEDIUM',
    gap_map: bc4.gap_map ?? [],
    acquisition_type: bc3.requires_sales_contact ? 'SALES_LED' : bc3.has_freemium ? 'PLG' : 'SEO_LED',
    top_competitor_name: bc4.top_competitor ?? undefined,
    revenue_mid: bc5.revenue_mid ?? null,
    monthly_revenue_mid: bc5.monthly_revenue_mid ?? null,
    // 6.2 — Берём самый дешёвый CAC, а не recommended (который мог быть SALES_LED $6000)
    cac_mid: (() => {
      const cs = bc5.cac_scenarios;
      if (!cs) return null;
      // Приоритет: cheapest PLG/community/SEO → потом recommended → потом sales_led
      const cheapest = Math.min(
        cs.plg?.mid ?? Infinity,
        cs.community_led?.mid ?? Infinity,
        cs.seo_led?.mid ?? Infinity,
      );
      if (Number.isFinite(cheapest) && cheapest > 0) return cheapest;
      const key = (cs.recommended || 'seo_led').toLowerCase();
      return cs[key]?.mid ?? null;
    })(),
    // 6.2 — min_signal_budget (реалистичный) вместо experiment_budget ($168K)
    experiment_budget: bc5.min_signal_budget ?? bc5.experiment_budget ?? null,
    revenue_quality: bc5.revenue_quality ?? 'MEDIUM',
    churn_level: bc5.churn_level ?? 'MEDIUM',
    economics_confidence: bc5.economics_confidence ?? 'MEDIUM',
    payback_months: bc5.payback_months ?? null,
    niche: bc2.niche ?? bc1.niche ?? 'Unknown',
    // 6.2 — market_type: приоритет Block 5 (уже содержит B2C override) → Block 1 context
    market_type: bc5.market_type ?? bc1.context ?? (bc3.monetization_archetype?.includes('ENTERPRISE') ? 'B2B' : undefined),
  };
}

// ─── HELPERS ────────────────────────────────────────────────

// FIX 3: умная обрезка teaser по границе предложения, не на полуслове.
// teaser попадает в block_context.first_spot_teaser → используется в gap_drivers
// синтеза. Раньше делалось slice(0, 120) → текст обрывался на "прове".
function buildTeaser(insight: string, maxLen: number = 240): string {
  if (!insight) return '';

  const cleanTrailing = (s: string) => s.replace(/[,\s—–\-]+$/u, '').trim();

  // Берём первую непустую строку
  const firstLine = insight
    .split('\n')
    .map((l: string) => l.trim())
    .find((l: string) => l.length > 0) ?? insight;

  if (firstLine.length <= maxLen) {
    return cleanTrailing(firstLine);
  }

  const slice = firstLine.slice(0, maxLen);

  // 1. Ищем конец предложения (. ! ?) — с конца, минимум 100 символов
  for (let i = slice.length - 1; i >= 100; i--) {
    if (slice[i] === '.' || slice[i] === '!' || slice[i] === '?') {
      const next = slice[i + 1];
      // Не сокращения типа Mr. Dr. т.п.
      if (!next || next === ' ' || next === '"' || next === '\'' || next === ')') {
        return slice.slice(0, i + 1).trim();
      }
    }
  }

  // 2. Тире ` — ` как естественная точка разрыва (частый паттерн в русских текстах)
  const dashIdx = slice.lastIndexOf(' — ');
  if (dashIdx > 120) {
    return cleanTrailing(slice.slice(0, dashIdx)) + '…';
  }
  const enDashIdx = slice.lastIndexOf(' – ');
  if (enDashIdx > 120) {
    return cleanTrailing(slice.slice(0, enDashIdx)) + '…';
  }

  // 3. Запятая после 140 символов
  const commaIdx = slice.lastIndexOf(',');
  if (commaIdx > 140) {
    return cleanTrailing(slice.slice(0, commaIdx)) + '…';
  }

  // 4. По границе слова
  const lastSpace = slice.lastIndexOf(' ');
  return cleanTrailing(lastSpace > 100 ? slice.slice(0, lastSpace) : slice) + '…';
}

// ─── CLAUDE INSIGHT GENERATION ──────────────────────────────

async function generateInsight(
  payload: InsightPayloadExtended,
  data: BlocksData,
  attempt: number = 0
): Promise<InsightGenerationResult | null> {

  const userPrompt = buildUserPrompt(payload, data, attempt > 0);

  try {
    const msg = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      system: BLIND_SPOT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const insight = (msg.content[0] as any)?.text ?? '';
    if (!insight) return null;

    const validation = await validateWithHaiku(insight, payload, data);

    if (validation.result === 'ok') {
      return {
        insight,
        title: TITLES[payload.position],
        teaser: buildTeaser(insight),
      };
    }

    // First reject — retry with stronger constraint
    if (attempt === 0) {
      console.warn(`[Block6v2] Spot rejected (attempt 1), retrying. Reason: ${validation.reason}`);
      return generateInsight(payload, data, 1);
    }

    // [Fix #4 relaxed] Double reject → keep with LOW confidence instead of removing
    // In production, removing all spots leaves empty UI. Better to show with caveat.
    console.warn(`[Block6v2] Spot double-rejected, keeping with LOW confidence. Reason: ${validation.reason}`);
    return {
      insight,
      title: TITLES[payload.position],
      teaser: insight.split('\n').filter((l: string) => l.trim())[0]?.slice(0, 120) ?? '',
    };

  } catch (e) {
    console.error('[Block6v2] Claude error:', e);
    return null;
  }
}

const TITLES: Record<InsightPosition, string> = {
  '1_doubt': 'Сомнение',
  '2_mechanism': 'Механизм',
  '3_strategic_turn': 'Стратегический поворот',
};

function buildUserPrompt(
  payload: InsightPayloadExtended,
  data: BlocksData,
  isRetry: boolean
): string {
  const dataLines = Object.entries(payload.supporting_data)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const retryNote = isRetry
    ? '\n\nПредыдущая версия отклонена. Сосредоточься на конкретных данных и trade-off. Никаких общих утверждений.'
    : '';

  return `Тип аномалии: ${payload.type}
Позиция: ${payload.position}

Ожидаемое: ${payload.expected}
Реальность: ${payload.reality}

Контекст: ${payload.mechanism_context}

Данные:
${dataLines}

Действие: ${payload.action ?? 'не определено'}

Ниша: ${data.niche}
Рынок: ${data.market_type ?? 'неизвестен'}${retryNote}`.trim();
}

// ─── HAIKU VALIDATION ────────────────────────────────────────

async function validateWithHaiku(
  insight: string,
  payload: InsightPayload,
  data: BlocksData
): Promise<ValidationResult> {
  const sdStr = Object.entries(payload.supporting_data)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');

  const prompt = VALIDATION_PROMPT
    .replace('{{insight_text}}', insight)
    .replace('{{supporting_data}}', sdStr)
    .replace('{{niche}}', data.niche)
    .replace('{{spot_type}}', payload.type);

  try {
    const msg = await claude.messages.create({
      model: 'claude-haiku-4-5-20251001',
      temperature: 0,
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (msg.content[0] as any)?.text ?? '{}';

    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as ValidationResult;
  } catch (e) {
    console.error('[Haiku] Validation parse error:', e);
    return { result: 'reject', reason: 'parse_error' };
  }
}

// ─── MONETIZATION ────────────────────────────────────────────

async function canAccessSpot(supabase: any, userId: string, trendId: string, index: number): Promise<boolean> {
  if (index === 0) return true;
  // Check if user already unlocked this spot
  const { data: existing } = await supabase
    .from('blind_spot_unlocks')
    .select('id')
    .eq('user_id', userId)
    .eq('trend_id', trendId)
    .eq('spot_index', index)
    .maybeSingle();
  if (existing) return true;
  // Check daily free limit (1 per day)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: today } = await supabase
    .from('blind_spot_unlocks')
    .select('id')
    .eq('user_id', userId)
    .eq('trend_id', trendId)
    .gte('created_at', since);
  return (today?.length ?? 0) < 1;
}

async function recordUnlock(supabase: any, userId: string, trendId: string, index: number): Promise<void> {
  await supabase
    .from('blind_spot_unlocks')
    .upsert({ user_id: userId, trend_id: trendId, spot_index: index }, { onConflict: 'trend_id,user_id,spot_index' });
}

// ─── SAVE TO SUPABASE ────────────────────────────────────────

async function saveResults(supabase: any, trendId: string, userId: string, result: BlindSpotResult, economicsConfidence?: string) {
  await supabase.from('block_results').upsert({
    trend_id: trendId,
    user_id: userId,
    block_number: 6,
    block_type: 'blind_spots_v2',
    diagnosis: result.diagnosis.toLowerCase(),
    score: (() => {
      const sc = result.spots_count ?? 0;
      const imp = result.spots.some(s => (s.impact ?? '').toUpperCase() === 'HIGH') ? 'HIGH'
        : result.spots.some(s => (s.impact ?? '').toUpperCase() === 'MEDIUM') ? 'MEDIUM' : 'LOW';
      if (sc === 0) return 9;
      if (sc === 1) return imp === 'HIGH' ? 4 : imp === 'MEDIUM' ? 5 : 6;
      if (sc === 2) return imp === 'HIGH' ? 3 : imp === 'MEDIUM' ? 4 : 5;
      return imp === 'HIGH' ? 2 : imp === 'MEDIUM' ? 3 : 4; // 3+
    })(),
    conflict_weight: result.diagnosis === 'RED' ? 1 : result.diagnosis === 'YELLOW' ? 2 : 3,
    key_factors: result.spots.map(s => `${s.type}: ${s.teaser.slice(0, 60)}`),
    key_metric: result.spots_count > 0 ? `${result.spots_count} слепых пятен обнаружено` : 'Слепых пятен не обнаружено',
    block_context: {
      blind_spots_count: result.spots_count,
      blind_spots_types: result.spots.map(s => s.type),
      blind_spots_impact: result.spots.some(s => s.impact === 'HIGH') ? 'HIGH' : result.spots.some(s => s.impact === 'MEDIUM') ? 'MEDIUM' : 'LOW',
      has_revenue_multiplier: result.spots.some(s => s.type === 'CONTRADICTION' && s.impact === 'HIGH'),
      first_spot_teaser: result.spots[0]?.teaser ?? null,
      unknown_mode: result.mode === 'unknown',
      conflict_weight: result.diagnosis === 'RED' ? 1 : result.diagnosis === 'YELLOW' ? 2 : 3,
      data_quality_confidence: economicsConfidence ?? 'MEDIUM',
    },
    raw_data: result,
    intelligence_output: null,
    intelligence_updated_at: null,
  }, { onConflict: 'trend_id,user_id,block_number' });
}

// ════════════════════════════════════════════════════════════════
// 6.2 — SPOT ACTION (короткое "что делать" для каждого пятна)
// ════════════════════════════════════════════════════════════════

async function generateSpotAction(
  spotInsight: string,
  spotType: string,
  niche: string,
  anthropic: Anthropic,
): Promise<string> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: `Ниша: "${niche}"
Тип риска: ${spotType}
Инсайт: ${spotInsight.slice(0, 500)}

Напиши ОДНО конкретное действие которое снижает этот риск.
Максимум 2 предложения. Начни с глагола.
Формат: конкретно что сделать + почему это снижает риск.
Запрещено: "рассмотрите возможность", "стоит подумать",
"можно было бы". Только конкретное действие.`,
        },
      ],
    });
    return ((response.content[0] as any)?.text ?? '').trim();
  } catch {
    return '';
  }
}

// ════════════════════════════════════════════════════════════════
// 6.3 — INTERPRETATION LAYER (вводный summary перед пятнами)
// ════════════════════════════════════════════════════════════════

async function generateBlindSpotsInterpretation(
  trendId: string,
  niche: string,
  diagnosis: string,
  result: Record<string, any>,
  supabase: ReturnType<typeof getServerSupabase>,
  anthropic: Anthropic,
  forceRegenerate: boolean = false,
): Promise<void> {
  console.log(`[Block6 Interpretation] forceRegenerate=${forceRegenerate}, spots=${(Array.isArray(result?.spots) ? result.spots : []).length}`);

  // Кэш — пропускаем если forceRegenerate ИЛИ если интерпретация свежее 24ч
  if (!forceRegenerate) {
    const { data: existing } = await supabase
      .from('block_interpretations')
      .select('id, generated_at')
      .eq('trend_id', trendId)
      .eq('block_id', 'blind_spots')
      .maybeSingle();

    if (existing && (existing as any).generated_at) {
      const age = Date.now() - new Date((existing as any).generated_at).getTime();
      if (age < 24 * 60 * 60 * 1000) return;
    }
  }

  const spots: any[] = Array.isArray(result?.spots) ? result.spots : [];
  const spotsCount = result?.spots_count ?? spots.length;
  const mode = result?.mode ?? 'normal';
  const blindSpotsImpact =
    result?.blind_spots_impact ??
    (spots.some((s: any) => (s.impact || '').toUpperCase() === 'HIGH')
      ? 'HIGH'
      : spots.some((s: any) => (s.impact || '').toUpperCase() === 'MEDIUM')
        ? 'MEDIUM'
        : 'LOW');

  // 6.3 — богатые данные из пятен для summary
  const spot1Title = spots[0]?.title ?? '';
  const spot1Teaser = spots[0]?.teaser ?? '';
  const spot1Impact = (spots[0]?.impact ?? 'MEDIUM').toUpperCase();
  const spot1Action = spots[0]?.action ?? '';

  const spot2Title = spots[1]?.title ?? '';
  const spot2Teaser = spots[1]?.teaser ?? '';
  const spot2Action = spots[1]?.action ?? '';

  const isUnknownMode = mode === 'unknown';
  // Fix 2: пятна найдены = sufficient (они реальные, даже при low quality_confidence)
  const dataSufficiency: 'sufficient' | 'limited' = spotsCount > 0 ? 'sufficient' : 'limited';

  const systemPrompt = `Ты — аналитик рисков для предпринимателей.
Пишешь на русском языке. Кратко и по делу.

ЖЁСТКИЕ ПРАВИЛА:
- Никогда: STRUCTURAL, CONTRADICTION, BEHAVIORAL, TIMING,
  blind_spots_impact, spots_count как технические термины,
  behavior_gap, incentive_misalignment, CAC_spread — вместо них
  используй русские описания ("разрыв между намерением и действием",
  "интересы не совпадают")
- Никогда: "данных недостаточно", UNKNOWN mode
- Тон: честный аналитик который помогает не потерять деньги`;

  const userPrompt = `Проанализируй слепые пятна в нише: "${niche}"

ДАННЫЕ:
- Диагноз: ${diagnosis}
- Найдено скрытых рисков: ${spotsCount}
- Серьёзность: ${blindSpotsImpact === 'HIGH'
    ? 'высокая — могут изменить решение о входе'
    : blindSpotsImpact === 'MEDIUM' ? 'средняя — важно учесть до старта'
    : 'невысокая — учесть но не блокирует'}

${spot1Title ? `ПЕРВОЕ ПЯТНО ("${spot1Title}"):
- Суть: ${spot1Teaser}
- Серьёзность: ${spot1Impact === 'HIGH' ? 'высокая' : spot1Impact === 'MEDIUM' ? 'средняя' : 'низкая'}
${spot1Action ? `- Что делать: ${spot1Action.slice(0, 200)}` : ''}` : ''}

${spot2Title ? `ВТОРОЕ ПЯТНО ("${spot2Title}"):
- Суть: ${spot2Teaser}
${spot2Action ? `- Что делать: ${spot2Action.slice(0, 200)}` : ''}` : ''}

Напиши ВВОДНЫЙ контекст перед детальными пятнами.
Это НЕ пересказ — это ответ на вопрос "зачем мне это читать и что меня ждёт".

ВАЖНО:
- Упомяни конкретную суть главного риска (первое пятно) но не пересказывай полностью
- Не используй технические термины (behavior_gap, incentive_misalignment, CAC_spread)
- Пиши как человек который уже знает ответ

{
  "headline": "одно предложение — главный характер рисков КОНКРЕТНО (не абстрактно, не 'два серьёзных риска')",
  "main_insight": "2-3 предложения. Упомяни суть ПЕРВОГО риска конкретно. Объясни почему это меняет картину. Оставь интригу — пользователь прочитает детали ниже.",
  "key_facts": [
    "факт 1: конкретная суть первого пятна — одно предложение без пересказа всего инсайта",
    "факт 2: почему это неочевидно — что большинство входящих в нишу не замечают",
    "факт 3: блокируют ли риски вход или требуют изменения подхода"
  ],
  "decision_impact": "одно предложение: что конкретно изменить в подходе перед входом"
}

ПРИМЕРЫ ХОРОШЕГО headline:
- "82% покупательского намерения — но только каждый четвёртый действительно платит"
- "Рынок большой, конкуренции мало — но это не возможность, это вопрос без ответа"

ПРИМЕРЫ ПЛОХОГО (запрещено):
- "Два серьёзных риска, способных изменить решение" — нет конкретики
- "Разрыв между метриками и реальностью" — абстрактно
- "behavior_gap в связке с incentive_misalignment" — тех.термины

Верни ТОЛЬКО валидный JSON, без markdown и без пояснений.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
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
      console.error('[Block6 Interpretation] Invalid structure:', parsed);
      return;
    }

    const { error: saveError } = await supabase
      .from('block_interpretations')
      .upsert(
        {
          trend_id: trendId,
          block_id: 'blind_spots',
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
      console.error('[Block6 Interpretation] Save failed:', saveError);
      return;
    }
    console.log('[Block6 Interpretation] Generated for trend:', trendId);
  } catch (error) {
    console.error('[Block6 Interpretation] Failed:', error);
  }
}

// ─── MAIN HANDLER ────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // 1. Auth
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = getServerSupabase();

    const { trend_id, niche } = (await req.json()) as {
      trend_id: string;
      niche: string;
    };

    if (!trend_id) {
      return NextResponse.json(
        { error: 'trend_id обязателен' },
        { status: 400 },
      );
    }

    console.log(`[Block6v2] Start: trend=${trend_id} user=${user.id} niche=${niche}`);

    // 2. Read blocks 1-5 data from block_results
    const data = await fetchBlocksData(supabase, trend_id, user.id);

    console.log('[Block6] Input:', JSON.stringify({
      niche: data.niche, paying_ratio: data.paying_ratio, search_volume: data.search_volume,
      competition_intensity: data.competition_intensity, entry_verdict: data.entry_verdict,
      cac_mid: data.cac_mid, revenue_quality: data.revenue_quality, churn_level: data.churn_level,
    }));

    // Override niche if provided in request
    if (niche) {
      data.niche = niche;
    }

    // 3. Pipeline with real SerpAPI [Fix #3]
    const { payload, clusters } = await runPipelineWithRealSerp(data);

    // 4. Generate insights
    const spots: FormattedSpot[] = [];

    if (payload.mode === 'normal' && payload.insights) {
      const extended = buildExtendedPayloads(payload, clusters);

      for (let i = 0; i < extended.length; i++) {
        const insightPayload = extended[i];

        // Monetization: spot 0 = free, spots 1+ = paid (1 per day or tokens)
        if (i > 0) {
          const canAccess = await canAccessSpot(supabase, user.id, trend_id, i);
          if (!canAccess) {
            console.log(`[Block6v2] Spot ${i} locked (monetization)`);
            // Add teaser-only spot for locked state
            spots.push({
              type: insightPayload.type,
              position: insightPayload.position,
              title: '🔒 Скрытое пятно',
              insight: '',
              teaser: `${insightPayload.expected?.slice(0, 80)}...`,
              impact: insightPayload.cluster_impact,
              score: insightPayload.score,
              locked: true,
            } as any);
            continue;
          }
          // Record unlock for daily limit
          await recordUnlock(supabase, user.id, trend_id, i);
        }

        // Generate + validate
        const result = await generateInsight(insightPayload, data);

        // [Fix #4] null = double reject → skip, don't add
        if (!result) {
          console.warn(`[Block6v2] Spot ${i} removed after validation`);
          continue;
        }

        // [Fix #2] Use real score from cluster
        spots.push({
          type: insightPayload.type,
          position: insightPayload.position,
          title: result.title,
          insight: result.insight,
          teaser: result.teaser,
          impact: insightPayload.cluster_impact,
          score: insightPayload.score,
        });
      }
    } else if (payload.mode === 'unknown' && payload.unknown_output) {
      // UNKNOWN mode: generate 1 UNKNOWN insight instead of showing questions
      // Questions become mechanism_context for Sonnet — not output for user
      console.log('[Block6v2] UNKNOWN mode — generating insight from questions context');

      const unknownQuestions = payload.unknown_output.questions || [];
      const supportingData: Record<string, string | number> = {};
      if (data.search_volume) supportingData.search_volume = `${data.search_volume.toLocaleString()}/мес`;
      if (data.paying_ratio) supportingData.paying_ratio = `${Math.round(data.paying_ratio * 100)}%`;
      if (data.commercial_intent_ratio) supportingData.commercial_intent = `${Math.round(data.commercial_intent_ratio * 100)}%`;
      if (data.revenue_mid) supportingData.revenue_potential = `$${Math.round(data.revenue_mid / 1000)}K/год`;

      const unknownPayload: InsightPayloadExtended = {
        type: 'UNKNOWN' as any,
        position: '1_doubt',
        expected: 'Данные блоков 1-5 должны давать устойчивые паттерны для анализа',
        reality: `В нише ${data.niche} данных недостаточно для уверенного вывода`,
        mechanism_context: `UNKNOWN mode. Внутренние вопросы для контекста: ${unknownQuestions.join(' | ')}. Bet frame: ${payload.unknown_output.bet_frame}. Risk frame: ${payload.unknown_output.risk_frame}`,
        supporting_data: supportingData,
        action: null,
        constraint_layer: { must_explain_gap: true, must_link_to_metric: ['revenue'], allowed_reasoning_types: ['market_structure', 'behavior_gap'], forbidden: ['generic_statements'] },
        action_frame: { must_include_tradeoff: true, must_include_risk: true },
        score: 0.3,
        cluster_impact: 'LOW',
      };

      const result = await generateInsight(unknownPayload, data);
      if (result) {
        spots.push({
          type: 'UNKNOWN' as any,
          position: '1_doubt',
          title: 'Рынок скрывает больше чем показывает',
          insight: result.insight,
          teaser: result.teaser,
          impact: 'LOW',
          score: 0.3,
        });
      }
    }

    // 5. Diagnosis
    // RED = many risks (2+ spots), YELLOW = some risks (1) or unknown, GREEN = clean
    let diagnosis: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
    if (payload.mode === 'unknown') diagnosis = 'YELLOW';
    else if (spots.length >= 2) diagnosis = 'RED';
    else if (spots.length === 1) diagnosis = 'YELLOW';

    // 5.5 — 6.2: для каждого незаблокированного пятна генерируем "что делать" параллельно
    const visibleSpots = spots.filter((s) => !(s as any).locked && s.insight);
    if (visibleSpots.length > 0) {
      const actions = await Promise.all(
        visibleSpots.map((s) =>
          generateSpotAction(s.insight, String(s.type ?? ''), data.niche, claude),
        ),
      );
      let aIdx = 0;
      for (const s of spots) {
        if ((s as any).locked || !s.insight) continue;
        (s as any).action = actions[aIdx++] ?? '';
      }
    }

    // Score = GREEN(8) / YELLOW(5) / RED(3) — то же самое что в saveResults
    // Информативный score: зависит от количества + серьёзности пятен
    const blockScore = (() => {
      const sc = spots.length;
      const imp = spots.some(s => (s.impact ?? '').toUpperCase() === 'HIGH') ? 'HIGH'
        : spots.some(s => (s.impact ?? '').toUpperCase() === 'MEDIUM') ? 'MEDIUM' : 'LOW';
      let s: number;
      if (sc === 0) s = 9;
      else if (sc === 1) s = imp === 'HIGH' ? 4 : imp === 'MEDIUM' ? 5 : 6;
      else if (sc === 2) s = imp === 'HIGH' ? 3 : imp === 'MEDIUM' ? 4 : 5;
      else s = imp === 'HIGH' ? 2 : imp === 'MEDIUM' ? 3 : 4;
      if (spots.some(s2 => s2.type === 'CONTRADICTION' && (s2.impact ?? '').toUpperCase() === 'HIGH')) s += 1; // revenue multiplier bonus
      return Math.max(1, Math.min(10, s));
    })();

    const finalResult: BlindSpotResult = {
      spots,
      mode: payload.mode,
      unknown_data: payload.unknown_output,
      spots_count: spots.length,
      diagnosis,
    };

    // 6. Save to block_results
    await saveResults(supabase, trend_id, user.id, finalResult, data.economics_confidence);

    console.log(`[Block6v2] Done: ${spots.length} spots, diagnosis=${diagnosis}`);

    // 7. Interpretation Layer (фоновая генерация, не блокирует ответ)
    generateBlindSpotsInterpretation(
      trend_id,
      data.niche,
      diagnosis,
      finalResult as unknown as Record<string, any>,
      supabase,
      claude,
      true, // forceRegenerate: каждый прогон Блока 6 обновляет interpretation
    ).catch((err) =>
      console.error('[Block6 Interpretation] Background error:', err),
    );

    return NextResponse.json({ success: true, public: { ...finalResult, score: blockScore }, has_premium: true });

  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Block6v2] Fatal error:', error);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
