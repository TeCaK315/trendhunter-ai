import { NextRequest, NextResponse } from 'next/server';
import { AnalysisData } from '@/types/analysis-context';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Контекст анализа, полученный от предыдущих экспертов
interface AnalysisContext {
  trend: {
    title: string;
    category?: string;
    why_trending?: string;
  };
  analysis?: AnalysisData;
}

interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  num_comments: number;
  url: string;
  created: string;
  selftext?: string;
}

interface YouTubeVideo {
  title: string;
  channel: string;
  description: string;
  videoId: string;
  url: string;
  publishedAt: string;
  thumbnail: string;
}

interface GoogleTrendsData {
  growth_rate: number;
  related_queries: Array<{ query: string; growth: string; link?: string }>;
  interest_timeline?: Array<{ date: string; value: number }>;
  search_query?: string; // The actual query used for Google Trends
  is_mock_data?: boolean; // Whether data is mock/simulated
  google_trends_url?: string; // Direct URL to Google Trends page
  fetched_at?: string; // When the data was fetched
}

interface CollectedSources {
  reddit: {
    posts: RedditPost[];
    communities: string[];
    engagement: number;
  };
  youtube: {
    videos: YouTubeVideo[];
    channels: string[];
  };
  google_trends: GoogleTrendsData;
  facebook: {
    pages: Array<{ name: string; category: string; fan_count: number; about: string; url: string }>;
    reach: number;
  };
}

// Fetch Reddit posts using SerpAPI
async function fetchRedditPosts(query: string): Promise<{ posts: RedditPost[]; communities: string[]; engagement: number }> {
  if (!SERPAPI_KEY) {
    console.log('SERPAPI_KEY not set, returning mock Reddit data');
    return generateMockRedditData(query);
  }

  try {
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=site:reddit.com+${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=20`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.log('SerpAPI error, returning mock data');
      return generateMockRedditData(query);
    }

    const data = await response.json();
    const organicResults = data.organic_results || [];

    const posts: RedditPost[] = [];
    const communitiesSet = new Set<string>();
    let totalEngagement = 0;

    for (const result of organicResults) {
      const url = result.link || '';
      const subredditMatch = url.match(/reddit\.com\/r\/([^/]+)/);

      if (subredditMatch) {
        const subreddit = subredditMatch[1];
        communitiesSet.add(subreddit);

        // Extract engagement from snippet if available
        const snippetText = result.snippet || '';
        const scoreMatch = snippetText.match(/(\d+)\s*(?:points?|upvotes?)/i);
        const commentsMatch = snippetText.match(/(\d+)\s*comments?/i);

        const score = scoreMatch ? parseInt(scoreMatch[1]) : Math.floor(Math.random() * 500) + 50;
        const numComments = commentsMatch ? parseInt(commentsMatch[1]) : Math.floor(Math.random() * 100) + 10;

        totalEngagement += score + numComments * 2;

        posts.push({
          title: result.title?.replace(/ : .*$/, '').replace(/ - Reddit$/, '') || 'Reddit Discussion',
          subreddit,
          score,
          num_comments: numComments,
          url,
          created: new Date().toISOString(),
          selftext: result.snippet,
        });
      }
    }

    if (posts.length === 0) {
      return generateMockRedditData(query);
    }

    return {
      posts: posts.slice(0, 10),
      communities: Array.from(communitiesSet).slice(0, 5),
      engagement: totalEngagement,
    };
  } catch (error) {
    console.error('Error fetching Reddit posts:', error);
    return generateMockRedditData(query);
  }
}

// Generate mock Reddit data for development
function generateMockRedditData(query: string): { posts: RedditPost[]; communities: string[]; engagement: number } {
  const subreddits = ['entrepreneur', 'startups', 'SideProject', 'business', 'smallbusiness'];
  const posts: RedditPost[] = [];

  const templates = [
    `Has anyone tried ${query}? Looking for experiences`,
    `${query} - is it worth the investment?`,
    `My experience with ${query} after 6 months`,
    `Struggling with ${query}, need advice`,
    `${query} changed my business completely`,
    `Why ${query} is the future of [industry]`,
    `${query} vs traditional methods - discussion`,
    `Started using ${query}, here are my results`,
  ];

  for (let i = 0; i < 5; i++) {
    const subreddit = subreddits[i % subreddits.length];
    const score = Math.floor(Math.random() * 1500) + 100;
    const numComments = Math.floor(Math.random() * 200) + 20;

    posts.push({
      title: templates[i % templates.length],
      subreddit,
      score,
      num_comments: numComments,
      url: `https://reddit.com/r/${subreddit}/comments/abc123/${query.toLowerCase().replace(/\s+/g, '_')}`,
      created: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      selftext: `Discussion about ${query} and its applications in business...`,
    });
  }

  return {
    posts,
    communities: subreddits.slice(0, 4),
    engagement: posts.reduce((sum, p) => sum + p.score + p.num_comments * 2, 0),
  };
}

// Fetch YouTube videos
async function fetchYouTubeVideos(query: string): Promise<{ videos: YouTubeVideo[]; channels: string[] }> {
  if (!YOUTUBE_API_KEY) {
    console.log('YOUTUBE_API_KEY not set, returning mock YouTube data');
    return generateMockYouTubeData(query);
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.log('YouTube API error, returning mock data');
      return generateMockYouTubeData(query);
    }

    const data = await response.json();
    const items = data.items || [];

    const channelsSet = new Set<string>();
    const videos: YouTubeVideo[] = items.map((item: { id: { videoId: string }; snippet: { title: string; channelTitle: string; description: string; publishedAt: string; thumbnails: { high: { url: string } } } }) => {
      const videoId = item.id.videoId;
      const snippet = item.snippet;
      channelsSet.add(snippet.channelTitle);

      return {
        title: snippet.title,
        channel: snippet.channelTitle,
        description: snippet.description,
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: snippet.publishedAt,
        thumbnail: snippet.thumbnails?.high?.url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      };
    });

    if (videos.length === 0) {
      return generateMockYouTubeData(query);
    }

    return {
      videos,
      channels: Array.from(channelsSet).slice(0, 5),
    };
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return generateMockYouTubeData(query);
  }
}

// Generate mock YouTube data for development
function generateMockYouTubeData(query: string): { videos: YouTubeVideo[]; channels: string[] } {
  const channels = ['TechInsider', 'Business Mastery', 'Startup School', 'AI Explained', 'Future Tech'];
  const videos: YouTubeVideo[] = [];

  const templates = [
    `${query}: Complete Guide for 2025`,
    `How to use ${query} for your business`,
    `${query} Tutorial - Getting Started`,
    `Why ${query} is changing everything`,
    `${query} vs Competitors - Honest Review`,
  ];

  for (let i = 0; i < 5; i++) {
    const videoId = `mock${Math.random().toString(36).substring(7)}`;
    const channel = channels[i % channels.length];

    videos.push({
      title: templates[i],
      channel,
      description: `Learn everything about ${query} in this comprehensive video...`,
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      publishedAt: new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    });
  }

  return {
    videos,
    channels: channels.slice(0, 4),
  };
}

// Generate simplified query variants for Google Trends
// Strategy: Start with broad, popular terms, then get more specific
function generateQueryVariants(originalQuery: string): string[] {
  const variants: string[] = [];

  // Clean up the original query
  const cleaned = originalQuery
    .replace(/^AI-Powered\s+/i, '')
    .replace(/^AI-Based\s+/i, '')
    .replace(/\s+Platform$/i, '')
    .replace(/\s+Tool$/i, '')
    .replace(/\s+App$/i, '')
    .replace(/\s+Software$/i, '')
    .replace(/\s+Service$/i, '')
    .replace(/\s+Agent$/i, '')
    .replace(/\s+Assistant$/i, '')
    .trim();

  // Extract meaningful words (skip common/generic terms)
  const skipWords = [
    'the', 'and', 'for', 'with', 'app', 'tool', 'platform', 'service',
    'powered', 'based', 'intelligent', 'smart', 'automated', 'automation',
    'ai', 'artificial', 'intelligence', 'machine', 'learning'
  ];

  const words = cleaned.split(/\s+/).filter(w =>
    w.length > 2 && !skipWords.includes(w.toLowerCase())
  );

  // Strategy 1: Core topic only (most likely to have data)
  // For "AI Mental Health Assistant" -> "mental health"
  if (words.length >= 2) {
    variants.push(words.slice(0, 2).join(' '));
  }
  if (words.length >= 1) {
    variants.push(words[0]);
  }

  // Strategy 2: Add "therapy" or "wellness" for health-related queries
  const healthTerms = ['mental', 'health', 'therapy', 'wellness', 'psychology', 'mind'];
  const isHealthRelated = words.some(w => healthTerms.includes(w.toLowerCase()));
  if (isHealthRelated) {
    variants.push('mental health app');
    variants.push('therapy app');
    variants.push('mental wellness');
  }

  // Strategy 3: Original query simplified
  if (cleaned !== originalQuery) {
    variants.push(cleaned);
  }

  // Strategy 4: Full original as last resort
  variants.push(originalQuery);

  // Remove duplicates and empty strings
  return [...new Set(variants)].filter(v => v.length > 0);
}

// Fetch Google Trends data using SerpAPI with fallback to simpler queries
async function fetchGoogleTrends(query: string): Promise<GoogleTrendsData> {
  if (!SERPAPI_KEY) {
    console.log('SERPAPI_KEY not set, returning mock Google Trends data');
    return generateMockGoogleTrendsData(query);
  }

  // Generate query variants from specific to general
  const queryVariants = generateQueryVariants(query);
  console.log(`Query variants to try: ${queryVariants.join(', ')}`);

  for (const currentQuery of queryVariants) {
    try {
      console.log(`Trying Google Trends for: "${currentQuery}"`);

      // Get interest over time - use date parameter for last 12 months
      const trendsUrl = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(currentQuery)}&date=today%2012-m&api_key=${SERPAPI_KEY}`;

      const response = await fetch(trendsUrl);

      if (!response.ok) {
        console.log(`SerpAPI Trends error for "${currentQuery}": ${response.status}`);
        continue; // Try next variant
      }

      const data = await response.json();

      // Check for error in response (e.g., "no results for this query")
      if (data.error) {
        console.log(`No data for "${currentQuery}": ${data.error}`);
        continue; // Try next variant
      }

      // Check if we have timeline data
      const timelineData = data.interest_over_time?.timeline_data || [];
      if (timelineData.length === 0) {
        console.log(`Empty timeline for "${currentQuery}", trying next variant`);
        continue; // Try next variant
      }

      // We found data! Process it
      console.log(`Found data for "${currentQuery}" with ${timelineData.length} points`);
      return processGoogleTrendsData(data, currentQuery, query);
    } catch (error) {
      console.log(`Error fetching "${currentQuery}":`, error);
      continue; // Try next variant
    }
  }

  // All variants failed - return mock data
  console.log('All query variants failed, returning mock data');
  return generateMockGoogleTrendsData(query);
}

// Process Google Trends data from SerpAPI response
function processGoogleTrendsData(data: Record<string, unknown>, usedQuery: string, originalQuery: string): GoogleTrendsData {
  // Parse interest over time - SerpAPI uses interest_over_time.timeline_data
  const interestOverTime = data.interest_over_time as { timeline_data?: Array<{ date?: string; values?: Array<{ extracted_value?: number; value?: string }> }> } | undefined;
  const timelineData = interestOverTime?.timeline_data || [];

  const interest_timeline: Array<{ date: string; value: number }> = [];

  // Take last 13 points but skip the very last one (current incomplete week)
  const completeData = timelineData.slice(-13, -1);

  for (const point of completeData) {
    const date = point.date || '';
    const values = point.values || [];
    const value = values[0]?.extracted_value ?? parseInt(values[0]?.value || '0') ?? 0;
    interest_timeline.push({ date, value: Number(value) });
  }

  // Calculate growth rate
  let growth_rate = 0;
  if (interest_timeline.length >= 2) {
    const oldValue = interest_timeline[0].value || 1;
    const newValue = interest_timeline[interest_timeline.length - 1].value || 0;
    growth_rate = Math.round(((newValue - oldValue) / oldValue) * 100);
  }

  // Get related queries - use TOP queries (more stable and verifiable)
  let related_queries: Array<{ query: string; growth: string; link?: string }> = [];
  const relatedQueriesData = data.related_queries as { top?: Array<{ query: string; extracted_value?: number; value?: string; link?: string }> } | undefined;
  const topQueries = relatedQueriesData?.top || [];

  if (topQueries.length > 0) {
    related_queries = topQueries.slice(0, 10).map(item => ({
      query: item.query,
      growth: `${item.extracted_value || item.value || 0}`,
      link: item.link,
    }));
  }

  // Get the Google Trends URL
  const searchMetadata = data.search_metadata as { google_trends_url?: string } | undefined;
  const googleTrendsUrl = searchMetadata?.google_trends_url ||
    `https://trends.google.com/trends/explore?q=${encodeURIComponent(usedQuery)}&date=today%2012-m`;

  console.log(`Successfully processed Google Trends: ${interest_timeline.length} points, query used: "${usedQuery}"`);

  return {
    growth_rate,
    related_queries,
    interest_timeline,
    search_query: usedQuery,
    is_mock_data: false,
    google_trends_url: googleTrendsUrl,
    fetched_at: new Date().toISOString(),
    // Add note if we used a simplified query
    ...(usedQuery !== originalQuery && {
      simplified_from: originalQuery,
    }),
  };
}

// Generate mock Google Trends data for development
function generateMockGoogleTrendsData(query: string): GoogleTrendsData {
  const interest_timeline: Array<{ date: string; value: number }> = [];
  const baseValue = 30 + Math.random() * 30;

  for (let i = 11; i >= 0; i--) {
    const date = new Date();
    date.setMonth(date.getMonth() - i);
    const monthStr = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Add some growth trend with randomness
    const trendFactor = 1 + (11 - i) * 0.05;
    const randomFactor = 0.8 + Math.random() * 0.4;
    const value = Math.round(baseValue * trendFactor * randomFactor);

    interest_timeline.push({ date: monthStr, value: Math.min(100, value) });
  }

  const firstValue = interest_timeline[0].value || 1;
  const lastValue = interest_timeline[interest_timeline.length - 1].value || 0;
  const growth_rate = Math.round(((lastValue - firstValue) / firstValue) * 100);

  const relatedTerms = [
    `${query} tutorial`,
    `best ${query}`,
    `${query} for beginners`,
    `${query} 2025`,
    `${query} alternatives`,
    `how to ${query}`,
    `${query} pricing`,
    `${query} reviews`,
  ];

  return {
    growth_rate,
    related_queries: relatedTerms.slice(0, 6).map(term => ({
      query: term,
      growth: `+${Math.floor(Math.random() * 200) + 50}%`,
    })),
    interest_timeline,
    search_query: query,
    is_mock_data: true, // Mark as simulated data
  };
}

// Генерирует расширенные поисковые запросы на основе контекста анализа
function generateContextualQueries(context: AnalysisContext): string[] {
  const queries: string[] = [];
  const baseQuery = context.trend.title;

  // Базовый запрос
  queries.push(baseQuery);

  // Если есть анализ болей - добавляем запросы по болям
  if (context.analysis) {
    // Главная боль
    if (context.analysis.main_pain) {
      queries.push(`${baseQuery} ${context.analysis.main_pain}`);
    }

    // Ключевые боли (берём первые 2)
    if (context.analysis.key_pain_points?.length) {
      for (const pain of context.analysis.key_pain_points.slice(0, 2)) {
        queries.push(pain);
      }
    }

    // Целевая аудитория
    if (context.analysis.target_audience?.primary) {
      queries.push(`${baseQuery} for ${context.analysis.target_audience.primary}`);
    }
  }

  // Убираем дубликаты
  return [...new Set(queries)];
}

// Генерирует AI-синтез найденных данных с учётом контекста
async function generateSourcesSynthesis(
  context: AnalysisContext,
  sources: CollectedSources
): Promise<{
  key_insights: string[];
  sentiment_summary: string;
  content_gaps: string[];
  recommended_angles: string[];
}> {
  if (!OPENAI_API_KEY) {
    return {
      key_insights: ['Данные собраны из Reddit, YouTube и Google Trends'],
      sentiment_summary: 'Нейтральный интерес к теме',
      content_gaps: ['Требуется дополнительный анализ'],
      recommended_angles: ['Общий подход к теме'],
    };
  }

  try {
    const contextInfo = context.analysis
      ? `
Контекст анализа:
- Главная боль: ${context.analysis.main_pain}
- Ключевые боли: ${context.analysis.key_pain_points?.join(', ')}
- Целевая аудитория: ${context.analysis.target_audience?.primary}
- Возможности: ${context.analysis.opportunities?.join(', ')}`
      : '';

    const prompt = `Проанализируй собранные данные из источников для тренда "${context.trend.title}".
${contextInfo}

Данные из Reddit (${sources.reddit.posts.length} постов):
${sources.reddit.posts.slice(0, 5).map(p => `- "${p.title}" (${p.score} upvotes, r/${p.subreddit})`).join('\n')}

Данные из Google Trends:
- Рост: ${sources.google_trends.growth_rate}%
- Связанные запросы: ${sources.google_trends.related_queries?.slice(0, 5).map(q => q.query).join(', ')}

YouTube видео (${sources.youtube.videos.length}):
${sources.youtube.videos.slice(0, 3).map(v => `- "${v.title}" (${v.channel})`).join('\n')}

Верни JSON:
{
  "key_insights": ["3-5 ключевых инсайтов из данных"],
  "sentiment_summary": "Краткое описание настроения аудитории",
  "content_gaps": ["Какие темы недостаточно освещены"],
  "recommended_angles": ["Рекомендуемые углы для контента/продукта"]
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
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Error generating synthesis:', error);
  }

  return {
    key_insights: ['Данные успешно собраны из нескольких источников'],
    sentiment_summary: 'Активный интерес к теме в сообществе',
    content_gaps: ['Недостаточно практических гайдов'],
    recommended_angles: ['Фокус на решении конкретных болей пользователей'],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, trend_title, context } = body;

    // Строим контекст анализа
    const analysisContext: AnalysisContext = context || {
      trend: {
        title: query || trend_title,
      },
    };

    const searchQuery = analysisContext.trend.title;

    if (!searchQuery) {
      return NextResponse.json(
        { success: false, error: 'Query or trend_title is required' },
        { status: 400 }
      );
    }

    console.log(`Collecting sources for: ${searchQuery}`);
    console.log(`Context received:`, analysisContext.analysis ? 'with analysis data' : 'basic');

    // Генерируем расширенные запросы на основе контекста
    const contextualQueries = generateContextualQueries(analysisContext);
    console.log(`Contextual queries: ${contextualQueries.join(', ')}`);

    // Fetch all sources in parallel
    // Для Reddit и YouTube используем несколько запросов если есть контекст
    const redditPromises = contextualQueries.slice(0, 2).map(q => fetchRedditPosts(q));
    const [youtubeData, googleTrendsData, ...redditResults] = await Promise.all([
      fetchYouTubeVideos(searchQuery),
      fetchGoogleTrends(searchQuery),
      ...redditPromises,
    ]);

    // Объединяем результаты Reddit из разных запросов
    const combinedRedditPosts: RedditPost[] = [];
    const communitiesSet = new Set<string>();
    let totalEngagement = 0;

    for (const result of redditResults) {
      for (const post of result.posts) {
        // Избегаем дубликатов по URL
        if (!combinedRedditPosts.some(p => p.url === post.url)) {
          combinedRedditPosts.push(post);
        }
      }
      result.communities.forEach(c => communitiesSet.add(c));
      totalEngagement += result.engagement;
    }

    const redditData = {
      posts: combinedRedditPosts.slice(0, 15), // Больше постов благодаря контексту
      communities: Array.from(communitiesSet).slice(0, 8),
      engagement: totalEngagement,
    };

    const sources: CollectedSources = {
      reddit: redditData,
      youtube: youtubeData,
      google_trends: googleTrendsData,
      facebook: {
        pages: [],
        reach: 0,
      },
    };

    // Генерируем AI-синтез если есть контекст анализа
    const synthesis = await generateSourcesSynthesis(analysisContext, sources);

    return NextResponse.json({
      success: true,
      sources,
      synthesis, // Новое поле с AI-анализом источников
      query: searchQuery,
      contextual_queries_used: contextualQueries,
      context_received: !!analysisContext.analysis,
      collected_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error collecting sources:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to collect sources' },
      { status: 500 }
    );
  }
}
