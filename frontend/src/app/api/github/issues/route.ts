import { NextRequest, NextResponse } from 'next/server';

interface CreateIssueRequest {
  repo_owner: string;
  repo_name: string;
  title: string;
  body: string;
  labels?: string[];
  milestone?: number;
}

interface Issue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  labels: Array<{ name: string; color: string }>;
  created_at: string;
  updated_at: string;
}

// GET /api/github/issues - Get issues for a repository
export async function GET(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const owner = searchParams.get('owner');
  const repo = searchParams.get('repo');
  const state = searchParams.get('state') || 'all';

  if (!owner || !repo) {
    return NextResponse.json({ success: false, error: 'Missing owner or repo' }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=100`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ success: false, error: error.message }, { status: response.status });
    }

    const issues: Issue[] = await response.json();

    return NextResponse.json({
      success: true,
      issues: issues.filter(i => !i.html_url.includes('/pull/')), // Filter out PRs
    });
  } catch (error) {
    console.error('Error fetching issues:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/github/issues - Create a new issue
export async function POST(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body: CreateIssueRequest = await request.json();

    if (!body.repo_owner || !body.repo_name || !body.title) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.github.com/repos/${body.repo_owner}/${body.repo_name}/issues`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: body.title,
          body: body.body || '',
          labels: body.labels || [],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ success: false, error: error.message }, { status: response.status });
    }

    const issue = await response.json();

    return NextResponse.json({
      success: true,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
      },
    });
  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/github/issues - Update issue (close/reopen)
export async function PATCH(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { repo_owner, repo_name, issue_number, state } = body;

    if (!repo_owner || !repo_name || !issue_number) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const response = await fetch(
      `https://api.github.com/repos/${repo_owner}/${repo_name}/issues/${issue_number}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ state }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ success: false, error: error.message }, { status: response.status });
    }

    const issue = await response.json();

    return NextResponse.json({
      success: true,
      issue: {
        id: issue.id,
        number: issue.number,
        state: issue.state,
      },
    });
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
