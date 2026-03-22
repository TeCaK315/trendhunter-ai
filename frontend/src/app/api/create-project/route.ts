import { NextRequest, NextResponse } from 'next/server';
import { generateCodeWithClaude, ProjectSpec } from '@/lib/code-generator';
import { assembleProject } from '@/lib/blocks/block-assembler';
import { sanitizeImports } from '@/lib/blocks/custom/gap-filler';
import type { ProductSpecification } from '@/lib/mvp-templates/types';

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
    // Build full context from all experts
    const fullContextPrompt = `
# FULL MARKET ANALYSIS CONTEXT

## 1. TREND
- Title: ${context.trend.title}
- Category: ${context.trend.category || 'Technology'}
- Why trending: ${context.trend.why_trending || 'Growing demand'}

## 2. PAIN ANALYSIS (from Pain Point Expert)
${context.analysis ? `
- Main pain: ${context.analysis.main_pain}
- Confidence: ${context.analysis.confidence || 'N/A'}%
- Key pain points: ${context.analysis.key_pain_points?.join(', ') || 'N/A'}
- Target audience: ${context.analysis.target_audience?.primary || 'N/A'}
- Segments: ${context.analysis.target_audience?.segments?.map(s => `${s.name} (${s.size}, willingness to pay: ${s.willingness_to_pay || 'N/A'})`).join('; ') || 'N/A'}
- Opportunities: ${context.analysis.opportunities?.join(', ') || 'N/A'}
- Risks: ${context.analysis.risks?.join(', ') || 'N/A'}
- Market readiness: ${context.analysis.market_readiness || 'N/A'}/10
` : 'No analysis data available'}

## 3. DATA SOURCES (from Sources Expert)
${context.sources ? `
- Reddit engagement: ${context.sources.reddit?.engagement || 0}
- Active communities: ${context.sources.reddit?.communities?.join(', ') || 'N/A'}
- Google Trends growth: ${context.sources.google_trends?.growth_rate || 0}%
- Related queries: ${context.sources.google_trends?.related_queries?.map(q => q.query).join(', ') || 'N/A'}
- YouTube content: ${context.sources.youtube?.videos?.length || 0} videos
- Key insights: ${context.sources.synthesis?.key_insights?.join('; ') || 'N/A'}
- Content gaps: ${context.sources.synthesis?.content_gaps?.join('; ') || 'N/A'}
- Recommended angles: ${context.sources.synthesis?.recommended_angles?.join('; ') || 'N/A'}
` : 'No source data available'}

## 4. COMPETITORS (from Competition Expert)
${context.competition ? `
- Market saturation: ${context.competition.market_saturation}
- Blue Ocean Score: ${context.competition.blue_ocean_score}/10
- Competitors: ${context.competition.competitors?.map(c => `${c.name}${c.funding ? ` (${c.funding})` : ''}`).join(', ') || 'N/A'}
- Opportunity areas: ${context.competition.opportunity_areas?.join(', ') || 'N/A'}
- Strategic positioning: ${context.competition.strategic_positioning || 'N/A'}
- Differentiation: ${context.competition.differentiation_opportunities?.join('; ') || 'N/A'}
` : 'No competitive analysis available'}

## 5. INVESTMENTS (from Venture Expert)
${context.venture ? `
- Total funding in niche: ${context.venture.total_funding_last_year}
- Average round: ${context.venture.average_round_size || 'N/A'}
- Funding trend: ${context.venture.funding_trend || 'N/A'}
- Investment hotness: ${context.venture.investment_hotness}/10
- Investment thesis: ${context.venture.investment_thesis || 'N/A'}
- Recommended round: ${context.venture.recommended_round || 'N/A'}
- Target investors: ${context.venture.key_investors_to_target?.join(', ') || 'N/A'}
- Market signals: ${context.venture.market_signals?.join('; ') || 'N/A'}
` : 'No investment analysis available'}

## 6. POTENTIAL CLIENTS (from Leads Expert)
${context.leads ? `
- Companies found: ${context.leads.companies?.length || 0}
- Top clients: ${context.leads.companies?.slice(0, 5).map(c => `${c.name} (${c.industry}, relevance: ${c.relevance_score}/10)`).join('; ') || 'N/A'}
- LinkedIn queries: ${context.leads.linkedin_queries?.join('; ') || 'N/A'}
- Directories: ${context.leads.directories?.map(d => d.name).join(', ') || 'N/A'}
- Outreach sequence: ${context.leads.outreach_sequence?.join(' → ') || 'N/A'}
` : 'No leads data available'}

## 7. PITCH DECK (from Presentation Expert)
${context.pitch ? `
- Company name: ${context.pitch.company_name}
- Tagline: ${context.pitch.tagline}
- Slides: ${context.pitch.slides?.length || 0}
` : 'No pitch deck created'}
`;

    const prompt = `You are the META-AGENT — the final expert in the analysis chain. Your task is to compile ALL data from the previous 7 experts into a complete technical specification for building an MVP.

ABSOLUTE RULE: ALL output text MUST be in ENGLISH. No Russian, no exceptions. Every single string value in the JSON must be in English.

${fullContextPrompt}

Based on ALL the data above, create a COMPLETE project specification.

IMPORTANT:
1. Use REAL data from the experts — do not invent facts
2. MVP must solve the MAIN PAIN from the analysis
3. Tech stack must be budget-friendly ($0-100/month)
4. Roadmap must be SPECIFIC and tied to the analysis data:
   - MVP: solve the main pain "${context.analysis?.main_pain || 'not defined'}"
   - Alpha: iterate based on feedback from "${context.analysis?.target_audience?.primary || 'target audience'}"
   - Beta: differentiate from competitors (${context.competition?.competitors?.slice(0, 2).map(c => c.name).join(', ') || 'main players'})
   - Production: market launch (investment hotness: ${context.venture?.investment_hotness || 'N/A'}/10)
5. Recommendations must account for competitors and market
6. Success metrics must be measurable and tied to target audience

CRITICAL: ALL text values in the JSON MUST be in ENGLISH. The project will be deployed as a public English-language website.
- project_name MUST be a short, catchy English brand name UNIQUE to this specific niche (e.g. "CodeLens" for dev tools, "MealPlan" for food, "FitTrack" for fitness), NOT a translated Russian phrase
- one_liner, problem_statement, solution_overview — all in English
- ALL feature names, descriptions, user stories — in English
- The project MUST reflect the SPECIFIC niche, pain points, and target audience from the analysis data — NOT a generic tool

CRITICAL REMINDER: Every single string value in the JSON below MUST be in English. No Russian text anywhere.

Return JSON only:
{
  "project_name": "Short catchy English brand name SPECIFIC to this niche and problem",
  "one_liner": "Short English tagline, max 10 words, describing THIS specific product's value",
  "problem_statement": "Detailed problem description based on pain analysis — in English",
  "solution_overview": "Solution description with positioning — in English",

  "readme_content": "Full README.md for GitHub in English (markdown)",

  "mvp_specification": {
    "core_features": [
      {
        "name": "Feature name in English",
        "description": "What it does — in English",
        "priority": "must-have",
        "user_story": "As a [user], I want [feature] so that [benefit]",
        "acceptance_criteria": ["Criterion 1 in English", "Criterion 2 in English"]
      }
    ],
    "tech_stack": [
      {
        "category": "Frontend",
        "recommendation": "Next.js",
        "alternatives": ["React", "Vue"],
        "reasoning": "Why this choice — in English"
      }
    ],
    "architecture": "Architecture description in English",
    "estimated_complexity": "medium"
  },

  "roadmap": {
    "mvp": {
      "duration": "4-6 weeks",
      "goals": ["Specific goal addressing the main pain point — English"],
      "deliverables": ["Concrete feature solving: ${context.analysis?.main_pain || 'core problem'} — English"],
      "success_metrics": ["Validation metric: e.g. 100 ${context.analysis?.target_audience?.segments?.[0]?.name || 'target users'} tested the product"]
    },
    "alpha": {
      "duration": "2-4 weeks",
      "goals": ["Goal based on feedback from ${context.analysis?.target_audience?.primary || 'target audience'} — English"],
      "deliverables": ["Improvements based on early user feedback — English"],
      "success_metrics": ["Pain reduction metric: ${context.analysis?.key_pain_points?.[0] || 'reduce main pain point'} — English"]
    },
    "beta": {
      "duration": "4-8 weeks",
      "goals": ["Scale and differentiate from ${context.competition?.competitors?.[0]?.name || 'main competitor'} — English"],
      "deliverables": ["Features to outperform competitors — English"],
      "success_metrics": ["Growth metric — English"]
    },
    "production": {
      "goals": ["Public launch focused on ${context.venture?.investment_thesis || 'growth'} — English"],
      "deliverables": ["Full product ready for ${context.venture?.recommended_round || 'market entry'} — English"],
      "success_metrics": ["Revenue or adoption target — English"]
    }
  },

  "enhancement_recommendations": [
    {
      "area": "Area of improvement — English",
      "current_state": "Current MVP state — English",
      "recommended_improvement": "Recommended improvement — English",
      "expected_impact": "Expected impact — English",
      "priority": "high"
    }
  ],

  "business_metrics": {
    "target_users_mvp": "100 beta users",
    "target_revenue_mvp": "$0 (validation)",
    "target_users_production": "10,000 users",
    "target_revenue_production": "$50K MRR",
    "key_kpis": ["KPI 1 — English", "KPI 2 — English"]
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
  // Generate English project name — strip all non-ASCII (removes Russian characters)
  const trendTitle = context.trend.title || 'MyProject';
  const englishOnly = trendTitle.replace(/[^a-zA-Z0-9\s]/g, '').trim();
  const projectName = context.pitch?.company_name || (englishOnly.length > 2 ? englishOnly : 'SmartTool MVP');

  return {
    project_name: projectName,
    one_liner: `Smart ${context.trend?.category || 'productivity'} tool for ${context.analysis?.target_audience?.primary || 'modern businesses'}`,
    problem_statement: context.analysis?.main_pain || 'Current solutions are too complex and expensive for the target audience',
    solution_overview: context.competition?.strategic_positioning || 'A streamlined solution that addresses the core pain points with modern technology',

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

    // Sanitize project_name: must be short English brand name, not a Russian description
    const pn = projectOutput.project_name || '';
    const asciiOnly = pn.replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
    if (asciiOnly.length < 3 || pn.split(/\s+/).length > 5) {
      // Name is non-ASCII or too long — generate a fallback
      const trendWords = (context.trend.title || '').replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
      projectOutput.project_name = trendWords.length >= 2
        ? trendWords.slice(0, 2).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')
        : 'SmartTool MVP';
    } else if (asciiOnly !== pn) {
      projectOutput.project_name = asciiOnly;
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

          console.log(`[create-project] Features: ${derivedFeatures.length} derived_features`);
          derivedFeatures.forEach((f: { feature_name: string; priority: string; pain_quote: string; solution: string }, i: number) => {
            console.log(`  ${i + 1}. ${f.feature_name} [${f.priority}]: "${f.pain_quote}" → ${f.solution}`);
          });

          // Используем блочный ассемблер (быстро, дёшево) если есть productSpec
          // Fallback на Claude pipeline если нет
          let codeGenError: string | null = null;
          const fullProductSpec = context.productSpec as ProductSpecification | undefined;

          if (fullProductSpec) {
            // Block Assembler: ~30 сек, 0-1 Claude call
            console.log('[create-project] Using Block Assembler (fast mode)...');
            try {
              const assemblyResult = await assembleProject({
                product_spec: fullProductSpec,
                project_name: projectOutput.project_name,
              });
              projectFiles = assemblyResult.files;
              // Block assembler generates comprehensive README — don't overwrite with GPT stub
              console.log(`[create-project] Block Assembler: ${assemblyResult.total_files} files in ${assemblyResult.assembly_time_ms}ms (${assemblyResult.claude_calls} Claude calls, blocks: ${assemblyResult.blocks_used.length})`);
            } catch (blockErr) {
              const errMsg = blockErr instanceof Error ? blockErr.message : String(blockErr);
              console.error(`[create-project] Block Assembler FAILED: ${errMsg}, falling back to Claude...`);
              // Fallback на Claude pipeline
              try {
                const generatedFiles = await generateCodeWithClaude(claudeSpec as ProjectSpec);
                projectFiles = generatedFiles;
                console.log(`[create-project] Claude fallback generated ${Object.keys(projectFiles).length} files`);
              } catch (claudeErr) {
                codeGenError = claudeErr instanceof Error ? claudeErr.message : String(claudeErr);
                console.error(`[create-project] Claude fallback also FAILED: ${codeGenError}`);
                projectFiles = {
                  'README.md': `# ${projectOutput.project_name}\n\n${projectOutput.one_liner}\n\n## Problem\n${projectOutput.problem_statement}\n\n## Solution\n${projectOutput.solution_overview}\n\n---\n*Code generation failed: ${codeGenError}*\n*Re-run project creation to generate full code.*`,
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
            }
          } else {
            // Legacy: Claude pipeline (~50 min) — только если нет productSpec
            console.log('[create-project] No productSpec, using Claude pipeline (legacy)...');
            try {
              const generatedFiles = await generateCodeWithClaude(claudeSpec as ProjectSpec);
              projectFiles = generatedFiles;
              if (projectOutput.readme_content) {
                projectFiles['README.md'] = projectOutput.readme_content;
              }
              console.log(`[create-project] Claude generated ${Object.keys(projectFiles).length} files`);
            } catch (codeErr) {
              const errMsg = codeErr instanceof Error ? codeErr.message : String(codeErr);
              console.error(`[create-project] Code generation FAILED: ${errMsg}`);
              codeGenError = errMsg;
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
          }

          // Sanitize all generated files (fix translated keywords, wrong imports)
          projectFiles = sanitizeImports(projectFiles);

          // ─── FINAL SAFETY: remove ALL Cyrillic from code files (not UI strings) ───
          // This is the last line of defense: scan every .ts/.tsx/.js/.jsx file
          // and replace Cyrillic words that appear as code keywords (at statement positions)
          for (const [filePath, content] of Object.entries(projectFiles)) {
            if (!/\.(ts|tsx|js|jsx)$/.test(filePath)) continue;

            // Check if any Cyrillic word appears at a statement position (start of line)
            const cyrillicKeywordPattern = /^(\s*)(возврат|функция|конст|пусть|импорт|экспорт|ожидать|класс|бросить|попытка|поймать|наконец)(\s|\(|;)/gm;
            if (cyrillicKeywordPattern.test(content)) {
              let fixed = content;
              fixed = fixed.replace(/^(\s*)возврат(\s*\()/gm, '$1return$2');
              fixed = fixed.replace(/^(\s*)возврат(\s)/gm, '$1return$2');
              fixed = fixed.replace(/^(\s*)возврат;/gm, '$1return;');
              fixed = fixed.replace(/^(\s*)функция\s/gm, '$1function ');
              fixed = fixed.replace(/^(\s*)конст\s/gm, '$1const ');
              fixed = fixed.replace(/^(\s*)пусть\s/gm, '$1let ');
              fixed = fixed.replace(/^(\s*)импорт\s/gm, '$1import ');
              fixed = fixed.replace(/^(\s*)экспорт\s/gm, '$1export ');
              fixed = fixed.replace(/^(\s*)ожидать\s/gm, '$1await ');
              fixed = fixed.replace(/^(\s*)класс\s/gm, '$1class ');
              fixed = fixed.replace(/^(\s*)бросить\s/gm, '$1throw ');
              fixed = fixed.replace(/^(\s*)попытка\s*\{/gm, '$1try {');
              fixed = fixed.replace(/^(\s*)\}\s*поймать\s*\(/gm, '$1} catch (');
              fixed = fixed.replace(/^(\s*)наконец\s*\{/gm, '$1finally {');
              console.log(`[create-project] ⚠️ FIXED Cyrillic keywords in ${filePath}`);
              projectFiles[filePath] = fixed;
            }
          }

          // Debug: log first 300 chars of page.tsx to verify it's correct
          if (projectFiles['src/app/page.tsx']) {
            const pagePreview = projectFiles['src/app/page.tsx'].substring(0, 300);
            console.log(`[create-project] page.tsx preview:\n${pagePreview}`);
            if (pagePreview.includes('возврат')) {
              console.error('[create-project] ❌ CRITICAL: page.tsx still contains возврат after all sanitization!');
            }
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
