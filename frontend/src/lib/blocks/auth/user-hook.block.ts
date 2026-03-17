import type { BlockContext, BlockResult } from '../types';

export default function generate(_ctx: BlockContext): BlockResult {
  return {
    'src/hooks/useUser.ts': `'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  [key: string]: any;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const init = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        // Check if this is a real Supabase instance (not placeholder)
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!url || url.includes('placeholder')) {
          setLoading(false);
          return;
        }

        const { data: { user: authUser } } = await supabase.auth.getUser();
        setUser(authUser);

        if (authUser) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single();
          setProfile(profileData);
        }

        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(async (_event, session) => {
          setUser(session?.user ?? null);
          if (session?.user) {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            setProfile(profileData);
          } else {
            setProfile(null);
          }
        });
        subscription = sub;
      } catch {
        // Supabase not configured — app works in guest mode
      } finally {
        setLoading(false);
      }
    };

    init();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  return { user, profile, loading };
}
`,
  };
}
