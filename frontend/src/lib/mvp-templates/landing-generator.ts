/**
 * Landing + Waitlist MVP Generator
 *
 * Генерирует профессиональный лендинг с:
 * - Hero секцией
 * - Features секцией
 * - Social proof
 * - Email сбором
 * - Современным дизайном
 */

import { MVPGenerationContext, LandingConfig } from './types';

// Безопасное экранирование строк для JSX
function escapeJsx(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"');
}

/**
 * Генерирует конфигурацию лендинга на основе контекста анализа
 */
export function generateLandingConfig(context: MVPGenerationContext): LandingConfig {
  const mainPain = context.analysis?.main_pain || context.trend.title;
  const painPoints = context.analysis?.key_pain_points || [];
  const opportunities = context.analysis?.opportunities || [];

  // Генерируем benefits из pain points
  const benefits = painPoints.slice(0, 3).map((pain, i) => {
    return `Решаем проблему: ${pain}`;
  });

  if (benefits.length < 3) {
    benefits.push('Экономьте время на рутинных задачах');
    benefits.push('Получайте результаты быстрее');
    benefits.push('Масштабируйте без лишних затрат');
  }

  // Генерируем features
  const features: LandingConfig['features'] = [
    {
      icon: '⚡',
      title: 'Быстрый старт',
      description: 'Начните использовать за считанные минуты без сложной настройки',
    },
    {
      icon: '🎯',
      title: 'Точные результаты',
      description: painPoints[0] ? `Решаем: ${painPoints[0]}` : 'Получайте именно то, что вам нужно',
    },
    {
      icon: '💡',
      title: 'Умные решения',
      description: painPoints[1] ? `Решаем: ${painPoints[1]}` : 'AI-powered подход к вашим задачам',
    },
    {
      icon: '📈',
      title: 'Рост бизнеса',
      description: opportunities[0] || 'Масштабируйтесь без ограничений',
    },
    {
      icon: '🔒',
      title: 'Безопасность',
      description: 'Ваши данные защищены по высшим стандартам',
    },
    {
      icon: '🤝',
      title: 'Поддержка 24/7',
      description: 'Всегда на связи, чтобы помочь вам',
    },
  ];

  return {
    productName: context.pitch?.company_name || context.trend.title,
    tagline: context.pitch?.tagline || `Решение для ${mainPain}`,
    problemStatement: mainPain,
    solutionBenefits: benefits.slice(0, 3),
    ctaText: 'Получить ранний доступ',
    features,
  };
}

/**
 * Генерирует все файлы для Landing MVP
 */
export function generateLandingFiles(context: MVPGenerationContext): Record<string, string> {
  const config = generateLandingConfig(context);
  const files: Record<string, string> = {};

  const projectName = config.productName;
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  const safe = {
    projectName: escapeJsx(projectName),
    tagline: escapeJsx(config.tagline),
    problemStatement: escapeJsx(config.problemStatement),
    ctaText: escapeJsx(config.ctaText),
    benefits: config.solutionBenefits.map(escapeJsx),
    features: config.features.map(f => ({
      icon: f.icon,
      title: escapeJsx(f.title),
      description: escapeJsx(f.description),
    })),
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
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
        },
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
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
  files['.gitignore'] = `node_modules
.next
.env
.env.local
.DS_Store
*.tsbuildinfo
next-env.d.ts
.vercel
`;

  // .env.example
  files['.env.example'] = `# Supabase (опционально, для хранения email)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# Resend (опционально, для отправки email)
RESEND_API_KEY=re_xxx
`;

  // src/app/globals.css
  files['src/app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground: 255 255 255;
  --background: 0 0 0;
}

body {
  color: rgb(var(--foreground));
  background: rgb(var(--background));
}

/* Градиентный текст */
.gradient-text {
  background: linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f97316 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Градиентная граница */
.gradient-border {
  position: relative;
  background: linear-gradient(#000, #000) padding-box,
              linear-gradient(135deg, #a855f7, #ec4899) border-box;
  border: 2px solid transparent;
}

/* Свечение */
.glow {
  box-shadow: 0 0 60px rgba(168, 85, 247, 0.3);
}

/* Анимация появления */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeInUp {
  animation: fadeInUp 0.6s ease-out forwards;
}

/* Стилизация скроллбара */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #1a1a1a;
}
::-webkit-scrollbar-thumb {
  background: #333;
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: #444;
}
`;

  // src/app/layout.tsx
  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: '${safe.projectName} - ${safe.tagline}',
  description: '${safe.problemStatement}',
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

  // Генерируем features JSX
  const featuresJsx = safe.features.map((f, i) => `
            <div
              key="${i}"
              className="group p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-purple-500/50 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
                ${f.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">${f.title}</h3>
              <p className="text-zinc-400 text-sm">${f.description}</p>
            </div>`).join('\n');

  // src/app/page.tsx - Главная страница (лендинг)
  files['src/app/page.tsx'] = `'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle, ArrowRight, Sparkles, Star, Users, Zap } from 'lucide-react';

export default function Home() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [subscriberCount, setSubscriberCount] = useState(147);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || isSubmitting) return;

    // Валидация email
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Введите корректный email');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Здесь можно добавить реальную отправку на API
      // await fetch('/api/subscribe', { method: 'POST', body: JSON.stringify({ email }) });

      // Симуляция отправки
      await new Promise(resolve => setTimeout(resolve, 1000));

      setIsSubmitted(true);
      setSubscriberCount(prev => prev + 1);

      // Сохраняем в localStorage для демо
      const subscribers = JSON.parse(localStorage.getItem('subscribers') || '[]');
      subscribers.push({ email, date: new Date().toISOString() });
      localStorage.setItem('subscribers', JSON.stringify(subscribers));

    } catch (err) {
      setError('Произошла ошибка. Попробуйте позже.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '4s' }} />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-zinc-800/50 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg">${safe.projectName}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden md:flex items-center gap-2 text-sm text-zinc-400">
              <Users className="w-4 h-4" />
              {subscriberCount}+ в waitlist
            </span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-4 pt-20 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-8">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            <span className="text-sm text-zinc-300">Ранний доступ открыт</span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            ${safe.projectName.split(' ').map((word, i) =>
              i === 0 ? `<span className="gradient-text">${word}</span>` : word
            ).join(' ')}
          </h1>

          {/* Subheadline */}
          <p className="text-xl md:text-2xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            ${safe.tagline}
          </p>

          {/* Benefits */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            ${safe.benefits.map((benefit, i) => `
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 border border-zinc-800">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm">${benefit}</span>
            </div>`).join('\n')}
          </div>

          {/* Email Form */}
          {!isSubmitted ? (
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Ваш email"
                    className="w-full px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-4 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 font-semibold flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      ${safe.ctaText}
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
              {error && (
                <p className="text-red-400 text-sm mt-2">{error}</p>
              )}
              <p className="text-zinc-500 text-sm mt-4">
                Присоединяйтесь к {subscriberCount}+ людям в waitlist. Никакого спама.
              </p>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-md mx-auto p-6 rounded-2xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20"
            >
              <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Вы в списке! 🎉</h3>
              <p className="text-zinc-400">
                Мы отправим вам приглашение, как только будет готово.
              </p>
            </motion.div>
          )}
        </motion.div>
      </section>

      {/* Problem Section */}
      <section className="relative z-10 py-20 bg-gradient-to-b from-transparent to-zinc-900/50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Знакомая проблема?</h2>
            <div className="p-8 rounded-2xl bg-red-500/5 border border-red-500/20">
              <p className="text-xl text-zinc-300">${safe.problemStatement}</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 py-20">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Как мы решаем это</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              ${safe.projectName} предоставляет всё необходимое для решения вашей проблемы
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            ${featuresJsx}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="relative z-10 py-20 bg-gradient-to-b from-zinc-900/50 to-transparent">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-6 h-6 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <blockquote className="text-xl md:text-2xl text-zinc-300 mb-6">
              "Именно такое решение я искал. Жду релиза!"
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
              <div className="text-left">
                <p className="font-semibold">Ранний пользователь</p>
                <p className="text-sm text-zinc-500">Из waitlist</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10 py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="p-12 rounded-3xl gradient-border glow"
          >
            <Zap className="w-12 h-12 text-purple-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Готовы начать?</h2>
            <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
              Присоединяйтесь к {subscriberCount}+ людям, которые уже ждут запуска
            </p>
            {!isSubmitted && (
              <form onSubmit={handleSubmit} className="max-w-sm mx-auto flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ваш email"
                  className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? '...' : 'Вступить'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-zinc-800 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-zinc-500 text-sm">
          <p>© 2025 ${safe.projectName}. Создано с TrendHunter AI.</p>
        </div>
      </footer>
    </main>
  );
}
`;

  // README.md
  const mainPain = context.analysis?.main_pain || context.trend.title;
  const targetAudience = context.analysis?.target_audience?.primary || 'современные компании';

  files['README.md'] = `# ${projectName}

${config.tagline}

## 🎯 Проблема

${mainPain}

## 💡 Решение

${projectName} - современный лендинг с waitlist для валидации идеи и сбора ранних пользователей.

## ✨ Возможности

- **Современный дизайн** - градиенты, анимации, glassmorphism
- **Email сбор** - waitlist с локальным хранением
- **Адаптивность** - идеально на любых устройствах
- **SEO оптимизация** - метатеги и Open Graph
- **Социальные доказательства** - счётчик подписчиков

## 🎯 Для кого

${targetAudience}

## 🚀 Быстрый старт

\`\`\`bash
# Клонировать репозиторий
git clone <repo-url>
cd ${sanitizedName}

# Установить зависимости
npm install

# Запустить
npm run dev
\`\`\`

Откройте [http://localhost:3000](http://localhost:3000)

## 📧 Интеграция с сервисами

### Supabase (хранение email)

1. Создайте проект на [supabase.com](https://supabase.com)
2. Создайте таблицу \`subscribers\`
3. Добавьте переменные в \`.env.local\`

### Resend (отправка email)

1. Зарегистрируйтесь на [resend.com](https://resend.com)
2. Получите API ключ
3. Добавьте в \`.env.local\`

## 🌐 Деплой на Vercel

1. Push в GitHub
2. Импортируйте в [Vercel](https://vercel.com)
3. Deploy!

## 📝 Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **Icons:** Lucide React

---

*Создано с [TrendHunter AI](https://trendhunter.ai) 🚀*
`;

  return files;
}
