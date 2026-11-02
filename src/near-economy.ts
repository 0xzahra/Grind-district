import type { Season } from './logic.ts'

export type NearMarketAsset = 'UNIT' | 'MEME'
export type NearMarketSide = 'buy' | 'sell'

export type NearMarketOrder = {
  asset: NearMarketAsset
  side: NearMarketSide
  size: number
  quote: number
  season: Season
  expiresAt: number
}

/** A local NPC market-maker quote follows the live practice book and the city season. */
export function quoteNpcMarket(spot: number, side: NearMarketSide, season: Season): number {
  if (!Number.isFinite(spot) || spot <= 0) return 0
  const spread = side === 'buy' ? 0.01 : -0.01
  const seasonalShift = season === 'bull' ? 0.005 : -0.005
  return Math.max(0.0001, Math.round(spot * (1 + spread + seasonalShift) * 10_000) / 10_000)
}

/** Deliberately excludes player names, usernames, profile data, and wallet IDs. */
export function nearMarketOrderMessage(order: NearMarketOrder): string {
  const percent = Math.round(order.size * 100)
  const price = order.quote.toFixed(4)
  const expiry = new Date(order.expiresAt).toISOString()
  return [
    'Grind District market order',
    `Order: ${order.side.toUpperCase()} ${percent}% ${order.asset}`,
    `NPC quote: ${price} practice USD per ${order.asset}`,
    `Market mood: ${order.season}`,
    `Expires: ${expiry}`,
    'Execution: local practice book only; no on-chain settlement or real funds.',
  ].join('\n')
}
