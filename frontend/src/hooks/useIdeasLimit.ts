'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Check if user is authenticated
  const isAuthenticated = !!session || githubAuth;

  // Check if user is admin
  const isAdmin = !!(
    (session?.user?.email && ADMIN_USERS.includes(session.user.email)) ||
    (githubUser?.login && ADMIN_USERS.includes(githubUser.login))
  );

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

  // Record a generation (5 ideas)
  const recordGeneration = useCallback(() => {
    if (isAdmin) return true; // Admins don't track usage

    const currentUsage = getStoredUsage();
    const newIdeasCount = currentUsage.ideasGenerated + IDEAS_PER_GENERATION;

    if (newIdeasCount > DAILY_IDEAS_LIMIT && currentUsage.ideasGenerated < DAILY_IDEAS_LIMIT) {
      // This would exceed the limit
      const newData = { ...currentUsage, ideasGenerated: DAILY_IDEAS_LIMIT };
      setStoredUsage(newData);
      setUsage(newData);
      return true; // Still allow this last generation
    }

    const newData = { ...currentUsage, ideasGenerated: newIdeasCount };
    setStoredUsage(newData);
    setUsage(newData);
    return true;
  }, [isAdmin]);

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
