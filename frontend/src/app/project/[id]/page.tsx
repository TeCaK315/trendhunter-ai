'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';
import { getItem, setItem, removeItem } from '@/lib/storage';

// Interface for tracking which quick actions have responses
interface QuickActionResponse {
  actionKey: string;  // Format: "agentType-actionIndex"
  messageIndex: number;
}

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

// Deep Analysis types (from multi-agent system)
interface DeepAnalysisPainPoint {
  pain: string;
  confidence: number;
  arguments_for: string[];
  arguments_against: string[];
  verdict: string;
}

interface DeepAnalysisSegment {
  name: string;
  size: string;
  willingness_to_pay: string;
  where_to_find: string;
  confidence: number;
}

interface DeepAnalysisMetadata {
  optimist_summary: string;
  skeptic_summary: string;
  consensus_reached: boolean;
  analysis_depth: 'deep';
}

interface DeepAnalysisResult {
  main_pain: string;
  confidence: number;
  key_pain_points: DeepAnalysisPainPoint[];
  target_audience: {
    segments: DeepAnalysisSegment[];
  };
  risks: string[];
  opportunities: string[];
  final_recommendation: string;
  analysis_metadata: DeepAnalysisMetadata;
}

interface TrendAnalysis {
  trend_id: string;
  main_pain: string;
  key_pain_points: string[];
  target_audience: {
    segments: Array<{
      name: string;
      size: string;
      willingness_to_pay: string;
      where_to_find: string;
      confidence?: number;
    }>;
  };
  real_sources?: {
    youtube?: {
      videos: Array<{ title: string; channel: string; url: string; publishedAt?: string }>;
      channels?: string[];
    };
    reddit?: {
      posts: Array<{ title: string; url: string; subreddit?: string; score?: number; num_comments?: number }>;
      communities?: string[];
      engagement?: number;
    };
    google_trends?: {
      growth_rate?: number;
      related_queries?: Array<{ query: string; growth: string; link?: string }>;
      interest_timeline?: Array<{ date: string; value: number }>;
      search_query?: string;
      is_mock_data?: boolean;
      google_trends_url?: string;
      fetched_at?: string;
      simplified_from?: string; // Original query if simplified
    };
  };
  sources_analysis?: {
    reddit?: { sentiment?: string; key_discussions?: string[]; top_subreddits?: string[] };
    youtube?: { content_type?: string; top_channels?: string[] };
    google_trends?: { trend_direction?: string; related_topics?: string[] };
  };
  market_signals?: string[];
  analyzed_at?: string;
  analysis_type?: 'basic' | 'deep';
  deep_analysis?: DeepAnalysisResult;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agent?: AgentType;
}

type AgentType = 'general' | 'developer' | 'marketing' | 'sales' | 'designer';

interface Agent {
  id: AgentType;
  name: string;
  icon: string;
  color: string;
  description: string;
  role?: string;
  expertise?: string[];
  recommended_tasks?: string[];
  system_prompt?: string;
}

const DEFAULT_AGENTS: Agent[] = [
  { id: 'general', name: 'Ассистент', icon: '🤖', color: 'indigo', description: 'Общие вопросы и планирование' },
  { id: 'developer', name: 'Developer', icon: '👨‍💻', color: 'green', description: 'Код, архитектура, tech stack' },
  { id: 'marketing', name: 'Marketing', icon: '📣', color: 'pink', description: 'Маркетинг и привлечение' },
  { id: 'sales', name: 'Sales', icon: '💰', color: 'yellow', description: 'Продажи и монетизация' },
  { id: 'designer', name: 'Designer', icon: '🎨', color: 'purple', description: 'UX/UI и дизайн' },
];

const categoryIcons: Record<string, string> = {
  'SaaS': '💻',
  'E-commerce': '🛒',
  'Mobile Apps': '📱',
  'EdTech': '🎓',
  'HealthTech': '💚',
  'AI/ML': '🤖',
  'AI & ML': '🤖',
  'FinTech': '💰',
  'Technology': '⚙️',
  'Business': '📊',
  'Healthcare': '🏥',
  'Finance': '💵',
  'Education': '📚',
};

// Быстрые действия для каждого эксперта
const AGENT_QUICK_ACTIONS: Record<AgentType, Array<{ icon: string; label: string; prompt: string }>> = {
  general: [
    { icon: '🚀', label: 'MVP план', prompt: 'Создай детальный план MVP для этого проекта. Включи: основные функции, tech stack, этапы разработки.' },
    { icon: '💡', label: 'Идеи фич', prompt: 'Предложи 10 уникальных функций для этого продукта, которые решат боли целевой аудитории.' },
    { icon: '🎯', label: 'SWOT анализ', prompt: 'Проведи SWOT анализ для этого проекта: сильные/слабые стороны, возможности и угрозы.' },
    { icon: '📋', label: 'Roadmap', prompt: 'Создай roadmap продукта на 6 месяцев с ключевыми milestone и приоритетами.' },
    { icon: '🏆', label: 'Конкуренты', prompt: 'Проанализируй основных конкурентов и определи наше конкурентное преимущество.' },
    { icon: '📝', label: 'User Stories', prompt: 'Напиши 10 user stories для MVP в формате: "Как [роль], я хочу [действие], чтобы [результат]".' },
  ],
  developer: [
    { icon: '🏗️', label: 'Архитектура', prompt: 'Спроектируй техническую архитектуру: frontend, backend, база данных, API, интеграции. Учти масштабируемость.' },
    { icon: '⚙️', label: 'Tech Stack', prompt: 'Подбери оптимальный tech stack для MVP с учётом бюджета $0-100/мес. Обоснуй каждый выбор.' },
    { icon: '📁', label: 'Структура проекта', prompt: 'Создай структуру папок и файлов для проекта. Покажи дерево директорий с пояснениями.' },
    { icon: '🗄️', label: 'База данных', prompt: 'Спроектируй схему базы данных: таблицы, связи, индексы. Напиши SQL миграции.' },
    { icon: '🔌', label: 'API endpoints', prompt: 'Спроектируй REST API: endpoints, методы, параметры, ответы. Создай OpenAPI спецификацию.' },
    { icon: '🚀', label: 'Deploy план', prompt: 'Создай план деплоя: CI/CD pipeline, хостинг, мониторинг, логирование. Укажи конкретные сервисы.' },
  ],
  marketing: [
    { icon: '📊', label: 'GTM стратегия', prompt: 'Создай Go-to-Market стратегию: позиционирование, каналы, messaging, timeline запуска.' },
    { icon: '🎯', label: 'Целевая аудитория', prompt: 'Детализируй ICP (Ideal Customer Profile): демография, поведение, боли, где их найти.' },
    { icon: '📱', label: 'Контент-план', prompt: 'Создай контент-план на месяц: темы постов, форматы, каналы, частота публикаций.' },
    { icon: '🚀', label: 'Product Hunt', prompt: 'Подготовь план запуска на Product Hunt: tagline, описание, скриншоты, hunting strategy.' },
    { icon: '✉️', label: 'Email воронка', prompt: 'Создай email-воронку: welcome серия, onboarding, retention. Напиши тексты писем.' },
    { icon: '📈', label: 'Growth hacks', prompt: 'Предложи 10 growth hacks для быстрого роста с минимальным бюджетом.' },
  ],
  sales: [
    { icon: '💰', label: 'Pricing', prompt: 'Разработай модель ценообразования: тарифы, features по планам, цены. Обоснуй каждую цифру.' },
    { icon: '📞', label: 'Sales скрипт', prompt: 'Напиши скрипт продаж: discovery questions, презентация value, работа с возражениями, закрытие.' },
    { icon: '🎯', label: 'ICP анализ', prompt: 'Определи Ideal Customer Profile для B2B: размер компании, индустрия, должность ЛПР, бюджет.' },
    { icon: '📧', label: 'Cold outreach', prompt: 'Создай шаблоны cold email и LinkedIn сообщений для outbound. 5 вариантов с персонализацией.' },
    { icon: '📊', label: 'Sales воронка', prompt: 'Спроектируй sales funnel: этапы, конверсии, actions на каждом этапе, инструменты.' },
    { icon: '🤝', label: 'Партнёрства', prompt: 'Предложи стратегию партнёрств: типы партнёров, value proposition, revenue share модели.' },
  ],
  designer: [
    { icon: '🎨', label: 'UI концепция', prompt: 'Опиши UI концепцию: стиль, цветовая палитра, типографика, ключевые компоненты. Ссылки на референсы.' },
    { icon: '🔄', label: 'User Flow', prompt: 'Создай user flow для основных сценариев: регистрация, onboarding, core action, retention loop.' },
    { icon: '📱', label: 'Wireframes', prompt: 'Опиши wireframes для ключевых экранов: структура, элементы, взаимодействия. Текстовое описание.' },
    { icon: '✨', label: 'Микро-анимации', prompt: 'Предложи микро-анимации для улучшения UX: loading states, transitions, feedback, celebrations.' },
    { icon: '🎯', label: 'UX аудит', prompt: 'Проведи UX аудит концепции: потенциальные проблемы, friction points, рекомендации по улучшению.' },
    { icon: '📐', label: 'Design System', prompt: 'Спроектируй основу design system: токены, компоненты, spacing, иконки, состояния.' },
  ],
};

// GitHub Issue interface
interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  html_url: string;
  labels: Array<{ name: string; color: string }>;
  created_at: string;
}

// Tasks Tab Component
function TasksTab({
  projectCreated,
  githubAuthenticated,
  githubLogin,
  trendTitle,
}: {
  projectCreated: { repo_url: string; clone_url: string } | null;
  githubAuthenticated: boolean;
  githubLogin: () => void;
  trendTitle: string;
}) {
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskBody, setNewTaskBody] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Extract repo info from URL
  const getRepoInfo = () => {
    if (!projectCreated?.repo_url) return null;
    const match = projectCreated.repo_url.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (match) {
      return { owner: match[1], repo: match[2] };
    }
    return null;
  };

  const repoInfo = getRepoInfo();

  // Load issues when component mounts
  useEffect(() => {
    if (repoInfo && githubAuthenticated) {
      loadIssues();
    }
  }, [repoInfo?.owner, repoInfo?.repo, githubAuthenticated]);

  const loadIssues = async () => {
    if (!repoInfo) return;
    setLoadingIssues(true);
    try {
      const response = await fetch(
        `/api/github/issues?owner=${repoInfo.owner}&repo=${repoInfo.repo}&state=all`
      );
      const data = await response.json();
      if (data.success) {
        setIssues(data.issues);
      }
    } catch (error) {
      console.error('Error loading issues:', error);
    } finally {
      setLoadingIssues(false);
    }
  };

  const createIssue = async () => {
    if (!repoInfo || !newTaskTitle.trim()) return;
    setIsCreating(true);
    try {
      const response = await fetch('/api/github/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_owner: repoInfo.owner,
          repo_name: repoInfo.repo,
          title: newTaskTitle,
          body: newTaskBody,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setNewTaskTitle('');
        setNewTaskBody('');
        setShowCreateForm(false);
        loadIssues();
      }
    } catch (error) {
      console.error('Error creating issue:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const toggleIssueState = async (issueNumber: number, currentState: string) => {
    if (!repoInfo) return;
    const newState = currentState === 'open' ? 'closed' : 'open';
    try {
      const response = await fetch('/api/github/issues', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_owner: repoInfo.owner,
          repo_name: repoInfo.repo,
          issue_number: issueNumber,
          state: newState,
        }),
      });
      const data = await response.json();
      if (data.success) {
        loadIssues();
      }
    } catch (error) {
      console.error('Error updating issue:', error);
    }
  };

  // Extract week number from issue title like "[Неделя 1] Task name"
  const getWeekNumber = (title: string): number => {
    const match = title.match(/\[Неделя\s*(\d+)\]/i);
    return match ? parseInt(match[1], 10) : 999; // Non-week tasks go to the end
  };

  // Sort issues by week number (ascending: week 1 first)
  const sortByWeek = (a: GitHubIssue, b: GitHubIssue) => {
    const weekA = getWeekNumber(a.title);
    const weekB = getWeekNumber(b.title);
    if (weekA !== weekB) return weekA - weekB;
    // If same week, sort by issue number (ascending)
    return a.number - b.number;
  };

  const openIssues = issues.filter(i => i.state === 'open').sort(sortByWeek);
  const closedIssues = issues.filter(i => i.state === 'closed').sort(sortByWeek);
  const progress = issues.length > 0 ? Math.round((closedIssues.length / issues.length) * 100) : 0;

  if (!githubAuthenticated) {
    return (
      <div className="text-center py-16 animate-fadeIn">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-card)] rounded-2xl flex items-center justify-center border border-[var(--border-color)]">
          <svg className="w-10 h-10 text-[var(--text-muted)]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Войдите через GitHub</h3>
        <p className="text-[var(--text-muted)] mb-6">Для работы с задачами необходима авторизация</p>
        <button
          onClick={githubLogin}
          className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:border-[var(--border-light)] rounded-xl text-[var(--text-primary)] font-medium transition-all"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
          </svg>
          Войти через GitHub
        </button>
      </div>
    );
  }

  if (!projectCreated) {
    return (
      <div className="text-center py-16 animate-fadeIn">
        <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-4xl">
          📋
        </div>
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Проект не создан</h3>
        <p className="text-[var(--text-muted)]">Сначала создайте проект на GitHub, чтобы управлять задачами</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Progress Header */}
      <div className="trend-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Прогресс проекта</h3>
            <p className="text-sm text-[var(--text-muted)]">{trendTitle}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{progress}%</div>
            <div className="text-sm text-[var(--text-muted)]">{closedIssues.length} из {issues.length} задач</div>
          </div>
        </div>
        <div className="h-3 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--text-secondary)]">
            {openIssues.length} открытых · {closedIssues.length} завершённых
          </span>
        </div>
        <div className="flex gap-2">
          <a
            href={projectCreated.repo_url + '/issues'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:border-[var(--border-light)] rounded-xl text-sm text-[var(--text-secondary)] transition-all"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            GitHub Issues
          </a>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm text-white font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
          >
            ➕ Добавить задачу
          </button>
        </div>
      </div>

      {/* Create Issue Form */}
      {showCreateForm && (
        <div className="trend-card animate-fadeIn">
          <h4 className="text-sm font-medium text-[var(--text-primary)] mb-3">Новая задача</h4>
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="Название задачи"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] mb-3 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
          />
          <textarea
            value={newTaskBody}
            onChange={(e) => setNewTaskBody(e.target.value)}
            placeholder="Описание (опционально)"
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-2.5 text-[var(--text-primary)] placeholder-[var(--text-muted)] mb-3 resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-secondary)] transition-all"
            >
              Отмена
            </button>
            <button
              onClick={createIssue}
              disabled={!newTaskTitle.trim() || isCreating}
              className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-sm text-white font-medium transition-all"
            >
              {isCreating ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </div>
      )}

      {/* Issues List */}
      {loadingIssues ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-2 border-[var(--border-color)] border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[var(--text-muted)] text-sm">Загрузка задач...</p>
        </div>
      ) : issues.length === 0 ? (
        <div className="text-center py-12 trend-card">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-3xl">
            📝
          </div>
          <p className="text-[var(--text-secondary)]">Пока нет задач</p>
          <p className="text-[var(--text-muted)] text-sm mt-2">Создайте первую задачу или используйте AI-чат для генерации плана</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Open Issues */}
          {openIssues.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs">📋</span>
                Открытые ({openIssues.length})
              </h4>
              <div className="space-y-2">
                {openIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="trend-card hover:border-indigo-500/30 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleIssueState(issue.number, issue.state)}
                        className="mt-1 w-5 h-5 rounded-md border-2 border-[var(--border-light)] hover:border-green-500 hover:bg-green-500/10 transition-all flex-shrink-0"
                        title="Отметить как выполненное"
                      />
                      <div className="flex-1 min-w-0">
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--text-primary)] hover:text-indigo-400 font-medium transition-colors"
                        >
                          {issue.title}
                        </a>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-[var(--text-muted)]">#{issue.number}</span>
                          {issue.labels.map((label) => (
                            <span
                              key={label.name}
                              className="text-xs px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
                            >
                              {label.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Closed Issues */}
          {closedIssues.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-[var(--text-secondary)] mb-3 mt-6 flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-xs">✅</span>
                Завершённые ({closedIssues.length})
              </h4>
              <div className="space-y-2">
                {closedIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="trend-card opacity-60 hover:opacity-80 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleIssueState(issue.number, issue.state)}
                        className="mt-1 w-5 h-5 rounded-md bg-green-600 flex items-center justify-center flex-shrink-0 hover:bg-green-500 transition-colors"
                        title="Переоткрыть"
                      >
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <div className="flex-1 min-w-0">
                        <a
                          href={issue.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--text-secondary)] hover:text-indigo-400 font-medium line-through transition-colors"
                        >
                          {issue.title}
                        </a>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-[var(--text-muted)]">#{issue.number}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [trend, setTrend] = useState<Trend | null>(null);
  const [analysis, setAnalysis] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'analysis' | 'tasks'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [usedQuickActions, setUsedQuickActions] = useState<QuickActionResponse[]>([]);
  const [isAtTop, setIsAtTop] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [creatingElapsed, setCreatingElapsed] = useState(0);
  const [projectCreated, setProjectCreated] = useState<{ repo_url: string; clone_url: string } | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('general');
  const { authenticated: githubAuthenticated, user: githubUser, login: githubLogin } = useGitHubAuth();

  // Companies state
  const [companies, setCompanies] = useState<Array<{
    name: string;
    website: string;
    email: string;
    email_pattern?: string;
    industry: string;
    size: string;
    location: string;
    relevance_score: number;
    pain_match: string;
    outreach_angle: string;
    linkedin_search_query?: string;
  }> | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Email generation state
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedCompanyForEmail, setSelectedCompanyForEmail] = useState<{
    name: string;
    website: string;
    email: string;
    email_pattern?: string;
    industry: string;
    size: string;
    location: string;
    relevance_score: number;
    pain_match: string;
    outreach_angle: string;
    linkedin_search_query?: string;
  } | null>(null);
  const [generatedEmail, setGeneratedEmail] = useState<{
    subject: string;
    body: string;
    follow_up_subject?: string;
    follow_up_body?: string;
    tips?: string[];
  } | null>(null);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailSenderCompany, setEmailSenderCompany] = useState('');
  const [emailTone, setEmailTone] = useState<'formal' | 'friendly' | 'professional'>('professional');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Improvements plan state
  const [improvementsPlan, setImprovementsPlan] = useState<{
    product_vision?: {
      one_liner: string;
      value_proposition: string;
      success_metrics: string[];
    };
    functionality_improvements?: Array<{
      title: string;
      description: string;
      priority: string;
      complexity: string;
      user_story: string;
      acceptance_criteria: string[];
      claude_prompt: string;
    }>;
    ux_improvements?: Array<{
      title: string;
      current_problem: string;
      proposed_solution: string;
      impact: string;
      claude_prompt: string;
    }>;
    ai_agent_prompts?: Record<string, {
      name: string;
      description: string;
      system_prompt: string;
      example_interactions: string[];
    }>;
    quick_wins?: Array<{
      title: string;
      time_estimate: string;
      impact: string;
      claude_prompt: string;
    }>;
    full_implementation_prompt?: string;
  } | null>(null);
  const [loadingImprovements, setLoadingImprovements] = useState(false);
  const [showImprovementsModal, setShowImprovementsModal] = useState(false);

  // Deep analysis state
  const [isRunningDeepAnalysis, setIsRunningDeepAnalysis] = useState(false);
  const [isRefreshingSources, setIsRefreshingSources] = useState(false);

  useEffect(() => {
    loadTrend();
    loadAnalysis();
    loadChatHistory();
    loadProjectData();
  }, [projectId]);

  // Load existing project data from localStorage
  const loadProjectData = () => {
    try {
      const projects = getItem<Array<{ trend_id: string; repo_url?: string; clone_url?: string }>>('trendhunter_projects');
      if (projects) {
        const found = projects.find((p) => p.trend_id === projectId);
        if (found && found.repo_url) {
          setProjectCreated({
            repo_url: found.repo_url,
            clone_url: found.clone_url || found.repo_url.replace('github.com', 'github.com') + '.git',
          });
        }
      }
    } catch (error) {
      console.error('Error loading project data:', error);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Track scroll position for up/down button
  useEffect(() => {
    const handleScroll = () => {
      setIsAtTop(window.scrollY < 200);
    };
    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Save chat history and used quick actions to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0 && projectId) {
      const chatKey = `trendhunter_chat_${projectId}`;
      setItem(chatKey, messages);
    }
  }, [messages, projectId]);

  // Timer for project creation elapsed time
  useEffect(() => {
    if (!isCreatingProject) {
      setCreatingElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setCreatingElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isCreatingProject]);

  // Save used quick actions to localStorage
  useEffect(() => {
    if (projectId) {
      const quickActionsKey = `trendhunter_quickactions_${projectId}`;
      setItem(quickActionsKey, usedQuickActions);
    }
  }, [usedQuickActions, projectId]);

  const loadChatHistory = () => {
    try {
      // Load chat messages
      const chatKey = `trendhunter_chat_${projectId}`;
      const savedChat = getItem<ChatMessage[]>(chatKey);
      if (savedChat) {
        // Convert timestamp strings back to Date objects
        const messagesWithDates = savedChat.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(messagesWithDates);
      }

      // Load used quick actions
      const quickActionsKey = `trendhunter_quickactions_${projectId}`;
      const savedQuickActions = getItem<QuickActionResponse[]>(quickActionsKey);
      if (savedQuickActions) {
        setUsedQuickActions(savedQuickActions);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const clearChatHistory = () => {
    const chatKey = `trendhunter_chat_${projectId}`;
    const quickActionsKey = `trendhunter_quickactions_${projectId}`;
    removeItem(chatKey);
    removeItem(quickActionsKey);
    setMessages([]);
    setUsedQuickActions([]);
  };

  const loadTrend = () => {
    try {
      const favorites = getItem<Trend[]>('trendhunter_favorites_data');
      if (favorites) {
        const found = favorites.find(t => t.id === projectId);
        if (found) {
          setTrend(found);
        }
      }
    } catch (error) {
      console.error('Error loading trend:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysis = async () => {
    try {
      const response = await fetch(`/api/trends/analyze?trend_id=${projectId}`);
      const data = await response.json();
      if (data.found && data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch (error) {
      console.error('Error loading analysis:', error);
    }
  };

  // Run deep analysis with source collection
  const runDeepAnalysis = async () => {
    if (!trend || isRunningDeepAnalysis) return;

    setIsRunningDeepAnalysis(true);
    try {
      // Step 1: Collect real data from sources (Reddit, YouTube, Google Trends) in parallel with AI analysis
      const [sourcesResponse, analysisResponse] = await Promise.all([
        fetch('/api/collect-sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trend_title: trend.title }),
        }),
        fetch('/api/deep-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trend_title: trend.title,
            trend_category: trend.category,
            why_trending: trend.why_trending,
          }),
        }),
      ]);

      // Parse sources data
      let realSources = {
        reddit: { posts: [], communities: [], engagement: 0 },
        youtube: { videos: [], channels: [] },
        google_trends: { growth_rate: trend.growth_rate || 0, related_queries: [], interest_timeline: [] },
        facebook: { pages: [], reach: 0 },
      };

      if (sourcesResponse.ok) {
        const sourcesResult = await sourcesResponse.json();
        if (sourcesResult.success && sourcesResult.sources) {
          realSources = sourcesResult.sources;
        }
      }

      // Parse AI analysis
      if (analysisResponse.ok) {
        const analysisResult = await analysisResponse.json();

        if (analysisResult.success && analysisResult.analysis) {
          const deepAnalysis = analysisResult.analysis;

          // Save to analysis storage with both AI analysis and real sources
          await fetch('/api/trends/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trend_id: trend.id,
              trend_title: trend.title,
              main_pain: deepAnalysis.main_pain,
              key_pain_points: deepAnalysis.key_pain_points.map((p: { pain: string }) => p.pain),
              target_audience: deepAnalysis.target_audience,
              sentiment_score: deepAnalysis.confidence / 10,
              real_sources: realSources,
              status: 'analyzed',
              analyzed_at: new Date().toISOString(),
              deep_analysis: deepAnalysis,
              analysis_type: 'deep',
            }),
          });

          // Reload analysis to show updated data
          await loadAnalysis();
        }
      }
    } catch (error) {
      console.error('Error running deep analysis:', error);
    } finally {
      setIsRunningDeepAnalysis(false);
    }
  };

  // Refresh only the sources data (Google Trends, Reddit, YouTube)
  const refreshSources = async () => {
    if (!trend || !analysis || isRefreshingSources) return;

    setIsRefreshingSources(true);
    try {
      const sourcesResponse = await fetch('/api/collect-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trend_title: trend.title }),
      });

      if (sourcesResponse.ok) {
        const sourcesResult = await sourcesResponse.json();
        if (sourcesResult.success && sourcesResult.sources) {
          // Update analysis with new sources data
          await fetch('/api/trends/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ...analysis,
              real_sources: sourcesResult.sources,
              analyzed_at: new Date().toISOString(),
            }),
          });

          // Reload analysis to show updated data
          await loadAnalysis();
        }
      }
    } catch (error) {
      console.error('Error refreshing sources:', error);
    } finally {
      setIsRefreshingSources(false);
    }
  };

  // Find potential companies
  const findCompanies = async () => {
    if (!trend || !analysis) return;

    setLoadingCompanies(true);
    try {
      const response = await fetch('/api/find-companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: trend.title,
          painPoint: analysis.main_pain,
          count: 10
        })
      });

      const data = await response.json();
      if (data.success && data.companies) {
        setCompanies(data.companies);
      }
    } catch (error) {
      console.error('Error finding companies:', error);
    } finally {
      setLoadingCompanies(false);
    }
  };

  // Generate email for a company
  const generateEmail = async (company: typeof selectedCompanyForEmail) => {
    if (!company || !trend || !analysis) return;

    setSelectedCompanyForEmail(company);
    setEmailModalOpen(true);
    setLoadingEmail(true);
    setGeneratedEmail(null);

    try {
      const response = await fetch('/api/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company: {
            name: company.name,
            website: company.website,
            email: company.email,
            industry: company.industry,
            size: company.size,
            pain_match: company.pain_match,
            outreach_angle: company.outreach_angle
          },
          niche: trend.title,
          painPoint: analysis.main_pain,
          senderName: emailSenderName || 'Ваше имя',
          senderCompany: emailSenderCompany,
          tone: emailTone,
          language: 'ru'
        })
      });

      const data = await response.json();
      if (data.success) {
        setGeneratedEmail({
          subject: data.subject,
          body: data.body,
          follow_up_subject: data.follow_up_subject,
          follow_up_body: data.follow_up_body,
          tips: data.tips
        });
      }
    } catch (error) {
      console.error('Error generating email:', error);
    } finally {
      setLoadingEmail(false);
    }
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Generate improvements plan
  const generateImprovementsPlan = async () => {
    if (!trend || !analysis) return;

    setLoadingImprovements(true);
    setShowImprovementsModal(true);

    try {
      const response = await fetch('/api/generate-improvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_title: trend.title,
          trend_category: trend.category,
          main_pain: analysis.main_pain,
          key_pain_points: analysis.key_pain_points,
          target_audience: JSON.stringify(analysis.target_audience),
          why_trending: trend.why_trending
        })
      });

      const data = await response.json();
      if (data.success && data.improvements) {
        setImprovementsPlan(data.improvements);
      }
    } catch (error) {
      console.error('Error generating improvements:', error);
    } finally {
      setLoadingImprovements(false);
    }
  };

  const handleCreateProject = async () => {
    if (!trend || !analysis || isCreatingProject) return;

    setIsCreatingProject(true);

    try {
      const response = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trend_id: trend.id,
          trend_title: trend.title,
          trend_category: trend.category,
          why_trending: trend.why_trending,
          main_pain: analysis.main_pain,
          key_pain_points: analysis.key_pain_points,
          target_audience: JSON.stringify(analysis.target_audience),
          market_signals: analysis.market_signals || [],
        }),
      });

      const data = await response.json();

      if (data.success && data.github) {
        const projectData = {
          repo_url: data.github.repo_url,
          clone_url: data.github.clone_url,
        };
        setProjectCreated(projectData);

        // Save project to localStorage
        try {
          const storedProjects = getItem<Array<{ trend_id: string }>>('trendhunter_projects');
          const projects = storedProjects || [];

          // Check if project already exists
          const existingIndex = projects.findIndex((p) => p.trend_id === trend.id);

          const newProject = {
            id: `project-${Date.now()}`,
            name: data.github.name || trend.title,
            description: data.github.description || analysis.main_pain,
            repo_url: data.github.repo_url,
            clone_url: data.github.clone_url,
            trend_id: trend.id,
            trend_title: trend.title,
            created_at: new Date().toISOString(),
            tech_stack: data.tech_stack || [],
            solution_type: data.solution_type || 'web_app',
          };

          if (existingIndex >= 0) {
            projects[existingIndex] = { ...projects[existingIndex], ...newProject };
          } else {
            projects.push(newProject);
          }

          setItem('trendhunter_projects', projects);
        } catch (storageError) {
          console.error('Error saving project to localStorage:', storageError);
        }
      } else {
        alert('Ошибка создания проекта: ' + (data.error || 'Неизвестная ошибка'));
      }
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Ошибка создания проекта. Проверьте консоль.');
    } finally {
      setIsCreatingProject(false);
    }
  };

  const sendMessage = async (content: string, agentOverride?: AgentType) => {
    if (!content.trim() || !trend) return;

    const agent = agentOverride || selectedAgent;

    const userMessage: ChatMessage = {
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      agent: agent
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          agent_type: agent,
          trend_context: {
            title: trend.title,
            category: trend.category,
            why_trending: trend.why_trending,
            analysis: analysis ? {
              main_pain: analysis.main_pain,
              key_pain_points: analysis.key_pain_points,
              target_audience: analysis.target_audience,
              market_signals: analysis.market_signals,
              real_sources: analysis.real_sources ? {
                reddit: analysis.real_sources.reddit ? {
                  communities: analysis.real_sources.reddit.communities,
                  engagement: analysis.real_sources.reddit.engagement
                } : undefined,
                youtube: analysis.real_sources.youtube ? {
                  channels: analysis.real_sources.youtube.channels
                } : undefined,
                google_trends: analysis.real_sources.google_trends ? {
                  growth_rate: analysis.real_sources.google_trends.growth_rate,
                  related_queries: analysis.real_sources.google_trends.related_queries
                } : undefined
              } : undefined
            } : undefined
          }
        })
      });

      const data = await response.json();

      if (data.success) {
        const assistantMessage: ChatMessage = {
          role: 'assistant',
          content: data.message,
          timestamp: new Date(),
          agent: agent
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: 'Извините, произошла ошибка. Попробуйте еще раз.',
          timestamp: new Date(),
          agent: agent
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Ошибка соединения. Проверьте подключение к интернету.',
        timestamp: new Date(),
        agent: agent
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickAction = (prompt: string, actionKey: string) => {
    // Track which quick action was used and at which message index (will be the assistant response)
    const responseMessageIndex = messages.length + 1; // +1 because user message will be added first, then assistant
    setUsedQuickActions(prev => [...prev, { actionKey, messageIndex: responseMessageIndex }]);
    sendMessage(prompt);
  };

  const scrollToMessage = (messageIndex: number) => {
    const messageEl = messageRefs.current.get(messageIndex);
    if (messageEl) {
      messageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Find if a quick action has been used and get its response index
  const getQuickActionResponseIndex = (actionKey: string): number | null => {
    const found = usedQuickActions.find(ua => ua.actionKey === actionKey);
    return found ? found.messageIndex : null;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h3 key={idx} className="text-lg font-semibold text-white mt-4 mb-2">{line.slice(4)}</h3>;
      }
      if (line.startsWith('## ')) {
        return <h2 key={idx} className="text-xl font-bold text-white mt-4 mb-2">{line.slice(3)}</h2>;
      }
      if (line.startsWith('# ')) {
        return <h1 key={idx} className="text-2xl font-bold text-white mt-4 mb-2">{line.slice(2)}</h1>;
      }
      if (line.match(/^\d+\.\s/)) {
        return <li key={idx} className="text-zinc-300 ml-4 py-0.5 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return <li key={idx} className="text-zinc-300 ml-4 py-0.5 list-disc">{line.slice(2)}</li>;
      }
      if (line.startsWith('```')) {
        return null;
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2"></div>;
      }
      // Bold text
      const boldProcessed = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      return <p key={idx} className="text-zinc-300 py-0.5" dangerouslySetInnerHTML={{ __html: boldProcessed }}></p>;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-indigo-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[var(--text-muted)]">Загрузка проекта...</p>
        </div>
      </div>
    );
  }

  if (!trend) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-center">
        <div className="w-20 h-20 mb-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-4xl">
          🔍
        </div>
        <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Проект не найден</h3>
        <p className="text-[var(--text-muted)] mb-6">Возможно, он был удалён или перемещён</p>
        <Link
          href="/favorites"
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-xl text-sm font-medium text-white transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40"
        >
          Вернуться к избранному
        </Link>
      </div>
    );
  }

  const categoryIcon = categoryIcons[trend.category] || '📌';

  return (
    <div className="flex flex-col">
        {/* Project header */}
        <header className="sticky top-0 z-30 glass border-b border-[var(--border-color)]">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-lg">
                    {categoryIcon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-xl font-bold text-[var(--text-primary)]">{trend.title}</h1>
                      {trend.growth_rate > 0 && (
                        <span className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full font-medium">
                          +{trend.growth_rate}%
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[var(--text-muted)]">{trend.category}</p>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-1 bg-[var(--bg-secondary)] rounded-xl p-1">
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'chat'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  AI Чат
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'tasks'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Задачи
                </button>
                <button
                  onClick={() => setActiveTab('analysis')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    activeTab === 'analysis'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Анализ
                </button>
              </div>
            </div>
          </div>
        </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col">
        {activeTab === 'chat' ? (
          <div className="flex-1 flex gap-6">
            {/* Sidebar Navigation - sticky */}
            <aside className="hidden lg:block w-60 flex-shrink-0">
              <div className="sticky top-24">
                {/* Agent Selector */}
                <div className="trend-card mb-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    Эксперт
                  </h3>
                  <div className="space-y-1.5">
                    {DEFAULT_AGENTS.map((agent) => (
                      <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                          selectedAgent === agent.id
                            ? `bg-gradient-to-r ${agent.color === 'indigo' ? 'from-indigo-600 to-purple-600' : agent.color === 'green' ? 'from-green-600 to-emerald-600' : agent.color === 'pink' ? 'from-pink-600 to-rose-600' : agent.color === 'yellow' ? 'from-yellow-600 to-orange-600' : 'from-purple-600 to-violet-600'} text-white shadow-lg`
                            : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] hover:border-[var(--border-light)]'
                        }`}
                      >
                        <span className="text-lg">{agent.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{agent.name}</div>
                          {selectedAgent === agent.id && (
                            <div className="text-xs opacity-80 truncate">{agent.description}</div>
                          )}
                        </div>
                        {selectedAgent === agent.id && (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="trend-card">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Быстрые действия
                  </h3>
                  <div className="space-y-1.5">
                    {AGENT_QUICK_ACTIONS[selectedAgent].map((action, idx) => {
                      const actionKey = `${selectedAgent}-${idx}`;
                      const responseIndex = getQuickActionResponseIndex(actionKey);
                      const isUsed = responseIndex !== null;
                      return (
                        <button
                          key={actionKey}
                          onClick={() => isUsed ? scrollToMessage(responseIndex) : handleQuickAction(action.prompt, actionKey)}
                          disabled={isTyping && !isUsed}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all text-sm group ${
                            isUsed
                              ? 'bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20'
                              : 'bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] hover:border-[var(--border-light)]'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <span className="text-base">{action.icon}</span>
                          <span className="flex-1 truncate text-xs font-medium">{action.label}</span>
                          {isUsed && (
                            <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Scroll up/down button */}
                  {messages.length > 0 && (
                    <button
                      onClick={() => {
                        if (isAtTop) {
                          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        } else {
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }
                      }}
                      className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all"
                    >
                      <svg className={`w-4 h-4 transition-transform ${isAtTop ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                      <span>{isAtTop ? 'К последним' : 'Наверх'}</span>
                    </button>
                  )}
                </div>

                {/* Create Project Section */}
                <div className="mt-4 trend-card">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Создать проект
                  </h3>
                  {projectCreated ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
                        <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-sm text-green-400 font-medium">Проект создан!</span>
                      </div>
                      <a
                        href={projectCreated.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-sm font-medium text-[var(--text-primary)] transition-all hover:border-indigo-500/50"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span>Открыть на GitHub</span>
                      </a>
                      <div className="bg-[var(--bg-secondary)] rounded-lg p-3 border border-[var(--border-color)]">
                        <p className="text-xs text-[var(--text-muted)] mb-1.5">Клонировать:</p>
                        <code className="text-xs text-[var(--text-secondary)] break-all font-mono">
                          git clone {projectCreated.clone_url}
                        </code>
                      </div>
                    </div>
                  ) : githubAuthenticated ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-2 bg-[var(--bg-secondary)] rounded-lg border border-[var(--border-color)]">
                        <img
                          src={githubUser?.avatar_url}
                          alt={githubUser?.login}
                          className="w-6 h-6 rounded-full ring-2 ring-[var(--border-color)]"
                        />
                        <span className="text-sm text-[var(--text-primary)] font-medium">{githubUser?.login}</span>
                      </div>
                      {!analysis ? (
                        <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                          <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <span className="text-xs text-yellow-400">Сначала выполните анализ</span>
                        </div>
                      ) : (
                        <button
                          onClick={handleCreateProject}
                          disabled={isCreatingProject}
                          className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl text-sm font-medium text-white transition-all ${
                            isCreatingProject
                              ? 'bg-indigo-800 cursor-wait'
                              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02]'
                          }`}
                        >
                          {isCreatingProject ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>
                                {creatingElapsed < 15 ? 'Генерация кода' : creatingElapsed < 60 ? 'Создание репозитория' : creatingElapsed < 120 ? 'Загрузка файлов' : 'Почти готово'}... {Math.floor(creatingElapsed / 60)}:{(creatingElapsed % 60).toString().padStart(2, '0')}
                              </span>
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                              </svg>
                              <span>Создать на GitHub</span>
                            </>
                          )}
                        </button>
                      )}
                      <p className="text-xs text-[var(--text-muted)] text-center">
                        AI создаст репозиторий и план проекта
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs text-[var(--text-secondary)]">
                        Войдите через GitHub чтобы создавать проекты автоматически
                      </p>
                      <button
                        onClick={githubLogin}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-sm font-medium text-[var(--text-primary)] transition-all hover:border-[var(--border-light)]"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                        </svg>
                        <span>Войти через GitHub</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Improvements Plan Section */}
                {analysis && (
                  <div className="mt-4 trend-card">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      План улучшений
                    </h3>
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                      AI создаст детальный план с промптами для Claude Code
                    </p>
                    <button
                      onClick={generateImprovementsPlan}
                      disabled={loadingImprovements}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-sm font-medium text-white transition-all shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40"
                    >
                      {loadingImprovements ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Генерация...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span>Сгенерировать план</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </aside>

            {/* Chat content */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Clear chat button */}
              {messages.length > 0 && (
                <div className="flex justify-end mb-3">
                  <button
                    onClick={clearChatHistory}
                    className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-red-400 transition-colors px-2 py-1 rounded-lg hover:bg-red-500/10"
                    title="Очистить историю чата"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Очистить чат
                  </button>
                </div>
              )}

              {/* Chat messages */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {messages.length === 0 && (
                  <div className="text-center py-16">
                    <div className={`w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center text-4xl bg-gradient-to-br ${
                      selectedAgent === 'general' ? 'from-indigo-500 to-purple-500' :
                      selectedAgent === 'developer' ? 'from-green-500 to-emerald-500' :
                      selectedAgent === 'marketing' ? 'from-pink-500 to-rose-500' :
                      selectedAgent === 'sales' ? 'from-yellow-500 to-orange-500' :
                      'from-purple-500 to-violet-500'
                    } shadow-lg`}>
                      {DEFAULT_AGENTS.find(a => a.id === selectedAgent)?.icon || '🤖'}
                    </div>
                    <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
                      Привет! Я {DEFAULT_AGENTS.find(a => a.id === selectedAgent)?.name}
                    </h3>
                    <p className="text-[var(--text-secondary)] max-w-md mx-auto">
                      {DEFAULT_AGENTS.find(a => a.id === selectedAgent)?.description}. Помогу создать проект на основе тренда "{trend.title}".
                    </p>
                    <p className="text-[var(--text-muted)] text-sm mt-4">
                      Выберите эксперта слева, быстрое действие или напишите свой запрос
                    </p>
                  </div>
                )}

              {messages.map((message, idx) => {
                const messageAgent = DEFAULT_AGENTS.find(a => a.id === message.agent) || DEFAULT_AGENTS[0];
                const agentGradient = messageAgent.color === 'indigo' ? 'from-indigo-500 to-purple-500' :
                  messageAgent.color === 'green' ? 'from-green-500 to-emerald-500' :
                  messageAgent.color === 'pink' ? 'from-pink-500 to-rose-500' :
                  messageAgent.color === 'yellow' ? 'from-yellow-500 to-orange-500' :
                  'from-purple-500 to-violet-500';
                return (
                  <div
                    key={idx}
                    ref={(el) => {
                      if (el) messageRefs.current.set(idx, el);
                    }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex-shrink-0 mr-3 mt-1">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${agentGradient} flex items-center justify-center text-base shadow-lg`}>
                          {messageAgent.icon}
                        </div>
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-5 py-3.5 ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20'
                          : 'bg-[var(--bg-card)] border border-[var(--border-color)]'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="text-xs text-[var(--text-muted)] mb-2 font-semibold">
                          {messageAgent.name}
                        </div>
                      )}
                      {message.role === 'assistant' ? (
                        <div className="prose prose-invert prose-sm max-w-none">
                          {renderMarkdown(message.content)}
                        </div>
                      ) : (
                        <p className="text-sm">{message.content}</p>
                      )}
                    </div>
                  </div>
                );
              })}

              {isTyping && (
                <div className="flex justify-start animate-fadeIn">
                  <div className="flex-shrink-0 mr-3 mt-1">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${
                      selectedAgent === 'general' ? 'from-indigo-500 to-purple-500' :
                      selectedAgent === 'developer' ? 'from-green-500 to-emerald-500' :
                      selectedAgent === 'marketing' ? 'from-pink-500 to-rose-500' :
                      selectedAgent === 'sales' ? 'from-yellow-500 to-orange-500' :
                      'from-purple-500 to-violet-500'
                    } flex items-center justify-center text-base shadow-lg`}>
                      {DEFAULT_AGENTS.find(a => a.id === selectedAgent)?.icon || '🤖'}
                    </div>
                  </div>
                  <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl px-5 py-3.5">
                    <div className="text-xs text-[var(--text-muted)] mb-2 font-semibold">
                      {DEFAULT_AGENTS.find(a => a.id === selectedAgent)?.name} думает...
                    </div>
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span>
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="border-t border-[var(--border-color)] pt-4 mt-auto">
              <div className="flex gap-3">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Напишите сообщение..."
                  className="flex-1 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl px-4 py-3 text-[var(--text-primary)] placeholder-[var(--text-muted)] resize-none focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  rows={2}
                  disabled={isTyping}
                />
                <button
                  onClick={() => sendMessage(inputValue)}
                  disabled={!inputValue.trim() || isTyping}
                  className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed rounded-xl text-white font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 disabled:shadow-none flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  Отправить
                </button>
              </div>
            </div>
          </div>
          </div>
        ) : activeTab === 'tasks' ? (
          /* Tasks Tab */
          <TasksTab
            projectCreated={projectCreated}
            githubAuthenticated={githubAuthenticated}
            githubLogin={githubLogin}
            trendTitle={trend.title}
          />
        ) : (
          /* Analysis Tab */
          <div className="space-y-6 animate-fadeIn">
            {/* Re-analyze Button */}
            {analysis && (
              <div className="flex items-center justify-between trend-card !py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--text-muted)]">
                    Анализ от {new Date(analysis.analyzed_at || Date.now()).toLocaleDateString('ru-RU')}
                  </span>
                  {analysis.analysis_type === 'deep' && (
                    <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg">
                      Глубокий анализ
                    </span>
                  )}
                </div>
                <button
                  onClick={runDeepAnalysis}
                  disabled={isRunningDeepAnalysis}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-sm text-white font-medium transition-all"
                >
                  {isRunningDeepAnalysis ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Анализирую...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Обновить анализ
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Trend Info */}
            <div className="trend-card">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-sm">📊</span>
                Информация о тренде
              </h3>
              <p className="text-[var(--text-secondary)] mb-4">{trend.why_trending}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)] hover:border-indigo-500/30 transition-all">
                  <div className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{trend.opportunity_score}/10</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Возможность</div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)] hover:border-red-500/30 transition-all">
                  <div className="text-2xl font-bold text-red-400">{trend.pain_score}/10</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Потребность</div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)] hover:border-green-500/30 transition-all">
                  <div className="text-2xl font-bold text-green-400">{trend.feasibility_score}/10</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Выполнимость</div>
                </div>
                <div className="bg-[var(--bg-secondary)] rounded-xl p-4 text-center border border-[var(--border-color)] hover:border-yellow-500/30 transition-all">
                  <div className="text-2xl font-bold text-yellow-400">{trend.profit_potential}/10</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">Прибыльность</div>
                </div>
              </div>
            </div>

            {/* Analysis Results */}
            {analysis ? (
              <>
                {/* Deep Analysis Badge */}
                {analysis.analysis_type === 'deep' && analysis.deep_analysis && (
                  <div className="trend-card bg-gradient-to-r from-purple-500/10 to-indigo-500/10 !border-purple-500/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🧠</span>
                        <div>
                          <div className="text-[var(--text-primary)] font-semibold">Глубокий анализ</div>
                          <div className="text-xs text-[var(--text-muted)]">Оптимист + Скептик + Арбитр</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-2xl font-bold text-[var(--text-primary)]">{analysis.deep_analysis.confidence.toFixed(1)}</div>
                          <div className="text-xs text-[var(--text-muted)]">уверенность</div>
                        </div>
                        {analysis.deep_analysis.analysis_metadata?.consensus_reached && (
                          <span className="text-xs px-2.5 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg font-medium">
                            ✓ Консенсус
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Main Pain with Confidence */}
                <div className="trend-card bg-red-500/5 !border-red-500/30">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center text-sm">🎯</span>
                      Главная боль
                    </h3>
                    {analysis.deep_analysis && (
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                            style={{ width: `${analysis.deep_analysis.confidence * 10}%` }}
                          />
                        </div>
                        <span className="text-xs text-[var(--text-muted)]">{analysis.deep_analysis.confidence}/10</span>
                      </div>
                    )}
                  </div>
                  <p className="text-[var(--text-primary)]">{analysis.main_pain}</p>
                </div>

                {/* Deep Analysis: Pain Points with Arguments */}
                {analysis.deep_analysis ? (
                  <div className="trend-card">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-sm">⚡</span>
                      Ключевые проблемы (с аргументацией)
                    </h3>
                    <div className="space-y-4">
                      {analysis.deep_analysis.key_pain_points.map((painPoint, idx) => (
                        <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="text-[var(--text-primary)] font-medium">{painPoint.pain}</div>
                              <div className="text-xs text-[var(--text-muted)] mt-1">{painPoint.verdict}</div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <div className="h-2 w-16 bg-[var(--bg-card)] rounded-full overflow-hidden">
                                <div
                                  className={`h-full ${
                                    painPoint.confidence >= 7 ? 'bg-green-500' :
                                    painPoint.confidence >= 5 ? 'bg-yellow-500' : 'bg-red-500'
                                  }`}
                                  style={{ width: `${painPoint.confidence * 10}%` }}
                                />
                              </div>
                              <span className="text-xs text-[var(--text-muted)] w-8">{painPoint.confidence}/10</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-3">
                            <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3">
                              <div className="text-xs text-green-400 font-medium mb-2 flex items-center gap-1">
                                <span>✓</span> Аргументы ЗА
                              </div>
                              <ul className="space-y-1">
                                {painPoint.arguments_for.map((arg, argIdx) => (
                                  <li key={argIdx} className="text-xs text-[var(--text-secondary)]">• {arg}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-3">
                              <div className="text-xs text-red-400 font-medium mb-2 flex items-center gap-1">
                                <span>✗</span> Аргументы ПРОТИВ
                              </div>
                              <ul className="space-y-1">
                                {painPoint.arguments_against.map((arg, argIdx) => (
                                  <li key={argIdx} className="text-xs text-[var(--text-secondary)]">• {arg}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : analysis.key_pain_points?.length > 0 && (
                  <div className="trend-card">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-sm">💢</span>
                      Ключевые проблемы
                    </h3>
                    <ul className="space-y-2">
                      {analysis.key_pain_points.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-[var(--text-secondary)] p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                          <span className="w-6 h-6 rounded-lg bg-red-500/20 flex items-center justify-center text-xs text-red-400 flex-shrink-0">{idx + 1}</span>
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Target Audience with Confidence */}
                {analysis.target_audience?.segments?.length > 0 && (
                  <div className="trend-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm">👥</span>
                        Целевая аудитория
                      </h3>
                      <span className="text-sm text-[var(--text-muted)] bg-[var(--bg-secondary)] px-3 py-1 rounded-full border border-[var(--border-color)]">
                        {analysis.target_audience.segments.length} сегментов
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(analysis.deep_analysis?.target_audience?.segments || analysis.target_audience.segments).map((segment, idx) => (
                        <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] hover:border-indigo-500/30 transition-all">
                          <div className="flex items-start justify-between mb-2">
                            <span className="font-medium text-[var(--text-primary)]">{segment.name}</span>
                            <div className="flex items-center gap-2">
                              {segment.confidence && (
                                <span className="text-xs text-[var(--text-muted)]">{segment.confidence}/10</span>
                              )}
                            </div>
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mb-2">Размер: {segment.size}</div>
                          <div className="flex flex-wrap gap-2">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                              segment.willingness_to_pay === 'high' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                              segment.willingness_to_pay === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' :
                              'bg-[var(--bg-card)] text-[var(--text-muted)] border border-[var(--border-color)]'
                            }`}>
                              {segment.willingness_to_pay === 'high' ? 'Высокая готовность платить' : segment.willingness_to_pay === 'medium' ? 'Средняя готовность платить' : 'Низкая готовность платить'}
                            </span>
                          </div>
                          {segment.where_to_find && (
                            <div className="text-xs text-[var(--text-muted)] mt-3">📍 {segment.where_to_find}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Risks & Opportunities (Deep Analysis Only) */}
                {analysis.deep_analysis && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="trend-card bg-red-500/5 !border-red-500/20">
                      <h3 className="text-lg font-semibold text-red-400 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center text-sm">⚠️</span>
                        Риски
                      </h3>
                      <ul className="space-y-2">
                        {analysis.deep_analysis.risks.map((risk, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                            <span className="text-red-400 mt-0.5">•</span>
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="trend-card bg-green-500/5 !border-green-500/20">
                      <h3 className="text-lg font-semibold text-green-400 mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center text-sm">🚀</span>
                        Возможности
                      </h3>
                      <ul className="space-y-2">
                        {analysis.deep_analysis.opportunities.map((opp, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                            <span className="text-green-400 mt-0.5">•</span>
                            {opp}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Final Recommendation (Deep Analysis Only) */}
                {analysis.deep_analysis && (
                  <div className="trend-card bg-gradient-to-r from-indigo-500/10 to-purple-500/10 !border-indigo-500/30">
                    <h3 className="text-lg font-semibold text-indigo-400 mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-sm">💡</span>
                      Финальная рекомендация
                    </h3>
                    <p className="text-[var(--text-primary)]">{analysis.deep_analysis.final_recommendation}</p>
                  </div>
                )}

                {/* Agent Perspectives (Deep Analysis Only) */}
                {analysis.deep_analysis && analysis.deep_analysis.analysis_metadata && (
                  <div className="trend-card">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 flex items-center justify-center text-sm">🎭</span>
                      Позиции агентов
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">😊</span>
                          <span className="text-green-400 font-medium">Оптимист</span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{analysis.deep_analysis.analysis_metadata.optimist_summary}</p>
                      </div>
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">🤔</span>
                          <span className="text-red-400 font-medium">Скептик</span>
                        </div>
                        <p className="text-sm text-[var(--text-secondary)]">{analysis.deep_analysis.analysis_metadata.skeptic_summary}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Market Signals */}
                {analysis.market_signals && analysis.market_signals.length > 0 && (
                  <div className="trend-card">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-sm">📡</span>
                      Сигналы рынка
                    </h3>
                    <ul className="space-y-2">
                      {analysis.market_signals.map((signal, idx) => (
                        <li key={idx} className="flex items-start gap-3 text-[var(--text-secondary)] p-3 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                          <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-xs text-blue-400 flex-shrink-0">→</span>
                          {signal}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Find Companies Section */}
                <div className="trend-card">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-sm">🏢</span>
                      Конкретные компании-клиенты
                    </h3>
                    {!companies && (
                      <button
                        onClick={findCompanies}
                        disabled={loadingCompanies}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-sm text-white font-medium transition-all"
                      >
                        {loadingCompanies ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Ищу компании...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            Найти компании
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {loadingCompanies ? (
                    <div className="text-center py-8">
                      <div className="w-10 h-10 border-2 border-[var(--border-color)] border-t-emerald-500 rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-[var(--text-muted)]">AI ищет потенциальных клиентов...</p>
                    </div>
                  ) : companies && companies.length > 0 ? (
                    <div className="space-y-3">
                      {companies.map((company, idx) => (
                        <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] hover:border-emerald-500/30 transition-all">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-[var(--text-primary)]">{company.name}</h4>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${
                                  company.relevance_score >= 8 ? 'bg-green-500/20 text-green-400' :
                                  company.relevance_score >= 6 ? 'bg-yellow-500/20 text-yellow-400' :
                                  'bg-zinc-500/20 text-zinc-400'
                                }`}>
                                  {company.relevance_score}/10
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-muted)] mt-1">{company.industry} • {company.size} • {company.location}</p>
                            </div>
                            <a
                              href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-indigo-400 hover:bg-indigo-500/10 transition-all"
                            >
                              {company.website.replace(/https?:\/\//, '')}
                            </a>
                          </div>

                          <p className="text-sm text-[var(--text-secondary)] mb-3">{company.pain_match}</p>

                          <div className="flex flex-wrap items-center gap-2">
                            <a
                              href={`mailto:${company.email}`}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 hover:bg-emerald-500/20 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                              {company.email}
                            </a>
                            {company.linkedin_search_query && (
                              <a
                                href={`https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(company.linkedin_search_query)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-400 hover:bg-blue-500/20 transition-all"
                              >
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                                </svg>
                                LinkedIn
                              </a>
                            )}
                            <button
                              onClick={() => generateEmail(company)}
                              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg text-purple-400 hover:bg-purple-500/20 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                              Написать письмо
                            </button>
                          </div>

                          {company.outreach_angle && (
                            <div className="mt-3 p-2 bg-[var(--bg-card)] rounded-lg border border-[var(--border-color)]">
                              <p className="text-xs text-[var(--text-muted)]">
                                <span className="text-indigo-400 font-medium">Подход:</span> {company.outreach_angle}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}

                      <button
                        onClick={() => setCompanies(null)}
                        className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-sm text-[var(--text-secondary)] transition-all"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Найти других
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center text-3xl">
                        🏢
                      </div>
                      <p className="text-[var(--text-secondary)]">Нажмите кнопку выше для поиска компаний</p>
                      <p className="text-[var(--text-muted)] text-sm mt-1">AI найдёт реальные компании с контактами</p>
                    </div>
                  )}
                </div>

                {/* Real Sources Section */}
                <div className="trend-card">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm">📊</span>
                    Данные из источников
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Reddit Stats */}
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] hover:border-orange-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">🔥</span>
                        <span className="font-medium text-[var(--text-primary)]">Reddit</span>
                      </div>
                      {analysis.real_sources?.reddit ? (
                        <>
                          <div className="text-2xl font-bold text-orange-400">
                            {analysis.real_sources.reddit.posts?.length || 0} постов
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">
                            Engagement: {analysis.real_sources.reddit.engagement || 0}
                          </div>
                          {analysis.real_sources.reddit.communities && analysis.real_sources.reddit.communities.length > 0 && (
                            <div className="text-xs text-[var(--text-secondary)] mt-2">
                              Сообщества: {analysis.real_sources.reddit.communities.slice(0, 3).map(c => `r/${c}`).join(', ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-[var(--text-muted)]">Нет данных</div>
                      )}
                    </div>

                    {/* YouTube Stats */}
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] hover:border-red-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">📺</span>
                        <span className="font-medium text-[var(--text-primary)]">YouTube</span>
                      </div>
                      {analysis.real_sources?.youtube ? (
                        <>
                          <div className="text-2xl font-bold text-red-400">
                            {analysis.real_sources.youtube.videos?.length || 0} видео
                          </div>
                          {analysis.real_sources.youtube.channels && analysis.real_sources.youtube.channels.length > 0 && (
                            <div className="text-xs text-[var(--text-secondary)] mt-2">
                              Каналы: {analysis.real_sources.youtube.channels.slice(0, 3).join(', ')}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-sm text-[var(--text-muted)]">Нет данных</div>
                      )}
                    </div>

                    {/* Google Trends Stats */}
                    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] hover:border-blue-500/30 transition-all">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">📈</span>
                        <span className="font-medium text-[var(--text-primary)]">Google Trends</span>
                      </div>
                      {analysis.real_sources?.google_trends ? (
                        <>
                          <div className={`text-2xl font-bold ${
                            (analysis.real_sources.google_trends.growth_rate || 0) > 0 ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {(analysis.real_sources.google_trends.growth_rate || 0) > 0 ? '+' : ''}
                            {analysis.real_sources.google_trends.growth_rate || 0}%
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">рост за 3 месяца</div>
                        </>
                      ) : (
                        <div className="text-sm text-[var(--text-muted)]">Нет данных</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Google Trends Chart */}
                {analysis.real_sources?.google_trends?.interest_timeline &&
                 analysis.real_sources.google_trends.interest_timeline.length > 0 && (
                  <div className="trend-card">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-sm">📊</span>
                        График интереса (Google Trends)
                        {analysis.real_sources.google_trends.is_mock_data && (
                          <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg ml-2">
                            ⚠️ Симулированные данные
                          </span>
                        )}
                      </h3>
                      <button
                        onClick={refreshSources}
                        disabled={isRefreshingSources}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] disabled:opacity-50 border border-[var(--border-color)] hover:border-green-500/30 rounded-lg text-green-400 transition-all"
                        title="Обновить данные из Google Trends"
                      >
                        {isRefreshingSources ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-green-400/30 border-t-green-400 rounded-full animate-spin" />
                            Обновление...
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            Обновить данные
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex gap-4">
                      {/* Y-axis labels */}
                      <div className="flex flex-col justify-between text-xs text-[var(--text-muted)] py-1" style={{ height: '180px' }}>
                        <span>100</span>
                        <span>50</span>
                        <span>0</span>
                      </div>
                      {/* Chart area */}
                      <div className="flex-1 relative" style={{ height: '200px' }}>
                        {/* Grid lines */}
                        <div className="absolute inset-x-0 top-0 border-b border-[var(--border-color)] opacity-30" style={{ top: '0%' }}></div>
                        <div className="absolute inset-x-0 border-b border-[var(--border-color)] opacity-30" style={{ top: '50%' }}></div>
                        <div className="absolute inset-x-0 border-b border-[var(--border-color)] opacity-30" style={{ top: '100%' }}></div>

                        {/* Bars container */}
                        <div className="flex items-end justify-around gap-1 h-[180px] px-2">
                          {analysis.real_sources.google_trends.interest_timeline.map((point, idx) => {
                            const rawValue = typeof point.value === 'string' ? parseInt(point.value) || 0 : (point.value || 0);
                            const value = Math.min(Math.max(rawValue, 0), 100); // Clamp between 0-100
                            const heightPx = Math.max((value / 100) * 180, 4); // Min 4px height for visibility
                            return (
                              <div
                                key={idx}
                                className="flex-1 flex flex-col items-center justify-end group relative max-w-[40px]"
                                style={{ height: '100%' }}
                              >
                                {/* Tooltip */}
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-primary)] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10 shadow-lg">
                                  <span className="font-semibold">{value}</span>
                                  {point.date && <span className="text-[var(--text-muted)] ml-1">({point.date})</span>}
                                </div>
                                {/* Bar */}
                                <div
                                  className="w-full bg-gradient-to-t from-indigo-600 to-purple-400 rounded-t-sm transition-all duration-300 hover:from-indigo-500 hover:to-purple-300 cursor-pointer"
                                  style={{ height: `${heightPx}px`, minHeight: '4px' }}
                                />
                              </div>
                            );
                          })}
                        </div>

                        {/* X-axis labels */}
                        <div className="flex justify-between text-xs text-[var(--text-muted)] mt-2 px-2">
                          <span>{analysis.real_sources.google_trends.interest_timeline[0]?.date || ''}</span>
                          <span>{analysis.real_sources.google_trends.interest_timeline[Math.floor(analysis.real_sources.google_trends.interest_timeline.length / 2)]?.date || ''}</span>
                          <span>{analysis.real_sources.google_trends.interest_timeline[analysis.real_sources.google_trends.interest_timeline.length - 1]?.date || ''}</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      {/* Mock data warning */}
                      {analysis.real_sources.google_trends.is_mock_data && (
                        <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                          <span>⚠️</span>
                          <span>Симулированные данные (SerpAPI недоступен). Проверьте реальные данные по ссылке ниже.</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-[var(--text-muted)] space-y-1">
                          <div>
                            <span>Запрос: </span>
                            <span className="text-[var(--text-secondary)] font-medium">
                              &quot;{analysis.real_sources.google_trends.search_query || trend?.title}&quot;
                            </span>
                            {analysis.real_sources.google_trends.simplified_from && (
                              <span className="text-amber-400 ml-2" title={`Оригинальный запрос: "${analysis.real_sources.google_trends.simplified_from}"`}>
                                (упрощён)
                              </span>
                            )}
                          </div>
                          {analysis.real_sources.google_trends.fetched_at && (
                            <div>
                              <span>Данные получены: </span>
                              <span className="text-[var(--text-secondary)]">
                                {new Date(analysis.real_sources.google_trends.fetched_at).toLocaleString('ru-RU')}
                              </span>
                            </div>
                          )}
                          {analysis.real_sources.google_trends.interest_timeline && analysis.real_sources.google_trends.interest_timeline.length > 0 && (
                            <div>
                              <span>Период: </span>
                              <span className="text-[var(--text-secondary)]">
                                {analysis.real_sources.google_trends.interest_timeline[0]?.date} — {analysis.real_sources.google_trends.interest_timeline[analysis.real_sources.google_trends.interest_timeline.length - 1]?.date}
                              </span>
                            </div>
                          )}
                        </div>
                        <a
                          href={analysis.real_sources.google_trends.google_trends_url || `https://trends.google.com/trends/explore?q=${encodeURIComponent(analysis.real_sources.google_trends.search_query || trend?.title || '')}&date=today%2012-m`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs px-3 py-1.5 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:border-indigo-500/30 rounded-lg text-indigo-400 transition-all"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                          </svg>
                          Проверить в Google Trends
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reddit Posts */}
                {analysis.real_sources?.reddit?.posts && analysis.real_sources.reddit.posts.length > 0 && (
                  <div className="trend-card">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center text-sm">🔥</span>
                      Reddit обсуждения
                    </h3>
                    <div className="space-y-2">
                      {analysis.real_sources.reddit.posts.slice(0, 5).map((post, idx) => (
                        <a
                          key={idx}
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:border-orange-500/30 rounded-xl p-4 transition-all"
                        >
                          <div className="text-sm text-[var(--text-primary)] font-medium">{post.title}</div>
                          <div className="flex gap-3 text-xs text-[var(--text-muted)] mt-2">
                            {post.subreddit && <span className="bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full">r/{post.subreddit}</span>}
                            {post.score && <span className="flex items-center gap-1">⬆️ {post.score}</span>}
                            {post.num_comments && <span className="flex items-center gap-1">💬 {post.num_comments}</span>}
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* YouTube Videos */}
                {analysis.real_sources?.youtube?.videos && analysis.real_sources.youtube.videos.length > 0 && (
                  <div className="trend-card">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center text-sm">📺</span>
                      YouTube видео
                    </h3>
                    <div className="space-y-2">
                      {analysis.real_sources.youtube.videos.slice(0, 5).map((video, idx) => (
                        <a
                          key={idx}
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] hover:border-red-500/30 rounded-xl p-4 transition-all"
                        >
                          <div className="text-sm text-[var(--text-primary)] font-medium">{video.title}</div>
                          <div className="text-xs text-[var(--text-muted)] mt-1 flex items-center gap-2">
                            <span className="bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full">{video.channel}</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Google Trends Related Queries */}
                {analysis.real_sources?.google_trends?.related_queries && analysis.real_sources.google_trends.related_queries.length > 0 && (
                  <div className="trend-card">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-sm">📈</span>
                        Связанные запросы (Google Trends)
                      </h3>
                      {analysis.real_sources.google_trends.is_mock_data && (
                        <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg">
                          ⚠️ Симулированные данные
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {analysis.real_sources.google_trends.related_queries.slice(0, 10).map((query, idx) => {
                        // Parse growth value - could be "100", "+50%", or "Breakout"
                        const growthValue = parseInt(query.growth) || 0;
                        const isPercentage = query.growth.includes('%');
                        const isBreakout = query.growth.toLowerCase().includes('breakout');

                        return (
                          <a
                            key={idx}
                            href={query.link || `https://trends.google.com/trends/explore?q=${encodeURIComponent(query.query)}&date=today%2012-m`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-[var(--bg-secondary)] border border-[var(--border-color)] hover:border-blue-500/50 hover:bg-blue-500/10 px-3 py-1.5 rounded-xl text-sm text-[var(--text-secondary)] transition-all cursor-pointer group flex items-center gap-1.5"
                          >
                            <span>{query.query}</span>
                            {/* Show relevance score (0-100) for TOP queries, or growth % for RISING */}
                            <span className={`font-medium ${isBreakout ? 'text-purple-400' : isPercentage ? 'text-green-400' : 'text-blue-400'}`}>
                              {isBreakout ? '🚀' : isPercentage ? query.growth : `${growthValue}/100`}
                            </span>
                            <svg className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-3">
                      Число — относительная популярность запроса (0-100). Клик откроет Google Trends.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 trend-card">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center text-4xl">
                  📊
                </div>
                <h3 className="text-xl font-semibold text-[var(--text-primary)] mb-2">Анализ еще не проведен</h3>
                <p className="text-[var(--text-muted)] mb-6">Запустите глубокий анализ с 3 AI-агентами</p>
                <button
                  onClick={runDeepAnalysis}
                  disabled={isRunningDeepAnalysis}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-white font-medium transition-all shadow-lg shadow-purple-500/25"
                >
                  {isRunningDeepAnalysis ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      3 агента анализируют...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Запустить глубокий анализ
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Email Generation Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setEmailModalOpen(false);
              setGeneratedEmail(null);
              setSelectedCompanyForEmail(null);
            }}
          />

          {/* Modal */}
          <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    Письмо для {selectedCompanyForEmail?.name}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">{selectedCompanyForEmail?.email}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setEmailModalOpen(false);
                  setGeneratedEmail(null);
                  setSelectedCompanyForEmail(null);
                }}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {/* Sender Settings */}
              {!generatedEmail && !loadingEmail && (
                <div className="mb-6 p-4 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)]">
                  <h4 className="font-medium text-[var(--text-primary)] mb-3">Настройки отправителя</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Ваше имя *</label>
                      <input
                        type="text"
                        value={emailSenderName}
                        onChange={(e) => setEmailSenderName(e.target.value)}
                        placeholder="Иван Иванов"
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--text-muted)] mb-1">Ваша компания</label>
                      <input
                        type="text"
                        value={emailSenderCompany}
                        onChange={(e) => setEmailSenderCompany(e.target.value)}
                        placeholder="Название компании"
                        className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="mt-4">
                    <label className="block text-xs text-[var(--text-muted)] mb-2">Тон письма</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'formal', label: 'Формальный', icon: '👔' },
                        { value: 'professional', label: 'Профессиональный', icon: '💼' },
                        { value: 'friendly', label: 'Дружелюбный', icon: '🤝' },
                      ].map((tone) => (
                        <button
                          key={tone.value}
                          onClick={() => setEmailTone(tone.value as 'formal' | 'friendly' | 'professional')}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            emailTone === tone.value
                              ? 'bg-purple-500/20 border-purple-500/50 text-purple-400 border'
                              : 'bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-purple-500/30'
                          }`}
                        >
                          <span>{tone.icon}</span>
                          {tone.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => generateEmail(selectedCompanyForEmail)}
                    disabled={!emailSenderName.trim()}
                    className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-zinc-700 disabled:to-zinc-700 rounded-xl text-white font-medium transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Сгенерировать письмо
                  </button>
                </div>
              )}

              {/* Loading */}
              {loadingEmail && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">AI генерирует персонализированное письмо...</p>
                  <p className="text-xs text-[var(--text-muted)] mt-2">Это займёт несколько секунд</p>
                </div>
              )}

              {/* Generated Email */}
              {generatedEmail && !loadingEmail && (
                <div className="space-y-4">
                  {/* Main Email */}
                  <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
                      <span className="text-sm font-medium text-[var(--text-primary)]">Основное письмо</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => copyToClipboard(`${generatedEmail.subject}\n\n${generatedEmail.body}`, 'main')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                            copiedField === 'main'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {copiedField === 'main' ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Скопировано!
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Копировать
                            </>
                          )}
                        </button>
                        <a
                          href={`mailto:${selectedCompanyForEmail?.email}?subject=${encodeURIComponent(generatedEmail.subject)}&body=${encodeURIComponent(generatedEmail.body)}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/20 text-purple-400 rounded-lg text-xs hover:bg-purple-500/30 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Открыть в почте
                        </a>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="mb-3">
                        <span className="text-xs text-[var(--text-muted)]">Тема:</span>
                        <p className="text-sm font-medium text-[var(--text-primary)] mt-1">{generatedEmail.subject}</p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)]">Текст:</span>
                        <pre className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-sans">{generatedEmail.body}</pre>
                      </div>
                    </div>
                  </div>

                  {/* Follow-up Email */}
                  {generatedEmail.follow_up_subject && generatedEmail.follow_up_body && (
                    <div className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                      <div className="flex items-center justify-between p-3 border-b border-[var(--border-color)]">
                        <span className="text-sm font-medium text-[var(--text-primary)]">Follow-up (через 3-5 дней)</span>
                        <button
                          onClick={() => copyToClipboard(`${generatedEmail.follow_up_subject}\n\n${generatedEmail.follow_up_body}`, 'followup')}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                            copiedField === 'followup'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {copiedField === 'followup' ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Скопировано!
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              Копировать
                            </>
                          )}
                        </button>
                      </div>
                      <div className="p-4">
                        <div className="mb-3">
                          <span className="text-xs text-[var(--text-muted)]">Тема:</span>
                          <p className="text-sm font-medium text-[var(--text-primary)] mt-1">{generatedEmail.follow_up_subject}</p>
                        </div>
                        <div>
                          <span className="text-xs text-[var(--text-muted)]">Текст:</span>
                          <pre className="mt-1 text-sm text-[var(--text-secondary)] whitespace-pre-wrap font-sans">{generatedEmail.follow_up_body}</pre>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tips */}
                  {generatedEmail.tips && generatedEmail.tips.length > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
                      <h4 className="font-medium text-amber-400 mb-2 flex items-center gap-2">
                        <span>💡</span> Советы по отправке
                      </h4>
                      <ul className="space-y-1">
                        {generatedEmail.tips.map((tip, idx) => (
                          <li key={idx} className="text-sm text-amber-300/80 flex items-start gap-2">
                            <span className="text-amber-500 mt-1">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Regenerate Button */}
                  <button
                    onClick={() => {
                      setGeneratedEmail(null);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-xl text-[var(--text-secondary)] transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Изменить настройки и перегенерировать
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Improvements Plan Modal */}
      {showImprovementsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => {
              setShowImprovementsModal(false);
            }}
          />

          {/* Modal */}
          <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--text-primary)]">
                    План улучшений
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">Промпты для Claude Code</p>
                </div>
              </div>
              <button
                onClick={() => setShowImprovementsModal(false)}
                className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
              {loadingImprovements ? (
                <div className="text-center py-16">
                  <div className="w-12 h-12 border-2 border-[var(--border-color)] border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-[var(--text-secondary)]">AI генерирует план улучшений...</p>
                  <p className="text-xs text-[var(--text-muted)] mt-2">Это может занять до 30 секунд</p>
                </div>
              ) : improvementsPlan ? (
                <div className="space-y-6">
                  {/* Product Vision */}
                  {improvementsPlan.product_vision && (
                    <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-xl p-4">
                      <h4 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
                        <span>🎯</span> Видение продукта
                      </h4>
                      <p className="text-lg text-[var(--text-primary)] font-medium mb-2">
                        {improvementsPlan.product_vision.one_liner}
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] mb-3">
                        {improvementsPlan.product_vision.value_proposition}
                      </p>
                      {improvementsPlan.product_vision.success_metrics && (
                        <div className="flex flex-wrap gap-2">
                          {improvementsPlan.product_vision.success_metrics.map((metric, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-lg">
                              {metric}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Wins */}
                  {improvementsPlan.quick_wins && improvementsPlan.quick_wins.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-green-500/20 flex items-center justify-center text-sm">⚡</span>
                        Быстрые победы
                      </h4>
                      <div className="grid gap-3">
                        {improvementsPlan.quick_wins.map((win, idx) => (
                          <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h5 className="font-medium text-[var(--text-primary)]">{win.title}</h5>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                                    {win.time_estimate}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    win.impact === 'high' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
                                  }`}>
                                    {win.impact} impact
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => copyToClipboard(win.claude_prompt, `qw-${idx}`)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                                  copiedField === `qw-${idx}`
                                    ? 'bg-green-500/20 text-green-400'
                                    : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                              >
                                {copiedField === `qw-${idx}` ? '✓ Скопировано' : 'Копировать промпт'}
                              </button>
                            </div>
                            <pre className="mt-2 text-xs text-[var(--text-muted)] whitespace-pre-wrap font-mono bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)] max-h-32 overflow-y-auto">
                              {win.claude_prompt}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Functionality Improvements */}
                  {improvementsPlan.functionality_improvements && improvementsPlan.functionality_improvements.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-blue-500/20 flex items-center justify-center text-sm">🔧</span>
                        Функциональные улучшения
                      </h4>
                      <div className="space-y-3">
                        {improvementsPlan.functionality_improvements.map((imp, idx) => (
                          <details key={idx} className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden group">
                            <summary className="p-4 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <span className={`text-xs px-2 py-0.5 rounded ${
                                    imp.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                    imp.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                    'bg-zinc-500/20 text-zinc-400'
                                  }`}>
                                    {imp.priority}
                                  </span>
                                  <span className="font-medium text-[var(--text-primary)]">{imp.title}</span>
                                </div>
                                <span className={`text-xs px-2 py-0.5 rounded ${
                                  imp.complexity === 'complex' ? 'bg-purple-500/20 text-purple-400' :
                                  imp.complexity === 'medium' ? 'bg-blue-500/20 text-blue-400' :
                                  'bg-green-500/20 text-green-400'
                                }`}>
                                  {imp.complexity}
                                </span>
                              </div>
                            </summary>
                            <div className="p-4 pt-0 border-t border-[var(--border-color)]">
                              <p className="text-sm text-[var(--text-secondary)] mb-3">{imp.description}</p>
                              <p className="text-xs text-[var(--text-muted)] italic mb-3">{imp.user_story}</p>
                              {imp.acceptance_criteria && (
                                <div className="mb-3">
                                  <p className="text-xs text-[var(--text-muted)] mb-1">Критерии приёмки:</p>
                                  <ul className="text-xs text-[var(--text-secondary)] space-y-1">
                                    {imp.acceptance_criteria.map((c, i) => (
                                      <li key={i} className="flex items-start gap-2">
                                        <span className="text-green-400">✓</span> {c}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-[var(--text-muted)]">Промпт для Claude:</span>
                                <button
                                  onClick={() => copyToClipboard(imp.claude_prompt, `func-${idx}`)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                                    copiedField === `func-${idx}`
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  {copiedField === `func-${idx}` ? '✓ Скопировано' : 'Копировать'}
                                </button>
                              </div>
                              <pre className="mt-2 text-xs text-[var(--text-muted)] whitespace-pre-wrap font-mono bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)] max-h-40 overflow-y-auto">
                                {imp.claude_prompt}
                              </pre>
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* UX Improvements */}
                  {improvementsPlan.ux_improvements && improvementsPlan.ux_improvements.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-pink-500/20 flex items-center justify-center text-sm">🎨</span>
                        UX улучшения
                      </h4>
                      <div className="grid md:grid-cols-2 gap-3">
                        {improvementsPlan.ux_improvements.map((ux, idx) => (
                          <div key={idx} className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                            <h5 className="font-medium text-[var(--text-primary)] mb-2">{ux.title}</h5>
                            <div className="text-xs text-[var(--text-muted)] mb-2">
                              <span className="text-red-400">Проблема:</span> {ux.current_problem}
                            </div>
                            <div className="text-xs text-[var(--text-secondary)] mb-3">
                              <span className="text-green-400">Решение:</span> {ux.proposed_solution}
                            </div>
                            <button
                              onClick={() => copyToClipboard(ux.claude_prompt, `ux-${idx}`)}
                              className={`w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                                copiedField === `ux-${idx}`
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {copiedField === `ux-${idx}` ? '✓ Скопировано' : 'Копировать промпт'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Agents */}
                  {improvementsPlan.ai_agent_prompts && Object.keys(improvementsPlan.ai_agent_prompts).length > 0 && (
                    <div>
                      <h4 className="font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center text-sm">🤖</span>
                        AI Агенты
                      </h4>
                      <div className="space-y-3">
                        {Object.entries(improvementsPlan.ai_agent_prompts).map(([key, agent], idx) => (
                          <details key={key} className="bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] overflow-hidden">
                            <summary className="p-4 cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors">
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                  {key === 'customer_support' ? '💬' : key === 'sales_assistant' ? '💰' : '✍️'}
                                </span>
                                <div>
                                  <span className="font-medium text-[var(--text-primary)]">{agent.name}</span>
                                  <p className="text-xs text-[var(--text-muted)]">{agent.description}</p>
                                </div>
                              </div>
                            </summary>
                            <div className="p-4 pt-0 border-t border-[var(--border-color)]">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs text-[var(--text-muted)]">System Prompt:</span>
                                <button
                                  onClick={() => copyToClipboard(agent.system_prompt, `agent-${idx}`)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                                    copiedField === `agent-${idx}`
                                      ? 'bg-green-500/20 text-green-400'
                                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                  }`}
                                >
                                  {copiedField === `agent-${idx}` ? '✓ Скопировано' : 'Копировать'}
                                </button>
                              </div>
                              <pre className="text-xs text-[var(--text-muted)] whitespace-pre-wrap font-mono bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-color)] max-h-48 overflow-y-auto">
                                {agent.system_prompt}
                              </pre>
                              {agent.example_interactions && agent.example_interactions.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-[var(--text-muted)] mb-2">Примеры использования:</p>
                                  <div className="space-y-1">
                                    {agent.example_interactions.map((ex, i) => (
                                      <p key={i} className="text-xs text-[var(--text-secondary)] pl-3 border-l-2 border-indigo-500/30">
                                        {ex}
                                      </p>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Full Implementation Prompt */}
                  {improvementsPlan.full_implementation_prompt && (
                    <div className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-indigo-400 flex items-center gap-2">
                          <span>🚀</span> Полный промпт для Claude Code
                        </h4>
                        <button
                          onClick={() => copyToClipboard(improvementsPlan.full_implementation_prompt || '', 'full-prompt')}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            copiedField === 'full-prompt'
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
                          }`}
                        >
                          {copiedField === 'full-prompt' ? '✓ Скопировано!' : 'Копировать всё'}
                        </button>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mb-3">
                        Скопируйте этот промпт и вставьте в Claude Code для реализации всех улучшений
                      </p>
                      <pre className="text-xs text-[var(--text-secondary)] whitespace-pre-wrap font-mono bg-[var(--bg-card)] p-4 rounded-lg border border-[var(--border-color)] max-h-64 overflow-y-auto">
                        {improvementsPlan.full_implementation_prompt}
                      </pre>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16">
                  <p className="text-[var(--text-muted)]">Нажмите кнопку для генерации плана</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
