import { NextRequest, NextResponse } from 'next/server';
import {
  fetchKeywordCPC,
  fetchCompetitorPricing,
  fetchGoogleSearch,
  fetchGoogleTrends,
  discoverCompetitors,
} from '@/lib/data-fetchers';
import {
  calcEstimatedCac,
  calcEstimatedLtv,
  calcLtvCacRatio,
  calcScalabilityScore,
} from '@/lib/evidence-calculations';

/**
 * Block 5: "Экономика сходится?"
 *
 * Вопросы:
 * 1. CAC — SEM keyword CPC через SerpAPI
 * 2. LTV — Цены конкурентов из context
 * 3. Повторные продажи — Бизнес-модель конкурентов
 * 4. Масштабируемость — Размер рынка из Trends + market signals
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

    // Generate keyword variants for CPC
    const keywords = [
      searchQuery,
      `${searchQuery} software`,
      `${searchQuery} tool`,
    ];

    // Fetch CPC data + competitor pricing + market size signals in parallel
    let competitorNames: string[] = context?.competition?.competitors?.map((c: { name: string }) => c.name).slice(0, 3) || [];

    // Fallback: discover competitors via Google Search + GPT if none in context
    if (competitorNames.length === 0) {
      const discovered = await discoverCompetitors(searchQuery, 5);
      totalSerpApiCalls += discovered.serpapi_calls_used;
      competitorNames = discovered.competitors.map(c => c.name).slice(0, 3);
    }

    const [
      cpcResult1,
      cpcResult2,
      marketSizeResult,
      trendsResult,
    ] = await Promise.all([
      fetchKeywordCPC(keywords[0]),
      fetchKeywordCPC(keywords[1]),
      fetchGoogleSearch(`${searchQuery} market size OR TAM OR industry report`),
      fetchGoogleTrends(searchQuery),
    ]);

    totalSerpApiCalls += cpcResult1.serpapi_calls_used;
    totalSerpApiCalls += cpcResult2.serpapi_calls_used;
    totalSerpApiCalls += marketSizeResult.serpapi_calls_used;
    totalSerpApiCalls += trendsResult.serpapi_calls_used;

    // Fetch competitor pricing
    const pricingResults: Array<{
      competitor: string;
      pricing_url: string;
      pricing_snippet: string;
      prices_found: Array<{ amount: string; plan: string; period: string }>;
      serpapi_calls_used: number;
    }> = [];
    for (const name of competitorNames.slice(0, 3)) {
      const pricingResult = await fetchCompetitorPricing(name);
      totalSerpApiCalls += pricingResult.serpapi_calls_used;
      pricingResults.push(pricingResult);
    }

    // Detect business model from competitor search results
    const businessModelResult = await fetchGoogleSearch(`${searchQuery} subscription OR SaaS OR freemium OR one-time purchase`);
    totalSerpApiCalls += businessModelResult.serpapi_calls_used;

    // === CALCULATIONS (NO GPT) ===

    // 1. CAC estimation from CPC data
    const allCpcData = [cpcResult1, cpcResult2].filter(d => !d.error);
    const cpcValues = allCpcData.map(d => d.cpc).filter(v => v > 0);

    const estimatedCac = calcEstimatedCac(cpcValues);

    const keywordCpcDetails = allCpcData.map(d => ({
      keyword: d.keyword,
      cpc: d.cpc,
      currency: d.currency,
      volume: d.volume,
      source_url: d.source_url,
    }));

    // 2. LTV estimation from competitor pricing
    const monthlyPrices: number[] = [];
    const competitorPriceDetails: Array<{ competitor: string; monthly_price: number; annual_price?: number }> = [];

    for (const pr of pricingResults) {
      for (const p of pr.prices_found) {
        const priceNum = parseFloat(p.amount.replace(/[^0-9.]/g, ''));
        if (priceNum > 0 && priceNum < 10000) {
          // Determine if monthly or annual
          const isAnnual = (p.period === 'yr') || /yr|year|annual/i.test(p.plan);
          if (isAnnual) {
            const monthlyEquiv = priceNum / 12;
            if (!monthlyPrices.some(mp => Math.abs(mp - monthlyEquiv) < 1)) {
              monthlyPrices.push(monthlyEquiv);
              competitorPriceDetails.push({
                competitor: pr.competitor,
                monthly_price: monthlyEquiv,
                annual_price: priceNum,
              });
            }
          } else {
            monthlyPrices.push(priceNum);
            competitorPriceDetails.push({
              competitor: pr.competitor,
              monthly_price: priceNum,
            });
          }
        }
      }
      // Also try parsing from pricing_snippet if no structured prices found
      if (pr.prices_found.length === 0 && pr.pricing_snippet) {
        const priceMatch = pr.pricing_snippet.match(/\$(\d+(?:\.\d{2})?)\s*(?:\/?\s*(?:mo|month))/i);
        if (priceMatch) {
          const price = parseFloat(priceMatch[1]);
          if (price > 0 && price < 10000) {
            monthlyPrices.push(price);
            competitorPriceDetails.push({
              competitor: pr.competitor,
              monthly_price: price,
            });
          }
        }
      }
    }

    // 3. Market Size Indicators (REPLACES LTV!)
    // Call our new market-size API to get real revenue data
    const marketSizeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/evidence/market-size`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        competitors: competitorNames,
        existing_pricing: competitorNames.reduce((acc: Record<string, { range: string; typical_price: string; source_url: string }>, name: string, idx: number) => {
          const pr = pricingResults[idx];
          if (pr && pr.prices_found.length > 0) {
            const prices = pr.prices_found.map(p => parseFloat(p.amount.replace(/[^0-9.]/g, ''))).filter(p => p > 0);
            const typical = prices.length > 0 ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : null;
            if (typical) {
              acc[name] = {
                range: `$${Math.min(...prices)}-${Math.max(...prices)}/mo`,
                typical_price: `$${typical}/mo`,
                source_url: pr.pricing_url || '',
              };
            }
          }
          return acc;
        }, {}),
      }),
    });

    const marketSizeData = marketSizeResponse.ok ? await marketSizeResponse.json() : null;

    // 4. Calculate average price for LTV/CAC ratio (use median from competitors)
    const avgMonthlyPrice = monthlyPrices.length > 0
      ? monthlyPrices.sort((a, b) => a - b)[Math.floor(monthlyPrices.length / 2)]
      : 0;
    const estimatedLtvForRatio = avgMonthlyPrice * 24; // Assume 24-month lifetime for ratio

    const ltvCacRatio = calcLtvCacRatio(estimatedLtvForRatio, estimatedCac.value);

    // 4. Business model detection
    const modelSnippets = businessModelResult.data.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
    const subscriptionSignals = (modelSnippets.match(/subscription|monthly|annual plan|saas|recurring/g) || []).length;
    const oneTimeSignals = (modelSnippets.match(/one-time|lifetime|perpetual|single purchase/g) || []).length;
    const freemiumSignals = (modelSnippets.match(/freemium|free plan|free tier|free version/g) || []).length;
    const marketplaceSignals = (modelSnippets.match(/marketplace|commission|transaction fee/g) || []).length;

    let businessModel: 'subscription' | 'one-time' | 'freemium' | 'marketplace' | 'unknown' = 'unknown';
    const maxModel = Math.max(subscriptionSignals, oneTimeSignals, freemiumSignals, marketplaceSignals);
    if (maxModel > 0) {
      if (subscriptionSignals === maxModel) businessModel = 'subscription';
      else if (freemiumSignals === maxModel) businessModel = 'freemium';
      else if (oneTimeSignals === maxModel) businessModel = 'one-time';
      else if (marketplaceSignals === maxModel) businessModel = 'marketplace';
    }

    const isSubscription = businessModel === 'subscription' || businessModel === 'freemium';

    // 5. Scalability
    const trendGrowth = trendsResult.data ? trendsResult.data.growth_rate : 0;
    const marketSizeSignals = marketSizeResult.data.length;

    const scalabilityScore = calcScalabilityScore(marketSizeSignals, trendGrowth, isSubscription);

    // === VERDICT ===
    let verdictValue = 5;
    if (ltvCacRatio.value >= 7) verdictValue += 2;
    else if (ltvCacRatio.value >= 4) verdictValue += 1;
    else if (ltvCacRatio.value <= 2 && ltvCacRatio.value > 0) verdictValue -= 1;

    if (scalabilityScore.value >= 7) verdictValue += 2;
    else if (scalabilityScore.value >= 5) verdictValue += 1;

    if (isSubscription) verdictValue += 1;

    verdictValue = Math.min(10, Math.max(1, verdictValue));

    const dataPointsCount = cpcValues.length + monthlyPrices.length + marketSizeSignals;
    const verdictConfidence = Math.min(90, 15 + dataPointsCount * 5 + (ltvCacRatio.value > 0 ? 15 : 0));

    const result = {
      cac: {
        keyword_cpc: keywordCpcDetails,
        estimated_cac: estimatedCac,
        cpc_data_points: cpcValues.length,
      },
      market_size_indicators: marketSizeData || {
        competitors: [],
        total_market_revenue: null,
        total_estimated_customers: null,
        largest_player: null,
        data_quality: 'low',
        sources_count: 0,
      },
      ltv_cac_ratio: ltvCacRatio,
      repeat_sales: {
        business_model: businessModel,
        signals: {
          subscription: subscriptionSignals,
          one_time: oneTimeSignals,
          freemium: freemiumSignals,
          marketplace: marketplaceSignals,
        },
        evidence: businessModelResult.data.slice(0, 3).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
          source: 'google_search' as const,
        })),
      },
      scalability: {
        market_size_signals: marketSizeResult.data.slice(0, 5).map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet,
        })),
        trend_growth: trendGrowth,
        scalability_score: scalabilityScore,
      },
      verdict: {
        value: verdictValue,
        data_type: 'calculated' as const,
        formula: 'base(5) + ltv_cac_bonus + scalability_bonus + subscription_bonus',
        inputs: [
          `ltv_cac_ratio=${ltvCacRatio.value}`,
          `scalability=${scalabilityScore.value}`,
          `business_model=${businessModel}`,
          `trend_growth=${trendGrowth}%`,
        ],
        confidence: verdictConfidence,
      },
      data_metadata: {
        cac: { data_type: cpcValues.length > 0 ? 'calculated' : 'no_data', source: 'Google Ads CPC via SerpAPI' },
        market_size: {
          data_type: marketSizeData && marketSizeData.sources_count > 0 ? 'actual_and_estimated' : 'no_data',
          source: 'SEC filings, press releases, LinkedIn, competitor pricing',
          note: 'Public companies: actual data. Private companies: estimates based on employees and pricing.',
        },
        ltv_cac_ratio: { data_type: (cpcValues.length > 0 && monthlyPrices.length > 0) ? 'calculated' : 'no_data' },
        business_model: { data_type: 'calculated', note: 'Keyword frequency analysis' },
        scalability: { data_type: 'calculated', formula: 'base(5) + trend_bonus + market_signals_bonus + subscription_bonus' },
      },
      serpapi_calls_used: totalSerpApiCalls,
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Unit Economics API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
