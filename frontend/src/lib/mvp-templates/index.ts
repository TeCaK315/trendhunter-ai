/**
 * MVP Templates Index
 *
 * Экспортирует все генераторы и типы для создания рабочих MVP
 */

// Типы
export * from './types';

// Генераторы Level 1 (Basic MVP ~10 files)
export { generateAIToolFiles, generateAIToolConfig } from './ai-tool-generator';
export { generateCalculatorFiles, generateCalculatorConfig } from './calculator-generator';
export { generateDashboardFiles, generateDashboardConfig } from './dashboard-generator';
export { generateLandingFiles, generateLandingConfig } from './landing-generator';

// Генераторы Level 2 (Functional Prototype ~50 files with Supabase + Auth + Stripe)
export { generateAIToolFilesV2 } from './ai-tool-generator-v2';

// Импорты для главного генератора
import { MVPType, MVPGenerationContext, MVPGenerationResult, detectMVPType, getMVPTypeDefinition } from './types';
import { generateAIToolFiles } from './ai-tool-generator';
import { generateAIToolFilesV2 } from './ai-tool-generator-v2';
import { generateCalculatorFiles } from './calculator-generator';
import { generateDashboardFiles } from './dashboard-generator';
import { generateLandingFiles } from './landing-generator';

/**
 * MVP Generation Level
 * - 1: Basic MVP (~10 files, simple structure)
 * - 2: Functional Prototype (~50 files, Supabase + Auth + Stripe)
 */
export type MVPLevel = 1 | 2;

/**
 * Главная функция генерации MVP
 *
 * @param context - Контекст анализа тренда
 * @param mvpType - Тип MVP (опционально, автоопределяется)
 * @param level - Уровень генерации (1 = basic, 2 = full prototype)
 * @returns Результат генерации с файлами проекта
 */
export function generateMVP(
  context: MVPGenerationContext,
  mvpType?: MVPType,
  level: MVPLevel = 1
): MVPGenerationResult {
  // Определяем тип MVP если не указан
  const type = mvpType || detectMVPType(context);
  const definition = getMVPTypeDefinition(type);

  // Генерируем файлы в зависимости от типа и уровня
  let files: Record<string, string>;

  if (level === 2 && type === 'ai-tool') {
    // Level 2: Full Functional Prototype with Supabase + Stripe
    files = generateAIToolFilesV2(context);
  } else {
    // Level 1: Basic MVP
    switch (type) {
      case 'ai-tool':
        files = generateAIToolFiles(context);
        break;
      case 'calculator':
        files = generateCalculatorFiles(context);
        break;
      case 'dashboard':
        files = generateDashboardFiles(context);
        break;
      case 'landing-waitlist':
      default:
        files = generateLandingFiles(context);
        break;
    }
  }

  // Формируем результат
  const projectName = context.pitch?.company_name ||
    context.trend.title.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').trim();

  const setupInstructions = level === 2 ? [
    'git clone <repo-url>',
    `cd ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    'npm install',
    'cp .env.example .env.local',
    '# Настройте Supabase: создайте проект на supabase.com',
    '# Настройте Stripe: создайте аккаунт и products',
    '# Добавьте все ключи в .env.local',
    'npm run dev',
  ] : [
    'git clone <repo-url>',
    `cd ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    'npm install',
    'cp .env.example .env.local',
    '# Настройте переменные в .env.local',
    'npm run dev',
  ];

  return {
    mvpType: type,
    projectName,
    files,
    readme: files['README.md'] || '',
    envExample: files['.env.example'] || '',
    features: definition?.features || [],
    setupInstructions,
  };
}

/**
 * Получает рекомендуемый тип MVP с объяснением
 * Если есть productSpec - использует его generation_approach для более точной рекомендации
 */
export function getRecommendedMVPType(context: MVPGenerationContext): {
  type: MVPType;
  confidence: number;
  reason: string;
  alternatives: MVPType[];
} {
  // Если есть productSpec - используем его рекомендацию
  if (context.productSpec) {
    const specApproach = context.productSpec.generation_approach;

    // Маппинг generation_approach -> MVPType
    const approachToType: Record<string, MVPType> = {
      'ai-tool': 'ai-tool',
      'calculator': 'calculator',
      'dashboard': 'dashboard',
      'automation': 'ai-tool', // automation -> ai-tool
      'marketplace': 'dashboard', // marketplace -> dashboard
      'content-platform': 'landing-waitlist', // content-platform -> landing
    };

    const type = approachToType[specApproach] || detectMVPType(context);
    const confidence = Math.round(context.productSpec.confidence_score * 10); // 0-10 -> 0-100

    // Формируем причину на основе productSpec
    const reason = `AI анализ определил: ${context.productSpec.magic_location.description}. ` +
      `Пользователь получает: ${context.productSpec.user_output.primary_output}`;

    const alternatives: MVPType[] = ['ai-tool', 'calculator', 'dashboard', 'landing-waitlist']
      .filter(t => t !== type) as MVPType[];

    return { type, confidence, reason, alternatives };
  }

  // Fallback: старая логика
  const type = detectMVPType(context);
  const definition = getMVPTypeDefinition(type);

  // Определяем уверенность на основе совпадения ключевых слов
  const painText = [
    context.analysis?.main_pain || '',
    ...(context.analysis?.key_pain_points || []),
    context.trend.title,
  ].join(' ').toLowerCase();

  let matchCount = 0;
  for (const keyword of definition?.keywords || []) {
    if (painText.includes(keyword.toLowerCase())) {
      matchCount++;
    }
  }

  const confidence = Math.min(100, Math.round((matchCount / 5) * 100));

  // Формируем причину рекомендации
  let reason = '';
  switch (type) {
    case 'ai-tool':
      reason = 'Боль связана с анализом, обработкой текста или отзывов - идеально для AI-инструмента';
      break;
    case 'calculator':
      reason = 'Боль связана с расчётами, сравнением или финансами - калькулятор решит это';
      break;
    case 'dashboard':
      reason = 'Боль связана с мониторингом, трекингом или агрегацией данных - нужен дашборд';
      break;
    case 'landing-waitlist':
      reason = 'Идея новая или ниша не ясна - лендинг поможет валидировать спрос';
      break;
  }

  // Альтернативы (все кроме выбранного)
  const alternatives: MVPType[] = ['ai-tool', 'calculator', 'dashboard', 'landing-waitlist']
    .filter(t => t !== type) as MVPType[];

  return {
    type,
    confidence,
    reason,
    alternatives,
  };
}
