// app/api/evidence/competition-v2/route.ts
// Block 4 v2 — Competition Analysis Pipeline
// Central Question: "Где конкуренты слепые?"
//
// 12-step pipeline:
// 1. Auth + read Blocks 0-3
// 2. Extract competitors + user pains
// 3. Validate + deduplicate
// 4. Substitute analysis (if applicable)
// 5. Handle "no competitors" case
// 6. Build tasks: Classes 1-5 per competitor
// 7. Execute with p-limit(6) + Promise.allSettled
// 8. Group results + reliability tracking
// 9. Merge with Block 3 prices
// 10. Pain matching
// 11. Class 6 synthesis
// 12. Entry verdict + save to Supabase

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import pLimit from 'p-limit';
import { getAuthUser } from '@/lib/auth-helpers';
import { getServerSupabase } from '@/lib/supabase';

import {
  type Competitor,
  type CompetitorType,
  type CompetitorAnalysis,
  type CompetitorReliability,
  type SubstituteOutput,
  Class1Schema,
  Class2Schema,
  Class3Schema,
  Class4Schema,
  Class5Schema,
  Class6Schema,
  SubstituteSchema,
} from '@/lib/competition/schemas';

import { type UserPain, mapPainsToCompetitor } from '@/lib/competition/pain-matching';

import {
  CLASS1_PROMPT,
  CLASS2_PROMPT,
  CLASS3_PROMPT,
  CLASS4_PROMPT,
  CLASS5_PROMPT,
  CLASS6_PROMPT,
  SUBSTITUTE_PROMPT,
} from '@/lib/competition/prompts';

import {
  calculateEntryVerdict,
  getSchemaDefaults,
  getClassesByType,
  deduplicateCompetitors,
  validateCompetitors,
  calculateReliability,
  mergeWithBlock3Prices,
  buildPrompt,
} from '@/lib/competition/formula';

// ─── Anthropic SDK client ───────────────────────────────────

const claude = new Anthropic();

async function callClaude(
  prompt: string,
  model: 'haiku' | 'sonnet',
  schema: z.ZodType<any>,
): Promise<any> {
  const modelId = model === 'haiku'
    ? 'claude-haiku-4-5-20251001'
    : 'claude-sonnet-4-6';

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await claude.messages.create({
        model: modelId,
        max_tokens: 1000,
        system: 'Respond with valid JSON only, no markdown.',
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      if (!text) throw new Error('Empty response from Claude');

      const clean = text.replace(/```json|```/g, '').trim();
      return schema.parse(JSON.parse(clean));
    } catch (e) {
      console.warn(`[Block4v2] Claude attempt ${attempt + 1} failed (${modelId}):`, e);

      if (attempt < 2) {
        await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
        continue;
      }

      // Финальный fallback — безопасные дефолты
      try {
        const defaults = getSchemaDefaults(schema);
        if (defaults === null || (typeof defaults === 'object' && Object.keys(defaults).length === 0)) {
          throw new Error('No defaults for this schema');
        }
        return schema.parse(defaults);
      } catch {
        throw new Error(`Claude failed after 3 attempts for model ${modelId}`);
      }
    }
  }
}

// ─── Type-safe competitor filter ────────────────────────────

type DirectOrIndirect = Competitor & { type: Exclude<CompetitorType, 'SUBSTITUTE'> };

// ─── POST handler ───────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Step 1: Auth + read Blocks 0-3 ──
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = getServerSupabase();

    const { trend_id, niche } = (await req.json()) as {
      trend_id: string;
      niche: string;
    };

    if (!trend_id || !niche) {
      return NextResponse.json(
        { error: 'trend_id и niche обязательны' },
        { status: 400 },
      );
    }

    // Read blocks 0-3 in parallel
    const [block0Result, block1Result, block2Result, block3Result] = await Promise.all([
      supabase
        .from('block_results')
        .select('*')
        .eq('trend_id', trend_id)
        .eq('user_id', user.id)
        .eq('block_number', 0)
        .single(),
      supabase
        .from('block_results')
        .select('*')
        .eq('trend_id', trend_id)
        .eq('user_id', user.id)
        .eq('block_number', 1)
        .single(),
      supabase
        .from('block_results')
        .select('*')
        .eq('trend_id', trend_id)
        .eq('user_id', user.id)
        .eq('block_number', 2)
        .single(),
      supabase
        .from('block_results')
        .select('*')
        .eq('trend_id', trend_id)
        .eq('user_id', user.id)
        .eq('block_number', 3)
        .single(),
    ]);

    if (block2Result.error || !block2Result.data) {
      return NextResponse.json(
        { error: 'Блок 2 (Спрос) не найден. Запустите анализ Спроса.' },
        { status: 422 },
      );
    }

    const block0Context = block0Result.data?.block_context ?? {};
    const block1Context = block1Result.data?.block_context ?? {};
    const block1RawData = block1Result.data?.raw_data ?? {};
    const block2Context = block2Result.data.block_context ?? {};
    const block3Context = block3Result.data?.block_context ?? {};

    // ── Step 2: Extract competitors + user pains ──

    // Competitors from Block 2
    const rawCompetitors: Competitor[] = (block2Context.competitors_found ?? []).map((c: any) => ({
      name: c.name ?? c.domain?.split('.')[0] ?? 'Unknown',
      domain: c.domain ?? '',
      url: c.url ?? `https://${c.domain ?? ''}`,
      type: (c.type as CompetitorType) ?? 'DIRECT',
      serp_frequency: c.serp_frequency ?? 1,
    }));

    // User pains from Block 1 clusters
    let payingRatio = block1Context.paying_users_ratio ?? 0.5;
    if (payingRatio > 1) payingRatio = payingRatio / 100; // normalize >1 to /100

    const clusters: any[] = block1RawData.clusters ?? block1Context.clusters ?? [];
    const userPains: UserPain[] = clusters.length > 0
      ? clusters.map((cluster: any) => ({
          pain: cluster.pain ?? cluster.label ?? cluster.name ?? 'unknown pain',
          paying_ratio: cluster.paying_ratio ?? payingRatio,
        }))
      : [{ pain: niche, paying_ratio: payingRatio }]; // fallback

    // Block 3 competitor monetization for merge
    const block3CompetitorMonetization: Array<{
      name: string;
      price_usd?: number;
      billing_model?: string;
      has_freemium?: boolean;
      requires_sales?: boolean;
    }> = block3Context.competitor_monetization ?? [];

    // ── Step 3: Validate + deduplicate ──
    const competitors = deduplicateCompetitors(validateCompetitors(rawCompetitors));

    const block3PriceMap = new Map(
      block3CompetitorMonetization.map(m => [m.name.toLowerCase(), m])
    );

    // Separate SUBSTITUTE
    const directIndirect = competitors.filter(
      (c): c is DirectOrIndirect => c.type !== 'SUBSTITUTE'
    );
    const hasSubstitute = competitors.some(c => c.type === 'SUBSTITUTE');
    const directCount = competitors.filter(c => c.type === 'DIRECT').length;

    // ── Step 4: Substitute analysis ──
    let substituteData: SubstituteOutput | null = null;
    if (hasSubstitute) {
      const subPrompt = buildPrompt(SUBSTITUTE_PROMPT, {
        niche_name: niche,
        category_type: block0Context.category_type ?? '',
        user_pains: JSON.stringify(userPains),
      });
      substituteData = await callClaude(subPrompt, 'haiku', SubstituteSchema);
    }

    // ── Step 5: Handle "no competitors" case ──
    if (directIndirect.length === 0) {
      const entryVerdict = calculateEntryVerdict({
        gapMap: userPains.map(() => ({ status: 'unknown' })),
        competitionIntensity: 'LOW',
        avgSwitchingCost: 'LOW',
        directCompetitorCount: 0,
        substituteData,
      });

      const noCompOutput = {
        gap_map: userPains.map(p => ({ pain: p.pain, status: 'unknown' as const, paying_ratio: p.paying_ratio })),
        competition_intensity: 'LOW' as const,
        positioning_map: [],
        entry_verdict: entryVerdict,
        main_opportunity: substituteData
          ? `Заменить ${substituteData.solution_method} для ${userPains[0]?.pain ?? 'основной боли'}`
          : 'Рынок не исследован — требуется ручной анализ',
        open_pain_ratio: 0,
        high_value_gap_count: userPains.filter(p => p.paying_ratio > 0.7).length,
        dominant_player_present: false,
        avg_switching_cost: 'LOW' as const,
        substitute_strength: (substituteData?.coverage_strength ?? 'LOW') as 'LOW' | 'MEDIUM' | 'HIGH',
        positioning_distribution: { LOW_COST: 0, PREMIUM: 0, NICHE: 0, ALL_IN_ONE: 0, BEST_OF_BREED: 0 },
        special_reason: 'no_saas_competitors',
        competitors_detail: [],
        substitute_data: substituteData,
        task_failure_rate: 0,
        task_reliability: 'HIGH' as const,
      };

      const noCompBlockContext = {
        competition_intensity: 'LOW',
        entry_verdict: entryVerdict,
        special_reason: 'no_saas_competitors',
      };

      // Save to Supabase
      await supabase.from('block_results').upsert({
        trend_id,
        user_id: user.id,
        block_number: 4,
        block_type: 'competition_v2',
        diagnosis: entryVerdict === 'GO' ? 'green' : entryVerdict === 'EXPERIMENT' ? 'yellow' : 'red',
        score: entryVerdict === 'GO' ? 8 : entryVerdict === 'EXPERIMENT' ? 5 : 2,
        conflict_weight: 1,
        key_factors: ['Нет SaaS конкурентов'],
        key_metric: 'Нет конкурентов',
        block_context: noCompBlockContext,
        raw_data: noCompOutput,
      }, { onConflict: 'trend_id,user_id,block_number' });

      return NextResponse.json({ success: true, data: noCompOutput });
    }

    // ── Step 6: Build tasks — Classes 1-5 per competitor ──
    const limit = pLimit(6);
    const tasks: Promise<any>[] = [];
    const taskMeta: Array<{ competitorName: string; classNum: number }> = [];

    for (const competitor of directIndirect) {
      const classes = getClassesByType(competitor.type);
      const sourceData = `
        Homepage: ${competitor.url}
        Competitor: ${competitor.name}
        Type: ${competitor.type}
      `.trim();

      for (const cls of classes) {
        const model: 'haiku' | 'sonnet' = cls <= 3 ? 'haiku' : 'sonnet';
        const prompts: Record<number, string> = {
          1: buildPrompt(CLASS1_PROMPT, {
            competitor_name: competitor.name,
            competitor_url: competitor.url,
            market_type: block0Context.category_type ?? '',
            competitor_type: competitor.type,
            source_data: sourceData,
          }),
          2: buildPrompt(CLASS2_PROMPT, {
            competitor_name: competitor.name,
            competitor_type: competitor.type,
            source_data: sourceData,
          }),
          3: buildPrompt(CLASS3_PROMPT, {
            competitor_name: competitor.name,
            market_type: block0Context.category_type ?? '',
            monetization_archetype: block3Context.monetization_archetype ?? '',
            source_data: sourceData,
          }),
          4: buildPrompt(CLASS4_PROMPT, {
            competitor_name: competitor.name,
            competitor_url: competitor.url,
            market_type: block0Context.category_type ?? '',
            competitor_type: competitor.type,
            monetization_archetype: block3Context.monetization_archetype ?? '',
            user_pains: JSON.stringify(userPains),
            source_data: sourceData,
          }),
          5: buildPrompt(CLASS5_PROMPT, {
            competitor_name: competitor.name,
            competitor_url: competitor.url,
            market_type: block0Context.category_type ?? '',
            source_data: sourceData,
            founding_year: 'null',
          }),
        };
        const schemas: Record<number, z.ZodType<any>> = {
          1: Class1Schema,
          2: Class2Schema,
          3: Class3Schema,
          4: Class4Schema,
          5: Class5Schema,
        };

        // Каждый task с собственным timeout через Promise.race
        tasks.push(limit(() =>
          Promise.race([
            callClaude(prompts[cls], model, schemas[cls]),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error(`Task timeout: class${cls} for ${competitor.name}`)), 25_000)
            ),
          ])
        ));
        taskMeta.push({ competitorName: competitor.name, classNum: cls });
      }
    }

    // ── Step 7: Execute with Promise.allSettled ──
    const results = await Promise.allSettled(tasks);

    // Failure monitoring
    const failureStats = {
      total: results.length,
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
      failureRate: results.filter(r => r.status === 'rejected').length / Math.max(results.length, 1),
    };
    if (failureStats.failureRate > 0.3) {
      console.warn(`[Block4v2] HIGH failure rate: ${(failureStats.failureRate * 100).toFixed(0)}% (${failureStats.failed}/${failureStats.total} tasks failed)`);
    }

    // ── Step 8: Group results by competitor ──
    const competitorMap = new Map<string, CompetitorAnalysis & { missingClasses: number[]; reliability: CompetitorReliability }>();
    for (const c of directIndirect) {
      competitorMap.set(c.name, {
        name: c.name,
        type: c.type,
        missingClasses: [],
        reliability: calculateReliability([]),
      } as any);
    }

    results.forEach((result, idx) => {
      const { competitorName, classNum } = taskMeta[idx];
      const analysis = competitorMap.get(competitorName)! as any;
      if (result.status === 'fulfilled') {
        analysis[`p${classNum}`] = result.value;
      } else {
        analysis.missingClasses.push(classNum);
      }
    });

    // ── Step 9: Update reliability + merge with Block 3 prices ──
    for (const [name, analysis] of competitorMap.entries()) {
      const a = analysis as any;
      a.reliability = calculateReliability(a.missingClasses);

      // Мёрж с Block 3 если есть данные
      if (a.p3) {
        const b3Data = block3PriceMap.get(name.toLowerCase());
        if (b3Data) a.p3 = mergeWithBlock3Prices(a.p3, b3Data);
      }
    }

    // ── Step 10: Pain matching ──
    for (const analysis of competitorMap.values()) {
      if (analysis.p4?.pain_point_gaps) {
        analysis.mappedPains = mapPainsToCompetitor(userPains, analysis.p4.pain_point_gaps);
      } else {
        // Класс 4 упал — все боли = UNKNOWN
        analysis.mappedPains = userPains.map(up => ({
          pain: up.pain,
          paying_ratio: up.paying_ratio,
          status: 'UNKNOWN' as const,
        }));
      }
    }

    // ── Step 11: Class 6 synthesis ──
    const competitorsSummary = Array.from(competitorMap.values()).map(a => {
      const anyA = a as any;
      return {
        name: a.name,
        type: a.type,
        p1: a.p1,
        p2: a.p2,
        p3: a.p3,
        p4_mapped: {
          pain_point_gaps: a.mappedPains ?? [],
          structural_weakness: a.p4?.structural_weakness,
          data_quality: anyA.reliability?.overall_confidence ?? 'LOW',
        },
        p5: a.p5,
      };
    });

    const class6Prompt = buildPrompt(CLASS6_PROMPT, {
      competitors_summary: JSON.stringify(competitorsSummary),
      user_pains: JSON.stringify(userPains),
      substitute_data: JSON.stringify(substituteData),
      commercial_intent_ratio: block2Context.commercial_intent_ratio ?? 0.5,
      demand_strength_score: block2Context.demand_confidence_score ?? block2Context.demand_strength_score ?? 0.5,
      market_stage: block2Context.market_stage ?? 'GROWING',
    });

    const class6Result = await callClaude(class6Prompt, 'sonnet', Class6Schema);

    // ── Step 12: Entry verdict + save ──
    const entryVerdict = calculateEntryVerdict({
      gapMap: class6Result.gap_map,
      competitionIntensity: class6Result.competition_intensity,
      avgSwitchingCost: class6Result.avg_switching_cost,
      directCompetitorCount: directCount,
      substituteData,
    });

    // Final output
    const fullOutput = {
      ...class6Result,
      entry_verdict: entryVerdict,
      competitors_detail: Array.from(competitorMap.values()),
      substitute_data: substituteData,
      task_failure_rate: failureStats.failureRate,
      task_reliability: failureStats.failureRate < 0.1 ? 'HIGH' : failureStats.failureRate < 0.25 ? 'MEDIUM' : 'LOW',
    };

    // block_context for downstream blocks
    const blockContext = {
      competition_intensity: class6Result.competition_intensity,
      entry_verdict: entryVerdict,
      avg_switching_cost: class6Result.avg_switching_cost,
      dominant_player_present: class6Result.dominant_player_present,
      open_pain_ratio: class6Result.open_pain_ratio,
      high_value_gap_count: class6Result.high_value_gap_count,
      substitute_strength: class6Result.substitute_strength,
      main_opportunity: class6Result.main_opportunity,
      gap_map: class6Result.gap_map,
      positioning_distribution: class6Result.positioning_distribution,
      task_failure_rate: failureStats.failureRate,
      // Для Narrative Engine
      competitor_summary: Array.from(competitorMap.values())
        .filter(a => a.type === 'DIRECT')
        .map(a => ({
          name: a.name,
          positioning_type: a.p1?.positioning_type ?? 'BEST_OF_BREED',
          core_promise: a.p1?.core_promise ?? null,
          main_weakness: a.p4?.summary?.core_failure ?? null,
        })),
      // Keep from old code for Block 5 compatibility
      gap_type: null,
      top_competitor: null,
      top_competitor_size: null,
      top_competitor_g2_reviews: null,
    };

    // Diagnosis mapping
    const diagnosis = entryVerdict === 'GO' ? 'green' : entryVerdict === 'EXPERIMENT' ? 'yellow' : 'red';
    const score = entryVerdict === 'GO' ? 8 : entryVerdict === 'EXPERIMENT' ? 5 : 2;

    // Save to Supabase
    const { error: dbError } = await supabase.from('block_results').upsert({
      trend_id,
      user_id: user.id,
      block_number: 4,
      block_type: 'competition_v2',
      diagnosis,
      score: Math.max(0, Math.min(10, score)),
      conflict_weight: 3,
      key_factors: [
        `${directCount} прямых конкурентов`,
        `Интенсивность: ${class6Result.competition_intensity}`,
        `Вердикт входа: ${entryVerdict}`,
        `Open pain ratio: ${(class6Result.open_pain_ratio * 100).toFixed(0)}%`,
      ],
      key_metric: `${entryVerdict} (${class6Result.competition_intensity})`,
      block_context: blockContext,
      raw_data: {
        fullOutput,
        premium: {
          gap_map: class6Result.gap_map,
          positioning_map: class6Result.positioning_map,
          entry_verdict: entryVerdict,
          main_opportunity: class6Result.main_opportunity,
          competitors_detail: Array.from(competitorMap.values()),
          substitute_data: substituteData,
        },
      },
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);

    console.log('[Block4v2] Competition analysis complete:', {
      diagnosis,
      entry_verdict: entryVerdict,
      competition_intensity: class6Result.competition_intensity,
      competitors: directIndirect.length,
      open_pain_ratio: class6Result.open_pain_ratio,
      failure_rate: failureStats.failureRate,
    });

    return NextResponse.json({ success: true, data: fullOutput });

  } catch (error: any) {
    console.error('[Block4v2] Pipeline error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
