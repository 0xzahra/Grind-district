// Scheduled routes (vercel.json crons) accept only Vercel Cron's `Authorization: Bearer $CRON_SECRET`.
// Without CRON_SECRET set, they refuse every call. Underscore = not a Vercel function.
import { createHash, timingSafeEqual } from 'crypto'

export function cronAuthorized(headers: Record<string, string | string[] | undefined> | undefined): boolean {
  const secret = process.env.CRON_SECRET ?? ''
  if (secret.length < 16) return false
  const got = String(headers?.authorization ?? '')
  const h = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(h(got), h(`Bearer ${secret}`))
}
