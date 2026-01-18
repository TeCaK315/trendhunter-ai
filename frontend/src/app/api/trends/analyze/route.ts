import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'trends.json');
const ANALYSIS_FILE = path.join(process.cwd(), 'data', 'analysis.json');

// Deep Analysis types (from multi-agent system)
interface DeepAnalysisPainPoint {
  pain: string;
  confidence: number;
  arguments_for: string[];
  arguments_against: string[];
  verdict: string;
}

interface DeepAnalysisSegment {
  name: string;
  size: string;
  willingness_to_pay: string;
  where_to_find: string;
  confidence: number;
}

interface DeepAnalysisMetadata {
  optimist_summary: string;
  skeptic_summary: string;
  consensus_reached: boolean;
  analysis_depth: 'deep';
}

interface DeepAnalysisResult {
  main_pain: string;
  confidence: number;
  key_pain_points: DeepAnalysisPainPoint[];
  target_audience: {
    segments: DeepAnalysisSegment[];
  };
  risks: string[];
  opportunities: string[];
  final_recommendation: string;
  analysis_metadata: DeepAnalysisMetadata;
}

interface TrendAnalysis {
  trend_id: string;
  trend_title: string;
  main_pain: string;
  key_pain_points: string[];
  target_audience: {
    segments: Array<{
      name: string;
      size: string;
      willingness_to_pay: string;
      where_to_find?: string;
      confidence?: number;
    }>;
  };
  sources_analysis?: {
    reddit?: { sentiment: string; key_discussions: string[]; top_subreddits: string[] };
    youtube?: { content_type: string; top_channels: string[] };
    google_trends?: { trend_direction: string; related_topics: string[] };
    facebook?: { community_size: string; engagement: string };
  };
  real_sources?: {
    reddit?: {
      posts: Array<{
        title: string;
        subreddit: string;
        score: number;
        num_comments: number;
        url: string;
        created: string;
        selftext?: string;
      }>;
      communities: string[];
      engagement: number;
    };
    youtube?: {
      videos: Array<{
        title: string;
        channel: string;
        description: string;
        videoId: string;
        url: string;
        publishedAt: string;
        thumbnail: string;
      }>;
      channels: string[];
    };
    google_trends?: {
      growth_rate: number;
      related_queries: Array<{ query: string; growth: string }>;
      interest_timeline?: Array<{ date: string; value: number }>;
    };
    facebook?: {
      pages: Array<{
        name: string;
        category: string;
        fan_count: number;
        about: string;
        url: string;
      }>;
      reach: number;
    };
  };
  sentiment_score?: number;
  market_signals?: string[];
  status: string;
  analyzed_at: string;
  // Deep analysis fields
  analysis_type?: 'basic' | 'deep';
  deep_analysis?: DeepAnalysisResult;
}

interface AnalysisData {
  analyses: Record<string, TrendAnalysis>;
  lastUpdated: string | null;
}

// POST - Save analysis results from n8n Pain Point Detector
export async function POST(request: NextRequest) {
  try {
    const analysis: TrendAnalysis = await request.json();

    if (!analysis.trend_id) {
      return NextResponse.json(
        { success: false, error: 'trend_id is required' },
        { status: 400 }
      );
    }

    // Read existing analysis data
    let existingData: AnalysisData = { analyses: {}, lastUpdated: null };
    try {
      const data = await fs.readFile(ANALYSIS_FILE, 'utf-8');
      existingData = JSON.parse(data);
    } catch {
      // File doesn't exist, use default
    }

    // Save analysis indexed by trend_id
    existingData.analyses[analysis.trend_id] = {
      ...analysis,
      analyzed_at: analysis.analyzed_at || new Date().toISOString(),
    };
    existingData.lastUpdated = new Date().toISOString();

    // Ensure data directory exists
    const dataDir = path.dirname(ANALYSIS_FILE);
    await fs.mkdir(dataDir, { recursive: true });

    // Write analysis data
    await fs.writeFile(ANALYSIS_FILE, JSON.stringify(existingData, null, 2));

    // Also update the trend status in trends.json
    try {
      const trendsData = await fs.readFile(DATA_FILE, 'utf-8');
      const trends = JSON.parse(trendsData);

      const trendIndex = trends.trends.findIndex((t: { id: string }) => t.id === analysis.trend_id);
      if (trendIndex !== -1) {
        trends.trends[trendIndex].status = 'analyzed';
        trends.trends[trendIndex].analysis_available = true;
        await fs.writeFile(DATA_FILE, JSON.stringify(trends, null, 2));
      }
    } catch (e) {
      console.log('Could not update trend status:', e);
    }

    return NextResponse.json({
      success: true,
      trend_id: analysis.trend_id,
      message: `Analysis saved for trend: ${analysis.trend_title}`,
    });
  } catch (error) {
    console.error('Error saving analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save analysis' },
      { status: 500 }
    );
  }
}

// GET - Retrieve analysis for a specific trend or all analyses
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trendId = searchParams.get('trend_id');

    let existingData: AnalysisData = { analyses: {}, lastUpdated: null };
    try {
      const data = await fs.readFile(ANALYSIS_FILE, 'utf-8');
      existingData = JSON.parse(data);
    } catch {
      // File doesn't exist
      return NextResponse.json({ analyses: {}, lastUpdated: null });
    }

    if (trendId) {
      const analysis = existingData.analyses[trendId];
      if (analysis) {
        return NextResponse.json({ analysis, found: true });
      }
      return NextResponse.json({ analysis: null, found: false });
    }

    return NextResponse.json(existingData);
  } catch (error) {
    console.error('Error reading analysis:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to read analysis' },
      { status: 500 }
    );
  }
}
