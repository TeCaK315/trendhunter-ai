import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/auth/vercel/callback
 *
 * Callback для OAuth авторизации Vercel
 * Получает токен и сохраняет в cookies
 */

const VERCEL_CLIENT_ID = process.env.VERCEL_CLIENT_ID || '';
const VERCEL_CLIENT_SECRET = process.env.VERCEL_CLIENT_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  // Декодируем state для получения returnTo
  let returnTo = '/';
  if (state) {
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
      returnTo = decoded.returnTo || '/';
    } catch {
      // Игнорируем ошибку парсинга
    }
  }

  if (error) {
    console.error('Vercel OAuth error:', error);
    return NextResponse.redirect(`${APP_URL}${returnTo}?vercel_error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${APP_URL}${returnTo}?vercel_error=no_code`);
  }

  if (!VERCEL_CLIENT_ID || !VERCEL_CLIENT_SECRET) {
    return NextResponse.redirect(`${APP_URL}${returnTo}?vercel_error=not_configured`);
  }

  try {
    // Обмениваем код на токен
    const tokenResponse = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: VERCEL_CLIENT_ID,
        client_secret: VERCEL_CLIENT_SECRET,
        code: code,
        redirect_uri: `${APP_URL}/api/auth/vercel/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Vercel token exchange error:', errorData);
      return NextResponse.redirect(`${APP_URL}${returnTo}?vercel_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return NextResponse.redirect(`${APP_URL}${returnTo}?vercel_error=no_access_token`);
    }

    // Получаем информацию о пользователе
    const userResponse = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    let username = 'unknown';
    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.user?.username || 'unknown';
    }

    // Создаём response с редиректом
    const response = NextResponse.redirect(`${APP_URL}${returnTo}?vercel_connected=true`);

    // Сохраняем токен в httpOnly cookie
    response.cookies.set('vercel_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 дней
      path: '/',
    });

    // Сохраняем username в обычной cookie (для UI)
    response.cookies.set('vercel_username', username, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    console.log(`Vercel OAuth successful for user: ${username}`);

    return response;

  } catch (error) {
    console.error('Vercel OAuth callback error:', error);
    return NextResponse.redirect(`${APP_URL}${returnTo}?vercel_error=unknown`);
  }
}
