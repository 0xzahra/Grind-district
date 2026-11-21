// NEP-413 signed-message verification for NEAR login. Underscore = not a Vercel function.
// A login is accepted when: the challenge nonce was issued by this server and is used once, the signature is
// valid, and the signing key is a full-access key of the named account on its network (implicit 64-hex
// accounts: the key must be the account). A verified login is swapped for a short game session token.
import { createPublicKey, createHash, createHmac, timingSafeEqual, verify as cryptoVerify, randomBytes } from 'crypto'

const TAG = 2147484061 // 2^31 + 413
const MAX_AGE_MS = 10 * 60 * 1000
const SESSION_MS = 12 * 60 * 60 * 1000
const RECIPIENT = 'grinddistrict.vercel.app'

function b58decode(s: string): Buffer {
  const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let n = 0n
  for (const c of s) {
    const i = ALPH.indexOf(c)
    if (i < 0) throw new Error('bad base58')
    n = n * 58n + BigInt(i)
  }
  const hex = n === 0n ? '' : n.toString(16)
  const buf = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex')
  let pad = 0
  for (const c of s) { if (c === '1') pad++; else break }
  return Buffer.concat([Buffer.alloc(pad), buf])
}

function borshString(s: string): Buffer {
  const b = Buffer.from(s, 'utf8')
  const len = Buffer.alloc(4)
  len.writeUInt32LE(b.length)
  return Buffer.concat([len, b])
}

export function nep413Bytes(message: string, nonce: Buffer, recipient: string, callbackUrl?: string | null): Buffer {
  const tag = Buffer.alloc(4)
  tag.writeUInt32LE(TAG >>> 0)
  const parts = [tag, borshString(message), nonce, borshString(recipient)]
  if (callbackUrl) parts.push(Buffer.from([1]), borshString(callbackUrl))
  else parts.push(Buffer.from([0]))
  return Buffer.concat(parts)
}

export type NearProof = {
  accountId: string
  publicKey: string
  signature: string
  message: string
  recipient: string
  nonce: string
  callbackUrl?: string
}
/** What NEAR players send: a signed login (once), then the session token it was swapped for. */
export type NearAuth = NearProof | { session: string }
export type NearSession = { token: string; exp: number }
type Fail = { ok: false; error: string; status?: number }

export function nearUserId(accountId: string): string {
  return `near:${accountId.toLowerCase()}`
}

export function isNearAccount(id: string): boolean {
  return /^[a-z0-9._-]{2,64}$/.test(id) && (id.endsWith('.testnet') || id.endsWith('.near') || /^[0-9a-f]{64}$/.test(id))
}

// ---- server keys (DM_SESSION_SECRET only; never leaves the server) ----
function subkey(label: string): Buffer | null {
  const s = process.env.DM_SESSION_SECRET ?? ''
  return s.length >= 16 ? createHmac('sha256', s).update(label).digest() : null
}
/** NEAR sign-in and its sessions need DM_SESSION_SECRET; without it they are off (503), never a fallback key. */
export const nearAuthConfigured = () => subkey('probe') !== null
const eq = (a: Buffer, b: Buffer) => a.length === b.length && timingSafeEqual(a, b)

// ---- challenge: 32 bytes = issued-at ms (8, BE) | random (8) | HMAC tag (16) ----
const CHALLENGE_LABEL = 'grind-district near login challenge v1'
export function issueNearChallenge(now = Date.now()): { nonce: string; exp: number } | null {
  const k = subkey(CHALLENGE_LABEL)
  if (!k) return null
  const head = Buffer.alloc(16)
  head.writeBigUInt64BE(BigInt(now), 0)
  randomBytes(8).copy(head, 8)
  const tag = createHmac('sha256', k).update(head).digest().subarray(0, 16)
  return { nonce: Buffer.concat([head, tag]).toString('base64'), exp: now + MAX_AGE_MS }
}
function checkChallenge(nonce: Buffer, now: number): string | null {
  const k = subkey(CHALLENGE_LABEL)
  if (!k) return 'Sign-in is not configured'
  if (nonce.length !== 32) return 'Bad nonce'
  const head = nonce.subarray(0, 16)
  const want = createHmac('sha256', k).update(head).digest().subarray(0, 16)
  if (!eq(Buffer.from(nonce.subarray(16)), want)) return 'Sign-in expired — try again'
  const age = now - Number(head.readBigUInt64BE(0))
  if (age < -60_000 || age > MAX_AGE_MS) return 'Sign-in expired — try again'
  return null
}

// ---- game session token: gdns.<base64url {u, exp}>.<HMAC-SHA256> ----
const SESSION_LABEL = 'grind-district near game session v1'
export function issueNearSession(accountId: string, now = Date.now()): NearSession | null {
  const k = subkey(SESSION_LABEL)
  if (!k) return null
  const exp = now + SESSION_MS
  const body = Buffer.from(JSON.stringify({ u: nearUserId(accountId), exp })).toString('base64url')
  return { token: `gdns.${body}.${createHmac('sha256', k).update(body).digest('base64url')}`, exp }
}
export function readNearSession(token: unknown, now = Date.now()): string | null {
  return readNearSessionFull(token, now)?.accountId ?? null
}
export function readNearSessionFull(token: unknown, now = Date.now()): { accountId: string; exp: number } | null {
  const k = subkey(SESSION_LABEL)
  if (!k || typeof token !== 'string' || token.length > 600) return null
  const [v, body, mac, extra] = token.split('.')
  if (v !== 'gdns' || !body || !mac || extra !== undefined) return null
  if (!eq(Buffer.from(mac, 'base64url'), createHmac('sha256', k).update(body).digest())) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u?: string; exp?: number }
    if (typeof p.u !== 'string' || !p.u.startsWith('near:') || typeof p.exp !== 'number' || p.exp <= now) return null
    const acc = p.u.slice(5)
    return isNearAccount(acc) ? { accountId: acc, exp: p.exp } : null
  } catch { return null }
}

// ---- Messages token: gdn1.<base64url {u: near:<account>, exp}>.<HMAC-SHA256>, up to 30 days ----
const DM_DAYS = 30
const dmKey = () => { const s = process.env.DM_SESSION_SECRET ?? ''; return s.length >= 16 ? createHmac('sha256', s).update('grind-district dm session v1').digest() : null }
/** `maxExp` caps the token (a token made from a game session never outlives that session). */
export function issueDmSession(userId: string, maxExp = Infinity, now = Date.now()): NearSession | null {
  const k = dmKey()
  if (!k) return null
  const exp = Math.min(now + DM_DAYS * 86_400_000, maxExp)
  const body = Buffer.from(JSON.stringify({ u: userId, exp })).toString('base64url')
  return { token: `gdn1.${body}.${createHmac('sha256', k).update(body).digest('base64url')}`, exp }
}
export function readDmSession(token: string, now = Date.now()): string | null {
  const k = dmKey()
  if (!k) return null
  const [v, body, mac] = token.split('.')
  if (v !== 'gdn1' || !body || !mac) return null
  if (!eq(Buffer.from(mac, 'base64url'), createHmac('sha256', k).update(body).digest())) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { u?: string; exp?: number }
    return typeof p.u === 'string' && p.u.startsWith('near:') && typeof p.exp === 'number' && p.exp > now ? p.u : null
  } catch { return null }
}

// ---- on-chain key check and single-use nonce store (injectable for tests) ----
export type NearAuthDeps = {
  /** 'full' = full-access key of the account, 'other' = a function-call key, 'none' = not a key, 'error' = RPC down. */
  keyKind(accountId: string, publicKey: string): Promise<'full' | 'other' | 'none' | 'error'>
  /** true the first time this nonce is consumed, false if it was used before; throws if the store is unreachable. */
  consumeNonce(nonce: Buffer, accountId: string, expiresAt: number): Promise<boolean>
  /** Whether an account exists on chain ('error' = RPC down). Used for implicit (64-hex) accounts. */
  accountExists(accountId: string): Promise<'yes' | 'no' | 'error'>
  now?(): number
}

// Implicit (64-hex) accounts are looked up on testnet, the network the sign-in wallet connects to.
const rpcs = (accountId: string): string[] => accountId.endsWith('.testnet') || /^[0-9a-f]{64}$/.test(accountId)
  ? [process.env.NEAR_TESTNET_RPC_URL || 'https://rpc.testnet.near.org', 'https://test.rpc.fastnear.com']
  : [process.env.NEAR_MAINNET_RPC_URL || 'https://rpc.mainnet.near.org', 'https://free.rpc.fastnear.com']

async function rpcKeyKind(accountId: string, publicKey: string): Promise<'full' | 'other' | 'none' | 'error'> {
  for (const url of rpcs(accountId)) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'view_access_key', finality: 'optimistic', account_id: accountId, public_key: publicKey } }),
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) continue
      const j = await r.json() as { result?: { permission?: unknown; error?: string }; error?: { cause?: { name?: string }; data?: string; message?: string } }
      if (j.result && j.result.permission !== undefined) return j.result.permission === 'FullAccess' ? 'full' : 'other'
      const why = `${j.error?.cause?.name ?? ''} ${j.error?.data ?? ''} ${j.result?.error ?? ''}`
      if (/UNKNOWN_ACCESS_KEY|UNKNOWN_ACCOUNT|does not exist|doesn't exist|access key/i.test(why)) return 'none'
    } catch { /* try the next RPC */ }
  }
  return 'error'
}

async function rpcAccountExists(accountId: string): Promise<'yes' | 'no' | 'error'> {
  for (const url of rpcs(accountId)) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'view_account', finality: 'optimistic', account_id: accountId } }),
        signal: AbortSignal.timeout(5000),
      })
      if (!r.ok) continue
      const j = await r.json() as { result?: { amount?: unknown }; error?: { cause?: { name?: string }; data?: string } }
      if (j.result && j.result.amount !== undefined) return 'yes'
      if (j.error?.cause?.name === 'UNKNOWN_ACCOUNT' || /does not exist/i.test(String(j.error?.data ?? ''))) return 'no'
    } catch { /* try the next RPC */ }
  }
  return 'error'
}

async function dbConsumeNonce(nonce: Buffer, accountId: string, expiresAt: number): Promise<boolean> {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('not configured')
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, key, { auth: { persistSession: false } })
  const id = createHash('sha256').update(nonce).digest('hex')
  const { error } = await db.from('near_login_nonces').insert({ nonce_hash: id, account_id: accountId, expires_at: new Date(expiresAt).toISOString() })
  if (Math.random() < 0.05) void db.from('near_login_nonces').delete().lt('expires_at', new Date(Date.now() - 3_600_000).toISOString()).then(() => {}, () => {})
  if (!error) return true
  if (error.code === '23505') return false
  throw new Error('nonce store unavailable')
}

export const defaultNearDeps: NearAuthDeps = { keyKind: rpcKeyKind, consumeNonce: dbConsumeNonce, accountExists: rpcAccountExists }

/** Checks a signed login. The nonce is consumed only after every other check passes. */
export async function verifyNearLogin(p: NearProof, deps: NearAuthDeps = defaultNearDeps): Promise<{ ok: true; accountId: string } | Fail> {
  try {
    const now = deps.now?.() ?? Date.now()
    if (!nearAuthConfigured()) return { ok: false, status: 503, error: 'NEAR sign-in is not available right now' }
    if (!p || typeof p !== 'object') return { ok: false, error: 'Bad NEAR account' }
    if (typeof p.accountId !== 'string' || !isNearAccount(p.accountId)) return { ok: false, error: 'Bad NEAR account' }
    if (typeof p.publicKey !== 'string' || !p.publicKey.startsWith('ed25519:')) return { ok: false, error: 'Need an ed25519 public key' }
    if (typeof p.nonce !== 'string' || typeof p.message !== 'string' || typeof p.signature !== 'string') return { ok: false, error: 'Bad login message' }
    const nonce = Buffer.from(p.nonce, 'base64')
    if (nonce.length !== 32) return { ok: false, error: 'Bad nonce' }
    const m = /^Grind District login\n(\d+)\n/.exec(p.message)
    if (!m) return { ok: false, error: 'Bad login message' }
    const age = now - Number(m[1])
    if (age < -60_000 || age > MAX_AGE_MS) return { ok: false, error: 'Sign-in expired — try again' }
    if (p.recipient !== RECIPIENT) return { ok: false, error: 'Bad recipient' }
    const ch = checkChallenge(nonce, now)
    if (ch) return { ok: false, error: ch }

    const bytes = nep413Bytes(p.message, nonce, p.recipient, p.callbackUrl ?? null)
    const pub = b58decode(p.publicKey.slice('ed25519:'.length))
    if (pub.length !== 32) return { ok: false, error: 'Bad public key' }
    // Wallets send the signature as base64 (NEP-413) or, in some wallets, base58 / "ed25519:" base58.
    const raw = p.signature.startsWith('ed25519:') ? p.signature.slice(8) : p.signature
    const sigs: Buffer[] = []
    try { sigs.push(Buffer.from(raw, 'base64')) } catch { /* not base64 */ }
    try { sigs.push(b58decode(raw)) } catch { /* not base58 */ }
    const candidates = sigs.filter((b) => b.length === 64)
    if (!candidates.length) return { ok: false, error: 'Bad signature' }
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), pub])
    const key = createPublicKey({ key: spki, format: 'der', type: 'spki' })
    // NEP-413: the wallet signs SHA-256 of the Borsh payload (raw payload kept as a fallback).
    const hashed = createHash('sha256').update(bytes).digest()
    const good = candidates.some((sig) => cryptoVerify(null, hashed, key, sig) || cryptoVerify(null, bytes, key, sig))
    if (!good) return { ok: false, error: 'Signature mismatch' }

    const accountId = p.accountId.toLowerCase()
    if (/^[0-9a-f]{64}$/.test(accountId)) {
      if (pub.toString('hex') !== accountId) return { ok: false, error: 'This key does not belong to that NEAR account' }
      // Once the implicit account exists on chain, its key list decides (a removed key stops working).
      const kind = await deps.keyKind(accountId, `ed25519:${p.publicKey.slice('ed25519:'.length)}`)
      if (kind === 'error') return { ok: false, error: 'Could not reach NEAR — try again' }
      if (kind !== 'full') {
        const exists = await deps.accountExists(accountId)
        if (exists === 'error') return { ok: false, error: 'Could not reach NEAR — try again' }
        if (exists === 'yes') return { ok: false, error: 'This key does not belong to that NEAR account' }
      }
    } else {
      const kind = await deps.keyKind(accountId, `ed25519:${p.publicKey.slice('ed25519:'.length)}`)
      if (kind === 'error') return { ok: false, error: 'Could not reach NEAR — try again' }
      if (kind !== 'full') return { ok: false, error: 'This key does not belong to that NEAR account' }
    }
    let fresh: boolean
    try { fresh = await deps.consumeNonce(nonce, accountId, Number(nonce.readBigUInt64BE(0)) + MAX_AGE_MS) } catch { return { ok: false, error: 'Could not sign in right now — try again' } }
    if (!fresh) return { ok: false, error: 'This sign-in was already used — sign in again' }
    return { ok: true, accountId }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Could not verify' }
  }
}

/**
 * NEAR auth for API routes: a game session token ({ session }) or a signed login (consumed once).
 * `session` is set when a signed login was just swapped for a new token, so the caller can return it.
 */
export async function verifyNearAuth(n: unknown, deps: NearAuthDeps = defaultNearDeps): Promise<{ ok: true; accountId: string; session?: NearSession; fresh: boolean; expiresAt: number } | Fail> {
  if (!nearAuthConfigured()) return { ok: false, status: 503, error: 'NEAR sign-in is not available right now' }
  if (!n || typeof n !== 'object') return { ok: false, error: 'Bad NEAR account' }
  if ('session' in n) {
    const s = readNearSessionFull((n as { session: unknown }).session, deps.now?.())
    return s ? { ok: true, accountId: s.accountId, fresh: false, expiresAt: s.exp } : { ok: false, error: 'Sign in with NEAR again' }
  }
  const v = await verifyNearLogin(n as NearProof, deps)
  if (!v.ok) return v
  const session = issueNearSession(v.accountId, deps.now?.())
  if (!session) return { ok: false, status: 503, error: 'NEAR sign-in is not available right now' }
  return { ok: true, accountId: v.accountId, session, fresh: true, expiresAt: session.exp }
}

export const NEAR_LOGIN_RECIPIENT = RECIPIENT
