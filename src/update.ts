// New deploy while playing: never dim or block the game. A small corner toast offers a refresh instead.
// Two signals: a lazy chunk from the old build fails to load (vite:preloadError), or index.html now
// references a different entry script (checked every 3 minutes while the tab is visible).
let shown = false
export function offerRefresh(): void { toast() }
function toast(): void {
  if (shown) return
  shown = true
  const b = document.createElement('button')
  b.type = 'button'
  b.textContent = 'Update available · tap to refresh'
  b.style.cssText = 'position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;padding:8px 14px;border-radius:999px;border:1px solid #ffffff2a;background:#141a17e6;color:#efe9dc;font:500 13px Outfit,system-ui,sans-serif;box-shadow:0 4px 16px #0006;pointer-events:auto'
  b.onclick = () => location.reload()
  document.body.append(b)
}
const entry = () => document.querySelector<HTMLScriptElement>('script[type=module][src*="/assets/"]')?.getAttribute('src') ?? ''
let watching = false
export function watchUpdates(): void {
  if (watching) return // boot and the city both call this; one watcher is enough
  watching = true
  window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); toast() })
  const mine = entry()
  if (!mine) return
  window.setInterval(async () => {
    if (document.hidden || shown) return
    const html = await fetch('/', { cache: 'no-store' }).then((r) => r.text()).catch(() => '')
    const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]*\/assets\/[^"]+)"/)
    if (m && m[1] !== mine) toast()
  }, 180_000)
}
