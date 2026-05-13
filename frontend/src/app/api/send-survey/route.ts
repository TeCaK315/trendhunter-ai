import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAuthUser } from '@/lib/auth-helpers'

const EMAILS_FILE = path.join(process.cwd(), 'data', 'survey-emails.json');
const DAILY_LIMIT = 100; // Resend free tier

interface EmailLog {
  survey_id: string;
  email: string;
  token: string;
  sent_at: string;
  status: 'sent' | 'failed';
  error?: string;
}

async function readEmailLogs(): Promise<EmailLog[]> {
  try {
    const data = await fs.readFile(EMAILS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeEmailLogs(logs: EmailLog[]): Promise<void> {
  const dir = path.dirname(EMAILS_FILE);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(EMAILS_FILE, JSON.stringify(logs, null, 2));
}

function getTodaySentCount(logs: EmailLog[]): number {
  const today = new Date().toISOString().split('T')[0];
  return logs.filter(l => l.sent_at.startsWith(today) && l.status === 'sent').length;
}

function generateSurveyEmailHtml(params: {
  surveyUrl: string;
  title: string;
  description: string;
  senderName: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="background:#18181b;border:1px solid #27272a;border-radius:16px;padding:32px;text-align:center;">
      <div style="font-size:40px;margin-bottom:16px;">📝</div>
      <h1 style="color:#ffffff;font-size:22px;font-weight:700;margin:0 0 12px;">${escapeHtml(params.title)}</h1>
      ${params.description ? `<p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin:0 0 24px;">${escapeHtml(params.description)}</p>` : ''}
      <p style="color:#71717a;font-size:13px;margin:0 0 24px;">
        ${escapeHtml(params.senderName)} приглашает вас пройти короткий опрос. Это займёт 2-3 минуты.
      </p>
      <a href="${params.surveyUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;border-radius:12px;font-size:15px;font-weight:600;">
        Пройти опрос →
      </a>
      <p style="color:#52525b;font-size:11px;margin:24px 0 0;">
        Если вы не хотите получать такие письма, просто проигнорируйте это сообщение.
      </p>
    </div>
    <p style="text-align:center;color:#3f3f46;font-size:10px;margin-top:16px;">
      Отправлено через TrendHunter AI
    </p>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { survey_id, emails, subject, sender_name, trend_title } = body;

    if (!survey_id || !emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'survey_id and emails array are required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'RESEND_API_KEY not configured. Add it to .env.local' },
        { status: 500 }
      );
    }

    // Validate and deduplicate emails
    const validEmails = [...new Set(emails.filter(isValidEmail))];
    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: 'No valid emails provided' },
        { status: 400 }
      );
    }

    // Check daily rate limit
    const logs = await readEmailLogs();
    const sentToday = getTodaySentCount(logs);
    const remaining = DAILY_LIMIT - sentToday;

    if (remaining <= 0) {
      return NextResponse.json(
        { error: `Daily limit reached (${DAILY_LIMIT}/day). Try again tomorrow.`, remaining_today: 0 },
        { status: 429 }
      );
    }

    const emailsToSend = validEmails.slice(0, remaining);
    const resend = new Resend(apiKey);

    // Detect app URL from request headers
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${proto}://${host}`;
    const emailSubject = subject || `Опрос: ${trend_title || 'Customer Discovery'}`;
    const fromName = sender_name || 'TrendHunter AI';

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];
    const newLogs: EmailLog[] = [];

    // Send emails one by one (Resend free tier doesn't support batch well)
    for (const email of emailsToSend) {
      const token = crypto.randomUUID();
      const surveyUrl = `${appUrl}/survey/${survey_id}?token=${token}`;

      try {
        await resend.emails.send({
          from: `${fromName} <onboarding@resend.dev>`,
          to: [email],
          subject: emailSubject,
          html: generateSurveyEmailHtml({
            surveyUrl,
            title: emailSubject,
            description: trend_title ? `Исследование ниши "${trend_title}"` : '',
            senderName: fromName,
          }),
        });

        newLogs.push({
          survey_id,
          email,
          token,
          sent_at: new Date().toISOString(),
          status: 'sent',
        });
        sent++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        newLogs.push({
          survey_id,
          email,
          token,
          sent_at: new Date().toISOString(),
          status: 'failed',
          error: errMsg,
        });
        errors.push(`${email}: ${errMsg}`);
        failed++;
      }
    }

    // Save logs
    logs.push(...newLogs);
    // Keep max 5000 logs
    if (logs.length > 5000) {
      logs.splice(0, logs.length - 5000);
    }
    await writeEmailLogs(logs);

    const skipped = validEmails.length - emailsToSend.length;

    return NextResponse.json({
      success: true,
      sent,
      failed,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
      remaining_today: remaining - sent,
      survey_url: `${appUrl}/survey/${survey_id}`,
    });
  } catch (error) {
    console.error('[send-survey] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET — get send stats for a survey
export async function GET(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get('survey_id');

    if (!surveyId) {
      return NextResponse.json(
        { error: 'survey_id parameter required' },
        { status: 400 }
      );
    }

    const logs = await readEmailLogs();
    const surveyLogs = logs.filter(l => l.survey_id === surveyId);
    const sentCount = surveyLogs.filter(l => l.status === 'sent').length;
    const failedCount = surveyLogs.filter(l => l.status === 'failed').length;
    const remaining = DAILY_LIMIT - getTodaySentCount(logs);

    return NextResponse.json({
      survey_id: surveyId,
      total_sent: sentCount,
      total_failed: failedCount,
      remaining_today: remaining,
      emails: surveyLogs.map(l => ({
        email: l.email,
        status: l.status,
        sent_at: l.sent_at,
      })),
    });
  } catch (error) {
    console.error('[send-survey] GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
