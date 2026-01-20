/**
 * Calculator MVP Generator
 *
 * Генерирует полностью рабочий калькулятор с:
 * - Динамической формой ввода
 * - Мгновенными расчётами
 * - Визуализацией результатов
 * - Сохранением сценариев
 */

import { MVPGenerationContext, CalculatorConfig } from './types';

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
 * Генерирует конфигурацию калькулятора на основе контекста анализа
 */
export function generateCalculatorConfig(context: MVPGenerationContext): CalculatorConfig {
  const mainPain = context.analysis?.main_pain || context.trend.title;
  const painLower = mainPain.toLowerCase();

  // Определяем тип калькулятора и генерируем поля
  let fields: CalculatorConfig['fields'] = [];
  let resultFields: CalculatorConfig['resultFields'] = [];
  let formula = '';

  if (painLower.includes('стоимост') || painLower.includes('cost') ||
      painLower.includes('цен') || painLower.includes('price') ||
      painLower.includes('бюджет') || painLower.includes('budget')) {
    // Калькулятор стоимости
    fields = [
      { name: 'users', label: 'Количество пользователей', type: 'number', placeholder: '100', min: 1, defaultValue: 100 },
      { name: 'period', label: 'Период', type: 'select', options: ['Месяц', 'Квартал', 'Год'], defaultValue: 'Месяц' },
      { name: 'plan', label: 'Тарифный план', type: 'select', options: ['Basic', 'Pro', 'Enterprise'], defaultValue: 'Pro' },
      { name: 'support', label: 'Поддержка 24/7', type: 'select', options: ['Нет', 'Да'], defaultValue: 'Нет' },
    ];
    resultFields = [
      { name: 'monthlyCost', label: 'Ежемесячная стоимость', format: 'currency' },
      { name: 'annualCost', label: 'Годовая стоимость', format: 'currency' },
      { name: 'savings', label: 'Экономия при годовой оплате', format: 'currency' },
      { name: 'perUser', label: 'Стоимость на пользователя', format: 'currency' },
    ];
    formula = 'Расчёт на основе количества пользователей, плана и периода';

  } else if (painLower.includes('roi') || painLower.includes('окупаемост') ||
             painLower.includes('return') || painLower.includes('investment')) {
    // ROI калькулятор
    fields = [
      { name: 'investment', label: 'Начальные инвестиции ($)', type: 'number', placeholder: '10000', min: 0, defaultValue: 10000 },
      { name: 'monthlyRevenue', label: 'Ожидаемый месячный доход ($)', type: 'number', placeholder: '2000', min: 0, defaultValue: 2000 },
      { name: 'monthlyExpenses', label: 'Ежемесячные расходы ($)', type: 'number', placeholder: '500', min: 0, defaultValue: 500 },
      { name: 'period', label: 'Период расчёта (месяцев)', type: 'range', min: 3, max: 36, defaultValue: 12 },
    ];
    resultFields = [
      { name: 'totalProfit', label: 'Общая прибыль', format: 'currency' },
      { name: 'roi', label: 'ROI', format: 'percent' },
      { name: 'paybackMonths', label: 'Срок окупаемости', format: 'number' },
      { name: 'monthlyProfit', label: 'Чистая прибыль в месяц', format: 'currency' },
    ];
    formula = 'ROI = (Доход - Расходы - Инвестиции) / Инвестиции × 100%';

  } else if (painLower.includes('конверс') || painLower.includes('conversion')) {
    // Калькулятор конверсии
    fields = [
      { name: 'visitors', label: 'Посетителей в месяц', type: 'number', placeholder: '10000', min: 1, defaultValue: 10000 },
      { name: 'currentConversion', label: 'Текущая конверсия (%)', type: 'number', placeholder: '2', min: 0, defaultValue: 2 },
      { name: 'targetConversion', label: 'Целевая конверсия (%)', type: 'number', placeholder: '4', min: 0, defaultValue: 4 },
      { name: 'averageOrder', label: 'Средний чек ($)', type: 'number', placeholder: '50', min: 0, defaultValue: 50 },
    ];
    resultFields = [
      { name: 'currentRevenue', label: 'Текущий доход', format: 'currency' },
      { name: 'potentialRevenue', label: 'Потенциальный доход', format: 'currency' },
      { name: 'additionalRevenue', label: 'Дополнительный доход', format: 'currency' },
      { name: 'additionalCustomers', label: 'Доп. клиентов в месяц', format: 'number' },
    ];
    formula = 'Дополнительный доход = Посетители × (Целевая - Текущая конверсия) × Средний чек';

  } else {
    // Универсальный калькулятор
    fields = [
      { name: 'value1', label: 'Параметр 1', type: 'number', placeholder: '100', defaultValue: 100 },
      { name: 'value2', label: 'Параметр 2', type: 'number', placeholder: '50', defaultValue: 50 },
      { name: 'multiplier', label: 'Множитель', type: 'range', min: 1, max: 10, defaultValue: 2 },
      { name: 'category', label: 'Категория', type: 'select', options: ['A', 'B', 'C'], defaultValue: 'A' },
    ];
    resultFields = [
      { name: 'result', label: 'Результат', format: 'number' },
      { name: 'percentage', label: 'Процент', format: 'percent' },
      { name: 'total', label: 'Итого', format: 'currency' },
    ];
    formula = 'Расчёт на основе введённых параметров';
  }

  return {
    calculatorName: context.pitch?.company_name || `${context.trend.title} Calculator`,
    calculatorDescription: context.pitch?.tagline || `Калькулятор для ${mainPain}`,
    fields,
    formula,
    resultFields,
  };
}

/**
 * Генерирует все файлы для Calculator MVP
 */
export function generateCalculatorFiles(context: MVPGenerationContext): Record<string, string> {
  const config = generateCalculatorConfig(context);
  const files: Record<string, string> = {};

  const projectName = config.calculatorName;
  const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');

  const safe = {
    projectName: escapeJsx(projectName),
    calculatorDescription: escapeJsx(config.calculatorDescription),
    formula: escapeJsx(config.formula || ''),
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
      recharts: '2.10.3'
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
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
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
  files['.env.example'] = `# Нет обязательных переменных окружения
# Калькулятор работает полностью на клиенте
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

/* Кастомный range slider */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #374151;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #10b981;
  cursor: pointer;
  transition: background 0.2s;
}

input[type="range"]::-webkit-slider-thumb:hover {
  background: #059669;
}

/* Анимации */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

@keyframes countUp {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}

.animate-countUp {
  animation: countUp 0.4s ease-out;
}
`;

  // src/app/layout.tsx
  files['src/app/layout.tsx'] = `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: '${safe.projectName}',
  description: '${safe.calculatorDescription}',
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

  // Генерируем поля формы
  const fieldsJson = JSON.stringify(config.fields);
  const resultFieldsJson = JSON.stringify(config.resultFields);

  // src/app/page.tsx - Главная страница с калькулятором
  files['src/app/page.tsx'] = `'use client';

import { useState, useEffect, useMemo } from 'react';
import { Calculator, Download, Save, Trash2, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

// Конфигурация полей
const FIELDS = ${fieldsJson};
const RESULT_FIELDS = ${resultFieldsJson};

interface SavedScenario {
  id: string;
  name: string;
  values: Record<string, number | string>;
  results: Record<string, number>;
  timestamp: Date;
}

export default function Home() {
  const [values, setValues] = useState<Record<string, number | string>>(() => {
    const initial: Record<string, number | string> = {};
    FIELDS.forEach((field: any) => {
      initial[field.name] = field.defaultValue || (field.type === 'number' ? 0 : '');
    });
    return initial;
  });

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [scenarioName, setScenarioName] = useState('');

  // Расчёт результатов
  const results = useMemo(() => {
    const r: Record<string, number> = {};

    // Логика расчёта зависит от типа калькулятора
    const v = values;

    // Пример: калькулятор стоимости
    if ('users' in v && 'plan' in v) {
      const users = Number(v.users) || 0;
      const planPrices: Record<string, number> = { Basic: 10, Pro: 25, Enterprise: 50 };
      const planPrice = planPrices[String(v.plan)] || 10;
      const supportCost = v.support === 'Да' ? users * 5 : 0;
      const periodMultiplier = v.period === 'Год' ? 12 : v.period === 'Квартал' ? 3 : 1;

      r.monthlyCost = users * planPrice + supportCost;
      r.annualCost = r.monthlyCost * 12;
      r.savings = r.annualCost * 0.2;
      r.perUser = users > 0 ? r.monthlyCost / users : 0;
    }
    // ROI калькулятор
    else if ('investment' in v && 'monthlyRevenue' in v) {
      const investment = Number(v.investment) || 0;
      const monthlyRevenue = Number(v.monthlyRevenue) || 0;
      const monthlyExpenses = Number(v.monthlyExpenses) || 0;
      const period = Number(v.period) || 12;

      const monthlyProfit = monthlyRevenue - monthlyExpenses;
      const totalRevenue = monthlyRevenue * period;
      const totalExpenses = monthlyExpenses * period;
      const totalProfit = totalRevenue - totalExpenses - investment;

      r.totalProfit = totalProfit;
      r.roi = investment > 0 ? (totalProfit / investment) * 100 : 0;
      r.paybackMonths = monthlyProfit > 0 ? Math.ceil(investment / monthlyProfit) : 0;
      r.monthlyProfit = monthlyProfit;
    }
    // Калькулятор конверсии
    else if ('visitors' in v && 'currentConversion' in v) {
      const visitors = Number(v.visitors) || 0;
      const currentConv = Number(v.currentConversion) || 0;
      const targetConv = Number(v.targetConversion) || 0;
      const avgOrder = Number(v.averageOrder) || 0;

      const currentCustomers = visitors * (currentConv / 100);
      const targetCustomers = visitors * (targetConv / 100);

      r.currentRevenue = currentCustomers * avgOrder;
      r.potentialRevenue = targetCustomers * avgOrder;
      r.additionalRevenue = r.potentialRevenue - r.currentRevenue;
      r.additionalCustomers = targetCustomers - currentCustomers;
    }
    // Универсальный
    else {
      const v1 = Number(v.value1) || 0;
      const v2 = Number(v.value2) || 0;
      const mult = Number(v.multiplier) || 1;

      r.result = (v1 + v2) * mult;
      r.percentage = v1 > 0 ? (v2 / v1) * 100 : 0;
      r.total = r.result * 10;
    }

    return r;
  }, [values]);

  // Форматирование значений
  const formatValue = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('ru-RU', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        }).format(value);
      case 'percent':
        return value.toFixed(1) + '%';
      case 'number':
      default:
        return new Intl.NumberFormat('ru-RU').format(Math.round(value));
    }
  };

  // Данные для графика
  const chartData = RESULT_FIELDS.map((field: any) => ({
    name: field.label,
    value: results[field.name] || 0,
    format: field.format,
  }));

  // Сохранение сценария
  const saveScenario = () => {
    if (!scenarioName.trim()) return;

    const newScenario: SavedScenario = {
      id: Date.now().toString(),
      name: scenarioName,
      values: { ...values },
      results: { ...results },
      timestamp: new Date(),
    };

    setSavedScenarios(prev => [newScenario, ...prev].slice(0, 5));
    setScenarioName('');
  };

  // Загрузка сценария
  const loadScenario = (scenario: SavedScenario) => {
    setValues(scenario.values);
  };

  // Удаление сценария
  const deleteScenario = (id: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
  };

  // Сброс значений
  const resetValues = () => {
    const initial: Record<string, number | string> = {};
    FIELDS.forEach((field: any) => {
      initial[field.name] = field.defaultValue || (field.type === 'number' ? 0 : '');
    });
    setValues(initial);
  };

  // Экспорт результатов
  const exportResults = () => {
    const text = \`${safe.projectName} - Результаты расчёта
============================================

Входные данные:
\${FIELDS.map((f: any) => \`\${f.label}: \${values[f.name]}\`).join('\\n')}

Результаты:
\${RESULT_FIELDS.map((f: any) => \`\${f.label}: \${formatValue(results[f.name] || 0, f.format)}\`).join('\\n')}

Дата: \${new Date().toLocaleString('ru-RU')}
\`;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calculation-results.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-lg">${safe.projectName}</h1>
              <p className="text-xs text-gray-400">${safe.calculatorDescription}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetValues}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Сбросить"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={exportResults}
              className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              title="Экспорт"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Форма ввода */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">1</span>
                Введите данные
              </h2>

              <div className="space-y-5">
                {FIELDS.map((field: any) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      {field.label}
                    </label>

                    {field.type === 'number' && (
                      <input
                        type="number"
                        value={values[field.name]}
                        onChange={(e) => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        placeholder={field.placeholder}
                        min={field.min}
                        max={field.max}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    )}

                    {field.type === 'select' && (
                      <select
                        value={values[field.name]}
                        onChange={(e) => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
                        className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                      >
                        {field.options.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    )}

                    {field.type === 'range' && (
                      <div className="space-y-2">
                        <input
                          type="range"
                          value={values[field.name]}
                          onChange={(e) => setValues(prev => ({ ...prev, [field.name]: Number(e.target.value) }))}
                          min={field.min}
                          max={field.max}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm text-gray-400">
                          <span>{field.min}</span>
                          <span className="font-medium text-white">{values[field.name]}</span>
                          <span>{field.max}</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Сохранённые сценарии */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Save className="w-4 h-4 text-emerald-400" />
                Сохранённые сценарии
              </h3>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={scenarioName}
                  onChange={(e) => setScenarioName(e.target.value)}
                  placeholder="Название сценария"
                  className="flex-1 bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={saveScenario}
                  disabled={!scenarioName.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Сохранить
                </button>
              </div>

              {savedScenarios.length > 0 ? (
                <div className="space-y-2">
                  {savedScenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                    >
                      <button
                        onClick={() => loadScenario(scenario)}
                        className="text-left flex-1 hover:text-emerald-400 transition-colors"
                      >
                        <p className="font-medium">{scenario.name}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(scenario.timestamp).toLocaleString('ru-RU')}
                        </p>
                      </button>
                      <button
                        onClick={() => deleteScenario(scenario.id)}
                        className="p-1 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Нет сохранённых сценариев</p>
              )}
            </div>
          </div>

          {/* Результаты */}
          <div className="space-y-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400">2</span>
                Результаты
              </h2>

              <div className="grid gap-4">
                {RESULT_FIELDS.map((field: any, index: number) => (
                  <div
                    key={field.name}
                    className="p-4 bg-gray-900/50 rounded-xl animate-countUp"
                    style={{ animationDelay: \`\${index * 100}ms\` }}
                  >
                    <p className="text-sm text-gray-400 mb-1">{field.label}</p>
                    <p className="text-2xl font-bold text-emerald-400">
                      {formatValue(results[field.name] || 0, field.format)}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* График */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="font-semibold mb-4">Визуализация</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis type="number" stroke="#9ca3af" />
                    <YAxis dataKey="name" type="category" width={120} stroke="#9ca3af" />
                    <Tooltip
                      contentStyle={{ background: '#1f2937', border: '1px solid #374151' }}
                      formatter={(value: number, name: string, props: any) => [
                        formatValue(value, props.payload.format),
                        ''
                      ]}
                    />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {chartData.map((entry: any, index: number) => (
                        <Cell key={index} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Формула */}
            <div className="bg-gray-800/30 border border-gray-700/50 rounded-xl p-4">
              <p className="text-sm text-gray-400">
                <span className="font-medium text-gray-300">Формула: </span>
                ${safe.formula}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm text-gray-500">
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

${config.calculatorDescription}

## 🎯 Проблема

${mainPain}

## 💡 Решение

${projectName} - интерактивный калькулятор, который помогает быстро рассчитать ключевые метрики и принять обоснованные решения.

## ✨ Возможности

- **Мгновенные расчёты** - результаты обновляются в реальном времени
- **Визуализация** - графики и диаграммы для наглядности
- **Сохранение сценариев** - сравнивайте разные варианты
- **Экспорт результатов** - выгрузка в текстовый файл
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

## 🌐 Деплой на Vercel

1. Push в GitHub
2. Импортируйте в [Vercel](https://vercel.com)
3. Deploy! (переменные окружения не требуются)

## 📝 Tech Stack

- **Framework:** Next.js 14
- **Styling:** Tailwind CSS
- **Charts:** Recharts
- **Icons:** Lucide React

---

*Создано с [TrendHunter AI](https://trendhunter.ai) 🚀*
`;

  return files;
}
