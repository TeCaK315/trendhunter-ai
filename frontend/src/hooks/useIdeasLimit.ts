'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useGitHubAuth } from './useGitHubAuth';

// Admin users who have unlimited access (add your email/GitHub username here)
const ADMIN_USERS = [
  'belousevgeniy315@gmail.com',  // Google email
  'TeCaK315',                     // GitHub username
];

const DAILY_IDEAS_LIMIT = 10;
const IDEAS_PER_GENERATION = 5;
const STORAGE_KEY = 'trendhunter_ideas_usage';

interface UsageData {
  ideasGenerated: number;
  lastReset: string; // ISO date string
}

interface TrendIdea {
  id?: string;
  title: string;
  category?: string;
  [key: string]: unknown;
}

function getStoredUsage(): UsageData {
  if (typeof window === 'undefined') {
    return { ideasGenerated: 0, lastReset: new Date().toISOString() };
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as UsageData;

      // Check if we need to reset (new day)
      const lastReset = new Date(data.lastReset);
      const now = new Date();

      // Reset if it's a new day (comparing dates, not times)
      if (lastReset.toDateString() !== now.toDateString()) {
        const newData = { ideasGenerated: 0, lastReset: now.toISOString() };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        return newData;
      }

      return data;
    }
  } catch {
    // Ignore parse errors
  }

  const newData = { ideasGenerated: 0, lastReset: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
  return newData;
}

function setStoredUsage(data: UsageData): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useIdeasLimit() {
  const { data: session } = useSession();
  const { authenticated: githubAuth, user: githubUser } = useGitHubAuth();

  const [usage, setUsage] = useState<UsageData>({ ideasGenerated: 0, lastReset: new Date().toISOString() });
  const [mounted, setMounted] = useState(false);
  const userRegistered = useRef(false);

  // Get user identifiers
  const userEmail = session?.user?.email || null;
  const userName = session?.user?.name || githubUser?.name || null;
  const userAvatar = session?.user?.image || githubUser?.avatar_url || null;
  const userGithub = githubUser?.login || null;

  // Check if user is authenticated
  const isAuthenticated = !!session || githubAuth;

  // Check if user is admin
  const isAdmin = !!(
    (userEmail && ADMIN_USERS.includes(userEmail)) ||
    (userGithub && ADMIN_USERS.includes(userGithub))
  );

  // Register user in database on first auth
  useEffect(() => {
    if (!isAuthenticated || userRegistered.current) return;
    if (!userEmail && !userGithub) return;

    userRegistered.current = true;

    // Register/update user in background (don't block UI)
    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: userEmail,
        githubUsername: userGithub,
        name: userName,
        avatarUrl: userAvatar,
        provider: userEmail ? 'google' : 'github',
      }),
    }).catch(err => {
      console.error('Failed to register user:', err);
    });
  }, [isAuthenticated, userEmail, userGithub, userName, userAvatar]);

  // Load usage on mount
  useEffect(() => {
    setMounted(true);
    setUsage(getStoredUsage());
  }, []);

  // Calculate remaining ideas
  const ideasUsed = usage.ideasGenerated;
  const ideasRemaining = isAdmin ? Infinity : Math.max(0, DAILY_IDEAS_LIMIT - ideasUsed);
  const canGenerate = isAdmin || ideasRemaining >= IDEAS_PER_GENERATION;

  // Calculate how many generations are left
  const generationsRemaining = isAdmin ? Infinity : Math.floor(ideasRemaining / IDEAS_PER_GENERATION);

  // Record a generation (5 ideas) - also sends to server
  const recordGeneration = useCallback((ideas?: TrendIdea[]) => {
    // Update local storage
    const currentUsage = getStoredUsage();
    const newIdeasCount = currentUsage.ideasGenerated + IDEAS_PER_GENERATION;

    if (!isAdmin) {
      if (newIdeasCount > DAILY_IDEAS_LIMIT && currentUsage.ideasGenerated < DAILY_IDEAS_LIMIT) {
        // This would exceed the limit
        const newData = { ...currentUsage, ideasGenerated: DAILY_IDEAS_LIMIT };
        setStoredUsage(newData);
        setUsage(newData);
      } else {
        const newData = { ...currentUsage, ideasGenerated: newIdeasCount };
        setStoredUsage(newData);
        setUsage(newData);
      }
    }

    // Send to server for tracking (don't block UI)
    if (userEmail || userGithub) {
      fetch('/api/users/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          githubUsername: userGithub,
          type: 'ideas',
          amount: IDEAS_PER_GENERATION,
          ideaData: ideas,
        }),
      }).catch(err => {
        console.error('Failed to record usage:', err);
      });
    }

    return true;
  }, [isAdmin, userEmail, userGithub]);

  // Get time until reset
  const getTimeUntilReset = useCallback(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return { hours, minutes };
  }, []);

  return {
    // Auth status
    isAuthenticated,
    isAdmin,
    mounted,

    // Usage stats
    ideasUsed,
    ideasRemaining: isAdmin ? '∞' : ideasRemaining,
    ideasLimit: DAILY_IDEAS_LIMIT,
    canGenerate,
    generationsRemaining: isAdmin ? '∞' : generationsRemaining,

    // Actions
    recordGeneration,
    getTimeUntilReset,

    // For progress bar
    usagePercent: isAdmin ? 0 : Math.min(100, (ideasUsed / DAILY_IDEAS_LIMIT) * 100),
  };
}
