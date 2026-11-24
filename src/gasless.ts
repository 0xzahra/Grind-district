// Gas-free Base transactions (Coinbase Developer Platform Paymaster). OFF unless the build sets VITE_GASLESS=1 and the
// server has CDP_PAYMASTER_URL; when off, nothing here is loaded and players pay their own gas as before.
// How it works: a Coinbase Smart Wallet owned by the player's Privy game wallet relays the call as an ERC-4337
// user operation; CDP's paymaster pays the gas. The relayer never holds anything:
//  - certificate mint: the voucher already names the player's game wallet as the receiver;
//  - USDC top-up: the game wallet signs an EIP-3009 authorization, the relayer submits transferWithAuthorization,
//    so the USDC leaves the player's own address and the existing top-up detection credits it unchanged.
// The browser talks to /api/topup-confirm?aa=1, which forwards only these two calls to CDP (the CDP key stays on the server).
// If sponsorship is refused (switched off, spend cap reached), callers fall back to paying their own gas.
import type { Hex } from 'viem'

export const GASLESS = import.meta.env.VITE_GASLESS === '1'
const BASE_RPC = 'https://mainnet.base.org'
const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const

let ready: Promise<boolean> | null = null
/** Server says the paymaster is configured (GET /api/topup-confirm?aa=1). */
export const gaslessReady = () => (ready ??= GASLESS
  ? fetch('/api/topup-confirm?aa=1').then((r) => r.json()).then((j: { gasless?: boolean }) => !!j.gasless).catch(() => false)
  : Promise.resolve(false))

async function relayer() {
  const [{ createPublicClient, http }, { base }, aa, { gameWalletSigner }, login] = await Promise.all([
    import('viem'), import('viem/chains'), import('viem/account-abstraction'), import('./privyWallet.ts'), import('./login.ts'),
  ])
  const { address, provider } = await gameWalletSigner()
  const client = createPublicClient({ chain: base, transport: http(BASE_RPC) })
  // Owner = the game wallet; user operations are signed with Privy's raw secp256k1_sign (same as Privy's own smart-wallet helper).
  const owner = { type: 'local', source: 'privy', address, publicKey: '0x', sign: async ({ hash }: { hash: Hex }) => (await provider.request({ method: 'secp256k1_sign', params: [hash] })) as Hex } as unknown as Parameters<typeof aa.toCoinbaseSmartAccount>[0]['owners'][number]
  const account = await aa.toCoinbaseSmartAccount({ client, owners: [owner], version: '1.1' })
  const token = await login.accessToken().catch(() => null)
  const bundler = aa.createBundlerClient({
    account, client, paymaster: true,
    transport: http(`${location.origin}/api/topup-confirm?aa=1`, { fetchOptions: { headers: token ? { authorization: `Bearer ${token}` } : {} } }),
    userOperation: { estimateFeesPerGas: async () => { const f = await client.estimateFeesPerGas(); return { maxFeePerGas: (f.maxFeePerGas * 15n) / 10n, maxPriorityFeePerGas: (f.maxPriorityFeePerGas * 15n) / 10n } } },
  })
  return { address, provider, bundler }
}

/** Send calls (no ETH value) gas-free. Returns the Base transaction hash once included. Throws if not sponsored. */
export async function sponsoredCalls(calls: Array<{ to: `0x${string}`; data: Hex }>): Promise<{ hash: string; from: string }> {
  if (!(await gaslessReady())) throw new Error('gas-free transactions are off')
  const { address, bundler } = await relayer()
  const userOpHash = await bundler.sendUserOperation({ calls: calls.map((c) => ({ to: c.to, data: c.data, value: 0n })) })
  const r = await bundler.waitForUserOperationReceipt({ hash: userOpHash, timeout: 120_000 })
  if (!r.success) throw new Error('sponsored transaction reverted')
  return { hash: r.receipt.transactionHash.toLowerCase(), from: address }
}

/** EIP-3009 typed data for Base USDC (name "USD Coin", version "2"). Pure, for tests. */
export function usdcAuthorization(o: { from: `0x${string}`; to: `0x${string}`; value: bigint; nonce: Hex; validBefore: bigint; usdc?: `0x${string}` }) {
  return {
    domain: { name: 'USD Coin', version: '2', chainId: 8453, verifyingContract: o.usdc ?? BASE_USDC },
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }, { name: 'version', type: 'string' }, { name: 'chainId', type: 'uint256' }, { name: 'verifyingContract', type: 'address' }],
      TransferWithAuthorization: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }],
    },
    primaryType: 'TransferWithAuthorization' as const,
    message: { from: o.from, to: o.to, value: o.value, validAfter: 0n, validBefore: o.validBefore, nonce: o.nonce },
  }
}

/** Gas-free USDC top-up: the game wallet signs an authorization; the relayer submits it. */
export async function sponsoredUsdcTransfer(to: `0x${string}`, value: bigint): Promise<{ hash: string; from: string }> {
  if (!(await gaslessReady())) throw new Error('gas-free transactions are off')
  const [{ encodeFunctionData, parseSignature, toHex }, { address, provider }] = await Promise.all([import('viem'), import('./privyWallet.ts').then((m) => m.gameWalletSigner())])
  const nonce = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const typed = usdcAuthorization({ from: address, to, value, nonce, validBefore: BigInt(Math.floor(Date.now() / 1000) + 3600) })
  const json = JSON.stringify(typed, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))
  const sig = parseSignature((await provider.request({ method: 'eth_signTypedData_v4', params: [address, json] })) as Hex)
  const m = typed.message
  const data = encodeFunctionData({
    abi: [{ type: 'function', name: 'transferWithAuthorization', stateMutability: 'nonpayable', inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' }, { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] }],
    functionName: 'transferWithAuthorization',
    args: [m.from, m.to, m.value, m.validAfter, m.validBefore, m.nonce, Number(sig.v ?? BigInt(27 + (sig.yParity ?? 0))), sig.r, sig.s],
  })
  return sponsoredCalls([{ to: BASE_USDC, data }])
}
