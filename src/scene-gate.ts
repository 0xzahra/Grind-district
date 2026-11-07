// Pure scheduling gate: scene mutations never run behind an open sheet.
export class SceneGate {
  width = 0
  height = 0
  resizeCount = 0
  skippedResizes = 0
  private pending: { width: number; height: number } | null = null
  private graphicsPending = true
  requestResize(width: number, height: number): void {
    this.pending = { width: Math.max(1, width), height: Math.max(1, height) }
  }
  requestGraphics(): void { this.graphicsPending = true }
  flush(paused: boolean, resize: (width: number, height: number) => void, graphics: () => void): void {
    if (paused) return
    const next = this.pending
    this.pending = null
    if (next) {
      if (next.width !== this.width || next.height !== this.height) {
        this.width = next.width
        this.height = next.height
        resize(this.width, this.height)
        this.resizeCount++
        this.graphicsPending = true
      } else this.skippedResizes++
    }
    if (this.graphicsPending) {
      this.graphicsPending = false
      graphics()
    }
  }
  advance(paused: boolean, mutate: () => void): void { if (!paused) mutate() }
}
