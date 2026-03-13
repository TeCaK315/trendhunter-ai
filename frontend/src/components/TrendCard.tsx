'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getItem } from '@/lib/storage';
import { useTranslations, useLanguage, useTranslateContent } from '@/lib/i18n';
import type { Trend } from '@/types/trend';

interface ProjectData {
  trend_id: string;
  name: string;
  repo_url?: string;
}

interface TrendCardProps {
  trend: Trend;
  dataTour?: string;
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

export default function TrendCard({ trend, dataTour }: TrendCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isProjectCompleted, setIsProjectCompleted] = useState(false);
  const router = useRouter();
  const t = useTranslations();
  const { language } = useLanguage();
  const config = categoryConfig[trend.category] || { icon: '📌', color: 'from-zinc-500/20 to-zinc-600/20' };

  // Для английского: используем готовый перевод why_trending_en если есть, иначе переводим через API
  const needsTranslation = language === 'en' && !trend.why_trending_en;

  // Перевод контента тренда (только если нет готового перевода)
  const trendContent = needsTranslation ? {
    title: trend.title,
    why_trending: trend.why_trending,
  } : null;

  const { data: translatedTrend } = useTranslateContent(trendContent, {
    cacheKey: `trend-card-${trend.id}`,
    fields: ['title', 'why_trending']
  });

  // Используем переведённые данные или оригинал
  const displayTitle = language === 'en'
    ? (translatedTrend?.title || trend.title)
    : trend.title;

  const displayWhyTrending = language === 'en'
    ? (trend.why_trending_en || translatedTrend?.why_trending || trend.why_trending)
    : trend.why_trending;

  // Localized time ago
  const getTimeAgoLocalized = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMinutes < 1) return t.trendCard.justNow;
    if (diffMinutes < 60) return `${diffMinutes} ${t.trendCard.minAgo}`;
    if (diffHours < 24) return `${diffHours} ${t.trendCard.hoursAgo}`;

    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} ${t.trendCard.daysAgo}`;
  };

  // Проверяем, завершён ли проект (GitHub репозиторий создан = проект готов)
  useEffect(() => {
    const checkProjectCompletion = () => {
      try {
        const projects = getItem<ProjectData[]>('trendhunter_projects');
        if (projects) {
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

  return (
    <>
      <div
        className="trend-card group"
        data-tour={dataTour}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Category gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-[20px]`} />

        {/* Content */}
        <div className="relative">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            {/* Project completed indicator */}
            {isProjectCompleted && (
              <div
                className="text-2xl text-yellow-400 animate-pulse"
                title={t.trendCard.projectCreated}
              >
                ★
              </div>
            )}
          </div>

          {/* Category */}
          <div className="category-pill inline-flex items-center gap-1.5 mb-3 group/cat" title={trend.category}>
            <span className="text-base">{config.icon}</span>
            <span className="hidden xs:inline">{trend.category}</span>
            {/* Tooltip for mobile - show category name on hover */}
            <span className="xs:hidden absolute left-0 -bottom-6 text-[10px] bg-zinc-800 px-2 py-0.5 rounded opacity-0 group-hover/cat:opacity-100 transition-opacity whitespace-nowrap z-10">
              {trend.category}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-2 leading-tight group-hover:text-indigo-100 transition-colors">
            {displayTitle}
          </h3>

          {/* Description */}
          <p className="text-sm text-zinc-400 mb-5 line-clamp-3 group-hover:text-zinc-300 transition-colors">
            {displayWhyTrending}
          </p>

          {/* Metrics Bar */}
          {trend.enriched_at ? (
            <div className="flex items-center gap-2 mb-4 p-2.5 bg-zinc-900/50 rounded-xl border border-zinc-800/30">
              {/* Competition Level */}
              <div
                className="flex-1 flex items-center gap-1.5 min-w-0 cursor-help group/comp relative"
                title={`Уровень конкуренции: ${
                  trend.competition_level === 'low' ? 'низкий (мало конкурентов в поиске Google)' :
                  trend.competition_level === 'medium' ? 'средний (умеренное количество конкурентов)' :
                  'высокий (много существующих продуктов)'
                }. Источник: Google Search (SerpAPI)`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  trend.competition_level === 'low' ? 'bg-green-400' :
                  trend.competition_level === 'medium' ? 'bg-yellow-400' :
                  'bg-red-400'
                }`} />
                <span className={`text-[11px] font-medium truncate ${
                  trend.competition_level === 'low' ? 'text-green-400' :
                  trend.competition_level === 'medium' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {trend.competition_level === 'low' ? 'Low' :
                   trend.competition_level === 'medium' ? 'Mid' : 'High'}
                </span>
              </div>
              {/* Separator */}
              <div className="w-px h-4 bg-zinc-700/50" />
              {/* Players Count */}
              <div
                className="flex-1 flex items-center gap-1.5 min-w-0 justify-center cursor-help"
                title={`${trend.top_players_count ?? 0} прямых конкурентов найдено в Google. Считаются сайты с признаками SaaS/продукта (pricing, signup, free trial и т.д.). Источник: Google Search (SerpAPI)`}
              >
                <span className="text-[11px] text-zinc-500">📊</span>
                <span className="text-[11px] text-zinc-300 font-medium">{trend.top_players_count ?? '—'}</span>
                <span className="text-[11px] text-zinc-500 hidden xs:inline">players</span>
              </div>
              {/* Separator */}
              <div className="w-px h-4 bg-zinc-700/50" />
              {/* Entry Cost */}
              <div
                className="flex-1 flex items-center gap-1 min-w-0 justify-end cursor-help"
                title={`${trend.entry_cost_estimate || '—'} — рекомендуемый бюджет на MVP (разработка, API, хостинг, домен). AI-оценка на основе сложности ниши и конкуренции. Источник: GPT-4o-mini`}
              >
                <span className="text-[11px] text-zinc-500">💰</span>
                <span className="text-[11px] text-zinc-300 font-medium truncate">{trend.entry_cost_estimate || '—'}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-4 p-2.5 bg-zinc-900/30 rounded-xl border border-zinc-800/20">
              <div className="flex-1 flex items-center justify-center gap-2">
                <div className="w-12 h-2 bg-zinc-800 rounded animate-pulse" />
                <div className="w-px h-4 bg-zinc-800/50" />
                <div className="w-10 h-2 bg-zinc-800 rounded animate-pulse" />
                <div className="w-px h-4 bg-zinc-800/50" />
                <div className="w-14 h-2 bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-between items-center pt-4 border-t border-zinc-800/50">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
              <span>{getTimeAgoLocalized(trend.first_detected_at)}</span>
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
                title={t.trendCard.details}
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
                {t.trendCard.details}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fadeIn"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#16161a] border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`p-4 sm:p-6 border-b border-zinc-800 bg-gradient-to-br ${config.color}`}>
              {/* Mobile drag handle */}
              <div className="w-12 h-1 bg-zinc-600 rounded-full mx-auto mb-4 sm:hidden" />
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="category-pill inline-flex items-center gap-1.5 mb-2 sm:mb-3">
                    <span className="text-sm sm:text-base">{config.icon}</span>
                    <span className="text-xs sm:text-sm">{trend.category}</span>
                  </div>
                  <h2 className="text-lg sm:text-2xl font-bold text-white truncate">{displayTitle}</h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 sm:w-10 h-8 sm:h-10 flex-shrink-0 flex items-center justify-center rounded-full bg-zinc-800/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-all"
                >
                  <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Description */}
              <div className="bg-zinc-900/30 rounded-xl p-4">
                <h3 className="text-white font-semibold mb-2 flex items-center gap-2">
                  <span>💡</span>
                  {t.trendCard.whyTrending}
                </h3>
                <p className="text-zinc-400">{displayWhyTrending}</p>
              </div>

              {/* Info */}
              <div className="flex items-center gap-4 text-sm text-zinc-500 pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>{t.trendCard.detected} {getTimeAgoLocalized(trend.first_detected_at)}</span>
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
            <div className="p-4 sm:p-6 border-t border-zinc-800 flex flex-col sm:flex-row gap-2 sm:gap-3">
              {/* Индикатор завершённого проекта */}
              {isProjectCompleted && (
                <div className="flex-1 py-3 sm:py-3.5 rounded-xl font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 flex items-center justify-center gap-2 text-sm sm:text-base">
                  <span className="text-lg sm:text-xl">★</span>
                  <span>{t.trendCard.projectCreated}</span>
                </div>
              )}
              <button
                onClick={() => {
                  setShowModal(false);
                  router.push(`/trends/${trend.id}`);
                }}
                className="flex-1 py-3 sm:py-3.5 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 text-sm sm:text-base"
              >
                <span>🚀</span>
                <span>{t.trendCard.openDetails}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
