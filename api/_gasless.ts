// Gas-free Base transactions through Coinbase Developer Platform (CDP) Paymaster. OFF until CDP_PAYMASTER_URL is set
// (server) and VITE_GASLESS=1 (build). The CDP URL holds the project's client key, so the game never sees it: the
// browser sends ERC-4337 bundler/paymaster JSON-RPC to /api/topup-confirm?aa=1 and this route forwards only what the
// game itself builds:
//   - GrindCertificate.mint(voucher, signature) on the Base certificate contract (the voucher already names the player's
//     own wallet as the receiver, so who relays it does not matter), and
//   - Base USDC transferWithAuthorization(...) whose receiver is the Grind District treasury (the player's game wallet
//     signs an EIP-3009 authorization; the USDC still leaves the player's own address, so top-up detection is unchanged).
// Anything else is refused before it reaches CDP. The smart account is a Coinbase Smart Wallet owned by the player's
// Privy game wallet; it only relays, it never holds funds. Players still pay their own gas while this is off.
// Underscore = not a Vercel function.
import { decodeFunctionData, getAddress, isAddress, type Hex } from 'viem'

export const CSW_FACTORY_V1 = '0x0BA5ED0c6AA8c49038F819E587E2633c4A9F428a' // Coinbase Smart Wallet factory (v1 / v1.1), EntryPoint v0.6
export const ENTRYPOINT_V06 = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789'
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const GRIND_TREASURY_VAULT = '0x6bc81e26832986d56b6e59c31599f3113971ec33'

const CSW_ABI = [
  { type: 'function', name: 'execute', stateMutability: 'payable', inputs: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }], outputs: [] },
  { type: 'function', name: 'executeBatch', stateMutability: 'payable', inputs: [{ name: 'calls', type: 'tuple[]', components: [{ name: 'target', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'data', type: 'bytes' }] }], outputs: [] },
] as const
const USDC_ABI = [
  { type: 'function', name: 'transferWithAuthorization', stateMutability: 'nonpayable', inputs: [
    { name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }, { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' }, { name: 'nonce', type: 'bytes32' }, { name: 'v', type: 'uint8' }, { name: 'r', type: 'bytes32' }, { name: 's', type: 'bytes32' }], outputs: [] },
] as const
const CERT_ABI = [
  { type: 'function', name: 'mint', stateMutability: 'nonpayable', inputs: [
    { name: 'v', type: 'tuple', components: [
      { name: 'to', type: 'address' }, { name: 'courseId', type: 'string' }, { name: 'courseTitle', type: 'string' }, { name: 'playerName', type: 'string' },
      { name: 'username', type: 'string' }, { name: 'rank', type: 'string' }, { name: 'issuedAt', type: 'uint64' }, { name: 'issuedWat', type: 'string' },
      { name: 'serial', type: 'string' }, { name: 'certId', type: 'string' }, { name: 'deadline', type: 'uint64' }] },
    { name: 'signature', type: 'bytes' }], outputs: [{ name: 'tokenId', type: 'uint256' }] },
] as const

export type GaslessCfg = { certContract: string; usdc?: string; treasury?: string; maxUsdcMicro?: bigint }
export const gaslessUrl = () => { const u = (process.env.CDP_PAYMASTER_URL ?? '').trim(); return /^https:\/\/api\.developer\.coinbase\.com\/rpc\/v1\/base(-sepolia)?\//.test(u) ? u : '' }
export const gaslessCfg = (): GaslessCfg => ({ certContract: (process.env.VITE_CERT_NFT_BASE ?? '').trim(), usdc: BASE_USDC, treasury: GRIND_TREASURY_VAULT, maxUsdcMicro: 1000_000_000n })

const same = (a: string, b: string) => isAddress(a) && isAddress(b) && getAddress(a) === getAddress(b)

/** Is this one inner call something the game sponsors? */
export function allowedCall(target: string, value: bigint, data: Hex, cfg: GaslessCfg): { ok: true; kind: 'cert-mint' | 'usdc-topup' } | { ok: false; error: string } {
  if (value !== 0n) return { ok: false, error: 'sponsored calls never send ETH' }
  if (cfg.certContract && same(target, cfg.certContract)) {
    try { const d = decodeFunctionData({ abi: CERT_ABI, data: stripSuffix(data) }); if (d.functionName === 'mint') return { ok: true, kind: 'cert-mint' } } catch { /* fallthrough */ }
    return { ok: false, error: 'only the certificate mint is sponsored on that contract' }
  }
  if (same(target, cfg.usdc ?? BASE_USDC)) {
    try {
      const d = decodeFunctionData({ abi: USDC_ABI, data })
      const [, to, amount] = d.args
      if (!same(to, cfg.treasury ?? GRIND_TREASURY_VAULT)) return { ok: false, error: 'USDC can only go to the Grind District treasury' }
      if (amount <= 0n || amount > (cfg.maxUsdcMicro ?? 1000_000_000n)) return { ok: false, error: 'top-up amount out of range' }
      return { ok: true, kind: 'usdc-topup' }
    } catch { return { ok: false, error: 'only USDC transferWithAuthorization to the treasury is sponsored' } }
  }
  return { ok: false, error: 'contract not sponsored' }
}

/** The game appends a Base Builder Code (ERC-8021 data suffix) to the mint; decode the ABI part only. */
function stripSuffix(data: Hex): Hex {
  // ERC-8021: ...<codes><codesLength:1 byte><schemaId:1 byte><16-byte marker 0x8021...8021>. Strip it when present.
  const marker = '80218021802180218021802180218021'
  const h = data.toLowerCase()
  if (!h.endsWith(marker)) return data
  const body = h.slice(0, -marker.length)
  const codesLen = parseInt(body.slice(-4, -2), 16)
  const cut = body.length - 4 - codesLen * 2
  return (cut > 10 ? body.slice(0, cut) : data) as Hex
}

/** Checks a Coinbase Smart Wallet userOperation (EntryPoint v0.6) only does sponsored calls. */
export function checkUserOp(op: Record<string, unknown> | undefined, cfg: GaslessCfg): { ok: true; kinds: string[] } | { ok: false; error: string } {
  if (!op || typeof op !== 'object') return { ok: false, error: 'missing user operation' }
  const initCode = String(op.initCode ?? '0x').toLowerCase()
  if (initCode !== '0x' && !initCode.startsWith(CSW_FACTORY_V1.toLowerCase())) return { ok: false, error: 'only Coinbase Smart Wallet accounts are sponsored' }
  if (op.factory && !same(String(op.factory), CSW_FACTORY_V1)) return { ok: false, error: 'only Coinbase Smart Wallet accounts are sponsored' }
  const callData = String(op.callData ?? '') as Hex
  let calls: Array<{ target: string; value: bigint; data: Hex }>
  try {
    const d = decodeFunctionData({ abi: CSW_ABI, data: callData })
    calls = d.functionName === 'execute' ? [{ target: d.args[0], value: d.args[1], data: d.args[2] }] : d.args[0].map((c) => ({ target: c.target, value: c.value, data: c.data }))
  } catch { return { ok: false, error: 'unrecognised account call' } }
  if (calls.length === 0 || calls.length > 2) return { ok: false, error: 'one or two calls per sponsored operation' }
  const kinds: string[] = []
  for (const c of calls) { const r = allowedCall(c.target, c.value, c.data, cfg); if (!r.ok) return r; kinds.push(r.kind) }
  return { ok: true, kinds }
}

const PASS = new Set(['eth_chainId', 'eth_supportedEntryPoints', 'eth_getUserOperationReceipt', 'eth_getUserOperationByHash'])
const CHECKED = new Set(['eth_estimateUserOperationGas', 'eth_sendUserOperation', 'pm_getPaymasterStubData', 'pm_getPaymasterData', 'pm_sponsorUserOperation'])

type Req = { method?: string; body?: unknown; query?: Record<string, string | string[] | undefined> }
type Res = { status(n: number): { json(b: unknown): void } }
type Rpc = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown[] }

/** JSON-RPC proxy to CDP (bundler + paymaster in one endpoint). Batches are handled one by one. */
export async function gaslessRoute(req: Req, res: Res, userId: string | null, deps: { url?: string; cfg?: GaslessCfg; fetch?: typeof fetch } = {}) {
  const url = deps.url ?? gaslessUrl(), cfg = deps.cfg ?? gaslessCfg(), f = deps.fetch ?? fetch
  if (req.method === 'GET') return res.status(200).json({ gasless: !!url && !!cfg.certContract, entryPoint: ENTRYPOINT_V06, factory: CSW_FACTORY_V1 })
  if (!url) return res.status(503).json({ error: 'gas-free transactions are not switched on' })
  if (!userId) return res.status(401).json({ error: 'sign in with Google, X or email first' })
  const one = async (m: Rpc) => {
    const id = m?.id ?? null, method = String(m?.method ?? '')
    const fail = (code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })
    if (!PASS.has(method) && !CHECKED.has(method)) return fail(-32601, `method not allowed: ${method}`)
    if (CHECKED.has(method)) {
      const params = Array.isArray(m.params) ? m.params : []
      const ep = String(params[1] ?? '')
      if (ep && !same(ep, ENTRYPOINT_V06)) return fail(-32602, 'unsupported entry point')
      if (method.startsWith('pm_') && params[2] != null && String(params[2]) !== '0x2105' && String(params[2]) !== '0x14a34') return fail(-32602, 'Base only')
      const chk = checkUserOp(params[0] as Record<string, unknown>, cfg)
      if (!chk.ok) return fail(-32602, chk.error)
    }
    try {
      const r = await f(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params: m.params ?? [] }), signal: AbortSignal.timeout(20_000) })
      return (await r.json()) as unknown
    } catch (e) { return fail(-32603, `paymaster unreachable: ${(e as Error).message}`.slice(0, 200)) }
  }
  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Rpc | Rpc[]
  if (Array.isArray(body)) { if (body.length > 10) return res.status(400).json({ error: 'batch too large' }); return res.status(200).json(await Promise.all(body.map(one))) }
  return res.status(200).json(await one(body))
}
