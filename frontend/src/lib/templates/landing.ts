/**
 * Landing + Waitlist Template
 *
 * Полностью функциональный лендинг со сбором email
 * Интеграция с Supabase для хранения подписчиков
 */

interface LandingContext {
  projectName: string;
  tagline: string;
  description: string;
  problemStatement: string;
  solutionOverview: string;
  features: Array<{ name: string; description: string }>;
  targetAudience: string;
  ctaText?: string;
}

// Функция для безопасного экранирования строк в JSX
function escapeJsx(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

export function generateLandingTemplate(context: LandingContext): Record<string, string> {
  const files: Record<string, string> = {};
  const sanitizedName = context.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // Экранируем все строки из контекста
  const safe = {
    projectName: escapeJsx(context.projectName),
    tagline: escapeJsx(context.tagline),
    description: escapeJsx(context.description),
    problemStatement: escapeJsx(context.problemStatement),
    solutionOverview: escapeJsx(context.solutionOverview),
    targetAudience: escapeJsx(context.targetAudience),
    ctaText: context.ctaText ? escapeJsx(context.ctaText) : 'Присоединиться',
    features: context.features.map(f => ({
      name: escapeJsx(f.name),
      description: escapeJsx(f.description),
    })),
  };

  // package.json - фиксированные версии для стабильного деплоя
  files['package.json'] = JSON.stringify({
    name: sanitizedName,
    version: '0.1.0',
    private: true,
    scripts: {
      dev: 'next dev',
      build: 'next build',
      start: 'next start',
      lint: 'next lint'
    },
    dependencies: {
      next: '14.2.15',
      react: '18.2.0',
      'react-dom': '18.2.0',
      '@supabase/supabase-js': '2.39.8',
      'lucide-react': '0.294.0',
      'framer-motion': '10.16.16'
    },
    devDependencies: {
      '@types/node': '20.10.6',
      '@types/react': '18.2.47',
      '@types/react-dom': '18.2.18',
      typescript: '5.3.3',
      tailwindcss: '3.4.0',
      postcss: '8.4.33',
      autoprefixer: '10.4.16',
      eslint: '8.56.0',
      'eslint-config-next': '14.2.15'
    },
    engines: {
      node: '>=18.17.0'
    }
  }, null, 2);

  // tsconfig.json
  files['tsconfig.json'] = JSON.stringify({
    compilerOptions: {
      target: 'es5',
      lib: ['dom', 'dom.iterable', 'esnext'],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: 'preserve',
      incremental: true,
      plugins: [{ name: 'next' }],
      paths: { '@/*': ['./src/*'] }
    },
    include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
    exclude: ['node_modules']
  }, null, 2);

  // next.config.js
  files['next.config.js'] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

module.exports = nextConfig;
`;

  // tailwind.config.ts
  files['tailwind.config.ts'] = `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
`;

  // postcss.config.js
  files['postcss.config.js'] = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  // .gitignore
  files['.gitignore'] = `# Dependencies
/node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
`;

  // .eslintrc.json
  files['.eslintrc.json'] = JSON.stringify({
    extends: ['next/core-web-vitals'],
    rules: {
      '@next/next/no-img-element': 'off',
      'react/no-unescaped-entities': 'off'
    }
  }, null, 2);

  // .nvmrc - указываем версию Node.js
  files['.nvmrc'] = '18.17.0';

  // .env.example
  files['.env.example'] = `# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

  // src/lib/supabase.ts
  files['src/lib/supabase.ts'] = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Типы для waitlist
export interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

// Добавление email в waitlist
export async function addToWaitlist(email: string, source?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('waitlist')
      .insert([{ email, source, created_at: new Date().toISOString() }]);

    if (error) {
      if (error.code === '23505') {
        return { success: false, error: 'Этот email уже зарегистрирован' };
      }
      console.error('Supabase error:', error);
      return { success: false, error: 'Произошла ошибка. Попробуйте позже.' };
    }

    return { success: true };
  } catch (err) {
    console.error('Waitlist error:', err);
    return { success: false, error: 'Произошла ошибка. Попробуйте позже.' };
  }
}

// Получение количества подписчиков
export async function getWaitlistCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Count error:', error);
      return 0;
    }

    return count || 0;
  } catch {
    return 0;
  }
}
`;

  // src/app/globals.css
  files['src/app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 255, 255, 255;
  --background-end-rgb: 245, 245, 245;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 10, 10, 12;
    --background-end-rgb: 15, 15, 20;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
      to bottom,
      transparent,
      rgb(var(--background-end-rgb))
    )
    rgb(var(--background-start-rgb));
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

/* Custom animations */
.animate-in {
  animation: slideUp 0.5s ease-out forwards;
}

.animate-in-delay-1 {
  animation: slideUp 0.5s ease-out 0.1s forwards;
  opacity: 0;
}

.animate-in-delay-2 {
  animation: slideUp 0.5s ease-out 0.2s forwards;
  opacity: 0;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
`;

  // src/app/layout.tsx
  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${safe.projectName}',
  description: '${safe.tagline}',
  openGraph: {
    title: '${safe.projectName}',
    description: '${safe.tagline}',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '${safe.projectName}',
    description: '${safe.tagline}',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;

  // Генерируем features JSX
  const featuresJSX = safe.features.slice(0, 6).map((f, i) => `
        <div key={${i}} className="group p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-zinc-800">
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <CheckCircle className="w-6 h-6 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">${f.name}</h3>
          <p className="text-gray-600 dark:text-gray-400">${f.description}</p>
        </div>`).join('\n');

  // src/app/page.tsx
  files['src/app/page.tsx'] = `'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle, Sparkles, Mail, Users, Zap } from 'lucide-react';
import { addToWaitlist, getWaitlistCount } from '@/lib/supabase';

export default function Home() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [waitlistCount, setWaitlistCount] = useState(0);

  useEffect(() => {
    // Загружаем количество подписчиков
    getWaitlistCount().then(count => setWaitlistCount(count));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || status === 'loading') return;

    setStatus('loading');

    const result = await addToWaitlist(email, 'landing');

    if (result.success) {
      setStatus('success');
      setMessage('Вы в списке! Мы свяжемся с вами.');
      setEmail('');
      setWaitlistCount(prev => prev + 1);
    } else {
      setStatus('error');
      setMessage(result.error || 'Произошла ошибка');
    }

    // Сбрасываем статус через 5 секунд
    setTimeout(() => {
      setStatus('idle');
      setMessage('');
    }, 5000);
  };

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-purple-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-indigo-950" />

        <div className="relative container mx-auto px-4 py-24 sm:py-32">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="animate-in inline-flex items-center px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-8">
              <Sparkles className="w-4 h-4 mr-2 text-primary-600" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                Скоро запуск • Присоединяйтесь к waitlist
              </span>
            </div>

            {/* Headline */}
            <h1 className="animate-in-delay-1 text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              ${safe.projectName}
            </h1>

            {/* Tagline */}
            <p className="animate-in-delay-2 text-xl sm:text-2xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              ${safe.tagline}
            </p>

            {/* Waitlist Form */}
            <form onSubmit={handleSubmit} className="animate-in-delay-2 max-w-md mx-auto">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ваш email"
                    required
                    disabled={status === 'loading'}
                    className="w-full pl-12 pr-4 py-4 rounded-xl border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-8 py-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40"
                >
                  {status === 'loading' ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      ${safe.ctaText}
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>

              {/* Status message */}
              {message && (
                <p className={\`mt-3 text-sm \${status === 'success' ? 'text-green-600' : 'text-red-600'}\`}>
                  {message}
                </p>
              )}
            </form>

            {/* Social proof */}
            {waitlistCount > 0 && (
              <div className="animate-in-delay-2 mt-6 flex items-center justify-center gap-2 text-gray-600 dark:text-gray-400">
                <Users className="w-5 h-5" />
                <span>{waitlistCount.toLocaleString()} человек уже в списке</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-gray-50 dark:bg-zinc-900/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
              <span className="text-sm font-medium text-red-700 dark:text-red-300">Проблема</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              ${context.problemStatement.split('.')[0]}
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              ${safe.problemStatement}
            </p>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
              <span className="text-sm font-medium text-green-700 dark:text-green-300">Решение</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              ${safe.projectName} решает эту проблему
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              ${safe.solutionOverview}
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-zinc-900/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-4">
              <Zap className="w-4 h-4 mr-2 text-primary-600" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">Возможности</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Что вы получите
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              ${safe.description}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            ${featuresJSX}
          </div>
        </div>
      </section>

      {/* Target Audience */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Для кого это?
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              ${safe.targetAudience}
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary-600 to-purple-700">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Готовы начать?
          </h2>
          <p className="text-lg text-primary-100 mb-8 max-w-xl mx-auto">
            Присоединяйтесь к waitlist и станьте одним из первых пользователей.
          </p>

          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ваш email"
                required
                className="flex-1 px-4 py-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/50 transition-all"
              />
              <button
                type="submit"
                disabled={status === 'loading'}
                className="px-8 py-4 bg-white text-primary-600 font-semibold rounded-xl hover:bg-primary-50 transition-all"
              >
                Присоединиться
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-gray-200 dark:border-zinc-800">
        <div className="container mx-auto px-4 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            © ${new Date().getFullYear()} ${safe.projectName}. Создано с TrendHunter AI.
          </p>
        </div>
      </footer>
    </main>
  );
}
`;

  // README.md
  files['README.md'] = `# ${safe.projectName}

${safe.tagline}

## Описание

${safe.description}

## Проблема

${safe.problemStatement}

## Решение

${safe.solutionOverview}

## Целевая аудитория

${safe.targetAudience}

## Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Database:** Supabase
- **Animations:** Framer Motion

## Быстрый старт

### 1. Установка

\`\`\`bash
npm install
\`\`\`

### 2. Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)
2. Создайте таблицу \`waitlist\`:

\`\`\`sql
create table waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  source text,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Индекс для быстрого поиска
create index waitlist_email_idx on waitlist(email);

-- RLS политики
alter table waitlist enable row level security;

create policy "Allow anonymous inserts" on waitlist
  for insert with check (true);

create policy "Allow authenticated reads" on waitlist
  for select using (auth.role() = 'authenticated');
\`\`\`

3. Скопируйте URL и anon key в \`.env.local\`:

\`\`\`
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
\`\`\`

### 3. Запуск

\`\`\`bash
npm run dev
\`\`\`

Откройте [http://localhost:3000](http://localhost:3000)

## Деплой на Vercel

1. Push в GitHub
2. Подключите репозиторий к Vercel
3. Добавьте environment variables
4. Deploy!

---

*Создано с [TrendHunter AI](https://trendhunter.ai)*
`;

  // SQL для Supabase
  files['supabase/schema.sql'] = `-- Waitlist table
create table if not exists waitlist (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  source text,
  metadata jsonb,
  created_at timestamp with time zone default now()
);

-- Индекс для быстрого поиска по email
create index if not exists waitlist_email_idx on waitlist(email);

-- Row Level Security
alter table waitlist enable row level security;

-- Политика: разрешить анонимные вставки
create policy "Allow anonymous inserts" on waitlist
  for insert with check (true);

-- Политика: только авторизованные могут читать
create policy "Allow authenticated reads" on waitlist
  for select using (auth.role() = 'authenticated');

-- Функция для подсчёта подписчиков
create or replace function get_waitlist_count()
returns integer as $$
  select count(*)::integer from waitlist;
$$ language sql security definer;
`;

  return files;
}
