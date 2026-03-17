import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface EnrichmentResult {
  competition_level: 'low' | 'medium' | 'high';
  entry_cost_estimate: string;
  top_players_count: number;
  monthly_searches?: number;
  data_confidence?: 'verified' | 'estimated' | 'ai_generated';
  growth_rate_source?: 'google_trends' | 'ai_estimated';
  growth_rate_verified?: number;
  sentiment?: {
    positive: number;
    negative: number;
    neutral: number;
    sample_quotes?: string[];
  };
  difficulty_score?: number;
  difficulty_reasoning?: string;
  quick_verdict?: {
    decision: 'go' | 'no_go' | 'pivot' | 'more_data';
    summary: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { title, category, growth_rate, source_query } = await request.json();

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

    // Step 3: Sentiment Snapshot — search Reddit, classify with GPT
    if (SERPAPI_KEY && OPENAI_API_KEY) {
      try {
        const redditParams = new URLSearchParams({
          engine: 'google',
          q: `"${title}" site:reddit.com`,
          num: '10',
          api_key: SERPAPI_KEY,
        });

        const redditRes = await fetch(`https://serpapi.com/search.json?${redditParams.toString()}`);
        if (redditRes.ok) {
          const redditData = await redditRes.json();
          const snippets = (redditData.organic_results || [])
            .slice(0, 8)
            .map((r: any) => r.snippet || r.title || '')
            .filter((s: string) => s.length > 20);

          if (snippets.length >= 2) {
            const sentimentRes = await fetch('https://api.openai.com/v1/chat/completions', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
              },
              body: JSON.stringify({
                model: 'gpt-4o-mini',
                temperature: 0.1,
                messages: [
                  {
                    role: 'system',
                    content: `Classify each text as positive, negative, or neutral regarding "${title}" as a product/niche opportunity.
Respond ONLY with JSON: {"positive": N, "negative": N, "neutral": N, "sample_quotes": ["quote1", "quote2"]}
Where N is count of texts. Include 1-2 most representative quotes (shortened to <80 chars).`,
                  },
                  {
                    role: 'user',
                    content: snippets.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n'),
                  },
                ],
              }),
            });

            if (sentimentRes.ok) {
              const sentimentData = await sentimentRes.json();
              const sentimentContent = sentimentData.choices?.[0]?.message?.content || '';
              const sentimentJson = sentimentContent.match(/\{[\s\S]*\}/);
              if (sentimentJson) {
                const parsed = JSON.parse(sentimentJson[0]);
                result.sentiment = {
                  positive: parsed.positive || 0,
                  negative: parsed.negative || 0,
                  neutral: parsed.neutral || 0,
                  sample_quotes: parsed.sample_quotes?.slice(0, 2),
                };
              }
            }
          }
        }
      } catch (err) {
        console.error('[enrich-trend] Sentiment error:', err);
      }
    }

    // Step 4: Difficulty Score + Quick Verdict (single GPT call for efficiency)
    if (OPENAI_API_KEY) {
      try {
        const competitionCtx = result.competition_level || 'unknown';
        const playersCtx = result.top_players_count ?? 0;
        const costCtx = result.entry_cost_estimate || 'unknown';

        const dvRes = await fetch('https://api.openai.com/v1/chat/completions', {
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
                content: `You are a startup advisor. Given a product niche, provide TWO assessments:

1. DIFFICULTY SCORE (1-10): Technical complexity of building an MVP.
   1-3 = Simple (landing + form, no-code possible)
   4-6 = Medium (SaaS with integrations, APIs)
   7-10 = Complex (ML models, real-time systems, compliance)

2. QUICK VERDICT: Should someone pursue this niche?
   - "go" = Good opportunity, worth pursuing
   - "no_go" = Too risky or saturated
   - "pivot" = Core idea is good but needs differentiation
   - "more_data" = Insufficient data to decide

Respond ONLY with JSON:
{"difficulty_score": N, "difficulty_reasoning": "brief why", "verdict_decision": "go|no_go|pivot|more_data", "verdict_summary": "1 sentence why in Russian"}`,
              },
              {
                role: 'user',
                content: `Niche: "${title}" (${category || 'Technology'}). Competition: ${competitionCtx} (${playersCtx} players). Growth: ${growth_rate ?? 'unknown'}%. Entry cost: ${costCtx}.`,
              },
            ],
          }),
        });

        if (dvRes.ok) {
          const dvData = await dvRes.json();
          const dvContent = dvData.choices?.[0]?.message?.content || '';
          const dvJson = dvContent.match(/\{[\s\S]*\}/);
          if (dvJson) {
            const parsed = JSON.parse(dvJson[0]);
            if (parsed.difficulty_score) {
              result.difficulty_score = Math.min(10, Math.max(1, parsed.difficulty_score));
              result.difficulty_reasoning = parsed.difficulty_reasoning;
            }
            if (parsed.verdict_decision) {
              result.quick_verdict = {
                decision: parsed.verdict_decision as 'go' | 'no_go' | 'pivot' | 'more_data',
                summary: parsed.verdict_summary || '',
              };
            }
          }
        }
      } catch (err) {
        console.error('[enrich-trend] Difficulty/Verdict error:', err);
      }
    }

    // Step 5: Validate growth_rate via Google Trends cross-check
    if (SERPAPI_KEY && source_query) {
      try {
        const trendsParams = new URLSearchParams({
          engine: 'google_trends',
          q: source_query,
          date: 'today 1-m',
          data_type: 'TIMESERIES',
          api_key: SERPAPI_KEY,
        });

        const trendsResponse = await fetch(`https://serpapi.com/search.json?${trendsParams.toString()}`);
        if (trendsResponse.ok) {
          const trendsData = await trendsResponse.json();
          const timelineData = trendsData.interest_over_time?.timeline_data;

          if (timelineData && timelineData.length >= 8) {
            // Calculate week-over-week growth from real data
            const lastWeek = timelineData.slice(-7);
            const prevWeek = timelineData.slice(-14, -7);

            const lastAvg = lastWeek.reduce((sum: number, d: any) => sum + (d.values?.[0]?.extracted_value || 0), 0) / lastWeek.length;
            const prevAvg = prevWeek.reduce((sum: number, d: any) => sum + (d.values?.[0]?.extracted_value || 0), 0) / prevWeek.length;

            if (prevAvg > 0) {
              const verifiedGrowth = Math.round(((lastAvg - prevAvg) / prevAvg) * 100);
              result.growth_rate_verified = verifiedGrowth;
              result.growth_rate_source = 'google_trends';

              // Determine confidence based on divergence
              if (growth_rate !== undefined) {
                const divergence = Math.abs(growth_rate - verifiedGrowth);
                if (divergence <= growth_rate * 0.3) {
                  result.data_confidence = 'verified';
                } else if (divergence <= growth_rate * 0.6) {
                  result.data_confidence = 'estimated';
                } else {
                  result.data_confidence = 'ai_generated';
                }
              } else {
                result.data_confidence = 'verified';
              }
            }
          }
        }
      } catch (err) {
        console.error('[enrich-trend] Google Trends validation error:', err);
      }
    }

    // If no Google Trends validation was possible, mark based on data source
    if (!result.data_confidence) {
      result.data_confidence = growth_rate !== undefined ? 'estimated' : 'ai_generated';
      result.growth_rate_source = growth_rate !== undefined ? 'google_trends' : 'ai_estimated';
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
