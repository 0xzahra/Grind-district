// Multichain router: which chain and contract each certificate (credential) goes to, who pays the gas, and which
// wallet signs. Pure config, no secrets: imported by the game (src/) and the server (api/). docs/multichain-router.md
// explains every entry. A route is only usable when its contract env is set; status says what is actually on-chain.
//
// Wallet model: Privy's embedded EVM wallet is ONE address shared by every EVM chain (Base, and later BNB / Robinhood
// Chain); Solana is a separate address (Privy Solana wallet or Phantom); NEAR keeps its own flow (NEAR sign-in or a
// connected NEAR wallet through near-connect). Every mint needs a server-signed voucher, issued only after a
// server-graded exam pass (cert_passes + pass ticket), see api/_certMint.ts.

export type RouteId = 'base' | 'base-eas' | 'near-testnet' | 'near-mainnet' | 'solana-devnet'
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
    contractEnv: 'VITE_CERT_NFT_SOLANA',
    standard: 'Metaplex Core collection, co-signed by the update authority', wallet: 'solana',
    gas: { payer: 'player', sponsorship: 'none' },
    status: 'planned', note: 'Separate Solana address. Work in progress on branch solana-cert-devnet, not merged.',
  },
}

/** Every course issues the same credential; this is where a course would be pinned to other chains. */
export const DEFAULT_ROUTES: RouteId[] = ['near-testnet', 'base', 'near-mainnet']
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
