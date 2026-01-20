import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Контекст от предыдущих экспертов
interface PreviousContext {
  trend: {
    title: string;
    category?: string;
    why_trending?: string;
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

// Analyze competition using AI with full context
async function analyzeCompetition(
  query: string,
  competitors: Competitor[],
  context?: PreviousContext
): Promise<Partial<CompetitionData> & { strategic_positioning?: string; differentiation_opportunities?: string[] }> {
  if (!OPENAI_API_KEY) {
    return {
      ...getDefaultAnalysis(competitors),
      error: 'OPENAI_API_KEY не настроен. AI-анализ недоступен.'
    };
  }

  if (competitors.length === 0) {
    return {
      market_saturation: 'low',
      blue_ocean_score: 9,
      opportunity_areas: ['Рынок свободен - конкуренты не найдены'],
      risk_level: 'low',
    };
  }

  try {
    let contextSection = '';
    if (context?.analysis) {
      contextSection += `
## Контекст от эксперта по анализу болей:
- Главная боль рынка: ${context.analysis.main_pain}
- Ключевые боли: ${context.analysis.key_pain_points?.join(', ') || 'не определены'}
- Целевая аудитория: ${context.analysis.target_audience?.primary || 'не определена'}
- Выявленные возможности: ${context.analysis.opportunities?.join(', ') || 'не определены'}
`;
    }

    if (context?.sources?.synthesis) {
      contextSection += `
## Контекст от эксперта по источникам:
- Ключевые инсайты: ${context.sources.synthesis.key_insights?.join('; ') || 'нет данных'}
- Пробелы в контенте: ${context.sources.synthesis.content_gaps?.join('; ') || 'нет данных'}
`;
    }

    if (context?.sources?.google_trends) {
      contextSection += `- Рост интереса: ${context.sources.google_trends.growth_rate}%
`;
    }

    const prompt = `Ты эксперт по конкурентному анализу. Проанализируй конкурентный ландшафт для "${query}".
${contextSection}
## Найденные конкуренты:
${competitors.map((c, i) => `${i + 1}. ${c.name}: ${c.description}`).join('\n')}

ВАЖНО: Учитывай контекст от предыдущих экспертов для более глубокого анализа.
Определи, какие боли конкуренты НЕ решают, и где есть возможности для дифференциации.

Верни JSON:
{
  "market_saturation": "low" | "medium" | "high",
  "blue_ocean_score": 0-10 (выше = меньше конкуренции),
  "opportunity_areas": ["конкретная возможность 1", "возможность 2", "возможность 3"],
  "risk_level": "low" | "medium" | "high",
  "strategic_positioning": "Рекомендуемое позиционирование на основе анализа болей и конкурентов",
  "differentiation_opportunities": ["Как отличиться от конкурента 1", "Как отличиться от конкурента 2"],
  "unserved_pain_points": ["Боль которую никто не решает 1", "Боль 2"]
}

Будь конкретен. Опирайся на данные от предыдущих экспертов.`;

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
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errorData);
      return {
        ...getDefaultAnalysis(competitors),
        error: `Ошибка OpenAI API (${response.status}): ${errorData.error?.message || 'Не удалось выполнить анализ'}`
      };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        market_saturation: parsed.market_saturation || 'medium',
        blue_ocean_score: parsed.blue_ocean_score || 5,
        opportunity_areas: parsed.opportunity_areas || [],
        risk_level: parsed.risk_level || 'medium',
        strategic_positioning: parsed.strategic_positioning,
        differentiation_opportunities: parsed.differentiation_opportunities || [],
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      ...getDefaultAnalysis(competitors),
      error: `Ошибка AI-анализа: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  return getDefaultAnalysis(competitors);
}

function getDefaultAnalysis(competitors: Competitor[]): Partial<CompetitionData> {
  const count = competitors.length;
  return {
    market_saturation: count > 7 ? 'high' : count > 3 ? 'medium' : 'low',
    blue_ocean_score: Math.max(1, 10 - count),
    opportunity_areas: count > 0 ? ['Требуется дифференциация', 'Фокус на нишу', 'Улучшение UX'] : ['Рынок свободен'],
    risk_level: count > 5 ? 'high' : count > 2 ? 'medium' : 'low',
  };
}

export async function POST(request: NextRequest) {
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
    const searchQuery = query || trend_title || context?.trend?.title;

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
      errors: [searchError, analysis.error].filter(Boolean),
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
