import { NextRequest, NextResponse } from 'next/server';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

// Парсинг state для получения returnUrl
function parseState(stateParam: string | null): { returnUrl: string } {
  if (!stateParam) return { returnUrl: '/' };

  try {
    const decoded = Buffer.from(stateParam, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    return { returnUrl: parsed.returnUrl || '/' };
  } catch {
    return { returnUrl: '/' };
  }
}

// GET /api/auth/github/callback - Handle GitHub OAuth callback
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const stateParam = searchParams.get('state');

  // Парсим state для получения returnUrl
  const { returnUrl } = parseState(stateParam);

  if (error) {
    return NextResponse.redirect(new URL(returnUrl + '?auth_error=' + error, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL(returnUrl + '?auth_error=no_code', request.url));
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('GitHub OAuth error:', tokenData.error);
      return NextResponse.redirect(new URL('/?auth_error=' + tokenData.error, request.url));
    }

    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    // Create response with redirect to original page
    const redirectUrl = returnUrl.includes('?')
      ? `${returnUrl}&auth_success=true`
      : `${returnUrl}?auth_success=true`;
    const response = NextResponse.redirect(new URL(redirectUrl, request.url));

    // Store auth data in cookies (httpOnly for security)
    response.cookies.set('github_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    response.cookies.set('github_user', JSON.stringify({
      id: userData.id,
      login: userData.login,
      name: userData.name,
      avatar_url: userData.avatar_url,
      html_url: userData.html_url,
    }), {
      httpOnly: false, // Allow client-side access for UI
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('GitHub OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?auth_error=server_error', request.url));
  }
}
