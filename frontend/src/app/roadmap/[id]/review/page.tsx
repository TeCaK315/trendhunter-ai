/**
 * TrendHunter AI — Kill Switch Review Page
 * src/app/roadmap/[id]/review/page.tsx
 */

import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { createHash } from 'crypto'
import KillSwitchClient from './KillSwitchClient'

export default async function ReviewPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession()
  if (!session?.user?.email) redirect('/auth/signin')

  const userId = createHash('sha256')
    .update(session.user.email.toLowerCase())
    .digest('hex')

  // Данные загружаются на клиенте через API
  // (Review требует живого чата с Максом — нужен Client Component)
  return <KillSwitchClient roadmapId={params.id} userId={userId} />
}
