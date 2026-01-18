'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Trend {
  id: string;
  title: string;
  category: string;
  popularity_score: number;
  opportunity_score: number;
  pain_score: number;
  feasibility_score: number;
  profit_potential: number;
  growth_rate: number;
  why_trending: string;
  status: string;
  first_detected_at: string;
  source?: string;
}

interface ProjectData {
  trend_id: string;
  name: string;
  repo_url?: string;
}

interface TrendCardProps {
  trend: Trend;
}

const categoryConfig: Record<string, { icon: string; color: string }> = {
  'SaaS': { icon: '💻', color: 'from-blue-500/20 to-cyan-500/20' },
  'E-commerce': { icon: '🛒', color: 'from-emerald-500/20 to-green-500/20' },
  'Mobile Apps': { icon: '📱', color: 'from-violet-500/20 to-purple-500/20' },
  'EdTech': { icon: '🎓', color: 'from-amber-500/20 to-yellow-500/20' },
  'HealthTech': { icon: '💚', color: 'from-green-500/20 to-emerald-500/20' },
  'AI/ML': { icon: '🤖', color: 'from-indigo-500/20 to-violet-500/20' },
  'AI & ML': { icon: '🤖', color: 'from-indigo-500/20 to-violet-500/20' },
  'FinTech': { icon: '💰', color: 'from-yellow-500/20 to-orange-500/20' },
  'Technology': { icon: '⚙️', color: 'from-slate-500/20 to-zinc-500/20' },
  'Business': { icon: '📊', color: 'from-blue-500/20 to-indigo-500/20' },
  'Healthcare': { icon: '🏥', color: 'from-red-500/20 to-rose-500/20' },
  'Finance': { icon: '💵', color: 'from-green-500/20 to-emerald-500/20' },
  'Education': { icon: '📚', color: 'from-orange-500/20 to-amber-500/20' },
};

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 1) return 'Только что';
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} д назад`;
}

function getOverallScore(trend: Trend): number {
  return Number(((trend.opportunity_score + trend.pain_score + trend.feasibility_score + trend.profit_potential) / 4).toFixed(1));
}

function getScoreColor(score: number): string {
  if (score >= 8.5) return 'from-green-500 to-emerald-500';
  if (score >= 7) return 'from-indigo-500 to-purple-500';
  if (score >= 5) return 'from-yellow-500 to-orange-500';
  return 'from-red-500 to-rose-500';
}

function getScoreLabel(score: number): string {
  if (score >= 8.5) return 'Отлично';
  if (score >= 7) return 'Хорошо';
  if (score >= 5) return 'Средне';
  return 'Низкий';
}

export default function TrendCard({ trend }: TrendCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isProjectCompleted, setIsProjectCompleted] = useState(false);
  const router = useRouter();
  const overallScore = getOverallScore(trend);
  const config = categoryConfig[trend.category] || { icon: '📌', color: 'from-zinc-500/20 to-zinc-600/20' };

  // Проверяем, завершён ли проект (GitHub репозиторий создан = проект готов)
  useEffect(() => {
    const checkProjectCompletion = () => {
      try {
        const savedProjects = localStorage.getItem('trendhunter_projects');
        if (savedProjects) {
          const projects: ProjectData[] = JSON.parse(savedProjects);
          const project = projects.find(p => p.trend_id === trend.id);

          // Проект завершён, если есть GitHub URL (repo_url)
          setIsProjectCompleted(!!project?.repo_url);
        } else {
          setIsProjectCompleted(false);
        }
      } catch (error) {
        console.error('Error checking project completion:', error);
        setIsProjectCompleted(false);
      }
    };

    checkProjectCompletion();

    // Слушаем изменения localStorage
    const handleStorageChange = () => checkProjectCompletion();
    window.addEventListener('storage', handleStorageChange);

    return () => window.removeEventListener('storage', handleStorageChange);
  }, [trend.id]);

  const metrics = [
    { label: 'Возможность', value: trend.opportunity_score, icon: '🎯' },
    { label: 'Боль', value: trend.pain_score, icon: '🔥' },
    { label: 'Выполнимость', value: trend.feasibility_score, icon: '⚡' },
    { label: 'Выгода', value: trend.profit_potential, icon: '💰' },
  ];

  return (
    <>
      <div
        className="trend-card group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Category gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[20px]`} />

        {/* Content */}
        <div className="relative">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            {/* Score */}
            <div className="relative">
              <div className={`score-badge bg-gradient-to-br ${getScoreColor(overallScore)} text-white shadow-lg`}>
                {overallScore}
              </div>
              <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-medium px-2 py-0.5 rounded-full bg-zinc-900/80 text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity`}>
                {getScoreLabel(overallScore)}
              </div>
            </div>

            {/* Project completed indicator */}
            {isProjectCompleted && (
              <div
                className="text-2xl text-yellow-400 animate-pulse"
                title="Проект завершён: все этапы пройдены, репозиторий создан"
              >
                ★
              </div>
            )}
          </div>

          {/* Category */}
          <div className="category-pill inline-flex items-center gap-1.5 mb-3">
            <span className="text-base">{config.icon}</span>
            <span>{trend.category}</span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-2 leading-tight group-hover:text-indigo-100 transition-colors">
            {trend.title}
          </h3>

          {/* Description */}
          <p className="text-sm text-zinc-400 mb-5 line-clamp-2 group-hover:text-zinc-300 transition-colors">
            {trend.why_trending}
          </p>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="group/metric">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="text-zinc-500 flex items-center gap-1">
                    <span className="opacity-0 group-hover/metric:opacity-100 transition-opacity">{metric.icon}</span>
                    {metric.label}
                  </span>
                  <span className="text-zinc-300 font-medium">{metric.value}</span>
                </div>
                <div className="metric-bar">
                  <div
                    className="metric-bar-fill"
                    style={{
                      width: isHovered ? `${metric.value * 10}%` : `${metric.value * 10}%`,
                      transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span>{getTimeAgo(trend.first_detected_at)}</span>
              {trend.source && (
                <>
                  <span className="text-zinc-700">•</span>
                  <span className="text-zinc-600">{trend.source}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowModal(true)}
                className="px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                title="Быстрый просмотр"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </button>
              <button
                onClick={() => router.push(`/trends/${trend.id}`)}
                className="detail-btn px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:scale-105"
              >
                Открыть
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#16161a] border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-6 border-b border-zinc-800 bg-gradient-to-br ${config.color}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="category-pill inline-flex items-center gap-1.5 mb-3">
                    <span className="text-base">{config.icon}</span>
                    <span>{trend.category}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white">{trend.title}</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Score Section */}
              <div className="flex items-center gap-6 p-4 bg-zinc-900/50 rounded-xl">
                <div className={`score-badge bg-gradient-to-br ${getScoreColor(overallScore)} text-white text-3xl`}>
                  {overallScore}
                </div>
                <div>
                  <div className="text-zinc-400 text-sm mb-1">Общий рейтинг</div>
                  <div className="text-white font-semibold text-lg">{getScoreLabel(overallScore)} потенциал</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    На основе 4 ключевых метрик
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="bg-zinc-900/30 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span>💡</span>
                  Почему это трендит
                </h3>
                <p className="text-zinc-400">{trend.why_trending}</p>
              </div>

              {/* Detailed Metrics */}
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <span>📊</span>
                  Детальные метрики
                </h3>
                <div className="space-y-4">
                  {metrics.map((metric) => (
                    <div key={metric.label} className="group">
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-zinc-400 flex items-center gap-2">
                          <span>{metric.icon}</span>
                          {metric.label}
                        </span>
                        <span className="text-white font-semibold">{metric.value}/10</span>
                      </div>
                      <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
                          style={{ width: `${metric.value * 10}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="flex items-center gap-4 text-sm text-zinc-500 pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Обнаружено {getTimeAgo(trend.first_detected_at)}</span>
                </div>
                {trend.source && (
                  <div className="flex items-center gap-2">
                    <span>📡</span>
                    <span>{trend.source}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-zinc-800 flex gap-3">
              {/* Индикатор завершённого проекта */}
              {isProjectCompleted && (
                <div className="flex-1 py-3.5 rounded-xl font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center justify-center gap-2">
                  <span className="text-xl">★</span>
                  <span>Проект завершён</span>
                </div>
              )}
              <button
                onClick={() => {
                  setShowModal(false);
                  router.push(`/trends/${trend.id}`);
                }}
                className="flex-1 py-3.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
              >
                <span>🚀</span>
                <span>Открыть детали</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
