import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/auth/vercel
 *
 * OAuth авторизация через Vercel
 * Редирект на страницу авторизации Vercel
 */

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get('returnTo') || '/';

  if (!VERCEL_CLIENT_ID) {
    return NextResponse.json(
      { success: false, error: 'Vercel OAuth not configured' },
      { status: 500 }
    );
  }

  // Сохраняем returnTo в state для редиректа после авторизации
  const state = Buffer.from(JSON.stringify({ returnTo })).toString('base64');

  const authUrl = new URL('https://vercel.com/integrations/new');
  authUrl.searchParams.set('client_id', VERCEL_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', `${APP_URL}/api/auth/vercel/callback`);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('scope', 'user:read,project:read,project:write,deployment:read,deployment:write');

  return NextResponse.redirect(authUrl.toString());
}
