// Economy display rules. Mechanics unchanged: this only describes fees and the top-up config.
export const TRANSFER_FEE_BPS = 200 // 2% on player-to-player transfers, credited to the treasury ledger
export const TREASURY_SAFE = '0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a'

export function transferQuote(amount: number): { fee: number; net: number } {
  const fee = Math.round(amount * TRANSFER_FEE_BPS) / 10000
  return { fee, net: Math.round((amount - fee) * 100) / 100 }
}

export const TOPUP = {
  address: (import.meta.env.VITE_TOPUP_ADDRESS ?? '') as string,
  contract: (import.meta.env.VITE_CONTRACT_ADDRESS ?? '') as string,
  chainId: Number(import.meta.env.VITE_CHAIN_ID ?? '8453'),
  rate: Number(import.meta.env.VITE_TOPUP_RATE ?? '0'), // in-game $ per 1 USDC
}
export const topupReady = () => /^0x[0-9a-fA-F]{40}$/.test(TOPUP.contract || TOPUP.address) && TOPUP.rate > 0
