/**
 * AI Tool MVP Generator
 *
 * Генерирует полностью рабочий AI-инструмент с:
 * - Вводом текста или URL
 * - Парсингом контента из URL
 * - AI-анализом через OpenAI API
 * - Структурированным выводом результатов
 */

import { MVPGenerationContext, AIToolConfig } from './types';

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
 * Генерирует конфигурацию AI Tool на основе контекста анализа
 * Приоритет данных: productSpec > analysis > defaults
 */
export function generateAIToolConfig(context: MVPGenerationContext): AIToolConfig {
  const mainPain = context.analysis?.main_pain || context.trend.title;
  const painPoints = context.analysis?.key_pain_points || [];
  const targetAudience = context.analysis?.target_audience?.primary || 'пользователи';
  const productSpec = context.productSpec;

  // Если есть productSpec - используем его данные
  let inputType: 'text' | 'url' | 'form' = 'text';
  let outputFormat: 'text' | 'json' | 'list' | 'table' = 'list';
  let inputPlaceholder = 'Введите текст для анализа...';
  let systemPromptHint = '';

  if (productSpec) {
    // Маппинг input_type из productSpec в AIToolConfig
    const inputTypeMap: Record<string, 'text' | 'url' | 'form'> = {
      'text': 'text',
      'url': 'url',
      'form': 'form',
      'file': 'text', // fallback
      'selection': 'form',
      'voice': 'text',
      'image': 'text',
    };
    inputType = inputTypeMap[productSpec.user_input.input_type] || 'text';

    // Маппинг output_format из productSpec
    const outputMap: Record<string, 'text' | 'json' | 'list' | 'table'> = {
      'text': 'text',
      'report': 'text',
      'score': 'json',
      'list': 'list',
      'visualization': 'json',
      'recommendation': 'list',
      'action': 'list',
    };
    outputFormat = outputMap[productSpec.user_output.output_format] || 'list';

    // Генерируем placeholder на основе required_fields
    if (productSpec.user_input.required_fields.length > 0) {
      const field = productSpec.user_input.required_fields[0];
      inputPlaceholder = field.example || field.description || productSpec.user_input.primary_input;
    } else {
      inputPlaceholder = productSpec.user_input.primary_input;
    }

    // Используем AI prompt hint если есть
    systemPromptHint = productSpec.magic_location.ai_prompt_hint || '';
  } else {
    // Fallback: определяем тип на основе боли (старая логика)
    const painLower = mainPain.toLowerCase();
    if (painLower.includes('отзыв') || painLower.includes('review') ||
        painLower.includes('feedback') || painLower.includes('комментар')) {
      inputType = 'url';
      outputFormat = 'table';
    } else if (painLower.includes('анализ') || painLower.includes('analysis')) {
      outputFormat = 'list';
    }
    inputPlaceholder = inputType === 'url'
      ? 'Вставьте ссылку на Reddit пост, Product Hunt, или другой источник...'
      : 'Введите текст для анализа...';
  }

  // Генерируем системный промпт с учётом productSpec
  let systemPrompt: string;

  if (productSpec && systemPromptHint) {
    // Используем AI-сгенерированный hint как основу
    systemPrompt = `Ты - эксперт по анализу в области "${context.trend.title}".

${systemPromptHint}

Контекст задачи:
- Главная боль пользователя: ${mainPain}
- Целевая аудитория: ${targetAudience}
- Что пользователь ожидает получить: ${productSpec.user_output.primary_output}
- Пример выходных данных: ${productSpec.user_output.example}

${painPoints.length > 0 ? `Дополнительные аспекты для анализа:
${painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}` : ''}

Формат ответа:
- ${productSpec.user_output.output_format === 'list' ? 'Используй bullet points для структурирования' : ''}
- ${productSpec.user_output.output_format === 'report' ? 'Сформируй детальный отчёт с заголовками' : ''}
- ${productSpec.user_output.output_format === 'score' ? 'Выдай числовую оценку с обоснованием' : ''}
- ${productSpec.user_output.output_format === 'recommendation' ? 'Дай конкретные рекомендации к действию' : ''}
- Выдели главные инсайты
- Отвечай на русском языке, если не указано иное.`;
  } else {
    // Fallback: старая логика промпта
    systemPrompt = `Ты - эксперт по анализу в области "${context.trend.title}".

Твоя задача: ${mainPain}

Целевая аудитория: ${targetAudience}

При анализе обращай внимание на:
${painPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}

Формат ответа:
- Всегда структурируй ответ
- Используй bullet points для ключевых находок
- Выдели главные инсайты
- Добавь рекомендации по действиям

Отвечай на русском языке, если не указано иное.`;
  }

  // Генерируем название и описание
  const toolName = context.pitch?.company_name || `${context.trend.title} Analyzer`;
  const toolDescription = productSpec
    ? productSpec.user_output.value_proposition
    : (context.pitch?.tagline || `Умный анализатор для ${mainPain}`);

  return {
    toolName,
    toolDescription,
    inputType,
    inputPlaceholder,
    systemPrompt,
    outputFormat,
    exampleInput: productSpec?.user_input.required_fields[0]?.example
      || (inputType === 'url' ? 'https://www.reddit.com/r/startups/comments/...' : 'Пример текста для анализа...'),
    exampleOutput: productSpec?.user_output.example || 'Структурированные результаты анализа появятся здесь'
  };
}

/**
 * Генерирует все файлы для AI Tool MVP
 */
export function generateAIToolFiles(context: MVPGenerationContext): Record<string, string> {
  const config = generateAIToolConfig(context);
  const files: Record<string, string> = {};

  const projectName = config.toolName;
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  const safe = {
    projectName: escapeJsx(projectName),
    toolDescription: escapeJsx(config.toolDescription),
    inputPlaceholder: escapeJsx(config.inputPlaceholder),
    systemPrompt: escapeJsx(config.systemPrompt),
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
      openai: '4.24.7',
      'lucide-react': '0.294.0',
      'react-markdown': '9.0.1',
      cheerio: '1.0.0-rc.12'
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
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
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
  files['.env.example'] = `# OpenAI API Key (обязательно)
OPENAI_API_KEY=sk-...

# Модель OpenAI (опционально)
OPENAI_MODEL=gpt-4o-mini
`;

  // src/app/globals.css
  files['src/app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground: 0 0 0;
  --background: 255 255 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground: 255 255 255;
    --background: 17 17 27;
  }
}

body {
  color: rgb(var(--foreground));
  background: rgb(var(--background));
}

/* Анимации */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.animate-pulse {
  animation: pulse 1.5s infinite;
}

/* Скроллбар */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #4b5563;
  border-radius: 3px;
}
`;

  // src/app/layout.tsx
  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: '${safe.projectName}',
  description: '${safe.toolDescription}',
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

  // src/app/page.tsx - Главная страница с формой
  files['src/app/page.tsx'] = `'use client';

import { useState } from 'react';
import { Send, Loader2, Sparkles, Link as LinkIcon, FileText, Download, History } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface AnalysisResult {
  id: string;
  input: string;
  inputType: 'text' | 'url';
  result: string;
  timestamp: Date;
}

export default function Home() {
  const [input, setInput] = useState('');
  const [inputType, setInputType] = useState<'text' | 'url'>('${config.inputType}');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.trim(), inputType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка анализа');
      }

      setResult(data.result);

      // Добавляем в историю
      const newResult: AnalysisResult = {
        id: Date.now().toString(),
        input: input.trim(),
        inputType,
        result: data.result,
        timestamp: new Date(),
      };
      setHistory(prev => [newResult, ...prev].slice(0, 10));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Произошла ошибка');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analysis-result.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">${safe.projectName}</h1>
              <p className="text-xs text-gray-400">${safe.toolDescription}</p>
            </div>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={\`p-2 rounded-lg transition-colors \${showHistory ? 'bg-indigo-600' : 'hover:bg-gray-800'}\`}
            title="История"
          >
            <History className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="mb-8">
          {/* Input Type Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setInputType('text')}
              className={\`flex items-center gap-2 px-4 py-2 rounded-lg transition-all \${
                inputType === 'text'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }\`}
            >
              <FileText className="w-4 h-4" />
              Текст
            </button>
            <button
              onClick={() => setInputType('url')}
              className={\`flex items-center gap-2 px-4 py-2 rounded-lg transition-all \${
                inputType === 'url'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }\`}
            >
              <LinkIcon className="w-4 h-4" />
              URL
            </button>
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmit}>
            <div className="relative">
              {inputType === 'text' ? (
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="${safe.inputPlaceholder}"
                  rows={6}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              ) : (
                <input
                  type="url"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="https://www.reddit.com/r/... или другой URL"
                  className="w-full bg-gray-800/50 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                />
              )}
            </div>

            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-gray-500">
                {inputType === 'url'
                  ? 'Поддерживаются: Reddit, Product Hunt, Hacker News, и другие'
                  : 'Вставьте текст для анализа'}
              </p>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Анализирую...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Анализировать
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-400 animate-fadeIn">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Результаты анализа
              </h2>
              <button
                onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                Экспорт
              </button>
            </div>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 prose prose-invert max-w-none">
              <ReactMarkdown>{result}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* History Sidebar */}
        {showHistory && history.length > 0 && (
          <div className="fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto z-40 animate-fadeIn">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="w-4 h-4" />
              История запросов
            </h3>
            <div className="space-y-3">
              {history.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setInput(item.input);
                    setInputType(item.inputType);
                    setResult(item.result);
                    setShowHistory(false);
                  }}
                  className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <p className="text-sm truncate text-gray-300">{item.input}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(item.timestamp).toLocaleString('ru-RU')}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !isLoading && !error && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Готов к анализу</h3>
            <p className="text-gray-400 max-w-md mx-auto">
              {inputType === 'url'
                ? 'Вставьте ссылку на Reddit, Product Hunt или другой источник для извлечения и анализа контента'
                : 'Введите текст для интеллектуального анализа'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 text-center text-sm text-gray-500">
          <p>Создано с помощью TrendHunter AI</p>
        </div>
      </footer>
    </main>
  );
}
`;

  // src/app/api/analyze/route.ts - API endpoint
  files['src/app/api/analyze/route.ts'] = `import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as cheerio from 'cheerio';

const SYSTEM_PROMPT = \`${safe.systemPrompt}\`;

// Парсеры для разных источников
async function parseReddit(url: string): Promise<string> {
  try {
    // Преобразуем в JSON API URL
    const jsonUrl = url.replace(/\\/?$/, '.json');
    const response = await fetch(jsonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Tool-Bot/1.0)'
      }
    });

    if (!response.ok) throw new Error('Reddit API error');

    const data = await response.json();
    const post = data[0]?.data?.children[0]?.data;
    const comments = data[1]?.data?.children || [];

    let content = '';
    if (post) {
      content += \`# \${post.title}\\n\\n\`;
      content += \`**Автор:** u/\${post.author}\\n\`;
      content += \`**Subreddit:** r/\${post.subreddit}\\n\`;
      content += \`**Score:** \${post.score} | **Комментариев:** \${post.num_comments}\\n\\n\`;
      if (post.selftext) {
        content += \`## Текст поста\\n\${post.selftext}\\n\\n\`;
      }
    }

    content += \`## Комментарии (\${Math.min(comments.length, 20)} из \${comments.length})\\n\\n\`;

    for (const comment of comments.slice(0, 20)) {
      const c = comment.data;
      if (c && c.body && c.author !== 'AutoModerator') {
        content += \`**u/\${c.author}** (score: \${c.score}):\\n\${c.body}\\n\\n---\\n\\n\`;
      }
    }

    return content;
  } catch (error) {
    console.error('Reddit parse error:', error);
    throw new Error('Не удалось загрузить данные с Reddit');
  }
}

async function parseProductHunt(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Tool-Bot/1.0)'
      }
    });

    if (!response.ok) throw new Error('Product Hunt fetch error');

    const html = await response.text();
    const $ = cheerio.load(html);

    let content = '';

    // Название продукта
    const title = $('h1').first().text().trim();
    const tagline = $('[class*="tagline"]').first().text().trim() || $('meta[name="description"]').attr('content');

    content += \`# \${title}\\n\\n\`;
    content += \`**Tagline:** \${tagline}\\n\\n\`;

    // Описание
    const description = $('[class*="description"]').text().trim();
    if (description) {
      content += \`## Описание\\n\${description}\\n\\n\`;
    }

    // Комментарии
    content += \`## Отзывы и комментарии\\n\\n\`;
    $('[class*="comment"], [class*="review"]').slice(0, 15).each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 20 && text.length < 2000) {
        content += \`- \${text}\\n\\n\`;
      }
    });

    return content || 'Не удалось извлечь контент с Product Hunt';
  } catch (error) {
    console.error('Product Hunt parse error:', error);
    throw new Error('Не удалось загрузить данные с Product Hunt');
  }
}

async function parseGenericUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Tool-Bot/1.0)'
      }
    });

    if (!response.ok) throw new Error('Fetch error');

    const html = await response.text();
    const $ = cheerio.load(html);

    // Удаляем скрипты и стили
    $('script, style, nav, footer, header, aside').remove();

    // Извлекаем текст
    const title = $('title').text().trim() || $('h1').first().text().trim();
    const content = $('article, main, [role="main"], .content, #content')
      .first()
      .text()
      .trim() || $('body').text().trim();

    // Ограничиваем длину
    const truncated = content.substring(0, 10000);

    return \`# \${title}\\n\\n\${truncated}\`;
  } catch (error) {
    console.error('Generic URL parse error:', error);
    throw new Error('Не удалось загрузить данные по ссылке');
  }
}

async function parseUrl(url: string): Promise<string> {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('reddit.com')) {
    return parseReddit(url);
  } else if (urlLower.includes('producthunt.com')) {
    return parseProductHunt(url);
  } else {
    return parseGenericUrl(url);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { input, inputType } = await request.json();

    if (!input) {
      return NextResponse.json({ error: 'Введите данные для анализа' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'API ключ не настроен. Добавьте OPENAI_API_KEY в Environment Variables.' }, { status: 500 });
    }

    // Создаём клиент внутри функции чтобы избежать ошибок при билде
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    let contentToAnalyze = input;

    // Если URL - парсим контент
    if (inputType === 'url') {
      try {
        contentToAnalyze = await parseUrl(input);
      } catch (parseError) {
        return NextResponse.json({
          error: parseError instanceof Error ? parseError.message : 'Ошибка парсинга URL'
        }, { status: 400 });
      }
    }

    // Анализируем через OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: \`Проанализируй следующий контент:\\n\\n\${contentToAnalyze}\` }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const result = completion.choices[0]?.message?.content || 'Не удалось получить результат';

    return NextResponse.json({ result });

  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Ошибка анализа. Попробуйте позже.' },
      { status: 500 }
    );
  }
}
`;

  // README.md
  const mainPain = context.analysis?.main_pain || context.trend.title;
  const targetAudience = context.analysis?.target_audience?.primary || 'современные компании';

  files['README.md'] = `# ${projectName}

${config.toolDescription}

## 🎯 Проблема

${mainPain}

## 💡 Решение

${projectName} - это AI-инструмент, который автоматизирует анализ и помогает получить ценные инсайты за минуты вместо часов.

## ✨ Возможности

- **Ввод текста или URL** - анализируйте тексты напрямую или извлекайте контент из ссылок
- **Парсинг источников** - автоматическое извлечение данных с Reddit, Product Hunt и других платформ
- **AI-анализ** - интеллектуальная обработка с помощью GPT-4
- **Структурированный вывод** - результаты в удобном формате
- **История запросов** - сохранение предыдущих анализов
- **Экспорт** - выгрузка результатов в Markdown

## 🎯 Для кого

${targetAudience}

## 🚀 Быстрый старт

\`\`\`bash
# Клонировать репозиторий
git clone <repo-url>
cd ${sanitizedName}

# Установить зависимости
npm install

# Настроить окружение
cp .env.example .env.local
# Добавьте ваш OPENAI_API_KEY в .env.local

# Запустить
npm run dev
\`\`\`

Откройте [http://localhost:3000](http://localhost:3000)

## 🔑 Настройка

Создайте файл \`.env.local\`:

\`\`\`
OPENAI_API_KEY=sk-ваш-ключ
OPENAI_MODEL=gpt-4o-mini
\`\`\`

## 🌐 Деплой на Vercel

1. Push в GitHub
2. Импортируйте в [Vercel](https://vercel.com)
3. Добавьте Environment Variables
4. Deploy!

## 📝 Tech Stack

- **Framework:** Next.js 14
- **AI:** OpenAI GPT-4
- **Styling:** Tailwind CSS
- **Parsing:** Cheerio

---

*Создано с [TrendHunter AI](https://trendhunter.ai) 🚀*
`;

  return files;
}
