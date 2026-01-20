/**
 * Dashboard MVP Generator
 *
 * Генерирует полностью рабочий дашборд с:
 * - Агрегацией данных
 * - Интерактивными графиками
 * - Фильтрами и поиском
 * - Автообновлением
 */

import { MVPGenerationContext, DashboardConfig } from './types';

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
 * Генерирует конфигурацию дашборда на основе контекста анализа
 */
export function generateDashboardConfig(context: MVPGenerationContext): DashboardConfig {
  const mainPain = context.analysis?.main_pain || context.trend.title;
  const painPoints = context.analysis?.key_pain_points || [];

  // Определяем метрики на основе болей
  const metrics: DashboardConfig['metrics'] = [
    { name: 'total', label: 'Всего записей', type: 'number' },
    { name: 'trend', label: 'Динамика', type: 'chart' },
    { name: 'topItems', label: 'Топ элементы', type: 'list' },
    { name: 'status', label: 'Статус обновления', type: 'status' },
  ];

  // Определяем источники данных
  const dataSources: DashboardConfig['dataSources'] = [];

  // Добавляем источники на основе контекста
  if (context.sources?.reddit?.communities?.length) {
    dataSources.push({
      name: 'Reddit',
      type: 'api',
      url: 'https://www.reddit.com/r/',
      refreshInterval: 15,
    });
  }

  dataSources.push({
    name: 'Manual Data',
    type: 'manual',
    refreshInterval: 60,
  });

  // Фильтры
  const filters: DashboardConfig['filters'] = [
    { name: 'period', label: 'Период', type: 'select', options: ['Сегодня', 'Неделя', 'Месяц', 'Год'] },
    { name: 'search', label: 'Поиск', type: 'search' },
    { name: 'category', label: 'Категория', type: 'select', options: ['Все', 'Категория 1', 'Категория 2'] },
  ];

  return {
    dashboardName: context.pitch?.company_name || `${context.trend.title} Dashboard`,
    dashboardDescription: context.pitch?.tagline || `Дашборд для мониторинга ${mainPain}`,
    dataSources,
    metrics,
    filters,
  };
}

/**
 * Генерирует все файлы для Dashboard MVP
 */
export function generateDashboardFiles(context: MVPGenerationContext): Record<string, string> {
  const config = generateDashboardConfig(context);
  const files: Record<string, string> = {};

  const projectName = config.dashboardName;
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  const safe = {
    projectName: escapeJsx(projectName),
    dashboardDescription: escapeJsx(config.dashboardDescription),
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
      recharts: '2.10.3',
      swr: '2.2.4'
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
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
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
  files['.env.example'] = `# API Keys (опционально)
# Добавьте ключи если используете внешние API

# Интервал обновления данных (в минутах)
REFRESH_INTERVAL=15
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
    --background: 15 23 42;
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
  animation: pulse 2s infinite;
}

/* Кастомный скроллбар */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
`;

  // src/app/layout.tsx
  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: '${safe.projectName}',
  description: '${safe.dashboardDescription}',
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

  // src/app/page.tsx - Главная страница с дашбордом
  files['src/app/page.tsx'] = `'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  LayoutDashboard, RefreshCw, Filter, Search, Download, TrendingUp, TrendingDown,
  Activity, Clock, AlertCircle, CheckCircle
} from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

// Типы данных
interface DataItem {
  id: string;
  title: string;
  value: number;
  category: string;
  date: string;
  trend: 'up' | 'down' | 'stable';
}

interface DashboardStats {
  total: number;
  change: number;
  changePercent: number;
  averageValue: number;
}

// Генерация демо-данных
function generateDemoData(): DataItem[] {
  const categories = ['Категория 1', 'Категория 2', 'Категория 3', 'Категория 4'];
  const items: DataItem[] = [];

  for (let i = 0; i < 50; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));

    items.push({
      id: \`item-\${i}\`,
      title: \`Элемент #\${i + 1}\`,
      value: Math.floor(Math.random() * 1000) + 100,
      category: categories[Math.floor(Math.random() * categories.length)],
      date: date.toISOString(),
      trend: ['up', 'down', 'stable'][Math.floor(Math.random() * 3)] as 'up' | 'down' | 'stable',
    });
  }

  return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// Генерация данных для графиков
function generateChartData() {
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }),
      value: Math.floor(Math.random() * 500) + 200,
      previous: Math.floor(Math.random() * 500) + 200,
    });
  }
  return data;
}

// Fetcher для SWR
const fetcher = () => Promise.resolve({
  items: generateDemoData(),
  chartData: generateChartData(),
  lastUpdated: new Date().toISOString(),
});

export default function Home() {
  const [period, setPeriod] = useState('Месяц');
  const [category, setCategory] = useState('Все');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Используем SWR для кэширования и автообновления
  const { data, error, mutate } = useSWR('dashboard-data', fetcher, {
    refreshInterval: 60000, // Обновлять каждую минуту
    revalidateOnFocus: true,
  });

  const items = data?.items || [];
  const chartData = data?.chartData || [];
  const lastUpdated = data?.lastUpdated;

  // Фильтрация данных
  const filteredItems = items.filter(item => {
    const matchesCategory = category === 'Все' || item.category === category;
    const matchesSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Расчёт статистики
  const stats: DashboardStats = {
    total: filteredItems.length,
    change: filteredItems.filter(i => i.trend === 'up').length - filteredItems.filter(i => i.trend === 'down').length,
    changePercent: filteredItems.length > 0
      ? Math.round((filteredItems.filter(i => i.trend === 'up').length / filteredItems.length) * 100)
      : 0,
    averageValue: filteredItems.length > 0
      ? Math.round(filteredItems.reduce((sum, i) => sum + i.value, 0) / filteredItems.length)
      : 0,
  };

  // Данные для pie chart
  const categoryData = ['Категория 1', 'Категория 2', 'Категория 3', 'Категория 4'].map(cat => ({
    name: cat,
    value: items.filter(i => i.category === cat).length,
  }));

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  // Ручное обновление
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await mutate();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Экспорт данных
  const handleExport = () => {
    const csv = [
      'ID,Название,Значение,Категория,Дата,Тренд',
      ...filteredItems.map(i => \`\${i.id},"\${i.title}",\${i.value},\${i.category},\${i.date},\${i.trend}\`)
    ].join('\\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-800/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">${safe.projectName}</h1>
              <p className="text-xs text-slate-400">${safe.dashboardDescription}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdated && (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-4 h-4" />
                <span>Обновлено: {new Date(lastUpdated).toLocaleTimeString('ru-RU')}</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
              title="Обновить"
            >
              <RefreshCw className={\`w-5 h-5 \${isRefreshing ? 'animate-spin' : ''}\`} />
            </button>
            <button
              onClick={handleExport}
              className="p-2 rounded-lg hover:bg-slate-700 transition-colors"
              title="Экспорт"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option>Сегодня</option>
              <option>Неделя</option>
              <option>Месяц</option>
              <option>Год</option>
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            >
              <option>Все</option>
              <option>Категория 1</option>
              <option>Категория 2</option>
              <option>Категория 3</option>
              <option>Категория 4</option>
            </select>
          </div>

          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Всего записей</p>
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold mt-2">{stats.total}</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '100ms' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Изменение</p>
              {stats.change >= 0 ? (
                <TrendingUp className="w-5 h-5 text-emerald-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className={\`text-3xl font-bold mt-2 \${stats.change >= 0 ? 'text-emerald-400' : 'text-red-400'}\`}>
              {stats.change >= 0 ? '+' : ''}{stats.change}
            </p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '200ms' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Рост</p>
              <TrendingUp className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold mt-2">{stats.changePercent}%</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 animate-fadeIn" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Среднее значение</p>
              <Activity className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-3xl font-bold mt-2">{stats.averageValue}</p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          {/* Main Chart */}
          <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold mb-4">Динамика</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} />
                  <YAxis stroke="#94a3b8" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pie Chart */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="font-semibold mb-4">По категориям</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {categoryData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-full" style={{ background: COLORS[index] }} />
                  <span className="text-slate-400">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-700">
            <h3 className="font-semibold">Данные ({filteredItems.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Название</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Значение</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Категория</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Дата</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-400">Тренд</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredItems.slice(0, 10).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3 text-sm">{item.title}</td>
                    <td className="px-4 py-3 text-sm font-medium">{item.value}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-1 bg-slate-700 rounded-md text-xs">{item.category}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(item.date).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.trend === 'up' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                      {item.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-400" />}
                      {item.trend === 'stable' && <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredItems.length > 10 && (
            <div className="p-4 border-t border-slate-700 text-center">
              <p className="text-sm text-slate-400">
                Показано 10 из {filteredItems.length} записей
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-700 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-slate-500">
          <p>Создано с помощью TrendHunter AI</p>
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

${config.dashboardDescription}

## 🎯 Проблема

${mainPain}

## 💡 Решение

${projectName} - интерактивный дашборд для мониторинга и визуализации данных в реальном времени.

## ✨ Возможности

- **Реалtime данные** - автоматическое обновление каждую минуту
- **Интерактивные графики** - Area, Line, Pie charts
- **Фильтрация и поиск** - быстрый доступ к нужным данным
- **Экспорт в CSV** - выгрузка для дальнейшего анализа
- **Адаптивный дизайн** - работает на любых устройствах

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

## 📊 Подключение данных

Дашборд использует демо-данные по умолчанию. Для подключения реальных данных:

1. Создайте API endpoint в \`src/app/api/data/route.ts\`
2. Обновите fetcher в \`src/app/page.tsx\`
3. Настройте интервал обновления

## 🌐 Деплой на Vercel

1. Push в GitHub
2. Импортируйте в [Vercel](https://vercel.com)
3. Deploy!

## 📝 Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Data Fetching:** SWR
- **Icons:** Lucide React

---

*Создано с [TrendHunter AI](https://trendhunter.ai) 🚀*
`;

  return files;
}
