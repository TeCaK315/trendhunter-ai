import { NextRequest, NextResponse } from 'next/server';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

/**
 * /api/generate-code
 *
 * Генерация полноценного кода проекта через Claude API
 * На основе спецификации от META-агента создаёт рабочий код
 */

interface ProjectSpec {
  project_name: string;
  one_liner: string;
  problem_statement: string;
  solution_overview: string;
  mvp_specification: {
    core_features: Array<{
      name: string;
      description: string;
      priority: string;
      user_story: string;
      acceptance_criteria: string[];
    }>;
    tech_stack: Array<{
      category: string;
      recommendation: string;
      reasoning: string;
    }>;
    architecture: string;
  };
  target_audience?: string;
  main_pain?: string;
}

interface GeneratedFiles {
  [path: string]: string;
}

// Системный промпт для Claude
const SYSTEM_PROMPT = `Ты - эксперт Full-Stack разработчик, специализирующийся на создании MVP продуктов.

Твоя задача - сгенерировать ПОЛНЫЙ, РАБОЧИЙ код проекта на основе спецификации.

## Технические требования:
- Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Компоненты: React Server Components где возможно, Client Components только где нужна интерактивность
- Styling: Tailwind CSS с кастомными цветами для бренда
- Никаких внешних UI библиотек кроме lucide-react для иконок
- Код должен компилироваться БЕЗ ОШИБОК

## Структура ответа:
Верни JSON объект где ключи - пути к файлам, значения - содержимое файлов.

Пример:
{
  "package.json": "...",
  "src/app/page.tsx": "...",
  "src/app/layout.tsx": "...",
  "src/components/Header.tsx": "..."
}

## Обязательные файлы:
1. package.json - с правильными dependencies
2. tsconfig.json
3. tailwind.config.ts
4. postcss.config.js
5. next.config.js
6. src/app/globals.css - с @tailwind директивами
7. src/app/layout.tsx - корневой layout
8. src/app/page.tsx - главная страница с ПОЛНЫМ функционалом MVP

## Критически важно:
- НЕ используй заглушки типа "// TODO" или "placeholder"
- Каждая фича из спецификации должна быть РЕАЛИЗОВАНА
- Код должен быть production-ready
- Добавь хорошую типизацию TypeScript
- Добавь обработку ошибок
- UI должен быть красивым и отзывчивым

Верни ТОЛЬКО JSON без markdown блоков.`;

// Генерация кода через Claude API
async function generateCodeWithClaude(spec: ProjectSpec): Promise<GeneratedFiles> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const userPrompt = `Создай полноценный MVP проект на основе этой спецификации:

## Название проекта
${spec.project_name}

## Описание (one-liner)
${spec.one_liner}

## Проблема
${spec.problem_statement}

## Решение
${spec.solution_overview}

## Целевая аудитория
${spec.target_audience || 'Широкая аудитория'}

## Главная боль пользователей
${spec.main_pain || spec.problem_statement}

## Core Features (ДОЛЖНЫ БЫТЬ РЕАЛИЗОВАНЫ):
${spec.mvp_specification.core_features.map((f, i) => `
${i + 1}. **${f.name}** (${f.priority})
   - Описание: ${f.description}
   - User Story: ${f.user_story}
   - Критерии приёмки: ${f.acceptance_criteria.join('; ')}
`).join('\n')}

## Tech Stack
${spec.mvp_specification.tech_stack.map(t => `- ${t.category}: ${t.recommendation} (${t.reasoning})`).join('\n')}

## Архитектура
${spec.mvp_specification.architecture}

---

ВАЖНО: Реализуй ВСЕ фичи из списка выше. Не пропускай ни одну.
Код должен компилироваться и работать сразу после npm install && npm run dev.

Верни JSON с файлами проекта.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Claude API error:', error);
    throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';

  // Парсим JSON из ответа
  try {
    // Пробуем найти JSON в ответе
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (parseError) {
    console.error('Failed to parse Claude response:', parseError);
    console.error('Raw response:', content.substring(0, 500));
    throw new Error('Failed to parse generated code');
  }
}

// Добавляем файлы в GitHub репозиторий
async function addFilesToGitHub(
  token: string,
  owner: string,
  repo: string,
  files: GeneratedFiles
): Promise<{ success: boolean; filesCreated: number; errors: string[] }> {
  const errors: string[] = [];
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // Небольшая задержка
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Получаем текущий коммит
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

    // Создаём blob для каждого файла
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

    // Получаем текущее дерево
    const commitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${baseCommitSha}`,
      { headers }
    );

    if (!commitResponse.ok) {
      return { success: false, filesCreated: 0, errors: ['Could not get base commit'] };
    }

    const commitData = await commitResponse.json();
    const baseTreeSha = commitData.tree.sha;

    // Создаём новое дерево с базовым деревом
    const treeResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree: blobs.map(b => ({
            path: b.path,
            mode: '100644',
            type: 'blob',
            sha: b.sha,
          })),
        }),
      }
    );

    if (!treeResponse.ok) {
      const error = await treeResponse.json();
      return { success: false, filesCreated: 0, errors: [`Tree creation failed: ${error.message}`] };
    }

    const tree = await treeResponse.json();

    // Создаём коммит
    const newCommitResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: `🚀 Generated MVP code via Claude API

- ${blobs.length} files added/updated
- Ready for deployment
- Run: npm install && npm run dev`,
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

    // Обновляем ref
    const refUpdateResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          sha: newCommit.sha,
          force: true,
        }),
      }
    );

    if (!refUpdateResponse.ok) {
      const error = await refUpdateResponse.json();
      errors.push(`Failed to update branch: ${error.message}`);
    }

    return {
      success: errors.length === 0,
      filesCreated: blobs.length,
      errors,
    };

  } catch (error) {
    console.error('GitHub API error:', error);
    return {
      success: false,
      filesCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    };
  }
}

// Получение имени пользователя GitHub
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
  try {
    const body = await request.json();
    const { spec, github_repo, auto_deploy } = body;

    // Получаем токены
    const githubToken = request.cookies.get('github_token')?.value;
    const vercelToken = request.cookies.get('vercel_token')?.value;

    if (!spec) {
      return NextResponse.json(
        { success: false, error: 'Project specification required' },
        { status: 400 }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'Code generation not configured (missing API key)' },
        { status: 503 }
      );
    }

    console.log(`Generating code for: ${spec.project_name}`);
    console.log(`Features to implement: ${spec.mvp_specification?.core_features?.length || 0}`);

    // Генерируем код через Claude
    const generatedFiles = await generateCodeWithClaude(spec);
    const fileCount = Object.keys(generatedFiles).length;

    console.log(`Generated ${fileCount} files`);

    let github_url: string | undefined;
    let files_pushed = 0;
    let vercel_url: string | undefined;

    // Если указан GitHub репозиторий, добавляем файлы
    if (github_repo && githubToken) {
      const username = await getGitHubUsername(githubToken);

      if (username) {
        // Извлекаем имя репо из URL или используем как есть
        let repoName = github_repo;
        if (github_repo.includes('github.com')) {
          const match = github_repo.match(/github\.com\/[^/]+\/([^/]+)/);
          if (match) repoName = match[1].replace(/\.git$/, '');
        }

        console.log(`Pushing to GitHub: ${username}/${repoName}`);

        const pushResult = await addFilesToGitHub(
          githubToken,
          username,
          repoName,
          generatedFiles
        );

        if (pushResult.success) {
          github_url = `https://github.com/${username}/${repoName}`;
          files_pushed = pushResult.filesCreated;
          console.log(`Pushed ${files_pushed} files to ${github_url}`);
        } else {
          console.warn('Failed to push to GitHub:', pushResult.errors);
        }

        // Автоматический деплой на Vercel
        if (auto_deploy && vercelToken && github_url) {
          try {
            const { deployFromGitHub } = await import('@/lib/vercel');
            const repoPath = `${username}/${repoName}`;

            console.log(`Deploying to Vercel: ${repoPath}`);

            const deployResult = await deployFromGitHub(vercelToken, repoName, repoPath);

            if (deployResult.success) {
              vercel_url = deployResult.projectUrl;
              console.log(`Vercel deployment started: ${vercel_url}`);
            }
          } catch (deployError) {
            console.error('Vercel deployment error:', deployError);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      files_generated: fileCount,
      files_list: Object.keys(generatedFiles),
      files_pushed,
      github_url,
      vercel_url,
      // Возвращаем сами файлы если нет GitHub
      files: !github_repo ? generatedFiles : undefined,
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Generate code API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Code generation failed'
      },
      { status: 500 }
    );
  }
}
