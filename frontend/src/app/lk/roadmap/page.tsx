import { redirect } from 'next/navigation'
import { getStrategyAuthUser } from '@/lib/strategy/auth'
import { getServerSupabase } from '@/lib/supabase'

export default async function LKRoadmapRedirect({
  searchParams,
}: {
  searchParams: Promise<{ trend_id?: string }>
}) {
  const { trend_id } = await searchParams
  if (!trend_id) redirect('/lk')

  const user = await getStrategyAuthUser()
  if (!user) redirect('/auth/signin')

  const supabase = getServerSupabase()
  const { data: session } = await supabase
    .from('roadmap_sessions')
    .select('id')
    .eq('trend_id', trend_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (session?.id) redirect(`/roadmap/${session.id}`)

  redirect(`/lk/research/${encodeURIComponent(trend_id)}`)
}
