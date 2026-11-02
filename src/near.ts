import { Buffer } from 'buffer'
import type { WalletSelector } from '@near-wallet-selector/core'
import type { WalletSelectorModal } from '@near-wallet-selector/modal-ui'

export type NearWalletResult =
  | { ok: true; accountId: string }
  | { ok: false; error: string }

type NearWalletSession = { selector: WalletSelector; modal: WalletSelectorModal }

let sessionPromise: Promise<NearWalletSession> | null = null

async function walletSession(): Promise<NearWalletSession> {
  if (!sessionPromise) {
    sessionPromise = (async () => {
      await import('@near-wallet-selector/modal-ui/styles.css')
      const [core, modalUi, myNearWallet] = await Promise.all([
        import('@near-wallet-selector/core'),
        import('@near-wallet-selector/modal-ui'),
        import('@near-wallet-selector/my-near-wallet'),
      ])
      const selector = await core.setupWalletSelector({
        network: 'mainnet',
        modules: [myNearWallet.setupMyNearWallet()],
        debug: false,
      })
      if (selector.options.network.networkId !== 'mainnet') {
        throw new Error('The wallet selector did not initialize on NEAR mainnet.')
      }
      const modal = modalUi.setupModal(selector, {
        theme: 'dark',
        description: 'Connect a NEAR mainnet account. Grind District never needs your seed phrase.',
      })
      return { selector, modal }
    })().catch((error: unknown) => {
      sessionPromise = null
      throw error
    })
  }
  return sessionPromise
}

function activeAccountId(selector: WalletSelector): string {
  const accounts = selector.store.getState().accounts
  return accounts.find((account) => account.active)?.accountId ?? accounts[0]?.accountId ?? ''
}

export async function connectNearMainnet(): Promise<NearWalletResult> {
  try {
    const { selector, modal } = await walletSession()
    if (selector.options.network.networkId !== 'mainnet') {
      return { ok: false, error: 'This connection is not on NEAR mainnet.' }
    }
    const alreadyConnected = activeAccountId(selector)
    if (selector.isSignedIn() && alreadyConnected) return { ok: true, accountId: alreadyConnected }

    return await new Promise<NearWalletResult>((resolve) => {
      let settled = false
      let stateSubscription: { unsubscribe: () => void } | undefined
      let modalSubscription: { remove: () => void } | undefined
      const settle = (result: NearWalletResult) => {
        if (settled) return
        settled = true
        stateSubscription?.unsubscribe()
        modalSubscription?.remove()
        if (result.ok) modal.hide()
        resolve(result)
      }
      stateSubscription = selector.store.observable.subscribe((state) => {
        const accountId = state.accounts.find((account) => account.active)?.accountId ?? state.accounts[0]?.accountId
        if (accountId) settle({ ok: true, accountId })
      })
      modalSubscription = modal.on('onHide', ({ hideReason }) => {
        if (hideReason === 'user-triggered') settle({ ok: false, error: 'Wallet connection was cancelled.' })
      })
      modal.show()
    })
  } catch {
    return { ok: false, error: 'NEAR mainnet wallet support could not start. Try again or check the wallet extension.' }
  }
}

export async function disconnectNearMainnet(): Promise<void> {
  const { selector } = await walletSession()
  if (selector.isSignedIn()) {
    const wallet = await selector.wallet()
    await wallet.signOut()
  }
}

/** Requests a NEP-413 message signature only; it never creates or broadcasts a transaction. */
export async function signNearMarketOrder(accountId: string, message: string): Promise<NearWalletResult> {
  try {
    const { selector } = await walletSession()
    if (selector.options.network.networkId !== 'mainnet') {
      return { ok: false, error: 'Market orders require the configured NEAR mainnet wallet.' }
    }
    if (!selector.isSignedIn() || activeAccountId(selector) !== accountId) {
      return { ok: false, error: 'The connected NEAR account changed. Reconnect it before signing.' }
    }
    const wallet = await selector.wallet()
    if (!wallet.signMessage) return { ok: false, error: 'This wallet does not support NEP-413 message signing.' }
    const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
    const signed = await wallet.signMessage({
      message,
      recipient: location.origin,
      nonce,
      callbackUrl: `${location.origin}${location.pathname}`,
    })
    if (!signed || signed.accountId !== accountId || !signed.signature) {
      return { ok: false, error: 'The wallet response did not include the linked account and its signature.' }
    }
    // The signature is intentionally neither persisted nor sent anywhere by the game.
    return { ok: true, accountId }
  } catch {
    return { ok: false, error: 'The NEAR wallet did not complete the market-order signature.' }
  }
}
