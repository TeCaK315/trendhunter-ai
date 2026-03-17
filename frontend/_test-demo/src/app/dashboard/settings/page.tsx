'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Settings, User, Save, Loader2, Check, LogOut } from 'lucide-react';

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (profile) {
        setFullName(profile.full_name || '');
      }
      setLoading(false);
    }
    loadProfile();
  }, []);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f0f23' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#6366f1' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#0f0f23' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-8 h-8" style={{ color: '#6366f1' }} />
          <h1 className="text-3xl font-heading font-bold" style={{ color: '#e2e8f0' }}>
            Settings
          </h1>
        </div>

        {/* Profile Section */}
        <div className="rounded-2xl border p-6 mb-6" style={{ background: '#6366f110', borderColor: '#6366f140' }}>
          <div className="flex items-center gap-2 mb-6">
            <User className="w-5 h-5" style={{ color: '#6366f1' }} />
            <h2 className="text-lg font-heading font-semibold" style={{ color: '#e2e8f0' }}>
              Profile
            </h2>
          </div>

          <div className="space-y-4">
            {/* Email (read-only) */}
            <div>
              <label className="block text-sm mb-2" style={{ color: '#e2e8f070' }}>
                Email
              </label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full px-4 py-3 rounded-xl border opacity-60 cursor-not-allowed"
                style={{
                  background: '#0f0f23',
                  borderColor: '#6366f120',
                  color: '#e2e8f050',
                }}
              />
              <p className="mt-1 text-xs" style={{ color: '#e2e8f050' }}>
                Email cannot be changed
              </p>
            </div>

            {/* Full Name */}
            <div>
              <label className="block text-sm mb-2" style={{ color: '#e2e8f070' }}>
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
                style={{
                  background: '#0f0f23',
                  borderColor: '#6366f140',
                  color: '#e2e8f0',
                }}
              />
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: '#6366f1' }}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
              </button>
              {saved && (
                <span className="text-sm" style={{ color: '#6366f1' }}>
                  Changes saved successfully
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className="rounded-2xl border p-6" style={{ borderColor: '#6366f140' }}>
          <h2 className="text-lg font-heading font-semibold mb-4" style={{ color: '#e2e8f0' }}>
            Account
          </h2>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold border transition-all hover:bg-red-500/10"
            style={{ borderColor: '#ef444440', color: '#ef4444' }}
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
