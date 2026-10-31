import { attribution, track } from './track.ts'
import { grade, courseById } from './courses.ts'
import {
  BOUNTY_USD,
  CHAIN_USD,
  CLIMATE_USD,
  COURSE_XP,
  DRONES,
  RESELL_USD,
  SAVE_KEY,
  SKILL_META,
  STIPEND_USD,
  TAX_USD,
  applyDay,
  cleanDisplayName,
  cleanUsername,
  buyHolding,
  cents,
  createSave,
  hydrate,
  quoteDrone,
  quoteVehicle,
  RANK_START,
  RANKS,
  COINS,
  stepCoins,
  VEHICLES,
  type VehicleId,
  lagosDay,
  makeId,
  markDaily,
  maybeOpenTax,
  money,
  positionPnl,
  pushHist,
  rankFor,
  seasonAt,
  sellHolding,
  stepPrices,
  type Activity,
  type DroneId,
  type Graphics,
  type MapSize,
  type MaskId,
  type RankId,
  type RepFlag,
  type Save,
  type SkillId,
} from './logic.ts'

type Listener = (rankedUp?: RankId) => void

let save = createSave()
const listeners = new Set<Listener>()
let sample = 0
let sinceSave = 0

function today(): string {
  const day = lagosDay(new Date())
  applyDay(save, day)
  return day
}

// Per-user, versioned save slot: Privy user id when signed in, else a stable guest id.
const SLOT_VERSION = 'v1'
function userId(): string {
  try {
    const privy = localStorage.getItem('gd.privy.userId')
    if (privy) return `privy-${privy}`
    let guest = localStorage.getItem('gd.guestId')
    if (!guest) {
      guest = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('gd.guestId', guest)
    }
    return `guest-${guest}`
  } catch {
    return 'guest-session'
  }
}
export function slotKey(): string {
  return `gd.save.${SLOT_VERSION}.${userId()}`
}
let autosave = 0
function startAutosave(): void {
  if (autosave) return
  autosave = window.setInterval(persist, 10_000)
  window.addEventListener('pagehide', persist)
}

/** Spend earned first: the topped-up bucket only shrinks once earned is gone. */
function settleBuckets(): void {
  save.toppedUp = cents(Math.max(0, Math.min(save.toppedUp || 0, save.ledger)))
}

/** Spendable total split into earned (free rewards) and topped-up (from /api/topup-confirm). */
export function balanceSplit(): { total: number; earned: number; toppedUp: number } {
  settleBuckets()
  return { total: save.ledger, earned: cents(save.ledger - save.toppedUp), toppedUp: save.toppedUp }
}

function persist(): void {
  settleBuckets()
  try {
    const json = JSON.stringify(save)
    localStorage.setItem(slotKey(), json)
    localStorage.setItem(SAVE_KEY, json)
    void syncProgress(json)
  } catch {
    // Private mode can refuse the write. The session still plays.
  }
}

function emit(rankedUp?: RankId): void {
  settleBuckets()
  for (const listener of listeners) listener(rankedUp)
}

function gainXp(amount: number): RankId | undefined {
  const before = rankFor(save.xp).id
  save.xp += amount
  const after = rankFor(save.xp).id
  applyStarts()
  return before === after ? undefined : after
}

/** Credit each ladder level's starting balance once (Shrimp $1,000, then the step to each level). */
function applyStarts(): void {
  if (!save.signedUp) return
  const idx = RANKS.findIndex((r) => r.id === rankFor(save.xp).id)
  while (save.startTier < idx) {
    const next = save.startTier + 1
    const prev = next > 0 ? RANK_START[RANKS[next - 1].id] : 0
    const grant = RANK_START[RANKS[next].id] - prev
    save.ledger = cents(save.ledger + grant)
    save.startTier = next
    log('money', `${RANKS[next].label} starting balance`, `+${money(grant)} in-game for reaching ${RANKS[next].label}.`)
  }
}

export function tradeCoin(id: string, side: 'buy' | 'sell', fraction: number): { ok: boolean; message: string } {
  const coin = COINS.find((c) => c.id === id)
  if (!coin) return { ok: false, message: 'Not listed.' }
  const rankIdx = RANKS.findIndex((r) => r.id === rankFor(save.xp).id)
  if (RANKS.findIndex((r) => r.id === coin.minRank) > rankIdx) return { ok: false, message: `Opens at ${RANKS.find((r) => r.id === coin.minRank)!.label}.` }
  const price = save.coinPrices[id] ?? coin.base
  const holding = save.coins[id] ?? { qty: 0, avg: 0 }
  const result = side === 'buy' ? buyHolding(save.ledger, holding, price, fraction) : sellHolding(save.ledger, holding, price, fraction)
  if (!result.ok) return { ok: false, message: result.error }
  save.ledger = result.ledger
  save.coins[id] = result.holding
  const sym = coin.label.split(' ')[0]
  let extra = ''
  if (side === 'buy' && coin.cat === 'big') { save.reputation += 1; extra = ' Reputation +1 for a big-cap position.' }
  log('trade', `${side === 'buy' ? 'Bought' : 'Sold'} ${sym}`, `${money(result.cash)} in-game.`)
  persist()
  emit()
  const pnl = result.pnl
  return { ok: true, message: `${side === 'buy' ? 'Bought' : 'Sold'} ${sym} · ${money(result.cash)}${pnl != null ? ` · P&L ${pnl >= 0 ? '+' : ''}${money(pnl)}` : ''}.${extra}` }
}

type ActivityHook = (kind: Activity['kind'], label: string, detail: string) => void
const activityHooks = new Set<ActivityHook>()
export function onActivity(fn: ActivityHook): void { activityHooks.add(fn) }
/** Small XP for party attendance and city moments. Logged; can rank you up. */
export function bonusXp(n: number, label: string, detail: string): void {
  const up = gainXp(Math.max(0, Math.round(n)))
  log('social', label, detail)
  persist()
  emit(up)
}
/** Small in-game cash rewards (never real money). Credits the in-game balance and logs it in history; XP stays internal for rank. */
export function earnCash(usd: number, label: string, detail: string, xp = 0): void {
  const amt = cents(Math.max(0, usd))
  if (amt > 0) save.ledger = cents(save.ledger + amt)
  log('money', label, `+${money(amt)} in-game. ${detail}`)
  const up = xp > 0 ? gainXp(Math.round(xp)) : undefined
  persist()
  emit(up)
}
/** Career duties: reputation for showing up. Logged like any other activity. */
export function addReputation(n: number, label: string, detail: string): void {
  save.reputation += Math.max(0, Math.round(n))
  log('gig', label, detail)
  persist()
  emit()
}
function log(kind: Activity['kind'], label: string, detail: string): void {
  for (const fn of activityHooks) { try { fn(kind, label, detail) } catch { /* a listener never breaks the log */ } }
  save.activities.unshift({ id: makeId(), at: Date.now(), kind, label, detail })
  if (save.activities.length > 40) save.activities.length = 40
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSave(): Save {
  return save
}

export function loadSave(prefer: Graphics): Save {
  try {
    // Prefer this user's slot, fall back to the legacy key; a corrupt slot falls through to the next.
    let loaded: Save | null = null
    for (const key of [slotKey(), SAVE_KEY]) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        loaded = hydrate(JSON.parse(raw) as unknown)
        break
      } catch (error) {
        console.warn(`[grind] Ignoring a corrupt save in ${key}.`, error)
      }
    }
    save = loaded ?? createSave(new Date(), { graphics: prefer })
  } catch {
    save = createSave(new Date(), { graphics: prefer })
  }
  startAutosave()
  applyDay(save, lagosDay(new Date()))
  if (!save.signedUp && save.body === 'shrimp') {
    save.body = 'player'
    if (save.tint === 0x17f790) save.tint = 0x1a4cff
  }
  applyStarts()
  persist()
  return save
}

export function rememberPlace(x: number, z: number): void {
  if (Math.hypot(save.posX - x, save.posZ - z) < 0.35) return
  save.posX = x
  save.posZ = z
  persist()
}

export function tickMarket(dt: number, now = Date.now()): void {
  applyDay(save, lagosDay(new Date()))
  stepPrices(save, dt, seasonAt(now))
  stepCoins(save, dt, seasonAt(now))
  sample += dt
  if (sample >= 0.8) {
    sample = 0
    pushHist(save.unitHist, save.unitPrice)
    pushHist(save.memeHist, save.memePrice)
  }
  sinceSave += dt
  if (sinceSave > 5) {
    sinceSave = 0
    persist()
  }
}

export function signUp(name: string, username: string, body: 'player' | 'zuri'): { ok: true } | { ok: false; error: string } {
  queueMicrotask(() => { if (save.signedUp) track('signup', { username: save.username, ...attribution() }) })
  const display = cleanDisplayName(name)
  const handle = cleanUsername(username)
  if (!display) return { ok: false, error: 'Pick a name.' }
  if (!handle) return { ok: false, error: 'Username is 3–16 letters, numbers, or underscores.' }
  save.name = display
  save.username = handle
  save.body = body
  save.signedUp = true
  applyStarts()
  persist()
  emit()
  return { ok: true }
}

export function setName(name: string): { ok: true } | { ok: false; error: string } {
  const display = cleanDisplayName(name)
  if (!display) return { ok: false, error: 'Pick a name.' }
  save.name = display
  persist()
  emit()
  return { ok: true }
}

export function setUsername(name: string): { ok: true } | { ok: false; error: string } {
  const handle = cleanUsername(name)
  if (!handle) return { ok: false, error: 'Username is 3–16 letters, numbers, or underscores.' }
  save.username = handle
  persist()
  emit()
  return { ok: true }
}

export function setBody(body: Save['body']): void {
  save.body = body
  persist()
  emit()
}

export function setMask(mask: MaskId): void {
  save.mask = mask
  persist()
  emit()
}

export function buyDrone(id: DroneId): { ok: boolean; message: string } {
  const item = DRONES.find((drone) => drone.id === id)
  if (!item) return { ok: false, message: 'That drone is not on the wall.' }
  const quote = quoteDrone(save.ledger, save.ownedDrones, id)
  if (!quote.ok) return { ok: false, message: quote.error }
  if (!quote.already) {
    save.ledger = quote.ledger
    save.ownedDrones = [...save.ownedDrones, id]
    save.wants.push({ label: `${item.label} drone`, spent: quote.spent, at: Date.now() })
    log('money', `Bought a ${item.label} drone`, 'It follows. It does not carry a message.')
  }
  save.drone = id
  persist()
  emit()
  return { ok: true, message: quote.already ? `${item.label} is up.` : `${item.label} is paid and flying.` }
}

export function buyVehicle(id: VehicleId): { ok: boolean; message: string } {
  const item = VEHICLES.find((v) => v.id === id)
  if (!item) return { ok: false, message: 'That vehicle is not in the hangar.' }
  const quote = quoteVehicle(save.ledger, save.ownedVehicles, id)
  if (!quote.ok) return { ok: false, message: quote.error }
  if (quote.already) return { ok: true, message: `The ${item.label.toLowerCase()} is already yours.` }
  save.ledger = quote.ledger
  save.ownedVehicles = [...save.ownedVehicles, id]
  save.wants.push({ label: item.label, spent: quote.spent, at: Date.now() })
  log('money', `Bought a ${item.label.toLowerCase()}`, 'Filed under liabilities. It costs upkeep.')
  persist()
  emit()
  return { ok: true, message: `${item.label} is yours. It sits under liabilities.` }
}

export function pocketDrone(): { message: string } {
  if (save.drone === 'none') return { message: 'Nothing is flying.' }
  save.drone = 'none'
  persist()
  emit()
  return { message: 'Pocketed. The drone is still yours.' }
}

export function setTint(tint: number): void {
  save.tint = tint
  persist()
  emit()
}

export function setTime(time: Save['timeOfDay']): void {
  save.timeOfDay = time
  persist()
  emit()
}

export function setGraphics(graphics: Graphics): void {
  save.graphics = graphics
  persist()
  emit()
}

export function setMapSize(size: MapSize): void {
  save.mapSize = size
  persist()
  emit()
}

export function setHints(on: boolean): void {
  save.hints = on
  persist()
  emit()
}

export function setReduceMotion(on: boolean): void {
  save.reduceMotion = on
  persist()
  emit()
}

export function setVolume(volume: number): void {
  save.volume = Math.min(100, Math.max(0, Math.round(volume)))
  persist()
}

export function dismissIntro(): void {
  if (save.seenIntro) return
  save.seenIntro = true
  persist()
}

export type CourseResult =
  | { ok: true; already?: false; rankedUp?: RankId; stipend: boolean; focus: boolean; bonus: number }
  | { ok: false; already: true }
  | { ok: false; already?: false; hints: string[]; tries: number }

const COURSE_REP = 5

export function submitCourse(id: SkillId, picks: number[]): CourseResult {
  const course = courseById(id)
  if (!course) return { ok: false, hints: ['That course is not on the board.'], tries: 0 }
  const prev = save.skills[id] ?? { passed: false, tries: 0 }
  if (prev.passed) return { ok: false, already: true }
  const graded = grade(course, picks)
  const tries = prev.tries + 1
  if (!graded.ok) {
    save.skills[id] = { passed: false, tries }
    persist()
    emit()
    return { ok: false, hints: graded.hints, tries }
  }
  const day = today()
  const bonus = markDaily(save, day, 'lesson')
  const focused = save.focus
  if (focused) save.focus = false
  const gained = Math.round(COURSE_XP * (focused ? 1.25 : 1))
  save.skills[id] = { passed: true, tries }
  save.reputation += COURSE_REP
  track('course_complete', { course: id, tries })
  const rankedUp = gainXp(gained + bonus)
  const stipend = id === 'spot' && !save.activities.some((item) => item.label === 'Campus stipend')
  log('skill', `Passed ${SKILL_META[id].title}`, focused ? 'Prayer focus added a quarter. Filed to the CV.' : 'Filed to the CV, resume, and portfolio.')
  if (stipend) {
    save.ledger = cents(save.ledger + STIPEND_USD)
    save.earnings += 1
    log('money', 'Campus stipend', `${money(STIPEND_USD)} practice funds. Not a deposit and not a token.`)
    maybeOpenTax(save, day)
  }
  persist()
  emit(rankedUp)
  return { ok: true, rankedUp, stipend, focus: focused, bonus }
}

export type TradeFill = {
  ok: boolean
  message: string
  rankedUp?: RankId
}

export function trade(symbol: 'unit' | 'meme', side: 'buy' | 'sell', fraction: number, plan: boolean): TradeFill {
  const price = symbol === 'unit' ? save.unitPrice : save.memePrice
  const holding = symbol === 'unit' ? save.unit : save.meme
  const result = side === 'buy' ? buyHolding(save.ledger, holding, price, fraction) : sellHolding(save.ledger, holding, price, fraction)
  if (!result.ok) return { ok: false, message: result.error }
  save.ledger = result.ledger
  if (symbol === 'unit') save.unit = result.holding
  else save.meme = result.holding
  const name = symbol === 'unit' ? 'UNIT' : 'MEME'
  if (side === 'buy') {
    log('trade', `Bought ${name}`, `Spent ${money(result.cash)} practice at ${money(price)}.`)
    persist()
    emit()
    return { ok: true, message: `Bought ${name} with ${money(result.cash)} practice. The plan is logged when you sell.` }
  }
  const day = today()
  const flag: RepFlag = symbol === 'unit' ? 'spotPlan' : 'trenchPlan'
  let bonus = 0
  let planXp = 0
  if (plan && !save.dailies[flag]) {
    bonus = markDaily(save, day, flag)
    planXp = 12
  }
  const rankedUp = planXp + bonus > 0 ? gainXp(planXp + bonus) : undefined
  const pnl = result.pnl ?? 0
  const tone = pnl >= 0 ? `Closed in the green by ${money(pnl)} on the practice book.` : `Closed in the red by ${money(pnl)}. Rank does not mark to market.`
  let extra = 'No plan was checked, so the ladder stays put.'
  if (plan && planXp > 0) extra = 'The plan is on the ladder.'
  else if (plan) extra = 'You already logged a plan on this desk today.'
  log('trade', `Sold ${name}`, `${tone} ${extra}`)
  persist()
  emit(rankedUp)
  return { ok: true, message: `${tone} ${extra}`, rankedUp }
}

export function walkGym(): { message: string } {
  today()
  if (!save.dailies.gym) return { message: 'The set is the rep. Hit the marker in the mint band. A walk does not file the day.' }
  return { message: `Best filed set is ${save.gymBest}/8. Another set today does not stack the streak.` }
}

export function finishGym(hits: number, swings: number): { message: string; rankedUp?: RankId; already: boolean } {
  const day = today()
  if (hits > save.gymBest) save.gymBest = hits
  if (save.dailies.gym) {
    persist()
    return { already: true, message: `Practice set: ${hits}/${swings}. Today's gym is already on the ladder. Best is ${save.gymBest}.` }
  }
  const bonus = markDaily(save, day, 'gym')
  const rankedUp = gainXp(hits * 5 + bonus)
  log('skill', `Gym ${hits}/${swings}`, 'Consistency rep. Balance was not involved.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: `${hits}/${swings} logged. +${hits * 5} XP${bonus ? `, plus ${bonus} for showing up` : ''}.` }
}

export function attendChurch(): { message: string; rankedUp?: RankId; already: boolean } {
  today()
  if (save.dailies.church) return { already: true, message: 'You were here today. The room stays open.' }
  const bonus = markDaily(save, today(), 'church')
  save.reputation += 8
  const rankedUp = gainXp(10 + bonus)
  log('social', 'Sat in the church', 'Rest is part of the grind. Charts stayed outside.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: 'You sat. Reputation +8. The chart did not get a vote.' }
}

export function sitPrayer(): { message: string; rankedUp?: RankId; already: boolean } {
  today()
  if (save.dailies.prayer) {
    return { already: true, message: save.focus ? 'Focus is still on the next course.' : 'You already sat today.' }
  }
  const bonus = markDaily(save, today(), 'prayer')
  save.focus = true
  const rankedUp = bonus > 0 ? gainXp(bonus) : undefined
  log('social', 'Sat in the prayer space', 'No one asked what you believe. Next course counts a quarter more.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: 'Focus is on. The next course you pass counts a quarter more.' }
}

export function orderWater(): { message: string } {
  const day = today()
  if (!save.dailies.cafe) return { message: 'Read the board first. The water can wait.' }
  if (save.waterDay === day) return { message: 'The glass is already on the table. It is water, and it is free.' }
  save.waterDay = day
  save.reputation += 1
  log('social', 'Ordered water', 'Free. The board is still gossip, not a signal.')
  persist()
  emit()
  return { message: 'Water is free. Reputation +1. The headlines did not become a trade.' }
}

export function readCafe(): { message: string; rankedUp?: RankId; already: boolean } {
  today()
  if (save.dailies.cafe) return { already: true, message: 'You already read the room today. The board stays up.' }
  const bonus = markDaily(save, today(), 'cafe')
  const rankedUp = gainXp(8 + bonus)
  log('social', 'Read the café board', 'Gossip is the season, not a trade signal.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: 'Filed. The headlines are not a signal to size up.' }
}

export function postBounty(text: string): { message: string; rankedUp?: RankId; already: boolean } {
  const body = text.replace(/\s+/g, ' ').trim()
  if (body.length < 20) return { already: false, message: 'Give it at least 20 characters. A bounty is a sentence, not a ticker.' }
  const day = today()
  if (save.dailies.bounty) return { already: true, message: 'One bounty a day. The row will still be here tomorrow.' }
  save.ledger = cents(save.ledger + BOUNTY_USD)
  const bonus = markDaily(save, day, 'bounty')
  save.earnings += 1
  save.reputation += 4
  const rankedUp = gainXp(14 + bonus)
  log('gig', 'Posted a bounty', body.slice(0, 160))
  maybeOpenTax(save, day)
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: `Posted. ${money(BOUNTY_USD)} practice landed. It is not a thesis.` }
}

export function pledge(projectName: string): { message: string; rankedUp?: RankId; already: boolean } {
  const day = today()
  if (save.dailies.climate) return { already: true, message: 'One pledge a day. The grove does not retire a real credit either way.' }
  if (save.ledger < CLIMATE_USD) {
    return { already: false, message: `The desk asks ${money(CLIMATE_USD)} practice. Pass Spot for a stipend, or post on the row.` }
  }
  const bonus = markDaily(save, day, 'climate')
  save.ledger = cents(save.ledger - CLIMATE_USD)
  save.reputation += 10
  save.carbon.unshift({ id: makeId(), name: projectName, usd: CLIMATE_USD, at: Date.now() })
  const rankedUp = gainXp(8 + bonus)
  log('climate', `Pledged to ${projectName}`, 'Practice only. This does not retire a real tonne.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: `${projectName} is on your portfolio as a practice pledge. Not a retired credit.` }
}

export function noteTalk(): { message: string; already: boolean } {
  if (!save.conference) return { already: false, message: 'Sit through the talk first. The notes are the last two minutes.' }
  if (save.conferenceNoted) return { already: true, message: 'You already kept the note: a course, a bounty, or a pledge. A balance is not the proof.' }
  save.conferenceNoted = true
  save.reputation += 1
  log('skill', 'Kept the hall note', 'Proof is a course, a bounty, or a pledge. A balance is not.')
  persist()
  emit()
  return { already: false, message: 'Noted. Reputation +1. The hall does not grade a slogan.' }
}

export function hearTalk(): { message: string; rankedUp?: RankId; already: boolean } {
  if (save.conference) return { already: true, message: 'You already sat through it. The hall keeps the chairs.' }
  save.conference = true
  const bonus = markDaily(save, today(), 'visit')
  const rankedUp = gainXp(18 + bonus)
  log('skill', 'Sat through the campus talk', 'Proof of work, not a slogan. Ninety seconds, then back outside.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: 'You stayed. +18 XP. The talk is on your portfolio.' }
}

export function readRobot(): { message: string; rankedUp?: RankId; already: boolean } {
  if (save.robotRead) return { already: true, message: 'Unit 4 stays labeled. That was the whole lesson.' }
  save.robotRead = true
  const bonus = markDaily(save, today(), 'visit')
  const rankedUp = gainXp(8 + bonus)
  log('skill', 'Read Unit 4’s label', 'Agents attach to robots and say so.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: 'Label read. People are not silent agents.' }
}

export function claimHouse(): { message: string; already: boolean } {
  if (save.houseClaimed) return { already: true, message: 'The room is already yours. Voice comes later.' }
  save.houseClaimed = true
  markDaily(save, today(), 'visit')
  save.reputation += 3
  log('social', 'Claimed a room', 'Private for now. Messaging and voice are not in this build.')
  persist()
  emit()
  return { already: false, message: 'The room is yours. Reputation +3. The notes house, the set house, and the grove house are on this row.' }
}

export function markHouseVisit(id: string): { already: boolean } {
  if (id === 'yours' || save.houseVisits.includes(id)) return { already: true }
  if (id !== 'adaeze' && id !== 'malik' && id !== 'nia' && id !== 'vacant') return { already: true }
  save.houseVisits = [...save.houseVisits, id]
  save.reputation += 2
  const names: Record<string, string> = {
    adaeze: 'Studied at the notes house',
    malik: 'Trained at the set house',
    nia: 'Visited the grove house',
    vacant: 'Looked through the vacant house',
  }
  log('social', names[id] ?? 'Visited a house', 'Visited a neighbour on the east row.')
  persist()
  emit()
  return { already: false }
}

export function payTax(): { message: string; ok: boolean; rankedUp?: RankId } {
  if (!save.taxOpen) return { ok: false, message: 'No open request.' }
  if (save.ledger < TAX_USD) return { ok: false, message: `The practice ledger does not cover ${money(TAX_USD)}.` }
  save.ledger = cents(save.ledger - TAX_USD)
  save.taxOpen = false
  save.taxPaid += 1
  const day = today()
  save.taxResolvedDay = day
  save.reputation += 12
  const bonus = markDaily(save, day, 'visit')
  const rankedUp = bonus > 0 ? gainXp(bonus) : undefined
  log('tax', 'Paid the family request', `${money(TAX_USD)} practice for transport. Reputation, not rank.`)
  persist()
  emit(rankedUp)
  return { ok: true, rankedUp, message: `Paid ${money(TAX_USD)}. Reputation +12. Rank did not move for the money.` }
}

export function declineTax(): { message: string } {
  if (!save.taxOpen) return { message: 'No open request.' }
  save.taxOpen = false
  save.taxDeclined += 1
  save.taxResolvedDay = today()
  log('tax', 'Left the family request', 'No penalty. The ladder does not punish a no.')
  persist()
  emit()
  return { message: 'Not today. No penalty, and the request will not stack on you.' }
}

export function buyChain(): { message: string; ok: boolean } {
  if (save.luxury) return { ok: false, message: 'You already wear it.' }
  if (save.ledger < CHAIN_USD) return { ok: false, message: `Short ${money(CHAIN_USD - save.ledger)}. The chain is a want, not a need.` }
  save.ledger = cents(save.ledger - CHAIN_USD)
  save.luxury = true
  save.wants.push({ label: 'Gold chain', spent: CHAIN_USD, at: Date.now() })
  log('money', 'Bought a gold chain', 'A want. It sits under liabilities as a want, and under assets as a thing you can resell.')
  persist()
  emit()
  return { ok: true, message: 'It is on. The books will call it a want.' }
}

export function sellChain(): { message: string; ok: boolean } {
  if (!save.luxury) return { ok: false, message: 'Nothing to resell.' }
  save.luxury = false
  save.ledger = cents(save.ledger + RESELL_USD)
  log('money', 'Resold the chain', `${money(RESELL_USD)} practice came back. The want stays in the history.`)
  persist()
  emit()
  return { ok: true, message: `Resold for ${money(RESELL_USD)} practice. The purchase stays on the books as a want.` }
}

export function resetProgress(): void {
  const graphics = save.graphics
  const volume = save.volume
  const timeOfDay = save.timeOfDay
  const mapSize = save.mapSize
  const hints = save.hints
  const reduceMotion = save.reduceMotion
  const name = save.name
  const username = save.username
  const signedUp = save.signedUp
  const body = save.body
  save = createSave(new Date(), { graphics })
  save.volume = volume
  save.timeOfDay = timeOfDay
  save.mapSize = mapSize
  save.hints = hints
  save.reduceMotion = reduceMotion
  save.name = name
  save.username = username
  save.signedUp = signedUp
  save.body = body
  save.seenIntro = true
  persist()
  emit()
}

export function describeTrade(symbol: 'unit' | 'meme'): { price: number; pnl: number; qty: number; avg: number } {
  const holding = symbol === 'unit' ? save.unit : save.meme
  const price = symbol === 'unit' ? save.unitPrice : save.memePrice
  return { price, pnl: positionPnl(holding, price), qty: holding.qty, avg: holding.avg }
}

/**
 * Server sync stub (flag VITE_PROGRESS_SYNC=1). Posts the save to /api/progress, throttled to one
 * write per 30 s. The table is in supabase/migrations/20261031_player_progress.sql; the endpoint is not built yet.
 */
let lastSync = 0
async function syncProgress(json: string): Promise<void> {
  if (import.meta.env.VITE_PROGRESS_SYNC !== '1') return
  const now = Date.now()
  if (now - lastSync < 30_000) return
  lastSync = now
  try {
    await fetch('/api/progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: json, keepalive: true })
  } catch {
    // Offline is fine: local save is the source of truth.
  }
}

export const SIGNUP_BONUS = 1000
/** One 1,000 in-game sign-up bonus per verified (Privy) login id. In-game money only. */
export function grantSignupBonus(verifiedId: string): boolean {
  if (!verifiedId) return false
  const key = 'gd.signupBonus.v1'
  let claimed: string[] = []
  try { claimed = JSON.parse(localStorage.getItem(key) ?? '[]') as string[] } catch { claimed = [] }
  if (claimed.includes(verifiedId)) return false
  claimed.push(verifiedId)
  localStorage.setItem(key, JSON.stringify(claimed))
  save.ledger = Math.round((save.ledger + SIGNUP_BONUS) * 100) / 100
  log('social', 'Sign-up bonus', `$${SIGNUP_BONUS.toLocaleString()} in-game for a verified login.`)
  persist()
  emit()
  return true
}

/** On-chain top-up credited by /api/topup-confirm. Applied once per payment tx hash. */
export function applyTopup(hash: string, amount: number, asset: string): boolean {
  const key = 'gd.topups.v1'
  let seen: string[] = []
  try { seen = JSON.parse(localStorage.getItem(key) ?? '[]') as string[] } catch { seen = [] }
  const h = hash.toLowerCase()
  if (seen.includes(h) || !(amount > 0)) return false
  seen.push(h)
  localStorage.setItem(key, JSON.stringify(seen))
  settleBuckets()
  save.ledger = Math.round((save.ledger + amount) * 100) / 100
  save.toppedUp = cents(save.toppedUp + amount)
  log('money', 'Top-up credited', `$${amount.toFixed(2)} in-game from a ${asset} top-up on Base (after the 2% fee).`)
  persist()
  emit()
  return true
}

/** Join an in-game Web3 event at the Conference centre (once per event; doors open 2 h before). */
export function joinEvent(ev: { id: string; title: string; kind: string; xp: number; rep: number; open: boolean }): { message: string; rankedUp?: RankId; already: boolean } {
  if (!ev.open) return { already: false, message: `Doors open two hours before. Come back for ${ev.title}.` }
  if (save.eventsJoined.includes(ev.id)) return { already: true, message: 'You are already on the list for this one. Take a seat.' }
  save.eventsJoined = [...save.eventsJoined, ev.id].slice(-30)
  save.reputation += ev.rep
  const rankedUp = gainXp(ev.xp)
  save.ledger = cents(save.ledger + ev.xp)
  log('money', `Event reward: ${ev.title}`, `+${money(ev.xp)} in-game for attending.`)
  log('skill', `Joined ${ev.kind}: ${ev.title}`, 'Attended at the Conference centre.')
  persist()
  emit(rankedUp)
  return { already: false, rankedUp, message: `You joined. +${money(ev.xp)} in-game, reputation +${ev.rep}. It is on your portfolio.` }
}
