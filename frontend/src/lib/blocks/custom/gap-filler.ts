/**
 * Gap Filler — Custom Code Generation
 *
 * The ONLY place that calls Claude API in the block system.
 * Generates code for unique features not covered by any pre-built block.
 * Typically produces 2-5 files per project instead of 50.
 */

import type { BlockContext, BlockResult } from '../types';
import type { ProductSpecification } from '../../mvp-templates/types';
import { createDesignTokens } from '../design-injector';

type DerivedFeature = NonNullable<ProductSpecification['derived_features']>[number];

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

/**
 * ONE Claude call to generate custom code for unique features not covered by blocks.
 */
export async function fillGaps(
  ctx: BlockContext,
  uncoveredFeatures: DerivedFeature[],
  existingPaths: string[],
): Promise<BlockResult> {
  if (!ANTHROPIC_API_KEY || uncoveredFeatures.length === 0) {
    return {};
  }

  const t = createDesignTokens(ctx.design);

  const featuresDescription = uncoveredFeatures.map((f, i) =>
    `${i + 1}. ${f.feature_name} [${f.priority}]
   Pain: "${f.pain_quote}"
   Solution: ${f.solution}
   Hint: ${f.implementation_hint}`
  ).join('\n\n');

  // ─── Product context for better generation ───
  const spec = ctx.product_spec;
  const magicDesc = spec.magic_location?.description || '';
  const magicType = spec.magic_location?.type || 'ai_analysis';
  const primaryInput = spec.user_input?.primary_input || '';
  const inputType = spec.user_input?.input_type || 'text';
  const primaryOutput = spec.user_output?.primary_output || '';
  const outputFormat = spec.user_output?.output_format || 'text';
  const valueProposition = spec.user_output?.value_proposition || '';
  const userFlowSteps = (spec.user_flow?.steps || [])
    .map(s => `  ${s.step_number}. ${s.action} → User sees: ${s.user_sees}`)
    .join('\n');

  const productContextSection = [
    `## Product Context (CRITICAL — generate code specific to this product):`,
    valueProposition ? `- Value Proposition: ${valueProposition}` : '',
    magicDesc ? `- What the app does: ${magicDesc}` : '',
    magicType ? `- Magic type: ${magicType}` : '',
    primaryInput ? `- User inputs: ${primaryInput} (type: ${inputType})` : '',
    primaryOutput ? `- User gets: ${primaryOutput} (format: ${outputFormat})` : '',
    userFlowSteps ? `- User flow:\n${userFlowSteps}` : '',
    '',
    `## Output format guidance:`,
    outputFormat === 'score' ? '- Components should display scores with progress bars, breakdowns, color-coded ratings' : '',
    outputFormat === 'report' ? '- Components should render structured reports with sections, headings, expandable details' : '',
    outputFormat === 'list' ? '- Components should render prioritized lists with icons, badges, filtering' : '',
    outputFormat === 'visualization' ? '- Use recharts for data visualization (bar charts, line charts, pie charts)' : '',
    outputFormat === 'recommendation' ? '- Components should display actionable recommendations with impact/effort matrix' : '',
    outputFormat === 'action' ? '- Components should render step-by-step action plans with timelines and checkboxes' : '',
    `- All custom components must be tailored to "${primaryOutput || 'analysis results'}" — NOT generic dashboards`,
  ].filter(Boolean).join('\n');

  const prompt = `Generate ONLY the custom files needed for these unique features.

## Project: ${ctx.project_name}
## Stack: Next.js 14, TypeScript, Tailwind CSS, Supabase

${productContextSection}

## Design System:
- Primary: ${t.primary}
- Secondary: ${t.secondary}
- Accent: ${t.accent}
- Background: ${t.bg}
- Text: ${t.text}
- Heading font: ${t.headingFont}
- Body font: ${t.bodyFont}

## Features that need custom code:
${featuresDescription}

## EXISTING files (DO NOT regenerate these, import from them):
${existingPaths.slice(0, 40).map(p => `- ${p}`).join('\n')}

## AVAILABLE block-generated utilities you can import and use:
${existingPaths.includes('src/lib/pdf-generator.ts') ? `- PDF export: import { generatePDF, downloadPDF } from '@/lib/pdf-generator'
  EXACT SIGNATURES (do NOT deviate):
    generatePDF(options: { title: string; sections?: Array<{ heading?: string; content?: string; items?: string[]; table?: { headers: string[]; rows: string[][]; alignRight?: number[] } }>; subtitle?: string; brandColor?: string; [key: string]: any }, autoDownloadFilename?: string): any
    downloadPDF(doc: any, filename?: string): void
  USAGE EXAMPLES:
    // Simple: auto-download
    generatePDF({ title: 'Report', sections: [{ heading: 'Summary', content: 'text' }] }, 'report.pdf');
    // With table:
    generatePDF({ title: 'Invoice', sections: [{ heading: 'Items', table: { headers: ['Desc','Qty','Rate','Amount'], rows: [['Service','1','100','100']], alignRight: [2,3] } }] }, 'invoice.pdf');
    // Or get doc object and download separately:
    const doc = generatePDF({ title: 'Doc', sections: [] });
    downloadPDF(doc, 'file.pdf');` : ''}
${existingPaths.includes('src/components/ExportButtons.tsx') ? `- Export UI: import ExportButtons from '@/components/ExportButtons'
  Props: { title: string; data: any; filename?: string; [key: string]: any }` : ''}
${existingPaths.includes('src/components/ChartComponents.tsx') ? "- Charts: import { BarChart, PieChart, StatCard, DataTable } from '@/components/ChartComponents' — CSS-only charts" : ''}
${existingPaths.includes('src/components/InteractiveWizard.tsx') ? "- Wizard: import InteractiveWizard from '@/components/InteractiveWizard' — multi-step questionnaire" : ''}
${existingPaths.includes('src/components/CsvUploader.tsx') ? "- CSV: import CsvUploader from '@/components/CsvUploader' — CSV upload + preview" : ''}
${existingPaths.includes('src/components/AiChatWidget.tsx') ? "- Chat: import AiChatWidget from '@/components/AiChatWidget' — AI chat with streaming" : ''}

## Rules:
- ALL code MUST be valid JavaScript/TypeScript. NEVER translate JS/TS keywords (return, function, const, let, import, export, if, else, class, etc.) to any other language. Code must compile without errors.
- ALL strings in error messages, console.log, throw, alert MUST be in ENGLISH. Never use Russian or other non-ASCII in code strings.
- Generate ONLY new files needed for the features above (typically 2-5 files)
- NEVER regenerate files that already exist in the EXISTING files list above — import from them instead
- Import from existing files using @/ aliases
- Use Tailwind CSS with inline styles for design system colors
- Each file must be COMPLETE and compilable
- 'use client' for components with state/effects
- Use lucide-react for icons
- Format: ===FILE: path=== before each file content
- DO NOT wrap code in markdown code blocks
- CRITICAL: Do NOT import from files that don't exist. If you need a type, define it inline in the file that uses it (e.g. \`interface InvoiceData { ... }\`). Do NOT create separate @/types/* files unless you also generate the file itself.
- If you generate a file that another file imports from, make sure to generate BOTH files.
- NEVER import from @/types/* — always define types inline where they are used.

## IMPORTANT — Do NOT import these packages (use built-in alternatives):
- uuid → use crypto.randomUUID() (built-in Node.js 19+)
- moment / dayjs → use Intl.DateTimeFormat or new Date().toLocaleDateString()
- lodash → use native JS (Array.prototype methods, structuredClone, etc.)
- axios → use fetch() (built-in)
- classnames / clsx → use template literals or conditional strings
- LoadingSpinner → use Spinner from @/components/LoadingStates

## Supabase client usage (CRITICAL — use the correct client for each file type):
- 'use client' components (src/components/, src/app/**/page.tsx with 'use client'): import { createClient } from '@/lib/supabase/client' (SYNC, no await on createClient, but MUST await on .auth.getUser() and .auth.getSession())
- API routes (src/app/api/**/route.ts): import { createClient } from '@/lib/supabase/server' (ASYNC, must await)
- Server components (src/app/**/page.tsx without 'use client'): import { createClient } from '@/lib/supabase/server' (ASYNC, must await)
- Utility/lib files (src/lib/**): use lazy admin client pattern:
  \`\`\`
  import { createClient, type SupabaseClient } from '@supabase/supabase-js';
  let _sb: SupabaseClient | null = null;
  function getSupabase() { if (!_sb) _sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!); return _sb; }
  \`\`\`
- NEVER use @supabase/auth-helpers-nextjs, createClientComponentClient, createRouteHandlerClient, createServerComponentClient
- Only use packages already in the project: next, react, tailwindcss, @supabase/supabase-js, @supabase/ssr, lucide-react, openai, stripe, recharts
- NEVER import 'resend' package. For sending emails, use fetch() to POST to /api/send-email which is already generated. Example: await fetch('/api/send-email', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ to, subject, body: text }) })
- For API routes (src/app/api/**/route.ts): add \`export const dynamic = 'force-dynamic';\` before the handler function
- NEVER initialize SDK clients (Supabase, Stripe, OpenAI) at module level — always use lazy initialization inside functions`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
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
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[gap-filler] Claude API error:', response.status);
      return {};
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    const files = parseDelimiterFormat(text);
    return sanitizeImports(files);
  } catch (err) {
    console.error('[gap-filler] Error:', err);
    return {};
  }
}

/**
 * Post-process generated files: replace problematic package imports
 * with built-in alternatives to prevent Vercel build failures.
 */
export function sanitizeImports(files: BlockResult): BlockResult {
  const sanitized: BlockResult = {};
  console.log(`[sanitizeImports] Processing ${Object.keys(files).length} files...`);

  for (const [path, content] of Object.entries(files)) {
    let code = content;

    // ─── STEP 0: Fix translated JS keywords that appear as CODE statements ───
    // Only replace Cyrillic words when they appear as actual code keywords
    // (at the start of a line/statement), NOT inside UI strings or JSX text.
    // Pattern: line starts with optional whitespace, then the keyword, then space/(
    const codeKeywordMap: [RegExp, string][] = [
      // These ONLY match at statement positions (start of line after whitespace)
      [/^(\s*)возврат(\s)/gm, '$1return$2'],
      [/^(\s*)возврат(\s*\()/gm, '$1return$2'],
      [/^(\s*)возврат;/gm, '$1return;'],
      [/^(\s*)функция\s/gm, '$1function '],
      [/^(\s*)конст\s/gm, '$1const '],
      [/^(\s*)пусть\s/gm, '$1let '],
      [/^(\s*)импорт\s/gm, '$1import '],
      [/^(\s*)экспорт\s/gm, '$1export '],
      [/^(\s*)если\s*\(/gm, '$1if ('],
      [/^(\s*)\}\s*иначе\s/gm, '$1} else '],
      [/^(\s*)иначе\s/gm, '$1else '],
      [/^(\s*)ожидать\s/gm, '$1await '],
      [/^(\s*)асинхронн(?:ый|ая|ое)\s/gm, '$1async '],
      [/^(\s*)класс\s/gm, '$1class '],
      [/^(\s*)бросить\s/gm, '$1throw '],
      [/^(\s*)попытка\s*\{/gm, '$1try {'],
      [/^(\s*)\}\s*поймать\s*\(/gm, '$1} catch ('],
      [/^(\s*)наконец\s*\{/gm, '$1finally {'],
      [/^(\s*)переключить\s*\(/gm, '$1switch ('],
      [/^(\s*)случай\s/gm, '$1case '],
      [/^(\s*)прервать;/gm, '$1break;'],
      [/^(\s*)продолжить;/gm, '$1continue;'],
      [/^(\s*)по\s*умолчанию:/gm, '$1default:'],
    ];

    let fixCount = 0;
    for (const [regex, replacement] of codeKeywordMap) {
      const before = code;
      code = code.replace(regex, replacement);
      if (code !== before) {
        fixCount++;
        console.log(`[sanitizeImports] ✅ Fixed keyword "${regex.source}" in ${path}`);
      }
    }
    if (fixCount > 0) {
      console.log(`[sanitizeImports] Fixed ${fixCount} translated keywords in ${path}`);
    }

    // ─── STEP 1: Replace problematic package imports ───
    // Replace: import { v4 as uuidv4 } from 'uuid' → crypto.randomUUID()
    code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"]uuid['"];?\n?/g, '');
    code = code.replace(/import\s+\w+\s+from\s*['"]uuid['"];?\n?/g, '');
    code = code.replace(/\buuidv4\(\)/g, 'crypto.randomUUID()');
    code = code.replace(/\buuid\.v4\(\)/g, 'crypto.randomUUID()');
    code = code.replace(/\bv4\(\)/g, 'crypto.randomUUID()');

    // Replace: import axios → fetch
    code = code.replace(/import\s+axios\s+from\s*['"]axios['"];?\n?/g, '');

    // Replace: import moment/dayjs
    code = code.replace(/import\s+\w+\s+from\s*['"]moment['"];?\n?/g, '');
    code = code.replace(/import\s+\w+\s+from\s*['"]dayjs['"];?\n?/g, '');

    // Remove: import { Resend } from 'resend' (not installed, use fetch to /api/send-email instead)
    code = code.replace(/import\s*\{[^}]*\}\s*from\s*['"]resend['"];?\n?/g, '');
    code = code.replace(/import\s+\w+\s+from\s*['"]resend['"];?\n?/g, '');

    // ─── STEP 2: Supabase context-aware replacement ───
    const isApiRoute = path.includes('app/api/') && path.endsWith('route.ts');
    const isClientComponent = code.includes("'use client'") || code.includes('"use client"');
    const isSupabaseClientFile = path.includes('lib/supabase/');
    const isLibFile = (path.includes('src/lib/') || path.includes('lib/')) && !isSupabaseClientFile;

    // Remove all deprecated supabase imports
    code = code.replace(
      /import\s*\{[^}]*\}\s*from\s*['"]@supabase\/auth-helpers-nextjs['"];?\n?/g, ''
    );

    // Replace deprecated function calls
    code = code.replace(/\bcreateClientComponentClient\s*(<[^>]*>)?\s*\(\s*\)/g, 'createClient()');
    code = code.replace(/\bcreateRouteHandlerClient\s*(<[^>]*>)?\s*\(\s*\{[^}]*\}\s*\)/g, 'await createClient()');
    code = code.replace(/\bcreateServerComponentClient\s*(<[^>]*>)?\s*\(\s*\{[^}]*\}\s*\)/g, 'await createClient()');

    if (isLibFile && !isApiRoute) {
      // Utility/lib files: use direct @supabase/supabase-js admin client (sync)
      // Replace any @/lib/supabase/* imports with direct client
      code = code.replace(
        /import\s*\{[^}]*createClient[^}]*\}\s*from\s*['"]@\/lib\/supabase\/(server|client)['"];?\n?/g, ''
      );
      // If file uses createClient but has no supabase import, add admin pattern
      if (/\bcreateClient\s*\(/.test(code) && !code.includes("from '@supabase/supabase-js'")) {
        const adminImport = [
          "import { createClient as _createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';",
          '',
          'let _supabaseAdmin: SupabaseClient | null = null;',
          'function getSupabase(): SupabaseClient {',
          '  if (!_supabaseAdmin) {',
          '    _supabaseAdmin = _createSupabaseClient(',
          '      process.env.NEXT_PUBLIC_SUPABASE_URL!,',
          '      process.env.SUPABASE_SERVICE_ROLE_KEY!',
          '    );',
          '  }',
          '  return _supabaseAdmin;',
          '}',
          '',
        ].join('\n');
        // Add admin pattern at the top (after 'use client' if present)
        const insertPos = code.indexOf('\n') + 1;
        code = code.slice(0, insertPos) + adminImport + code.slice(insertPos);
        // Replace createClient() calls with getSupabase()
        code = code.replace(/\bcreateClient\s*\(\s*\)/g, 'getSupabase()');
        // Remove any leftover await before getSupabase (it's sync)
        code = code.replace(/await\s+getSupabase\(\)/g, 'getSupabase()');
      }
    } else if (isApiRoute) {
      // API routes: use @/lib/supabase/server (async)
      if (!code.includes("from '@/lib/supabase/server'") && /\bcreateClient\b/.test(code)) {
        code = "import { createClient } from '@/lib/supabase/server';\n" + code;
      }
    } else if (isClientComponent) {
      // Client components: use @/lib/supabase/client (sync)
      if (!code.includes("from '@/lib/supabase/client'") && /\bcreateClient\b/.test(code)) {
        code = code.replace(
          /import\s*\{[^}]*createClient[^}]*\}\s*from\s*['"]@\/lib\/supabase\/server['"];?\n?/g,
          "import { createClient } from '@/lib/supabase/client';\n"
        );
        // Remove await before sync createClient
        code = code.replace(/await\s+createClient\(\)/g, 'createClient()');
      }
    }

    // Fix LoadingSpinner → Spinner (our block exports Spinner, not LoadingSpinner)
    code = code.replace(/\bLoadingSpinner\b/g, 'Spinner');

    // ─── STEP 2.3: Fix missing await on supabase.auth.getUser() ───
    // Pattern: `const { data: { user } } = supabase.auth.getUser()` → add await
    // Also handles: `const { data } = supabase.auth.getUser()` etc.
    code = code.replace(
      /(\bconst\s+\{[^}]*\}\s*=\s*)(supabase\.auth\.getUser\(\))/g,
      '$1await $2'
    );
    // Same for getSession()
    code = code.replace(
      /(\bconst\s+\{[^}]*\}\s*=\s*)(supabase\.auth\.getSession\(\))/g,
      '$1await $2'
    );
    // Prevent double-await
    code = code.replace(/await\s+await\s+/g, 'await ');

    // ─── STEP 2.4: Remove Russian strings from error messages / throw ───
    // Replace Cyrillic error messages with English equivalents
    code = code.replace(/['"]Пользователь не авторизован['"]/g, "'Not authenticated'");
    code = code.replace(/['"]Необходима авторизация['"]/g, "'Authentication required'");
    code = code.replace(/['"]Ошибка[^'"]*['"]/g, "'An error occurred'");
    code = code.replace(/['"]Загрузка[^'"]*['"]/g, "'Loading...'");
    code = code.replace(/['"]Сохранено[^'"]*['"]/g, "'Saved'");
    code = code.replace(/['"]Удалено[^'"]*['"]/g, "'Deleted'");

    // ─── STEP 2.5: Remove imports from @/types/* (gap-filler generates phantom type files) ───
    // Extract imported type names before removing, so we can replace usages with `any`
    const phantomTypeNames: string[] = [];
    code = code.replace(/import\s+type\s*\{([^}]*)\}\s*from\s*['"]@\/types\/[^'"]+['"];?\n?/g, (_match, names: string) => {
      names.split(',').forEach((n: string) => {
        const clean = n.trim().split(/\s+as\s+/).pop()?.trim();
        if (clean) phantomTypeNames.push(clean);
      });
      console.log(`[sanitizeImports] ⚠️ Removed phantom type import in ${path}: ${_match.trim()}`);
      return '';
    });
    code = code.replace(/import\s*\{([^}]*)\}\s*from\s*['"]@\/types\/[^'"]+['"];?\n?/g, (_match, names: string) => {
      names.split(',').forEach((n: string) => {
        const clean = n.trim().split(/\s+as\s+/).pop()?.trim();
        if (clean) phantomTypeNames.push(clean);
      });
      console.log(`[sanitizeImports] ⚠️ Removed phantom import in ${path}: ${_match.trim()}`);
      return '';
    });
    // Replace usages of removed types with `any` in type annotations
    for (const typeName of phantomTypeNames) {
      const typeUsageRegex = new RegExp(`:\\s*${typeName}\\b`, 'g');
      code = code.replace(typeUsageRegex, ': any');
      const genericUsageRegex = new RegExp(`<${typeName}>`, 'g');
      code = code.replace(genericUsageRegex, '<any>');
      console.log(`[sanitizeImports] ⚠️ Replaced type "${typeName}" with "any" in ${path}`);
    }

    // ─── STEP 3: Auto-add import React if file uses React. namespace ───
    if (/\.(tsx|jsx)$/.test(path) && /\bReact\./.test(code) && !code.includes("import React")) {
      // Add React to existing react import, or add new import
      if (code.includes("from 'react'")) {
        code = code.replace(
          /import\s*\{([^}]+)\}\s*from\s*'react'/,
          "import React, {$1} from 'react'"
        );
      } else {
        // Add at the very top (after 'use client' if present)
        const useClientMatch = code.match(/^(['"])use client\1;?\n?/);
        if (useClientMatch) {
          code = useClientMatch[0] + "import React from 'react';\n" + code.slice(useClientMatch[0].length);
        } else {
          code = "import React from 'react';\n" + code;
        }
      }
      console.log(`[sanitizeImports] ✅ Auto-added React import in ${path}`);
    }

    sanitized[path] = code;
  }

  return sanitized;
}

/**
 * Parse ===FILE: path=== delimiter format.
 * Same format used in code-generator.ts (proven reliable).
 */
export function parseDelimiterFormat(text: string): BlockResult {
  const files: BlockResult = {};
  const parts = text.split(/===FILE:\s*/);

  for (const part of parts) {
    if (!part.trim()) continue;
    const endMarker = part.indexOf('===');
    if (endMarker === -1) continue;

    const filePath = part.substring(0, endMarker).trim();
    let content = part.substring(endMarker + 3).trim();

    // Remove markdown code block wrappers if present
    content = content.replace(/^```\w*\n?/, '').replace(/\n?```\s*$/, '');

    if (filePath && content && filePath.includes('.')) {
      files[filePath] = content;
    }
  }

  return files;
}
