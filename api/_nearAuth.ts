// NEP-413 signed-message verification for NEAR login. Underscore = not a Vercel function.
import { createPublicKey, createHash, verify as cryptoVerify, randomBytes } from 'crypto'

const TAG = 2147484061 // 2^31 + 413
const MAX_AGE_MS = 10 * 60 * 1000
const RECIPIENT = 'grinddistrict.vercel.app'

function b58decode(s: string): Buffer {
  const ALPH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let n = 0n
  for (const c of s) {
    const i = ALPH.indexOf(c)
    if (i < 0) throw new Error('bad base58')
    n = n * 58n + BigInt(i)
  }
  const hex = n.toString(16)
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

function nep413Bytes(message: string, nonce: Buffer, recipient: string, callbackUrl?: string | null): Buffer {
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

export function nearUserId(accountId: string): string {
  return `near:${accountId.toLowerCase()}`
}

export function isNearAccount(id: string): boolean {
  return /^[a-z0-9._-]{2,64}$/.test(id) && (id.endsWith('.testnet') || id.endsWith('.near') || /^[0-9a-f]{64}$/.test(id))
}

export function verifyNearLogin(p: NearProof): { ok: true; accountId: string } | { ok: false; error: string } {
  try {
    if (!isNearAccount(p.accountId)) return { ok: false, error: 'Bad NEAR account' }
    if (!p.publicKey.startsWith('ed25519:')) return { ok: false, error: 'Need an ed25519 public key' }
    const nonce = Buffer.from(p.nonce, 'base64')
    if (nonce.length !== 32) return { ok: false, error: 'Bad nonce' }
    const m = /^Grind District login\n(\d+)\n/.exec(p.message)
    if (!m) return { ok: false, error: 'Bad login message' }
    const age = Date.now() - Number(m[1])
    if (age < -60_000 || age > MAX_AGE_MS) return { ok: false, error: 'Login expired — try again' }
    if (p.recipient !== RECIPIENT) return { ok: false, error: 'Bad recipient' }

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
    return { ok: true, accountId: p.accountId.toLowerCase() }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Could not verify' }
  }
}

export function freshNonceB64(): string {
  return randomBytes(32).toString('base64')
}

export const NEAR_LOGIN_RECIPIENT = RECIPIENT
