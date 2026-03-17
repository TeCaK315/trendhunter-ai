import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const name = ctx.safe.projectName;
  const hasStripe = ctx.stripe.required;

  const billingNavItem = hasStripe
    ? `{ href: '/dashboard/billing', labelKey: 'nav.billing', icon: CreditCard },`
    : '';

  const creditCardImport = hasStripe ? ', CreditCard' : '';

  return {
    'src/components/DashboardNav.tsx': `'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUser } from '@/hooks/useUser';
import { useT } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import {
  LayoutDashboard,
  Clock,
  PlusCircle,
  Settings,
  LogOut,
  LogIn${creditCardImport},
  Sparkles,
  ChevronDown,
  Users,
  BarChart3,
  FileText,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/dashboard/create', labelKey: 'nav.createNew', icon: PlusCircle },
  { href: '/dashboard/history', labelKey: 'nav.history', icon: Clock },
  { href: '/dashboard/clients', labelKey: 'nav.clients', icon: Users },
  { href: '/dashboard/reports', labelKey: 'nav.reports', icon: BarChart3 },
  ${billingNavItem}
  { href: '/dashboard/settings', labelKey: 'nav.settings', icon: Settings },
  { href: '/dashboard/legal-editor', labelKey: 'nav.legalPages', icon: FileText },
];

export default function DashboardNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useUser();
  const t = useT();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Supabase not configured
    }
    router.push('/');
  }, [router]);

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href);
  };

  const avatarUrl = profile?.avatar_url;
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Guest';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <nav
      className="w-64 min-h-screen border-r flex flex-col"
      style={{
        background: '${t.bg}',
        borderColor: '${t.primary10}',
      }}
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: '${t.primary10}' }}>
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '${t.gradientPrimary}' }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-heading font-bold" style={{ color: '${t.text}' }}>
            ${name}
          </span>
        </Link>
      </div>

      {/* Nav Items */}
      <div className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: active ? '${t.primary20}' : 'transparent',
                color: active ? '${t.primary}' : '${t.text70}',
              }}
            >
              <Icon className="w-5 h-5" />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </div>

      {/* Language Switcher */}
      <div className="px-4 pb-2">
        <LanguageSwitcher compact />
      </div>

      {/* User Section */}
      <div className="p-4 border-t" style={{ borderColor: '${t.primary10}' }}>
        {user ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:opacity-80"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold text-white"
                  style={{ background: '${t.gradientPrimary}' }}
                >
                  {initials}
                </div>
              )}
              <div className="flex-1 text-left">
                <p className="text-sm font-medium truncate" style={{ color: '${t.text}' }}>
                  {displayName}
                </p>
                <p className="text-xs truncate" style={{ color: '${t.text50}' }}>
                  {user.email}
                </p>
              </div>
              <ChevronDown
                className="w-4 h-4 transition-transform"
                style={{
                  color: '${t.text50}',
                  transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>

            {dropdownOpen && (
              <div
                className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border shadow-lg overflow-hidden"
                style={{
                  background: '${t.bg}',
                  borderColor: '${t.primary20}',
                }}
              >
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:opacity-80"
                  style={{ color: '#ef4444' }}
                >
                  <LogOut className="w-4 h-4" />
                  {t('nav.signOut')}
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors hover:opacity-80"
            style={{ color: '${t.text70}' }}
          >
            <LogIn className="w-5 h-5" />
            <span className="text-sm font-medium">{t('nav.signIn')}</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
`,
  };
}
