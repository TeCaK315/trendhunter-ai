import { NextRequest, NextResponse } from 'next/server';

/**
 * /api/auth/vercel
 *
 * POST — сохранить Vercel Personal Access Token
 * DELETE — удалить токен (logout)
 */

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400 }
      );
    }

    // Проверяем токен — получаем инфо о пользователе
    const userRes = await fetch('https://api.vercel.com/v2/user', {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userRes.ok) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      );
    }

    const userData = await userRes.json();
    const username = userData.user?.username || 'unknown';

    const response = NextResponse.json({
      success: true,
      user: { username },
    });

    // Сохраняем токен в httpOnly cookie
    response.cookies.set('vercel_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    response.cookies.set('vercel_username', username, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Vercel auth error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify token' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('vercel_token');
  response.cookies.delete('vercel_username');
  return response;
}
