import { NextRequest, NextResponse } from 'next/server';
import {
  fetchComplaints,
  fetchGoogleTrends,
  fetchG2Reviews,
  fetchCapterraReviews,
  fetchTrustpilot,
  fetchCompetitorPricing,
  discoverCompetitors,
} from '@/lib/data-fetchers';
import {
  calcProblemSeverity,
  calcFrequencyScore,
} from '@/lib/evidence-calculations';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Block 1: "Есть ли реальная проблема?"
 *
 * Вопросы:
 * 1. У кого болит — Reddit/HN/Quora/SO жалобы
 * 2. Как часто — Google Trends + Reddit post count + SO question count
 * 3. Что делают сейчас — G2/Capterra отзывы конкурентов
 * 4. Платят ли за решение — Pricing pages конкурентов
 *
 * Вердикт: рассчитанный score по формуле (кол-во жалоб * avg engagement)
 */

const ROUTE_TIMEOUT_MS = 45_000; // 45 seconds max for entire route

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

    const routeStart = Date.now();
    let totalSerpApiCalls = 0;

    // Fetch all data in parallel (including Twitter + Trustpilot)
    const [
      complaintsResult,
      trendsResult,
      g2Result,
      capterraResult,
      trustpilotResult,
    ] = await Promise.all([
      fetchComplaints(searchQuery, ['reddit', 'hacker_news', 'quora', 'stackoverflow', 'twitter']),
      fetchGoogleTrends(searchQuery),
      fetchG2Reviews(searchQuery),
      fetchCapterraReviews(searchQuery),
      fetchTrustpilot(searchQuery),
    ]);

    totalSerpApiCalls += complaintsResult.serpapi_calls_used;
    totalSerpApiCalls += trendsResult.serpapi_calls_used;
    totalSerpApiCalls += g2Result.serpapi_calls_used;
    totalSerpApiCalls += capterraResult.serpapi_calls_used;
    totalSerpApiCalls += trustpilotResult.serpapi_calls_used;

    // Fetch competitor pricing — use context or discover via search (max 3 to avoid SerpAPI overload)
    // Skip if route is already taking too long
    let competitorNames: string[] = context?.competition?.competitors?.map((c: { name: string }) => c.name).slice(0, 3) || [];
    let pricingResults: Awaited<ReturnType<typeof fetchCompetitorPricing>>[] = [];

    const elapsed = Date.now() - routeStart;
    if (elapsed < ROUTE_TIMEOUT_MS - 15_000) { // Only if we have 15+ seconds left
      if (competitorNames.length === 0) {
        const discovered = await discoverCompetitors(searchQuery, 3);
        totalSerpApiCalls += discovered.serpapi_calls_used;
        competitorNames = discovered.competitors.map(c => c.name).slice(0, 3);
      }

      // Parallel pricing fetch (was sequential — caused 10+ minute delays)
      pricingResults = await Promise.all(
        competitorNames.slice(0, 3).map(name => fetchCompetitorPricing(name))
      );
      for (const pr of pricingResults) {
        totalSerpApiCalls += pr.serpapi_calls_used;
      }
    } else {
      console.log(`[real-problem] Skipping pricing fetch — ${elapsed}ms elapsed, timeout at ${ROUTE_TIMEOUT_MS}ms`);
    }

    // === CALCULATIONS (NO GPT) ===

    // 1. Who hurts — complaints analysis
    const complaints = complaintsResult.complaints;
    const totalEngagement = complaints.reduce((sum, c) => sum + (c.engagement || 0), 0);
    const sourcesCount = new Set(complaints.map(c => c.source)).size;

    const severityScore = calcProblemSeverity(
      complaints.length,
      totalEngagement,
      sourcesCount
    );

    // 2. How often — frequency score
    const redditCount = complaints.filter(c => c.source === 'reddit').length;
    const soCount = complaints.filter(c => c.source === 'stackoverflow').length;
    const trendsVolume = trendsResult.data ? trendsResult.data.growth_rate : 0;

    const frequencyScore = calcFrequencyScore(redditCount, soCount, Math.abs(trendsVolume));

    // 3. Current solutions — reviews (G2 + Capterra + Trustpilot)
    const reviews = [...g2Result.data, ...capterraResult.data, ...trustpilotResult.data];

    // 4. Willingness to pay — pricing data
    const paidSolutionCount = pricingResults.filter(p => p.prices_found.length > 0 || p.pricing_url).length;

    // === VERDICT (calculated) ===
    const verdictRaw = (severityScore.value * 0.4 + frequencyScore.value * 0.3 + Math.min(10, paidSolutionCount * 2) * 0.3);
    const verdictValue = Math.min(10, Math.max(1, Math.round(verdictRaw * 10) / 10));
    const verdictConfidence = Math.min(90, 20 + complaints.length * 5 + reviews.length * 3 + paidSolutionCount * 5);

    // === AI SUMMARY (optional, based on real data — skip if running low on time) ===
    let aiSummary: string | null = null;
    const elapsed2 = Date.now() - routeStart;
    if (OPENAI_API_KEY && complaints.length > 0 && elapsed2 < ROUTE_TIMEOUT_MS - 10_000) {
      try {
        const complaintsText = complaints.slice(0, 10).map((c, i) =>
          `${i + 1}. [${c.source}] "${c.title}" (engagement: ${c.engagement || 0}, URL: ${c.url})`
        ).join('\n');

        const prompt = `На основе РЕАЛЬНЫХ жалоб пользователей для "${searchQuery}":
${complaintsText}

Кратко (2-3 предложения): какая главная боль и насколько она острая?
ВАЖНО: Ссылайся на конкретные жалобы по их заголовкам (в кавычках), а НЕ по номерам пунктов. Не выдумывай данных.`;

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
            max_tokens: 300,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          aiSummary = data.choices?.[0]?.message?.content || null;
        }
      } catch (e) {
        console.error('AI summary error:', e);
      }
    }

    const result = {
      who_hurts: {
        complaints: complaints.map(c => ({
          text: c.title,
          source: c.source,
          source_url: c.url,
          engagement: c.engagement || 0,
          data_type: 'real_data' as const,
        })),
        total_complaints: complaints.length,
        sources_count: sourcesCount,
        severity_score: severityScore,
      },
      how_often: {
        google_trends: trendsResult.data ? {
          growth_rate: Math.abs(trendsResult.data.growth_rate), // Always positive
          search_query: trendsResult.data.search_query,
          google_trends_url: trendsResult.data.google_trends_url,
        } : null,
        reddit_post_count: redditCount,
        so_question_count: soCount,
        frequency_score: frequencyScore,
      },
      current_solutions: {
        reviews: reviews.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: r.source,
          rating: 'rating' in r ? (r as { rating?: number }).rating : undefined,
        })),
        total_reviews: reviews.length,
      },
      willingness_to_pay: {
        pricing_data: pricingResults.map(p => ({
          competitor: p.competitor,
          pricing_url: p.pricing_url,
          pricing_snippet: p.pricing_snippet,
          prices_found: p.prices_found,
        })),
        paid_solution_count: paidSolutionCount,
      },
      verdict: {
        value: verdictValue,
        data_type: 'calculated' as const,
        formula: 'severity*0.4 + frequency*0.3 + paid_solutions*0.3',
        inputs: [
          `severity=${severityScore.value}`,
          `frequency=${frequencyScore.value}`,
          `paid_solutions=${paidSolutionCount}`,
        ],
        confidence: verdictConfidence,
      },
      ai_summary: aiSummary ? {
        text: aiSummary,
        data_type: 'ai_synthesis' as const,
        note: 'AI-синтез на основе реальных жалоб',
      } : null,
      search_errors: [
        ...(complaintsResult.errors || []),
        ...(trendsResult.error ? [`google_trends: ${trendsResult.error}`] : []),
        ...(g2Result.error ? [`g2: ${g2Result.error}`] : []),
        ...(capterraResult.error ? [`capterra: ${capterraResult.error}`] : []),
        ...(trustpilotResult.error ? [`trustpilot: ${trustpilotResult.error}`] : []),
      ],
      serpapi_calls_used: totalSerpApiCalls,
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Real Problem API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
