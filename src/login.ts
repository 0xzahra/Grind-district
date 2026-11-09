import { trackFunnelOnce } from './track.ts'
// Privy sign-in (Google, X, email) when the Privy app has them on, plus Continue with NEAR (NEP-413 signed login).
// Lazy-loaded. Without VITE_PRIVY_APP_ID the Privy methods are hidden; NEAR still works. Guest play is gated off.
import { needsAvatarCreator, mountAvatarCreator } from './creator.ts'
const APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined
const USERNAME = /^[a-z0-9_]{3,20}$/
export const CLAIMED_KEY = 'gd.privy.username'
export const NEAR_KEY = 'gd.near.account'
const DRAFT_KEY = 'gd.signup.username'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (text) n.textContent = text
  if (cls) n.className = cls
  return n
}

async function client() {
  const mod = await import('@privy-io/js-sdk-core')
  return new mod.default({ appId: APP_ID!, storage: new mod.LocalStorage() })
}

type Social = 'google' | 'twitter'
const SOCIAL_LABEL: Record<Social, string> = { google: 'Google', twitter: 'X' }
const OAUTH_KEY = 'gd.oauth.provider'
const NEAR_RECIPIENT = 'grinddistrict.vercel.app'

/** Finish a Google or X redirect if we came back from one. */
export async function resumeOAuth(): Promise<void> {
  const q = new URLSearchParams(location.search)
  const code = q.get('privy_oauth_code')
  const state = q.get('privy_oauth_state')
  if (!APP_ID || !code || !state) return
  history.replaceState(null, '', location.pathname)
  let provider: Social = 'google'
  try { if (sessionStorage.getItem(OAUTH_KEY) === 'twitter') provider = 'twitter'; sessionStorage.removeItem(OAUTH_KEY) } catch { /* private mode */ }
  try {
    const privy = await client()
    await privy.auth.oauth.loginWithCode(code, state, provider)
    openLogin()
  } catch (e) {
    openLogin(`${SOCIAL_LABEL[provider]} sign-in did not complete: ${(e as Error).message || 'unknown error'}. Try again or use another option.`)
  }
}

async function withTimeout<T>(p: Promise<T>, ms: number, label = 'timed out'): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms))])
}


async function enterAs(_handle: string): Promise<void> {
  window.dispatchEvent(new Event('gd-auth-changed'))
  const menu = document.getElementById('menu')
  if (!menu || menu.hidden) return
  const body = document.querySelector<HTMLElement>('#login-dlg .wallet-body')
  const finish = () => {
    document.getElementById('login-dlg')?.remove()
    // Refresh Continue label, then enter without restarting the title preview mid-flight.
    window.dispatchEvent(new Event('gd-auth-changed'))
    window.dispatchEvent(new Event('gd-enter-city'))
  }
  if (body && needsAvatarCreator()) {
    mountAvatarCreator(body, finish)
    return
  }
  const go = el('button', 'Enter the district', 'glass-btn primary')
  go.onclick = finish
  body?.append(go)
}

export type LoginMode = 'signin' | 'signup'

export function openLogin(notice = '', mode: LoginMode = 'signin'): void {
  document.getElementById('login-dlg')?.remove()
  const dlg = el('div', '', 'wallet-dlg login-dlg')
  dlg.id = 'login-dlg'
  dlg.setAttribute('role', 'dialog')
  const heading = mode === 'signup' ? 'Sign up' : 'Sign in'
  dlg.setAttribute('aria-label', heading)
  const logo = el('p', 'Grind District', 'login-wordmark')
  const body = el('div', '', 'wallet-body')
  const close = el('button', '✕', 'ghost login-x'); close.type = 'button'; close.setAttribute('aria-label', 'Close')
  // Closed flag lets in-flight Google/X/email/NEAR work abort instead of navigating or hanging the panel.
  let closed = false
  let nearConnector: { disconnect?: () => Promise<unknown> | void } | null = null
  const dismiss = () => {
    if (closed) return
    closed = true
    try { mo.disconnect() } catch { /* already gone */ }
    try { sessionStorage.removeItem(OAUTH_KEY) } catch { /* private mode */ }
    // Cancel in-flight NEAR wallet UI if the connector exposes disconnect.
    try { void nearConnector?.disconnect?.() } catch { /* ignore */ }
    nearConnector = null
    // Tear down common wallet/privy overlays so a cancelled provider tap does not leave a stuck modal.
    for (const sel of [
      'iframe[src*="privy"]',
      'iframe[src*="near"]',
      '[id*="near-connector"]',
      '[class*="near-connector"]',
      '[data-near-connect]',
      '#w3m-modal',
      'w3m-modal',
    ]) {
      document.querySelectorAll(sel).forEach((n) => { try { n.remove() } catch { /* ignore */ } })
    }
    dlg.remove()
    window.dispatchEvent(new Event('gd-login-closed'))
  }
  // pointerdown + click: touch devices sometimes swallow click after a disabled provider button.
  close.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); dismiss() })
  close.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); dismiss() })
  const acct = document.getElementById('menu-account'); const acctWas = acct?.hidden
  if (acct) acct.hidden = true
  window.addEventListener('gd-login-closed', () => { if (acct && acctWas === false && !document.getElementById('login-dlg')) acct.hidden = false }, { once: true })
  dlg.append(logo, el('h2', heading), body, close)
  const mo = new MutationObserver(() => { if (document.body.classList.contains('sheet-open')) { mo.disconnect(); dismiss() } })
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  document.body.append(dlg)
  const msg = el('p', notice, 'muted')

  const bind = async (token: string | null, j: { username?: string | null; userId?: string; save?: unknown }, nearProof?: unknown, opts?: { firstClaim?: boolean }) => {
    if (!j.userId || !j.username) return false
    localStorage.setItem(CLAIMED_KEY, j.username)
    localStorage.setItem('gd.privy.userId', j.userId)
    if (j.userId.startsWith('near:')) localStorage.setItem(NEAR_KEY, j.userId.slice(5))
    trackFunnelOnce('account_created', { userIdPrefix: j.userId.startsWith('near:') ? 'near' : 'privy' })
    const { adoptAccount } = await import('./state.ts')
    const how = adoptAccount(j.userId, j.username, j.save ?? undefined)
    const st = await import('./state.ts')
    // Sign-up bonus only on a true first username claim — never again on Continue / re-login.
    const bonus = opts?.firstClaim ? await st.grantSignupBonus('') : false
    if (token) void syncProgress(token)
    else if (nearProof) void syncProgressNear(nearProof)
    const howLine = how === 'fresh'
      ? 'Starting a fresh account on this device.'
      : how === 'migrated'
        ? 'Your guest progress is now saved to your account.'
        : how === 'server'
          ? 'Loaded your saved progress.'
          : 'Loaded your account progress on this device.'
    body.replaceChildren(
      el('p', `Signed in as @${j.username}.`),
      el('p', howLine, 'muted'),
      ...(bonus ? [el('p', `Welcome bonus: $${st.SIGNUP_BONUS.toLocaleString()} in-game added (once per account).`)] : []),
    )
    void enterAs(j.username)
    return true
  }

  const readDraft = () => {
    try { return (sessionStorage.getItem(DRAFT_KEY) ?? '').trim().toLowerCase() } catch { return '' }
  }
  const writeDraft = (u: string) => {
    try {
      const v = u.trim().toLowerCase()
      if (v) sessionStorage.setItem(DRAFT_KEY, v)
      else sessionStorage.removeItem(DRAFT_KEY)
    } catch { /* private */ }
  }

  const ensureGameId = (): string | null => {
    const live = body.querySelector<HTMLInputElement>('input[data-game-id]')
    const typed = live ? live.value.trim().toLowerCase() : ''
    const u = typed || readDraft()
    writeDraft(u)
    if (USERNAME.test(u)) return u
    msg.textContent = 'Pick a Game ID first (3–20 letters, numbers, or _).'
    live?.focus()
    return null
  }

  const claimWith = async (auth: { token?: string; near?: unknown }, username: string) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' }
    const bodyJson: Record<string, unknown> = { username, ref: localStorage.getItem('gd.invitedBy') ?? undefined }
    if (auth.token) headers.authorization = `Bearer ${auth.token}`
    if (auth.near) bodyJson.near = auth.near
    const r = await fetch('/api/claim-username', { method: 'POST', headers, body: JSON.stringify(bodyJson) })
    const j = (await r.json().catch(() => ({}))) as { username?: string; userId?: string; error?: string; invitedBy?: string | null }
    if (j.username && (await bind(auth.token ?? null, j, auth.near, { firstClaim: true }))) {
      try { sessionStorage.removeItem(DRAFT_KEY) } catch { /* */ }
      if (j.invitedBy) { body.append(el('p', `@${j.username} joined via @${j.invitedBy}'s invite link.`)); localStorage.removeItem('gd.invitedBy') }
      return true
    }
    return j.error ?? 'Could not save'
  }

  const pickUsername = async (auth: { token?: string; near?: unknown }, userId: string) => {
    const input = el('input')
    input.placeholder = 'Game ID (username)'
    input.maxLength = 20
    input.autocapitalize = 'off'
    input.autocomplete = 'username'
    input.setAttribute('aria-label', 'Game ID username')
    input.value = readDraft()
    const state = el('p', '', 'muted')
    const save = el('button', 'Claim Game ID', 'glass-btn primary')
    let timer = 0
    const check = () => {
      const u = input.value.trim().toLowerCase()
      clearTimeout(timer)
      writeDraft(u)
      if (!USERNAME.test(u)) { state.textContent = '3–20 characters: a–z, 0–9 or _'; return }
      state.textContent = 'Checking…'
      timer = window.setTimeout(async () => {
        const r = await fetch(`/api/check-username?u=${encodeURIComponent(u)}`).then((x) => x.json()).catch(() => null) as { available?: boolean; reason?: string } | null
        if (!r) { state.textContent = 'Could not check — we will still try to save it as your Game ID'; return }
        state.textContent = r.available ? 'Available — this will be your Game ID' : r.reason || 'Taken'
      }, 250)
    }
    input.oninput = check
    if (input.value) check()
    save.onclick = async () => {
      const u = input.value.trim().toLowerCase()
      if (!USERNAME.test(u)) { state.textContent = '3–20 characters: a–z, 0–9 or _'; return }
      save.disabled = true
      const err = await claimWith(auth, u)
      if (err !== true) { state.textContent = String(err); save.disabled = false }
    }
    body.replaceChildren(
      el('p', 'Choose your Game ID. This is your unique username in the city — it stays with this account (Google, X, email, or NEAR).'),
      input, state, save,
    )
    void userId
  }

  const afterLogin = async (privy: Awaited<ReturnType<typeof client>>) => {
    if (closed) return
    const token = await privy.getAccessToken()
    if (closed) return
    if (!token) { msg.textContent = 'Sign in failed'; return }
    body.replaceChildren(el('p', 'Signing you in…', 'muted'))
    const r = await fetch('/api/claim-username', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: '{}' }).catch(() => null)
    const j = r ? (await r.json().catch(() => ({}))) as { username?: string | null; userId?: string; save?: unknown; error?: string } : {}
    if (!r || !r.ok) { body.replaceChildren(el('p', (j as { error?: string }).error ?? 'Could not reach the server. Try again.', 'muted')); return }
    if (!j.username) {
      localStorage.removeItem(CLAIMED_KEY)
      if (j.userId) localStorage.setItem('gd.privy.userId', j.userId)
      const draft = readDraft()
      if (draft && USERNAME.test(draft)) {
        body.replaceChildren(el('p', `Claiming @${draft}…`, 'muted'))
        const err = await claimWith({ token }, draft)
        if (err === true) return
        body.replaceChildren(el('p', String(err), 'muted'))
      }
      void pickUsername({ token }, j.userId!)
      return
    }
    await bind(token, j)
  }

  const afterNearLogin = async (proof: Record<string, unknown>) => {
    body.replaceChildren(el('p', 'Signing you in with NEAR…', 'muted'))
    const r = await fetch('/api/claim-username', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ near: proof }) }).catch(() => null)
    const j = r ? (await r.json().catch(() => ({}))) as { username?: string | null; userId?: string; save?: unknown; error?: string } : {}
    if (!r || !r.ok) { body.replaceChildren(el('p', (j as { error?: string }).error ?? 'Could not reach the server. Try again.', 'muted'), nearButton()); return }
    if (!j.username) {
      localStorage.removeItem(CLAIMED_KEY)
      if (j.userId) localStorage.setItem('gd.privy.userId', j.userId)
      const draft = readDraft()
      if (draft && USERNAME.test(draft)) {
        body.replaceChildren(el('p', `Claiming @${draft}…`, 'muted'))
        const err = await claimWith({ near: proof }, draft)
        if (err === true) return
        body.replaceChildren(el('p', String(err), 'muted'))
      }
      void pickUsername({ near: proof }, j.userId!)
      return
    }
    await bind(null, j, proof)
  }

  const social = (provider: Social) => {
    const b = el('button', `Continue with ${SOCIAL_LABEL[provider]}`, 'glass-btn primary')
    b.onclick = async () => {
      if (closed) return
      if (mode === 'signup' && !ensureGameId()) return
      b.disabled = true
      b.textContent = `Opening ${SOCIAL_LABEL[provider]}…`
      try {
        const privy = await client()
        if (closed) return
        const { url } = await privy.auth.oauth.generateURL(provider, location.origin + location.pathname)
        if (closed) return
        try { sessionStorage.setItem(OAUTH_KEY, provider) } catch { /* private mode */ }
        location.assign(url)
      } catch (e) {
        if (closed) return
        b.disabled = false
        b.textContent = `Continue with ${SOCIAL_LABEL[provider]}`
        const err = (e as Error).message || 'unknown error'
        msg.textContent = /cancel|denied|closed|block|popup/i.test(err)
          ? 'Sign-in cancelled. You can try again or pick another option.'
          : `${SOCIAL_LABEL[provider]} sign-in failed: ${err}`
      }
    }
    return b
  }

  const nearButton = () => {
    const b = el('button', 'Continue with NEAR', 'glass-btn primary')
    b.onclick = async () => {
      if (closed) return
      if (mode === 'signup' && !ensureGameId()) return
      b.disabled = true
      b.textContent = 'Opening NEAR wallets…'
      msg.textContent = 'No funds or transactions — only a signed login message.'
      try {
        const nonce = crypto.getRandomValues(new Uint8Array(32))
        const nonceB64 = btoa(String.fromCharCode(...Array.from(nonce)))
        const message = `Grind District login\n${Date.now()}\n${nonceB64}`
        // Test hook: a page can set window.__GD_MOCK_NEAR__ to return a NEP-413 proof (no real wallet).
        const mock = (window as unknown as { __GD_MOCK_NEAR__?: (a: { message: string; recipient: string; nonce: Uint8Array; nonceB64: string }) => Promise<Record<string, unknown>> }).__GD_MOCK_NEAR__
        if (mock) {
          if (closed) return
          await afterNearLogin(await mock({ message, recipient: NEAR_RECIPIENT, nonce, nonceB64 }))
          return
        }
        const { NearConnector } = await import('@hot-labs/near-connect')
        const connector = new NearConnector({ network: 'testnet', features: { signMessage: true, signInAndSignMessage: true } })
        nearConnector = connector as { disconnect?: () => Promise<unknown> | void }
        if (closed) { try { void nearConnector.disconnect?.() } catch { /* ignore */ }; return }
        type Acc = { accountId: string; publicKey?: string; signedMessage?: { accountId: string; publicKey: string; signature: string } }
        const signedAcc = new Promise<Acc>((resolve, reject) => {
          const t = window.setTimeout(() => reject(new Error('NEAR wallet timed out')), 120_000)
          connector.once('wallet:signInAndSignMessage', (p: { success: boolean; accounts: Acc[] }) => {
            window.clearTimeout(t)
            if (p.success && p.accounts?.[0]) resolve(p.accounts[0])
            else reject(new Error('NEAR sign-in returned no account'))
          })
        })
        const wallet = await connector.connect({ signMessageParams: { message, recipient: NEAR_RECIPIENT, nonce } })
        let accountId = ''
        let publicKey = ''
        let signature = ''
        try {
          const a = await signedAcc
          accountId = a.accountId
          if (a.signedMessage) { publicKey = a.signedMessage.publicKey; signature = a.signedMessage.signature }
        } catch {
          // Wallet signed in without the message: ask for a separate NEP-413 signature.
          const acc = (await wallet.getAccounts())[0]
          if (!acc?.accountId) throw new Error('No NEAR account connected')
          const signed = await wallet.signMessage({ message, recipient: NEAR_RECIPIENT, nonce })
          accountId = signed.accountId || acc.accountId
          publicKey = signed.publicKey
          signature = signed.signature
        }
        if (!accountId || !publicKey || !signature) throw new Error('Wallet did not return a signed message')
        if (closed) return
        nearConnector = null
        await afterNearLogin({ accountId, publicKey, signature, message, recipient: NEAR_RECIPIENT, nonce: nonceB64 })
      } catch (e) {
        nearConnector = null
        if (closed) return
        b.disabled = false
        b.textContent = 'Continue with NEAR'
        const err = (e as Error).message || 'unknown error'
        // Popup blocked / user cancelled should land as a soft error with buttons re-enabled.
        msg.textContent = /cancel|denied|closed|block|popup/i.test(err)
          ? 'Sign-in cancelled. You can try again or pick another option.'
          : `NEAR sign-in failed: ${err}. No funds were requested.`
      }
    }
    return b
  }

  const email = el('input'); email.type = 'email'; email.placeholder = 'you@example.com'
  const send = el('button', 'Email me a code', 'glass-btn ghost')
  const code = el('input'); code.inputMode = 'numeric'; code.placeholder = '6-digit code'; code.hidden = true
  const verify = el('button', 'Verify', 'glass-btn primary'); verify.hidden = true
  send.onclick = async () => {
    if (closed) return
    if (mode === 'signup' && !ensureGameId()) return
    if (!email.value.trim()) { msg.textContent = 'Enter your email first.'; return }
    send.disabled = true
    msg.textContent = 'Sending…'
    try {
      const privy = await client()
      if (closed) return
      await privy.auth.email.sendCode(email.value.trim())
      if (closed) return
      code.hidden = verify.hidden = false
      msg.textContent = 'Code sent. Check your inbox (and spam).'
    } catch (e) { if (!closed) msg.textContent = `Could not send the code: ${(e as Error).message || 'unknown error'}` }
    if (!closed) send.disabled = false
  }
  verify.onclick = async () => {
    if (closed) return
    try {
      const privy = await client()
      if (closed) return
      await privy.auth.email.loginWithCode(email.value.trim(), code.value.trim())
      if (closed) return
      await afterLogin(privy)
    } catch (e) { if (!closed) msg.textContent = (e as Error).message }
  }
  send.className = 'glass-btn ghost'

  const loading = el('p', mode === 'signup' ? 'Loading sign up…' : 'Loading sign in…', 'muted')
  body.append(loading, msg)

  const renderOptions = (opts: { google: boolean; twitter: boolean; email: boolean; domainOk: boolean } | null, privyError = '') => {
    if (closed) return
    loading.remove()
    const parts: HTMLElement[] = []
    if (mode === 'signup') {
      const gameBox = el('div', '', 'login-game-id')
      const input = el('input')
      input.placeholder = 'Game ID (username)'
      input.maxLength = 20
      input.autocapitalize = 'off'
      input.autocomplete = 'username'
      input.dataset.gameId = '1'
      input.setAttribute('aria-label', 'Game ID username')
      input.value = readDraft()
      const state = el('p', 'Your public Game ID in Grind District. 3–20 characters: a–z, 0–9 or _.', 'muted')
      let timer = 0
      input.oninput = () => {
        const u = input.value.trim().toLowerCase()
        clearTimeout(timer)
        writeDraft(u)
        if (!u) { state.textContent = 'Your public Game ID in Grind District. 3–20 characters: a–z, 0–9 or _.'; return }
        if (!USERNAME.test(u)) { state.textContent = '3–20 characters: a–z, 0–9 or _'; return }
        state.textContent = 'Checking…'
        timer = window.setTimeout(async () => {
          const r = await fetch(`/api/check-username?u=${encodeURIComponent(u)}`).then((x) => x.json()).catch(() => null) as { available?: boolean; reason?: string } | null
          if (!r) { state.textContent = 'Could not check right now — you can still continue'; return }
          state.textContent = r.available ? `@${u} is available` : (r.reason || 'Taken')
        }, 250)
      }
      if (input.value) input.dispatchEvent(new Event('input'))
      gameBox.append(el('p', 'Pick your Game ID', 'kicker'), input, state)
      parts.push(gameBox)
    }
    const stack = el('div', '', 'login-providers')
    // Order: X, Google, NEAR (always), then compact email (Privy one-time code — email cannot verify without a code).
    if (APP_ID && opts?.domainOk) {
      if (opts.twitter) stack.append(social('twitter'))
      if (opts.google) stack.append(social('google'))
    }
    stack.append(nearButton())
    parts.push(stack)
    if (!APP_ID) {
      parts.push(el('p', 'Google, X and email need the Privy app set up on this build. NEAR still works.', 'muted'))
    } else if (privyError) {
      parts.push(el('p', privyError, 'muted'))
    } else if (!opts) {
      parts.push(el('p', 'Could not load Google / X / email options. Try NEAR.', 'muted'))
    } else if (!opts.domainOk) {
      parts.push(el('p', `Google, X and email are not enabled for ${location.host} yet. You can use NEAR.`, 'muted'))
    } else if (opts.email) {
      const emailBox = el('div', '', 'login-email')
      emailBox.append(
        el('p', 'Or email a one-time code', 'muted login-email-label'),
        email, send, code, verify,
      )
      parts.push(emailBox)
    } else if (!opts.google && !opts.twitter && !opts.email) {
      parts.push(el('p', 'Google, X and email are off in the Privy dashboard. NEAR still works.', 'muted'))
    }
    parts.push(el('p', 'No funds or transactions are requested to sign in.', 'muted'))
    body.insertBefore(el('div', '', 'login-options'), msg).append(...parts)
  }

  if (!APP_ID) {
    renderOptions(null)
    return
  }

  // Initialize with a hard timeout BEFORE checking the access token, so a hung Privy never leaves "Loading…" forever.
  void client().then(async (p) => {
    if (closed) return
    try {
      await withTimeout(p.initialize(), 10_000, 'timed out')
    } catch (e) {
      if (!closed) renderOptions(null, `Could not reach the sign-in service: ${(e as Error).message || 'network error'}. Try NEAR.`)
      return
    }
    if (closed) return
    try {
      if (await p.getAccessToken()) { await afterLogin(p); return }
    } catch { /* treat as signed out */ }
    if (closed) return
    try {
      const cfg = p.app.getConfig()
      if (!cfg) { renderOptions(null); return }
      const allowed = (cfg.allowed_domains ?? []).map((d: string) => d.replace(/\/+$/, '').toLowerCase())
      const here = location.origin.toLowerCase()
      const localDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      const domainOk = localDev || allowed.length === 0 || allowed.some((d: string) => d === here || d === location.host.toLowerCase() || (d.startsWith('https://*.') && here.endsWith(d.slice(9))))
      renderOptions({ google: !!cfg.google_oauth, twitter: !!cfg.twitter_oauth, email: !!cfg.email_auth, domainOk })
    } catch {
      if (!closed) renderOptions(null)
    }
  }).catch((e) => {
    if (!closed) renderOptions(null, `Could not reach the sign-in service: ${(e as Error).message || 'network error'}. Try NEAR.`)
  })
}

export async function accessToken(): Promise<string | null> {
  if (!APP_ID) return null
  try {
    return (await (await client()).getAccessToken()) ?? null
  } catch {
    return null
  }
}

export async function syncProgress(token?: string | null): Promise<boolean> {
  if (!localStorage.getItem(CLAIMED_KEY)) return true
  const t = token ?? await accessToken()
  if (!t) return false
  const { getSave } = await import('./state.ts')
  const r = await fetch('/api/profile?op=progress', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ save: getSave() }) }).catch(() => null)
  return !!r && r.ok
}

async function syncProgressNear(near: unknown): Promise<boolean> {
  if (!localStorage.getItem(CLAIMED_KEY)) return true
  const { getSave } = await import('./state.ts')
  const r = await fetch('/api/profile?op=progress', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ save: getSave(), near }) }).catch(() => null)
  return !!r && r.ok
}

/** Sign out: push progress, end Privy and NEAR sessions, clear this device's binding, reload to the opening screen. */
export async function signOut(): Promise<void> {
  const saved = await syncProgress().catch(() => false)
  if (!saved && localStorage.getItem(CLAIMED_KEY) && !confirm('Could not save your progress to your account just now. It stays on this device under your account. Sign out anyway?')) return
  if (APP_ID) { try { await (await client()).auth.logout() } catch { /* already signed out */ } }
  try {
    const { NearConnector } = await import('@hot-labs/near-connect')
    const c = new NearConnector({ network: 'testnet' })
    const w = await c.wallet().catch(() => null)
    if (w) await w.signOut().catch(() => {})
  } catch { /* no near session */ }
  for (const k of [CLAIMED_KEY, NEAR_KEY, 'gd.privy.userId', 'grind-district-save-v1']) {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  }
  location.assign(location.pathname)
}
