import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/InAppMessaging.tsx': `'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send, Search, Circle, Check, CheckCheck, ArrowLeft } from 'lucide-react';

interface Message {
  id: string;
  from: string;
  to: string;
  text: string;
  timestamp: string;
  read: boolean;
}

interface Conversation {
  userId: string;
  userName: string;
  avatar?: string;
  lastMessage?: string;
  lastTimestamp?: string;
  unread: number;
}

interface InAppMessagingProps {
  currentUserId: string;
  conversations: Conversation[];
  messages: Message[];
  onSend?: (to: string, text: string) => void;
  onSelectConversation?: (userId: string) => void;
}

export default function InAppMessaging({
  currentUserId,
  conversations,
  messages,
  onSend,
  onSelectConversation,
}: InAppMessagingProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? conversations.filter(c => c.userName.toLowerCase().includes(search.toLowerCase()))
    : conversations;

  const chatMessages = selected
    ? messages.filter(m => (m.from === selected && m.to === currentUserId) || (m.from === currentUserId && m.to === selected))
    : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length]);

  function handleSend() {
    if (!input.trim() || !selected) return;
    onSend?.(selected, input.trim());
    setInput('');
  }

  function formatTime(ts: string): string {
    const d = new Date(ts);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  const selectedConv = conversations.find(c => c.userId === selected);

  return (
    <div className="rounded-2xl border overflow-hidden flex" style={{ borderColor: '${t.primary40}', height: 500 }}>
      {/* Conversations list */}
      <div className={\`\${selected ? 'hidden sm:flex' : 'flex'} flex-col w-full sm:w-80 border-r\`}
        style={{ borderColor: '${t.primary40}' }}>
        <div className="p-3 border-b" style={{ borderColor: '${t.primary40}' }}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '${t.text50}' }} />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Поиск..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-sm"
              style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => (
            <button key={conv.userId}
              onClick={() => { setSelected(conv.userId); onSelectConversation?.(conv.userId); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 border-b transition-all"
              style={{
                borderColor: '${t.primary40}',
                background: selected === conv.userId ? '${t.primary10}' : 'transparent',
              }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: '${t.gradientPrimary}' }}>
                {conv.avatar ? <img src={conv.avatar} alt="" className="w-full h-full rounded-full object-cover" /> : conv.userName.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between">
                  <span className="text-sm font-medium truncate" style={{ color: '${t.text}' }}>{conv.userName}</span>
                  {conv.lastTimestamp && <span className="text-xs flex-shrink-0" style={{ color: '${t.text50}' }}>{formatTime(conv.lastTimestamp)}</span>}
                </div>
                {conv.lastMessage && <p className="text-xs truncate mt-0.5" style={{ color: '${t.text50}' }}>{conv.lastMessage}</p>}
              </div>
              {conv.unread > 0 && (
                <span className="w-5 h-5 rounded-full text-xs text-white flex items-center justify-center font-bold flex-shrink-0"
                  style={{ background: '${t.primary}' }}>{conv.unread}</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="py-12 text-center">
              <MessageSquare className="w-8 h-8 mx-auto mb-2" style={{ color: '${t.text50}' }} />
              <p className="text-xs" style={{ color: '${t.text50}' }}>Нет диалогов</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={\`\${selected ? 'flex' : 'hidden sm:flex'} flex-col flex-1\`}>
        {selected && selectedConv ? (
          <>
            <div className="flex items-center gap-3 p-3 border-b" style={{ borderColor: '${t.primary40}' }}>
              <button onClick={() => setSelected(null)} className="sm:hidden p-1">
                <ArrowLeft className="w-5 h-5" style={{ color: '${t.text50}' }} />
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                style={{ background: '${t.gradientPrimary}' }}>
                {selectedConv.userName.charAt(0)}
              </div>
              <span className="text-sm font-medium" style={{ color: '${t.text}' }}>{selectedConv.userName}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.map(msg => {
                const isMine = msg.from === currentUserId;
                return (
                  <div key={msg.id} className={\`flex \${isMine ? 'justify-end' : 'justify-start'}\`}>
                    <div className="max-w-[70%] px-3 py-2 rounded-2xl text-sm"
                      style={{
                        background: isMine ? '${t.primary}' : '${t.primary10}',
                        color: isMine ? '#fff' : '${t.text}',
                      }}>
                      <p>{msg.text}</p>
                      <div className={\`flex items-center gap-1 mt-1 \${isMine ? 'justify-end' : ''}\`}>
                        <span className="text-xs opacity-70">{formatTime(msg.timestamp)}</span>
                        {isMine && (msg.read ? <CheckCheck className="w-3 h-3 opacity-70" /> : <Check className="w-3 h-3 opacity-70" />)}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="p-3 border-t flex gap-2" style={{ borderColor: '${t.primary40}' }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                placeholder="Написать сообщение..."
                className="flex-1 px-4 py-2.5 rounded-xl border text-sm"
                style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }} />
              <button onClick={handleSend} disabled={!input.trim()}
                className="p-2.5 rounded-xl text-white disabled:opacity-50"
                style={{ background: '${t.primary}' }}>
                <Send className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-3" style={{ color: '${t.text50}' }} />
              <p className="text-sm" style={{ color: '${t.text50}' }}>Выберите диалог</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`,
  };
}
