import { Resend } from 'resend';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

/** @deprecated Use getResend() instead */
export const resend = new Proxy({} as Resend, {
  get(_, prop) {
    return (getResend() as any)[prop];
  },
});

interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, from, replyTo }: SendEmailOptions) {
  const fromAddress = from || process.env.RESEND_FROM_EMAIL || 'noreply@example.com';

  try {
    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      ...(replyTo ? { reply_to: replyTo } : {}),
    });

    if (error) {
      console.error('Email send error:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (err: any) {
    console.error('Failed to send email:', err);
    throw err;
  }
}
