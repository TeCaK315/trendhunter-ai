'use client';

import { useState } from 'react';
import { Trophy, Star, Flame, Medal, Lock, Zap } from 'lucide-react';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  earned: boolean;
  earnedAt?: string;
}

interface GamificationProps {
  xp: number;
  level: number;
  xpToNextLevel: number;
  streak: number;
  badges: Badge[];
  leaderboard?: { name: string; xp: number; level: number; avatar?: string }[];
}

export default function Gamification({ xp, level, xpToNextLevel, streak, badges, leaderboard = [] }: GamificationProps) {
  const [tab, setTab] = useState<'badges' | 'leaderboard'>('badges');

  const xpProgress = xpToNextLevel > 0 ? Math.min(100, Math.round((xp / xpToNextLevel) * 100)) : 100;
  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#6366f140' }}>
          <Zap className="w-6 h-6 mx-auto mb-1" style={{ color: '#6366f1' }} />
          <p className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>{xp}</p>
          <p className="text-xs" style={{ color: '#e2e8f050' }}>XP</p>
        </div>
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#6366f140' }}>
          <Star className="w-6 h-6 mx-auto mb-1" style={{ color: '#eab308' }} />
          <p className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>{level}</p>
          <p className="text-xs" style={{ color: '#e2e8f050' }}>Уровень</p>
        </div>
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#6366f140' }}>
          <Flame className="w-6 h-6 mx-auto mb-1" style={{ color: '#ef4444' }} />
          <p className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>{streak}</p>
          <p className="text-xs" style={{ color: '#e2e8f050' }}>Streak дней</p>
        </div>
        <div className="rounded-xl border p-4 text-center" style={{ borderColor: '#6366f140' }}>
          <Medal className="w-6 h-6 mx-auto mb-1" style={{ color: '#6366f1' }} />
          <p className="text-2xl font-bold" style={{ color: '#e2e8f0' }}>{earnedBadges.length}</p>
          <p className="text-xs" style={{ color: '#e2e8f050' }}>Бейджей</p>
        </div>
      </div>

      {/* Level progress */}
      <div className="rounded-xl border p-4" style={{ borderColor: '#6366f140' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>Уровень {level}</span>
          <span className="text-xs" style={{ color: '#e2e8f050' }}>{xp} / {xpToNextLevel} XP</span>
        </div>
        <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: '#6366f110' }}>
          <div className="h-full rounded-full transition-all" style={{ width: xpProgress + '%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }} />
        </div>
        <p className="text-xs mt-1" style={{ color: '#e2e8f050' }}>
          {xpToNextLevel - xp > 0 ? `Ещё ${xpToNextLevel - xp} XP до уровня ${level + 1}` : 'Максимальный уровень!'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border rounded-xl p-1" style={{ borderColor: '#6366f140' }}>
        <button onClick={() => setTab('badges')}
          className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
          style={{ background: tab === 'badges' ? '#6366f1' : 'transparent', color: tab === 'badges' ? '#fff' : '#e2e8f070' }}>
          Бейджи ({badges.length})
        </button>
        {leaderboard.length > 0 && (
          <button onClick={() => setTab('leaderboard')}
            className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
            style={{ background: tab === 'leaderboard' ? '#6366f1' : 'transparent', color: tab === 'leaderboard' ? '#fff' : '#e2e8f070' }}>
            Рейтинг
          </button>
        )}
      </div>

      {/* Badges */}
      {tab === 'badges' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {earnedBadges.map(badge => (
            <div key={badge.id} className="rounded-xl border p-4 text-center" style={{ borderColor: '#6366f1', background: '#6366f110' }}>
              <span className="text-3xl block mb-2">{badge.icon}</span>
              <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{badge.name}</p>
              <p className="text-xs mt-1" style={{ color: '#e2e8f050' }}>{badge.description}</p>
            </div>
          ))}
          {lockedBadges.map(badge => (
            <div key={badge.id} className="rounded-xl border p-4 text-center opacity-50" style={{ borderColor: '#6366f140' }}>
              <div className="relative inline-block mb-2">
                <span className="text-3xl block grayscale">{badge.icon}</span>
                <Lock className="w-4 h-4 absolute -bottom-1 -right-1" style={{ color: '#e2e8f050' }} />
              </div>
              <p className="text-sm font-semibold" style={{ color: '#e2e8f0' }}>{badge.name}</p>
              <p className="text-xs mt-1" style={{ color: '#e2e8f050' }}>{badge.description}</p>
            </div>
          ))}
        </div>
      )}

      {/* Leaderboard */}
      {tab === 'leaderboard' && (
        <div className="space-y-2">
          {leaderboard.map((user, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl border" style={{ borderColor: i < 3 ? '#6366f1' : '#6366f140', background: i < 3 ? '#6366f110' : 'transparent' }}>
              <span className="w-7 text-center text-sm font-bold" style={{ color: i < 3 ? '#6366f1' : '#e2e8f050' }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
                {user.avatar || user.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{user.name}</p>
                <p className="text-xs" style={{ color: '#e2e8f050' }}>Ур. {user.level}</p>
              </div>
              <span className="text-sm font-bold" style={{ color: '#6366f1' }}>{user.xp} XP</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
