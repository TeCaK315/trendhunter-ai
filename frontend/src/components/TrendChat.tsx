'use client';

import { useState, useRef, useEffect } from 'react';

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

export default function TrendChat({ trendContext, className = '' }: TrendChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('general');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          agent_type: selectedAgent,
          trend_context: trendContext,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: 'Произошла ошибка. Попробуйте ещё раз.' }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Ошибка соединения. Проверьте интернет.' }]);
    } finally {
      setLoading(false);
    }
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
        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-all ${
              selectedAgent === agent.id
                ? 'bg-indigo-500/20 text-indigo-400'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
            }`}
          >
            <span>{agent.icon}</span>
            <span>{agent.label}</span>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] max-h-[350px]">
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">{currentAgent.icon}</div>
            <div className="text-white font-medium mb-2">Привет! Я {currentAgent.label}</div>
            <div className="text-sm text-zinc-400 mb-4">
              Задай вопрос о тренде &quot;{trendContext.title}&quot;
            </div>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickPromptsByAgent[selectedAgent].map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(prompt.text)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-sm transition-colors"
                >
                  <span>{prompt.icon}</span>
                  <span>{prompt.text}</span>
                </button>
              ))}
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-zinc-800 bg-zinc-900/95">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напиши сообщение..."
            disabled={loading}
            className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500 text-sm"
          />
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
  );
}
