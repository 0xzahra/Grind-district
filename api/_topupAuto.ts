// Pure helpers for automatic top-up (no HTTP). Underscore = not a Vercel function.
// Matching: exact preset amount + connected payer address (no decimal tag codes).
// Addresses mirrored from src/grindConfig.ts (avoid .js/.ts import friction in node checks).
export const GRIND_TREASURY_VAULT = '0x6bc81e26832986d56b6e59c31599f3113971ec33' as const
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
export const TREASURY = GRIND_TREASURY_VAULT.toLowerCase()
export const USDC = BASE_USDC.toLowerCase()
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
/** keccak256("EthDeposited(address,uint256)") — from indexed, amount in data */
export const ETH_DEPOSITED = '0x66ff7c8f71ccc7c36152a41920d0d3b46ef3034359f76aa1498ed4478c204b5c'

export const ORDER_TTL_MS = 30 * 60 * 1000
export const PRESET_USDC = [5, 10, 25, 50, 100] as const
export const PRESET_MILLI_ETH = [1, 5, 10] as const

/** Exact whole USDC dollars → 6-decimal base units (e.g. 5 → 5000000). */
export function encodeUsdcAmount(dollars: number): bigint {
  if (!Number.isInteger(dollars) || dollars < 1 || dollars > 1000) throw new Error('bad dollars')
  return BigInt(dollars) * 1_000_000n
}

export const MIN_USDC = 1
export const MAX_USDC = 1000
/** Custom USDC amount (player's choice, up to 2 decimals, MIN_USDC..MAX_USDC) → 6-decimal units. */
export function encodeUsdcCustom(dollars: number): bigint {
  if (!Number.isFinite(dollars) || dollars < MIN_USDC || dollars > MAX_USDC) throw new Error(`pick between ${MIN_USDC} and ${MAX_USDC} USDC`)
  const cents = Math.round(dollars * 100)
  if (Math.abs(dollars * 100 - cents) > 1e-6) throw new Error('use at most 2 decimals')
  return BigInt(cents) * 10_000n
}

/** Exact milli-ETH → wei (e.g. 1 → 1e15 = 0.001 ETH). */
export function encodeEthAmount(milliEth: number): bigint {
  if (!Number.isInteger(milliEth) || milliEth < 1 || milliEth > 100) throw new Error('bad eth')
  return BigInt(milliEth) * 10n ** 15n
}

export function formatUsdc(raw: bigint): string {
  const whole = raw / 1_000_000n
  const frac = (raw % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
}

export function formatEth(raw: bigint): string {
  const whole = raw / 10n ** 18n
  const frac = (raw % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
}

export function amountLabel(asset: 'USDC' | 'ETH', raw: bigint): string {
  return asset === 'USDC' ? `$${formatUsdc(raw)}` : `${formatEth(raw)} ETH`
}

type Log = { address?: string; topics?: string[]; data?: string; transactionHash?: string; logIndex?: string; blockNumber?: string }

/** Find a Transfer/EthDeposited to the treasury matching exact amount FROM the connected payer. */
export function matchPaymentLogs(opts: {
  logs: Log[]
  asset: 'USDC' | 'ETH'
  amountRaw: bigint
  from: string
}): { hash: string; logIndex: number; blockNumber: number } | null {
  const from = opts.from.toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(from)) return null
  const want = opts.amountRaw
  for (const log of opts.logs) {
    const topics = (log.topics || []).map((t) => t.toLowerCase())
    const data = (log.data || '0x').toLowerCase()
    const addr = (log.address || '').toLowerCase()
    if (opts.asset === 'USDC') {
      if (addr !== USDC) continue
      if (topics[0] !== TRANSFER_TOPIC) continue
      if (topics.length < 3) continue
      const topicFrom = '0x' + topics[1].slice(-40)
      const topicTo = '0x' + topics[2].slice(-40)
      if (topicFrom !== from) continue
      if (topicTo !== TREASURY) continue
      const amount = BigInt(data)
      if (amount !== want) continue
    } else {
      if (addr !== TREASURY) continue
      if (topics[0] !== ETH_DEPOSITED) continue
      if (topics.length < 2) continue
      const topicFrom = '0x' + topics[1].slice(-40)
      if (topicFrom !== from) continue
      const amount = BigInt(data)
      if (amount !== want) continue
    }
    const hash = (log.transactionHash || '').toLowerCase()
    if (!/^0x[0-9a-f]{64}$/.test(hash)) continue
    return {
      hash,
      logIndex: Number.parseInt(log.logIndex || '0', 16),
      blockNumber: Number.parseInt(log.blockNumber || '0', 16),
    }
  }
  return null
}

/** Among open orders for same payer+asset+amount, credit the oldest. One tx → one order. */
export function pickOrderForPayment(opts: {
  openOrders: { id: string; created_at: string; status?: string; tx_hash?: string | null }[]
  scannedOrderId: string
  txHash: string
  ordersByTx?: Record<string, string>
}): { ok: true; orderId: string } | { ok: false; reason: 'tx_taken' | 'not_oldest' | 'empty' } {
  const tx = opts.txHash.toLowerCase()
  const byTx = opts.ordersByTx || {}
  if (byTx[tx] && byTx[tx] !== opts.scannedOrderId) return { ok: false, reason: 'tx_taken' }
  const open = [...opts.openOrders].sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (!open.length) return { ok: false, reason: 'empty' }
  const oldest = open[0]
  // If oldest already owns this tx, allow that order through
  if (oldest.tx_hash && oldest.tx_hash.toLowerCase() === tx) {
    return oldest.id === opts.scannedOrderId
      ? { ok: true, orderId: oldest.id }
      : { ok: false, reason: 'tx_taken' }
  }
  if (oldest.id !== opts.scannedOrderId) return { ok: false, reason: 'not_oldest' }
  return { ok: true, orderId: oldest.id }
}

export function orderPublic(row: {
  id: string
  asset: string
  amount_raw: string | number
  tag?: string | null
  player?: string | null
  status: string
  tx_hash?: string | null
  expires_at: string
}) {
  const raw = BigInt(row.amount_raw)
  const asset = row.asset === 'ETH' ? 'ETH' as const : 'USDC' as const
  return {
    orderId: row.id,
    asset,
    amountRaw: raw.toString(),
    amountTag: row.tag || null,
    from: row.player || null,
    status: row.status,
    txHash: row.tx_hash || null,
    expiresAt: row.expires_at,
    amountLabel: amountLabel(asset, raw),
    amountDisplay: asset === 'USDC' ? formatUsdc(raw) : formatEth(raw),
  }
}
