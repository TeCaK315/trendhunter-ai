import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName || 'AI Assistant';
  const aiHint = ctx.product_spec.magic_location?.ai_prompt_hint ||
    'You are a helpful assistant. Answer questions based on the provided context.';

  return {
    'src/components/AiChatWidget.tsx': `'use client';

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
    <div className="flex flex-col h-full rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '${t.primary20}', background: '${t.primary10}' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: '${t.gradientPrimary}' }}>
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '${t.text}' }}>AI Ассистент</h3>
            <p className="text-xs" style={{ color: '${t.text70}' }}>Онлайн</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="p-2 rounded-lg hover:opacity-70 transition-all" style={{ color: '${t.text70}' }}>
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4" style={{ background: '${t.bg}', minHeight: 300 }}>
        {messages.length === 0 && !streamText && (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 mx-auto mb-4" style={{ color: '${t.primary40}' }} />
            <p className="font-medium mb-2" style={{ color: '${t.text}' }}>Начните диалог</p>
            <p className="text-sm" style={{ color: '${t.text70}' }}>
              Задайте вопрос, и AI ассистент ответит на основе имеющихся данных.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={\`flex gap-3 \${msg.role === 'user' ? 'justify-end' : 'justify-start'}\`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '${t.primary20}' }}>
                <Bot className="w-4 h-4" style={{ color: '${t.primary}' }} />
              </div>
            )}
            <div
              className={\`max-w-[80%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap \${
                msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
              }\`}
              style={{
                background: msg.role === 'user' ? '${t.gradientPrimary}' : '${t.primary10}',
                color: msg.role === 'user' ? 'white' : '${t.text}',
              }}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '${t.primary20}' }}>
                <User className="w-4 h-4" style={{ color: '${t.primary}' }} />
              </div>
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {streamText && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '${t.primary20}' }}>
              <Bot className="w-4 h-4" style={{ color: '${t.primary}' }} />
            </div>
            <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-bl-md text-sm whitespace-pre-wrap" style={{ background: '${t.primary10}', color: '${t.text}' }}>
              {streamText}
              <span className="inline-block w-2 h-4 ml-1 animate-pulse" style={{ background: '${t.primary}' }} />
            </div>
          </div>
        )}

        {/* Typing indicator */}
        {loading && !streamText && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '${t.primary20}' }}>
              <Bot className="w-4 h-4" style={{ color: '${t.primary}' }} />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-md" style={{ background: '${t.primary10}' }}>
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '${t.primary}', animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '${t.primary}', animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: '${t.primary}', animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t p-4" style={{ borderColor: '${t.primary20}', background: '${t.primary10}' }}>
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
              borderColor: '${t.primary40}',
              background: '${t.bg}',
              color: '${t.text}',
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="px-4 rounded-xl text-white transition-all disabled:opacity-50 flex items-center justify-center"
            style={{ background: '${t.gradientPrimary}' }}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: '${t.text50}' }}>
          Enter — отправить, Shift+Enter — новая строка
        </p>
      </div>
    </div>
  );
}
`,

    'src/app/api/chat/route.ts': `import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, context, history } = await req.json();

    if (!message) {
      return new Response(JSON.stringify({ error: 'No message provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Build system prompt
    const systemPrompt = context
      || \`${aiHint.replace(/`/g, "'").replace(/\\/g, '\\\\').replace(/\$/g, '\\$')}\`;

    // Build messages array
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history || []).map((m: any) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message },
    ];

    // Stream response
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${apiKey}\`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!openaiRes.ok) {
      const errorData = await openaiRes.json().catch(() => ({}));
      return new Response(JSON.stringify({ error: 'AI service error', details: errorData }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Transform OpenAI stream to text stream
    const reader = openaiRes.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: 'No response stream' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const decoder = new TextDecoder();
    let fullResponse = '';

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value, { stream: true });
            const lines = text.split('\\n').filter(l => l.trim().startsWith('data: '));

            for (const line of lines) {
              const data = line.replace('data: ', '').trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  fullResponse += content;
                  controller.enqueue(new TextEncoder().encode(content));
                }
              } catch {
                // Skip invalid JSON chunks
              }
            }
          }

          // Save to Supabase after completion
          if (supabaseUrl && supabaseKey && sessionId) {
            try {
              const supabase = createClient(supabaseUrl, supabaseKey);
              await supabase.from('chat_messages').insert([
                {
                  session_id: sessionId,
                  role: 'user',
                  content: message,
                },
                {
                  session_id: sessionId,
                  role: 'assistant',
                  content: fullResponse,
                },
              ]);
            } catch (e) {
              console.error('Failed to save chat messages:', e);
            }
          }

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    console.error('Chat API error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
`,

    'src/app/dashboard/chat/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Upload, FileText, X, Loader2 } from 'lucide-react';
import AiChatWidget from '@/components/AiChatWidget';

export default function ChatPage() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [contextText, setContextText] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setDocuments(data);
      // Build context from all documents
      const ctx = data.map((d: any) => d.content).filter(Boolean).join('\\n\\n---\\n\\n');
      if (ctx) {
        setContextText(\`Use the following knowledge base to answer questions. If the answer is not in the knowledge base, say so.\\n\\nKnowledge base:\\n\${ctx}\`);
      }
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const text = await file.text();

      await supabase.from('documents').insert({
        user_id: user.id,
        name: file.name,
        content: text.substring(0, 50000), // Limit to 50K chars
        file_type: file.name.split('.').pop() || 'txt',
      });

      await loadDocuments();
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  }

  async function removeDocument(id: string) {
    await supabase.from('documents').delete().eq('id', id);
    await loadDocuments();
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <MessageSquare className="w-7 h-7" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-heading font-bold" style={{ color: '${t.text}' }}>
            AI Чат
          </h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Documents sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border p-5" style={{ borderColor: '${t.primary40}' }}>
              <h2 className="font-semibold mb-4" style={{ color: '${t.text}' }}>
                База знаний
              </h2>
              <p className="text-sm mb-4" style={{ color: '${t.text70}' }}>
                Загрузите документы (.txt, .md, .csv), и AI будет использовать их для ответов.
              </p>

              {/* Upload button */}
              <label
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-all hover:opacity-80 mb-4"
                style={{ background: '${t.gradientPrimary}', color: 'white' }}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? 'Загрузка...' : 'Загрузить документ'}
                <input
                  type="file"
                  accept=".txt,.md,.csv,.json"
                  className="hidden"
                  onChange={handleUpload}
                  disabled={uploading}
                />
              </label>

              {/* Document list */}
              <div className="space-y-2">
                {documents.length === 0 && (
                  <p className="text-sm py-4 text-center" style={{ color: '${t.text50}' }}>
                    Нет загруженных документов
                  </p>
                )}
                {documents.map(doc => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl"
                    style={{ background: '${t.primary10}' }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 flex-shrink-0" style={{ color: '${t.primary}' }} />
                      <span className="text-sm truncate" style={{ color: '${t.text}' }}>
                        {doc.name}
                      </span>
                    </div>
                    <button
                      onClick={() => removeDocument(doc.id)}
                      className="p-1 rounded hover:opacity-70 flex-shrink-0"
                      style={{ color: '${t.text70}' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat area */}
          <div className="lg:col-span-2 h-[600px]">
            <AiChatWidget
              systemContext={contextText || undefined}
              placeholder="Задайте вопрос по базе знаний..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
`,
  };
}
