import type { BlockContext, BlockResult } from '../../types';
import { createDesignTokens } from '../../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  ctx.migrations.push(`
-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members table
CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  status TEXT NOT NULL DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  UNIQUE(team_id, email)
);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team owners can manage teams"
  ON teams FOR ALL
  USING (auth.uid() = owner_id);

CREATE POLICY "Team members can view their teams"
  ON teams FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members
      WHERE team_members.team_id = teams.id
      AND team_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can view members"
  ON team_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team admins can manage members"
  ON team_members FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_members.team_id
      AND tm.user_id = auth.uid()
      AND tm.role IN ('owner', 'admin')
    )
  );
`);

  return {
    'src/app/dashboard/team/page.tsx': `'use client';

import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield, Loader2, Mail, ChevronDown } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending';
  joined_at: string | null;
  invited_at: string;
}

const ROLES = ['owner', 'admin', 'member'] as const;

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('member');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      const res = await fetch('/api/team');
      if (!res.ok) throw new Error('Failed to load team');
      const data = await res.json();
      setMembers(data.members);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to invite');
      }

      setSuccess(\`Invitation sent to \${inviteEmail}\`);
      setInviteEmail('');
      fetchMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (memberId: string, memberEmail: string) => {
    if (!confirm(\`Remove \${memberEmail} from the team?\`)) return;

    try {
      const res = await fetch(\`/api/team?memberId=\${memberId}\`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to remove member');
      setMembers(members.filter((m) => m.id !== memberId));
      setSuccess(\`\${memberEmail} has been removed\`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, role: newRole, action: 'changeRole' }),
      });

      if (!res.ok) throw new Error('Failed to change role');
      setMembers(members.map((m) => (m.id === memberId ? { ...m, role: newRole as any } : m)));
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '${t.bg}' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '${t.primary}' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ background: '${t.bg}', color: '${t.text}' }}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
               style={{ background: '${t.gradientPrimary}' }}>
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: '${t.headingFont}' }}>
              Team Management
            </h1>
            <p className="text-sm" style={{ color: '${t.text70}' }}>
              Manage your ${name} team members
            </p>
          </div>
        </div>

        {/* Notifications */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg text-sm"
               style={{ background: '${t.primary20}', border: '1px solid ${t.primary40}', color: '${t.primary}' }}>
            {success}
          </div>
        )}

        {/* Invite Form */}
        <div className="rounded-2xl border p-6 mb-8"
             style={{ borderColor: '${t.primary20}', background: '${t.primary10}' }}>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5" style={{ color: '${t.primary}' }} />
            Invite Member
          </h2>
          <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@email.com"
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{
                  background: '${t.bg}',
                  borderColor: '${t.primary40}',
                  color: '${t.text}',
                }}
                required
              />
            </div>
            <div className="relative">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="appearance-none px-4 py-3 pr-10 rounded-xl border focus:outline-none focus:ring-2 cursor-pointer"
                style={{
                  background: '${t.bg}',
                  borderColor: '${t.primary40}',
                  color: '${t.text}',
                }}
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                           style={{ color: '${t.text70}' }} />
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="px-6 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
              style={{ background: '${t.primary}', color: 'white' }}
            >
              {inviting ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Send Invite'}
            </button>
          </form>
        </div>

        {/* Members List */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary20}' }}>
          <div className="px-6 py-4 border-b" style={{ borderColor: '${t.primary20}' }}>
            <h2 className="font-semibold">
              Members ({members.length})
            </h2>
          </div>
          <div className="divide-y" style={{ borderColor: '${t.primary10}' }}>
            {members.map((member) => (
              <div key={member.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                       style={{ background: '${t.primary20}', color: '${t.primary}' }}>
                    {member.email[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{member.email}</span>
                      {member.status === 'pending' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                          Pending
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs mt-1" style={{ color: '${t.text50}' }}>
                      <Mail className="w-3 h-3" />
                      {member.joined_at
                        ? \`Joined \${new Date(member.joined_at).toLocaleDateString()}\`
                        : \`Invited \${new Date(member.invited_at).toLocaleDateString()}\`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {member.role === 'owner' ? (
                    <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                          style={{ background: '${t.primary20}', color: '${t.primary}' }}>
                      <Shield className="w-3 h-3" /> Owner
                    </span>
                  ) : (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg border appearance-none cursor-pointer"
                        style={{
                          background: '${t.bg}',
                          borderColor: '${t.primary40}',
                          color: '${t.text}',
                        }}
                      >
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => handleRemove(member.id, member.email)}
                        className="p-2 rounded-lg hover:bg-red-500/10 transition-colors text-red-400"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {members.length === 0 && (
              <div className="px-6 py-12 text-center" style={{ color: '${t.text50}' }}>
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No team members yet. Invite someone to get started!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`,

    'src/app/api/team/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// ─── GET: List team members ───

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find user's team (as owner) or create one
  let { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!team) {
    const { data: newTeam, error: createError } = await supabase
      .from('teams')
      .insert({ name: 'My Team', owner_id: user.id })
      .select('id')
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Add owner as a member
    await supabase.from('team_members').insert({
      team_id: newTeam.id,
      user_id: user.id,
      email: user.email!,
      role: 'owner',
      status: 'active',
      joined_at: new Date().toISOString(),
    });

    team = newTeam;
  }

  const { data: members, error } = await supabase
    .from('team_members')
    .select('id, email, role, status, joined_at, invited_at')
    .eq('team_id', team.id)
    .order('role', { ascending: true })
    .order('invited_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members });
}

// ─── POST: Invite member or change role ───

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

  // Find user's team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Change role action
  if (body.action === 'changeRole') {
    const { memberId, role } = body;

    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { error } = await supabase
      .from('team_members')
      .update({ role })
      .eq('id', memberId)
      .eq('team_id', team.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  // Invite action
  const { email, role = 'member' } = body;

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from('team_members')
    .select('id')
    .eq('team_id', team.id)
    .eq('email', email)
    .single();

  if (existing) {
    return NextResponse.json({ error: 'This email is already on the team' }, { status: 409 });
  }

  const { data: member, error } = await supabase
    .from('team_members')
    .insert({
      team_id: team.id,
      email,
      role,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // TODO: Send invitation email via Resend / SendGrid

  return NextResponse.json({ member }, { status: 201 });
}

// ─── DELETE: Remove member ───

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const memberId = searchParams.get('memberId');

  if (!memberId) {
    return NextResponse.json({ error: 'Member ID is required' }, { status: 400 });
  }

  // Find user's team
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (!team) {
    return NextResponse.json({ error: 'Team not found' }, { status: 404 });
  }

  // Prevent removing the owner
  const { data: member } = await supabase
    .from('team_members')
    .select('role')
    .eq('id', memberId)
    .eq('team_id', team.id)
    .single();

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 });
  }

  if (member.role === 'owner') {
    return NextResponse.json({ error: 'Cannot remove the team owner' }, { status: 403 });
  }

  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', memberId)
    .eq('team_id', team.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
`,
  };
}
