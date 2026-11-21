// A city resident's public profile, opened by tapping them on the street: the same kind of page a real player
// has (a full-body shot, who they are, what they do, what they are studying, how well you know them), built from
// their persona (npcs.ts). Residents are city characters, not players, and the page says so. Nothing here shows
// anyone's balance. Say hello and Gift are the same friendship actions as the small card had (town.ts).
import { SKILL_META, type SkillId } from './logic.ts'

export type ResidentInfo = { name: string; trait: string; routine: string; doing: string; lines?: string[] }

type Bio = { about: string; tags: string[]; courses: SkillId[] }
/** What each kind of resident is about. Keys match the persona traits in npcs.ts; anything else gets the default. */
const BIOS: Record<string, Bio> = {
  'Builder': { about: 'Ships small things fast and fixes them in public. Always has a side project open on a café table.', tags: ['Building', 'Hackathons', 'Open source'], courses: ['building', 'agents', 'apps'] },
  'Researcher': { about: 'Reads the whitepaper before the thread. Keeps notes on every protocol she looks at.', tags: ['Research', 'Docs', 'Layer 2s'], courses: ['layers', 'trilemma', 'explorer'] },
  'Designer': { about: 'Cares how things feel to use. Thinks most wallets still have too many buttons.', tags: ['Design', 'Fashion', 'Brand'], courses: ['nfts', 'content', 'wallets'] },
  'Founder': { about: 'Building a payments app for small shops. Talks to customers every week, tokens later.', tags: ['Startups', 'Fundraising', 'Payments'], courses: ['building', 'stables', 'daos'] },
  'Analyst': { about: 'Charts first, opinions later. Keeps a trade journal and shares the losing trades too.', tags: ['Markets', 'Charts', 'Journaling'], courses: ['spot', 'risk', 'liquidity'] },
  'Community manager': { about: 'Runs the plaza meetups and knows every new face by the second visit.', tags: ['Community', 'Events', 'Moderation'], courses: ['community', 'content', 'scams'] },
  'Product designer': { about: 'Tests every flow with someone who has never used crypto. Sketching a calmer wallet.', tags: ['Product', 'UX', 'Research'], courses: ['wallets', 'defi', 'apps'] },
  'Content creator': { about: 'Explains Web3 in plain words on video. Discloses every holding, cites every source.', tags: ['Video', 'Threads', 'Education'], courses: ['content', 'community', 'memes'] },
  'Careful trader': { about: 'Sizes every position before he thinks about the story. Stop-loss is self-respect.', tags: ['Trading', 'Risk', 'Discipline'], courses: ['risk', 'spot', 'stables'] },
  'Community lead': { about: 'Hosts the podium talks and believes good communities compound like interest.', tags: ['Community', 'Speaking', 'Governance'], courses: ['community', 'daos', 'content'] },
  'Security nerd': { about: 'Hardware wallet, always. Checks every address twice and revokes old approvals monthly.', tags: ['Security', 'Wallets', 'Audits'], courses: ['wallets', 'custody', 'scams'] },
  'Calm saver': { about: 'Slow money is still money. Runs every morning and reviews his budget every Sunday.', tags: ['Saving', 'Stablecoins', 'Fitness'], courses: ['stables', 'staking', 'money'] },
  'Smart-contract dev': { about: 'Writes tests before deploys and reads contracts, not tweets. Audits at the library.', tags: ['Solidity', 'Audits', 'Testing'], courses: ['building', 'explorer', 'defi'] },
  'Market maker': { about: 'Watches spreads all morning. Says liquidity is a promise and never trades tired.', tags: ['Liquidity', 'Markets', 'Spreads'], courses: ['liquidity', 'spot', 'risk'] },
  'Game designer': { about: 'Fun first, tokens later. Playtests the arcade every week and builds tools for guilds.', tags: ['Games', 'Guilds', 'NFTs'], courses: ['nfts', 'building', 'community'] },
  'Student': { about: 'Working through the Campus worlds one course at a time. Group study at seven.', tags: ['Learning', 'Campus', 'Study group'], courses: ['wallets', 'internet', 'money'] },
}
const DEFAULT_BIO: Bio = { about: 'Lives and works in Grind District.', tags: ['Grind District'], courses: ['internet', 'wallets'] }
export const bioFor = (trait: string): Bio => BIOS[trait] ?? DEFAULT_BIO

const hash = (s: string): number => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h }
/** A stable handle and standing for a resident, so the same person always shows the same page. */
export const handleFor = (name: string): string => `${name.toLowerCase().replace(/[^a-z]/g, '')}.grind`
export const standingFor = (name: string): { rep: number; since: string } => {
  const h = hash(name)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October']
  return { rep: 40 + (h % 56), since: `${months[(h >>> 8) % months.length]} 2026` }
}

type Friendship = { level: string; hello: () => { ok: boolean; message: string }; gift: () => { ok: boolean; message: string } }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const key = (label: string, cls: string, on: (e?: Event) => void) => { const b = el('button', label, `gm-key ${cls}`); b.type = 'button'; b.onclick = on; return b }

/** Open the profile. `shot` is a full-body portrait (data URL) or null; `friend` comes from town.ts. */
export function openResidentProfile(r: ResidentInfo, o: { shot: string | null; friend: () => Promise<Friendship>; toast: (m: string) => void }): void {
  document.getElementById('gd-modal')?.remove()
  const bio = bioFor(r.trait), st = standingFor(r.name)
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', `${r.name}'s profile`)
  const card = el('div', '', 'gm-card rp-card')
  const close = () => shade.remove()
  shade.addEventListener('click', (e) => { if (e.target === shade) close() })
  const head = el('div', '', 'gm-head'), t = el('div')
  t.append(el('p', 'Resident · public profile', 'gm-kick'), el('h3', r.name, 'gm-title'), el('p', `@${handleFor(r.name)} · ${r.trait}`, 'gm-sub'))
  head.append(t, key('Close', 'gm-ghost', close))
  card.append(head)
  const top = el('div', '', 'rp-top')
  if (o.shot) { const img = el('img', '', 'rp-shot'); img.src = o.shot; img.alt = `${r.name}, full body`; top.append(img) }
  const facts = el('div', '', 'rp-facts')
  const fact = (k: string, v: string) => { const d = el('div', '', 'rp-fact'); d.append(el('span', k), el('b', v)); facts.append(d) }
  fact('Right now', r.doing)
  fact('Daily routine', r.routine)
  fact('Reputation', String(st.rep))
  fact('In the city since', st.since)
  const you = el('div', '', 'rp-fact'); you.append(el('span', 'You and them'), el('b', '…')); facts.append(you)
  top.append(facts)
  card.append(top)
  card.append(el('h4', 'About', 'rp-h'), el('p', bio.about, 'rp-about'))
  const tags = el('div', '', 'rp-tags'); for (const tg of bio.tags) tags.append(el('span', tg, 'rp-tag'))
  card.append(tags)
  card.append(el('h4', 'Studying on Campus', 'rp-h'))
  const studying = el('ul', '', 'rp-list'); for (const c of bio.courses) studying.append(el('li', SKILL_META[c]?.title ?? c)); card.append(studying)
  if (r.lines?.length) {
    card.append(el('h4', 'Often says', 'rp-h'))
    const q = el('div', '', 'rp-quotes'); for (const l of r.lines.slice(0, 3)) q.append(el('p', `“${l}”`)); card.append(q)
  }
  const keys = el('div', '', 'gm-keys')
  card.append(keys)
  card.append(el('p', `${r.name} is a city resident, not a real player. Real players have a gold ring at their feet: tap one to see their profile and message them.`, 'gm-sub rp-note'))
  shade.append(card); document.body.append(shade)
  void o.friend().then((f) => {
    if (!card.isConnected) return
    const paint = (lv: string) => { (you.querySelector('b') as HTMLElement).textContent = lv }
    paint(f.level)
    // One action at a time: both keys rest while one runs, show that it is working, then say what happened.
    // (A gift is charged once a day by town.ts; this also stops a quick second tap from looking like a second try.)
    let busy = false
    const btns: HTMLButtonElement[] = []
    const run = (fn: () => { ok: boolean; message: string }, label: string, working: string, doneLabel: string) => (e?: Event) => {
      const b = e?.currentTarget as HTMLButtonElement | undefined
      if (busy) return
      busy = true
      for (const x of btns) { x.disabled = true; x.setAttribute('aria-busy', 'true') }
      if (b) b.textContent = working
      const out = fn()
      o.toast(out.message)
      void o.friend().then((g) => paint(g.level))
      window.setTimeout(() => {
        busy = false
        for (const x of btns) { x.disabled = false; x.removeAttribute('aria-busy') }
        if (b) { b.textContent = out.ok ? doneLabel : label; if (out.ok) b.disabled = true }
      }, 1800)
    }
    const hi = key('Say hello', 'gm-ghost', run(f.hello, 'Say hello', 'Saying hello…', 'Said hello ✓'))
    const gift = key('Gift · $10', 'gm-go', run(f.gift, 'Gift · $10', 'Giving…', 'Gift given ✓'))
    btns.push(hi, gift)
    keys.append(hi, gift)
  })
}
