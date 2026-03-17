import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  return {
    'src/app/login/page.tsx': `'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Sparkles, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/dashboard');
    }
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: \`\${window.location.origin}/api/auth/callback\` },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '${t.bg}' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
               style={{ background: '${t.gradientPrimary}' }}>
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-heading font-bold" style={{ color: '${t.text}' }}>
            Вход в ${name}
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-2" style={{ color: '${t.text}' }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
              required
            />
          </div>
          <div>
            <label className="block text-sm mb-2" style={{ color: '${t.text}' }}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2"
              style={{ background: '${t.bg}', borderColor: '${t.primary40}', color: '${t.text}' }}
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold transition-colors disabled:opacity-50"
            style={{ background: '${t.primary}', color: 'white' }}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Войти'}
          </button>
        </form>

        <div className="mt-6">
          <button
            onClick={handleGoogleLogin}
            className="w-full py-3 rounded-xl font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: '${t.primary40}', color: '${t.text}' }}
          >
            Войти через Google
          </button>
        </div>

        <p className="mt-6 text-center text-sm" style={{ color: '${t.text70}' }}>
          Нет аккаунта?{' '}
          <Link href="/signup" style={{ color: '${t.primary}' }}>
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
`,
  };
}
