/**
 * SaaS Dashboard Template
 *
 * Полноценное SaaS приложение с:
 * - Профессиональный Landing Page с множеством секций
 * - Demo режим авторизации (работает без Supabase)
 * - Dashboard с mock данными
 * - Pricing, Testimonials, FAQ
 */

interface SaaSContext {
  projectName: string;
  tagline: string;
  description: string;
  problemStatement: string;
  solutionOverview: string;
  features: Array<{ name: string; description: string }>;
  targetAudience: string;
  dashboardMetrics?: string[]; // Какие метрики показывать на dashboard
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

export function generateSaaSTemplate(context: SaaSContext): Record<string, string> {
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
    features: context.features.map(f => ({
      name: escapeJsx(f.name),
      description: escapeJsx(f.description),
    })),
    dashboardMetrics: context.dashboardMetrics?.map(m => escapeJsx(m)) || ['Пользователи', 'Конверсия', 'Доход', 'Активность'],
  };

  // package.json
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
      'lucide-react': '0.294.0',
      'framer-motion': '10.16.16',
      'recharts': '2.10.4'
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
        'float': 'float 6s ease-in-out infinite',
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
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
`;

  // .gitignore
  files['.gitignore'] = `# Dependencies
/node_modules

# Next.js
/.next/
/out/

# Misc
.DS_Store
*.pem

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

  // .nvmrc
  files['.nvmrc'] = '18.17.0';

  // postcss.config.js
  files['postcss.config.js'] = `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`;

  // src/lib/auth.ts - простая авторизация без Supabase
  files['src/lib/auth.ts'] = `// Простая демо-авторизация через localStorage
// В production замените на Supabase, NextAuth или другую систему

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
}

const STORAGE_KEY = 'demo_user';

export function getUser(): User | null {
  if (typeof window === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
}

export function setUser(user: User): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}

export function clearUser(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
}

export function login(email: string, password: string): { success: boolean; user?: User; error?: string } {
  // Demo: принимаем любые данные
  if (!email || !password) {
    return { success: false, error: 'Введите email и пароль' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Пароль должен быть не менее 6 символов' };
  }

  const user: User = {
    id: 'demo-' + Date.now(),
    email,
    name: email.split('@')[0],
  };
  setUser(user);
  return { success: true, user };
}

export function signup(name: string, email: string, password: string): { success: boolean; user?: User; error?: string } {
  if (!name || !email || !password) {
    return { success: false, error: 'Заполните все поля' };
  }
  if (password.length < 6) {
    return { success: false, error: 'Пароль должен быть не менее 6 символов' };
  }

  const user: User = {
    id: 'demo-' + Date.now(),
    email,
    name,
  };
  setUser(user);
  return { success: true, user };
}

export function logout(): void {
  clearUser();
}
`;

  // src/app/globals.css
  files['src/app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 255, 255, 255;
  --background-end-rgb: 249, 250, 251;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 17, 17, 27;
    --background-end-rgb: 9, 9, 11;
  }
}

body {
  color: rgb(var(--foreground-rgb));
  background: linear-gradient(
    to bottom,
    rgb(var(--background-start-rgb)),
    rgb(var(--background-end-rgb))
  );
}

/* Scroll animations */
.animate-on-scroll {
  opacity: 0;
  transform: translateY(20px);
  transition: all 0.6s ease-out;
}

.animate-on-scroll.visible {
  opacity: 1;
  transform: translateY(0);
}

/* Gradient text */
.gradient-text {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Glass effect */
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Smooth scroll */
html {
  scroll-behavior: smooth;
}
`;

  // src/app/layout.tsx
  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: '${safe.projectName} - ${safe.tagline}',
  description: '${safe.description}',
  openGraph: {
    title: '${safe.projectName}',
    description: '${safe.tagline}',
    type: 'website',
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

  // Генерируем features для страницы
  const featuresData = safe.features.slice(0, 6).map((f, i) => {
    const icons = ['Zap', 'Shield', 'BarChart3', 'Users', 'Clock', 'Star'];
    return { ...f, icon: icons[i] || 'CheckCircle' };
  });

  // src/app/page.tsx - Полноценная Landing Page
  files['src/app/page.tsx'] = `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, CheckCircle, Sparkles, Zap, Shield, BarChart3,
  Users, Clock, Star, Play, ChevronDown, Menu, X, Quote
} from 'lucide-react';

const features = [
  ${featuresData.map((f, i) => `{ name: '${f.name}', description: '${f.description}', icon: ${['Zap', 'Shield', 'BarChart3', 'Users', 'Clock', 'Star'][i] || 'CheckCircle'} }`).join(',\n  ')}
];

const testimonials = [
  {
    name: 'Алексей Петров',
    role: 'CEO, TechStartup',
    content: 'Это решение полностью изменило наш подход к работе. Рекомендую всем!',
    avatar: 'А',
  },
  {
    name: 'Мария Иванова',
    role: 'Product Manager',
    content: 'Наконец-то инструмент, который действительно решает нашу проблему. Отличная команда!',
    avatar: 'М',
  },
  {
    name: 'Дмитрий Сидоров',
    role: 'CTO, Enterprise Co',
    content: 'Интеграция заняла всего пару часов. Результаты превзошли ожидания.',
    avatar: 'Д',
  },
];

const pricingPlans = [
  {
    name: 'Starter',
    price: 'Бесплатно',
    description: 'Для начинающих',
    features: ['До 100 пользователей', 'Базовая аналитика', 'Email поддержка', '1 интеграция'],
    cta: 'Начать бесплатно',
    popular: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/мес',
    description: 'Для растущих команд',
    features: ['До 1000 пользователей', 'Расширенная аналитика', 'Приоритетная поддержка', 'Неограниченные интеграции', 'API доступ'],
    cta: 'Попробовать Pro',
    popular: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'Для больших компаний',
    features: ['Неограниченно', 'Полная аналитика', 'Персональный менеджер', 'SLA 99.9%', 'On-premise опция'],
    cta: 'Связаться',
    popular: false,
  },
];

const faqs = [
  {
    q: 'Как быстро можно начать работу?',
    a: 'Регистрация занимает менее минуты. Вы можете начать использовать платформу сразу после подтверждения email.',
  },
  {
    q: 'Есть ли бесплатный пробный период?',
    a: 'Да! Starter план полностью бесплатный. Также мы предоставляем 14-дневный trial для Pro плана без ограничений.',
  },
  {
    q: 'Какие интеграции поддерживаются?',
    a: 'Мы поддерживаем интеграции с популярными сервисами: Slack, Notion, Google Workspace, Microsoft 365 и многими другими.',
  },
  {
    q: 'Безопасны ли мои данные?',
    a: 'Абсолютно. Мы используем шифрование данных, соответствуем GDPR и SOC 2. Ваши данные в безопасности.',
  },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-gray-50 to-white dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-lg border-b border-gray-200 dark:border-zinc-800">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white">${safe.projectName}</span>
            </Link>

            {/* Desktop menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Возможности
              </a>
              <a href="#pricing" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Цены
              </a>
              <a href="#testimonials" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Отзывы
              </a>
              <a href="#faq" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                FAQ
              </a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <Link href="/login" className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors">
                Войти
              </Link>
              <Link
                href="/signup"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors"
              >
                Начать бесплатно
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white dark:bg-zinc-950 border-t border-gray-200 dark:border-zinc-800 py-4">
            <div className="container mx-auto px-4 space-y-4">
              <a href="#features" className="block text-gray-600 dark:text-gray-300">Возможности</a>
              <a href="#pricing" className="block text-gray-600 dark:text-gray-300">Цены</a>
              <a href="#testimonials" className="block text-gray-600 dark:text-gray-300">Отзывы</a>
              <a href="#faq" className="block text-gray-600 dark:text-gray-300">FAQ</a>
              <div className="pt-4 space-y-2">
                <Link href="/login" className="block text-center py-2 text-gray-600 dark:text-gray-300">
                  Войти
                </Link>
                <Link href="/signup" className="block text-center py-2 bg-primary-600 text-white rounded-lg">
                  Начать бесплатно
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-8">
              <Sparkles className="w-4 h-4 mr-2 text-primary-600" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
                Новый способ работы
              </span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              ${safe.projectName}
              <span className="block gradient-text">${safe.tagline}</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl mx-auto">
              ${safe.description}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/signup"
                className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-500/25 hover:shadow-primary-500/40 flex items-center justify-center gap-2"
              >
                Начать бесплатно <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/demo"
                className="px-8 py-4 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" /> Смотреть демо
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {['А', 'Б', 'В', 'Г'].map((letter, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium border-2 border-white dark:border-zinc-950">
                      {letter}
                    </div>
                  ))}
                </div>
                <span>2,000+ пользователей</span>
              </div>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
                <span className="ml-1">4.9/5 рейтинг</span>
              </div>
            </div>
          </motion.div>

          {/* Hero Image/Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="mt-16"
          >
            <div className="relative mx-auto max-w-4xl">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-purple-500/20 rounded-2xl blur-3xl" />
              <div className="relative bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
                <div className="h-8 bg-gray-100 dark:bg-zinc-800 flex items-center gap-2 px-4">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="p-6 min-h-[300px] bg-gradient-to-br from-gray-50 to-gray-100 dark:from-zinc-900 dark:to-zinc-800">
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    {['Users', 'Revenue', 'Growth', 'Active'].map((metric, i) => (
                      <div key={i} className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm">
                        <div className="text-xs text-gray-500 mb-1">{metric}</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">
                          {['2,345', '$12.5k', '+23%', '89%'][i]}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white dark:bg-zinc-800 rounded-xl p-4 shadow-sm h-40">
                    <div className="text-sm font-medium text-gray-900 dark:text-white mb-2">Активность</div>
                    <div className="flex items-end justify-between h-24 gap-2">
                      {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                        <div key={i} className="flex-1 bg-primary-500 rounded-t" style={{ height: h + '%' }} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-4 bg-red-50 dark:bg-red-950/20">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center px-3 py-1 bg-red-100 dark:bg-red-900/30 rounded-full mb-6">
            <span className="text-sm font-medium text-red-700 dark:text-red-300">Проблема</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            ${safe.problemStatement.split('.')[0]}
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            ${safe.problemStatement}
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-20 px-4 bg-green-50 dark:bg-green-950/20">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/30 rounded-full mb-6">
            <span className="text-sm font-medium text-green-700 dark:text-green-300">Решение</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-6">
            ${safe.projectName} решает эту проблему
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            ${safe.solutionOverview}
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-3 py-1 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-6">
              <Zap className="w-4 h-4 mr-2 text-primary-600" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">Возможности</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Всё, что вам нужно
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Мощные инструменты для решения ваших задач
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="group p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100 dark:border-zinc-800"
              >
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="w-6 h-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{feature.name}</h3>
                <p className="text-gray-600 dark:text-gray-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-gray-50 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Простые и прозрачные цены
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              Выберите план, который подходит вашей команде
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className={\`relative p-8 bg-white dark:bg-zinc-900 rounded-2xl border \${
                  plan.popular
                    ? 'border-primary-500 shadow-xl shadow-primary-500/10'
                    : 'border-gray-200 dark:border-zinc-800'
                }\`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-600 text-white text-xs font-medium rounded-full">
                    Популярный
                  </div>
                )}
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{plan.name}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">{plan.price}</span>
                    {plan.period && <span className="text-gray-500 dark:text-gray-400">{plan.period}</span>}
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={\`block w-full py-3 text-center font-medium rounded-xl transition-colors \${
                    plan.popular
                      ? 'bg-primary-600 hover:bg-primary-700 text-white'
                      : 'bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-900 dark:text-white'
                  }\`}
                >
                  {plan.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Что говорят наши клиенты
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
                className="p-6 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-zinc-800"
              >
                <Quote className="w-8 h-8 text-primary-500 mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-6">{testimonial.content}</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-medium">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{testimonial.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-4 bg-gray-50 dark:bg-zinc-900/50">
        <div className="container mx-auto max-w-3xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Часто задаваемые вопросы
            </h2>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800 overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{faq.q}</span>
                  <ChevronDown className={\`w-5 h-5 text-gray-500 transition-transform \${openFaq === i ? 'rotate-180' : ''}\`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-4 text-gray-600 dark:text-gray-400">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="relative overflow-hidden bg-gradient-to-br from-primary-600 to-purple-700 rounded-3xl p-12 text-center">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml,...')] opacity-10" />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Готовы начать?
              </h2>
              <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
                Присоединяйтесь к тысячам компаний, которые уже используют ${safe.projectName}
              </p>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-primary-600 font-semibold rounded-xl hover:bg-gray-100 transition-colors"
              >
                Попробовать бесплатно <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-gray-200 dark:border-zinc-800">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-gray-900 dark:text-white">${safe.projectName}</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500 dark:text-gray-400">
              <a href="#" className="hover:text-gray-900 dark:hover:text-white">О нас</a>
              <a href="#" className="hover:text-gray-900 dark:hover:text-white">Блог</a>
              <a href="#" className="hover:text-gray-900 dark:hover:text-white">Поддержка</a>
              <a href="#" className="hover:text-gray-900 dark:hover:text-white">Политика</a>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              © ${new Date().getFullYear()} ${safe.projectName}. Создано с TrendHunter AI.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
`;

  // src/app/login/page.tsx - Работает без Supabase
  files['src/app/login/page.tsx'] = `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { login, getUser } from '@/lib/auth';
import { Sparkles, Mail, Lock, Loader2, ArrowLeft } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Если уже залогинен - редирект на dashboard
    if (getUser()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Небольшая задержка для UX
    await new Promise(r => setTimeout(r, 500));

    const result = login(email, password);

    if (!result.success) {
      setError(result.error || 'Ошибка входа');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  const handleDemoLogin = () => {
    setEmail('demo@example.com');
    setPassword('demo123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 dark:from-zinc-950 dark:to-zinc-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">${safe.projectName}</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Войдите в свой аккаунт</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-zinc-800">
          {/* Demo notice */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Demo режим:</strong> Введите любой email и пароль (мин. 6 символов)
            </p>
            <button
              onClick={handleDemoLogin}
              className="mt-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 underline"
            >
              Заполнить демо-данные
            </button>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Войти'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Нет аккаунта?{' '}
            <Link href="/signup" className="text-primary-600 hover:text-primary-700 font-medium">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
`;

  // src/app/signup/page.tsx
  files['src/app/signup/page.tsx'] = `'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signup, getUser } from '@/lib/auth';
import { Sparkles, Mail, Lock, User, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';

export default function SignupPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (getUser()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    await new Promise(r => setTimeout(r, 500));

    const result = signup(name, email, password);

    if (!result.success) {
      setError(result.error || 'Ошибка регистрации');
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-gray-50 dark:from-zinc-950 dark:to-zinc-900 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            <ArrowLeft className="w-4 h-4" />
            На главную
          </Link>
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Создать аккаунт</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Начните работу с ${safe.projectName}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-zinc-800">
          {/* Benefits */}
          <div className="mb-6 space-y-2">
            {['14 дней Pro бесплатно', 'Без кредитной карты', 'Отмена в любой момент'].map((benefit, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <CheckCircle className="w-4 h-4 text-green-500" />
                {benefit}
              </div>
            ))}
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Имя
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Ваше имя"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="email@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Пароль
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-xl bg-white dark:bg-zinc-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Минимум 6 символов"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Создать аккаунт'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-primary-600 hover:text-primary-700 font-medium">
              Войти
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-gray-500 dark:text-gray-500">
            Регистрируясь, вы соглашаетесь с{' '}
            <a href="#" className="underline">условиями использования</a>
          </p>
        </div>
      </div>
    </div>
  );
}
`;

  // src/app/demo/page.tsx - Демо страница
  files['src/app/demo/page.tsx'] = `'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Sparkles, ArrowLeft, Play, Pause } from 'lucide-react';

export default function DemoPage() {
  const [playing, setPlaying] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 dark:from-zinc-950 dark:to-zinc-900">
      <div className="container mx-auto px-4 py-8">
        <Link href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 mb-8">
          <ArrowLeft className="w-4 h-4" />
          На главную
        </Link>

        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Демонстрация ${safe.projectName}
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Посмотрите, как работает наша платформа
          </p>

          {/* Video placeholder */}
          <div className="relative aspect-video bg-gray-900 rounded-2xl overflow-hidden mb-8">
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => setPlaying(!playing)}
                className="w-20 h-20 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
              >
                {playing ? (
                  <Pause className="w-8 h-8 text-white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" />
                )}
              </button>
            </div>
            <div className="absolute bottom-4 left-4 right-4">
              <div className="h-1 bg-white/20 rounded-full">
                <div className="h-full w-1/3 bg-primary-500 rounded-full" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-colors"
            >
              Попробовать бесплатно
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Войти в аккаунт
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

  // src/app/dashboard/page.tsx
  files['src/app/dashboard/page.tsx'] = `'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, logout, User } from '@/lib/auth';
import {
  Sparkles, LayoutDashboard, Settings, LogOut, Menu, X,
  TrendingUp, Users, Activity, DollarSign, Bell, Search,
  BarChart3, Calendar, FileText, HelpCircle, ChevronRight
} from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const currentUser = getUser();
    if (!currentUser) {
      router.push('/login');
      return;
    }
    setUser(currentUser);
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const metrics = [
    { label: '${safe.dashboardMetrics[0] || 'Пользователи'}', value: '2,345', change: '+12.5%', positive: true, icon: Users, color: 'bg-blue-500' },
    { label: '${safe.dashboardMetrics[1] || 'Сессии'}', value: '12,543', change: '+8.2%', positive: true, icon: Activity, color: 'bg-green-500' },
    { label: '${safe.dashboardMetrics[2] || 'Конверсия'}', value: '3.24%', change: '-0.4%', positive: false, icon: TrendingUp, color: 'bg-purple-500' },
    { label: '${safe.dashboardMetrics[3] || 'Доход'}', value: '$45,231', change: '+23.1%', positive: true, icon: DollarSign, color: 'bg-yellow-500' },
  ];

  const recentActivity = [
    { user: 'Алексей П.', action: 'создал новый проект', time: '2 мин назад' },
    { user: 'Мария И.', action: 'обновила настройки', time: '15 мин назад' },
    { user: 'Дмитрий С.', action: 'добавил команду', time: '1 час назад' },
    { user: 'Елена К.', action: 'экспортировала отчёт', time: '2 часа назад' },
  ];

  const quickActions = [
    { label: 'Создать проект', icon: FileText, href: '#' },
    { label: 'Пригласить команду', icon: Users, href: '#' },
    { label: 'Настроить интеграции', icon: Settings, href: '#' },
    { label: 'Просмотреть отчёты', icon: BarChart3, href: '#' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={\`fixed top-0 left-0 z-50 h-screen w-64 bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-800 transform transition-transform lg:translate-x-0 \${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}\`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white">${safe.projectName}</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2 text-primary-600 bg-primary-50 dark:bg-primary-900/20 rounded-lg font-medium"
          >
            <LayoutDashboard className="w-5 h-5" />
            Dashboard
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <BarChart3 className="w-5 h-5" />
            Аналитика
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <Calendar className="w-5 h-5" />
            Календарь
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <FileText className="w-5 h-5" />
            Документы
          </Link>
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg"
          >
            <Settings className="w-5 h-5" />
            Настройки
          </Link>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-zinc-800">
          <Link
            href="#"
            className="flex items-center gap-3 px-3 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg mb-2"
          >
            <HelpCircle className="w-5 h-5" />
            Помощь
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            <LogOut className="w-5 h-5" />
            Выйти
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
                <Menu className="w-6 h-6 text-gray-600 dark:text-gray-400" />
              </button>
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Поиск..."
                  className="pl-9 pr-4 py-2 w-64 bg-gray-100 dark:bg-zinc-800 border-0 rounded-lg text-sm focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="relative p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center text-white font-medium">
                  {user.name[0].toUpperCase()}
                </div>
                <div className="hidden sm:block">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{user.name}</div>
                  <div className="text-xs text-gray-500">{user.email}</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard content */}
        <main className="p-6">
          {/* Welcome */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Привет, {user.name}! 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Вот обзор вашей активности за сегодня
            </p>
          </div>

          {/* Metrics */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metrics.map((metric, i) => (
              <div key={i} className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-gray-200 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-4">
                  <div className={\`w-10 h-10 \${metric.color} rounded-lg flex items-center justify-center\`}>
                    <metric.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className={\`text-sm font-medium \${metric.positive ? 'text-green-600' : 'text-red-600'}\`}>
                    {metric.change}
                  </span>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Chart */}
            <div className="lg:col-span-2 bg-white dark:bg-zinc-900 rounded-xl p-6 border border-gray-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Обзор активности
              </h2>
              <div className="h-64 flex items-end justify-between gap-2">
                {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((day, i) => {
                  const height = [65, 80, 45, 90, 70, 40, 55][i];
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-2">
                      <div className="w-full flex flex-col justify-end h-48">
                        <div
                          className="w-full bg-gradient-to-t from-primary-500 to-primary-400 rounded-t"
                          style={{ height: height + '%' }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{day}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-zinc-900 rounded-xl p-6 border border-gray-200 dark:border-zinc-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Быстрые действия
              </h2>
              <div className="space-y-2">
                {quickActions.map((action, i) => (
                  <Link
                    key={i}
                    href={action.href}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                        <action.icon className="w-4 h-4 text-primary-600" />
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{action.label}</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="mt-6 bg-white dark:bg-zinc-900 rounded-xl p-6 border border-gray-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Последняя активность
            </h2>
            <div className="space-y-4">
              {recentActivity.map((item, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-400 to-purple-500 flex items-center justify-center text-white text-xs font-medium">
                    {item.user[0]}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900 dark:text-white">
                      <span className="font-medium">{item.user}</span> {item.action}
                    </p>
                    <p className="text-xs text-gray-500">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
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

## Функции

${safe.features.map(f => `- **${f.name}:** ${f.description}`).join('\n')}

## Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Charts:** Recharts
- **Icons:** Lucide React

## Быстрый старт

\`\`\`bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm run dev
\`\`\`

Откройте [http://localhost:3000](http://localhost:3000)

## Демо-режим

Приложение работает в демо-режиме без необходимости настройки базы данных:
- Используйте любой email и пароль (мин. 6 символов) для входа
- Данные сохраняются в localStorage браузера

## Структура проекта

\`\`\`
src/
├── app/
│   ├── page.tsx          # Landing page
│   ├── login/            # Страница входа
│   ├── signup/           # Страница регистрации
│   ├── demo/             # Демо страница
│   └── dashboard/        # Dashboard
├── lib/
│   └── auth.ts           # Демо-авторизация
└── globals.css           # Стили
\`\`\`

## Деплой на Vercel

1. Push в GitHub
2. Подключите репозиторий к [Vercel](https://vercel.com)
3. Deploy! (никаких env переменных не требуется для демо-режима)

## Production

Для production замените демо-авторизацию на:
- [Supabase Auth](https://supabase.com/auth)
- [NextAuth.js](https://next-auth.js.org/)
- [Clerk](https://clerk.com/)

---

*Создано с [TrendHunter AI](https://trendhunter.ai)*
`;

  return files;
}
