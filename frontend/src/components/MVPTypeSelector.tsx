'use client';

import { useState, useEffect } from 'react';
import { MVPType, mvpTypeDefinitions, getRecommendedMVPType, MVPGenerationContext } from '@/lib/mvp-templates';
import { useLanguage } from '@/lib/i18n';

interface MVPTypeSelectorProps {
  context: MVPGenerationContext;
  onSelect: (type: MVPType) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function MVPTypeSelector({
  context,
  onSelect,
  onCancel,
  isLoading = false,
}: MVPTypeSelectorProps) {
  const [selectedType, setSelectedType] = useState<MVPType | null>(null);
  const [recommendation, setRecommendation] = useState<ReturnType<typeof getRecommendedMVPType> | null>(null);
  const { language } = useLanguage();

  useEffect(() => {
    // Получаем рекомендацию при монтировании
    const rec = getRecommendedMVPType(context);
    setRecommendation(rec);
    setSelectedType(rec.type);
  }, [context]);

  const handleConfirm = () => {
    if (selectedType) {
      onSelect(selectedType);
    }
  };

  // Переводы для типов MVP
  const typeLabels: Record<MVPType, { name: string; description: string }> = {
    'ai-tool': {
      name: language === 'ru' ? 'AI Инструмент' : 'AI Tool',
      description: language === 'ru'
        ? 'Интерактивный AI-инструмент с вводом текста/URL и анализом'
        : 'Interactive AI tool with text/URL input and analysis',
    },
    'calculator': {
      name: language === 'ru' ? 'Калькулятор' : 'Calculator',
      description: language === 'ru'
        ? 'Интерактивный калькулятор с мгновенными расчётами'
        : 'Interactive calculator with instant calculations',
    },
    'dashboard': {
      name: language === 'ru' ? 'Дашборд' : 'Dashboard',
      description: language === 'ru'
        ? 'Дашборд с агрегацией данных и визуализацией'
        : 'Dashboard with data aggregation and visualization',
    },
    'landing-waitlist': {
      name: language === 'ru' ? 'Лендинг + Waitlist' : 'Landing + Waitlist',
      description: language === 'ru'
        ? 'Лендинг со сбором email для валидации идеи'
        : 'Landing page with email collection for idea validation',
    },
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div
        className="bg-[#16161a] border border-zinc-800 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {language === 'ru' ? 'Выберите тип MVP' : 'Choose MVP Type'}
              </h2>
              <p className="text-zinc-400 mt-1">
                {language === 'ru'
                  ? 'AI рекомендует тип на основе анализа, но вы можете выбрать другой'
                  : 'AI recommends a type based on analysis, but you can choose another'}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Recommendation Banner */}
        {recommendation && (
          <div className="p-4 mx-6 mt-6 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xl">🤖</span>
              </div>
              <div>
                <p className="text-sm text-indigo-300 font-medium mb-1">
                  {language === 'ru' ? 'Рекомендация AI' : 'AI Recommendation'}
                  <span className="ml-2 px-2 py-0.5 bg-indigo-500/20 rounded text-xs">
                    {recommendation.confidence}%
                  </span>
                </p>
                <p className="text-zinc-300">{recommendation.reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* MVP Types Grid */}
        <div className="p-6 grid gap-4">
          {mvpTypeDefinitions.map((definition) => {
            const isSelected = selectedType === definition.id;
            const isRecommended = recommendation?.type === definition.id;
            const labels = typeLabels[definition.id];

            return (
              <button
                key={definition.id}
                onClick={() => setSelectedType(definition.id)}
                className={`text-left p-5 rounded-xl border-2 transition-all ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${
                    isSelected ? 'bg-indigo-500/20' : 'bg-zinc-800'
                  }`}>
                    {definition.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-white">
                        {labels.name}
                      </h3>
                      {isRecommended && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          {language === 'ru' ? 'Рекомендуется' : 'Recommended'}
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        definition.complexity === 'low'
                          ? 'bg-green-500/20 text-green-400'
                          : definition.complexity === 'medium'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {definition.complexity === 'low'
                          ? (language === 'ru' ? 'Простой' : 'Simple')
                          : definition.complexity === 'medium'
                          ? (language === 'ru' ? 'Средний' : 'Medium')
                          : (language === 'ru' ? 'Сложный' : 'Complex')}
                      </span>
                    </div>
                    <p className="text-zinc-400 text-sm mb-3">{labels.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {definition.features.slice(0, 4).map((feature, i) => (
                        <span
                          key={i}
                          className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-4 mt-3 text-xs text-zinc-500">
                      <span>⏱️ {definition.generationTime}</span>
                      <span>📦 {definition.techStack.slice(0, 3).join(', ')}</span>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    isSelected
                      ? 'border-indigo-500 bg-indigo-500'
                      : 'border-zinc-600'
                  }`}>
                    {isSelected && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 flex items-center justify-between">
          <div className="text-sm text-zinc-500">
            {language === 'ru'
              ? 'После создания проект можно доработать вручную'
              : 'You can refine the project manually after creation'}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
            >
              {language === 'ru' ? 'Отмена' : 'Cancel'}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedType || isLoading}
              className="px-6 py-2.5 rounded-xl font-medium bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{language === 'ru' ? 'Создаю...' : 'Creating...'}</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>{language === 'ru' ? 'Создать MVP' : 'Create MVP'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
