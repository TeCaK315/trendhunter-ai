import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth-helpers';
import { getServerSupabase } from '@/lib/supabase';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getServerSupabase();
    const { data, error } = await supabase
      .from('user_credits')
      .select('balance')
      .eq('user_id', user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ balance: 0 });
    }

    return NextResponse.json({ balance: data.balance });
  } catch {
    return NextResponse.json({ balance: 0 });
  }
}
