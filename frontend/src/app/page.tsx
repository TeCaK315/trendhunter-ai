'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import TrendCard from '@/components/TrendCard';
import UserMenu from '@/components/auth/UserMenu';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useTranslations } from '@/lib/i18n';
import { useIdeasLimit } from '@/hooks/useIdeasLimit';
import { signIn } from 'next-auth/react';

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

const sortOptionsConfig: { id: SortField; labelKey: keyof typeof import('@/lib/i18n/translations').translations.ru.sort; icon: string }[] = [
  { id: 'overall_score', labelKey: 'overallScore', icon: '📊' },
  { id: 'first_detected_at', labelKey: 'byDate', icon: '🕐' },
  { id: 'opportunity_score', labelKey: 'opportunity', icon: '🎯' },
  { id: 'pain_score', labelKey: 'pain', icon: '🔥' },
  { id: 'feasibility_score', labelKey: 'feasibility', icon: '⚡' },
  { id: 'profit_potential', labelKey: 'profit', icon: '💰' },
];

function getOverallScore(trend: Trend): number {
  return Number(((trend.opportunity_score + trend.pain_score + trend.feasibility_score + trend.profit_potential) / 4).toFixed(1));
}

const categoriesConfig: { id: string; labelKey: keyof typeof import('@/lib/i18n/translations').translations.ru.categories; icon: string }[] = [
  { id: 'all', labelKey: 'all', icon: '🌐' },
  { id: 'Technology', labelKey: 'technology', icon: '⚙️' },
  { id: 'SaaS', labelKey: 'saas', icon: '💻' },
  { id: 'E-commerce', labelKey: 'ecommerce', icon: '🛒' },
  { id: 'Mobile Apps', labelKey: 'mobileApps', icon: '📱' },
  { id: 'EdTech', labelKey: 'edtech', icon: '🎓' },
  { id: 'HealthTech', labelKey: 'healthtech', icon: '💚' },
  { id: 'AI/ML', labelKey: 'aiml', icon: '🤖' },
  { id: 'FinTech', labelKey: 'fintech', icon: '💰' },
];


const INITIAL_DISPLAY_COUNT = 6;

export default function Home() {
  const [trends, setTrends] = useState<Trend[]>([]);
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
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generateCategory, setGenerateCategory] = useState<string>('random');
  const [generateDropdownOpen, setGenerateDropdownOpen] = useState(false);
  const t = useTranslations();
  const { isAuthenticated, canGenerate, recordGeneration, ideasRemaining, isAdmin, mounted: limitMounted } = useIdeasLimit();

  useEffect(() => {
    fetchTrends();

    const refreshInterval = setInterval(() => {
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
      if (!target.closest('.generate-dropdown')) {
        setGenerateDropdownOpen(false);
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

  const generateNewTrends = async (category?: string) => {
    // Check if user can generate
    if (!isAuthenticated) {
      setGenerateError(t.auth.loginToGenerate);
      setTimeout(() => setGenerateError(null), 8000);
      return;
    }

    if (!canGenerate) {
      setGenerateError(t.auth.limitReachedDescription);
      setTimeout(() => setGenerateError(null), 8000);
      return;
    }

    setGenerating(true);
    setGenerateError(null);
    setGenerateDropdownOpen(false);
    const selectedCategory = category || generateCategory;
    try {
      // Используем API route вместо прямого вызова n8n webhook
      const response = await fetch('/api/generate-trends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: selectedCategory })
      });
      const data = await response.json();

      if (data.success) {
        // Record usage with generated ideas data
        const generatedIdeas = data.data?.trends || data.data || [];
        recordGeneration(Array.isArray(generatedIdeas) ? generatedIdeas : []);
        await fetchTrends();
      } else if (data.error) {
        console.error('Error generating trends:', data.error);
        setGenerateError(data.hint || data.error);
        // Auto-hide error after 8 seconds
        setTimeout(() => setGenerateError(null), 8000);
      }
    } catch (error) {
      console.error('Error generating trends:', error);
      setGenerateError(t.home.connectionError || 'Ошибка соединения');
      setTimeout(() => setGenerateError(null), 8000);
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

  const currentSortOption = sortOptionsConfig.find(opt => opt.id === sortField);

  // Stats for hero
  const totalIdeas = trends.length;
  const avgScore = trends.length > 0 ? (trends.reduce((sum, t) => sum + getOverallScore(t), 0) / trends.length).toFixed(1) : '0';
  // Stats calculation (mostPopularCategory available for future use)

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Main Content */}
      <div className="min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 glass border-b border-zinc-800/50">
          <div className="px-4 sm:px-6 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-2 sm:gap-4">
              {/* Search + Live badge */}
              <div className="flex-1 flex items-center gap-3 max-w-xl">
                <div className="relative flex-1">
                  <svg className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder={t.home.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2.5 sm:py-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-sm sm:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
                {/* Live data badge */}
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-zinc-800/50 rounded-lg">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-xs text-zinc-400">{t.home.liveData}</span>
                </div>
              </div>

              {/* Right side */}
              <div className="flex items-center gap-2 sm:gap-3">
                {lastUpdated && (
                  <span className="hidden lg:block text-xs text-zinc-500 bg-zinc-800/50 px-3 py-1.5 rounded-lg">
                    {t.home.updated}: {new Date(lastUpdated).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {/* Generate Ideas Dropdown */}
                <div className="relative generate-dropdown">
                  <div className="flex">
                    <button
                      onClick={() => generateNewTrends()}
                      disabled={generating || refreshing}
                      data-tour="generate-trends"
                      className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-l-xl text-sm font-medium transition-all ${
                        generating
                          ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <svg className={`w-4 h-4 ${generating ? 'animate-pulse' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="hidden md:inline">{generating ? t.home.generating : t.home.newIdeas}</span>
                    </button>
                    <button
                      onClick={() => setGenerateDropdownOpen(!generateDropdownOpen)}
                      disabled={generating || refreshing}
                      className={`px-2 py-2 sm:py-2.5 rounded-r-xl border-l border-indigo-500/30 text-sm font-medium transition-all ${
                        generating
                          ? 'bg-indigo-600/50 text-indigo-300 cursor-wait'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>

                  {generateDropdownOpen && (
                    <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                      <div className="p-2">
                        <div className="px-3 py-2 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                          {t.home.generateFrom}
                        </div>
                        {/* Random option */}
                        <button
                          onClick={() => {
                            setGenerateCategory('random');
                            generateNewTrends('random');
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-zinc-800 transition-colors ${
                            generateCategory === 'random' ? 'bg-indigo-500/20 text-indigo-400' : 'text-white'
                          }`}
                        >
                          <span>🎲</span>
                          <span>{t.home.randomCategory}</span>
                        </button>
                        {/* Category options */}
                        {categoriesConfig.filter(c => c.id !== 'all').map((cat) => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setGenerateCategory(cat.id);
                              generateNewTrends(cat.id);
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-zinc-800 transition-colors ${
                              generateCategory === cat.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-white'
                            }`}
                          >
                            <span>{cat.icon}</span>
                            <span>{t.categories[cat.labelKey]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button
                  onClick={fetchTrends}
                  disabled={refreshing || generating}
                  className={`hidden sm:flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-sm font-medium transition-all ${
                    refreshing
                      ? 'bg-zinc-800 text-zinc-500 cursor-wait'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-white'
                  }`}
                >
                  <svg className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span className="hidden lg:inline">{refreshing ? t.home.refreshing : t.home.refresh}</span>
                </button>
                <div className="hidden sm:block">
                  <LanguageSwitcher compact />
                </div>
                {/* Hide UserMenu login button on mobile when not authenticated (main content has login screen) */}
                <div className={!isAuthenticated ? 'hidden sm:block' : ''}>
                  <UserMenu />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Error Toast */}
        {generateError && (
          <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fadeIn">
            <div className="bg-amber-500/20 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-xl shadow-lg flex items-start gap-3 max-w-md">
              <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm">{generateError}</p>
                <Link href="/niche-research" className="text-xs text-amber-400 hover:text-amber-300 underline mt-1 inline-block">
                  {t.home.useNicheResearch}
                </Link>
              </div>
              <button
                onClick={() => setGenerateError(null)}
                className="text-amber-400 hover:text-amber-200 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Hero Section */}
        <div className="relative px-4 sm:px-6 py-8 sm:py-12 hero-gradient overflow-hidden">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white mb-3 sm:mb-4 leading-tight">
              {t.home.heroTitle1} <span className="gradient-text">{t.home.heroTitle2}</span>
              <span className="hidden sm:inline"><br /></span>
              <span className="sm:hidden"> </span>
              {t.home.heroTitle3}
            </h1>

            <p className="text-sm sm:text-lg text-zinc-400 mb-6 sm:mb-8 max-w-xl mx-auto">
              {t.home.heroDescription}
            </p>

            {/* Stats - horizontal with dividers */}
            <div className="flex items-center justify-center gap-4 sm:gap-8 text-center">
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">{totalIdeas}</div>
                <div className="text-[10px] sm:text-xs text-zinc-500 mt-1">{t.home.ideas}</div>
              </div>
              <div className="w-px h-10 bg-zinc-700"></div>
              <div>
                <div className="text-xl sm:text-2xl font-bold gradient-text">{avgScore}</div>
                <div className="text-[10px] sm:text-xs text-zinc-500 mt-1">{t.home.avgRating}</div>
              </div>
              <div className="w-px h-10 bg-zinc-700"></div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-white">{categoriesConfig.length - 1}</div>
                <div className="text-[10px] sm:text-xs text-zinc-500 mt-1">{t.home.categories}</div>
              </div>
            </div>
          </div>

          {/* Decorative elements - hidden on mobile */}
          <div className="hidden sm:block absolute right-10 top-10 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="hidden sm:block absolute right-40 bottom-0 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
        </div>

        {/* Filters Section */}
        <div className="sticky top-0 lg:top-[73px] z-20 glass border-b border-zinc-800/50 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            {/* Category filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide -mx-4 sm:mx-0 px-4 sm:px-0">
              {categoriesConfig.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  title={t.categories[cat.labelKey]}
                  className={`filter-chip whitespace-nowrap flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm ${
                    selectedCategory === cat.id ? 'active' : ''
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="hidden xs:inline">{t.categories[cat.labelKey]}</span>
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="relative sort-dropdown flex-shrink-0">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setSortDropdownOpen(!sortDropdownOpen)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 rounded-l-xl text-xs sm:text-sm text-white transition-all"
                >
                  <span className="text-sm">{currentSortOption?.icon}</span>
                  <span className="hidden sm:inline whitespace-nowrap">{currentSortOption ? t.sort[currentSortOption.labelKey] : ''}</span>
                  <svg className="w-3 sm:w-4 h-3 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <button
                  onClick={toggleSortDirection}
                  className="flex items-center justify-center px-2 py-2 sm:py-2.5 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 border-l-0 rounded-r-xl text-white transition-all"
                  title={sortDirection === 'desc' ? t.sort.highToLow : t.sort.lowToHigh}
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
              </div>

              {sortDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
                  <div className="p-2">
                    {sortOptionsConfig.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleSortChange(option.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg hover:bg-zinc-800 transition-colors ${
                          sortField === option.id ? 'bg-indigo-500/20 text-indigo-400' : 'text-white'
                        }`}
                      >
                        <span className="w-5 text-center">{option.icon}</span>
                        <span className="flex-1">{t.sort[option.labelKey]}</span>
                        {sortField === option.id && (
                          <span className="text-xs opacity-60">
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
        <main className="px-4 sm:px-6 py-6 sm:py-8">
          {/* Login required screen for unauthenticated users */}
          {limitMounted && !isAuthenticated ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center">
              <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 rounded-full flex items-center justify-center mb-8 border border-indigo-500/30">
                <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">{t.auth.loginRequired}</h2>
              <p className="text-zinc-400 max-w-md mb-8 text-sm sm:text-base">
                {t.auth.loginToGenerate}
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => signIn('google')}
                  className="flex items-center justify-center gap-3 px-6 py-3 bg-white hover:bg-zinc-100 text-zinc-900 rounded-xl font-medium transition-all"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Google
                </button>
                <button
                  onClick={() => window.location.href = '/api/auth/github'}
                  className="flex items-center justify-center gap-3 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition-all border border-zinc-700"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
              </div>
              <p className="mt-6 text-xs text-zinc-500">
                {isAdmin ? '' : `10 ${t.home.ideas.toLowerCase()} / ${t.home.categories.toLowerCase()}`}
              </p>
            </div>
          ) : loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
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
              <h3 className="text-xl font-semibold text-white mb-2">{t.home.nothingFound}</h3>
              <p className="text-zinc-400 max-w-md">
                {searchQuery ? t.home.tryChangingSearch : t.home.noTrendsInCategory}
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-4 btn-secondary"
                >
                  {t.home.resetSearch}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Results count */}
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-zinc-500">
                  {t.home.found} <span className="text-white font-medium">{sortedTrends.length}</span> {t.home.moreIdeas}
                  {selectedCategory !== 'all' && (
                    <span> {t.home.ideasIn} <span className="text-indigo-400">{t.categories[categoriesConfig.find(c => c.id === selectedCategory)?.labelKey || 'all']}</span></span>
                  )}
                </p>
              </div>

              {/* Trends Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 stagger-children">
                {displayedTrends.map((trend, index) => (
                  <TrendCard
                    key={trend.id}
                    trend={trend}
                    dataTour={index === 0 ? 'trend-card' : undefined}
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
                        <span>{t.home.hide}</span>
                      </>
                    ) : (
                      <>
                        <span>{t.home.showMore} {hiddenCount} {t.home.moreIdeas}</span>
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

        {/* Footer - hidden on mobile (bottom nav takes its place) */}
        <footer className="hidden lg:block px-6 py-6 border-t border-zinc-800/50">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>{t.home.dataUpdatesAuto}</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/niche-research" className="hover:text-white transition-colors">{t.nav.nicheResearch}</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
