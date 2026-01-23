import { NextRequest, NextResponse } from 'next/server';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';

// Production callback URL - must match exactly what's in GitHub OAuth App settings
const PRODUCTION_CALLBACK_URL = 'https://trendhunter-ai.vercel.app/api/auth/github/callback';

// GET /api/auth/github - Redirect to GitHub OAuth
export async function GET(request: NextRequest) {
  const scope = 'repo user:email';

  // Определяем redirect_uri
  const host = request.headers.get('host') || 'localhost:3000';
  const isProduction = !host.includes('localhost');
  const redirectUri = isProduction
    ? PRODUCTION_CALLBACK_URL
    : `http://${host}/api/auth/github/callback`;

  // Сохраняем URL для возврата после авторизации
  const returnUrl = request.nextUrl.searchParams.get('returnUrl') || '/';
  const state = JSON.stringify({
    uuid: crypto.randomUUID(),
    returnUrl,
  });

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', redirectUri);
  githubAuthUrl.searchParams.set('scope', scope);
  githubAuthUrl.searchParams.set('state', Buffer.from(state).toString('base64'));

  return NextResponse.redirect(githubAuthUrl.toString());
}
