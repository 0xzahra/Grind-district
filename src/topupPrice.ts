const RPC = 'https://mainnet.base.org'
import { ETH_USD_FEED } from './grindConfig.ts'

/** Chainlink ETH/USD latestRoundData via a plain eth_call (keeps viem out of the game bundle). 8 decimals. */
export async function ethPrice(): Promise<bigint> {
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: ETH_USD_FEED, data: '0xfeaf968c' }, 'latest'] }) })
  const { result } = (await r.json()) as { result?: string }
  if (!result || result.length < 130) throw new Error('no price')
  return BigInt(`0x${result.slice(66, 130)}`)
}
