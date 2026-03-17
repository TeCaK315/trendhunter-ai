import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import fs from 'fs';
import path from 'path';
import type { Trend } from '@/types/trend';

export type { Trend };

interface TrendsData {
  trends: Trend[];
  lastUpdated: string | null;
}

const TRENDS_KEY = 'trendhunter:trends';

// Load seed data from file for local development
function loadSeedData(): TrendsData {
  try {
    const filePath = path.join(process.cwd(), 'data', 'trends.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.trends && Array.isArray(parsed.trends)) {
      return { trends: parsed.trends, lastUpdated: parsed.lastUpdated || new Date().toISOString() };
    }
  } catch (e) {
    console.warn('Could not load seed trends from data/trends.json:', e);
  }
  return { trends: [], lastUpdated: null };
}

// Fallback in-memory storage for local development (seeded from file)
let localTrendsStorage: TrendsData = loadSeedData();

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
    // Also persist to file for SSR access
    try {
      const filePath = path.join(process.cwd(), 'data', 'trends.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch { /* ignore write errors */ }
  }
}

// Normalize title for comparison - extract core concept
function normalizeTitle(title: string): string {
  // Generic suffixes to remove
  const genericSuffixes = [
    'tool', 'tools', 'software', 'platform', 'platforms', 'app', 'application',
    'solution', 'solutions', 'system', 'systems', 'service', 'services',
    'insights', 'analysis', 'analytics', 'management', 'manager',
    'assistant', 'suite', 'dashboard', 'portal', 'kit', 'engine'
  ];

  // Common modifiers to remove (prefixes/adjectives)
  const genericModifiers = [
    'ai-powered', 'ai', 'smart', 'intelligent', 'automated', 'automatic',
    'cloud-based', 'cloud', 'web-based', 'mobile', 'online', 'digital',
    'advanced', 'modern', 'next-gen', 'innovative', 'revolutionary',
    'integrated', 'comprehensive', 'complete', 'all-in-one', 'unified',
    'real-time', 'realtime', 'instant', 'live',
    'professional', 'enterprise', 'business', 'corporate',
    'custom', 'personalized', 'adaptive', 'dynamic',
    'secure', 'compliant', 'dea-compliant', 'hipaa-compliant',
    'virtual', 'remote', 'distributed',
    'consultation', 'monitoring', 'tracking', 'scheduling'
  ];

  let normalized = title.toLowerCase().trim().replace(/\s+/g, ' ');

  // Remove generic suffixes from the end (iterative)
  let changed = true;
  while (changed) {
    changed = false;
    for (const word of genericSuffixes) {
      const pattern = new RegExp(`\\s+${word}$`, 'i');
      if (pattern.test(normalized)) {
        normalized = normalized.replace(pattern, '');
        changed = true;
      }
    }
  }

  // Remove generic modifiers from anywhere in the title
  for (const modifier of genericModifiers) {
    // Remove as standalone word
    const pattern = new RegExp(`\\b${modifier}\\b\\s*`, 'gi');
    normalized = normalized.replace(pattern, ' ');
  }

  // Clean up multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim();

  return normalized;
}

// Extract significant words from a string (works for both English and Russian)
function getSignificantWords(text: string): Set<string> {
  const stopWords = new Set([
    // English
    'the', 'a', 'an', 'is', 'are', 'for', 'of', 'in', 'on', 'to', 'and', 'or', 'with',
    'tool', 'tools', 'software', 'platform', 'app', 'service', 'ai', 'ml', 'saas',
    'best', 'top', 'new', 'free', 'vs', 'comparison', 'compare', 'review',
    // Russian — common function words
    'для', 'на', 'по', 'из', 'от', 'до', 'при', 'без', 'над', 'под', 'через',
    'это', 'как', 'что', 'где', 'когда', 'так', 'все', 'уже', 'ещё', 'еще',
    // Russian — generic product nouns (should be stripped to find core domain)
    'инструмент', 'инструменты', 'платформа', 'сервис', 'система', 'приложение',
    'программное', 'обеспечение', 'список', 'решение', 'решения',
    'основе', 'помощью', 'помощи', 'управление', 'управления',
    'автоматизация', 'автоматизации', 'оптимизация', 'мониторинг',
  ]);

  return new Set(
    text.toLowerCase()
      .replace(/[^a-zа-яёА-ЯЁ0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w))
  );
}

function wordSetSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const w of a) { if (b.has(w)) intersection++; }
  return intersection / (a.size + b.size - intersection);
}

// Check if two trends are duplicates
function isDuplicate(newTrend: Trend, existingTrend: Trend): boolean {
  const newTitle = normalizeTitle(newTrend.title);
  const existingTitle = normalizeTitle(existingTrend.title);

  // 1. Exact normalized title match
  if (newTitle === existingTitle) return true;

  // 2. Substring match with 70%+ length ratio
  if (newTitle.includes(existingTitle) || existingTitle.includes(newTitle)) {
    const shorter = newTitle.length < existingTitle.length ? newTitle : existingTitle;
    const longer = newTitle.length < existingTitle.length ? existingTitle : newTitle;
    if (shorter.length / longer.length > 0.7) return true;
  }

  // 3. source_query word-set comparison (English keywords)
  if (newTrend.source_query && existingTrend.source_query) {
    const newQueryWords = getSignificantWords(newTrend.source_query);
    const existingQueryWords = getSignificantWords(existingTrend.source_query);
    if (newQueryWords.size >= 2 && existingQueryWords.size >= 2) {
      if (wordSetSimilarity(newQueryWords, existingQueryWords) >= 0.7) return true;
    }
  }

  // 4. Title word-set comparison (Russian/English words) — lower threshold to catch near-duplicates
  const newTitleWords = getSignificantWords(newTrend.title);
  const existingTitleWords = getSignificantWords(existingTrend.title);
  if (newTitleWords.size >= 2 && existingTitleWords.size >= 2) {
    if (wordSetSimilarity(newTitleWords, existingTitleWords) >= 0.5) return true;
  }

  // 5. Same category + shared core domain word (catches "HR льготы" vs "HR зарплаты")
  if (newTrend.category === existingTrend.category && newTitleWords.size >= 1 && existingTitleWords.size >= 1) {
    // If one set is a subset of the other (all significant words match)
    const smaller = newTitleWords.size <= existingTitleWords.size ? newTitleWords : existingTitleWords;
    const larger = newTitleWords.size <= existingTitleWords.size ? existingTitleWords : newTitleWords;
    let allMatch = true;
    for (const w of smaller) { if (!larger.has(w)) { allMatch = false; break; } }
    if (allMatch) return true;
  }

  return false;
}

// Normalize category
function normalizeCategory(category: string): string {
  if (!category) return 'Technology';

  const validCategories = [
    'AI & ML', 'SaaS', 'FinTech', 'EdTech', 'HealthTech',
    'E-commerce', 'Technology', 'Business', 'Mobile Apps'
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
    'ai/ml': 'AI & ML',
    'ai & ml': 'AI & ML',
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
    'mobile apps': 'Mobile Apps',
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

    // Deduplicate against existing trends AND within the new batch itself
    const uniqueNewTrends: typeof trendsWithIds = [];
    for (const newTrend of trendsWithIds) {
      const dupWithExisting = existingData.trends.some(existing => isDuplicate(newTrend, existing));
      const dupWithinBatch = uniqueNewTrends.some(accepted => isDuplicate(newTrend, accepted));
      if (dupWithExisting || dupWithinBatch) {
        console.log(`Skipping duplicate: "${newTrend.title}"`);
      } else {
        uniqueNewTrends.push(newTrend);
      }
    }

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

// PUT - Replace all trends (used by enrichment pipeline)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { trends, lastUpdated } = body;

    if (!Array.isArray(trends)) {
      return NextResponse.json(
        { success: false, error: 'trends array is required' },
        { status: 400 }
      );
    }

    await saveTrendsData({
      trends,
      lastUpdated: lastUpdated || new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      total: trends.length,
    });
  } catch (error) {
    console.error('Error updating trends:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update trends' },
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
