// GET /api/interpretations/demand?trend_id=...
// Возвращает кэшированную интерпретацию Блока 2.
// Генерируется фоном в /api/evidence/demand.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/supabase'
import { getAuthUser } from '@/lib/auth-helpers'

export async function GET(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const trend_id = req.nextUrl.searchParams.get('trend_id')
  if (!trend_id) {
    return NextResponse.json({ error: 'trend_id required' }, { status: 400 })
  }

  const supabase = getServerSupabase()

  const { data, error } = await supabase
    .from('block_interpretations')
    .select('*')
    .eq('trend_id', trend_id)
    .eq('block_id', 'demand')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Interpretation not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
