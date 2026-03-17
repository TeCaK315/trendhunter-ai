import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/components/CommentSection.tsx': `'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';

interface Comment {
  id: string;
  content: string;
  user_id: string;
  user_name: string;
  user_avatar?: string;
  created_at: string;
}

interface CommentSectionProps {
  entityId: string;
  entityType?: string;
}

export default function CommentSection({ entityId, entityType = 'post' }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadComments();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id || null);
    });
  }, [entityId]);

  async function loadComments() {
    setLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('entity_id', entityId)
      .eq('entity_type', entityType)
      .order('created_at', { ascending: true });

    setComments(data || []);
    setLoading(false);
  }

  async function submitComment() {
    if (!content.trim() || sending) return;
    setSending(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', user.id)
      .single();

    const { data: newComment } = await supabase
      .from('comments')
      .insert({
        entity_id: entityId,
        entity_type: entityType,
        user_id: user.id,
        user_name: profile?.full_name || user.email?.split('@')[0] || 'User',
        user_avatar: profile?.avatar_url,
        content: content.trim(),
      })
      .select()
      .single();

    if (newComment) {
      setComments(prev => [...prev, newComment]);
    }
    setContent('');
    setSending(false);
  }

  async function deleteComment(id: string) {
    await supabase.from('comments').delete().eq('id', id);
    setComments(prev => prev.filter(c => c.id !== id));
  }

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return mins + ' мин';
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + ' ч';
    return Math.floor(hours / 24) + ' дн';
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5" style={{ color: '${t.primary}' }} />
        <h3 className="font-semibold" style={{ color: '${t.text}' }}>
          Комментарии ({comments.length})
        </h3>
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: '${t.primary}' }} />
        </div>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
                style={{ background: '${t.primary}' }}
              >
                {comment.user_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '${t.text}' }}>{comment.user_name}</span>
                  <span className="text-xs" style={{ color: '${t.text50}' }}>{relativeTime(comment.created_at)}</span>
                </div>
                <p className="text-sm mt-1" style={{ color: '${t.text80}' }}>{comment.content}</p>
                {currentUserId === comment.user_id && (
                  <button
                    onClick={() => deleteComment(comment.id)}
                    className="text-xs mt-1 hover:opacity-70"
                    style={{ color: '#ef4444' }}
                  >
                    Удалить
                  </button>
                )}
              </div>
            </div>
          ))}
          {comments.length === 0 && (
            <p className="text-sm text-center py-4" style={{ color: '${t.text50}' }}>Нет комментариев</p>
          )}
        </div>
      )}

      {/* Add comment */}
      <div className="flex gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Написать комментарий..."
          rows={2}
          className="flex-1 px-4 py-2.5 rounded-xl border text-sm resize-none"
          style={{ borderColor: '${t.primary40}', background: '${t.primary10}', color: '${t.text}' }}
        />
        <button
          onClick={submitComment}
          disabled={sending || !content.trim()}
          className="px-4 rounded-xl text-white transition-all disabled:opacity-50 self-end"
          style={{ background: '${t.gradientPrimary}' }}
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
`,
  };
}
