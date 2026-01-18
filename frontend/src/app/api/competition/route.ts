import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface Competitor {
  name: string;
  website: string;
  description: string;
  funding?: string;
  founded?: string;
  source: string;
  source_url: string;
}

interface CompetitionData {
  competitors: Competitor[];
  market_saturation: 'low' | 'medium' | 'high';
  blue_ocean_score: number; // 0-10, higher = less competition
  total_funding_in_niche: string;
  opportunity_areas: string[];
  risk_level: 'low' | 'medium' | 'high';
  sources: Array<{ name: string; url: string; accessed_at: string }>;
  analyzed_at: string;
}

// Search for competitors using SerpAPI Google Search
async function searchCompetitors(query: string): Promise<Competitor[]> {
  const competitors: Competitor[] = [];

  if (!SERPAPI_KEY) {
    // Return mock data if no API key
    return getMockCompetitors(query);
  }

  try {
    // Search for startups/companies in this space
    const searchQuery = `${query} startup company`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&num=10&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      console.log('SerpAPI search error:', response.status);
      return getMockCompetitors(query);
    }

    const data = await response.json();
    const organicResults = data.organic_results || [];

    for (const result of organicResults.slice(0, 8)) {
      // Filter out non-company results
      const title = result.title || '';
      const link = result.link || '';
      const snippet = result.snippet || '';

      // Skip if it's a news article, blog, or listicle
      if (link.includes('medium.com') ||
          link.includes('forbes.com') ||
          link.includes('techcrunch.com') ||
          title.toLowerCase().includes('top 10') ||
          title.toLowerCase().includes('best ')) {
        continue;
      }

      competitors.push({
        name: extractCompanyName(title),
        website: link,
        description: snippet.substring(0, 200),
        source: 'Google Search',
        source_url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`,
      });
    }

    // Also search Product Hunt
    const phResults = await searchProductHunt(query);
    competitors.push(...phResults);

  } catch (error) {
    console.error('Error searching competitors:', error);
    return getMockCompetitors(query);
  }

  return competitors.slice(0, 10);
}

// Search Product Hunt for competitors
async function searchProductHunt(query: string): Promise<Competitor[]> {
  const competitors: Competitor[] = [];

  if (!SERPAPI_KEY) return [];

  try {
    const searchQuery = `site:producthunt.com ${query}`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&num=5&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) return [];

    const data = await response.json();
    const results = data.organic_results || [];

    for (const result of results.slice(0, 3)) {
      const title = result.title || '';
      const link = result.link || '';
      const snippet = result.snippet || '';

      if (!link.includes('producthunt.com/posts/')) continue;

      competitors.push({
        name: title.split(' - ')[0] || title,
        website: link,
        description: snippet.substring(0, 200),
        source: 'Product Hunt',
        source_url: link,
      });
    }
  } catch (error) {
    console.log('Product Hunt search error:', error);
  }

  return competitors;
}

// Extract company name from search result title
function extractCompanyName(title: string): string {
  // Remove common suffixes
  return title
    .replace(/\s*[-|–]\s*.*/g, '') // Remove everything after dash/pipe
    .replace(/\s*:\s*.*/g, '') // Remove everything after colon
    .replace(/\.(com|io|co|app|ai)$/i, '') // Remove domain extensions
    .trim()
    .substring(0, 50);
}

// Analyze competition using AI
async function analyzeCompetition(query: string, competitors: Competitor[]): Promise<Partial<CompetitionData>> {
  if (!OPENAI_API_KEY) {
    return getDefaultAnalysis(competitors);
  }

  try {
    const prompt = `Analyze the competitive landscape for "${query}" based on these competitors:

${competitors.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')}

Provide analysis in JSON format:
{
  "market_saturation": "low" | "medium" | "high",
  "blue_ocean_score": 0-10 (higher = less competition, more opportunity),
  "opportunity_areas": ["area1", "area2", "area3"],
  "risk_level": "low" | "medium" | "high"
}

Be concise. Focus on actual market gaps.`;

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
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      return getDefaultAnalysis(competitors);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        market_saturation: parsed.market_saturation || 'medium',
        blue_ocean_score: parsed.blue_ocean_score || 5,
        opportunity_areas: parsed.opportunity_areas || [],
        risk_level: parsed.risk_level || 'medium',
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
  }

  return getDefaultAnalysis(competitors);
}

function getDefaultAnalysis(competitors: Competitor[]): Partial<CompetitionData> {
  const count = competitors.length;
  return {
    market_saturation: count > 7 ? 'high' : count > 3 ? 'medium' : 'low',
    blue_ocean_score: Math.max(1, 10 - count),
    opportunity_areas: ['Differentiation needed', 'Niche targeting', 'Better UX'],
    risk_level: count > 5 ? 'high' : count > 2 ? 'medium' : 'low',
  };
}

function getMockCompetitors(query: string): Competitor[] {
  return [
    {
      name: 'Example Startup 1',
      website: 'https://example1.com',
      description: `A startup working on ${query} solutions for businesses.`,
      source: 'Mock Data',
      source_url: 'https://google.com',
    },
    {
      name: 'Example Startup 2',
      website: 'https://example2.com',
      description: `Another company in the ${query} space with AI-powered features.`,
      source: 'Mock Data',
      source_url: 'https://google.com',
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

    // Search for competitors
    const competitors = await searchCompetitors(searchQuery);

    // Analyze competition
    const analysis = await analyzeCompetition(searchQuery, competitors);

    const result: CompetitionData = {
      competitors,
      market_saturation: analysis.market_saturation || 'medium',
      blue_ocean_score: analysis.blue_ocean_score || 5,
      total_funding_in_niche: 'Data requires Crunchbase API',
      opportunity_areas: analysis.opportunity_areas || [],
      risk_level: analysis.risk_level || 'medium',
      sources: [
        {
          name: 'Google Search',
          url: `https://www.google.com/search?q=${encodeURIComponent(searchQuery + ' startup')}`,
          accessed_at: new Date().toISOString()
        },
        {
          name: 'Product Hunt',
          url: `https://www.producthunt.com/search?q=${encodeURIComponent(searchQuery)}`,
          accessed_at: new Date().toISOString()
        },
      ],
      analyzed_at: new Date().toISOString(),
    };

    return NextResponse.json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('Competition API error:', error);
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
