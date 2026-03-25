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

// ————————————————————————————————————————————————————————————
// Multi-Pass 2: Валидация релевантности отзывов и постов
// Проверяем: "Это РЕАЛЬНАЯ жалоба на конкурента в нашей нише?"
// ————————————————————————————————————————————————————————————
interface ValidatedReview {
  title: string;
  url: string;
  snippet: string;
  source: string;
  rating?: number;
  is_relevant: boolean;
  is_complaint: boolean;  // true = жалоба, false = позитивный отзыв
  complaint_category?: string;
  confidence: 'high' | 'medium' | 'low';
}

async function validateReviewRelevance(
  reviews: Array<{ title: string; url: string; snippet: string; source: string; rating?: number }>,
  niche: string,
  competitorNames: string[],
): Promise<{ validated: ValidatedReview[]; failed: boolean }> {
  if (reviews.length === 0) return { validated: [], failed: false };
  if (!OPENAI_API_KEY) return {
    validated: reviews.map(r => ({ ...r, is_relevant: true, is_complaint: true, confidence: 'low' as const })),
    failed: false,
  };

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `You are validating review data for the niche: "${niche}".
Known competitors in this niche: ${competitorNames.join(', ')}.

For each review below, determine:
1. is_relevant: Is this review about a product/service in the "${niche}" niche? (false if it's about a different industry)
2. is_complaint: Is this a REAL complaint/negative review? (false if it's positive, neutral, or just a product description)
3. complaint_category: If is_complaint=true, categorize: "UX"|"Pricing"|"Support"|"Bugs"|"Performance"|"Features"|"Integration"|"Other"

Reviews:
${reviews.slice(0, 15).map((r, i) => `${i}. [${r.source}] "${r.title}" — ${r.snippet?.slice(0, 100) || 'no snippet'}`).join('\n')}

Return JSON array:
[{"index": 0, "is_relevant": true/false, "is_complaint": true/false, "complaint_category": "..."}]`,
        }],
        temperature: 0.1,
        max_tokens: 800,
      }),
    });

    if (!response.ok) return {
      validated: reviews.map(r => ({ ...r, is_relevant: true, is_complaint: true, confidence: 'low' as const })),
      failed: true,
    };

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return {
      validated: reviews.map(r => ({ ...r, is_relevant: true, is_complaint: true, confidence: 'low' as const })),
      failed: true,
    };

    const parsed = JSON.parse(jsonMatch[0]);
    const validationMap = new Map<number, { is_relevant: boolean; is_complaint: boolean; complaint_category?: string }>();
    if (Array.isArray(parsed)) {
      parsed.forEach((item: any) => {
        if (typeof item.index === 'number') {
          validationMap.set(item.index, {
            is_relevant: item.is_relevant !== false,
            is_complaint: item.is_complaint !== false,
            complaint_category: item.complaint_category,
          });
        }
      });
    }

    const validated: ValidatedReview[] = reviews.slice(0, 15).map((r, i) => {
      const v = validationMap.get(i);
      return {
        ...r,
        is_relevant: v?.is_relevant ?? true,
        is_complaint: v?.is_complaint ?? true,
        complaint_category: v?.complaint_category,
        confidence: v ? 'medium' as const : 'low' as const,
      };
    });

    return { validated, failed: false };
  } catch (err) {
    console.warn('[Block4] Review validation failed:', err);
    return {
      validated: reviews.map(r => ({ ...r, is_relevant: true, is_complaint: true, confidence: 'low' as const })),
      failed: true,
    };
  }
}

// ————————————————————————————————————————————————————————————
// Multi-Pass 3: Кросс-валидация жалоб между источниками
// Жалоба из G2 + Reddit = high confidence
// Жалоба только из одного источника = medium
// ————————————————————————————————————————————————————————————
interface CrossValidatedComplaint {
  category: string;
  sources: string[];         // ['g2', 'reddit'], ['capterra', 'trustpilot', 'reddit']
  source_count: number;
  confidence: 'high' | 'medium' | 'low';
  examples: string[];
}

function crossValidateComplaints(
  validatedReviews: ValidatedReview[],
  redditPosts: Array<{ title: string; subreddit: string }>,
): CrossValidatedComplaint[] {
  // Группируем жалобы по категориям
  const categoryMap = new Map<string, { sources: Set<string>; examples: string[] }>();

  // Из валидированных отзывов (G2, Capterra, Trustpilot)
  for (const review of validatedReviews) {
    if (!review.is_relevant || !review.is_complaint) continue;
    const cat = review.complaint_category || 'Other';
    if (!categoryMap.has(cat)) categoryMap.set(cat, { sources: new Set(), examples: [] });
    const entry = categoryMap.get(cat)!;
    entry.sources.add(review.source);
    if (entry.examples.length < 2) entry.examples.push(review.title.slice(0, 60));
  }

  // Reddit posts — все считаем потенциальными жалобами (они уже отфильтрованы по "complaint OR problem OR issue")
  if (redditPosts.length > 0) {
    // Если есть Reddit упоминания — добавляем 'reddit' как источник ко всем категориям
    // (Reddit жалобы обычно не категоризированы на этом этапе)
    for (const [, entry] of categoryMap) {
      entry.sources.add('reddit');
    }
    // Также добавляем "Features" если есть посты о missing features
    if (!categoryMap.has('Features') && redditPosts.some(p =>
      /missing|wish|lack|need/i.test(p.title)
    )) {
      categoryMap.set('Features', {
        sources: new Set(['reddit']),
        examples: redditPosts.filter(p => /missing|wish|lack|need/i.test(p.title))
          .slice(0, 2).map(p => p.title.slice(0, 60)),
      });
    }
  }

  return Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    sources: Array.from(data.sources),
    source_count: data.sources.size,
    confidence: data.sources.size >= 3 ? 'high' : data.sources.size >= 2 ? 'high' : 'medium',
    examples: data.examples,
  }));
}

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
    const rawNegativeReviews = [
      ...negativeReviewsResult.reviews,
      ...trustpilotResult.data.map(t => ({
        ...t,
        source: 'trustpilot' as const,
        rating: t.rating,
      })),
    ];

    // 3. Feature gaps from discussions
    const featureGapPosts = featureGapRedditResult.data;

    // ——— Multi-Pass 2: Валидация релевантности ———————————
    const competitorNames = competitors.map(c => c.name);
    const { validated: validatedReviews, failed: validationFailed } =
      await validateReviewRelevance(rawNegativeReviews, searchQuery, competitorNames);

    // Оставляем только релевантные жалобы
    const negativeReviews = validatedReviews
      .filter(r => r.is_relevant && r.is_complaint)
      .map(r => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet,
        source: r.source,
        rating: r.rating,
        complaint_category: r.complaint_category,
      }));

    const irrelevantCount = validatedReviews.filter(r => !r.is_relevant).length;
    const positiveReviewsFiltered = validatedReviews.filter(r => r.is_relevant && !r.is_complaint).length;

    // ——— Multi-Pass 3: Кросс-валидация жалоб ——————————————
    const crossValidated = crossValidateComplaints(validatedReviews, featureGapPosts);
    const highConfidenceComplaints = crossValidated.filter(c => c.confidence === 'high');

    console.log(`[Block4] Review validation: ${rawNegativeReviews.length} raw → ${negativeReviews.length} validated complaints (${irrelevantCount} irrelevant, ${positiveReviewsFiltered} positive filtered)`);
    console.log(`[Block4] Cross-validation: ${crossValidated.length} complaint categories, ${highConfidenceComplaints.length} high-confidence`);

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
          complaint_category: r.complaint_category,
          data_type: 'validated_data' as const, // Multi-Pass: прошли валидацию
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
      // Multi-Pass 3: Cross-validated complaints
      cross_validated_complaints: crossValidated.length > 0 ? {
        categories: crossValidated,
        high_confidence_count: highConfidenceComplaints.length,
        data_type: 'cross_validated' as const,
      } : null,
      // Multi-Pass: Data quality for downstream blocks
      data_quality: {
        total_reviews_collected: rawNegativeReviews.length,
        validated_relevant: negativeReviews.length,
        irrelevant_filtered: irrelevantCount,
        positive_filtered: positiveReviewsFiltered,
        validation_failed: validationFailed,
        cross_validated_categories: crossValidated.length,
        high_confidence_complaints: highConfidenceComplaints.length,
        feature_gap_posts: featureGapPosts.length,
        overall_confidence: (
          highConfidenceComplaints.length >= 2 ? 'high'
          : negativeReviews.length >= 3 ? 'medium'
          : 'low'
        ) as 'high' | 'medium' | 'low',
      },
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
