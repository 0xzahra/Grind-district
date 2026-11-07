import type { Graphics } from './logic.ts'
export const QUALITY = {
  low: { pixelRatioCap: 1, shadows: false, shadowSize: 512, pointLights: 0, decorStride: 4 },
  medium: { pixelRatioCap: 1.5, shadows: true, shadowSize: 1024, pointLights: 2, decorStride: 2 },
  high: { pixelRatioCap: 2, shadows: true, shadowSize: 2048, pointLights: 4, decorStride: 1 },
} as const
export function applyDecorTier(items: Array<{ visible: boolean; userData: Record<string, unknown> }>, tier: Graphics): number {
  let visible = 0
  for (const [index, item] of items.entries()) {
    // Defense in depth: gameplay and colliding furniture are never density candidates.
    if (item.userData.essential || item.userData.tapUse || item.userData.tapGround) continue
    item.visible = index % QUALITY[tier].decorStride === 0
    if (item.visible) visible++
  }
  return visible
}
export function applyLightTier(items: Array<{ visible: boolean }>, tier: Graphics): number {
  items.forEach((item, index) => { item.visible = index < QUALITY[tier].pointLights })
  return items.filter((item) => item.visible).length
}
export class LocalPerformanceMetrics {
  readonly phases: Record<string, number> = {}
  private frames: number[] = []
  readonly enabled: boolean
  private start: number
  constructor(enabled: boolean, start: number) { this.enabled = enabled; this.start = start }
  phase(name: string, now: number): void { if (this.enabled) this.phases[name] = Math.round((now - this.start) * 10) / 10 }
  frame(milliseconds: number): void {
    if (!this.enabled || !Number.isFinite(milliseconds) || milliseconds <= 0) return
    this.frames.push(milliseconds)
    if (this.frames.length > 600) this.frames.shift()
  }
  snapshot() {
    const sorted = [...this.frames].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    return { phasesMs: { ...this.phases }, frameSamples: this.frames.length, recentFrameMs: [...this.frames], medianFrameMs: median, estimatedFps: median ? 1000 / median : 0 }
  }
}
