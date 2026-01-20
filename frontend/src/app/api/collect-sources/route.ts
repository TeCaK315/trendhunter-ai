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
  search_query?: string;
  google_trends_url?: string;
  fetched_at?: string;
  error?: string;
}

interface CollectedSources {
  reddit: {
    posts: RedditPost[];
    communities: string[];
    engagement: number;
    error?: string;
  };
  youtube: {
    videos: YouTubeVideo[];
    channels: string[];
    error?: string;
  };
  google_trends: GoogleTrendsData;
  facebook: {
    pages: Array<{ name: string; category: string; fan_count: number; about: string; url: string }>;
    reach: number;
  };
}

// Fetch Reddit posts using SerpAPI - NO MOCKS, real data only
async function fetchRedditPosts(query: string): Promise<{ posts: RedditPost[]; communities: string[]; engagement: number; error?: string }> {
  if (!SERPAPI_KEY) {
    return {
      posts: [],
      communities: [],
      engagement: 0,
      error: 'SERPAPI_KEY не настроен. Добавьте ключ в .env.local для получения данных Reddit.'
    };
  }

  try {
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=site:reddit.com+${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=20`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SerpAPI Reddit error:', response.status, errorText);
      return {
        posts: [],
        communities: [],
        engagement: 0,
        error: `Ошибка SerpAPI (${response.status}): Не удалось получить данные Reddit`
      };
    }

    const data = await response.json();

    // Check for API error
    if (data.error) {
      return {
        posts: [],
        communities: [],
        engagement: 0,
        error: `SerpAPI: ${data.error}`
      };
    }

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

        // Only use extracted values, not random
        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const numComments = commentsMatch ? parseInt(commentsMatch[1]) : 0;

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
      return {
        posts: [],
        communities: [],
        engagement: 0,
        error: `По запросу "${query}" не найдено постов на Reddit`
      };
    }

    return {
      posts: posts.slice(0, 10),
      communities: Array.from(communitiesSet).slice(0, 5),
      engagement: totalEngagement,
    };
  } catch (error) {
    console.error('Error fetching Reddit posts:', error);
    return {
      posts: [],
      communities: [],
      engagement: 0,
      error: `Ошибка сети при запросе Reddit: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Fetch YouTube videos - NO MOCKS, real data only
async function fetchYouTubeVideos(query: string): Promise<{ videos: YouTubeVideo[]; channels: string[]; error?: string }> {
  if (!YOUTUBE_API_KEY) {
    return {
      videos: [],
      channels: [],
      error: 'YOUTUBE_API_KEY не настроен. Добавьте ключ в .env.local для получения данных YouTube.'
    };
  }

  try {
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(searchUrl);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('YouTube API error:', response.status, errorData);
      return {
        videos: [],
        channels: [],
        error: `Ошибка YouTube API (${response.status}): ${errorData.error?.message || 'Не удалось получить данные'}`
      };
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
      return {
        videos: [],
        channels: [],
        error: `По запросу "${query}" не найдено видео на YouTube`
      };
    }

    return {
      videos,
      channels: Array.from(channelsSet).slice(0, 5),
    };
  } catch (error) {
    console.error('Error fetching YouTube videos:', error);
    return {
      videos: [],
      channels: [],
      error: `Ошибка сети при запросе YouTube: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

// Generate simplified query variants for Google Trends
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

  // Extract meaningful words
  const skipWords = [
    'the', 'and', 'for', 'with', 'app', 'tool', 'platform', 'service',
    'powered', 'based', 'intelligent', 'smart', 'automated', 'automation',
    'ai', 'artificial', 'intelligence', 'machine', 'learning'
  ];

  const words = cleaned.split(/\s+/).filter(w =>
    w.length > 2 && !skipWords.includes(w.toLowerCase())
  );

  // Core topic only
  if (words.length >= 2) {
    variants.push(words.slice(0, 2).join(' '));
  }
  if (words.length >= 1) {
    variants.push(words[0]);
  }

  // Add health-related variants
  const healthTerms = ['mental', 'health', 'therapy', 'wellness', 'psychology', 'mind'];
  const isHealthRelated = words.some(w => healthTerms.includes(w.toLowerCase()));
  if (isHealthRelated) {
    variants.push('mental health app');
    variants.push('therapy app');
    variants.push('mental wellness');
  }

  // Original query simplified
  if (cleaned !== originalQuery) {
    variants.push(cleaned);
  }

  // Full original as last resort
  variants.push(originalQuery);

  return [...new Set(variants)].filter(v => v.length > 0);
}

// Fetch Google Trends data - NO MOCKS, real data only
async function fetchGoogleTrends(query: string): Promise<GoogleTrendsData> {
  if (!SERPAPI_KEY) {
    return {
      growth_rate: 0,
      related_queries: [],
      error: 'SERPAPI_KEY не настроен. Добавьте ключ в .env.local для получения данных Google Trends.'
    };
  }

  const queryVariants = generateQueryVariants(query);

  for (const currentQuery of queryVariants) {
    try {
      const trendsUrl = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(currentQuery)}&date=today%2012-m&api_key=${SERPAPI_KEY}`;
      const response = await fetch(trendsUrl);

      if (!response.ok) {
        continue;
      }

      const data = await response.json();

      if (data.error) {
        continue;
      }

      const timelineData = data.interest_over_time?.timeline_data || [];
      if (timelineData.length === 0) {
        continue;
      }

      // We found real data - process it
      return processGoogleTrendsData(data, currentQuery);
    } catch (error) {
      console.error(`Error fetching Google Trends for "${currentQuery}":`, error);
      continue;
    }
  }

  // All variants failed - return honest error
  return {
    growth_rate: 0,
    related_queries: [],
    error: `Не найдено данных Google Trends для запроса "${query}" и его вариаций`
  };
}

// Process Google Trends data from SerpAPI response
function processGoogleTrendsData(data: Record<string, unknown>, usedQuery: string): GoogleTrendsData {
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

  // Get related queries
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

  return {
    growth_rate,
    related_queries,
    interest_timeline,
    search_query: usedQuery,
    google_trends_url: googleTrendsUrl,
    fetched_at: new Date().toISOString(),
  };
}

// Генерирует расширенные поисковые запросы на основе контекста анализа
function generateContextualQueries(context: AnalysisContext): string[] {
  const queries: string[] = [];
  const baseQuery = context.trend.title;

  queries.push(baseQuery);

  if (context.analysis) {
    if (context.analysis.main_pain) {
      queries.push(`${baseQuery} ${context.analysis.main_pain}`);
    }

    if (context.analysis.key_pain_points?.length) {
      for (const pain of context.analysis.key_pain_points.slice(0, 2)) {
        queries.push(pain);
      }
    }

    if (context.analysis.target_audience?.primary) {
      queries.push(`${baseQuery} for ${context.analysis.target_audience.primary}`);
    }
  }

  return [...new Set(queries)];
}

// Генерирует AI-синтез найденных данных
async function generateSourcesSynthesis(
  context: AnalysisContext,
  sources: CollectedSources
): Promise<{
  key_insights: string[];
  sentiment_summary: string;
  content_gaps: string[];
  recommended_angles: string[];
}> {
  // Check if we have any real data to analyze
  const hasRedditData = sources.reddit.posts.length > 0;
  const hasYoutubeData = sources.youtube.videos.length > 0;
  const hasGoogleTrendsData = sources.google_trends.interest_timeline && sources.google_trends.interest_timeline.length > 0;

  if (!hasRedditData && !hasYoutubeData && !hasGoogleTrendsData) {
    return {
      key_insights: ['Недостаточно данных для анализа. Проверьте настройки API ключей.'],
      sentiment_summary: 'Нет данных',
      content_gaps: [],
      recommended_angles: [],
    };
  }

  if (!OPENAI_API_KEY) {
    return {
      key_insights: ['Данные собраны, но для AI-синтеза требуется OPENAI_API_KEY'],
      sentiment_summary: 'Требуется OpenAI API для анализа',
      content_gaps: [],
      recommended_angles: [],
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

${hasRedditData ? `Данные из Reddit (${sources.reddit.posts.length} постов):
${sources.reddit.posts.slice(0, 5).map(p => `- "${p.title}" (${p.score} upvotes, r/${p.subreddit})`).join('\n')}` : 'Reddit: нет данных'}

${hasGoogleTrendsData ? `Данные из Google Trends:
- Рост: ${sources.google_trends.growth_rate}%
- Связанные запросы: ${sources.google_trends.related_queries?.slice(0, 5).map(q => q.query).join(', ')}` : 'Google Trends: нет данных'}

${hasYoutubeData ? `YouTube видео (${sources.youtube.videos.length}):
${sources.youtube.videos.slice(0, 3).map(v => `- "${v.title}" (${v.channel})`).join('\n')}` : 'YouTube: нет данных'}

Верни JSON:
{
  "key_insights": ["3-5 ключевых инсайтов из РЕАЛЬНЫХ данных"],
  "sentiment_summary": "Краткое описание настроения аудитории на основе данных",
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
    key_insights: ['Ошибка при генерации AI-синтеза'],
    sentiment_summary: 'Ошибка анализа',
    content_gaps: [],
    recommended_angles: [],
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, trend_title, context } = body;

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

    // Check API keys and warn if missing
    const missingKeys: string[] = [];
    if (!SERPAPI_KEY) missingKeys.push('SERPAPI_KEY');
    if (!YOUTUBE_API_KEY) missingKeys.push('YOUTUBE_API_KEY');

    const contextualQueries = generateContextualQueries(analysisContext);

    // Fetch all sources in parallel
    const redditPromises = contextualQueries.slice(0, 2).map(q => fetchRedditPosts(q));
    const [youtubeData, googleTrendsData, ...redditResults] = await Promise.all([
      fetchYouTubeVideos(searchQuery),
      fetchGoogleTrends(searchQuery),
      ...redditPromises,
    ]);

    // Combine Reddit results
    const combinedRedditPosts: RedditPost[] = [];
    const communitiesSet = new Set<string>();
    let totalEngagement = 0;
    const redditErrors: string[] = [];

    for (const result of redditResults) {
      if (result.error) {
        redditErrors.push(result.error);
      }
      for (const post of result.posts) {
        if (!combinedRedditPosts.some(p => p.url === post.url)) {
          combinedRedditPosts.push(post);
        }
      }
      result.communities.forEach(c => communitiesSet.add(c));
      totalEngagement += result.engagement;
    }

    const redditData = {
      posts: combinedRedditPosts.slice(0, 15),
      communities: Array.from(communitiesSet).slice(0, 8),
      engagement: totalEngagement,
      error: redditErrors.length > 0 ? redditErrors[0] : undefined,
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

    // Generate AI synthesis
    const synthesis = await generateSourcesSynthesis(analysisContext, sources);

    return NextResponse.json({
      success: true,
      sources,
      synthesis,
      query: searchQuery,
      contextual_queries_used: contextualQueries,
      context_received: !!analysisContext.analysis,
      collected_at: new Date().toISOString(),
      warnings: missingKeys.length > 0 ? `Отсутствуют API ключи: ${missingKeys.join(', ')}` : undefined,
    });
  } catch (error) {
    console.error('Error collecting sources:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to collect sources' },
      { status: 500 }
    );
  }
}
