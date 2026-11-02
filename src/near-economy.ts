export type NearMarketAsset = 'UNIT' | 'MEME'
export type NearMarketSide = 'buy' | 'sell'

export type NearMarketOrder = {
  asset: NearMarketAsset
  side: NearMarketSide
  size: number
  quote: number
  expiresAt: number
}

const NPC_SPREAD = 0.01

/** A local NPC quote tracks the live practice-book price with a fixed spread. */
export function quoteNpcMarket(spot: number, side: NearMarketSide): number {
  if (!Number.isFinite(spot) || spot <= 0) return 0
  const multiplier = side === 'buy' ? 1 + NPC_SPREAD : 1 - NPC_SPREAD
  return Math.max(0.0001, Math.round(spot * multiplier * 10_000) / 10_000)
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
    `Expires: ${expiry}`,
    'Execution: local practice book only; no on-chain settlement or real funds.',
  ].join('\n')
}
