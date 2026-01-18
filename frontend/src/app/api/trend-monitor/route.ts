import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const SERPAPI_KEY = process.env.SERPAPI_KEY || '';
const MONITOR_FILE = path.join(process.cwd(), 'data', 'trend-monitors.json');

interface TrendSnapshot {
  date: string;
  google_trends_value: number;
  reddit_mentions: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

interface TrendMonitor {
  trend_id: string;
  trend_title: string;
  created_at: string;
  last_checked: string;
  check_interval_days: number;
  status: 'active' | 'paused' | 'alert';
  alert_threshold: number; // % change to trigger alert
  snapshots: TrendSnapshot[];
  current_trend: 'rising' | 'stable' | 'declining';
  change_percent: number;
  alert_message?: string;
  sources: {
    google_trends_url: string;
    reddit_search_url: string;
  };
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
    const response = await fetch(trendsUrl);

    if (!response.ok) {
      return { value: 50, url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(query)}` };
    }

    const data = await response.json();
    const timelineData = data.interest_over_time?.timeline_data || [];

    // Get latest value
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
    const response = await fetch(searchUrl);

    if (!response.ok) {
      return { count: 0, url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&t=week` };
    }

    const data = await response.json();
    const resultCount = data.search_information?.total_results || 0;

    return {
      count: Math.min(resultCount, 1000), // Cap at 1000
      url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&t=week`
    };

  } catch (error) {
    console.error('Error counting Reddit mentions:', error);
    return { count: 0, url: `https://www.reddit.com/search/?q=${encodeURIComponent(query)}&t=week` };
  }
}

// Determine sentiment based on trends
function determineSentiment(currentValue: number, previousValue: number): 'positive' | 'neutral' | 'negative' {
  const change = ((currentValue - previousValue) / previousValue) * 100;
  if (change > 10) return 'positive';
  if (change < -10) return 'negative';
  return 'neutral';
}

// Determine trend direction
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

// POST - Create or update a trend monitor
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, trend_id, trend_title, check_interval_days = 7, alert_threshold = 20 } = body;

    const monitorData = await readMonitorData();

    if (action === 'create') {
      // Create new monitor
      if (!trend_id || !trend_title) {
        return NextResponse.json(
          { success: false, error: 'trend_id and trend_title are required' },
          { status: 400 }
        );
      }

      // Fetch initial data
      const googleTrends = await fetchGoogleTrendsValue(trend_title);
      const redditMentions = await countRedditMentions(trend_title);

      const initialSnapshot: TrendSnapshot = {
        date: new Date().toISOString(),
        google_trends_value: googleTrends.value,
        reddit_mentions: redditMentions.count,
        sentiment: 'neutral',
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
      // Check/update existing monitor
      const monitor = monitorData.monitors[trend_id];
      if (!monitor) {
        return NextResponse.json(
          { success: false, error: 'Monitor not found' },
          { status: 404 }
        );
      }

      // Fetch new data
      const googleTrends = await fetchGoogleTrendsValue(monitor.trend_title);
      const redditMentions = await countRedditMentions(monitor.trend_title);

      const previousSnapshot = monitor.snapshots[monitor.snapshots.length - 1];
      const sentiment = determineSentiment(googleTrends.value, previousSnapshot?.google_trends_value || 50);

      const newSnapshot: TrendSnapshot = {
        date: new Date().toISOString(),
        google_trends_value: googleTrends.value,
        reddit_mentions: redditMentions.count,
        sentiment,
      };

      monitor.snapshots.push(newSnapshot);

      // Keep only last 12 snapshots (about 3 months of weekly data)
      if (monitor.snapshots.length > 12) {
        monitor.snapshots = monitor.snapshots.slice(-12);
      }

      // Determine trend
      const { trend, changePercent } = determineTrend(monitor.snapshots);
      monitor.current_trend = trend;
      monitor.change_percent = Math.round(changePercent);
      monitor.last_checked = new Date().toISOString();
      monitor.sources.google_trends_url = googleTrends.url;
      monitor.sources.reddit_search_url = redditMentions.url;

      // Check for alerts
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

    } else if (action === 'delete') {
      delete monitorData.monitors[trend_id];
      monitorData.lastUpdated = new Date().toISOString();
      await writeMonitorData(monitorData);

      return NextResponse.json({
        success: true,
        message: 'Monitor deleted',
      });

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

    // Return all monitors
    const monitors = Object.values(monitorData.monitors);

    // Sort by last_checked (most recent first)
    monitors.sort((a, b) =>
      new Date(b.last_checked).getTime() - new Date(a.last_checked).getTime()
    );

    // Get alerts
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
