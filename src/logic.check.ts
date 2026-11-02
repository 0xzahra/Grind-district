import { COURSES, everySkillHasCourse, grade, courseById } from './courses.ts'
import {
  buyHolding,
  applyDay,
  createSave,
  decodeShare,
  documents,
  encodeShare,
  hydrate,
  localDay,
  markDaily,
  cleanDisplayName,
  cleanNearAccountId,
  cleanDrone,
  cleanMask,
  cleanOwnedDrones,
  cleanUsername,
  quoteDrone,
  rankFor,
  sellHolding,
  stepPrices,
  sharedText,
} from './logic.ts'
import { blocked, resolveCollision, type Obstacle } from './physics.ts'
import { nearMarketOrderMessage, quoteNpcMarket } from './near-economy.ts'

let failed = 0

function check(condition: boolean, message: string): void {
  if (condition) return
  failed += 1
  console.error(message)
}

check(everySkillHasCourse(), 'every skill needs one course')
const spot = courseById('spot')
check(!!spot, 'spot course exists')
check(COURSES.length === 12 && COURSES.every((course) => course.paragraphs.length >= 4 && course.questions.length === 4), 'twelve courses, each with a lesson and four exercises')
if (spot) {
  const good = grade(spot, spot.questions.map((question) => question.answer))
  check(good.ok, 'spot answers pass')
  const bad = grade(spot, spot.questions.map((question, index) => (index === 0 ? 0 : question.answer)))
  check(!bad.ok && bad.hints[0].length > 0 && bad.hints[1] === '', 'spot hints only the miss')
}

check(rankFor(0).id === 'shrimp', '0 is shrimp')
check(rankFor(69).id === 'shrimp', '69 is shrimp')
check(rankFor(70).id === 'crab', '70 is crab')
check(rankFor(699).id === 'dolphin', '699 is dolphin')
check(rankFor(700).id === 'shark', '700 is shark')
check(rankFor(1100).id === 'whale', '1100 is whale')

const bought = buyHolding(25, { qty: 0, avg: 0 }, 1, 0.5)
check(bought.ok && bought.ledger === 12.5 && bought.holding.qty === 12.5, 'buy half of 25 at $1')
if (bought.ok) {
  const sold = sellHolding(bought.ledger, bought.holding, 1.2, 1)
  check(sold.ok && sold.pnl === 2.5 && sold.holding.qty === 0 && sold.ledger === 27.5, 'sell the clip for +2.50')
}
check(!buyHolding(0.4, { qty: 0, avg: 0 }, 1, 1).ok, 'cannot buy without a dollar')
const red = sellHolding(0, { qty: 4, avg: 2 }, 1, 1)
check(red.ok && red.pnl === -4, 'a red close stays a red close')

check(localDay(new Date(2026, 9, 30, 23, 30)) === '2026-10-30', 'daily keys use the local calendar date')
check(quoteNpcMarket(1, 'buy') === 1.01 && quoteNpcMarket(1, 'sell') === 0.99, 'NPC quotes use a fixed spread around the live practice price')
const orderMessage = nearMarketOrderMessage({ asset: 'UNIT', side: 'buy', size: 0.5, quote: 1.01, expiresAt: Date.UTC(2026, 0, 1) })
check(orderMessage.includes('BUY 50% UNIT') && orderMessage.includes('local practice book only') && !orderMessage.includes('alice.near'), 'NEP-413 order copy is scoped to the market action and omits account identity')

const save = createSave(new Date(2026, 9, 30, 12))
const first = markDaily(save, '2026-10-30', 'lesson')
check(first === undefined && save.dailies.lesson && save.xp === 0, 'filing a daily flag does not add a first-action reward')
markDaily(save, '2026-10-30', 'gym')
check(save.dailies.lesson && save.dailies.gym, 'multiple daily flags can be filed on one date')
applyDay(save, '2026-11-02')
check(save.dailies.day === '2026-11-02' && !save.dailies.lesson && !save.dailies.gym, 'daily flags reset when the local date changes')

const marketA = createSave(new Date(0))
const marketB = createSave(new Date(360000))
check(JSON.stringify(marketA.unitHist) === JSON.stringify(marketB.unitHist) && JSON.stringify(marketA.memeHist) === JSON.stringify(marketB.memeHist), 'initial practice books do not depend on the wall clock')
const stableMarket = createSave()
const stableUnit = stableMarket.unitPrice
const stableMeme = stableMarket.memePrice
stepPrices(stableMarket, 1, () => 0.5)
check(stableMarket.unitPrice === stableUnit && stableMarket.memePrice === stableMeme, 'neutral market input leaves practice prices unchanged')

save.skills.spot = { passed: true, tries: 1 }
save.name = 'Reef'
save.username = 'reef_01'
save.signedUp = true
const docs = documents(save)
check(docs.cv.includes('Not a credential') && docs.cv.includes('Spot trading') && docs.cv.includes('Reef') && docs.resume.includes('@reef_01'), 'documents name the work and the disclaimer')
check(!docs.cv.includes('<script>'), 'documents stay plain text')

const round = decodeShare(encodeShare(save))
check(round?.n === 'Reef' && round.u === 'reef_01' && round.k.includes('spot') && round.x === save.xp, 'share link round-trips')
const walletShare = encodeShare({ ...save, nearAccountId: 'marketuser.near' })
check(!walletShare.includes('marketuser.near'), 'profile sharing excludes the NEAR account ID')
check(sharedText(round ?? { n: 'Reef', u: '', x: 0, p: 0, k: [], a: [] }).includes('Not a credential'), 'shared text carries the disclaimer')
check(decodeShare('nope') === null, 'bad share links are ignored')

const fresh = createSave()
check(fresh.signedUp === false && fresh.name === '' && fresh.username === '', 'a new save waits for a name and a username')
check(cleanDisplayName('  Reef   Lane ') === 'Reef Lane', 'a display name keeps spaces and trims')
check(cleanUsername('Reef_01') === 'reef_01' && cleanUsername('ab') === '' && cleanUsername('!!!') === '', 'a username is 3 to 16 letters, numbers, or underscores')

const junk = hydrate({ v: 1, xp: -40, ledger: -5, body: 'punk', username: '  ', name: '   ' })
check(junk.xp === 0 && junk.ledger === 0 && junk.body === 'shrimp' && junk.username === '' && junk.name === '' && junk.signedUp === false, 'hydrate refuses a broken save')
const oldName = hydrate({ v: 1, username: 'Player 8453', name: 'Player 8453' })
check(oldName.signedUp === false && oldName.username === '' && oldName.name === '', 'an old save without signup is not signed in')
const signed = hydrate({ v: 1, signedUp: true, name: 'Reef', username: 'Reef_01' })
check(signed.signedUp && signed.name === 'Reef' && signed.username === 'reef_01', 'signup keeps the name and the handle')
check(hydrate({ v: 1, signedUp: true, name: '', username: 'reef' }).signedUp === false, 'signup needs both a name and a username')
check(hydrate({ v: 1, privyId: 'did:privy:cldistrict01' }).privyId === 'did:privy:cldistrict01', 'a save keeps a privy id')
const linkedSave = hydrate({ v: 1, nearAccountId: 'MarketUser.near', ledger: 37.5 })
check(linkedSave.nearAccountId === 'marketuser.near' && linkedSave.ledger === 37.5, 'a NEAR link is normalized without changing an existing practice balance')
check(cleanNearAccountId('too..many') === '' && cleanNearAccountId('fake account') === '', 'NEAR account IDs reject malformed input')
check(hydrate({ v: 1, privyId: 'privy_app_secret_nope' }).privyId === '', 'a save ignores anything that is not a privy id')
check(hydrate({ v: 2 }).username === '' && hydrate({ v: 2 }).signedUp === false, 'unknown save versions start unsigned')
check(hydrate({ v: 2 }).body === 'player', 'a fresh city starts in the low-poly suit')
check(cleanMask('azuki') === 'azuki' && cleanMask('bayc') === 'none', 'masks accept the city list')
check(cleanDrone('scout') === 'scout' && cleanDrone('solana') === 'none', 'drones accept scout, courier, and halo')
check(cleanOwnedDrones(['scout', 'scout', 'nope']).join() === 'scout', 'owned drones stay unique')
const boughtDrone = quoteDrone(40, [], 'courier')
check(boughtDrone.ok && boughtDrone.ok && boughtDrone.ledger === 8 && boughtDrone.spent === 32, 'courier costs 32 practice')
check(!quoteDrone(10, [], 'scout').ok, 'a short ledger leaves the drone on the shelf')
const ownedDrone = quoteDrone(10, ['scout'], 'scout')
check(ownedDrone.ok && ownedDrone.already, 'an owned drone equips without another charge')
const geared = hydrate({ v: 1, mask: 'punk', drone: 'halo', ownedDrones: ['halo'], body: 'zuri' })
check(geared.mask === 'punk' && geared.drone === 'halo' && geared.body === 'zuri', 'a save keeps the woman, her mask, and a drone she owns')
check(hydrate({ v: 1, drone: 'halo', ownedDrones: [] }).drone === 'none', 'a drone that was never bought does not fly')

const pos = { x: 0.2, z: 0 }
const vel = { x: 1, z: 0 }
const obstacles: Obstacle[] = [{ kind: 'circle', x: 0, z: 0, r: 1 }]
resolveCollision(pos, vel, obstacles, 0.4)
check(Math.hypot(pos.x, pos.z) >= 1.39, 'a circle pushes the player out')
const inside = { x: 0, z: 0 }
const insideVel = { x: 0, z: 0 }
resolveCollision(inside, insideVel, [{ kind: 'box', x: 0, z: 0, hx: 2, hz: 2 }], 0.4)
check(Math.abs(inside.x) > 2 || Math.abs(inside.z) > 2, 'a box ejects a player stuck inside')
check(blocked([{ kind: 'circle', x: 0, z: 0, r: 1 }], 0, 0, 0.4), 'spawn check sees the fountain')

if (failed) throw new Error(`${failed} checks failed`)
console.log('logic checks passed')
