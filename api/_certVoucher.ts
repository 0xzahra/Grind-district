// Certificate mint vouchers (Base EIP-712 / NEAR ed25519). Underscore = not a Vercel function.
// The server signs only for the signed-in player's own username, a course their synced save shows
// passed, and canonical fields it rebuilds itself (title from the course list, name from the save).
// The save is written by the player's device, so this is a practice credential, not a verified grade.
import { createPrivateKey, sign as edSign, createPublicKey } from 'node:crypto'
import { encodeCertId, decodeCertId, certSerial, issuedWat, certField, type CertData } from './_certArt.js'
import { CERT_COURSES, CERT_RANKS } from './_certCourses.js'

export const VOUCHER_TTL_S = 30 * 60
const EARLIEST = Date.parse('2025-01-01T00:00:00Z')

type Save = { name?: unknown; xp?: unknown; skills?: Record<string, { passed?: boolean } | undefined>; activities?: Array<{ at?: unknown; label?: unknown }> }

/** Rebuilds the certificate from server-side facts. Returns an error string when it must not be signed. */
export function canonicalCert(save: Save | null | undefined, username: string, course: string, clientId: string, now = Date.now()): { ok: true; id: string; data: CertData } | { ok: false; error: string } {
  const title = CERT_COURSES[course]
  if (!title) return { ok: false, error: 'unknown course' }
  if (!save?.skills?.[course]?.passed) return { ok: false, error: 'course not passed in your synced progress' }
  const client = decodeCertId(clientId)
  if (!client || client.c !== course || client.u.toLowerCase() !== username.toLowerCase()) return { ok: false, error: 'certificate does not match your account' }
  const rank = CERT_RANKS.includes(client.r) ? client.r : CERT_RANKS[0]
  // Prefer the pass time in the save's activity log; else the device's first-issue time (must be sane).
  const logged = (save.activities ?? []).find((a) => a?.label === `Passed ${title}`)
  let at = Number(logged?.at)
  if (!Number.isFinite(at) || at < EARLIEST || at > now + 300_000) at = Number(client.at)
  if (!Number.isFinite(at) || at < EARLIEST || at > now + 300_000) at = now
  const data: CertData = { n: certField(save.name, 40) || username, u: username.toLowerCase(), r: rank, c: course, t: title, at: Math.floor(at) }
  const id = encodeCertId(data)
  return { ok: true, id, data: decodeCertId(id)! }
}

export type BaseVoucher = {
  to: `0x${string}`; courseId: string; courseTitle: string; playerName: string; username: string; rank: string
  issuedAt: bigint; issuedWat: string; serial: string; certId: string; deadline: bigint
}

export const VOUCHER_TYPES = {
  Voucher: [
    { name: 'to', type: 'address' }, { name: 'courseId', type: 'string' }, { name: 'courseTitle', type: 'string' },
    { name: 'playerName', type: 'string' }, { name: 'username', type: 'string' }, { name: 'rank', type: 'string' },
    { name: 'issuedAt', type: 'uint64' }, { name: 'issuedWat', type: 'string' }, { name: 'serial', type: 'string' },
    { name: 'certId', type: 'string' }, { name: 'deadline', type: 'uint64' },
  ],
} as const

export const certDomain = (chainId: number, verifyingContract: `0x${string}`) => ({ name: 'Grind District Certificate', version: '1', chainId, verifyingContract })

export function baseVoucher(to: `0x${string}`, id: string, d: CertData, now = Date.now()): BaseVoucher {
  return {
    to, courseId: d.c, courseTitle: d.t, playerName: d.n, username: d.u, rank: d.r,
    issuedAt: BigInt(Math.floor((d.at ?? now) / 1000)), issuedWat: issuedWat(d), serial: certSerial(d), certId: id,
    deadline: BigInt(Math.floor(now / 1000) + VOUCHER_TTL_S),
  }
}

export async function signBaseVoucher(key: `0x${string}`, chainId: number, contract: `0x${string}`, v: BaseVoucher): Promise<`0x${string}`> {
  const { privateKeyToAccount } = await import('viem/accounts')
  return privateKeyToAccount(key).signTypedData({ domain: certDomain(chainId, contract), types: VOUCHER_TYPES, primaryType: 'Voucher', message: v })
}

// ---------------------------------------------------------------- NEAR

/** Exact JSON the NEAR contract parses after checking the ed25519 signature over these bytes. */
export function nearVoucherJson(contract: string, receiver: string, id: string, d: CertData, now = Date.now()): string {
  return JSON.stringify({
    contract_id: contract, receiver_id: receiver, course_id: d.c, course_title: d.t, player_name: d.n, username: d.u, rank: d.r,
    issued_at_ms: d.at ?? now, issued_wat: issuedWat(d), serial: certSerial(d), cert_id: id, deadline_ms: now + VOUCHER_TTL_S * 1000,
  })
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
export function b58decode(s: string): Buffer {
  let n = 0n
  for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error('bad base58'); n = n * 58n + BigInt(i) }
  const hex = n.toString(16)
  const buf = n === 0n ? Buffer.alloc(0) : Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex')
  let pad = 0
  for (const c of s) { if (c === '1') pad++; else break }
  return Buffer.concat([Buffer.alloc(pad), buf])
}
export function b58encode(b: Uint8Array): string {
  let n = BigInt('0x' + (Buffer.from(b).toString('hex') || '0')), s = ''
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n }
  for (const x of b) { if (x === 0) s = '1' + s; else break }
  return s
}

/** NEAR-style secret "ed25519:<base58 of 64 bytes seed+pub>" (or a 32-byte seed) -> node key. */
function nearKey(secret: string) {
  const raw = b58decode(secret.replace(/^ed25519:/, ''))
  const seed = raw.subarray(0, 32)
  if (seed.length !== 32) throw new Error('bad NEAR signer key')
  return createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' })
}

export function nearSignerPublicKey(secret: string): string {
  const der = createPublicKey(nearKey(secret)).export({ format: 'der', type: 'spki' })
  return 'ed25519:' + b58encode(der.subarray(der.length - 32))
}

/** Base64 ed25519 signature over the UTF-8 bytes of the voucher JSON. */
export function signNearVoucher(secret: string, json: string): string {
  return edSign(null, Buffer.from(json, 'utf8'), nearKey(secret)).toString('base64')
}
