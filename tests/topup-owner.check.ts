// Base top-up orders belong to whoever proved the paying wallet, and a payment is credited to that order's owner
// only. Real handler (api/topup-confirm.ts) with an in-memory database, a stub chain check and a throwaway key.
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { verifyMessage } from 'viem'
import { payerMessage, provePayer, PROOF_MAX_AGE_MS } from '../api/_payerProof.ts'
import handler, { proofDeps, testHooks } from '../api/topup-confirm.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }

// ---- in-memory Supabase (only what the handler uses) ----
type Row = Record<string, any>
const tables: Record<string, Row[]> = { topup_orders: [], topups: [] }
let seq = 0
function q(table: string) {
  const rows = () => (tables[table] ??= [])
  const filters: Array<(r: Row) => boolean> = []
  let mode: 'select' | 'update' | 'insert' = 'select', patch: Row = {}, ins: Row | null = null, lim = Infinity
  const api: any = {
    select() { return api }, eq(k: string, v: unknown) { filters.push((r) => r[k] === v); return api },
    neq(k: string, v: unknown) { filters.push((r) => r[k] !== v); return api }, in(k: string, v: unknown[]) { filters.push((r) => v.includes(r[k])); return api },
    is(k: string, v: unknown) { filters.push((r) => (r[k] ?? null) === v); return api }, limit(n: number) { lim = n; return api },
    order() { return api },
    update(p: Row) { mode = 'update'; patch = p; return api }, insert(r: Row) { mode = 'insert'; ins = r; return api },
    async run() {
      if (mode === 'insert') {
        const r = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, created_at: new Date(Date.now() - 1000 * (100 - seq)).toISOString(), ...ins }
        if (table === 'topups' && rows().some((x) => x.tx_hash === r.tx_hash)) return { data: null, error: { code: '23505' } }
        rows().push(r); return { data: r, error: null }
      }
      const hit = rows().filter((r) => filters.every((f) => f(r))).slice(0, lim)
      if (mode === 'update') {
        if (patch.tx_hash && table === 'topup_orders' && rows().some((x) => x.tx_hash === patch.tx_hash && !hit.includes(x))) return { data: null, error: { code: '23505' } }
        hit.forEach((r) => Object.assign(r, patch)); return { data: hit, error: null }
      }
      return { data: hit, error: null }
    },
    async single() { const r = await api.run(); return { data: Array.isArray(r.data) ? r.data[0] ?? null : r.data, error: r.error } },
    async maybeSingle() { return api.single() },
    then(res: any, rej: any) { return api.run().then(res, rej) },
  }
  return api
}
testHooks.db = { from: (t: string) => q(t) } as never

// ---- players, wallets, auth, chain stub ----
const adaKey = generatePrivateKey(), bolaKey = generatePrivateKey()
const ada = privateKeyToAccount(adaKey), bola = privateKeyToAccount(bolaKey)
const ADA = ada.address.toLowerCase(), BOLA = bola.address.toLowerCase()
const GAME = '0x' + '1'.repeat(40)
const linked: Record<string, string[]> = { 'did:ada': [GAME], 'did:bola': [] }
proofDeps.linked = async (u) => linked[u] ?? []
proofDeps.verify = (address, message, signature) => verifyMessage({ address: address as `0x${string}`, message, signature: signature as `0x${string}` })
testHooks.auth = async (h) => (h.authorization ?? '').replace('Bearer ', '') || null
process.env.GRIND_OPERATOR_KEY = '0x' + 'ab'.repeat(32) // only checked for presence; the chain step is stubbed
const paid: Record<string, string> = {} // tx hash -> real payer
testHooks.confirm = async (o) => {
  if (paid[o.hash] !== (o.from ?? '').toLowerCase()) return { ok: false, code: 403, error: 'sender does not match the address you entered' }
  const prior = await o.store.get(o.hash)
  if (prior?.status === 'credited') return { ok: true, already: true, player: o.from as never, asset: 'USDC', paid: '5000000', feeUsd: 0.1, creditUsd: 4.9 }
  if (!(await o.store.claim({ tx_hash: o.hash, player: o.from, privy_user_id: o.userId ?? null, status: 'credited', credit_micro: '4900000' }))) return { ok: false, code: 409, error: 'already being processed' }
  return { ok: true, already: false, player: o.from as never, asset: 'USDC', paid: '5000000', feeUsd: 0.1, creditUsd: 4.9 }
}
async function call(user: string | null, body: Record<string, unknown>) {
  let code = 0, out: any = null
  await handler({ method: 'POST', body, headers: user ? { authorization: `Bearer ${user}` } : {} }, { status(n: number) { code = n; return { json(b: unknown) { out = b } } } })
  return { code, out }
}

// ---- provePayer ----
const now = Date.now()
ok((await provePayer(GAME, 'did:ada', undefined, undefined, proofDeps)).ok, 'linked game wallet: no signature needed')
const ask = await provePayer(ADA, 'did:ada', undefined, undefined, proofDeps)
ok(!ask.ok && ask.needSignature && ask.message.includes(ADA), 'unlinked wallet: asked to sign a message naming it')
const sigAda = await ada.signMessage({ message: payerMessage(ADA, 'did:ada', now) })
ok((await provePayer(ADA, 'did:ada', sigAda, now, proofDeps)).ok, 'the wallet\'s own signature proves it')
ok(!(await provePayer(ADA, 'did:bola', sigAda, now, proofDeps)).ok, 'a signature made for another account does not carry over')
const sigBola = await bola.signMessage({ message: payerMessage(ADA, 'did:bola', now) })
ok(!(await provePayer(ADA, 'did:bola', sigBola, now, proofDeps)).ok, 'another wallet cannot sign for Ada\'s address')
ok(!(await provePayer(ADA, 'did:ada', sigAda, now - PROOF_MAX_AGE_MS - 1000, proofDeps)).ok, 'an old confirmation expires')
const sigGuest = await ada.signMessage({ message: payerMessage(ADA, null, now) })
ok((await provePayer(ADA, null, sigGuest, now, proofDeps)).ok, 'guest with its own wallet signature still works')

// ---- an order for someone else's wallet ----
const pre = await call('did:bola', { op: 'create', asset: 'ETH', milliEth: 1, from: ADA })
ok(pre.code === 403 && pre.out.needSignature, 'another account cannot open an order for Ada\'s wallet')
const pre2 = await call('did:bola', { op: 'create', asset: 'ETH', milliEth: 1, from: ADA, sig: sigBola, issued: now })
ok(pre2.code === 403, 'Bola\'s signature over Ada\'s address is refused')
ok(tables.topup_orders!.length === 0, 'no order was stored for Bola')

// ---- Ada's normal flow: game wallet (linked) and a browser wallet (signed) ----
const g = await call('did:ada', { op: 'create', asset: 'USDC', dollars: 5, from: GAME })
ok(g.code === 200 && !!g.out.orderId, 'game wallet order opens with no extra step')
const b1 = await call('did:ada', { op: 'create', asset: 'USDC', dollars: 5, from: ADA })
ok(b1.code === 403 && b1.out.needSignature && typeof b1.out.issued === 'number', 'browser wallet: server asks for one signature')
const sig2 = await ada.signMessage({ message: b1.out.message })
const b2 = await call('did:ada', { op: 'create', asset: 'USDC', dollars: 5, from: ADA, sig: sig2, issued: b1.out.issued })
ok(b2.code === 200 && !!b2.out.orderId, 'browser wallet order opens after the signature')
const vOrder = tables.topup_orders!.find((o) => o.id === b2.out.orderId)!
ok(vOrder.privy_user_id === 'did:ada' && vOrder.player === ADA, 'order belongs to Ada and Ada\'s wallet')

// ---- confirming a payment without an order, or through someone else's order ----
const H = '0x' + 'c'.repeat(64); paid[H] = ADA
const race = await call('did:bola', { op: 'confirm', hash: H, from: ADA })
ok(race.code === 200 && tables.topups!.find((t) => t.tx_hash === H)?.privy_user_id === null, 'another account confirming Ada\'s payment first gets no credit for it')
const back = await call('did:ada', { op: 'confirm', hash: H, from: ADA, orderId: vOrder.id })
ok(back.code === 200 && tables.topups!.find((t) => t.tx_hash === H)?.privy_user_id === 'did:ada', 'Ada\'s own order then records that payment as hers')
vOrder.status = 'waiting'; vOrder.tx_hash = null
const H2 = '0x' + 'd'.repeat(64); paid[H2] = ADA
const race2 = await call('did:bola', { op: 'confirm', hash: H2, from: ADA, orderId: vOrder.id })
ok(race2.code === 200 && tables.topups!.find((t) => t.tx_hash === H2)?.privy_user_id === 'did:ada', 'confirming through Ada\'s order credits Ada, not the caller')
const again = await call('did:ada', { op: 'confirm', hash: H2, from: ADA, orderId: vOrder.id })
ok(again.code === 200 && again.out.already === true, 'same payment again: already credited, no second credit')
ok(tables.topups!.filter((t) => t.tx_hash === H2).length === 1, 'one credit row per payment')

// ---- one payment cannot fill two orders ----
const o3 = await call('did:bola', { op: 'create', asset: 'USDC', dollars: 5, from: BOLA, sig: await bola.signMessage({ message: payerMessage(BOLA, 'did:bola', now) }), issued: now })
ok(o3.code === 200, 'Bola can open an order for Bola\'s own wallet')
const other1 = await call('did:bola', { op: 'confirm', hash: H2, from: ADA, orderId: o3.out.orderId })
ok(other1.code === 403, 'an order for one wallet cannot be confirmed with another wallet\'s payment')
const other2 = await call('did:bola', { op: 'confirm', hash: H2, from: BOLA, orderId: o3.out.orderId })
ok(other2.code === 409 || other2.code === 403, 'a payment already on another order is refused')
const bolaRows = tables.topups!.filter((t) => t.privy_user_id === 'did:bola')
ok(bolaRows.length === 0, 'Bola ends with no credited top-ups')

// ---- a signed-in owner confirming their own linked wallet without an order still gets the credit ----
const H3 = '0x' + 'e'.repeat(64); paid[H3] = GAME
const own = await call('did:ada', { op: 'confirm', hash: H3, from: GAME })
ok(own.code === 200 && tables.topups!.find((t) => t.tx_hash === H3)?.privy_user_id === 'did:ada', 'own linked wallet without an order: credited to the owner')

console.log(`topup owner: ${pass} ok, ${fail} failed`)
if (fail) process.exit(1)
