// Who may open a Base top-up order for a wallet: only someone who controls it. Underscore = not a Vercel function.
// Either the wallet is linked to the caller's Privy account (game wallet, or a wallet linked at sign-in), or the
// wallet signs a short message naming the caller (personal_sign; smart wallets are checked with ERC-1271/6492).
// The order then belongs to the caller, so a payment from that wallet can only be credited to its own owner.
import { createHash } from 'node:crypto'

export const PROOF_MAX_AGE_MS = 10 * 60 * 1000

/** The account part of the message: a short hash of the Privy id (no id shown in the wallet), or "guest". */
export const accountTag = (userId: string | null) => (userId ? createHash('sha256').update(`gd-topup\n${userId}`).digest('hex').slice(0, 16) : 'guest')

export function payerMessage(from: string, userId: string | null, issued: number): string {
  return `Grind District top-up\nConfirm this wallet is yours.\nWallet: ${from.toLowerCase()}\nAccount: ${accountTag(userId)}\nIssued: ${issued}`
}

export type ProofDeps = {
  /** EVM wallets linked to this Privy account (lowercase or not). */
  linked(userId: string): Promise<string[]>
  /** true when `signature` is a valid signature of `message` by `address` (EOA or smart wallet). */
  verify(address: string, message: string, signature: string): Promise<boolean>
  now?(): number
}

export type Proof = { ok: true; via: 'linked' | 'signature' } | { ok: false; needSignature: true; message: string; issued: number; error: string }

/** Proof that the caller controls `from`. `sig`/`issued` are the optional signed message fields from the client. */
export async function provePayer(from: string, userId: string | null, sig: unknown, issued: unknown, deps: ProofDeps): Promise<Proof> {
  const now = deps.now?.() ?? Date.now()
  const addr = from.toLowerCase()
  const ask = (error: string): Proof => ({ ok: false, needSignature: true, message: payerMessage(addr, userId, now), issued: now, error })
  if (userId) {
    const mine = (await deps.linked(userId).catch(() => [] as string[])).map((a) => a.toLowerCase())
    if (mine.includes(addr)) return { ok: true, via: 'linked' }
  }
  if (typeof sig !== 'string' || !/^0x[0-9a-fA-F]+$/.test(sig) || sig.length > 20_000) return ask('Confirm in your wallet that it is yours')
  const at = Number(issued)
  if (!Number.isFinite(at) || at > now + 60_000 || now - at > PROOF_MAX_AGE_MS) return ask('That confirmation expired. Try again.')
  const good = await deps.verify(addr, payerMessage(addr, userId, at), sig).catch(() => false)
  return good ? { ok: true, via: 'signature' } : ask('That signature is not from this wallet')
}
