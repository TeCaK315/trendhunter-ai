// app/api/evidence/competition-v2/narrative/route.ts
// Narrative Engine for Block 4 v2 — Competition Analysis
// GET endpoint: reads block_results, generates narrative via Sonnet

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthUser } from '@/lib/auth-helpers';
import { getServerSupabase } from '@/lib/supabase';

import { NarrativeSchema } from '@/lib/competition/schemas';
import { NARRATIVE_ENGINE_PROMPT } from '@/lib/competition/prompts';
import {
  calculateAggregateConfidence,
  selectNarrativeMode,
  buildPrompt,
} from '@/lib/competition/formula';

const claude = new Anthropic();

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const supabase = getServerSupabase();

    const { searchParams } = new URL(req.url);
    const trend_id = searchParams.get('trend_id');

    if (!trend_id) {
      return NextResponse.json(
        { error: 'trend_id обязателен' },
        { status: 400 },
      );
    }

    // Read Block 4 v2 result + upstream blocks for context
    const [block0Result, block1Result, block2Result, block3Result, block4Result] = await Promise.all([
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
      supabase
        .from('block_results')
        .select('*')
        .eq('trend_id', trend_id)
        .eq('user_id', user.id)
        .eq('block_number', 4)
        .single(),
    ]);

    if (block4Result.error || !block4Result.data) {
      return NextResponse.json(
        { error: 'Блок 4 не найден. Запустите анализ Конкуренции.' },
        { status: 422 },
      );
    }

    const block0Context = block0Result.data?.block_context ?? {};
    const block1Context = block1Result.data?.block_context ?? {};
    const block2Context = block2Result.data?.block_context ?? {};
    const block3Context = block3Result.data?.block_context ?? {};
    const block4Context = block4Result.data.block_context ?? {};
    const block4RawData = block4Result.data.raw_data ?? {};

    // Extract data for narrative
    const fullOutput = block4RawData.fullOutput ?? block4RawData;
    const gapMap = block4Context.gap_map ?? fullOutput.gap_map ?? [];
    const entryVerdict = block4Context.entry_verdict ?? fullOutput.entry_verdict ?? 'EXPERIMENT';
    const competitionIntensity = block4Context.competition_intensity ?? fullOutput.competition_intensity ?? 'MEDIUM';
    const mainOpportunity = block4Context.main_opportunity ?? fullOutput.main_opportunity ?? '';
    const competitorSummary = block4Context.competitor_summary ?? [];

    // Compute aggregate confidence
    const demandConfidence = block2Context.demand_confidence_score ?? block2Context.demand_strength_score ?? 0.5;
    const monetizationConfidence = block3Context.monetization_confidence ?? 0.5;

    // Data coverage ratio: how many competitors had successful class analyses
    const competitorsDetail = fullOutput.competitors_detail ?? [];
    const totalClasses = competitorsDetail.length * 5;
    const missingClasses = competitorsDetail.reduce(
      (sum: number, c: any) => sum + (c.missingClasses?.length ?? 0), 0
    );
    const dataCoverageRatio = totalClasses > 0 ? (totalClasses - missingClasses) / totalClasses : 0.5;

    // Gap map unknown ratio
    const totalPains = gapMap.length;
    const unknownPains = gapMap.filter((g: any) => g.status === 'unknown').length;
    const gapMapUnknownRatio = totalPains > 0 ? unknownPains / totalPains : 1;

    const aggregateConfidence = calculateAggregateConfidence({
      demandConfidence,
      monetizationConfidence,
      dataCoverageRatio,
      gapMapUnknownRatio,
    });

    // Select narrative mode
    const mode = selectNarrativeMode(
      entryVerdict,
      aggregateConfidence,
      gapMapUnknownRatio,
      dataCoverageRatio,
    );

    // Build narrative prompt
    let payingRatio = block1Context.paying_users_ratio ?? 0.5;
    if (payingRatio > 1) payingRatio = payingRatio / 100;

    const narrativePrompt = buildPrompt(NARRATIVE_ENGINE_PROMPT, {
      category_type: block0Context.category_type ?? '',
      actors: JSON.stringify(block0Context.actors ?? []),
      pain_hierarchy: JSON.stringify(block0Context.pain_hierarchy ?? []),
      paying_ratio: payingRatio,
      demand_strength_score: demandConfidence,
      market_stage: block2Context.market_stage ?? 'GROWING',
      monetization_verdict: block3Context.monetization_verdict ?? block3Context.monetization_archetype ?? '',
      competition_intensity: competitionIntensity,
      entry_verdict: entryVerdict,
      gap_map: JSON.stringify(gapMap),
      main_opportunity: mainOpportunity,
      competitor_summary: JSON.stringify(competitorSummary),
      mode,
      aggregate_confidence: JSON.stringify(aggregateConfidence),
    });

    // Call Sonnet for narrative
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: 'Respond with valid JSON only, no markdown.',
      messages: [{ role: 'user', content: narrativePrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const clean = text.replace(/```json|```/g, '').trim();

    let narrativeOutput;
    try {
      narrativeOutput = NarrativeSchema.parse(JSON.parse(clean));
    } catch (parseError) {
      console.warn('[Block4v2 Narrative] Parse failed, using fallback:', parseError);
      narrativeOutput = {
        narrative_intro: `Анализ конкурентной среды выявил ${competitionIntensity.toLowerCase()} уровень конкуренции. ${mainOpportunity || 'Требуется дополнительное исследование.'}`,
        narrative_outro: `Вердикт входа: ${entryVerdict}. Уверенность анализа: ${aggregateConfidence.level}.`,
      };
    }

    // Save narrative_output to block_results
    const existingRawData = block4Result.data.raw_data ?? {};
    const { error: dbError } = await supabase.from('block_results').upsert({
      trend_id,
      user_id: user.id,
      block_number: 4,
      block_type: 'competition_v2',
      diagnosis: block4Result.data.diagnosis,
      score: block4Result.data.score,
      conflict_weight: block4Result.data.conflict_weight,
      key_factors: block4Result.data.key_factors,
      key_metric: block4Result.data.key_metric,
      block_context: block4Result.data.block_context,
      raw_data: {
        ...existingRawData,
        narrative_output: narrativeOutput,
        narrative_mode: mode,
        aggregate_confidence: aggregateConfidence,
      },
    }, { onConflict: 'trend_id,user_id,block_number' });

    if (dbError) throw new Error(`Supabase error: ${dbError.message}`);

    console.log('[Block4v2 Narrative] Generated:', {
      mode,
      confidence: aggregateConfidence.level,
      entry_verdict: entryVerdict,
    });

    return NextResponse.json({
      success: true,
      data: {
        narrative_output: narrativeOutput,
        mode,
        aggregate_confidence: aggregateConfidence,
      },
    });

  } catch (error: any) {
    console.error('[Block4v2 Narrative] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 },
    );
  }
}
