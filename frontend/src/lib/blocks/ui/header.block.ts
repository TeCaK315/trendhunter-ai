import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;

  return {
    'src/components/Header.tsx': `'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    async function checkAuth() {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!url || url.includes('placeholder')) return;
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
      } catch {
        // Supabase not configured
      }
    }
    checkAuth();
  }, []);

  // Don't show header on dashboard pages (they have their own nav)
  if (pathname?.startsWith('/dashboard')) return null;

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{
        background: '${t.bg}ee',
        borderColor: '${t.primary20}',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: '${t.gradientPrimary}' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-lg font-heading font-bold"
              style={{ color: '${t.text}' }}
            >
              ${name}
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {user ? (
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: '${t.primary}', color: 'white' }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: '${t.text70}' }}
                >
                  Sign In
                </Link>
                <Link
                  href="/dashboard"
                  className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: '${t.primary}', color: 'white' }}
                >
                  Get Started
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
`,
  };
}
