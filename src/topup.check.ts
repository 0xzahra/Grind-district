import { claimVerifiedTransfers, type TopupClaim, type TopupClaimStore } from '../server/topup-credit.ts'
import {
  BASE_CHAIN_ID,
  BASE_USDC_ADDRESS,
  ERC20_TRANSFER_TOPIC,
  GRIND_TREASURY_ADDRESS,
  TopupVerificationError,
  verifyBaseTransfers,
} from '../server/topup-verifier.ts'
import { formatUsdcMicros } from './topup-config.ts'

let failed = 0

function check(condition: boolean, message: string): void {
  if (condition) return
  failed += 1
  console.error(message)
}

async function rejects(action: Promise<unknown>, status: number, message: string): Promise<void> {
  try {
    await action
    check(false, message)
  } catch (error) {
    check(error instanceof TopupVerificationError && error.status === status, message)
  }
}

const hash = `0x${'1'.repeat(64)}`
const wallet = '0x1111111111111111111111111111111111111111'
const otherWallet = '0x2222222222222222222222222222222222222222'
const otherToken = '0x3333333333333333333333333333333333333333'

function addressTopic(value: string): string {
  return `0x${'0'.repeat(24)}${value.slice(2).toLowerCase()}`
}

function makeLog(options: { token?: string; from?: string; to?: string; amount?: bigint; logIndex?: string } = {}): Record<string, unknown> {
  const amount = options.amount ?? 12_500_000n
  return {
    address: options.token ?? BASE_USDC_ADDRESS,
    topics: [ERC20_TRANSFER_TOPIC, addressTopic(options.from ?? wallet), addressTopic(options.to ?? GRIND_TREASURY_ADDRESS)],
    data: `0x${amount.toString(16).padStart(64, '0')}`,
    logIndex: options.logIndex ?? '0x2',
  }
}

function makeRpc(options: {
  chainId?: string
  sender?: string
  txHash?: string
  receiptHash?: string
  receiptStatus?: string
  receiptBlock?: string
  latestBlock?: string
  logs?: unknown[]
  receipt?: unknown
} = {}) {
  const transaction = { hash: options.txHash ?? hash, from: options.sender ?? wallet }
  const receipt = options.receipt === undefined ? {
    transactionHash: options.receiptHash ?? hash,
    status: options.receiptStatus ?? '0x1',
    blockNumber: options.receiptBlock ?? '0x10',
    logs: options.logs ?? [makeLog()],
  } : options.receipt
  return async (method: string): Promise<unknown> => {
    if (method === 'eth_chainId') return options.chainId ?? `0x${BASE_CHAIN_ID.toString(16)}`
    if (method === 'eth_getTransactionByHash') return transaction
    if (method === 'eth_getTransactionReceipt') return receipt
    if (method === 'eth_blockNumber') return options.latestBlock ?? '0x20'
    throw new Error(`Unexpected RPC method: ${method}`)
  }
}

const accepted = await verifyBaseTransfers(hash, [wallet], makeRpc())
check(accepted.length === 1 && accepted[0].amountMicros === '12500000' && accepted[0].logIndex === '2', 'accepts an earlier Base USDC deposit and derives its amount from the receipt')
check(accepted[0]?.walletAddress === wallet && accepted[0]?.blockNumber === '16', 'attributes the claim to the linked wallet and receipt block')
const relayed = await verifyBaseTransfers(hash, [wallet], makeRpc({ sender: otherWallet }))
check(relayed[0]?.walletAddress === wallet, 'attributes sponsored transactions to the linked USDC transfer sender')
check(formatUsdcMicros('12500000') === '$12.500000 USDC', 'formats six-decimal USDC precisely')

await rejects(verifyBaseTransfers('not-a-hash', [wallet], makeRpc()), 400, 'rejects malformed transaction hashes')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ chainId: '0x1' })), 503, 'rejects an RPC that is not on Base mainnet')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ receipt: null })), 409, 'does not credit a pending transaction')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ receiptStatus: '0x0' })), 400, 'rejects failed Base transactions')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ latestBlock: '0x1a' })), 409, 'requires the full confirmation threshold')
await rejects(verifyBaseTransfers(hash, [otherWallet], makeRpc()), 400, 'rejects a transfer sender not linked to the Privy account')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ logs: [makeLog({ token: otherToken })] })), 400, 'rejects non-USDC transfer logs')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ logs: [makeLog({ to: otherWallet })] })), 400, 'rejects transfers to the wrong recipient')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ logs: [makeLog({ from: otherWallet })] })), 400, 'rejects transfers from a different wallet')
await rejects(verifyBaseTransfers(hash, [wallet], makeRpc({ logs: [makeLog({ amount: 0n })] })), 400, 'rejects zero-amount transfer logs')

const claims = new Map<string, TopupClaim>()
const balances = new Map<string, bigint>()
const store: TopupClaimStore = {
  async claim(claim) {
    const key = `${claim.chainId}:${claim.txHash}:${claim.logIndex}`
    if (claims.has(key)) return false
    claims.set(key, claim)
    balances.set(claim.privyUserId, (balances.get(claim.privyUserId) ?? 0n) + BigInt(claim.amountMicros))
    return true
  },
  async balance(privyUserId) {
    return (balances.get(privyUserId) ?? 0n).toString()
  },
}
const firstClaim = await claimVerifiedTransfers(hash, 'did:privy:player-1', accepted, store)
const duplicateClaim = await claimVerifiedTransfers(hash, 'did:privy:player-1', accepted, store)
const otherPlayerClaim = await claimVerifiedTransfers(hash, 'did:privy:player-2', accepted, store)
check(firstClaim.creditedMicros === '12500000' && firstClaim.balanceMicros === '12500000' && !firstClaim.alreadyProcessed, 'first verified log credits once to the authenticated player')
check(duplicateClaim.creditedMicros === '0' && duplicateClaim.balanceMicros === '12500000' && duplicateClaim.alreadyProcessed, 'duplicate log does not credit the same player twice')
check(otherPlayerClaim.creditedMicros === '0' && otherPlayerClaim.balanceMicros === '0', 'a duplicate log cannot be reassigned to another player')

if (failed) throw new Error(`${failed} top-up checks failed.`)
console.log('Top-up verification checks passed.')
