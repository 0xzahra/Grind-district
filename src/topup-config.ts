export const GRIND_TREASURY_ADDRESS = '0x6bc81e26832986d56b6e59c31599f3113971ec33'
export const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bda02913'

export function formatUsdcMicros(value: string): string {
  if (!/^\d+$/.test(value)) return '$0.000000 USDC'
  const amount = BigInt(value)
  const whole = (amount / 1_000_000n).toString()
  const fraction = (amount % 1_000_000n).toString().padStart(6, '0')
  return `$${whole}.${fraction} USDC`
}
