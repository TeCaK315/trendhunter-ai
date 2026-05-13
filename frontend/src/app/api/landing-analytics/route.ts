import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getAuthUser } from '@/lib/auth-helpers'

const ANALYTICS_FILE = path.join(process.cwd(), 'data', 'landing-analytics.json');

interface LandingEvent {
  landing_id: string;
  event_type: 'page_view' | 'signup' | 'click_cta';
  metadata?: {
    email?: string;
    referrer?: string;
    user_agent?: string;
  };
  timestamp: string;
  ip_hash?: string;
}

interface LandingAnalytics {
  events: Record<string, LandingEvent[]>; // landing_id → events
  landings: Record<string, {
    landing_id: string;
    trend_title: string;
    landing_url: string;
    created_at: string;
  }>;
}

async function readAnalytics(): Promise<LandingAnalytics> {
  try {
    const data = await fs.readFile(ANALYTICS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { events: {}, landings: {} };
  }
}

async function writeAnalytics(data: LandingAnalytics): Promise<void> {
  const dir = path.dirname(ANALYTICS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(ANALYTICS_FILE, JSON.stringify(data, null, 2));
}

function hashIP(ip: string): string {
  // Simple hash for unique visitor approximation
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// CORS headers for cross-origin requests from deployed landings
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

// OPTIONS - CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

// POST - Record event
export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { landing_id, event_type, metadata } = body;

    if (!landing_id || !event_type) {
      return NextResponse.json(
        { error: 'landing_id and event_type are required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!['page_view', 'signup', 'click_cta'].includes(event_type)) {
      return NextResponse.json(
        { error: 'Invalid event_type' },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Validate email on signup
    if (event_type === 'signup' && metadata?.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(metadata.email)) {
        return NextResponse.json(
          { error: 'Invalid email format' },
          { status: 400, headers: corsHeaders() }
        );
      }
    }

    const analytics = await readAnalytics();

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') || 'unknown';

    const event: LandingEvent = {
      landing_id,
      event_type,
      metadata: {
        email: metadata?.email,
        referrer: metadata?.referrer,
        user_agent: metadata?.user_agent,
      },
      timestamp: new Date().toISOString(),
      ip_hash: hashIP(ip),
    };

    if (!analytics.events[landing_id]) {
      analytics.events[landing_id] = [];
    }
    analytics.events[landing_id].push(event);

    // Keep max 10000 events per landing
    if (analytics.events[landing_id].length > 10000) {
      analytics.events[landing_id] = analytics.events[landing_id].slice(-10000);
    }

    await writeAnalytics(analytics);

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders() }
    );
  } catch (error) {
    console.error('[landing-analytics] POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// GET - Get stats for a landing
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url);
    const landingId = searchParams.get('landing_id');

    if (!landingId) {
      return NextResponse.json(
        { error: 'landing_id parameter required' },
        { status: 400, headers: corsHeaders() }
      );
    }

    const analytics = await readAnalytics();
    const events = analytics.events[landingId] || [];
    const landingInfo = analytics.landings[landingId];

    // Calculate stats
    const views = events.filter(e => e.event_type === 'page_view');
    const signups = events.filter(e => e.event_type === 'signup');
    const ctaClicks = events.filter(e => e.event_type === 'click_cta');

    // Unique views by ip_hash
    const uniqueIps = new Set(views.map(e => e.ip_hash).filter(Boolean));
    const uniqueViews = uniqueIps.size || views.length;

    const totalSignups = signups.length;
    const conversionRate = uniqueViews > 0
      ? Math.round((totalSignups / uniqueViews) * 10000) / 100
      : 0;

    // PMF verdict
    let pmfVerdict: 'confirmed' | 'promising' | 'needs_work' | 'insufficient_data';
    if (uniqueViews < 50) {
      pmfVerdict = 'insufficient_data';
    } else if (conversionRate > 3) {
      pmfVerdict = 'confirmed';
    } else if (conversionRate >= 1) {
      pmfVerdict = 'promising';
    } else {
      pmfVerdict = 'needs_work';
    }

    // Unique signup emails
    const signupList = signups
      .filter(e => e.metadata?.email)
      .map(e => ({
        email: e.metadata!.email!,
        timestamp: e.timestamp,
      }));

    // Deduplicate emails
    const uniqueSignups = Array.from(
      new Map(signupList.map(s => [s.email, s])).values()
    );

    // Daily stats
    const dailyMap: Record<string, { views: number; signups: number }> = {};
    for (const event of events) {
      const day = event.timestamp.split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { views: 0, signups: 0 };
      if (event.event_type === 'page_view') dailyMap[day].views++;
      if (event.event_type === 'signup') dailyMap[day].signups++;
    }
    const dailyStats = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));

    return NextResponse.json({
      landing_id: landingId,
      landing_info: landingInfo || null,
      total_views: views.length,
      unique_views: uniqueViews,
      total_signups: uniqueSignups.length,
      total_cta_clicks: ctaClicks.length,
      conversion_rate: conversionRate,
      pmf_verdict: pmfVerdict,
      signups: uniqueSignups,
      daily_stats: dailyStats,
    }, { headers: corsHeaders() });

  } catch (error) {
    console.error('[landing-analytics] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

// PUT - Register a new landing (called after deploy)
export async function PUT(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { landing_id, trend_title, landing_url } = body;

    if (!landing_id || !landing_url) {
      return NextResponse.json(
        { error: 'landing_id and landing_url are required' },
        { status: 400 }
      );
    }

    const analytics = await readAnalytics();
    analytics.landings[landing_id] = {
      landing_id,
      trend_title: trend_title || '',
      landing_url,
      created_at: new Date().toISOString(),
    };
    await writeAnalytics(analytics);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[landing-analytics] PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
