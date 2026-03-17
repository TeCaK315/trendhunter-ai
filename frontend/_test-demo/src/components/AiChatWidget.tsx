'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, Loader2, Trash2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AiChatWidgetProps {
  sessionId?: string;
  placeholder?: string;
  systemContext?: string;
}

export default function AiChatWidget({ sessionId, placeholder, systemContext }: AiChatWidgetProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamText, setStreamText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const currentSessionId = useRef(sessionId || crypto.randomUUID());

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamText]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStreamText('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: currentSessionId.current,
          context: systemContext,
          history: messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) throw new Error('Chat request failed');

      // Handle streaming response
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setStreamText(fullText);
        }
      } else {
        const data = await res.json();
        fullText = data.response || data.content || '';
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: fullText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setStreamText('');
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Произошла ошибка. Попробуйте ещё раз.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
      setStreamText('');
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, systemContext]);

  function clearChat() {
    setMessages([]);
    currentSessionId.current = crypto.randomUUID();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="flex flex-col h-full rounded-2xl border overflow-hidden" style={{ borderColor: '#6366f140' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#6366f120', background: '#6366f110' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#e2e8f0' }}>AI Ассистент</h3>
            <p className="text-xs" style={{ color: '#e2e8f070' }}>Онлайн</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="p-2 rounded-lg hover:opacity-70 transition-all" style={{ color: '#e2e8f070' }}>
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: '#0f0f23', minHeight: 300 }}>
        {messages.length === 0 && !streamText && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: '#6366f140' }} />
            <p className="font-medium mb-2" style={{ color: '#e2e8f0' }}>Начните диалог</p>
            <p className="text-sm" style={{ color: '#e2e8f070' }}>
              Задайте вопрос, и AI ассистент ответит на основе имеющихся данных.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#6366f120' }}>
                <Bot className="w-4 h-4" style={{ color: '#6366f1' }} />
              </div>
            )}
            <div
              className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
              }`}
              style={{
                background: msg.role === 'user' ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : '#6366f110',
                color: msg.role === 'user' ? 'white' : '#e2e8f0',
              }}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#6366f120' }}>
                <User className="w-4 h-4" style={{ color: '#6366f1' }} />
              </div>
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {streamText && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#6366f120' }}>
              <Bot className="w-4 h-4" style={{ color: '#6366f1' }} />
            </div>
            <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md text-sm whitespace-pre-wrap" style={{ background: '#6366f110', color: '#e2e8f0' }}>
              {streamText}
              <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ background: '#6366f1' }} />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {loading && !streamText && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#6366f120' }}>
              <Bot className="w-4 h-4" style={{ color: '#6366f1' }} />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: '#6366f110' }}>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#6366f1', animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#6366f1', animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '#6366f1', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4" style={{ borderColor: '#6366f120', background: '#6366f110' }}>
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || 'Введите сообщение...'}
            rows={1}
            className="flex-1 resize-none px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: '#6366f140',
              background: '#0f0f23',
              color: '#e2e8f0',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 rounded-xl text-white transition-all disabled:opacity-50 flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '#e2e8f050' }}>
          Enter — отправить, Shift+Enter — новая строка
        </p>
      </div>
    </div>
  );
}
