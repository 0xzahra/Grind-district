// Opening-card entry: keep Three / city code out of the first paint. The playable city
// chunk (`main.ts`) loads only after Sign in / Continue → Enter.
import './style.css'
// Panel theme (Settings > Theme): applied before anything paints, so there is no flash of the other theme.
try { if (localStorage.getItem('gd.ui') === 'light') document.documentElement.dataset.ui = 'light' } catch { /* private mode: dark */ }
import './glass.css'
// The game's typeface: the system face on Apple devices (San Francisco), and Inter, the open typeface drawn to
// the same model, everywhere else. Bundled, so Android and Windows see the same clean letters.
import '@fontsource-variable/inter/index.css'
import { mountMenu } from './menu.ts'
import { loadSave } from './state.ts'
import { startTracking } from './track.ts'
import { watchUpdates } from './update.ts'
import { resumeMusicOnFirstTap } from './music.ts'
import { languagePicker, startI18n } from './i18n.ts'

watchUpdates()
// Languages: the picker sits at the top of the title card (Settings has the same switch).
document.getElementById('menu-panel')?.prepend(languagePicker('lang-pick lang-title'))
startI18n()
// The theme starts with the first tap on the title screen and carries on into the city.
resumeMusicOnFirstTap()

// Warm the cache from the title screen: the people of the city (and the clips they move with) are fetched
// quietly while the player reads the opening card, so nobody is missing when the city opens. Plain fetch
// hints, no 3D code in this first chunk. The folder name is the one in humans.ts (FIGURES).
window.setTimeout(() => {
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) return
  for (const f of ['man1', 'man2', 'man3', 'man4', 'woman1', 'woman2', 'woman3', 'woman4', 'abaya', 'motion-m', 'motion-f']) {
    const link = document.createElement('link')
    link.rel = 'prefetch'
    link.href = `/models/figures/r1/${f}.glb`
    document.head.append(link)
  }
}, 1200)

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
  performance.mark('gd:enter')
  play.disabled = true
  play.textContent = 'Opening the district'
  menuNote.textContent = ''
  try { stopPreview() } catch { /* */ }
  stopPreview = () => {}
  // Two frames so Mac Safari frees the title-preview GL context before the city canvas asks for one.
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))
  performance.mark('gd:frames')

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
    performance.mark('gd:imports')
    prepareAssets()
    performance.mark('gd:assets')
    await city.startCity(reveal, (error) => { void flatFallback(error) })
    window.clearTimeout(watchdog)
  } catch (error) {
    await flatFallback(error)
  }
}

// Signs in the 3D city are drawn with the typeface: have it ready (briefly) before the preview paints them.
const typeface = Promise.race([
  Promise.all(['500', '600', '800'].map((w) => document.fonts.load(`${w} 24px "Inter Variable"`))).catch(() => undefined),
  new Promise((done) => window.setTimeout(done, 1500)),
])
const bootTitlePreview = () => {
  void Promise.all([import('./preview.ts'), typeface]).then(([m]) => {
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
  // The weakest phones (2 GB of memory or less, or data saver on) keep the still sky behind the title card: the
  // 3D preview would make Sign in and Continue slow to answer, and the city itself matters more.
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  if ((nav.deviceMemory ?? 8) <= 2 || nav.connection?.saveData) { document.getElementById('menu')?.classList.add('menu-fallback'); return }
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
// Fetch the city while the title card is up: its code, the walking animations and the ground textures, so
// tapping Continue opens the district without waiting on a download. Low priority, after the card has painted.
const prefetchCity = () => {
  if (opening) return
  void import('./main.ts').catch(() => undefined)
  void import('./assets.ts').catch(() => undefined)
  for (const u of ['/models/figures/r1/motion-m.glb', '/models/figures/r1/motion-f.glb', '/tex/nature/grass_t.webp', '/tex/nature/pavers_t.webp', '/tex/nature/wood_t.webp']) {
    void fetch(u, { priority: 'low' } as RequestInit).catch(() => undefined)
  }
}
{
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
  if (ric) ric(prefetchCity, { timeout: 2500 })
  else window.setTimeout(prefetchCity, 1200)
}
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
