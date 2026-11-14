// NEAR mainnet top-up: transfer checks, pricing, one-time credit, routes. No network, no money.
import { readFileSync } from 'node:fs'
import { checkNearTransfer, confirmNearTopup, encodeNear, formatNear, nearToUsdMicro, isNearTxHash, isNearAccountId, type NearDeps, type NearTx } from '../api/_nearTopup.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }
const load = (f: string) => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), 'utf8')) as NearTx
const tx = load('near-transfer-tx.json')
const fc = load('near-functioncall-tx.json')
const H = 'MASi45ub7Qe4ZE36UT5G6cU4ud8Fhhe4deS4F3cw9KTA'
const R = 'grinddistrict.near', S = 'player.near'

// Amounts and price maths
ok(encodeNear(1) === 10n ** 24n && encodeNear(0.25) === 25n * 10n ** 22n, 'NEAR -> yocto')
ok(formatNear(10n ** 23n) === '0.1' && formatNear(15n * 10n ** 23n) === '1.5', 'format')
let threw = 0; for (const v of [0.05, 501, 1.234, NaN]) { try { encodeNear(v) } catch { threw++ } }
ok(threw === 4, 'rejects too small, too big, 3 decimals, NaN')
ok(nearToUsdMicro(10n ** 24n, 333_120_424n) === 3_331_204n, '1 NEAR at $3.33120424 = $3.331204')
ok(isNearTxHash(H) && !isNearTxHash('0x' + 'a'.repeat(64)) && isNearAccountId('grinddistrict.near') && !isNearAccountId('Bad..id'), 'id formats')

// Transfer checks (real mainnet transfer shape)
const good = checkNearTransfer(tx, { hash: H, sender: S, receiver: R })
ok(good.ok && good.yocto === 10n ** 23n, 'real transfer: 0.1 NEAR to the receiver from the sender')
ok(!checkNearTransfer(tx, { hash: H, sender: 'someone.near', receiver: R }).ok, 'wrong sender refused')
ok(!checkNearTransfer(tx, { hash: H, sender: S, receiver: 'other.near' }).ok, 'wrong receiver refused')
ok(!checkNearTransfer(tx, { hash: 'x'.repeat(44), sender: S, receiver: R }).ok, 'hash mismatch refused')
const fcr = checkNearTransfer(fc, { hash: fc.transaction!.hash!, sender: 'funder.near', receiver: 'near' })
ok(!fcr.ok && /plain NEAR transfer/.test(fcr.error), 'a function call (with deposit) is not a top-up')
const failedTx = JSON.parse(JSON.stringify(tx)) as NearTx; failedTx.receipts_outcome![0]!.outcome!.status = { Failure: { ActionError: {} } }
ok(!checkNearTransfer(failedTx, { hash: H, sender: S, receiver: R }).ok, 'failed (refunded) transfer refused')
ok(!checkNearTransfer(null, { hash: H, sender: S, receiver: R }).ok, 'missing tx refused')

// One-time credit with a store
const rows = new Map<string, Record<string, unknown>>()
const store = { get: async (h: string) => (rows.get(h) as never) ?? null, claim: async (r: Record<string, unknown>) => { if (rows.has(String(r.tx_hash))) return false; rows.set(String(r.tx_hash), r); return true } }
const blockMs = Date.parse('2026-11-14T12:19:00Z')
const deps = (over: Partial<NearDeps> = {}): NearDeps => ({ txStatus: async () => tx, blockTimeMs: async () => blockMs, price: async () => ({ price8: 333_120_424n, updatedAt: 0 }), store, ...over })
const r1 = await confirmNearTopup(deps(), { hash: H, sender: S, receiver: R, userId: 'did:privy:z', notBeforeMs: blockMs - 60_000 })
ok(r1.ok && !r1.already && Math.abs(r1.creditUsd - 0.326458) < 1e-6 && Math.abs(r1.feeUsd - 0.006662) < 1e-6, `credits $0.326458 after the 2% fee (${r1.ok ? r1.creditUsd : r1.error})`)
const r2 = await confirmNearTopup(deps({ price: async () => ({ price8: 999_000_000n, updatedAt: 0 }) }), { hash: H, sender: S, receiver: R, userId: null })
ok(r2.ok && r2.already && r2.creditUsd === (r1.ok ? r1.creditUsd : -1), 'second confirm: same credit, flagged already (price frozen)')
ok(rows.size === 1, 'one row per payment')
const r3 = await confirmNearTopup(deps(), { hash: H, sender: 'thief.near', receiver: R, userId: null })
ok(!r3.ok && r3.code === 409, 'another account cannot claim a used payment')
rows.clear()
const r4 = await confirmNearTopup(deps(), { hash: H, sender: S, receiver: R, userId: null, notBeforeMs: blockMs + 60_000 })
ok(!r4.ok && /before the top-up/.test(r4.error) && rows.size === 0, 'payment older than the order refused')
const r5 = await confirmNearTopup(deps({ price: async () => { throw new Error('NEAR price is stale') } }), { hash: H, sender: S, receiver: R, userId: null })
ok(!r5.ok && r5.code === 503 && rows.size === 0, 'stale price: nothing credited')
const tiny = JSON.parse(JSON.stringify(tx)) as NearTx; (tiny.transaction!.actions![0] as { Transfer: { deposit: string } }).Transfer.deposit = '1000000000000000000000'
const r6 = await confirmNearTopup(deps({ txStatus: async () => tiny }), { hash: H, sender: S, receiver: R, userId: null })
ok(!r6.ok && /too small/.test(r6.error), 'dust refused')

// Routes: off without the env, then create / confirm / sync
const { nearRoute } = await import('../api/_nearRoute.ts')
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = { near_topups: [], near_topup_orders: [] }
const q = (t: string) => {
  const f: Array<[string, unknown]> = []; let patch: Row | null = null; let ins: Row | null = null
  const rowsOf = () => tables[t]!.filter((r) => f.every(([k, v]) => (Array.isArray(v) ? v.includes(r[k]) : r[k] === v)))
  const b: any = {
    select: () => b, order: () => b, limit: () => b,
    eq: (k: string, v: unknown) => { f.push([k, v]); return b }, in: (k: string, v: unknown[]) => { f.push([k, v]); return b },
    insert: (r: Row) => { ins = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...r }; if (t === 'near_topups' && tables[t]!.some((x) => x.tx_hash === r.tx_hash)) return { error: { message: 'dup' }, select: () => ({ single: async () => ({ data: null, error: { message: 'dup' } }) }) }; tables[t]!.push(ins); return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => ({ data: ins, error: null }) }) }) },
    update: (p: Row) => { patch = p; return b },
    maybeSingle: async () => ({ data: rowsOf()[0] ?? null, error: null }),
    then: (res: (v: unknown) => void) => { if (patch) { for (const r of rowsOf()) Object.assign(r, patch); return res({ error: null }) } return res({ data: rowsOf(), error: null }) },
  }
  return b
}
const db = { from: q } as never
const out = () => { const o = { code: 0, body: {} as Record<string, unknown> }; return { o, res: { status: (n: number) => ({ json: (b: unknown) => { o.code = n; o.body = b as Record<string, unknown> } }) } } }
const routeDeps = (): NearDeps => ({ txStatus: async () => tx, blockTimeMs: async () => Date.now(), price: async () => ({ price8: 333_120_424n, updatedAt: 0 }), store: { get: async (h) => (tables.near_topups!.find((r) => r.tx_hash === h) as never) ?? null, claim: async (r) => { if (tables.near_topups!.some((x) => x.tx_hash === r.tx_hash)) return false; tables.near_topups!.push(r); return true } } })
delete process.env.NEAR_TOPUP_ACCOUNT
let x = out(); await nearRoute({ method: 'POST', body: { op: 'near-create', sender: S, near: 0.1 } }, x.res, db, null, routeDeps())
ok(x.o.code === 503, 'no NEAR_TOPUP_ACCOUNT: route is off (503)')
process.env.NEAR_TOPUP_ACCOUNT = R
x = out(); await nearRoute({ method: 'POST', body: { op: 'near-create', sender: S, near: 0.1 } }, x.res, db, 'did:privy:z', routeDeps())
const orderId = String(x.o.body.orderId)
ok(x.o.code === 200 && x.o.body.receiver === R && x.o.body.amountYocto === String(10n ** 23n) && x.o.body.amountLabel === '0.1 NEAR', 'order created with receiver + exact amount')
x = out(); await nearRoute({ method: 'POST', body: { op: 'near-create', sender: R, near: 1 } }, x.res, db, null, routeDeps())
ok(x.o.code === 400, 'cannot pay from the receiver itself')
x = out(); await nearRoute({ method: 'POST', body: { op: 'near-confirm', orderId, hash: H } }, x.res, db, null, routeDeps())
ok(x.o.code === 200 && x.o.body.ok === true && x.o.body.txHash === `near:${H}`, `confirm credits the order (${JSON.stringify(x.o.body).slice(0, 120)})`)
ok(tables.near_topup_orders![0]!.status === 'credited' && tables.near_topups!.length === 1, 'order marked credited, one payment row')
x = out(); await nearRoute({ method: 'POST', body: { op: 'near-create', sender: S, near: 0.1 } }, x.res, db, null, routeDeps())
const order2 = String(x.o.body.orderId)
x = out(); await nearRoute({ method: 'POST', body: { op: 'near-confirm', orderId: order2, hash: H } }, x.res, db, null, routeDeps())
ok(x.o.body.already === true && tables.near_topups!.length === 1, 'reusing the same payment for a second order credits nothing new')
x = out(); await nearRoute({ method: 'GET', query: { near: S } }, x.res, db, null, routeDeps())
const list = x.o.body.topups as Array<{ hash: string; credit: number }>
x = out(); await nearRoute({ method: 'GET', query: { near: '-price' } }, x.res, db, null, routeDeps())
ok(x.o.code === 200 && x.o.body.price8 === '333120424' && x.o.body.receiver === R, 'price endpoint')
ok(x.o.code === 200 && list.length === 1 && list[0]!.hash === `near:${H}` && list[0]!.credit > 0.32, 'sync lists the credited NEAR top-up')

console.log(`near-topup: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
