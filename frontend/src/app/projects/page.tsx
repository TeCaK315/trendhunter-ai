'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';
import Sidebar from '@/components/layout/Sidebar';

interface Project {
  id: string;
  name: string;
  description: string;
  repo_url: string;
  clone_url: string;
  trend_id: string;
  trend_title: string;
  created_at: string;
  weekly_plan?: Array<{ week: number; tasks: string[] }>;
  tech_stack?: string[];
  solution_type?: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  language: string | null;
  stargazers_count: number;
  open_issues_count: number;
}

interface ProjectProgress {
  open: number;
  closed: number;
  total: number;
  percentage: number;
}

// Solution type configurations
const solutionConfig: Record<string, { icon: React.ReactNode; gradient: string; label: string }> = {
  web_app: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    gradient: 'from-blue-500 to-cyan-500',
    label: 'Веб-приложение'
  },
  automation: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    gradient: 'from-yellow-500 to-orange-500',
    label: 'Автоматизация'
  },
  bot: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    gradient: 'from-purple-500 to-pink-500',
    label: 'AI Бот'
  },
  landing: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
    gradient: 'from-green-500 to-emerald-500',
    label: 'Лендинг'
  },
  api_service: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    gradient: 'from-indigo-500 to-violet-500',
    label: 'API Сервис'
  },
  default: {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    gradient: 'from-indigo-500 to-purple-500',
    label: 'Проект'
  }
};

// Language color mapping
const languageColors: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-500',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  Rust: 'bg-orange-500',
  Java: 'bg-red-500',
  default: 'bg-zinc-500'
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'all' | 'github'>('all');
  const [projectProgress, setProjectProgress] = useState<Record<string, ProjectProgress>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { authenticated, login } = useGitHubAuth();

  useEffect(() => {
    loadProjects();
    if (authenticated) {
      loadGitHubRepos();
    }
  }, [authenticated]);

  const loadProjects = () => {
    try {
      const stored = localStorage.getItem('trendhunter_projects');
      if (stored) {
        setProjects(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGitHubRepos = async () => {
    try {
      const response = await fetch('/api/github/repos');
      const data = await response.json();
      if (data.success && data.repos) {
        const recentRepos = data.repos.filter((repo: GitHubRepo) => {
          const createdAt = new Date(repo.created_at);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return createdAt > thirtyDaysAgo;
        });
        setGithubRepos(recentRepos);
      }
    } catch (error) {
      console.error('Error loading GitHub repos:', error);
    }
  };

  const loadProjectProgress = async (repoUrl: string, projectId: string) => {
    try {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) return;

      const [, owner, repo] = match;
      const response = await fetch(`/api/github/issues?owner=${owner}&repo=${repo}&state=all`);
      const data = await response.json();

      if (data.success && data.issues) {
        const issues = data.issues;
        const open = issues.filter((i: { state: string }) => i.state === 'open').length;
        const closed = issues.filter((i: { state: string }) => i.state === 'closed').length;
        const total = issues.length;
        const percentage = total > 0 ? Math.round((closed / total) * 100) : 0;

        setProjectProgress(prev => ({
          ...prev,
          [projectId]: { open, closed, total, percentage }
        }));
      }
    } catch (error) {
      console.error('Error loading project progress:', error);
    }
  };

  useEffect(() => {
    if (authenticated && projects.length > 0) {
      projects.forEach(project => {
        if (project.repo_url) {
          loadProjectProgress(project.repo_url, project.id);
        }
      });
    }
  }, [authenticated, projects]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getProgressForProject = (project: Project) => {
    if (projectProgress[project.id]) {
      const progress = projectProgress[project.id];
      return { completed: progress.closed, total: progress.total, percentage: progress.percentage };
    }

    if (!project.weekly_plan) return { completed: 0, total: 0, percentage: 0 };

    const total = project.weekly_plan.reduce((acc, week) => acc + week.tasks.length, 0);
    return { completed: 0, total, percentage: 0 };
  };

  const getSolutionConfig = (solutionType?: string) => {
    return solutionConfig[solutionType || ''] || solutionConfig.default;
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Skeleton loader component
  const ProjectSkeleton = () => (
    <div className="trend-card animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-zinc-800 rounded-xl" />
        <div className="flex-1">
          <div className="h-6 bg-zinc-800 rounded w-1/3 mb-2" />
          <div className="h-4 bg-zinc-800 rounded w-1/4" />
        </div>
      </div>
      <div className="mt-4 h-4 bg-zinc-800 rounded w-full" />
      <div className="mt-2 h-4 bg-zinc-800 rounded w-2/3" />
      <div className="mt-4 flex gap-2">
        <div className="h-6 bg-zinc-800 rounded w-16" />
        <div className="h-6 bg-zinc-800 rounded w-16" />
        <div className="h-6 bg-zinc-800 rounded w-16" />
      </div>
      <div className="mt-6 pt-4 border-t border-zinc-800">
        <div className="h-2 bg-zinc-800 rounded-full w-full" />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />

      <div className="lg:ml-64 min-h-screen">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 glass border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)]">Мои проекты</h1>
                <p className="text-sm text-[var(--text-muted)] mt-1">
                  {projects.length > 0 ? `${projects.length} проектов создано` : 'Управляйте вашими проектами'}
                </p>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2 bg-[var(--bg-secondary)] rounded-xl p-1">
                <button
                  onClick={() => setActiveView('all')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeView === 'all'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  Все проекты
                </button>
                <button
                  onClick={() => setActiveView('github')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeView === 'github'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {loading ? (
            <div className="space-y-4">
              <ProjectSkeleton />
              <ProjectSkeleton />
              <ProjectSkeleton />
            </div>
          ) : !authenticated ? (
            /* GitHub Auth Required */
            <div className="flex flex-col items-center justify-center py-20">
              <div className="relative mb-8">
                <div className="w-24 h-24 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center">
                  <svg className="w-12 h-12 text-zinc-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Подключите GitHub</h3>
              <p className="text-[var(--text-secondary)] text-center max-w-md mb-8">
                Войдите через GitHub для синхронизации проектов, отслеживания прогресса и управления репозиториями
              </p>

              <button
                onClick={login}
                className="group flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-zinc-700 hover:to-zinc-800 border border-zinc-700 rounded-xl text-white font-medium transition-all hover:scale-105 hover:shadow-xl"
              >
                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                Войти через GitHub
              </button>

              {/* Features */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12 max-w-3xl">
                <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
                  <div className="w-10 h-10 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <h4 className="font-medium text-[var(--text-primary)] mb-1">Синхронизация</h4>
                  <p className="text-sm text-[var(--text-muted)]">Автоматическая синхронизация с GitHub репозиториями</p>
                </div>
                <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="font-medium text-[var(--text-primary)] mb-1">Прогресс</h4>
                  <p className="text-sm text-[var(--text-muted)]">Отслеживание прогресса через GitHub Issues</p>
                </div>
                <div className="p-4 bg-[var(--bg-card)] rounded-xl border border-[var(--border-color)]">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center mb-3">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h4 className="font-medium text-[var(--text-primary)] mb-1">Автоматизация</h4>
                  <p className="text-sm text-[var(--text-muted)]">Автоматическое создание репозиториев</p>
                </div>
              </div>
            </div>
          ) : activeView === 'github' ? (
            /* GitHub Repos View */
            <div>
              {githubRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="w-20 h-20 bg-[var(--bg-card)] rounded-2xl flex items-center justify-center mb-6">
                    <svg className="w-10 h-10 text-[var(--text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Нет недавних репозиториев</h3>
                  <p className="text-[var(--text-secondary)] text-center max-w-md">
                    Создайте проект из тренда в разделе Избранное, и репозиторий появится здесь
                  </p>
                  <Link
                    href="/favorites"
                    className="mt-6 btn-primary"
                  >
                    Перейти к избранному
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
                  {githubRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="trend-card group"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center">
                            <svg className="w-5 h-5 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-indigo-400 transition-colors">
                              {repo.name}
                            </h3>
                            <p className="text-xs text-[var(--text-muted)]">
                              {formatDate(repo.created_at)}
                            </p>
                          </div>
                        </div>
                        {repo.language && (
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2.5 h-2.5 rounded-full ${languageColors[repo.language] || languageColors.default}`} />
                            <span className="text-xs text-[var(--text-secondary)]">{repo.language}</span>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-4">
                        {repo.description || 'Нет описания'}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] mb-4">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                          {repo.stargazers_count}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {repo.open_issues_count} issues
                        </span>
                      </div>

                      <div className="flex gap-2">
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] font-medium transition-all hover:border-indigo-500/50"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Открыть
                        </a>
                        <button
                          onClick={() => copyToClipboard(`git clone ${repo.clone_url}`, `repo-${repo.id}`)}
                          className="flex items-center justify-center w-10 h-10 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] transition-all hover:border-indigo-500/50"
                          title="Копировать команду clone"
                        >
                          {copiedId === `repo-${repo.id}` ? (
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* All Projects View */
            <div>
              {projects.length === 0 && githubRepos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative mb-8">
                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center">
                      <svg className="w-12 h-12 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center animate-bounce">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                  </div>

                  <h3 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Начните создавать</h3>
                  <p className="text-[var(--text-secondary)] text-center max-w-md mb-8">
                    Добавьте тренды в Избранное, проанализируйте их с помощью AI, и создайте свой первый проект
                  </p>

                  <div className="flex gap-3">
                    <Link href="/" className="btn-secondary">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                      Смотреть тренды
                    </Link>
                    <Link href="/favorites" className="btn-primary">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                      Перейти к избранному
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 stagger-children">
                  {/* Show saved projects from localStorage */}
                  {projects.map((project) => {
                    const progress = getProgressForProject(project);
                    const config = getSolutionConfig(project.solution_type);

                    return (
                      <div
                        key={project.id}
                        className="trend-card group"
                      >
                        <div className="flex items-start gap-5">
                          {/* Solution Type Icon */}
                          <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${config.gradient} p-0.5 flex-shrink-0`}>
                            <div className="w-full h-full bg-[var(--bg-card)] rounded-[10px] flex items-center justify-center text-white">
                              {config.icon}
                            </div>
                          </div>

                          {/* Project Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-lg text-[var(--text-primary)] group-hover:text-indigo-400 transition-colors truncate">
                                {project.name}
                              </h3>
                              <span className={`text-xs px-2 py-0.5 rounded-full bg-gradient-to-r ${config.gradient} text-white`}>
                                {config.label}
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-2">
                              {project.trend_title} &bull; {formatDate(project.created_at)}
                            </p>
                            <p className="text-[var(--text-secondary)] line-clamp-2">
                              {project.description}
                            </p>

                            {/* Tech Stack */}
                            {project.tech_stack && project.tech_stack.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {project.tech_stack.slice(0, 6).map((tech, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs px-2.5 py-1 bg-[var(--bg-secondary)] text-[var(--text-secondary)] rounded-lg border border-[var(--border-color)]"
                                  >
                                    {tech}
                                  </span>
                                ))}
                                {project.tech_stack.length > 6 && (
                                  <span className="text-xs px-2.5 py-1 text-[var(--text-muted)]">
                                    +{project.tech_stack.length - 6}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 flex-shrink-0">
                            <Link
                              href={`/project/${project.trend_id}`}
                              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm text-white font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              Открыть
                            </Link>
                            {project.repo_url && (
                              <a
                                href={project.repo_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center w-10 h-10 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] transition-all hover:border-indigo-500/50"
                                title="Открыть на GitHub"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                </svg>
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="mt-6 pt-4 border-t border-[var(--border-color)]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-[var(--text-muted)]">Прогресс разработки</span>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[var(--text-primary)]">
                                {progress.completed}/{progress.total}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${
                                progress.percentage >= 75 ? 'bg-green-500/20 text-green-400' :
                                progress.percentage >= 50 ? 'bg-yellow-500/20 text-yellow-400' :
                                progress.percentage >= 25 ? 'bg-orange-500/20 text-orange-400' :
                                'bg-zinc-500/20 text-zinc-400'
                              }`}>
                                {progress.percentage}%
                              </span>
                            </div>
                          </div>
                          <div className="progress-bar">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${progress.percentage}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Show GitHub repos as project cards (not linked to saved projects) */}
                  {githubRepos.map((repo) => {
                    const isLinkedProject = projects.some(p => p.repo_url === repo.html_url);
                    if (isLinkedProject) return null;

                    return (
                      <div
                        key={repo.id}
                        className="trend-card group"
                      >
                        <div className="flex items-start gap-5">
                          <div className="w-14 h-14 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            <svg className="w-7 h-7 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-lg text-[var(--text-primary)] group-hover:text-indigo-400 transition-colors truncate">
                                {repo.name}
                              </h3>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">
                                GitHub
                              </span>
                            </div>
                            <p className="text-sm text-[var(--text-muted)] mb-2">
                              {formatDate(repo.created_at)}
                            </p>
                            <p className="text-[var(--text-secondary)] line-clamp-2">
                              {repo.description || 'Нет описания'}
                            </p>
                          </div>

                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-5 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-primary)] font-medium transition-all hover:border-indigo-500/50 flex-shrink-0"
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                            </svg>
                            GitHub
                          </a>
                        </div>

                        {/* Quick stats */}
                        <div className="mt-4 pt-4 border-t border-[var(--border-color)] flex items-center gap-4">
                          {repo.language && (
                            <div className="flex items-center gap-1.5">
                              <span className={`w-2.5 h-2.5 rounded-full ${languageColors[repo.language] || languageColors.default}`} />
                              <span className="text-sm text-[var(--text-secondary)]">{repo.language}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                            {repo.stargazers_count}
                          </div>
                          <div className="flex items-center gap-1.5 text-sm text-[var(--text-muted)]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {repo.open_issues_count} issues
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
