import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import {
  fetchGoogleTrends,
  fetchProductHunt,
  fetchHackerNews,
  fetchGoogleNews,
  fetchYouTube,
  fetchGitHub,
  fetchIndieHackers,
  fetchGoogleAutocomplete,
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
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

    // Fetch all data in parallel (including YouTube, GitHub, Indie Hackers, Autocomplete, Intent, Geo)
    const [
      trends12mResult,
      trends3mResult,
      phResult,
      hnResult,
      fundingNewsResult,
      youtubeResult,
      githubResult,
      indieHackersResult,
      autocompleteResult,
      // Search Intent — commercial autocomplete queries
      intentBuyResult,
      intentPricingResult,
      intentReviewResult,
      // Geographic breakdown — Google Trends by region
      geoUSResult,
      geoGBResult,
      geoDEResult,
      geoRUResult,
    ] = await Promise.all([
      fetchGoogleTrends(searchQuery, 'today 12-m'),
      fetchGoogleTrends(searchQuery, 'today 3-m'),
      fetchProductHunt(searchQuery),
      fetchHackerNews(`Show HN ${searchQuery}`),
      fetchGoogleNews(searchQuery, 6),
      fetchYouTube(searchQuery),
      fetchGitHub(searchQuery),
      fetchIndieHackers(searchQuery),
      fetchGoogleAutocomplete(searchQuery),
      // Intent queries
      fetchGoogleAutocomplete(`${searchQuery} buy`),
      fetchGoogleAutocomplete(`${searchQuery} pricing`),
      fetchGoogleAutocomplete(`${searchQuery} review`),
      // Geo queries (3-month for recent data)
      fetchGoogleTrends(searchQuery, 'today 3-m', 'US'),
      fetchGoogleTrends(searchQuery, 'today 3-m', 'GB'),
      fetchGoogleTrends(searchQuery, 'today 3-m', 'DE'),
      fetchGoogleTrends(searchQuery, 'today 3-m', 'RU'),
    ]);

    totalSerpApiCalls += trends12mResult.serpapi_calls_used;
    totalSerpApiCalls += trends3mResult.serpapi_calls_used;
    totalSerpApiCalls += phResult.serpapi_calls_used;
    totalSerpApiCalls += hnResult.serpapi_calls_used;
    totalSerpApiCalls += fundingNewsResult.serpapi_calls_used;
    totalSerpApiCalls += youtubeResult.serpapi_calls_used;
    totalSerpApiCalls += githubResult.serpapi_calls_used;
    totalSerpApiCalls += indieHackersResult.serpapi_calls_used;
    totalSerpApiCalls += autocompleteResult.serpapi_calls_used;
    totalSerpApiCalls += intentBuyResult.serpapi_calls_used;
    totalSerpApiCalls += intentPricingResult.serpapi_calls_used;
    totalSerpApiCalls += intentReviewResult.serpapi_calls_used;
    totalSerpApiCalls += geoUSResult.serpapi_calls_used;
    totalSerpApiCalls += geoGBResult.serpapi_calls_used;
    totalSerpApiCalls += geoDEResult.serpapi_calls_used;
    totalSerpApiCalls += geoRUResult.serpapi_calls_used;

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

    // 3. New players (PH + HN + GitHub + Indie Hackers)
    const phLaunches = phResult.data;
    const showHNPosts = hnResult.data;
    const fundingNews = fundingNewsResult.data;
    const githubRepos = githubResult.data;
    const indieHackersPosts = indieHackersResult.data;
    const youtubeVideos = youtubeResult.data;
    const autocompleteSuggestions = autocompleteResult.suggestions;
    const newEntrantsCount = phLaunches.length + showHNPosts.length + githubRepos.length + indieHackersPosts.length;

    // 4. Search Intent — commercial vs informational
    const commercialKeywords = ['buy', 'pricing', 'price', 'cost', 'plan', 'subscribe', 'trial', 'demo', 'purchase', 'deal', 'discount', 'coupon', 'free trial', 'alternative'];
    const informationalKeywords = ['what is', 'how to', 'tutorial', 'guide', 'learn', 'example', 'definition', 'meaning', 'vs', 'comparison', 'best', 'top'];

    const allIntentSuggestions = [
      ...intentBuyResult.suggestions.map(s => s.suggestion),
      ...intentPricingResult.suggestions.map(s => s.suggestion),
      ...intentReviewResult.suggestions.map(s => s.suggestion),
      ...autocompleteResult.suggestions.map(s => s.suggestion),
    ];

    let commercialCount = 0;
    let informationalCount = 0;
    for (const suggestion of allIntentSuggestions) {
      const lower = suggestion.toLowerCase();
      if (commercialKeywords.some(kw => lower.includes(kw))) commercialCount++;
      if (informationalKeywords.some(kw => lower.includes(kw))) informationalCount++;
    }
    const totalIntentSignals = commercialCount + informationalCount || 1;
    const commercialPercent = Math.round((commercialCount / totalIntentSignals) * 100);
    const informationalPercent = 100 - commercialPercent;

    // 5. Geographic breakdown
    const geoResults: Array<{ region: string; label: string; growth_rate: number | null }> = [
      { region: 'US', label: 'США', growth_rate: geoUSResult.data?.growth_rate ?? null },
      { region: 'GB', label: 'Великобритания', growth_rate: geoGBResult.data?.growth_rate ?? null },
      { region: 'DE', label: 'Германия', growth_rate: geoDEResult.data?.growth_rate ?? null },
      { region: 'RU', label: 'Россия', growth_rate: geoRUResult.data?.growth_rate ?? null },
    ];
    // Only include regions with data
    const geoBreakdown = geoResults.filter(g => g.growth_rate !== null);

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
        github_repos: githubRepos.map(r => ({
          name: r.full_name,
          url: r.url,
          stars: r.stars,
          forks: r.forks,
          description: r.description,
          language: r.language,
          source: 'github' as const,
        })),
        indiehackers_posts: indieHackersPosts.map(p => ({
          title: p.title,
          url: p.url,
          snippet: p.snippet,
          source: 'indiehackers' as const,
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
      youtube_content: youtubeVideos.map(v => ({
        title: v.title,
        url: v.url,
        channel: v.channel,
        publishedAt: v.publishedAt,
        thumbnail: v.thumbnail,
        source: 'youtube' as const,
      })),
      google_autocomplete: autocompleteSuggestions.length > 0 ? {
        suggestions: autocompleteSuggestions.map(s => s.suggestion),
        total: autocompleteSuggestions.length,
      } : null,
      search_intent: {
        commercial_percent: commercialPercent,
        informational_percent: informationalPercent,
        commercial_signals: commercialCount,
        informational_signals: informationalCount,
        total_signals: allIntentSuggestions.length,
        intent_type: commercialPercent >= 60 ? 'commercial' as const
          : commercialPercent >= 40 ? 'mixed' as const
          : 'informational' as const,
      },
      geo_breakdown: geoBreakdown,
      verdict: demandVerdict,
      search_errors: [
        ...(trends12mResult.error ? [`google_trends_12m: ${trends12mResult.error}`] : []),
        ...(trends3mResult.error ? [`google_trends_3m: ${trends3mResult.error}`] : []),
        ...(phResult.error ? [`producthunt: ${phResult.error}`] : []),
        ...(hnResult.error ? [`hacker_news: ${hnResult.error}`] : []),
        ...(youtubeResult.error ? [`youtube: ${youtubeResult.error}`] : []),
        ...(githubResult.error ? [`github: ${githubResult.error}`] : []),
        ...(indieHackersResult.error ? [`indiehackers: ${indieHackersResult.error}`] : []),
      ],
      data_metadata: {
        growing_or_dying: { data_type: 'real_data', source: 'Google Trends via SerpAPI' },
        hype_or_stable: { data_type: 'calculated', formula: 'stability = 10 - (std_dev / mean * 10)' },
        new_players: { data_type: 'real_data', source: 'Product Hunt + Hacker News + GitHub + Indie Hackers + Google News' },
        youtube: { data_type: 'real_data', source: 'YouTube Data API' },
        google_autocomplete: { data_type: 'real_data', source: 'Google Autocomplete via SerpAPI' },
        search_intent: { data_type: 'calculated', formula: 'commercial_signals / (commercial + informational)' },
        geo_breakdown: { data_type: 'real_data', source: 'Google Trends via SerpAPI (geo-filtered)' },
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
