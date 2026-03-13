import ShowcaseClient from '@/components/showcase/ShowcaseClient';
import fs from 'fs';
import path from 'path';

export const metadata = {
  title: 'TrendHunter AI — Discover Profitable Niches',
  description: 'Browse 69+ trending niches across 9 categories. AI-powered market analysis with competition levels, entry costs, and growth metrics. Find your next SaaS idea.',
  keywords: 'trend analysis, niche research, SaaS ideas, market research, startup ideas, AI analysis',
};

export const revalidate = 300;

// Read trends directly from file to avoid self-fetch deadlock in dev mode
function loadTrendsFromFile(): { trends: unknown[]; lastUpdated: string | null } {
  try {
    const filePath = path.join(process.cwd(), 'data', 'trends.json');
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed.trends && Array.isArray(parsed.trends)) {
      return { trends: parsed.trends, lastUpdated: parsed.lastUpdated || null };
    }
  } catch {
    // File doesn't exist yet or is invalid
  }
  return { trends: [], lastUpdated: null };
}

export default async function Home() {
  const { trends: initialTrends, lastUpdated } = loadTrendsFromFile();

  return <ShowcaseClient initialTrends={initialTrends as never[]} lastUpdated={lastUpdated} />;
}
