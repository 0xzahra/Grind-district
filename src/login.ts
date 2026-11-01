// Privy sign-in (Google, email OTP fallback). Lazy-loaded. Without VITE_PRIVY_APP_ID it shows "coming soon".
const APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined
const USERNAME = /^[a-z0-9_]{3,16}$/
export const CLAIMED_KEY = 'gd.privy.username'

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

/** Finish a Google redirect if we came back from one. */
export async function resumeOAuth(): Promise<void> {
  const q = new URLSearchParams(location.search)
  const code = q.get('privy_oauth_code')
  const state = q.get('privy_oauth_state')
  if (!APP_ID || !code || !state) return
  history.replaceState(null, '', location.pathname)
  try {
    const privy = await client()
    await privy.auth.oauth.loginWithCode(code, state, 'google')
    openLogin()
  } catch (e) {
    openLogin(`Google sign-in did not complete: ${(e as Error).message || 'unknown error'}. Try again or use an email code.`)
  }
}

/** On the title screen, a returning player who signs in goes straight into the city under their handle. */
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
  const close = el('button', 'Play as guest', 'ghost')
  close.onclick = () => { dlg.remove(); window.dispatchEvent(new Event('gd-login-closed')) }
  // One flow at a time: hide the title-screen account panel while this dialog is up.
  const acct = document.getElementById('menu-account'); const acctWas = acct?.hidden
  if (acct) acct.hidden = true
  window.addEventListener('gd-login-closed', () => { if (acct && acctWas === false && !document.getElementById('login-dlg')) acct.hidden = false }, { once: true })
  dlg.append(logo, el('h2', 'Sign in'), body, close)
  document.body.append(dlg)
  const msg = el('p', notice, 'muted')

  if (!APP_ID) {
    body.append(el('p', 'Sign in is coming soon. You can play now as a guest; your progress stays on this device.', 'muted'))
    return
  }

  // Bind the device to the Privy account: ask the server which username this account owns (if any), move guest
  // progress into the account slot, and only then offer a username claim (always with the Privy token).
  const bind = async (token: string, j: { username?: string | null; userId?: string; save?: unknown }) => {
    if (!j.userId || !j.username) return false
    localStorage.setItem(CLAIMED_KEY, j.username)
    const { adoptAccount } = await import('./state.ts')
    const how = adoptAccount(j.userId, j.username, j.save ?? undefined)
    const st = await import('./state.ts')
    const bonus = await st.grantSignupBonus('')
    void syncProgress(token)
    body.replaceChildren(el('p', `Signed in as @${j.username}.`), el('p', how === 'migrated' ? 'Your guest progress is now saved to your account.' : how === 'server' ? 'Loaded your saved progress.' : 'Loaded your account progress on this device.', 'muted'), ...(bonus ? [el('p', `Welcome bonus: $${st.SIGNUP_BONUS.toLocaleString()} in-game added (once per account).`)] : []))
    void enterAs(j.username)
    return true
  }
  const pickUsername = async (token: string) => {
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
      const r = await fetch('/api/claim-username', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ username: input.value, ref: localStorage.getItem('gd.invitedBy') ?? undefined }) })
      const j = (await r.json().catch(() => ({}))) as { username?: string; userId?: string; error?: string; invitedBy?: string | null }
      if (j.username && (await bind(token, j))) {
        if (j.invitedBy) { body.append(el('p', `@${j.username} joined via @${j.invitedBy}'s invite link.`)); localStorage.removeItem('gd.invitedBy') }
      } else state.textContent = j.error ?? 'Could not save'
    }
    body.replaceChildren(el('p', 'Choose your username. It is unique across the city and stays with this account.'), input, state, save)
  }

  const afterLogin = async (privy: Awaited<ReturnType<typeof client>>) => {
    const token = await privy.getAccessToken()
    if (!token) { msg.textContent = 'Sign in failed'; return }
    body.replaceChildren(el('p', 'Signing you in…', 'muted'))
    const r = await fetch('/api/claim-username', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: '{}' }).catch(() => null)
    const j = r ? (await r.json().catch(() => ({}))) as { username?: string | null; userId?: string; save?: unknown; error?: string } : {}
    if (!r || !r.ok) { body.replaceChildren(el('p', (j as { error?: string }).error ?? 'Could not reach the server. Try again.', 'muted')); return }
    // A cached handle from another account must never stick: the server's answer wins.
    if (!j.username) { localStorage.removeItem(CLAIMED_KEY); if (j.userId) localStorage.setItem('gd.privy.userId', j.userId); void pickUsername(token); return }
    await bind(token, j)
  }

  const google = el('button', 'Continue with Google', 'primary')
  google.onclick = async () => {
    try {
      const privy = await client()
      const { url } = await privy.auth.oauth.generateURL('google', location.origin + location.pathname)
      location.assign(url)
    } catch (e) {
      const m = (e as Error).message || ''
      msg.textContent = /not allowed|disallowed/i.test(m) ? 'Google sign-in is not switched on yet. Use an email code for now.' : m
    }
  }
  const email = el('input'); email.type = 'email'; email.placeholder = 'you@example.com'
  const send = el('button', 'Email me a code', 'ghost')
  const code = el('input'); code.inputMode = 'numeric'; code.placeholder = '6-digit code'; code.hidden = true
  const verify = el('button', 'Verify', 'primary'); verify.hidden = true
  send.onclick = async () => {
    try {
      const privy = await client()
      await privy.auth.email.sendCode(email.value.trim())
      code.hidden = verify.hidden = false
      msg.textContent = 'Code sent.'
    } catch (e) { msg.textContent = (e as Error).message }
  }
  verify.onclick = async () => {
    try {
      const privy = await client()
      await privy.auth.email.loginWithCode(email.value.trim(), code.value.trim())
      await afterLogin(privy)
    } catch (e) { msg.textContent = (e as Error).message }
  }
  body.append(google, el('p', 'or', 'muted'), email, send, code, verify, msg)
  void client().then(async (p) => { if (await p.getAccessToken()) await afterLogin(p) }).catch(() => {})
}

/** Current Privy access token, or null when signed out / Privy not configured. */
export async function accessToken(): Promise<string | null> {
  if (!APP_ID) return null
  try {
    return (await (await client()).getAccessToken()) ?? null
  } catch {
    return null
  }
}

/** Push the local save to the account (server copy for other devices). Best-effort, throttled by callers. */
export async function syncProgress(token?: string | null): Promise<void> {
  if (!localStorage.getItem(CLAIMED_KEY)) return
  const t = token ?? await accessToken()
  if (!t) return
  const { getSave } = await import('./state.ts')
  await fetch('/api/profile?op=progress', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t}` }, body: JSON.stringify({ save: getSave() }) }).catch(() => null)
}
