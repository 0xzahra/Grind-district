// Players online (menu > Players, or the Online pill): every real player in the city right now, where they are,
// and what you can do: see their profile, message them, go and find them, or invite them to your home when you
// are there. A home invite arrives as a card; Accept walks them straight into the same home, where you can sit,
// chat (bubbles show to everyone in the room) and dance together, and film it as a skit.
import type { OnlinePlayer, Visit } from './net.ts'

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const key = (label: string, cls: string, on: () => void) => { const b = el('button', label, `gm-key ${cls}`); b.type = 'button'; b.onclick = on; return b }

/** A room key in words. */
export function roomLabel(room: string, me: string): string {
  if (!room) return 'In the city'
  const [kind, a, b] = room.split(':')
  const homes: Record<string, string> = { duplex: 'garden duplex', mansion: 'mansion', penthouse: 'penthouse', skyhouse: 'sky house' }
  if (kind === 'house') return a === me ? 'At your home' : `At @${a}'s home`
  if (kind === 'home') return b === me ? `In your ${homes[a!] ?? 'home'}` : `In @${b}'s ${homes[a!] ?? 'home'}`
  const places: Record<string, string> = { gym: 'the gym', boutique: 'the Boutique', mosque: 'the Masjid', trading: 'the trading floor', campus: 'the Campus', studio: 'the studio', conference: 'the Conference Centre', lounge: 'the lounge', park: 'Grind Park', airport: 'the airport', yacht: 'the yacht', hotel: 'the Grind Grand', mall: 'Grind Mall', grad: 'the Great Hall', surf: 'the surf school', gallery: 'the Art Gallery' }
  return `At ${places[a!] ?? 'a venue'}`
}

export type PlayersDeps = {
  me: () => { username: string; signedIn: boolean }
  players: () => OnlinePlayer[]
  online: () => boolean
  myRoom: () => string
  /** The home you are in, if it is yours (so you can invite people to it). */
  atHome: () => { room: string; home: string; label: string } | null
  invite: (username: string, v: Omit<Visit, 'from' | 'name'>) => boolean
  profile: (username: string) => void
  message: (username: string) => void
  find: (username: string) => void
  toast: (m: string) => void
}

export function openPlayers(d: PlayersDeps): void {
  document.getElementById('gd-modal')?.remove()
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'Players online')
  const card = el('div', '', 'gm-card pl-card')
  let timer = 0
  const close = () => { window.clearInterval(timer); shade.remove() }
  shade.addEventListener('click', (e) => { if (e.target === shade) close() })
  const head = el('div', '', 'gm-head'), t = el('div')
  t.append(el('p', 'Real players · right now', 'gm-kick'), el('h3', 'Players online', 'gm-title'))
  head.append(t, key('Close', 'gm-ghost', close))
  const where = el('p', '', 'gm-sub'), list = el('div', '', 'pl-list'), foot = el('div', '', 'pl-foot')
  card.append(head, where, list, foot)
  shade.append(card); document.body.append(shade)
  const paint = () => {
    const me = d.me(), home = d.atHome(), ps = d.players()
    where.textContent = d.online() ? `${roomLabel(d.myRoom(), me.username)}. Real players have a gold ring at their feet; residents do not.` : 'Not connected to the city right now, so other players cannot be seen. Check your connection.'
    list.replaceChildren()
    if (!ps.length) list.append(el('p', d.online() ? 'Nobody else is in the city at the moment. Send a friend your invite link, then invite them home when they arrive.' : '', 'gm-sub'))
    for (const p of ps) {
      const row = el('div', '', `pl-row${p.here ? ' here' : ''}`)
      const who = el('div', '', 'pl-who')
      who.append(el('b', p.name), el('small', `${p.username && p.username !== 'guest' ? `@${p.username} · ` : 'Guest · '}${p.here ? 'here with you' : roomLabel(p.room, me.username)}`))
      const keys = el('div', '', 'pl-keys')
      const named = !!p.username && p.username !== 'guest'
      if (named) keys.append(key('Profile', 'gm-ghost', () => { close(); d.profile(p.username) }), key('Message', 'gm-ghost', () => { close(); d.message(p.username) }))
      if (p.here && named) keys.append(key('Find', 'gm-ghost', () => { close(); d.find(p.username) }))
      if (home && named && !p.here) keys.append(key('Invite home', 'gm-go', () => {
        if (!me.signedIn) { d.toast('Sign in to invite players home: invites go to a username.'); return }
        d.toast(d.invite(p.username, { room: home.room, home: home.home, label: home.label }) ? `Invite sent to @${p.username}.` : 'Could not send the invite: you are offline.')
      }))
      row.append(who, keys); list.append(row)
    }
    foot.replaceChildren(el('p', home
      ? 'You are at home: invite anyone online. When they arrive, sit together, chat, and tap Dance. Record a skit from My Gallery.'
      : 'Go home (your house on the home row, or a home you own) to invite players over.', 'gm-sub'))
  }
  paint()
  timer = window.setInterval(() => { if (!shade.isConnected) { window.clearInterval(timer); return } paint() }, 3000)
}

/** The card an invite arrives as. */
export function showVisitInvite(v: Visit, go: () => void): void {
  document.getElementById('pl-invite')?.remove()
  const c = el('div', '', 'pl-invite'); c.id = 'pl-invite'; c.setAttribute('role', 'alertdialog'); c.setAttribute('aria-label', `Invite from @${v.from}`)
  c.append(el('b', `${v.name} invites you over`), el('span', `@${v.from}'s ${v.label}. Hang out, chat and dance together.`))
  const keys = el('div', '', 'pl-keys')
  keys.append(key('Not now', 'gm-ghost', () => c.remove()), key('Go now', 'gm-go', () => { c.remove(); go() }))
  c.append(keys)
  document.body.append(c)
  window.setTimeout(() => c.remove(), 30_000)
}
