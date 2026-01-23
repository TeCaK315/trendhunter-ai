'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useTranslations } from '@/lib/i18n';
import { useGitHubAuth } from '@/hooks/useGitHubAuth';
import { useIdeasLimit } from '@/hooks/useIdeasLimit';

interface UserMenuProps {
  compact?: boolean;
}

export default function UserMenu({ compact = false }: UserMenuProps) {
  const { data: session, status } = useSession();
  const { authenticated: githubAuth, user: githubUser, login: githubLogin, logout: githubLogout } = useGitHubAuth();
  const { ideasUsed, ideasRemaining, ideasLimit, usagePercent, isAdmin } = useIdeasLimit();
  const [isOpen, setIsOpen] = useState(false);
  const [showProviders, setShowProviders] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useTranslations();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowProviders(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLoading = status === 'loading';
  const isGoogleAuth = !!session;
  const isAnyAuth = isGoogleAuth || githubAuth;

  if (isLoading) {
    return (
      <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />
    );
  }

  // Not authenticated - show login button
  if (!isAnyAuth) {
    return (
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowProviders(!showProviders)}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {!compact && <span>{t.auth.signIn}</span>}
          <svg
            className={`w-3 h-3 text-zinc-400 transition-transform ${showProviders ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showProviders && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
            <div className="p-2">
              <div className="px-3 py-2 text-xs text-zinc-500 font-medium uppercase tracking-wider">
                {t.auth.signInWith || 'Войти через'}
              </div>

              {/* Google */}
              <button
                onClick={() => {
                  signIn('google');
                  setShowProviders(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <span>Google</span>
              </button>

              {/* GitHub */}
              <button
                onClick={() => {
                  githubLogin();
                  setShowProviders(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </div>
                <span>GitHub</span>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Authenticated - show user menu
  const displayName = session?.user?.name || githubUser?.name || githubUser?.login || 'User';
  const displayEmail = session?.user?.email || (githubUser ? `@${githubUser.login}` : '');
  const displayImage = session?.user?.image || githubUser?.avatar_url;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1 rounded-xl hover:bg-zinc-800 transition-all"
      >
        {displayImage ? (
          <Image
            src={displayImage}
            alt={displayName}
            width={32}
            height={32}
            className="rounded-full"
            unoptimized={!!githubUser?.avatar_url}
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-sm font-medium">
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden animate-fadeIn">
          {/* User info */}
          <div className="p-4 border-b border-zinc-800">
            <div className="flex items-center gap-3">
              {displayImage ? (
                <Image
                  src={displayImage}
                  alt={displayName}
                  width={40}
                  height={40}
                  className="rounded-full"
                  unoptimized={!!githubUser?.avatar_url}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {displayName}
                </p>
                <p className="text-xs text-zinc-500 truncate">
                  {displayEmail}
                </p>
              </div>
            </div>
          </div>

          {/* Connected accounts */}
          <div className="p-3 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">
              {t.auth.connectedAccounts || 'Подключённые аккаунты'}
            </div>
            <div className="space-y-2">
              {/* Google status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span className="text-sm text-zinc-300">Google</span>
                </div>
                {isGoogleAuth ? (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    {t.auth.connected || 'Подключён'}
                  </span>
                ) : (
                  <button
                    onClick={() => signIn('google')}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {t.auth.connect || 'Подключить'}
                  </button>
                )}
              </div>

              {/* GitHub status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                  <span className="text-sm text-zinc-300">GitHub</span>
                </div>
                {githubAuth ? (
                  <span className="text-xs text-green-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
                    {t.auth.connected || 'Подключён'}
                  </span>
                ) : (
                  <button
                    onClick={githubLogin}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    {t.auth.connect || 'Подключить'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Usage stats */}
          <div className="p-3 border-b border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{t.auth.ideasToday || 'Идей сегодня'}</span>
              {isAdmin ? (
                <span className="text-amber-400 font-medium flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd" />
                  </svg>
                  ∞
                </span>
              ) : (
                <span className="text-white font-medium">{ideasUsed} / {ideasLimit}</span>
              )}
            </div>
            {!isAdmin && (
              <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${usagePercent >= 80 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
            )}
            {isAdmin && (
              <div className="mt-1 text-xs text-amber-400/70">
                {t.auth.unlimitedAccess || 'Безлимитный доступ'}
              </div>
            )}
          </div>

          {/* Menu items */}
          <div className="p-2">
            {githubAuth && githubUser && (
              <a
                href={githubUser.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                {t.auth.githubProfile || 'Профиль GitHub'}
              </a>
            )}

            <button
              onClick={() => {
                if (isGoogleAuth) signOut();
                if (githubAuth) githubLogout();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              {t.auth.signOut}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
