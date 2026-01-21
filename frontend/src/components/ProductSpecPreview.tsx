'use client';

import { ProductSpecification } from '@/lib/mvp-templates';
import { useLanguage } from '@/lib/i18n';

interface ProductSpecPreviewProps {
  spec: ProductSpecification;
  isLoading?: boolean;
}

export default function ProductSpecPreview({ spec, isLoading = false }: ProductSpecPreviewProps) {
  const { language } = useLanguage();

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-zinc-700" />
          <div className="h-5 w-48 bg-zinc-700 rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-zinc-800 rounded" />
          <div className="h-4 w-3/4 bg-zinc-800 rounded" />
          <div className="h-4 w-1/2 bg-zinc-800 rounded" />
        </div>
      </div>
    );
  }

  const t = {
    title: language === 'ru' ? 'AI-гипотезы о продукте' : 'AI Product Hypotheses',
    confidence: language === 'ru' ? 'Уверенность' : 'Confidence',
    userGets: language === 'ru' ? 'Пользователь получает' : 'User Gets',
    userProvides: language === 'ru' ? 'Пользователь вводит' : 'User Provides',
    userFlow: language === 'ru' ? 'User Flow' : 'User Flow',
    magic: language === 'ru' ? 'Где магия' : 'Where Magic Happens',
    tech: language === 'ru' ? 'Технические требования' : 'Technical Requirements',
    monetization: language === 'ru' ? 'Монетизация' : 'Monetization',
    currentSolution: language === 'ru' ? 'Текущее решение' : 'Current Solution',
    example: language === 'ru' ? 'Пример' : 'Example',
    ahaTitle: language === 'ru' ? 'Aha-момент' : 'Aha Moment',
    timeToValue: language === 'ru' ? 'Время до ценности' : 'Time to Value',
    advantage: language === 'ru' ? 'Наше преимущество' : 'Our Advantage',
    switchingCost: language === 'ru' ? 'Стоимость переключения' : 'Switching Cost',
    apis: language === 'ru' ? 'API' : 'APIs',
    db: language === 'ru' ? 'База данных' : 'Database',
    auth: language === 'ru' ? 'Авторизация' : 'Authentication',
    freeTier: language === 'ru' ? 'Бесплатный лимит' : 'Free Tier',
    yes: language === 'ru' ? 'Да' : 'Yes',
    no: language === 'ru' ? 'Нет' : 'No',
  };

  const complexityColors = {
    simple: 'bg-green-500/20 text-green-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    complex: 'bg-red-500/20 text-red-400',
  };

  const complexityLabels = {
    simple: language === 'ru' ? 'Простой' : 'Simple',
    medium: language === 'ru' ? 'Средний' : 'Medium',
    complex: language === 'ru' ? 'Сложный' : 'Complex',
  };

  const switchingCostLabels = {
    low: language === 'ru' ? 'Низкая' : 'Low',
    medium: language === 'ru' ? 'Средняя' : 'Medium',
    high: language === 'ru' ? 'Высокая' : 'High',
  };

  const monetizationLabels: Record<string, string> = {
    freemium: 'Freemium',
    subscription: language === 'ru' ? 'Подписка' : 'Subscription',
    pay_per_use: language === 'ru' ? 'За использование' : 'Pay per Use',
    one_time: language === 'ru' ? 'Разовая покупка' : 'One-time',
    free_with_ads: language === 'ru' ? 'Бесплатно с рекламой' : 'Free with Ads',
    enterprise: 'Enterprise',
  };

  return (
    <div className="rounded-xl bg-zinc-900/50 border border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
            <span className="text-lg">🧠</span>
          </div>
          <h3 className="text-white font-semibold">{t.title}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs ${complexityColors[spec.mvp_complexity]}`}>
            {complexityLabels[spec.mvp_complexity]}
          </span>
          <span className="px-2 py-1 bg-indigo-500/20 text-indigo-400 rounded-full text-xs">
            {t.confidence}: {Math.round(spec.confidence_score * 10)}%
          </span>
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* User Output */}
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-green-400">📤</span>
            <span className="text-zinc-400 font-medium">{t.userGets}</span>
          </div>
          <p className="text-white mb-2">{spec.user_output.primary_output}</p>
          <p className="text-zinc-500 text-xs">
            {t.example}: {spec.user_output.example}
          </p>
        </div>

        {/* User Input */}
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-blue-400">📥</span>
            <span className="text-zinc-400 font-medium">{t.userProvides}</span>
          </div>
          <p className="text-white mb-2">{spec.user_input.primary_input}</p>
          <div className="flex flex-wrap gap-1">
            {spec.user_input.required_fields.map((field, i) => (
              <span key={i} className="px-2 py-0.5 bg-zinc-700 rounded text-xs text-zinc-300">
                {field.name}
              </span>
            ))}
          </div>
        </div>

        {/* User Flow */}
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-yellow-400">🔄</span>
            <span className="text-zinc-400 font-medium">{t.userFlow}</span>
          </div>
          <div className="space-y-1.5">
            {spec.user_flow.steps.slice(0, 3).map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center text-xs text-zinc-400 flex-shrink-0">
                  {step.step_number}
                </span>
                <span className="text-zinc-300 text-xs">{step.action}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-zinc-700 flex justify-between text-xs">
            <span className="text-zinc-500">{t.timeToValue}: <span className="text-green-400">{spec.user_flow.total_time_to_value}</span></span>
          </div>
        </div>

        {/* Magic Location */}
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-purple-400">✨</span>
            <span className="text-zinc-400 font-medium">{t.magic}</span>
          </div>
          <p className="text-white mb-2">{spec.magic_location.description}</p>
          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs">
            {spec.magic_location.type.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Technical Requirements */}
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-cyan-400">⚙️</span>
            <span className="text-zinc-400 font-medium">{t.tech}</span>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.apis}:</span>
              <span className="text-zinc-300">
                {spec.technical_requirements.apis_needed.map(a => a.name).join(', ') || '-'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.db}:</span>
              <span className={spec.technical_requirements.database_required ? 'text-yellow-400' : 'text-green-400'}>
                {spec.technical_requirements.database_required ? t.yes : t.no}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">{t.auth}:</span>
              <span className={spec.technical_requirements.auth_required ? 'text-yellow-400' : 'text-green-400'}>
                {spec.technical_requirements.auth_required ? t.yes : t.no}
              </span>
            </div>
          </div>
        </div>

        {/* Monetization */}
        <div className="p-3 rounded-lg bg-zinc-800/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-400">💰</span>
            <span className="text-zinc-400 font-medium">{t.monetization}</span>
          </div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-xs">
              {monetizationLabels[spec.monetization.model] || spec.monetization.model}
            </span>
          </div>
          {spec.monetization.free_tier_limits && (
            <p className="text-xs text-zinc-500">
              {t.freeTier}: {spec.monetization.free_tier_limits}
            </p>
          )}
        </div>

        {/* Current Solution */}
        <div className="p-3 rounded-lg bg-zinc-800/50 md:col-span-2">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-orange-400">🎯</span>
            <span className="text-zinc-400 font-medium">{t.currentSolution}</span>
          </div>
          <p className="text-zinc-300 mb-2">{spec.current_user_solution.how_they_solve_now}</p>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-zinc-500">
              {t.advantage}: <span className="text-green-400">{spec.current_user_solution.our_advantage}</span>
            </span>
            <span className="text-zinc-500">
              {t.switchingCost}: <span className="text-zinc-300">{switchingCostLabels[spec.current_user_solution.switching_cost]}</span>
            </span>
          </div>
        </div>

        {/* Aha Moment */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 md:col-span-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">💡</span>
            <div>
              <span className="text-indigo-300 text-xs font-medium">{t.ahaTitle}</span>
              <p className="text-white">{spec.user_flow.aha_moment}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
