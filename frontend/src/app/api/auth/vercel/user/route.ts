import { NextRequest, NextResponse } from 'next/server';
import { getVercelUser } from '@/lib/vercel';

/**
 * GET /api/auth/vercel/user
 * Проверяет авторизацию Vercel и возвращает информацию о пользователе
 */
export async function GET(request: NextRequest) {
  try {
    const vercelToken = request.cookies.get('vercel_token')?.value;

    if (!vercelToken) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const user = await getVercelUser(vercelToken);

    if (!user) {
      // Токен невалидный или истёк
      const response = NextResponse.json({
        authenticated: false,
        user: null,
      });
      // Удаляем невалидный токен
      response.cookies.delete('vercel_token');
      return response;
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Vercel user check error:', error);
    return NextResponse.json({
      authenticated: false,
      user: null,
      error: 'Failed to check Vercel authentication',
    });
  }
}
