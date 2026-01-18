import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const response = await fetch('https://api.github.com/user/repos?sort=created&direction=desc&per_page=30', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ success: false, error: 'Failed to fetch repos' }, { status: 500 });
    }

    const repos = await response.json();

    return NextResponse.json({
      success: true,
      repos: repos,
    });
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
