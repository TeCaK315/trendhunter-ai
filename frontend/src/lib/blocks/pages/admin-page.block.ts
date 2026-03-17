import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  return {
    'src/app/admin/page.tsx': `import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Shield, Users, BarChart3, Activity } from 'lucide-react';

export const dynamic = 'force-dynamic';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase());

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
    redirect('/dashboard');
  }

  // Fetch stats
  const { count: userCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  const { count: analysisCount } = await supabase
    .from('usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('metric', 'analyses');

  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, full_name, email, subscription_tier, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '${t.bg}' }}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Shield className="w-8 h-8" style={{ color: '${t.primary}' }} />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: '${t.text}', fontFamily: '${t.headingFont}, sans-serif' }}>
              Admin Panel
            </h1>
            <p className="text-sm" style={{ color: '${t.text50}' }}>
              ${name} administration
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl border p-6" style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5" style={{ color: '${t.primary}' }} />
              <span className="text-sm font-semibold" style={{ color: '${t.text70}' }}>Total Users</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: '${t.text}' }}>
              {userCount || 0}
            </p>
          </div>

          <div className="rounded-2xl border p-6" style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-5 h-5" style={{ color: '${t.secondary}' }} />
              <span className="text-sm font-semibold" style={{ color: '${t.text70}' }}>Total Analyses</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: '${t.text}' }}>
              {analysisCount || 0}
            </p>
          </div>

          <div className="rounded-2xl border p-6" style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-5 h-5" style={{ color: '${t.accent}' }} />
              <span className="text-sm font-semibold" style={{ color: '${t.text70}' }}>System Status</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: '#22c55e' }}>
              Online
            </p>
          </div>
        </div>

        {/* Recent Users Table */}
        <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '${t.primary40}' }}>
          <div className="p-6 border-b" style={{ background: '${t.primary10}', borderColor: '${t.primary40}' }}>
            <h2 className="text-xl font-bold" style={{ color: '${t.text}', fontFamily: '${t.headingFont}, sans-serif' }}>
              Recent Users
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid ${t.primary20}' }}>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '${t.text70}' }}>Name</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '${t.text70}' }}>Email</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '${t.text70}' }}>Plan</th>
                  <th className="text-left p-4 text-sm font-semibold" style={{ color: '${t.text70}' }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers?.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors" style={{ borderBottom: '1px solid ${t.primary10}' }}>
                    <td className="p-4 text-sm" style={{ color: '${t.text}' }}>
                      {u.full_name || 'Unnamed'}
                    </td>
                    <td className="p-4 text-sm" style={{ color: '${t.text70}' }}>
                      {u.email}
                    </td>
                    <td className="p-4">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-semibold capitalize"
                        style={{
                          background: u.subscription_tier === 'free' ? '${t.primary20}' : '${t.primary}',
                          color: u.subscription_tier === 'free' ? '${t.text70}' : 'white',
                        }}
                      >
                        {u.subscription_tier || 'free'}
                      </span>
                    </td>
                    <td className="p-4 text-sm" style={{ color: '${t.text50}' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {(!recentUsers || recentUsers.length === 0) && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-sm" style={{ color: '${t.text50}' }}>
                      No users yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
`,
  };
}
