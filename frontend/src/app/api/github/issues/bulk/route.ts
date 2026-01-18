import { NextRequest, NextResponse } from 'next/server';

interface Task {
  title: string;
  description?: string;
  week?: number;
  priority?: 'high' | 'medium' | 'low';
  type?: 'feature' | 'bug' | 'task' | 'research';
}

interface BulkCreateRequest {
  repo_owner: string;
  repo_name: string;
  tasks: Task[];
  project_name?: string;
}

// POST /api/github/issues/bulk - Create multiple issues from project tasks
export async function POST(request: NextRequest) {
  const token = request.cookies.get('github_token')?.value;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const body: BulkCreateRequest = await request.json();

    if (!body.repo_owner || !body.repo_name || !body.tasks || body.tasks.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const createdIssues: Array<{ title: string; number: number; html_url: string }> = [];
    const errors: Array<{ title: string; error: string }> = [];

    // Create issues sequentially to avoid rate limiting
    for (const task of body.tasks) {
      try {
        // Build labels based on task properties
        const labels: string[] = [];
        if (task.week) labels.push(`week-${task.week}`);
        if (task.priority) labels.push(`priority:${task.priority}`);
        if (task.type) labels.push(task.type);

        // Build issue body
        let issueBody = '';
        if (task.description) {
          issueBody += task.description + '\n\n';
        }
        if (task.week) {
          issueBody += `**Неделя:** ${task.week}\n`;
        }
        if (task.priority) {
          issueBody += `**Приоритет:** ${task.priority}\n`;
        }
        if (body.project_name) {
          issueBody += `\n---\n*Создано из проекта: ${body.project_name}*`;
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
              title: task.title,
              body: issueBody || undefined,
              labels: labels.length > 0 ? labels : undefined,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          errors.push({ title: task.title, error: error.message });
          continue;
        }

        const issue = await response.json();
        createdIssues.push({
          title: issue.title,
          number: issue.number,
          html_url: issue.html_url,
        });

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (err) {
        errors.push({ title: task.title, error: 'Failed to create issue' });
      }
    }

    return NextResponse.json({
      success: true,
      created: createdIssues,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        total: body.tasks.length,
        created: createdIssues.length,
        failed: errors.length,
      },
    });
  } catch (error) {
    console.error('Error bulk creating issues:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
