// The Grind desk: the laptop on the bedroom desk is where a Web3 player actually makes a living online. Five
// original apps stand in for the real ones (no brands): Feed (the microblog where you build an audience), Wire
// (group chats and DMs, where the alpha and the scams arrive), Guilds (project communities with roles and
// whitelists), Gigs (paid Web3 work: moderation, threads, ambassadors, bug reports) and Farm (testnet activity
// toward airdrops, done honestly: one wallet, real usage, the official claim site). Your CV is one more icon.
// Everything pays in-game money and reputation only. Progress lives beside the save, never inside it.
import { getSave, slotKey, earnCash, addReputation } from './state.ts'

type Ctx = { toast: (m: string) => void; openPanel: (p: 'profile') => void; onClose: () => void }
type Farm = { days: number; last: string; done: string[]; flagged?: boolean; claimed?: boolean }
type Data = {
  followers: number; posts: Array<{ t: string; likes: number; reposts: number; at: number }>; postDay: string; postedToday: string[]
  roles: Record<string, number>; guildDay: Record<string, string[]>; gigsDay: string; gigs: string[]
  wireDay: string; wireDone: string[]; scamsSpotted: number; farm: Record<string, Farm>; earned: number
}
const KEY = () => `${slotKey()}.grinddesk`
const today = () => new Date().toISOString().slice(0, 10)
function load(): Data {
  const base: Data = { followers: 12, posts: [], postDay: '', postedToday: [], roles: {}, guildDay: {}, gigsDay: '', gigs: [], wireDay: '', wireDone: [], scamsSpotted: 0, farm: {}, earned: 0 }
  try { return { ...base, ...(JSON.parse(localStorage.getItem(KEY()) ?? '{}') as Partial<Data>) } } catch { return base }
}
const save = (d: Data) => { try { localStorage.setItem(KEY(), JSON.stringify(d)) } catch { /* private mode */ } }
const fmt = (n: number) => n >= 10000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-US')
const passedCourses = () => Object.entries(getSave().skills as Record<string, { passed?: boolean } | undefined>).filter(([, v]) => v?.passed).length

// ---------------------------------------------------------------- content
type Choice = { label: string; good: boolean; why: string }
const POSTS: Array<{ id: string; title: string; text: () => string; gain: [number, number]; needs?: () => string | null; choice?: { q: string; options: Choice[] } }> = [
  { id: 'gm', title: 'GM + what you are building today', text: () => `gm. Today: ${['finishing a Campus course', 'testing a new testnet', 'writing my first thread', 'learning how bridges work'][new Date().getDay() % 4]}. What are you building?`, gain: [3, 9] },
  { id: 'thread', title: 'Thread: what I learned this week', text: () => `What I learned passing ${passedCourses()} Web3 courses, in 6 posts 🧵 1/ Most "free money" offers are the cost, not the reward…`, gain: [14, 40], needs: () => passedCourses() ? null : 'Pass a Campus course first: threads need something real to teach.' },
  { id: 'take', title: 'Market take', text: () => 'Market take: sizing small, stop below the range, no leverage this week. Not financial advice.', gain: [6, 18], choice: { q: 'Which take do you post?', options: [
    { label: '"Sizing small, stop below the range. Not financial advice."', good: true, why: 'Measured takes build trust slowly, and trust is what gets you hired.' },
    { label: '"This coin 100x GUARANTEED, ape now 🚀"', good: false, why: 'Guarantees are how scams talk. You lose credibility, and if it dumps your name is on it.' },
  ] } },
  { id: 'reply', title: 'Reply to a big account', text: () => 'Replied with a short breakdown of how the bridge fee is split, with a diagram.', gain: [8, 26], choice: { q: 'A founder with 400k followers posts about their testnet. Your reply?', options: [
    { label: 'A short, useful breakdown of something in their post', good: true, why: 'Value-first replies are how small accounts get noticed by the people who hire.' },
    { label: '"wen airdrop ser?"', good: false, why: 'Everyone posts that. It gets muted, not noticed.' },
  ] } },
]
const SCAMS: Array<{ id: string; from: string; msg: string; safe: string; bad: string; lesson: string }> = [
  { id: 'support', from: 'Nova Support 🛡️ (DM)', msg: 'Hi! Your wallet is flagged for the airdrop. Please verify it here and enter your 12 words to sync: nova-verify.app', safe: 'Block and report', bad: 'Verify my wallet', lesson: 'Real teams never DM first and never ask for your recovery phrase. Anyone who has those words owns the wallet.' },
  { id: 'double', from: 'Elon Giveaway 2x (DM)', msg: 'Send 0.2 ETH, get 0.4 back instantly. Only 1 hour left!', safe: 'Ignore and block', bad: 'Send 0.2 to test it', lesson: 'Nobody doubles your money. "Send to receive" is always a scam, and the countdown is there to stop you thinking.' },
  { id: 'job', from: 'Recruiter, "Big Web3 Studio" (DM)', msg: 'Great profile! Paid role, $4k/week. First, download our test project and run it on your main laptop.', safe: 'Decline: offer to review the code online', bad: 'Download and run it', lesson: 'Fake job tests are a common way to plant malware that steals wallets and logins. Real employers do not need you to run unknown files.' },
  { id: 'pump', from: 'Alpha Hunters VIP (group)', msg: '🚨 $MOONX buy NOW before CEX listing, 50x incoming, admins already loaded', safe: 'Mute the group', bad: 'Buy before the listing', lesson: 'Admins who "already loaded" sell into your buy. That is a pump and dump, and you are the exit.' },
  { id: 'claim', from: 'Drift DEX Airdrop (group)', msg: 'Airdrop is LIVE! Claim at drift-dex-claim.xyz, connect and approve.', safe: 'Check the official site first', bad: 'Connect and approve', lesson: 'Lookalike claim sites ask you to "approve" unlimited spending. Only claim from the link on the project\'s own site and announcement channel.' },
]
const GUILDS: Array<{ id: string; name: string; about: string; tasks: Array<{ id: string; title: string; q?: { q: string; options: Choice[] } }> }> = [
  { id: 'nova', name: 'Project Nova', about: 'A layer-2 testnet with a community of builders.', tasks: [
    { id: 'gm', title: 'Say GM in #general' },
    { id: 'help', title: 'Help a newcomer', q: { q: 'Newcomer: "What is a testnet token worth?"', options: [
      { label: 'Nothing: it is free play money for testing, never pay for it', good: true, why: 'Exactly. Anyone selling testnet tokens is scamming.' },
      { label: 'About $1 each, buy some to farm faster', good: false, why: 'Testnet tokens have no value and come free from a faucet.' } ] } },
    { id: 'bug', title: 'File a bug report', q: { q: 'Which bug report gets fixed?', options: [
      { label: 'Steps to reproduce, what you expected, what happened, tx hash and a screenshot', good: true, why: 'Clear reports get fixed and get you noticed by the team.' },
      { label: '"bridge broken pls fix"', good: false, why: 'Nobody can act on that.' } ] } },
  ] },
  { id: 'meridian', name: 'Meridian DAO', about: 'A treasury governed by token holders. Proposals every week.', tasks: [
    { id: 'gm', title: 'Read the weekly update' },
    { id: 'vote', title: 'Vote on proposal MIP-12', q: { q: 'MIP-12: send 40% of the treasury to one new team, no milestones. Your vote?', options: [
      { label: 'Against: ask for milestone-based payments', good: true, why: 'Paying in milestones protects the treasury. Good governance is boring on purpose.' },
      { label: 'For: they seem nice', good: false, why: 'Big payments with no milestones are how DAOs get drained.' } ] } },
    { id: 'ama', title: 'Join the AMA with the core team' },
  ] },
  { id: 'pixel', name: 'Pixel Shrimp', about: 'An NFT art community. Contests, collabs and a whitelist for active members.', tasks: [
    { id: 'gm', title: 'Post your art in #gallery' },
    { id: 'contest', title: 'Enter the meme contest' },
    { id: 'mod', title: 'Spot the fake mint link', q: { q: 'Two mint links are posted. Which is real?', options: [
      { label: 'The one in #announcements, posted by the team and pinned', good: true, why: 'Official channels only. Links in chat and DMs are where wallets get drained.' },
      { label: 'The one a member posted, "mint is live hurry"', good: false, why: 'Members cannot post in announcements; that link is the trap.' } ] } },
  ] },
]
const ROLES = ['Newcomer', 'Member', 'Contributor', 'OG']
const GIGS: Array<{ id: string; title: string; pay: number; rep: number; need?: () => string | null; q: { q: string; options: Choice[] } }> = [
  { id: 'mod', title: 'Community moderator shift', pay: 45, rep: 2, q: { q: 'A member posts a "support" link and tags newcomers. You:', options: [
    { label: 'Delete it, ban the account, warn the channel', good: true, why: 'Fast removal protects members. That is the job.' },
    { label: 'Leave it, they might be helping', good: false, why: 'Fake support links are the most common drain in community chats.' } ] } },
  { id: 'thread', title: 'Thread writer for a wallet app', pay: 70, rep: 3, need: () => load().followers >= 100 || passedCourses() >= 2 ? null : 'Needs 100 followers or two passed courses.', q: { q: 'Best opening line for the thread?', options: [
    { label: '"Most people lose crypto to one mistake. Here is how to avoid it in 5 steps 🧵"', good: true, why: 'A clear promise and a reason to keep reading.' },
    { label: '"Thread about our wallet app. Please read."', good: false, why: 'No hook, no reason to care.' } ] } },
  { id: 'translate', title: 'Translate an announcement', pay: 40, rep: 2, q: { q: 'The source says "Mainnet is delayed to Q3." Your translation must:', options: [
    { label: 'Say exactly that, delay and date included', good: true, why: 'Translators are trusted to keep the meaning, bad news included.' },
    { label: 'Soften it to "Mainnet coming soon"', good: false, why: 'Changing the meaning misleads the community and costs you the client.' } ] } },
  { id: 'design', title: 'Design a launch banner', pay: 60, rep: 2, q: { q: 'The client sends a famous brand\'s logo to "add for hype". You:', options: [
    { label: 'Use only the client\'s own assets', good: true, why: 'Using brands you do not own invites takedowns and lawsuits.' },
    { label: 'Add it, everyone does', good: false, why: 'That is infringement, and the banner gets pulled.' } ] } },
  { id: 'ambassador', title: 'Ambassador, one week', pay: 150, rep: 5, need: () => Object.values(load().roles).some((r) => r >= 2) ? null : 'Needs the Contributor role in a guild.', q: { q: 'Your paid post about the project must:', options: [
    { label: 'Say it is sponsored (#ad) and give your honest view', good: true, why: 'Disclosure is the law in many places and it keeps your audience\'s trust.' },
    { label: 'Hide that you are paid', good: false, why: 'Undisclosed promotion is deceptive, and audiences notice.' } ] } },
  { id: 'bounty', title: 'Bug bounty: review a reported issue', pay: 250, rep: 6, need: () => passedCourses() >= 4 ? null : 'Needs four passed courses.', q: { q: 'Which report is a real security bug?', options: [
    { label: 'Anyone can call withdraw() for another user\'s balance', good: true, why: 'Missing access control on a withdrawal is critical. Responsible disclosure pays.' },
    { label: 'The button colour is slightly off on mobile', good: false, why: 'Worth a ticket, not a bounty.' } ] } },
]
const FARMS: Array<{ id: string; name: string; about: string; tasks: string[] }> = [
  { id: 'nova', name: 'Nova L2 testnet', about: 'New layer-2. Rumoured airdrop for real early users.', tasks: ['Get test ETH from the faucet', 'Bridge to Nova', 'Swap on the testnet DEX', 'Mint the testnet badge'] },
  { id: 'drift', name: 'Drift DEX', about: 'A testnet exchange counting liquidity providers and traders.', tasks: ['Add liquidity to a pool', 'Make a small swap', 'Daily check-in on the quest board'] },
  { id: 'orbit', name: 'Orbit Bridge', about: 'A bridge between testnets. Activity across weeks matters.', tasks: ['Bridge out', 'Bridge back', 'Give feedback in the form'] },
]
const SNAPSHOT_DAYS = 5

// ---------------------------------------------------------------- UI
let root: HTMLElement | null = null
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e }
const btn = (text: string, cls: string, f: () => void) => { const b = el('button', `gd-btn ${cls}`, text); b.type = 'button'; b.onclick = f; return b }

export function closeGrindDesk(): void { root?.remove(); root = null }

export function openGrindDesk(ctx: Ctx): void {
  closeGrindDesk()
  const d = load()
  if (d.postDay !== today()) { d.postDay = today(); d.postedToday = [] }
  if (d.gigsDay !== today()) { d.gigsDay = today(); d.gigs = [] }
  if (d.wireDay !== today()) { d.wireDay = today(); d.wireDone = [] }
  save(d)
  root = el('div', 'gdesk'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Grind desk laptop')
  const screen = el('div', 'gdesk-screen')
  const bar = el('div', 'gdesk-bar')
  const clock = el('span', 'gdesk-clock', new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
  const earned = el('span', 'gdesk-earned')
  const paint = () => { earned.textContent = `Earned here: $${fmt(Math.round(load().earned))}` }
  paint()
  bar.append(el('b', '', 'Grind desk'), earned, clock, btn('Close laptop', 'gdesk-close', () => { closeGrindDesk(); ctx.onClose() }))
  const body = el('div', 'gdesk-body')
  const dock = el('nav', 'gdesk-dock')
  const view = el('section', 'gdesk-view')
  const apps: Array<[string, string, string, () => void]> = [
    ['feed', '✦', 'Feed', () => feed()], ['wire', '✉', 'Wire', () => wire()], ['guilds', '⌘', 'Guilds', () => guilds()],
    ['gigs', '$', 'Gigs', () => gigs()], ['farm', '⛏', 'Farm', () => farm()], ['cv', '◎', 'My CV', () => { closeGrindDesk(); ctx.onClose(); ctx.openPanel('profile') }],
  ]
  const icons = new Map<string, HTMLButtonElement>()
  for (const [id, glyph, label, run] of apps) {
    const b = el('button', `gdesk-app app-${id}`); b.type = 'button'
    b.append(el('span', 'gdesk-icon', glyph), el('span', 'gdesk-label', label))
    b.onclick = () => { for (const x of icons.values()) x.classList.remove('on'); b.classList.add('on'); view.scrollTop = 0; run() }
    icons.set(id, b); dock.append(b)
  }
  body.append(dock, view); screen.append(bar, body)
  root.append(screen); document.body.append(root)

  const reward = (usd: number, rep: number, label: string, detail: string) => {
    const x = load(); x.earned += usd; save(x)
    if (usd > 0) earnCash(usd, label, detail)
    if (rep > 0) addReputation(rep, label, detail)
    paint()
  }
  const head = (title: string, sub: string) => { view.replaceChildren(); view.append(el('h2', 'gdesk-h', title), el('p', 'gdesk-sub', sub)) }
  const card = (title: string, text = '') => { const c = el('div', 'gdesk-card'); c.append(el('b', '', title)); if (text) c.append(el('p', '', text)); view.append(c); return c }
  /** A decision: two options, the right one rewarded; the lesson is shown either way. */
  const decide = (into: HTMLElement, q: string, options: Choice[], onGood: () => void, onBad?: () => void) => {
    const box = el('div', 'gdesk-q'); box.append(el('p', 'gdesk-qq', q))
    const order = [...options].sort(() => Math.random() - 0.5)
    for (const o of order) box.append(btn(o.label, 'opt', () => {
      box.replaceChildren(el('p', o.good ? 'gdesk-ok' : 'gdesk-no', `${o.good ? '✓ Good call.' : '✗ Not this one.'} ${o.why}`))
      if (o.good) onGood(); else onBad?.()
    }))
    into.append(box)
  }

  function feed() {
    const x = load(), s = getSave()
    head('Feed', 'Build an audience by being useful. Followers open doors to paid threads, ambassador roles and jobs.')
    const me = card(`${s.name || 'You'} · @${s.username || 'you'}`, `${fmt(x.followers)} followers · ${x.posts.length} posts`)
    me.classList.add('gdesk-me')
    for (const p of POSTS) {
      const posted = x.postedToday.includes(p.id)
      const c = card(p.title, posted ? 'Posted today. Come back tomorrow.' : '')
      const need = p.needs?.()
      if (posted) continue
      if (need) { c.append(el('p', 'gdesk-muted', need)); continue }
      const publish = (good: boolean) => {
        const y = load()
        const [lo, hi] = p.gain
        const gain = good ? Math.round(lo + Math.random() * (hi - lo) + y.followers * 0.02) : -Math.min(y.followers - 1, Math.round(lo / 2))
        const likes = good ? Math.round(gain * (2 + Math.random() * 3)) : Math.round(Math.random() * 3)
        y.followers = Math.max(1, y.followers + gain)
        y.posts.unshift({ t: p.text(), likes, reposts: Math.round(likes / 6), at: Date.now() }); y.posts.length = Math.min(y.posts.length, 12)
        y.postedToday.push(p.id); save(y)
        if (good) reward(0, p.id === 'thread' ? 2 : 1, 'Feed post', `${p.title}: ${gain >= 0 ? '+' : ''}${gain} followers`)
        ctx.toast(good ? `Posted. ${likes} likes, +${gain} followers.` : `Posted. ${likes} likes, ${gain} followers.`)
        window.setTimeout(feed, 1400)
      }
      if (p.choice) decide(c, p.choice.q, p.choice.options, () => publish(true), () => publish(false))
      else { c.append(el('p', 'gdesk-draft', p.text())); c.append(btn('Post', 'primary', () => publish(true))) }
    }
    if (x.followers >= 500) card('Sponsored posts unlocked', 'Brands pay accounts your size. Find them in Gigs (Ambassador), and always disclose #ad.')
    if (x.posts.length) {
      view.append(el('h3', 'gdesk-h3', 'Your posts'))
      for (const p of x.posts.slice(0, 6)) { const c = card('', p.t); c.querySelector('b')!.remove(); c.append(el('small', 'gdesk-muted', `♥ ${fmt(p.likes)}  ⟲ ${fmt(p.reposts)}  · ${new Date(p.at).toLocaleDateString()}`)) }
    }
  }

  function wire() {
    const x = load()
    head('Wire', 'Group chats and DMs: where the real alpha and the real scams both arrive. Spot the scam, keep your wallet.')
    card('Grind District · Announcements', 'Official channel. New today: airdrop farming on the Farm app, paid gigs in Gigs, and Guild roles. Only links posted here are real.')
    const day = Math.floor(Date.now() / 86400000)
    const queue = [0, 1, 2].map((i) => SCAMS[(day + i * 2) % SCAMS.length]!)
    for (const sc of queue) {
      const done = x.wireDone.includes(sc.id)
      const c = card(sc.from, sc.msg); c.classList.add('gdesk-dm')
      if (done) { c.append(el('p', 'gdesk-muted', 'Handled.')); continue }
      decide(c, 'What do you do?', [{ label: sc.safe, good: true, why: sc.lesson }, { label: sc.bad, good: false, why: `In real life this is where people lose everything. ${sc.lesson}` }], () => {
        const y = load(); y.wireDone.push(sc.id); y.scamsSpotted += 1; save(y); reward(0, 2, 'Scam spotted', `${sc.from}: ${sc.safe}`)
      }, () => { const y = load(); y.wireDone.push(sc.id); save(y) })
    }
    card('Scams spotted so far', `${x.scamsSpotted}. Every one of these is a real pattern used today.`)
  }

  function guilds() {
    const x = load()
    head('Guilds', 'Project communities. Show up, help, and contribute: roles lead to whitelists, tester spots and paid work.')
    for (const g of GUILDS) {
      const lvl = x.roles[g.id] ?? 0
      const doneToday = x.guildDay[g.id]?.[0] === today() ? x.guildDay[g.id]!.slice(1) : []
      const c = card(`${g.name} · ${ROLES[lvl]}`, g.about)
      const meter = el('div', 'gdesk-meter'); const fill = el('i'); fill.style.width = `${(lvl / 3) * 100}%`; meter.append(fill); c.append(meter)
      if (lvl >= 3) { c.append(el('p', 'gdesk-ok', 'OG role: whitelisted for the launch and on the early tester list.')); continue }
      for (const t of g.tasks) {
        if (doneToday.includes(t.id)) { c.append(el('p', 'gdesk-muted', `✓ ${t.title}`)); continue }
        const finish = () => {
          const y = load(); const prev = y.guildDay[g.id]?.[0] === today() ? y.guildDay[g.id]!.slice(1) : []
          y.guildDay[g.id] = [today(), ...prev, t.id]
          const all = y.guildDay[g.id]!.length - 1 >= g.tasks.length
          if (all) y.roles[g.id] = Math.min(3, (y.roles[g.id] ?? 0) + 1)
          save(y)
          reward(0, all ? 4 : 1, `${g.name}`, all ? `Promoted to ${ROLES[y.roles[g.id]!]}` : t.title)
          if (all) ctx.toast(`${g.name}: you are now ${ROLES[y.roles[g.id]!]}.`)
          window.setTimeout(guilds, t.q ? 1600 : 200)
        }
        if (t.q) { const sub = el('div', 'gdesk-sub-task'); sub.append(el('b', '', t.title)); c.append(sub); decide(sub, t.q.q, t.q.options, finish) }
        else c.append(btn(t.title, 'ghost', finish))
      }
      c.append(el('small', 'gdesk-muted', 'Do every task in a day to move up a role.'))
    }
  }

  function gigs() {
    const x = load()
    head('Gigs', `Paid Web3 work. Up to three gigs a day (${x.gigs.length} done today). Pay is in-game money.`)
    for (const gg of GIGS) {
      const c = card(`${gg.title} · $${gg.pay}`)
      if (x.gigs.includes(gg.id)) { c.append(el('p', 'gdesk-muted', 'Done today. Paid.')); continue }
      const need = gg.need?.()
      if (need) { c.append(el('p', 'gdesk-muted', `🔒 ${need}`)); continue }
      if (x.gigs.length >= 3) { c.append(el('p', 'gdesk-muted', 'Three gigs done today. Rest; more tomorrow.')); continue }
      decide(c, gg.q.q, gg.q.options, () => {
        const y = load(); y.gigs.push(gg.id); save(y); reward(gg.pay, gg.rep, 'Gig paid', `${gg.title}: $${gg.pay}`)
        ctx.toast(`Paid $${gg.pay} for ${gg.title.toLowerCase()}.`)
      }, () => { const y = load(); y.gigs.push(gg.id); save(y); ctx.toast('The client went with someone else this time.') })
    }
  }

  function farm() {
    const x = load()
    head('Farm', `Airdrop farming done right: real use of testnets, a little every day, one wallet. After ${SNAPSHOT_DAYS} active days a project takes its snapshot.`)
    card('The rules that keep you eligible', 'Testnet tokens are free and worth nothing. Never pay to farm. Never sign approvals you do not understand. Many wallets for one person (a "sybil") gets everything cancelled. Claim only from the project\'s own site.')
    for (const f of FARMS) {
      const st: Farm = x.farm[f.id] ?? { days: 0, last: '', done: [] }
      const doneToday = st.last === today() ? st.done : []
      const c = card(`${f.name} · ${st.days} active day${st.days === 1 ? '' : 's'}`, f.about)
      const meter = el('div', 'gdesk-meter'); const fill = el('i'); fill.style.width = `${Math.min(1, st.days / SNAPSHOT_DAYS) * 100}%`; meter.append(fill); c.append(meter)
      if (st.flagged) { c.append(el('p', 'gdesk-no', 'Flagged as a sybil: this wallet is excluded. Farming honestly elsewhere still counts.')); continue }
      if (st.claimed) { c.append(el('p', 'gdesk-ok', 'Airdrop claimed. On to the next one.')); continue }
      if (st.days >= SNAPSHOT_DAYS) {
        c.append(el('p', 'gdesk-ok', 'Snapshot taken. The claim is live.'))
        decide(c, 'Where do you claim?', [
          { label: `The link on ${f.name}'s own site and pinned announcement`, good: true, why: 'Official link only. The rest are drainers waiting for claim day.' },
          { label: `${f.id}-claim-airdrop.xyz from a reply under their post`, good: false, why: 'Lookalike claim sites drain wallets on every airdrop day.' },
        ], () => {
          const amt = Math.round(80 + Math.random() * 320)
          const y = load(); y.farm[f.id] = { ...st, claimed: true }; save(y)
          reward(amt, 6, 'Airdrop claimed', `${f.name}: $${amt} in-game`)
          ctx.toast(`Airdrop: $${amt} from ${f.name}. Real airdrops vary; many farmers get nothing.`)
        })
        continue
      }
      for (const t of f.tasks) {
        if (doneToday.includes(t)) { c.append(el('p', 'gdesk-muted', `✓ ${t}`)); continue }
        c.append(btn(t, 'ghost', () => {
          const y = load(); const cur: Farm = y.farm[f.id] ?? { days: 0, last: '', done: [] }
          const done = cur.last === today() ? [...cur.done, t] : [t]
          const days = cur.last === today() ? cur.days : cur.days + 1
          y.farm[f.id] = { ...cur, last: today(), done, days }; save(y)
          ctx.toast(cur.last === today() ? `${t}: done.` : `${t}: done. Active day ${days} of ${SNAPSHOT_DAYS}.`)
          farm()
        }))
      }
      c.append(btn('Spin up 20 wallets to multiply', 'danger', () => {
        const y = load(); y.farm[f.id] = { ...(y.farm[f.id] ?? st), flagged: true }; save(y)
        ctx.toast('Flagged. Projects cluster wallets funded from one source and cancel them all.')
        farm()
      }))
    }
  }

  icons.get('feed')!.click()
}

/** The laptop screen on the desk: the grind desktop with a feed, a chat and the farm checklist. */
export function paintDesktop(g: CanvasRenderingContext2D, w: number, h: number): void {
  const x = load(), s = getSave()
  const F = '"Inter Variable", system-ui, sans-serif'
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#0f1a15'); bg.addColorStop(1, '#1b2b23')
  g.fillStyle = bg; g.fillRect(0, 0, w, h)
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, w, 22)
  g.fillStyle = '#e9cf8e'; g.font = `700 13px ${F}`; g.fillText('Grind desk', 10, 15)
  g.fillStyle = '#b9c2bb'; g.font = `500 12px ${F}`; g.fillText(`@${s.username || 'you'} · ${fmt(x.followers)} followers`, 110, 15)
  const win = (wx: number, wy: number, ww: number, wh: number, title: string, lines: string[], accent: string) => {
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.roundRect(wx, wy, ww, wh, 8); g.fill()
    g.fillStyle = accent; g.beginPath(); g.roundRect(wx, wy, ww, 20, [8, 8, 0, 0]); g.fill()
    g.fillStyle = '#fff'; g.font = `700 11px ${F}`; g.fillText(title, wx + 8, wy + 14)
    g.fillStyle = '#2a2418'; g.font = `500 11px ${F}`
    lines.forEach((l, i) => g.fillText(l, wx + 8, wy + 36 + i * 16, ww - 16))
  }
  win(10, 32, 250, 160, 'Feed', ['gm. Building today.', '♥ 24   ⟲ 4', 'Thread: 5 ways people lose crypto 🧵', '♥ 182  ⟲ 31', `${x.posts.length} posts · ${fmt(x.followers)} followers`, 'Next: reply with value'], '#14a058')
  win(270, 32, 232, 120, 'Wire', ['Announcements: Farm is live', 'Nova Support (DM): verify wallet', '⚠ Scam: blocked and reported', `Scams spotted: ${x.scamsSpotted}`], '#3b6fd6')
  win(270, 162, 232, 148, 'Farm', ['Nova L2 · ' + (x.farm.nova?.days ?? 0) + ' days', 'Drift DEX · ' + (x.farm.drift?.days ?? 0) + ' days', 'Orbit Bridge · ' + (x.farm.orbit?.days ?? 0) + ' days', 'One wallet. Real use.', 'Official claim links only'], '#b8903e')
  win(10, 202, 250, 108, 'Gigs', ['Community moderator · $45', 'Thread writer · $70', 'Ambassador · $150', `Earned here: $${fmt(Math.round(x.earned))}`], '#7b4bd1')
}
