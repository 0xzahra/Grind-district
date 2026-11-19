// The Pitch (src/pitchCore.ts): a new coin each day, eight red flags, a pump that always ends in a rug a little
// after you buy, and walking away paying the most reputation.
import { COINS, coinOfDay, dayIndex, pitchLines, PITCH_FLAGS, QUESTIONS, ALL_FLAGS, STAKES, rugTime, priceAt, reputationFor } from '../src/pitchCore.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }

// Coins rotate by day, wrap round, and never repeat on consecutive days.
check(coinOfDay(0) === COINS[0] && coinOfDay(COINS.length) === COINS[0], 'coin rotation wraps')
check(coinOfDay(-1) === COINS[COINS.length - 1], 'negative day still picks a coin')
for (let d = 0; d < 30; d++) check(coinOfDay(d) !== coinOfDay(d + 1), `day ${d} and ${d + 1} differ`)
check(dayIndex(86_400_000 * 3 + 5) === 3, 'day index from a timestamp')
check(new Set(COINS.map((c) => c.sym)).size === COINS.length, 'symbols unique')

// The pitch names the coin; every flag has words; ids are unique.
check(pitchLines(COINS[2]!).some((l) => l.includes(COINS[2]!.name)), 'pitch names the coin')
check(ALL_FLAGS === 8 && PITCH_FLAGS.length === 3 && QUESTIONS.length === 5, `eight flags (got ${ALL_FLAGS})`)
const ids = [...PITCH_FLAGS, ...QUESTIONS].map((f) => f.id)
check(new Set(ids).size === ids.length, 'flag ids unique')
for (const f of [...PITCH_FLAGS, ...QUESTIONS]) check(f.flag.length > 3 && f.why.length > 20, `${f.id} has a flag and a reason`)
for (const q of QUESTIONS) check(q.ask.endsWith('?') && q.answer.length > 5, `${q.id} has a question and an answer`)
check(QUESTIONS.some((q) => /honeypot/i.test(q.why)), 'the sell question teaches the honeypot')
check(QUESTIONS.some((q) => /liquidity/i.test(q.flag)), 'liquidity lock is one of the questions')

// Nothing real: small practice stakes only.
check(STAKES.every((s) => s > 0 && s <= 100), 'practice stakes are small')

// The rug lands 13 to 19 s after buying, whatever the seed.
for (const seed of [0, 1, 17.5, 1234.567, 98765.4321, -3]) { const r = rugTime(seed); check(r >= 13 && r <= 19, `rug time ${r.toFixed(2)} in range`) }

// The pump: up while it lasts, then all but zero.
const rugAt = 15
check(priceAt(0, rugAt) >= 0.85 && priceAt(0, rugAt) <= 1.1, `starts near the buy price (${priceAt(0, rugAt).toFixed(3)})`)
check(priceAt(10, rugAt) > 2, `pumps by 10 s (${priceAt(10, rugAt).toFixed(3)})`)
check(priceAt(14.9, rugAt) > priceAt(3, rugAt), 'higher before the rug than early on')
for (let t = 0; t < rugAt; t += 0.1) if (priceAt(t, rugAt) < 0.85) { check(false, `never below 0.85 before the rug (t=${t})`); break }
check(priceAt(rugAt + 0.6, rugAt) < priceAt(rugAt - 0.01, rugAt), 'falls once the rug starts')
check(priceAt(rugAt + 1.2, rugAt) < 0.01 && priceAt(rugAt + 30, rugAt) < 0.01, 'all but zero after the rug')
check(priceAt(-1, rugAt) > 0, 'no negative price before buying')

// Reputation: walking away is the win, more so after asking questions; a rug still teaches something.
check(reputationFor('walked', 5) === 5 && reputationFor('walked', 3) === 5, 'walked after 3+ questions: 5')
check(reputationFor('walked', 0) === 3, 'walked straight away: 3')
check(reputationFor('rugged', 5) === 1 && reputationFor('rugged', 0) === 1, 'rugged: 1')
check(reputationFor('walked', 0) > reputationFor('rugged', 5), 'walking away always beats buying')

console.log(`pitch: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
