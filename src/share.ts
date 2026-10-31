import { track } from './track.ts'
import { getSave } from './state.ts'
import { rankFor, skillLines } from './logic.ts'

/** Every outgoing share link carries src, ref (the sharer's username) and utm_* params. */
export function shareLink(base: string, src: 'profile' | 'cv' | 'cert' | 'invite', username: string): string {
  const url = new URL(base, 'https://grinddistrict.vercel.app')
  url.searchParams.set('src', src)
  if (username) url.searchParams.set('ref', username)
  url.searchParams.set('utm_source', 'player_share')
  url.searchParams.set('utm_medium', 'social')
  url.searchParams.set('utm_campaign', src)
  return url.toString()
}

export async function shareOrCopy(title: string, link: string, src: string): Promise<'shared' | 'copied' | 'failed'> {
  track('share_click', { src })
  try {
    if (navigator.share) {
      await navigator.share({ title, url: link })
      return 'shared'
    }
    await navigator.clipboard.writeText(link)
    return 'copied'
  } catch {
    return 'failed'
  }
}

/** Short public profile link: /cv/username (OG card page that opens the game) (no payload in the URL). */
export function profileLink(username: string): string {
  return username ? `https://grinddistrict.vercel.app/cv/${encodeURIComponent(username.toLowerCase())}` : 'https://grinddistrict.vercel.app/'
}

/** Opens X with a short link and friendly prefilled text. */
export function shareToX(username: string, rank: string): void {
  void publishProfile()
  track('share_click', { src: 'x' })
  const text = username ? `I'm grinding in Grind District as @${username}, ${rank} rank. Come join:` : "I'm grinding in Grind District. Come join:"
  const intent = new URL('https://x.com/intent/post')
  intent.searchParams.set('text', text)
  intent.searchParams.set('url', profileLink(username))
  window.open(intent.toString(), '_blank', 'noopener')
}

/** Upsert this player's public card snapshot (name, rank, reputation, balance, skills) for /cv/<username>. Needs Privy sign-in. */
export async function publishProfile(): Promise<boolean> {
  try {
    const token = await (await import('./login.ts')).accessToken()
    if (!token) return false
    const s = getSave()
    const r = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ name: s.name, rank: rankFor(s.xp).label, reputation: s.reputation, balance: s.ledger, skills: skillLines(s), pinned: (await import('./career.ts')).pinnedTitles() }) })
    return r.ok
  } catch { return false }
}
