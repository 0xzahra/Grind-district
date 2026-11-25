// Grind Bank numbers: ETF NAV, fee drag, premium bounds, buying and selling; halal savings profit-sharing.
import assert from 'node:assert/strict'
import { FUNDS, LAUNCH, nav, premium, sharePrice, buy, sell, poolResult, settle, emptySavings, SAVER_SHARE } from '../src/bankCore.ts'

let pass = 0, fail = 0
const t = (name: string, fn: () => void) => { try { fn(); pass++; console.log('  ok', name) } catch (e) { fail++; console.log('  FAIL', name, (e as Error).message) } }
const btc = FUNDS[0]!

t('NAV at launch is the coin each share holds', () => { assert.equal(nav(btc, 100_000, LAUNCH), 50) })
t('the expense ratio takes about 0.25% over a year', () => {
  const a = nav(btc, 100_000, LAUNCH + 365.25 * 864e5)
  assert.ok(Math.abs(a - 50 * 0.9975) < 1e-9, String(a))
})
t('premium stays within about ±0.35%', () => { for (let i = 0; i < 5000; i++) assert.ok(Math.abs(premium(btc, LAUNCH + i * 7_919_000)) <= 0.0036) })
t('share price is NAV with the premium, in cents', () => {
  const now = LAUNCH + 1e9, p = sharePrice(btc, 90_000, now)
  assert.ok(Math.abs(p - nav(btc, 90_000, now) * (1 + premium(btc, now))) < 0.006)
})
t('buying and selling keep cost basis in step', () => {
  const b = buy({}, 'gbtx', 100, 40)
  assert.equal(b.shares, 2.5)
  assert.deepEqual(b.h.gbtx, { shares: 2.5, cost: 100 })
  const s = sell(b.h, 'gbtx', 1, 50)
  assert.equal(s.usd, 50); assert.deepEqual(s.h.gbtx, { shares: 1.5, cost: 60 })
  const all = sell(s.h, 'gbtx', 9, 50)
  assert.equal(all.shares, 1.5); assert.equal(all.h.gbtx, undefined)
})
t('nothing to buy with nothing', () => { assert.equal(buy({}, 'geth', 0, 30).shares, 0); assert.equal(sell({}, 'geth', 1, 30).usd, 0) })
t('pool results are small, mostly positive and fixed by the date', () => {
  let pos = 0
  for (let d = 0; d < 365; d++) { const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10); const r = poolResult(day); assert.ok(r >= -0.0003 && r < 0.0009, `${day} ${r}`); if (r > 0) pos++; assert.equal(poolResult(day), r) }
  assert.ok(pos > 240, String(pos))
})
t('profit is shared 60:40, losses fall on capital', () => {
  const s = { ...emptySavings('2026-03-01'), balance: 1000 }
  const r = settle(s, '2026-03-02'), pool = poolResult('2026-03-01')
  const want = Math.round((pool > 0 ? 1000 * pool * SAVER_SHARE : 1000 * pool) * 100) / 100
  assert.equal(r.balance, Math.round((1000 + want) * 100) / 100)
  assert.equal(r.day, '2026-03-02')
})
t('settling catches up missed days, at most 60', () => {
  const r = settle({ ...emptySavings('2025-01-01'), balance: 500 }, '2026-01-01')
  assert.equal(r.day, '2026-01-01'); assert.ok(r.log.length <= 30)
  assert.ok(r.balance > 495 && r.balance < 520, String(r.balance))
})
t('an empty account earns nothing', () => { assert.equal(settle(emptySavings('2026-01-01'), '2026-02-01').balance, 0) })
console.log(`bank: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
