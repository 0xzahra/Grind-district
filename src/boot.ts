// Opening-card entry: keep Three / city code out of the first paint. The playable city
// chunk (`main.ts`) loads only after Sign in / Continue → Enter.
import './style.css'
import './glass.css'
import { mountMenu } from './menu.ts'
import { loadSave } from './state.ts'
import { startTracking } from './track.ts'
import { watchUpdates } from './update.ts'

watchUpdates()

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

const menu = must<HTMLElement>('#menu')
const play = must<HTMLButtonElement>('#play')
const menuNote = must<HTMLParagraphElement>('#menu-note')
let opening = false
let stopPreview: () => void = () => {}

function revealCity() {
  menu.hidden = true
  document.documentElement.classList.remove('title-on')
  const boot = document.querySelector('#boot')
  if (boot) {
    boot.classList.add('hidden')
    boot.setAttribute('aria-hidden', 'true')
  }
}

async function begin() {
  if (opening) return
  opening = true
  play.disabled = true
  play.textContent = 'Opening the district'
  menuNote.textContent = ''
  try { stopPreview() } catch { /* */ }
  stopPreview = () => {}
  // Two frames so Mac Safari frees the title-preview GL context before the city canvas asks for one.
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

  let shown = false
  let attempts = 0
  let watchdog = 0
  const reveal = () => { shown = true; window.clearTimeout(watchdog); revealCity() }

  const freshView = () => {
    const cur = document.querySelector<HTMLCanvasElement>('#view')
    const next = document.createElement('canvas')
    next.id = 'view'
    next.setAttribute('aria-label', 'Grind District')
    if (cur?.parentElement) cur.replaceWith(next)
    else document.getElementById('game')?.prepend(next)
    return next
  }

  const openFlat = async () => {
    freshView()
    const { startFlat } = await import('./flat.ts')
    await startFlat(revealCity)
    shown = true
    window.clearTimeout(watchdog)
  }

  const flatFallback = async (why: unknown) => {
    if (shown) return
    console.error('[grind] 3D city failed to open; trying overhead map.', why)
    try {
      await openFlat()
      return
    } catch (error) {
      console.error('[grind] Overhead map failed.', error)
    }
    attempts += 1
    if (attempts <= 1) {
      try { sessionStorage.setItem('gd.autoEnter', '1') } catch { /* */ }
      menuNote.textContent = 'Opening again…'
      location.reload()
      return
    }
    opening = false
    play.disabled = false
    play.textContent = 'Enter the district'
    menu.hidden = false
    document.getElementById('menu')?.classList.add('menu-fallback')
    menuNote.textContent = 'Could not open the 3D city. Tap Enter to try the map view again.'
  }

  watchdog = window.setTimeout(() => { void flatFallback(new Error('timeout')) }, 45000)
  try {
    freshView()
    const [{ prepareAssets }, city] = await Promise.all([
      import('./assets.ts'),
      import('./main.ts'),
    ])
    prepareAssets()
    await city.startCity(reveal, (error) => { void flatFallback(error) })
    window.clearTimeout(watchdog)
  } catch (error) {
    await flatFallback(error)
  }
}

const bootTitlePreview = () => {
  void import('./preview.ts').then((m) => {
    const c = document.querySelector<HTMLCanvasElement>('#menu-preview')
    if (!c || opening) return
    try { stopPreview() } catch { /* first run */ }
    // Recreate canvas if a prior dispose removed it.
    let canvas = c
    if (!canvas.isConnected) {
      canvas = document.createElement('canvas')
      canvas.id = 'menu-preview'
      canvas.setAttribute('aria-hidden', 'true')
      document.getElementById('menu')?.prepend(canvas)
    }
    canvas.hidden = false
    stopPreview = m.startPreview(canvas)
    // preview.ts hides the canvas + sets menu-fallback when WebGL fails; keep that sky.
    if (!canvas.hidden) document.getElementById('menu')?.classList.remove('menu-fallback')
    else document.getElementById('menu')?.classList.add('menu-fallback')
  }).catch(() => {
    document.getElementById('menu')?.classList.add('menu-fallback')
  })
}

// Title Three preview for everyone (signed in or not). Canvas is pointer-events:none so Sign up / Sign in stay tappable.
// Phones: start after a short idle so the opening card paints first. Fallback sky only if WebGL fails.
const schedulePreview = () => {
  if (opening) return
  const titleCoarse = matchMedia('(pointer: coarse)').matches || innerWidth < 820
  if (titleCoarse) {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(() => { if (!opening) bootTitlePreview() }, { timeout: 1800 })
    else window.setTimeout(() => { if (!opening) bootTitlePreview() }, 700)
  } else {
    bootTitlePreview()
  }
}
schedulePreview()
window.addEventListener('gd-auth-changed', () => {
  // Never restart the title WebGL preview while entering the city — that race was burning the
  // only GL context on phones so Continue after avatar failed with "could not open on this device".
  if (opening) return
  document.getElementById('menu')?.classList.remove('menu-fallback')
  schedulePreview()
})
// Login finish path: stop preview first, then open the city (avoids play.click racing a fresh preview).
window.addEventListener('gd-enter-city', () => {
  try { stopPreview() } catch { /* none */ }
  void begin()
})

loadSave(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900 ? 'low' : 'medium')
startTracking()

mountMenu(() => { void begin() })

// After a WebGL failure reload: auto-retry enter once (no dead-end "city could not open").
try {
  if (sessionStorage.getItem('gd.autoEnter') === '1') {
    sessionStorage.removeItem('gd.autoEnter')
    const note = document.getElementById('menu-note')
    if (note) note.textContent = 'Opening again…'
    window.setTimeout(() => { void begin() }, 280)
  }
} catch { /* private mode */ }

const focusHome = document.querySelector<HTMLButtonElement>('#menu-create') ?? document.querySelector<HTMLButtonElement>('#menu-signin') ?? play
focusHome.focus()
