/**
 * Project Iterate API — META Agent iterative code generation
 *
 * Reads existing repo from GitHub, generates new/modified files via Claude,
 * pushes changes as a single atomic commit.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getRepoTree,
  getFilesContent,
  selectRelevantFiles,
  parseRepoUrl,
} from '@/lib/github-reader';
import {
  sanitizeImports,
  parseDelimiterFormat,
} from '@/lib/blocks/custom/gap-filler';

export const dynamic = 'force-dynamic';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ─── Types ───

interface IterateRequest {
  repo_url: string;
  message: string;
  conversation_history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface GitHubPushResult {
  success: boolean;
  filesCreated: number;
  commitSha?: string;
  commitUrl?: string;
  errors: string[];
}

// ─── Main Handler ───

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const githubToken = request.cookies.get('github_token')?.value;
    if (!githubToken) {
      return NextResponse.json(
        { error: 'GitHub authentication required' },
        { status: 401 },
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Anthropic API key not configured' },
        { status: 500 },
      );
    }

    // 2. Parse request
    const body: IterateRequest = await request.json();
    const { repo_url, message, conversation_history = [] } = body;

    if (!repo_url || !message) {
      return NextResponse.json(
        { error: 'repo_url and message are required' },
        { status: 400 },
      );
    }

    const parsed = parseRepoUrl(repo_url);
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub repo URL' },
        { status: 400 },
      );
    }

    const { owner, repo } = parsed;

    // 3. Read repo tree
    console.log(`[iterate] Reading tree for ${owner}/${repo}...`);
    const tree = await getRepoTree(githubToken, owner, repo);
    console.log(`[iterate] Found ${tree.entries.length} files`);

    // 4. Select relevant files
    const filesToRead = selectRelevantFiles(tree.entries, message);
    console.log(`[iterate] Reading ${filesToRead.length} files for context`);

    // 5. Read file contents
    const fileContents = await getFilesContent(githubToken, owner, repo, filesToRead);

    // 6. Build prompt
    const treeListing = tree.entries
      .slice(0, 150) // Cap at 150 entries for context
      .map(e => `- ${e.path}${e.size ? ` (${e.size}b)` : ''}`)
      .join('\n');

    const filesContext = fileContents
      .map(f => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
      .join('\n\n');

    // Extract installed packages from package.json
    const pkgJson = fileContents.find(f => f.path === 'package.json');
    let installedPackages = '';
    if (pkgJson) {
      try {
        const pkg = JSON.parse(pkgJson.content);
        const deps = Object.keys(pkg.dependencies || {});
        const devDeps = Object.keys(pkg.devDependencies || {});
        installedPackages = `\n\nInstalled packages:\n- dependencies: ${deps.join(', ')}\n- devDependencies: ${devDeps.join(', ')}`;
      } catch { /* ignore parse errors */ }
    }

    const systemPrompt = `You are a Senior Full-Stack Developer working on an existing Next.js + TypeScript + Tailwind CSS + Supabase project.
Your task is to implement the user's requested feature by generating or modifying files.

## Project structure (all files in repo):
${treeListing}
${installedPackages}

## Current file contents:
${filesContext}

## Rules:
1. Generate ONLY files that need to be CREATED or MODIFIED
2. Each file must be COMPLETE (not partial patches — include the full file content)
3. Use ===FILE: path=== delimiter before each file
4. After all files, add ===EXPLANATION=== with a brief summary of what was done (in the same language as the user's message)
5. Preserve existing code style, imports, and patterns from the files above
6. Use 'use client' for components with state/effects/event handlers
7. Use existing project dependencies (check the package.json above)
8. If new npm packages are needed, update package.json with the new dependencies
9. Use @/ import aliases as configured in tsconfig.json
10. DO NOT wrap code in markdown code blocks
11. DO NOT delete or rename existing files — only add new or modify existing

## CRITICAL — Do NOT import these packages (use built-in alternatives):
- uuid → use crypto.randomUUID()
- moment / dayjs → use Intl.DateTimeFormat or new Date().toLocaleDateString()
- lodash → use native JS (Array.prototype methods, structuredClone, etc.)
- axios → use fetch() (built-in)
- classnames / clsx → use template literals or conditional strings

## Supabase client usage (use the correct client for each file type):
- 'use client' components: import { createClient } from '@/lib/supabase/client' (SYNC, no await)
- API routes (src/app/api/**/route.ts): import { createClient } from '@/lib/supabase/server' (ASYNC, must await)
- Server components: import { createClient } from '@/lib/supabase/server' (ASYNC, must await)
- NEVER use @supabase/auth-helpers-nextjs or deprecated helpers
- For API routes: add \`export const dynamic = 'force-dynamic';\`
- NEVER initialize SDK clients at module level — always use lazy initialization inside functions`;

    // Build messages with conversation history (last 6)
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    const recentHistory = conversation_history.slice(-6);
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
    messages.push({ role: 'user', content: message });

    // 7. Call Claude API
    console.log('[iterate] Calling Claude API...');
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        temperature: 0.2,
        system: systemPrompt,
        messages,
      }),
    });

    if (!claudeResponse.ok) {
      const err = await claudeResponse.text();
      console.error('[iterate] Claude API error:', claudeResponse.status, err);
      return NextResponse.json(
        { error: 'AI generation failed' },
        { status: 502 },
      );
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || '';

    // 8. Parse response
    const explParts = responseText.split(/===EXPLANATION===/);
    const filesPart = explParts[0] || '';
    const explanation = explParts[1]?.trim() || 'Changes applied successfully.';

    const rawFiles = parseDelimiterFormat(filesPart);
    const files = sanitizeImports(rawFiles);

    console.log(`[iterate] Generated ${Object.keys(files).length} files`);

    if (Object.keys(files).length === 0) {
      return NextResponse.json({
        success: true,
        message: explanation,
        files_modified: [],
        files_count: 0,
      });
    }

    // 9. Push to GitHub
    console.log('[iterate] Pushing to GitHub...');
    const commitMessage = `feat: ${message.substring(0, 72)}\n\nGenerated by TrendHunter AI META agent\n${Object.keys(files).length} files added/updated`;
    const pushResult = await pushFilesToGitHub(
      githubToken,
      owner,
      repo,
      files,
      commitMessage,
    );

    if (!pushResult.success) {
      return NextResponse.json({
        success: false,
        error: `GitHub push failed: ${pushResult.errors.join(', ')}`,
        files_modified: Object.keys(files),
        files_count: Object.keys(files).length,
      }, { status: 500 });
    }

    console.log(`[iterate] Pushed ${pushResult.filesCreated} files, commit: ${pushResult.commitSha}`);

    return NextResponse.json({
      success: true,
      message: explanation,
      files_modified: Object.keys(files),
      files_count: Object.keys(files).length,
      commit_sha: pushResult.commitSha,
      commit_url: pushResult.commitUrl,
    });
  } catch (error: unknown) {
    console.error('[iterate] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// ─── GitHub Push (blob→tree→commit→ref) ───

async function pushFilesToGitHub(
  token: string,
  owner: string,
  repo: string,
  files: Record<string, string>,
  commitMessage: string,
): Promise<GitHubPushResult> {
  const errors: string[] = [];
  const hdrs = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // Find base branch
    let baseBranch = 'main';
    let baseCommitSha: string | null = null;

    for (const branch of ['main', 'master']) {
      const refRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        { headers: hdrs },
      );
      if (refRes.ok) {
        const refData = await refRes.json();
        baseBranch = branch;
        baseCommitSha = refData.object.sha;
        break;
      }
    }

    if (!baseCommitSha) {
      return { success: false, filesCreated: 0, errors: ['Could not find base branch'] };
    }

    // Create blobs
    const blobs: Array<{ path: string; sha: string }> = [];
    for (const [path, content] of Object.entries(files)) {
      const blobRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        {
          method: 'POST',
          headers: hdrs,
          body: JSON.stringify({
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          }),
        },
      );
      if (!blobRes.ok) {
        const error = await blobRes.json();
        errors.push(`Blob ${path}: ${error.message}`);
        continue;
      }
      const blob = await blobRes.json();
      blobs.push({ path, sha: blob.sha });
    }

    if (blobs.length === 0) {
      return { success: false, filesCreated: 0, errors: ['No blobs created'] };
    }

    // Get base tree
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
      { headers: hdrs },
    );
    if (!commitRes.ok) {
      return { success: false, filesCreated: 0, errors: ['Could not get base commit'] };
    }
    const commitData = await commitRes.json();

    // Create tree
    const treeRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          base_tree: commitData.tree.sha,
          tree: blobs.map(b => ({
            path: b.path,
            mode: '100644',
            type: 'blob',
            sha: b.sha,
          })),
        }),
      },
    );
    if (!treeRes.ok) {
      const error = await treeRes.json();
      return { success: false, filesCreated: 0, errors: [`Tree failed: ${error.message}`] };
    }
    const treeData = await treeRes.json();

    // Create commit
    const newCommitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers: hdrs,
        body: JSON.stringify({
          message: commitMessage,
          tree: treeData.sha,
          parents: [baseCommitSha],
        }),
      },
    );
    if (!newCommitRes.ok) {
      const error = await newCommitRes.json();
      return { success: false, filesCreated: 0, errors: [`Commit failed: ${error.message}`] };
    }
    const newCommit = await newCommitRes.json();

    // Update ref
    const refUpdateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      {
        method: 'PATCH',
        headers: hdrs,
        body: JSON.stringify({ sha: newCommit.sha, force: true }),
      },
    );
    if (!refUpdateRes.ok) {
      const error = await refUpdateRes.json();
      errors.push(`Ref update failed: ${error.message}`);
    }

    return {
      success: errors.length === 0,
      filesCreated: blobs.length,
      commitSha: newCommit.sha,
      commitUrl: `https://github.com/${owner}/${repo}/commit/${newCommit.sha}`,
      errors,
    };
  } catch (error) {
    return {
      success: false,
      filesCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}
