/**
 * Template Generator
 *
 * Генерирует файлы проекта на основе выбранного типа продукта и контекста
 */

import { type ProductType } from './index';
import { generateLandingTemplate } from './landing';
import { generateAIWrapperTemplate } from './ai-wrapper';
import { generateSaaSTemplate } from './saas';

interface ProjectContext {
  projectName: string;
  tagline: string;
  description: string;
  problemStatement: string;
  solutionOverview: string;
  features: Array<{ name: string; description: string }>;
  targetAudience: string;
  systemPrompt?: string; // Для AI Wrapper
  aiPurpose?: string; // Для AI Wrapper
  dashboardMetrics?: string[]; // Для SaaS
  ctaText?: string; // Для Landing
}

interface FullAnalysisContext {
  trend: {
    id?: string;
    title: string;
    category?: string;
    why_trending?: string;
  };
  analysis?: {
    main_pain: string;
    key_pain_points?: string[];
    target_audience?: {
      primary: string;
      segments?: Array<{ name: string; size: string; willingness_to_pay?: string }>;
    };
    opportunities?: string[];
  };
  sources?: {
    synthesis?: {
      key_insights?: string[];
    };
  };
  competition?: {
    strategic_positioning?: string;
    differentiation_opportunities?: string[];
  };
  pitch?: {
    company_name?: string;
    tagline?: string;
  };
}

/**
 * Преобразует контекст анализа в контекст для генерации шаблона
 */
export function buildProjectContext(analysisContext: FullAnalysisContext): ProjectContext {
  const trend = analysisContext.trend;
  const analysis = analysisContext.analysis;
  const pitch = analysisContext.pitch;
  const competition = analysisContext.competition;
  const synthesis = analysisContext.sources?.synthesis;

  // Генерируем features из key_pain_points и opportunities
  const features: Array<{ name: string; description: string }> = [];

  if (analysis?.key_pain_points) {
    analysis.key_pain_points.slice(0, 3).forEach((pain, i) => {
      features.push({
        name: `Решение #${i + 1}`,
        description: `Устраняет проблему: ${pain}`,
      });
    });
  }

  if (analysis?.opportunities) {
    analysis.opportunities.slice(0, 3).forEach((opp, i) => {
      features.push({
        name: `Возможность #${i + 1}`,
        description: opp,
      });
    });
  }

  // Дополняем до 6 features если мало
  if (features.length < 6) {
    const defaultFeatures = [
      { name: 'Быстрый старт', description: 'Начните работу за минуты, без сложной настройки' },
      { name: 'Интуитивный UI', description: 'Понятный интерфейс для любого уровня пользователей' },
      { name: 'Масштабируемость', description: 'Растёт вместе с вашим бизнесом' },
      { name: 'Безопасность', description: 'Защита данных на всех уровнях' },
      { name: 'Интеграции', description: 'Легко подключается к вашим инструментам' },
      { name: 'Поддержка', description: 'Документация и помощь когда нужно' },
    ];

    while (features.length < 6) {
      const next = defaultFeatures[features.length];
      if (next) features.push(next);
      else break;
    }
  }

  return {
    projectName: pitch?.company_name || trend.title,
    tagline: pitch?.tagline || analysis?.main_pain || `${trend.title} - современное решение`,
    description: trend.why_trending || 'Решение актуальной проблемы рынка',
    problemStatement: analysis?.main_pain || `Пользователи сталкиваются с проблемой в области ${trend.title}`,
    solutionOverview: competition?.strategic_positioning || `Уникальное решение для ${trend.title}`,
    features,
    targetAudience: analysis?.target_audience?.primary || 'Современные компании и предприниматели',
    // AI Wrapper specific
    systemPrompt: `Ты - эксперт в области ${trend.title}. ${analysis?.main_pain ? `Твоя главная задача - помочь решить проблему: ${analysis.main_pain}` : ''} Отвечай чётко и по делу, предоставляй практичные рекомендации.`,
    aiPurpose: synthesis?.key_insights?.[0] || `Помощник по ${trend.title}`,
    // SaaS specific
    dashboardMetrics: ['Активные пользователи', 'Конверсия', 'Время в системе', 'Доход'],
    ctaText: 'Попробовать бесплатно',
  };
}

/**
 * Генерирует файлы проекта на основе типа и контекста
 */
export function generateProjectFiles(
  productType: ProductType,
  analysisContext: FullAnalysisContext
): Record<string, string> {
  const projectContext = buildProjectContext(analysisContext);

  switch (productType) {
    case 'landing':
      return generateLandingTemplate(projectContext);

    case 'ai-wrapper':
      return generateAIWrapperTemplate({
        ...projectContext,
        systemPrompt: projectContext.systemPrompt || '',
        aiPurpose: projectContext.aiPurpose || '',
      });

    case 'saas':
      return generateSaaSTemplate(projectContext);

    case 'ecommerce':
      // E-commerce шаблон ещё не реализован, используем SaaS как базу
      return generateSaaSTemplate({
        ...projectContext,
        dashboardMetrics: ['Заказы', 'Выручка', 'Средний чек', 'Конверсия'],
      });

    default:
      // По умолчанию - Landing
      return generateLandingTemplate(projectContext);
  }
}

/**
 * Генерирует README.md на основе типа продукта и контекста
 */
export function generateReadme(
  productType: ProductType,
  context: ProjectContext
): string {
  const typeNames: Record<ProductType, string> = {
    landing: 'Landing Page + Waitlist',
    saas: 'SaaS Dashboard',
    'ai-wrapper': 'AI Wrapper Application',
    ecommerce: 'E-commerce Store',
  };

  return `# ${context.projectName}

${context.tagline}

## О проекте

**Тип:** ${typeNames[productType]}

${context.description}

## Проблема

${context.problemStatement}

## Решение

${context.solutionOverview}

## Целевая аудитория

${context.targetAudience}

## Возможности

${context.features.map(f => `- **${f.name}:** ${f.description}`).join('\n')}

## Быстрый старт

\`\`\`bash
# Установка зависимостей
npm install

# Настройка окружения
cp .env.example .env.local
# Отредактируйте .env.local с вашими API ключами

# Запуск в режиме разработки
npm run dev
\`\`\`

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Деплой

### Vercel (рекомендуется)

1. Push в GitHub
2. Импортируйте репозиторий в [Vercel](https://vercel.com)
3. Добавьте Environment Variables
4. Deploy!

## Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Database:** Supabase
- **Auth:** Supabase Auth
- **Hosting:** Vercel

---

*Создано с [TrendHunter AI](https://trendhunter.ai) 🚀*
`;
}
