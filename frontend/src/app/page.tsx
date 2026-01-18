'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TrendCard from '@/components/TrendCard';
import Sidebar from '@/components/layout/Sidebar';
import GitHubAuth from '@/components/GitHubAuth';

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

type SortField = 'overall_score' | 'opportunity_score' | 'pain_score' | 'feasibility_score' | 'profit_potential' | 'first_detected_at';
type SortDirection = 'asc' | 'desc';

const sortOptions: { id: SortField; label: string; icon: string }[] = [
  { id: 'overall_score', label: 'Общая оценка', icon: '📊' },
  { id: 'first_detected_at', label: 'По дате', icon: '🕐' },
  { id: 'opportunity_score', label: 'Возможность', icon: '🎯' },
  { id: 'pain_score', label: 'Боль', icon: '🔥' },
  { id: 'feasibility_score', label: 'Выполнимость', icon: '⚡' },
  { id: 'profit_potential', label: 'Выгода', icon: '💰' },
];

function getOverallScore(trend: Trend): number {
  return Number(((trend.opportunity_score + trend.pain_score + trend.feasibility_score + trend.profit_potential) / 4).toFixed(1));
}

const categories = [
  { id: 'all', label: 'Все ниши', icon: '🌐' },
  { id: 'Technology', label: 'Technology', icon: '⚙️' },
  { id: 'SaaS', label: 'SaaS', icon: '💻' },
  { id: 'E-commerce', label: 'E-commerce', icon: '🛒' },
  { id: 'Mobile Apps', label: 'Mobile Apps', icon: '📱' },
  { id: 'EdTech', label: 'EdTech', icon: '🎓' },
  { id: 'HealthTech', label: 'HealthTech', icon: '💚' },
  { id: 'AI/ML', label: 'AI/ML', icon: '🤖' },
  { id: 'FinTech', label: 'FinTech', icon: '💰' },
];

// Mock data for testing before n8n sends real data
const mockTrends: Trend[] = [
  {
    id: '1',
    title: 'AI-ассистент для создания контент-планов',
    category: 'SaaS',
    popularity_score: 85,
    opportunity_score: 9.2,
    pain_score: 8.8,
    feasibility_score: 8.5,
    profit_potential: 9.5,
    growth_rate: 72,
    why_trending: 'Автоматическая генерация контент-стратегии на основе анализа конкурентов и трендов в нише',
    status: 'active',
    first_detected_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    source: 'Reddit + Google Trends',
  },
  {
    id: '2',
    title: 'Платформа для подбора БАДов на основе анализов',
    category: 'HealthTech',
    popularity_score: 78,
    opportunity_score: 8.7,
    pain_score: 9.2,
    feasibility_score: 7.0,
    profit_potential: 9.0,
    growth_rate: 65,
    why_trending: 'Персонализированные рекомендации витаминов и добавок по результатам анализа крови',
    status: 'active',
    first_detected_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    source: 'YouTube + Facebook',
  },
  {
    id: '3',
    title: 'Маркетплейс аренды спортивного оборудования',
    category: 'E-commerce',
    popularity_score: 72,
    opportunity_score: 8.5,
    pain_score: 8.0,
    feasibility_score: 8.8,
    profit_potential: 8.2,
    growth_rate: 58,
    why_trending: 'P2P платформа для краткосрочной аренды велосипедов, лыж, сноубордов и другого спортинвентаря',
    status: 'active',
    first_detected_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    source: 'Reddit',
  },
];

const INITIAL_DISPLAY_COUNT = 6;

export default function Home() {
  const [trends, setTrends] = useState<Trend[]>(mockTrends);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('overall_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTrends();

    const refreshInterval = setInterval(() => {
      console.log('Auto-refreshing trends...');
      fetchTrends();
    }, 5 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.sort-dropdown')) {
        setSortDropdownOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const fetchTrends = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/trends');
      const data = await response.json();

      if (data.trends && data.trends.length > 0) {
        setTrends(data.trends);
        setLastUpdated(data.lastUpdated);
      }
    } catch (error) {
      console.error('Error fetching trends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const generateNewTrends = async () => {
    setGenerating(true);
    try {
      const response = await fetch('http://localhost:5678/webhook/generate-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();

      if (data.success) {
        // Refresh trends after generation
        await fetchTrends();
      }
    } catch (error) {
      console.error('Error generating trends:', error);
    } finally {
      setGenerating(false);
    }
  };

  const toggleSortDirection = () => {
    setSortDirection(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      toggleSortDirection();
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setSortDropdownOpen(false);
  };

  const filteredTrends = trends
    .filter(t => selectedCategory === 'all' || t.category === selectedCategory || (t.category === 'AI & ML' && selectedCategory === 'AI/ML'))
    .filter(t => searchQuery === '' || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.why_trending.toLowerCase().includes(searchQuery.toLowerCase()));

  const sortedTrends = [...filteredTrends].sort((a, b) => {
    let aValue: number;
    let bValue: number;

    if (sortField === 'overall_score') {
      aValue = getOverallScore(a);
      bValue = getOverallScore(b);
    } else if (sortField === 'first_detected_at') {
      // Сортировка по дате
      aValue = new Date(a.first_detected_at).getTime();
      bValue = new Date(b.first_detected_at).getTime();
    } else {
      aValue = Number(a[sortField]) || 0;
      bValue = Number(b[sortField]) || 0;
    }

    if (sortDirection === 'desc') {
      return bValue - aValue;
    }
    return aValue - bValue;
  });

  const displayedTrends = showAll ? sortedTrends : sortedTrends.slice(0, INITIAL_DISPLAY_COUNT);
  const hasMoreTrends = sortedTrends.length > INITIAL_DISPLAY_COUNT;
  const hiddenCount = sortedTrends.length - INITIAL_DISPLAY_COUNT;

  const currentSortOption = sortOptions.find(opt => opt.id === sortField);

  // Stats for hero
  const totalIdeas = trends.length;
  const avgScore = trends.length > 0 ? (trends.reduce((sum, t) => sum + getOverallScore(t), 0) / trends.length).toFixed(1) : '0';
  // Stats calculation (mostPopularCategory available for future use)

  return (
    <div className="min-h-screen bg-[#09090b]">
      <Sidebar />

      {/* Main Content */}
      <div className="lg:ml-64 min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 glass border-b border-zinc-800/50">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Search */}
              <div className="flex-1 max-w-xl">
                <div className="relative">
                  <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Поиск идей..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-3">
                {lastUpdated && (
                  <span className="hidden md:block text-xs text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                    Обновлено: {new Date(lastUpdated).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                <button
                  onClick={generateNewTrends}
                  disabled={generating || refreshing}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    generating
                      ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                  }`}
                  title="Запустить AI для генерации новых идей"
                >
                  <svg className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">{generating ? 'Генерация...' : 'Новые идеи'}</span>
                </button>
                <button
                  onClick={fetchTrends}
                  disabled={refreshing || generating}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    refreshing
                      ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                  title="Обновить список с сервера"
                >
                  <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden sm:inline">{refreshing ? 'Обновление...' : 'Обновить'}</span>
                </button>
                <GitHubAuth compact />
              </div>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="relative px-6 py-12 hero-gradient">
          <div className="max-w-4xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="badge badge-info">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Live данные
              </span>
              <span className="text-sm text-zinc-500">Обновляется каждые 6 часов</span>
            </div>

            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
              Найди свою <span className="gradient-text">идею</span><br />
              для следующего проекта
            </h1>

            <p className="text-lg text-zinc-400 mb-8 max-w-2xl">
              AI анализирует тренды из Reddit, Google Trends, YouTube и других источников,
              чтобы найти перспективные ниши с высоким потенциалом.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 max-w-lg">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{totalIdeas}</div>
                <div className="text-xs text-zinc-500 mt-1">Идей</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold gradient-text">{avgScore}</div>
                <div className="text-xs text-zinc-500 mt-1">Ср. рейтинг</div>
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-white">{categories.length - 1}</div>
                <div className="text-xs text-zinc-500 mt-1">Категорий</div>
              </div>
            </div>
          </div>

          {/* Decorative elements */}
          <div className="absolute right-10 top-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute right-40 bottom-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Filters Section */}
        <div className="sticky top-[73px] z-20 glass border-b border-zinc-800/50 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Category filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`filter-chip whitespace-nowrap flex items-center gap-2 ${
                    selectedCategory === cat.id ? 'active' : ''
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="relative sort-dropdown">
              <button
                onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-sm text-white transition-all"
              >
                <span>{currentSortOption?.icon}</span>
                <span className="hidden sm:inline">{currentSortOption?.label}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSortDirection();
                  }}
                  className="ml-1 p-1 hover:bg-zinc-700 rounded transition-colors"
                  title={sortDirection === 'desc' ? 'Высокие → Низкие' : 'Низкие → Высокие'}
                >
                  {sortDirection === 'desc' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </button>
                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {sortDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                  <div className="p-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleSortChange(option.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-zinc-800 transition-colors ${
                          sortField === option.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-white'
                        }`}
                      >
                        <span>{option.icon}</span>
                        <span>{option.label}</span>
                        {sortField === option.id && (
                          <span className="ml-auto text-xs opacity-60">
                            {sortDirection === 'desc' ? '↓' : '↑'}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <main className="px-6 py-8">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="trend-card">
                  <div className="flex justify-between items-start mb-4">
                    <div className="skeleton w-20 h-12"></div>
                    <div className="skeleton w-8 h-8 rounded-full"></div>
                  </div>
                  <div className="skeleton w-24 h-6 mb-3"></div>
                  <div className="skeleton w-full h-6 mb-2"></div>
                  <div className="skeleton w-3/4 h-4 mb-4"></div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {[...Array(4)].map((_, j) => (
                      <div key={j}>
                        <div className="skeleton w-full h-3 mb-2"></div>
                        <div className="skeleton w-full h-2"></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : sortedTrends.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                <span className="text-4xl">📭</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Ничего не найдено</h3>
              <p className="text-zinc-400 max-w-md">
                {searchQuery ? 'Попробуйте изменить поисковый запрос' : 'Нет трендов в этой категории. Запустите Trend Analyzer в n8n чтобы получить свежие данные'}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 btn-secondary"
                >
                  Сбросить поиск
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Results count */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-zinc-500">
                  Найдено <span className="text-white font-medium">{sortedTrends.length}</span> идей
                  {selectedCategory !== 'all' && (
                    <span> в категории <span className="text-indigo-400">{categories.find(c => c.id === selectedCategory)?.label}</span></span>
                  )}
                </p>
              </div>

              {/* Trends Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 stagger-children">
                {displayedTrends.map((trend) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                  />
                ))}
              </div>

              {/* Show More button */}
              {hasMoreTrends && (
                <div className="flex justify-center mt-10">
                  <button
                    onClick={() => setShowAll(!showAll)}
                    className="group flex items-center gap-3 px-8 py-4 bg-zinc-900/50 hover:bg-zinc-800/80 border border-zinc-800 hover:border-zinc-700 rounded-2xl text-white transition-all"
                  >
                    {showAll ? (
                      <>
                        <svg className="w-5 h-5 group-hover:-translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        <span>Скрыть</span>
                      </>
                    ) : (
                      <>
                        <span>Показать ещё {hiddenCount} идей</span>
                        <svg className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </main>

        {/* Footer */}
        <footer className="px-6 py-6 border-t border-zinc-800/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Данные обновляются автоматически каждые 6 часов через n8n</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/niche-research" className="hover:text-white transition-colors">Исследование ниши</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
