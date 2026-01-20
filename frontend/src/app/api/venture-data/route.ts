import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Контекст от предыдущих экспертов
interface PreviousContext {
  trend: {
    title: string;
    category?: string;
  };
  analysis?: {
    main_pain: string;
    key_pain_points?: string[];
    target_audience?: {
      primary: string;
      segments?: Array<{ name: string; size: string }>;
    };
    opportunities?: string[];
    market_readiness?: number;
  };
  sources?: {
    google_trends?: {
      growth_rate: number;
    };
    synthesis?: {
      key_insights: string[];
    };
  };
  competition?: {
    competitors: Array<{ name: string; description: string; funding?: string }>;
    market_saturation: string;
    blue_ocean_score: number;
    strategic_positioning?: string;
  };
}

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
  investment_hotness: number;
  market_signals: string[];
  sources: Array<{ name: string; url: string; accessed_at: string }>;
  analyzed_at: string;
  error?: string;
}

// Extract core niche keywords for more relevant search
function extractNicheKeywords(query: string): string {
  const genericTerms = [
    'ai-powered', 'ai powered', 'ai-based', 'ai based',
    'platform', 'tool', 'app', 'software', 'service', 'agent', 'assistant',
    'automated', 'automation', 'intelligent', 'smart'
  ];

  let cleaned = query.toLowerCase();
  for (const term of genericTerms) {
    cleaned = cleaned.replace(new RegExp(term, 'gi'), ' ');
  }

  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  if (cleaned.length < 5) {
    return query.split(' ').slice(0, 3).join(' ');
  }

  return cleaned;
}

// Search for funding news using SerpAPI - NO MOCKS
async function searchFundingNews(query: string): Promise<{ rounds: FundingRound[]; error?: string }> {
  if (!SERPAPI_KEY) {
    return {
      rounds: [],
      error: 'SERPAPI_KEY не настроен. Добавьте ключ в .env.local для поиска данных о финансировании.'
    };
  }

  const rounds: FundingRound[] = [];

  try {
    const nicheKeywords = extractNicheKeywords(query);

    // Search for recent funding announcements
    const searchQuery = `"${nicheKeywords}" startup funding round 2025 2026 -OpenAI -Anthropic -Google -Microsoft`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&tbs=qdr:m6&num=15&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI funding search error:', response.status, errorText);
      return {
        rounds: [],
        error: `Ошибка SerpAPI (${response.status}): Не удалось найти данные о финансировании`
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        rounds: [],
        error: `SerpAPI: ${data.error}`
      };
    }

    const results = data.organic_results || [];

    for (const result of results.slice(0, 8)) {
      const title = result.title || '';
      const link = result.link || '';
      const snippet = result.snippet || '';

      // Look for funding indicators
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

    // Also search TechCrunch
    const tcResults = await searchTechCrunch(query);
    rounds.push(...tcResults);

  } catch (error) {
    console.error('Error searching funding news:', error);
    return {
      rounds: [],
      error: `Ошибка сети при поиске финансирования: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // Deduplicate by company name
  const seen = new Set<string>();
  const uniqueRounds = rounds.filter(round => {
    const key = round.company.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (uniqueRounds.length === 0) {
    return {
      rounds: [],
      error: `По запросу "${query}" не найдено данных о раундах финансирования`
    };
  }

  return { rounds: uniqueRounds.slice(0, 10) };
}

// Search TechCrunch for funding news
async function searchTechCrunch(query: string): Promise<FundingRound[]> {
  if (!SERPAPI_KEY) return [];

  const rounds: FundingRound[] = [];

  try {
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
    console.error('TechCrunch search error:', error);
  }

  return rounds;
}

// Search for active VCs - NO MOCKS
async function searchActiveFunds(query: string): Promise<{ funds: ActiveFund[]; error?: string }> {
  if (!SERPAPI_KEY) {
    return {
      funds: [],
      error: 'SERPAPI_KEY не настроен. Добавьте ключ в .env.local для поиска инвесторов.'
    };
  }

  const funds: ActiveFund[] = [];

  try {
    const nicheKeywords = extractNicheKeywords(query);
    const searchQuery = `"${nicheKeywords}" venture capital investors 2025 2026`;
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(searchQuery)}&tbs=qdr:y&num=10&api_key=${SERPAPI_KEY}`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI VC search error:', response.status, errorText);
      return {
        funds: [],
        error: `Ошибка SerpAPI (${response.status}): Не удалось найти инвесторов`
      };
    }

    const data = await response.json();

    if (data.error) {
      return {
        funds: [],
        error: `SerpAPI: ${data.error}`
      };
    }

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
    return {
      funds: [],
      error: `Ошибка сети при поиске инвесторов: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  if (funds.length === 0) {
    return {
      funds: [],
      error: `По запросу "${query}" не найдены активные инвесторы`
    };
  }

  return { funds: funds.slice(0, 8) };
}

// AI analysis of venture landscape
async function analyzeVentureLandscape(
  query: string,
  rounds: FundingRound[],
  funds: ActiveFund[],
  context?: PreviousContext
): Promise<Partial<VentureData> & {
  investment_thesis?: string;
  recommended_round?: string;
  key_investors_to_target?: string[];
}> {
  if (!OPENAI_API_KEY) {
    return {
      ...getDefaultAnalysis(rounds, funds),
      error: 'OPENAI_API_KEY не настроен. AI-анализ недоступен.'
    };
  }

  if (rounds.length === 0 && funds.length === 0) {
    return {
      total_funding_last_year: 'Нет данных',
      average_round_size: 'Нет данных',
      funding_trend: 'stable',
      investment_hotness: 0,
      market_signals: ['Недостаточно данных для анализа инвестиционной активности'],
    };
  }

  try {
    let contextSection = '';

    if (context?.analysis) {
      contextSection += `
## Контекст от эксперта по анализу:
- Главная боль: ${context.analysis.main_pain}
- Целевая аудитория: ${context.analysis.target_audience?.primary || 'не определена'}
- Возможности: ${context.analysis.opportunities?.join(', ') || 'не определены'}
- Готовность рынка: ${context.analysis.market_readiness || 'не оценена'}/10
`;
    }

    if (context?.sources?.google_trends) {
      contextSection += `- Рост интереса по Google Trends: ${context.sources.google_trends.growth_rate}%
`;
    }

    if (context?.competition) {
      contextSection += `
## Контекст от эксперта по конкурентам:
- Насыщенность рынка: ${context.competition.market_saturation}
- Blue Ocean Score: ${context.competition.blue_ocean_score}/10
- Позиционирование: ${context.competition.strategic_positioning || 'не определено'}
- Конкуренты с финансированием: ${context.competition.competitors.filter(c => c.funding).map(c => `${c.name} (${c.funding})`).join(', ') || 'нет данных'}
`;
    }

    const prompt = `Ты эксперт по венчурным инвестициям. Проанализируй инвестиционный ландшафт для "${query}".
${contextSection}
## Найденные раунды финансирования:
${rounds.length > 0 ? rounds.map(r => `- ${r.company}: ${r.amount} (${r.round_type})`).join('\n') : 'Нет данных о раундах'}

## Активные инвесторы: ${funds.length > 0 ? funds.map(f => f.name).join(', ') : 'Не найдены'}

ВАЖНО: Учитывай контекст от предыдущих экспертов:
- Если боль острая и рынок растёт - это сильный сигнал для инвесторов
- Если Blue Ocean Score высокий - меньше конкуренции за инвестиции
- Если есть финансированные конкуренты - значит рынок validated

Верни JSON:
{
  "total_funding_estimate": "$XXM-$XXM в нише за последний год",
  "average_round_size": "$XM",
  "funding_trend": "growing" | "stable" | "declining",
  "investment_hotness": 0-10,
  "market_signals": ["сигнал для инвесторов 1", "сигнал 2"],
  "investment_thesis": "Краткий тезис почему инвесторы вкладывают в эту нишу",
  "recommended_round": "Рекомендуемый тип раунда для стартапа в этой нише",
  "key_investors_to_target": ["Инвестор 1", "Инвестор 2", "Инвестор 3"]
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

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenAI API error:', response.status, errorData);
      return {
        ...getDefaultAnalysis(rounds, funds),
        error: `Ошибка OpenAI API (${response.status}): ${errorData.error?.message || 'Не удалось выполнить анализ'}`
      };
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
        investment_thesis: parsed.investment_thesis,
        recommended_round: parsed.recommended_round,
        key_investors_to_target: parsed.key_investors_to_target || [],
      };
    }
  } catch (error) {
    console.error('AI analysis error:', error);
    return {
      ...getDefaultAnalysis(rounds, funds),
      error: `Ошибка AI-анализа: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  return getDefaultAnalysis(rounds, funds);
}

// Helper functions
function extractCompanyFromTitle(title: string): string {
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

  return 'Дата неизвестна';
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
    total_funding_last_year: roundCount > 5 ? '$100M+' : roundCount > 2 ? '$20M-$100M' : roundCount > 0 ? '$5M-$20M' : 'Нет данных',
    average_round_size: roundCount > 0 ? '$5M-$15M' : 'Нет данных',
    funding_trend: roundCount > 5 ? 'growing' : 'stable',
    investment_hotness: Math.min(10, roundCount + funds.length),
    market_signals: roundCount > 0 || funds.length > 0 ? [
      'Активный интерес инвесторов',
      'Объявлены раунды финансирования',
      'Растущий сегмент рынка',
    ] : ['Недостаточно данных для выводов'],
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

    // Fetch data in parallel
    const [roundsResult, fundsResult] = await Promise.all([
      searchFundingNews(searchQuery),
      searchActiveFunds(searchQuery),
    ]);

    // AI analysis with full context
    const analysis = await analyzeVentureLandscape(
      searchQuery,
      roundsResult.rounds,
      fundsResult.funds,
      previousContext
    );

    const result = {
      niche: searchQuery,
      total_funding_last_year: analysis.total_funding_last_year || 'Нет данных',
      average_round_size: analysis.average_round_size || 'Нет данных',
      funding_trend: analysis.funding_trend || 'stable',
      recent_rounds: roundsResult.rounds,
      active_funds: fundsResult.funds,
      investment_hotness: analysis.investment_hotness || 0,
      market_signals: analysis.market_signals || [],
      investment_thesis: analysis.investment_thesis || null,
      recommended_round: analysis.recommended_round || null,
      key_investors_to_target: analysis.key_investors_to_target || [],
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
      context_received: !!previousContext?.competition,
      errors: [roundsResult.error, fundsResult.error, analysis.error].filter(Boolean),
      warnings: missingKeys.length > 0 ? `Отсутствуют API ключи: ${missingKeys.join(', ')}` : undefined,
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

  const postRequest = new Request(request.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  return POST(postRequest as NextRequest);
}
