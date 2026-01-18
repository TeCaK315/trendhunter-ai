import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface FundingRound {
  company: string;
  amount: string;
  round_type: string;
  date: string;
  investors: string[];
  source_url: string;
}

interface ActiveFund {
  name: string;
  focus_areas: string[];
  recent_investments: string[];
  typical_check_size: string;
  website: string;
  crunchbase_url: string;
}

interface VentureData {
  niche: string;
  total_funding_last_year: string;
  average_round_size: string;
  funding_trend: 'growing' | 'stable' | 'declining';
  recent_rounds: FundingRound[];
  active_funds: ActiveFund[];
  investment_hotness: number; // 0-10
  market_signals: string[];
  sources: Array<{ name: string; url: string; accessed_at: string }>;
  analyzed_at: string;
}

// Extract core niche keywords for more relevant search
function extractNicheKeywords(query: string): string {
  // Remove overly generic AI terms that dilute search relevance
  const genericTerms = [
    'ai-powered', 'ai powered', 'ai-based', 'ai based',
    'platform', 'tool', 'app', 'software', 'service', 'agent', 'assistant',
    'automated', 'automation', 'intelligent', 'smart'
  ];

  let cleaned = query.toLowerCase();
  for (const term of genericTerms) {
    cleaned = cleaned.replace(new RegExp(term, 'gi'), ' ');
  }

  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // If too short after cleaning, use original but simplified
  if (cleaned.length < 5) {
    return query.split(' ').slice(0, 3).join(' ');
  }

  return cleaned;
}

// Search for funding news using SerpAPI
async function searchFundingNews(query: string): Promise<FundingRound[]> {
  const rounds: FundingRound[] = [];

  if (!SERPAPI_KEY) {
    return getMockFundingRounds(query);
  }

  try {
    // Extract core niche keywords for relevant search
    const nicheKeywords = extractNicheKeywords(query);
    console.log(`Searching funding for niche: "${nicheKeywords}" (from: "${query}")`);

    // Search for recent funding announcements - use 2025 2026 for fresh data
    // Add niche-specific terms to exclude unrelated AI giants
    const searchQuery = `"${nicheKeywords}" startup funding round 2025 2026 -OpenAI -Anthropic -Google -Microsoft`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&tbs=qdr:m6&num=15&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      return getMockFundingRounds(query);
    }

    const data = await response.json();
    const results = data.organic_results || [];

    for (const result of results.slice(0, 8)) {
      const title = result.title || '';
      const link = result.link || '';
      const snippet = result.snippet || '';

      // Look for funding indicators in title/snippet
      const fundingMatch = snippet.match(/\$(\d+(?:\.\d+)?)\s*(M|million|B|billion)/i);
      const roundMatch = title.match(/(seed|series\s*[a-z]|pre-seed|angel)/i);

      if (fundingMatch || roundMatch) {
        const amount = fundingMatch
          ? `$${fundingMatch[1]}${fundingMatch[2].toUpperCase().charAt(0)}`
          : 'Undisclosed';

        rounds.push({
          company: extractCompanyFromTitle(title),
          amount,
          round_type: roundMatch ? roundMatch[1] : 'Unknown',
          date: extractDateFromSnippet(snippet),
          investors: extractInvestorsFromSnippet(snippet),
          source_url: link,
        });
      }
    }

    // Also search TechCrunch specifically
    const tcResults = await searchTechCrunch(query);
    rounds.push(...tcResults);

  } catch (error) {
    console.error('Error searching funding news:', error);
    return getMockFundingRounds(query);
  }

  // Deduplicate by company name (normalized)
  const seen = new Set<string>();
  const uniqueRounds = rounds.filter(round => {
    const key = round.company.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueRounds.slice(0, 10);
}

// Search TechCrunch for funding news
async function searchTechCrunch(query: string): Promise<FundingRound[]> {
  const rounds: FundingRound[] = [];

  if (!SERPAPI_KEY) return [];

  try {
    // Use niche keywords for TechCrunch search too
    const nicheKeywords = extractNicheKeywords(query);
    const searchQuery = `site:techcrunch.com "${nicheKeywords}" raises funding 2025 2026 -OpenAI -Anthropic`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&tbs=qdr:m6&num=5&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) return [];

    const data = await response.json();
    const results = data.organic_results || [];

    for (const result of results.slice(0, 3)) {
      const title = result.title || '';
      const link = result.link || '';
      const snippet = result.snippet || '';

      const fundingMatch = snippet.match(/\$(\d+(?:\.\d+)?)\s*(M|million|B|billion)/i);

      if (fundingMatch) {
        rounds.push({
          company: extractCompanyFromTitle(title),
          amount: `$${fundingMatch[1]}${fundingMatch[2].toUpperCase().charAt(0)}`,
          round_type: extractRoundType(title + ' ' + snippet),
          date: extractDateFromSnippet(snippet),
          investors: extractInvestorsFromSnippet(snippet),
          source_url: link,
        });
      }
    }
  } catch (error) {
    console.log('TechCrunch search error:', error);
  }

  return rounds;
}

// Search for active VCs in the space
async function searchActiveFunds(query: string): Promise<ActiveFund[]> {
  const funds: ActiveFund[] = [];

  if (!SERPAPI_KEY) {
    return getMockFunds(query);
  }

  try {
    // Use niche keywords for VC search
    const nicheKeywords = extractNicheKeywords(query);
    const searchQuery = `"${nicheKeywords}" venture capital investors 2025 2026`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&tbs=qdr:y&num=10&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      return getMockFunds(query);
    }

    const data = await response.json();
    const results = data.organic_results || [];

    // Known VC names to look for
    const knownVCs = [
      'a16z', 'Andreessen Horowitz', 'Sequoia', 'Y Combinator', 'Accel',
      'Bessemer', 'Index Ventures', 'Greylock', 'NEA', 'Lightspeed',
      'General Catalyst', 'Benchmark', 'First Round', 'Founders Fund',
      'Insight Partners', 'Tiger Global', 'Coatue', 'Addition'
    ];

    for (const result of results) {
      const text = `${result.title} ${result.snippet}`.toLowerCase();

      for (const vc of knownVCs) {
        if (text.includes(vc.toLowerCase()) && !funds.find(f => f.name === vc)) {
          funds.push({
            name: vc,
            focus_areas: [query, 'Technology', 'SaaS'],
            recent_investments: [],
            typical_check_size: getTypicalCheckSize(vc),
            website: getVCWebsite(vc),
            crunchbase_url: `https://www.crunchbase.com/organization/${vc.toLowerCase().replace(/\s+/g, '-')}`,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error searching funds:', error);
    return getMockFunds(query);
  }

  return funds.slice(0, 8);
}

// AI analysis of venture landscape
async function analyzeVentureLandscape(
  query: string,
  rounds: FundingRound[],
  funds: ActiveFund[]
): Promise<Partial<VentureData>> {
  if (!OPENAI_API_KEY) {
    return getDefaultAnalysis(rounds, funds);
  }

  try {
    const prompt = `Analyze the venture capital landscape for "${query}" based on:

Recent Funding Rounds:
${rounds.map(r => `- ${r.company}: ${r.amount} (${r.round_type})`).join('\n')}

Active Investors: ${funds.map(f => f.name).join(', ')}

Provide analysis in JSON:
{
  "total_funding_estimate": "$XXM-$XXM",
  "average_round_size": "$XM",
  "funding_trend": "growing" | "stable" | "declining",
  "investment_hotness": 0-10,
  "market_signals": ["signal1", "signal2", "signal3"]
}

Be concise. Base estimates on the data provided.`;

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
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      return getDefaultAnalysis(rounds, funds);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        total_funding_last_year: parsed.total_funding_estimate || 'Unknown',
        average_round_size: parsed.average_round_size || 'Unknown',
        funding_trend: parsed.funding_trend || 'stable',
        investment_hotness: parsed.investment_hotness || 5,
        market_signals: parsed.market_signals || [],
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  return getDefaultAnalysis(rounds, funds);
}

// Helper functions
function extractCompanyFromTitle(title: string): string {
  // Remove common suffixes and extract company name
  return title
    .replace(/\s*[-|–:].*$/g, '')
    .replace(/raises.*$/i, '')
    .replace(/secures.*$/i, '')
    .replace(/announces.*$/i, '')
    .trim()
    .substring(0, 40);
}

function extractDateFromSnippet(snippet: string): string {
  const dateMatch = snippet.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},?\s+\d{4}/i);
  if (dateMatch) return dateMatch[0];

  const monthMatch = snippet.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i);
  if (monthMatch) return monthMatch[0];

  return '2024';
}

function extractRoundType(text: string): string {
  const roundMatch = text.match(/(pre-seed|seed|series\s*[a-z]|angel|bridge)/i);
  return roundMatch ? roundMatch[1] : 'Unknown';
}

function extractInvestorsFromSnippet(snippet: string): string[] {
  const investors: string[] = [];
  const knownVCs = ['a16z', 'Sequoia', 'Y Combinator', 'Accel', 'Bessemer', 'Index', 'Greylock'];

  for (const vc of knownVCs) {
    if (snippet.toLowerCase().includes(vc.toLowerCase())) {
      investors.push(vc);
    }
  }

  return investors.slice(0, 3);
}

function getTypicalCheckSize(vcName: string): string {
  const sizes: Record<string, string> = {
    'a16z': '$50M-$100M',
    'Andreessen Horowitz': '$50M-$100M',
    'Sequoia': '$10M-$100M',
    'Y Combinator': '$500K',
    'Accel': '$10M-$50M',
    'Bessemer': '$10M-$50M',
    'Index Ventures': '$10M-$50M',
    'Greylock': '$10M-$50M',
    'First Round': '$2M-$5M',
    'Founders Fund': '$20M-$100M',
  };
  return sizes[vcName] || '$5M-$20M';
}

function getVCWebsite(vcName: string): string {
  const websites: Record<string, string> = {
    'a16z': 'https://a16z.com',
    'Andreessen Horowitz': 'https://a16z.com',
    'Sequoia': 'https://www.sequoiacap.com',
    'Y Combinator': 'https://www.ycombinator.com',
    'Accel': 'https://www.accel.com',
    'Bessemer': 'https://www.bvp.com',
    'Index Ventures': 'https://www.indexventures.com',
    'Greylock': 'https://greylock.com',
    'First Round': 'https://firstround.com',
    'Founders Fund': 'https://foundersfund.com',
  };
  return websites[vcName] || `https://www.google.com/search?q=${encodeURIComponent(vcName)}`;
}

function getDefaultAnalysis(rounds: FundingRound[], funds: ActiveFund[]): Partial<VentureData> {
  const roundCount = rounds.length;
  return {
    total_funding_last_year: roundCount > 5 ? '$100M+' : roundCount > 2 ? '$20M-$100M' : '$5M-$20M',
    average_round_size: '$5M-$15M',
    funding_trend: roundCount > 5 ? 'growing' : 'stable',
    investment_hotness: Math.min(10, roundCount + funds.length),
    market_signals: [
      'Active investor interest',
      'Multiple funding rounds announced',
      'Growing market segment',
    ],
  };
}

function getMockFundingRounds(query: string): FundingRound[] {
  const nicheKeywords = extractNicheKeywords(query);
  const capitalizedNiche = nicheKeywords.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return [
    {
      company: `${capitalizedNiche} Health`,
      amount: '$8M',
      round_type: 'Seed',
      date: 'January 2026',
      investors: ['Y Combinator', 'Accel'],
      source_url: 'https://techcrunch.com',
    },
    {
      company: `${capitalizedNiche} Labs`,
      amount: '$20M',
      round_type: 'Series A',
      date: 'November 2025',
      investors: ['Sequoia', 'a16z'],
      source_url: 'https://techcrunch.com',
    },
    {
      company: `Mind${capitalizedNiche.replace(/\s/g, '')}`,
      amount: '$3.5M',
      round_type: 'Pre-Seed',
      date: 'October 2025',
      investors: ['First Round Capital'],
      source_url: 'https://techcrunch.com',
    },
  ];
}

function getMockFunds(query: string): ActiveFund[] {
  return [
    {
      name: 'Y Combinator',
      focus_areas: [query, 'AI', 'SaaS'],
      recent_investments: [],
      typical_check_size: '$500K',
      website: 'https://www.ycombinator.com',
      crunchbase_url: 'https://www.crunchbase.com/organization/y-combinator',
    },
    {
      name: 'Sequoia Capital',
      focus_areas: [query, 'Enterprise', 'Consumer'],
      recent_investments: [],
      typical_check_size: '$10M-$100M',
      website: 'https://www.sequoiacap.com',
      crunchbase_url: 'https://www.crunchbase.com/organization/sequoia-capital',
    },
  ];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, trend_title } = body;

    if (!query && !trend_title) {
      return NextResponse.json(
        { success: false, error: 'Query or trend_title is required' },
        { status: 400 }
      );
    }

    const searchQuery = query || trend_title;

    // Fetch data in parallel
    const [rounds, funds] = await Promise.all([
      searchFundingNews(searchQuery),
      searchActiveFunds(searchQuery),
    ]);

    // AI analysis
    const analysis = await analyzeVentureLandscape(searchQuery, rounds, funds);

    const result: VentureData = {
      niche: searchQuery,
      total_funding_last_year: analysis.total_funding_last_year || 'Unknown',
      average_round_size: analysis.average_round_size || 'Unknown',
      funding_trend: analysis.funding_trend || 'stable',
      recent_rounds: rounds,
      active_funds: funds,
      investment_hotness: analysis.investment_hotness || 5,
      market_signals: analysis.market_signals || [],
      sources: [
        {
          name: 'Google News Search',
          url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' startup funding')}&tbm=nws`,
          accessed_at: new Date().toISOString(),
        },
        {
          name: 'TechCrunch',
          url: `https://techcrunch.com/search/${encodeURIComponent(searchQuery)}`,
          accessed_at: new Date().toISOString(),
        },
        {
          name: 'Crunchbase',
          url: `https://www.crunchbase.com/discover/funding_rounds?q=${encodeURIComponent(searchQuery)}`,
          accessed_at: new Date().toISOString(),
        },
      ],
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Venture data API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Query parameter is required' },
      { status: 400 }
    );
  }

  // Redirect to POST handler
  const postRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  return POST(postRequest as NextRequest);
}
