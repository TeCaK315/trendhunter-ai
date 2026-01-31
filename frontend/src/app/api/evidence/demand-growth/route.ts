import { NextRequest, NextResponse } from 'next/server';
import {
  fetchGoogleTrends,
  fetchProductHunt,
  fetchHackerNews,
  fetchGoogleNews,
} from '@/lib/data-fetchers';
import {
  calcTrendStability,
  calcGrowthComparison,
  calcDemandVerdict,
} from '@/lib/evidence-calculations';

/**
 * Block 2: "Есть ли спрос?"
 *
 * Вопросы:
 * 1. Растёт или умирает — Google Trends 12мес vs 3мес
 * 2. Хайп или устойчивый — Стандартное отклонение timeline
 * 3. Новые игроки — Product Hunt запуски + Show HN + funding news
 *
 * Вердикт: рассчитанный score по формуле
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

    // Fetch all data in parallel
    const [
      trends12mResult,
      trends3mResult,
      phResult,
      hnResult,
      fundingNewsResult,
    ] = await Promise.all([
      fetchGoogleTrends(searchQuery, 'today 12-m'),
      fetchGoogleTrends(searchQuery, 'today 3-m'),
      fetchProductHunt(searchQuery),
      fetchHackerNews(`Show HN ${searchQuery}`),
      fetchGoogleNews(searchQuery, 6),
    ]);

    totalSerpApiCalls += trends12mResult.serpapi_calls_used;
    totalSerpApiCalls += trends3mResult.serpapi_calls_used;
    totalSerpApiCalls += phResult.serpapi_calls_used;
    totalSerpApiCalls += hnResult.serpapi_calls_used;
    totalSerpApiCalls += fundingNewsResult.serpapi_calls_used;

    // === CALCULATIONS (NO GPT) ===

    // 1. Growing or dying — compare 12m vs 3m growth
    const growth12m = trends12mResult.data ? trends12mResult.data.growth_rate : 0;
    const growth3m = trends3mResult.data ? trends3mResult.data.growth_rate : 0;

    const growthComparison = calcGrowthComparison(growth12m, growth3m);

    // 2. Hype or stable — standard deviation of timeline
    const timeline = trends12mResult.data?.interest_timeline
      ? trends12mResult.data.interest_timeline.map(t => ({ date: t.date, value: t.value }))
      : [];

    const stabilityScore = calcTrendStability(timeline);

    // Calculate std_deviation manually for display
    let stdDeviation = 0;
    if (timeline.length >= 3) {
      const values = timeline.map(t => t.value);
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
      stdDeviation = Math.round(Math.sqrt(variance) * 10) / 10;
    }

    // 3. New players
    const phLaunches = phResult.data;
    const showHNPosts = hnResult.data;
    const fundingNews = fundingNewsResult.data;
    const newEntrantsCount = phLaunches.length + showHNPosts.length;

    // === VERDICT (calculated) ===
    const demandVerdict = calcDemandVerdict(
      growthComparison.value,
      stabilityScore.value,
      newEntrantsCount
    );

    const result = {
      growing_or_dying: {
        trends_12m: trends12mResult.data ? {
          growth_rate: growth12m,
          search_query: trends12mResult.data.search_query,
          google_trends_url: trends12mResult.data.google_trends_url,
          interest_timeline: trends12mResult.data.interest_timeline,
        } : null,
        trends_3m: trends3mResult.data ? {
          growth_rate: growth3m,
          search_query: trends3mResult.data.search_query,
          google_trends_url: trends3mResult.data.google_trends_url,
        } : null,
        growth_comparison: growthComparison,
        error: trends12mResult.error || trends3mResult.error || undefined,
      },
      hype_or_stable: {
        stability_score: stabilityScore,
        std_deviation: stdDeviation,
        timeline_points: timeline.length,
      },
      new_players: {
        producthunt_launches: phLaunches.map(p => ({
          title: p.title,
          url: p.url,
          upvotes: p.upvotes,
          snippet: p.snippet,
          source: 'producthunt' as const,
        })),
        show_hn_posts: showHNPosts.map(p => ({
          title: p.title,
          url: p.url,
          points: p.points,
          snippet: p.snippet,
          source: 'hacker_news' as const,
        })),
        funding_news: fundingNews.map(n => ({
          title: n.title,
          url: n.url,
          snippet: n.snippet,
          date: n.date,
          source: 'google_news' as const,
        })),
        new_entrants_count: newEntrantsCount,
      },
      verdict: demandVerdict,
      data_metadata: {
        growing_or_dying: { data_type: 'real_data', source: 'Google Trends via SerpAPI' },
        hype_or_stable: { data_type: 'calculated', formula: 'stability = 10 - (std_dev / mean * 10)' },
        new_players: { data_type: 'real_data', source: 'Product Hunt + Hacker News + Google News' },
        verdict: { data_type: 'calculated', formula: '(growth*0.5 + stability*0.3 + new_entrants*0.2) * entrants_factor' },
      },
      serpapi_calls_used: totalSerpApiCalls,
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Demand Growth API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
