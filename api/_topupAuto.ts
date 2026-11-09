// Pure helpers for automatic top-up (no HTTP). Underscore = not a Vercel function.
// Matching: last 6 decimals of the paid amount encode the order tag (USDC micro / ETH wei).
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

export function encodeUsdcAmount(dollars: number, tag: string): bigint {
  if (!Number.isInteger(dollars) || dollars < 1 || dollars > 1000) throw new Error('bad dollars')
  if (!/^[0-9]{6}$/.test(tag)) throw new Error('bad tag')
  return BigInt(dollars) * 1_000_000n + BigInt(tag)
}

/** milliEth * 1e15 + tag wei for uniqueness. */
export function encodeEthAmount(milliEth: number, tag: string): bigint {
  if (!Number.isInteger(milliEth) || milliEth < 1 || milliEth > 100) throw new Error('bad eth')
  if (!/^[0-9]{6}$/.test(tag)) throw new Error('bad tag')
  return BigInt(milliEth) * 10n ** 15n + BigInt(tag)
}

export function randomTag(): string {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, '0')
}

export function formatUsdc(raw: bigint): string {
  const s = raw.toString().padStart(7, '0')
  return `${s.slice(0, -6)}.${s.slice(-6)}`
}

export function formatEth(raw: bigint): string {
  const whole = raw / 10n ** 18n
  const frac = (raw % 10n ** 18n).toString().padStart(18, '0').replace(/0+$/, '')
  return frac ? `${whole}.${frac}` : `${whole}`
}

export type ChainLog = { address: string; topics: string[]; data: string; transactionHash: string; logIndex: string; blockNumber: string }

/** Find a Transfer/EthDeposited to the treasury matching exact amount (and optional from). */
export function matchPaymentLogs(opts: {
  logs: ChainLog[]
  asset: 'USDC' | 'ETH'
  amountRaw: bigint
  from?: string | null
}): { hash: `0x${string}`; from: `0x${string}`; logIndex: number } | null {
  const wantFrom = opts.from?.toLowerCase()
  for (const log of opts.logs) {
    const addr = log.address.toLowerCase()
    if (opts.asset === 'USDC') {
      if (addr !== USDC) continue
      if ((log.topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue
      const to = '0x' + (log.topics[2] ?? '').slice(-40)
      if (to.toLowerCase() !== TREASURY) continue
      const value = BigInt(log.data)
      if (value !== opts.amountRaw) continue
      const from = ('0x' + (log.topics[1] ?? '').slice(-40)).toLowerCase() as `0x${string}`
      if (wantFrom && from !== wantFrom) continue
      return { hash: log.transactionHash.toLowerCase() as `0x${string}`, from, logIndex: parseInt(log.logIndex, 16) }
    }
    if (addr !== TREASURY) continue
    if ((log.topics[0] ?? '').toLowerCase() !== ETH_DEPOSITED) continue
    const from = ('0x' + (log.topics[1] ?? '').slice(-40)).toLowerCase() as `0x${string}`
    if (wantFrom && from !== wantFrom) continue
    const value = BigInt(log.data)
    if (value !== opts.amountRaw) continue
    return { hash: log.transactionHash.toLowerCase() as `0x${string}`, from, logIndex: parseInt(log.logIndex, 16) }
  }
  return null
}

export function orderPublic(row: {
  id: string
  asset: string
  amount_raw: string | number
  tag: string
  status: string
  tx_hash?: string | null
  credit_micro?: string | number | null
  expires_at: string
  player?: string | null
  error?: string | null
}) {
  const raw = BigInt(String(row.amount_raw))
  const credit = row.credit_micro != null ? Number(row.credit_micro) / 1e6 : null
  return {
    orderId: row.id,
    asset: row.asset as 'USDC' | 'ETH',
    amountRaw: raw.toString(),
    amountLabel: row.asset === 'USDC' ? `${formatUsdc(raw)} USDC` : `${formatEth(raw)} ETH`,
    tag: row.tag,
    status: row.status as 'waiting' | 'detected' | 'credited' | 'expired' | 'failed',
    treasury: GRIND_TREASURY_VAULT,
    chainId: 8453,
    usdc: BASE_USDC,
    txHash: row.tx_hash ?? null,
    creditUsd: credit,
    player: row.player ?? null,
    expiresAt: row.expires_at,
    error: row.error ?? null,
  }
}
