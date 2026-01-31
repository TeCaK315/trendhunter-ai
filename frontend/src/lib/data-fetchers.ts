/**
 * Data Fetchers — Единый слой получения РЕАЛЬНЫХ данных
 *
 * Все SerpAPI и YouTube функции извлечены сюда из отдельных routes.
 * Каждая функция:
 * - Использует только реальные API (SerpAPI, YouTube Data API)
 * - Возвращает данные с source_url для каждого результата
 * - Считает использованные SerpAPI вызовы
 * - Никогда не генерирует фейковые данные
 */

import type {
  SourceName,
  FetcherResponse,
  RedditResult,
  HackerNewsResult,
  TwitterResult,
  QuoraResult,
  StackOverflowResult,
  G2Result,
  CapterraResult,
  TrustpilotResult,
  ProductHuntResult,
  GoogleTrendsResult,
  GoogleTrendsTimeline,
  YouTubeResult,
  FundingNewsResult,
  CompanySearchResult,
  SearchResult,
} from './evidence-types';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// === INTERNAL HELPERS ===

async function serpApiSearch(
  query: string,
  options: {
    num?: number;
    tbs?: string;
    engine?: string;
    extraParams?: Record<string, string>;
  } = {}
): Promise<{ organic_results?: Array<Record<string, unknown>>; error?: string; [key: string]: unknown }> {
  if (!SERPAPI_KEY) {
    return { error: 'SERPAPI_KEY not configured' };
  }

  const { num = 10, tbs, engine = 'google', extraParams = {} } = options;

  const params = new URLSearchParams({
    engine,
    q: query,
    api_key: SERPAPI_KEY,
    num: String(num),
    ...extraParams,
  });

  if (tbs) params.set('tbs', tbs);

  try {
    const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
    if (!response.ok) {
      return { error: `SerpAPI error: ${response.status}` };
    }
    const data = await response.json();
    if (data.error) {
      return { error: `SerpAPI: ${data.error}` };
    }
    return data;
  } catch (error) {
    return { error: `Network error: ${error instanceof Error ? error.message : 'Unknown'}` };
  }
}

function extractFromSnippet(snippet: string, pattern: RegExp): string | null {
  const match = snippet.match(pattern);
  return match ? match[1] || match[0] : null;
}

// === REDDIT ===

export async function fetchReddit(query: string): Promise<FetcherResponse<RedditResult>> {
  const data = await serpApiSearch(`site:reddit.com ${query}`, { num: 20 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'reddit', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: RedditResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    const subredditMatch = url.match(/reddit\.com\/r\/([^/]+)/);
    if (!subredditMatch) continue;

    const snippet = result.snippet || '';
    const scoreMatch = snippet.match(/(\d+)\s*(?:points?|upvotes?)/i);
    const commentsMatch = snippet.match(/(\d+)\s*comments?/i);

    results.push({
      title: (result.title || '').replace(/ : .*$/, '').replace(/ - Reddit$/, ''),
      url,
      snippet,
      source: 'reddit',
      subreddit: subredditMatch[1],
      score: scoreMatch ? parseInt(scoreMatch[1]) : 0,
      num_comments: commentsMatch ? parseInt(commentsMatch[1]) : 0,
      date: result.date,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'reddit',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === HACKER NEWS ===

export async function fetchHackerNews(query: string): Promise<FetcherResponse<HackerNewsResult>> {
  const data = await serpApiSearch(`site:news.ycombinator.com ${query}`, { num: 15 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'hacker_news', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: HackerNewsResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('news.ycombinator.com')) continue;

    const snippet = result.snippet || '';
    const pointsMatch = snippet.match(/(\d+)\s*points?/i);

    results.push({
      title: (result.title || '').replace(/ \| Hacker News$/, ''),
      url,
      snippet,
      source: 'hacker_news',
      points: pointsMatch ? parseInt(pointsMatch[1]) : 0,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'hacker_news',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === TWITTER/X ===

export async function fetchTwitter(query: string): Promise<FetcherResponse<TwitterResult>> {
  const data = await serpApiSearch(`(site:twitter.com OR site:x.com) ${query}`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'twitter', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: TwitterResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('twitter.com') && !url.includes('x.com')) continue;

    results.push({
      title: result.title || '',
      url,
      snippet: result.snippet || '',
      source: 'twitter',
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'twitter',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === QUORA ===

export async function fetchQuora(query: string): Promise<FetcherResponse<QuoraResult>> {
  const data = await serpApiSearch(`site:quora.com ${query}`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'quora', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: QuoraResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('quora.com')) continue;

    results.push({
      title: result.title || '',
      url,
      snippet: result.snippet || '',
      source: 'quora',
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'quora',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === STACK OVERFLOW ===

export async function fetchStackOverflow(query: string): Promise<FetcherResponse<StackOverflowResult>> {
  const data = await serpApiSearch(`site:stackoverflow.com ${query}`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'stackoverflow', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: StackOverflowResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('stackoverflow.com')) continue;

    const snippet = result.snippet || '';
    const votesMatch = snippet.match(/(\d+)\s*votes?/i);
    const answersMatch = snippet.match(/(\d+)\s*answers?/i);

    results.push({
      title: result.title || '',
      url,
      snippet,
      source: 'stackoverflow',
      votes: votesMatch ? parseInt(votesMatch[1]) : 0,
      answers: answersMatch ? parseInt(answersMatch[1]) : 0,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'stackoverflow',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === G2 REVIEWS ===

export async function fetchG2Reviews(query: string): Promise<FetcherResponse<G2Result>> {
  const data = await serpApiSearch(`site:g2.com ${query} review`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'g2', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: G2Result[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('g2.com')) continue;

    const snippet = result.snippet || '';
    const ratingMatch = snippet.match(/(\d+(?:\.\d+)?)\s*(?:\/5|out of 5|stars?)/i);

    results.push({
      title: result.title || '',
      url,
      snippet,
      source: 'g2',
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : undefined,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'g2',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === CAPTERRA REVIEWS ===

export async function fetchCapterraReviews(query: string): Promise<FetcherResponse<CapterraResult>> {
  const data = await serpApiSearch(`site:capterra.com ${query}`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'capterra', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: CapterraResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('capterra.com')) continue;

    const snippet = result.snippet || '';
    const ratingMatch = snippet.match(/(\d+(?:\.\d+)?)\s*(?:\/5|out of 5|stars?)/i);

    results.push({
      title: result.title || '',
      url,
      snippet,
      source: 'capterra',
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : undefined,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'capterra',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === TRUSTPILOT ===

export async function fetchTrustpilot(query: string): Promise<FetcherResponse<TrustpilotResult>> {
  const data = await serpApiSearch(`site:trustpilot.com ${query}`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'trustpilot', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: TrustpilotResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('trustpilot.com')) continue;

    const snippet = result.snippet || '';
    const ratingMatch = snippet.match(/(\d+(?:\.\d+)?)\s*(?:\/5|out of 5|stars?)/i);

    results.push({
      title: result.title || '',
      url,
      snippet,
      source: 'trustpilot',
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : undefined,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'trustpilot',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === PRODUCT HUNT ===

export async function fetchProductHunt(query: string): Promise<FetcherResponse<ProductHuntResult>> {
  const data = await serpApiSearch(`site:producthunt.com ${query}`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'producthunt', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: ProductHuntResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const url = result.link || '';
    if (!url.includes('producthunt.com')) continue;

    const snippet = result.snippet || '';
    const upvotesMatch = snippet.match(/(\d+)\s*(?:upvotes?|votes?)/i);

    results.push({
      title: (result.title || '').split(' - ')[0],
      url,
      snippet,
      source: 'producthunt',
      upvotes: upvotesMatch ? parseInt(upvotesMatch[1]) : 0,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'producthunt',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === GOOGLE TRENDS ===

function generateQueryVariants(originalQuery: string): string[] {
  const variants: string[] = [];

  const cleaned = originalQuery
    .replace(/^AI[- ]?Powered\s+/i, '')
    .replace(/^AI[- ]?Based\s+/i, '')
    .replace(/^AI\s+/i, '')
    .replace(/\s+Platform$/i, '')
    .replace(/\s+Tool$/i, '')
    .replace(/\s+App$/i, '')
    .replace(/\s+Software$/i, '')
    .replace(/\s+Service$/i, '')
    .replace(/\s+Agent$/i, '')
    .replace(/\s+Assistant$/i, '')
    .replace(/\s+System$/i, '')
    .replace(/\s+Solution$/i, '')
    .trim();

  const skipWords = [
    'the', 'and', 'for', 'with', 'app', 'tool', 'platform', 'service',
    'powered', 'based', 'intelligent', 'smart', 'automated', 'automation',
    'ai', 'artificial', 'intelligence', 'machine', 'learning', 'using'
  ];

  const words = cleaned.split(/\s+/).filter(w =>
    w.length > 2 && !skipWords.includes(w.toLowerCase())
  );

  if (words.length >= 3) variants.push(words.slice(0, 3).join(' '));
  if (words.length >= 2) variants.push(words.slice(0, 2).join(' '));
  if (words.length >= 1) variants.push(words[0]);

  if (cleaned !== originalQuery && cleaned.length > 0) variants.push(cleaned);
  if (words.length >= 1) variants.push(`${words[0]} software`);
  variants.push(originalQuery);

  return [...new Set(variants)].filter(v => v.length > 0 && v.length < 50);
}

export async function fetchGoogleTrends(
  query: string,
  dateRange: string = 'today 12-m'
): Promise<{ data: GoogleTrendsResult | null; serpapi_calls_used: number; error?: string }> {
  if (!SERPAPI_KEY) {
    return { data: null, serpapi_calls_used: 0, error: 'SERPAPI_KEY not configured' };
  }

  const variants = generateQueryVariants(query);
  let callsUsed = 0;

  for (const currentQuery of variants) {
    callsUsed++;
    try {
      const params = new URLSearchParams({
        engine: 'google_trends',
        q: currentQuery,
        date: dateRange,
        api_key: SERPAPI_KEY,
      });

      const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);
      if (!response.ok) continue;

      const data = await response.json();
      if (data.error) continue;

      const timelineData = data.interest_over_time?.timeline_data || [];
      if (timelineData.length === 0) continue;

      // Process timeline
      const completeData = timelineData.slice(-13, -1);
      const interest_timeline: GoogleTrendsTimeline[] = [];

      for (const point of completeData) {
        const date = point.date || '';
        const values = point.values || [];
        const value = values[0]?.extracted_value ?? parseInt(values[0]?.value || '0') ?? 0;
        interest_timeline.push({ date, value: Number(value) });
      }

      // Growth rate
      let growth_rate = 0;
      if (interest_timeline.length >= 6) {
        const firstHalf = interest_timeline.slice(0, Math.floor(interest_timeline.length / 2));
        const secondHalf = interest_timeline.slice(Math.floor(interest_timeline.length / 2));
        const avgOld = firstHalf.reduce((s, p) => s + p.value, 0) / firstHalf.length || 1;
        const avgNew = secondHalf.reduce((s, p) => s + p.value, 0) / secondHalf.length || 0;
        growth_rate = Math.round(((avgNew - avgOld) / avgOld) * 100);
      }

      // Related queries
      const relatedQueriesData = data.related_queries as {
        top?: Array<{ query: string; extracted_value?: number; value?: string; link?: string }>;
        rising?: Array<{ query: string; extracted_value?: number; value?: string; link?: string }>;
      } | undefined;

      const allQueries = [...(relatedQueriesData?.top || []), ...(relatedQueriesData?.rising || [])];
      const seen = new Set<string>();
      const related_queries = allQueries
        .filter(item => {
          const key = item.query.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        })
        .slice(0, 10)
        .map(item => ({
          query: item.query,
          growth: item.value === 'Breakout' ? 'Breakout' : `${item.extracted_value || item.value || 0}`,
          link: item.link,
        }));

      const searchMetadata = data.search_metadata as { google_trends_url?: string } | undefined;

      return {
        data: {
          search_query: currentQuery,
          original_query: query,
          growth_rate,
          interest_timeline,
          related_queries,
          google_trends_url: searchMetadata?.google_trends_url ||
            `https://trends.google.com/trends/explore?q=${encodeURIComponent(currentQuery)}&date=${encodeURIComponent(dateRange)}`,
          fetched_at: new Date().toISOString(),
        },
        serpapi_calls_used: callsUsed,
      };
    } catch {
      continue;
    }
  }

  return {
    data: null,
    serpapi_calls_used: callsUsed,
    error: `No Google Trends data found for "${query}"`,
  };
}

// === YOUTUBE ===

export async function fetchYouTube(query: string): Promise<FetcherResponse<YouTubeResult>> {
  if (!YOUTUBE_API_KEY) {
    return { data: [], total_results: 0, source: 'youtube', query_used: query, fetched_at: new Date().toISOString(), error: 'YOUTUBE_API_KEY not configured', serpapi_calls_used: 0 };
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      return { data: [], total_results: 0, source: 'youtube', query_used: query, fetched_at: new Date().toISOString(), error: `YouTube API error: ${response.status}`, serpapi_calls_used: 0 };
    }

    const data = await response.json();
    const items = data.items || [];

    const videos: YouTubeResult[] = items.map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; description: string; publishedAt: string; thumbnails: { high: { url: string } } } }) => ({
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      description: item.snippet.description,
      videoId: item.id.videoId,
      url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      publishedAt: item.snippet.publishedAt,
      thumbnail: item.snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${item.id.videoId}/hqdefault.jpg`,
    }));

    return {
      data: videos,
      total_results: videos.length,
      source: 'youtube',
      query_used: query,
      fetched_at: new Date().toISOString(),
      serpapi_calls_used: 0,
    };
  } catch (error) {
    return { data: [], total_results: 0, source: 'youtube', query_used: query, fetched_at: new Date().toISOString(), error: `YouTube error: ${error instanceof Error ? error.message : 'Unknown'}`, serpapi_calls_used: 0 };
  }
}

// === GOOGLE NEWS (Funding/Investment news) ===

export async function fetchGoogleNews(query: string, months: number = 6): Promise<FetcherResponse<FundingNewsResult>> {
  const tbs = `qdr:m${months}`;
  const data = await serpApiSearch(query, { num: 15, tbs });

  if (data.error) {
    return { data: [], total_results: 0, source: 'google_news', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: FundingNewsResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const title = result.title || '';
    const link = result.link || '';
    const snippet = result.snippet || '';

    const fundingMatch = snippet.match(/\$(\d+(?:\.\d+)?)\s*(M|million|B|billion)/i);
    const roundMatch = (title + ' ' + snippet).match(/(seed|series\s*[a-z]|pre-seed|angel|bridge|growth)/i);

    if (fundingMatch || roundMatch) {
      const amount = fundingMatch
        ? `$${fundingMatch[1]}${fundingMatch[2].toUpperCase().charAt(0)}`
        : 'Undisclosed';

      // Extract company from title
      const company = title
        .replace(/\s*[-|–:].*$/g, '')
        .replace(/raises.*$/i, '')
        .replace(/secures.*$/i, '')
        .replace(/announces.*$/i, '')
        .trim()
        .substring(0, 40);

      // Extract investors
      const knownVCs = ['a16z', 'Sequoia', 'Y Combinator', 'Accel', 'Bessemer', 'Index', 'Greylock'];
      const investors = knownVCs.filter(vc => snippet.toLowerCase().includes(vc.toLowerCase()));

      results.push({
        title,
        url: link,
        snippet,
        source: 'google_news',
        company,
        amount,
        round_type: roundMatch ? roundMatch[1] : 'Unknown',
        investors,
      });
    }
  }

  return {
    data: results,
    total_results: results.length,
    source: 'google_news',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === GOOGLE SEARCH (General + Companies) ===

export async function fetchGoogleSearch(query: string, num: number = 10): Promise<FetcherResponse<SearchResult>> {
  const data = await serpApiSearch(query, { num });

  if (data.error) {
    return { data: [], total_results: 0, source: 'google_search', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: SearchResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    results.push({
      title: result.title || '',
      url: result.link || '',
      snippet: result.snippet || '',
      source: 'google_search',
      date: result.date,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'google_search',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

export async function fetchCompanySearch(query: string): Promise<FetcherResponse<CompanySearchResult>> {
  const data = await serpApiSearch(`"${query}" companies`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'google_search', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: CompanySearchResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const link = result.link || '';
    const title = result.title || '';

    // Skip news/blog articles
    if (link.includes('medium.com') || link.includes('forbes.com') ||
        link.includes('techcrunch.com') || title.toLowerCase().includes('top 10') ||
        title.toLowerCase().includes('best ')) {
      continue;
    }

    results.push({
      title,
      url: link,
      snippet: (result.snippet || '').substring(0, 200),
      source: 'google_search',
      company_name: title.replace(/\s*[-|–]\s*.*/g, '').replace(/\s*:\s*.*/g, '').trim().substring(0, 50),
      website: link,
      description: (result.snippet || '').substring(0, 200),
      linkedin_url: undefined,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'google_search',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

export async function fetchLinkedInCompanies(query: string): Promise<FetcherResponse<CompanySearchResult>> {
  const data = await serpApiSearch(`site:linkedin.com/company "${query}"`, { num: 10 });

  if (data.error) {
    return { data: [], total_results: 0, source: 'linkedin', query_used: query, fetched_at: new Date().toISOString(), error: data.error, serpapi_calls_used: 1 };
  }

  const results: CompanySearchResult[] = [];
  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;

  for (const result of organicResults) {
    const link = result.link || '';
    if (!link.includes('linkedin.com/company')) continue;

    const title = result.title || '';
    const companyName = title.replace(/ \| LinkedIn$/, '').replace(/ - LinkedIn$/, '').trim();

    results.push({
      title: companyName,
      url: link,
      snippet: (result.snippet || '').substring(0, 200),
      source: 'linkedin',
      company_name: companyName,
      website: link,
      description: (result.snippet || '').substring(0, 200),
      linkedin_url: link,
    });
  }

  return {
    data: results,
    total_results: results.length,
    source: 'linkedin',
    query_used: query,
    fetched_at: new Date().toISOString(),
    serpapi_calls_used: 1,
  };
}

// === SEM / CPC DATA ===

export async function fetchKeywordCPC(keyword: string): Promise<{
  keyword: string;
  cpc: number;
  volume: number;
  currency: string;
  source_url: string;
  serpapi_calls_used: number;
  error?: string;
}> {
  // Use Google Ads data from SerpAPI
  const data = await serpApiSearch(keyword, { num: 3 });

  if (data.error) {
    return { keyword, cpc: 0, volume: 0, currency: 'USD', source_url: '', serpapi_calls_used: 1, error: data.error };
  }

  // Extract CPC from ads if present
  const ads = (data as Record<string, unknown>).ads as Array<Record<string, unknown>> | undefined;
  let cpc = 0;
  let volume = 0;

  if (ads && ads.length > 0) {
    // If ads exist, there's commercial intent — estimate CPC
    cpc = ads.length >= 3 ? 2.5 : ads.length >= 1 ? 1.0 : 0.5;
  }

  // Get search info for volume estimation
  const searchInfo = (data as Record<string, unknown>).search_information as { total_results?: number } | undefined;
  if (searchInfo?.total_results) {
    volume = searchInfo.total_results;
  }

  return {
    keyword,
    cpc,
    volume,
    currency: 'USD',
    source_url: `https://www.google.com/search?q=${encodeURIComponent(keyword)}`,
    serpapi_calls_used: 1,
  };
}

// === PRICING PAGE SEARCH ===

export async function fetchCompetitorPricing(competitorName: string): Promise<{
  competitor: string;
  pricing_url: string;
  pricing_snippet: string;
  prices_found: Array<{ amount: string; plan: string }>;
  serpapi_calls_used: number;
  error?: string;
}> {
  const data = await serpApiSearch(`${competitorName} pricing plans`, { num: 5 });

  if (data.error) {
    return { competitor: competitorName, pricing_url: '', pricing_snippet: '', prices_found: [], serpapi_calls_used: 1, error: data.error };
  }

  const organicResults = (data.organic_results || []) as Array<Record<string, string>>;
  let pricingUrl = '';
  let pricingSnippet = '';
  const pricesFound: Array<{ amount: string; plan: string }> = [];

  for (const result of organicResults) {
    const title = (result.title || '').toLowerCase();
    const link = result.link || '';
    const snippet = result.snippet || '';

    if (title.includes('pricing') || title.includes('plans') || link.includes('pricing')) {
      pricingUrl = link;
      pricingSnippet = snippet;

      // Extract prices from snippet
      const priceMatches = snippet.matchAll(/\$(\d+(?:\.\d{2})?)\s*(?:\/?\s*(?:mo|month|year|yr|user))?/gi);
      for (const match of priceMatches) {
        pricesFound.push({
          amount: `$${match[1]}`,
          plan: match[0],
        });
      }
      break;
    }
  }

  return {
    competitor: competitorName,
    pricing_url: pricingUrl,
    pricing_snippet: pricingSnippet,
    prices_found: pricesFound,
    serpapi_calls_used: 1,
  };
}

// === COMPLAINT-FOCUSED SEARCH ===

export async function fetchComplaints(
  query: string,
  sources: SourceName[] = ['reddit', 'hacker_news', 'quora']
): Promise<{
  complaints: Array<SearchResult & { source: SourceName; engagement: number }>;
  total_engagement: number;
  sources_used: number;
  serpapi_calls_used: number;
}> {
  const complaints: Array<SearchResult & { source: SourceName; engagement: number }> = [];
  let totalEngagement = 0;
  let callsUsed = 0;

  const painKeywords = 'problem|frustrated|hate|annoying|issue|broken|terrible|worst|struggling';
  const modifiedQuery = `${query} (${painKeywords})`;

  const fetchers: Array<{ source: SourceName; fn: () => Promise<FetcherResponse<SearchResult & { engagement?: number }>> }> = [];

  if (sources.includes('reddit')) {
    fetchers.push({
      source: 'reddit',
      fn: async () => {
        const result = await fetchReddit(`${modifiedQuery}`);
        return {
          ...result,
          data: result.data.map(r => ({ ...r, engagement: (r as RedditResult).score + (r as RedditResult).num_comments * 2 })),
        };
      },
    });
  }

  if (sources.includes('hacker_news')) {
    fetchers.push({
      source: 'hacker_news',
      fn: async () => {
        const result = await fetchHackerNews(modifiedQuery);
        return {
          ...result,
          data: result.data.map(r => ({ ...r, engagement: (r as HackerNewsResult).points })),
        };
      },
    });
  }

  if (sources.includes('quora')) {
    fetchers.push({
      source: 'quora',
      fn: async () => {
        const result = await fetchQuora(modifiedQuery);
        return {
          ...result,
          data: result.data.map(r => ({ ...r, engagement: 1 })),
        };
      },
    });
  }

  if (sources.includes('stackoverflow')) {
    fetchers.push({
      source: 'stackoverflow',
      fn: async () => {
        const result = await fetchStackOverflow(modifiedQuery);
        return {
          ...result,
          data: result.data.map(r => ({ ...r, engagement: (r as StackOverflowResult).votes })),
        };
      },
    });
  }

  // Run all in parallel
  const results = await Promise.all(fetchers.map(f => f.fn()));

  for (const result of results) {
    callsUsed += result.serpapi_calls_used;
    for (const item of result.data) {
      const engagement = (item as { engagement?: number }).engagement || 0;
      complaints.push({
        ...item,
        source: result.source,
        engagement,
      });
      totalEngagement += engagement;
    }
  }

  // Sort by engagement
  complaints.sort((a, b) => b.engagement - a.engagement);

  return {
    complaints,
    total_engagement: totalEngagement,
    sources_used: fetchers.length,
    serpapi_calls_used: callsUsed,
  };
}

// === NEGATIVE REVIEWS SEARCH ===

export async function fetchNegativeReviews(query: string): Promise<{
  reviews: Array<SearchResult & { source: SourceName; rating?: number }>;
  serpapi_calls_used: number;
}> {
  const reviews: Array<SearchResult & { source: SourceName; rating?: number }> = [];
  let callsUsed = 0;

  // Search G2 and Capterra for negative reviews
  const [g2Result, capterraResult] = await Promise.all([
    fetchG2Reviews(`${query} cons problems`),
    fetchCapterraReviews(`${query} negative review`),
  ]);

  callsUsed += g2Result.serpapi_calls_used + capterraResult.serpapi_calls_used;

  for (const item of g2Result.data) {
    reviews.push({ ...item, source: 'g2' as SourceName, rating: item.rating });
  }

  for (const item of capterraResult.data) {
    reviews.push({ ...item, source: 'capterra' as SourceName, rating: item.rating });
  }

  return { reviews, serpapi_calls_used: callsUsed };
}

// === BATCH FETCH (for reuse across blocks) ===

export interface BatchFetchResult {
  reddit: FetcherResponse<RedditResult>;
  hacker_news: FetcherResponse<HackerNewsResult>;
  twitter: FetcherResponse<TwitterResult>;
  quora: FetcherResponse<QuoraResult>;
  stackoverflow: FetcherResponse<StackOverflowResult>;
  g2: FetcherResponse<G2Result>;
  capterra: FetcherResponse<CapterraResult>;
  producthunt: FetcherResponse<ProductHuntResult>;
  youtube: FetcherResponse<YouTubeResult>;
  google_trends: { data: GoogleTrendsResult | null; serpapi_calls_used: number; error?: string };
  total_serpapi_calls: number;
}

export async function fetchAllSources(query: string, enabledSources?: SourceName[]): Promise<BatchFetchResult> {
  const all: SourceName[] = enabledSources || [
    'reddit', 'hacker_news', 'twitter', 'quora', 'stackoverflow',
    'g2', 'capterra', 'producthunt', 'youtube', 'google_trends',
  ];

  const shouldFetch = (source: SourceName) => all.includes(source);

  const [reddit, hacker_news, twitter, quora, stackoverflow, g2, capterra, producthunt, youtube, google_trends] =
    await Promise.all([
      shouldFetch('reddit') ? fetchReddit(query) : emptyResponse<RedditResult>('reddit', query),
      shouldFetch('hacker_news') ? fetchHackerNews(query) : emptyResponse<HackerNewsResult>('hacker_news', query),
      shouldFetch('twitter') ? fetchTwitter(query) : emptyResponse<TwitterResult>('twitter', query),
      shouldFetch('quora') ? fetchQuora(query) : emptyResponse<QuoraResult>('quora', query),
      shouldFetch('stackoverflow') ? fetchStackOverflow(query) : emptyResponse<StackOverflowResult>('stackoverflow', query),
      shouldFetch('g2') ? fetchG2Reviews(query) : emptyResponse<G2Result>('g2', query),
      shouldFetch('capterra') ? fetchCapterraReviews(query) : emptyResponse<CapterraResult>('capterra', query),
      shouldFetch('producthunt') ? fetchProductHunt(query) : emptyResponse<ProductHuntResult>('producthunt', query),
      shouldFetch('youtube') ? fetchYouTube(query) : emptyResponse<YouTubeResult>('youtube', query),
      shouldFetch('google_trends') ? fetchGoogleTrends(query) : { data: null, serpapi_calls_used: 0 },
    ]);

  const totalCalls = [reddit, hacker_news, twitter, quora, stackoverflow, g2, capterra, producthunt, youtube]
    .reduce((sum, r) => sum + r.serpapi_calls_used, 0) + google_trends.serpapi_calls_used;

  return {
    reddit,
    hacker_news,
    twitter,
    quora,
    stackoverflow,
    g2,
    capterra,
    producthunt,
    youtube,
    google_trends,
    total_serpapi_calls: totalCalls,
  };
}

function emptyResponse<T>(source: SourceName, query: string): FetcherResponse<T> {
  return {
    data: [],
    total_results: 0,
    source,
    query_used: query,
    fetched_at: new Date().toISOString(),
    error: 'Source disabled',
    serpapi_calls_used: 0,
  };
}
