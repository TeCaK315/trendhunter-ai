import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface EnrichmentResult {
  competition_level: 'low' | 'medium' | 'high';
  entry_cost_estimate: string;
  top_players_count: number;
  monthly_searches?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { title, category } = await request.json();

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    const result: Partial<EnrichmentResult> = {};

    // Step 1: SerpAPI search to count competitors
    if (SERPAPI_KEY) {
      try {
        const searchQuery = `${title} ${category || ''} software tool SaaS`;
        const params = new URLSearchParams({
          engine: 'google',
          q: searchQuery,
          num: '20',
          api_key: SERPAPI_KEY,
        });

        const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          const organicResults = data.organic_results || [];

          // Count how many results are actual SaaS/tools (not articles, news, etc.)
          const productSignals = ['pricing', 'signup', 'free trial', 'demo', 'features', 'plan', 'subscribe', '.io', '.app', '.ai', 'saas', 'tool', 'platform', 'software'];
          let playerCount = 0;

          for (const item of organicResults) {
            const text = `${item.title || ''} ${item.snippet || ''} ${item.link || ''}`.toLowerCase();
            if (productSignals.some(signal => text.includes(signal))) {
              playerCount++;
            }
          }

          result.top_players_count = playerCount;

          if (playerCount <= 5) {
            result.competition_level = 'low';
          } else if (playerCount <= 12) {
            result.competition_level = 'medium';
          } else {
            result.competition_level = 'high';
          }

          // Extract monthly search volume if available
          const searchInfo = data.search_information;
          if (searchInfo?.total_results) {
            result.monthly_searches = Math.round(searchInfo.total_results / 1000);
          }
        }
      } catch (err) {
        console.error('[enrich-trend] SerpAPI error:', err);
      }
    }

    // Step 2: GPT estimate entry cost
    if (OPENAI_API_KEY) {
      try {
        const competitionContext = result.competition_level
          ? `Competition level: ${result.competition_level} (${result.top_players_count} existing players).`
          : '';

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content: `You are a startup cost analyst. Given a product niche, estimate the MVP development cost range.
Consider: development time, API costs, hosting, domain, basic marketing.
Respond ONLY with a JSON object: {"entry_cost_estimate": "$X-YK", "reasoning": "brief explanation"}
Use these ranges: "$200-500", "$500-2K", "$2K-5K", "$5K-15K", "$15K-50K", "$50K+"
Be realistic for a solo developer or small team building an MVP.`,
              },
              {
                role: 'user',
                content: `Product niche: "${title}" (category: ${category || 'Technology'}). ${competitionContext}`,
              },
            ],
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const content = data.choices?.[0]?.message?.content || '';
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.entry_cost_estimate) {
              result.entry_cost_estimate = parsed.entry_cost_estimate;
            }
          }
        }
      } catch (err) {
        console.error('[enrich-trend] GPT error:', err);
      }
    }

    // Fallback defaults
    if (!result.competition_level) result.competition_level = 'medium';
    if (!result.entry_cost_estimate) result.entry_cost_estimate = '$2K-5K';
    if (result.top_players_count === undefined) result.top_players_count = 0;

    return NextResponse.json({
      success: true,
      ...result,
      enriched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[enrich-trend] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
