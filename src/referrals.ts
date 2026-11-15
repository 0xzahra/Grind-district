// Referrals: invite friends with your link and both of you are rewarded in in-game dollars.
// - The friend: a $100 welcome gift once their account is made through your link.
// - You: $50 when a friend joins, and $150 more (plus reputation) when they pass their first course. Up to 25 friends.
// Tracking: how often your link was opened and by how many people, who joined, how far each got, and the month's
// top inviters. Counts come from /api/referrals (usernames and course counts from public profiles only).
// What has been collected is kept beside the save (and travels with the account, extras.ts), so nothing is paid twice.
import { addReputation, earnCash, getSave, slotKey } from './state.ts'

const JOIN_USD = 50
const ACTIVE_USD = 150
const GIFT_USD = 100
const MAX_FRIENDS = 25

type Store = { gift?: boolean; claimed: Record<string, number> }
const key = () => `${slotKey()}.ref`
const read = (): Store => { try { return { claimed: {}, ...(JSON.parse(localStorage.getItem(key()) ?? '{}') as Partial<Store>) } } catch { return { claimed: {} } } }
const write = (s: Store) => { try { localStorage.setItem(key(), JSON.stringify(s)) } catch { /* private mode */ } }

type Player = { u: string; at: string; courses: number; rank: string; rep: number }
type Stats = { joined: string[]; players?: Player[]; opens?: number; visitors?: number }

/** Count an opened invite link once per visitor (called at start-up when the page came from ?src=invite&ref=). */
export function recordInviteOpen(): void {
  try {
    const q = new URLSearchParams(location.search)
    const ref = (q.get('ref') ?? '').toLowerCase()
    if (q.get('src') !== 'invite' || !/^[a-z0-9_]{3,20}$/.test(ref)) return
    const flag = `gd.inviteOpened.${ref}`
    const day = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem(flag) === day) return
    localStorage.setItem(flag, day)
    const anon = localStorage.getItem('gd.guestId') ?? crypto.randomUUID?.() ?? String(Date.now())
    void fetch('/api/referrals?op=open', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ref, anon }), keepalive: true }).catch(() => undefined)
  } catch { /* private mode */ }
}

/** The welcome gift for a player whose account was made through a friend's link (once). */
export async function checkInviteGift(toast: (m: string) => void): Promise<void> {
  const s = read()
  const me = getSave().username
  if (s.gift || !me) return
  try {
    const r = await fetch(`/api/referrals?by=${encodeURIComponent(me)}`)
    if (!r.ok) return
    const j = (await r.json()) as { inviter?: string | null }
    const now = read()
    if (now.gift) return
    now.gift = true
    write(now)
    if (!j.inviter) return
    earnCash(GIFT_USD, 'Invite gift', `Welcome to Grind District, invited by @${j.inviter}.`)
    toast(`@${j.inviter} invited you: a $${GIFT_USD} welcome gift is in your balance.`)
  } catch { /* offline: try again next time */ }
}

/** What each friend has earned you so far: 1 = joined, 2 = joined and passed a course. */
const stage = (p: Player) => (p.courses > 0 ? 2 : 1)
const owed = (players: Player[], s: Store) => {
  let usd = 0, rep = 0
  const friends = players.slice(-MAX_FRIENDS)
  for (const p of friends) {
    const had = s.claimed[p.u] ?? 0, now = stage(p)
    if (now > had) { if (had < 1) { usd += JOIN_USD; rep += 2 } if (now >= 2) { usd += ACTIVE_USD; rep += 5 } }
  }
  return { usd, rep, friends }
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }

/** The referral block in Profile, under the invite link: stats, friends, rewards to collect, top inviters. */
export function referralNodes(h: H, toast: (m: string) => void): HTMLElement {
  const box = el('div', 'ref-box')
  const me = getSave().username
  box.append(h.para(`Invite a friend with your link: they get a $${GIFT_USD} welcome gift, you get $${JOIN_USD} when they join and $${ACTIVE_USD} more when they pass their first course.`, 'muted'))
  if (!me) { box.append(h.para('Make an account to get your own invite link.', 'muted')); return box }
  const stats = el('div', 'ref-stats')
  const list = el('div', 'ref-list')
  const collect = el('div', 'ref-collect')
  const top = el('div', 'ref-top')
  box.append(stats, collect, list, top)
  const tile = (n: number | string, label: string) => { const t = el('div', 'ref-tile'); t.append(el('b', '', String(n)), el('span', '', label)); return t }
  stats.append(tile('…', 'link opens'), tile('…', 'joined'), tile('…', 'active'), tile('…', 'earned'))
  const paint = (j: Stats) => {
    const s = read()
    const players = j.players ?? (j.joined ?? []).map((u) => ({ u, at: '', courses: 0, rank: '', rep: 0 }))
    const active = players.filter((p) => p.courses > 0).length
    const earned = Object.values(s.claimed).reduce((a, v) => a + (v >= 1 ? JOIN_USD : 0) + (v >= 2 ? ACTIVE_USD : 0), 0)
    stats.replaceChildren(tile(j.opens ?? 0, j.visitors ? `opens · ${j.visitors} people` : 'link opens'), tile(players.length, 'joined'), tile(active, 'active'), tile(`$${earned.toLocaleString('en-US')}`, 'earned'))
    list.replaceChildren()
    if (!players.length) list.append(h.para('No one has joined via your link yet. Share it, or show your photo card to scan.', 'muted'))
    for (const p of players) {
      const row = el('div', 'ref-row')
      row.append(el('b', '', `@${p.u}`), el('span', '', p.courses > 0 ? `${p.courses} course${p.courses === 1 ? '' : 's'} passed${p.rank ? ` · ${p.rank}` : ''}` : 'joined · no course yet'), el('em', '', (s.claimed[p.u] ?? 0) >= stage(p) ? 'paid' : 'reward ready'))
      list.append(row)
    }
    const due = owed(players, s)
    collect.replaceChildren()
    if (due.usd > 0) collect.append(h.button(`Collect $${due.usd.toLocaleString('en-US')} in referral rewards`, 'primary', () => {
      const now = read()
      const d = owed(players, now)
      if (d.usd <= 0) return
      for (const p of d.friends) now.claimed[p.u] = Math.max(now.claimed[p.u] ?? 0, stage(p))
      write(now)
      earnCash(d.usd, 'Referral rewards', `Friends who joined through your invite link.`)
      if (d.rep) addReputation(d.rep, 'Reputation: friends you brought', `${d.friends.length} friend${d.friends.length === 1 ? '' : 's'} in the city.`)
      toast(`+$${d.usd.toLocaleString('en-US')} for bringing friends${d.rep ? `, +${d.rep} reputation` : ''}.`)
      paint(j)
    }))
    else if (players.length >= MAX_FRIENDS) collect.append(h.para(`Rewards cover your first ${MAX_FRIENDS} friends. Thank you for growing the city.`, 'muted'))
  }
  void fetch(`/api/referrals?u=${encodeURIComponent(me)}`).then((r) => r.json()).then((j: Stats) => paint(j)).catch(() => { stats.replaceChildren(); box.append(h.para('Referral stats load when you are online.', 'muted')) })
  void fetch('/api/referrals?op=top').then((r) => r.json()).then((j: { top?: Array<{ u: string; n: number }> }) => {
    if (!j.top?.length) return
    top.append(h.para('Top inviters this month', 'kicker'))
    j.top.slice(0, 5).forEach((t, i) => { const row = el('div', 'ref-row'); row.append(el('b', '', `${i + 1}. @${t.u}${t.u === me ? ' (you)' : ''}`), el('span', '', `${t.n} joined`)); top.append(row) })
  }).catch(() => undefined)
  return box
}
