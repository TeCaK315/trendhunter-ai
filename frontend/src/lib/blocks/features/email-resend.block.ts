import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/lib/email.ts': `/**
 * Email utility — sends emails via Resend REST API (no SDK needed).
 * Set RESEND_API_KEY in .env to enable.
 */

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string }>;
}

export async function sendEmail({ to, subject, html, from, replyTo, attachments }: SendEmailOptions) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[email] No RESEND_API_KEY configured — email not sent');
    return { id: 'skipped', message: 'No RESEND_API_KEY' };
  }

  const fromAddress = from || process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev';

  const payload: Record<string, any> = {
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  if (replyTo) payload.reply_to = replyTo;
  if (attachments && attachments.length > 0) payload.attachments = attachments;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${apiKey}\`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' }));
    console.error('[email] Resend API error:', err);
    throw new Error(err.message || 'Failed to send email');
  }

  return res.json();
}
`,

    'src/app/api/send-email/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, html, body: textBody, pdf_base64, filename } = await req.json();

    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      );
    }

    // Build attachments if PDF provided
    const attachments: Array<{ filename: string; content: string }> = [];
    if (pdf_base64 && filename) {
      const base64Data = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
      attachments.push({ filename, content: base64Data });
    }

    const result = await sendEmail({
      to,
      subject,
      html: html || textBody || '',
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Send email API error:', error);

    // Fallback: return mailto link if Resend not configured
    if (error.message?.includes('No RESEND_API_KEY')) {
      const { to, subject, body: textBody } = await req.json().catch(() => ({} as any));
      return NextResponse.json({
        fallback: true,
        mailto: \`mailto:\${to || ''}?subject=\${encodeURIComponent(subject || '')}&body=\${encodeURIComponent(textBody || '')}\`,
        message: 'No RESEND_API_KEY configured. Use the mailto link instead.',
      });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}
`,
  };
}
