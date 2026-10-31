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
  const privy = await client()
  await privy.auth.oauth.loginWithCode(code, state, 'google')
  openLogin()
}

export function openLogin(): void {
  document.getElementById('login-dlg')?.remove()
  const dlg = el('div', '', 'wallet-dlg login-dlg')
  dlg.id = 'login-dlg'
  dlg.setAttribute('role', 'dialog')
  dlg.setAttribute('aria-label', 'Sign in')
  const logo = el('p', 'Grind District', 'login-wordmark')
  const body = el('div', '', 'wallet-body')
  const close = el('button', 'Play as guest', 'ghost')
  close.onclick = () => dlg.remove()
  dlg.append(logo, el('h2', 'Sign in'), body, close)
  document.body.append(dlg)
  const msg = el('p', '', 'muted')

  if (!APP_ID) {
    body.append(el('p', 'Sign in is coming soon. You can play now as a guest; your progress stays on this device.', 'muted'))
    return
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
      const r = await fetch('/api/claim-username', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ username: input.value }) })
      const j = (await r.json().catch(() => ({}))) as { username?: string; userId?: string; error?: string }
      if (j.userId) localStorage.setItem('gd.privy.userId', j.userId)
      if (j.username) {
        localStorage.setItem(CLAIMED_KEY, j.username)
        body.replaceChildren(el('p', `Signed in as @${j.username}.`))
      } else state.textContent = j.error ?? 'Could not save'
    }
    body.replaceChildren(el('p', 'Choose your username. It is unique across the city.'), input, state, save)
  }

  const afterLogin = async (privy: Awaited<ReturnType<typeof client>>) => {
    const token = await privy.getAccessToken()
    if (!token) { msg.textContent = 'Sign in failed'; return }
    try {
      const sub = (JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { sub?: string }).sub ?? ''
      const { grantSignupBonus, SIGNUP_BONUS } = await import('./state.ts')
      if (grantSignupBonus(sub)) body.prepend(el('p', `Welcome bonus: $${SIGNUP_BONUS.toLocaleString()} in-game added to your ledger.`))
    } catch { /* bonus is best-effort */ }
    const known = localStorage.getItem(CLAIMED_KEY)
    if (known) body.replaceChildren(el('p', `Signed in as @${known}.`))
    else void pickUsername(token)
  }

  const google = el('button', 'Continue with Google', 'primary')
  google.onclick = async () => {
    try {
      const privy = await client()
      const { url } = await privy.auth.oauth.generateURL('google', location.origin + location.pathname)
      location.assign(url)
    } catch (e) { msg.textContent = (e as Error).message }
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
