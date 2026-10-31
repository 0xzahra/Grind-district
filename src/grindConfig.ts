// Grind District on Base mainnet (chain 8453). Shared by the client top-up sheet and /api/topup-confirm.
export const BASE_CHAIN_ID = 8453
export const GRIND_LEDGER = '0x88091d65d38a4e153267f43744fb48e10e456d30' as const
export const GRIND_TREASURY_VAULT = '0x6bc81e26832986d56b6e59c31599f3113971ec33' as const
export const TREASURY_SAFE = '0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a' as const
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const
/** Chainlink ETH/USD on Base (8 decimals). Live price for ETH top-ups. */
export const ETH_USD_FEED = '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' as const
export const FEE_BPS = 200n // 2%, same as GrindLedger.FEE_BPS
/** Rate: 1 USD paid = 1 in-game $, minus the 2% fee. 1 in-game $ = 1 GRIND (18 decimals). */
export const feedAbi = [{ type: 'function', name: 'latestRoundData', stateMutability: 'view', inputs: [], outputs: [
  { name: 'roundId', type: 'uint80' }, { name: 'answer', type: 'int256' }, { name: 'startedAt', type: 'uint256' },
  { name: 'updatedAt', type: 'uint256' }, { name: 'answeredInRound', type: 'uint80' }] }] as const

/** USD value in micro-dollars (6 dp) -> { fee, credit } in micro-dollars. */
export function breakdown(usdMicro: bigint): { paid: bigint; fee: bigint; credit: bigint } {
  const fee = (usdMicro * FEE_BPS) / 10_000n
  return { paid: usdMicro, fee, credit: usdMicro - fee }
}
/** wei * price(8dp) -> micro-dollars */
export const ethToUsdMicro = (wei: bigint, price8: bigint) => (wei * price8) / 10n ** 20n
