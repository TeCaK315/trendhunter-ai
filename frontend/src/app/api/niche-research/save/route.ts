import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth-helpers'
import { getServerSupabase } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { niche, description, analysis, sources, product_spec } = (await req.json()) as {
      niche?: string
      description?: string
      analysis?: unknown
      sources?: unknown
      product_spec?: unknown
    }
    if (!niche || !analysis) {
      return NextResponse.json({ error: 'niche and analysis required' }, { status: 400 })
    }

    const supabase = getServerSupabase()
    const { data, error } = await supabase
      .from('custom_niche_research')
      .upsert(
        {
          user_id: user.id,
          niche,
          description: description ?? null,
          analysis,
          sources: sources ?? null,
          product_spec: product_spec ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,niche' }
      )
      .select('id')
      .single()

    if (error) {
      console.error('[niche-research/save]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal error'
    console.error('[niche-research/save]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
