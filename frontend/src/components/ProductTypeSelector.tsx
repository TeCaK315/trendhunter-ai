'use client';

import { useState } from 'react';
import { productTemplates, type ProductType } from '@/lib/templates';

interface ProductTypeSelectorProps {
  selectedType: ProductType | null;
  onSelect: (type: ProductType) => void;
}

const complexityColors = {
  low: 'bg-green-500/20 text-green-400 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const complexityLabels = {
  low: 'Легко',
  medium: 'Средне',
  high: 'Сложно',
};

export default function ProductTypeSelector({ selectedType, onSelect }: ProductTypeSelectorProps) {
  const [hoveredType, setHoveredType] = useState<ProductType | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-6">
        <span className="text-2xl">🎯</span>
        <h3 className="text-lg font-semibold text-white">Выберите тип продукта</h3>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {productTemplates.map((template) => {
          const isSelected = selectedType === template.id;
          const isHovered = hoveredType === template.id;

          return (
            <button
              key={template.id}
              onClick={() => onSelect(template.id)}
              onMouseEnter={() => setHoveredType(template.id)}
              onMouseLeave={() => setHoveredType(null)}
              className={`
                relative text-left p-5 rounded-xl border-2 transition-all duration-200
                ${isSelected
                  ? 'bg-indigo-500/10 border-indigo-500 shadow-lg shadow-indigo-500/20'
                  : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50'
                }
              `}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}

              {/* Icon and name */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{template.icon}</span>
                <div>
                  <h4 className={`font-semibold ${isSelected ? 'text-indigo-300' : 'text-white'}`}>
                    {template.name}
                  </h4>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${complexityColors[template.complexity]}`}>
                    {complexityLabels[template.complexity]}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-400 mb-4">
                {template.description}
              </p>

              {/* Features (show on hover or selected) */}
              <div className={`space-y-1 transition-all duration-200 ${isSelected || isHovered ? 'opacity-100 max-h-40' : 'opacity-0 max-h-0 overflow-hidden'}`}>
                <p className="text-xs text-zinc-500 font-medium mb-2">Включает:</p>
                <div className="flex flex-wrap gap-1">
                  {template.features.slice(0, 4).map((feature, i) => (
                    <span
                      key={i}
                      className="text-xs px-2 py-1 bg-zinc-800 text-zinc-400 rounded"
                    >
                      {feature}
                    </span>
                  ))}
                  {template.features.length > 4 && (
                    <span className="text-xs px-2 py-1 bg-zinc-800 text-zinc-500 rounded">
                      +{template.features.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {/* Tech stack and time */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-800">
                <div className="flex items-center gap-1">
                  {template.techStack.slice(0, 3).map((tech, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                      {tech}
                    </span>
                  ))}
                </div>
                <span className="text-xs text-zinc-500">
                  {template.estimatedTime}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected type details */}
      {selectedType && (
        <div className="mt-6 p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-2xl">
              {productTemplates.find(t => t.id === selectedType)?.icon}
            </span>
            <div>
              <h4 className="font-medium text-indigo-300 mb-1">
                Выбрано: {productTemplates.find(t => t.id === selectedType)?.name}
              </h4>
              <p className="text-sm text-zinc-400">
                Система сгенерирует полностью рабочий код для этого типа продукта
                с интеграцией Supabase, готовый к деплою на Vercel.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
