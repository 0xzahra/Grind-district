// Boutique photographs: each outfit is shown on the real figure that wears it, photographed once with the
// game's own renderer under a soft studio light and cached. (The Boutique used to show flat clothing icons,
// which looked nothing like the people.) One small render per piece, queued so the city never stutters.
import * as THREE from 'three'
import { posedHuman, releaseHuman, type Extras, type HumanModel, type Look } from './humans.ts'

export type Frame = 'full' | 'top' | 'legs' | 'feet' | 'face'
type Job = { key: string; model: HumanModel; look?: Look; extras?: Extras; frame: Frame; done: Array<(url: string) => void>; batch: number; order: number }

let renderer: THREE.WebGLRenderer | null = null
let environment: () => THREE.Texture | null = () => null
const shots = new Map<string, string>()
const jobs = new Map<string, Job>()
const queue: Job[] = []
let busy = false
let batch = 0
let order = 0

/** Call when the Boutique is drawn afresh: what it asks for now is photographed before anything left over. */
export function newShootBatch(): void { batch += 1; order = 0 }

export function setLookRenderer(r: THREE.WebGLRenderer, env: () => THREE.Texture | null): void { renderer = r; environment = env }

const W = 300, H = 400
const studio = new THREE.Scene()
{
  const key = new THREE.DirectionalLight(0xfff3e4, 1.7); key.position.set(1.4, 2.8, 3.2)
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.8); rim.position.set(-2.2, 2.4, -2.4)
  studio.add(key, rim, new THREE.HemisphereLight(0xf4efe8, 0x4a4238, 0.95))
}
const camera = new THREE.PerspectiveCamera(24, W / H, 0.05, 40)
// Where to stand for each kind of piece: centre height and how much of the body is in frame (metres).
const FRAMES: Record<Frame, [number, number]> = { full: [0.9, 1.95], top: [1.28, 0.95], legs: [0.52, 1.15], feet: [0.2, 0.6], face: [1.5, 0.5] }

function take(job: Job): Promise<string | null> {
  return new Promise((resolve) => {
    const r = renderer
    if (!r) { resolve(null); return }
    let finished = false
    const figure = posedHuman(job.model, {
      pose: 'stand', look: job.look, extras: job.extras, height: 1.74, detail: 0.5,
      onReady: () => {
        if (finished) return
        finished = true
        // Two frames later the texture is on the card; then photograph.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          try {
            const [cy, span] = FRAMES[job.frame]
            const dist = span / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
            figure.rotation.y = job.frame === 'feet' ? 0.5 : 0.32
            camera.position.set(dist * 0.1, cy + span * 0.04, dist)
            camera.lookAt(0, cy, 0)
            studio.environment = environment()
            studio.environmentIntensity = 0.4
            const target = new THREE.WebGLRenderTarget(W, H, { samples: 0 })
            const prevTarget = r.getRenderTarget(), prevExposure = r.toneMappingExposure, prevAlpha = r.getClearAlpha()
            const prevClear = r.getClearColor(new THREE.Color())
            r.toneMappingExposure = 1
            r.setRenderTarget(target)
            r.setClearColor(0x000000, 0)
            r.clear()
            r.render(studio, camera)
            const px = new Uint8Array(W * H * 4)
            r.readRenderTargetPixels(target, 0, 0, W, H, px)
            r.setRenderTarget(prevTarget)
            r.setClearColor(prevClear, prevAlpha)
            r.toneMappingExposure = prevExposure
            target.dispose()
            // Onto an ivory studio backdrop (the certificate's paper), flipped upright.
            const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H
            const g = canvas.getContext('2d')
            if (!g) { resolve(null); return }
            const img = g.createImageData(W, H)
            for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4)
            const layer = document.createElement('canvas'); layer.width = W; layer.height = H
            layer.getContext('2d')!.putImageData(img, 0, 0)
            const bg = g.createLinearGradient(0, 0, 0, H)
            bg.addColorStop(0, '#f6efe3'); bg.addColorStop(0.72, '#ece2d0'); bg.addColorStop(0.73, '#d9ccb6'); bg.addColorStop(1, '#cbbda4')
            g.fillStyle = bg; g.fillRect(0, 0, W, H)
            g.drawImage(layer, 0, 0)
            resolve(canvas.toDataURL('image/jpeg', 0.84))
          } catch { resolve(null) } finally { studio.remove(figure); releaseHuman(figure) }
        }))
      },
    })
    studio.add(figure)
    // Never wait for ever on a figure that cannot load.
    window.setTimeout(() => { if (!finished) { finished = true; studio.remove(figure); resolve(null) } }, 12000)
  })
}

async function pump(): Promise<void> {
  if (busy) return
  busy = true
  while (queue.length) {
    // Newest request first (the cards on screen now), and within it top to bottom.
    let at = 0
    for (let i = 1; i < queue.length; i++) { const a = queue[i]!, b = queue[at]!; if (a.batch > b.batch || (a.batch === b.batch && a.order < b.order)) at = i }
    const job = queue.splice(at, 1)[0]!
    const url = await take(job)
    jobs.delete(job.key)
    if (url) { shots.set(job.key, url); for (const f of job.done) f(url) }
    await new Promise((r) => window.setTimeout(r, 60))
  }
  busy = false
}

/** The photograph for a piece: at once if it has been taken, otherwise `done` is called when it is ready. */
export function lookShot(key: string, model: HumanModel, look: Look | undefined, frame: Frame, done: (url: string) => void, extras?: Extras): string | null {
  const have = shots.get(key)
  if (have) return have
  if (!renderer) return null
  const waiting = jobs.get(key)
  if (waiting) { waiting.done.push(done); waiting.batch = batch; waiting.order = order++; return null }
  const job: Job = { key, model, look, extras, frame, done: [done], batch, order: order++ }
  jobs.set(key, job)
  queue.push(job)
  void pump()
  return null
}
