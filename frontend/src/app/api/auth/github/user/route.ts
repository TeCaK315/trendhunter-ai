import { NextRequest, NextResponse } from 'next/server';

// GET /api/auth/github/user - Get current GitHub user
export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;
  const userCookie = request.cookies.get('github_user')?.value;

  if (!token || !userCookie) {
    return NextResponse.json({ authenticated: false, user: null });
  }

  try {
    // Verify token is still valid
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      // Token is invalid, clear cookies
      const res = NextResponse.json({ authenticated: false, user: null });
      res.cookies.delete('github_token');
      res.cookies.delete('github_user');
      return res;
    }

    const user = JSON.parse(userCookie);
    return NextResponse.json({ authenticated: true, user });

  } catch (error) {
    console.error('Error verifying GitHub token:', error);
    return NextResponse.json({ authenticated: false, user: null });
  }
}
