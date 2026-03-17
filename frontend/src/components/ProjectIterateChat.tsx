'use client';

import { useState, useRef, useEffect } from 'react';
import { setItem, getItem } from '@/lib/storage';

// ─── Types ───

interface IterateMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  files_modified?: string[];
  commit_url?: string;
  error?: boolean;
}

interface ProjectIterateChatProps {
  repoUrl: string;
  projectName: string;
  language?: 'ru' | 'en';
}

// ─── Loading Steps ───

const LOADING_STEPS_RU = [
  'Читаю структуру репозитория...',
  'Анализирую код...',
  'Генерирую новый код...',
  'Пушу в GitHub...',
];

const LOADING_STEPS_EN = [
  'Reading repository structure...',
  'Analyzing code...',
  'Generating new code...',
  'Pushing to GitHub...',
];

// ─── Quick Actions ───

const QUICK_ACTIONS_RU = [
  { text: 'Добавить страницу', icon: '📄' },
  { text: 'Добавить API роут', icon: '🔌' },
  { text: 'Добавить компонент', icon: '🧩' },
  { text: 'Исправить баги', icon: '🐛' },
  { text: 'Добавить авторизацию', icon: '🔐' },
  { text: 'Улучшить стили', icon: '🎨' },
];

const QUICK_ACTIONS_EN = [
  { text: 'Add a page', icon: '📄' },
  { text: 'Add API route', icon: '🔌' },
  { text: 'Add component', icon: '🧩' },
  { text: 'Fix bugs', icon: '🐛' },
  { text: 'Add authentication', icon: '🔐' },
  { text: 'Improve styling', icon: '🎨' },
];

// ─── Helpers ───

function storageKey(repoUrl: string): string {
  // Simple hash for storage key
  let hash = 0;
  for (let i = 0; i < repoUrl.length; i++) {
    const char = repoUrl.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `iterate_chat_${Math.abs(hash)}`;
}

// ─── Component ───

export default function ProjectIterateChat({
  repoUrl,
  projectName,
  language = 'ru',
}: ProjectIterateChatProps) {
  const [messages, setMessages] = useState<IterateMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loadingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const isRu = language === 'ru';
  const loadingSteps = isRu ? LOADING_STEPS_RU : LOADING_STEPS_EN;
  const quickActions = isRu ? QUICK_ACTIONS_RU : QUICK_ACTIONS_EN;

  // Load messages from localStorage
  useEffect(() => {
    const key = storageKey(repoUrl);
    const saved = getItem<IterateMessage[]>(key);
    if (saved && Array.isArray(saved)) {
      setMessages(saved);
    }
  }, [repoUrl]);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      const key = storageKey(repoUrl);
      // Keep last 30 messages
      const toSave = messages.slice(-30);
      setItem(key, toSave);
    }
  }, [messages, repoUrl]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Loading step animation
  useEffect(() => {
    if (loading) {
      setLoadingStep(0);
      loadingInterval.current = setInterval(() => {
        setLoadingStep(prev => {
          if (prev < loadingSteps.length - 1) return prev + 1;
          return prev;
        });
      }, 4000);
    } else {
      if (loadingInterval.current) {
        clearInterval(loadingInterval.current);
        loadingInterval.current = null;
      }
    }
    return () => {
      if (loadingInterval.current) clearInterval(loadingInterval.current);
    };
  }, [loading, loadingSteps.length]);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput('');

    // Add user message
    const userMsg: IterateMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build conversation history (text-only, for context)
      const history = messages
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/projects/iterate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo_url: repoUrl,
          message: messageText,
          conversation_history: history,
        }),
      });

      const data = await res.json();

      const assistantMsg: IterateMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || data.error || 'Something went wrong',
        timestamp: Date.now(),
        files_modified: data.files_modified,
        commit_url: data.commit_url,
        error: !data.success,
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: IterateMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: isRu
          ? 'Ошибка соединения. Попробуйте ещё раз.'
          : 'Connection error. Please try again.',
        timestamp: Date.now(),
        error: true,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearHistory = () => {
    setMessages([]);
    const key = storageKey(repoUrl);
    setItem(key, []);
  };

  // Repo name from URL
  const repoName = repoUrl.split('/').pop() || projectName;

  return (
    <div className="mt-6 rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900/50">
      {/* Header — always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-800/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-lg">
            🤖
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-zinc-200">
              META Agent
            </h3>
            <p className="text-xs text-zinc-500">
              {isRu
                ? 'Добавьте функционал в проект через чат'
                : 'Add features to your project via chat'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <span className="text-xs bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full">
              {messages.filter(m => m.role === 'user').length}
            </span>
          )}
          <svg
            className={`w-5 h-5 text-zinc-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expandable content */}
      {isOpen && (
        <div className="border-t border-zinc-800">
          {/* Repo badge */}
          <div className="px-4 py-2 flex items-center justify-between bg-zinc-800/30">
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              {repoName}
            </a>
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
              >
                {isRu ? 'Очистить' : 'Clear'}
              </button>
            )}
          </div>

          {/* Messages area */}
          <div className="h-80 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && !loading && (
              <div className="text-center py-8">
                <div className="text-3xl mb-3">🛠️</div>
                <p className="text-sm text-zinc-500 max-w-xs mx-auto">
                  {isRu
                    ? 'Опишите функционал, который хотите добавить в проект. META Agent сгенерирует код и запушит в GitHub.'
                    : 'Describe the feature you want to add to your project. META Agent will generate code and push to GitHub.'}
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : msg.error
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-zinc-800 text-zinc-200'
                  }`}
                >
                  {/* Message text */}
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* File list */}
                  {msg.files_modified && msg.files_modified.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700/50">
                      <p className="text-xs text-zinc-400 mb-1">
                        {isRu
                          ? `${msg.files_modified.length} файл(ов) изменено:`
                          : `${msg.files_modified.length} file(s) modified:`}
                      </p>
                      <div className="space-y-0.5">
                        {msg.files_modified.map((file, i) => (
                          <div key={i} className="text-xs font-mono flex items-center gap-1.5">
                            <span className="text-emerald-400">+</span>
                            <span className="text-zinc-400">{file}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Commit link */}
                  {msg.commit_url && (
                    <a
                      href={msg.commit_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {isRu ? 'Посмотреть коммит' : 'View commit'}
                    </a>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 rounded-xl px-3.5 py-2.5 text-sm">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    {loadingSteps[loadingStep]}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick actions */}
          {messages.length === 0 && !loading && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(action.text)}
                  className="text-xs px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
                >
                  <span>{action.icon}</span>
                  {action.text}
                </button>
              ))}
            </div>
          )}

          {/* Input area */}
          <div className="p-3 border-t border-zinc-800 flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRu
                  ? 'Опишите функционал для добавления...'
                  : 'Describe the feature to add...'
              }
              disabled={loading}
              rows={1}
              className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-indigo-500/50 disabled:opacity-50"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
