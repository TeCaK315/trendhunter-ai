'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

export default function Header() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Don't show header on dashboard pages (they have their own nav)
  if (pathname?.startsWith('/dashboard')) return null;

  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{
        background: '#0f0f23ee',
        borderColor: '#6366f120',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span
              className="text-lg font-heading font-bold"
              style={{ color: '#e2e8f0' }}
            >
              MaxTest App
            </span>
          </Link>

          {/* Navigation */}
          <nav className="flex items-center gap-4">
            {user ? (
              <Link
                href="/dashboard"
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: '#6366f1', color: 'white' }}
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="px-4 py-2 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: '#e2e8f070' }}
                >
                  Войти
                </Link>
                <Link
                  href="/signup"
                  className="px-5 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: '#6366f1', color: 'white' }}
                >
                  Начать
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
