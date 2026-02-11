/**
 * Code Generator - Claude API based code generation
 *
 * This module exports the code generation function that can be called directly
 * without HTTP timeouts (used by create-project)
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Types
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

// System prompt for Claude
const SYSTEM_PROMPT = `Ты - эксперт Full-Stack разработчик, специализирующийся на создании ФУНКЦИОНАЛЬНЫХ ПРОТОТИПОВ.

Твоя задача - сгенерировать ПОЛНЫЙ, РАБОЧИЙ код проекта на основе спецификации.
НЕ MVP с заглушками, а ФУНКЦИОНАЛЬНЫЙ ПРОТОТИП с реальными интеграциями.

## ⚠️ КРИТИЧЕСКИ ВАЖНО: РЕАЛЬНЫЙ КОД, НЕ ЗАГЛУШКИ!

### 🚫 АБСОЛЮТНО ЗАПРЕЩЕНО:
1. **Fake Data** - НЕ создавай массивы с фейковыми данными (mockData, dummyUsers, sampleItems)
2. **Placeholder onClick** - НЕ создавай кнопки без реальной логики
3. **Декоративные компоненты** - НЕ создавай UI который ничего не делает
4. **"Подключить позже"** - НЕ оставляй комментарии типа "// TODO: connect to API"
5. **Имитация авторизации** - НЕ создавай fake login/logout без реального auth

### ✅ ОБЯЗАТЕЛЬНО ДЛЯ КАЖДОЙ ИНТЕГРАЦИИ:

**Если фича требует авторизации через сервис (Google, GitHub, Mailchimp, etc.):**
1. \`/api/auth/[provider]/route.ts\` - инициация OAuth flow с redirect
2. \`/api/auth/[provider]/callback/route.ts\` - обработка callback, получение токенов
3. \`/lib/tokens.ts\` - сохранение токенов (cookies/localStorage/Supabase)
4. \`/lib/[provider]-client.ts\` - API wrapper для работы с сервисом
5. В UI: реальная кнопка "Connect" которая редиректит на OAuth

**Если фича показывает данные из внешнего сервиса:**
1. API route который РЕАЛЬНО запрашивает данные (fetch с токеном)
2. Обработка ошибок (401 → redirect на реавторизацию)
3. Loading states в UI
4. Empty states если данных нет

**Если фича требует платежей:**
1. \`/api/stripe/create-checkout/route.ts\` - создание Stripe Checkout Session
2. \`/api/stripe/webhook/route.ts\` - обработка успешных платежей
3. \`/lib/stripe.ts\` - Stripe SDK initialization

### 📁 ОБЯЗАТЕЛЬНЫЕ ФАЙЛЫ (ВСЕГДА СОЗДАВАЙ!):

1. **package.json** - с ВСЕМИ нужными dependencies (stripe, @supabase/supabase-js, etc.)
2. **.env.example** - ВСЕ ключи которые нужны для работы
3. **supabase/schema.sql** - SQL для создания таблиц
4. **src/lib/supabase.ts** - ОБЯЗАТЕЛЬНО! Клиент Supabase (createClientComponentClient, createServerComponentClient)
5. **README.md** - инструкции по настройке КАЖДОГО сервиса
6. **tailwind.config.ts** - конфигурация Tailwind с кастомными цветами
7. **tsconfig.json** - с path aliases (@/*)
8. **next.config.js** - конфигурация Next.js

### ⚠️ КРИТИЧЕСКОЕ ПРАВИЛО: DEPENDENCY RESOLUTION

**ПЕРЕД ОТПРАВКОЙ ОТВЕТА ПРОВЕРЬ:**
Каждый файл который ты создаёшь может импортировать ТОЛЬКО:
1. npm packages из package.json (react, next, @supabase/supabase-js, etc.)
2. Другие файлы которые ты ТАКЖЕ создал в этом же ответе

**ЗАПРЕЩЕНО:**
- import { supabase } from '@/lib/supabase' → если src/lib/supabase.ts НЕ создан
- import { stripe } from '@/lib/stripe' → если src/lib/stripe.ts НЕ создан
- import { SomeComponent } from '@/components/X' → если X.tsx НЕ создан

**Если API route использует Supabase, ты ДОЛЖЕН создать src/lib/supabase.ts:**
\`\`\`typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
\`\`\`

**Если используешь Stripe, ДОЛЖЕН создать src/lib/stripe.ts:**
\`\`\`typescript
// src/lib/stripe.ts
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});
\`\`\`

### 🎯 DERIVED FEATURES = ПРИОРИТЕТ!

Ты получаешь derived_features - фичи, ВЫВЕДЕННЫЕ ИЗ РЕАЛЬНЫХ БОЛЕЙ ПОЛЬЗОВАТЕЛЕЙ.
Каждая фича = КОНКРЕТНАЯ ПРОБЛЕМА которую нужно РЕШИТЬ РЕАЛЬНЫМ КОДОМ.

## Технические требования:
- Stack: Next.js 14 (App Router), TypeScript, Tailwind CSS
- Auth: Supabase Auth или NextAuth.js
- DB: Supabase (PostgreSQL)
- Payments: Stripe Checkout
- Компоненты: React Client Components для интерактивности
- Styling: Tailwind CSS с кастомными цветами для бренда
- lucide-react для иконок

## Структура ответа:
Верни JSON объект где ключи - пути к файлам, значения - содержимое файлов.

{
  "package.json": "...",
  ".env.example": "...",
  "supabase/schema.sql": "...",
  "src/app/page.tsx": "...",
  "src/app/api/auth/[provider]/route.ts": "...",
  "src/lib/supabase.ts": "..."
}

## Финальная проверка перед ответом:
1. ✅ Каждая кнопка имеет реальный onClick с логикой
2. ✅ Каждый API route делает реальные запросы
3. ✅ .env.example содержит ВСЕ нужные ключи
4. ✅ Нет массивов с fake data
5. ✅ OAuth интеграции имеют authorize + callback
6. ✅ IMPORT CHECK: Каждый import '@/lib/X' → файл src/lib/X.ts СОЗДАН
7. ✅ IMPORT CHECK: Каждый import '@/components/X' → файл СОЗДАН
8. ✅ src/lib/supabase.ts СОЗДАН если хоть один файл использует Supabase
9. ✅ Код компилируется: npm install && npm run build проходит без ошибок

Верни ТОЛЬКО JSON без markdown блоков.`;

// Validation and auto-fix for generated files
function validateAndFixGeneratedFiles(files: GeneratedFiles): GeneratedFiles {
  const fixedFiles = { ...files };
  const allFilePaths = Object.keys(files);
  const missingImports: string[] = [];

  // Standard supabase.ts if missing
  const SUPABASE_CLIENT = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client with service role (for API routes)
export function createServerSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
`;

  // Standard stripe.ts if missing
  const STRIPE_CLIENT = `import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set');
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});
`;

  // Scan all files for @/lib/* and @/components/* imports
  for (const [filePath, content] of Object.entries(files)) {
    if (typeof content !== 'string') continue;

    // Find @/lib/* imports
    const libImports = content.match(/from\s+['"]@\/lib\/([^'"]+)['"]/g) || [];
    for (const imp of libImports) {
      const match = imp.match(/from\s+['"]@\/lib\/([^'"]+)['"]/);
      if (match) {
        const libName = match[1].replace(/\.ts$/, '');
        const expectedPath = `src/lib/${libName}.ts`;
        const altPath = `src/lib/${libName}/index.ts`;

        if (!allFilePaths.includes(expectedPath) && !allFilePaths.includes(altPath)) {
          missingImports.push(`${filePath} imports @/lib/${libName} but ${expectedPath} not found`);

          // Auto-create critical files
          if (libName === 'supabase' && !fixedFiles['src/lib/supabase.ts']) {
            console.log('[code-generator] Auto-adding missing src/lib/supabase.ts');
            fixedFiles['src/lib/supabase.ts'] = SUPABASE_CLIENT;
          }
          if (libName === 'stripe' && !fixedFiles['src/lib/stripe.ts']) {
            console.log('[code-generator] Auto-adding missing src/lib/stripe.ts');
            fixedFiles['src/lib/stripe.ts'] = STRIPE_CLIENT;
          }
        }
      }
    }

    // Find @/components/* imports
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
    console.warn('[code-generator] Import validation warnings:', missingImports);
  }

  console.log(`[code-generator] Validation complete: ${Object.keys(fixedFiles).length} files (${missingImports.length} warnings)`);
  return fixedFiles;
}

/**
 * Generate code using Claude API
 * Can be called directly without HTTP timeout issues
 */
export async function generateCodeWithClaude(spec: ProjectSpec): Promise<GeneratedFiles> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const userPrompt = `Создай ФУНКЦИОНАЛЬНЫЙ ПРОТОТИП (не MVP с заглушками!) на основе этой спецификации:

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

${spec.derived_features?.length ? `## 🎯 DERIVED FEATURES — ФИЧИ ИЗ РЕАЛЬНЫХ БОЛЕЙ (ГЛАВНЫЙ ПРИОРИТЕТ!)

${spec.derived_features.map((f, i) => `
### ${i + 1}. ${f.feature_name} [${f.priority}]
- **Источник боли:** ${f.pain_source}
- **Цитата:** "${f.pain_quote}"
- **Наше решение:** ${f.solution}
- **Как реализовать:** ${f.implementation_hint}

🔧 **Требования к реализации:**
${f.implementation_hint.toLowerCase().includes('oauth') || f.implementation_hint.toLowerCase().includes('интеграц') || f.implementation_hint.toLowerCase().includes('api') ?
`- Создай ПОЛНЫЙ OAuth flow (authorize + callback + token storage)
- Создай API wrapper для работы с сервисом
- Добавь ключи в .env.example` : ''}
${f.implementation_hint.toLowerCase().includes('ai') || f.implementation_hint.toLowerCase().includes('генерац') ?
`- Создай API route который реально вызывает OpenAI/Claude
- Добавь OPENAI_API_KEY в .env.example` : ''}
${f.implementation_hint.toLowerCase().includes('данн') || f.implementation_hint.toLowerCase().includes('сохран') ?
`- Используй Supabase для хранения данных
- Добавь SQL schema в supabase/schema.sql` : ''}
`).join('\n')}

⚠️ КРИТИЧЕСКИ ВАЖНО:
- Каждая фича должна РАБОТАТЬ, а не быть заглушкой
- Если нужна интеграция → полный OAuth flow
- Если нужны данные → реальный API запрос
- НИКАКИХ fake data или mock arrays!
` : ''}

## Core Features (ДОЛЖНЫ БЫТЬ РЕАЛИЗОВАНЫ):
${spec.mvp_specification.core_features.map((f, i) => `
${i + 1}. **${f.name}** (${f.priority})
   - Описание: ${f.description}
   - User Story: ${f.user_story}
   - Критерии приёмки: ${f.acceptance_criteria.join('; ')}
`).join('\n')}

${spec.design_system ? `## Дизайн система
**Цвета:**
- Primary: ${spec.design_system.color_palette.primary}
- Secondary: ${spec.design_system.color_palette.secondary}
- Accent: ${spec.design_system.color_palette.accent}
- Background: ${spec.design_system.color_palette.background}
- Text: ${spec.design_system.color_palette.text}

**Шрифты:**
- Headings: ${spec.design_system.typography.headings}
- Body: ${spec.design_system.typography.body}

**Уникальные элементы:**
${spec.design_system.unique_elements.map(el => `- ${el}`).join('\n')}

**Обоснование дизайна:** ${spec.design_system.design_rationale}

ВАЖНО: В tailwind.config.ts добавь эти цвета как кастомные (primary, secondary, accent).
В layout.tsx добавь Google Fonts для указанных шрифтов.
Используй эти цвета ВЕЗДЕ в проекте вместо дефолтных tailwind цветов.
` : ''}

---

## 📋 ЧЕКЛИСТ ПЕРЕД ГЕНЕРАЦИЕЙ:

1. ✅ .env.example содержит ВСЕ ключи (Supabase, Stripe, OAuth providers, OpenAI)
2. ✅ supabase/schema.sql если нужна БД
3. ✅ Каждая интеграция = полный OAuth flow (authorize + callback + token)
4. ✅ API routes делают РЕАЛЬНЫЕ запросы к сервисам
5. ✅ НЕТ массивов с fake/mock/dummy data
6. ✅ Каждая кнопка имеет РЕАЛЬНЫЙ onClick с логикой
7. ✅ README.md с инструкциями настройки каждого сервиса

${spec.derived_features?.length ? '⚠️ ПРИОРИТЕТ: Сначала реализуй derived_features, потом core_features!' : ''}
Код должен компилироваться и работать после: npm install && настройка .env.local && npm run dev

Верни JSON с файлами проекта.`;

  // Log what Claude will receive
  console.log('[code-generator] derived_features count:', spec.derived_features?.length || 0);
  if (spec.derived_features?.length) {
    console.log('[code-generator] Features to implement:');
    spec.derived_features.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.feature_name} [${f.priority}]: "${f.pain_quote}" → ${f.solution}`);
    });
  }

  // No timeout here - let it run as long as needed
  // The caller can implement their own timeout if needed

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('[code-generator] Claude API error:', error);
    throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '';
  const stopReason = data.stop_reason;

  // Check if response was truncated
  if (stopReason === 'max_tokens') {
    console.error('[code-generator] Response was truncated (max_tokens reached)');
    console.error('[code-generator] Response length:', content.length, 'chars');
    throw new Error('Claude response truncated - need more tokens');
  }

  // Parse JSON from response
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsedFiles = JSON.parse(jsonMatch[0]);
    // Validate and auto-fix missing dependencies
    return validateAndFixGeneratedFiles(parsedFiles);
  }

  throw new Error('No JSON found in response');
}
