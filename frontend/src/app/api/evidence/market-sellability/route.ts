import { NextRequest, NextResponse } from 'next/server';
import {
  fetchReddit,
  fetchHackerNews,
  fetchG2Reviews,
  fetchCompetitorPricing,
  fetchGoogleSearch,
} from '@/lib/data-fetchers';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * Block 3: "Кому продать?"
 *
 * Вопросы:
 * 1. Кто платит — Reddit/HN обсуждения + G2 профили покупателей
 * 2. B2C/B2B/SMB/Enterprise — Сайты конкурентов (enterprise/teams/business)
 * 3. Средний чек — Pricing pages конкурентов (до 5)
 * 4. Цикл сделки — Сложность по отзывам (расчёт)
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

    // 1. Buyer discussions — who talks about paying for this
    const [
      buyerRedditResult,
      buyerHNResult,
      g2Result,
    ] = await Promise.all([
      fetchReddit(`${searchQuery} pricing OR buy OR subscribe OR paid`),
      fetchHackerNews(`${searchQuery} pricing`),
      fetchG2Reviews(searchQuery),
    ]);

    totalSerpApiCalls += buyerRedditResult.serpapi_calls_used;
    totalSerpApiCalls += buyerHNResult.serpapi_calls_used;
    totalSerpApiCalls += g2Result.serpapi_calls_used;

    // 2. Market segment detection — search for enterprise/teams/business keywords
    const segmentSearchResult = await fetchGoogleSearch(`${searchQuery} enterprise OR teams OR business pricing`);
    totalSerpApiCalls += segmentSearchResult.serpapi_calls_used;

    // Detect segment from search results
    const allSnippets = segmentSearchResult.data.map(r => `${r.title} ${r.snippet}`).join(' ').toLowerCase();
    let segmentType: 'B2C' | 'B2B' | 'SMB' | 'Enterprise' | 'Mixed' = 'Mixed';
    let segmentConfidence = 30;

    const enterpriseSignals = (allSnippets.match(/enterprise/g) || []).length;
    const businessSignals = (allSnippets.match(/business|b2b|saas/g) || []).length;
    const consumerSignals = (allSnippets.match(/personal|consumer|individual|free/g) || []).length;
    const smbSignals = (allSnippets.match(/small business|smb|startup/g) || []).length;

    const maxSignal = Math.max(enterpriseSignals, businessSignals, consumerSignals, smbSignals);

    if (maxSignal > 0) {
      if (enterpriseSignals === maxSignal) { segmentType = 'Enterprise'; segmentConfidence = 50 + enterpriseSignals * 10; }
      else if (businessSignals === maxSignal) { segmentType = 'B2B'; segmentConfidence = 50 + businessSignals * 10; }
      else if (consumerSignals === maxSignal) { segmentType = 'B2C'; segmentConfidence = 50 + consumerSignals * 10; }
      else if (smbSignals === maxSignal) { segmentType = 'SMB'; segmentConfidence = 50 + smbSignals * 10; }
    }
    segmentConfidence = Math.min(90, segmentConfidence);

    // 3. Average ticket — competitor pricing pages
    const competitorNames: string[] = context?.competition?.competitors?.map((c: { name: string }) => c.name).slice(0, 5) || [];
    const pricingResults = [];

    for (const name of competitorNames.slice(0, 3)) {
      const pricingResult = await fetchCompetitorPricing(name);
      totalSerpApiCalls += pricingResult.serpapi_calls_used;
      pricingResults.push(pricingResult);
    }

    // Extract price mentions from pricing results
    const priceExtracted: Array<{ competitor: string; price: string; url: string; plan_type: string }> = [];
    for (const pr of pricingResults) {
      for (const p of pr.prices_found) {
        priceExtracted.push({
          competitor: pr.competitor,
          price: p.amount,
          url: pr.pricing_url,
          plan_type: p.plan.toLowerCase().includes('enterprise') ? 'Enterprise' :
                     p.plan.toLowerCase().includes('pro') ? 'Pro' :
                     p.plan.toLowerCase().includes('team') ? 'Team' : 'Standard',
        });
      }
      // Also try to extract from pricing_snippet if no prices_found
      if (pr.prices_found.length === 0 && pr.pricing_snippet) {
        const priceMatch = pr.pricing_snippet.match(/\$(\d+(?:\.\d{2})?)\s*(?:\/|\s*per\s*)?(?:mo|month|yr|year|user)?/i);
        if (priceMatch) {
          priceExtracted.push({
            competitor: pr.competitor,
            price: priceMatch[0],
            url: pr.pricing_url,
            plan_type: 'Standard',
          });
        }
      }
    }

    // Calculate median price
    const priceValues = priceExtracted.map(p => {
      const num = parseFloat(p.price.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? 0 : num;
    }).filter(v => v > 0);

    let medianPrice: number | null = null;
    if (priceValues.length > 0) {
      priceValues.sort((a, b) => a - b);
      const mid = Math.floor(priceValues.length / 2);
      medianPrice = priceValues.length % 2 !== 0
        ? priceValues[mid]
        : (priceValues[mid - 1] + priceValues[mid]) / 2;
    }

    // 4. Sales cycle complexity
    const totalSignals = enterpriseSignals + businessSignals + consumerSignals + smbSignals;
    let salesComplexity: 'simple' | 'moderate' | 'complex' = 'moderate';
    if (segmentType === 'Enterprise' || (medianPrice && medianPrice > 500)) {
      salesComplexity = 'complex';
    } else if (segmentType === 'B2C' || (medianPrice && medianPrice < 50)) {
      salesComplexity = 'simple';
    }

    // === VERDICT ===
    const buyerDataPoints = buyerRedditResult.data.length + buyerHNResult.data.length + g2Result.data.length;
    let verdictValue = 5; // baseline
    if (buyerDataPoints > 10) verdictValue += 2;
    else if (buyerDataPoints > 5) verdictValue += 1;
    if (priceExtracted.length > 3) verdictValue += 2;
    else if (priceExtracted.length > 0) verdictValue += 1;
    if (segmentConfidence > 70) verdictValue += 1;
    verdictValue = Math.min(10, Math.max(1, verdictValue));

    const verdictConfidence = Math.min(90, 20 + buyerDataPoints * 3 + priceExtracted.length * 5 + (segmentConfidence > 50 ? 10 : 0));

    const result = {
      who_pays: {
        buyer_discussions: [
          ...buyerRedditResult.data.map(r => ({
            text: r.title,
            source: 'reddit' as const,
            source_url: r.url,
            engagement: r.score,
          })),
          ...buyerHNResult.data.map(h => ({
            text: h.title,
            source: 'hacker_news' as const,
            source_url: h.url,
            engagement: h.points,
          })),
        ],
        buyer_profiles: g2Result.data.map(g => ({
          text: g.title,
          source: 'g2' as const,
          source_url: g.url,
          rating: 'rating' in g ? (g as { rating?: number }).rating : undefined,
        })),
        total_data_points: buyerDataPoints,
      },
      market_segment: {
        segment_type: segmentType,
        confidence: segmentConfidence,
        signals: {
          enterprise: enterpriseSignals,
          b2b: businessSignals,
          b2c: consumerSignals,
          smb: smbSignals,
          total: totalSignals,
        },
        evidence_urls: segmentSearchResult.data.slice(0, 3).map(r => ({
          title: r.title,
          url: r.url,
        })),
      },
      average_ticket: {
        competitor_prices: priceExtracted,
        median_price: medianPrice,
        price_count: priceExtracted.length,
      },
      sales_cycle: {
        complexity: salesComplexity,
        reasoning: salesComplexity === 'complex'
          ? 'Enterprise сегмент или высокий средний чек (>$500/мес)'
          : salesComplexity === 'simple'
            ? 'B2C сегмент или низкий чек (<$50/мес)'
            : 'Средний уровень сложности продажи',
      },
      verdict: {
        value: verdictValue,
        data_type: 'calculated' as const,
        formula: 'base(5) + buyer_data_bonus + pricing_bonus + segment_clarity_bonus',
        inputs: [
          `buyer_data_points=${buyerDataPoints}`,
          `prices_found=${priceExtracted.length}`,
          `segment_confidence=${segmentConfidence}%`,
        ],
        confidence: verdictConfidence,
      },
      data_metadata: {
        who_pays: { data_type: 'real_data', source: 'Reddit + HN + G2' },
        market_segment: { data_type: 'calculated', note: 'Keyword frequency analysis from search results' },
        average_ticket: { data_type: 'real_data', source: 'Competitor pricing pages' },
        sales_cycle: { data_type: 'calculated', note: 'Based on segment + price level' },
      },
      serpapi_calls_used: totalSerpApiCalls,
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({ success: true, data: result });

  } catch (error) {
    console.error('Market Sellability API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
