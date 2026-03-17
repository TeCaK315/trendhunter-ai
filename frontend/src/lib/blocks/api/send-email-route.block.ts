import type { BlockContext, BlockResult } from '../types';

export default function generate(ctx: BlockContext): BlockResult {
  return {
    'src/app/api/send-email/route.ts': `import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, subject, body: emailBody, pdf_base64, filename } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields: to, subject' }, { status: 400 });
    }

    // Check for Resend API key
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      // Fallback: open mailto link (frontend will handle)
      return NextResponse.json({
        fallback: true,
        mailto: \`mailto:\${to}?subject=\${encodeURIComponent(subject)}&body=\${encodeURIComponent(emailBody || '')}\`,
        message: 'No RESEND_API_KEY configured. Use the mailto link instead.',
      });
    }

    // Send via Resend API
    const fromEmail = process.env.EMAIL_FROM || 'noreply@resend.dev';

    const emailPayload: any = {
      from: fromEmail,
      to: [to],
      subject,
      text: emailBody || '',
    };

    // Attach PDF if provided
    if (pdf_base64 && filename) {
      // Extract base64 data from data URI
      const base64Data = pdf_base64.includes(',') ? pdf_base64.split(',')[1] : pdf_base64;
      emailPayload.attachments = [{
        filename: filename,
        content: base64Data,
      }];
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${resendKey}\`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.message || 'Failed to send email' },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, id: data.id });
  } catch (err: any) {
    console.error('Send email error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
`,
  };
}
