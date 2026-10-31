// End-to-end top-up test on an Anvil fork of Base mainnet. No real transactions: everything runs on the local fork.
// Run: anvil --fork-url https://mainnet.base.org --port 8546 & ; then node tests/run-fork.mjs
import { createPublicClient, createTestClient, createWalletClient, http, parseEther, parseUnits, erc20Abi, type Address } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base } from 'viem/chains'
import { confirmTopup, type Store } from '../api/_grind.ts'
import { grindLedgerAbi } from '../src/grindLedgerAbi.ts'
import { GRIND_LEDGER, GRIND_TREASURY_VAULT, BASE_USDC, TREASURY_SAFE } from '../src/grindConfig.ts'
import { grindTreasuryAbi } from '../src/grindTreasuryAbi.ts'
import { Attribution } from 'ox/erc8021'

const RPC = process.env.FORK_RPC ?? 'http://127.0.0.1:8546'
const chain = { ...base, rpcUrls: { default: { http: [RPC] } } }
const pub = createPublicClient({ chain, transport: http(RPC) })
const test = createTestClient({ chain, mode: 'anvil', transport: http(RPC) })
const OP_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const // anvil #0, fork-only test operator
const op = privateKeyToAccount(OP_KEY)
const PLAYER = '0x00000000000000000000000000000000000Pa1e5'.replace('Pa1e5', 'a11e5') as Address
let pass = 0, fail = 0
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('  ok', m) } else { fail++; console.log('  FAIL', m) } }

const rows = new Map<string, Record<string, unknown>>()
const store: Store = {
  async get(h) { return (rows.get(h) as { status: string } | undefined) ?? null },
  async claim(r) { if (rows.has(String(r.tx_hash))) return false; rows.set(String(r.tx_hash), { ...r }); return true },
  async update(h, p) { rows.set(h, { ...rows.get(h), ...p }) },
}
const run = (hash: `0x${string}`) => confirmTopup({ hash, rpc: RPC, operatorKey: OP_KEY, store, chain, minConfirmations: 1 })

async function main() {
  const id = await pub.getChainId(); ok(id === 8453, `fork chain id ${id}`)
  // Safe adds the fork-only operator (impersonated; only on the fork).
  await test.impersonateAccount({ address: TREASURY_SAFE }); await test.setBalance({ address: TREASURY_SAFE, value: parseEther('1') })
  const safeW = createWalletClient({ account: TREASURY_SAFE, chain, transport: http(RPC) })
  await pub.waitForTransactionReceipt({ hash: await safeW.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'setOperator', args: [op.address, true] }) })
  ok(await pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'isOperator', args: [op.address] }), 'fork operator set by Safe')

  // Player gets USDC from a real holder (impersonated) and ETH.
  await test.impersonateAccount({ address: PLAYER }); await test.setBalance({ address: PLAYER, value: parseEther('1') })
  const HOLDER = '0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB' as Address // Aave aBasUSDC: large real USDC holder on Base
  await test.impersonateAccount({ address: HOLDER }); await test.setBalance({ address: HOLDER, value: parseEther('1') })
  const hw = createWalletClient({ account: HOLDER, chain, transport: http(RPC) })
  await pub.waitForTransactionReceipt({ hash: await hw.writeContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'transfer', args: [PLAYER, parseUnits('100', 6)] }) })
  const pw = createWalletClient({ account: PLAYER, chain, transport: http(RPC) })
  const safeUsdc0 = await pub.readContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [TREASURY_SAFE] })

  // USDC: approve + topUpUSDC(10)
  await pub.waitForTransactionReceipt({ hash: await pw.writeContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'approve', args: [GRIND_LEDGER, parseUnits('10', 6)] }) })
  const h1 = await pw.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'topUpUSDC', args: [parseUnits('10', 6), `0x${'11'.repeat(32)}`] })
  await pub.waitForTransactionReceipt({ hash: h1 })
  const safeUsdc1 = await pub.readContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [TREASURY_SAFE] })
  ok(safeUsdc1 - safeUsdc0 === parseUnits('10', 6), 'full 10 USDC landed in the Safe (contract forwards on-chain)')
  const r1 = await run(h1)
  ok(r1.ok && r1.creditUsd === 9.8 && r1.feeUsd === 0.2 && !r1.already, `USDC confirm credits $9.80, fee $0.20 (${JSON.stringify(r1).slice(0, 120)})`)
  ok((await pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'balanceOf', args: [PLAYER] })) === parseEther('9.8'), 'player holds 9.8 GRIND on-chain')
  ok(rows.get(h1)?.status === 'credited', 'store row credited')
  const r1b = await run(h1); ok(r1b.ok && r1b.already, 'second confirm of same tx is idempotent (already)')
  ok((await pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'balanceOf', args: [PLAYER] })) === parseEther('9.8'), 'no double credit')
  rows.delete(h1); const r1c = await run(h1); ok(r1c.ok && r1c.already, 'even with the DB row lost, on-chain creditedRef blocks a double credit')

  // ETH: topUp 0.001 ETH, credited at Chainlink price at that block
  const h2 = await pw.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'topUp', args: [`0x${'22'.repeat(32)}`], value: parseEther('0.001') })
  await pub.waitForTransactionReceipt({ hash: h2 })
  const r2 = await run(h2)
  ok(r2.ok && r2.creditUsd > 0.5 && r2.creditUsd < 20 && Math.abs(r2.feeUsd / (r2.feeUsd + r2.creditUsd) - 0.02) < 1e-4, `ETH confirm credits ${r2.ok ? r2.creditUsd : '?'} (fee ${r2.ok ? r2.feeUsd : '?'})`)

  // Rejects: a non-ledger tx (plain USDC approve)
  const h3 = await pw.writeContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'approve', args: [GRIND_LEDGER, 0n] })
  await pub.waitForTransactionReceipt({ hash: h3 })
  const r3 = await run(h3); ok(!r3.ok && r3.code === 400, `wrong contract rejected (${!r3.ok && r3.error})`)
  const r4 = await run(`0x${'ab'.repeat(32)}`); ok(!r4.ok && r4.code === 409, 'unknown hash -> 409')

  // GrindTreasury USDC: approve + depositERC20 with the Builder Code suffix (what src/topup.ts sends)
  const SUFFIX = Attribution.toDataSuffix({ codes: ['bc_ke1fy1yi'] })
  const vault0 = await pub.readContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [GRIND_TREASURY_VAULT] })
  const g0 = await pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'balanceOf', args: [PLAYER] })
  await pub.waitForTransactionReceipt({ hash: await pw.writeContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'approve', args: [GRIND_TREASURY_VAULT, parseUnits('20', 6)], dataSuffix: SUFFIX }) })
  const ht = await pw.writeContract({ address: GRIND_TREASURY_VAULT, abi: grindTreasuryAbi, functionName: 'depositERC20', args: [BASE_USDC, parseUnits('20', 6)], dataSuffix: SUFFIX })
  await pub.waitForTransactionReceipt({ hash: ht })
  ok((await pub.getTransaction({ hash: ht })).input.endsWith(SUFFIX.slice(2)), 'treasury deposit tx carries Builder Code suffix')
  ok((await pub.readContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'balanceOf', args: [GRIND_TREASURY_VAULT] })) - vault0 === parseUnits('20', 6), '20 USDC landed in GrindTreasury')
  const rt = await run(ht)
  ok(rt.ok && rt.creditUsd === 19.6 && rt.feeUsd === 0.4 && rt.asset === 'USDC', `treasury USDC confirm credits $19.60 (${JSON.stringify(rt).slice(0, 100)})`)
  ok((await pub.readContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'balanceOf', args: [PLAYER] })) - g0 === parseEther('19.6'), 'GrindLedger credited 19.6 GRIND for treasury deposit')
  ok((await run(ht)).ok, 'treasury deposit confirm idempotent')
  // GrindTreasury ETH: plain send credits; ETH with calldata (suffix) reverts (no fallback)
  const he = await pw.sendTransaction({ to: GRIND_TREASURY_VAULT, value: parseEther('0.001') })
  await pub.waitForTransactionReceipt({ hash: he })
  const re = await run(he); ok(re.ok && re.asset === 'ETH' && re.creditUsd > 0.5, 'plain ETH to treasury credits')
  let reverted = false
  try { await pub.call({ account: PLAYER, to: GRIND_TREASURY_VAULT, value: parseEther('0.001'), data: SUFFIX }) } catch { reverted = true }
  ok(reverted, 'ETH + Builder Code suffix to treasury reverts (so ETH stays on GrindLedger.topUp)')

  // Cap: Safe lowers the cap to 1 GRIND; next top-up is refused with 429 and nothing minted
  await pub.waitForTransactionReceipt({ hash: await safeW.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'setDailyCreditCap', args: [parseEther('1')] }) })
  await pub.waitForTransactionReceipt({ hash: await pw.writeContract({ address: BASE_USDC, abi: erc20Abi, functionName: 'approve', args: [GRIND_LEDGER, parseUnits('5', 6)] }) })
  const h5 = await pw.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'topUpUSDC', args: [parseUnits('5', 6), `0x${'55'.repeat(32)}`] })
  await pub.waitForTransactionReceipt({ hash: h5 })
  const r5 = await run(h5); ok(!r5.ok && r5.code === 429, 'daily cap respected (429)')
  ok(rows.get(h5)?.status === 'failed', 'capped top-up stays retryable (failed)')
  await pub.waitForTransactionReceipt({ hash: await safeW.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'setDailyCreditCap', args: [parseEther('1000000')] }) })
  const r6 = await run(h5); ok(r6.ok && r6.creditUsd === 4.9, 'retry after cap raised credits $4.90')

  // Revoked operator cannot credit
  await pub.waitForTransactionReceipt({ hash: await safeW.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'setOperator', args: [op.address, false] }) })
  const h7 = await pw.writeContract({ address: GRIND_LEDGER, abi: grindLedgerAbi, functionName: 'topUp', args: [`0x${'77'.repeat(32)}`], value: parseEther('0.0005') })
  await pub.waitForTransactionReceipt({ hash: h7 })
  const r7 = await run(h7); ok(!r7.ok && r7.code === 502, 'revoked operator: credit fails, row marked failed')
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}
main().catch((e) => { console.error(e); process.exit(1) })
