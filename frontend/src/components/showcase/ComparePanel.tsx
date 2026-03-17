'use client';

import type { Trend } from '@/types/trend';

interface ComparePanelProps {
  trends: Trend[];
  compareIds: string[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

const categoryIcons: Record<string, string> = {
  'SaaS': '💻', 'E-commerce': '🛒', 'Mobile Apps': '📱', 'EdTech': '🎓',
  'HealthTech': '💚', 'AI/ML': '🤖', 'AI & ML': '🤖', 'FinTech': '💰',
  'Technology': '⚙️', 'Business': '📊', 'Healthcare': '🏥', 'Finance': '💵',
  'Education': '📚',
};

export default function ComparePanel({ trends, compareIds, onRemove, onClear }: ComparePanelProps) {
  const compareTrends = compareIds
    .map(id => trends.find(t => t.id === id))
    .filter(Boolean) as Trend[];

  if (compareTrends.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-5xl mb-4">⚖️</span>
        <h3 className="text-lg font-semibold text-white mb-2">Сравнение ниш</h3>
        <p className="text-zinc-400 text-sm max-w-md mb-4">
          Выберите минимум 2 ниши для сравнения. Используйте чекбоксы в табличном виде или кнопки на карточках.
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <span>Выбрано: {compareTrends.length} из 2+ необходимых</span>
        </div>
      </div>
    );
  }

  const metrics = [
    {
      label: 'Рост тренда',
      getValue: (t: Trend) => `+${t.growth_rate || 0}%`,
      getRaw: (t: Trend) => t.growth_rate || 0,
      higherBetter: true,
    },
    {
      label: 'Конкуренция',
      getValue: (t: Trend) =>
        t.competition_level === 'low' ? '🟢 Низкая' :
        t.competition_level === 'medium' ? '🟡 Средняя' : '🔴 Высокая',
      getRaw: (t: Trend) =>
        t.competition_level === 'low' ? 3 :
        t.competition_level === 'medium' ? 2 : 1,
      higherBetter: true, // lower competition is better
    },
    {
      label: 'Количество игроков',
      getValue: (t: Trend) => t.top_players_count?.toString() || '—',
      getRaw: (t: Trend) => -(t.top_players_count || 0), // fewer is better
      higherBetter: true,
    },
    {
      label: 'Стоимость входа',
      getValue: (t: Trend) => t.entry_cost_estimate || '—',
      getRaw: (t: Trend) => {
        const match = t.entry_cost_estimate?.match(/\$?([\d,.]+)/);
        return match ? -parseFloat(match[1].replace(/,/g, '')) : 0; // lower cost is better
      },
      higherBetter: true,
    },
    {
      label: 'Популярность',
      getValue: (t: Trend) => `${t.popularity_score}/100`,
      getRaw: (t: Trend) => t.popularity_score || 0,
      higherBetter: true,
    },
  ];

  const getBestIndex = (metricIndex: number) => {
    const rawValues = compareTrends.map(t => metrics[metricIndex].getRaw(t));
    const best = metrics[metricIndex].higherBetter
      ? Math.max(...rawValues)
      : Math.min(...rawValues);
    return rawValues.indexOf(best);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <span>⚖️</span>
          Сравнение {compareTrends.length} ниш
        </h3>
        <button
          onClick={onClear}
          className="text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800"
        >
          Очистить
        </button>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase w-40">
                Метрика
              </th>
              {compareTrends.map(trend => (
                <th key={trend.id} className="px-4 py-3 text-center min-w-[160px]">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-lg">{categoryIcons[trend.category] || '📌'}</span>
                    <span className="text-white font-medium text-xs leading-tight">{trend.title}</span>
                    <span className="text-[10px] text-zinc-500">{trend.category}</span>
                    <button
                      onClick={() => onRemove(trend.id)}
                      className="mt-1 text-[10px] text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      ✕ убрать
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {metrics.map((metric, mi) => {
              const bestIdx = getBestIndex(mi);
              return (
                <tr key={metric.label} className="hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-zinc-400 font-medium">
                    {metric.label}
                  </td>
                  {compareTrends.map((trend, ti) => {
                    const isBest = ti === bestIdx;
                    return (
                      <td key={trend.id} className="px-4 py-3 text-center">
                        <span className={`text-sm font-medium ${
                          isBest ? 'text-green-400' : 'text-zinc-300'
                        }`}>
                          {metric.getValue(trend)}
                        </span>
                        {isBest && compareTrends.length > 1 && (
                          <span className="ml-1 text-[10px] text-green-500">★</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Verdict */}
      {compareTrends.length >= 2 && (
        <div className="mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
          <div className="flex items-start gap-3">
            <span className="text-xl">💡</span>
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">Рекомендация</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {(() => {
                  // Simple scoring: count how many "best" metrics each trend wins
                  const scores = compareTrends.map((_, ti) =>
                    metrics.reduce((sum, _, mi) => sum + (getBestIndex(mi) === ti ? 1 : 0), 0)
                  );
                  const bestScore = Math.max(...scores);
                  const bestIdx = scores.indexOf(bestScore);
                  const winner = compareTrends[bestIdx];
                  return `«${winner.title}» лидирует по ${bestScore} из ${metrics.length} метрик. ${
                    winner.competition_level === 'low'
                      ? 'Низкая конкуренция даёт хорошее окно для входа.'
                      : winner.growth_rate > 30
                        ? 'Высокий рост компенсирует конкуренцию.'
                        : 'Рассмотрите все факторы перед принятием решения.'
                  }`;
                })()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
