/**
 * TrendHunter AI — Auth Helper для раздела Стратегия
 * src/lib/strategy/auth.ts
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createHash } from 'crypto'
import { NextRequest } from 'next/server'

export interface AuthUser {
  id: string
  email: string
}

export function emailToUuid(email: string): string {
  const hash = createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32),
  ].join('-')
}

export async function getStrategyAuthUser(): Promise<AuthUser | null> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) return null
    return {
      id: emailToUuid(session.user.email),
      email: session.user.email,
    }
  } catch (error) {
    console.error('[StrategyAuth] getServerSession error:', error)
    return null
  }
}

export async function getStrategyAuthUserFromRequest(
  _req: NextRequest
): Promise<AuthUser | null> {
  return getStrategyAuthUser()
}
