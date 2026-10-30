import { assetUrl } from './assets.ts'

const themeParts = [
  '/audio/parts/market-00.b64',
  '/audio/parts/market-01.b64',
  '/audio/parts/market-02.b64',
  '/audio/parts/market-03.b64',
  '/audio/parts/market-04.b64',
  '/audio/parts/market-05.b64',
  '/audio/parts/market-06.b64',
]

/** Market Velocity stays paused until the player opts in. */
export function bindMusic(
  button: HTMLButtonElement,
  slider: HTMLInputElement,
  note: HTMLParagraphElement,
): void {
  const audio = new Audio()
  audio.loop = true
  audio.preload = 'auto'
  void assetUrl('/audio/market_velocity.mp3', themeParts, 'audio/mpeg', 0x49).then((url) => {
    audio.src = url
  })
  let playing = false

  const level = () => Number(slider.value) / 100 * 0.8

  const paint = () => {
    button.textContent = playing ? 'Stop theme' : 'Play theme'
    button.setAttribute('aria-pressed', String(playing))
    slider.disabled = !playing
    audio.volume = playing ? level() : 0
  }

  button.addEventListener('click', () => {
    if (playing) {
      playing = false
      audio.pause()
      note.textContent = ''
      paint()
      return
    }
    playing = true
    paint()
    void audio.play().catch(() => {
      playing = false
      audio.pause()
      note.textContent = 'Tap again to play Market Velocity.'
      paint()
    })
  })

  slider.addEventListener('input', () => {
    if (playing) audio.volume = level()
  })

  document.addEventListener('visibilitychange', () => {
    if (!playing) return
    if (document.hidden) audio.pause()
    else void audio.play().catch(() => undefined)
  })

  paint()
}
