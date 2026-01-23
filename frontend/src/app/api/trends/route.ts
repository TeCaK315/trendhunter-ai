import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export interface Trend {
  id: string;
  title: string;
  category: string;
  popularity_score: number;
  opportunity_score: number;
  pain_score: number;
  feasibility_score: number;
  profit_potential: number;
  growth_rate: number;
  why_trending: string;
  status: string;
  first_detected_at: string;
  source?: string;
}

interface TrendsData {
  trends: Trend[];
  lastUpdated: string | null;
}

const TRENDS_KEY = 'trendhunter:trends';

// Fallback in-memory storage for local development
let localTrendsStorage: TrendsData = {
  trends: [],
  lastUpdated: null,
};

// Check if Vercel KV is configured
const isKVConfigured = () => {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
};

// Get trends from storage (KV or local)
async function getTrendsData(): Promise<TrendsData> {
  if (isKVConfigured()) {
    try {
      const data = await kv.get<TrendsData>(TRENDS_KEY);
      return data || { trends: [], lastUpdated: null };
    } catch (error) {
      console.error('KV read error:', error);
      return { trends: [], lastUpdated: null };
    }
  }
  return localTrendsStorage;
}

// Save trends to storage (KV or local)
async function saveTrendsData(data: TrendsData): Promise<void> {
  if (isKVConfigured()) {
    try {
      await kv.set(TRENDS_KEY, data);
    } catch (error) {
      console.error('KV write error:', error);
    }
  } else {
    localTrendsStorage = data;
  }
}

// Normalize title for comparison
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Check if two trends are duplicates
function isDuplicate(newTrend: Trend, existingTrend: Trend): boolean {
  const newTitle = normalizeTitle(newTrend.title);
  const existingTitle = normalizeTitle(existingTrend.title);

  if (newTitle === existingTitle) return true;

  if (newTitle.includes(existingTitle) || existingTitle.includes(newTitle)) {
    const shorter = newTitle.length < existingTitle.length ? newTitle : existingTitle;
    const longer = newTitle.length < existingTitle.length ? existingTitle : newTitle;
    if (shorter.length / longer.length > 0.7) return true;
  }

  return false;
}

// Normalize category
function normalizeCategory(category: string): string {
  if (!category) return 'Technology';

  const validCategories = [
    'AI & ML', 'SaaS', 'FinTech', 'EdTech', 'HealthTech',
    'E-commerce', 'Technology', 'Business', 'Healthcare',
    'Finance', 'Education', 'Mobile Apps'
  ];

  const parts = category.split(/[|,]/);

  for (const part of parts) {
    const trimmed = part.trim();
    const match = validCategories.find(vc =>
      vc.toLowerCase() === trimmed.toLowerCase() ||
      trimmed.toLowerCase().includes(vc.toLowerCase()) ||
      vc.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (match) return match;
  }

  const categoryMap: Record<string, string> = {
    'ai': 'AI & ML',
    'ml': 'AI & ML',
    'artificial intelligence': 'AI & ML',
    'machine learning': 'AI & ML',
    'saas': 'SaaS',
    'software': 'SaaS',
    'fintech': 'FinTech',
    'finance': 'FinTech',
    'financial': 'FinTech',
    'edtech': 'EdTech',
    'education': 'EdTech',
    'learning': 'EdTech',
    'healthtech': 'HealthTech',
    'health': 'HealthTech',
    'healthcare': 'HealthTech',
    'medical': 'HealthTech',
    'wellness': 'HealthTech',
    'ecommerce': 'E-commerce',
    'e-commerce': 'E-commerce',
    'commerce': 'E-commerce',
    'retail': 'E-commerce',
    'mobile': 'Mobile Apps',
    'app': 'Mobile Apps',
    'business': 'Business',
    'enterprise': 'Business',
    'tech': 'Technology',
    'technology': 'Technology',
  };

  const lowerCategory = category.toLowerCase();
  for (const [key, value] of Object.entries(categoryMap)) {
    if (lowerCategory.includes(key)) {
      return value;
    }
  }

  return 'Technology';
}

// GET - Read trends
export async function GET() {
  try {
    const data = await getTrendsData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error reading trends:', error);
    return NextResponse.json({ trends: [], lastUpdated: null });
  }
}

// POST - Save new trends (merges with existing, no duplicates)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const newTrends: Trend[] = Array.isArray(body) ? body : [body];

    const existingData = await getTrendsData();

    const trendsWithIds = newTrends.map((trend, index) => ({
      ...trend,
      id: trend.id || `trend-${Date.now()}-${index}`,
      category: normalizeCategory(trend.category),
    }));

    const uniqueNewTrends = trendsWithIds.filter(newTrend => {
      const isDup = existingData.trends.some(existing => isDuplicate(newTrend, existing));
      if (isDup) {
        console.log(`Skipping duplicate: "${newTrend.title}"`);
      }
      return !isDup;
    });

    const mergedTrends = [...existingData.trends, ...uniqueNewTrends];

    mergedTrends.sort((a, b) => {
      return new Date(b.first_detected_at).getTime() - new Date(a.first_detected_at).getTime();
    });

    const updatedData: TrendsData = {
      trends: mergedTrends,
      lastUpdated: new Date().toISOString(),
    };

    await saveTrendsData(updatedData);

    return NextResponse.json({
      success: true,
      count: uniqueNewTrends.length,
      total: mergedTrends.length,
      duplicatesSkipped: trendsWithIds.length - uniqueNewTrends.length,
      storage: isKVConfigured() ? 'vercel-kv' : 'in-memory',
      message: `Added ${uniqueNewTrends.length} new trends. Total: ${mergedTrends.length}`
    });
  } catch (error) {
    console.error('Error saving trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save trends' },
      { status: 500 }
    );
  }
}

// DELETE - Remove trends
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trendId = searchParams.get('id');
    const clearAll = searchParams.get('clear') === 'true';

    if (clearAll) {
      await saveTrendsData({
        trends: [],
        lastUpdated: new Date().toISOString(),
      });
      return NextResponse.json({ success: true, message: 'All trends cleared' });
    }

    if (!trendId) {
      return NextResponse.json(
        { success: false, error: 'Trend ID is required' },
        { status: 400 }
      );
    }

    const existingData = await getTrendsData();
    const filteredTrends = existingData.trends.filter(t => t.id !== trendId);

    if (filteredTrends.length === existingData.trends.length) {
      return NextResponse.json(
        { success: false, error: 'Trend not found' },
        { status: 404 }
      );
    }

    await saveTrendsData({
      trends: filteredTrends,
      lastUpdated: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: `Trend ${trendId} deleted`,
      remaining: filteredTrends.length
    });
  } catch (error) {
    console.error('Error deleting trend:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete trend' },
      { status: 500 }
    );
  }
}
