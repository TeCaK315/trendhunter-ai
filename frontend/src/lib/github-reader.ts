/**
 * GitHub Reader — утилиты для чтения репозиториев через GitHub API
 *
 * Используется META Agent итеративным чатом для понимания структуры проекта
 * перед генерацией нового кода.
 */

// ─── Types ───

export interface RepoTreeEntry {
  path: string;
  mode: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
}

export interface RepoTree {
  sha: string;
  entries: RepoTreeEntry[];
  truncated: boolean;
}

export interface FileContent {
  path: string;
  content: string;
  sha: string;
  size: number;
}

const GITHUB_API = 'https://api.github.com';

function headers(token: string) {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
  };
}

// ─── Core Functions ───

/**
 * Get full recursive tree of a repo.
 * Tries 'main' first, falls back to 'master'.
 */
export async function getRepoTree(
  token: string,
  owner: string,
  repo: string,
  branch?: string,
): Promise<RepoTree> {
  const branches = branch ? [branch] : ['main', 'master'];

  for (const b of branches) {
    // Get branch ref
    const refRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/refs/heads/${b}`,
      { headers: headers(token) },
    );
    if (!refRes.ok) continue;

    const refData = await refRes.json();
    const commitSha = refData.object.sha;

    // Get commit to find tree SHA
    const commitRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/commits/${commitSha}`,
      { headers: headers(token) },
    );
    if (!commitRes.ok) continue;

    const commitData = await commitRes.json();
    const treeSha = commitData.tree.sha;

    // Get recursive tree
    const treeRes = await fetch(
      `${GITHUB_API}/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
      { headers: headers(token) },
    );
    if (!treeRes.ok) {
      throw new Error(`Failed to get tree: ${treeRes.status}`);
    }

    const treeData = await treeRes.json();

    if (treeData.truncated) {
      console.warn('[github-reader] Tree is truncated (>100k entries)');
    }

    return {
      sha: treeSha,
      entries: (treeData.tree || []).filter((e: RepoTreeEntry) => e.type === 'blob'),
      truncated: treeData.truncated || false,
    };
  }

  throw new Error(`Could not find branch for ${owner}/${repo}`);
}

/**
 * Read content of a single file by path.
 * Decodes base64 content to UTF-8.
 */
export async function getFileContent(
  token: string,
  owner: string,
  repo: string,
  path: string,
): Promise<FileContent> {
  const res = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
    { headers: headers(token) },
  );

  if (!res.ok) {
    throw new Error(`Failed to read ${path}: ${res.status}`);
  }

  const data = await res.json();

  if (data.type !== 'file') {
    throw new Error(`${path} is not a file`);
  }

  const content = Buffer.from(data.content, 'base64').toString('utf-8');

  return {
    path: data.path,
    content,
    sha: data.sha,
    size: data.size,
  };
}

/**
 * Read multiple files in parallel (batched, max 10 concurrent).
 * Silently skips files that fail to read.
 */
export async function getFilesContent(
  token: string,
  owner: string,
  repo: string,
  paths: string[],
): Promise<FileContent[]> {
  const results: FileContent[] = [];
  const batchSize = 10;

  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const promises = batch.map(async (path) => {
      try {
        return await getFileContent(token, owner, repo, path);
      } catch {
        console.warn(`[github-reader] Skipping ${path}`);
        return null;
      }
    });

    const batchResults = await Promise.all(promises);
    for (const r of batchResults) {
      if (r) results.push(r);
    }
  }

  return results;
}

// ─── Smart File Selection ───

/** Files that are ALWAYS read for context */
const ALWAYS_READ = [
  'package.json',
  'tsconfig.json',
  'src/app/layout.tsx',
  '.env.example',
];

/** Patterns for ALWAYS_READ (glob-like matching) */
const ALWAYS_READ_PATTERNS = [
  /^tailwind\.config\./,
  /^next\.config\./,
];

/** Keyword → file path patterns mapping */
const KEYWORD_FILE_MAP: Array<{ keywords: string[]; patterns: RegExp[] }> = [
  {
    keywords: ['page', 'страниц', 'route', 'маршрут', 'навигац'],
    patterns: [/src\/app\/.*\/page\.tsx$/, /src\/app\/.*\/layout\.tsx$/],
  },
  {
    keywords: ['api', 'endpoint', 'эндпоинт', 'backend', 'бэкенд', 'серверн'],
    patterns: [/src\/app\/api\/.*\/route\.ts$/],
  },
  {
    keywords: ['component', 'компонент', 'ui', 'кнопк', 'форм', 'карточ'],
    patterns: [/src\/components\/.*\.(tsx|ts)$/],
  },
  {
    keywords: ['auth', 'авторизац', 'аутентификац', 'login', 'вход', 'регистрац'],
    patterns: [/middleware\.ts$/, /src\/app\/api\/auth\//, /src\/lib\/supabase\//],
  },
  {
    keywords: ['database', 'база данных', 'supabase', 'таблиц', 'миграц', 'схем'],
    patterns: [/migrations\//, /\.env\.example$/, /src\/lib\/supabase\//],
  },
  {
    keywords: ['style', 'стил', 'design', 'дизайн', 'theme', 'тем', 'css', 'цвет'],
    patterns: [/globals\.css$/, /tailwind\.config\./, /src\/app\/layout\.tsx$/],
  },
  {
    keywords: ['stripe', 'оплат', 'подписк', 'billing', 'payment'],
    patterns: [/stripe/, /billing/, /subscription/],
  },
  {
    keywords: ['email', 'почт', 'письм', 'resend', 'notify', 'уведомлен'],
    patterns: [/email/, /resend/, /notification/],
  },
  {
    keywords: ['lib', 'утилит', 'helper', 'хелпер', 'util'],
    patterns: [/src\/lib\/.*\.(ts|tsx)$/],
  },
];

/**
 * Smart file selection: given a repo tree and user's message,
 * determine which files to read for context.
 *
 * Budget: max 15 files. Skips files >50KB.
 */
export function selectRelevantFiles(
  tree: RepoTreeEntry[],
  userMessage: string,
): string[] {
  const MAX_FILES = 15;
  const MAX_FILE_SIZE = 50_000; // 50KB

  const selected = new Set<string>();
  const msgLower = userMessage.toLowerCase();

  // 1. Always-read files
  for (const entry of tree) {
    if (entry.size && entry.size > MAX_FILE_SIZE) continue;

    if (ALWAYS_READ.includes(entry.path)) {
      selected.add(entry.path);
    }
    for (const pattern of ALWAYS_READ_PATTERNS) {
      if (pattern.test(entry.path)) {
        selected.add(entry.path);
      }
    }
  }

  // 2. Keyword-matched files
  for (const mapping of KEYWORD_FILE_MAP) {
    const matches = mapping.keywords.some(kw => msgLower.includes(kw));
    if (!matches) continue;

    for (const entry of tree) {
      if (selected.size >= MAX_FILES) break;
      if (entry.size && entry.size > MAX_FILE_SIZE) continue;

      for (const pattern of mapping.patterns) {
        if (pattern.test(entry.path)) {
          selected.add(entry.path);
          break;
        }
      }
    }
  }

  // 3. If still under budget, add key app files
  if (selected.size < MAX_FILES) {
    const priorities = [
      /src\/app\/dashboard\/page\.tsx$/,
      /src\/app\/page\.tsx$/,
      /src\/components\/Header\./,
      /src\/components\/Footer\./,
      /src\/lib\/usage\./,
    ];
    for (const pattern of priorities) {
      if (selected.size >= MAX_FILES) break;
      for (const entry of tree) {
        if (pattern.test(entry.path) && (!entry.size || entry.size <= MAX_FILE_SIZE)) {
          selected.add(entry.path);
          break;
        }
      }
    }
  }

  return Array.from(selected);
}

/**
 * Extract owner and repo from GitHub URL.
 * Supports: https://github.com/owner/repo, https://github.com/owner/repo.git
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/.]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2] };
}
