import { COURSES, everySkillHasCourse, grade, courseById } from './courses.ts'
import {
  buyHolding,
  createSave,
  dayDiff,
  decodeShare,
  documents,
  encodeShare,
  hydrate,
  lagosDay,
  markDaily,
  cleanDrone,
  cleanMask,
  cleanOwnedDrones,
  quoteDrone,
  rankFor,
  seasonAt,
  sellHolding,
  sharedText,
} from './logic.ts'
import { blocked, resolveCollision, type Obstacle } from './physics.ts'

let failed = 0

function check(condition: boolean, message: string): void {
  if (condition) return
  failed += 1
  console.error(message)
}

check(everySkillHasCourse(), 'every skill needs one course')
const spot = courseById('spot')
check(!!spot, 'spot course exists')
check(COURSES.every((course) => course.paragraphs.length >= 4 && course.questions.length === 4), 'each course has a lesson and four exercises')
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

check(dayDiff('2026-10-30', '2026-10-31') === 1, 'next calendar day')
check(dayDiff('2026-10-30', '2026-11-01') === 2, 'across the month')
check(lagosDay(new Date('2026-10-29T23:30:00Z')) === '2026-10-30', 'Lagos is ahead of that UTC instant')
check(seasonAt(0) === 'bull' && seasonAt(360000) === 'bear', 'seasons alternate every six minutes')

const save = createSave(new Date('2026-10-30T12:00:00Z'))
const first = markDaily(save, '2026-10-30', 'lesson')
check(first === 5 && save.streak === 1, 'first rep starts a streak and pays 5')
const second = markDaily(save, '2026-10-30', 'gym')
check(second === 0 && save.streak === 1 && save.dailies.gym, 'second rep the same day does not restack the streak')
const next = markDaily(save, '2026-10-31', 'cafe')
check(next === 10 && save.streak === 2, 'the next Lagos day extends the streak')
const skipped = markDaily(save, '2026-11-02', 'bounty')
check(skipped === 5 && save.streak === 1, 'a missed day starts the streak over')

save.skills.spot = { passed: true, tries: 1 }
save.username = 'Adaeze'
const docs = documents(save, new Date('2026-10-30T12:00:00Z'))
check(docs.cv.includes('Not a credential') && docs.cv.includes('Spot trading') && docs.resume.includes('Adaeze'), 'documents name the work and the disclaimer')
check(!docs.cv.includes('<script>'), 'documents stay plain text')

const round = decodeShare(encodeShare(save))
check(round?.n === 'Adaeze' && round.k.includes('spot') && round.x === save.xp, 'share link round-trips')
check(sharedText(round ?? { n: 'Shrimp', x: 0, p: 0, s: 0, k: [], a: [] }).includes('Not a credential'), 'shared text carries the disclaimer')
check(decodeShare('nope') === null, 'bad share links are ignored')

const junk = hydrate({ v: 1, xp: -40, ledger: -5, body: 'punk', username: '  ' })
check(junk.xp === 0 && junk.ledger === 0 && junk.body === 'shrimp' && junk.username === 'Shrimp', 'hydrate refuses a broken save')
check(hydrate({ v: 2 }).username === 'Player 8453', 'unknown save versions start clean')
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
check(geared.mask === 'punk' && geared.drone === 'halo' && geared.body === 'zuri', 'a save keeps Zuri, her mask, and a drone she owns')
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
