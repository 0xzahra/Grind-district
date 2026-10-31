import { createPublicClient, createWalletClient, http, parseEventLogs, type Hash, type Address, type Chain } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { grindLedgerAbi } from '../src/grindLedgerAbi.js'
import { grindTreasuryAbi } from '../src/grindTreasuryAbi.js'
import { GRIND_LEDGER, GRIND_TREASURY_VAULT, BASE_USDC, ETH_USD_FEED, feedAbi, breakdown, ethToUsdMicro } from '../src/grindConfig.js'

// Core of /api/topup-confirm, kept free of HTTP/Supabase so it can run against an Anvil fork.
export type Store = {
  get(hash: string): Promise<{ status: string; credit_micro?: string } | null>
  claim(row: Record<string, unknown>): Promise<boolean> // false if the hash is already claimed
  update(hash: string, patch: Record<string, unknown>): Promise<void>
}
export type Result =
  | { ok: true; already: boolean; player: Address; asset: 'ETH' | 'USDC'; paid: string; feeUsd: number; creditUsd: number; creditTx?: Hash }
  | { ok: false; code: number; error: string }

export async function confirmTopup(opts: { hash: Hash; rpc: string; operatorKey: `0x${string}`; store: Store; chain?: Chain; minConfirmations?: number; userId?: string | null }): Promise<Result> {
  const chain = opts.chain ?? base
  const pub = createPublicClient({ chain, transport: http(opts.rpc) })
  const receipt = await pub.getTransactionReceipt({ hash: opts.hash }).catch(() => null)
  if (!receipt) return { ok: false, code: 409, error: 'transaction not found or not mined yet' }
  if (receipt.status !== 'success') return { ok: false, code: 400, error: 'transaction reverted' }
  const to = (receipt.to ?? '').toLowerCase()
  if (to !== GRIND_LEDGER && to !== GRIND_TREASURY_VAULT) return { ok: false, code: 400, error: 'not a GrindLedger or GrindTreasury transaction' }
  const head = await pub.getBlockNumber()
  if (head - receipt.blockNumber + 1n < BigInt(opts.minConfirmations ?? 2)) return { ok: false, code: 409, error: 'waiting for confirmations' }
  // Payment event: GrindLedger.TopUp, or GrindTreasury.ERC20Deposited / EthDeposited (emitted by the treasury itself).
  let player: Address, asset: Address, amount: bigint
  if (to === GRIND_LEDGER) {
    const ev = parseEventLogs({ abi: grindLedgerAbi, logs: receipt.logs, eventName: 'TopUp' }).find((l) => l.address.toLowerCase() === GRIND_LEDGER)
    if (!ev) return { ok: false, code: 400, error: 'no TopUp event' }
    ;({ player, asset, amount } = ev.args)
  } else {
    const logs = receipt.logs.filter((l) => l.address.toLowerCase() === GRIND_TREASURY_VAULT)
    const erc = parseEventLogs({ abi: grindTreasuryAbi, logs, eventName: 'ERC20Deposited' })[0]
    const ethEv = parseEventLogs({ abi: grindTreasuryAbi, logs, eventName: 'EthDeposited' })[0]
    if (erc) ({ token: asset, from: player, amount } = erc.args)
    else if (ethEv) { player = ethEv.args.from; amount = ethEv.args.amount; asset = '0x0000000000000000000000000000000000000000' }
    else return { ok: false, code: 400, error: 'no treasury deposit event' }
  }
  if (player.toLowerCase() !== receipt.from.toLowerCase()) return { ok: false, code: 400, error: 'player mismatch' }
  const isEth = asset === '0x0000000000000000000000000000000000000000'
  if (!isEth && asset.toLowerCase() !== BASE_USDC.toLowerCase()) return { ok: false, code: 400, error: 'unknown asset' }
  let usdMicro = amount
  if (isEth) {
    // Price at the payment block, so a retry later credits the same amount.
    const [, answer, , updatedAt] = await pub.readContract({ address: ETH_USD_FEED, abi: feedAbi, functionName: 'latestRoundData', blockNumber: receipt.blockNumber })
    if (answer <= 0n) return { ok: false, code: 503, error: 'no ETH price' }
    void updatedAt
    usdMicro = ethToUsdMicro(amount, answer)
  }
  const b = breakdown(usdMicro)
  const out = (already: boolean, creditTx?: Hash): Result => ({ ok: true, already, player, asset: isEth ? 'ETH' : 'USDC', paid: amount.toString(), feeUsd: Number(b.fee) / 1e6, creditUsd: Number(b.credit) / 1e6, creditTx })
  if (b.credit === 0n) return { ok: false, code: 400, error: 'amount too small' }

  const prior = await opts.store.get(opts.hash)
  if (prior?.status === 'credited') return out(true)
  if (prior && prior.status !== 'failed') return { ok: false, code: 409, error: `already ${prior.status}` }
  const row = { tx_hash: opts.hash, player: player.toLowerCase(), privy_user_id: opts.userId ?? null, asset: isEth ? 'ETH' : 'USDC', amount_raw: amount.toString(), usd_micro: usdMicro.toString(), fee_micro: b.fee.toString(), credit_micro: b.credit.toString(), block_number: Number(receipt.blockNumber), status: 'pending' }
  if (prior?.status === 'failed') await opts.store.update(opts.hash, { status: 'pending', error: null })
  else if (!(await opts.store.claim(row))) return { ok: false, code: 409, error: 'already being processed' }

  const ref = opts.hash as `0x${string}` // bytes32 ref = tx hash: the contract also refuses a second credit
  if (await pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'creditedRef', args: [ref] })) {
    await opts.store.update(opts.hash, { status: 'credited' })
    return out(true)
  }
  const grind = b.credit * 10n ** 12n // micro-dollars -> 18-decimal GRIND
  const day = BigInt(Math.floor(Date.now() / 1000 / 86400))
  const [cap, used] = await Promise.all([
    pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'dailyCreditCap' }),
    pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'creditedOnDay', args: [day] }),
  ])
  if (used + grind > cap) {
    await opts.store.update(opts.hash, { status: 'failed', error: 'daily cap reached' })
    return { ok: false, code: 429, error: 'daily credit cap reached; try again tomorrow' }
  }
  try {
    const account = privateKeyToAccount(opts.operatorKey)
    const wallet = createWalletClient({ account, chain, transport: http(opts.rpc) })
    const { request } = await pub.simulateContract({ account, address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'credit', args: [player, grind, ref] })
    const creditTx = await wallet.writeContract(request)
    const r = await pub.waitForTransactionReceipt({ hash: creditTx })
    if (r.status !== 'success') throw new Error('credit reverted')
    await opts.store.update(opts.hash, { status: 'credited', credit_tx: creditTx, credited_at: new Date().toISOString() })
    return out(false, creditTx)
  } catch (e) {
    await opts.store.update(opts.hash, { status: 'failed', error: String((e as Error).message ?? e).slice(0, 300) })
    return { ok: false, code: 502, error: 'credit failed; retry shortly' }
  }
}
