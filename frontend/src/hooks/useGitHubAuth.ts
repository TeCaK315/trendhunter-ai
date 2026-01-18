'use client';

import { useState, useEffect, useCallback } from 'react';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
}

interface AuthState {
  authenticated: boolean;
  user: GitHubUser | null;
  loading: boolean;
}

export function useGitHubAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    authenticated: false,
    user: null,
    loading: true,
  });

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/github/user');
      const data = await response.json();

      setAuthState({
        authenticated: data.authenticated,
        user: data.user,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking auth:', error);
      setAuthState({
        authenticated: false,
        user: null,
        loading: false,
      });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = useCallback(() => {
    window.location.href = '/api/auth/github';
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/github/logout', { method: 'POST' });
      setAuthState({
        authenticated: false,
        user: null,
        loading: false,
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  }, []);

  return {
    ...authState,
    login,
    logout,
    refresh: checkAuth,
  };
}
