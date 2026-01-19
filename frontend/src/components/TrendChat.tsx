'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TrendContext {
  title: string;
  category: string;
  why_trending: string;
  analysis?: {
    main_pain?: string;
    key_pain_points?: string[];
    target_audience?: {
      segments?: Array<{
        name: string;
        size: string;
        willingness_to_pay: string;
        where_to_find?: string;
      }>;
    };
    real_sources?: {
      reddit?: { communities?: string[]; engagement?: number };
      youtube?: { channels?: string[] };
      google_trends?: { growth_rate?: number; related_queries?: Array<{ query: string; growth: string }> };
    };
  };
}

type AgentType = 'general' | 'developer' | 'marketing' | 'sales' | 'designer';

interface TrendChatProps {
  trendContext: TrendContext;
  className?: string;
}

const agents: { id: AgentType; label: string; icon: string; description: string }[] = [
  { id: 'general', label: 'Ассистент', icon: '🤖', description: 'Общие вопросы по проекту' },
  { id: 'developer', label: 'Developer', icon: '💻', description: 'Архитектура и код' },
  { id: 'marketing', label: 'Marketing', icon: '📈', description: 'Привлечение клиентов' },
  { id: 'sales', label: 'Sales', icon: '💰', description: 'Продажи и монетизация' },
  { id: 'designer', label: 'Designer', icon: '🎨', description: 'UX/UI и дизайн' },
];

// Быстрые действия для каждого агента
const quickPromptsByAgent: Record<AgentType, { text: string; icon: string }[]> = {
  general: [
    { text: 'Создай MVP план', icon: '🚀' },
    { text: 'Какие риски у проекта?', icon: '⚠️' },
    { text: 'Оцени потенциал рынка', icon: '📊' },
    { text: 'Сколько нужно инвестиций?', icon: '💵' },
  ],
  developer: [
    { text: 'Какой tech stack выбрать?', icon: '⚙️' },
    { text: 'Опиши архитектуру системы', icon: '🏗️' },
    { text: 'Сколько времени на MVP?', icon: '⏰' },
    { text: 'Какие API интеграции нужны?', icon: '🔌' },
  ],
  marketing: [
    { text: 'Как привлечь первых клиентов?', icon: '🎯' },
    { text: 'Какие каналы продвижения?', icon: '📢' },
    { text: 'Создай контент-план', icon: '📝' },
    { text: 'Какой бюджет на маркетинг?', icon: '💰' },
  ],
  sales: [
    { text: 'Сколько можно заработать?', icon: '💵' },
    { text: 'Какую модель монетизации?', icon: '💳' },
    { text: 'Как выстроить воронку продаж?', icon: '📈' },
    { text: 'Какую цену установить?', icon: '🏷️' },
  ],
  designer: [
    { text: 'Какой UI/UX нужен для MVP?', icon: '🎨' },
    { text: 'Опиши user journey', icon: '🗺️' },
    { text: 'Какой стиль бренда?', icon: '✨' },
    { text: 'Что важно для конверсии?', icon: '🎯' },
  ],
};

// Ключ для localStorage
const getStorageKey = (trendTitle: string, agentId: AgentType) =>
  `chat_${trendTitle.replace(/\s+/g, '_')}_${agentId}`;

export default function TrendChat({ trendContext, className = '' }: TrendChatProps) {
  // Отдельная история для каждого агента
  const [messagesByAgent, setMessagesByAgent] = useState<Record<AgentType, Message[]>>({
    general: [],
    developer: [],
    marketing: [],
    sales: [],
    designer: [],
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('general');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Загружаем историю из localStorage при монтировании
  useEffect(() => {
    const loadedMessages: Record<AgentType, Message[]> = {
      general: [],
      developer: [],
      marketing: [],
      sales: [],
      designer: [],
    };

    agents.forEach(agent => {
      const key = getStorageKey(trendContext.title, agent.id);
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          loadedMessages[agent.id] = JSON.parse(saved);
        } catch {
          // Игнорируем ошибки парсинга
        }
      }
    });

    setMessagesByAgent(loadedMessages);
  }, [trendContext.title]);

  // Сохраняем историю в localStorage при изменении
  const saveMessages = useCallback((agentId: AgentType, messages: Message[]) => {
    const key = getStorageKey(trendContext.title, agentId);
    localStorage.setItem(key, JSON.stringify(messages));
  }, [trendContext.title]);

  // Получаем сообщения текущего агента
  const messages = messagesByAgent[selectedAgent];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    const currentMessages = messagesByAgent[selectedAgent];
    const newMessages = [...currentMessages, userMessage];

    // Обновляем состояние и сохраняем
    setMessagesByAgent(prev => ({
      ...prev,
      [selectedAgent]: newMessages
    }));
    saveMessages(selectedAgent, newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages,
          agent_type: selectedAgent,
          trend_context: trendContext,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.success ? data.message : 'Произошла ошибка. Попробуйте ещё раз.'
      };

      const updatedMessages = [...newMessages, assistantMessage];
      setMessagesByAgent(prev => ({
        ...prev,
        [selectedAgent]: updatedMessages
      }));
      saveMessages(selectedAgent, updatedMessages);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: Message = { role: 'assistant', content: 'Ошибка соединения. Проверьте интернет.' };
      const updatedMessages = [...newMessages, errorMessage];
      setMessagesByAgent(prev => ({
        ...prev,
        [selectedAgent]: updatedMessages
      }));
      saveMessages(selectedAgent, updatedMessages);
    } finally {
      setLoading(false);
    }
  };

  // Очистка истории текущего агента
  const clearCurrentChat = () => {
    setMessagesByAgent(prev => ({
      ...prev,
      [selectedAgent]: []
    }));
    const key = getStorageKey(trendContext.title, selectedAgent);
    localStorage.removeItem(key);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const currentAgent = agents.find((a) => a.id === selectedAgent) || agents[0];

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/30 transition-all hover:scale-105 ${className}`}
      >
        <span className="text-xl">💬</span>
        <span className="font-medium">Чат с AI</span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 z-50 w-[420px] max-h-[600px] bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-900/95">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{currentAgent.icon}</span>
          <div>
            <div className="font-medium text-white">{currentAgent.label}</div>
            <div className="text-xs text-zinc-400">{currentAgent.description}</div>
          </div>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Agent Selector */}
      <div className="flex gap-1 p-2 border-b border-zinc-800 bg-zinc-900/50 overflow-x-auto">
        {agents.map((agent) => {
          const msgCount = messagesByAgent[agent.id].length;
          return (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent.id)}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
                selectedAgent === agent.id
                  ? 'bg-indigo-500/20 text-indigo-400'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
              }`}
            >
              <span>{agent.icon}</span>
              <span>{agent.label}</span>
              {msgCount > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                  selectedAgent === agent.id
                    ? 'bg-indigo-500/30 text-indigo-300'
                    : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {msgCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[300px]">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">{currentAgent.icon}</div>
            <div className="text-white font-medium mb-2">Привет! Я {currentAgent.label}</div>
            <div className="text-sm text-zinc-400">
              Задай вопрос о тренде &quot;{trendContext.title}&quot;
            </div>
            <div className="text-xs text-zinc-500 mt-2">
              Используй быстрые действия ниже или напиши свой вопрос
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-md'
                      : 'bg-zinc-800 text-zinc-200 rounded-bl-md'
                  }`}
                >
                  <div className="prose prose-sm prose-invert max-w-none">
                    {msg.content.split('\n').map((line, j) => (
                      <p key={j} className="mb-1 last:mb-0">
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-zinc-800 text-zinc-400 p-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-zinc-600 border-t-indigo-400 rounded-full" />
                    <span className="text-sm">Думаю...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input + Quick Actions */}
      <div className="border-t border-zinc-800 bg-zinc-900/95">
        {/* Quick Actions - всегда видны */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex flex-wrap gap-1.5">
            {quickPromptsByAgent[selectedAgent].map((prompt, i) => (
              <button
                key={i}
                onClick={() => sendMessage(prompt.text)}
                disabled={loading}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 rounded-lg text-xs transition-colors border border-zinc-700 hover:border-zinc-600"
              >
                <span>{prompt.icon}</span>
                <span>{prompt.text}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Input Field */}
        <form onSubmit={handleSubmit} className="px-3 pb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Напиши сообщение..."
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
            />
            {messages.length > 0 && (
              <button
                type="button"
                onClick={clearCurrentChat}
                disabled={loading}
                className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-400 hover:text-white rounded-xl transition-all"
                title="Очистить историю"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
