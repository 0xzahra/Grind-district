// Read-only lookups: has this (username, course) certificate been minted on Base / NEAR? Underscore = not a function.
import { encodeAbiParameters, keccak256, encodeFunctionData, decodeFunctionResult, type Abi } from 'viem'
import { routeContract } from '../src/chains/router.js'

export const BASE_RPC = process.env.CERT_BASE_RPC || 'https://mainnet.base.org'
// The RPC must be on the contract's own network: a .testnet contract read through the mainnet RPC finds nothing
// (the certificate page then said "Not minted yet" for minted tokens).
export const nearRpc = () => process.env.CERT_NEAR_RPC || ((process.env.VITE_CERT_NFT_NEAR ?? '').endsWith('.testnet') ? 'https://rpc.testnet.near.org' : 'https://rpc.mainnet.near.org')
export const baseContract = () => (/^0x[0-9a-fA-F]{40}$/.test(process.env.VITE_CERT_NFT_BASE ?? '') ? (process.env.VITE_CERT_NFT_BASE as `0x${string}`) : null)
export const nearContract = () => (/^[a-z0-9._-]{2,64}$/.test(process.env.VITE_CERT_NFT_NEAR ?? '') ? process.env.VITE_CERT_NFT_NEAR! : null)
export const baseChainId = () => Number(process.env.VITE_CERT_NFT_BASE_CHAIN || 8453)
export const nearNetwork = () => (nearContract()?.endsWith('.testnet') ? 'testnet' : 'mainnet')
/** NEAR mainnet certificate contract, kept ALONGSIDE the main one (testnet during judging). Off while unset. */
export const nearMainnetContract = () => routeContract('near-mainnet', process.env)
/** The NEAR contract for a requested network: the main one when it is on that network, else the mainnet extra. */
export const nearContractFor = (net: 'testnet' | 'mainnet'): string | null => {
  const main = nearContract()
  if (main && (main.endsWith('.testnet') ? 'testnet' : 'mainnet') === net) return main
  return net === 'mainnet' ? nearMainnetContract() : null
}

export const CERT_ABI = [
  { type: 'function', name: 'tokenOfKey', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'tokenJSON', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'string' }] },
] as const satisfies Abi

export const certKey = (username: string, course: string) => keccak256(encodeAbiParameters([{ type: 'string' }, { type: 'string' }], [username, course]))

const timed = async (url: string, body: unknown, ms = 2500) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms)
  try { return await (await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json() } finally { clearTimeout(t) }
}

export type Minted = { chain: 'base' | 'near'; tokenId: string; contract: string; explorer: string; owner?: string; certUrls?: string[] }

export async function mintedOnBase(username: string, course: string): Promise<Minted | null> {
  const c = baseContract(); if (!c) return null
  const data = encodeFunctionData({ abi: CERT_ABI, functionName: 'tokenOfKey', args: [certKey(username, course)] })
  const j = (await timed(BASE_RPC, { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: c, data }, 'latest'] })) as { result?: `0x${string}` }
  if (!j.result) return null
  const id = decodeFunctionResult({ abi: CERT_ABI, functionName: 'tokenOfKey', data: j.result }) as bigint
  if (!id) return null
  const scan = baseChainId() === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'
  // The certificate link written on-chain at mint (lets an already-minted certificate's page keep working).
  const certUrls: string[] = []
  try {
    const q = encodeFunctionData({ abi: CERT_ABI, functionName: 'tokenJSON', args: [id] })
    const m = (await timed(BASE_RPC, { jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: c, data: q }, 'latest'] })) as { result?: `0x${string}` }
    if (m.result) { const x = JSON.parse(decodeFunctionResult({ abi: CERT_ABI, functionName: 'tokenJSON', data: m.result }) as string) as { external_url?: unknown }; if (typeof x.external_url === 'string') certUrls.push(x.external_url) }
  } catch { /* metadata read is best effort */ }
  return { chain: 'base', tokenId: id.toString(), contract: c, explorer: `${scan}/nft/${c}/${id}`, certUrls }
}

export async function mintedOnNear(username: string, course: string, contract?: string): Promise<Minted | null> {
  const c = contract ?? nearContract(); if (!c) return null
  const testnet = c.endsWith('.testnet')
  const rpc = contract && contract !== nearContract() ? (testnet ? 'https://rpc.testnet.near.org' : process.env.CERT_NEAR_MAINNET_RPC || 'https://rpc.mainnet.near.org') : nearRpc()
  const args = Buffer.from(JSON.stringify({ username, course_id: course })).toString('base64')
  const j = (await timed(rpc, { jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: c, method_name: 'cert_for', args_base64: args } }, 6000)) as { result?: { result?: number[] } }
  if (!j.result?.result) return null
  const t = JSON.parse(Buffer.from(j.result.result).toString('utf8')) as { token_id: string; owner_id: string; metadata?: { media?: string; extra?: string } } | null
  if (!t) return null
  const scan = testnet ? 'https://testnet.nearblocks.io' : 'https://nearblocks.io'
  // The certificate links written on-chain at mint (lets an already-minted certificate's page keep working).
  const certUrls: string[] = []
  if (typeof t.metadata?.media === 'string') certUrls.push(t.metadata.media)
  try { const x = JSON.parse(t.metadata?.extra || '{}') as { external_url?: unknown }; if (typeof x.external_url === 'string') certUrls.push(x.external_url) } catch { /* not JSON */ }
  return { chain: 'near', tokenId: t.token_id, contract: c, owner: t.owner_id, explorer: `${scan}/nft-token/${c}/${t.token_id}`, certUrls }
}
