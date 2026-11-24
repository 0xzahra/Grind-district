// Home staff: hire residents to work in your house. A house help, a chef, a personal assistant, a driver, a
// security guard and a gardener, each paid by the week from the in-game balance. Nothing renews by itself: when a
// week ends the person waits (and is not in the house) until the next week is paid. Hired staff stand at their
// post in the house, and walking up to them gives a real action: a cooked meal (Hunger), a cleaned house and
// laundry (Hygiene), the PA's daily brief, a lift anywhere in the city, a security check with a scam-safety tip,
// a chat about the garden (Social). Kept on this device beside the save (the save format is untouched).
import * as THREE from 'three'
import { posedHuman, MEN, WOMEN } from './humans.ts'
import { getSave, slotKey, spendInGame } from './state.ts'
import { SKILL_META, SKILL_ORDER, money } from './logic.ts'
import { nextMission } from './worlds.ts'
import { adjust, needs, NEEDS } from './needs.ts'
import { getBirthday, upcoming } from './calendar.ts'
import { note as personaNote } from './persona.ts'
import type { Obstacle } from './physics.ts'

export type RoleId = 'help' | 'chef' | 'pa' | 'driver' | 'guard' | 'gardener'
type Look = { top: number; bottom: number; shoes: number }
type Role = { id: RoleId; title: string; does: string; wage: number; ask: string; look: Look; post: { x: number; z: number; face: number }; strengths: string[] }

const W = 7 * 86_400_000
const COOL = 2 * 3_600_000
/** Posts in the family house, room-local (x east, z south). Faces: the direction the person looks, in radians. */
const ROLES: Role[] = [
  { id: 'help', title: 'House help', does: 'Cleans the house and does your laundry. Hygiene up.', wage: 40, ask: 'Ask {n} to clean up and do the laundry', look: { top: 0x6f9fc8, bottom: 0x2a2c2f, shoes: 0x1c1d1f }, post: { x: 9.35, z: 5.2, face: 0 }, strengths: ['Spotless and quick', 'Great with laundry', 'Organised, early riser'] },
  { id: 'chef', title: 'Chef', does: 'Cooks you a proper meal whenever you are home. Hunger up.', wage: 60, ask: 'Ask {n} to cook for you', look: { top: 0xf4f3ef, bottom: 0x2a2c2f, shoes: 0x1c1d1f }, post: { x: 7.4, z: -5.0, face: Math.PI }, strengths: ['Jollof and suya specialist', 'Healthy meal prep', 'Pasta, ramen and tacos'] },
  { id: 'pa', title: 'Personal assistant', does: 'Briefs you each day: your next step, reminders, birthdays, how you play and the role that fits you.', wage: 90, ask: 'Get your brief from {n}', look: { top: 0x22304a, bottom: 0x22304a, shoes: 0x1c1d1f }, post: { x: 2.3, z: -1.3, face: Math.atan2(-5, -4.4) }, strengths: ['Calendar wizard', 'Keeps you on your streak', 'Inbox zero, always'] },
  { id: 'driver', title: 'Driver', does: 'Brings the car round and drives you anywhere in the city.', wage: 70, ask: 'Ask {n} to drive you somewhere', look: { top: 0x1d1f22, bottom: 0x1d1f22, shoes: 0x111214 }, post: { x: -7.9, z: -4.3, face: -Math.PI / 2 }, strengths: ['Knows every shortcut', 'Smooth and safe', 'Never late'] },
  { id: 'guard', title: 'Security guard', does: 'Watches the door and gives you a security check with a scam-safety tip.', wage: 50, ask: 'Security check with {n}', look: { top: 0x1f2a3a, bottom: 0x1f2a3a, shoes: 0x111214 }, post: { x: -9.2, z: -0.4, face: Math.PI / 2 }, strengths: ['Sharp eye at the door', 'Calm and polite', 'Knows every scam trick'] },
  { id: 'gardener', title: 'Gardener', does: 'Keeps the planter garden growing and chats about the season. Social up.', wage: 30, ask: 'Talk garden with {n}', look: { top: 0x4f7a3a, bottom: 0x8a7a5a, shoes: 0x3a2a1c }, post: { x: 5.65, z: 3.2, face: -Math.PI / 2 }, strengths: ['Green thumb', 'Seasonal planting', 'Herbs and vegetables'] },
]
const WOMEN_N = ['Amara', 'Ngozi', 'Fatima', 'Aisha', 'Zainab', 'Chioma', 'Folake', 'Mei', 'Yuki', 'Priya', 'Sofia', 'Lucia', 'Grace', 'Halima', 'Leila', 'Hana']
const MEN_N = ['Tunde', 'Emeka', 'Musa', 'Ibrahim', 'Kwame', 'Kofi', 'Diego', 'Mateo', 'Hiro', 'Arjun', 'Omar', 'Yusuf', 'Daniel', 'Samuel', 'Chen', 'Luis']
const SKINS = [0x8d5a3b, 0x5a3825, 0xc89b78, 0x6e4630, 0xe0b896, 0x4a2e1f, 0xa9734f]
const HAIRS = [0x16110e, 0x2b1d14, 0x0d0b0a, 0x4a3426]

export type Hire = { role: RoleId; name: string; woman: boolean; model: number; skin: number; hair: number; since: number; until: number; last: number; wage: number }
type Store = { hires: Hire[] }
const key = () => `gd.staff.v1:${slotKey()}`
function load(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(key()) ?? 'null') as Store | null
    if (raw && Array.isArray(raw.hires)) return { hires: raw.hires.filter((h) => h && ROLES.some((r) => r.id === h.role) && typeof h.name === 'string' && typeof h.until === 'number') }
  } catch { /* fresh */ }
  return { hires: [] }
}
const listeners = new Set<() => void>()
function save(s: Store): boolean {
  try { localStorage.setItem(key(), JSON.stringify(s)) } catch { return false }
  for (const f of listeners) { try { f() } catch { /* never break */ } }
  return true
}
export const onStaff = (f: () => void) => { listeners.add(f) }
export const hires = (): Hire[] => load().hires
export const hireOf = (role: RoleId): Hire | undefined => load().hires.find((h) => h.role === role)
/** Hired and paid up: at their post in the house. */
export const working = (role: RoleId, now = Date.now()): Hire | undefined => { const h = hireOf(role); return h && h.until > now ? h : undefined }
const roleOf = (id: RoleId) => ROLES.find((r) => r.id === id)!

/** Three people looking for this job this week (the list changes every Monday). */
export function candidates(role: RoleId, now = Date.now()): Array<Omit<Hire, 'since' | 'until' | 'last'> & { years: number; stars: number; strength: string }> {
  const wk = Math.floor((now / 86_400_000 + 3) / 7)
  const r = roleOf(role)
  let seed = (wk * 9973 + ROLES.indexOf(r) * 7919) >>> 0
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 }
  return [0, 1, 2].map((i) => {
    const woman = (i + Math.floor(rnd() * 2)) % 2 === 0
    const pool = woman ? WOMEN_N : MEN_N
    const name = pool[Math.floor(rnd() * pool.length)]!
    const years = 1 + Math.floor(rnd() * 12)
    const stars = Math.round((4.1 + rnd() * 0.9) * 10) / 10
    const wage = Math.round(r.wage * (0.85 + years / 40 + (stars - 4.1) * 0.15))
    return { role, name, woman, model: Math.floor(rnd() * 4), skin: SKINS[Math.floor(rnd() * SKINS.length)]!, hair: HAIRS[Math.floor(rnd() * HAIRS.length)]!, wage, years, stars, strength: r.strengths[i % r.strengths.length]! }
  }).filter((c, i, a) => a.findIndex((x) => x.name === c.name) === i)
}

export function hire(c: Omit<Hire, 'since' | 'until' | 'last'>): { ok: boolean; message: string } {
  const s = load()
  if (s.hires.some((h) => h.role === c.role)) return { ok: false, message: `You already have a ${roleOf(c.role).title.toLowerCase()}.` }
  const paid = spendInGame(c.wage, `Hired ${c.name} (${roleOf(c.role).title.toLowerCase()})`, 'First week of wages, paid in advance.')
  if (!paid.ok) return paid
  const now = Date.now()
  s.hires.push({ ...c, since: now, until: now + W, last: 0 })
  save(s)
  personaNote('staff')
  return { ok: true, message: `${c.name} starts today. Find them at home.` }
}
export function payWeek(role: RoleId): { ok: boolean; message: string } {
  const s = load(), h = s.hires.find((x) => x.role === role)
  if (!h) return { ok: false, message: 'Nobody to pay.' }
  const paid = spendInGame(h.wage, `Paid ${h.name} for a week`, `${roleOf(role).title} wages.`)
  if (!paid.ok) return paid
  h.until = Math.max(Date.now(), h.until) + W
  save(s)
  return { ok: true, message: `${h.name} is paid for another week.` }
}
export function letGo(role: RoleId): string {
  const s = load(), h = s.hires.find((x) => x.role === role)
  s.hires = s.hires.filter((x) => x.role !== role)
  save(s)
  return h ? `${h.name} has left with a good reference.` : ''
}

// ---------------------------------------------------------------- what staff do
const DISHES = ['jollof rice with plantain', 'chicken suya with onions and pepper', 'egusi soup and pounded yam', 'a spicy ramen bowl', 'grilled fish with salad', 'shawarma wraps', 'pasta arrabbiata', 'beef tacos', 'vegetable stir-fry and rice', 'chickpea curry with flatbread']
const TIPS = [
  'Nobody from support will ever DM you first. Fake support is the most common scam.',
  'A seed phrase is the whole wallet. No real app, job or airdrop will ever ask for it.',
  'Check the address twice before you send. Clipboard malware swaps addresses.',
  '“Guaranteed returns” and countdown timers are red flags. Walk away.',
  'Before you sign, read what you are approving. Unlimited approvals can drain a wallet.',
  'Bookmark the real sites you use. Search ads can point to look-alike drainers.',
  'Use a separate wallet for mints and new apps; keep savings somewhere you never connect.',
  'If a deal needs you to move off the escrow or to a “third-party payment”, it is a P2P scam.',
]
const GARDEN = ['Tomatoes and peppers love this sun. I moved them to the bright end.', 'The basil is ready: pick from the top so it grows bushier.', 'I mulched the planter so it keeps water through the heat.', 'Leaves are turning: I am planting bulbs for the spring.', 'Herbs are doing well. Mint everywhere, as usual.']

type Hooks = { toast: (m: string) => void; openPanel: (p: 'profile' | 'learn' | 'city') => void; openMap: () => void }
let hooks: Hooks = { toast: () => {}, openPanel: () => {}, openMap: () => {} }
export function initStaff(h: Hooks): void { hooks = h }

const cooling = (h: Hire, now = Date.now()) => (h.last && now - h.last < COOL ? COOL - (now - h.last) : 0)
const mins = (ms: number) => { const m = Math.ceil(ms / 60_000); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min` }
function touch(role: RoleId): void { const s = load(), h = s.hires.find((x) => x.role === role); if (h) { h.last = Date.now(); save(s) } }

export function act(role: RoleId): void {
  const h = working(role)
  if (!h) { openStaffDesk(); return }
  personaNote('staff')
  const left = cooling(h)
  if (role === 'chef') {
    if (left) { hooks.toast(`${h.name} is still clearing up from the last meal. Next one in ${mins(left)}.`); return }
    touch(role)
    hooks.toast(`${h.name} serves ${DISHES[Math.floor(Math.random() * DISHES.length)]}. Enjoy!`)
    adjust({ hunger: 55, social: 4 }, 'later')
  } else if (role === 'help') {
    if (left) { hooks.toast(`${h.name} cleaned up not long ago. Next round in ${mins(left)}.`); return }
    touch(role)
    hooks.toast(`${h.name} tidies every room and folds your laundry. The house smells fresh.`)
    adjust({ hygiene: 35, energy: 5, social: 3 }, 'later')
  } else if (role === 'gardener') {
    if (left) { hooks.toast(`${h.name} is busy in the planter. Come back in ${mins(left)}.`); return }
    touch(role)
    hooks.toast(`${h.name}: “${GARDEN[Math.floor(Math.random() * GARDEN.length)]}”`)
    adjust({ social: 10 }, 'later')
  } else if (role === 'guard') {
    personaNote('security')
    hooks.toast(`${h.name}: “All quiet. ${TIPS[Math.floor(Math.random() * TIPS.length)]}”`)
  } else if (role === 'driver') {
    hooks.toast(`${h.name} brings the car round. Tap anywhere on the map to go.`)
    hooks.openMap()
  } else if (role === 'pa') openBrief(h)
}

// ---------------------------------------------------------------- the house: people at their posts
type HouseCtx = { group: THREE.Group; ox: number; oz: number; obstacles: Obstacle[]; use: (u: { id: string; x: number; z: number; r: number; title: string; body: string; enter: string; run: () => void; when?: () => boolean }) => void; wallMat?: THREE.Material }
export function mountStaff(c: HouseCtx): void {
  const figures = new Map<RoleId, { obj: THREE.Object3D; ob: Obstacle; name: string }>()
  const sync = () => {
    for (const r of ROLES) {
      const h = working(r.id)
      const had = figures.get(r.id)
      if (had && (!h || had.name !== h.name)) {
        c.group.remove(had.obj)
        const i = c.obstacles.indexOf(had.ob); if (i >= 0) c.obstacles.splice(i, 1)
        figures.delete(r.id)
      }
      if (h && !figures.has(r.id)) {
        const model = h.woman ? WOMEN[h.model % WOMEN.length]! : MEN[h.model % MEN.length]!
        const p = posedHuman(model, { pose: 'stand', height: h.woman ? 1.66 : 1.77, look: { ...r.look, skin: h.skin, hair: h.hair } })
        p.position.set(r.post.x, 0, r.post.z)
        p.rotation.y = r.post.face
        p.traverse((o) => { o.userData.ghost = true })
        c.group.add(p)
        const ob: Obstacle = { kind: 'circle', x: c.ox + r.post.x, z: c.oz + r.post.z, r: 0.28 }
        c.obstacles.push(ob)
        figures.set(r.id, { obj: p, ob, name: h.name })
      }
    }
  }
  for (const r of ROLES) {
    c.use({
      id: `staff-${r.id}`, x: r.post.x, z: r.post.z, r: 1.35,
      title: `${r.title}`, body: r.does, enter: r.ask.replace('{n}', working(r.id)?.name ?? 'them'),
      run: () => act(r.id), when: () => !!working(r.id),
    })
  }
  // The staff intercom on the hall side of the living-room wall: hire and pay staff from here.
  if (c.wallMat) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.18), new THREE.MeshStandardMaterial({ color: 0x1f2225, roughness: 0.4, metalness: 0.4 }))
    panel.position.set(-5.6, 1.35, -4.2)
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0x0b3d24, emissive: 0x06ee74, emissiveIntensity: 0.55 }))
    screen.position.set(-5.625, 1.38, -4.2); screen.rotation.y = -Math.PI / 2
    c.group.add(panel, screen)
  }
  c.use({ id: 'staff-desk', x: -6.25, z: -4.2, r: 0.95, title: 'Staff intercom', body: 'Hire a house help, chef, personal assistant, driver, guard or gardener, and pay their week.', enter: 'Hire or pay staff', run: () => openStaffDesk() })
  sync()
  onStaff(sync)
  // A week can end while the player is home: check now and then.
  window.setInterval(sync, 60_000)
}

// ---------------------------------------------------------------- screens
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
function modal(title: string, kicker: string): { card: HTMLElement; close: () => void } {
  document.getElementById('gd-modal')?.remove()
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', title)
  const card = el('div', '', 'gm-card')
  const head = el('div', '', 'gm-head')
  const t = el('div'); t.append(el('p', kicker, 'gm-kick'), el('h3', title, 'gm-title'))
  const x = el('button', 'Close', 'gm-key gm-ghost'); x.type = 'button'
  const close = () => shade.remove()
  x.onclick = close
  head.append(t, x)
  card.append(head)
  shade.append(card)
  shade.addEventListener('click', (e) => { if (e.target === shade) close() })
  shade.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
  document.body.append(shade)
  window.setTimeout(() => x.focus(), 0)
  return { card, close }
}
const key2 = (label: string, cls: string, fn: () => void) => { const b = el('button', label, `gm-key ${cls}`); b.type = 'button'; b.onclick = fn; return b }

/** Hire, pay and let go of staff. */
export function openStaffDesk(): void {
  const { card } = modal('Staff for your home', 'Staff intercom')
  const body = el('div', '', 'gm-body')
  card.append(body)
  const paint = (msg = '') => {
    body.replaceChildren()
    body.append(el('p', 'Paid by the week from your in-game balance. Nothing renews by itself: when a week ends, they wait until you pay the next one. They work at your family house; walk up to them there.', 'gm-sub'))
    if (msg) body.append(el('p', msg, 'gm-msg'))
    // A suggestion from the lowest need.
    const n = needs()
    const low = NEEDS.reduce((a, b) => (n[b.id] < n[a.id] ? b : a))
    const tip: Partial<Record<string, RoleId>> = { hunger: 'chef', hygiene: 'help', social: 'gardener' }
    const sug = tip[low.id] ?? 'pa'
    if (!working(sug)) body.append(el('p', `Suggested for you: ${roleOf(sug).title}. ${roleOf(sug).does}`, 'gm-hint'))
    for (const r of ROLES) {
      const row = el('div', '', 'gm-row')
      const h = hireOf(r.id)
      const top = el('div', '', 'gm-row-top')
      top.append(el('strong', r.title), el('span', h ? `${h.name} · ${money(h.wage)}/week` : `from about ${money(r.wage)}/week`, 'gm-price'))
      row.append(top, el('p', r.does, 'gm-does'))
      const keys = el('div', '', 'gm-keys')
      if (h) {
        const daysLeft = Math.ceil((h.until - Date.now()) / 86_400_000)
        row.append(el('p', daysLeft > 0 ? `Working · ${daysLeft} day${daysLeft === 1 ? '' : 's'} left this week` : 'Week ended · waiting for this week’s pay', daysLeft > 0 ? 'gm-ok' : 'gm-warn'))
        keys.append(key2(`Pay next week · ${money(h.wage)}`, 'gm-go', () => paint(payWeek(r.id).message)), key2('Let go', 'gm-ghost', () => paint(letGo(r.id))))
      } else {
        const list = el('div', '', 'gm-cands'); list.hidden = true
        for (const c of candidates(r.id)) {
          const cd = el('div', '', 'gm-cand')
          cd.append(el('strong', c.name), el('span', `${c.years} yr${c.years === 1 ? '' : 's'} experience · ★ ${c.stars.toFixed(1)} · ${c.strength}`, 'gm-meta'))
          cd.append(key2(`Hire · ${money(c.wage)}/week`, 'gm-go', () => paint(hire(c).message)))
          list.append(cd)
        }
        keys.append(key2('See candidates', 'gm-ghost', () => { list.hidden = !list.hidden }))
        row.append(list)
      }
      row.append(keys)
      body.append(row)
    }
  }
  paint()
}

/** The PA's daily brief. */
function openBrief(h: Hire): void {
  const { card, close } = modal(`Your brief from ${h.name}`, 'Personal assistant')
  const s = getSave()
  const hr = new Date().getHours()
  const lines: string[] = []
  lines.push(`Good ${hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening'}, ${s.name || 'boss'}.`)
  const next = nextMission() ?? SKILL_ORDER.find((id) => !s.skills[id]?.passed)
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed).length
  lines.push(next ? `Campus: ${passed} course${passed === 1 ? '' : 's'} passed. Next up is “${SKILL_META[next].title}”, about a minute.` : 'Campus: every course passed. Your CV is complete.')
  lines.push(s.streak > 0 ? `Streak: ${s.streak} day${s.streak === 1 ? '' : 's'}. One thing today keeps it going.` : 'No streak yet: one lesson or duty today starts it.')
  const n = needs()
  const low = NEEDS.reduce((a, b) => (n[b.id] < n[a.id] ? b : a))
  if (n[low.id] < 50) {
    const who: Partial<Record<string, RoleId>> = { hunger: 'chef', hygiene: 'help', social: 'gardener' }
    const staff = who[low.id] ? working(who[low.id]!) : undefined
    lines.push(`${low.label} is low (${Math.round(n[low.id])}). ${staff ? `${staff.name} can help with that.` : low.fix}`)
  }
  const holdings = Object.values(s.coins).filter((c) => c.qty > 0).length
  if (holdings) lines.push(`Practice book: ${holdings} open position${holdings === 1 ? '' : 's'}. Check them against your plan, not the noise.`)
  const b = getBirthday()
  if (b) {
    const now = new Date(), next = new Date(now.getFullYear(), b.m - 1, b.d)
    if (next.getTime() < new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) next.setFullYear(now.getFullYear() + 1)
    const days = Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000)
    if (days <= 14) lines.push(days === 0 ? 'It is your birthday today! The whole district is celebrating.' : `Your birthday is in ${days} day${days === 1 ? '' : 's'}.`)
  }
  const hol = upcoming(10)[0]
  if (hol) lines.push(`Coming up: ${hol.h.name} on ${hol.date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}.`)
  const ul = el('ul', '', 'gm-brief')
  for (const l of lines) ul.append(el('li', l))
  const keys = el('div', '', 'gm-keys')
  keys.append(key2('My CV', 'gm-go', () => { close(); hooks.openPanel('profile') }), key2(next ? 'Go to Campus' : 'Close', 'gm-ghost', () => { close(); if (next) hooks.openPanel('learn') }))
  card.append(ul, keys)
}
