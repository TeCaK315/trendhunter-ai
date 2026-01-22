'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from '@/lib/i18n';
import { useSidebar } from '@/lib/SidebarContext';
import OnboardingTour, { resetOnboardingTour } from '@/components/OnboardingTour';

interface NavItemConfig {
  href: string;
  labelKey: 'home' | 'nicheResearch' | 'favorites' | 'projects';
  icon: React.ReactNode;
  tourId?: string;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggleCollapsed } = useSidebar();
  const t = useTranslations();
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showTour, setShowTour] = useState(false);

  const handleStartTour = () => {
    setShowHelpMenu(false);
    resetOnboardingTour();
    setShowTour(true);
  };

  const navItemsConfig: NavItemConfig[] = [
    {
      href: '/',
      labelKey: 'home',
      tourId: 'nav-home',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      href: '/niche-research',
      labelKey: 'nicheResearch',
      tourId: 'nav-research',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      href: '/favorites',
      labelKey: 'favorites',
      tourId: 'nav-favorites',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      ),
    },
    {
      href: '/projects',
      labelKey: 'projects',
      tourId: 'nav-projects',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-[#0a0a0c] border-r border-zinc-800/50 z-40 transition-all duration-300 flex flex-col ${
        collapsed ? 'w-[72px]' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-zinc-800/50">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-white font-bold text-lg leading-tight">TrendHunter</span>
              <span className="text-[10px] text-indigo-400 font-medium tracking-wider">AI PLATFORM</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItemsConfig.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-tour={item.tourId}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                active
                  ? 'bg-indigo-500/10 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }`}
            >
              {/* Active indicator */}
              {active && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full" />
              )}

              <span className={`flex-shrink-0 ${active ? 'text-indigo-400' : 'group-hover:text-indigo-400'}`}>
                {item.icon}
              </span>

              {!collapsed && (
                <span className="font-medium text-sm">{t.nav[item.labelKey]}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer: Help, Discord, Collapse */}
      <div className="p-3 border-t border-zinc-800/50 space-y-2">
        {/* Help button */}
        <div className="relative">
          <button
            onClick={() => setShowHelpMenu(!showHelpMenu)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-zinc-400 hover:text-white hover:bg-zinc-800/50 group ${
              collapsed ? 'justify-center' : ''
            } ${showHelpMenu ? 'bg-zinc-800/50 text-white' : ''}`}
            title={t.help.title}
          >
            <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-lg font-bold group-hover:text-indigo-400">?</span>
            {!collapsed && <span className="font-medium text-sm">{t.help.title}</span>}
          </button>

          {/* Help menu dropdown */}
          {showHelpMenu && (
            <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-0'} bottom-full mb-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-3 z-50`}>
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2 px-2">
                {t.help.title}
              </div>

              <button
                onClick={handleStartTour}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors group"
              >
                <span className="w-8 h-8 bg-indigo-600/20 rounded-lg flex items-center justify-center group-hover:bg-indigo-600/30 transition-colors">
                  <svg className="w-4 h-4 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </span>
                <div>
                  <div className="font-medium text-sm">{t.help.showTour}</div>
                  <div className="text-xs text-zinc-500">{t.help.tourDescription}</div>
                </div>
              </button>

              <a
                href="https://github.com/your-repo/trendhunter-ai"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors group"
              >
                <span className="w-8 h-8 bg-zinc-700/50 rounded-lg flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </span>
                <div>
                  <div className="font-medium text-sm">{t.help.documentation}</div>
                  <div className="text-xs text-zinc-500">{t.help.githubRepo}</div>
                </div>
              </a>

              <div className="border-t border-zinc-800 mt-2 pt-2">
                <div className="px-3 py-2 text-xs text-zinc-600">
                  TrendHunter AI {t.help.version} 1.0
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Discord link */}
        <a
          href={process.env.NEXT_PUBLIC_DISCORD_INVITE || 'https://discord.gg/YOUR_INVITE_CODE'}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-zinc-400 hover:text-white hover:bg-zinc-800/50 group ${
            collapsed ? 'justify-center' : ''
          }`}
          title="Join our Discord"
        >
          <svg className="w-5 h-5 flex-shrink-0 group-hover:text-indigo-400" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
          </svg>
          {!collapsed && <span className="font-medium text-sm">Discord</span>}
        </a>

        {/* Collapse button */}
        <button
          onClick={toggleCollapsed}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-zinc-500 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-all"
        >
          <svg
            className={`w-5 h-5 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
          {!collapsed && <span className="text-sm">{t.nav.collapse}</span>}
        </button>
      </div>

      {/* Backdrop for help menu */}
      {showHelpMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowHelpMenu(false)}
        />
      )}

      {/* Tour component */}
      {showTour && (
        <OnboardingTour forceShow={true} onComplete={() => setShowTour(false)} />
      )}
    </aside>
  );
}
