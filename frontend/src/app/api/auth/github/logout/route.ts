import { NextRequest, NextResponse } from 'next/server';

// POST /api/auth/github/logout - Clear GitHub auth
export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });

  // Clear auth cookies
  response.cookies.delete('github_token');
  response.cookies.delete('github_user');

  return response;
}
