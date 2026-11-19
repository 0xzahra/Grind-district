// Players always end up on the newest version, without anyone having to do anything. Every deploy ships
// /release.json naming the live version (vite.config.ts); an open game checks it every ten minutes and whenever
// the tab comes back into view. When a newer version is live:
// - on the title screen, or after the tab was away for ten minutes or more, the page simply reloads into it;
// - mid-play, a notification offers it (Refresh), so nobody is pulled out of a lesson or a trade.
// Progress is saved as it happens, so a reload loses nothing.
type Deps = { notify: (title: string, body: string, once: string, go: string) => void; onTitle: () => boolean }

export function watchForUpdates(d: Deps): void {
  if (import.meta.env.DEV) return
  let hiddenAt = 0, newer: string | null = null, offered = ''
  const check = async (): Promise<void> => {
    try {
      const r = await fetch('/release.json', { cache: 'no-store' })
      if (!r.ok) return
      const id = String(((await r.json()) as { id?: string }).id ?? '')
      if (!id || id === __BUILD__) return
      newer = id
      if (d.onTitle()) { location.reload(); return }
      if (offered !== id) { offered = id; d.notify('A new version is ready', 'Tap to refresh into the latest Grind District. Your progress is saved.', `build-${id}`, 'reload') }
    } catch { /* offline: try again later */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = Date.now(); return }
    // Back after a long while with a newer version already known: straight into it.
    if (newer && hiddenAt && Date.now() - hiddenAt > 10 * 60_000) { location.reload(); return }
    void check()
  })
  window.setInterval(() => { if (!document.hidden) void check() }, 10 * 60_000)
  window.setTimeout(() => void check(), 60_000)
}
