/**
 * MVP Templates Index
 *
 * Экспортирует все генераторы и типы для создания рабочих MVP
 */

// Типы
export * from './types';

// Генераторы
export { generateAIToolFiles, generateAIToolConfig } from './ai-tool-generator';
export { generateCalculatorFiles, generateCalculatorConfig } from './calculator-generator';
export { generateDashboardFiles, generateDashboardConfig } from './dashboard-generator';
export { generateLandingFiles, generateLandingConfig } from './landing-generator';

// Импорты для главного генератора
import { MVPType, MVPGenerationContext, MVPGenerationResult, detectMVPType, getMVPTypeDefinition } from './types';
import { generateAIToolFiles } from './ai-tool-generator';
import { generateCalculatorFiles } from './calculator-generator';
import { generateDashboardFiles } from './dashboard-generator';
import { generateLandingFiles } from './landing-generator';

/**
 * Главная функция генерации MVP
 *
 * @param context - Контекст анализа тренда
 * @param mvpType - Тип MVP (опционально, автоопределяется)
 * @returns Результат генерации с файлами проекта
 */
export function generateMVP(
  context: MVPGenerationContext,
  mvpType?: MVPType
): MVPGenerationResult {
  // Определяем тип MVP если не указан
  const type = mvpType || detectMVPType(context);
  const definition = getMVPTypeDefinition(type);

  // Генерируем файлы в зависимости от типа
  let files: Record<string, string>;

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

  // Формируем результат
  const projectName = context.pitch?.company_name ||
    context.trend.title.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').trim();

  return {
    mvpType: type,
    projectName,
    files,
    readme: files['README.md'] || '',
    envExample: files['.env.example'] || '',
    features: definition?.features || [],
    setupInstructions: [
      'git clone <repo-url>',
      `cd ${projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      'npm install',
      'cp .env.example .env.local',
      '# Настройте переменные в .env.local',
      'npm run dev',
    ],
  };
}

/**
 * Получает рекомендуемый тип MVP с объяснением
 */
export function getRecommendedMVPType(context: MVPGenerationContext): {
  type: MVPType;
  confidence: number;
  reason: string;
  alternatives: MVPType[];
} {
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
