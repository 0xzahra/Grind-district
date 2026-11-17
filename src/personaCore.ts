// The personality reading: pure functions over a player's long-term play record (persona.ts keeps the record on
// the device). Everything here is computed from what the player actually did, with the evidence shown and a
// confidence that grows with the amount of play behind it. When there is not enough play yet, a trait says so and
// says what would unlock it, instead of guessing. The zodiac reading is kept apart and labelled "for fun": the
// sign never moves a trait; the game only says whether the play agrees with it.
// No money amounts appear in any text (sizes are shares of cash, never dollars), so the card is safe to share.

/** An open spot position: when it opened, average cost, worst fall seen (fraction), and dip state (`seen` once it fell 10%). */
export type SpotOpen = { at: number; avg: number; worst: number; dipped: boolean; seen?: boolean }
export type PerpOpen = { at: number; lev: number; side: 'long' | 'short' }
export type PersonaRecord = {
  v: 1
  since: number
  /** Activity counts by local hour (24) and weekday (7, Sunday first). */
  hours: number[]
  days: number[]
  /** Local dates (YYYY-MM-DD) with any activity, newest last, at most 90. */
  active: string[]
  kinds: Record<string, number>
  sessions: number
  playMin: number
  lastSeen: number
  spot: {
    buys: number; sells: number; converts: number
    sellsAtLoss: number; sellsAtProfit: number
    /** Sold at a loss within 30 minutes of buying. */
    quickLoss: number
    /** Sold at a loss near the worst point of a 10%+ dip. */
    panic: number
    /** Positions that fell 10% or more while held. */
    dips: number
    /** Of those, positions held until they were back in profit (sold green, or still held and green). */
    recovered: number
    big: number; alt: number; meme: number
    /** Share of the cash on hand used per buy (0..1), last 60. */
    sizes: number[]
    /** Hold times of closed positions in minutes, last 60. */
    holds: number[]
    open: Record<string, SpotOpen>
  }
  perps: {
    opens: number; closes: number; liquidations: number; wins: number; losses: number
    levSum: number; lev10: number; shorts: number
    holds: number[]
    open: Record<string, PerpOpen[]>
  }
  places: Record<string, number>
  panels: Record<string, number>
  acts: Record<string, number>
  family: { paid: number; left: number }
  buys: number
}

export const blankRecord = (now = Date.now()): PersonaRecord => ({
  v: 1, since: now, hours: Array(24).fill(0), days: Array(7).fill(0), active: [], kinds: {}, sessions: 0, playMin: 0, lastSeen: 0,
  spot: { buys: 0, sells: 0, converts: 0, sellsAtLoss: 0, sellsAtProfit: 0, quickLoss: 0, panic: 0, dips: 0, recovered: 0, big: 0, alt: 0, meme: 0, sizes: [], holds: [], open: {} },
  perps: { opens: 0, closes: 0, liquidations: 0, wins: 0, losses: 0, levSum: 0, lev10: 0, shorts: 0, holds: [], open: {} },
  places: {}, panels: {}, acts: {}, family: { paid: 0, left: 0 }, buys: 0,
})

/** Repair a stored record (missing fields after an update, wrong types). */
export function normalizeRecord(raw: unknown, now = Date.now()): PersonaRecord {
  const b = blankRecord(now)
  if (!raw || typeof raw !== 'object') return b
  const r = raw as Partial<PersonaRecord>
  const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d)
  const nums = (v: unknown, n: number) => (Array.isArray(v) && v.length === n ? v.map((x) => num(x)) : Array(n).fill(0))
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x) => typeof x === 'number' && Number.isFinite(x)).slice(-max) : [])
  const rec = (v: unknown): Record<string, number> => {
    const out: Record<string, number> = {}
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x)) out[k] = x
    return out
  }
  const sp = (r.spot ?? {}) as Partial<PersonaRecord['spot']>
  const pp = (r.perps ?? {}) as Partial<PersonaRecord['perps']>
  return {
    v: 1, since: num(r.since, now), hours: nums(r.hours, 24), days: nums(r.days, 7),
    active: Array.isArray(r.active) ? r.active.filter((d) => typeof d === 'string').slice(-90) : [],
    kinds: rec(r.kinds), sessions: num(r.sessions), playMin: num(r.playMin), lastSeen: num(r.lastSeen),
    spot: {
      ...b.spot, ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === 'number')),
      sizes: list(sp.sizes, 60), holds: list(sp.holds, 60),
      open: sp.open && typeof sp.open === 'object' ? sp.open : {},
    } as PersonaRecord['spot'],
    perps: {
      ...b.perps, ...Object.fromEntries(Object.entries(pp).filter(([, v]) => typeof v === 'number')),
      holds: list(pp.holds, 60), open: pp.open && typeof pp.open === 'object' ? pp.open : {},
    } as PersonaRecord['perps'],
    places: rec(r.places), panels: rec(r.panels), acts: rec(r.acts),
    family: { paid: num(r.family?.paid), left: num(r.family?.left) }, buys: num(r.buys),
  }
}

export type Confidence = 'low' | 'medium' | 'high'
export type Trait = { id: string; label: string; value: string; icon: string; confidence: Confidence; why: string[]; unlock?: string }
export type Fit = { id: string; title: string; score: number; level: 'Strong' | 'Good' | 'Emerging'; why: string[]; next: string }
export type ZodiacSign = { name: string; sym: string; trait: string }
export type PersonaFacts = {
  skills: Record<string, { passed?: boolean; tries?: number } | undefined>
  tracks: Record<string, number>
  job: string
  streak: number
  sign: ZodiacSign | null
}
export type Persona = {
  title: string
  line: string
  traits: Trait[]
  roles: Fit[]
  niches: Fit[]
  zodiac: { sign: ZodiacSign; agrees: boolean | null; note: string } | null
  evidence: number
}

const median = (xs: number[]): number => {
  if (!xs.length) return NaN
  const s = [...xs].sort((a, b) => a - b), m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const conf = (n: number, mid: number, high: number): Confidence => (n >= high ? 'high' : n >= mid ? 'medium' : 'low')
const pct = (x: number) => `${Math.round(x * 100)}%`
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const dur = (min: number): string => {
  if (!Number.isFinite(min)) return 'n/a'
  if (min < 60) return plural(Math.max(1, Math.round(min)), 'minute')
  if (min < 48 * 60) return plural(Math.round(min / 60), 'hour')
  return plural(Math.round(min / 1440), 'day')
}

/** Hand type: how the player behaves when a position goes against them. */
export function handType(r: PersonaRecord): Trait {
  const s = r.spot
  const samples = s.sells + s.dips
  if (s.sells < 3 && s.dips < 2) {
    return { id: 'hands', label: 'Hands', value: 'Not read yet', icon: '✋', confidence: 'low', why: [`${plural(s.sells, 'sale')} so far.`], unlock: 'Make a few practice trades and close some: buy, hold, sell. The reading starts after three sales.' }
  }
  const quick = s.sells ? s.quickLoss / s.sells : 0
  const panic = s.dips ? s.panic / s.dips : 0
  const held = s.dips ? s.recovered / s.dips : 0
  const lossRate = s.sells ? s.sellsAtLoss / s.sells : 0
  const why: string[] = []
  if (s.dips) why.push(`Held through ${plural(s.recovered, 'dip')} of 10% or more until back in profit (of ${s.dips}).`)
  if (s.panic) why.push(`Sold ${plural(s.panic, 'time')} near the bottom of a dip.`)
  if (s.quickLoss) why.push(`Cut ${plural(s.quickLoss, 'position')} at a loss within 30 minutes.`)
  why.push(`${pct(1 - lossRate)} of sales closed in profit.`)
  const c = conf(samples, 6, 15)
  if (s.dips >= 2 && held >= 0.6 && panic <= 0.2) return { id: 'hands', label: 'Hands', value: 'Diamond hands', icon: '💎', confidence: c, why }
  if (quick >= 0.35 || (s.dips >= 2 && panic >= 0.5)) return { id: 'hands', label: 'Hands', value: 'Paper hands', icon: '🧻', confidence: c, why: [...why, 'Tip: decide the exit before you buy; the Risk sizing course shows how.'] }
  if (lossRate <= 0.3 && s.sells >= 4) return { id: 'hands', label: 'Hands', value: 'Steady hands (takes profit)', icon: '🤝', confidence: c, why }
  return { id: 'hands', label: 'Hands', value: 'Steady hands', icon: '🤝', confidence: c, why }
}

/** Trader type by time frame, and risk appetite. */
export function traderType(r: PersonaRecord): Trait[] {
  const s = r.spot, p = r.perps
  const holds = [...s.holds, ...p.holds]
  const trades = s.buys + s.sells + s.converts + p.opens
  const out: Trait[] = []
  if (trades < 4) {
    out.push({ id: 'style', label: 'Trading style', value: 'Not read yet', icon: '📈', confidence: 'low', why: [`${plural(trades, 'trade')} so far.`], unlock: 'Trade on the practice desk a few times. Time frame and risk read from four trades.' })
  } else {
    const med = median(holds)
    const openLong = Object.values(s.open).filter((o) => r.lastSeen - o.at > 7 * 1440 * 60_000).length
    const why = [holds.length ? `Median hold ${dur(med)} over ${plural(holds.length, 'closed position')}.` : 'No position closed yet.', `${plural(trades, 'trade')} in total.`]
    let value: string, icon: string
    if ((holds.length < 2 && s.buys >= 3) || (s.buys >= 5 && s.sells / s.buys < 0.25) || med > 14 * 1440 || openLong >= 2) { value = 'Long-term holder (HODL)'; icon = '🏔️'; if (openLong) why.push(`${plural(openLong, 'position')} held over a week.`) }
    else if (med < 10 && trades >= 8) { value = 'Scalper'; icon = '⚡' }
    else if (med < 24 * 60) { value = 'Day trader'; icon = '☀️' }
    else { value = 'Swing trader'; icon = '🌊' }
    out.push({ id: 'style', label: 'Trading style', value, icon, confidence: conf(holds.length, 4, 12), why })
  }
  const buys = s.big + s.alt + s.meme
  if (buys + p.opens >= 3) {
    const memeShare = buys ? s.meme / buys : 0
    const bigShare = buys ? s.big / buys : 0
    const size = s.sizes.length ? sum(s.sizes) / s.sizes.length : 0
    const lev = p.opens ? p.levSum / p.opens : 0
    const why: string[] = []
    if (buys) why.push(`${pct(bigShare)} of buys in big caps, ${pct(memeShare)} in memecoins.`)
    if (s.sizes.length) why.push(`Uses about ${pct(size)} of the cash on hand per buy.`)
    if (p.opens) why.push(`${plural(p.opens, 'perpetual')} opened at ${lev.toFixed(1)}x average leverage${p.liquidations ? `, ${plural(p.liquidations, 'liquidation')}` : ''}.`)
    if (p.shorts && p.opens) why.push(`${pct(p.shorts / p.opens)} of perpetuals were shorts.`)
    let value: string, icon: string
    if (memeShare >= 0.4 || p.lev10 >= 2 || (p.liquidations >= 1 && size >= 0.5)) { value = 'Degen (high risk)'; icon = '🎲' }
    else if (bigShare >= 0.6 && size <= 0.35 && !p.lev10 && !p.liquidations) { value = 'Conservative'; icon = '🛡️' }
    else if (size >= 0.6 || lev >= 5 || memeShare >= 0.25) { value = 'Aggressive'; icon = '🔥' }
    else { value = 'Balanced'; icon = '⚖️' }
    out.push({ id: 'risk', label: 'Risk appetite', value, icon, confidence: conf(buys + p.opens, 6, 15), why })
  } else {
    out.push({ id: 'risk', label: 'Risk appetite', value: 'Not read yet', icon: '⚖️', confidence: 'low', why: ['Fewer than three buys or perpetuals.'], unlock: 'Buy a few coins or open a practice perpetual. Big caps, alts and memes all count.' })
  }
  return out
}

/** When the player plays: time of day, weekdays or weekends, and how regularly. */
export function rhythm(r: PersonaRecord, now = Date.now()): Trait[] {
  const total = sum(r.hours)
  if (total < 12) return [{ id: 'rhythm', label: 'Rhythm', value: 'Not read yet', icon: '🕒', confidence: 'low', why: [`${plural(total, 'activity', 'activities')} logged.`], unlock: 'Play on a few different days; the rhythm reads from twelve activities.' }]
  const band = (a: number, b: number) => { let n = 0; for (let h = a; h !== b; h = (h + 1) % 24) n += r.hours[h]!; return n }
  const bands = [
    { v: 'Early bird', icon: '🌅', n: band(5, 9), when: '5 to 9 in the morning' },
    { v: 'Daytime grinder', icon: '🏙️', n: band(9, 17), when: 'working hours' },
    { v: 'Evening player', icon: '🌆', n: band(17, 22), when: '5 to 10 in the evening' },
    { v: 'Night owl', icon: '🦉', n: band(22, 5), when: '10 at night to 5 in the morning' },
  ].sort((a, b) => b.n - a.n)
  const top = bands[0]!
  const weekend = r.days[0]! + r.days[6]!
  const wkShare = sum(r.days) ? weekend / sum(r.days) : 0
  const out: Trait[] = [{ id: 'rhythm', label: 'Rhythm', value: top.v, icon: top.icon, confidence: conf(total, 30, 80), why: [`${pct(top.n / total)} of your activity is between ${top.when}.`, wkShare >= 0.5 ? `${pct(wkShare)} of it is at weekends: a weekend warrior.` : `${pct(1 - wkShare)} of it is on weekdays.`] }]
  const day = 86_400_000
  const recent = r.active.filter((d) => now - Date.parse(`${d}T12:00:00`) <= 14 * day).length
  if (r.active.length >= 3) {
    const value = recent >= 8 ? 'Daily regular' : recent >= 4 ? 'Steady visitor' : 'Drops in now and then'
    out.push({ id: 'habit', label: 'Habit', value, icon: recent >= 8 ? '📅' : '🗓️', confidence: conf(r.active.length, 7, 21), why: [`Active on ${plural(recent, 'day')} of the last 14.`, `${plural(r.sessions, 'session')} in total.`] })
  }
  return out
}

/** How the player learns at Campus. */
export function learning(r: PersonaRecord, f: PersonaFacts): Trait {
  const passed = Object.values(f.skills).filter((s) => s?.passed)
  if (passed.length < 2) return { id: 'learning', label: 'Learning style', value: 'Not read yet', icon: '📚', confidence: 'low', why: [`${plural(passed.length, 'course')} passed.`], unlock: 'Pass two courses at Campus; each takes about a minute.' }
  const first = passed.filter((s) => (s?.tries ?? 1) <= 1).length / passed.length
  const places = Object.keys(r.places).length + Object.keys(r.panels).length
  const why = [`${plural(passed.length, 'course')} passed, ${pct(first)} on the first try.`]
  if (places) why.push(`${plural(places, 'place and screen', 'places and screens')} explored.`)
  if (first >= 0.8 && passed.length >= 4) return { id: 'learning', label: 'Learning style', value: 'Quick study', icon: '⚡', confidence: conf(passed.length, 4, 10), why }
  if (first < 0.6) return { id: 'learning', label: 'Learning style', value: 'Persistent (retries until it clicks)', icon: '🔁', confidence: conf(passed.length, 4, 10), why }
  if (places >= 10) return { id: 'learning', label: 'Learning style', value: 'Explorer (learns by trying everything)', icon: '🧭', confidence: conf(passed.length, 4, 10), why }
  return { id: 'learning', label: 'Learning style', value: 'Steady learner', icon: '📖', confidence: conf(passed.length, 4, 10), why }
}

/** People, money and values. */
export function lifestyle(r: PersonaRecord): Trait[] {
  const a = (k: string) => r.acts[k] ?? 0
  const out: Trait[] = []
  const social = a('greet') + a('message') + a('event') + a('cafe') + a('party') + (r.kinds.social ?? 0)
  const focus = (r.kinds.skill ?? 0) + (r.kinds.trade ?? 0)
  if (social + focus >= 8) {
    const share = social / (social + focus)
    const value = share >= 0.45 ? 'Connector' : share >= 0.2 ? 'Social when it counts' : 'Focused solo grinder'
    out.push({ id: 'social', label: 'With people', value, icon: share >= 0.45 ? '🤝' : share >= 0.2 ? '🙂' : '🎧', confidence: conf(social + focus, 15, 40), why: [`${plural(a('greet'), 'greeting')}, ${plural(a('message'), 'message')}, ${plural(a('event'), 'event')} joined.`, `${pct(share)} of what you do is with people.`] })
  }
  const fam = r.family.paid + r.family.left
  if (r.buys + fam >= 3) {
    const why = [`${plural(r.buys, 'purchase')} in the city.`]
    let value = r.buys >= 8 ? 'Enjoys the finer things' : 'Saver'
    let icon = r.buys >= 8 ? '🛍️' : '🐖'
    if (fam >= 2) {
      why.push(`Family requests: ${r.family.paid} paid, ${r.family.left} left.`)
      if (r.family.paid / fam >= 0.6) { value = `${value}, generous with family`; icon = '💝' }
      else if (r.family.left / fam >= 0.6) { value = `${value}, sets boundaries`; icon = '🧱' }
    }
    out.push({ id: 'money', label: 'Money habits', value, icon, confidence: conf(r.buys + fam, 6, 15), why })
  }
  const values: string[] = []
  if (a('faith') >= 3) values.push(`Faith (${plural(a('faith'), 'visit')} to pray)`)
  if (a('gym') >= 3) values.push(`Fitness (${plural(a('gym'), 'gym session')})`)
  if ((r.kinds.climate ?? 0) >= 1) values.push(`Climate (${plural(r.kinds.climate ?? 0, 'pledge')})`)
  if (a('outfit') + (r.panels.boutique ?? 0) >= 5) values.push('Style (Boutique regular)')
  if (a('swim') >= 3) values.push('Wellbeing (swims at home)')
  if (values.length) out.push({ id: 'values', label: 'What you make time for', value: values.map((v) => v.split(' (')[0]).join(', '), icon: '🌱', confidence: conf(values.length, 2, 3), why: values })
  return out
}

type Feature = { n: number; w: number; why: (n: number) => string }
function fit(id: string, title: string, next: string, feats: Feature[]): { id: string; title: string; raw: number; why: string[]; next: string } {
  const parts = feats.filter((f) => f.n > 0).map((f) => ({ v: Math.min(f.n, 12) * f.w, why: f.why(f.n) })).sort((a, b) => b.v - a.v)
  return { id, title, raw: sum(parts.map((p) => p.v)), why: parts.slice(0, 3).map((p) => p.why), next }
}
const passedIn = (f: PersonaFacts, ids: string[]) => ids.filter((i) => f.skills[i]?.passed).length
const coursesWhy = (n: number) => `Passed ${plural(n, 'related course')}.`

/** Web3 roles that fit the player, best first, from what they spend their time on. */
export function roles(r: PersonaRecord, f: PersonaFacts): Fit[] {
  const a = (k: string) => r.acts[k] ?? 0
  const pl = (k: string) => (r.places[k] ?? 0) + (r.panels[k] ?? 0)
  const tr = (k: string) => f.tracks[k] ?? 0
  const trades = r.spot.buys + r.spot.sells + r.spot.converts + r.perps.opens
  const list = [
    fit('trader', 'Trader', 'Take the Risk sizing course, then run a sized trade on the practice desk.', [
      { n: trades, w: 1.2, why: (n) => `${plural(n, 'practice trade')}.` },
      { n: r.perps.opens, w: 1, why: (n) => `${plural(n, 'perpetual')} opened.` },
      { n: passedIn(f, ['spot', 'risk', 'moneyPaths', 'memes', 'liquidity']), w: 3, why: coursesWhy },
      { n: pl('trading') + pl('trade') + tr('trading'), w: 0.6, why: (n) => `${plural(n, 'visit')} to the trading floor.` },
      { n: f.job === 'analyst' ? 4 : 0, w: 2, why: () => 'Works as a market analyst.' },
    ]),
    fit('analyst', 'Research analyst', 'Read the café board and the TV news, then pass “Reading a block explorer”.', [
      { n: passedIn(f, ['chainBlocks', 'chainTraits', 'chainHistory', 'trilemma', 'useCases', 'internet', 'money', 'webEras', 'layers', 'explorer', 'records']), w: 2, why: coursesWhy },
      { n: a('news') + pl('cafe') + a('talk'), w: 1, why: (n) => `${plural(n, 'time')} reading the news or sitting in on talks.` },
      { n: r.spot.holds.filter((h) => h > 1440).length, w: 0.8, why: (n) => `${plural(n, 'position')} held for days on a thesis.` },
      { n: f.job === 'researcher' ? 4 : 0, w: 2, why: () => 'Works as a researcher.' },
    ]),
    fit('community', 'Community manager', 'Pass “Community management in Web3” and host or join an event.', [
      { n: a('greet') + a('message') + a('party'), w: 0.8, why: (n) => `${plural(n, 'greeting and message', 'greetings and messages')}.` },
      { n: a('event') + pl('conference'), w: 1.4, why: (n) => `${plural(n, 'event')} joined.` },
      { n: passedIn(f, ['community', 'daos']), w: 4, why: coursesWhy },
      { n: tr('daos') + tr('jobs'), w: 1, why: (n) => `Explored DAOs and Web3 jobs ${plural(n, 'time')}.` },
      { n: f.job === 'community' ? 4 : 0, w: 2, why: () => 'Works as a community manager.' },
    ]),
    fit('content', 'Content creator', 'Pass “Content & threads that grow” and share your journal card.', [
      { n: a('photo') + a('share') + a('journal'), w: 1.2, why: (n) => `${plural(n, 'photo or share', 'photos and shares')}.` },
      { n: passedIn(f, ['content']), w: 5, why: coursesWhy },
      { n: tr('content') + tr('infofi') + pl('studio'), w: 1, why: (n) => `${plural(n, 'visit')} to the studio and creator tracks.` },
      { n: f.job === 'speaker' ? 4 : 0, w: 2, why: () => 'Works as an event speaker.' },
    ]),
    fit('designer', 'Designer and creative', 'Pass “NFT basics” and style a home look in Furniture.', [
      { n: a('outfit') + a('makeup') + pl('boutique'), w: 0.7, why: (n) => `${plural(n, 'visit')} to the Boutique and the mirror.` },
      { n: a('furniture') + pl('homes'), w: 0.8, why: (n) => `${plural(n, 'home styling session')}.` },
      { n: passedIn(f, ['nfts']), w: 4, why: coursesWhy },
      { n: a('photo'), w: 0.5, why: (n) => `${plural(n, 'photo')} taken.` },
      { n: tr('nfts'), w: 1, why: (n) => `Explored the NFT track ${plural(n, 'time')}.` },
    ]),
    fit('builder', 'Developer and builder', 'Pass “Building” and “Agents”, then open the Agents page.', [
      { n: passedIn(f, ['building', 'agents', 'apps', 'w4Boss', 'layers', 'chainTypes']), w: 3, why: coursesWhy },
      { n: tr('building') + tr('ai') + tr('infra') + tr('grants'), w: 1.2, why: (n) => `Explored building, AI and infrastructure tracks ${plural(n, 'time')}.` },
      { n: pl('robot') + a('desk'), w: 0.8, why: (n) => `${plural(n, 'session')} at the Agents page and your grind desk.` },
    ]),
    fit('security', 'Security analyst', 'Pass “Spotting scams & rug pulls” and “Wallet safety & seed phrases”.', [
      { n: passedIn(f, ['wallets', 'scams', 'redFlags', 'p2pSharks', 'w2Boss', 'custody', 'explorer', 'records']), w: 3, why: coursesWhy },
      { n: tr('scams'), w: 1.5, why: (n) => `Studied the scam track ${plural(n, 'time')}.` },
      { n: a('security'), w: 1, why: (n) => `${plural(n, 'security check')} with your guard.` },
    ]),
    fit('bd', 'Founder and partnerships', 'Join a conference event and post a bounty for a task you need done.', [
      { n: a('event') + pl('conference') + pl('lounge'), w: 1, why: (n) => `${plural(n, 'conference or lounge visit')}.` },
      { n: (r.kinds.gig ?? 0) + a('bounty'), w: 0.8, why: (n) => `${plural(n, 'bounty or duty', 'bounties and duties')}.` },
      { n: tr('business') + tr('grants') + pl('society'), w: 1.2, why: (n) => `Explored business, grants and masterclasses ${plural(n, 'time')}.` },
      { n: passedIn(f, ['earnWays', 'web2Skill', 'daos']), w: 2, why: coursesWhy },
    ]),
    fit('airdrops', 'Airdrop and ecosystem explorer', 'Pass “Airdrops” and “Time paths”; never share a seed phrase.', [
      { n: passedIn(f, ['airdrops', 'timePaths', 'staking']), w: 3, why: coursesWhy },
      { n: tr('airdrops') + tr('defi'), w: 1.2, why: (n) => `Explored airdrops and DeFi tracks ${plural(n, 'time')}.` },
      // Exploring many places only counts once the player has shown an interest in airdrops or DeFi.
      { n: passedIn(f, ['airdrops', 'timePaths', 'staking']) + tr('airdrops') + tr('defi') > 0 ? Object.keys(r.places).length + Object.keys(r.panels).length : 0, w: 0.4, why: (n) => `${plural(n, 'place')} explored.` },
    ]),
  ]
  return rank(list)
}

/** The corners of Web3 the player leans towards. */
export function niches(r: PersonaRecord, f: PersonaFacts): Fit[] {
  const a = (k: string) => r.acts[k] ?? 0
  const pl = (k: string) => (r.places[k] ?? 0) + (r.panels[k] ?? 0)
  const tr = (k: string) => f.tracks[k] ?? 0
  const list = [
    fit('defi', 'DeFi', 'Try “Liquidity pools” next.', [
      { n: passedIn(f, ['defi', 'liquidity', 'staking', 'stables']), w: 3, why: coursesWhy },
      { n: r.spot.converts + r.perps.opens, w: 0.8, why: (n) => `${plural(n, 'swap or perpetual', 'swaps and perpetuals')}.` },
      { n: tr('defi'), w: 1.2, why: (n) => `Explored the DeFi track ${plural(n, 'time')}.` },
    ]),
    fit('memes', 'Memecoins and culture', 'Read “Red flags everywhere” before the next meme buy.', [
      { n: r.spot.meme, w: 1, why: (n) => `${plural(n, 'memecoin buy')}.` },
      { n: passedIn(f, ['memes']), w: 4, why: coursesWhy },
    ]),
    fit('nfts', 'NFTs and collectibles', 'Mint your course certificate on NEAR after the exam.', [
      { n: passedIn(f, ['nfts']), w: 4, why: coursesWhy },
      { n: tr('nfts') + pl('lounge') + pl('gallery') + a('mint'), w: 1.2, why: (n) => `${plural(n, 'visit')} to the art gallery, NFT tracks and the holders’ lounge.` },
    ]),
    fit('ai', 'AI agents', 'Open the Agents page and pass “Agents”.', [
      { n: passedIn(f, ['agents']), w: 5, why: coursesWhy },
      { n: tr('ai') + pl('robot'), w: 1.2, why: (n) => `${plural(n, 'visit')} to AI agent tracks.` },
    ]),
    fit('refi', 'ReFi and climate', 'Pass “Carbon claims” and check the climate desk.', [
      { n: r.kinds.climate ?? 0, w: 2, why: (n) => `${plural(n, 'climate pledge')}.` },
      { n: passedIn(f, ['carbon']), w: 4, why: coursesWhy },
      { n: pl('climate') + pl('seasons'), w: 0.6, why: (n) => `${plural(n, 'look')} at the climate view.` },
    ]),
    fit('gaming', 'Gaming and play-to-own', 'Explore the Crypto gaming track.', [
      { n: pl('race') + a('race') + a('ride') + pl('casino'), w: 0.8, why: (n) => `${plural(n, 'race, ride or game')}.` },
      { n: tr('gaming'), w: 1.5, why: (n) => `Explored the gaming track ${plural(n, 'time')}.` },
    ]),
    fit('infra', 'Infrastructure and chains', 'Pass “Layers 0, 1, 2 and 3”.', [
      { n: passedIn(f, ['layers', 'chainTypes', 'trilemma', 'chainBlocks', 'explorer']), w: 2.5, why: coursesWhy },
      { n: tr('infra'), w: 1.5, why: (n) => `Explored the infrastructure track ${plural(n, 'time')}.` },
    ]),
    fit('security', 'Security and safety', 'Finish “The scam inbox”.', [
      { n: passedIn(f, ['wallets', 'scams', 'redFlags', 'p2pSharks', 'w2Boss', 'custody']), w: 2.5, why: coursesWhy },
      { n: tr('scams') + a('security'), w: 1.2, why: (n) => `${plural(n, 'look')} at scam tracks and security checks.` },
    ]),
    fit('payments', 'Payments and stablecoins', 'Pass “Stablecoins”.', [
      { n: passedIn(f, ['money', 'stables', 'records']), w: 3, why: coursesWhy },
      { n: tr('business'), w: 1.2, why: (n) => `Explored crypto businesses ${plural(n, 'time')}.` },
    ]),
    fit('social', 'Social and creator economy', 'Pass “Content & threads that grow”.', [
      { n: a('photo') + a('share') + a('journal') + a('message'), w: 0.7, why: (n) => `${plural(n, 'post, photo or message', 'posts, photos and messages')}.` },
      { n: passedIn(f, ['content', 'community']), w: 3, why: coursesWhy },
      { n: tr('content') + tr('infofi'), w: 1.2, why: (n) => `Explored creator tracks ${plural(n, 'time')}.` },
    ]),
    fit('daos', 'DAOs and governance', 'Pass “DAOs & governance”.', [
      { n: passedIn(f, ['daos']), w: 5, why: coursesWhy },
      { n: tr('daos'), w: 1.5, why: (n) => `Explored the DAO track ${plural(n, 'time')}.` },
    ]),
  ]
  return rank(list)
}

function rank(list: Array<{ id: string; title: string; raw: number; why: string[]; next: string }>): Fit[] {
  const top = Math.max(...list.map((x) => x.raw))
  if (!(top > 0)) return []
  return list.filter((x) => x.raw > 0).sort((a, b) => b.raw - a.raw).slice(0, 3).map((x) => {
    // Relative to the best match, scaled by how much evidence there is overall (a strong lead on little play stays "Emerging").
    const evidence = 1 - Math.exp(-top / 14)
    const score = Math.round(100 * (x.raw / top) * (0.2 + 0.8 * evidence))
    return { id: x.id, title: x.title, score, level: score >= 70 ? 'Strong' : score >= 45 ? 'Good' : 'Emerging', why: x.why, next: x.next }
  })
}

/** What each sign's popular reading would predict, checked against the traits measured from play. */
const SIGN_EXPECT: Record<string, { trait: string; ok: (t: Record<string, string>) => boolean | null; says: string }> = {
  Aries: { trait: 'risk', ok: (t) => (t.risk ? /Aggressive|Degen/.test(t.risk) : null), says: 'bold, quick to act' },
  Taurus: { trait: 'hands', ok: (t) => (t.hands ? /Diamond|Steady/.test(t.hands) : null), says: 'steady, holds through noise' },
  Gemini: { trait: 'learning', ok: (t) => (t.learning ? /Explorer|Quick/.test(t.learning) : null), says: 'curious, learns fast' },
  Cancer: { trait: 'money', ok: (t) => (t.money ? /generous/.test(t.money) : null), says: 'caring, looks after family' },
  Leo: { trait: 'social', ok: (t) => (t.social ? /Connector|Social/.test(t.social) : null), says: 'warm, at home with people' },
  Virgo: { trait: 'risk', ok: (t) => (t.risk ? /Conservative|Balanced/.test(t.risk) : null), says: 'careful, reads the small print' },
  Libra: { trait: 'social', ok: (t) => (t.social ? /Connector|Social/.test(t.social) : null), says: 'social, brings people together' },
  Scorpio: { trait: 'hands', ok: (t) => (t.hands ? /Diamond|Steady/.test(t.hands) : null), says: 'focused, not easily shaken' },
  Sagittarius: { trait: 'learning', ok: (t) => (t.learning ? /Explorer/.test(t.learning) : null), says: 'adventurous, loves a new path' },
  Capricorn: { trait: 'style', ok: (t) => (t.style ? /Long-term|Swing/.test(t.style) : null), says: 'patient, builds for the long run' },
  Aquarius: { trait: 'social', ok: (t) => (t.social ? /Connector|Social/.test(t.social) : null), says: 'community-minded' },
  Pisces: { trait: 'learning', ok: (t) => (t.learning ? /Persistent|Steady|Explorer/.test(t.learning) : null), says: 'learns by feeling it out' },
}

const ADJ: Record<string, string> = {
  'Diamond hands': 'Diamond-Hand', 'Paper hands': 'Quick-Exit', 'Night owl': 'Night-Owl', 'Early bird': 'Early-Bird', 'Quick study': 'Sharp',
  Connector: 'Social', 'Focused solo grinder': 'Focused', 'Daily regular': 'Consistent', Conservative: 'Careful', 'Degen (high risk)': 'Fearless',
}

/** The whole reading. */
export function readPersona(r: PersonaRecord, f: PersonaFacts, now = Date.now()): Persona {
  const traits = [handType(r), ...traderType(r), ...rhythm(r, now), learning(r, f), ...lifestyle(r)]
  const read = traits.filter((t) => t.value !== 'Not read yet')
  const val: Record<string, string> = Object.fromEntries(read.map((t) => [t.id, t.value]))
  const rs = roles(r, f), ns = niches(r, f)
  const evidence = sum(r.hours) + Object.values(f.skills).filter((s) => s?.passed).length * 3
  // Title: the strongest measured adjective with the best-fitting role (or trading style).
  const adj = [val.hands, val.risk, val.rhythm, val.habit, val.learning, val.social].map((v) => (v ? ADJ[v] : undefined)).find(Boolean)
  const noun = rs[0]?.title ?? (val.style && val.style !== 'Not read yet' ? val.style.replace(/ \(.*\)$/, '') : null)
  const title = noun ? `The ${adj ? `${adj} ` : ''}${noun}` : 'A story still being written'
  const line = read.length
    ? read.slice(0, 3).map((t) => t.value.replace(/ \(.*\)$/, '').toLowerCase()).join(' · ')
    : 'Play a little more: pass a course, make a few practice trades, greet a resident. Your reading fills in as you go.'
  let zodiac: Persona['zodiac'] = null
  if (f.sign) {
    const e = SIGN_EXPECT[f.sign.name]
    const ok = e ? e.ok(val) : null
    const note = ok === null
      ? `Popular astrology calls ${f.sign.name} ${e?.says ?? 'distinctive'}. Your play has not shown that side yet.`
      : ok ? `Popular astrology calls ${f.sign.name} ${e!.says}, and your play agrees.`
        : `Popular astrology calls ${f.sign.name} ${e!.says}. Your play tells a different story: ${traits.find((t) => t.id === e!.trait)?.value.toLowerCase() ?? 'something else'}.`
    zodiac = { sign: f.sign, agrees: ok, note }
  }
  return { title, line, traits, roles: rs, niches: ns, zodiac, evidence }
}

/** A short text for a post (no amounts, no wallet). */
export function personaPost(p: Persona, link: string): string {
  const traits = p.traits.filter((t) => t.value !== 'Not read yet').slice(0, 3).map((t) => `${t.icon} ${t.value}`)
  const role = p.roles[0] ? `Best-fit Web3 role: ${p.roles[0].title}` : ''
  return [`My Web3 personality in Grind District: ${p.title}`, '', ...traits, role, '', 'Read from how I actually play. What’s yours? 👇', link].filter((l, i, a) => l || a[i - 1]).join('\n')
}
