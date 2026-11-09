// Privy sign-in (Google, X, email) when the Privy app has them on, plus Continue with NEAR (NEP-413 signed login).
// Lazy-loaded. Without VITE_PRIVY_APP_ID the Privy methods are hidden and NEAR / guest still work.
const APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined
const USERNAME = /^[a-z0-9_]{3,16}$/
export const CLAIMED_KEY = 'gd.privy.username'
export const NEAR_KEY = 'gd.near.account'

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
  const menu = document.getElementById('menu')
  if (!menu || menu.hidden) return
  const go = el('button', 'Enter the district', 'primary')
  go.onclick = () => { document.getElementById('login-dlg')?.remove(); document.getElementById('play')?.click() }
  document.querySelector('#login-dlg .wallet-body')?.append(go)
}

export function openLogin(notice = ''): void {
  document.getElementById('login-dlg')?.remove()
  const dlg = el('div', '', 'wallet-dlg login-dlg')
  dlg.id = 'login-dlg'
  dlg.setAttribute('role', 'dialog')
  dlg.setAttribute('aria-label', 'Sign in')
  const logo = el('p', 'Grind District', 'login-wordmark')
  const body = el('div', '', 'wallet-body')
  const close = el('button', '✕', 'ghost login-x'); close.setAttribute('aria-label', 'Close')
  close.onclick = () => { dlg.remove(); window.dispatchEvent(new Event('gd-login-closed')) }
  const acct = document.getElementById('menu-account'); const acctWas = acct?.hidden
  if (acct) acct.hidden = true
  window.addEventListener('gd-login-closed', () => { if (acct && acctWas === false && !document.getElementById('login-dlg')) acct.hidden = false }, { once: true })
  dlg.append(close, logo, el('h2', 'Sign in'), body)
  const mo = new MutationObserver(() => { if (document.body.classList.contains('sheet-open')) { mo.disconnect(); close.click() } })
  mo.observe(document.body, { attributes: true, attributeFilter: ['class'] })
  document.body.append(dlg)
  const msg = el('p', notice, 'muted')

  const bind = async (token: string | null, j: { username?: string | null; userId?: string; save?: unknown }, nearProof?: unknown) => {
    if (!j.userId || !j.username) return false
    localStorage.setItem(CLAIMED_KEY, j.username)
    if (j.userId.startsWith('near:')) localStorage.setItem(NEAR_KEY, j.userId.slice(5))
    const { adoptAccount } = await import('./state.ts')
    const how = adoptAccount(j.userId, j.username, j.save ?? undefined)
    const st = await import('./state.ts')
    const bonus = await st.grantSignupBonus('')
    if (token) void syncProgress(token)
    else if (nearProof) void syncProgressNear(nearProof)
    body.replaceChildren(
      el('p', `Signed in as @${j.username}.`),
      el('p', how === 'migrated' ? 'Your guest progress is now saved to your account.' : how === 'server' ? 'Loaded your saved progress.' : 'Loaded your account progress on this device.', 'muted'),
      ...(bonus ? [el('p', `Welcome bonus: $${st.SIGNUP_BONUS.toLocaleString()} in-game added (once per account).`)] : []),
    )
    void enterAs(j.username)
    return true
  }

  const pickUsername = async (auth: { token?: string; near?: unknown }, userId: string) => {
    const input = el('input'); input.placeholder = 'username'; input.maxLength = 16; input.autocapitalize = 'off'
    const state = el('p', '', 'muted')
    const save = el('button', 'Claim username', 'primary')
    let timer = 0
    input.oninput = () => {
      const u = input.value.trim().toLowerCase()
      clearTimeout(timer)
      if (!USERNAME.test(u)) { state.textContent = '3–16 characters: a–z, 0–9 or _'; return }
      state.textContent = 'Checking…'
      timer = window.setTimeout(async () => {
        const r = await fetch(`/api/check-username?u=${encodeURIComponent(u)}`).then((x) => x.json()).catch(() => null) as { available?: boolean; reason?: string } | null
        state.textContent = !r ? 'Could not check right now' : r.available ? 'Available' : r.reason || 'Taken'
      }, 250)
    }
    save.onclick = async () => {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      const bodyJson: Record<string, unknown> = { username: input.value, ref: localStorage.getItem('gd.invitedBy') ?? undefined }
      if (auth.token) headers.authorization = `Bearer ${auth.token}`
      if (auth.near) bodyJson.near = auth.near
      const r = await fetch('/api/claim-username', { method: 'POST', headers, body: JSON.stringify(bodyJson) })
      const j = (await r.json().catch(() => ({}))) as { username?: string; userId?: string; error?: string; invitedBy?: string | null }
      if (j.username && (await bind(auth.token ?? null, j, auth.near))) {
        if (j.invitedBy) { body.append(el('p', `@${j.username} joined via @${j.invitedBy}'s invite link.`)); localStorage.removeItem('gd.invitedBy') }
      } else state.textContent = j.error ?? 'Could not save'
    }
    body.replaceChildren(el('p', 'Choose your username. It is unique across the city and stays with this account.'), input, state, save)
    void userId
  }

  const afterLogin = async (privy: Awaited<ReturnType<typeof client>>) => {
    const token = await privy.getAccessToken()
    if (!token) { msg.textContent = 'Sign in failed'; return }
    body.replaceChildren(el('p', 'Signing you in…', 'muted'))
    const r = await fetch('/api/claim-username', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: '{}' }).catch(() => null)
    const j = r ? (await r.json().catch(() => ({}))) as { username?: string | null; userId?: string; save?: unknown; error?: string } : {}
    if (!r || !r.ok) { body.replaceChildren(el('p', (j as { error?: string }).error ?? 'Could not reach the server. Try again.', 'muted')); return }
    if (!j.username) { localStorage.removeItem(CLAIMED_KEY); if (j.userId) localStorage.setItem('gd.privy.userId', j.userId); void pickUsername({ token }, j.userId!); return }
    await bind(token, j)
  }

  const afterNearLogin = async (proof: Record<string, unknown>) => {
    body.replaceChildren(el('p', 'Signing you in with NEAR…', 'muted'))
    const r = await fetch('/api/claim-username', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ near: proof }) }).catch(() => null)
    const j = r ? (await r.json().catch(() => ({}))) as { username?: string | null; userId?: string; save?: unknown; error?: string } : {}
    if (!r || !r.ok) { body.replaceChildren(el('p', (j as { error?: string }).error ?? 'Could not reach the server. Try again.', 'muted'), nearButton()); return }
    if (!j.username) { localStorage.removeItem(CLAIMED_KEY); if (j.userId) localStorage.setItem('gd.privy.userId', j.userId); void pickUsername({ near: proof }, j.userId!); return }
    await bind(null, j, proof)
  }

  const social = (provider: Social) => {
    const b = el('button', `Continue with ${SOCIAL_LABEL[provider]}`, 'primary')
    b.onclick = async () => {
      b.disabled = true
      b.textContent = `Opening ${SOCIAL_LABEL[provider]}…`
      try {
        const privy = await client()
        const { url } = await privy.auth.oauth.generateURL(provider, location.origin + location.pathname)
        try { sessionStorage.setItem(OAUTH_KEY, provider) } catch { /* private mode */ }
        location.assign(url)
      } catch (e) {
        b.disabled = false
        b.textContent = `Continue with ${SOCIAL_LABEL[provider]}`
        msg.textContent = `${SOCIAL_LABEL[provider]} sign-in failed: ${(e as Error).message || 'unknown error'}`
      }
    }
    return b
  }

  const nearButton = () => {
    const b = el('button', 'Continue with NEAR', 'primary')
    b.onclick = async () => {
      b.disabled = true
      b.textContent = 'Opening NEAR wallets…'
      msg.textContent = 'No funds or transactions — only a signed login message.'
      try {
        const { NearConnector } = await import('@hot-labs/near-connect')
        const nonce = crypto.getRandomValues(new Uint8Array(32))
        const nonceB64 = btoa(String.fromCharCode(...Array.from(nonce)))
        const message = `Grind District login\n${Date.now()}\n${nonceB64}`
        const connector = new NearConnector({ network: 'testnet', features: { signMessage: true, signInAndSignMessage: true } })
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
        await afterNearLogin({ accountId, publicKey, signature, message, recipient: NEAR_RECIPIENT, nonce: nonceB64 })
      } catch (e) {
        b.disabled = false
        b.textContent = 'Continue with NEAR'
        msg.textContent = `NEAR sign-in failed: ${(e as Error).message || 'unknown error'}. No funds were requested.`
      }
    }
    return b
  }

  const email = el('input'); email.type = 'email'; email.placeholder = 'you@example.com'
  const send = el('button', 'Email me a code', 'ghost')
  const code = el('input'); code.inputMode = 'numeric'; code.placeholder = '6-digit code'; code.hidden = true
  const verify = el('button', 'Verify', 'primary'); verify.hidden = true
  send.onclick = async () => {
    if (!email.value.trim()) { msg.textContent = 'Enter your email first.'; return }
    send.disabled = true
    msg.textContent = 'Sending…'
    try {
      const privy = await client()
      await privy.auth.email.sendCode(email.value.trim())
      code.hidden = verify.hidden = false
      msg.textContent = 'Code sent. Check your inbox (and spam).'
    } catch (e) { msg.textContent = `Could not send the code: ${(e as Error).message || 'unknown error'}` }
    send.disabled = false
  }
  verify.onclick = async () => {
    try {
      const privy = await client()
      await privy.auth.email.loginWithCode(email.value.trim(), code.value.trim())
      await afterLogin(privy)
    } catch (e) { msg.textContent = (e as Error).message }
  }
  send.className = 'primary'

  const loading = el('p', 'Loading sign-in options…', 'muted')
  body.append(loading, msg)

  const renderOptions = (opts: { google: boolean; twitter: boolean; email: boolean; domainOk: boolean } | null, privyError = '') => {
    loading.remove()
    const parts: HTMLElement[] = []
    // NEAR is always offered: it uses the game's own wallet connector and a signed message, not Privy.
    parts.push(nearButton())
    if (!APP_ID) {
      parts.push(el('p', 'Google, X and email need the Privy app set up on this build. NEAR and guest play still work.', 'muted'))
    } else if (privyError) {
      parts.push(el('p', privyError, 'muted'))
    } else if (!opts) {
      parts.push(el('p', 'Could not load Google / X / email options. Try NEAR, or play as a guest.', 'muted'))
    } else if (!opts.domainOk) {
      parts.push(el('p', `Google, X and email are not enabled for ${location.host} yet. You can use NEAR or play as a guest.`, 'muted'))
    } else {
      if (opts.google) parts.push(social('google'))
      if (opts.twitter) parts.push(social('twitter'))
      if (opts.email) {
        parts.push(el('p', parts.length ? 'Or get a one-time code by email.' : 'Sign in with a one-time code sent to your email.', 'muted'), email, send, code, verify)
      }
      if (!opts.google && !opts.twitter && !opts.email) {
        parts.push(el('p', 'Google, X and email are off in the Privy dashboard. NEAR and guest play still work.', 'muted'))
      }
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
    try {
      await withTimeout(p.initialize(), 10_000, 'timed out')
    } catch (e) {
      renderOptions(null, `Could not reach the sign-in service: ${(e as Error).message || 'network error'}. Try NEAR, or play as a guest.`)
      return
    }
    try {
      if (await p.getAccessToken()) { await afterLogin(p); return }
    } catch { /* treat as signed out */ }
    try {
      const cfg = p.app.getConfig()
      if (!cfg) { renderOptions(null); return }
      const allowed = (cfg.allowed_domains ?? []).map((d: string) => d.replace(/\/+$/, '').toLowerCase())
      const here = location.origin.toLowerCase()
      const domainOk = allowed.length === 0 || allowed.some((d: string) => d === here || d === location.host.toLowerCase() || (d.startsWith('https://*.') && here.endsWith(d.slice(9))))
      renderOptions({ google: !!cfg.google_oauth, twitter: !!cfg.twitter_oauth, email: !!cfg.email_auth, domainOk })
    } catch {
      renderOptions(null)
    }
  }).catch((e) => {
    renderOptions(null, `Could not reach the sign-in service: ${(e as Error).message || 'network error'}. Try NEAR, or play as a guest.`)
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
