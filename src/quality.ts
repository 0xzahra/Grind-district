import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import type { Graphics } from './logic.ts'

/** Visual-only post stack: bloom on medium/high so neon windows and signs glow. */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  let level: Graphics = 'low'
  const build = () => {
    composer = new EffectComposer(renderer)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.82)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
  }
  return {
    configure(graphics: Graphics, width: number, height: number, ratio: number) {
      level = graphics
      if (graphics === 'low') return
      if (!composer) build()
      // Bloom runs at reduced resolution on medium to stay cheap on phones.
      composer!.setPixelRatio(graphics === 'high' ? ratio : Math.min(ratio, 1.25))
      composer!.setSize(width, height)
      bloom!.strength = graphics === 'high' ? 0.62 : 0.48
    },
    /** Night lifts bloom so neon strips read; day keeps it subtle. */
    setNight(night: number) {
      if (bloom) {
        bloom.threshold = 0.9 - night * 0.28
        bloom.strength = (level === 'high' ? 0.4 : 0.32) + night * 0.4
      }
    },
    render() {
      if (level === 'low' || !composer) renderer.render(scene, camera)
      else composer.render()
    },
  }
}

const PROBED = 'gd.quality.probed'

/** One-off fps probe on first load: steps graphics down (or up on strong desktops). */
export function createProbe(current: () => Graphics, apply: (g: Graphics) => void) {
  let done = (() => { try { return localStorage.getItem(PROBED) === '1' } catch { return true } })()
  let frames = 0
  let time = 0
  let warm = 0
  const coarse = window.matchMedia('(pointer: coarse)').matches
  return (dt: number) => {
    if (done) return
    if (warm < 1.5) { warm += dt; return }
    frames++
    time += dt
    if (time < 3) return
    const fps = frames / time
    const g = current()
    let next: Graphics = g
    if (fps < 28) next = g === 'high' ? 'medium' : 'low'
    else if (fps < 45 && g === 'high') next = 'medium'
    else if (fps > 57 && !coarse && g === 'medium') next = 'high'
    done = true
    try { localStorage.setItem(PROBED, '1') } catch { /* private mode */ }
    if (next !== g) apply(next)
  }
}
