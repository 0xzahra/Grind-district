import { assetUrl } from './assets.ts'
import { getSave } from './state.ts'

const themeParts = [
  '/audio/parts/market-00.b64',
  '/audio/parts/market-01.b64',
  '/audio/parts/market-02.b64',
  '/audio/parts/market-03.b64',
  '/audio/parts/market-04.b64',
  '/audio/parts/market-05.b64',
  '/audio/parts/market-06.b64',
]

/** Drop the theme at public/assets/audio/theme.mp3 and it is picked up on the next load. */
const THEME = '/assets/audio/theme.mp3'
const PREF = 'grind-district-music'

async function exists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    const type = response.headers.get('content-type') ?? ''
    // Vite dev and some static hosts answer a missing file with index.html.
    return response.ok && !type.includes('text/html')
  } catch {
    return false
  }
}

async function resolveTheme(): Promise<string | null> {
  if (await exists(THEME)) return THEME
  try {
    return await assetUrl('/audio/market_velocity.mp3', themeParts, 'audio/mpeg', 0x49)
  } catch {
    return null
  }
}

export function musicWanted(): boolean {
  try {
    return localStorage.getItem(PREF) === 'on'
  } catch {
    return false
  }
}

function remember(on: boolean): void {
  try {
    localStorage.setItem(PREF, on ? 'on' : 'off')
  } catch {
    // Private mode: the toggle still works for this visit.
  }
}

/**
 * Music toggle. Off by default. Once someone turns it on, the next visit resumes it
 * on the first tap, unless reduced motion is set in Settings or by the system.
 */
export function bindMusic(
  button: HTMLButtonElement,
  slider: HTMLInputElement,
  note: HTMLParagraphElement,
): void {
  const audio = new Audio()
  audio.loop = true
  audio.preload = 'none'
  let ready: Promise<boolean> | null = null
  let playing = false

  const load = () => {
    ready ??= resolveTheme().then((url) => {
      if (!url) return false
      audio.src = url
      return true
    })
    return ready
  }

  const level = () => Number(slider.value) / 100 * 0.8

  const paint = () => {
    button.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>${playing ? '' : '<path d="M3 3l18 18"/>'}</svg>`
    button.setAttribute('aria-label', playing ? 'Music on' : 'Music off')
    button.setAttribute('aria-pressed', String(playing))
    slider.disabled = !playing
    audio.volume = playing ? level() : 0
  }

  const start = async () => {
    playing = true
    paint()
    if (!(await load())) {
      playing = false
      note.textContent = 'The theme is not in this build yet.'
      paint()
      return
    }
    try {
      await audio.play()
      note.textContent = ''
    } catch {
      playing = false
      audio.pause()
      note.textContent = 'Tap again to play the theme.'
      paint()
    }
  }

  button.addEventListener('click', () => {
    if (playing) {
      playing = false
      audio.pause()
      note.textContent = ''
      remember(false)
      paint()
      return
    }
    remember(true)
    void start()
  })

  slider.addEventListener('input', () => {
    if (playing) audio.volume = level()
  })

  document.addEventListener('visibilitychange', () => {
    if (!playing) return
    if (document.hidden) audio.pause()
    else void audio.play().catch(() => undefined)
  })

  const calm = () => getSave().reduceMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (musicWanted() && !calm()) {
    // Browsers need a gesture. Resume on the first one after entering.
    const resume = () => {
      window.removeEventListener('pointerdown', resume)
      window.removeEventListener('keydown', resume)
      if (!playing && musicWanted() && !calm()) void start()
    }
    window.addEventListener('pointerdown', resume, { once: true })
    window.addEventListener('keydown', resume, { once: true })
  }

  paint()
}
