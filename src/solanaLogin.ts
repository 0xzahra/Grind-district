// Sign in with a Solana wallet (Phantom, Solflare, Backpack...): Sign-In With Solana through Privy.
// Lazy-loaded from the sign-in card. The wallet only signs a login message: no funds, no transaction.
// Wallets are found the standard way (Wallet Standard events), with the older window.phantom / window.solflare
// providers as a fallback. No wallet library is bundled.

export type SolWallet = {
  id: string
  name: string
  icon: string
  /** Ask the wallet to connect, and return its Solana address (base58). */
  connect: () => Promise<string>
  /** Sign the exact message bytes; return the raw 64-byte signature. */
  sign: (address: string, message: Uint8Array) => Promise<Uint8Array>
}

type StdAccount = { address: string; chains?: readonly string[]; features?: readonly string[] }
type StdWallet = {
  name: string
  icon?: string
  chains?: readonly string[]
  accounts?: readonly StdAccount[]
  features: Record<string, unknown>
}
type LegacyProvider = {
  isPhantom?: boolean
  isSolflare?: boolean
  isBackpack?: boolean
  publicKey?: { toString(): string } | null
  connect: () => Promise<{ publicKey?: { toString(): string } } | void>
  signMessage?: (m: Uint8Array, enc?: string) => Promise<{ signature?: Uint8Array } | Uint8Array>
}

const found: StdWallet[] = []
let watching = false

/** Start listening for wallets that announce themselves (safe to call many times). */
export function watchSolanaWallets(): void {
  if (watching || typeof window === 'undefined') return
  watching = true
  const api = {
    register: (...ws: StdWallet[]) => {
      for (const w of ws) if (w && w.features && !found.includes(w)) found.push(w)
      return () => { /* wallets stay listed */ }
    },
  }
  try { window.addEventListener('wallet-standard:register-wallet', ((e: CustomEvent) => { try { e.detail(api) } catch { /* bad wallet */ } }) as EventListener) } catch { /* old browser */ }
  try { window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api })) } catch { /* old browser */ }
}

const isSolanaWallet = (w: StdWallet) =>
  !!w.features['standard:connect'] && !!w.features['solana:signMessage'] && (!w.chains || w.chains.length === 0 || w.chains.some((c) => c.startsWith('solana:')))

function fromStandard(w: StdWallet): SolWallet {
  let account: StdAccount | undefined
  return {
    id: `std:${w.name}`,
    name: w.name,
    icon: w.icon ?? '',
    connect: async () => {
      const f = w.features['standard:connect'] as { connect: () => Promise<{ accounts: readonly StdAccount[] }> }
      const r = await f.connect()
      const all = [...(r?.accounts ?? []), ...(w.accounts ?? [])]
      account = all.find((a) => !a.chains || a.chains.length === 0 || a.chains.some((c) => c.startsWith('solana:'))) ?? all[0]
      if (!account) throw new Error('This wallet has no Solana account. Add one in the wallet and try again.')
      return account.address
    },
    sign: async (_address, message) => {
      const f = w.features['solana:signMessage'] as { signMessage: (...i: { account: StdAccount; message: Uint8Array }[]) => Promise<{ signature: Uint8Array }[]> }
      if (!account) throw new Error('Wallet is not connected')
      const out = await f.signMessage({ account, message })
      if (!out?.[0]?.signature) throw new Error('The wallet did not sign the message')
      return out[0].signature
    },
  }
}

function fromLegacy(id: string, name: string, p: LegacyProvider): SolWallet {
  return {
    id,
    name,
    icon: '',
    connect: async () => {
      const r = await p.connect()
      const pk = (r && 'publicKey' in r && r.publicKey) || p.publicKey
      if (!pk) throw new Error('This wallet did not share an address')
      return pk.toString()
    },
    sign: async (_address, message) => {
      if (!p.signMessage) throw new Error('This wallet cannot sign login messages')
      const r = await p.signMessage(message, 'utf8')
      const sig = r instanceof Uint8Array ? r : r.signature
      if (!sig) throw new Error('The wallet did not sign the message')
      return sig
    },
  }
}

/** Solana wallets in this browser, most common first. */
export function listSolanaWallets(): SolWallet[] {
  watchSolanaWallets()
  const out = found.filter(isSolanaWallet).map(fromStandard)
  const has = (n: string) => out.some((w) => w.name.toLowerCase().includes(n))
  const w = window as unknown as { phantom?: { solana?: LegacyProvider }; solflare?: LegacyProvider; backpack?: LegacyProvider }
  if (w.phantom?.solana?.isPhantom && !has('phantom')) out.push(fromLegacy('legacy:phantom', 'Phantom', w.phantom.solana))
  if (w.solflare?.isSolflare && !has('solflare')) out.push(fromLegacy('legacy:solflare', 'Solflare', w.solflare))
  if (w.backpack?.isBackpack && !has('backpack')) out.push(fromLegacy('legacy:backpack', 'Backpack', w.backpack))
  const rank = (n: string) => (/phantom/i.test(n) ? 0 : /solflare/i.test(n) ? 1 : /backpack/i.test(n) ? 2 : 3)
  return out.sort((a, b) => rank(a.name) - rank(b.name))
}

/** The Sign-In With Solana text Privy expects (same layout as Privy's own SDK). */
export function siwsMessage(o: { address: string; nonce: string; domain: string; uri: string; chain?: string; issuedAt?: string }): string {
  const chain = (o.chain ?? 'solana:mainnet').replace('solana:', '')
  return `${o.domain} wants you to sign in with your Solana account:\n${o.address}\n\nYou are proving you own ${o.address}.\n\nURI: ${o.uri}\nVersion: 1\nChain ID: ${chain}\nNonce: ${o.nonce}\nIssued At: ${o.issuedAt ?? new Date().toISOString()}\nResources:\n- https://privy.io`
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

type SiwsClient = {
  auth: { siws: { fetchNonce: (a: { address: string }) => Promise<{ nonce: string }>; login: (a: { message: string; signature: string; walletClientType?: string; connectorType?: string; mode?: 'login-or-sign-up' | 'no-signup'; opts?: unknown }) => Promise<unknown> } }
}

/** Connect the wallet, sign the Privy login message and log in. Throws on cancel or failure. */
export async function loginWithSolanaWallet(privy: unknown, wallet: SolWallet, opts?: unknown): Promise<string> {
  const siws = (privy as SiwsClient).auth.siws
  const address = await wallet.connect()
  const { nonce } = await siws.fetchNonce({ address })
  const message = siwsMessage({ address, nonce, domain: location.host, uri: location.origin })
  const signature = toBase64(await wallet.sign(address, new TextEncoder().encode(message)))
  await siws.login({ message, signature, walletClientType: wallet.name.toLowerCase().replace(/\s+/g, '_'), connectorType: 'solana_adapter', opts })
  return address
}
