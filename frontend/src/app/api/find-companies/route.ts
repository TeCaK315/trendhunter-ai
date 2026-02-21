import { NextRequest, NextResponse } from 'next/server';
import { fetchCompanySearch, fetchLinkedInCompanies } from '@/lib/data-fetchers';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';

// Контекст от предыдущих экспертов
interface FullContext {
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
      segments?: Array<{ name: string; size: string; willingness_to_pay?: string }>;
    };
    opportunities?: string[];
  };
  sources?: {
    reddit?: {
      communities: string[];
    };
    synthesis?: {
      key_insights: string[];
      recommended_angles: string[];
    };
  };
  competition?: {
    competitors: Array<{ name: string; target_market?: string }>;
    strategic_positioning?: string;
    differentiation_opportunities?: string[];
  };
  venture?: {
    investment_hotness: number;
    investment_thesis?: string;
    recommended_round?: string;
  };
}

interface FindCompaniesRequest {
  niche: string;
  painPoint: string;
  location?: string;
  companySize?: string;
  count?: number;
  context?: FullContext;
}

interface RealCompany {
  name: string;
  website: string;
  description: string;
  linkedin_url?: string;
  source: string;
  source_url: string;
  // AI-enriched fields (optional)
  pain_match?: string;
  outreach_angle?: string;
}

// Search for real companies via SerpAPI — NO FABRICATION
async function searchRealCompanies(
  niche: string,
  location?: string
): Promise<{ companies: RealCompany[]; serpapi_calls: number; error?: string }> {
  if (!SERPAPI_KEY) {
    return {
      companies: [],
      serpapi_calls: 0,
      error: 'SERPAPI_KEY не настроен. Добавьте ключ в .env.local для поиска компаний.'
    };
  }

  const allCompanies: RealCompany[] = [];
  let serpApiCalls = 0;

  try {
    // 1. General company search
    const companyResults = await fetchCompanySearch(niche);
    serpApiCalls += companyResults.serpapi_calls_used;

    for (const result of companyResults.data) {
      allCompanies.push({
        name: result.company_name,
        website: result.website,
        description: result.description,
        linkedin_url: result.linkedin_url,
        source: 'Google Search',
        source_url: result.url,
      });
    }

    // 2. LinkedIn company search
    const linkedinResults = await fetchLinkedInCompanies(niche);
    serpApiCalls += linkedinResults.serpapi_calls_used;

    for (const result of linkedinResults.data) {
      // Deduplicate by name
      const nameNorm = result.company_name.toLowerCase().trim();
      const exists = allCompanies.some(
        c => c.name.toLowerCase().trim() === nameNorm
      );
      if (!exists) {
        allCompanies.push({
          name: result.company_name,
          website: result.website,
          description: result.description,
          linkedin_url: result.linkedin_url,
          source: 'LinkedIn',
          source_url: result.url,
        });
      }
    }

    // 3. Location-specific search if provided
    if (location) {
      const locationQuery = `"${niche}" companies ${location}`;
      const searchUrl = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(locationQuery)}&num=5&api_key=${SERPAPI_KEY}`;

      const response = await fetch(searchUrl);
      serpApiCalls++;

      if (response.ok) {
        const data = await response.json();
        const results = data.organic_results || [];

        for (const result of results.slice(0, 5)) {
          const title = result.title || '';
          const link = result.link || '';
          const snippet = result.snippet || '';

          // Skip aggregator sites
          if (link.includes('crunchbase.com/lists') ||
              link.includes('yelp.com') ||
              link.includes('yellowpages.com') ||
              title.toLowerCase().includes('top 10') ||
              title.toLowerCase().includes('best ')) {
            continue;
          }

          const name = extractCompanyName(title);
          const nameNorm = name.toLowerCase().trim();
          const exists = allCompanies.some(
            c => c.name.toLowerCase().trim() === nameNorm
          );

          if (!exists && name.length > 1) {
            allCompanies.push({
              name,
              website: link,
              description: snippet.substring(0, 200),
              source: 'Google Search (location)',
              source_url: `https://www.google.com/search?q=${encodeURIComponent(locationQuery)}`,
            });
          }
        }
      }
    }
  } catch (error) {
    console.error('Error searching companies:', error);
    return {
      companies: allCompanies,
      serpapi_calls: serpApiCalls,
      error: `Ошибка поиска: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  if (allCompanies.length === 0) {
    return {
      companies: [],
      serpapi_calls: serpApiCalls,
      error: `По запросу "${niche}" не найдено реальных компаний`
    };
  }

  return { companies: allCompanies, serpapi_calls: serpApiCalls };
}

// Extract company name from search result title
function extractCompanyName(title: string): string {
  return title
    .replace(/\s*[-|–]\s*.*/g, '')
    .replace(/\s*:\s*.*/g, '')
    .replace(/\.(com|io|co|app|ai)$/i, '')
    .replace(/\s*\|.*$/g, '')
    .trim()
    .substring(0, 60);
}

// AI enrichment: ONLY for pain_match and outreach_angle, based on REAL data
async function enrichWithAI(
  companies: RealCompany[],
  niche: string,
  painPoint: string,
  context?: FullContext
): Promise<RealCompany[]> {
  if (!OPENAI_API_KEY || companies.length === 0) {
    return companies;
  }

  try {
    let contextSection = '';
    if (context?.analysis) {
      contextSection += `\nГлавная боль: ${context.analysis.main_pain}`;
      contextSection += `\nАудитория: ${context.analysis.target_audience?.primary || 'не определена'}`;
    }
    if (context?.competition?.strategic_positioning) {
      contextSection += `\nПозиционирование: ${context.competition.strategic_positioning}`;
    }

    const companyList = companies.slice(0, 15).map((c, i) =>
      `${i + 1}. ${c.name} — ${c.description}`
    ).join('\n');

    const prompt = `Ты эксперт по B2B продажам. Вот РЕАЛЬНЫЕ компании, найденные поиском для ниши "${niche}":

${companyList}
${contextSection}

Для КАЖДОЙ компании определи:
1. pain_match — почему эта компания может испытывать боль "${painPoint}" (коротко, 1-2 предложения). Если из описания компании НЕЛЬЗЯ определить связь с болью — верни null.
2. outreach_angle — как лучше к ним обратиться (коротко, 1 предложение). Если pain_match = null, то outreach_angle тоже null.
3. relevance_score — 1-10 насколько релевантна (СТРОГО на основе description компании)

КРИТИЧЕСКИЕ ПРАВИЛА:
- НЕ выдумывай информацию о компаниях. Опирайся ТОЛЬКО на описания выше.
- НЕ ПРИДУМЫВАЙ проблемы компании, которых не видно из описания.
- Если description компании не содержит явных признаков боли — pain_match ДОЛЖЕН быть null.
- relevance_score < 3 = pain_match: null обязательно.

Верни JSON:
{
  "enrichments": [
    { "index": 0, "pain_match": "...", "outreach_angle": "...", "relevance_score": 7 },
    { "index": 1, "pain_match": null, "outreach_angle": null, "relevance_score": 2 },
    ...
  ]
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
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const enrichments = parsed.enrichments || [];

        for (const e of enrichments) {
          const idx = e.index;
          if (idx >= 0 && idx < companies.length) {
            companies[idx].pain_match = e.pain_match;
            companies[idx].outreach_angle = e.outreach_angle;
          }
        }

        // Sort by relevance_score if available
        const scoreMap = new Map<number, number>();
        for (const e of enrichments) {
          if (e.relevance_score) scoreMap.set(e.index, e.relevance_score);
        }
        companies.sort((a, b) => {
          const idxA = companies.indexOf(a);
          const idxB = companies.indexOf(b);
          return (scoreMap.get(idxB) || 5) - (scoreMap.get(idxA) || 5);
        });
      }
    }
  } catch (error) {
    console.error('AI enrichment error:', error);
    // Companies still returned — just without AI enrichment
  }

  return companies;
}

export async function POST(request: NextRequest) {
  try {
    const body: FindCompaniesRequest = await request.json();

    const context = body.context;
    const niche = body.niche || context?.trend?.title;
    const painPoint = body.painPoint || context?.analysis?.main_pain;

    if (!niche || !painPoint) {
      return NextResponse.json(
        { success: false, error: 'Ниша и боль обязательны' },
        { status: 400 }
      );
    }

    console.log(`Finding REAL companies for: ${niche}`);

    const count = Math.min(body.count || 10, 20);

    // Step 1: Search for REAL companies via SerpAPI
    const { companies: realCompanies, serpapi_calls, error: searchError } =
      await searchRealCompanies(niche, body.location);

    // Step 2: AI enrichment — ONLY pain_match and outreach_angle
    const enrichedCompanies = await enrichWithAI(
      realCompanies.slice(0, count),
      niche,
      painPoint,
      context
    );

    // Build search tips based on real data
    const searchTips: string[] = [];
    if (body.location) {
      searchTips.push(`Поиск выполнен с фильтром по локации: ${body.location}`);
    }
    searchTips.push(`LinkedIn поиск: site:linkedin.com/company "${niche}"`);
    searchTips.push(`Crunchbase: crunchbase.com/search/organizations?query=${encodeURIComponent(niche)}`);
    if (context?.sources?.reddit?.communities?.length) {
      searchTips.push(`Reddit-сообщества: ${context.sources.reddit.communities.join(', ')}`);
    }

    const result = {
      companies: enrichedCompanies.map(c => ({
        name: c.name,
        website: c.website,
        description: c.description,
        linkedin_url: c.linkedin_url || null,
        source: c.source,
        source_url: c.source_url,
        pain_match: c.pain_match || null,
        outreach_angle: c.outreach_angle || null,
        // NO FAKE EMAILS — only real data
      })),
      search_tips: searchTips,
      linkedin_queries: [
        `"${niche}" company`,
        `"${painPoint}" solution`,
      ],
      directories: [
        {
          name: 'Crunchbase',
          url: `https://www.crunchbase.com/search/organizations?query=${encodeURIComponent(niche)}`,
          description: 'Database of companies and investments'
        },
        {
          name: 'Product Hunt',
          url: `https://www.producthunt.com/search?q=${encodeURIComponent(niche)}`,
          description: 'New product launches'
        },
        {
          name: 'G2',
          url: `https://www.g2.com/search?query=${encodeURIComponent(niche)}`,
          description: 'Software reviews and comparisons'
        },
      ],
      data_metadata: {
        companies: { data_type: 'real_data', note: 'Найдены через SerpAPI Google Search + LinkedIn' },
        pain_match: { data_type: OPENAI_API_KEY ? 'ai_synthesis' : 'not_available', note: 'AI-анализ на основе реальных описаний' },
        outreach_angle: { data_type: OPENAI_API_KEY ? 'ai_synthesis' : 'not_available', note: 'AI-рекомендация на основе реальных данных' },
        emails: { data_type: 'not_provided', note: 'Фейковые email-ы удалены. Используйте Hunter.io или LinkedIn.' },
      },
      niche,
      painPoint,
      context_received: !!context?.venture,
      serpapi_calls_used: serpapi_calls,
      errors: [searchError].filter(Boolean),
      warnings: !SERPAPI_KEY ? 'SERPAPI_KEY не настроен — поиск невозможен' : undefined,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    console.error('Find companies error:', error);
    return NextResponse.json(
      { success: false, error: 'Внутренняя ошибка сервера' },
      { status: 500 }
    );
  }
}
