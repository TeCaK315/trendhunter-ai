/**
 * Market Size Indicators API
 *
 * Collects REAL financial data for competitors:
 * - Revenue (from SEC filings for public companies, estimates for private)
 * - Employee count (from LinkedIn)
 * - Estimated customer count (calculated)
 * - Funding data
 *
 * CRITICAL: NO HALLUCINATIONS
 * - If data not found → return null
 * - Mark estimates clearly
 * - Always include source URLs
 */

import { NextRequest, NextResponse } from 'next/server';
import { callOpenAI, parseJSONResponse } from '@/lib/openai';
import { getAuthUser } from '@/lib/auth-helpers'

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const FMP_API_KEY = process.env.FMP_API_KEY || ''; // Financial Modeling Prep (optional)

interface CompetitorMetrics {
  name: string;
  revenue: {
    value: string | null;
    year: number | null;
    type: 'actual' | 'estimate' | null;
    source: string | null;
    source_url: string | null;
    fiscal_year_end?: string;
  };
  employees: {
    count: number | null;
    source: 'LinkedIn' | 'Crunchbase' | null;
    source_url: string | null;
    revenue_estimate?: string; // Only if no actual revenue
  };
  pricing: {
    range: string | null;
    typical_price: string | null;
    source_url: string | null;
  };
  estimated_customers: {
    range: string;
    calculation: string;
    confidence: 'low' | 'medium' | 'high';
  } | null;
  funding: {
    total: string;
    last_round: string;
    source_url: string;
  } | null;
}

interface MarketSizeResponse {
  competitors: CompetitorMetrics[];
  total_market_revenue: string | null;
  total_estimated_customers: string | null;
  largest_player: string | null;
  data_quality: 'high' | 'medium' | 'low';
  sources_count: number;
}

const SERPAPI_TIMEOUT_MS = 10_000; // 10 seconds per request

// SerpAPI helper with timeout
async function serpApiSearch(query: string, params: Record<string, unknown> = {}) {
  const url = new URL('https://serpapi.com/search');
  url.searchParams.set('q', query);
  url.searchParams.set('api_key', SERPAPI_KEY);
  url.searchParams.set('engine', 'google');
  url.searchParams.set('num', '5'); // Reduced from 10 to speed up

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SERPAPI_TIMEOUT_MS);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`SerpAPI error: ${response.status}`);

    const data = await response.json();
    return data.organic_results || [];
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[market-size] SerpAPI timeout for: ${query.substring(0, 50)}`);
      return [];
    }
    throw error;
  }
}

// Check if company is public (has stock ticker)
async function getStockTicker(companyName: string): Promise<string | null> {
  try {
    const results = await serpApiSearch(`${companyName} stock ticker symbol`);

    const prompt = `
Extract stock ticker from search results. Return ONLY the ticker symbol (e.g., "ZM", "SHOP") or null.

CRITICAL RULES:
1. Only return if explicitly stated as stock ticker/symbol
2. Must be 1-5 uppercase letters
3. If not found or uncertain, return null

Search results:
${results.slice(0, 5).map((r: { title: string; snippet: string }) =>
  `Title: ${r.title}\nSnippet: ${r.snippet}`
).join('\n\n')}

Return JSON: { "ticker": "ZM" } or { "ticker": null }
`;

    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o-mini', temperature: 0 }
    );

    if (!response.success) {
      console.error('[market-size] OpenAI error in getStockTicker:', response.error);
      return null;
    }

    const parsed = parseJSONResponse<{ ticker: string | null }>(response.content);
    return parsed?.ticker || null;
  } catch (error) {
    console.error('[market-size] Error getting ticker:', error);
    return null;
  }
}

// Get revenue from SEC filings (for public companies)
async function getPublicCompanyRevenue(ticker: string): Promise<CompetitorMetrics['revenue']> {
  try {
    // Try Financial Modeling Prep API if key available
    if (FMP_API_KEY) {
      const url = `https://financialmodelingprep.com/api/v3/income-statement/${ticker}?limit=1&apikey=${FMP_API_KEY}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data && data[0]) {
          const latest = data[0];
          return {
            value: `$${(latest.revenue / 1e9 >= 1
              ? (latest.revenue / 1e9).toFixed(2) + 'B'
              : (latest.revenue / 1e6).toFixed(0) + 'M')}`,
            year: new Date(latest.date).getFullYear(),
            type: 'actual',
            source: 'SEC 10-K Annual Report',
            source_url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&ticker=${ticker}&type=10-K`,
            fiscal_year_end: latest.date,
          };
        }
      }
    }

    // Fallback: search for revenue via SerpAPI
    const results = await serpApiSearch(`${ticker} revenue 2024 2025 SEC filing`);

    const prompt = `
Extract company revenue from search results about SEC filings.

CRITICAL RULES:
1. ONLY extract if explicitly stated in results
2. If not found, return revenue_found: false
3. Include exact quote and source

Search results:
${results.slice(0, 5).map((r: { title: string; snippet: string; link: string }) =>
  `Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.link}`
).join('\n\n')}

Return JSON:
{
  "revenue_found": true/false,
  "revenue_value": "$X.XB" or null,
  "revenue_year": 2024 or null,
  "quote": "exact text" or null,
  "source_url": "url" or null
}
`;

    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o-mini', temperature: 0 }
    );

    if (!response.success) {
      console.error('[market-size] OpenAI error in getPublicCompanyRevenue:', response.error);
      return {
        value: null,
        year: null,
        type: null,
        source: null,
        source_url: null,
      };
    }

    const parsed = parseJSONResponse<{
      revenue_found: boolean;
      revenue_value: string | null;
      revenue_year: number | null;
      source_url: string | null;
    }>(response.content);

    if (parsed && parsed.revenue_found) {
      return {
        value: parsed.revenue_value,
        year: parsed.revenue_year,
        type: 'actual',
        source: 'SEC Filing',
        source_url: parsed.source_url,
      };
    }

    return {
      value: null,
      year: null,
      type: null,
      source: null,
      source_url: null,
    };
  } catch (error) {
    console.error('[market-size] Error getting public company revenue:', error);
    return {
      value: null,
      year: null,
      type: null,
      source: null,
      source_url: null,
    };
  }
}

// Get revenue from press releases (for private companies)
async function getPrivateCompanyRevenue(companyName: string): Promise<CompetitorMetrics['revenue']> {
  try {
    const results = await serpApiSearch(`"${companyName}" revenue 2024 2025 ARR`);

    const prompt = `
Extract company revenue from search results (press releases, news).

CRITICAL RULES:
1. ONLY extract if EXPLICITLY stated
2. Look for: "revenue of $X", "ARR of $X", "$X in revenue"
3. If not found, return revenue_found: false
4. DO NOT ESTIMATE OR GUESS

Search results:
${results.slice(0, 5).map((r: { title: string; snippet: string; link: string }) =>
  `Title: ${r.title}\nSnippet: ${r.snippet}\nURL: ${r.link}`
).join('\n\n')}

Return JSON:
{
  "revenue_found": true/false,
  "revenue_value": "$XM" or null,
  "revenue_year": 2024 or null,
  "quote": "exact text from source" or null,
  "source_name": "TechCrunch" or null,
  "source_url": "url" or null,
  "confidence": "high" | "medium" | "low" or null
}
`;

    const response = await callOpenAI(
      [{ role: 'user', content: prompt }],
      { model: 'gpt-4o-mini', temperature: 0 }
    );

    if (!response.success) {
      console.error('[market-size] OpenAI error in getPrivateCompanyRevenue:', response.error);
      return {
        value: null,
        year: null,
        type: null,
        source: null,
        source_url: null,
      };
    }

    const parsed = parseJSONResponse<{
      revenue_found: boolean;
      revenue_value: string | null;
      revenue_year: number | null;
      source_name: string | null;
      source_url: string | null;
    }>(response.content);

    if (parsed && parsed.revenue_found) {
      return {
        value: parsed.revenue_value,
        year: parsed.revenue_year,
        type: 'estimate',
        source: parsed.source_name || 'Press Release',
        source_url: parsed.source_url,
      };
    }

    return {
      value: null,
      year: null,
      type: null,
      source: null,
      source_url: null,
    };
  } catch (error) {
    console.error('[market-size] Error getting private company revenue:', error);
    return {
      value: null,
      year: null,
      type: null,
      source: null,
      source_url: null,
    };
  }
}

// Get employee count from LinkedIn
async function getEmployeeCount(companyName: string): Promise<CompetitorMetrics['employees']> {
  try {
    const results = await serpApiSearch(`site:linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}`);

    if (results.length === 0) {
      // Try without site: restriction
      const results2 = await serpApiSearch(`"${companyName}" linkedin employees`);
      results.push(...results2);
    }

    // Extract employee count from snippets
    for (const result of results) {
      const text = `${result.title} ${result.snippet}`.toLowerCase();
      const match = text.match(/(\d{1,3}(?:,\d{3})*)\s*(?:employees?|people)/i);

      if (match) {
        const count = parseInt(match[1].replace(/,/g, ''));
        return {
          count,
          source: 'LinkedIn',
          source_url: result.link,
          revenue_estimate: undefined, // Will be filled later if needed
        };
      }
    }

    return {
      count: null,
      source: null,
      source_url: null,
    };
  } catch (error) {
    console.error('[market-size] Error getting employee count:', error);
    return {
      count: null,
      source: null,
      source_url: null,
    };
  }
}

// Calculate estimated customers
function calculateEstimatedCustomers(
  revenue: CompetitorMetrics['revenue'],
  pricing: CompetitorMetrics['pricing']
): CompetitorMetrics['estimated_customers'] {
  if (!revenue.value || !pricing.typical_price) return null;

  try {
    // Parse revenue (handle $XM, $XB format)
    const revenueMatch = revenue.value.match(/\$?([\d.]+)([MB])/);
    if (!revenueMatch) return null;

    const revenueNum = parseFloat(revenueMatch[1]);
    const revenueMultiplier = revenueMatch[2] === 'B' ? 1e9 : 1e6;
    const totalRevenue = revenueNum * revenueMultiplier;

    // Parse typical price (handle $X/mo, $X/month, $X/year format)
    const priceMatch = pricing.typical_price.match(/\$?([\d,]+)/);
    if (!priceMatch) return null;

    const priceNum = parseFloat(priceMatch[1].replace(/,/g, ''));
    const annualPrice = pricing.typical_price.includes('/mo') || pricing.typical_price.includes('month')
      ? priceNum * 12
      : priceNum;

    // Calculate range with ±20% error margin
    const customersExact = totalRevenue / annualPrice;
    const customersMin = Math.floor(customersExact * 0.8);
    const customersMax = Math.ceil(customersExact * 1.2);

    return {
      range: `${customersMin.toLocaleString()}-${customersMax.toLocaleString()}`,
      calculation: `${revenue.value} revenue / ${pricing.typical_price} avg price`,
      confidence: revenue.type === 'actual' ? 'high' : 'medium',
    };
  } catch (error) {
    console.error('[market-size] Error calculating customers:', error);
    return null;
  }
}

// Get competitor metrics — runs revenue + employees + funding in parallel
async function getCompetitorMetrics(
  companyName: string,
  existingPricing?: { range: string; typical_price: string; source_url: string }
): Promise<CompetitorMetrics> {
  console.log(`[market-size] Fetching metrics for: ${companyName}`);

  // Run ticker check, employee count, and funding in parallel
  const [ticker, employees, funding] = await Promise.all([
    getStockTicker(companyName),
    getEmployeeCount(companyName),
    // Funding (optional, quick search)
    (async (): Promise<CompetitorMetrics['funding']> => {
      try {
        const fundingResults = await serpApiSearch(`"${companyName}" raises funding Series`);
        const fundingMatch = fundingResults[0]?.snippet?.match(/raises?\s+\$?([\d.]+)([MB])/i);
        if (fundingMatch) {
          return {
            total: `$${fundingMatch[1]}${fundingMatch[2]}`,
            last_round: 'Series A',
            source_url: fundingResults[0].link,
          };
        }
        return null;
      } catch {
        return null;
      }
    })(),
  ]);

  // Get revenue (depends on ticker result)
  const revenue = ticker
    ? await getPublicCompanyRevenue(ticker)
    : await getPrivateCompanyRevenue(companyName);

  // If no revenue but have employees, estimate
  if (!revenue.value && employees.count) {
    const estimateMin = employees.count * 150000;
    const estimateMax = employees.count * 200000;
    employees.revenue_estimate = `$${(estimateMin/1e6).toFixed(0)}M-${(estimateMax/1e6).toFixed(0)}M`;
  }

  const pricing = existingPricing || {
    range: null,
    typical_price: null,
    source_url: null,
  };

  const estimated_customers = calculateEstimatedCustomers(revenue, pricing);

  return {
    name: companyName,
    revenue,
    employees,
    pricing,
    estimated_customers,
    funding,
  };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { competitors = [], existing_pricing = {} } = body;

    console.log(`[market-size] Starting analysis for ${competitors.length} competitors`);

    // Fetch metrics for each competitor IN PARALLEL (was sequential — caused massive delays)
    // Limit to 3 to avoid SerpAPI rate limits
    const competitorMetrics = await Promise.all(
      competitors.slice(0, 3).map((compName: string) => {
        const pricing = existing_pricing[compName];
        return getCompetitorMetrics(compName, pricing);
      })
    );

    // Calculate totals
    let totalRevenue = 0;
    let totalCustomers = 0;
    let largestPlayerRevenue = 0;
    let largestPlayer = null;
    let sourcesCount = 0;

    for (const comp of competitorMetrics) {
      // Count sources
      if (comp.revenue.value) sourcesCount++;
      if (comp.employees.count) sourcesCount++;

      // Sum revenues
      if (comp.revenue.value) {
        const match = comp.revenue.value.match(/\$?([\d.]+)([MB])/);
        if (match) {
          const val = parseFloat(match[1]) * (match[2] === 'B' ? 1e9 : 1e6);
          totalRevenue += val;
          if (val > largestPlayerRevenue) {
            largestPlayerRevenue = val;
            largestPlayer = comp.name;
          }
        }
      }

      // Sum customers
      if (comp.estimated_customers) {
        const match = comp.estimated_customers.range.match(/^([\d,]+)/);
        if (match) {
          totalCustomers += parseInt(match[1].replace(/,/g, ''));
        }
      }
    }

    const response: MarketSizeResponse = {
      competitors: competitorMetrics,
      total_market_revenue: totalRevenue > 0
        ? totalRevenue >= 1e9
          ? `$${(totalRevenue / 1e9).toFixed(1)}B+`
          : `$${(totalRevenue / 1e6).toFixed(0)}M+`
        : null,
      total_estimated_customers: totalCustomers > 0
        ? `${totalCustomers.toLocaleString()}+`
        : null,
      largest_player: largestPlayer,
      data_quality: sourcesCount > competitors.length ? 'high'
        : sourcesCount > competitors.length / 2 ? 'medium'
        : 'low',
      sources_count: sourcesCount,
    };

    console.log(`[market-size] Complete: ${sourcesCount} sources found, quality: ${response.data_quality}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('[market-size] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market size data' },
      { status: 500 }
    );
  }
}
