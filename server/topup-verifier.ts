import { BASE_USDC_ADDRESS, GRIND_TREASURY_ADDRESS } from '../src/topup-config.ts'

export { BASE_USDC_ADDRESS, GRIND_TREASURY_ADDRESS }
export const BASE_CHAIN_ID = 8453
export const MIN_BASE_CONFIRMATIONS = 12
export const ERC20_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export type RpcCall = (method: string, params: unknown[]) => Promise<unknown>
export type VerifiedTransfer = { logIndex: string; amountMicros: string; blockNumber: string; walletAddress: string }

export class TopupVerificationError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'TopupVerificationError'
    this.status = status
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : null
}

function hexInteger(value: unknown): bigint | null {
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) return null
  try {
    return BigInt(value)
  } catch {
    return null
  }
}

function address(value: unknown): string | null {
  return typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : null
}

function topicAddress(value: unknown): string | null {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/i.test(value) || !/^0{24}$/i.test(value.slice(2, 26))) return null
  return `0x${value.slice(-40).toLowerCase()}`
}

export async function verifyBaseTransfers(hash: string, linkedWallets: string[], rpc: RpcCall): Promise<VerifiedTransfer[]> {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) throw new TopupVerificationError('Enter a valid 32-byte transaction hash.', 400)
  const txHash = hash.toLowerCase()
  const wallets = new Set(linkedWallets.map(address).filter((value): value is string => value !== null))
  if (!wallets.size) throw new TopupVerificationError('Link an Ethereum wallet to your Privy account first.', 403)

  let chainId: unknown
  let txResult: unknown
  let receiptResult: unknown
  let latestResult: unknown
  try {
    ;[chainId, txResult, receiptResult] = await Promise.all([
      rpc('eth_chainId', []),
      rpc('eth_getTransactionByHash', [txHash]),
      rpc('eth_getTransactionReceipt', [txHash]),
    ])
    if (receiptResult) {
      const receipt = record(receiptResult)
      const blockNumber = hexInteger(receipt?.blockNumber)
      if (blockNumber !== null) latestResult = await rpc('eth_blockNumber', [])
    }
  } catch {
    throw new TopupVerificationError('Base could not verify that transaction right now.', 503)
  }

  if (hexInteger(chainId) !== BigInt(BASE_CHAIN_ID)) throw new TopupVerificationError('The configured RPC is not Base mainnet.', 503)
  const tx = record(txResult)
  if (!tx) throw new TopupVerificationError('Transaction was not found on Base.', 404)
  if (typeof tx.hash !== 'string' || tx.hash.toLowerCase() !== txHash) throw new TopupVerificationError('Base returned a different transaction.', 503)
  const receipt = record(receiptResult)
  if (!receipt) throw new TopupVerificationError('Transaction is still pending on Base.', 409)
  if (typeof receipt.transactionHash !== 'string' || receipt.transactionHash.toLowerCase() !== txHash) throw new TopupVerificationError('Base returned a receipt for a different transaction.', 503)
  if (receipt.status !== '0x1') throw new TopupVerificationError('The Base transaction did not succeed.', 400)
  const blockNumber = hexInteger(receipt.blockNumber)
  const latestBlock = hexInteger(latestResult)
  if (blockNumber === null || latestBlock === null || latestBlock < blockNumber) throw new TopupVerificationError('Base has not confirmed this transaction yet.', 409)
  if (latestBlock - blockNumber + 1n < BigInt(MIN_BASE_CONFIRMATIONS)) {
    throw new TopupVerificationError(`Wait for ${MIN_BASE_CONFIRMATIONS} Base confirmations before claiming this deposit.`, 409)
  }

  if (!Array.isArray(receipt.logs)) throw new TopupVerificationError('Base returned an invalid transaction receipt.', 503)
  const transfers: VerifiedTransfer[] = []
  for (const rawLog of receipt.logs) {
    const log = record(rawLog)
    const logAddress = address(log?.address)
    if (logAddress !== BASE_USDC_ADDRESS.toLowerCase() || !Array.isArray(log?.topics) || log.topics.length !== 3) continue
    if (typeof log.topics[0] !== 'string' || log.topics[0].toLowerCase() !== ERC20_TRANSFER_TOPIC) continue
    const logSender = topicAddress(log.topics[1])
    if (!logSender || !wallets.has(logSender) || topicAddress(log.topics[2]) !== GRIND_TREASURY_ADDRESS.toLowerCase()) continue
    const amount = typeof log.data === 'string' && /^0x[0-9a-f]{64}$/i.test(log.data) ? BigInt(log.data) : 0n
    const logIndex = hexInteger(log.logIndex)
    if (amount <= 0n || logIndex === null) continue
    transfers.push({ logIndex: logIndex.toString(), amountMicros: amount.toString(), blockNumber: blockNumber.toString(), walletAddress: logSender })
  }

  if (!transfers.length) throw new TopupVerificationError('No Base USDC transfer from your linked wallet to GrindTreasury was found.', 400)
  return transfers
}
