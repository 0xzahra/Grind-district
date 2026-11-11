// Read-only lookups: has this (username, course) certificate been minted on Base / NEAR? Underscore = not a function.
import { encodeAbiParameters, keccak256, encodeFunctionData, decodeFunctionResult, type Abi } from 'viem'

export const BASE_RPC = process.env.CERT_BASE_RPC || 'https://mainnet.base.org'
export const NEAR_RPC = process.env.CERT_NEAR_RPC || process.env.VITE_NEAR_RPC || 'https://rpc.mainnet.near.org'
export const baseContract = () => (/^0x[0-9a-fA-F]{40}$/.test(process.env.VITE_CERT_NFT_BASE ?? '') ? (process.env.VITE_CERT_NFT_BASE as `0x${string}`) : null)
export const nearContract = () => (/^[a-z0-9._-]{2,64}$/.test(process.env.VITE_CERT_NFT_NEAR ?? '') ? process.env.VITE_CERT_NFT_NEAR! : null)
export const baseChainId = () => Number(process.env.VITE_CERT_NFT_BASE_CHAIN || 8453)
export const nearNetwork = () => (nearContract()?.endsWith('.testnet') ? 'testnet' : 'mainnet')

export const CERT_ABI = [
  { type: 'function', name: 'tokenOfKey', stateMutability: 'view', inputs: [{ type: 'bytes32' }], outputs: [{ type: 'uint256' }] },
] as const satisfies Abi

export const certKey = (username: string, course: string) => keccak256(encodeAbiParameters([{ type: 'string' }, { type: 'string' }], [username, course]))

const timed = async (url: string, body: unknown, ms = 2500) => {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms)
  try { return await (await fetch(url, { method: 'POST', signal: ctl.signal, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).json() } finally { clearTimeout(t) }
}

export type Minted = { chain: 'base' | 'near'; tokenId: string; contract: string; explorer: string; owner?: string }

export async function mintedOnBase(username: string, course: string): Promise<Minted | null> {
  const c = baseContract(); if (!c) return null
  const data = encodeFunctionData({ abi: CERT_ABI, functionName: 'tokenOfKey', args: [certKey(username, course)] })
  const j = (await timed(BASE_RPC, { jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: c, data }, 'latest'] })) as { result?: `0x${string}` }
  if (!j.result) return null
  const id = decodeFunctionResult({ abi: CERT_ABI, functionName: 'tokenOfKey', data: j.result }) as bigint
  if (!id) return null
  const scan = baseChainId() === 84532 ? 'https://sepolia.basescan.org' : 'https://basescan.org'
  return { chain: 'base', tokenId: id.toString(), contract: c, explorer: `${scan}/nft/${c}/${id}` }
}

export async function mintedOnNear(username: string, course: string): Promise<Minted | null> {
  const c = nearContract(); if (!c) return null
  const args = Buffer.from(JSON.stringify({ username, course_id: course })).toString('base64')
  const j = (await timed(NEAR_RPC, { jsonrpc: '2.0', id: 'gd', method: 'query', params: { request_type: 'call_function', finality: 'final', account_id: c, method_name: 'cert_for', args_base64: args } })) as { result?: { result?: number[] } }
  if (!j.result?.result) return null
  const t = JSON.parse(Buffer.from(j.result.result).toString('utf8')) as { token_id: string; owner_id: string } | null
  if (!t) return null
  const scan = nearNetwork() === 'testnet' ? 'https://testnet.nearblocks.io' : 'https://nearblocks.io'
  return { chain: 'near', tokenId: t.token_id, contract: c, owner: t.owner_id, explorer: `${scan}/nft-token/${c}/${t.token_id}` }
}
