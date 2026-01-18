import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'trends.json');

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

// Normalize title for comparison (lowercase, trim, remove extra spaces)
function normalizeTitle(title: string): string {
  return title.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Check if two trends are duplicates
function isDuplicate(newTrend: Trend, existingTrend: Trend): boolean {
  const newTitle = normalizeTitle(newTrend.title);
  const existingTitle = normalizeTitle(existingTrend.title);

  // Exact match
  if (newTitle === existingTitle) return true;

  // One contains the other (for similar titles like "AI Automation" and "AI Automation Tools")
  if (newTitle.includes(existingTitle) || existingTitle.includes(newTitle)) {
    // Only if similarity is high enough (at least 70% of characters match)
    const shorter = newTitle.length < existingTitle.length ? newTitle : existingTitle;
    const longer = newTitle.length < existingTitle.length ? existingTitle : newTitle;
    if (shorter.length / longer.length > 0.7) return true;
  }

  return false;
}

// GET - Read trends from JSON
export async function GET() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const trendsData: TrendsData = JSON.parse(data);
    return NextResponse.json(trendsData);
  } catch (error) {
    console.error('Error reading trends:', error);
    return NextResponse.json({ trends: [], lastUpdated: null });
  }
}

// POST - Save new trends from n8n (merges with existing, no duplicates)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Handle both single trend and array of trends
    const newTrends: Trend[] = Array.isArray(body) ? body : [body];

    // Read existing data
    let existingData: TrendsData = { trends: [], lastUpdated: null };
    try {
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      existingData = JSON.parse(data);
    } catch {
      // File doesn't exist or is empty, use default
    }

    // Add IDs if missing
    const trendsWithIds = newTrends.map((trend, index) => ({
      ...trend,
      id: trend.id || `trend-${Date.now()}-${index}`,
      // Normalize category - take only first category if multiple are provided
      category: normalizeCategory(trend.category),
    }));

    // Filter out duplicates - keep existing trends, only add truly new ones
    const uniqueNewTrends = trendsWithIds.filter(newTrend => {
      const isDup = existingData.trends.some(existing => isDuplicate(newTrend, existing));
      if (isDup) {
        console.log(`Skipping duplicate: "${newTrend.title}"`);
      }
      return !isDup;
    });

    // Merge: existing trends + new unique trends
    const mergedTrends = [...existingData.trends, ...uniqueNewTrends];

    // Sort by first_detected_at (newest first)
    mergedTrends.sort((a, b) => {
      return new Date(b.first_detected_at).getTime() - new Date(a.first_detected_at).getTime();
    });

    const updatedData: TrendsData = {
      trends: mergedTrends,
      lastUpdated: new Date().toISOString(),
    };

    // Write back to file
    await fs.writeFile(DATA_FILE, JSON.stringify(updatedData, null, 2));

    return NextResponse.json({
      success: true,
      count: uniqueNewTrends.length,
      total: mergedTrends.length,
      duplicatesSkipped: trendsWithIds.length - uniqueNewTrends.length,
      message: `Added ${uniqueNewTrends.length} new trends (${trendsWithIds.length - uniqueNewTrends.length} duplicates skipped). Total: ${mergedTrends.length}`
    });
  } catch (error) {
    console.error('Error saving trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save trends' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific trend or clear all
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const trendId = searchParams.get('id');
    const clearAll = searchParams.get('clear') === 'true';

    if (clearAll) {
      // Clear all trends
      const updatedData: TrendsData = {
        trends: [],
        lastUpdated: new Date().toISOString(),
      };
      await fs.writeFile(DATA_FILE, JSON.stringify(updatedData, null, 2));
      return NextResponse.json({ success: true, message: 'All trends cleared' });
    }

    if (!trendId) {
      return NextResponse.json(
        { success: false, error: 'Trend ID is required' },
        { status: 400 }
      );
    }

    // Read existing data
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    const existingData: TrendsData = JSON.parse(data);

    // Filter out the trend to delete
    const filteredTrends = existingData.trends.filter(t => t.id !== trendId);

    if (filteredTrends.length === existingData.trends.length) {
      return NextResponse.json(
        { success: false, error: 'Trend not found' },
        { status: 404 }
      );
    }

    const updatedData: TrendsData = {
      trends: filteredTrends,
      lastUpdated: new Date().toISOString(),
    };

    await fs.writeFile(DATA_FILE, JSON.stringify(updatedData, null, 2));

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

// Normalize category - extract single valid category
function normalizeCategory(category: string): string {
  if (!category) return 'Technology';

  // Valid categories
  const validCategories = [
    'AI & ML', 'SaaS', 'FinTech', 'EdTech', 'HealthTech',
    'E-commerce', 'Technology', 'Business', 'Healthcare',
    'Finance', 'Education', 'Mobile Apps'
  ];

  // If category contains multiple values separated by | or ,
  const parts = category.split(/[|,]/);

  for (const part of parts) {
    const trimmed = part.trim();
    // Find matching valid category
    const match = validCategories.find(vc =>
      vc.toLowerCase() === trimmed.toLowerCase() ||
      trimmed.toLowerCase().includes(vc.toLowerCase()) ||
      vc.toLowerCase().includes(trimmed.toLowerCase())
    );
    if (match) return match;
  }

  // Default mapping for common variations
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
