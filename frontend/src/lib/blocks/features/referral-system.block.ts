import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);
  const projectName = ctx.safe.projectName;

  return {
    'src/components/ReferralWidget.tsx': `'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Copy, Check, Gift, Share2 } from 'lucide-react';

export default function ReferralWidget() {
  const [code, setCode] = useState('');
  const [referrals, setReferrals] = useState(0);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function loadReferral() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('referral_code, referral_count')
        .eq('id', user.id)
        .single();

      if (profile?.referral_code) {
        setCode(profile.referral_code);
        setReferrals(profile.referral_count || 0);
      } else {
        // Generate new referral code
        const newCode = user.id.substring(0, 8).toUpperCase();
        await supabase.from('profiles').update({ referral_code: newCode }).eq('id', user.id);
        setCode(newCode);
      }
    }
    loadReferral();
  }, []);

  const referralLink = typeof window !== 'undefined'
    ? \`\${window.location.origin}/signup?ref=\${code}\`
    : '';

  async function copyLink() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border p-6" style={{ borderColor: '${t.primary40}' }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '${t.gradientPrimary}' }}>
          <Gift className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: '${t.text}' }}>Пригласи друга</h3>
          <p className="text-xs" style={{ color: '${t.text70}' }}>Получите бонус за каждого приглашённого</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4">
        <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '${t.primary10}' }}>
          <p className="text-2xl font-bold" style={{ color: '${t.primary}' }}>{referrals}</p>
          <p className="text-xs" style={{ color: '${t.text70}' }}>Приглашено</p>
        </div>
        <div className="flex-1 p-3 rounded-xl text-center" style={{ background: '${t.primary10}' }}>
          <p className="text-2xl font-bold" style={{ color: '${t.primary}' }}>{referrals * 10}%</p>
          <p className="text-xs" style={{ color: '${t.text70}' }}>Бонус</p>
        </div>
      </div>

      {/* Referral link */}
      <div className="flex gap-2">
        <input
          value={referralLink}
          readOnly
          className="flex-1 px-3 py-2 rounded-xl border text-sm truncate"
          style={{ borderColor: '${t.primary40}', background: '${t.primary10}', color: '${t.text}' }}
        />
        <button
          onClick={copyLink}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white flex items-center gap-1.5 transition-all hover:opacity-90"
          style={{ background: '${t.gradientPrimary}' }}
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
    </div>
  );
}
`,

    'src/app/api/referral/route.ts': `import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { referralCode, newUserId } = await req.json();
    if (!referralCode || !newUserId) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find referrer
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id, referral_count')
      .eq('referral_code', referralCode)
      .single();

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code' }, { status: 404 });
    }

    // Update referral count
    await supabase
      .from('profiles')
      .update({ referral_count: (referrer.referral_count || 0) + 1 })
      .eq('id', referrer.id);

    // Mark new user as referred
    await supabase
      .from('profiles')
      .update({ referred_by: referrer.id })
      .eq('id', newUserId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
`,
  };
}
