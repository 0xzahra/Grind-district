// Pop-up windows (certificate, wallet, confirmations...) all use `.wallet-dlg` and sit above every panel.
// Esc and a tap outside close the topmost one first, so a window can never be left stuck over the Map or a panel
// after the panel behind it closes. A tap outside still reaches whatever was tapped (HUD buttons keep working).

const CLOSE_TEXT = /^(close|cancel|not now|not today|keep my progress|✕|×)$/i

function topmost(): HTMLElement | null {
  const open = [...document.querySelectorAll<HTMLElement>('.wallet-dlg')].filter((d) => d.isConnected && !d.hidden && d.getClientRects().length > 0)
  if (!open.length) return null
  const z = (d: HTMLElement) => Number.parseInt(getComputedStyle(d).zIndex, 10) || 0
  // Highest stacking first; among equals, the one added last is drawn on top.
  return open.reduce((a, b) => (z(b) >= z(a) ? b : a))
}

function dismiss(dlg: HTMLElement): void {
  const x = dlg.querySelector<HTMLElement>('.login-x, button[aria-label="Close"]')
  const named = [...dlg.querySelectorAll<HTMLButtonElement>('button')].reverse().find((b) => CLOSE_TEXT.test((b.textContent ?? '').trim()))
  const btn = x ?? named
  // Prefer the window's own close button, so any cleanup it does still runs.
  if (btn) btn.click()
  if (dlg.isConnected) dlg.remove()
}

/** Sign-in and third-party wallet pickers manage themselves; never close them from under the player. */
const isGuarded = (dlg: HTMLElement) => dlg.classList.contains('login-dlg')

let installed = false
export function installLayers(): void {
  if (installed) return
  installed = true
  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    const dlg = topmost()
    if (!dlg) return
    event.preventDefault()
    event.stopImmediatePropagation() // only this window closes; the panel behind stays open
    dismiss(dlg)
  }, true)
  document.addEventListener('pointerdown', (event) => {
    const dlg = topmost()
    if (!dlg || isGuarded(dlg)) return
    const target = event.target as Element | null
    if (!target || dlg.contains(target)) return
    // Taps inside another site's overlay (wallet picker, sign-in frame) are not "outside" for us.
    if (target.closest('iframe, [id^="privy"], [class*="privy"], #near-wallet-selector-modal, .nws-modal-wrapper, w3m-modal, wcm-modal')) return
    dismiss(dlg)
    // One layer per tap: a tap on a panel's dimmed backdrop closes only the window above it, not the panel too.
    if (target.id === 'sheet' || target.id === 'cc-sheet') event.stopPropagation()
  }, true)
}
