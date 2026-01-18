import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

interface CreateProjectRequest {
  trend_id: string;
  trend_title: string;
  trend_category: string;
  why_trending: string;
  main_pain: string;
  key_pain_points: string[];
  target_audience: string;
  market_signals: string[];
}

interface GeneratedFile {
  path: string;
  content: string;
}

// Generate project files using AI
async function generateProjectFiles(data: CreateProjectRequest): Promise<GeneratedFile[]> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `Ты Senior Full-Stack Developer. Создай ПОЛНОЦЕННУЮ рабочую MVP версию проекта, а НЕ просто лендинг.

ВАЖНО: Верни ТОЛЬКО JSON массив файлов без markdown форматирования.

Формат ответа (строго JSON):
[
  {"path": "package.json", "content": "содержимое файла"},
  {"path": "src/app/page.tsx", "content": "содержимое файла"},
  ...
]

Создай ПОЛНОЦЕННЫЙ Next.js 14 App Router проект с РЕАЛЬНЫМ функционалом:

ОБЯЗАТЕЛЬНЫЕ ФАЙЛЫ:
1. package.json - включи ВСЕ необходимые зависимости (next, react, tailwindcss, zustand, react-hook-form, zod, lucide-react)
2. tsconfig.json, next.config.js, tailwind.config.js, postcss.config.js
3. src/app/globals.css - Tailwind + тёмная тема (zinc/indigo)
4. src/app/layout.tsx - с навигацией и sidebar

СТРАНИЦЫ (с реальным функционалом):
5. src/app/page.tsx - Dashboard с метриками и обзором
6. src/app/dashboard/page.tsx - Основной рабочий интерфейс
7. src/app/settings/page.tsx - Страница настроек с формами

API ROUTES (с реальной логикой):
8. src/app/api/data/route.ts - GET/POST для основных данных
9. src/app/api/settings/route.ts - GET/PUT для настроек

КОМПОНЕНТЫ:
10. src/components/ui/Button.tsx - кнопка с вариантами
11. src/components/ui/Card.tsx - карточка
12. src/components/ui/Input.tsx - поле ввода
13. src/components/layout/Sidebar.tsx - боковая навигация
14. src/components/layout/Header.tsx - шапка

STORE (Zustand):
15. src/store/index.ts - глобальное состояние

ТИПЫ:
16. src/types/index.ts - TypeScript типы

ТРЕБОВАНИЯ К КОДУ:
- Все формы должны работать (react-hook-form + zod валидация)
- API routes должны хранить данные в памяти или localStorage
- Компоненты должны быть интерактивными (не заглушки)
- Используй 'use client' где нужен useState/useEffect
- Код должен компилироваться без ошибок
- Тёмная тема: bg-zinc-950, text-white, accent-indigo-500`
        },
        {
          role: 'user',
          content: `Создай ПОЛНОЦЕННЫЙ MVP проект (НЕ просто лендинг!):

**Название:** ${data.trend_title}
**Категория:** ${data.trend_category}
**Главная проблема:** ${data.main_pain}
**Боли пользователей:** ${Array.isArray(data.key_pain_points) ? data.key_pain_points.join('; ') : data.key_pain_points}
**Целевая аудитория:** ${data.target_audience}

MVP должен включать:
1. РАБОЧИЙ Dashboard с реальными данными и метриками
2. РАБОЧИЕ формы для ввода/редактирования данных
3. API routes которые сохраняют данные
4. Навигацию между страницами
5. Zustand store для состояния
6. Компоненты UI (Button, Card, Input)

НЕ создавай просто лендинг с текстом! Создай ФУНКЦИОНАЛЬНОЕ приложение.

Верни ТОЛЬКО JSON массив файлов. Минимум 15 файлов.`
        }
      ],
      temperature: 0.7,
      max_tokens: 16000
    })
  });

  if (!response.ok) {
    console.error('OpenAI API error');
    return getDefaultFiles(data);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || '';

  try {
    // Try to parse JSON from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error('Failed to parse AI response:', e);
  }

  return getDefaultFiles(data);
}

// Default template files if AI generation fails - creates a FULL MVP, not just landing
function getDefaultFiles(data: CreateProjectRequest): GeneratedFile[] {
  const projectName = data.trend_title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);

  const painPoints = Array.isArray(data.key_pain_points) ? data.key_pain_points : [data.main_pain];

  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: projectName,
        version: '0.1.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start',
          lint: 'next lint'
        },
        dependencies: {
          next: '^14.0.0',
          react: '^18.2.0',
          'react-dom': '^18.2.0',
          'zustand': '^4.4.0',
          'lucide-react': '^0.294.0',
          'react-hook-form': '^7.48.0',
          'zod': '^3.22.0',
          '@hookform/resolvers': '^3.3.0'
        },
        devDependencies: {
          '@types/node': '^20.0.0',
          '@types/react': '^18.2.0',
          '@types/react-dom': '^18.2.0',
          autoprefixer: '^10.4.0',
          postcss: '^8.4.0',
          tailwindcss: '^3.3.0',
          typescript: '^5.0.0'
        }
      }, null, 2)
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
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
      }, null, 2)
    },
    {
      path: 'next.config.js',
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig`
    },
    {
      path: 'tailwind.config.js',
      content: `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`
    },
    {
      path: 'postcss.config.js',
      content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`
    },
    {
      path: 'src/app/globals.css',
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 255, 255, 255;
  --background-rgb: 9, 9, 11;
}

body {
  color: rgb(var(--foreground-rgb));
  background: rgb(var(--background-rgb));
}`
    },
    {
      path: 'src/app/layout.tsx',
      content: `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/layout/Sidebar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '${data.trend_title}',
  description: '${data.main_pain}',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body className={inter.className}>
        <div className="flex min-h-screen bg-zinc-950">
          <Sidebar />
          <main className="flex-1 ml-64">{children}</main>
        </div>
      </body>
    </html>
  )
}`
    },
    // Sidebar component
    {
      path: 'src/components/layout/Sidebar.tsx',
      content: `'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Settings, BarChart3, FileText } from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Данные', href: '/data', icon: BarChart3 },
  { name: 'Отчёты', href: '/reports', icon: FileText },
  { name: 'Настройки', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-zinc-900 border-r border-zinc-800 p-4">
      <div className="mb-8">
        <h1 className="text-xl font-bold text-white">${data.trend_title.substring(0, 20)}</h1>
        <p className="text-xs text-zinc-500 mt-1">MVP Dashboard</p>
      </div>
      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={\`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors \${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
              }\`}
            >
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}`
    },
    // Main dashboard page
    {
      path: 'src/app/page.tsx',
      content: `'use client'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/Card'
import { TrendingUp, Users, Activity, DollarSign } from 'lucide-react'

interface Stats {
  total: number
  active: number
  revenue: number
  growth: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ total: 0, active: 0, revenue: 0, growth: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const metrics = [
    { name: 'Всего записей', value: stats.total, icon: Activity, color: 'text-blue-400' },
    { name: 'Активных', value: stats.active, icon: Users, color: 'text-green-400' },
    { name: 'Выручка', value: '$' + stats.revenue.toLocaleString(), icon: DollarSign, color: 'text-yellow-400' },
    { name: 'Рост', value: stats.growth + '%', icon: TrendingUp, color: 'text-indigo-400' },
  ]

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">${data.trend_title}</h1>
        <p className="text-zinc-400 mt-2">${data.main_pain}</p>
      </div>

      <div className="grid grid-cols-4 gap-6 mb-8">
        {metrics.map((metric) => (
          <Card key={metric.name} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">{metric.name}</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {loading ? '...' : metric.value}
                </p>
              </div>
              <metric.icon className={\`w-8 h-8 \${metric.color}\`} />
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Проблемы которые решаем</h2>
          <ul className="space-y-3">
            ${painPoints.slice(0, 3).map((pain, i) => `<li className="flex items-start gap-3">
              <span className="text-indigo-400 mt-1">•</span>
              <span className="text-zinc-300">${pain}</span>
            </li>`).join('\n            ')}
          </ul>
        </Card>
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Быстрые действия</h2>
          <div className="space-y-3">
            <a href="/data" className="block px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-center transition-colors">
              Добавить данные
            </a>
            <a href="/settings" className="block px-4 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-center transition-colors">
              Настройки
            </a>
          </div>
        </Card>
      </div>
    </div>
  )
}`
    },
    // Data page with form
    {
      path: 'src/app/data/page.tsx',
      content: `'use client'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Plus, Trash2 } from 'lucide-react'

interface DataItem {
  id: string
  name: string
  value: string
  createdAt: string
}

export default function DataPage() {
  const [items, setItems] = useState<DataItem[]>([])
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    const res = await fetch('/api/data')
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !value) return

    await fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, value })
    })
    setName('')
    setValue('')
    loadData()
  }

  const handleDelete = async (id: string) => {
    await fetch('/api/data?id=' + id, { method: 'DELETE' })
    loadData()
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Управление данными</h1>

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-6 col-span-1">
          <h2 className="text-lg font-semibold text-white mb-4">Добавить запись</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Значение"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button type="submit" className="w-full">
              <Plus className="w-4 h-4 mr-2" /> Добавить
            </Button>
          </form>
        </Card>

        <Card className="p-6 col-span-2">
          <h2 className="text-lg font-semibold text-white mb-4">Все записи ({items.length})</h2>
          {loading ? (
            <p className="text-zinc-400">Загрузка...</p>
          ) : items.length === 0 ? (
            <p className="text-zinc-400">Нет данных. Добавьте первую запись.</p>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg">
                  <div>
                    <p className="text-white font-medium">{item.name}</p>
                    <p className="text-sm text-zinc-400">{item.value}</p>
                  </div>
                  <button onClick={() => handleDelete(item.id)} className="p-2 hover:bg-zinc-700 rounded-lg text-red-400">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}`
    },
    // Settings page
    {
      path: 'src/app/settings/page.tsx',
      content: `'use client'
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Save } from 'lucide-react'

export default function SettingsPage() {
  const [settings, setSettings] = useState({ appName: '', apiKey: '', notifications: true })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
  }, [])

  const handleSave = async () => {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Настройки</h1>

      <Card className="p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Название приложения</label>
            <Input
              value={settings.appName}
              onChange={(e) => setSettings({...settings, appName: e.target.value})}
              placeholder="${data.trend_title}"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">API Key</label>
            <Input
              type="password"
              value={settings.apiKey}
              onChange={(e) => setSettings({...settings, apiKey: e.target.value})}
              placeholder="sk-..."
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
              className="w-4 h-4 rounded bg-zinc-800 border-zinc-700"
            />
            <label className="text-zinc-300">Получать уведомления</label>
          </div>
          <Button onClick={handleSave} className="w-full">
            <Save className="w-4 h-4 mr-2" />
            {saved ? 'Сохранено!' : 'Сохранить настройки'}
          </Button>
        </div>
      </Card>
    </div>
  )
}`
    },
    // Reports page
    {
      path: 'src/app/reports/page.tsx',
      content: `'use client'
import { Card } from '@/components/ui/Card'
import { FileText, Download } from 'lucide-react'

export default function ReportsPage() {
  const reports = [
    { name: 'Ежедневный отчёт', date: new Date().toLocaleDateString('ru-RU'), type: 'daily' },
    { name: 'Недельная аналитика', date: new Date().toLocaleDateString('ru-RU'), type: 'weekly' },
    { name: 'Месячный обзор', date: new Date().toLocaleDateString('ru-RU'), type: 'monthly' },
  ]

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-white mb-8">Отчёты</h1>
      <div className="grid gap-4">
        {reports.map((report, i) => (
          <Card key={i} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600/20 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-white font-medium">{report.name}</p>
                <p className="text-sm text-zinc-400">{report.date}</p>
              </div>
            </div>
            <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white">
              <Download className="w-5 h-5" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}`
    },
    // API Route - Stats
    {
      path: 'src/app/api/stats/route.ts',
      content: `import { NextResponse } from 'next/server'

export async function GET() {
  // In production, fetch from database
  return NextResponse.json({
    total: 1234,
    active: 456,
    revenue: 12500,
    growth: 23
  })
}`
    },
    // API Route - Data CRUD
    {
      path: 'src/app/api/data/route.ts',
      content: `import { NextRequest, NextResponse } from 'next/server'

// In-memory storage (use database in production)
let items: Array<{ id: string; name: string; value: string; createdAt: string }> = []

export async function GET() {
  return NextResponse.json({ items })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const newItem = {
    id: Date.now().toString(),
    name: body.name,
    value: body.value,
    createdAt: new Date().toISOString()
  }
  items.push(newItem)
  return NextResponse.json(newItem)
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  items = items.filter(item => item.id !== id)
  return NextResponse.json({ success: true })
}`
    },
    // API Route - Settings
    {
      path: 'src/app/api/settings/route.ts',
      content: `import { NextRequest, NextResponse } from 'next/server'

let settings = {
  appName: '${data.trend_title}',
  apiKey: '',
  notifications: true
}

export async function GET() {
  return NextResponse.json(settings)
}

export async function PUT(request: NextRequest) {
  const body = await request.json()
  settings = { ...settings, ...body }
  return NextResponse.json(settings)
}`
    },
    // UI Components
    {
      path: 'src/components/ui/Card.tsx',
      content: `import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={\`bg-zinc-900/50 border border-zinc-800 rounded-xl \${className}\`}>
      {children}
    </div>
  )
}`
    },
    {
      path: 'src/components/ui/Button.tsx',
      content: `'use client'
import { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: 'primary' | 'secondary'
}

export function Button({ children, variant = 'primary', className = '', ...props }: ButtonProps) {
  const variants = {
    primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
    secondary: 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
  }

  return (
    <button
      className={\`px-4 py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center \${variants[variant]} \${className}\`}
      {...props}
    >
      {children}
    </button>
  )
}`
    },
    {
      path: 'src/components/ui/Input.tsx',
      content: `'use client'
import { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...props }: InputProps) {
  return (
    <input
      className={\`w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition-colors \${className}\`}
      {...props}
    />
  )
}`
    },
    // Types
    {
      path: 'src/types/index.ts',
      content: `export interface DataItem {
  id: string
  name: string
  value: string
  createdAt: string
}

export interface Settings {
  appName: string
  apiKey: string
  notifications: boolean
}

export interface Stats {
  total: number
  active: number
  revenue: number
  growth: number
}`
    }
  ];
}

// Create file in GitHub repository
async function createGitHubFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          content: Buffer.from(content).toString('base64'),
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error(`Failed to create ${path}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error creating ${path}:`, error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get GitHub token from cookies
    const githubToken = request.cookies.get('github_token')?.value;
    const githubUserCookie = request.cookies.get('github_user')?.value;

    if (!githubToken || !githubUserCookie) {
      return NextResponse.json(
        { success: false, error: 'GitHub authentication required' },
        { status: 401 }
      );
    }

    const githubUser = JSON.parse(githubUserCookie);
    const body: CreateProjectRequest = await request.json();

    // Validate required fields
    if (!body.trend_id || !body.trend_title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate repo name from trend title
    const repoName = body.trend_title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 50) + '-mvp';

    // Step 1: Create GitHub repository
    const createRepoResponse = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        description: `${body.main_pain} | Created by TrendHunter AI`,
        private: false,
        auto_init: false, // Don't auto-init, we'll add files manually
      }),
    });

    if (!createRepoResponse.ok) {
      const error = await createRepoResponse.json();
      console.error('Failed to create repo:', error);
      return NextResponse.json(
        { success: false, error: error.message || 'Failed to create repository' },
        { status: 400 }
      );
    }

    const repo = await createRepoResponse.json();
    const owner = githubUser.login;

    // Step 2: Generate README
    const readme = `# ${body.trend_title}

> ${body.main_pain}

## 🎯 О проекте

**Категория:** ${body.trend_category}

**Почему это актуально:** ${body.why_trending}

## 💡 Проблема

${body.main_pain}

### Ключевые боли пользователей:
${(Array.isArray(body.key_pain_points) ? body.key_pain_points : [body.key_pain_points]).map(p => `- ${p}`).join('\n')}

## 👥 Целевая аудитория

${body.target_audience}

## 🚀 Быстрый старт

\`\`\`bash
# Клонируй репозиторий
git clone ${repo.clone_url}
cd ${repoName}

# Установи зависимости
npm install

# Запусти dev сервер
npm run dev
\`\`\`

Открой [http://localhost:3000](http://localhost:3000) в браузере.

## 📁 Структура проекта

\`\`\`
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Корневой layout с Sidebar
│   │   ├── page.tsx            # Dashboard с метриками
│   │   ├── data/page.tsx       # CRUD страница данных
│   │   ├── settings/page.tsx   # Страница настроек
│   │   ├── reports/page.tsx    # Страница отчётов
│   │   ├── globals.css         # Тёмная тема
│   │   └── api/
│   │       ├── stats/route.ts  # API метрик
│   │       ├── data/route.ts   # CRUD API
│   │       └── settings/route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   └── Sidebar.tsx     # Боковая навигация
│   │   └── ui/
│   │       ├── Button.tsx      # Кнопка
│   │       ├── Card.tsx        # Карточка
│   │       └── Input.tsx       # Поле ввода
│   └── types/
│       └── index.ts            # TypeScript типы
├── package.json
├── tailwind.config.js
└── tsconfig.json
\`\`\`

## 🛠 Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS (тёмная тема)
- **State:** Zustand
- **Forms:** React Hook Form + Zod
- **Icons:** Lucide React
- **Language:** TypeScript

## 📋 Функционал MVP

- ✅ Dashboard с метриками
- ✅ CRUD операции с данными
- ✅ Страница настроек с формами
- ✅ API routes с in-memory хранилищем
- ✅ Адаптивный тёмный интерфейс
- ✅ Компоненты UI (Button, Card, Input)

---

*Создано с помощью [TrendHunter AI](https://github.com/your-username/trendhunter-ai)*
`;

    // Step 3: Create README first (initializes the repo)
    await createGitHubFile(githubToken, owner, repoName, 'README.md', readme, 'Initial commit: Add README');

    // Small delay to ensure repo is initialized
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Generate project files
    const files = await generateProjectFiles(body);

    // Step 5: Add all generated files to repo
    for (const file of files) {
      await createGitHubFile(
        githubToken,
        owner,
        repoName,
        file.path,
        file.content,
        `Add ${file.path}`
      );
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Step 6: Create GitHub Issues for weekly tasks
    // Note: Create in reverse order (week 4 first) so they display correctly in GitHub (newest first)
    const weeklyTasks = [
      { week: 4, tasks: ['Деплой на Vercel', 'Оптимизация производительности', 'End-to-end тестирование', 'Подключить аналитику'] },
      { week: 3, tasks: ['Подключить PostgreSQL/Supabase', 'Реализовать авторизацию', 'Добавить валидацию форм', 'Интеграция с внешними API'] },
      { week: 2, tasks: ['Расширить Dashboard метриками', 'Добавить фильтрацию и сортировку данных', 'Создать страницу профиля', 'Улучшить мобильную версию'] },
      { week: 1, tasks: ['Изучить сгенерированный код', 'Запустить локально (npm install && npm run dev)', 'Протестировать CRUD операции', 'Кастомизировать под свои нужды'] },
    ];

    for (const week of weeklyTasks) {
      for (const task of week.tasks) {
        await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: `[Неделя ${week.week}] ${task}`,
            labels: [`week-${week.week}`],
            body: `## Неделя ${week.week}\n\n**Задача:** ${task}\n\n---\n*Создано TrendHunter AI*`,
          }),
        });
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    return NextResponse.json({
      success: true,
      github: {
        repo_url: repo.html_url,
        clone_url: repo.clone_url,
        name: repo.name,
        description: repo.description,
      },
      files_created: files.length + 1, // +1 for README
      issues_created: weeklyTasks.reduce((acc, w) => acc + w.tasks.length, 0),
    });

  } catch (error) {
    console.error('Create project error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
