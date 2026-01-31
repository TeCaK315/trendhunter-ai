import { NextRequest, NextResponse } from 'next/server';
import { AnalysisData } from '@/types/analysis-context';
import {
  fetchReddit,
  fetchHackerNews,
  fetchTwitter,
  fetchQuora,
  fetchStackOverflow,
  fetchYouTube,
  fetchGoogleTrends,
} from '@/lib/data-fetchers';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';

// Контекст анализа, полученный от предыдущих экспертов
interface AnalysisContext {
  trend: {
    title: string;
    category?: string;
    why_trending?: string;
  };
  analysis?: AnalysisData;
}

interface CollectedSources {
  reddit: {
    posts: Array<{ title: string; subreddit: string; score: number; num_comments: number; url: string; created: string; selftext?: string }>;
    communities: string[];
    engagement: number;
    error?: string;
  };
  hacker_news: {
    posts: Array<{ title: string; url: string; points: number; snippet: string }>;
    error?: string;
  };
  twitter: {
    discussions: Array<{ title: string; url: string; snippet: string }>;
    error?: string;
  };
  quora: {
    questions: Array<{ title: string; url: string; snippet: string }>;
    error?: string;
  };
  stackoverflow: {
    questions: Array<{ title: string; url: string; votes: number; answers: number; snippet: string }>;
    error?: string;
  };
  youtube: {
    videos: Array<{ title: string; channel: string; description: string; videoId: string; url: string; publishedAt: string; thumbnail: string }>;
    channels: string[];
    error?: string;
  };
  google_trends: {
    growth_rate: number;
    related_queries: Array<{ query: string; growth: string; link?: string }>;
    interest_timeline?: Array<{ date: string; value: number }>;
    search_query?: string;
    google_trends_url?: string;
    fetched_at?: string;
    error?: string;
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

// Генерирует AI-синтез найденных данных — с обязательными ссылками на реальные посты
async function generateSourcesSynthesis(
  context: AnalysisContext,
  sources: CollectedSources
): Promise<{
  key_insights: string[];
  sentiment_summary: string;
  content_gaps: string[];
  recommended_angles: string[];
}> {
  const hasReddit = sources.reddit.posts.length > 0;
  const hasHN = sources.hacker_news.posts.length > 0;
  const hasTwitter = sources.twitter.discussions.length > 0;
  const hasQuora = sources.quora.questions.length > 0;
  const hasSO = sources.stackoverflow.questions.length > 0;
  const hasYoutube = sources.youtube.videos.length > 0;
  const hasTrends = sources.google_trends.interest_timeline && sources.google_trends.interest_timeline.length > 0;

  const totalDataPoints = sources.reddit.posts.length +
    sources.hacker_news.posts.length +
    sources.twitter.discussions.length +
    sources.quora.questions.length +
    sources.stackoverflow.questions.length +
    sources.youtube.videos.length;

  if (totalDataPoints === 0 && !hasTrends) {
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

    // Build data sections from ALL sources
    let dataSections = '';

    if (hasReddit) {
      dataSections += `\nReddit (${sources.reddit.posts.length} постов, engagement: ${sources.reddit.engagement}):
${sources.reddit.posts.slice(0, 5).map(p => `- "${p.title}" (${p.score} upvotes, r/${p.subreddit}, URL: ${p.url})`).join('\n')}`;
    }

    if (hasHN) {
      dataSections += `\nHacker News (${sources.hacker_news.posts.length} постов):
${sources.hacker_news.posts.slice(0, 3).map(p => `- "${p.title}" (${p.points} points, URL: ${p.url})`).join('\n')}`;
    }

    if (hasTwitter) {
      dataSections += `\nTwitter/X (${sources.twitter.discussions.length} обсуждений):
${sources.twitter.discussions.slice(0, 3).map(d => `- "${d.title}" (URL: ${d.url})`).join('\n')}`;
    }

    if (hasQuora) {
      dataSections += `\nQuora (${sources.quora.questions.length} вопросов):
${sources.quora.questions.slice(0, 3).map(q => `- "${q.title}" (URL: ${q.url})`).join('\n')}`;
    }

    if (hasSO) {
      dataSections += `\nStack Overflow (${sources.stackoverflow.questions.length} вопросов):
${sources.stackoverflow.questions.slice(0, 3).map(q => `- "${q.title}" (${q.votes} votes, ${q.answers} answers, URL: ${q.url})`).join('\n')}`;
    }

    if (hasTrends) {
      dataSections += `\nGoogle Trends:
- Рост: ${sources.google_trends.growth_rate}%
- Связанные запросы: ${sources.google_trends.related_queries?.slice(0, 5).map(q => q.query).join(', ')}`;
    }

    if (hasYoutube) {
      dataSections += `\nYouTube (${sources.youtube.videos.length} видео):
${sources.youtube.videos.slice(0, 3).map(v => `- "${v.title}" (${v.channel})`).join('\n')}`;
    }

    const prompt = `Проанализируй собранные данные из источников для тренда "${context.trend.title}".
${contextInfo}

РЕАЛЬНЫЕ ДАННЫЕ:
${dataSections}

ВАЖНО: Каждый инсайт должен ссылаться на КОНКРЕТНЫЙ пост/источник из данных выше.
НЕ выдумывай информацию, которой нет в данных.

Верни JSON:
{
  "key_insights": ["Инсайт со ссылкой на конкретный источник (Reddit: r/subreddit, HN, SO и т.д.)"],
  "sentiment_summary": "Настроение аудитории на основе реальных обсуждений",
  "content_gaps": ["Темы, которые НЕ покрыты в найденных обсуждениях"],
  "recommended_angles": ["Углы для продукта/контента на основе реальных данных"]
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
        max_tokens: 1200,
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
    const primaryQuery = contextualQueries[0];
    const secondaryQuery = contextualQueries[1] || primaryQuery;

    let totalSerpApiCalls = 0;

    // Fetch ALL sources in parallel — using shared data-fetchers
    const [
      redditResult1,
      redditResult2,
      hnResult,
      twitterResult,
      quoraResult,
      soResult,
      youtubeResult,
      trendsResult,
    ] = await Promise.all([
      fetchReddit(primaryQuery),
      fetchReddit(secondaryQuery),
      fetchHackerNews(primaryQuery),
      fetchTwitter(primaryQuery),
      fetchQuora(primaryQuery),
      fetchStackOverflow(primaryQuery),
      fetchYouTube(primaryQuery),
      fetchGoogleTrends(primaryQuery),
    ]);

    // Count SerpAPI calls
    totalSerpApiCalls += redditResult1.serpapi_calls_used;
    totalSerpApiCalls += redditResult2.serpapi_calls_used;
    totalSerpApiCalls += hnResult.serpapi_calls_used;
    totalSerpApiCalls += twitterResult.serpapi_calls_used;
    totalSerpApiCalls += quoraResult.serpapi_calls_used;
    totalSerpApiCalls += soResult.serpapi_calls_used;
    totalSerpApiCalls += youtubeResult.serpapi_calls_used;
    totalSerpApiCalls += trendsResult.serpapi_calls_used;

    // Combine Reddit results (deduplicate)
    const redditPostUrls = new Set<string>();
    const combinedRedditPosts: Array<{ title: string; subreddit: string; score: number; num_comments: number; url: string; created: string; selftext?: string }> = [];
    const communitiesSet = new Set<string>();
    let totalEngagement = 0;

    for (const result of [redditResult1, redditResult2]) {
      for (const post of result.data) {
        if (!redditPostUrls.has(post.url)) {
          redditPostUrls.add(post.url);
          combinedRedditPosts.push({
            title: post.title,
            subreddit: post.subreddit,
            score: post.score,
            num_comments: post.num_comments,
            url: post.url,
            created: post.date || new Date().toISOString(),
            selftext: post.snippet,
          });
          communitiesSet.add(post.subreddit);
          totalEngagement += post.score + post.num_comments * 2;
        }
      }
    }

    // Build sources object with all data
    const sources: CollectedSources = {
      reddit: {
        posts: combinedRedditPosts.slice(0, 15),
        communities: Array.from(communitiesSet).slice(0, 8),
        engagement: totalEngagement,
        error: redditResult1.error || undefined,
      },
      hacker_news: {
        posts: hnResult.data.map(p => ({
          title: p.title,
          url: p.url,
          points: p.points,
          snippet: p.snippet,
        })),
        error: hnResult.error || undefined,
      },
      twitter: {
        discussions: twitterResult.data.map(t => ({
          title: t.title,
          url: t.url,
          snippet: t.snippet,
        })),
        error: twitterResult.error || undefined,
      },
      quora: {
        questions: quoraResult.data.map(q => ({
          title: q.title,
          url: q.url,
          snippet: q.snippet,
        })),
        error: quoraResult.error || undefined,
      },
      stackoverflow: {
        questions: soResult.data.map(q => ({
          title: q.title,
          url: q.url,
          votes: q.votes,
          answers: q.answers,
          snippet: q.snippet,
        })),
        error: soResult.error || undefined,
      },
      youtube: {
        videos: youtubeResult.data.map(v => ({
          title: v.title,
          channel: v.channel,
          description: v.description,
          videoId: v.videoId,
          url: v.url,
          publishedAt: v.publishedAt,
          thumbnail: v.thumbnail,
        })),
        channels: [...new Set(youtubeResult.data.map(v => v.channel))].slice(0, 5),
        error: youtubeResult.error || undefined,
      },
      google_trends: {
        growth_rate: trendsResult.data ? trendsResult.data.growth_rate : 0,
        related_queries: trendsResult.data ? trendsResult.data.related_queries : [],
        interest_timeline: trendsResult.data ? trendsResult.data.interest_timeline : [],
        search_query: trendsResult.data ? trendsResult.data.search_query : primaryQuery,
        google_trends_url: trendsResult.data ? trendsResult.data.google_trends_url : undefined,
        fetched_at: trendsResult.data ? trendsResult.data.fetched_at : new Date().toISOString(),
        error: trendsResult.error || undefined,
      },
    };

    // Generate AI synthesis based on ALL real data
    const synthesis = await generateSourcesSynthesis(analysisContext, sources);

    // Data summary
    const dataSummary = {
      reddit_posts: combinedRedditPosts.length,
      hacker_news_posts: hnResult.data.length,
      twitter_discussions: twitterResult.data.length,
      quora_questions: quoraResult.data.length,
      stackoverflow_questions: soResult.data.length,
      youtube_videos: youtubeResult.data.length,
      google_trends_data: !!trendsResult.data,
      total_data_points: combinedRedditPosts.length + hnResult.data.length + twitterResult.data.length + quoraResult.data.length + soResult.data.length + youtubeResult.data.length,
    };

    return NextResponse.json({
      success: true,
      sources,
      synthesis,
      query: searchQuery,
      contextual_queries_used: contextualQueries,
      context_received: !!analysisContext.analysis,
      data_summary: dataSummary,
      serpapi_calls_used: totalSerpApiCalls,
      data_metadata: {
        sources: { data_type: 'real_data', note: 'Все данные из SerpAPI + YouTube API' },
        synthesis: { data_type: 'ai_synthesis', note: 'AI-анализ на основе реальных данных с обязательными ссылками' },
      },
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
