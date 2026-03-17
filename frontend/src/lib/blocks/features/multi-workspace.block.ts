import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/app/dashboard/workspace/page.tsx': `'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building2, Plus, Users, Settings, Crown, Loader2, UserPlus, X } from 'lucide-react';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  member_count: number;
  created_at: string;
}

export default function WorkspacePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [activeWs, setActiveWs] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const supabase = createClient();

  useEffect(() => { loadWorkspaces(); }, []);

  async function loadWorkspaces() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id, workspaces(*)')
      .eq('user_id', user.id);

    const ws = (data || [])
      .map((d: any) => d.workspaces)
      .filter(Boolean);

    setWorkspaces(ws);
    if (ws.length > 0 && !activeWs) setActiveWs(ws[0].id);
    setLoading(false);
  }

  async function createWorkspace() {
    if (!newName.trim()) return;
    setCreating(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]/g, '-');

    const { data: ws } = await supabase
      .from('workspaces')
      .insert({ name: newName.trim(), slug, owner_id: user.id, member_count: 1 })
      .select()
      .single();

    if (ws) {
      await supabase.from('workspace_members').insert({
        workspace_id: ws.id,
        user_id: user.id,
        role: 'owner',
      });
      setWorkspaces(prev => [...prev, ws]);
      setActiveWs(ws.id);
    }

    setNewName('');
    setCreating(false);
  }

  async function inviteMember() {
    if (!inviteEmail.trim() || !activeWs) return;

    await supabase.from('workspace_invites').insert({
      workspace_id: activeWs,
      email: inviteEmail.trim().toLowerCase(),
      invited_by: currentUserId,
    });

    setInviteEmail('');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '${t.bg}' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <Building2 className="w-7 h-7" style={{ color: '${t.primary}' }} />
          <h1 className="text-2xl font-heading font-bold" style={{ color: '${t.text}' }}>
            Рабочие пространства
          </h1>
        </div>

        {/* Workspace list */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {workspaces.map(ws => (
            <button
              key={ws.id}
              onClick={() => setActiveWs(ws.id)}
              className="p-5 rounded-2xl border text-left transition-all hover:scale-[1.02]"
              style={{
                borderColor: activeWs === ws.id ? '${t.primary}' : '${t.primary40}',
                background: activeWs === ws.id ? '${t.primary10}' : 'transparent',
              }}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '${t.gradientPrimary}' }}>
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold" style={{ color: '${t.text}' }}>{ws.name}</h3>
                  <p className="text-xs flex items-center gap-1" style={{ color: '${t.text50}' }}>
                    <Users className="w-3 h-3" /> {ws.member_count || 1} участник
                    {ws.owner_id === currentUserId && (
                      <span className="ml-1 flex items-center gap-0.5" style={{ color: '#f59e0b' }}>
                        <Crown className="w-3 h-3" /> Владелец
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </button>
          ))}

          {/* Create new */}
          <div className="p-5 rounded-2xl border border-dashed" style={{ borderColor: '${t.primary40}' }}>
            <div className="flex gap-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Новое пространство..."
                className="flex-1 px-3 py-2 rounded-xl border text-sm"
                style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
              />
              <button
                onClick={createWorkspace}
                disabled={creating || !newName.trim()}
                className="px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ background: '${t.gradientPrimary}' }}
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Invite members */}
        {activeWs && (
          <div className="rounded-2xl border p-6" style={{ borderColor: '${t.primary40}' }}>
            <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '${t.text}' }}>
              <UserPlus className="w-5 h-5" style={{ color: '${t.primary}' }} />
              Пригласить участника
            </h2>
            <div className="flex gap-3">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email участника..."
                type="email"
                className="flex-1 px-4 py-2 rounded-xl border text-sm"
                style={{ borderColor: '${t.primary40}', background: '${t.bg}', color: '${t.text}' }}
              />
              <button
                onClick={inviteMember}
                disabled={!inviteEmail.trim()}
                className="px-6 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ background: '${t.gradientPrimary}' }}
              >
                Пригласить
              </button>
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
