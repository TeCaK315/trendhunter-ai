import { NextRequest, NextResponse } from 'next/server';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface RedditPost {
  title: string;
  subreddit: string;
  score: number;
  num_comments: number;
  url: string;
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
  error?: string;
}

interface NicheSourcesResponse {
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
  synthesis?: {
    key_insights: string[];
    sentiment_summary: string;
    content_gaps: string[];
    recommended_angles: string[];
  };
}

// Fetch Reddit posts using SerpAPI
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
      return {
        posts: [],
        communities: [],
        engagement: 0,
        error: `Ошибка SerpAPI (${response.status}): Не удалось получить данные Reddit`
      };
    }

    const data = await response.json();

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

        const snippetText = result.snippet || '';
        const scoreMatch = snippetText.match(/(\d+)\s*(?:points?|upvotes?)/i);
        const commentsMatch = snippetText.match(/(\d+)\s*comments?/i);

        const score = scoreMatch ? parseInt(scoreMatch[1]) : 0;
        const numComments = commentsMatch ? parseInt(commentsMatch[1]) : 0;
        totalEngagement += score + numComments * 2;

        posts.push({
          title: result.title?.replace(/ : .*$/, '').replace(/ - Reddit$/, '') || 'Reddit Discussion',
          subreddit,
          score,
          num_comments: numComments,
          url,
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

// Fetch YouTube videos
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

// Generate query variants for better Google Trends results
function generateQueryVariants(query: string): string[] {
  const variants: string[] = [];
  const cleaned = query.trim();

  // Original query
  variants.push(cleaned);

  // Extract meaningful words
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);

  // Two word combinations
  if (words.length >= 2) {
    variants.push(words.slice(0, 2).join(' '));
  }

  // First word only
  if (words.length >= 1) {
    variants.push(words[0]);
  }

  return [...new Set(variants)].filter(v => v.length > 0);
}

// Fetch Google Trends data
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

      if (!response.ok) continue;

      const data = await response.json();
      if (data.error) continue;

      const timelineData = data.interest_over_time?.timeline_data || [];
      if (timelineData.length === 0) continue;

      // Process the data
      const interest_timeline: Array<{ date: string; value: number }> = [];
      const completeData = timelineData.slice(-13, -1);

      for (const point of completeData) {
        const date = point.date || '';
        const values = point.values || [];
        const value = values[0]?.extracted_value ?? parseInt(values[0]?.value || '0') ?? 0;
        interest_timeline.push({ date, value: Number(value) });
      }

      let growth_rate = 0;
      if (interest_timeline.length >= 2) {
        const oldValue = interest_timeline[0].value || 1;
        const newValue = interest_timeline[interest_timeline.length - 1].value || 0;
        growth_rate = Math.round(((newValue - oldValue) / oldValue) * 100);
      }

      let related_queries: Array<{ query: string; growth: string; link?: string }> = [];
      const topQueries = data.related_queries?.top || [];
      if (topQueries.length > 0) {
        related_queries = topQueries.slice(0, 10).map((item: { query: string; extracted_value?: number; value?: string; link?: string }) => ({
          query: item.query,
          growth: `${item.extracted_value || item.value || 0}`,
          link: item.link,
        }));
      }

      return {
        growth_rate,
        related_queries,
        interest_timeline,
        search_query: currentQuery,
        google_trends_url: data.search_metadata?.google_trends_url || `https://trends.google.com/trends/explore?q=${encodeURIComponent(currentQuery)}&date=today%2012-m`,
      };
    } catch (error) {
      console.error(`Error fetching Google Trends for "${currentQuery}":`, error);
      continue;
    }
  }

  return {
    growth_rate: 0,
    related_queries: [],
    error: `Не найдено данных Google Trends для запроса "${query}"`
  };
}

// Generate AI synthesis of collected data
async function generateSynthesis(
  niche: string,
  description: string,
  sources: NicheSourcesResponse
): Promise<{
  key_insights: string[];
  sentiment_summary: string;
  content_gaps: string[];
  recommended_angles: string[];
}> {
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
    const prompt = `Проанализируй собранные данные для ниши "${niche}".

Описание ниши: ${description}

${hasRedditData ? `Данные из Reddit (${sources.reddit.posts.length} постов):
${sources.reddit.posts.slice(0, 5).map(p => `- "${p.title}" (${p.score} upvotes, r/${p.subreddit})`).join('\n')}
Сообщества: ${sources.reddit.communities.join(', ')}` : 'Reddit: нет данных'}

${hasGoogleTrendsData ? `Данные из Google Trends:
- Рост за год: ${sources.google_trends.growth_rate}%
- Связанные запросы: ${sources.google_trends.related_queries?.slice(0, 5).map(q => q.query).join(', ')}` : 'Google Trends: нет данных'}

${hasYoutubeData ? `YouTube видео (${sources.youtube.videos.length}):
${sources.youtube.videos.slice(0, 3).map(v => `- "${v.title}" (${v.channel})`).join('\n')}` : 'YouTube: нет данных'}

Верни JSON:
{
  "key_insights": ["3-5 ключевых инсайтов из РЕАЛЬНЫХ данных"],
  "sentiment_summary": "Краткое описание настроения аудитории (позитивное/негативное/смешанное) на основе данных",
  "content_gaps": ["Какие темы недостаточно освещены - возможности для контента"],
  "recommended_angles": ["Рекомендуемые углы для продукта/контента на основе данных"]
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
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API error');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return JSON.parse(content);
  } catch (error) {
    console.error('Error generating synthesis:', error);
    return {
      key_insights: ['Ошибка при генерации AI-синтеза'],
      sentiment_summary: 'Ошибка анализа',
      content_gaps: [],
      recommended_angles: [],
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { niche, description, keywords } = body;

    if (!niche) {
      return NextResponse.json(
        { success: false, error: 'Название ниши обязательно' },
        { status: 400 }
      );
    }

    // Check API keys
    const missingKeys: string[] = [];
    if (!SERPAPI_KEY) missingKeys.push('SERPAPI_KEY');
    if (!YOUTUBE_API_KEY) missingKeys.push('YOUTUBE_API_KEY');

    // Generate search queries
    const searchQueries = [niche];
    if (keywords && Array.isArray(keywords)) {
      searchQueries.push(...keywords.slice(0, 2));
    }

    // Fetch all sources in parallel
    const redditPromises = searchQueries.slice(0, 2).map(q => fetchRedditPosts(q));
    const [youtubeData, googleTrendsData, ...redditResults] = await Promise.all([
      fetchYouTubeVideos(niche),
      fetchGoogleTrends(niche),
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

    const sources: NicheSourcesResponse = {
      reddit: {
        posts: combinedRedditPosts.slice(0, 15),
        communities: Array.from(communitiesSet).slice(0, 8),
        engagement: totalEngagement,
        error: redditErrors.length > 0 ? redditErrors[0] : undefined,
      },
      youtube: youtubeData,
      google_trends: googleTrendsData,
    };

    // Generate AI synthesis
    const synthesis = await generateSynthesis(niche, description || '', sources);
    sources.synthesis = synthesis;

    return NextResponse.json({
      success: true,
      sources,
      niche,
      queries_used: searchQueries,
      collected_at: new Date().toISOString(),
      warnings: missingKeys.length > 0 ? `Отсутствуют API ключи: ${missingKeys.join(', ')}` : undefined,
    });
  } catch (error) {
    console.error('Error collecting niche sources:', error);
    return NextResponse.json(
      { success: false, error: 'Ошибка сбора данных' },
      { status: 500 }
    );
  }
}
