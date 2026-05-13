import { NextRequest, NextResponse } from 'next/server';
import { calcBlueOceanScore, calcMarketSaturation, calcRiskLevel } from '@/lib/evidence-calculations';
import { getAuthUser } from '@/lib/auth-helpers'

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Контекст от предыдущих экспертов
interface PreviousContext {
  trend: {
    title: string;
    category?: string;
    why_trending?: string;
    source_query?: string;
  };
  analysis?: {
    main_pain: string;
    key_pain_points?: string[];
    target_audience?: {
      primary: string;
      segments?: Array<{ name: string; size: string }>;
    };
    opportunities?: string[];
  };
  sources?: {
    reddit?: {
      posts: Array<{ title: string; subreddit: string; score: number }>;
      communities: string[];
    };
    google_trends?: {
      growth_rate: number;
      related_queries?: Array<{ query: string }>;
    };
    synthesis?: {
      key_insights: string[];
      content_gaps: string[];
    };
  };
}

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
  blue_ocean_score: number;
  total_funding_in_niche: string;
  opportunity_areas: string[];
  risk_level: 'low' | 'medium' | 'high';
  sources: Array<{ name: string; url: string; accessed_at: string }>;
  analyzed_at: string;
  error?: string;
}

// Search for competitors using SerpAPI Google Search - NO MOCKS
async function searchCompetitors(query: string): Promise<{ competitors: Competitor[]; error?: string }> {
  if (!SERPAPI_KEY) {
    return {
      competitors: [],
      error: 'SERPAPI_KEY не настроен. Добавьте ключ в .env.local для поиска конкурентов.'
    };
  }

  const competitors: Competitor[] = [];

  try {
    // Search for startups/companies in this space
    const searchQuery = `${query} startup company`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&num=10&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI search error:', response.status, errorText);
      return {
        competitors: [],
        error: `Ошибка SerpAPI (${response.status}): Не удалось найти конкурентов`
      };
    }

    const data = await response.json();

    // Check for API error
    if (data.error) {
      return {
        competitors: [],
        error: `SerpAPI: ${data.error}`
      };
    }

    const organicResults = data.organic_results || [];

    for (const result of organicResults.slice(0, 8)) {
      const title = result.title || '';
      const link = result.link || '';
      const snippet = result.snippet || '';

      // Skip news articles, blogs, listicles
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
    return {
      competitors: [],
      error: `Ошибка сети при поиске конкурентов: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  if (competitors.length === 0) {
    return {
      competitors: [],
      error: `По запросу "${query}" не найдено конкурентов`
    };
  }

  return { competitors: competitors.slice(0, 10) };
}

// Search Product Hunt for competitors
async function searchProductHunt(query: string): Promise<Competitor[]> {
  if (!SERPAPI_KEY) return [];

  const competitors: Competitor[] = [];

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
    console.error('Product Hunt search error:', error);
  }

  return competitors;
}

// Extract company name from search result title
function extractCompanyName(title: string): string {
  return title
    .replace(/\s*[-|–]\s*.*/g, '')
    .replace(/\s*:\s*.*/g, '')
    .replace(/\.(com|io|co|app|ai)$/i, '')
    .trim()
    .substring(0, 50);
}

// Analyze competition: ФОРМУЛЫ для scores, GPT ТОЛЬКО для opportunity_areas
async function analyzeCompetition(
  query: string,
  competitors: Competitor[],
  context?: PreviousContext
): Promise<Partial<CompetitionData> & { strategic_positioning?: string; differentiation_opportunities?: string[] }> {
  const count = competitors.length;
  const fundedCount = competitors.filter(c => c.funding).length;

  // ФОРМУЛЫ — не GPT
  const saturation = calcMarketSaturation(count);
  const blueOcean = calcBlueOceanScore(count);
  const risk = calcRiskLevel(count, fundedCount);

  if (competitors.length < 2) {
    // Слишком мало данных для AI-анализа — не генерируем opportunity_areas
    return {
      market_saturation: saturation.level,
      blue_ocean_score: blueOcean.value,
      opportunity_areas: [],
      risk_level: risk.level,
    };
  }

  // GPT ТОЛЬКО для opportunity_areas — с обязательными ссылками на конкурентов
  let opportunityAreas: string[] = [];
  let strategicPositioning: string | undefined;
  let differentiationOpportunities: string[] = [];

  if (OPENAI_API_KEY) {
    try {
      let contextSection = '';
      if (context?.analysis) {
        contextSection += `\n- Главная боль: ${context.analysis.main_pain}`;
        contextSection += `\n- Целевая аудитория: ${context.analysis.target_audience?.primary || 'не определена'}`;
      }

      const prompt = `Ты эксперт по конкурентному анализу. Вот РЕАЛЬНЫЕ конкуренты для "${query}":
${competitors.map((c, i) => `${i + 1}. ${c.name} (${c.website}) [${c.source}]: ${c.description}`).join('\n')}
${contextSection}

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Опирайся ТОЛЬКО на данные о конкурентах выше. НЕ ПРИДУМЫВАЙ конкурентов, которых нет в списке.
2. Каждая возможность ДОЛЖНА ссылаться на КОНКРЕТНОГО конкурента из списка и его РЕАЛЬНУЮ слабость видную из описания.
3. НЕ ВЫДУМЫВАЙ слабости — используй только то, что видно из описания или сайта конкурента.
4. Если из описаний нельзя понять слабости — скажи "Требуется ручной анализ конкурента X".

Верни JSON:
{
  "opportunity_areas": ["Конкурент [имя] не покрывает [что именно видно из описания] — возможность для...", "..."],
  "strategic_positioning": "Позиционирование на основе видимых слабостей конкурентов",
  "differentiation_opportunities": ["Отличие от [имя]: ...", "Отличие от [имя]: ..."]
}`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.4,
          max_tokens: 800,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          opportunityAreas = parsed.opportunity_areas || [];
          strategicPositioning = parsed.strategic_positioning;
          differentiationOpportunities = parsed.differentiation_opportunities || [];
        }
      }
    } catch (error) {
      console.error('AI opportunity analysis error:', error);
    }
  }

  // Не добавляем шаблонные фразы — если AI не нашёл возможностей, значит их нет в данных

  return {
    market_saturation: saturation.level,
    blue_ocean_score: blueOcean.value,
    opportunity_areas: opportunityAreas,
    risk_level: risk.level,
    strategic_positioning: strategicPositioning,
    differentiation_opportunities: differentiationOpportunities,
  };
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { query, trend_title, context } = body;

    if (!query && !trend_title && !context?.trend?.title) {
      return NextResponse.json(
        { success: false, error: 'Query or trend_title is required' },
        { status: 400 }
      );
    }

    const previousContext: PreviousContext | undefined = context;
    const searchQuery = context?.trend?.source_query || query || trend_title || context?.trend?.title;

    // Check API keys
    const missingKeys: string[] = [];
    if (!SERPAPI_KEY) missingKeys.push('SERPAPI_KEY');

    // Search for competitors
    const { competitors, error: searchError } = await searchCompetitors(searchQuery);

    // Analyze competition with full context
    const analysis = await analyzeCompetition(searchQuery, competitors, previousContext);

    const result = {
      competitors,
      market_saturation: analysis.market_saturation || 'medium',
      blue_ocean_score: analysis.blue_ocean_score || 5,
      total_funding_in_niche: 'Требуется Crunchbase API для данных о финансировании',
      opportunity_areas: analysis.opportunity_areas || [],
      risk_level: analysis.risk_level || 'medium',
      strategic_positioning: analysis.strategic_positioning || null,
      differentiation_opportunities: analysis.differentiation_opportunities || [],
      score_metadata: {
        market_saturation: { data_type: 'calculated', formula: '<3=low, 3-7=medium, >7=high' },
        blue_ocean_score: { data_type: 'calculated', formula: 'max(1, 10 - competitors * 1.2)' },
        risk_level: { data_type: 'calculated', formula: 'competitors + funded_competitors * 2' },
        opportunity_areas: { data_type: 'ai_synthesis', note: 'AI анализ на основе реальных конкурентов' },
      },
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
      context_received: !!previousContext?.analysis,
      errors: [searchError].filter(Boolean),
      warnings: missingKeys.length > 0 ? `Отсутствуют API ключи: ${missingKeys.join(', ')}` : undefined,
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
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');

  if (!query) {
    return NextResponse.json(
      { success: false, error: 'Query parameter is required' },
      { status: 400 }
    );
  }

  const postRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  return POST(postRequest as NextRequest);
}
