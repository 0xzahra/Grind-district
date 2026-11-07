// Opt-in local QA only: fixed DOM IDs/tags and geometry, never account/message text.
export function modalDiagnostics(sheet: HTMLElement, panel: string | null) {
  const style = (node: Element) => window.getComputedStyle(node)
  const overlay = (id: string) => {
    const node = document.getElementById(id)
    if (!node) return { id, missing: true }
    const css = style(node)
    return { id, hidden: node.hidden, display: css.display, visibility: css.visibility, pointerEvents: css.pointerEvents, zIndex: css.zIndex }
  }
  return {
    panel, hidden: sheet.hidden,
    overlays: ['menu', 'boot', 'sheet'].map(overlay),
    controls: [...sheet.querySelectorAll('button')].map((button, index) => {
      const rect = button.getBoundingClientRect()
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
      const inViewport = rect.width > 0 && rect.height > 0 && x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight
      const hit = inViewport ? document.elementFromPoint(x, y) : null
      return { index, disabled: button.disabled, width: rect.width, height: rect.height, x, y, inViewport,
        receivesPointer: Boolean(hit && (hit === button || button.contains(hit))),
        hitTag: hit?.tagName ?? null, hitId: hit?.id ?? null }
    }),
  }
}
