import { NextRequest, NextResponse } from 'next/server';
import { generateCodeWithClaude, type ProjectSpec } from '@/lib/code-generator';
import { assembleProject } from '@/lib/blocks/block-assembler';
import { sanitizeImports } from '@/lib/blocks/custom/gap-filler';
import { quickSyntaxCheck } from '@/lib/blocks/validate';
import type { ProductSpecification } from '@/lib/mvp-templates/types';
import { getAuthUser } from '@/lib/auth-helpers'

/**
 * /api/generate-code
 *
 * HTTP endpoint for code generation.
 *
 * Two modes:
 * 1. "blocks" (default) — Assembles project from pre-built blocks (fast, cheap, ~30 sec)
 * 2. "claude" — Full Architect → Coder → Reviewer pipeline (slow, expensive, ~50 min)
 *
 * Also handles pushing generated files to GitHub and optional Vercel deploy.
 */

// Добавляем файлы в GitHub репозиторий (Git Data API — один коммит)
async function addFilesToGitHub(
  token: string,
  owner: string,
  repo: string,
  files: Record<string, string>
): Promise<{ success: boolean; filesCreated: number; errors: string[] }> {
  const errors: string[] = [];
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    await new Promise(resolve => setTimeout(resolve, 1000));

    let baseBranch = 'main';
    let baseCommitSha: string | null = null;

    for (const branch of ['main', 'master']) {
      const refResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`,
        { headers }
      );
      if (refResponse.ok) {
        const refData = await refResponse.json();
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
      const blobResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/blobs`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content: Buffer.from(content).toString('base64'),
            encoding: 'base64',
          }),
        }
      );
      if (!blobResponse.ok) {
        const error = await blobResponse.json();
        errors.push(`Blob ${path}: ${error.message}`);
        continue;
      }
      const blob = await blobResponse.json();
      blobs.push({ path, sha: blob.sha });
    }

    if (blobs.length === 0) {
      return { success: false, filesCreated: 0, errors: ['No files created'] };
    }

    // Get base tree
    const commitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
      { headers }
    );
    if (!commitResponse.ok) {
      return { success: false, filesCreated: 0, errors: ['Could not get base commit'] };
    }
    const commitData = await commitResponse.json();

    // Create tree
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          base_tree: commitData.tree.sha,
          tree: blobs.map(b => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })),
        }),
      }
    );
    if (!treeResponse.ok) {
      const error = await treeResponse.json();
      return { success: false, filesCreated: 0, errors: [`Tree creation failed: ${error.message}`] };
    }
    const tree = await treeResponse.json();

    // Create commit
    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: `Generated MVP code (Architect → Coder → Reviewer pipeline)\n\n- ${blobs.length} files added/updated\n- Ready for deployment\n- Run: npm install && npm run dev`,
          tree: tree.sha,
          parents: [baseCommitSha],
        }),
      }
    );
    if (!newCommitResponse.ok) {
      const error = await newCommitResponse.json();
      return { success: false, filesCreated: 0, errors: [`Commit creation failed: ${error.message}`] };
    }
    const newCommit = await newCommitResponse.json();

    // Update ref
    const refUpdateResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ sha: newCommit.sha, force: true }),
      }
    );
    if (!refUpdateResponse.ok) {
      const error = await refUpdateResponse.json();
      errors.push(`Failed to update branch: ${error.message}`);
    }

    return { success: errors.length === 0, filesCreated: blobs.length, errors };
  } catch (error) {
    return {
      success: false,
      filesCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

async function getGitHubUsername(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) return null;
    const user = await response.json();
    return user.login;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await request.json();
    const { spec, github_repo, auto_deploy } = body;

    const githubToken = request.cookies.get('github_token')?.value;
    const vercelToken = request.cookies.get('vercel_token')?.value;

    if (!spec) {
      return NextResponse.json(
        { success: false, error: 'Project specification required' },
        { status: 400 }
      );
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Code generation not configured (missing API key)' },
        { status: 503 }
      );
    }

    const generationMode = body.mode || 'blocks'; // 'blocks' (fast) or 'claude' (full pipeline)

    console.log(`[generate-code] Starting for: ${spec.project_name} (mode: ${generationMode})`);
    console.log(`[generate-code] Features: ${spec.mvp_specification?.core_features?.length || 0} core, ${spec.derived_features?.length || 0} derived`);

    let generatedFiles: Record<string, string>;
    let assemblyMeta: { blocks_used?: string[]; custom_files?: string[]; claude_calls?: number } = {};

    if (generationMode === 'blocks' && body.product_spec) {
      // Block-based assembly (fast, cheap)
      console.log('[generate-code] Using block assembler...');
      const result = await assembleProject({
        product_spec: body.product_spec as ProductSpecification,
        project_name: spec.project_name,
        project_type: body.project_type,
      });
      generatedFiles = result.files;
      assemblyMeta = {
        blocks_used: result.blocks_used,
        custom_files: result.custom_files,
        claude_calls: result.claude_calls,
      };
      console.log(`[generate-code] Block assembly: ${result.total_files} files in ${result.assembly_time_ms}ms (${result.claude_calls} Claude calls)`);
    } else {
      // Legacy: Full Claude pipeline (slow, expensive)
      console.log('[generate-code] Using Claude pipeline...');
      generatedFiles = await generateCodeWithClaude(spec as ProjectSpec);
    }

    // Sanitize ALL generated files (fix translated keywords, wrong imports, etc.)
    generatedFiles = sanitizeImports(generatedFiles);

    const fileCount = Object.keys(generatedFiles).length;
    console.log(`[generate-code] Produced ${fileCount} files`);

    // ── Pre-deploy validation: catch invoice-template-leak / undeclared vars ──
    const validationErrors = quickSyntaxCheck(generatedFiles)
    if (validationErrors.length > 0) {
      console.error(`[generate-code] Validation failed (${validationErrors.length} errors):`)
      for (const e of validationErrors.slice(0, 10)) {
        console.error(`  ${e.file}${e.line ? `:${e.line}` : ''} — ${e.message}`)
      }
      return NextResponse.json(
        {
          success: false,
          error: 'Generated project failed pre-deploy validation',
          validation_errors: validationErrors.slice(0, 20),
          files_count: fileCount,
          ...assemblyMeta,
        },
        { status: 422 }
      )
    }

    let github_url: string | undefined;
    let files_pushed = 0;
    let vercel_url: string | undefined;

    console.log(`[generate-code] deploy gate: github_repo=${!!github_repo}, githubToken=${!!githubToken}, auto_deploy=${!!auto_deploy}, vercelToken=${!!vercelToken}`)

    // Push to GitHub if requested
    if (github_repo && githubToken) {
      const username = await getGitHubUsername(githubToken);
      if (username) {
        let repoName = github_repo;
        if (github_repo.includes('github.com')) {
          const match = github_repo.match(/github\.com\/[^/]+\/([^/]+)/);
          if (match) repoName = match[1].replace(/\.git$/, '');
        }

        console.log(`[generate-code] Pushing to GitHub: ${username}/${repoName}`);
        const pushResult = await addFilesToGitHub(githubToken, username, repoName, generatedFiles);
        console.log('[generate-code] GitHub push result:', JSON.stringify({
          success: pushResult.success,
          filesCreated: pushResult.filesCreated,
          errors: pushResult.errors.slice(0, 5),
        }, null, 2))

        if (pushResult.success) {
          github_url = `https://github.com/${username}/${repoName}`;
          files_pushed = pushResult.filesCreated;
        } else {
          console.warn('[generate-code] GitHub push failed:', pushResult.errors);
        }

        // Vercel deploy
        if (auto_deploy && vercelToken && github_url) {
          try {
            const { deployFromGitHub } = await import('@/lib/vercel');
            const deployResult = await deployFromGitHub(vercelToken, repoName, `${username}/${repoName}`);
            console.log('[generate-code] Vercel deploy result:', JSON.stringify(deployResult, null, 2))
            // Use the actual deploymentUrl (real build URL) — fallback to projectUrl (alias, may 404 until first build succeeds)
            if (deployResult.success && deployResult.deploymentUrl) {
              vercel_url = deployResult.deploymentUrl;
            } else if (deployResult.success && deployResult.projectUrl) {
              vercel_url = deployResult.projectUrl;
              console.warn('[generate-code] Using projectUrl as vercel_url — alias may 404 until first successful build')
            }
          } catch (deployError) {
            console.error('[generate-code] Vercel deploy error:', deployError);
          }
        } else if (auto_deploy && !vercelToken) {
          console.warn('[generate-code] auto_deploy requested but vercelToken missing — connect Vercel via OAuth')
        }
      } else {
        console.warn('[generate-code] getGitHubUsername returned null — token may be invalid or expired')
      }
    } else if (github_repo && !githubToken) {
      console.warn('[generate-code] github_repo provided but no github_token cookie — user must connect GitHub via OAuth first')
    }

    return NextResponse.json({
      success: true,
      mode: generationMode,
      files_generated: fileCount,
      files_list: Object.keys(generatedFiles),
      files_pushed,
      github_url,
      vercel_url,
      files: !github_repo ? generatedFiles : undefined,
      ...assemblyMeta,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[generate-code] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Code generation failed' },
      { status: 500 }
    );
  }
}
