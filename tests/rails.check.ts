// Optional top-up rails (Solana Pay, NEAR Intents / 1Click): signature checks, payment checks, one-time credit, routes.
// No network, no money. The 1Click fixture is a real signed quote + status (nobody paid it).
import { readFileSync } from 'node:fs'
import {
  b58encode, b58decode, stableStringify, verifyQuoteSignature, checkIntentsQuote, intentsCredit, usdToLamports, lamportsLabel, solanaPayUrl,
  checkSolanaPayment, validRefund, USDC_NEAR, USDC_SOL_MINT, type QuoteResponse, type SolTx,
} from '../api/_rails.ts'

let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }
const fx = JSON.parse(readFileSync(new URL('./fixtures/oneclick-quote-status.json', import.meta.url), 'utf8')) as { quote: QuoteResponse; status: { status: string; quoteResponse: QuoteResponse; swapDetails: Record<string, unknown> } }
const Q = fx.quote, DEP = String(Q.quote.depositAddress), REFUND = String(Q.quoteRequest.refundTo), R = 'grinddistrict.near'

// Encoding
const bytes = Uint8Array.from([0, 0, 1, 2, 255, 7])
ok(b58encode(b58decode('11Ldp')) === '11Ldp' && b58encode(bytes) === b58encode(b58decode(b58encode(bytes))), 'base58 round trip (leading zeros kept)')
ok(stableStringify({ b: 1, a: [1, undefined, { d: 'x', c: null }], u: undefined }) === '{"a":[1,null,{"c":null,"d":"x"}],"b":1}', 'stable stringify like json-stable-stringify')
ok(validRefund('sol', REFUND) && validRefund('evm', '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913') && validRefund('btc', 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq') && !validRefund('sol', '0xabc') && !validRefund('evm', 'abc'), 'refund address formats')

// 1Click signatures (real quote)
ok(verifyQuoteSignature(Q), 'real 1Click quote signature verifies')
ok(verifyQuoteSignature(fx.status.quoteResponse), 'quote inside /v0/status verifies')
const t1 = structuredClone(Q); t1.quote.amountOut = '6000000'
const t2 = structuredClone(Q); t2.quoteRequest.recipient = 'attacker.near'
const t3 = structuredClone(Q); t3.quote.depositAddress = 'So11111111111111111111111111111111111111112'
ok(!verifyQuoteSignature(t1) && !verifyQuoteSignature(t2) && !verifyQuoteSignature(t3), 'tampered amount / recipient / deposit address refused')
ok(!verifyQuoteSignature(Q, 'ed25519:11111111111111111111111111111111'), 'wrong signer key refused')
const want = { originAsset: 'nep141:sol.omft.near', usdMicro: 5_000_000n, refundTo: REFUND, recipient: R, dry: false }
ok(checkIntentsQuote(Q, want).ok, 'quote matches the order')
ok(!checkIntentsQuote(Q, { ...want, recipient: 'other.near' }).ok && !checkIntentsQuote(Q, { ...want, usdMicro: 6_000_000n }).ok && !checkIntentsQuote(Q, { ...want, refundTo: '0x' + '1'.repeat(40) }).ok, 'mismatched receiver / amount / refund refused')
ok(Q.quoteRequest.destinationAsset === USDC_NEAR && Q.quoteRequest.recipientType === 'INTENTS', 'pays USDC into the NEAR Intents balance')

// Status -> credit
const order = { ref: DEP, usdMicro: 5_000_000n, recipient: R }
const st = (status: string, amountOut: string | null, qr = fx.status.quoteResponse) => ({ status, quoteResponse: qr, swapDetails: { ...fx.status.swapDetails, amountOut } as never })
ok(intentsCredit(st('PENDING_DEPOSIT', null), order).ok === false && (intentsCredit(st('PROCESSING', null), order) as { waiting?: boolean }).waiting === true, 'pending / processing wait')
const c = intentsCredit(st('SUCCESS', '5000000'), order)
ok(c.ok && c.usdMicro === 5_000_000n && c.fee === 100_000n && c.credit === 4_900_000n, 'SUCCESS $5 -> $4.90 after 2%')
const more = intentsCredit(st('SUCCESS', '9000000'), order), less = intentsCredit(st('SUCCESS', '4000000'), order)
ok(more.ok && more.usdMicro === 5_000_000n && less.ok && less.usdMicro === 4_000_000n, 'credits what arrived, never above the order')
ok(!intentsCredit(st('SUCCESS', '5000000'), { ...order, ref: 'otherDeposit11111111' }).ok, 'status for another deposit address refused')
ok(!intentsCredit(st('SUCCESS', '5000000', t1), order).ok, 'status with a forged quote refused')
const rf = intentsCredit(st('REFUNDED', null), order)
ok(!rf.ok && !rf.waiting && /refunded/.test(rf.error), 'refunded payment is not credited')

// Solana Pay
ok(usdToLamports(5_000_000n, 15_000_000_000n) === 33_334_000n && lamportsLabel(33_334_000n) === '0.033334', '$5 at $150 = 0.033334 SOL (rounded up)')
const REF = b58encode(new Uint8Array(32).fill(7)), RCV = b58encode(new Uint8Array(32).fill(9)), PAYER = b58encode(new Uint8Array(32).fill(3))
const url = solanaPayUrl({ recipient: RCV, asset: 'USDC', amountRaw: 5_000_000n, reference: REF, mint: USDC_SOL_MINT })
ok(url.startsWith(`solana:${RCV}?amount=5.00&reference=${REF}`) && url.includes(`spl-token=${USDC_SOL_MINT}`) && !url.includes('+'), 'Solana Pay URL (USDC)')
const solTx = (o: { delta?: number; ref?: boolean; err?: unknown; usdc?: [string, string] }): SolTx => ({
  blockTime: Math.floor(Date.now() / 1000),
  meta: { err: o.err ?? null, preBalances: [1e9, 5000, 1], postBalances: [1e9 - (o.delta ?? 0) - 5000, 5000 + (o.delta ?? 0), 1],
    preTokenBalances: o.usdc ? [{ accountIndex: 3, mint: USDC_SOL_MINT, owner: RCV, uiTokenAmount: { amount: o.usdc[0] } }] : [],
    postTokenBalances: o.usdc ? [{ accountIndex: 3, mint: USDC_SOL_MINT, owner: RCV, uiTokenAmount: { amount: o.usdc[1] } }] : [] },
  transaction: { signatures: ['5'.repeat(88)], message: { accountKeys: [{ pubkey: PAYER }, { pubkey: RCV }, ...(o.ref === false ? [] : [{ pubkey: REF }])] } },
})
const w = { receiver: RCV, reference: REF, asset: 'SOL' as const, amountRaw: 33_334_000n, mint: USDC_SOL_MINT }
const g = checkSolanaPayment(solTx({ delta: 33_334_000 }), w)
ok(g.ok && g.payer === PAYER, 'SOL payment with reference and exact amount')
ok(!checkSolanaPayment(solTx({ delta: 33_333_000 }), w).ok && !checkSolanaPayment(solTx({ delta: 33_334_000, ref: false }), w).ok && !checkSolanaPayment(solTx({ delta: 33_334_000, err: { x: 1 } }), w).ok, 'wrong amount / no reference / failed tx refused')
const wu = { ...w, asset: 'USDC' as const, amountRaw: 5_000_000n }
ok(checkSolanaPayment(solTx({ usdc: ['0', '5000000'] }), wu).ok && checkSolanaPayment(solTx({ usdc: ['1000000', '6000000'] }), wu).ok, 'USDC payment (new or existing token account)')
ok(!checkSolanaPayment(solTx({ usdc: ['0', '4990000'] }), wu).ok && !checkSolanaPayment(solTx({ usdc: ['0', '5000000'] }), { ...wu, mint: 'Fake1111111111111111111111111111111111111111' }).ok, 'short USDC / other mint refused')

// Routes (fake DB): off without env, then create / scan / credit once / sync
const { railsRoute } = await import('../api/_railsRoute.ts')
type Row = Record<string, unknown>
const tables: Record<string, Row[]> = { rail_topups: [], rail_topup_orders: [] }
const q = (t: string) => {
  const f: Array<[string, unknown]> = []; let patch: Row | null = null
  const rowsOf = () => tables[t]!.filter((r) => f.every(([k, v]) => r[k] === v))
  const b: any = {
    select: () => b, order: () => b, limit: () => b, eq: (k: string, v: unknown) => { f.push([k, v]); return b },
    insert: (r: Row) => {
      const row: Row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), status: t === 'rail_topups' ? 'credited' : 'waiting', ...r }
      if (tables[t]!.some((x) => x.id === row.id || (t === 'rail_topup_orders' && x.ref === row.ref))) return Object.assign(Promise.resolve({ error: { message: 'dup' } }), { select: () => ({ single: async () => ({ data: null, error: { message: 'dup' } }) }) })
      tables[t]!.push(row); return Object.assign(Promise.resolve({ error: null }), { select: () => ({ single: async () => ({ data: { ...row, amount_text: String(row.amount_raw) }, error: null }) }) })
    },
    update: (p: Row) => { patch = p; return b },
    maybeSingle: async () => { const r = rowsOf()[0]; return { data: r ? { ...r, amount_text: String(r.amount_raw) } : null, error: null } },
    then: (res: (v: unknown) => void) => { if (patch) { for (const r of rowsOf()) Object.assign(r, patch); return res({ error: null }) } return res({ data: rowsOf(), error: null }) },
  }
  return b
}
const db = { from: q } as never
const out = () => { const o = { code: 0, body: {} as Record<string, unknown> }; return { o, res: { status: (n: number) => ({ json: (b: unknown) => { o.code = n; o.body = b as Record<string, unknown> } }) } } }
let stage = 'PENDING_DEPOSIT', amountOut: string | null = null
const deps = {
  intents: { quote: async () => structuredClone(Q), status: async () => st(stage, amountOut), submit: async () => ({}) },
  sol: { price: async () => 15_000_000_000n, signaturesFor: async () => [{ signature: '5'.repeat(88), err: null }], tx: async () => solTxNow },
}
let solTx0: SolTx | null = null; let solTxNow: SolTx | null = null
delete process.env.INTENTS_TOPUP_ACCOUNT; delete process.env.SOLANA_TOPUP_ADDRESS
let x = out(); await railsRoute({ method: 'POST', body: { op: 'intents-create' } }, x.res, db, null, deps)
ok(x.o.code === 503, 'NEAR Intents off without INTENTS_TOPUP_ACCOUNT')
x = out(); await railsRoute({ method: 'POST', body: { op: 'sol-create' } }, x.res, db, null, deps)
ok(x.o.code === 503, 'Solana off without SOLANA_TOPUP_ADDRESS')
x = out(); await railsRoute({ method: 'GET', query: { rails: '-config' } }, x.res, db, null, deps)
ok(x.o.code === 200 && x.o.body.intents === null && x.o.body.solana === null, 'config says both off')

process.env.INTENTS_TOPUP_ACCOUNT = R; process.env.SOLANA_TOPUP_ADDRESS = RCV
x = out(); await railsRoute({ method: 'POST', body: { op: 'intents-create', asset: 'nep141:sol.omft.near', dollars: 5, refundTo: 'nope' } }, x.res, db, null, deps)
ok(x.o.code === 400, 'bad refund address refused')
x = out(); await railsRoute({ method: 'POST', body: { op: 'intents-create', asset: 'nep141:sol.omft.near', dollars: 5, refundTo: REFUND } }, x.res, db, 'did:privy:t', deps)
ok(x.o.code === 200 && x.o.body.depositAddress === DEP && /SOL$/.test(String(x.o.body.amountLabel)), 'intents order: deposit address + SOL amount')
const iid = String(x.o.body.orderId)
x = out(); await railsRoute({ method: 'POST', body: { op: 'intents-scan', orderId: iid } }, x.res, db, null, deps)
ok(x.o.code === 200 && x.o.body.waiting === true, 'waiting before deposit')
stage = 'SUCCESS'; amountOut = '5000000'
x = out(); await railsRoute({ method: 'POST', body: { op: 'intents-scan', orderId: iid } }, x.res, db, null, deps)
ok(x.o.code === 200 && x.o.body.creditUsd === 4.9 && x.o.body.hash === `intents:${DEP}`, 'credited $4.90 on SUCCESS')
x = out(); await railsRoute({ method: 'POST', body: { op: 'intents-scan', orderId: iid } }, x.res, db, null, deps)
ok(x.o.body.already === true && tables.rail_topups!.length === 1, 'second scan does not credit again')

x = out(); await railsRoute({ method: 'POST', body: { op: 'sol-create', asset: 'SOL', dollars: 5, payer: PAYER } }, x.res, db, null, deps)
ok(x.o.code === 200 && x.o.body.amountLabel === '0.033334 SOL' && String(x.o.body.payUrl).startsWith(`solana:${RCV}?amount=0.033334&reference=`), 'Solana order: exact SOL + pay link')
const sid = String(x.o.body.orderId), sref = String(x.o.body.reference)
solTx0 = solTx({ delta: 33_334_000 }); (solTx0.transaction!.message!.accountKeys as Array<{ pubkey: string }>)[2] = { pubkey: sref }
x = out(); await railsRoute({ method: 'POST', body: { op: 'sol-scan', orderId: sid } }, x.res, db, null, deps)
ok(x.o.body.waiting === true, 'waiting before payment')
solTxNow = solTx0
x = out(); await railsRoute({ method: 'POST', body: { op: 'sol-scan', orderId: sid } }, x.res, db, null, deps)
ok(x.o.code === 200 && x.o.body.creditUsd === 4.9, 'Solana payment credited $4.90')
x = out(); await railsRoute({ method: 'POST', body: { op: 'sol-create', asset: 'SOL', dollars: 5, payer: PAYER } }, x.res, db, null, deps)
const sid2 = String(x.o.body.orderId)
x = out(); await railsRoute({ method: 'POST', body: { op: 'sol-scan', orderId: sid2, signature: '5'.repeat(88) } }, x.res, db, null, deps)
ok(x.o.code === 400 && tables.rail_topups!.length === 2, 'same payment cannot pay a second order (reference differs)')
x = out(); await railsRoute({ method: 'GET', query: { rails: PAYER } }, x.res, db, null, deps)
ok(x.o.code === 200 && (x.o.body.topups as unknown[]).length === 1, 'sync lists the payer\'s credited top-ups')

console.log(`rails: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
