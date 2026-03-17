import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Differentiation & Blue Ocean Shift API
 *
 * Input: market-occupation data (competitors, negative_reviews, unmet_needs)
 * Output: 3 positioning vectors + USP formula + Blue Ocean strategy
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, evidenceData } = body;

    if (!query) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    // Extract relevant data from evidence blocks
    const occupation = evidenceData?.occupation || {};
    const problem = evidenceData?.problem || {};
    const sellability = evidenceData?.sellability || {};

    const competitors = occupation?.competitors_exist?.competitors || [];
    const negativeReviews = occupation?.why_gaps_exist?.negative_reviews || [];
    const unmetNeeds = occupation?.why_gaps_exist?.unmet_needs || [];
    const featureGap = occupation?.feature_gap_matrix?.features || [];
    const blueOceanScore = occupation?.red_ocean?.blue_ocean_score?.score ?? 5;
    const complaints = problem?.who_hurts?.top_complaints || [];
    const topSegment = sellability?.market_segment?.primary_segment || '';

    // Default result (no API key)
    let positioningVectors: Array<{
      vector: string;
      description: string;
      target_audience: string;
      evidence: string[];
      effort: 'low' | 'medium' | 'high';
    }> = [];
    let uspFormula = {
      for_whom: '',
      what_does: '',
      how_different: '',
      full_usp: '',
    };
    let blueOceanStrategy = {
      eliminate: [] as string[],
      reduce: [] as string[],
      raise: [] as string[],
      create: [] as string[],
    };
    let competitorWeaknesses: Array<{
      competitor: string;
      weakness: string;
      opportunity: string;
    }> = [];

    if (OPENAI_API_KEY) {
      try {
        const competitorsList = competitors.slice(0, 5).map((c: { name: string }) => c.name).join(', ') || 'unknown';
        const reviewSnippets = negativeReviews.slice(0, 8).map((r: { source: string; title: string }) =>
          `[${r.source}] "${r.title}"`
        ).join('\n');
        const needSnippets = unmetNeeds.slice(0, 8).map((u: { subreddit?: string; title: string }) =>
          `[r/${u.subreddit || 'unknown'}] "${u.title}"`
        ).join('\n');
        const complaintSnippets = complaints.slice(0, 5).map((c: { text?: string; title?: string }) =>
          `"${c.text || c.title || ''}"`
        ).join('\n');
        const featureGapStr = featureGap.slice(0, 6).map((f: { feature: string; competitors: Record<string, boolean> }) => {
          const missing = Object.entries(f.competitors).filter(([, v]) => !v).map(([k]) => k);
          return `${f.feature}: missing in ${missing.join(', ') || 'none'}`;
        }).join('\n');

        const prompt = `Analyze differentiation opportunities for the niche: "${query}"

Competitors: ${competitorsList}
Blue Ocean Score: ${blueOceanScore}/10

Negative reviews about competitors:
${reviewSnippets || 'No data'}

Unmet needs from Reddit:
${needSnippets || 'No data'}

User complaints:
${complaintSnippets || 'No data'}

Feature gaps:
${featureGapStr || 'No data'}

Target segment: ${topSegment || 'General'}

Return JSON:
{
  "positioning_vectors": [
    {
      "vector": "Vector name",
      "description": "How to differentiate using this vector",
      "target_audience": "Who benefits most",
      "evidence": ["Based on review X", "Reddit post Y shows..."],
      "effort": "low"
    }
  ],
  "usp": {
    "for_whom": "Target audience description",
    "what_does": "Core value proposition",
    "how_different": "Key differentiator",
    "full_usp": "Complete USP sentence"
  },
  "blue_ocean": {
    "eliminate": ["What to remove that industry takes for granted"],
    "reduce": ["What to reduce below industry standard"],
    "raise": ["What to raise above industry standard"],
    "create": ["What to create that industry never offered"]
  },
  "competitor_weaknesses": [
    {"competitor": "Name", "weakness": "Specific weakness", "opportunity": "How to exploit it"}
  ]
}

Rules:
- 3-5 positioning vectors, each referencing actual data above
- effort: low=copy/messaging change, medium=feature work, high=major pivot
- USP formula: "{For whom} who need {what}, {product} is the {category} that {how different}"
- Blue Ocean: 2-4 items per quadrant, practical and specific
- competitor_weaknesses: based on real negative reviews/complaints`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.4,
            max_tokens: 1500,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);

            if (parsed.positioning_vectors && Array.isArray(parsed.positioning_vectors)) {
              positioningVectors = parsed.positioning_vectors.map((v: {
                vector: string; description: string; target_audience: string;
                evidence: string[]; effort: string;
              }) => ({
                vector: v.vector,
                description: v.description,
                target_audience: v.target_audience || '',
                evidence: (v.evidence || []).slice(0, 3),
                effort: (['low', 'medium', 'high'].includes(v.effort) ? v.effort : 'medium') as 'low' | 'medium' | 'high',
              }));
            }

            if (parsed.usp) {
              uspFormula = {
                for_whom: parsed.usp.for_whom || '',
                what_does: parsed.usp.what_does || '',
                how_different: parsed.usp.how_different || '',
                full_usp: parsed.usp.full_usp || '',
              };
            }

            if (parsed.blue_ocean) {
              blueOceanStrategy = {
                eliminate: (parsed.blue_ocean.eliminate || []).slice(0, 4),
                reduce: (parsed.blue_ocean.reduce || []).slice(0, 4),
                raise: (parsed.blue_ocean.raise || []).slice(0, 4),
                create: (parsed.blue_ocean.create || []).slice(0, 4),
              };
            }

            if (parsed.competitor_weaknesses && Array.isArray(parsed.competitor_weaknesses)) {
              competitorWeaknesses = parsed.competitor_weaknesses.slice(0, 5).map((w: {
                competitor: string; weakness: string; opportunity: string;
              }) => ({
                competitor: w.competitor,
                weakness: w.weakness,
                opportunity: w.opportunity,
              }));
            }
          }
        }
      } catch (e) {
        console.error('Differentiation GPT error:', e);
      }
    }

    const result = {
      positioning_vectors: positioningVectors,
      usp: uspFormula,
      blue_ocean_strategy: blueOceanStrategy,
      competitor_weaknesses: competitorWeaknesses,
      blue_ocean_score: blueOceanScore,
      data_inputs: {
        competitors_count: competitors.length,
        negative_reviews_count: negativeReviews.length,
        unmet_needs_count: unmetNeeds.length,
        complaints_count: complaints.length,
        feature_gaps_count: featureGap.length,
      },
      generated_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Differentiation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
