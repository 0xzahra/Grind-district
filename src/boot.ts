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
  stopPreview()
  play.disabled = true
  play.textContent = 'Opening the district'
  menuNote.textContent = ''
  let shown = false
  const reveal = () => { shown = true; revealCity() }
  const flatFallback = async (why: unknown) => {
    if (shown) return
    shown = true
    console.error('[grind] 3D city failed to open; switching to the overhead map.', why)
    const old = document.querySelector<HTMLCanvasElement>('#view')
    if (old) old.replaceWith(old.cloneNode(false))
    try {
      const { startFlat } = await import('./flat.ts')
      await startFlat(revealCity)
    } catch (error) {
      console.error('[grind] Overhead map failed too.', error)
      opening = false
      play.disabled = false
      play.textContent = 'Enter the district'
      menu.hidden = false
      menuNote.textContent = 'The city could not open on this device. Try again or another browser.'
    }
  }
  const watchdog = window.setTimeout(() => { void flatFallback(new Error('timeout')) }, 15000)
  try {
    const [{ prepareAssets }, city] = await Promise.all([
      import('./assets.ts'),
      import('./main.ts'),
    ])
    prepareAssets()
    await city.startCity(reveal, (error) => { void flatFallback(error) })
  } catch (error) {
    await flatFallback(error)
  } finally {
    if (shown) clearTimeout(watchdog)
  }
}

const bootTitlePreview = () => {
  void import('./preview.ts').then((m) => {
    const c = document.querySelector<HTMLCanvasElement>('#menu-preview')
    if (c && !opening) stopPreview = m.startPreview(c)
  }).catch(() => {
    document.getElementById('menu')?.classList.add('menu-fallback')
  })
}

// Title Three preview only after a session exists — keeps Sign up / Sign in off the Three chunk.
const hasSession = () => !!(localStorage.getItem('gd.privy.username') || localStorage.getItem('gd.privy.userId') || localStorage.getItem('gd.near.account'))
const schedulePreview = () => {
  if (!hasSession()) {
    document.getElementById('menu')?.classList.add('menu-fallback')
    return
  }
  const titleCoarse = matchMedia('(pointer: coarse)').matches || innerWidth < 820
  if (titleCoarse) {
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(() => { if (!opening) bootTitlePreview() }, { timeout: 2200 })
    else window.setTimeout(() => { if (!opening) bootTitlePreview() }, 900)
  } else {
    bootTitlePreview()
  }
}
schedulePreview()
window.addEventListener('gd-auth-changed', () => {
  document.getElementById('menu')?.classList.remove('menu-fallback')
  schedulePreview()
})

loadSave(window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900 ? 'low' : 'medium')
startTracking()

mountMenu(() => { void begin() })

const focusHome = document.querySelector<HTMLButtonElement>('#menu-create') ?? document.querySelector<HTMLButtonElement>('#menu-signin') ?? play
focusHome.focus()
