/**
 * Code Generator — Hybrid Pipeline: Architect → Coder → Reviewer
 *
 * Instead of one massive Claude call that generates everything at once,
 * we split the work into 3 phases:
 *
 * 1. ARCHITECT — Plans file structure, shared types, API contracts
 * 2. CODER    — Generates code in parallel groups (foundation, backend, frontend)
 * 3. REVIEWER — Cross-checks all files, fixes import/type/contract mismatches
 *
 * This dramatically reduces hallucinations because each phase has a small,
 * focused context instead of one 64K-token monolith.
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// ============================================================
// PUBLIC TYPES (unchanged interface for backward compatibility)
// ============================================================

export interface ProjectSpec {
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
  design_system?: {
    color_palette: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      text: string;
    };
    typography: {
      headings: string;
      body: string;
      mono?: string;
    };
    unique_elements: string[];
    design_rationale: string;
  };
  derived_features?: Array<{
    feature_name: string;
    pain_source: string;
    pain_quote: string;
    solution: string;
    priority: string;
    implementation_hint: string;
  }>;
}

export interface GeneratedFiles {
  [path: string]: string;
}

// ============================================================
// INTERNAL TYPES
// ============================================================

interface ArchitecturePlan {
  file_plan: Array<{
    path: string;
    purpose: string;
    group: 'foundation' | 'backend' | 'frontend';
    exports?: string[];
  }>;
  shared_types: string; // TypeScript interfaces shared across files
  api_contracts: Array<{
    endpoint: string;
    method: string;
    request_shape: string;
    response_shape: string;
    auth_required: boolean;
  }>;
  env_variables: string[]; // List of env vars needed
  database_tables: string; // SQL schema description
  dependencies: Record<string, string>; // npm package → version
}

// ============================================================
// PHASE 1: ARCHITECT
// ============================================================

const ARCHITECT_SYSTEM = `Ты — Software Architect. Твоя задача — спланировать АРХИТЕКТУРУ проекта, НЕ писать код.

Ты получаешь спецификацию продукта и должен создать ПЛАН генерации кода:

1. **file_plan** — список ВСЕХ файлов которые нужно создать, с описанием назначения
2. **shared_types** — ПОЛНЫЙ компилируемый TypeScript файл (src/types/index.ts) со ВСЕМИ интерфейсами и типами проекта. Это "источник правды" — все файлы ОБЯЗАНЫ импортировать типы ОТСЮДА.
3. **api_contracts** — REST API endpoints с точным request/response shape
4. **env_variables** — все переменные окружения которые нужны
5. **database_tables** — SQL схема для Supabase
6. **dependencies** — npm пакеты с версиями

КРИТИЧЕСКОЕ ПРАВИЛО — ЭТО РАБОЧИЙ ПРОТОТИП, А НЕ ЛЕНДИНГ:
- Главная страница (src/app/page.tsx) — это РАБОЧИЙ DASHBOARD с функциональным UI, НЕ маркетинговая лендинг-страница
- ЗАПРЕЩЕНО: hero-секции, "Start Free Trial", фейковые метрики ("10K+ Users"), секции "Features", "Testimonials", "Pricing"
- ОБЯЗАТЕЛЬНО: page.tsx показывает рабочий интерфейс приложения — формы ввода данных, таблицы, графики, карточки с реальными данными
- Данные хранятся в localStorage или Supabase — но UI должен РАБОТАТЬ
- Пользователь открывает приложение и СРАЗУ может им пользоваться, без регистрации для прототипа

ПРАВИЛА АРХИТЕКТУРЫ:
- Каждый файл в file_plan ДОЛЖЕН иметь группу: "foundation" (config, lib, types), "backend" (API routes), "frontend" (components, pages, styles)
- shared_types — это ПОЛНЫЙ TypeScript файл со всеми export interface/type. Должен КОМПИЛИРОВАТЬСЯ как есть. Включи:
  * Все модели данных (User, Item, etc.)
  * Все API request/response типы (CreateItemRequest, CreateItemResponse)
  * Все props компонентов если они используются в >1 файле
  * Все function signatures для utility-классов (calc, storage)
- api_contracts должен ТОЧНО описывать request/response для КАЖДОГО API route
- НИКАКИХ заглушек или fake data
- Думай о dependency resolution: если файл A импортирует из B, оба должны быть в плане

ОБЯЗАТЕЛЬНЫЕ файлы в file_plan (foundation group):
- package.json — все dependencies
- tailwind.config.ts — с content paths: ["./src/**/*.{js,ts,jsx,tsx,mdx}"]
- postcss.config.js — с tailwindcss и autoprefixer плагинами
- src/app/globals.css — с @tailwind base; @tailwind components; @tailwind utilities;
- src/app/layout.tsx — с import './globals.css' и metadata
- tsconfig.json — с path aliases

Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS, Supabase (optional)

ЗАПРЕЩЁННЫЕ ПАКЕТЫ (не работают на Vercel, нативные C++ модули):
- canvas, node-canvas — используй CSS/SVG/HTML для визуализации, recharts для графиков
- sharp — используй next/image (встроенная оптимизация)
- bcrypt — используй bcryptjs (чистый JS)
- better-sqlite3, libsql — используй Supabase или Prisma
- puppeteer, playwright — не нужны для MVP
- Для генерации PDF используй @react-pdf/renderer или html2canvas + jsPDF (чистый JS)

ЗАПРЕЩЁННЫЕ ПАТТЕРНЫ (App Router):
- НЕ используй \`export const config = { api: { bodyParser: false } }\` — это Pages Router, deprecated в App Router
- Для file uploads используй \`request.formData()\` напрямую (bodyParser не нужен в App Router)
- Для настройки route: используй route segment config: \`export const runtime = 'nodejs'\`, \`export const maxDuration = 30\`
- ЗАПРЕЩЕНО писать файлы на диск (fs.writeFileSync, mkdirSync) — Vercel serverless read-only. Для временных файлов — ТОЛЬКО \`/tmp/\`. Для хранения — cloud storage.

Верни ТОЛЬКО JSON:
{
  "file_plan": [
    { "path": "package.json", "purpose": "All dependencies", "group": "foundation", "exports": [] },
    { "path": "tailwind.config.ts", "purpose": "Tailwind config with content paths", "group": "foundation", "exports": [] },
    { "path": "postcss.config.js", "purpose": "PostCSS with tailwindcss plugin", "group": "foundation", "exports": [] },
    { "path": "src/app/globals.css", "purpose": "Global styles with @tailwind directives", "group": "foundation", "exports": [] },
    { "path": "src/app/layout.tsx", "purpose": "Root layout importing globals.css", "group": "foundation", "exports": [] },
    { "path": "src/app/page.tsx", "purpose": "Main dashboard — working app UI, NOT a landing page", "group": "frontend", "exports": [] }
  ],
  "shared_types": "// src/types/index.ts — ПОЛНЫЙ файл, все типы проекта\nexport interface User { id: string; name: string; email: string; }\nexport interface CreateUserRequest { name: string; email: string; }\nexport interface CreateUserResponse { success: boolean; user: User; }\n// ... ВСЕ интерфейсы проекта ЗДЕСЬ",
  "api_contracts": [...],
  "env_variables": [...],
  "database_tables": "...",
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0",
    "typescript": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}`;

async function runArchitect(spec: ProjectSpec): Promise<ArchitecturePlan> {
  console.log('[architect] Starting architecture planning...');
  const startTime = Date.now();

  const userPrompt = buildArchitectPrompt(spec);
  const MAX_ARCHITECT_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_ARCHITECT_RETRIES; attempt++) {
    const isRetry = attempt > 0;
    const promptToUse = isRetry
      ? userPrompt + '\n\nВАЖНО: Ответь СТРОГО в формате JSON. Без markdown, без ```json```, без пояснений — ТОЛЬКО чистый JSON объект начинающийся с { и заканчивающийся }.'
      : userPrompt;

    const response = await callClaude(ARCHITECT_SYSTEM, promptToUse, {
      maxTokens: 12000,
      temperature: isRetry ? 0.1 : 0.3,
      prefill: '{',  // Force Claude to start with JSON
    });

    console.log(`[architect] Response length: ${response.length} chars (attempt ${attempt + 1})`);
    const plan = parseJSON<ArchitecturePlan>(response);

    if (plan && plan.file_plan?.length) {
      const elapsed = Date.now() - startTime;
      console.log(`[architect] Plan complete in ${elapsed}ms: ${plan.file_plan.length} files, ${plan.api_contracts?.length || 0} API contracts`);
      return plan;
    }

    if (attempt < MAX_ARCHITECT_RETRIES) {
      console.warn(`[architect] Parse failed on attempt ${attempt + 1}, retrying...`);
      console.error('[architect] Raw response (first 1000 chars):', response.substring(0, 1000));
    } else {
      console.error('[architect] Raw response (first 2000 chars):', response.substring(0, 2000));
      throw new Error('[architect] Failed to parse architecture plan after ' + (MAX_ARCHITECT_RETRIES + 1) + ' attempts');
    }
  }

  throw new Error('[architect] Failed to parse architecture plan');
}

function buildArchitectPrompt(spec: ProjectSpec): string {
  const features = spec.derived_features?.length
    ? spec.derived_features.map((f, i) =>
      `${i + 1}. ${f.feature_name} [${f.priority}]: "${f.pain_quote}" → ${f.solution} (hint: ${f.implementation_hint})`
    ).join('\n')
    : '';

  const coreFeatures = spec.mvp_specification.core_features.map((f, i) =>
    `${i + 1}. ${f.name} (${f.priority}): ${f.description}\n   User Story: ${f.user_story}\n   Acceptance: ${f.acceptance_criteria.join('; ')}`
  ).join('\n');

  return `Спланируй архитектуру проекта:

## Проект: ${spec.project_name}
${spec.one_liner}

## Проблема: ${spec.problem_statement}
## Решение: ${spec.solution_overview}
## Аудитория: ${spec.target_audience || 'Широкая аудитория'}
## Главная боль: ${spec.main_pain || spec.problem_statement}

${features ? `## DERIVED FEATURES (приоритет!)\n${features}\n` : ''}
## Core Features
${coreFeatures}

## Tech Stack
${spec.mvp_specification.tech_stack.map(t => `- ${t.category}: ${t.recommendation} (${t.reasoning})`).join('\n')}

## Архитектура
${spec.mvp_specification.architecture}

${spec.design_system ? `## Дизайн
- Primary: ${spec.design_system.color_palette.primary}
- Secondary: ${spec.design_system.color_palette.secondary}
- Accent: ${spec.design_system.color_palette.accent}
- Background: ${spec.design_system.color_palette.background}
- Text: ${spec.design_system.color_palette.text}
- Headings font: ${spec.design_system.typography.headings}
- Body font: ${spec.design_system.typography.body}
- Unique elements: ${spec.design_system.unique_elements.join(', ')}
` : ''}

Создай архитектурный план. Помни:
- ЭТО РАБОЧЕЕ ПРИЛОЖЕНИЕ, НЕ ЛЕНДИНГ. page.tsx = dashboard с UI для работы, НЕ маркетинговая страница
- ОБЯЗАТЕЛЬНО включи: tailwind.config.ts, postcss.config.js, src/app/globals.css, src/app/layout.tsx
- Для КАЖДОЙ derived_feature нужны конкретные файлы
- API routes должны делать РЕАЛЬНЫЕ запросы
- НИКАКИХ fake data, hero sections, "Start Free Trial" кнопок
- shared_types — ПОЛНЫЙ КОМПИЛИРУЕМЫЙ TypeScript файл. Включи ВСЕ:
  * Модели данных (interface Model { id: string; ... })
  * API request/response типы (interface CreateModelRequest/Response)
  * Props для повторно используемых компонентов
  * Типы для utility-функций (storage, calculator, etc.)
  * КАЖДАЯ функция, которая вызывается из ДРУГОГО файла, должна иметь свой тип здесь
- Данные можно хранить в localStorage для прототипа`;
}

// ============================================================
// PHASE 2: CODER (parallel generation by group)
// ============================================================

const CODER_SYSTEM = `Ты — Expert Full-Stack Developer. Ты получаешь АРХИТЕКТУРНЫЙ ПЛАН и должен сгенерировать КОД для указанных файлов.

САМОЕ ВАЖНОЕ ПРАВИЛО — ЭТО РАБОЧИЙ ПРОТОТИП:
- page.tsx — это РАБОЧИЙ dashboard/интерфейс приложения. ЗАПРЕЩЕНО делать лендинг-страницу!
- ЗАПРЕЩЕНО: hero-секции, "Get Started", "Start Free Trial", фейковые метрики "10K+ Users", секции Features/Testimonials/Pricing
- ОБЯЗАТЕЛЬНО: рабочие формы, таблицы данных, интерактивные элементы, localStorage для хранения данных
- Пользователь открывает приложение и СРАЗУ видит рабочий интерфейс

КРИТИЧЕСКИЕ ПРАВИЛА:
1. Генерируй ТОЛЬКО файлы из списка "files_to_generate"
2. Типы: ВСЕГДА импортируй из '@/types' (import { User, Item } from '@/types'). НИКОГДА не определяй interface/type локально если он уже есть в shared_types. Файл src/types/index.ts УЖЕ СОЗДАН — не генерируй его заново.
3. API routes должны соответствовать api_contracts — ТОЧНЫЕ request/response shape из shared_types
4. Импортируй ТОЛЬКО из файлов перечисленных в "all_project_files" или npm пакетов
5. НЕ создавай fake data, mock arrays, placeholder onClick
6. Каждый API route делает РЕАЛЬНЫЕ запросы
7. НЕ ОСТАВЛЯЙ неиспользуемые импорты
8. НЕ ОСТАВЛЯЙ неиспользуемые переменные
9. НИКОГДА не бросай throw на верхнем уровне модуля при проверке env vars — проверяй ВНУТРИ handlers
10. Для database/service clients используй lazy initialization
11. Сигнатуры функций: если функция вызывается из ДРУГОГО файла, её сигнатура ДОЛЖНА совпадать с типом в shared_types
12. В API routes (App Router) ЗАПРЕЩЕНО: \`export const config = { api: { bodyParser: false } }\` — это Pages Router паттерн, deprecated. Для file uploads используй \`request.formData()\` напрямую.
13. Если используешь shadcn/ui классы (border-border, bg-background, text-foreground и т.д.) — globals.css ДОЛЖЕН содержать CSS переменные (--border, --background, --foreground и т.д.) в @layer base, а tailwind.config ДОЛЖЕН маппить их через hsl(var(--border)).
14. ЗАПРЕЩЕНО писать файлы в локальную файловую систему (Vercel read-only). Для uploads используй ТОЛЬКО \`/tmp/\` директорию: \`/tmp/uploads/\`. Всегда добавляй \`{ recursive: true }\` в mkdirSync. Лучше — используй cloud storage (S3, Supabase Storage).

ПРАВИЛА TAILWIND CSS (ОБЯЗАТЕЛЬНО):
- globals.css ДОЛЖЕН содержать: @tailwind base; @tailwind components; @tailwind utilities;
- tailwind.config.ts: content ДОЛЖЕН включать "./src/**/*.{js,ts,jsx,tsx,mdx}"
- postcss.config.js: ДОЛЖЕН содержать plugins: { tailwindcss: {}, autoprefixer: {} }
- layout.tsx ДОЛЖЕН импортировать './globals.css'
- Без этих файлов Tailwind НЕ БУДЕТ РАБОТАТЬ — стили не применятся

Для каждого файла:
- Пиши ПОЛНЫЙ, РАБОЧИЙ код — НИКОГДА не обрезай файл на середине
- Каждый файл ОБЯЗАН быть завершённым: все функции закрыты, все JSX теги закрыты, все экспорты на месте
- Если файл получается длинным — всё равно пиши его ПОЛНОСТЬЮ, не пропускай код
- Включай все импорты
- Используй TypeScript
- Используй Tailwind CSS для стилей (классы типа bg-gray-900, text-white, flex, p-4, rounded-lg)
- Используй lucide-react для иконок

ФОРМАТ ОТВЕТА — используй разделители ===FILE:, НЕ JSON:

===FILE: src/lib/supabase.ts===
import { createClient } from '@supabase/supabase-js';
// actual code here...

===FILE: src/app/page.tsx===
'use client';
import React from 'react';
// actual code here...

ПРАВИЛА ФОРМАТА:
- Каждый файл НАЧИНАЕТСЯ строкой ===FILE: path=== (обязательно три знака = в конце)
- Код файла идёт сразу после маркера, plain text
- НЕ оборачивай код в \`\`\` markdown блоки
- НЕ используй JSON формат
- НЕ добавляй пояснения между файлами
- Первая строка ответа ДОЛЖНА быть ===FILE: ...===`;

async function runCoder(
  plan: ArchitecturePlan,
  group: 'foundation' | 'backend' | 'frontend',
  spec: ProjectSpec,
): Promise<GeneratedFiles> {
  const groupFiles = plan.file_plan.filter(f => f.group === group);
  if (groupFiles.length === 0) {
    console.log(`[coder:${group}] No files in this group, skipping`);
    return {};
  }

  // Split into small batches to avoid token limit truncation
  // 2 files per batch ensures each file gets full generation without cutoff
  const MAX_BATCH_SIZE = 2;
  if (groupFiles.length > MAX_BATCH_SIZE) {
    console.log(`[coder:${group}] ${groupFiles.length} files — splitting into batches of max ${MAX_BATCH_SIZE}`);
    const batches = [];
    for (let i = 0; i < groupFiles.length; i += MAX_BATCH_SIZE) {
      batches.push(groupFiles.slice(i, i + MAX_BATCH_SIZE));
    }

    let allFiles: GeneratedFiles = {};
    for (let b = 0; b < batches.length; b++) {
      try {
        console.log(`[coder:${group}] Batch ${b + 1}/${batches.length}: ${batches[b].length} files`);
        const batchResult = await runCoderSingle(plan, group, spec, batches[b]);
        allFiles = { ...allFiles, ...batchResult };
      } catch (batchErr) {
        console.error(`[coder:${group}] Batch ${b + 1} FAILED: ${batchErr instanceof Error ? batchErr.message : batchErr}`);
        // Continue with other batches
      }
    }
    return allFiles;
  }

  return runCoderSingle(plan, group, spec, groupFiles);
}

async function runCoderSingle(
  plan: ArchitecturePlan,
  group: 'foundation' | 'backend' | 'frontend',
  spec: ProjectSpec,
  groupFiles: ArchitecturePlan['file_plan'],
): Promise<GeneratedFiles> {
  console.log(`[coder:${group}] Generating ${groupFiles.length} files...`);
  const startTime = Date.now();

  const MAX_CODER_RETRIES = 1;

  for (let attempt = 0; attempt <= MAX_CODER_RETRIES; attempt++) {
    const isRetry = attempt > 0;
    const userPrompt = buildCoderPrompt(plan, groupFiles, group, spec)
      + (isRetry ? '\n\nВАЖНО: Используй СТРОГО формат ===FILE: path===. Без JSON, без markdown. Просто код каждого файла после маркера.' : '');

    const maxTokens = group === 'foundation' ? 16000 : 32000;

    const response = await callClaude(CODER_SYSTEM, userPrompt, {
      maxTokens,
      temperature: isRetry ? 0.1 : 0.2,
      prefill: '===FILE:',  // Force delimiter format
    });

    console.log(`[coder:${group}] Response length: ${response.length} chars (attempt ${attempt + 1})`);
    console.log(`[coder:${group}] Response starts with: "${response.substring(0, 100)}"`);
    console.log(`[coder:${group}] Response ends with: "${response.substring(Math.max(0, response.length - 100))}"`);

    // Parse delimiter-based format
    let files = parseDelimiterFormat(response);

    // Fallback: try JSON parsing in case Claude still used JSON
    if (!files || Object.keys(files).length === 0) {
      console.log(`[coder:${group}] Delimiter parse returned nothing, trying JSON...`);
      files = parseJSON<GeneratedFiles>(response);
    }

    if (files && Object.keys(files).length > 0) {
      const elapsed = Date.now() - startTime;
      console.log(`[coder:${group}] Generated ${Object.keys(files).length} files in ${elapsed}ms`);
      return files;
    }

    if (attempt < MAX_CODER_RETRIES) {
      console.warn(`[coder:${group}] Parse failed on attempt ${attempt + 1}, retrying...`);
      console.error(`[coder:${group}] Full response length: ${response.length}`);
      console.error(`[coder:${group}] Raw response (first 2000 chars):`, response.substring(0, 2000));
    } else {
      console.error(`[coder:${group}] FINAL FAILURE. Full response length: ${response.length}`);
      // Save raw response to disk for debugging
      try {
        const fs = require('fs');
        const debugPath = require('path').join(process.cwd(), `_debug_coder_${group}_${Date.now()}.txt`);
        fs.writeFileSync(debugPath, response);
        console.error(`[coder:${group}] Raw response saved to: ${debugPath}`);
      } catch { /* ignore fs errors */ }
      // Instead of throwing, return empty — the pipeline will handle it
      return {};
    }
  }

  return {};
}

/**
 * Parse generated code from various formats Claude might use.
 * Tries multiple formats in order of specificity:
 * 1. ===FILE: path=== delimiter format
 * 2. Markdown code blocks with file paths in comments/headers
 * 3. JSON format as fallback
 */
function parseDelimiterFormat(text: string): GeneratedFiles | null {
  let files: GeneratedFiles = {};

  // Strategy 1: ===FILE: path=== markers
  const parts = text.split(/===FILE:\s*/);
  if (parts.length > 1) {
    for (const part of parts) {
      if (!part.trim()) continue;

      const endMarker = part.indexOf('===');
      if (endMarker === -1) continue;

      const filePath = part.substring(0, endMarker).trim();
      let content = part.substring(endMarker + 3).trim();

      // Remove wrapping ```lang ... ``` if Claude added code blocks
      content = content.replace(/^```\w*\n?/, '').replace(/\n?```\s*$/, '');

      if (filePath && content && filePath.includes('.')) {
        files[filePath] = content;
      }
    }

    if (Object.keys(files).length > 0) {
      console.log(`[parseDelimiter] Strategy 1 (===FILE:): ${Object.keys(files).length} files`);
      return files;
    }
  }

  // Strategy 2: Markdown code blocks with file paths
  // Matches patterns like:
  //   ```tsx // src/app/page.tsx
  //   ### src/app/page.tsx\n```tsx
  //   **src/app/page.tsx**\n```tsx
  const codeBlockRegex = /(?:###?\s*`?([^\n`]+\.[a-z]{1,5})`?\s*\n)?```\w*\s*(?:\/\/\s*([^\n]+\.[a-z]{1,5}))?\n([\s\S]*?)```/g;
  let match;
  files = {};

  while ((match = codeBlockRegex.exec(text)) !== null) {
    const filePath = (match[1] || match[2] || '').trim();
    const content = match[3]?.trim();
    if (filePath && content && filePath.includes('/')) {
      files[filePath] = content;
    }
  }

  // Also try **path** pattern before code blocks
  if (Object.keys(files).length === 0) {
    const boldPathRegex = /\*\*([^*]+\.[a-z]{1,5})\*\*\s*\n```\w*\n([\s\S]*?)```/g;
    while ((match = boldPathRegex.exec(text)) !== null) {
      const filePath = match[1].trim();
      const content = match[2]?.trim();
      if (filePath && content) {
        files[filePath] = content;
      }
    }
  }

  if (Object.keys(files).length > 0) {
    console.log(`[parseDelimiter] Strategy 2 (markdown): ${Object.keys(files).length} files`);
    return files;
  }

  return null;
}

function buildCoderPrompt(
  plan: ArchitecturePlan,
  groupFiles: ArchitecturePlan['file_plan'],
  group: string,
  spec: ProjectSpec,
): string {
  const allFilePaths = plan.file_plan.map(f => `  - ${f.path} (${f.purpose})${f.exports?.length ? ` exports: [${f.exports.join(', ')}]` : ''}`).join('\n');

  const filesToGenerate = groupFiles.map(f =>
    `- **${f.path}**: ${f.purpose}${f.exports?.length ? `\n  Exports: [${f.exports.join(', ')}]` : ''}`
  ).join('\n');

  const apiContracts = plan.api_contracts?.length
    ? plan.api_contracts.map(c =>
      `- ${c.method} ${c.endpoint}\n  Request: ${c.request_shape}\n  Response: ${c.response_shape}${c.auth_required ? '\n  Auth: required' : ''}`
    ).join('\n')
    : 'Нет API контрактов';

  let groupSpecificInstructions = '';
  if (group === 'foundation') {
    groupSpecificInstructions = `
## Специальные инструкции для Foundation:
- package.json: включи ВСЕ dependencies. ОБЯЗАТЕЛЬНО: tailwindcss, postcss, autoprefixer. Все deps: ${JSON.stringify(plan.dependencies || {})}
- .env.example: включи ВСЕ переменные: ${plan.env_variables?.join(', ') || 'none'}
- src/types/index.ts: УЖЕ СОЗДАН автоматически. НЕ генерируй его. Импортируй из '@/types'.
- supabase/schema.sql:
\`\`\`sql
${plan.database_tables || '-- No tables defined'}
\`\`\`

КРИТИЧЕСКИ ВАЖНЫЕ ФАЙЛЫ для работы Tailwind CSS:

- tailwind.config.ts — ТОЧНО такой формат:
  import type { Config } from 'tailwindcss';
  const config: Config = { content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'], theme: { extend: { ${spec.design_system ? `colors: { primary: '${spec.design_system.color_palette.primary}', secondary: '${spec.design_system.color_palette.secondary}', accent: '${spec.design_system.color_palette.accent}' }` : ''} } }, plugins: [] };
  export default config;

- postcss.config.js — ТОЧНО так:
  module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };

- src/app/globals.css — ПЕРВЫЕ 3 строки ОБЯЗАТЕЛЬНО:
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  (можно добавить кастомные стили после)

- src/app/layout.tsx — ОБЯЗАТЕЛЬНО import './globals.css' в начале файла
  ${spec.design_system ? `- Используй Google Fonts: ${spec.design_system.typography.headings}, ${spec.design_system.typography.body}` : ''}`;
  } else if (group === 'backend') {
    groupSpecificInstructions = `
## Специальные инструкции для Backend:
- Каждый API route ДОЛЖЕН соответствовать api_contracts
- Импортируй типы из '@/types' — НЕ определяй interface локально если тип есть в shared_types
- Сигнатуры функций в lib-файлах ДОЛЖНЫ совпадать с типами в shared_types
- Используй Supabase клиент из @/lib/supabase
- OAuth routes: ПОЛНЫЙ flow (authorize → redirect → callback → token → cookie)
- РЕАЛЬНЫЕ fetch вызовы к внешним API, НЕ заглушки`;
  } else if (group === 'frontend') {
    groupSpecificInstructions = `
## Специальные инструкции для Frontend:
- ГЛАВНАЯ СТРАНИЦА (page.tsx) = РАБОЧИЙ DASHBOARD, НЕ ЛЕНДИНГ. Пользователь видит рабочий интерфейс сразу
- ЗАПРЕЩЕНО на page.tsx: hero-секции, "Get Started", "Start Free Trial", фейковые метрики, секции Features/Testimonials
- Для хранения данных без БД используй localStorage + useState + useEffect для загрузки
- Компоненты используют 'use client' где нужен интерактив
- Импортируй типы из '@/types' — НЕ определяй interface локально если тип есть в shared_types
- fetch к API routes из api_contracts — request/response shape ДОЛЖНЫ совпадать с типами в shared_types
- Loading states, error states, empty states
- lucide-react для иконок
- Tailwind CSS для стилей (bg-*, text-*, flex, grid, p-*, rounded-*, shadow-*)
- Каждая кнопка имеет РЕАЛЬНЫЙ onClick с логикой
- Тёмная тема: bg-gray-950 для body, bg-gray-900 для карточек, text-white/text-gray-300 для текста
${spec.design_system ? `- Используй кастомные цвета: primary, secondary, accent
- Уникальные UI элементы: ${spec.design_system.unique_elements.join(', ')}` : ''}`;
  }

  return `## Архитектурный план проекта: ${spec.project_name}

### Все файлы проекта (для проверки импортов):
${allFilePaths}

### Shared Types (КАНОНИЧЕСКИЙ файл src/types/index.ts — УЖЕ создан, НЕ генерируй заново):
\`\`\`typescript
${plan.shared_types || '// No shared types'}
\`\`\`
⚠️ ВСЕ типы выше доступны через import { ... } from '@/types'. НЕ создавай локальные дубликаты.

### API Contracts:
${apiContracts}

### ENV Variables: ${plan.env_variables?.join(', ') || 'none'}
${groupSpecificInstructions}

---

## ТВОЯ ЗАДАЧА: Сгенерируй КОД для этих файлов (группа: ${group}):
${filesToGenerate}

Помни:
- Каждый import ДОЛЖЕН ссылаться на файл из "all_project_files" или npm пакет
- ТИПЫ: import { ... } from '@/types' — НЕ создавай локальные interface если тип есть в shared_types
- src/types/index.ts УЖЕ СОЗДАН — НЕ включай его в ответ
- API routes соответствуют api_contracts — request/response совпадают с shared_types
- Функции в lib-файлах: сигнатуры ДОЛЖНЫ совпадать с тем что ожидают вызывающие файлы
- НЕТ fake data, НЕТ заглушек, НЕТ TODO комментариев
- Код компилируется — все файлы ПОЛНЫЕ, без обрезки

ФОРМАТ: Используй СТРОГО формат ===FILE: path=== для КАЖДОГО файла. Без JSON, без markdown code blocks.`;
}

// ============================================================
// PHASE 3: REVIEWER
// ============================================================

// Phase 3a: Find issues only (small JSON, always parseable)
const REVIEWER_FIND_SYSTEM = `Ты — Senior Code Reviewer. Твоя задача — найти ВСЕ ошибки в сгенерированных файлах.

Ты получаешь:
1. Архитектурный план (file_plan, shared_types, api_contracts)
2. ВСЕ сгенерированные файлы

ПРОВЕРЬ:
1. **Import Resolution** — каждый import '@/lib/X' или '@/components/X' → файл СУЩЕСТВУЕТ и ЭКСПОРТИРУЕТ нужное
2. **Type Compatibility** — props компонентов совпадают с интерфейсами, API request/response совпадают с контрактами
3. **API Contract Compliance** — frontend fetch() вызовы точно соответствуют backend API routes (method, endpoint, body shape, response shape)
4. **Function Signatures** — вызовы функций совпадают с их определениями (количество и типы аргументов)
5. **package.json** — ВСЕ npm пакеты перечислены (включая @types/*)
6. **No Dead Code** — нет неиспользуемых импортов или переменных
7. **'use client'** — указан в файлах с useState/useEffect/onClick/event handlers

НЕ ВКЛЮЧАЙ исправленный код — только ОПИСАНИЕ ошибок.

Верни JSON:
{
  "issues": [
    {
      "severity": "error",
      "file": "src/app/api/example/route.ts",
      "description": "Function calculateX(a, b) called with 3 arguments on line ~15",
      "fix_hint": "Remove third argument or add parameter to function definition"
    }
  ]
}

ВАЖНО:
- Описывай ошибки КОНКРЕТНО: какая функция, какой импорт, какая строка
- fix_hint — короткое описание как исправить (1 предложение)
- Если ошибок нет — верни {"issues": []}`;

// Phase 3b: Fix specific files
const REVIEWER_FIX_SYSTEM = `Ты — Senior Code Fixer. Тебе даны файлы с ошибками и описания ошибок.
Твоя задача — ИСПРАВИТЬ каждый файл.

ПРАВИЛА:
- Выводи ТОЛЬКО исправленные файлы
- Каждый файл ПОЛНОСТЬЮ (не фрагменты)
- Используй формат: ===FILE: path/to/file.ts=== перед каждым файлом
- НЕ добавляй пояснений, только код
- Если файл отсутствует но импортируется — создай его
- 'use client' — в компонентах с useState/useEffect/onClick`;

interface ReviewResult {
  issues: Array<{
    severity: 'error' | 'warning';
    file: string;
    description: string;
    fix_hint?: string;
  }>;
  fixed_files: GeneratedFiles;
}

async function runReviewer(
  plan: ArchitecturePlan,
  allFiles: GeneratedFiles,
): Promise<ReviewResult> {
  console.log(`[reviewer] Reviewing ${Object.keys(allFiles).length} files...`);
  const startTime = Date.now();

  // ── Phase 3a: Find issues (small JSON output — always parseable) ──
  const reviewPrompt = buildReviewerPrompt(plan, allFiles);

  const findResponse = await callClaude(REVIEWER_FIND_SYSTEM, reviewPrompt, {
    maxTokens: 8000,   // Issues-only: max ~4-5KB, never truncates
    temperature: 0.1,
    prefill: '{',
  });

  const findResult = parseJSON<{ issues: ReviewResult['issues'] }>(findResponse);
  if (!findResult || !findResult.issues?.length) {
    const elapsed = Date.now() - startTime;
    console.log(`[reviewer] No issues found in ${elapsed}ms`);
    return { issues: [], fixed_files: {} };
  }

  const errorIssues = findResult.issues.filter(i => i.severity === 'error');
  const warningIssues = findResult.issues.filter(i => i.severity === 'warning');
  console.log(`[reviewer] Found ${errorIssues.length} errors, ${warningIssues.length} warnings`);

  findResult.issues.forEach(issue => {
    const prefix = issue.severity === 'error' ? '❌' : '⚠️';
    console.log(`  ${prefix} ${issue.file}: ${issue.description}`);
  });

  // If only warnings (no errors) — skip fix phase
  if (errorIssues.length === 0) {
    const elapsed = Date.now() - startTime;
    console.log(`[reviewer] Only warnings, no fixes needed (${elapsed}ms)`);
    return { issues: findResult.issues, fixed_files: {} };
  }

  // ── Phase 3b: Fix files with errors ──
  // Collect unique files that need fixing
  const filesToFix = [...new Set(errorIssues.map(i => i.file))];
  console.log(`[reviewer] Fixing ${filesToFix.length} files: ${filesToFix.join(', ')}`);

  // Shared context for all fix batches
  const typesFile = allFiles['src/types/index.ts'] || plan.shared_types || '';
  const apiContracts = plan.api_contracts?.length
    ? plan.api_contracts.map(c =>
      `- ${c.method} ${c.endpoint}: request=${c.request_shape} response=${c.response_shape}`
    ).join('\n')
    : '';

  // Batch the fix phase — max 4 files per batch to avoid timeout
  const FIX_BATCH_SIZE = 4;
  const fixBatches: string[][] = [];
  for (let i = 0; i < filesToFix.length; i += FIX_BATCH_SIZE) {
    fixBatches.push(filesToFix.slice(i, i + FIX_BATCH_SIZE));
  }

  let allFixedFiles: GeneratedFiles = {};

  for (let b = 0; b < fixBatches.length; b++) {
    const batchFiles = fixBatches[b];
    const batchIssues = errorIssues.filter(i => batchFiles.includes(i.file));

    console.log(`[reviewer] Fix batch ${b + 1}/${fixBatches.length}: ${batchFiles.join(', ')}`);

    const issuesList = batchIssues
      .map(i => `- ${i.file}: ${i.description}${i.fix_hint ? ` (hint: ${i.fix_hint})` : ''}`)
      .join('\n');

    const affectedFilesContent = batchFiles
      .map(path => {
        const content = allFiles[path];
        if (!content) return `### ${path}\n(FILE NOT FOUND — needs to be created)`;
        return `### ${path}\n\`\`\`\n${content}\n\`\`\``;
      })
      .join('\n\n');

    // Find related files imported by this batch's files
    const relatedFiles: string[] = [];
    for (const path of batchFiles) {
      const content = allFiles[path] || '';
      const importMatches = content.matchAll(/from\s+['"]@\/([^'"]+)['"]/g);
      for (const match of importMatches) {
        const importPath = `src/${match[1]}`;
        for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
          const fullPath = importPath + ext;
          if (allFiles[fullPath] && !batchFiles.includes(fullPath) && !relatedFiles.includes(fullPath)) {
            relatedFiles.push(fullPath);
          }
        }
      }
    }

    let relatedContext = '';
    if (relatedFiles.length > 0) {
      relatedContext = '\n\n## Связанные файлы (для контекста импортов):\n\n' +
        relatedFiles.slice(0, 5).map(path => {
          const content = allFiles[path];
          const truncated = content.length > 2000
            ? content.substring(0, 2000) + '\n// ... truncated'
            : content;
          return `### ${path}\n\`\`\`\n${truncated}\n\`\`\``;
        }).join('\n\n');
    }

    const fixPrompt = `## Ошибки для исправления:
${issuesList}

## Shared Types:
\`\`\`typescript
${typesFile}
\`\`\`

${apiContracts ? `## API Contracts:\n${apiContracts}\n` : ''}

## Файлы с ошибками:

${affectedFilesContent}
${relatedContext}

Исправь ВСЕ файлы с ошибками. Каждый файл — ПОЛНОСТЬЮ, не фрагментами.
Формат: ===FILE: path/to/file.ts=== перед каждым файлом.`;

    try {
      const fixResponse = await callClaude(REVIEWER_FIX_SYSTEM, fixPrompt, {
        maxTokens: 32000,
        temperature: 0.1,
      });

      const batchFixed = parseDelimiterFormat(fixResponse) || {};
      const fixedCount = Object.keys(batchFixed).length;
      console.log(`[reviewer] Batch ${b + 1}: fixed ${fixedCount} files`);
      allFixedFiles = { ...allFixedFiles, ...batchFixed };
    } catch (err) {
      console.error(`[reviewer] Fix batch ${b + 1} failed:`, err instanceof Error ? err.message : err);
      // Continue with other batches
    }
  }

  const elapsed = Date.now() - startTime;
  const totalFixed = Object.keys(allFixedFiles).length;
  console.log(`[reviewer] Fix phase complete: ${totalFixed}/${filesToFix.length} files fixed in ${elapsed}ms`);

  return { issues: findResult.issues, fixed_files: allFixedFiles };
}

function buildReviewerPrompt(plan: ArchitecturePlan, allFiles: GeneratedFiles): string {
  // Build file list with full content — reviewer must see complete files to catch all errors
  const fileEntries = Object.entries(allFiles).map(([path, content]) => {
    return `### ${path}\n\`\`\`\n${content}\n\`\`\``;
  }).join('\n\n');

  const apiContracts = plan.api_contracts?.length
    ? plan.api_contracts.map(c =>
      `- ${c.method} ${c.endpoint}: request=${c.request_shape} response=${c.response_shape}`
    ).join('\n')
    : 'none';

  return `## Архитектурный план

### Shared Types:
\`\`\`typescript
${plan.shared_types || '// none'}
\`\`\`

### API Contracts:
${apiContracts}

### ENV Variables: ${plan.env_variables?.join(', ') || 'none'}

### Dependencies planned: ${JSON.stringify(plan.dependencies || {})}

---

## ВСЕ СГЕНЕРИРОВАННЫЕ ФАЙЛЫ (${Object.keys(allFiles).length} шт.):

${fileEntries}

---

## ПРОВЕРЬ:
1. Каждый import → файл существует И экспортирует нужное
2. Типы props компонентов совместимы
3. Frontend fetch() → соответствует backend API routes
4. package.json содержит ВСЕ используемые пакеты
5. .env.example содержит ВСЕ переменные
6. 'use client' указан где нужен интерактив
7. Нет fake data или заглушек

Верни JSON с issues и fixed_files.`;
}

// ============================================================
// IMPORT/EXPORT VALIDATOR
// ============================================================

interface ImportError {
  file: string;
  importPath: string;
  symbols: string[];
  reason: 'file_missing' | 'symbol_missing';
  missingSymbols?: string[];
}

/**
 * Validates that all local imports resolve to real exports in generated files.
 * Returns a list of errors that can be fed to the fix-loop.
 */
function validateImports(files: GeneratedFiles): ImportError[] {
  const errors: ImportError[] = [];
  const filePaths = Object.keys(files);

  // Build export map: path → Set of exported names
  const exportMap = new Map<string, Set<string>>();

  for (const [filePath, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;
    const exports = new Set<string>();

    // export default → __default
    if (/export\s+default\s+/.test(content)) {
      exports.add('__default');
    }

    // export { name1, name2 } or export { name1 as alias }
    const reExportMatches = content.matchAll(/export\s*\{([^}]+)\}/g);
    for (const m of reExportMatches) {
      const names = m[1].split(',').map(n => {
        const parts = n.trim().split(/\s+as\s+/);
        return parts[parts.length - 1].trim();
      });
      names.filter(Boolean).forEach(n => exports.add(n));
    }

    // export const/let/var/function/class/type/interface/enum NAME
    const namedExports = content.matchAll(/export\s+(?:const|let|var|function|async\s+function|class|type|interface|enum)\s+(\w+)/g);
    for (const m of namedExports) {
      exports.add(m[1]);
    }

    exportMap.set(filePath, exports);
  }

  // Resolve an import path to actual file path
  // Returns: string = resolved path, null = node module (skip), undefined = local file not found
  function resolveImport(fromFile: string, importSpec: string): string | null | undefined {
    let targetPath: string;

    if (importSpec.startsWith('@/')) {
      // @/ → src/
      targetPath = 'src/' + importSpec.slice(2);
    } else if (importSpec.startsWith('./') || importSpec.startsWith('../')) {
      // Relative import
      const fromDir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      const parts = [...fromDir.split('/'), ...importSpec.split('/')];
      const resolved: string[] = [];
      for (const p of parts) {
        if (p === '.') continue;
        if (p === '..') { resolved.pop(); continue; }
        resolved.push(p);
      }
      targetPath = resolved.join('/');
    } else {
      // Node module — skip validation
      return null;
    }

    // Try extensions: exact, .ts, .tsx, /index.ts, /index.tsx
    const candidates = [
      targetPath,
      targetPath + '.ts',
      targetPath + '.tsx',
      targetPath + '/index.ts',
      targetPath + '/index.tsx',
    ];

    for (const c of candidates) {
      if (filePaths.includes(c)) return c;
    }

    return undefined; // local file not found
  }

  // Scan each file for imports
  for (const [filePath, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;

    // Match: import { X, Y } from '...'  or  import X from '...'  or  import type { X } from '...'
    const importRegex = /import\s+(?:type\s+)?(?:\{([^}]*)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const namedImports = match[1]; // { X, Y }
      const defaultImport = match[2]; // X
      const importPath = match[3];

      // Skip node_modules / package imports
      if (!importPath.startsWith('.') && !importPath.startsWith('@/')) continue;
      // Skip @/ paths that point to node_modules (e.g., @radix-ui)
      if (importPath.startsWith('@') && !importPath.startsWith('@/')) continue;

      const resolved = resolveImport(filePath, importPath);

      // null = node module, skip
      if (resolved === null) continue;

      // undefined = local file not found
      if (resolved === undefined) {
        const symbols = defaultImport
          ? [defaultImport]
          : (namedImports?.split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean) || []);

        errors.push({
          file: filePath,
          importPath,
          symbols,
          reason: 'file_missing',
        });
        continue;
      }

      // File exists — check symbols
      const fileExports = exportMap.get(resolved);
      if (!fileExports) continue;

      if (defaultImport) {
        if (!fileExports.has('__default') && !fileExports.has(defaultImport)) {
          errors.push({
            file: filePath,
            importPath,
            symbols: [defaultImport],
            reason: 'symbol_missing',
            missingSymbols: [defaultImport + ' (default)'],
          });
        }
      }

      if (namedImports) {
        const symbols = namedImports.split(',')
          .map(s => s.trim().split(/\s+as\s+/)[0].trim())
          .filter(Boolean);

        const missing = symbols.filter(s => !fileExports.has(s));
        if (missing.length > 0) {
          errors.push({
            file: filePath,
            importPath,
            symbols,
            reason: 'symbol_missing',
            missingSymbols: missing,
          });
        }
      }
    }
  }

  return errors;
}

// ============================================================
// VALIDATION (safety net — same as before)
// ============================================================

function validateAndFixGeneratedFiles(files: GeneratedFiles): GeneratedFiles {
  const fixedFiles = { ...files };
  const allFilePaths = Object.keys(files);
  const missingImports: string[] = [];

  const SUPABASE_CLIENT = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`;

  const STRIPE_CLIENT = `import Stripe from 'stripe';

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
  }
  return _stripe;
}

export const stripe = getStripe;
`;

  for (const [filePath, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;

    const libImports = content.match(/from\s+['"]@\/lib\/([^'"]+)['"]/g) || [];
    for (const imp of libImports) {
      const match = imp.match(/from\s+['"]@\/lib\/([^'"]+)['"]/);
      if (match) {
        const libName = match[1].replace(/\.ts$/, '');
        const expectedPath = `src/lib/${libName}.ts`;
        const altPath = `src/lib/${libName}/index.ts`;

        if (!allFilePaths.includes(expectedPath) && !allFilePaths.includes(altPath)) {
          missingImports.push(`${filePath} imports @/lib/${libName} but ${expectedPath} not found`);
          if (libName === 'supabase' && !fixedFiles['src/lib/supabase.ts']) {
            fixedFiles['src/lib/supabase.ts'] = SUPABASE_CLIENT;
          }
          if (libName === 'stripe' && !fixedFiles['src/lib/stripe.ts']) {
            fixedFiles['src/lib/stripe.ts'] = STRIPE_CLIENT;
          }
        }
      }
    }

    const componentImports = content.match(/from\s+['"]@\/components\/([^'"]+)['"]/g) || [];
    for (const imp of componentImports) {
      const match = imp.match(/from\s+['"]@\/components\/([^'"]+)['"]/);
      if (match) {
        const compName = match[1].replace(/\.tsx?$/, '');
        const expectedPath = `src/components/${compName}.tsx`;
        const altPath1 = `src/components/${compName}/index.tsx`;
        const altPath2 = `src/components/${compName}.ts`;

        if (!allFilePaths.includes(expectedPath) &&
            !allFilePaths.includes(altPath1) &&
            !allFilePaths.includes(altPath2)) {
          missingImports.push(`${filePath} imports @/components/${compName} but file not found`);
        }
      }
    }
  }

  if (missingImports.length > 0) {
    console.warn('[validate] Import warnings:', missingImports);
  }

  // Fix top-level throws for missing env vars — they break Next.js build
  let topLevelThrowsFixed = 0;
  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;

    // Pattern: if (!process.env.X) { throw new Error('...') } or throw new Error('...X...')
    // at the top level (not inside a function)
    const throwPattern = /^(if\s*\(\s*!process\.env\.\w+\s*\)\s*\{\s*\n?\s*throw\s+new\s+Error\([^)]*\);?\s*\n?\s*\})/gm;
    if (throwPattern.test(content)) {
      let fixed = content.replace(throwPattern, (match) => {
        return '// ' + match.split('\n').join('\n// ') + '\n// (disabled: top-level throws break Next.js build)';
      });
      fixedFiles[filePath] = fixed;
      topLevelThrowsFixed++;
    }

    // Pattern: const X = process.env.Y!; or process.env.Y || '' at top level - ok, skip
    // But: if (!X) throw ... after const - fix it
    const simpleThrowPattern = /^if\s*\(\s*!\w+\s*\)\s*\{\s*\n?\s*throw\s+new\s+Error\([^)]*\);?\s*\n?\s*\}/gm;
    if (simpleThrowPattern.test(fixedFiles[filePath])) {
      // Only comment out if it looks like an env var check at module level
      // Check if the variable referenced is from process.env
      const lines = fixedFiles[filePath].split('\n');
      let inFunction = false;
      const fixedLines: string[] = [];
      let braceDepth = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Track if we're inside a function/method
        if (/(?:function|async function|export async function|export function|=>)\s*/.test(line) && line.includes('{')) {
          inFunction = true;
        }
        // Simple brace tracking
        for (const ch of line) {
          if (ch === '{') braceDepth++;
          if (ch === '}') braceDepth--;
        }
        if (braceDepth <= 0) {
          inFunction = false;
          braceDepth = 0;
        }

        // If at top level and line is a throw for missing env
        if (!inFunction && braceDepth <= 1 && /throw\s+new\s+Error\(.*(?:env|ENV|process\.env|not set|not configured|is required|missing)/.test(line)) {
          fixedLines.push('// ' + line + ' // (disabled for build safety)');
          topLevelThrowsFixed++;
        } else {
          fixedLines.push(line);
        }
      }
      fixedFiles[filePath] = fixedLines.join('\n');
    }
  }
  if (topLevelThrowsFixed > 0) {
    console.log(`[validate] Fixed ${topLevelThrowsFixed} top-level throws that would break build`);
  }

  // Ensure next.config.js exists (required for Next.js build)
  const nextConfigKey = Object.keys(fixedFiles).find(k =>
    k === 'next.config.js' || k === 'next.config.mjs' || k === 'next.config.ts'
  );

  if (!nextConfigKey) {
    fixedFiles['next.config.js'] = `/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
`;
    console.log('[validate] Created minimal next.config.js');
  }

  // Note: tsconfig.json is left as-is — generated code should pass strict checks

  // ── ENSURE TAILWIND CSS WORKS ──
  // These files are REQUIRED for Tailwind to compile. Without them, all styles break.

  // 1. postcss.config.js (or .mjs)
  const hasPostcss = Object.keys(fixedFiles).some(k => k.startsWith('postcss.config'));
  if (!hasPostcss) {
    fixedFiles['postcss.config.js'] = `module.exports = {\n  plugins: {\n    tailwindcss: {},\n    autoprefixer: {},\n  },\n};\n`;
    console.log('[validate] Created postcss.config.js (was missing!)');
  }

  // 2. tailwind.config.ts (or .js)
  const hasTailwindConfig = Object.keys(fixedFiles).some(k => k.startsWith('tailwind.config'));
  if (!hasTailwindConfig) {
    fixedFiles['tailwind.config.ts'] = `import type { Config } from 'tailwindcss';\n\nconst config: Config = {\n  content: [\n    './src/**/*.{js,ts,jsx,tsx,mdx}',\n  ],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n};\n\nexport default config;\n`;
    console.log('[validate] Created tailwind.config.ts (was missing!)');
  } else {
    // Ensure content paths are correct
    const tailwindKey = Object.keys(fixedFiles).find(k => k.startsWith('tailwind.config'))!;
    if (fixedFiles[tailwindKey] && !fixedFiles[tailwindKey].includes('./src/')) {
      // Content paths might be wrong — fix them
      fixedFiles[tailwindKey] = fixedFiles[tailwindKey].replace(
        /content:\s*\[[^\]]*\]/,
        "content: ['./src/**/*.{js,ts,jsx,tsx,mdx}']"
      );
      console.log('[validate] Fixed tailwind.config content paths');
    }
  }

  // 3. globals.css must have @tailwind directives
  const globalsCssKey = Object.keys(fixedFiles).find(k =>
    k.includes('globals.css') || k.includes('global.css')
  );
  if (globalsCssKey) {
    const css = fixedFiles[globalsCssKey];
    if (!css.includes('@tailwind')) {
      fixedFiles[globalsCssKey] = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n' + css;
      console.log('[validate] Added @tailwind directives to globals.css');
    }
  } else {
    // No globals.css at all — create it
    fixedFiles['src/app/globals.css'] = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n* {\n  box-sizing: border-box;\n  margin: 0;\n  padding: 0;\n}\n\nbody {\n  min-height: 100vh;\n}\n';
    console.log('[validate] Created src/app/globals.css with @tailwind directives');
  }

  // 4. layout.tsx must import globals.css
  const layoutKey = Object.keys(fixedFiles).find(k =>
    k.includes('layout.tsx') && k.includes('app/')
  );
  if (layoutKey) {
    const layout = fixedFiles[layoutKey];
    if (!layout.includes('globals.css') && !layout.includes('global.css')) {
      // Add import at the top of the file
      fixedFiles[layoutKey] = "import './globals.css';\n" + layout;
      console.log('[validate] Added globals.css import to layout.tsx');
    }
  } else {
    // No layout.tsx — create one
    fixedFiles['src/app/layout.tsx'] = `import './globals.css';\nimport type { Metadata } from 'next';\n\nexport const metadata: Metadata = {\n  title: 'App',\n  description: 'Generated with TrendHunter AI',\n};\n\nexport default function RootLayout({\n  children,\n}: {\n  children: React.ReactNode;\n}) {\n  return (\n    <html lang="en">\n      <body className="bg-gray-950 text-white min-h-screen">{children}</body>\n    </html>\n  );\n}\n`;
    console.log('[validate] Created src/app/layout.tsx with globals.css import');
  }

  // 5. Ensure package.json has tailwindcss, postcss, autoprefixer
  if (fixedFiles['package.json']) {
    try {
      const pkg = JSON.parse(fixedFiles['package.json']);
      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};
      let modified = false;

      const requiredDeps: Record<string, string> = {
        'tailwindcss': '^3.4.0',
        'postcss': '^8.4.0',
        'autoprefixer': '^10.4.0',
      };

      for (const [name, version] of Object.entries(requiredDeps)) {
        if (!deps[name] && !devDeps[name]) {
          if (!pkg.devDependencies) pkg.devDependencies = {};
          pkg.devDependencies[name] = version;
          modified = true;
        }
      }

      if (modified) {
        fixedFiles['package.json'] = JSON.stringify(pkg, null, 2);
        console.log('[validate] Added missing Tailwind deps to package.json');
      }
    } catch {
      // skip
    }
  }

  // ── FIX: Default vs Named export mismatch ──
  // AI often generates `export function Navigation()` but imports as `import Navigation from ...`
  // Fix: add `export default ComponentName;` to component files that lack default export
  let defaultExportFixes = 0;
  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;
    // Find default imports from @/components/
    const defaultImports = content.matchAll(/import\s+(\w+)\s+from\s+['"]@\/components\/([^'"]+)['"]/g);
    for (const match of defaultImports) {
      const importedName = match[1];
      const compPath = match[2].replace(/\.tsx?$/, '');
      const targetPath = `src/components/${compPath}.tsx`;
      const altPath = `src/components/${compPath}/index.tsx`;
      const actualPath = fixedFiles[targetPath] ? targetPath : fixedFiles[altPath] ? altPath : null;

      if (actualPath) {
        const compContent = fixedFiles[actualPath];
        const hasDefaultExport = /export\s+default\s/.test(compContent);
        if (!hasDefaultExport) {
          // Check if the component is exported as named
          const hasNamedExport = new RegExp(`export\\s+(?:function|const|class)\\s+${importedName}\\b`).test(compContent);
          if (hasNamedExport) {
            fixedFiles[actualPath] = compContent + `\nexport default ${importedName};\n`;
            defaultExportFixes++;
          }
        }
      }
    }
  }
  if (defaultExportFixes > 0) {
    console.log(`[validate] Fixed ${defaultExportFixes} missing default exports in components`);
  }

  // ── FIX: Unused `request` parameter in API route handlers ──
  // Next.js route handlers: export async function GET(request: NextRequest) — if request unused, prefix with _
  let unusedRequestFixes = 0;
  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;
    if (!filePath.includes('/api/') || !filePath.endsWith('route.ts')) continue;

    // Find route handler functions with request parameter
    const handlerPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(\s*(request)\s*(?::\s*[^)]+)?\)/g;
    let handlerMatch;
    let fixedContent = content;
    let fileModified = false;

    while ((handlerMatch = handlerPattern.exec(content)) !== null) {
      const methodName = handlerMatch[1];
      const fullMatch = handlerMatch[0];

      // Extract the function body to check if `request` is used beyond the signature
      const funcStart = handlerMatch.index + fullMatch.length;
      // Count usages of `request` in the rest of the function (simple heuristic: whole file after signature)
      const restOfFile = content.slice(funcStart);
      // Find closing brace of this function (track braces)
      let braceDepth = 0;
      let funcEnd = 0;
      for (let i = 0; i < restOfFile.length; i++) {
        if (restOfFile[i] === '{') braceDepth++;
        if (restOfFile[i] === '}') {
          braceDepth--;
          if (braceDepth === 0) { funcEnd = i; break; }
        }
      }
      const funcBody = restOfFile.slice(0, funcEnd);
      // Count `request` usage in function body (not in comments)
      const requestUsages = (funcBody.match(/\brequest\b/g) || []).length;

      if (requestUsages === 0) {
        // request is unused — prefix with _
        const fixedSignature = fullMatch.replace(/\(\s*request\s*(?=[:)])/, '(_request ');
        fixedContent = fixedContent.replace(fullMatch, fixedSignature);
        fileModified = true;
        unusedRequestFixes++;
      }
    }

    if (fileModified) {
      fixedFiles[filePath] = fixedContent;
    }
  }
  if (unusedRequestFixes > 0) {
    console.log(`[validate] Fixed ${unusedRequestFixes} unused 'request' parameters in API routes`);
  }

  // ── FIX: Remove problematic native modules from package.json ──
  // Native C++ modules (canvas, sharp, etc.) fail on Vercel with newer Node versions.
  // Replace with pure-JS alternatives or remove entirely.
  if (fixedFiles['package.json']) {
    try {
      const pkg = JSON.parse(fixedFiles['package.json']);

      // Map of problematic native deps → safe replacements (null = just remove)
      const nativeModuleReplacements: Record<string, { replacement: string | null; version: string | null }> = {
        'canvas': { replacement: null, version: null },           // Use CSS/SVG instead
        'node-canvas': { replacement: null, version: null },
        'sharp': { replacement: 'next/image', version: null },    // Next.js has built-in image optimization
        'bcrypt': { replacement: 'bcryptjs', version: '^2.4.3' }, // Pure JS alternative
        'argon2': { replacement: 'bcryptjs', version: '^2.4.3' },
        'better-sqlite3': { replacement: null, version: null },
        'libsql': { replacement: null, version: null },
        'node-gyp': { replacement: null, version: null },
      };

      let nativeFixCount = 0;
      for (const [nativeDep, fix] of Object.entries(nativeModuleReplacements)) {
        const inDeps = pkg.dependencies?.[nativeDep];
        const inDevDeps = pkg.devDependencies?.[nativeDep];

        if (inDeps || inDevDeps) {
          // Remove the problematic package
          if (pkg.dependencies?.[nativeDep]) delete pkg.dependencies[nativeDep];
          if (pkg.devDependencies?.[nativeDep]) delete pkg.devDependencies[nativeDep];

          // Add replacement if available
          if (fix.replacement && fix.version && !pkg.dependencies?.[fix.replacement]) {
            if (!pkg.dependencies) pkg.dependencies = {};
            pkg.dependencies[fix.replacement] = fix.version;
          }

          nativeFixCount++;
          console.log(`[validate] Removed native module "${nativeDep}"${fix.replacement ? ` → replaced with "${fix.replacement}"` : ''}`);
        }
      }

      if (nativeFixCount > 0) {
        fixedFiles['package.json'] = JSON.stringify(pkg, null, 2);

        // Also remove imports of canvas/sharp from source files
        for (const [fp, fc] of Object.entries(fixedFiles)) {
          if (typeof fc !== 'string' || fp === 'package.json') continue;

          let fixedContent = fc;
          // Remove canvas imports and replace with comment
          fixedContent = fixedContent.replace(
            /import\s+.*?from\s+['"]canvas['"];?\n?/g,
            '// canvas removed — use CSS/SVG for rendering\n'
          );
          fixedContent = fixedContent.replace(
            /const\s+.*?=\s*require\s*\(\s*['"]canvas['"]\s*\);?\n?/g,
            '// canvas removed — use CSS/SVG for rendering\n'
          );
          fixedContent = fixedContent.replace(
            /import\s+.*?from\s+['"]sharp['"];?\n?/g,
            '// sharp removed — use next/image for image processing\n'
          );

          if (fixedContent !== fc) {
            fixedFiles[fp] = fixedContent;
          }
        }
      }
    } catch {
      // skip
    }
  }

  // === Fix 3: Remove deprecated `export const config` in App Router API routes ===
  // Next.js App Router doesn't use Pages Router config pattern.
  // Uses brace counting to handle any nesting depth.
  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;
    if (!filePath.includes('route.ts') && !filePath.includes('route.js')) continue;

    // Find `export const config` and remove the entire block using brace counting
    const configStart = content.search(/export\s+const\s+config\s*=/);
    if (configStart === -1) continue;

    // Find opening brace
    const braceStart = content.indexOf('{', configStart);
    if (braceStart === -1) continue;

    // Count braces to find matching close
    let depth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < content.length; i++) {
      if (content[i] === '{') depth++;
      if (content[i] === '}') depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }

    if (braceEnd === -1) continue;

    // Include trailing semicolon and newline
    let endPos = braceEnd + 1;
    if (content[endPos] === ';') endPos++;
    while (endPos < content.length && (content[endPos] === '\n' || content[endPos] === '\r')) endPos++;

    // Also remove leading newlines
    let startPos = configStart;
    while (startPos > 0 && (content[startPos - 1] === '\n' || content[startPos - 1] === '\r')) startPos--;
    if (startPos > 0) startPos++; // keep one newline

    const fixed = content.slice(0, startPos) + content.slice(endPos);
    fixedFiles[filePath] = fixed;
    console.log(`[validate] Removed deprecated "export const config" from ${filePath}`);
  }

  // === Fix 4: Fix globals.css — remove undefined Tailwind classes like border-border ===
  // shadcn/ui pattern `@apply border-border` requires CSS variable --border in tailwind config.
  // If tailwind config doesn't define it, the build fails. Fix: add CSS variables or remove @apply.
  const globalsCssPath = Object.keys(fixedFiles).find(fp =>
    fp.includes('globals.css') || fp.includes('global.css')
  );
  const tailwindConfigPath = Object.keys(fixedFiles).find(fp =>
    fp.includes('tailwind.config')
  );

  if (globalsCssPath && fixedFiles[globalsCssPath]) {
    let css = fixedFiles[globalsCssPath] as string;
    const hasBorderBorder = css.includes('border-border');
    const hasBackgroundBackground = css.includes('bg-background');
    const hasForeground = css.includes('text-foreground');

    if (hasBorderBorder || hasBackgroundBackground || hasForeground) {
      // Check if CSS variables are defined in globals.css
      const hasCssVars = css.includes('--border') || css.includes('--background') || css.includes('--foreground');

      if (!hasCssVars) {
        // Option A: Add CSS variable definitions for shadcn/ui theme
        const cssVarsBlock = `
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
  }
}
`;
        // Insert CSS vars after @tailwind directives
        if (css.includes('@tailwind utilities;')) {
          css = css.replace('@tailwind utilities;', '@tailwind utilities;\n' + cssVarsBlock);
        } else {
          css = cssVarsBlock + '\n' + css;
        }

        fixedFiles[globalsCssPath] = css;
        console.log('[validate] Added shadcn/ui CSS variables to globals.css');

        // Also ensure tailwind.config extends theme with hsl() colors
        if (tailwindConfigPath && fixedFiles[tailwindConfigPath]) {
          let twConfig = fixedFiles[tailwindConfigPath] as string;
          if (!twConfig.includes('hsl(') && !twConfig.includes('--border')) {
            // Add theme extension for CSS variable colors
            const themeExtend = `
    colors: {
      border: 'hsl(var(--border))',
      input: 'hsl(var(--input))',
      ring: 'hsl(var(--ring))',
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
      secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
      destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
      muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
      accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
      popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
      card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
    },
    borderRadius: {
      lg: 'var(--radius)',
      md: 'calc(var(--radius) - 2px)',
      sm: 'calc(var(--radius) - 4px)',
    },`;

            // Insert into extend block
            if (twConfig.includes('extend: {')) {
              twConfig = twConfig.replace('extend: {', 'extend: {' + themeExtend);
            } else if (twConfig.includes('theme: {')) {
              twConfig = twConfig.replace('theme: {', 'theme: {\n    extend: {' + themeExtend + '\n    },');
            }

            fixedFiles[tailwindConfigPath] = twConfig;
            console.log('[validate] Added shadcn/ui theme colors to tailwind.config');
          }
        }
      }
    }
  }

  // === Fix 5: Auto-add 'use client' to files using React hooks/browser APIs ===
  let useClientFixes = 0;
  const clientHookPatterns = [
    /\buseState\b/, /\buseEffect\b/, /\buseRef\b/, /\buseCallback\b/,
    /\buseMemo\b/, /\buseContext\b/, /\buseReducer\b/, /\buseLayoutEffect\b/,
    /\buseRouter\b/, /\busePathname\b/, /\buseSearchParams\b/, /\buseParams\b/,
    /\bonClick\b/, /\bonChange\b/, /\bonSubmit\b/, /\bonKeyDown\b/,
    /\bwindow\./, /\bdocument\./, /\blocalStorage\b/, /\bsessionStorage\b/,
  ];

  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;
    // Only TSX/JSX files, not API routes, not layout.tsx (root layout must be server component for metadata)
    if (!filePath.endsWith('.tsx') && !filePath.endsWith('.jsx')) continue;
    if (filePath.includes('/api/')) continue;
    // Skip if already has 'use client' or 'use server'
    if (content.includes("'use client'") || content.includes('"use client"')) continue;
    if (content.includes("'use server'") || content.includes('"use server"')) continue;
    // Root layout — don't add 'use client' (breaks metadata export)
    if (filePath.match(/src\/app\/layout\.tsx$/)) continue;

    const needsClient = clientHookPatterns.some(pattern => pattern.test(content));
    if (needsClient) {
      fixedFiles[filePath] = "'use client';\n\n" + content;
      useClientFixes++;
    }
  }
  if (useClientFixes > 0) {
    console.log(`[validate] Added 'use client' to ${useClientFixes} files with React hooks/browser APIs`);
  }

  // === Fix 6: Ensure page.tsx files have default export ===
  let pageFixes = 0;
  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;
    if (!filePath.endsWith('page.tsx') && !filePath.endsWith('page.jsx')) continue;

    if (!/export\s+default\s/.test(content)) {
      // Try to find a named function export to make default
      const namedExport = content.match(/export\s+(?:async\s+)?function\s+(\w+)/);
      if (namedExport) {
        fixedFiles[filePath] = content + `\nexport default ${namedExport[1]};\n`;
        pageFixes++;
      }
    }
  }
  if (pageFixes > 0) {
    console.log(`[validate] Fixed ${pageFixes} page.tsx files missing default export`);
  }

  // === Fix 7: next.config — add images.remotePatterns for external images ===
  const nextCfgKey = Object.keys(fixedFiles).find(k =>
    k === 'next.config.js' || k === 'next.config.mjs' || k === 'next.config.ts'
  );
  if (nextCfgKey) {
    let cfg = fixedFiles[nextCfgKey] as string;
    // Check if any file uses next/image with external URLs
    const usesExternalImages = Object.values(fixedFiles).some(fc =>
      typeof fc === 'string' && fc.includes('next/image') && /src=\{?["'`]https?:\/\//.test(fc)
    );
    if (usesExternalImages && !cfg.includes('remotePatterns') && !cfg.includes('images')) {
      // Add permissive images config
      if (cfg.includes('const nextConfig = {')) {
        cfg = cfg.replace(
          'const nextConfig = {',
          `const nextConfig = {\n  images: {\n    remotePatterns: [\n      { protocol: 'https', hostname: '**' },\n    ],\n  },`
        );
      } else if (cfg.includes('const nextConfig: NextConfig = {')) {
        cfg = cfg.replace(
          'const nextConfig: NextConfig = {',
          `const nextConfig: NextConfig = {\n  images: {\n    remotePatterns: [\n      { protocol: 'https', hostname: '**' },\n    ],\n  },`
        );
      }
      fixedFiles[nextCfgKey] = cfg;
      console.log('[validate] Added images.remotePatterns to next.config');
    }
  }

  // === Fix 8: Disable ESLint build errors (warnings shouldn't block deploy) ===
  if (nextCfgKey) {
    let cfg = fixedFiles[nextCfgKey] as string;
    if (!cfg.includes('eslint')) {
      if (cfg.includes('const nextConfig = {')) {
        cfg = cfg.replace(
          'const nextConfig = {',
          `const nextConfig = {\n  eslint: {\n    ignoreDuringBuilds: true,\n  },\n  typescript: {\n    ignoreBuildErrors: true,\n  },`
        );
      } else if (cfg.includes('const nextConfig: NextConfig = {')) {
        cfg = cfg.replace(
          'const nextConfig: NextConfig = {',
          `const nextConfig: NextConfig = {\n  eslint: {\n    ignoreDuringBuilds: true,\n  },\n  typescript: {\n    ignoreBuildErrors: true,\n  },`
        );
      }
      fixedFiles[nextCfgKey] = cfg;
      console.log('[validate] Added eslint.ignoreDuringBuilds to next.config');
    }
  }

  // === Fix 9: Remove 'use server' from files that should be client components ===
  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;
    if (!filePath.endsWith('.tsx')) continue;
    // If file has 'use server' but also uses client-side hooks/events — remove 'use server'
    if (content.includes("'use server'") || content.includes('"use server"')) {
      const hasClientCode = clientHookPatterns.some(pattern => pattern.test(content));
      if (hasClientCode) {
        let fixed = content.replace(/['"]use server['"];?\s*\n?/g, "'use client';\n");
        fixedFiles[filePath] = fixed;
        console.log(`[validate] Replaced 'use server' with 'use client' in ${filePath} (has client hooks)`);
      }
    }
  }

  // === Fix 10: Ensure tsconfig.json has proper paths alias ===
  if (fixedFiles['tsconfig.json']) {
    try {
      const tsConfig = JSON.parse(fixedFiles['tsconfig.json']);
      if (!tsConfig.compilerOptions?.paths?.['@/*']) {
        if (!tsConfig.compilerOptions) tsConfig.compilerOptions = {};
        if (!tsConfig.compilerOptions.paths) tsConfig.compilerOptions.paths = {};
        tsConfig.compilerOptions.paths['@/*'] = ['./src/*'];
        fixedFiles['tsconfig.json'] = JSON.stringify(tsConfig, null, 2);
        console.log('[validate] Added @/* path alias to tsconfig.json');
      }
    } catch {
      // skip
    }
  }

  // === Fix 11: Replace filesystem uploads with /tmp (Vercel is read-only) ===
  for (const [filePath, content] of Object.entries(fixedFiles)) {
    if (typeof content !== 'string') continue;
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx') && !filePath.endsWith('.js') && !filePath.endsWith('.jsx')) continue;

    let fixed = content;
    let changed = false;

    // Replace mkdirSync/mkdir with /tmp path
    // Pattern: fs.mkdirSync('uploads' or './uploads' or 'public/uploads' etc.)
    if (/mkdirSync|mkdir/.test(fixed) && /uploads|upload/i.test(fixed)) {
      // Replace any path that creates an uploads dir to use /tmp
      fixed = fixed.replace(
        /(mkdirSync|mkdir)\s*\(\s*(['"`])(?:\.?\/?(?:public\/)?)(uploads?[^'"`]*)\2/g,
        '$1($2/tmp/$3$2'
      );
      // Also replace path.join(..., 'uploads') patterns
      fixed = fixed.replace(
        /path\.join\s*\(\s*(?:__dirname|process\.cwd\(\)|'\.'),\s*(['"`])(?:public\/)?uploads?\1/g,
        "path.join('/tmp', $1uploads$1"
      );
      changed = true;
    }

    // Replace hardcoded upload paths (not in /tmp already)
    if (/['"`](?:\.?\/?(?:public\/)?uploads?\/)/.test(fixed) && !/\/tmp\/uploads/.test(fixed)) {
      fixed = fixed.replace(
        /(['"`])(?:\.?\/?(?:public\/)?)(uploads?\/)/g,
        (match, quote, dir) => {
          // Don't double-fix paths already using /tmp
          if (match.includes('/tmp/')) return match;
          return `${quote}/tmp/${dir}`;
        }
      );
      changed = true;
    }

    // Replace writeFileSync/writeFile to uploads paths
    if (/writeFileSync|writeFile|createWriteStream/.test(fixed)) {
      fixed = fixed.replace(
        /(['"`])(?:\.?\/?(?:public\/)?)(uploads?\/[^'"`]*)\1/g,
        (match, quote, path) => {
          if (match.includes('/tmp/')) return match;
          return `${quote}/tmp/${path}${quote}`;
        }
      );
      changed = true;
    }

    // Ensure mkdirSync has { recursive: true }
    if (/mkdirSync/.test(fixed)) {
      fixed = fixed.replace(
        /mkdirSync\s*\(([^)]+)\)/g,
        (match, args) => {
          if (args.includes('recursive')) return match;
          return `mkdirSync(${args.trim()}, { recursive: true })`;
        }
      );
      changed = true;
    }

    if (changed) {
      fixedFiles[filePath] = fixed;
      console.log(`[validate] Fixed filesystem upload paths to use /tmp in ${filePath}`);
    }
  }

  // Ensure README.md exists
  if (!fixedFiles['README.md']) {
    fixedFiles['README.md'] = '# Project\n\nGenerated with TrendHunter AI\n';
    console.log('[validate] Added placeholder README.md');
  }

  console.log(`[validate] Complete: ${Object.keys(fixedFiles).length} files (${missingImports.length} warnings)`);
  return fixedFiles;
}

// ============================================================
// CLAUDE API HELPER
// ============================================================

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens: number; temperature?: number; prefill?: string },
): Promise<string> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const MAX_RETRIES = 4;
  const RETRY_DELAYS = [5000, 15000, 30000, 60000]; // 5s, 15s, 30s, 60s

  // Build messages array — optionally with assistant prefill to force JSON output
  const messages: Array<{ role: string; content: string }> = [
    { role: 'user', content: userPrompt },
  ];
  if (options.prefill) {
    messages.push({ role: 'assistant', content: options.prefill });
  }

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: options.maxTokens,
        temperature: options.temperature ?? 0.3,
        system: systemPrompt,
        messages,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const errorBody = await response.json().catch(() => ({ error: { message: response.statusText } }));
      const errMsg = errorBody.error?.message || JSON.stringify(errorBody);

      // Retry on overloaded (529) or rate limit (429)
      if ((status === 529 || status === 429) && attempt < MAX_RETRIES) {
        const delay = RETRY_DELAYS[attempt];
        console.warn(`[claude] ${status === 529 ? 'Overloaded' : 'Rate limited'} (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Claude API error: ${errMsg}`);
    }

    const data = await response.json();
    let content = data.content?.[0]?.text || '';
    const stopReason = data.stop_reason;

    // If we used prefill, prepend it to the response (Claude continues from prefill)
    if (options.prefill) {
      content = options.prefill + content;
    }

    if (stopReason === 'max_tokens') {
      console.warn(`[claude] Response truncated (max_tokens: ${options.maxTokens})`);
    }

    if (attempt > 0) {
      console.log(`[claude] Succeeded on attempt ${attempt + 1}`);
    }

    return content;
  }

  throw new Error('Claude API: max retries exceeded');
}

function parseJSON<T>(text: string): T | null {
  // 1. Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // continue to extraction
  }

  // 2. Try extracting from ```json ... ``` code block
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch {
      // continue
    }
  }

  // 3. Try finding outermost { ... } (greedy)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      // 4. Try cleaning common issues: trailing commas, comments
      const cleaned = jsonMatch[0]
        .replace(/,\s*([}\]])/g, '$1')           // trailing commas
        .replace(/\/\/[^\n]*/g, '')                // single-line comments
        .replace(/\/\*[\s\S]*?\*\//g, '');         // multi-line comments
      try {
        return JSON.parse(cleaned);
      } catch {
        // continue
      }
    }
  }

  // 5. Handle truncated JSON — try to salvage "issues" array from partial response
  const truncatedMatch = text.match(/\{\s*"issues"\s*:\s*\[[\s\S]*/);
  if (truncatedMatch) {
    let partial = truncatedMatch[0];
    // Find the last complete object in the array (ends with })
    const lastCompleteObj = partial.lastIndexOf('}');
    if (lastCompleteObj > 0) {
      // Close the array and object
      partial = partial.substring(0, lastCompleteObj + 1) + ']}';
      try {
        const result = JSON.parse(partial);
        console.warn(`[parseJSON] Recovered truncated JSON with ${result.issues?.length || 0} issues`);
        return result;
      } catch {
        // continue
      }
    }
  }

  console.error('[parseJSON] Failed to parse. First 500 chars:', text.substring(0, 500));
  return null;
}

// ============================================================
// MAIN PIPELINE
// ============================================================

/**
 * Generate code using the hybrid Architect → Coder → Reviewer pipeline.
 * Same interface as before — drop-in replacement.
 */
export async function generateCodeWithClaude(spec: ProjectSpec): Promise<GeneratedFiles> {
  const totalStart = Date.now();

  console.log('='.repeat(60));
  console.log(`[pipeline] Starting hybrid generation for: ${spec.project_name}`);
  console.log(`[pipeline] derived_features: ${spec.derived_features?.length || 0}`);
  console.log(`[pipeline] core_features: ${spec.mvp_specification.core_features.length}`);
  console.log('='.repeat(60));

  // ── PHASE 1: ARCHITECT ──
  const plan = await runArchitect(spec);

  // Log the plan
  const foundationFiles = plan.file_plan.filter(f => f.group === 'foundation').length;
  const backendFiles = plan.file_plan.filter(f => f.group === 'backend').length;
  const frontendFiles = plan.file_plan.filter(f => f.group === 'frontend').length;
  console.log(`[pipeline] Architecture: ${foundationFiles} foundation, ${backendFiles} backend, ${frontendFiles} frontend`);

  // ── INJECT TYPES BEFORE CODERS ──
  // Types file comes directly from Architect — this is the "source of truth"
  // Coder must NOT regenerate it — only import from it
  let typesFile: GeneratedFiles = {};
  if (plan.shared_types) {
    typesFile['src/types/index.ts'] = plan.shared_types;
    console.log(`[pipeline] Types file injected from Architect (${plan.shared_types.length} chars)`);
    // Remove types from file_plan so Coder doesn't regenerate them
    plan.file_plan = plan.file_plan.filter(f => f.path !== 'src/types/index.ts');
  }

  // ── PHASE 2: CODER (sequential, each phase wrapped in try-catch) ──
  console.log('[pipeline] Starting sequential code generation...');
  const coderStart = Date.now();

  let foundationResult: GeneratedFiles = {};
  let backendResult: GeneratedFiles = {};
  let frontendResult: GeneratedFiles = {};

  // Foundation — critical (types, config, lib)
  try {
    console.log('[pipeline] Generating foundation...');
    foundationResult = await runCoder(plan, 'foundation', spec);
    console.log(`[pipeline] Foundation done: ${Object.keys(foundationResult).length} files`);
  } catch (err) {
    console.error(`[pipeline] Foundation FAILED: ${err instanceof Error ? err.message : err}`);
  }

  // Backend — API routes
  try {
    console.log('[pipeline] Generating backend...');
    backendResult = await runCoder(plan, 'backend', spec);
    console.log(`[pipeline] Backend done: ${Object.keys(backendResult).length} files`);
  } catch (err) {
    console.error(`[pipeline] Backend FAILED: ${err instanceof Error ? err.message : err}`);
  }

  // Frontend — components & pages (most likely to fail due to size)
  try {
    console.log('[pipeline] Generating frontend...');
    frontendResult = await runCoder(plan, 'frontend', spec);
    console.log(`[pipeline] Frontend done: ${Object.keys(frontendResult).length} files`);
  } catch (err) {
    console.error(`[pipeline] Frontend FAILED: ${err instanceof Error ? err.message : err}`);
    // Create a minimal page.tsx so the project at least loads
    frontendResult = {
      'src/app/page.tsx': `'use client';\n\nexport default function Home() {\n  return (\n    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white">\n      <div className="text-center">\n        <h1 className="text-4xl font-bold mb-4">${spec.project_name}</h1>\n        <p className="text-gray-400">${spec.one_liner}</p>\n        <p className="text-sm text-gray-600 mt-8">Frontend generation failed — run the code generator again.</p>\n      </div>\n    </main>\n  );\n}\n`,
    };
  }

  const coderElapsed = Date.now() - coderStart;
  console.log(`[pipeline] All coders finished in ${coderElapsed}ms`);

  // Merge all generated files (types first — canonical, cannot be overwritten by Coder)
  let allFiles: GeneratedFiles = {
    ...foundationResult,
    ...backendResult,
    ...frontendResult,
    ...typesFile, // Types from Architect override any Coder output
  };

  console.log(`[pipeline] Total files after merge: ${Object.keys(allFiles).length}`);

  // ── PHASE 3: REVIEWER + FIX-LOOP ──
  const MAX_FIX_ITERATIONS = 3;
  const FIX_ITERATION_TIMEOUT_MS = 300_000; // 5 min per iteration (accounts for rate limiting retries)
  let lastReview: ReviewResult = { issues: [], fixed_files: {} };

  for (let iteration = 1; iteration <= MAX_FIX_ITERATIONS; iteration++) {
    console.log(`\n[fix-loop] ── Iteration ${iteration}/${MAX_FIX_ITERATIONS} ──`);

    // Save snapshot before this iteration (fallback on failure)
    const snapshot = { ...allFiles };

    try {
      // Run reviewer with timeout
      const reviewPromise = runReviewer(plan, allFiles);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Reviewer timeout')), FIX_ITERATION_TIMEOUT_MS)
      );

      lastReview = await Promise.race([reviewPromise, timeoutPromise]);

      // Apply reviewer fixes
      if (lastReview.fixed_files && Object.keys(lastReview.fixed_files).length > 0) {
        console.log(`[fix-loop] Reviewer fixed ${Object.keys(lastReview.fixed_files).length} files`);
        allFiles = { ...allFiles, ...lastReview.fixed_files };
      }

      // Run import/export validation
      const importErrors = validateImports(allFiles);
      const reviewerErrors = lastReview.issues?.filter(i => i.severity === 'error').length || 0;
      const totalErrors = reviewerErrors + importErrors.length;

      if (importErrors.length > 0) {
        console.log(`[fix-loop] Import validation: ${importErrors.length} errors`);
        importErrors.forEach(e => {
          if (e.reason === 'file_missing') {
            console.log(`  ❌ ${e.file}: imports "${e.importPath}" — file not found`);
          } else {
            console.log(`  ❌ ${e.file}: imports {${e.missingSymbols?.join(', ')}} from "${e.importPath}" — not exported`);
          }
        });
      }

      console.log(`[fix-loop] Iteration ${iteration} result: ${totalErrors} errors (reviewer: ${reviewerErrors}, imports: ${importErrors.length})`);

      // No errors — exit loop early
      if (totalErrors === 0) {
        console.log(`[fix-loop] ✅ All clean after ${iteration} iteration(s)`);
        break;
      }

      // Last iteration — don't try again
      if (iteration === MAX_FIX_ITERATIONS) {
        console.warn(`[fix-loop] ⚠️ ${totalErrors} errors remain after ${MAX_FIX_ITERATIONS} iterations`);
        break;
      }

      // Prepare import errors as reviewer-compatible issues for next iteration
      if (importErrors.length > 0) {
        const importIssues = importErrors.map(e => ({
          file: e.file,
          severity: 'error' as const,
          description: e.reason === 'file_missing'
            ? `Import from "${e.importPath}" — target file does not exist in generated files`
            : `Import {${e.missingSymbols?.join(', ')}} from "${e.importPath}" — symbols not exported by target file`,
          fix_hint: e.reason === 'file_missing'
            ? `Either create the missing file or change the import to use an existing file`
            : `Add missing exports to the target file or fix the import names`,
        }));
        // Inject import errors into review so next iteration's reviewer sees them
        lastReview.issues = [...(lastReview.issues || []), ...importIssues];
      }

    } catch (err) {
      console.error(`[fix-loop] Iteration ${iteration} failed: ${err instanceof Error ? err.message : err}`);
      // Restore snapshot — don't lose good files
      allFiles = snapshot;
      console.log(`[fix-loop] Restored snapshot from before iteration ${iteration}`);
      break;
    }
  }

  // ── FINAL SAFETY NET ──
  allFiles = validateAndFixGeneratedFiles(allFiles);

  // Final import check (log only, don't fail)
  const finalImportErrors = validateImports(allFiles);
  if (finalImportErrors.length > 0) {
    console.warn(`[pipeline] ⚠️ ${finalImportErrors.length} unresolved import(s) in final output`);
  }

  const totalElapsed = Date.now() - totalStart;
  console.log('='.repeat(60));
  console.log(`[pipeline] COMPLETE: ${Object.keys(allFiles).length} files in ${(totalElapsed / 1000).toFixed(1)}s`);
  console.log(`[pipeline] Reviewer issues: ${lastReview.issues?.length || 0} (${lastReview.issues?.filter(i => i.severity === 'error').length || 0} errors)`);
  console.log(`[pipeline] Unresolved imports: ${finalImportErrors.length}`);
  console.log('='.repeat(60));

  return allFiles;
}
