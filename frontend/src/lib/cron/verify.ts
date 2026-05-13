/**
 * Verifies that a request is a legitimate Vercel cron invocation
 * (or a local-dev curl with CRON_SECRET).
 */
export function verifyCronRequest(req: Request): boolean {
  // Vercel automatically attaches this header to scheduled invocations
  if (req.headers.get('x-vercel-cron') === '1') return true

  // Local development override via secret header
  const isDev = process.env.NODE_ENV === 'development'
  const secretConfigured = process.env.CRON_SECRET
  const headerSecret = req.headers.get('x-cron-secret')
  if (isDev && secretConfigured && headerSecret === secretConfigured) return true

  return false
}
