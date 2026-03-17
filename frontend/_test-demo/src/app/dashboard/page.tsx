'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { LayoutDashboard, TrendingUp, CreditCard, Settings, Sparkles, Loader2, ArrowRight, Clock, ExternalLink, BarChart3 } from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [recentAnalyses, setRecentAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      setProfile(profile);

      // Load recent analyses
      const { data: analyses } = await supabase
        .from('analyses')
        .select('id, input, input_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      setRecentAnalyses(analyses || []);

      setLoading(false);
    }
    loadUser();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f23' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#0f0f23' }}>
      <div className="max-w-6xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <LayoutDashboard className="w-8 h-8" style={{ color: '#6366f1' }} />
            <h1 className="text-3xl font-heading font-bold" style={{ color: '#e2e8f0' }}>
              Dashboard
            </h1>
          </div>
          <p style={{ color: '#e2e8f070' }}>
            Welcome back, {profile?.full_name || user?.email?.split('@')[0] || 'User'}!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl border p-6" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5" style={{ color: '#6366f1' }} />
              <h3 className="font-heading font-semibold" style={{ color: '#e2e8f0' }}>
                AI-powered market analysis report
              </h3>
            </div>
            <p className="text-2xl font-bold mb-1" style={{ color: '#e2e8f0' }}>
              {profile?.usage_count ?? 0}
            </p>
            <p className="text-sm" style={{ color: '#e2e8f050' }}>
              Total this month
            </p>
          </div>

          <div className="rounded-2xl border p-6" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5" style={{ color: '#8b5cf6' }} />
              <h3 className="font-heading font-semibold" style={{ color: '#e2e8f0' }}>
                Last AI-powered market analysis report
              </h3>
            </div>
            <p className="text-2xl font-bold mb-1" style={{ color: '#e2e8f0' }}>
              {profile?.last_analysis_at
                ? new Date(profile.last_analysis_at).toLocaleDateString()
                : 'No results yet'}
            </p>
            <p className="text-sm" style={{ color: '#e2e8f050' }}>
              {profile?.last_analysis_at ? 'Most recent result' : 'Start your first analysis'}
            </p>
          </div>

          <div className="rounded-2xl border p-6" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5" style={{ color: '#f59e0b' }} />
              <h3 className="font-heading font-semibold" style={{ color: '#e2e8f0' }}>
                Current Plan
              </h3>
            </div>
            <p className="text-2xl font-bold capitalize mb-1" style={{ color: '#e2e8f0' }}>
              {profile?.subscription_tier || 'Free'}
            </p>
            <Link
              href="/dashboard/billing"
              className="text-sm flex items-center gap-1 transition-colors hover:opacity-80"
              style={{ color: '#6366f1' }}
            >
              Manage plan <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Main Action Area */}
        <div className="rounded-2xl border p-8" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-heading font-bold" style={{ color: '#e2e8f0' }}>
                AI analyzes market data and generates strategic insights
              </h2>
              <p className="text-sm" style={{ color: '#e2e8f070' }}>
                Enter a market or product name
              </p>
            </div>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setSubmitting(true);
              try {
                const form = e.target as HTMLFormElement;
              const params = `${encodeURIComponent('query')}=${encodeURIComponent((form.elements.namedItem('query') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value || '')}&${encodeURIComponent('region')}=${encodeURIComponent((form.elements.namedItem('region') as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value || '')}`;
              router.push(`/dashboard/analysis?${params}`);
              } finally {
                setSubmitting(false);
              }
            }}
          >
            
            <div className="space-y-4">
              
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#e2e8f080' }}>
                  Market or product to analyze
                </label>
                <input
                  name="query"
                  type="text"
                  placeholder="AI fitness apps"
                  required
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                  style={{
                    background: '#0f0f23',
                    borderColor: '#6366f140',
                    color: '#e2e8f0',
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#e2e8f080' }}>
                  Target region
                </label>
                <select
                  name="region"
                  required
                  className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                  style={{
                    background: '#0f0f23',
                    borderColor: '#6366f140',
                    color: '#e2e8f0',
                  }}
                >
                  <option value="">US</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-6 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Analyze</>
              )}
            </button>
          </form>

          {/* Step Hint */}
          <p className="mt-3 text-sm flex items-center gap-1.5" style={{ color: '#e2e8f050' }}>
            <ArrowRight className="w-3.5 h-3.5" />
            Enter your market query
          </p>
        </div>

        {/* Recent Analyses */}
        <div className="rounded-2xl border p-6 mt-8" style={{ borderColor: '#6366f140' }}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5" style={{ color: '#6366f1' }} />
            <h2 className="font-heading font-semibold" style={{ color: '#e2e8f0' }}>
              Recent Results
            </h2>
          </div>
          {recentAnalyses.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: '#e2e8f050' }}>
              No analyses yet. Start your first one above!
            </p>
          ) : (
            <div className="space-y-3">
              {recentAnalyses.map((a: any) => (
                <Link
                  key={a.id}
                  href={`/dashboard/analysis?id=${a.id}`}
                  className="flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.01]"
                  style={{ borderColor: '#6366f120' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" style={{ color: '#e2e8f0' }}>
                      {(a.input || '').substring(0, 80)}{(a.input || '').length > 80 ? '...' : ''}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#e2e8f050' }}>
                      {new Date(a.created_at).toLocaleDateString()} - {a.input_type || 'text'}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 ml-3 flex-shrink-0" style={{ color: '#6366f1' }} />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <Link
            href="/dashboard/billing"
            className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.02]"
            style={{ borderColor: '#6366f140' }}
          >
            <CreditCard className="w-5 h-5" style={{ color: '#6366f1' }} />
            <span style={{ color: '#e2e8f0' }}>Billing & Plans</span>
            <ArrowRight className="w-4 h-4 ml-auto" style={{ color: '#e2e8f050' }} />
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:scale-[1.02]"
            style={{ borderColor: '#6366f140' }}
          >
            <Settings className="w-5 h-5" style={{ color: '#6366f1' }} />
            <span style={{ color: '#e2e8f0' }}>Settings</span>
            <ArrowRight className="w-4 h-4 ml-auto" style={{ color: '#e2e8f050' }} />
          </Link>
        </div>
      </div>
    </div>
  );
}
