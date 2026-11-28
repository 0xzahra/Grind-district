// POST /api/profile?op=cert-voucher (auth already checked by profile.ts). Underscore = not a function.
// Body: { chain: 'base'|'near'|'solana', course, certId, to?: 0x… (Base), receiver?: account.near/.testnet (NEAR),
//        network?: 'testnet'|'mainnet' (NEAR; default = the main contract's network, mainnet only when configured),
//        owner?: Solana address (optional; Solana records are issued by the server, no player wallet needed) }
// Signs only when: minting is configured, the course is passed in the player's synced save, the player
// holds a pass ticket from the server-graded certificate exam (api/_certExam.ts), the
// wallet is the player's own (Base: a wallet linked to their Privy account; NEAR: their signed-in
// NEAR account if they use NEAR sign-in) and this (username, course) is not already minted.
// Solana (programs/grind-cert on devnet): same gates; the server is the issuer and writes the record itself.
import type { SupabaseClient } from '@supabase/supabase-js'
import { baseVoucher, signBaseVoucher, nearVoucherJson, signNearVoucher } from './_certVoucher.js'
import { baseContract, nearContract, nearContractFor, baseChainId, mintedOnBase, mintedOnNear } from './_certChain.js'
import { easLive, easAttestationRequest } from './_certEas.js'
import { issueOnSolana, mintedOnSolana, solanaMintLive, isSolanaAddress } from './_certSolana.js'
import { isNearAccount } from './_nearAuth.js'
import { issueCert, rowData } from './_certStore.js'
import { checkTicket } from './_certExam.js'

type Res = { status(n: number): { json(b: unknown): void } }
type Body = Record<string, unknown> & { chain?: unknown; course?: unknown; certId?: unknown; to?: unknown; receiver?: unknown; owner?: unknown; ticket?: unknown; network?: unknown }

export async function certVoucher(body: Body, res: Res, db: SupabaseClient, userId: string, username: string, linkedEvm: () => Promise<string[]>) {
  const chain = body.chain === 'base' || body.chain === 'near' || body.chain === 'solana' ? body.chain : null
  const course = String(body.course ?? '')
  if (!chain) return res.status(400).json({ error: 'choose Base, NEAR or Solana' })
  // The server certificate record (issued now if this is the first time) is what gets minted.
  const rec = await issueCert(db, userId, username, course, String(body.certId ?? ''))
  if (!rec.ok) return res.status(rec.status).json({ error: rec.error, ...(rec.exam ? { exam: true } : {}) })
  const c = { id: rec.row.cert_id, data: rowData(rec.row) }

  if (chain === 'base') {
    const contract = baseContract(), key = process.env.CERT_SIGNER_PRIVATE_KEY
    if (!contract || !key || !/^0x[0-9a-fA-F]{64}$/.test(key)) return res.status(503).json({ error: 'Base minting is not live yet', live: false })
    const to = String(body.to ?? '')
    if (!/^0x[0-9a-fA-F]{40}$/.test(to)) return res.status(400).json({ error: 'no Base wallet' })
    if (userId.startsWith('near:')) return res.status(403).json({ error: 'Base minting uses the game wallet from Google, X or email sign-in' })
    const mine = (await linkedEvm().catch(() => [] as string[])).map((a) => a.toLowerCase())
    if (!mine.includes(to.toLowerCase())) return res.status(403).json({ error: 'that wallet is not linked to your account' })
    const already = await mintedOnBase(c.data.u, course).catch(() => null)
    if (already) return res.status(200).json({ already, certId: c.id })
    if (!checkTicket(username, course, body.ticket).ok) return res.status(403).json({ error: 'pass the short certificate exam first', exam: true })
    const v = baseVoucher(to as `0x${string}`, c.id, c.data)
    const signature = await signBaseVoucher(key as `0x${string}`, baseChainId(), contract, v)
    // Optional EAS attestation alongside the NFT (off unless CERT_EAS=1 and the schema uid is set); same gate as the mint.
    const eas = easLive() ? await easAttestationRequest(key as `0x${string}`, to as `0x${string}`, c.id, c.data).catch(() => null) : null
    return res.status(200).json({ chain, contract, chainId: baseChainId(), certId: c.id, signature, voucher: { ...v, issuedAt: v.issuedAt.toString(), deadline: v.deadline.toString() }, ...(eas ? { eas } : {}) })
  }

  if (chain === 'solana') {
    if (!solanaMintLive()) return res.status(503).json({ error: 'Solana minting is not live yet', live: false })
    const owner = body.owner == null || body.owner === '' ? undefined : String(body.owner)
    if (owner && !isSolanaAddress(owner)) return res.status(400).json({ error: 'not a Solana address' })
    const already = await mintedOnSolana(c.data.u, course).catch(() => null)
    if (already) return res.status(200).json({ already, certId: c.id })
    if (!checkTicket(username, course, body.ticket).ok) return res.status(403).json({ error: 'pass the short certificate exam first', exam: true })
    const r = await issueOnSolana(c.id, c.data, owner)
    if (!r.ok) return res.status(r.status).json({ error: r.error, ...(r.live === false ? { live: false } : {}) })
    return res.status(200).json({ chain, certId: c.id, minted: { ...r.minted, ...(r.tx ? { tx: r.tx } : {}) } })
  }

  const main = nearContract()
  const net: 'testnet' | 'mainnet' = body.network === 'mainnet' || body.network === 'testnet' ? body.network : (main?.endsWith('.testnet') ? 'testnet' : 'mainnet')
  const contract = nearContractFor(net), key = process.env.CERT_NEAR_SIGNER_KEY
  if (!contract || !key) return res.status(503).json({ error: `NEAR ${net} minting is not live yet`, live: false })
  const receiver = String(body.receiver ?? '').toLowerCase()
  if (!isNearAccount(receiver)) return res.status(400).json({ error: 'connect a NEAR wallet' })
  if (net === 'testnet' ? !receiver.endsWith('.testnet') && !/^[0-9a-f]{64}$/.test(receiver) : receiver.endsWith('.testnet')) return res.status(400).json({ error: `use a NEAR ${net} account` })
  if (userId.startsWith('near:') && userId !== `near:${receiver}`) return res.status(403).json({ error: 'mint to the NEAR account you signed in with' })
  const already = await mintedOnNear(c.data.u, course, contract).catch(() => null)
  if (already) return res.status(200).json({ already, certId: c.id })
  // The on-chain certificate needs a pass on the server-graded exam (api/_certExam.ts), not just the device's save.
  if (!checkTicket(username, course, body.ticket).ok) return res.status(403).json({ error: 'pass the short certificate exam first', exam: true })
  const json = nearVoucherJson(contract, receiver, c.id, c.data)
  return res.status(200).json({ chain, contract, network: net, certId: c.id, voucher: json, signature: signNearVoucher(key, json) })
}
