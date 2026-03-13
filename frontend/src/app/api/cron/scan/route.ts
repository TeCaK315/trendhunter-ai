import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this automatically for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/scan-trends`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ auto: true }),
    });

    if (response.ok) {
      const result = await response.json();
      return NextResponse.json({
        ok: true,
        newTrends: result.newTrendsCount,
        serpApiCalls: result.serpApiCallsUsed,
        duration: result.scanDurationMs,
      });
    } else {
      return NextResponse.json({ ok: false, error: 'Scan failed' }, { status: 500 });
    }
  } catch (error) {
    console.error('[cron/scan] Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
