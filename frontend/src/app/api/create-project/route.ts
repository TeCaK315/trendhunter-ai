import { NextRequest, NextResponse } from 'next/server';
import { generateCodeWithClaude, ProjectSpec } from '@/lib/code-generator';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

/**
 * /api/create-project
 *
 * Финальный эксперт - META-АГЕНТ
 * Получает ПОЛНЫЙ контекст от всех 7 предыдущих экспертов и генерирует:
 * 1. Техническое задание для MVP
 * 2. README для GitHub репозитория
 * 3. Roadmap развития (MVP → Alpha → Beta → Production)
 * 4. Рекомендации по улучшению
 */

// Полный контекст от всех экспертов
interface FullAnalysisContext {
  trend: {
    id?: string;
    title: string;
    category?: string;
    why_trending?: string;
  };
  analysis?: {
    main_pain: string;
    confidence?: number;
    key_pain_points?: string[];
    target_audience?: {
      primary: string;
      segments?: Array<{ name: string; size: string; willingness_to_pay?: string }>;
    };
    opportunities?: string[];
    risks?: string[];
    market_readiness?: number;
  };
  sources?: {
    reddit?: {
      posts: Array<{ title: string; subreddit: string; score: number }>;
      communities: string[];
      engagement: number;
    };
    google_trends?: {
      growth_rate: number;
      related_queries?: Array<{ query: string }>;
    };
    youtube?: {
      videos: Array<{ title: string; channel: string }>;
    };
    synthesis?: {
      key_insights: string[];
      content_gaps: string[];
      recommended_angles: string[];
    };
  };
  competition?: {
    competitors: Array<{
      name: string;
      website?: string;
      description?: string;
      funding?: string;
    }>;
    market_saturation: string;
    blue_ocean_score: number;
    opportunity_areas?: string[];
    strategic_positioning?: string;
    differentiation_opportunities?: string[];
  };
  venture?: {
    total_funding_last_year: string;
    average_round_size?: string;
    funding_trend?: string;
    recent_rounds?: Array<{
      company: string;
      amount: string;
      round_type: string;
    }>;
    active_funds?: Array<{ name: string }>;
    investment_hotness: number;
    market_signals?: string[];
    investment_thesis?: string;
    recommended_round?: string;
    key_investors_to_target?: string[];
  };
  leads?: {
    companies: Array<{
      name: string;
      website?: string;
      industry: string;
      size?: string;
      relevance_score?: number;
      pain_match?: string;
    }>;
    linkedin_queries?: string[];
    directories?: Array<{ name: string; url: string }>;
    outreach_sequence?: string[];
  };
  pitch?: {
    company_name: string;
    tagline: string;
    slides: Array<{
      title: string;
      type: string;
      content: string[];
    }>;
  };
}

interface ProjectOutput {
  // Мета-информация
  project_name: string;
  one_liner: string;
  problem_statement: string;
  solution_overview: string;

  // README для GitHub
  readme_content: string;

  // Техническое задание MVP
  mvp_specification: {
    core_features: Array<{
      name: string;
      description: string;
      priority: 'must-have' | 'should-have' | 'nice-to-have';
      user_story: string;
      acceptance_criteria: string[];
    }>;
    tech_stack: Array<{
      category: string;
      recommendation: string;
      alternatives: string[];
      reasoning: string;
    }>;
    architecture: string;
    estimated_complexity: 'low' | 'medium' | 'high';
  };

  // Roadmap
  roadmap: {
    mvp: {
      duration: string;
      goals: string[];
      deliverables: string[];
      success_metrics: string[];
    };
    alpha: {
      duration: string;
      goals: string[];
      deliverables: string[];
      success_metrics: string[];
    };
    beta: {
      duration: string;
      goals: string[];
      deliverables: string[];
      success_metrics: string[];
    };
    production: {
      goals: string[];
      deliverables: string[];
      success_metrics: string[];
    };
  };

  // Рекомендации по улучшению
  enhancement_recommendations: Array<{
    area: string;
    current_state: string;
    recommended_improvement: string;
    expected_impact: string;
    priority: 'high' | 'medium' | 'low';
  }>;

  // Бизнес-метрики
  business_metrics: {
    target_users_mvp: string;
    target_revenue_mvp: string;
    target_users_production: string;
    target_revenue_production: string;
    key_kpis: string[];
  };

  // Ошибка генерации кода (если была)
  code_generation_error?: string;
}

// Генерирует полное ТЗ проекта на основе контекста от всех экспертов
async function generateProjectSpecification(context: FullAnalysisContext): Promise<ProjectOutput> {
  if (!OPENAI_API_KEY) {
    return getDefaultProjectOutput(context);
  }

  try {
    // Формируем полный контекст от всех экспертов
    const fullContextPrompt = `
# ПОЛНЫЙ КОНТЕКСТ АНАЛИЗА РЫНКА

## 1. ТРЕНД
- Название: ${context.trend.title}
- Категория: ${context.trend.category || 'Technology'}
- Почему трендит: ${context.trend.why_trending || 'Растущий спрос'}

## 2. АНАЛИЗ БОЛЕЙ (от Pain Point Expert)
${context.analysis ? `
- Главная боль: ${context.analysis.main_pain}
- Уверенность: ${context.analysis.confidence || 'не оценена'}%
- Ключевые боли: ${context.analysis.key_pain_points?.join(', ') || 'не определены'}
- Целевая аудитория: ${context.analysis.target_audience?.primary || 'не определена'}
- Сегменты: ${context.analysis.target_audience?.segments?.map(s => `${s.name} (${s.size}, готовность платить: ${s.willingness_to_pay || 'не оценена'})`).join('; ') || 'не определены'}
- Возможности: ${context.analysis.opportunities?.join(', ') || 'не определены'}
- Риски: ${context.analysis.risks?.join(', ') || 'не определены'}
- Готовность рынка: ${context.analysis.market_readiness || 'не оценена'}/10
` : 'Данные анализа отсутствуют'}

## 3. ИСТОЧНИКИ ДАННЫХ (от Sources Expert)
${context.sources ? `
- Reddit engagement: ${context.sources.reddit?.engagement || 0}
- Активные сообщества: ${context.sources.reddit?.communities?.join(', ') || 'нет данных'}
- Google Trends рост: ${context.sources.google_trends?.growth_rate || 0}%
- Связанные запросы: ${context.sources.google_trends?.related_queries?.map(q => q.query).join(', ') || 'нет'}
- YouTube контент: ${context.sources.youtube?.videos?.length || 0} видео
- Ключевые инсайты: ${context.sources.synthesis?.key_insights?.join('; ') || 'нет'}
- Пробелы в контенте: ${context.sources.synthesis?.content_gaps?.join('; ') || 'нет'}
- Рекомендуемые углы: ${context.sources.synthesis?.recommended_angles?.join('; ') || 'нет'}
` : 'Данные источников отсутствуют'}

## 4. КОНКУРЕНТЫ (от Competition Expert)
${context.competition ? `
- Насыщенность рынка: ${context.competition.market_saturation}
- Blue Ocean Score: ${context.competition.blue_ocean_score}/10
- Конкуренты: ${context.competition.competitors?.map(c => `${c.name}${c.funding ? ` (${c.funding})` : ''}`).join(', ') || 'нет данных'}
- Рыночные ниши: ${context.competition.opportunity_areas?.join(', ') || 'не определены'}
- Позиционирование: ${context.competition.strategic_positioning || 'не определено'}
- Дифференциация: ${context.competition.differentiation_opportunities?.join('; ') || 'не определена'}
` : 'Конкурентный анализ отсутствует'}

## 5. ИНВЕСТИЦИИ (от Venture Expert)
${context.venture ? `
- Объём инвестиций в нише: ${context.venture.total_funding_last_year}
- Средний раунд: ${context.venture.average_round_size || 'не определён'}
- Тренд финансирования: ${context.venture.funding_trend || 'не определён'}
- Горячесть рынка: ${context.venture.investment_hotness}/10
- Инвестиционный тезис: ${context.venture.investment_thesis || 'нет'}
- Рекомендуемый раунд: ${context.venture.recommended_round || 'не определён'}
- Целевые инвесторы: ${context.venture.key_investors_to_target?.join(', ') || 'не определены'}
- Рыночные сигналы: ${context.venture.market_signals?.join('; ') || 'нет'}
` : 'Инвестиционный анализ отсутствует'}

## 6. ПОТЕНЦИАЛЬНЫЕ КЛИЕНТЫ (от Leads Expert)
${context.leads ? `
- Найдено компаний: ${context.leads.companies?.length || 0}
- Топ клиенты: ${context.leads.companies?.slice(0, 5).map(c => `${c.name} (${c.industry}, relevance: ${c.relevance_score}/10)`).join('; ') || 'нет'}
- LinkedIn запросы: ${context.leads.linkedin_queries?.join('; ') || 'нет'}
- Каталоги: ${context.leads.directories?.map(d => d.name).join(', ') || 'нет'}
- Рекомендуемая последовательность outreach: ${context.leads.outreach_sequence?.join(' → ') || 'нет'}
` : 'Данные о лидах отсутствуют'}

## 7. PITCH DECK (от Presentation Expert)
${context.pitch ? `
- Название компании: ${context.pitch.company_name}
- Tagline: ${context.pitch.tagline}
- Слайдов: ${context.pitch.slides?.length || 0}
` : 'Pitch deck не создан'}
`;

    const prompt = `Ты META-АГЕНТ - финальный эксперт в цепочке анализа. Твоя задача - скомпилировать ВСЕ данные от предыдущих 7 экспертов в полноценное техническое задание для создания MVP.

${fullContextPrompt}

На основе ВСЕХ данных выше, создай ПОЛНУЮ спецификацию проекта.

ВАЖНО:
1. Используй РЕАЛЬНЫЕ данные от экспертов, не выдумывай
2. MVP должен решать ГЛАВНУЮ БОЛЬ из анализа
3. Tech stack должен быть бюджетным ($0-100/мес)
4. Roadmap должен быть КОНКРЕТНЫМ и привязанным к данным анализа:
   - MVP: фокус на решении главной боли "${context.analysis?.main_pain || 'не определена'}"
   - Alpha: улучшения на основе фидбека от "${context.analysis?.target_audience?.primary || 'целевой аудитории'}"
   - Beta: дифференциация от конкурентов (${context.competition?.competitors?.slice(0, 2).map(c => c.name).join(', ') || 'основных игроков'})
   - Production: выход на рынок с учётом инвестиционной привлекательности (hotness: ${context.venture?.investment_hotness || 'N/A'}/10)
5. Рекомендации должны учитывать конкурентов и рынок
6. Success metrics должны быть измеримыми и привязанными к целевой аудитории

Верни JSON:
{
  "project_name": "Название проекта",
  "one_liner": "Одно предложение описание",
  "problem_statement": "Детальное описание проблемы на основе анализа болей",
  "solution_overview": "Описание решения с учётом позиционирования",

  "readme_content": "Полный README.md для GitHub (markdown)",

  "mvp_specification": {
    "core_features": [
      {
        "name": "Feature 1",
        "description": "Описание",
        "priority": "must-have",
        "user_story": "As a [user], I want [feature] so that [benefit]",
        "acceptance_criteria": ["Критерий 1", "Критерий 2"]
      }
    ],
    "tech_stack": [
      {
        "category": "Frontend",
        "recommendation": "Next.js",
        "alternatives": ["React", "Vue"],
        "reasoning": "Почему"
      }
    ],
    "architecture": "Описание архитектуры",
    "estimated_complexity": "medium"
  },

  "roadmap": {
    "mvp": {
      "duration": "4-6 weeks",
      "goals": ["Конкретная цель на основе ГЛАВНОЙ БОЛИ из анализа"],
      "deliverables": ["Конкретный функционал решающий боль ${context.analysis?.main_pain || 'основную проблему'}"],
      "success_metrics": ["Метрика валидации - например: ${context.analysis?.target_audience?.segments?.[0]?.name || 'целевых пользователей'} протестировали продукт"]
    },
    "alpha": {
      "duration": "2-4 weeks",
      "goals": ["Цель на основе обратной связи от ${context.analysis?.target_audience?.primary || 'целевой аудитории'}"],
      "deliverables": ["Улучшения основанные на фидбеке первых пользователей"],
      "success_metrics": ["Метрика на основе болей: ${context.analysis?.key_pain_points?.[0] || 'уменьшение главной боли'}"]
    },
    "beta": {
      "duration": "4-8 weeks",
      "goals": ["Масштабирование и ${context.competition?.differentiation_opportunities?.[0] || 'дифференциация от конкурентов'}"],
      "deliverables": ["Функции для опережения конкурентов: ${context.competition?.competitors?.[0]?.name || 'основного конкурента'}"],
      "success_metrics": ["Blue Ocean метрика: ${context.competition?.blue_ocean_score ? 'улучшить blue ocean score' : 'занять свободную нишу'}"]
    },
    "production": {
      "goals": ["Публичный запуск с фокусом на ${context.venture?.investment_thesis || 'growth'}"],
      "deliverables": ["Полный продукт готовый для ${context.venture?.recommended_round || 'привлечения инвестиций'}"],
      "success_metrics": ["${context.venture?.investment_hotness && context.venture.investment_hotness > 7 ? 'Подготовка к раунду инвестиций' : 'Organic growth метрики'}"]
    }
  },

  "enhancement_recommendations": [
    {
      "area": "Область улучшения",
      "current_state": "Текущее состояние в MVP",
      "recommended_improvement": "Рекомендуемое улучшение",
      "expected_impact": "Ожидаемый эффект",
      "priority": "high"
    }
  ],

  "business_metrics": {
    "target_users_mvp": "100 beta users",
    "target_revenue_mvp": "$0 (validation)",
    "target_users_production": "10,000 users",
    "target_revenue_production": "$50K MRR",
    "key_kpis": ["KPI 1", "KPI 2"]
  }
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 6000,
      }),
    });

    if (!response.ok) {
      console.error('OpenAI API error:', response.status);
      return getDefaultProjectOutput(context);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (error) {
    console.error('Project generation error:', error);
  }

  return getDefaultProjectOutput(context);
}

function getDefaultProjectOutput(context: FullAnalysisContext): ProjectOutput {
  const projectName = context.pitch?.company_name || `${context.trend.title} MVP`;

  return {
    project_name: projectName,
    one_liner: `Solving ${context.analysis?.main_pain || context.trend.title} for ${context.analysis?.target_audience?.primary || 'modern businesses'}`,
    problem_statement: context.analysis?.main_pain || 'Problem not analyzed',
    solution_overview: context.competition?.strategic_positioning || 'Solution not defined',

    readme_content: `# ${projectName}

## Problem
${context.analysis?.main_pain || 'TBD'}

## Solution
${context.competition?.strategic_positioning || 'TBD'}

## Target Audience
${context.analysis?.target_audience?.primary || 'TBD'}

## Tech Stack
- Frontend: Next.js
- Backend: Node.js
- Database: PostgreSQL

## Getting Started
\`\`\`bash
npm install
npm run dev
\`\`\`
`,

    mvp_specification: {
      core_features: [
        {
          name: 'Core Feature',
          description: 'Main functionality',
          priority: 'must-have',
          user_story: 'As a user, I want to solve my problem',
          acceptance_criteria: ['Works correctly', 'Good UX'],
        },
      ],
      tech_stack: [
        {
          category: 'Frontend',
          recommendation: 'Next.js',
          alternatives: ['React', 'Vue'],
          reasoning: 'Best for SEO and performance',
        },
      ],
      architecture: 'Monolithic with API routes',
      estimated_complexity: 'medium',
    },

    roadmap: {
      mvp: {
        duration: '4-6 weeks',
        goals: ['Validate core value proposition'],
        deliverables: ['Working prototype'],
        success_metrics: ['100 beta signups'],
      },
      alpha: {
        duration: '2-4 weeks',
        goals: ['Gather feedback'],
        deliverables: ['Improved UX'],
        success_metrics: ['50% retention'],
      },
      beta: {
        duration: '4-8 weeks',
        goals: ['Scale testing'],
        deliverables: ['Production-ready app'],
        success_metrics: ['1000 users'],
      },
      production: {
        goals: ['Launch publicly'],
        deliverables: ['Full product'],
        success_metrics: ['10K users', '$10K MRR'],
      },
    },

    enhancement_recommendations: [
      {
        area: 'User Experience',
        current_state: 'Basic MVP',
        recommended_improvement: 'Add onboarding flow',
        expected_impact: '30% better retention',
        priority: 'high',
      },
    ],

    business_metrics: {
      target_users_mvp: '100 beta users',
      target_revenue_mvp: '$0 (validation)',
      target_users_production: '10,000 users',
      target_revenue_production: '$50K MRR',
      key_kpis: ['User signups', 'Retention rate', 'NPS'],
    },
  };
}

// Создание GitHub репозитория
async function createGitHubRepo(
  token: string,
  repoName: string,
  description: string
): Promise<{ success: boolean; url?: string; error?: string; existed?: boolean }> {
  try {
    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: repoName,
        description: description,
        private: false,
        auto_init: true,
      }),
    });

    if (!response.ok) {
      const error = await response.json();

      // Если репо уже существует — используем его
      if (response.status === 422 && error.errors?.some((e: { message?: string }) => e.message?.includes('already exists'))) {
        console.log(`[github] Repo "${repoName}" already exists, reusing it`);
        // Получаем URL существующего репо
        const existingRes = await fetch(`https://api.github.com/repos/${await getGitHubUsername(token)}/${repoName}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        });
        if (existingRes.ok) {
          const existingRepo = await existingRes.json();
          return { success: true, url: existingRepo.html_url, existed: true };
        }
      }

      console.error('GitHub repo creation error:', error);
      return { success: false, error: error.message || 'Failed to create repository' };
    }

    const repo = await response.json();
    return { success: true, url: repo.html_url };
  } catch (error) {
    console.error('GitHub repo creation error:', error);
    return { success: false, error: 'Failed to create repository' };
  }
}

// Добавление файла в репозиторий
async function addFileToRepo(
  token: string,
  owner: string,
  repo: string,
  path: string,
  content: string,
  message: string,
  sha?: string // SHA для обновления существующего файла
): Promise<{ success: boolean; sha?: string; error?: string }> {
  try {
    const body: Record<string, string> = {
      message,
      content: Buffer.from(content).toString('base64'),
    };
    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error(`GitHub file creation error (${path}):`, error);
      return { success: false, error: error.message };
    }

    const result = await response.json();
    return { success: true, sha: result.content?.sha };
  } catch (error) {
    console.error(`GitHub file creation error (${path}):`, error);
    return { success: false, error: 'Failed to add file' };
  }
}

// Добавление README в репозиторий (legacy wrapper)
async function addReadmeToRepo(
  token: string,
  owner: string,
  repo: string,
  content: string
): Promise<{ success: boolean; error?: string }> {
  return addFileToRepo(token, owner, repo, 'README.md', content, 'Initial commit: Add project specification README');
}

// Генерация полной структуры Next.js проекта
function generateProjectFiles(projectOutput: ProjectOutput, context: FullAnalysisContext): Record<string, string> {
  const projectName = projectOutput.project_name || 'my-mvp';
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const files: Record<string, string> = {};

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
      next: '^14.0.0',
      react: '^18.2.0',
      'react-dom': '^18.2.0',
      'lucide-react': '^0.294.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      '@types/react': '^18.2.0',
      '@types/react-dom': '^18.2.0',
      typescript: '^5.0.0',
      tailwindcss: '^3.3.0',
      postcss: '^8.4.0',
      autoprefixer: '^10.4.0',
      eslint: '^8.0.0',
      'eslint-config-next': '^14.0.0'
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
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
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

  // .env.example
  files['.env.example'] = `# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# API Keys
OPENAI_API_KEY=sk-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
`;

  // src/app/globals.css
  files['src/app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --foreground-rgb: 0, 0, 0;
  --background-start-rgb: 255, 255, 255;
  --background-end-rgb: 255, 255, 255;
}

@media (prefers-color-scheme: dark) {
  :root {
    --foreground-rgb: 255, 255, 255;
    --background-start-rgb: 10, 10, 10;
    --background-end-rgb: 10, 10, 10;
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
`;

  // src/app/layout.tsx
  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: '${projectName}',
  description: '${projectOutput.one_liner || 'MVP Project'}',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
`;

  // Генерируем главную страницу на основе данных проекта
  const features = projectOutput.mvp_specification?.core_features || [];
  const featuresJSX = features.map((f, i) => `
          <div key="${i}" className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-2">${f.name}</h3>
            <p className="text-gray-600 dark:text-gray-300">${f.description}</p>
            <span className="inline-block mt-3 px-3 py-1 text-xs font-medium rounded-full ${
              f.priority === 'must-have' ? 'bg-red-100 text-red-800' :
              f.priority === 'should-have' ? 'bg-yellow-100 text-yellow-800' :
              'bg-green-100 text-green-800'
            }">${f.priority}</span>
          </div>`).join('\n');

  // src/app/page.tsx
  files['src/app/page.tsx'] = `import { ArrowRight, CheckCircle, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center px-4 py-2 bg-primary-100 dark:bg-primary-900 rounded-full mb-6">
          <Sparkles className="w-4 h-4 mr-2 text-primary-600" />
          <span className="text-sm font-medium text-primary-700 dark:text-primary-300">MVP Version</span>
        </div>

        <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-6">
          ${projectName}
        </h1>

        <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-8">
          ${projectOutput.one_liner || 'Your next big thing starts here'}
        </p>

        <div className="flex gap-4 justify-center">
          <button className="px-8 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors flex items-center">
            Get Started <ArrowRight className="ml-2 w-5 h-5" />
          </button>
          <button className="px-8 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Learn More
          </button>
        </div>
      </section>

      {/* Problem Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto bg-red-50 dark:bg-red-900/20 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">The Problem</h2>
          <p className="text-gray-700 dark:text-gray-300 text-lg">
            ${projectOutput.problem_statement || context.analysis?.main_pain || 'Problem statement will be added here'}
          </p>
        </div>
      </section>

      {/* Solution Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto bg-green-50 dark:bg-green-900/20 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Our Solution</h2>
          <p className="text-gray-700 dark:text-gray-300 text-lg">
            ${projectOutput.solution_overview || 'Solution overview will be added here'}
          </p>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">
          Core Features
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          ${featuresJSX || `
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold mb-2">Feature 1</h3>
            <p className="text-gray-600 dark:text-gray-300">Core functionality description</p>
          </div>`}
        </div>
      </section>

      {/* Target Audience */}
      <section className="container mx-auto px-4 py-16 bg-gray-50 dark:bg-gray-800/50">
        <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-8">
          Who Is This For?
        </h2>
        <p className="text-center text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
          ${context.analysis?.target_audience?.primary || 'Our target audience'}
        </p>
        ${context.analysis?.target_audience?.segments ? `
        <div className="flex flex-wrap justify-center gap-4 mt-8">
          ${context.analysis.target_audience.segments.map(s => `
          <div className="px-6 py-3 bg-white dark:bg-gray-700 rounded-lg shadow">
            <span className="font-medium">${s.name}</span>
            <span className="text-gray-500 ml-2">${s.size}</span>
          </div>`).join('')}
        </div>` : ''}
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
          Ready to Get Started?
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-8 max-w-xl mx-auto">
          Join early adopters and be part of the journey.
        </p>
        <button className="px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-lg transition-colors text-lg">
          Start Free Trial
        </button>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 py-8">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <p>© 2025 ${projectName}. Built with TrendHunter AI.</p>
        </div>
      </footer>
    </main>
  );
}
`;

  // docs/PROJECT_SPEC.md - полная спецификация проекта
  files['docs/PROJECT_SPEC.md'] = `# ${projectName} - Project Specification

## Overview
${projectOutput.one_liner}

## Problem Statement
${projectOutput.problem_statement || 'TBD'}

## Solution Overview
${projectOutput.solution_overview || 'TBD'}

## Target Audience
**Primary:** ${context.analysis?.target_audience?.primary || 'TBD'}

### Segments
${context.analysis?.target_audience?.segments?.map(s => `- **${s.name}** (${s.size}) - Willingness to pay: ${s.willingness_to_pay || 'Unknown'}`).join('\n') || 'TBD'}

## Key Pain Points
${context.analysis?.key_pain_points?.map(p => `- ${p}`).join('\n') || 'TBD'}

## Core Features (MVP)

${projectOutput.mvp_specification?.core_features?.map(f => `### ${f.name}
- **Priority:** ${f.priority}
- **Description:** ${f.description}
- **User Story:** ${f.user_story}
- **Acceptance Criteria:**
${f.acceptance_criteria?.map(c => `  - ${c}`).join('\n') || '  - TBD'}
`).join('\n') || 'TBD'}

## Tech Stack
${projectOutput.mvp_specification?.tech_stack?.map(t => `### ${t.category}
- **Recommended:** ${t.recommendation}
- **Alternatives:** ${t.alternatives?.join(', ')}
- **Reasoning:** ${t.reasoning}
`).join('\n') || 'Standard Next.js stack'}

## Architecture
${projectOutput.mvp_specification?.architecture || 'TBD'}

## Estimated Complexity
${projectOutput.mvp_specification?.estimated_complexity || 'Medium'}

---

## Roadmap

### MVP Phase
- **Duration:** ${projectOutput.roadmap?.mvp?.duration || '4-6 weeks'}
- **Goals:**
${projectOutput.roadmap?.mvp?.goals?.map(g => `  - ${g}`).join('\n') || '  - Validate core value proposition'}
- **Deliverables:**
${projectOutput.roadmap?.mvp?.deliverables?.map(d => `  - ${d}`).join('\n') || '  - Working prototype'}
- **Success Metrics:**
${projectOutput.roadmap?.mvp?.success_metrics?.map(m => `  - ${m}`).join('\n') || '  - 100 beta signups'}

### Alpha Phase
- **Duration:** ${projectOutput.roadmap?.alpha?.duration || '2-4 weeks'}
- **Goals:**
${projectOutput.roadmap?.alpha?.goals?.map(g => `  - ${g}`).join('\n') || '  - Gather feedback'}

### Beta Phase
- **Duration:** ${projectOutput.roadmap?.beta?.duration || '4-8 weeks'}
- **Goals:**
${projectOutput.roadmap?.beta?.goals?.map(g => `  - ${g}`).join('\n') || '  - Scale testing'}

### Production
- **Goals:**
${projectOutput.roadmap?.production?.goals?.map(g => `  - ${g}`).join('\n') || '  - Public launch'}

---

## Competitive Analysis

${context.competition?.competitors?.map(c => `### ${c.name}
- Website: ${c.website || 'N/A'}
- Description: ${c.description || 'N/A'}
- Funding: ${c.funding || 'Unknown'}
`).join('\n') || 'No competitive analysis available'}

**Market Saturation:** ${context.competition?.market_saturation || 'Unknown'}
**Blue Ocean Score:** ${context.competition?.blue_ocean_score || 'N/A'}/10
**Strategic Positioning:** ${context.competition?.strategic_positioning || 'TBD'}

---

## Investment Landscape

- **Total Funding (Last Year):** ${context.venture?.total_funding_last_year || 'Unknown'}
- **Average Round:** ${context.venture?.average_round_size || 'Unknown'}
- **Investment Hotness:** ${context.venture?.investment_hotness || 'N/A'}/10
- **Recommended Round:** ${context.venture?.recommended_round || 'TBD'}
- **Target Investors:** ${context.venture?.key_investors_to_target?.join(', ') || 'TBD'}

---

## Business Metrics

- **Target Users (MVP):** ${projectOutput.business_metrics?.target_users_mvp || '100'}
- **Target Revenue (MVP):** ${projectOutput.business_metrics?.target_revenue_mvp || '$0'}
- **Target Users (Production):** ${projectOutput.business_metrics?.target_users_production || '10,000'}
- **Target Revenue (Production):** ${projectOutput.business_metrics?.target_revenue_production || '$50K MRR'}

### Key KPIs
${projectOutput.business_metrics?.key_kpis?.map(k => `- ${k}`).join('\n') || '- User signups\n- Retention rate'}

---

## Enhancement Recommendations

${projectOutput.enhancement_recommendations?.map(r => `### ${r.area} (${r.priority} priority)
- **Current State:** ${r.current_state}
- **Recommendation:** ${r.recommended_improvement}
- **Expected Impact:** ${r.expected_impact}
`).join('\n') || 'No recommendations yet'}

---

## Data Sources

### Reddit
${context.sources?.reddit?.communities?.map(c => `- r/${c}`).join('\n') || 'No Reddit data'}
**Engagement Score:** ${context.sources?.reddit?.engagement || 'N/A'}

### Google Trends
**Growth Rate:** ${context.sources?.google_trends?.growth_rate || 'N/A'}%
**Related Queries:** ${context.sources?.google_trends?.related_queries?.map(q => q.query).join(', ') || 'None'}

### Key Insights
${context.sources?.synthesis?.key_insights?.map(i => `- ${i}`).join('\n') || 'No insights'}

---

*Generated by TrendHunter AI Meta-Agent*
*Generated at: ${new Date().toISOString()}*
`;

  // docs/SETUP.md - инструкция по запуску
  files['docs/SETUP.md'] = `# Setup Guide

## Prerequisites
- Node.js 18+
- npm or yarn
- Git

## Installation

1. Clone the repository:
\`\`\`bash
git clone <repo-url>
cd ${sanitizedName}
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Copy environment variables:
\`\`\`bash
cp .env.example .env.local
\`\`\`

4. Configure your \`.env.local\`:
\`\`\`
DATABASE_URL=your_database_url
OPENAI_API_KEY=your_openai_key
\`\`\`

5. Run the development server:
\`\`\`bash
npm run dev
\`\`\`

6. Open [http://localhost:3000](http://localhost:3000)

## Build for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Deploy

### Vercel (Recommended)
1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy

### Docker
\`\`\`bash
docker build -t ${sanitizedName} .
docker run -p 3000:3000 ${sanitizedName}
\`\`\`

---

Need help? Check [PROJECT_SPEC.md](./PROJECT_SPEC.md) for full project details.
`;

  return files;
}

// Создание всех файлов проекта в репозитории ОДНИМ коммитом (Git Data API)
async function createProjectStructure(
  token: string,
  owner: string,
  repo: string,
  files: Record<string, string>
): Promise<{ success: boolean; filesCreated: number; errors: string[]; branch: string }> {
  const errors: string[] = [];
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  try {
    // Небольшая задержка чтобы GitHub успел создать начальный коммит
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 0. Получаем информацию о текущей ветке (main или master)
    let baseBranch = 'main';
    let baseCommitSha: string | null = null;

    for (const branch of ['main', 'master']) {
      const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
        headers,
      });

      if (refResponse.ok) {
        const refData = await refResponse.json();
        baseBranch = branch;
        baseCommitSha = refData.object.sha;
        console.log(`Found base branch: ${branch}, commit: ${baseCommitSha}`);
        break;
      }
    }

    if (!baseCommitSha) {
      console.log('No base commit found, creating orphan commit...');
    }

    // 1. Создаём blob для каждого файла
    const blobs: Array<{ path: string; sha: string }> = [];

    for (const [path, content] of Object.entries(files)) {
      // Ensure content is a string (Claude might return objects for some files)
      let fileContent: string;
      if (typeof content === 'string') {
        fileContent = content;
      } else if (content && typeof content === 'object') {
        fileContent = JSON.stringify(content, null, 2);
        console.warn(`[create-project] File ${path} was an object, converted to JSON string`);
      } else {
        console.error(`[create-project] File ${path} has invalid content type: ${typeof content}`);
        errors.push(`File ${path}: invalid content type`);
        continue;
      }

      const blobResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: Buffer.from(fileContent).toString('base64'),
          encoding: 'base64',
        }),
      });

      if (!blobResponse.ok) {
        const error = await blobResponse.json();
        errors.push(`Blob ${path}: ${error.message}`);
        continue;
      }

      const blob = await blobResponse.json();
      blobs.push({ path, sha: blob.sha });
    }

    if (blobs.length === 0) {
      return { success: false, filesCreated: 0, errors: ['No files created'], branch: baseBranch };
    }

    console.log(`Created ${blobs.length} blobs`);

    // 2. Создаём tree со всеми файлами
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        tree: blobs.map(b => ({
          path: b.path,
          mode: '100644', // file mode
          type: 'blob',
          sha: b.sha,
        })),
      }),
    });

    if (!treeResponse.ok) {
      const error = await treeResponse.json();
      return { success: false, filesCreated: 0, errors: [`Tree creation failed: ${error.message}`], branch: baseBranch };
    }

    const tree = await treeResponse.json();
    console.log(`Created tree: ${tree.sha}`);

    // 3. Создаём commit (с родителем если есть base commit)
    const commitPayload: Record<string, unknown> = {
      message: `🚀 MVP Project: Full structure

Generated by TrendHunter AI Meta-Agent
- ${blobs.length} files created
- Ready for: npm install && npm run dev`,
      tree: tree.sha,
    };

    // Добавляем родительский коммит если он есть
    if (baseCommitSha) {
      commitPayload.parents = [baseCommitSha];
    }

    const commitResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers,
      body: JSON.stringify(commitPayload),
    });

    if (!commitResponse.ok) {
      const error = await commitResponse.json();
      return { success: false, filesCreated: 0, errors: [`Commit creation failed: ${error.message}`], branch: baseBranch };
    }

    const commit = await commitResponse.json();
    console.log(`Created commit: ${commit.sha}`);

    // 4. Обновляем ref чтобы указывал на новый коммит
    const refResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${baseBranch}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sha: commit.sha,
        force: true,
      }),
    });

    if (!refResponse.ok) {
      // Если PATCH не работает, пробуем создать ref
      const createRefResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ref: `refs/heads/${baseBranch}`,
          sha: commit.sha,
        }),
      });

      if (!createRefResponse.ok) {
        const error = await createRefResponse.json();
        errors.push(`Failed to update branch reference: ${error.message}`);
      } else {
        console.log(`Created ${baseBranch} branch at commit ${commit.sha}`);
      }
    } else {
      console.log(`Updated ${baseBranch} branch to commit ${commit.sha}`);
    }

    return {
      success: errors.length === 0,
      filesCreated: blobs.length,
      errors,
      branch: baseBranch,
    };

  } catch (error) {
    console.error('createProjectStructure error:', error);
    return {
      success: false,
      filesCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
      branch: 'main',
    };
  }
}

// Получение имени пользователя GitHub
async function getGitHubUsername(token: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) return null;

    const user = await response.json();
    return user.login;
  } catch {
    return null;
  }
}

// Транслитерация кириллицы в латиницу
const CYRILLIC_TO_LATIN: Record<string, string> = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
  'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
  'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
  'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
  'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
};

function transliterate(text: string): string {
  return text
    .toLowerCase()
    .split('')
    .map(ch => CYRILLIC_TO_LATIN[ch] ?? ch)
    .join('');
}

// Генерация безопасного имени для репозитория
function generateRepoName(projectName: string): string {
  const transliterated = transliterate(projectName);
  const cleaned = transliterated
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')       // схлопнуть множественные дефисы
    .replace(/^-+/, '')        // убрать ведущие дефисы
    .replace(/-+$/, '')        // убрать хвостовые дефисы
    .substring(0, 50);

  // Если после очистки пусто — fallback
  if (!cleaned || cleaned.length < 2) {
    return `project-${Date.now().toString(36)}`;
  }

  return cleaned;
}

// DEPRECATED: Статические шаблоны больше не используются!
// Теперь ВСЕГДА используем Claude API для генерации реального кода.
// import { generateProjectFiles as generateTemplateFiles } from '@/lib/templates/generator';
// import { type ProductType } from '@/lib/templates';
// import { generateMVP, MVPType } from '@/lib/mvp-templates';

// Типы для обратной совместимости (но шаблоны не используются)
type ProductType = 'landing' | 'saas' | 'ai-wrapper' | 'ecommerce';
type MVPType = 'ai-tool' | 'calculator' | 'dashboard' | 'landing-waitlist';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { context, project_name, create_github_repo, product_type, mvp_type, auto_deploy } = body;

    // Получаем токены из cookies
    const githubToken = request.cookies.get('github_token')?.value;
    const vercelToken = request.cookies.get('vercel_token')?.value;

    if (!context?.trend?.title) {
      return NextResponse.json(
        { success: false, error: 'Context with trend data is required' },
        { status: 400 }
      );
    }

    // Проверяем, используем ли новую систему MVP или старую
    const validMVPTypes: MVPType[] = ['ai-tool', 'calculator', 'dashboard', 'landing-waitlist'];
    const useNewMVPSystem = mvp_type && validMVPTypes.includes(mvp_type);

    // Валидация product_type (для обратной совместимости)
    const validProductTypes: ProductType[] = ['landing', 'saas', 'ai-wrapper', 'ecommerce'];
    const selectedProductType: ProductType = validProductTypes.includes(product_type) ? product_type : 'landing';

    console.log(`Creating project for: ${context.trend.title}`);
    console.log(`MVP type: ${mvp_type || 'auto'}, Product type (legacy): ${selectedProductType}`);
    console.log(`Using new MVP system: ${useNewMVPSystem}`);
    console.log(`Context stages completed:`, {
      analysis: !!context.analysis,
      sources: !!context.sources,
      competition: !!context.competition,
      venture: !!context.venture,
      leads: !!context.leads,
      pitch: !!context.pitch,
    });
    console.log(`GitHub integration: ${create_github_repo ? 'enabled' : 'disabled'}, token: ${githubToken ? 'present' : 'missing'}`);
    console.log(`Auto deploy: ${auto_deploy ? 'enabled' : 'disabled'}, Vercel token: ${vercelToken ? 'present' : 'missing'}`);

    // Генерируем полную спецификацию проекта
    const projectOutput = await generateProjectSpecification(context);

    // Если передано кастомное имя проекта, используем его
    if (project_name) {
      projectOutput.project_name = project_name;
    }

    let github_url: string | undefined;
    let github_created = false;
    let vercel_url: string | undefined;
    let vercel_deployed = false;
    let files_created = 0;
    let generated_files: string[] = [];

    // Если запрошено создание GitHub репозитория и есть токен
    if (create_github_repo !== false && githubToken) {
      const username = await getGitHubUsername(githubToken);
      if (username) {
        const repoName = generateRepoName(projectOutput.project_name);
        const description = projectOutput.one_liner || `MVP project based on ${context.trend.title} trend`;

        console.log(`Creating GitHub repo: ${repoName}`);

        const repoResult = await createGitHubRepo(githubToken, repoName, description);

        if (repoResult.success && repoResult.url) {
          github_url = repoResult.url;
          if (repoResult.existed) {
            console.log(`[create-project] Reusing existing repo: ${github_url}`);
          }
          github_created = true;

          // ВСЕГДА используем Claude API для генерации — никаких статических шаблонов!
          let projectFiles: Record<string, string>;

          // Получаем derived_features из ProductSpec или генерируем из анализа
          let derivedFeatures = context.productSpec?.derived_features || [];

          // Если derived_features пустой — генерируем из контекста анализа
          if (derivedFeatures.length === 0 && context.analysis) {
            console.log('[create-project] No derived_features, generating from analysis context...');

            // Создаём базовые фичи из анализа болей
            const mainPain = context.analysis.main_pain || projectOutput.problem_statement;
            const keyPains = context.analysis.key_pain_points || [];
            const opportunities = context.analysis.opportunities || [];

            derivedFeatures = [
              {
                feature_name: 'Решение главной боли',
                pain_source: 'analysis',
                pain_quote: mainPain,
                solution: projectOutput.solution_overview || `Инструмент для решения: ${mainPain}`,
                priority: 'must-have',
                implementation_hint: 'Core functionality with real API integration',
              },
              ...keyPains.slice(0, 2).map((pain: string, i: number) => ({
                feature_name: `Дополнительная функция ${i + 1}`,
                pain_source: 'key_pain_points',
                pain_quote: pain,
                solution: `Функционал для: ${pain}`,
                priority: i === 0 ? 'should-have' : 'nice-to-have',
                implementation_hint: 'Supporting feature with data persistence',
              })),
              ...opportunities.slice(0, 1).map((opp: string) => ({
                feature_name: 'Рыночная возможность',
                pain_source: 'opportunities',
                pain_quote: opp,
                solution: `Использовать возможность: ${opp}`,
                priority: 'should-have',
                implementation_hint: 'Market differentiator feature',
              })),
            ];

            console.log(`[create-project] Generated ${derivedFeatures.length} features from analysis`);
          }

          // Формируем spec для Claude API
          const claudeSpec = {
            project_name: projectOutput.project_name,
            one_liner: projectOutput.one_liner,
            problem_statement: projectOutput.problem_statement,
            solution_overview: projectOutput.solution_overview,
            target_audience: context.analysis?.target_audience?.primary || 'Broad audience',
            main_pain: context.analysis?.main_pain || projectOutput.problem_statement,
            mvp_specification: projectOutput.mvp_specification,
            design_system: context.productSpec?.design_system,
            derived_features: derivedFeatures,
          };

          console.log(`[create-project] ALWAYS using Claude API with ${derivedFeatures.length} derived_features`);
          derivedFeatures.forEach((f: { feature_name: string; priority: string; pain_quote: string; solution: string }, i: number) => {
            console.log(`  ${i + 1}. ${f.feature_name} [${f.priority}]: "${f.pain_quote}" → ${f.solution}`);
          });

          // Вызываем Claude API для генерации кода
          console.log('[create-project] Calling generateCodeWithClaude directly...');
          let codeGenError: string | null = null;
          try {
            const generatedFiles = await generateCodeWithClaude(claudeSpec as ProjectSpec);
            projectFiles = generatedFiles;
            // Всегда перезаписываем README из спецификации (placeholder из validator слишком минимальный)
            if (projectOutput.readme_content) {
              projectFiles['README.md'] = projectOutput.readme_content;
            }
            console.log(`[create-project] Claude generated ${Object.keys(projectFiles).length} files with REAL integrations`);
          } catch (codeErr) {
            const errMsg = codeErr instanceof Error ? codeErr.message : String(codeErr);
            console.error(`[create-project] Code generation FAILED: ${errMsg}`);
            codeGenError = errMsg;
            // Fallback: минимальный набор файлов чтобы репо не было пустым
            projectFiles = {
              'README.md': `# ${projectOutput.project_name}\n\n${projectOutput.one_liner}\n\n## Problem\n${projectOutput.problem_statement}\n\n## Solution\n${projectOutput.solution_overview}\n\n---\n*Code generation failed: ${errMsg}*\n*Re-run project creation to generate full code.*`,
              'package.json': JSON.stringify({
                name: generateRepoName(projectOutput.project_name),
                version: '0.1.0',
                private: true,
                scripts: { dev: 'next dev', build: 'next build', start: 'next start' },
                dependencies: { next: '^14.0.0', react: '^18.2.0', 'react-dom': '^18.2.0' },
                devDependencies: { typescript: '^5.0.0', '@types/react': '^18.2.0', '@types/node': '^20.0.0', tailwindcss: '^3.3.0' },
              }, null, 2),
            };
          }

          // Проверяем что Claude создал критические файлы
          const criticalFiles = ['.env.example', 'package.json', 'src/app/page.tsx'];
          const missingCritical = criticalFiles.filter(f => !projectFiles[f]);
          if (missingCritical.length > 0) {
            console.warn(`[create-project] WARNING: Missing critical files: ${missingCritical.join(', ')}`);
          }

          // Сохраняем список файлов для response
          generated_files = Object.keys(projectFiles);
          console.log(`Creating ${generated_files.length} files in repo (type: ${selectedProductType})...`);

          // Создаём все файлы в репозитории
          const structureResult = await createProjectStructure(
            githubToken,
            username,
            repoName,
            projectFiles
          );

          files_created = structureResult.filesCreated;

          if (structureResult.success) {
            console.log(`GitHub repo created with ${files_created} files: ${github_url}`);
          } else {
            console.warn(`GitHub repo created with ${files_created} files, but some failed:`, structureResult.errors);
          }

          // Если генерация кода не удалась — добавляем предупреждение в ответ
          if (codeGenError) {
            projectOutput.code_generation_error = codeGenError;
          }

          // Автоматический деплой на Vercel если запрошено
          if (auto_deploy && vercelToken && github_url) {
            try {
              const { deployFromGitHub } = await import('@/lib/vercel');
              const repoPath = `${username}/${repoName}`;

              console.log(`Deploying to Vercel: ${repoPath}`);

              const deployResult = await deployFromGitHub(vercelToken, repoName, repoPath, structureResult.branch);

              if (deployResult.success) {
                vercel_url = deployResult.projectUrl;
                vercel_deployed = true;
                console.log(`Vercel deployment started: ${vercel_url}`);
              } else {
                console.warn('Vercel deployment failed:', deployResult.error);
              }
            } catch (deployError) {
              console.error('Vercel deployment error:', deployError);
            }
          }
        } else {
          console.warn('Failed to create GitHub repo:', repoResult.error);
        }
      }
    }

    // Извлекаем список фич для response
    const features_list = projectOutput.mvp_specification?.core_features?.map(f => ({
      name: f.name,
      description: f.description,
      priority: f.priority,
    })) || [];

    return NextResponse.json({
      success: true,
      data: {
        ...projectOutput,
        github_url,
        vercel_url,
        product_type: selectedProductType,
        mvp_type: useNewMVPSystem ? mvp_type : null,
        is_functional_mvp: useNewMVPSystem, // Флаг что это рабочий MVP
      },
      github_created,
      vercel_deployed,
      // Новые поля из таблицы требований
      files_created,
      generated_files,
      features_list,
      preview_url: vercel_url || null, // Alias для vercel_url
      context_summary: {
        trend: context.trend.title,
        main_pain: context.analysis?.main_pain,
        target_audience: context.analysis?.target_audience?.primary,
        competitors_count: context.competition?.competitors?.length || 0,
        leads_count: context.leads?.companies?.length || 0,
        investment_hotness: context.venture?.investment_hotness,
      },
      generated_at: new Date().toISOString(),
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('Create project API error:', errMsg, error);
    return NextResponse.json(
      { success: false, error: `Project creation failed: ${errMsg}` },
      { status: 500 }
    );
  }
}
