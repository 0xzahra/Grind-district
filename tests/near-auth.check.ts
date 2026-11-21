// NEAR sign-in checks (no network, no database): the signing key must belong to the account, challenges come
// from the server and work once, game sessions verify, and Messages tokens stop working when the secret changes.
import { generateKeyPairSync, createHash, sign as edSign, randomBytes } from 'node:crypto'
process.env.DM_SESSION_SECRET = randomBytes(32).toString('hex')
process.env.SUPABASE_URL = 'http://127.0.0.1:9'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-not-real'
const A = await import('../api/_nearAuth.ts')

const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const b58 = (b: Buffer) => { let n = BigInt('0x' + (b.toString('hex') || '0')), s = ''; while (n > 0n) { s = ALPH[Number(n % 58n)] + s; n /= 58n } for (const x of b) { if (x === 0) s = '1' + s; else break } return s }
const newKey = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const raw = (publicKey.export({ format: 'der', type: 'spki' }) as Buffer).subarray(12)
  return { privateKey, raw, pk: `ed25519:${b58(raw)}` }
}
type K = ReturnType<typeof newKey>
const proofFor = (accountId: string, k: K, nonceB64 = A.issueNearChallenge()!.nonce, at = Date.now()) => {
  const message = `Grind District login\n${at}\n${nonceB64}`
  const bytes = A.nep413Bytes(message, Buffer.from(nonceB64, 'base64'), A.NEAR_LOGIN_RECIPIENT, null)
  const signature = edSign(null, createHash('sha256').update(bytes).digest(), k.privateKey).toString('base64')
  return { accountId, publicKey: k.pk, signature, message, recipient: A.NEAR_LOGIN_RECIPIENT, nonce: nonceB64 }
}

// Fake chain + nonce store (installed as the defaults so route handlers use them too).
const owner = newKey(), fnKey = newKey(), stranger = newKey()
const chain: Record<string, Record<string, 'full' | 'other'>> = { 'player.testnet': { [owner.pk]: 'full', [fnKey.pk]: 'other' }, 'player.near': { [owner.pk]: 'full' } }
let rpcDown = false
const used = new Set<string>()
A.defaultNearDeps.keyKind = async (acc, pk) => rpcDown ? 'error' : chain[acc]?.[pk] ?? 'none'
A.defaultNearDeps.consumeNonce = async (n) => { const h = n.toString('hex'); if (used.has(h)) return false; used.add(h); return true }

let fails = 0
const expect = (name: string, cond: boolean) => { if (!cond) { fails++; console.error('FAIL - ' + name) } }
const ok = async (p: unknown) => (await A.verifyNearAuth(p)).ok

expect('fresh key not on the account is refused', !(await ok(proofFor('player.testnet', stranger))))
expect('function-call key is refused', !(await ok(proofFor('player.testnet', fnKey))))
expect('full-access key of the account is accepted (testnet)', await ok(proofFor('player.testnet', owner)))
expect('full-access key of the account is accepted (mainnet)', await ok(proofFor('player.near', owner)))
expect('owner key on a different account is refused', !(await ok(proofFor('someone.testnet', owner))))
const once = proofFor('player.testnet', owner)
expect('first use of a proof passes', await ok(once))
expect('same proof sent twice is refused', !(await ok(once)))
expect('client-made nonce is refused', !(await ok(proofFor('player.testnet', owner, randomBytes(32).toString('base64')))))
const old = A.issueNearChallenge(Date.now() - 11 * 60_000)!.nonce
expect('expired challenge is refused', !(await ok(proofFor('player.testnet', owner, old, Date.now()))))
const bad = proofFor('player.testnet', owner); bad.message = bad.message + ' '
expect('tampered message is refused', !(await ok(bad)))
rpcDown = true
expect('RPC down refuses (never fails open)', !(await ok(proofFor('player.testnet', owner))))
rpcDown = false
const implicitOwner = newKey(), implicitId = implicitOwner.raw.toString('hex')
expect('implicit account with its own key is accepted', await ok(proofFor(implicitId, implicitOwner)))
expect('implicit account with another key is refused', !(await ok(proofFor(implicitId, stranger))))

// Game session tokens.
const v = await A.verifyNearAuth(proofFor('player.testnet', owner))
const tok = v.ok ? v.session?.token : undefined
expect('a verified login returns a session', !!tok)
expect('session verifies', await ok({ session: tok }))
expect('tampered session is refused', !(await ok({ session: tok!.slice(0, -2) + (tok!.endsWith('AA') ? 'BB' : 'AA') })))
const forged = A.readNearSession(`gdns.${Buffer.from(JSON.stringify({ u: 'near:player.testnet', exp: Date.now() + 1e6 })).toString('base64url')}.x`)
expect('unsigned session is refused', forged === null)

// Route handlers: a login signed by an unknown key gets 401 on all three NEAR entry points.
type Out = { code: number; body: unknown }
const call = async (mod: string, req: Record<string, unknown>): Promise<Out> => {
  const h = (await import(mod)).default as (q: unknown, r: unknown) => Promise<void>
  const out: Out = { code: 0, body: null }
  const res = { status(n: number) { out.code = n; return { json(b: unknown) { out.body = b }, send(b: unknown) { out.body = b } } }, setHeader() {} }
  await h({ headers: {}, query: {}, ...req }, res)
  return out
}
const strangerBody = () => ({ near: proofFor('player.testnet', stranger) })
expect('/api/profile unknown key -> 401', (await call('../api/profile.ts', { method: 'POST', query: { op: 'progress' }, body: strangerBody() })).code === 401)
expect('/api/profile?op=near-login unknown key -> 401', (await call('../api/profile.ts', { method: 'POST', query: { op: 'near-login' }, body: strangerBody() })).code === 401)
expect('/api/claim-username unknown key -> 401', (await call('../api/claim-username.ts', { method: 'POST', body: strangerBody() })).code === 401)
expect('/api/messages?op=near-session unknown key -> 401', (await call('../api/messages.ts', { method: 'POST', query: { op: 'near-session' }, body: strangerBody() })).code === 401)
const replay = { near: proofFor('player.testnet', owner) }
expect('near-login real key -> 200', (await call('../api/profile.ts', { method: 'POST', query: { op: 'near-login' }, body: replay })).code === 200)
expect('near-login replay -> 401', (await call('../api/profile.ts', { method: 'POST', query: { op: 'near-login' }, body: replay })).code === 401)
const ch = await call('../api/profile.ts', { method: 'POST', query: { op: 'near-challenge' }, body: {} })
expect('challenge endpoint issues a 32-byte nonce', ch.code === 200 && Buffer.from(String((ch.body as { nonce?: string }).nonce), 'base64').length === 32)

// Rotating the secret ends old Messages tokens and game sessions.
const M = await import('../api/messages.ts')
const dm = M.issueSession('near:player.testnet').token
expect('Messages token valid before rotation', M.readSession(dm) === 'near:player.testnet')
process.env.DM_SESSION_SECRET = randomBytes(32).toString('hex')
expect('Messages token refused after rotation', M.readSession(dm) === null)
expect('/api/messages with a pre-rotation token -> 401', (await call('../api/messages.ts', { method: 'GET', query: { op: 'inbox' }, headers: { authorization: `Bearer ${dm}` } })).code === 401)
expect('game session refused after rotation', !(await ok({ session: tok })))

if (fails) { console.error(`${fails} NEAR sign-in check(s) failed`); process.exit(1) }
console.log('ok - NEAR sign-in: key bound to account, single-use server nonce, sessions, rotation')
process.exit(0)
