import * as THREE from 'three'
import type { Graphics } from './logic.ts'

/**
 * Occasional light rain + silent lightning. Auto-cycles: ~4 min dry, ~70 s shower.
 * Rain: one InstancedMesh of thin streaks around the camera (medium/high only; off on low).
 * Wet road: ground roughness eases down while raining. Lightning: brief sky/sun pulse, no glow.
 * Zero per-frame allocations.
 */
export function createWeather(scene: THREE.Scene, ground: THREE.MeshStandardMaterial, graphics: Graphics) {
  const count = graphics === 'high' ? 900 : graphics === 'medium' ? 450 : 0
  const geo = new THREE.PlaneGeometry(0.012, 0.55)
  const mat = new THREE.MeshBasicMaterial({ color: 0xb9c4cc, transparent: true, opacity: 0, depthWrite: false, fog: true })
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, count))
  mesh.frustumCulled = false
  mesh.visible = false
  mesh.count = count
  scene.add(mesh)
  const R = 14
  const H = 12
  const px = new Float32Array(count), py = new Float32Array(count), pz = new Float32Array(count)
  for (let i = 0; i < count; i++) { px[i] = (Math.random() * 2 - 1) * R; py[i] = Math.random() * H; pz[i] = (Math.random() * 2 - 1) * R }
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const s = new THREE.Vector3(1, 1, 1)
  const p = new THREE.Vector3()
  const CYCLE = 900
  const WET = 60
  const baseRough = ground.roughness
  const forced = new URLSearchParams(location.search).get('weather')
  // Mostly clear: only ~12% of (Lagos) days are rainy, and even then one short shower per ~5 min cycle at most.
  const rainyDay = () => { const d = new Date(Date.now() + 3600_000).toISOString().slice(0, 10); let h = 7; for (const c of d) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 100 < 12 }
  let clock = forced === 'rain' ? 10 : WET + 1
  let rain = 0 // 0..1 eased intensity
  let flash = 0
  let nextFlash = 6
  return {
    /** Returns lightning pulse 0..1 for the caller to add to sky/sun intensity. */
    tick(dt: number, cam: THREE.Camera, outside: boolean, calm: boolean): number {
      clock = (clock + dt) % CYCLE
      const raining = forced === 'clear' ? false : forced === 'rain' || (rainyDay() && clock < WET)
      rain += ((raining ? 1 : 0) - rain) * (1 - Math.exp(-dt / 6))
      ground.roughness = baseRough - rain * 0.38
      flash = Math.max(0, flash - dt * 5)
      if (raining && !calm && rain > 0.6) {
        nextFlash -= dt
        if (nextFlash <= 0) { flash = 1; nextFlash = 9 + Math.random() * 18 }
      }
      const show = count > 0 && outside && rain > 0.02
      mesh.visible = show
      if (show) {
        mat.opacity = 0.32 * rain
        q.copy(cam.quaternion) // billboard-ish: face camera, keep vertical
        q.x = 0; q.z = 0; q.normalize()
        const cx = cam.position.x, cy = cam.position.y, cz = cam.position.z
        const fall = dt * 11
        for (let i = 0; i < count; i++) {
          let y = py[i]! - fall
          if (y < 0) y += H
          py[i] = y
          p.set(cx + px[i]!, cy - 4 + y, cz + pz[i]!)
          m.compose(p, q, s)
          mesh.setMatrixAt(i, m)
        }
        mesh.instanceMatrix.needsUpdate = true
      }
      // Two-stroke flicker reads as lightning without any bloom.
      return flash > 0 ? flash * flash * (flash > 0.55 || flash < 0.3 ? 1 : 0.35) : 0
    },
    rain: () => rain,
  }
}
