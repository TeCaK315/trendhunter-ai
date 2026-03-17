import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  ctx.migrations.push(`
-- Conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  participant_1 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2, listing_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Authenticated users can create conversations"
  ON conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_conversations_participants ON conversations(participant_1, participant_2);
`);

  return {
    // ─── Messages Page ───
    'src/app/dashboard/messages/page.tsx': `'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Send, Loader2, ArrowLeft, User, Circle } from 'lucide-react';

interface Conversation {
  id: string;
  other_user_email: string;
  other_user_id: string;
  listing_id: string | null;
  last_message_at: string;
  unread_count: number;
}

interface Message {
  id: string;
  sender_id: string;
  content: string;
  read: boolean;
  created_at: string;
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    initUser();
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeConversation) {
      fetchMessages(activeConversation);
      subscribeToMessages(activeConversation);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const initUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
  };

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setConversations(data.conversations);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const res = await fetch(\`/api/messages?conversationId=\${conversationId}\`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setMessages(data.messages);
    } catch (err) {
      console.error(err);
    }
  };

  const subscribeToMessages = (conversationId: string) => {
    const channel = supabase
      .channel(\`messages:\${conversationId}\`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: \`conversation_id=eq.\${conversationId}\`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversation,
          content: newMessage.trim(),
        }),
      });

      if (!res.ok) throw new Error('Failed to send');
      setNewMessage('');
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const activeConv = conversations.find((c) => c.id === activeConversation);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '${t.bg}' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ background: '${t.bg}', color: '${t.text}' }}>
      {/* Sidebar: Conversation List */}
      <div
        className={\`\${activeConversation ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-80 lg:w-96 border-r\`}
        style={{ borderColor: '${t.primary20}' }}
      >
        <div className="p-4 border-b" style={{ borderColor: '${t.primary20}' }}>
          <h1 className="text-xl font-bold flex items-center gap-2" style={{ fontFamily: '${t.headingFont}' }}>
            <MessageSquare className="w-5 h-5" style={{ color: '${t.primary}' }} />
            Messages
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center" style={{ color: '${t.text50}' }}>
              <MessageSquare className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No conversations yet</p>
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={\`w-full p-4 flex items-center gap-3 text-left border-b transition-colors hover:bg-white/5 \${
                  activeConversation === conv.id ? 'bg-white/5' : ''
                }\`}
                style={{ borderColor: '${t.primary10}' }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                     style={{ background: '${t.primary20}', color: '${t.primary}' }}>
                  {conv.other_user_email[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{conv.other_user_email}</span>
                    <span className="text-xs flex-shrink-0" style={{ color: '${t.text50}' }}>
                      {new Date(conv.last_message_at).toLocaleDateString()}
                    </span>
                  </div>
                  {conv.unread_count > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Circle className="w-2 h-2 fill-current" style={{ color: '${t.accent}' }} />
                      <span className="text-xs" style={{ color: '${t.accent}' }}>
                        {conv.unread_count} new
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main: Message View */}
      <div className={\`\${activeConversation ? 'flex' : 'hidden md:flex'} flex-col flex-1\`}>
        {activeConversation && activeConv ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b flex items-center gap-3" style={{ borderColor: '${t.primary20}' }}>
              <button
                onClick={() => setActiveConversation(null)}
                className="md:hidden p-1"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                   style={{ background: '${t.primary20}', color: '${t.primary}' }}>
                {activeConv.other_user_email[0].toUpperCase()}
              </div>
              <span className="font-medium">{activeConv.other_user_email}</span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => {
                const isMine = msg.sender_id === userId;
                return (
                  <div key={msg.id} className={\`flex \${isMine ? 'justify-end' : 'justify-start'}\`}>
                    <div
                      className="max-w-[75%] px-4 py-2.5 rounded-2xl text-sm"
                      style={{
                        background: isMine ? '${t.primary}' : '${t.primary20}',
                        color: isMine ? 'white' : '${t.text}',
                        borderBottomRightRadius: isMine ? '4px' : undefined,
                        borderBottomLeftRadius: !isMine ? '4px' : undefined,
                      }}
                    >
                      <p>{msg.content}</p>
                      <p className="text-[10px] mt-1 opacity-60 text-right">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-4 border-t flex gap-3" style={{ borderColor: '${t.primary20}' }}>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="p-3 rounded-xl transition-colors disabled:opacity-50"
                style={{ background: '${t.primary}', color: 'white' }}
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ color: '${t.text50}' }}>
            <div className="text-center">
              <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-20" />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`,

    // ─── Messages API ───
    'src/app/api/messages/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── GET: List conversations or messages in a conversation ───

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  // If conversationId provided, fetch messages for that conversation
  if (conversationId) {
    // Verify user is part of conversation
    const { data: conv } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversationId)
      .or(\`participant_1.eq.\${user.id},participant_2.eq.\${user.id}\`)
      .single();

    if (!conv) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const { data: messages, error } = await supabase
      .from('messages')
      .select('id, sender_id, content, read, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Mark unread messages as read
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('read', false);

    return NextResponse.json({ messages: messages || [] });
  }

  // Otherwise, list all conversations for the user
  const { data: convos, error } = await supabase
    .from('conversations')
    .select('*')
    .or(\`participant_1.eq.\${user.id},participant_2.eq.\${user.id}\`)
    .order('last_message_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build conversation list with other user info and unread count
  const conversations = await Promise.all(
    (convos || []).map(async (conv) => {
      const otherUserId =
        conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;

      // Get other user's email
      const { data: otherUser } = await supabase.auth.admin.getUserById(otherUserId);

      // Get unread count
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', user.id)
        .eq('read', false);

      return {
        id: conv.id,
        other_user_email: otherUser?.user?.email || 'Unknown',
        other_user_id: otherUserId,
        listing_id: conv.listing_id,
        last_message_at: conv.last_message_at,
        unread_count: count || 0,
      };
    })
  );

  return NextResponse.json({ conversations });
}

// ─── POST: Send a message ───

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { conversationId, recipientId, listingId, content } = body;

  if (!content?.trim()) {
    return NextResponse.json({ error: 'Message content is required' }, { status: 400 });
  }

  let convId = conversationId;

  // If no conversationId, create or find one
  if (!convId && recipientId) {
    // Check if conversation already exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        \`and(participant_1.eq.\${user.id},participant_2.eq.\${recipientId}),and(participant_1.eq.\${recipientId},participant_2.eq.\${user.id})\`
      )
      .eq('listing_id', listingId || null)
      .single();

    if (existing) {
      convId = existing.id;
    } else {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          participant_1: user.id,
          participant_2: recipientId,
          listing_id: listingId || null,
        })
        .select('id')
        .single();

      if (convError) {
        return NextResponse.json({ error: convError.message }, { status: 500 });
      }
      convId = newConv.id;
    }
  }

  if (!convId) {
    return NextResponse.json(
      { error: 'Either conversationId or recipientId is required' },
      { status: 400 }
    );
  }

  // Send message
  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: convId,
      sender_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update last_message_at on conversation
  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', convId);

  return NextResponse.json({ message, conversationId: convId }, { status: 201 });
}
`,
  };
}
