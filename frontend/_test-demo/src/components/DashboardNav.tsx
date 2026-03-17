'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/hooks/useUser';
import {
  LayoutDashboard,
  Clock,
  Settings,
  LogOut, CreditCard,
  Sparkles,
  ChevronDown,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/history', label: 'History', icon: Clock },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export default function DashboardNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useUser();
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

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const isActive = (href: string) => {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname?.startsWith(href);
  };

  const avatarUrl = profile?.avatar_url;
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';
  const initials = displayName.charAt(0).toUpperCase();

  return (
    <nav
      className="w-64 min-h-screen border-r flex flex-col"
      style={{
        background: '#0f0f23',
        borderColor: '#6366f110',
      }}
    >
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: '#6366f110' }}>
        <Link href="/" className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-heading font-bold" style={{ color: '#e2e8f0' }}>
            MaxTest App
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
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{
                background: active ? '#6366f120' : 'transparent',
                color: active ? '#6366f1' : '#e2e8f070',
              }}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </div>

      {/* User Section */}
      <div className="p-4 border-t" style={{ borderColor: '#6366f110' }}>
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
                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
              >
                {initials}
              </div>
            )}
            <div className="flex-1 text-left">
              <p className="text-sm font-medium truncate" style={{ color: '#e2e8f0' }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: '#e2e8f050' }}>
                {user?.email}
              </p>
            </div>
            <ChevronDown
              className="w-4 h-4 transition-transform"
              style={{
                color: '#e2e8f050',
                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            />
          </button>

          {dropdownOpen && (
            <div
              className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border shadow-lg overflow-hidden"
              style={{
                background: '#0f0f23',
                borderColor: '#6366f120',
              }}
            >
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:opacity-80"
                style={{ color: '#ef4444' }}
              >
                <LogOut className="w-4 h-4" />
                Выйти
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
