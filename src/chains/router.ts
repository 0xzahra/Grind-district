// Multichain router: which chain and contract each certificate (credential) goes to, who pays the gas, and which
// wallet signs. Pure config, no secrets: imported by the game (src/) and the server (api/). docs/multichain-router.md
// explains every entry. A route is only usable when its contract env is set; status says what is actually on-chain.
//
// Wallet model: Privy's embedded EVM wallet is ONE address shared by every EVM chain (Base, OP, Arbitrum, Robinhood
// Chain, Polygon, BNB Chain); Solana is a separate address (Privy Solana wallet or Phantom); NEAR keeps its own flow (NEAR sign-in or a
// connected NEAR wallet through near-connect). Every mint needs a server-signed voucher, issued only after a
// server-graded exam pass (cert_passes + pass ticket), see api/_certMint.ts.

export type RouteId = 'base' | 'base-eas' | 'near-testnet' | 'near-mainnet' | 'solana-devnet' | EvmCertKey
export type Family = 'evm' | 'near' | 'solana'
export type Wallet = 'privy-evm' | 'near' | 'solana'
export type Status = 'live' | 'deployed' | 'built-off' | 'planned'

export type Gas = {
  /** Who pays the network fee today. */
  payer: 'player' | 'sponsor'
  /** Optional sponsorship route and the flags that switch it on (all must be set). */
  sponsorship: 'none' | 'cdp-paymaster'
  sponsorFlags?: string[]
  /** NEAR storage deposit the player attaches, in yoctoNEAR (unused part refunded). */
  depositYocto?: string
  /** Base Builder Code appended to the calldata (ERC-8021). */
  builderCode?: string
}

export type Route = {
  id: RouteId
  label: string
  family: Family
  network: string
  /** EVM chain id, when EVM. */
  chainId?: number
  /** Env var holding the contract address / account / schema; the route is off while it is empty. */
  contractEnv: string
  /** The address that is deployed for this route (for docs and checks); the env value is what the code uses. */
  deployed?: string
  standard: string
  wallet: Wallet
  gas: Gas
  status: Status
  note: string
}

/** The same GrindCertificate contract (same signer, same base URI) on more EVM mainnets, deployed 28 Nov 2026. */
export const CERT_MULTI_EVM = '0x6bC81E26832986d56B6e59c31599F3113971Ec33'

export type EvmCertKey = 'optimism' | 'arbitrum' | 'robinhood' | 'polygon' | 'bsc'
/** Every EVM chain a certificate can be minted on, Base included. One game wallet address works on all of them. */
export type EvmCertChainKey = 'base' | EvmCertKey
export type EvmCertChain = {
  key: EvmCertChainKey
  label: string
  chainId: number
  /** Public RPC with CORS (browser reads); the server may override it with CERT_RPC_<KEY>. */
  rpc: string
  explorer: string
  explorerName: string
  /** 'blockscout' links tokens as /token/<c>/instance/<id>; etherscan-style explorers as /nft/<c>/<id>. */
  explorerKind: 'etherscan' | 'blockscout'
  /** Gas token the player pays with. */
  native: string
  /** Brand colour for the chain key in the mint dialog. */
  color: string
  contractEnv: string
  deployed: string
}
export const EVM_CERT_CHAINS: Record<EvmCertChainKey, EvmCertChain> = {
  base: { key: 'base', label: 'Base', chainId: 8453, rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org', explorerName: 'Basescan', explorerKind: 'etherscan', native: 'ETH', color: '#0052ff', contractEnv: 'VITE_CERT_NFT_BASE', deployed: '0xBEC44b497b5D4696644A5ad581804476CB20808f' },
  arbitrum: { key: 'arbitrum', label: 'Arbitrum', chainId: 42161, rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io', explorerName: 'Arbiscan', explorerKind: 'etherscan', native: 'ETH', color: '#28a0f0', contractEnv: 'VITE_CERT_NFT_ARBITRUM', deployed: CERT_MULTI_EVM },
  optimism: { key: 'optimism', label: 'OP Mainnet', chainId: 10, rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io', explorerName: 'OP Etherscan', explorerKind: 'etherscan', native: 'ETH', color: '#ff0420', contractEnv: 'VITE_CERT_NFT_OPTIMISM', deployed: CERT_MULTI_EVM },
  robinhood: { key: 'robinhood', label: 'Robinhood Chain', chainId: 4663, rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://robinhoodchain.blockscout.com', explorerName: 'Blockscout', explorerKind: 'blockscout', native: 'ETH', color: '#ccff00', contractEnv: 'VITE_CERT_NFT_ROBINHOOD', deployed: CERT_MULTI_EVM },
  polygon: { key: 'polygon', label: 'Polygon', chainId: 137, rpc: 'https://polygon-bor-rpc.publicnode.com', explorer: 'https://polygonscan.com', explorerName: 'Polygonscan', explorerKind: 'etherscan', native: 'POL', color: '#8247e5', contractEnv: 'VITE_CERT_NFT_POLYGON', deployed: CERT_MULTI_EVM },
  bsc: { key: 'bsc', label: 'BNB Chain', chainId: 56, rpc: 'https://bsc-dataseed.binance.org', explorer: 'https://bscscan.com', explorerName: 'BscScan', explorerKind: 'etherscan', native: 'BNB', color: '#f0b90b', contractEnv: 'VITE_CERT_NFT_BSC', deployed: CERT_MULTI_EVM },
}
/** Order of the chain keys in the mint dialog. */
export const EVM_CERT_ORDER: EvmCertChainKey[] = ['base', 'arbitrum', 'optimism', 'robinhood', 'polygon', 'bsc']
export const isEvmCertKey = (k: unknown): k is EvmCertChainKey => typeof k === 'string' && Object.hasOwn(EVM_CERT_CHAINS, k)
const BASE_SEPOLIA = { chainId: 84532, rpc: 'https://sepolia.base.org', explorer: 'https://sepolia.basescan.org' }
/**
 * A chain with its configured contract, or null while its env is empty. Base keeps its Sepolia switch
 * (VITE_CERT_NFT_BASE_CHAIN=84532). `serverRpc` applies the server-only RPC override (CERT_BASE_RPC / CERT_RPC_<KEY>).
 */
export function evmCertChain(key: EvmCertChainKey, env: Record<string, string | undefined>, serverRpc = false): (EvmCertChain & { contract: `0x${string}` }) | null {
  const c = EVM_CERT_CHAINS[key]
  if (!c) return null
  const contract = String(env[c.contractEnv] ?? '').trim()
  if (!/^0x[0-9a-fA-F]{40}$/.test(contract)) return null
  const sep = key === 'base' && Number(env.VITE_CERT_NFT_BASE_CHAIN) === 84532
  const over = serverRpc ? (key === 'base' ? env.CERT_BASE_RPC : env[`CERT_RPC_${key.toUpperCase()}`]) : undefined
  return { ...c, ...(sep ? BASE_SEPOLIA : {}), ...(over ? { rpc: over } : {}), contract: contract as `0x${string}` }
}
export const evmNftUrl = (c: Pick<EvmCertChain, 'explorer' | 'explorerKind'>, contract: string, id: bigint | string) =>
  c.explorerKind === 'blockscout' ? `${c.explorer}/token/${contract}/instance/${id}` : `${c.explorer}/nft/${contract}/${id}`
export const evmTxUrl = (c: Pick<EvmCertChain, 'explorer'>, hash: string) => `${c.explorer}/tx/${hash}`
export const evmAddressUrl = (c: Pick<EvmCertChain, 'explorer'>, a: string) => `${c.explorer}/address/${a}`

const evmRoute = (k: EvmCertKey): Route => {
  const c = EVM_CERT_CHAINS[k]
  return {
    id: k, label: c.label, family: 'evm', network: `${k}-mainnet`, chainId: c.chainId, contractEnv: c.contractEnv, deployed: c.deployed,
    standard: 'ERC-721 soulbound (ERC-5192), EIP-712 voucher (same contract and signer as Base)', wallet: 'privy-evm',
    gas: { payer: 'player', sponsorship: 'none' },
    status: 'deployed', note: `Deployed 28 Nov 2026; owner is the deployer until the Safe is created on ${c.label} and accepts ownership.`,
  }
}

export const BUILDER_CODE = 'bc_ke1fy1yi'

export const ROUTES: Record<RouteId, Route> = {
  'base': {
    id: 'base', label: 'Base', family: 'evm', network: 'base-mainnet', chainId: 8453,
    contractEnv: 'VITE_CERT_NFT_BASE', deployed: '0xBEC44b497b5D4696644A5ad581804476CB20808f',
    standard: 'ERC-721 soulbound (ERC-5192), EIP-712 voucher', wallet: 'privy-evm',
    gas: { payer: 'player', sponsorship: 'cdp-paymaster', sponsorFlags: ['VITE_GASLESS=1', 'CDP_PAYMASTER_URL'], builderCode: BUILDER_CODE },
    status: 'live', note: 'Owner is the Safe; vouchers signed by CERT_SIGNER_PRIVATE_KEY.',
  },
  'base-eas': {
    id: 'base-eas', label: 'Base (EAS attestation)', family: 'evm', network: 'base-mainnet', chainId: 8453,
    contractEnv: 'CERT_EAS_SCHEMA_UID', deployed: '0x4200000000000000000000000000000000000021',
    standard: 'EAS delegated attestation (attestByDelegation), schema CERT_EAS_SCHEMA', wallet: 'privy-evm',
    gas: { payer: 'player', sponsorship: 'cdp-paymaster', sponsorFlags: ['CERT_EAS=1', 'CERT_EAS_SCHEMA_UID'], builderCode: BUILDER_CODE },
    status: 'built-off', note: 'Schema not registered yet (about 0.0000012 ETH of gas). Server code returns an attestation request only when the flag is on.',
  },
  'optimism': evmRoute('optimism'),
  'arbitrum': evmRoute('arbitrum'),
  'robinhood': evmRoute('robinhood'),
  'polygon': evmRoute('polygon'),
  'bsc': evmRoute('bsc'),
  'near-testnet': {
    id: 'near-testnet', label: 'NEAR (testnet)', family: 'near', network: 'testnet',
    contractEnv: 'VITE_CERT_NFT_NEAR', deployed: 'grinddistrict-cert.testnet',
    standard: 'NEP-171 soulbound, ed25519 voucher', wallet: 'near',
    gas: { payer: 'player', sponsorship: 'none', depositYocto: '50000000000000000000000' },
    status: 'live', note: 'Keep fully working until hackathon judging ends. Never replaced by mainnet.',
  },
  'near-mainnet': {
    id: 'near-mainnet', label: 'NEAR', family: 'near', network: 'mainnet',
    contractEnv: 'VITE_CERT_NFT_NEAR_MAINNET', deployed: 'cert.grinddistrict.near',
    standard: 'NEP-171 soulbound, ed25519 voucher (same wasm as testnet)', wallet: 'near',
    gas: { payer: 'player', sponsorship: 'none', depositYocto: '50000000000000000000000' },
    status: 'deployed', note: 'Deployed 28 Nov 2026, owner grinddistrict.near. Server accepts network:"mainnet" once the env is set; no game button yet.',
  },
  'solana-devnet': {
    id: 'solana-devnet', label: 'Solana (devnet)', family: 'solana', network: 'devnet',
    contractEnv: 'VITE_CERT_SOLANA_PROGRAM', deployed: '6NJLLRRTkvEwijjSo62HHJF4trQowqJJLWDXxPdMB1Hd',
    standard: 'Grind District Rust program (programs/grind-cert): issuer-only soulbound certificate accounts (PDA per player and course)', wallet: 'solana',
    gas: { payer: 'sponsor', sponsorship: 'none' },
    status: 'live', note: 'Deployed on devnet 28 Nov 2026. Server is the issuer and pays the devnet (test SOL) fee; no player wallet needed. This is a program-owned certificate account (a record), not a token NFT. Auto-recorded on cert issue when CERT_SOLANA_AUTO=1. The mint picker shows it as Recorded on Solana devnet, with a tick if the auto-record already landed.',
  },
}

/** Every course issues the same credential; this is where a course would be pinned to other chains. */
export const DEFAULT_ROUTES: RouteId[] = ['near-testnet', 'base', 'near-mainnet', 'arbitrum', 'optimism', 'robinhood', 'polygon', 'bsc']
export const COURSE_ROUTES: Partial<Record<string, RouteId[]>> = {}
export const routesFor = (course: string): RouteId[] => COURSE_ROUTES[course] ?? DEFAULT_ROUTES

type Env = Record<string, string | undefined>
const VALID: Record<Family, RegExp> = {
  evm: /^0x[0-9a-fA-F]{40}$/,
  near: /^[a-z0-9._-]{2,64}$/,
  solana: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
}

/** The configured contract for a route, or null while the route is off. NEAR names must be on the route's network. */
export function routeContract(id: RouteId, env: Env): string | null {
  const r = ROUTES[id]
  const v = String(env[r.contractEnv] ?? '').trim()
  if (id === 'base-eas') return /^0x[0-9a-fA-F]{64}$/.test(v) && env.CERT_EAS === '1' ? v : null
  if (!VALID[r.family].test(v)) return null
  if (r.family === 'near' && (r.network === 'testnet') !== v.endsWith('.testnet')) return null
  return v
}

/** Which wallet address a route mints to: EVM chains share the Privy address, Solana and NEAR have their own. */
export const walletFor = (id: RouteId): Wallet => ROUTES[id].wallet
