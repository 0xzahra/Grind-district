import { track } from './track.ts'
import { getSave } from './state.ts'
import { rankFor, skillLines } from './logic.ts'

/** Every outgoing share link carries only src and ref (the sharer's username): short enough to read in a post.
 *  The stats count a player's source from src (utm_source is still read on links that already carry it). */
export function shareLink(base: string, src: 'profile' | 'cv' | 'cert' | 'invite', username: string): string {
  const url = new URL(base, 'https://www.grinddistrict.app')
  url.searchParams.set('src', src)
  if (username) url.searchParams.set('ref', username.toLowerCase())
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
  return username ? `https://www.grinddistrict.app/cv/${encodeURIComponent(username.toLowerCase())}` : 'https://www.grinddistrict.app/'
}

/** Opens X with a short link and friendly prefilled text. */
export function shareToX(username: string, rank: string): void {
  void publishProfile()
  track('share_click', { src: 'x' })
  void rank
  const text = 'Learning Web3 in Grind District, a free 3D city. Lessons go straight onto my CV. Come join:'
  const intent = new URL('https://x.com/intent/post')
  intent.searchParams.set('text', text)
  intent.searchParams.set('url', profileLink(username))
  window.open(intent.toString(), '_blank', 'noopener')
}

let charSource: () => unknown = () => undefined
/** The character this player picked (figure and colours), published so other players see it as their picture. */
export function setCharacterSource(fn: () => unknown): void { charSource = fn }

/** Upsert this player's public card snapshot (name, rank, reputation, balance, skills) for /cv/<username>. Needs Privy sign-in. */
export async function publishProfile(): Promise<boolean> {
  try {
    const token = await (await import('./login.ts')).accessToken()
    if (!token) return false
    const s = getSave()
    const mo = await import('./morph.ts')
    const career = await import('./career.ts')
    const jobId = career.getCareer().job
    const jobTitle = jobId ? (await import('./careerData.ts')).JOBS.find((j) => j.id === jobId)?.title : undefined
    const r = await fetch('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ name: s.name, rank: rankFor(s.xp).label, reputation: s.reputation, balance: Math.round(s.ledger * 100) / 100, skills: skillLines(s), pinned: career.pinnedTitles(), job: jobTitle ?? null, look: mo.hasLocalMorph() ? mo.getMorph() : undefined, lux: (await import('./luxury.ts')).luxRecord(), char: charSource() }) })
    // Fresh device: adopt the look saved on the account.
    const j = r.ok ? await r.json().catch(() => null) as { look?: { h: number; b: number; hair: number | null; skin?: number | null; lux?: { last: string; streak: number; best: number } } | null } | null : null
    if (j?.look?.lux) (await import('./luxury.ts')).adoptLux(j.look.lux)
    if (j?.look && !mo.hasLocalMorph() && typeof j.look.h === 'number') { mo.setMorph({ h: j.look.h, b: j.look.b, hair: j.look.hair, skin: j.look.skin ?? null, lip: (j.look as { lip?: number | null }).lip ?? null, blush: (j.look as { blush?: number | null }).blush ?? null }); window.dispatchEvent(new Event('gd:look')) }
    return r.ok
  } catch { return false }
}
