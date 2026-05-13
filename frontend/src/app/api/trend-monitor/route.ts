import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { callAgent } from '@/lib/openai';
import { fetchCompetitorPricing } from '@/lib/data-fetchers';
import { getAuthUser } from '@/lib/auth-helpers'

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const MONITOR_FILE = path.join(process.cwd(), 'data', 'trend-monitors.json');

interface TrendSnapshot {
  date: string;
  google_trends_value: number;
  reddit_mentions: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  new_competitors_found: number;
  new_launches: number;
  competitor_price_changes: Array<{ name: string; old: string; new: string }>;
}

interface CompetitorPriceRecord {
  competitor: string;
  prices: Array<{ amount: string; plan: string; period: string }>;
  pricing_url: string;
  fetched_at: string;
}

interface TrendMonitor {
  trend_id: string;
  trend_title: string;
  created_at: string;
  last_checked: string;
  check_interval_days: number;
  status: 'active' | 'paused' | 'alert';
  alert_threshold: number;
  snapshots: TrendSnapshot[];
  current_trend: 'rising' | 'stable' | 'declining';
  change_percent: number;
  alert_message?: string;
  sources: {
    google_trends_url: string;
    reddit_search_url: string;
  };
  // Price tracking
  tracked_competitors: string[];
  price_history: CompetitorPriceRecord[][];  // Array of snapshots, each snapshot = array of records
}

interface DigestItem {
  type: 'trend_change' | 'new_competitor' | 'price_change' | 'new_complaints' | 'new_launch' | 'alert';
  severity: 'info' | 'warning' | 'opportunity';
  title: string;
  detail: string;
  evidence: string;
  delta?: string;
}

interface MonitorData {
  monitors: Record<string, TrendMonitor>;
  lastUpdated: string | null;
}

async function readMonitorData(): Promise<MonitorData> {
  try {
    const data = await fs.readFile(MONITOR_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { monitors: {}, lastUpdated: null };
  }
}

async function writeMonitorData(data: MonitorData): Promise<void> {
  await fs.writeFile(MONITOR_FILE, JSON.stringify(data, null, 2));
}

// Fetch current Google Trends value
async function fetchGoogleTrendsValue(query: string): Promise<{ value: number; url: string }> {
  if (!SERPAPI_KEY) {
    return { value: 50 + Math.random() * 30, url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}` };
  }

  try {
    const trendsUrl = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(query)}&date=now%207-d&api_key=${SERPAPI_KEY}`;
    const response = await fetch(trendsUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return { value: 50, url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}` };
    }

    const data = await response.json();
    const timelineData = data.interest_over_time?.timeline_data || [];
    const latestPoint = timelineData[timelineData.length - 1];
    const value = latestPoint?.values?.[0]?.extracted_value || 50;
    const googleTrendsUrl = data.search_metadata?.google_trends_url ||
      `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}&date=now%207-d`;

    return { value, url: googleTrendsUrl };
  } catch (error) {
    console.error('Error fetching Google Trends:', error);
    return { value: 50, url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}` };
  }
}

// Count Reddit mentions in last 7 days
async function countRedditMentions(query: string): Promise<{ count: number; url: string }> {
  if (!SERPAPI_KEY) {
    return { count: Math.floor(Math.random() * 50) + 10, url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&t=week` };
  }

  try {
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=site:reddit.com ${encodeURIComponent(query)}&tbs=qdr:w&api_key=${SERPAPI_KEY}`;
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) {
      return { count: 0, url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&t=week` };
    }

    const data = await response.json();
    const resultCount = data.search_information?.total_results || 0;

    return {
      count: Math.min(resultCount, 1000),
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&t=week`
    };
  } catch (error) {
    console.error('Error counting Reddit mentions:', error);
    return { count: 0, url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&t=week` };
  }
}

// Search for new competitors in last 7 days
async function searchNewCompetitors(query: string): Promise<{ count: number; names: string[] }> {
  if (!SERPAPI_KEY) return { count: 0, names: [] };

  try {
    const searchUrl = `https://serpapi.com/search.json?engine=google&q="${encodeURIComponent(query)}"+alternative+OR+competitor&tbs=qdr:w&num=5&api_key=${SERPAPI_KEY}`;
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) return { count: 0, names: [] };

    const data = await response.json();
    const results = data.organic_results || [];
    const names: string[] = [];

    for (const r of results.slice(0, 5)) {
      const title = r.title || '';
      // Extract potential competitor names from titles like "X vs Y" or "Best X alternatives"
      const vsMatch = title.match(/(\w[\w\s]*?)\s+vs\s+/i);
      if (vsMatch) names.push(vsMatch[1].trim());
    }

    return { count: results.length, names: [...new Set(names)].slice(0, 3) };
  } catch {
    return { count: 0, names: [] };
  }
}

// Search Product Hunt + Show HN launches in last 7 days
async function searchNewLaunches(query: string): Promise<{ count: number; launches: string[] }> {
  if (!SERPAPI_KEY) return { count: 0, launches: [] };

  try {
    const searchUrl = `https://serpapi.com/search.json?engine=google&q=(site:producthunt.com OR site:news.ycombinator.com "Show HN") ${encodeURIComponent(query)}&tbs=qdr:w&num=5&api_key=${SERPAPI_KEY}`;
    const response = await fetch(searchUrl, { signal: AbortSignal.timeout(10000) });

    if (!response.ok) return { count: 0, launches: [] };

    const data = await response.json();
    const results = data.organic_results || [];
    const launches = results.slice(0, 3).map((r: any) => r.title?.substring(0, 80) || '');

    return { count: results.length, launches };
  } catch {
    return { count: 0, launches: [] };
  }
}

// Fetch current prices for tracked competitors
async function fetchTrackedPrices(competitorNames: string[]): Promise<CompetitorPriceRecord[]> {
  if (competitorNames.length === 0) return [];

  const results = await Promise.all(
    competitorNames.slice(0, 3).map(async (name) => {
      try {
        const result = await fetchCompetitorPricing(name);
        return {
          competitor: name,
          prices: result.prices_found,
          pricing_url: result.pricing_url,
          fetched_at: new Date().toISOString(),
        };
      } catch {
        return {
          competitor: name,
          prices: [],
          pricing_url: '',
          fetched_at: new Date().toISOString(),
        };
      }
    })
  );

  return results;
}

// Detect price changes between two snapshots
function detectPriceChanges(
  previous: CompetitorPriceRecord[],
  current: CompetitorPriceRecord[]
): Array<{ name: string; old: string; new: string }> {
  const changes: Array<{ name: string; old: string; new: string }> = [];

  for (const curr of current) {
    const prev = previous.find(p => p.competitor === curr.competitor);
    if (!prev || prev.prices.length === 0 || curr.prices.length === 0) continue;

    // Compare primary (first) price
    const prevPrice = parseFloat(prev.prices[0].amount.replace(/[^0-9.]/g, ''));
    const currPrice = parseFloat(curr.prices[0].amount.replace(/[^0-9.]/g, ''));

    if (isNaN(prevPrice) || isNaN(currPrice) || prevPrice === 0) continue;

    const changePct = Math.abs((currPrice - prevPrice) / prevPrice) * 100;
    if (changePct >= 10) {
      changes.push({
        name: curr.competitor,
        old: `$${prevPrice}/мес`,
        new: `$${currPrice}/мес`,
      });
    }
  }

  return changes;
}

function determineSentiment(currentValue: number, previousValue: number): 'positive' | 'neutral' | 'negative' {
  const change = ((currentValue - previousValue) / previousValue) * 100;
  if (change > 10) return 'positive';
  if (change < -10) return 'negative';
  return 'neutral';
}

function determineTrend(snapshots: TrendSnapshot[]): { trend: 'rising' | 'stable' | 'declining'; changePercent: number } {
  if (snapshots.length < 2) {
    return { trend: 'stable', changePercent: 0 };
  }

  const latest = snapshots[snapshots.length - 1];
  const oldest = snapshots[0];
  const changePercent = ((latest.google_trends_value - oldest.google_trends_value) / oldest.google_trends_value) * 100;

  if (changePercent > 15) return { trend: 'rising', changePercent };
  if (changePercent < -15) return { trend: 'declining', changePercent };
  return { trend: 'stable', changePercent };
}

// Build digest from snapshots
function buildDigest(monitor: TrendMonitor): DigestItem[] {
  const items: DigestItem[] = [];
  const snaps = monitor.snapshots;
  if (snaps.length < 2) return items;

  const latest = snaps[snaps.length - 1];
  const previous = snaps[snaps.length - 2];

  // Google Trends change
  const gtChange = previous.google_trends_value > 0
    ? ((latest.google_trends_value - previous.google_trends_value) / previous.google_trends_value) * 100
    : 0;
  if (Math.abs(gtChange) >= 3) {
    items.push({
      type: 'trend_change',
      severity: gtChange > 10 ? 'opportunity' : gtChange < -10 ? 'warning' : 'info',
      title: `Google Trends: ${gtChange > 0 ? '+' : ''}${Math.round(gtChange)}%`,
      detail: `${previous.google_trends_value} → ${latest.google_trends_value}`,
      evidence: 'Google Trends 7-day data',
      delta: `${gtChange > 0 ? '+' : ''}${Math.round(gtChange)}%`,
    });
  }

  // Reddit mentions change
  const redditDelta = latest.reddit_mentions - previous.reddit_mentions;
  if (Math.abs(redditDelta) >= 3) {
    items.push({
      type: 'new_complaints',
      severity: redditDelta > 10 ? 'opportunity' : redditDelta < -5 ? 'warning' : 'info',
      title: `Reddit: ${redditDelta > 0 ? '+' : ''}${redditDelta} упоминаний`,
      detail: `${previous.reddit_mentions} → ${latest.reddit_mentions} за неделю`,
      evidence: 'Reddit search (site:reddit.com)',
      delta: `${redditDelta > 0 ? '+' : ''}${redditDelta}`,
    });
  }

  // New competitors
  if (latest.new_competitors_found > 0) {
    items.push({
      type: 'new_competitor',
      severity: 'warning',
      title: `${latest.new_competitors_found} новых результатов по конкурентам`,
      detail: 'Найдены новые упоминания альтернатив/конкурентов за неделю',
      evidence: 'SerpAPI: alternatives search (7 days)',
      delta: `+${latest.new_competitors_found}`,
    });
  }

  // New launches
  if (latest.new_launches > 0) {
    items.push({
      type: 'new_launch',
      severity: 'warning',
      title: `${latest.new_launches} новых запусков`,
      detail: 'Product Hunt / Show HN за последнюю неделю',
      evidence: 'SerpAPI: PH + HN search (7 days)',
      delta: `+${latest.new_launches}`,
    });
  }

  // Competitor price changes
  if (latest.competitor_price_changes?.length > 0) {
    for (const pc of latest.competitor_price_changes) {
      items.push({
        type: 'price_change',
        severity: 'opportunity',
        title: `${pc.name}: цена изменилась`,
        detail: `${pc.old} → ${pc.new}`,
        evidence: 'Competitor pricing data',
        delta: `${pc.old} → ${pc.new}`,
      });
    }
  }

  // Overall alert
  if (monitor.status === 'alert' && monitor.alert_message) {
    items.push({
      type: 'alert',
      severity: monitor.change_percent > 0 ? 'opportunity' : 'warning',
      title: 'Порог алерта превышен',
      detail: monitor.alert_message,
      evidence: `Изменение ${monitor.change_percent}% за период мониторинга`,
      delta: `${monitor.change_percent > 0 ? '+' : ''}${monitor.change_percent}%`,
    });
  }

  return items;
}

// Generate AI recommendation from digest items
async function generateRecommendation(trendTitle: string, items: DigestItem[]): Promise<string> {
  // Don't call AI if there are fewer than 2 significant items
  const significantItems = items.filter(i => i.severity !== 'info');
  if (significantItems.length < 2) {
    if (items.length === 0) return 'Значимых изменений не обнаружено за этот период.';
    return items.map(i => i.title).join('. ') + '.';
  }

  const itemsSummary = items.map(i => `- [${i.severity}] ${i.title}: ${i.detail}`).join('\n');

  const result = await callAgent(
    'Ты — аналитик рынка. Дай краткую рекомендацию (1-2 предложения) на основе ТОЛЬКО предоставленных дельт. Не выдумывай факты. Отвечай на русском.',
    `Тренд: "${trendTitle}"\n\nИзменения за неделю:\n${itemsSummary}\n\nДай конкретную рекомендацию действий.`,
    { maxTokens: 200, temperature: 0.3 }
  );

  if (result.success) {
    return result.content.trim();
  }
  return items.map(i => i.title).join('. ') + '.';
}

// POST - Create or update a trend monitor
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { action, trend_id, trend_title, check_interval_days = 7, alert_threshold = 20, competitor_names = [] } = body;

    const monitorData = await readMonitorData();

    if (action === 'create') {
      if (!trend_id || !trend_title) {
        return NextResponse.json(
          { success: false, error: 'trend_id and trend_title are required' },
          { status: 400 }
        );
      }

      // Fetch initial data in parallel
      const trackedCompetitors: string[] = (competitor_names as string[]).slice(0, 5);
      const fetchPromises: [Promise<{ value: number; url: string }>, Promise<{ count: number; url: string }>, Promise<CompetitorPriceRecord[]>] = [
        fetchGoogleTrendsValue(trend_title),
        countRedditMentions(trend_title),
        trackedCompetitors.length > 0 ? fetchTrackedPrices(trackedCompetitors) : Promise.resolve([]),
      ];
      const [googleTrends, redditMentions, initialPrices] = await Promise.all(fetchPromises);

      const initialSnapshot: TrendSnapshot = {
        date: new Date().toISOString(),
        google_trends_value: googleTrends.value,
        reddit_mentions: redditMentions.count,
        sentiment: 'neutral',
        new_competitors_found: 0,
        new_launches: 0,
        competitor_price_changes: [],
      };

      const monitor: TrendMonitor = {
        trend_id,
        trend_title,
        created_at: new Date().toISOString(),
        last_checked: new Date().toISOString(),
        check_interval_days,
        status: 'active',
        alert_threshold,
        snapshots: [initialSnapshot],
        current_trend: 'stable',
        change_percent: 0,
        sources: {
          google_trends_url: googleTrends.url,
          reddit_search_url: redditMentions.url,
        },
        tracked_competitors: trackedCompetitors,
        price_history: initialPrices.length > 0 ? [initialPrices] : [],
      };

      monitorData.monitors[trend_id] = monitor;
      monitorData.lastUpdated = new Date().toISOString();
      await writeMonitorData(monitorData);

      return NextResponse.json({
        success: true,
        monitor,
        message: 'Monitor created successfully',
      });

    } else if (action === 'check') {
      // Basic check (Google Trends + Reddit only)
      const monitor = monitorData.monitors[trend_id];
      if (!monitor) {
        return NextResponse.json({ success: false, error: 'Monitor not found' }, { status: 404 });
      }

      const [googleTrends, redditMentions] = await Promise.all([
        fetchGoogleTrendsValue(monitor.trend_title),
        countRedditMentions(monitor.trend_title),
      ]);

      const previousSnapshot = monitor.snapshots[monitor.snapshots.length - 1];
      const sentiment = determineSentiment(googleTrends.value, previousSnapshot?.google_trends_value || 50);

      const newSnapshot: TrendSnapshot = {
        date: new Date().toISOString(),
        google_trends_value: googleTrends.value,
        reddit_mentions: redditMentions.count,
        sentiment,
        new_competitors_found: 0,
        new_launches: 0,
        competitor_price_changes: [],
      };

      monitor.snapshots.push(newSnapshot);
      if (monitor.snapshots.length > 12) {
        monitor.snapshots = monitor.snapshots.slice(-12);
      }

      const { trend, changePercent } = determineTrend(monitor.snapshots);
      monitor.current_trend = trend;
      monitor.change_percent = Math.round(changePercent);
      monitor.last_checked = new Date().toISOString();
      monitor.sources.google_trends_url = googleTrends.url;
      monitor.sources.reddit_search_url = redditMentions.url;

      if (Math.abs(changePercent) > monitor.alert_threshold) {
        monitor.status = 'alert';
        monitor.alert_message = changePercent > 0
          ? `Тренд "${monitor.trend_title}" вырос на ${Math.round(changePercent)}%! Возможность растёт.`
          : `Тренд "${monitor.trend_title}" упал на ${Math.abs(Math.round(changePercent))}%. Рассмотрите альтернативы.`;
      }

      monitorData.monitors[trend_id] = monitor;
      monitorData.lastUpdated = new Date().toISOString();
      await writeMonitorData(monitorData);

      return NextResponse.json({
        success: true,
        monitor,
        message: monitor.alert_message || 'Monitor updated successfully',
      });

    } else if (action === 'check-full') {
      // Full check: Google Trends + Reddit + new competitors + new launches
      const monitor = monitorData.monitors[trend_id];
      if (!monitor) {
        return NextResponse.json({ success: false, error: 'Monitor not found' }, { status: 404 });
      }

      // Fetch all data in parallel (including price tracking)
      const hasTrackedCompetitors = (monitor.tracked_competitors?.length || 0) > 0;
      const [googleTrends, redditMentions, newCompetitors, newLaunches, currentPrices] = await Promise.all([
        fetchGoogleTrendsValue(monitor.trend_title),
        countRedditMentions(monitor.trend_title),
        searchNewCompetitors(monitor.trend_title),
        searchNewLaunches(monitor.trend_title),
        hasTrackedCompetitors ? fetchTrackedPrices(monitor.tracked_competitors) : Promise.resolve([] as CompetitorPriceRecord[]),
      ]);

      // Detect price changes vs previous price snapshot
      const previousPriceSnapshot = (monitor.price_history?.length || 0) > 0
        ? monitor.price_history[monitor.price_history.length - 1]
        : [];
      const priceChanges = currentPrices.length > 0 && previousPriceSnapshot.length > 0
        ? detectPriceChanges(previousPriceSnapshot, currentPrices)
        : [];

      // Save current prices to history
      if (currentPrices.length > 0) {
        if (!monitor.price_history) monitor.price_history = [];
        monitor.price_history.push(currentPrices);
        if (monitor.price_history.length > 12) {
          monitor.price_history = monitor.price_history.slice(-12);
        }
      }

      const previousSnapshot = monitor.snapshots[monitor.snapshots.length - 1];
      const sentiment = determineSentiment(googleTrends.value, previousSnapshot?.google_trends_value || 50);

      const newSnapshot: TrendSnapshot = {
        date: new Date().toISOString(),
        google_trends_value: googleTrends.value,
        reddit_mentions: redditMentions.count,
        sentiment,
        new_competitors_found: newCompetitors.count,
        new_launches: newLaunches.count,
        competitor_price_changes: priceChanges,
      };

      monitor.snapshots.push(newSnapshot);
      if (monitor.snapshots.length > 12) {
        monitor.snapshots = monitor.snapshots.slice(-12);
      }

      const { trend, changePercent } = determineTrend(monitor.snapshots);
      monitor.current_trend = trend;
      monitor.change_percent = Math.round(changePercent);
      monitor.last_checked = new Date().toISOString();
      monitor.sources.google_trends_url = googleTrends.url;
      monitor.sources.reddit_search_url = redditMentions.url;

      if (Math.abs(changePercent) > monitor.alert_threshold) {
        monitor.status = 'alert';
        monitor.alert_message = changePercent > 0
          ? `Тренд "${monitor.trend_title}" вырос на ${Math.round(changePercent)}%! Возможность растёт.`
          : `Тренд "${monitor.trend_title}" упал на ${Math.abs(Math.round(changePercent))}%. Рассмотрите альтернативы.`;
      }

      monitorData.monitors[trend_id] = monitor;
      monitorData.lastUpdated = new Date().toISOString();
      await writeMonitorData(monitorData);

      // Build digest
      const digestItems = buildDigest(monitor);
      const recommendation = await generateRecommendation(monitor.trend_title, digestItems);

      // Format period
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const period = `${weekAgo.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

      return NextResponse.json({
        success: true,
        monitor,
        digest: {
          trend_id: monitor.trend_id,
          trend_title: monitor.trend_title,
          period,
          items: digestItems,
          summary: `${digestItems.length} изменений за неделю`,
          recommendation,
          snapshots: monitor.snapshots.slice(-4),
        },
        message: 'Full check completed',
      });

    } else if (action === 'digest') {
      // Generate digest from existing data (no new API calls)
      const monitor = monitorData.monitors[trend_id];
      if (!monitor) {
        return NextResponse.json({ success: false, error: 'Monitor not found' }, { status: 404 });
      }

      const digestItems = buildDigest(monitor);
      const recommendation = await generateRecommendation(monitor.trend_title, digestItems);

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const period = `${weekAgo.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — ${now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`;

      return NextResponse.json({
        success: true,
        digest: {
          trend_id: monitor.trend_id,
          trend_title: monitor.trend_title,
          period,
          items: digestItems,
          summary: `${digestItems.length} изменений`,
          recommendation,
          snapshots: monitor.snapshots.slice(-4),
        },
      });

    } else if (action === 'delete') {
      delete monitorData.monitors[trend_id];
      monitorData.lastUpdated = new Date().toISOString();
      await writeMonitorData(monitorData);
      return NextResponse.json({ success: true, message: 'Monitor deleted' });

    } else if (action === 'pause') {
      if (monitorData.monitors[trend_id]) {
        monitorData.monitors[trend_id].status = 'paused';
        await writeMonitorData(monitorData);
      }
      return NextResponse.json({ success: true, message: 'Monitor paused' });

    } else if (action === 'resume') {
      if (monitorData.monitors[trend_id]) {
        monitorData.monitors[trend_id].status = 'active';
        monitorData.monitors[trend_id].alert_message = undefined;
        await writeMonitorData(monitorData);
      }
      return NextResponse.json({ success: true, message: 'Monitor resumed' });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Monitor API error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET - Get all monitors or specific monitor
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url);
    const trendId = searchParams.get('trend_id');

    const monitorData = await readMonitorData();

    if (trendId) {
      const monitor = monitorData.monitors[trendId];
      if (!monitor) {
        return NextResponse.json(
          { success: false, error: 'Monitor not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, monitor });
    }

    const monitors = Object.values(monitorData.monitors);
    monitors.sort((a, b) =>
      new Date(b.last_checked).getTime() - new Date(a.last_checked).getTime()
    );

    const alerts = monitors.filter(m => m.status === 'alert');

    return NextResponse.json({
      success: true,
      monitors,
      alerts,
      total: monitors.length,
      lastUpdated: monitorData.lastUpdated,
    });

  } catch (error) {
    console.error('Monitor GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
