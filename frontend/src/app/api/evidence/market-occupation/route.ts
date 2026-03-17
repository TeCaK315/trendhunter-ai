import { NextRequest, NextResponse } from 'next/server';
import {
  fetchNegativeReviews,
  fetchReddit,
  fetchTrustpilot,
  fetchGoogleSearch,
  discoverCompetitors,
} from '@/lib/data-fetchers';
import {
  calcBlueOceanScore,
  calcMarketSaturation,
} from '@/lib/evidence-calculations';
import { analyzeDesign } from '@/lib/design-analyzer';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Block 4: "Насколько рынок занят?"
 *
 * Вопросы:
 * 1. Есть ли конкуренты (нет = плохо) — из context
 * 2. Почему не закрывают боль — G2/Capterra негативные отзывы
 * 3. Чем отличаемся — Feature gap из обсуждений
 * 4. Красный океан? — Формула: конкуренты + финансирование
 *
 * Вердикт: рассчитанный score
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, context } = body;

    const searchQuery = query || context?.trend?.title;
    if (!searchQuery) {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    let totalSerpApiCalls = 0;

    // Get competitor info from context
    let competitors: Array<{ name: string; website?: string; target_market?: string }> = context?.competition?.competitors || [];

    // Fallback: discover competitors via Google Search + GPT if none in context
    if (competitors.length === 0) {
      const discovered = await discoverCompetitors(searchQuery, 8);
      totalSerpApiCalls += discovered.serpapi_calls_used;
      competitors = discovered.competitors.map(c => ({ name: c.name, website: c.website }));
    }

    const competitorsCount = competitors.length;

    // Fetch data in parallel (including background design analysis + Trustpilot)
    const [
      negativeReviewsResult,
      featureGapRedditResult,
      alternativesSearchResult,
      trustpilotResult,
      designAnalysisResult,
    ] = await Promise.all([
      fetchNegativeReviews(searchQuery),
      fetchReddit(`${searchQuery} alternative OR wish OR missing feature OR lack`),
      fetchGoogleSearch(`${searchQuery} alternatives comparison`),
      fetchTrustpilot(searchQuery),
      analyzeDesign(searchQuery, competitors), // Background design analysis
    ]);

    totalSerpApiCalls += negativeReviewsResult.serpapi_calls_used;
    totalSerpApiCalls += featureGapRedditResult.serpapi_calls_used;
    totalSerpApiCalls += alternativesSearchResult.serpapi_calls_used;
    totalSerpApiCalls += trustpilotResult.serpapi_calls_used;

    // === CALCULATIONS (NO GPT) ===

    // 1. Competitors exist
    // No competitors is actually BAD — it might mean no market
    const noCompetitorsIsBad = competitorsCount === 0;

    // 2. Why gaps exist — negative reviews (G2 + Capterra + Trustpilot)
    const negativeReviews = [
      ...negativeReviewsResult.reviews,
      ...trustpilotResult.data.map(t => ({
        ...t,
        source: 'trustpilot' as const,
        rating: t.rating,
      })),
    ];

    // 3. Feature gaps from discussions
    const featureGapPosts = featureGapRedditResult.data;

    // 4. Red ocean calculations
    const saturation = calcMarketSaturation(competitorsCount);
    const blueOcean = calcBlueOceanScore(competitorsCount);

    // === FEATURE GAP + PRICING + TRAFFIC + COMPLAINTS (Phase 3.3) ===
    let featureGapMatrix: Array<{ feature: string; competitors: Record<string, boolean> }> = [];
    let pricingBenchmark: Array<{ competitor: string; plan: string; price: string; trial: boolean }> = [];
    let trafficSources: Array<{ competitor: string; seo: number; ads: number; social: number; direct: number }> = [];
    let competitorComplaints: Array<{ competitor: string; categories: Array<{ category: string; count: number; examples: string[] }> }> = [];

    const top3Competitors = competitors.slice(0, 3);

    // Complaint mining: SerpAPI Reddit search for top-3 competitors
    if (top3Competitors.length > 0) {
      const complaintSearches = await Promise.all(
        top3Competitors.map(c =>
          fetchReddit(`"${c.name}" complaint OR problem OR issue OR bug OR terrible`)
        )
      );
      for (const cs of complaintSearches) {
        totalSerpApiCalls += cs.serpapi_calls_used;
      }

      // GPT: Feature Gap + Pricing + Traffic + Complaint categorization in ONE call
      if (OPENAI_API_KEY) {
        try {
          const complaintsContext = top3Competitors.map((c, idx) => {
            const posts = complaintSearches[idx]?.data || [];
            return `${c.name}: ${posts.slice(0, 5).map(p => `"${p.title}"`).join(', ') || 'нет жалоб'}`;
          }).join('\n');

          const competitorsList = top3Competitors.map(c =>
            `${c.name}${c.website ? ` (${c.website})` : ''}`
          ).join(', ');

          const gapPrompt = `Analyze the niche "${searchQuery}" with these top competitors: ${competitorsList}

Negative reviews found:
${negativeReviews.slice(0, 8).map(r => `- [${r.source}] ${r.title}`).join('\n')}

Competitor complaints from Reddit:
${complaintsContext}

Return JSON with exactly this structure:
{
  "feature_gap": [
    {"feature": "Feature Name", ${top3Competitors.map(c => `"${c.name}": true`).join(', ')}}
  ],
  "pricing": [
    {"competitor": "Name", "plan": "Basic/Pro/Enterprise", "price": "$X/mo", "trial": true}
  ],
  "traffic": [
    {"competitor": "Name", "seo": 40, "ads": 20, "social": 25, "direct": 15}
  ],
  "complaints": [
    {"competitor": "Name", "categories": [{"category": "UX", "count": 3, "examples": ["quote1"]}]}
  ]
}

Rules:
- feature_gap: 5-8 key features for this niche, boolean per competitor (true=has, false=missing)
- pricing: estimate pricing tiers based on typical SaaS pricing in this niche
- traffic: estimate % split of traffic sources (must sum to 100)
- complaints: categorize Reddit complaints into: UX, Pricing, Support, Bugs, Performance, Features
- Keep examples short (<60 chars), max 2 per category
- Be realistic, base on actual data above`;

          const gapRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [{ role: 'user', content: gapPrompt }],
              temperature: 0.3,
              max_tokens: 1500,
            }),
          });

          if (gapRes.ok) {
            const gapData = await gapRes.json();
            const gapContent = gapData.choices?.[0]?.message?.content || '';
            const gapJson = gapContent.match(/\{[\s\S]*\}/);
            if (gapJson) {
              const parsed = JSON.parse(gapJson[0]);

              // Feature Gap Matrix
              if (parsed.feature_gap && Array.isArray(parsed.feature_gap)) {
                featureGapMatrix = parsed.feature_gap.map((f: Record<string, unknown>) => {
                  const competitorFlags: Record<string, boolean> = {};
                  for (const c of top3Competitors) {
                    competitorFlags[c.name] = !!f[c.name];
                  }
                  return { feature: f.feature as string, competitors: competitorFlags };
                });
              }

              // Pricing Benchmark
              if (parsed.pricing && Array.isArray(parsed.pricing)) {
                pricingBenchmark = parsed.pricing.map((p: { competitor: string; plan: string; price: string; trial: boolean }) => ({
                  competitor: p.competitor,
                  plan: p.plan || 'N/A',
                  price: p.price || 'N/A',
                  trial: !!p.trial,
                }));
              }

              // Traffic Sources
              if (parsed.traffic && Array.isArray(parsed.traffic)) {
                trafficSources = parsed.traffic.map((t: { competitor: string; seo: number; ads: number; social: number; direct: number }) => ({
                  competitor: t.competitor,
                  seo: t.seo || 0,
                  ads: t.ads || 0,
                  social: t.social || 0,
                  direct: t.direct || 0,
                }));
              }

              // Complaints
              if (parsed.complaints && Array.isArray(parsed.complaints)) {
                competitorComplaints = parsed.complaints.map((cc: { competitor: string; categories: Array<{ category: string; count: number; examples: string[] }> }) => ({
                  competitor: cc.competitor,
                  categories: (cc.categories || []).map(cat => ({
                    category: cat.category,
                    count: cat.count || 0,
                    examples: (cat.examples || []).slice(0, 2),
                  })),
                }));
              }
            }
          }
        } catch (e) {
          console.error('Feature gap analysis error:', e);
        }
      }
    }

    // === AI ANALYSIS for differentiation (optional) ===
    let differentiationOpportunities: string[] = [];
    if (OPENAI_API_KEY && (negativeReviews.length > 0 || featureGapPosts.length > 0)) {
      try {
        let dataSection = '';
        if (negativeReviews.length > 0) {
          dataSection += `\nНегативные отзывы конкурентов:
${negativeReviews.slice(0, 5).map((r, i) => `${i + 1}. [${r.source}] "${r.title}" (URL: ${r.url})`).join('\n')}`;
        }
        if (featureGapPosts.length > 0) {
          dataSection += `\nОбсуждения недостающих функций:
${featureGapPosts.slice(0, 5).map((p, i) => `${i + 1}. [Reddit r/${p.subreddit}] "${p.title}" (URL: ${p.url})`).join('\n')}`;
        }

        const prompt = `На основе РЕАЛЬНЫХ данных для ниши "${searchQuery}":
${dataSection}

Конкуренты (${competitorsCount}): ${competitors.slice(0, 5).map(c => c.name).join(', ') || 'нет данных'}

Определи 3-5 возможностей для дифференциации. Каждая ДОЛЖНА ссылаться на конкретный отзыв/пост выше.
Верни JSON: { "opportunities": ["Возможность 1 (на основе отзыва X)", ...] }`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 600,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            differentiationOpportunities = parsed.opportunities || [];
          }
        }
      } catch (e) {
        console.error('Differentiation AI error:', e);
      }
    }

    // === VERDICT ===
    // Score: high when there ARE competitors but they have gaps
    let verdictValue = 5;
    if (competitorsCount === 0) {
      verdictValue = 3; // No competitors = risky
    } else if (competitorsCount <= 3 && negativeReviews.length > 2) {
      verdictValue = 9; // Few competitors with clear gaps = great
    } else if (competitorsCount <= 5 && negativeReviews.length > 0) {
      verdictValue = 7; // Moderate competition with some gaps
    } else if (competitorsCount > 7 && negativeReviews.length > 3) {
      verdictValue = 5; // Many competitors but opportunities exist
    } else if (competitorsCount > 7) {
      verdictValue = 3; // Red ocean, few gaps found
    }
    verdictValue = Math.min(10, Math.max(1, verdictValue));

    const verdictConfidence = Math.min(90, 20 + competitorsCount * 5 + negativeReviews.length * 5 + featureGapPosts.length * 3);

    const result = {
      competitors_exist: {
        count: competitorsCount,
        competitors: competitors.slice(0, 10).map(c => ({
          name: c.name,
          website: c.website,
          target_market: c.target_market,
        })),
        no_competitors_is_bad: noCompetitorsIsBad,
        note: noCompetitorsIsBad
          ? 'Отсутствие конкурентов может означать отсутствие рынка'
          : `Найдено ${competitorsCount} конкурентов`,
      },
      why_gaps_exist: {
        negative_reviews: negativeReviews.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.source,
          data_type: 'real_data' as const,
        })),
        unmet_needs: featureGapPosts.map(p => ({
          title: p.title,
          url: p.url,
          subreddit: p.subreddit,
          score: p.score,
          data_type: 'real_data' as const,
        })),
        total_signals: negativeReviews.length + featureGapPosts.length,
      },
      differentiation: {
        feature_gaps_found: featureGapPosts.length,
        negative_reviews_found: negativeReviews.length,
        positioning_opportunities: differentiationOpportunities.length > 0
          ? differentiationOpportunities
          : (negativeReviews.length > 0
            ? ['Анализируйте негативные отзывы выше для определения возможностей']
            : ['Недостаточно данных для определения возможностей дифференциации']),
        opportunities_data_type: differentiationOpportunities.length > 0
          ? 'ai_synthesis' as const
          : 'insufficient_data' as const,
      },
      red_ocean: {
        saturation_score: {
          level: saturation.level,
          data_type: saturation.data_type,
          formula: saturation.formula,
        },
        blue_ocean_score: blueOcean,
      },
      verdict: {
        value: verdictValue,
        data_type: 'calculated' as const,
        formula: 'competitors_count + gaps_found → opportunity score',
        inputs: [
          `competitors=${competitorsCount}`,
          `negative_reviews=${negativeReviews.length}`,
          `feature_gaps=${featureGapPosts.length}`,
        ],
        confidence: verdictConfidence,
      },
      data_metadata: {
        competitors: { data_type: 'real_data', source: 'From competition context' },
        negative_reviews: { data_type: 'real_data', source: 'G2 + Capterra via SerpAPI' },
        feature_gaps: { data_type: 'real_data', source: 'Reddit via SerpAPI' },
        differentiation: { data_type: differentiationOpportunities.length > 0 ? 'ai_synthesis' : 'not_available' },
        red_ocean: { data_type: 'calculated', formula: 'max(1, 10 - competitors * 1.2)' },
        design_analysis: { data_type: designAnalysisResult ? 'ai_synthesis' : 'not_available' },
      },
      // Phase 3.3: Competitor Anatomy
      feature_gap_matrix: featureGapMatrix.length > 0 ? {
        features: featureGapMatrix,
        competitors: top3Competitors.map(c => c.name),
        data_type: 'ai_synthesis' as const,
      } : null,
      pricing_benchmark: pricingBenchmark.length > 0 ? {
        entries: pricingBenchmark,
        data_type: 'ai_synthesis' as const,
      } : null,
      traffic_sources: trafficSources.length > 0 ? {
        entries: trafficSources,
        data_type: 'ai_synthesis' as const,
      } : null,
      competitor_complaints: competitorComplaints.length > 0 ? {
        entries: competitorComplaints,
        data_type: 'real_data' as const,
        source: 'Reddit via SerpAPI + GPT categorization',
      } : null,
      // Design analysis runs in background - used by META agent for MVP generation
      design_analysis: designAnalysisResult,
      serpapi_calls_used: totalSerpApiCalls,
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Market Occupation API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
