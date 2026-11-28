// Solana certificates: Grind District's own Rust program (programs/grind-cert) on Solana devnet.
// Underscore = not a Vercel function. The server is the only issuer: it records a certificate account after the
// same server-graded exam pass that gates Base and NEAR (api/_certStore.ts issueCert + cert_passes), and the
// program has no transfer instruction, so certificates are soulbound. No names, emails or wallets go on-chain:
// the player id is an HMAC of the username keyed by the issuer key. On devnet the issuer pays the (test) fee.
import { createHash, createHmac } from 'node:crypto'
import { b58decode } from './_certVoucher.js'
import type { CertData } from './_certArt.js'
import type { Minted } from './_certChain.js'

export const isSolanaAddress = (s: string): boolean => {
  try { return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s) && b58decode(s).length === 32 } catch { return false }
}

export const solanaCluster = (): 'devnet' | 'mainnet-beta' =>
  process.env.CERT_SOLANA_CLUSTER === 'mainnet-beta' ? 'mainnet-beta' : 'devnet'

export const solanaRpc = () =>
  process.env.CERT_SOLANA_RPC || (solanaCluster() === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com')

/** The grind-cert program id, or null while the route is off. */
export const solanaProgram = () => {
  const c = String(process.env.VITE_CERT_SOLANA_PROGRAM ?? '').trim()
  return isSolanaAddress(c) ? c : null
}

export const solanaExplorer = (addr: string, typ: 'address' | 'tx' = 'address') => {
  const q = solanaCluster() === 'devnet' ? '?cluster=devnet' : ''
  return `https://explorer.solana.com/${typ}/${addr}${q}`
}

function signerSecret(): Uint8Array | null {
  const raw = String(process.env.CERT_SOLANA_SIGNER_KEY ?? '').trim()
  if (!raw) return null
  try {
    if (raw.startsWith('[')) {
      const a = JSON.parse(raw) as unknown
      if (Array.isArray(a) && a.length === 64 && a.every((x) => Number.isInteger(x) && x >= 0 && x <= 255)) return Uint8Array.from(a)
      return null
    }
    const b = b58decode(raw)
    if (b.length === 64) return new Uint8Array(b)
  } catch { /* bad key */ }
  return null
}

export const solanaMintLive = () => !!(solanaProgram() && signerSecret())

/** 32-byte server-derived player id (no username on-chain). */
export function solanaPlayerId(username: string): Buffer | null {
  const sec = signerSecret()
  if (!sec) return null
  return createHmac('sha256', Buffer.from(sec.slice(0, 32))).update(`gd-cert-player-v1:${username.toLowerCase()}`).digest()
}
/** Course id as 32 bytes, zero-padded (course ids are short ASCII slugs). */
export const courseBytes = (course: string): Buffer => { const b = Buffer.alloc(32); Buffer.from(course, 'utf8').copy(b, 0, 0, 32); return b }
/** sha256 of the certificate id: anyone holding the public certificate link can check it against the chain. */
export const certHash = (certId: string): Buffer => createHash('sha256').update(certId).digest()

async function web3() { return import('@solana/web3.js') }

export async function certAddress(username: string, course: string): Promise<string | null> {
  const program = solanaProgram(), pid = solanaPlayerId(username)
  if (!program || !pid) return null
  const { PublicKey } = await web3()
  const cs = createHash('sha256').update(courseBytes(course)).digest()
  return PublicKey.findProgramAddressSync([Buffer.from('cert'), pid, cs], new PublicKey(program))[0].toBase58()
}

const rpc = async (method: string, params: unknown[], ms = 4000) => {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms)
  try {
    return (await (await fetch(solanaRpc(), { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })).json()) as { result?: { value?: { data?: [string, string]; owner?: string } | null }; error?: unknown }
  } finally { clearTimeout(t) }
}

/** Decoded certificate account, or null when this (player, course) has none. */
export async function mintedOnSolana(username: string, course: string): Promise<Minted | null> {
  const program = solanaProgram(), addr = await certAddress(username, course)
  if (!program || !addr) return null
  const j = await rpc('getAccountInfo', [addr, { encoding: 'base64', commitment: 'confirmed' }])
  const v = j.result?.value
  if (!v?.data || v.owner !== program) return null
  const d = Buffer.from(v.data[0], 'base64')
  if (d.length < 179 || d[0] !== 2 || d[2] !== 0) return null
  const serial = d.readBigUInt64LE(99).toString()
  return { chain: 'solana', tokenId: serial, contract: program, explorer: solanaExplorer(addr) }
}

/** Issue the certificate account on-chain (issuer signs and pays). Idempotent: an existing record is returned. */
export async function issueOnSolana(certId: string, d: CertData, recipient?: string): Promise<
  { ok: true; minted: Minted; tx?: string } | { ok: false; status: number; error: string; live?: false }
> {
  const program = solanaProgram(), sec = signerSecret(), pid = solanaPlayerId(d.u)
  if (!program || !sec || !pid) return { ok: false, status: 503, error: 'Solana minting is not live yet', live: false }
  if (recipient && !isSolanaAddress(recipient)) return { ok: false, status: 400, error: 'not a Solana address' }
  const already = await mintedOnSolana(d.u, d.c).catch(() => null)
  if (already) return { ok: true, minted: already }
  const { Connection, Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction } = await web3()
  const issuer = Keypair.fromSecretKey(sec)
  const pidKey = new PublicKey(program)
  const [config] = PublicKey.findProgramAddressSync([Buffer.from('config')], pidKey)
  const addr = new PublicKey((await certAddress(d.u, d.c))!)
  const data = Buffer.concat([Buffer.from([1]), pid, courseBytes(d.c), certHash(certId), recipient ? new PublicKey(recipient).toBuffer() : Buffer.alloc(32)])
  const ix = new TransactionInstruction({
    programId: pidKey, data,
    keys: [
      { pubkey: issuer.publicKey, isSigner: true, isWritable: true },
      { pubkey: config, isSigner: false, isWritable: true },
      { pubkey: addr, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
  })
  const conn = new Connection(solanaRpc(), 'confirmed')
  try {
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed')
    const tx = new Transaction({ feePayer: issuer.publicKey, blockhash, lastValidBlockHeight }).add(ix)
    tx.sign(issuer)
    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 })
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed')
    const minted = await mintedOnSolana(d.u, d.c)
    if (!minted) return { ok: false, status: 502, error: 'Solana did not confirm the certificate yet. Try again.' }
    return { ok: true, minted: { ...minted }, tx: sig }
  } catch (e) {
    // A parallel request may have issued it a moment ago.
    const again = await mintedOnSolana(d.u, d.c).catch(() => null)
    if (again) return { ok: true, minted: again }
    return { ok: false, status: 502, error: 'Solana is busy. Try again in a minute.', ...(process.env.VERCEL ? {} : { detail: String((e as Error)?.message ?? e) }) }
  }
}
