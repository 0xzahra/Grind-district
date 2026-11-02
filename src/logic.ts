export const ZAHRA = 'https://0xzahra.github.io'
export const SAVE_KEY = 'grind-district-save-v1'
export const COURSE_XP = 70
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
  records: { title: 'Reading a transfer', cv: 'Reading a transfer — status, from, to, asset, and chain, not a screenshot' },
}

export type MapSize = 'compact' | 'large'

export type BodyId = 'player' | 'zuri' | 'shrimp' | 'ledger' | 'marina' | 'signal'
export type MaskId = 'none' | 'punk' | 'ape' | 'pudgy' | 'azuki' | 'nodemonke' | 'degods'
export type DroneId = 'scout' | 'courier' | 'halo'
export type TimeOfDay = 'night' | 'dusk' | 'day'
export type Graphics = 'low' | 'medium' | 'high'
export type RankId = 'shrimp' | 'crab' | 'fish' | 'dolphin' | 'shark' | 'whale'

export type PanelId =
  | 'intro'
  | 'profile'
  | 'topup'
  | 'learn'
  | 'trade'
  | 'trench'
  | 'boutique'
  | 'gadgets'
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
  { id: 'mint', hex: 0x1af38f, label: 'Mint' },
  { id: 'sand', hex: 0xf0d7b0, label: 'Sand' },
  { id: 'coral', hex: 0xff6f61, label: 'Coral' },
  { id: 'ice', hex: 0x9fd4ff, label: 'Ice' },
] as const

export const BODIES: { id: BodyId; label: string; blurb: string }[] = [
  { id: 'player', label: 'Man', blurb: 'Blonde hair, thin glasses, grey suit, blue shirt. Original. Not a licensed collection.' },
  { id: 'zuri', label: 'Woman', blurb: 'Longer hair, a softer face, lashes, and a fitted coat. Original.' },
  { id: 'shrimp', label: 'Shrimp', blurb: 'The mascot. Free. Rank still starts at shrimp either way.' },
  { id: 'ledger', label: 'Ledger', blurb: 'Original helmet. Not a licensed collection.' },
  { id: 'marina', label: 'Marina', blurb: 'Original buoy. Not a licensed collection.' },
  { id: 'signal', label: 'Signal', blurb: 'Original coat. Not a licensed collection.' },
]

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

export const PROJECTS = [
  { id: 'mangrove', name: 'Lagos mangrove' },
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
  privyId: string
  nearAccountId: string
  body: BodyId
  tint: number
  luxury: boolean
  mask: MaskId
  drone: DroneId | 'none'
  ownedDrones: DroneId[]
  xp: number
  reputation: number
  ledger: number
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
  timeOfDay: TimeOfDay
  graphics: Graphics
  volume: number
  mapSize: MapSize
  hints: boolean
  reduceMotion: boolean
  waterDay: string
  conferenceNoted: boolean
  conference: boolean
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
  k: SkillId[]
  a: string[]
}

export function localDay(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function activityDate(ts: number): string {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(ts))
}

export function cents(value: number): number {
  return Math.round(value * 100) / 100
}

export function money(value: number): string {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toFixed(2)}`
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

export function createSave(now = new Date(), opts?: { graphics?: Graphics }): Save {
  const rand = mulberry32(19)
  const unitHist = walkPrice(1, 0, 0.03, 0.2, 5, 42, rand)
  const memeHist = walkPrice(0.4, 0, 0.12, 0.02, 12, 42, rand)
  return {
    v: 1,
    name: '',
    username: '',
    signedUp: false,
    privyId: '',
    nearAccountId: '',
    body: 'player',
    tint: TINTS[0].hex,
    luxury: false,
    mask: 'none',
    drone: 'none',
    ownedDrones: [],
    xp: 0,
    reputation: 0,
    ledger: 0,
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
    dailies: blankDaily(localDay(now)),
    timeOfDay: 'night',
    graphics: opts?.graphics ?? 'medium',
    volume: 70,
    mapSize: 'compact',
    hints: true,
    reduceMotion: false,
    waterDay: '',
    conferenceNoted: false,
    conference: false,
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

export function cleanPrivyId(value: unknown): string {
  if (typeof value !== 'string') return ''
  const id = value.trim()
  if (!/^did:privy:[A-Za-z0-9_-]{8,80}$/.test(id)) return ''
  return id
}

export function cleanNearAccountId(value: unknown): string {
  if (typeof value !== 'string') return ''
  const id = value.trim().toLowerCase()
  if (id.length < 2 || id.length > 64 || !/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/.test(id)) return ''
  return id
}

export function cleanDisplayName(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, 24)
}

export function cleanUsername(value: unknown): string {
  if (typeof value !== 'string') return ''
  const handle = value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16)
  return /^[a-z0-9_]{3,16}$/.test(handle) ? handle : ''
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
  if (value === 'player' || value === 'zuri' || value === 'shrimp' || value === 'ledger' || value === 'marina' || value === 'signal') return value
  return 'shrimp'
}

export function wearsPlate(body: BodyId): boolean {
  return body === 'player' || body === 'zuri'
}

const MASK_IDS = new Set<string>(MASKS.map((mask) => mask.id))

export function cleanMask(value: unknown): MaskId {
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
  return TINTS.some((tint) => tint.hex === hex) ? hex : TINTS[0].hex
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
  fresh.privyId = cleanPrivyId(row.privyId)
  fresh.nearAccountId = cleanNearAccountId(row.nearAccountId)
  fresh.body = cleanBody(row.body)
  fresh.tint = cleanTint(row.tint)
  fresh.luxury = bool(row.luxury, false)
  fresh.mask = cleanMask(row.mask)
  fresh.ownedDrones = cleanOwnedDrones(row.ownedDrones)
  const worn = cleanDrone(row.drone)
  fresh.drone = worn !== 'none' && fresh.ownedDrones.includes(worn) ? worn : 'none'
  fresh.xp = num(row.xp, 0, 1_000_000, 0)
  fresh.reputation = num(row.reputation, 0, 1_000_000, 0)
  fresh.ledger = cents(num(row.ledger, 0, 1_000_000, 0))
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
  fresh.timeOfDay = cleanTime(row.timeOfDay)
  fresh.graphics = cleanGraphics(row.graphics)
  fresh.volume = num(row.volume, 0, 100, 70)
  fresh.mapSize = cleanMapSize(row.mapSize)
  fresh.hints = bool(row.hints, true)
  fresh.reduceMotion = bool(row.reduceMotion, false)
  fresh.waterDay = typeof row.waterDay === 'string' ? row.waterDay.slice(0, 10) : ''
  fresh.conferenceNoted = bool(row.conferenceNoted, false)
  fresh.conference = bool(row.conference, false)
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
  if (save.dailies.day !== today) save.dailies = blankDaily(today)
}

export function markDaily(save: Save, today: string, flag: RepFlag): void {
  applyDay(save, today)
  save.dailies[flag] = true
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

export function stepPrices(save: Save, dt: number, rand: () => number = Math.random): void {
  const step = Math.min(0.1, Math.max(0, dt))
  const unitNoise = (rand() - 0.5) * 0.015 * Math.sqrt(step)
  const memeNoise = (rand() - 0.5) * 0.08 * Math.sqrt(step)
  save.unitPrice = roundPx(clampPrice(save.unitPrice * Math.exp(unitNoise), 0.2, 5))
  save.memePrice = roundPx(clampPrice(save.memePrice * Math.exp(memeNoise), 0.02, 12))
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

function skillLines(save: Save): string[] {
  return SKILL_ORDER.flatMap((id) => (save.skills[id]?.passed ? [SKILL_META[id].cv] : []))
}

export function documents(save: Save): { cv: string; resume: string; portfolio: string } {
  const rank = rankFor(save.xp)
  const next = nextRank(save.xp)
  const skills = skillLines(save)
  const proof = save.activities.slice(0, 8)
  const header = [
    'GRIND DISTRICT',
    'Practice profile. Not a credential. Not a wallet. Not financial advice.',
    '',
    `Name: ${save.name}`,
    `Username: @${save.username}`,
    `Rank: ${rank.label} (${save.xp} XP${next ? `, next ${next.label} at ${next.xp}` : ', top of an open ladder'})`,
    `Reputation: ${save.reputation} (this does not move the ladder)`,
    `Practice ledger: ${money(save.ledger)}`,
    'Real funds in this build: none',
  ]
  const cv = [
    ...header,
    '',
    'Skills',
    ...(skills.length ? skills.map((line) => `- ${line}`) : ['- None filed. The learning hall is north of the plaza.']),
    '',
    'Recent proof',
    ...(proof.length
      ? proof.map((item) => `- ${item.label} (${activityDate(item.at)})`)
      : ['- Nothing filed yet.']),
    '',
    'Investments (practice marks)',
    holdingLine('UNIT', save.unit, save.unitPrice),
    holdingLine('MEME', save.meme, save.memePrice),
    '',
    save.taxOpen ? `Open request: cousin, transport, ${money(TAX_USD)}. Paying is reputation. Declining has no penalty.` : 'Open request: none',
  ].join('\n')

  const resume = [
    `${save.name} (@${save.username}) is a ${rank.label.toLowerCase()} in Grind District, one shared city. This resume is written from practice actions. It is not a degree and it is not a claim about real capital.`,
    '',
    skills.length
      ? `Skills filed: ${skills.join('; ')}.`
      : 'No skill is filed yet. The learning hall is north of the plaza, and the first course is Spot.',
    '',
    proof.length
      ? `Latest proof: ${proof.map((item) => item.label).join('; ')}.`
      : 'No proof is filed yet. A passed course, a bounty, or a pledge will land here on its own.',
    '',
    `Reputation is ${save.reputation}. Rank does not read the practice ledger.`,
  ].join('\n')

  const portfolio = [
    `${save.name} (@${save.username}) — portfolio`,
    'Generated from the city. Share the link. Do not send a seed phrase to anyone who asks to "verify" it.',
    '',
    ...(save.activities.length
      ? save.activities.slice(0, 16).map((item) => `- ${activityDate(item.at)} — ${item.label}. ${item.detail}`)
      : ['- Empty. Finish a course or post a bounty and this page writes itself.']),
    '',
    save.carbon.length
      ? `Practice pledges: ${save.carbon.map((note) => note.name).join(', ')}. These do not retire a real credit.`
      : 'Practice pledges: none.',
    save.wants.length ? `Wants bought: ${save.wants.map((want) => want.label).join(', ')}.` : 'Wants bought: none.',
  ].join('\n')

  return { cv, resume, portfolio }
}

function holdingLine(symbol: string, holding: Holding, price: number): string {
  if (holding.qty <= 0) return `- ${symbol}: flat`
  const pnl = positionPnl(holding, price)
  return `- ${symbol}: ${holding.qty.toFixed(4)} @ avg ${money(holding.avg)}, mark ${money(price)}, open ${money(pnl)}`
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
    k: SKILL_ORDER.filter((id) => save.skills[id]?.passed),
    a: save.activities.slice(0, 6).map((item) => item.label.slice(0, 80)),
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
      k: skills,
      a: proof,
    }
  } catch {
    return null
  }
}

export function profileShareUrl(save: Save, href: string): string {
  const url = new URL(href)
  url.search = ''
  url.hash = `p=${encodeShare(save)}`
  return url.toString()
}

export function decodeProfileHash(hash: string): SharedProfile | null {
  const match = hash.match(/^#(?:p|profile)=([A-Za-z0-9_-]+)$/)
  return match ? decodeShare(match[1]) : null
}

export function sharedText(profile: SharedProfile): string {
  const rank = rankFor(profile.x)
  const skills = profile.k.map((id) => SKILL_META[id].title)
  return [
    `${profile.n}${profile.u ? ` · @${profile.u}` : ''} · ${rank.label}`,
    'Grind District practice profile',
    `XP ${profile.x} · reputation ${profile.p}`,
    skills.length ? `Skills: ${skills.join(', ')}` : 'Skills: none filed',
    'Proof:',
    ...(profile.a.length ? profile.a.map((line) => `- ${line}`) : ['- none attached']),
    'Not a credential. Not a wallet. Not financial advice.',
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
