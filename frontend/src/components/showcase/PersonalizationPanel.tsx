'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import type { Trend } from '@/types/trend';

interface UserProfile {
  budget: 'low' | 'medium' | 'high';      // <$1K, $1-5K, $5K+
  experience: 'beginner' | 'intermediate' | 'expert';
  interests: string[];  // category IDs
}

interface PersonalizationPanelProps {
  trends: Trend[];
  onFilteredTrends: (trends: Trend[]) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const STORAGE_KEY = 'trendhunter_profile';

const budgetOptions = [
  { id: 'low' as const, label: 'До $1K', icon: '💵', desc: 'Минимальный старт' },
  { id: 'medium' as const, label: '$1K – $5K', icon: '💰', desc: 'Средний бюджет' },
  { id: 'high' as const, label: '$5K+', icon: '🏦', desc: 'Серьёзные инвестиции' },
];

const experienceOptions = [
  { id: 'beginner' as const, label: 'Новичок', icon: '🌱', desc: 'Первый проект' },
  { id: 'intermediate' as const, label: 'Опытный', icon: '🔧', desc: 'Есть опыт запусков' },
  { id: 'expert' as const, label: 'Эксперт', icon: '🏆', desc: '3+ проектов за плечами' },
];

const categoryOptions = [
  { id: 'SaaS', label: 'SaaS', icon: '💻' },
  { id: 'E-commerce', label: 'E-commerce', icon: '🛒' },
  { id: 'Mobile Apps', label: 'Mobile Apps', icon: '📱' },
  { id: 'EdTech', label: 'EdTech', icon: '🎓' },
  { id: 'HealthTech', label: 'HealthTech', icon: '💚' },
  { id: 'AI/ML', label: 'AI/ML', icon: '🤖' },
  { id: 'FinTech', label: 'FinTech', icon: '💰' },
  { id: 'Business', label: 'Business', icon: '📊' },
];

function parseCostRange(cost?: string): number {
  if (!cost) return 5000;
  const match = cost.match(/\$?([\d,.]+)/);
  return match ? parseFloat(match[1].replace(/,/g, '')) : 5000;
}

function scoreTrend(trend: Trend, profile: UserProfile): number {
  let score = 50; // base

  // Budget fit
  const cost = parseCostRange(trend.entry_cost_estimate);
  if (profile.budget === 'low' && cost <= 1000) score += 20;
  else if (profile.budget === 'low' && cost <= 3000) score += 10;
  else if (profile.budget === 'low' && cost > 5000) score -= 15;
  else if (profile.budget === 'medium' && cost >= 1000 && cost <= 5000) score += 20;
  else if (profile.budget === 'medium') score += 10;
  else if (profile.budget === 'high') score += 15;

  // Competition fit based on experience
  if (profile.experience === 'beginner' && trend.competition_level === 'low') score += 20;
  else if (profile.experience === 'beginner' && trend.competition_level === 'high') score -= 15;
  else if (profile.experience === 'intermediate' && trend.competition_level !== 'high') score += 10;
  else if (profile.experience === 'expert') score += 10;

  // Interest match
  if (profile.interests.length > 0) {
    if (profile.interests.includes(trend.category) ||
        (trend.category === 'AI & ML' && profile.interests.includes('AI/ML'))) {
      score += 25;
    }
  }

  // Growth bonus
  if (trend.growth_rate > 30) score += 10;
  if (trend.growth_rate > 50) score += 10;

  return Math.min(100, Math.max(0, score));
}

export default function PersonalizationPanel({ trends, onFilteredTrends, isOpen, onToggle }: PersonalizationPanelProps) {
  const [profile, setProfile] = useState<UserProfile>({
    budget: 'medium',
    experience: 'beginner',
    interests: [],
  });
  const [isConfigured, setIsConfigured] = useState(false);

  // Load profile
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setProfile(JSON.parse(saved));
        setIsConfigured(true);
      }
    } catch {}
  }, []);

  // Score and filter trends
  const scoredTrends = useMemo(() => {
    if (!isConfigured) return trends;
    return [...trends]
      .map(t => ({ ...t, _score: scoreTrend(t, profile) }))
      .sort((a, b) => b._score - a._score);
  }, [trends, profile, isConfigured]);

  // Notify parent (use ref to avoid infinite loop when parent setState recreates callback)
  const onFilteredTrendsRef = useRef(onFilteredTrends);
  onFilteredTrendsRef.current = onFilteredTrends;
  const prevScoredRef = useRef<typeof scoredTrends | null>(null);

  useEffect(() => {
    if (isConfigured && scoredTrends !== prevScoredRef.current) {
      prevScoredRef.current = scoredTrends;
      onFilteredTrendsRef.current(scoredTrends);
    }
  }, [scoredTrends, isConfigured]);

  const saveProfile = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    setIsConfigured(true);
  };

  const resetProfile = () => {
    localStorage.removeItem(STORAGE_KEY);
    setIsConfigured(false);
    setProfile({ budget: 'medium', experience: 'beginner', interests: [] });
    onFilteredTrends(trends);
  };

  const toggleInterest = (catId: string) => {
    setProfile(prev => ({
      ...prev,
      interests: prev.interests.includes(catId)
        ? prev.interests.filter(i => i !== catId)
        : [...prev.interests, catId],
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="mb-6 p-4 sm:p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/50 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎯</span>
          <h3 className="text-sm font-semibold text-white">Персонализация</h3>
          {isConfigured && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
              Активна
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <button
              onClick={resetProfile}
              className="text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-zinc-800"
            >
              Сбросить
            </button>
          )}
          <button
            onClick={onToggle}
            className="text-zinc-500 hover:text-white transition-colors p-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-5">
        {/* Budget */}
        <div>
          <label className="text-xs text-zinc-400 font-medium mb-2 block">Ваш бюджет на MVP</label>
          <div className="grid grid-cols-3 gap-2">
            {budgetOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setProfile(p => ({ ...p, budget: opt.id }))}
                className={`p-3 rounded-xl text-center transition-all border ${
                  profile.budget === opt.id
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                    : 'bg-zinc-800/40 border-zinc-700/30 text-zinc-400 hover:bg-zinc-800/70'
                }`}
              >
                <span className="text-lg block mb-1">{opt.icon}</span>
                <span className="text-xs font-medium block">{opt.label}</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Experience */}
        <div>
          <label className="text-xs text-zinc-400 font-medium mb-2 block">Ваш опыт</label>
          <div className="grid grid-cols-3 gap-2">
            {experienceOptions.map(opt => (
              <button
                key={opt.id}
                onClick={() => setProfile(p => ({ ...p, experience: opt.id }))}
                className={`p-3 rounded-xl text-center transition-all border ${
                  profile.experience === opt.id
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                    : 'bg-zinc-800/40 border-zinc-700/30 text-zinc-400 hover:bg-zinc-800/70'
                }`}
              >
                <span className="text-lg block mb-1">{opt.icon}</span>
                <span className="text-xs font-medium block">{opt.label}</span>
                <span className="text-[10px] text-zinc-500 block mt-0.5">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Interests */}
        <div>
          <label className="text-xs text-zinc-400 font-medium mb-2 block">Интересные категории</label>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map(cat => (
              <button
                key={cat.id}
                onClick={() => toggleInterest(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  profile.interests.includes(cat.id)
                    ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                    : 'bg-zinc-800/40 border-zinc-700/30 text-zinc-400 hover:bg-zinc-800/70'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Apply */}
        <button
          onClick={saveProfile}
          className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all"
        >
          {isConfigured ? 'Обновить рекомендации' : 'Применить фильтр'}
        </button>
      </div>

      {/* Score preview */}
      {isConfigured && scoredTrends.length > 0 && (
        <div className="mt-4 pt-4 border-t border-zinc-800/50">
          <p className="text-[10px] text-zinc-500 mb-2">Топ-3 рекомендации для вас:</p>
          <div className="space-y-1.5">
            {scoredTrends.slice(0, 3).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-zinc-800/30">
                <span className="text-xs text-white truncate flex-1">{t.title}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ml-2 ${
                  t._score >= 80 ? 'bg-green-500/15 text-green-400' :
                  t._score >= 60 ? 'bg-yellow-500/15 text-yellow-400' :
                  'bg-zinc-500/15 text-zinc-400'
                }`}>
                  {t._score}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
