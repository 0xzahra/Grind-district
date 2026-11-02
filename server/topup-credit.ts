import type { VerifiedTransfer } from './topup-verifier.ts'

export type TopupClaim = {
  chainId: 8453
  txHash: string
  logIndex: string
  privyUserId: string
  walletAddress: string
  amountMicros: string
  blockNumber: string
}

export type TopupClaimStore = {
  claim: (claim: TopupClaim) => Promise<boolean>
  balance: (privyUserId: string) => Promise<string>
}

export type TopupCreditResult = {
  creditedMicros: string
  balanceMicros: string
  alreadyProcessed: boolean
}

export async function claimVerifiedTransfers(
  txHash: string,
  privyUserId: string,
  transfers: VerifiedTransfer[],
  store: TopupClaimStore,
): Promise<TopupCreditResult> {
  let creditedMicros = 0n
  for (const transfer of transfers) {
    const inserted = await store.claim({
      chainId: 8453,
      txHash: txHash.toLowerCase(),
      logIndex: transfer.logIndex,
      privyUserId,
      walletAddress: transfer.walletAddress.toLowerCase(),
      amountMicros: transfer.amountMicros,
      blockNumber: transfer.blockNumber,
    })
    if (inserted) creditedMicros += BigInt(transfer.amountMicros)
  }
  return {
    creditedMicros: creditedMicros.toString(),
    balanceMicros: await store.balance(privyUserId),
    alreadyProcessed: creditedMicros === 0n,
  }
}
