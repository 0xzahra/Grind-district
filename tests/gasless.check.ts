// Gas-free route (CDP Paymaster), off by default: the proxy only forwards the certificate mint and USDC top-ups to the
// treasury, the Coinbase Smart Wallet relayer is owned by the game wallet, and the EIP-3009 authorization verifies.
import { encodeFunctionData, recoverTypedDataAddress, createPublicClient, http, hashDomain, type Hex } from 'viem'
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts'
import { base } from 'viem/chains'
import { checkUserOp, gaslessRoute, CSW_FACTORY_V1, ENTRYPOINT_V06, BASE_USDC, GRIND_TREASURY_VAULT, type GaslessCfg } from '../api/_gasless.ts'
import { usdcAuthorization } from '../src/gasless.ts'
import { BUILDER_SUFFIX } from '../src/builderCode.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const CERT = '0xBEC44b497b5D4696644A5ad581804476CB20808f'
const cfg: GaslessCfg = { certContract: CERT }
const player = privateKeyToAccount(generatePrivateKey())

const CSW = [
  { type: 'function', name: 'execute', stateMutability: 'payable', inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'executeBatch', stateMutability: 'payable', inputs: [{ name: 'calls', type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }] }], outputs: [] },
] as const
const MINT = [{ type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [{ name: 'v', type: 'tuple', components: [
  { name: 'to', type: 'address' }, { name: 'courseId', type: 'string' }, { name: 'courseTitle', type: 'string' }, { name: 'playerName', type: 'string' },
  { name: 'username', type: 'string' }, { name: 'rank', type: 'string' }, { name: 'issuedAt', type: 'uint64' }, { name: 'issuedWat', type: 'string' },
  { name: 'serial', type: 'string' }, { name: 'certId', type: 'string' }, { name: 'deadline', type: 'uint64' }] }, { name: 'signature', type: 'bytes' }], outputs: [{ name: 'tokenId', type: 'uint256' }] }] as const
const TWA = [{ type: 'function', name: 'transferWithAuthorization', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] }] as const
const Z32 = ('0x' + '11'.repeat(32)) as Hex

const mintData = (encodeFunctionData({ abi: MINT, functionName: 'mint', args: [{ to: player.address, courseId: 'basics', courseTitle: 'Basics', playerName: 'A', username: 'a', rank: 'Normie', issuedAt: 1n, issuedWat: 'x', serial: 'GD-1', certId: 'GD-1', deadline: 2n }, '0x1234'] }) + BUILDER_SUFFIX) as Hex
const twa = (to: string, value: bigint) => encodeFunctionData({ abi: TWA, functionName: 'transferWithAuthorization', args: [player.address, to as Hex, value, 0n, 9n, Z32, 27, Z32, Z32] })
const exec = (target: string, data: Hex, value = 0n) => encodeFunctionData({ abi: CSW, functionName: 'execute', args: [target as Hex, value, data] })
const op = (callData: Hex, initCode: Hex = '0x') => ({ sender: '0x' + '22'.repeat(20), callData, initCode })

check(checkUserOp(op(exec(CERT, mintData)), cfg).ok, 'certificate mint (with builder code) is sponsored')
check(checkUserOp(op(exec(BASE_USDC, twa(GRIND_TREASURY_VAULT, 5_000_000n))), cfg).ok, 'USDC top-up to the treasury is sponsored')
check(!checkUserOp(op(exec(BASE_USDC, twa(player.address, 5_000_000n))), cfg).ok, 'USDC to anyone else is refused')
check(!checkUserOp(op(exec(BASE_USDC, twa(GRIND_TREASURY_VAULT, 5_000_000_000n))), cfg).ok, 'oversized USDC top-up is refused')
check(!checkUserOp(op(exec(CERT, mintData, 1n)), cfg).ok, 'sending ETH is refused')
check(!checkUserOp(op(exec('0x' + '33'.repeat(20), mintData)), cfg).ok, 'other contracts are refused')
check(!checkUserOp(op(exec(CERT, '0xa9059cbb' as Hex)), cfg).ok, 'other functions on the certificate contract are refused')
check(!checkUserOp(op(exec(BASE_USDC, encodeFunctionData({ abi: [{ type: 'function', name: 'transfer', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'v', type: 'uint256' }], outputs: [] }], functionName: 'transfer', args: [GRIND_TREASURY_VAULT, 1n] }))), cfg).ok, 'plain USDC transfer from the relayer is refused')
check(checkUserOp(op(encodeFunctionData({ abi: CSW, functionName: 'executeBatch', args: [[{ target: CERT, value: 0n, data: mintData }]] })), cfg).ok, 'batch of one allowed call is sponsored')
check(!checkUserOp(op(encodeFunctionData({ abi: CSW, functionName: 'executeBatch', args: [[{ target: CERT, value: 0n, data: mintData }, { target: '0x' + '33'.repeat(20) as Hex, value: 0n, data: '0x' }]] })), cfg).ok, 'batch with one bad call is refused')
check(checkUserOp(op(exec(CERT, mintData), (CSW_FACTORY_V1 + 'ab') as Hex), cfg).ok, 'first operation deploys the Coinbase Smart Wallet')
check(!checkUserOp(op(exec(CERT, mintData), ('0x' + '44'.repeat(20)) as Hex), cfg).ok, 'other account factories are refused')
check(!checkUserOp(op(exec(CERT, mintData)), { certContract: '' }).ok, 'no certificate contract configured: mint not sponsored')

// The proxy.
type Out = { code: number; body: any }
const call = async (req: Parameters<typeof gaslessRoute>[0], user: string | null, url = 'https://api.developer.coinbase.com/rpc/v1/base/KEY') => {
  const seen: string[] = []
  const out: Out = { code: 0, body: null }
  const res = { status(n: number) { out.code = n; return { json(b: unknown) { out.body = b } } } }
  const f = (async (_u: string, init: { body: string }) => { const m = JSON.parse(init.body); seen.push(m.method); return { json: async () => ({ jsonrpc: '2.0', id: m.id, result: 'ok' }) } }) as unknown as typeof fetch
  await gaslessRoute(req, res, user, { url, cfg, fetch: f })
  return { ...out, seen }
}
{
  const off = await call({ method: 'GET' }, null, '')
  check(off.code === 200 && off.body.gasless === false, 'GET reports off with no paymaster URL')
  const on = await call({ method: 'GET' }, null)
  check(on.body.gasless === true && on.body.entryPoint === ENTRYPOINT_V06, 'GET reports on with a URL and a certificate contract')
  check((await call({ method: 'POST', body: { id: 1, method: 'eth_chainId' } }, 'u', '')).code === 503, 'POST answers 503 while off')
  check((await call({ method: 'POST', body: { id: 1, method: 'eth_chainId' } }, null)).code === 401, 'POST needs a signed-in player')
  const bad = await call({ method: 'POST', body: { id: 1, method: 'eth_sendRawTransaction', params: [] } }, 'u')
  check(bad.body.error && bad.seen.length === 0, 'other RPC methods are not forwarded')
  const ok = await call({ method: 'POST', body: { id: 2, method: 'pm_getPaymasterStubData', params: [op(exec(CERT, mintData)), ENTRYPOINT_V06, '0x2105', {}] } }, 'u')
  check(ok.body.result === 'ok' && ok.seen[0] === 'pm_getPaymasterStubData', 'allowed sponsorship request is forwarded')
  const no = await call({ method: 'POST', body: { id: 3, method: 'eth_sendUserOperation', params: [op(exec('0x' + '33'.repeat(20), '0x')), ENTRYPOINT_V06] } }, 'u')
  check(no.body.error && no.seen.length === 0, 'a user operation calling anything else never reaches CDP')
  const ep = await call({ method: 'POST', body: { id: 4, method: 'eth_estimateUserOperationGas', params: [op(exec(CERT, mintData)), '0x' + '55'.repeat(20)] } }, 'u')
  check(ep.body.error && ep.seen.length === 0, 'other entry points are refused')
  const batch = await call({ method: 'POST', body: [{ id: 5, method: 'eth_chainId' }, { id: 6, method: 'eth_supportedEntryPoints' }] as unknown as Record<string, unknown> }, 'u')
  check(Array.isArray(batch.body) && batch.seen.length === 2, 'JSON-RPC batches are forwarded one by one')
}

// EIP-3009 authorization: signed by the game wallet, recovers to it.
{
  const typed = usdcAuthorization({ from: player.address, to: GRIND_TREASURY_VAULT, value: 5_000_000n, nonce: Z32, validBefore: 9_999_999_999n })
  const { EIP712Domain: _d, ...types } = typed.types
  const sig = await player.signTypedData({ domain: typed.domain, types, primaryType: typed.primaryType, message: typed.message })
  const who = await recoverTypedDataAddress({ domain: typed.domain, types, primaryType: typed.primaryType, message: typed.message, signature: sig })
  check(who === player.address, 'USDC authorization recovers to the game wallet')
  // Optional live check: the domain matches Base USDC's DOMAIN_SEPARATOR (skipped offline).
  try {
    const c = createPublicClient({ chain: base, transport: http('https://mainnet.base.org') })
    const ds = await c.readContract({ address: BASE_USDC, abi: [{ type: 'function', name: 'DOMAIN_SEPARATOR', stateMutability: 'view', inputs: [], outputs: [{ type: 'bytes32' }] }], functionName: 'DOMAIN_SEPARATOR' })
    check(ds === hashDomain({ domain: typed.domain, types: { EIP712Domain: typed.types.EIP712Domain } }), 'domain matches Base USDC on chain')
    // The Coinbase Smart Wallet relayer address is derived from the game wallet (counterfactual, no deploy needed).
    const { toCoinbaseSmartAccount } = await import('viem/account-abstraction')
    const acct = await toCoinbaseSmartAccount({ client: c, owners: [player], version: '1.1' })
    check(/^0x[0-9a-fA-F]{40}$/.test(acct.address) && acct.address !== player.address, 'relayer smart wallet address derived from the game wallet')
    const again = await toCoinbaseSmartAccount({ client: c, owners: [player], version: '1.1' })
    check(again.address === acct.address, 'relayer address is stable')
  } catch (e) { console.log('  (skipped live Base checks:', (e as Error).message.slice(0, 80), ')') }
}

console.log(`gasless: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
