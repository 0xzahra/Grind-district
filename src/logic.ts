import { EXTRA_BODIES_ENABLED, NFT_COLLECTIONS_ENABLED } from './nft.ts'
export const ZAHRA = 'https://0xzahra.github.io'
export const SAVE_KEY = 'grind-district-save-v1'
export const COURSE_XP = 70
/** One-time in-game dollar bonus when a course is first passed (not SP). */
export const COURSE_CASH = 15
export const TAX_USD = 8
export const CHAIN_USD = 30
export const RESELL_USD = 10
export const STIPEND_USD = 25
export const BOUNTY_USD = 12
export const CLIMATE_USD = 5
const CITY_POS = 62

export const SKILL_ORDER = [
  'spot',
  'risk',
  'staking',
  'airdrops',
  'memes',
  'agents',
  'building',
  'carbon',
  'custody',
  'stables',
  'liquidity',
  'records',
  'wallets',
  'explorer',
  'scams',
  'community',
  'content',
  'defi',
  'nfts',
  'daos',
  // Six-world Campus (worlds.ts): new missions and final checks. Appended so old saves keep their ids.
  'internet', 'money', 'webEras', 'w1Boss', 'redFlags', 'p2pSharks', 'w2Boss', 'chainBlocks', 'chainTraits', 'chainTypes', 'chainHistory', 'trilemma', 'layers', 'useCases', 'w4Boss', 'earnWays', 'w5Boss', 'apps', 'web2Skill', 'timePaths', 'moneyPaths', 'builderPaths',
] as const

export type SkillId = (typeof SKILL_ORDER)[number]

export const SKILL_META: Record<SkillId, { title: string; cv: string }> = {
  spot: { title: 'Spot trading', cv: 'Spot trading — owns the asset and reads the spread' },
  risk: { title: 'Risk sizing', cv: 'Risk sizing — decides the clip before the story gets loud' },
  staking: { title: 'Staking', cv: 'Staking — knows lockup, variable rewards, and receipt tokens' },
  airdrops: { title: 'Airdrops', cv: 'Airdrops — treats points as a score, never a promise, and never shares a seed' },
  memes: { title: 'Memecoins', cv: 'Memecoins — sizes for attention that can leave' },
  agents: { title: 'Agents', cv: 'Agents — labeled, and attached to robots' },
  building: { title: 'Building', cv: 'Building — proof of work over a purchased certificate' },
  carbon: { title: 'Carbon claims', cv: 'Carbon claims — reads the method before the logo' },
  custody: { title: 'Custody', cv: 'Custody — a recovery phrase is the keys, and an approval is a spending limit' },
  stables: { title: 'Stablecoins', cv: 'Stablecoins — a peg is a claim about reserves and redemption, not a law' },
  liquidity: { title: 'Liquidity pools', cv: 'Liquidity pools — a swap moves the ratio, and providing liquidity takes inventory risk' },
  wallets: { title: 'Wallet safety & seed phrases', cv: 'Wallet safety — keeps the seed phrase offline and never shares it' },
  explorer: { title: 'Reading a block explorer (Basescan)', cv: 'Block explorers — verifies a payment by its hash on Basescan' },
  scams: { title: 'Spotting scams & rug pulls', cv: 'Scam awareness — reads approvals and spots rug-pull signs' },
  community: { title: 'Community management in Web3', cv: 'Community management — runs a safe, honest Web3 community' },
  content: { title: 'Content & threads that grow', cv: 'Content — writes clear, sourced threads and discloses holdings' },
  defi: { title: 'Intro to DeFi', cv: 'DeFi basics — swaps, slippage, liquidity pools and their risks' },
  nfts: { title: 'NFT basics', cv: 'NFT basics — checks the contract and reads the licence' },
  daos: { title: 'DAOs & governance', cv: 'DAO governance — reads proposals, votes and delegates' },
  records: { title: 'Reading a transfer', cv: 'Reading a transfer — status, from, to, asset, and chain, not a screenshot' },
  internet: { title: 'What the internet is', cv: 'Internet basics — servers, packets and shared protocols' },
  money: { title: 'What money is', cv: 'Money basics — medium of exchange, unit of account, store of value' },
  webEras: { title: 'Web 1, Web 2, Web 3', cv: 'Web eras — read, read-write, read-write-own' },
  w1Boss: { title: 'Web eras: sorting practice', cv: 'Netizen badge — sorts real examples into the right Web era' },
  redFlags: { title: 'Red flags everywhere', cv: 'Red flags — urgency, guaranteed returns, seed-phrase requests' },
  p2pSharks: { title: 'P2P and OTC sharks', cv: 'P2P safety — stays in escrow, checks the bank, refuses third-party payments' },
  w2Boss: { title: 'The scam inbox', cv: 'Scam Shield badge — flags scams in a live inbox' },
  chainBlocks: { title: 'What a blockchain is', cv: 'Blockchain basics — blocks linked by hashes, many copies' },
  chainTraits: { title: 'Decentralised, secure, transparent', cv: 'Key traits — decentralisation, security, transparency' },
  chainTypes: { title: 'Types of blockchain', cv: 'Chain types — public, private, consortium, hybrid' },
  chainHistory: { title: 'Bitcoin to today', cv: 'Evolution — Bitcoin, Ethereum and smart contracts, today' },
  trilemma: { title: 'The trilemma tightrope', cv: 'Chain Builder badge — explains the security, scalability, decentralisation trade-off' },
  layers: { title: 'Layers 0, 1, 2 and 3', cv: 'Layers — interoperability, base chains, rollups, app chains' },
  useCases: { title: 'Real-world use cases', cv: 'Use cases — matches problems to blockchain fits and misfits' },
  w4Boss: { title: 'The right tool', cv: "Builder's Eye badge — picks the right Web3 tool for real problems" },
  earnWays: { title: 'Three ways in: Money, Skills, Time', cv: 'Earning Map — money, skills, time and builder paths' },
  apps: { title: 'Run a tiny town: Web3 apps', cv: 'Applications — DeFi, DEXs, stablecoins, NFTs, DAOs, dApps, decentralised identity' },
  web2Skill: { title: 'Your Web2 skill, your Web3 job', cv: 'Career mapping — turns a Web2 skill into a Web3 role' },
  timePaths: { title: 'Time paths', cv: 'Time paths — airdrops, testnets, bounties, ambassadors with realistic expectations' },
  moneyPaths: { title: 'Money paths and risk sizing', cv: 'Money paths — spot first, sizes every position' },
  builderPaths: { title: 'Builder paths', cv: 'Builder paths — dApps, bots, AI tools, grants and hackathons' },
  w5Boss: { title: 'Draw your path', cv: 'Pathfinder badge — picks a safe first earning path' },
}

export type MapSize = 'compact' | 'large'

export type BodyId = 'player' | 'zuri' | 'shrimp' | 'ledger' | 'marina' | 'signal'
export type MaskId = 'none' | 'punk' | 'ape' | 'pudgy' | 'azuki' | 'nodemonke' | 'degods'
export type DroneId = 'scout' | 'courier' | 'halo'
export type TimeOfDay = 'night' | 'dusk' | 'day'
export type Graphics = 'low' | 'medium' | 'high'
export type Season = 'bull' | 'bear'
export type RankId = 'shrimp' | 'crab' | 'fish' | 'dolphin' | 'shark' | 'whale'

export type PanelId =
  | 'intro'
  | 'profile'
  | 'learn'
  | 'trade'
  | 'trench'
  | 'boutique'
  | 'gadgets'
  | 'dealer'
  | 'gym'
  | 'church'
  | 'prayer'
  | 'cafe'
  | 'house'
  | 'city'
  | 'climate'
  | 'bounty'
  | 'conference'
  | 'robot'
  | 'settings'
  | 'about'
  | 'tax'
  | 'season'
  | 'shared'

export const RANKS: { id: RankId; label: string; xp: number }[] = [
  { id: 'shrimp', label: 'Shrimp', xp: 0 },
  { id: 'crab', label: 'Crab', xp: 70 },
  { id: 'fish', label: 'Fish', xp: 210 },
  { id: 'dolphin', label: 'Dolphin', xp: 420 },
  { id: 'shark', label: 'Shark', xp: 700 },
  { id: 'whale', label: 'Whale', xp: 1100 },
]

export const TINTS = [
  { id: 'blue', hex: 0x1a4cff, label: 'Blue' },
  { id: 'mint', hex: 0x17f790, label: 'Mint' },
  { id: 'sand', hex: 0xf0d7b0, label: 'Sand' },
  { id: 'coral', hex: 0xff6f61, label: 'Coral' },
  { id: 'ice', hex: 0x9fd4ff, label: 'Ice' },
  { id: 'charcoal', hex: 0x2e3136, label: 'Charcoal' },
  { id: 'denim', hex: 0x4a6585, label: 'Denim' },
  { id: 'kente', hex: 0xc8962e, label: 'Kente gold' },
  { id: 'adire', hex: 0x2b3a67, label: 'Adire indigo' },
  { id: 'terracotta', hex: 0xb5553a, label: 'Terracotta' },
] as const
export const TINT_STYLE: Record<string, Array<'office' | 'street' | 'african'>> = {
  blue: ['office'], ice: ['office'], charcoal: ['office', 'street'], sand: ['office', 'african'], denim: ['street'],
  mint: ['street'], coral: ['street'], kente: ['african'], adire: ['african'], terracotta: ['african', 'street'],
}

/** Free season-track shirt tints (earned in Career > Weekly, never sold). */
export const SEASON_TINTS = [
  { id: 'graphite', hex: 0x3a3d42, label: 'Graphite' },
  { id: 'olive', hex: 0x6b7350, label: 'Olive' },
  { id: 'oxblood', hex: 0x6e2a2a, label: 'Oxblood' },
  { id: 'champagne', hex: 0xd9c49a, label: 'Champagne' },
] as const

export const ALL_BODIES: { id: BodyId; label: string; blurb: string }[] = [
  { id: 'player', label: 'Gentleman', blurb: 'Blonde hair, thin glasses, grey suit, blue shirt. Original. Not a licensed collection.' },
  { id: 'zuri', label: 'Lady', blurb: 'Long hair, a softer face, lashes, and a fitted dress or coat. Original.' },
  { id: 'shrimp', label: 'Shrimp', blurb: 'The mascot. Free. Rank still starts at shrimp either way.' },
  { id: 'ledger', label: 'Ledger', blurb: 'Original helmet. Not a licensed collection.' },
  { id: 'marina', label: 'Marina', blurb: 'Original buoy. Not a licensed collection.' },
  { id: 'signal', label: 'Signal', blurb: 'Original coat. Not a licensed collection.' },
]
export const BODIES = EXTRA_BODIES_ENABLED ? ALL_BODIES : ALL_BODIES.filter((b) => b.id === 'player' || b.id === 'zuri')

export const MASKS: { id: Exclude<MaskId, 'none'>; label: string; blurb: string }[] = [
  { id: 'punk', label: 'CryptoPunks', blurb: 'Block visor and a stripe. A Grind District cut under that name. Not the licensed pixel face.' },
  { id: 'ape', label: 'Bored Apes', blurb: 'A faceted muzzle. Original geometry. Not the licensed ape.' },
  { id: 'pudgy', label: 'Pudgy Penguins', blurb: 'Round cheeks and a short bill. Original. Not the licensed penguin.' },
  { id: 'azuki', label: 'Azuki', blurb: 'A swept half-mask. Original. Not the licensed portrait.' },
  { id: 'nodemonke', label: 'Nodemonkes', blurb: 'Cube brow and block ears. Original. Not the licensed monkey.' },
  { id: 'degods', label: 'DeGods', blurb: 'Gold cheek plates and a gem. Original. Not the licensed god.' },
]

export const DRONES: { id: DroneId; label: string; price: number; blurb: string }[] = [
  { id: 'scout', label: 'Scout', price: 18, blurb: 'A small quad. It keeps your shoulder.' },
  { id: 'courier', label: 'Courier', price: 32, blurb: 'A box on a quad. It follows. It does not carry messages yet.' },
  { id: 'halo', label: 'Halo', price: 48, blurb: 'A lit ring. The street can see you coming.' },
]

export type VehicleKind = 'car' | 'jet' | 'drone' | 'phone' | 'laptop' | 'accessory'
export type VehicleId = 'saloon' | 'tourer' | 'lightjet' | 'longjet' | 'skydrone' | 'phone' | 'phonepro' | 'laptop' | 'desktop' | 'earbuds' | 'watch'
/** Vehicles: in-game cash only, nothing on chain. Drones sit just above the priciest jet. */
export const VEHICLES: { id: VehicleId; kind: VehicleKind; label: string; price: number; blurb: string }[] = [
  { id: 'saloon', kind: 'car', label: 'City saloon', price: 600, blurb: 'A quiet four-door in graphite. Insurance and fuel are yours.' },
  { id: 'tourer', kind: 'car', label: 'Grand tourer', price: 900, blurb: 'Long bonnet, two seats, a cabin in tan leather.' },
  { id: 'lightjet', kind: 'jet', label: 'Light jet', price: 1200, blurb: 'Six seats, regional range. Hangar fees every month.' },
  { id: 'longjet', kind: 'jet', label: 'Long-range jet', price: 1500, blurb: 'Intercontinental range. Crew, hangar and fuel on you.' },
  { id: 'phone', kind: 'phone', label: 'Smartphone', price: 40, blurb: 'A clean everyday phone. Good camera, all-day battery.' },
  { id: 'phonepro', kind: 'phone', label: 'Pro phone', price: 90, blurb: 'Titanium frame, triple camera, the one everyone films on.' },
  { id: 'laptop', kind: 'laptop', label: 'Laptop', price: 120, blurb: 'Thin, light, enough power to code and edit.' },
  { id: 'desktop', kind: 'laptop', label: 'Desktop PC', price: 160, blurb: 'Tower and monitor for heavy work and games.' },
  { id: 'earbuds', kind: 'accessory', label: 'Wireless earbuds', price: 15, blurb: 'Noise cancelling. Study anywhere.' },
  { id: 'watch', kind: 'accessory', label: 'Smartwatch', price: 30, blurb: 'Steps, sleep, and a nudge to keep grinding.' },
  { id: 'skydrone', kind: 'drone', label: 'Sky drone', price: 1650, blurb: 'A two-seat electric air taxi. The priciest thing in the hangar.' },
]
const VEHICLE_IDS = new Set<string>(VEHICLES.map((v) => v.id))
export function cleanOwnedVehicles(value: unknown): VehicleId[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((v): v is VehicleId => typeof v === 'string' && VEHICLE_IDS.has(v)))]
}
export function quoteVehicle(ledger: number, owned: readonly string[], id: VehicleId): { ok: true; ledger: number; spent: number; already: boolean } | { ok: false; error: string } {
  const item = VEHICLES.find((v) => v.id === id)
  if (!item) return { ok: false, error: 'That vehicle is not in the hangar.' }
  if (owned.includes(id)) return { ok: true, ledger, spent: 0, already: true }
  if (ledger < item.price) return { ok: false, error: `Short ${money(item.price - ledger)}. The ${item.label.toLowerCase()} stays parked.` }
  return { ok: true, ledger: cents(ledger - item.price), spent: item.price, already: false }
}

/** Starting balance per ladder level (in-game). Reaching a level tops the ledger up by the step. */
export const RANK_START: Record<RankId, number> = { shrimp: 1000, crab: 1500, fish: 2500, dolphin: 4000, shark: 6500, whale: 10000 }

export type CoinCategory = 'big' | 'alt' | 'meme'
export const COIN_CATEGORIES: { id: CoinCategory; label: string; note: string; vol: number }[] = [
  { id: 'big', label: 'Big caps', note: 'Large, liquid, slower. The core of a sane book.', vol: 0.0025 },
  { id: 'alt', label: 'Altcoins', note: 'Mid caps. Bigger swings both ways.', vol: 0.006 },
  { id: 'meme', label: 'Meme coins', note: 'Hype-driven. Size small or not at all.', vol: 0.014 },
]
/** Practice prices only. Nothing here touches a chain or a real exchange. */
export const COINS: { id: string; cat: CoinCategory; label: string; base: number; minRank: RankId }[] = [
  { id: 'btc', cat: 'big', label: 'BTC · Bitcoin', base: 64000, minRank: 'shrimp' },
  { id: 'eth', cat: 'big', label: 'ETH · Ether', base: 3200, minRank: 'shrimp' },
  { id: 'sol', cat: 'big', label: 'SOL · Solana', base: 150, minRank: 'shrimp' },
  { id: 'link', cat: 'alt', label: 'LINK · Chainlink', base: 15, minRank: 'shrimp' },
  { id: 'avax', cat: 'alt', label: 'AVAX · Avalanche', base: 30, minRank: 'crab' },
  { id: 'dot', cat: 'alt', label: 'DOT · Polkadot', base: 6, minRank: 'crab' },
  { id: 'doge', cat: 'meme', label: 'DOGE · Dogecoin', base: 0.15, minRank: 'crab' },
  { id: 'wif', cat: 'meme', label: 'WIF · dogwifhat', base: 2.1, minRank: 'fish' },
  { id: 'bonk', cat: 'meme', label: 'BONK · Bonk', base: 0.00003, minRank: 'fish' },
]
export function coinPrice(value: number): string {
  if (value >= 1) return money(value)
  return `$${value.toPrecision(3)}`
}
export function stepCoins(save: Save, dt: number, season: Season, rand: () => number = Math.random): void {
  const step = Math.min(0.1, Math.max(0, dt))
  const drift = season === 'bull' ? 0.0006 : -0.0006
  for (const coin of COINS) {
    const vol = COIN_CATEGORIES.find((c) => c.id === coin.cat)!.vol
    const now = save.coinPrices[coin.id] ?? coin.base
    let next = now * (1 + (drift + (rand() - 0.5) * 2 * vol) * step * 10)
    next = Math.min(coin.base * 4, Math.max(coin.base * 0.2, next))
    save.coinPrices[coin.id] = next
  }
}

export const PROJECTS = [
  { id: 'mangrove', name: 'Coastal mangrove' },
  { id: 'stoves', name: 'Clean cookstoves' },
  { id: 'trees', name: 'Row trees' },
] as const

export type Holding = { qty: number; avg: number }

export type Activity = {
  id: string
  at: number
  label: string
  detail: string
  kind: 'skill' | 'social' | 'money' | 'climate' | 'tax' | 'trade' | 'gig'
}

export type CarbonNote = { id: string; name: string; usd: number; at: number }
export type Want = { label: string; spent: number; at: number }

export const REP_FLAGS = [
  'lesson',
  'spotPlan',
  'trenchPlan',
  'gym',
  'church',
  'prayer',
  'cafe',
  'bounty',
  'climate',
  'visit',
] as const

export type RepFlag = (typeof REP_FLAGS)[number]

export type Daily = { day: string } & Record<RepFlag, boolean>

export type Save = {
  v: 1
  name: string
  username: string
  signedUp: boolean
  body: BodyId
  tint: number
  luxury: boolean
  mask: MaskId
  drone: DroneId | 'none'
  ownedDrones: DroneId[]
  ownedVehicles: VehicleId[]
  /** Highest ladder level whose starting balance was credited (-1 = none). */
  startTier: number
  coins: Record<string, Holding>
  coinPrices: Record<string, number>
  xp: number
  reputation: number
  ledger: number
  /** Part of ledger that came from on-chain top-ups; the rest is earned. Earned is spent first. */
  toppedUp: number
  focus: boolean
  skills: Partial<Record<SkillId, { passed: boolean; tries: number }>>
  activities: Activity[]
  unit: Holding
  meme: Holding
  unitPrice: number
  memePrice: number
  unitHist: number[]
  memeHist: number[]
  carbon: CarbonNote[]
  wants: Want[]
  taxOpen: boolean
  taxPaid: number
  taxDeclined: number
  taxResolvedDay: string
  earnings: number
  dailies: Daily
  streak: number
  timeOfDay: TimeOfDay
  graphics: Graphics
  volume: number
  mapSize: MapSize
  hints: boolean
  reduceMotion: boolean
  waterDay: string
  conferenceNoted: boolean
  conference: boolean
  eventsJoined: string[]
  robotRead: boolean
  houseClaimed: boolean
  houseVisits: string[]
  gymBest: number
  seenIntro: boolean
  posX: number
  posZ: number
}

export type TradeResult =
  | { ok: true; ledger: number; holding: Holding; cash: number; pnl: number | null }
  | { ok: false; error: string }

export type SharedProfile = {
  n: string
  u: string
  x: number
  p: number
  s: number
  k: SkillId[]
  a: string[]
  /** Public books: [section, label, value] rows. Never includes family requests. */
  b?: [string, string, string][]
  /** Public docs (family requests stripped). */
  d?: { c: string; r: string; p: string }
}

const SEASON_MS = 6 * 60 * 1000

export function seasonAt(now = Date.now()): Season {
  return Math.floor(now / SEASON_MS) % 2 === 0 ? 'bull' : 'bear'
}

export function seasonLabel(season: Season): string {
  return season === 'bull' ? 'Bull' : 'Bear'
}

export function lagosDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Lagos',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function lagosStamp(ts: number): string {
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Lagos',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts))
  return date
}

export function dayDiff(earlier: string, later: string): number {
  const from = Date.parse(`${earlier}T00:00:00Z`)
  const to = Date.parse(`${later}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

export function cents(value: number): number {
  return Math.round(value * 100) / 100
}

export function money(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Holding quantity for display (not dollars). Up to 6 dp, trim trailing zeros. */
export function formatQty(qty: number): string {
  if (!Number.isFinite(qty) || qty === 0) return '0'
  const abs = Math.abs(qty)
  const digits = abs >= 100 ? 2 : abs >= 1 ? 4 : 6
  return Number(qty.toFixed(digits)).toLocaleString('en-US', { maximumFractionDigits: digits })
}

export function rankFor(xp: number): (typeof RANKS)[number] {
  let current = RANKS[0]
  for (const rank of RANKS) {
    if (xp >= rank.xp) current = rank
  }
  return current
}

export function nextRank(xp: number): (typeof RANKS)[number] | null {
  return RANKS.find((rank) => rank.xp > xp) ?? null
}

export function rankToast(id: RankId): string {
  switch (id) {
    case 'shrimp':
      return 'Shrimp.'
    case 'crab':
      return 'Crab. The plaza noticed.'
    case 'fish':
      return 'Fish. Keep the reps.'
    case 'dolphin':
      return 'Dolphin. The row knows your name.'
    case 'shark':
      return 'Shark. Balance still is not the ladder.'
    case 'whale':
      return 'Whale. Same streets as a shrimp.'
    default: {
      const neverRank: never = id
      return neverRank
    }
  }
}

function mulberry32(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function roundPx(value: number): number {
  if (Math.abs(value) < 0.01) return Number(value.toPrecision(6))
  return Math.round(value * 10000) / 10000
}

function roundQty(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

function clampPrice(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function walkPrice(start: number, drift: number, vol: number, min: number, max: number, steps: number, rand: () => number): number[] {
  const hist: number[] = []
  let price = start
  for (let i = 0; i < steps; i += 1) {
    price = clampPrice(price * Math.exp(drift + (rand() - 0.5) * vol), min, max)
    hist.push(roundPx(price))
  }
  return hist
}

export function blankDaily(day: string): Daily {
  return {
    day,
    lesson: false,
    spotPlan: false,
    trenchPlan: false,
    gym: false,
    church: false,
    prayer: false,
    cafe: false,
    bounty: false,
    climate: false,
    visit: false,
  }
}

export function hadAny(daily: Daily): boolean {
  return REP_FLAGS.some((flag) => daily[flag])
}

export function createSave(now = new Date(), opts?: { graphics?: Graphics }): Save {
  const rand = mulberry32(19)
  const season = seasonAt(now.getTime())
  const unitDrift = season === 'bull' ? 0.004 : -0.004
  const memeDrift = season === 'bull' ? 0.01 : -0.02
  const unitHist = walkPrice(1, unitDrift, 0.03, 0.2, 5, 42, rand)
  const memeHist = walkPrice(0.4, memeDrift, 0.12, 0.02, 12, 42, rand)
  return {
    v: 1,
    name: '',
    username: '',
    signedUp: false,
    body: 'player',
    tint: TINTS[0].hex,
    luxury: false,
    mask: 'none',
    drone: 'none',
    ownedDrones: [],
    ownedVehicles: [],
    startTier: -1,
    coins: {},
    coinPrices: {},
    xp: 0,
    reputation: 0,
    ledger: 0,
    toppedUp: 0,
    focus: false,
    skills: {},
    activities: [],
    unit: { qty: 0, avg: 0 },
    meme: { qty: 0, avg: 0 },
    unitPrice: unitHist[unitHist.length - 1] ?? 1,
    memePrice: memeHist[memeHist.length - 1] ?? 0.4,
    unitHist,
    memeHist,
    carbon: [],
    wants: [],
    taxOpen: false,
    taxPaid: 0,
    taxDeclined: 0,
    taxResolvedDay: '',
    earnings: 0,
    dailies: blankDaily(lagosDay(now)),
    streak: 0,
    timeOfDay: 'night',
    graphics: opts?.graphics ?? 'medium',
    volume: 70,
    mapSize: 'compact',
    hints: true,
    reduceMotion: false,
    waterDay: '',
    conferenceNoted: false,
    conference: false,
    eventsJoined: [],
    robotRead: false,
    houseClaimed: false,
    houseVisits: [],
    gymBest: 0,
    seenIntro: false,
    posX: 0,
    posZ: 8,
  }
}

function num(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, value))
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function cleanDisplayName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, 24)
}

export function cleanUsername(value: unknown): string {
  if (typeof value !== 'string') return ''
  const handle = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
  return /^[a-z0-9_]{3,20}$/.test(handle) ? handle : ''
}

const HOUSE_VISIT_IDS = new Set(['adaeze', 'malik', 'nia', 'vacant'])

export function cleanHouseVisits(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  for (const item of value) {
    if (typeof item === 'string' && HOUSE_VISIT_IDS.has(item)) seen.add(item)
  }
  return [...seen]
}

export function cleanBody(value: unknown): BodyId {
  if (!EXTRA_BODIES_ENABLED) return value === 'zuri' ? 'zuri' : 'player' // migrate shrimp/ledger/marina/signal to Man
  if (value === 'player' || value === 'zuri' || value === 'shrimp' || value === 'ledger' || value === 'marina' || value === 'signal') return value
  return 'shrimp'
}

export function wearsPlate(body: BodyId): boolean {
  return body === 'player' || body === 'zuri'
}

const MASK_IDS = new Set<string>(MASKS.map((mask) => mask.id))

export function cleanMask(value: unknown): MaskId {
  if (!NFT_COLLECTIONS_ENABLED) return 'none' // migrates saved NFT masks away
  if (value === 'none') return 'none'
  if (typeof value === 'string' && MASK_IDS.has(value)) return value as MaskId
  return 'none'
}

const DRONE_IDS = new Set<string>(DRONES.map((drone) => drone.id))

export function cleanDrone(value: unknown): DroneId | 'none' {
  if (value === 'none') return 'none'
  if (typeof value === 'string' && DRONE_IDS.has(value)) return value as DroneId
  return 'none'
}

export function cleanOwnedDrones(value: unknown): DroneId[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<DroneId>()
  for (const item of value) {
    const id = cleanDrone(item)
    if (id !== 'none') seen.add(id)
  }
  return [...seen]
}

export function quoteDrone(
  ledger: number,
  owned: readonly string[],
  id: DroneId,
): { ok: true; ledger: number; spent: number; already: boolean } | { ok: false; error: string } {
  const item = DRONES.find((drone) => drone.id === id)
  if (!item) return { ok: false, error: 'That drone is not on the wall.' }
  if (owned.includes(id)) return { ok: true, ledger, spent: 0, already: true }
  if (ledger < item.price) return { ok: false, error: `Short ${money(item.price - ledger)}. The drone stays on the shelf.` }
  return { ok: true, ledger: cents(ledger - item.price), spent: item.price, already: false }
}

export function cleanTint(value: unknown): number {
  const hex = typeof value === 'number' ? value : Number.NaN
  return [...TINTS, ...SEASON_TINTS].some((tint) => tint.hex === hex) ? hex : TINTS[0].hex
}

function cleanTime(value: unknown): TimeOfDay {
  if (value === 'night' || value === 'dusk' || value === 'day') return value
  return 'night'
}

function cleanGraphics(value: unknown): Graphics {
  if (value === 'low' || value === 'medium' || value === 'high') return value
  return 'medium'
}

function cleanMapSize(value: unknown): MapSize {
  if (value === 'compact' || value === 'large') return value
  return 'compact'
}

function cleanHolding(value: unknown): Holding {
  if (!value || typeof value !== 'object') return { qty: 0, avg: 0 }
  const row = value as Record<string, unknown>
  const qty = num(row.qty, 0, 1_000_000, 0)
  return { qty, avg: qty === 0 ? 0 : num(row.avg, 0, 1_000_000, 0) }
}

function cleanHist(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback
  const hist = value.filter((item) => typeof item === 'number' && Number.isFinite(item)).slice(-48)
  return hist.length >= 2 ? hist : fallback
}

function isSkill(value: string): value is SkillId {
  return (SKILL_ORDER as readonly string[]).includes(value)
}

export function hydrate(raw: unknown, now = new Date()): Save {
  const fresh = createSave(now)
  if (!raw || typeof raw !== 'object') return fresh
  const row = raw as Record<string, unknown>
  if (row.v !== 1) return fresh
  fresh.name = cleanDisplayName(row.name)
  fresh.username = cleanUsername(row.username)
  fresh.signedUp = row.signedUp === true && fresh.name.length > 0 && fresh.username.length > 0
  if (!fresh.signedUp) {
    fresh.name = ''
    fresh.username = ''
    fresh.signedUp = false
  }
  fresh.body = cleanBody(row.body)
  fresh.tint = cleanTint(row.tint)
  fresh.luxury = bool(row.luxury, false)
  fresh.mask = cleanMask(row.mask)
  fresh.ownedDrones = cleanOwnedDrones(row.ownedDrones)
  fresh.ownedVehicles = cleanOwnedVehicles(row.ownedVehicles)
  fresh.startTier = num(row.startTier, -1, RANKS.length - 1, -1)
  // Legacy SP/skillPoints fields (if any) are ignored — rewards are in-game $ only; do not convert to ledger.
  const rawCoins = (row.coins && typeof row.coins === 'object' ? row.coins : {}) as Record<string, { qty?: unknown; avg?: unknown }>
  const rawPrices = (row.coinPrices && typeof row.coinPrices === 'object' ? row.coinPrices : {}) as Record<string, unknown>
  for (const coin of COINS) {
    const h = rawCoins[coin.id]
    if (h) fresh.coins[coin.id] = { qty: num(h.qty, 0, 1e15, 0), avg: num(h.avg, 0, 1e9, 0) }
    fresh.coinPrices[coin.id] = num(rawPrices[coin.id], coin.base * 0.2, coin.base * 4, coin.base)
  }
  const worn = cleanDrone(row.drone)
  fresh.drone = worn !== 'none' && fresh.ownedDrones.includes(worn) ? worn : 'none'
  fresh.xp = num(row.xp, 0, 1_000_000, 0)
  fresh.reputation = num(row.reputation, 0, 1_000_000, 0)
  fresh.ledger = cents(num(row.ledger, 0, 1_000_000, 0))
  fresh.toppedUp = cents(Math.min(fresh.ledger, num(row.toppedUp, 0, 1_000_000, 0)))
  fresh.focus = bool(row.focus, false)
  fresh.unit = cleanHolding(row.unit)
  fresh.meme = cleanHolding(row.meme)
  fresh.unitPrice = num(row.unitPrice, 0.2, 5, fresh.unitPrice)
  fresh.memePrice = num(row.memePrice, 0.02, 12, fresh.memePrice)
  fresh.unitHist = cleanHist(row.unitHist, fresh.unitHist)
  fresh.memeHist = cleanHist(row.memeHist, fresh.memeHist)
  fresh.taxOpen = bool(row.taxOpen, false)
  fresh.taxPaid = num(row.taxPaid, 0, 99, 0)
  fresh.taxDeclined = num(row.taxDeclined, 0, 99, 0)
  fresh.taxResolvedDay = typeof row.taxResolvedDay === 'string' ? row.taxResolvedDay : ''
  fresh.earnings = num(row.earnings, 0, 1_000_000, 0)
  fresh.streak = num(row.streak, 0, 9999, 0)
  fresh.timeOfDay = cleanTime(row.timeOfDay)
  fresh.graphics = cleanGraphics(row.graphics)
  fresh.volume = num(row.volume, 0, 100, 70)
  fresh.mapSize = cleanMapSize(row.mapSize)
  fresh.hints = bool(row.hints, true)
  fresh.reduceMotion = bool(row.reduceMotion, false)
  fresh.waterDay = typeof row.waterDay === 'string' ? row.waterDay.slice(0, 10) : ''
  fresh.conferenceNoted = bool(row.conferenceNoted, false)
  fresh.conference = bool(row.conference, false)
  fresh.eventsJoined = Array.isArray(row.eventsJoined) ? row.eventsJoined.filter((x): x is string => typeof x === 'string').slice(-30).map((x) => x.slice(0, 40)) : []
  fresh.robotRead = bool(row.robotRead, false)
  fresh.houseClaimed = bool(row.houseClaimed, false)
  fresh.houseVisits = cleanHouseVisits(row.houseVisits)
  fresh.gymBest = num(row.gymBest, 0, 8, 0)
  fresh.seenIntro = bool(row.seenIntro, false)
  fresh.posX = num(row.posX, -CITY_POS, CITY_POS, 0)
  fresh.posZ = num(row.posZ, -CITY_POS, CITY_POS, 8)
  if (row.skills && typeof row.skills === 'object') {
    for (const [key, value] of Object.entries(row.skills as Record<string, unknown>)) {
      if (!isSkill(key) || !value || typeof value !== 'object') continue
      const skill = value as Record<string, unknown>
      fresh.skills[key] = { passed: skill.passed === true, tries: num(skill.tries, 0, 99, 0) }
    }
  }
  if (Array.isArray(row.activities)) {
    fresh.activities = row.activities.slice(0, 40).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const activity = item as Record<string, unknown>
      if (typeof activity.label !== 'string' || typeof activity.detail !== 'string') return []
      const kind = activity.kind
      if (
        kind !== 'skill' &&
        kind !== 'social' &&
        kind !== 'money' &&
        kind !== 'climate' &&
        kind !== 'tax' &&
        kind !== 'trade' &&
        kind !== 'gig'
      ) {
        return []
      }
      return [
        {
          id: typeof activity.id === 'string' ? activity.id : makeId(),
          at: num(activity.at, 0, Date.now() + 86_400_000, Date.now()),
          label: activity.label.slice(0, 80),
          detail: activity.detail.slice(0, 180),
          kind,
        },
      ]
    })
  }
  if (Array.isArray(row.carbon)) {
    fresh.carbon = row.carbon.slice(0, 20).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const note = item as Record<string, unknown>
      if (typeof note.name !== 'string') return []
      return [{ id: typeof note.id === 'string' ? note.id : note.name, name: note.name.slice(0, 40), usd: CLIMATE_USD, at: num(note.at, 0, Date.now() + 86_400_000, Date.now()) }]
    })
  }
  if (Array.isArray(row.wants)) {
    fresh.wants = row.wants.slice(0, 10).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const want = item as Record<string, unknown>
      if (typeof want.label !== 'string') return []
      return [{ label: want.label.slice(0, 40), spent: num(want.spent, 0, 10_000, 0), at: num(want.at, 0, Date.now() + 86_400_000, Date.now()) }]
    })
  }
  if (row.dailies && typeof row.dailies === 'object') {
    const daily = row.dailies as Record<string, unknown>
    if (typeof daily.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(daily.day)) {
      fresh.dailies.day = daily.day
      for (const flag of REP_FLAGS) fresh.dailies[flag] = daily[flag] === true
    }
  }
  return fresh
}

export function applyDay(save: Save, today: string): void {
  if (save.dailies.day === today) return
  const previous = save.dailies
  const continued = previous.day !== '' && dayDiff(previous.day, today) === 1 && hadAny(previous)
  if (!continued) save.streak = 0
  save.dailies = blankDaily(today)
}

export function markDaily(save: Save, today: string, flag: RepFlag): number {
  applyDay(save, today)
  const first = !hadAny(save.dailies)
  save.dailies[flag] = true
  if (!first) return 0
  save.streak += 1
  return Math.min(25, save.streak * 5)
}

export function todayTasks(save: Save): { label: string; done: boolean }[] {
  return [
    { label: 'Pass a course', done: save.dailies.lesson },
    { label: 'Log a sized trade', done: save.dailies.spotPlan || save.dailies.trenchPlan },
    { label: 'Gym set', done: save.dailies.gym },
    { label: 'Read the café', done: save.dailies.cafe },
    { label: 'Post a bounty', done: save.dailies.bounty },
    { label: 'Church or prayer', done: save.dailies.church || save.dailies.prayer },
    { label: 'Carbon desk', done: save.dailies.climate },
  ]
}

export function buyHolding(ledger: number, holding: Holding, price: number, fraction: number): TradeResult {
  if (fraction !== 0.25 && fraction !== 0.5 && fraction !== 1) return { ok: false, error: 'Pick a size.' }
  if (!(price > 0)) return { ok: false, error: 'No price on the book.' }
  const spend = cents(ledger * fraction)
  if (spend < 1) return { ok: false, error: 'You need at least $1 in the practice ledger for that size.' }
  const qty = roundQty(spend / price)
  if (qty <= 0) return { ok: false, error: 'That size is too small at this price.' }
  const nextQty = roundQty(holding.qty + qty)
  const avg = (holding.avg * holding.qty + spend) / nextQty
  return { ok: true, ledger: cents(ledger - spend), holding: { qty: nextQty, avg: roundPx(avg) }, cash: spend, pnl: null }
}

export function sellHolding(ledger: number, holding: Holding, price: number, fraction: number): TradeResult {
  if (fraction !== 0.25 && fraction !== 0.5 && fraction !== 1) return { ok: false, error: 'Pick a size.' }
  if (!(price > 0)) return { ok: false, error: 'No price on the book.' }
  const qty = roundQty(holding.qty * fraction)
  if (qty <= 0) return { ok: false, error: 'No position to sell.' }
  const proceeds = cents(qty * price)
  const pnl = cents((price - holding.avg) * qty)
  const left = roundQty(holding.qty - qty)
  const next = left <= 0.000001 ? { qty: 0, avg: 0 } : { qty: left, avg: holding.avg }
  return { ok: true, ledger: cents(ledger + proceeds), holding: next, cash: proceeds, pnl }
}

export function stepPrices(save: Save, dt: number, season: Season, rand: () => number = Math.random): void {
  const step = Math.min(0.1, Math.max(0, dt))
  const unitDrift = (season === 'bull' ? 0.0009 : -0.0009) * step
  const memeDrift = (season === 'bull' ? 0.0012 : -0.0016) * step
  const unitNoise = (rand() - 0.5) * 0.015 * Math.sqrt(step)
  const memeNoise = (rand() - 0.5) * 0.08 * Math.sqrt(step)
  save.unitPrice = roundPx(clampPrice(save.unitPrice * Math.exp(unitDrift + unitNoise), 0.2, 5))
  save.memePrice = roundPx(clampPrice(save.memePrice * Math.exp(memeDrift + memeNoise), 0.02, 12))
}

export function pushHist(hist: number[], value: number): void {
  hist.push(roundPx(value))
  if (hist.length > 48) hist.splice(0, hist.length - 48)
}

export function positionValue(holding: Holding, price: number): number {
  return cents(holding.qty * price)
}

export function positionPnl(holding: Holding, price: number): number {
  return cents((price - holding.avg) * holding.qty)
}

export function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

export function skillLines(save: Save): string[] {
  return SKILL_ORDER.flatMap((id) => (save.skills[id]?.passed ? [SKILL_META[id].cv] : []))
}

/** Activity that belongs in a wallet/ledger feed — not on CV, resume, or portfolio. */
export function isWalletActivity(item: { kind: string; label: string; detail?: string }): boolean {
  if (item.kind === 'money') return true
  const blob = `${item.label} ${item.detail ?? ''}`.toLowerCase()
  return /top-?up|topped up|wallet|sign-up bonus|starting balance|course bonus|campus stipend|event reward|withdraw|deposit|usdc|privy|balance|ledger|transfer fee/.test(blob)
}

export function documents(save: Save, now = new Date(), jobTitle = ''): { cv: string; resume: string; portfolio: string } {
  const rank = rankFor(save.xp)
  const next = nextRank(save.xp)
  const skills = skillLines(save)
  // CV/resume: courses, trades, social proof — never wallet/top-up/balance noise.
  const proof = save.activities.filter((a) => !isWalletActivity(a)).slice(0, 8)
  const season = seasonLabel(seasonAt(now.getTime()))
  const header = [
    `${save.name}  ·  @${save.username}`,
    'Grind District profile',
    '',
    `Rank        ${rank.label} · ${save.xp} XP${next ? ` (${next.label} at ${next.xp})` : ''}`,
    ...(jobTitle ? [`Job         ${jobTitle}`] : []),
    `Reputation  ${save.reputation}`,
    `Streak      ${save.streak} day${save.streak === 1 ? '' : 's'}`,
    `Market      ${season} season`,
  ]
  const cv = [
    ...header,
    '',
    'Skills',
    ...(skills.length ? skills.map((line) => `- ${line}`) : ['- No courses completed yet.']),
    '',
    'Recent activity',
    ...(proof.length
      ? proof.map((item) => `- ${item.label} (${lagosStamp(item.at)})`)
      : ['- Nothing yet.']),
    '',
    'Holdings',
    holdingLine('District Coin', save.unit, save.unitPrice),
    holdingLine('Meme Token', save.meme, save.memePrice),
    '',
    'In-game profile. Not financial advice.',
  ].join('\n')

  const resume = [
    `${save.name} (@${save.username}) is a ${rank.label} in Grind District with ${save.xp} XP.`,
    '',
    skills.length
      ? `Skills: ${skills.join('; ')}.`
      : 'No courses completed yet.',
    '',
    proof.length
      ? `Recent activity: ${proof.map((item) => item.label).join('; ')}.`
      : 'No activity yet.',
    '',
    `Shows up consistently: ${save.streak}-day streak, reputation ${save.reputation}.`,
  ].join('\n')

  // Portfolio: holdings and performance only — not the city activity feed / wallet lines.
  const coinLines = COINS.flatMap((coin) => {
    const h = save.coins?.[coin.id]
    if (!h || h.qty <= 0) return [] as string[]
    const price = save.coinPrices[coin.id] ?? coin.base
    const pnl = positionPnl(h, price)
    return [`- ${coin.label}: ${formatQty(h.qty)} @ avg ${money(h.avg)}, worth ${money(h.qty * price)}, open ${money(pnl)}`]
  })
  const portfolio = [
    `${save.name} (@${save.username}) — portfolio`,
    'Holdings and performance (in-game practice values).',
    '',
    holdingLine('District Coin', save.unit, save.unitPrice),
    holdingLine('Meme Token', save.meme, save.memePrice),
    ...coinLines,
    ...(coinLines.length || save.unit.qty > 0 || save.meme.qty > 0 ? [] : ['- No open positions yet.']),
    '',
    save.carbon.length
      ? `Climate pledges: ${save.carbon.map((note) => note.name).join(', ')}.`
      : 'Climate pledges: none.',
  ].join('\n')

  return { cv, resume, portfolio }
}

function holdingLine(symbol: string, holding: Holding, price: number): string {
  if (holding.qty <= 0) return `- ${symbol}: no position`
  const pnl = positionPnl(holding, price)
  return `- ${symbol}: ${formatQty(holding.qty)} @ avg ${money(holding.avg)}, mark ${money(price)}, open ${money(pnl)}`
}

export function maybeOpenTax(save: Save, today: string): void {
  if (save.taxOpen) return
  if (save.taxPaid + save.taxDeclined >= 3) return
  if (save.taxResolvedDay === today) return
  if (save.ledger <= 0) return
  if (save.earnings < 1) return
  save.taxOpen = true
}

function toB64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '')
}

function fromB64Url(text: string): string {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4))
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/') + pad)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeShare(save: Save): string {
  const payload = {
    n: save.name,
    u: save.username,
    x: save.xp,
    p: save.reputation,
    s: save.streak,
    k: SKILL_ORDER.filter((id) => save.skills[id]?.passed),
    a: save.activities.slice(0, 6).map((item) => item.label.slice(0, 80)),
    b: bookRows(save, true).map((r) => [r.section, r.label, r.value]),
    d: (() => { const docs = documents(save); return { c: publicDoc(docs.cv), r: publicDoc(docs.resume), p: publicDoc(docs.portfolio) } })(),
  }
  return toB64Url(JSON.stringify(payload))
}

export function decodeShare(param: string): SharedProfile | null {
  try {
    const parsed = JSON.parse(fromB64Url(param)) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const row = parsed as Record<string, unknown>
    if (typeof row.n !== 'string' || typeof row.x !== 'number') return null
    const name = cleanDisplayName(row.n)
    if (!name) return null
    const skills = Array.isArray(row.k) ? row.k.filter((id): id is SkillId => typeof id === 'string' && isSkill(id)) : []
    const proof = Array.isArray(row.a) ? row.a.filter((line): line is string => typeof line === 'string').slice(0, 6).map((line) => line.slice(0, 90)) : []
    return {
      n: name,
      u: cleanUsername(row.u),
      x: num(row.x, 0, 1_000_000, 0),
      p: num(row.p, 0, 1_000_000, 0),
      s: num(row.s, 0, 9999, 0),
      k: skills,
      a: proof,
      b: Array.isArray(row.b) ? row.b.filter((r): r is [string, string, string] => Array.isArray(r) && r.length === 3 && r.every((v) => typeof v === 'string')).slice(0, 40).map((r) => [r[0].slice(0, 20), r[1].slice(0, 60), r[2].slice(0, 60)] as [string, string, string]) : [],
      d: row.d && typeof row.d === 'object' ? (() => { const d = row.d as Record<string, unknown>; const t = (v: unknown) => (typeof v === 'string' ? publicDoc(v) : ''); return { c: t(d.c), r: t(d.r), p: t(d.p) } })() : undefined,
    }
  } catch {
    return null
  }
}

export function sharedText(profile: SharedProfile): string {
  const rank = rankFor(profile.x)
  const skills = profile.k.map((id) => SKILL_META[id].title)
  return [
    `${profile.n}${profile.u ? ` · @${profile.u}` : ''} · ${rank.label}`,
    'Grind District profile',
    `${profile.x} XP · reputation ${profile.p} · ${profile.s}-day streak`,
    skills.length ? `Skills: ${skills.join(', ')}` : 'Skills: none yet',
    'Recent activity:',
    ...(profile.a.length ? profile.a.map((line) => `- ${line}`) : ['- nothing yet']),
    'In-game profile. Not financial advice.',
  ].join('\n')
}

export function progressToNext(xp: number): number {
  const current = rankFor(xp)
  const next = nextRank(xp)
  if (!next) return 1
  const span = next.xp - current.xp
  if (span <= 0) return 1
  return Math.min(1, (xp - current.xp) / span)
}

/** Strip private lines (family requests) and cap length for public share pages. */
export function publicDoc(text: string): string {
  return text.split('\n').filter((l) => !/open request|family request|cousin/i.test(l)).join('\n').slice(0, 1800)
}

export type BookRow = { section: 'Assets' | 'Liabilities' | 'Coins' | 'Tokens' | 'Stocks'; label: string; value: string }
/** Coins run on their own chain; tokens are issued on another chain (or are this city's practice tokens). */
/** Listed assets that are tokens (issued on another chain); the rest are coins of their own chain. */
export const TOKEN_IDS = new Set(['link', 'wif', 'bonk'])

/** Books: assets, liabilities (luxury rewards with upkeep), investments (coins, new coins, stocks).
 *  isPublic hides family requests and spending wants. */
export function bookRows(save: Save, isPublic = false): BookRow[] {
  const rows: BookRow[] = []
  const passed = Object.values(save.skills).some((skill) => skill?.passed)
  if (save.ledger > 0) rows.push({ section: 'Assets', label: 'Grind cash (in-game)', value: money(save.ledger) })
  if (passed) rows.push({ section: 'Assets', label: 'Campus pass', value: 'Held' })
  if (save.earnings > 0) rows.push({ section: 'Assets', label: 'Lifetime earnings', value: money(save.earnings) })
  if (!rows.length) rows.push({ section: 'Assets', label: 'Nothing held yet', value: 'Earn from courses and jobs' })
  // Liabilities: luxury rewards cost upkeep and lose value the moment you own them.
  const lux: BookRow[] = []
  if (save.houseClaimed) lux.push({ section: 'Liabilities', label: 'House', value: 'Upkeep' })
  if (save.luxury) lux.push({ section: 'Liabilities', label: 'Gold chain', value: `Resells ${money(RESELL_USD)}` })
  const kindLabel = { car: 'Car', jet: 'Jet', drone: 'Drone', phone: 'Phone', laptop: 'Computer', accessory: 'Accessory' } as const
  for (const id of save.ownedVehicles ?? []) {
    const v = VEHICLES.find((item) => item.id === id)
    if (v) lux.push({ section: 'Liabilities', label: `${kindLabel[v.kind]} · ${v.label}`, value: 'Upkeep' })
  }
  for (const id of save.ownedDrones) lux.push({ section: 'Liabilities', label: `Drone · ${id}`, value: 'Upkeep' })
  if (!isPublic) for (const want of save.wants) lux.push({ section: 'Liabilities', label: want.label, value: `${money(want.spent)} spent` })
  if (!isPublic && save.taxOpen) lux.push({ section: 'Liabilities', label: 'Family request (private)', value: money(TAX_USD) })
  rows.push(...(lux.length ? lux : [{ section: 'Liabilities' as const, label: 'No cars, jets, drones or houses yet', value: 'None' }]))
  const pos = (section: 'Coins' | 'Tokens', label: string, h: Holding, price: number): BookRow => {
    if (h.qty <= 0) return { section, label, value: 'None held' }
    const pnl = (price - h.avg) * h.qty
    const value = h.qty * price
    return { section, label, value: `${formatQty(h.qty)} @ ${money(h.avg)} · worth ${money(value)} · ${pnl >= 0 ? '+' : ''}${money(pnl)}` }
  }
  const coins: BookRow[] = [pos('Coins', 'District Coin', save.unit, save.unitPrice)]
  const tokens: BookRow[] = [pos('Tokens', 'Meme Token', save.meme, save.memePrice)]
  for (const coin of COINS) {
    const h = save.coins?.[coin.id]
    if (h && h.qty > 0) {
      const price = save.coinPrices[coin.id] ?? coin.base
      const cat = COIN_CATEGORIES.find((c) => c.id === coin.cat)!.label
      if (TOKEN_IDS.has(coin.id)) tokens.push(pos('Tokens', `${coin.label} · ${cat}`, h, price))
      else coins.push(pos('Coins', `${coin.label} · ${cat}`, h, price))
    }
  }
  rows.push(...(coins.length ? coins : [{ section: 'Coins' as const, label: 'BTC, ETH, SOL and more on the Markets desk', value: 'None held' }]))
  rows.push(...tokens)
  rows.push({ section: 'Stocks', label: 'Stocks', value: 'None listed yet' })
  return rows
}
