import { NextRequest, NextResponse } from 'next/server';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/api/auth/github/callback';

// GET /api/auth/github - Redirect to GitHub OAuth
export async function GET(request: NextRequest) {
  const scope = 'repo user:email';

  // Сохраняем URL для возврата после авторизации
  const returnUrl = request.nextUrl.searchParams.get('returnUrl') || '/';
  const state = JSON.stringify({
    uuid: crypto.randomUUID(),
    returnUrl,
  });

  const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
  githubAuthUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
  githubAuthUrl.searchParams.set('redirect_uri', GITHUB_REDIRECT_URI);
  githubAuthUrl.searchParams.set('scope', scope);
  githubAuthUrl.searchParams.set('state', Buffer.from(state).toString('base64'));

  return NextResponse.redirect(githubAuthUrl.toString());
}
