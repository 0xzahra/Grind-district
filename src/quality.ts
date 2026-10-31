import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Graphics } from './logic.ts'

/** One-time PMREM env map so metal, glass and cars have something to reflect. */
export function applyEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  scene.environment = pmrem.fromScene(room, 0.04).texture
  scene.environmentIntensity = 0.5
  room.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
  pmrem.dispose()
}

/** Cheap combined grade: teal shadows, warm highlights, contrast, saturation, vignette, grain (high). */
const Grade = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 }, grain: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float time; uniform float grain; varying vec2 vUv;
  void main(){
    vec4 c = texture2D(tDiffuse, vUv);
    vec3 col = c.rgb;
    float l = dot(col, vec3(0.2126,0.7152,0.0722));
    col = mix(col, vec3(l), 0.05);
    col = (col - 0.5) * 1.08 + 0.5;
    col += vec3(0.024,0.102,0.078) * 0.12 * (1.0 - l);
    col *= mix(vec3(1.0), vec3(1.03,1.0,0.96), smoothstep(0.5,1.0,l));
    vec2 d = vUv - 0.5;
    col *= 1.0 - 0.25 * smoothstep(0.25, 0.75, dot(d,d) * 2.0);
    float n = fract(sin(dot(vUv * (time + 1.0), vec2(12.9898,78.233))) * 43758.5453);
    col += (n - 0.5) * grain;
    gl_FragColor = vec4(clamp(col,0.0,1.0), c.a);
  }`,
}

/** Visual-only post stack: bloom on medium/high so neon windows and signs glow. */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  let level: Graphics = 'low'
  let grade: ShaderPass | null = null
  let scale = 1
  let want = 1
  let base = 1
  let slow = 0
  let w = 1
  let h = 1
  const build = () => {
    // MSAA target keeps edges clean through the composer (WebGL2).
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: level === 'high' ? 4 : 2 })
    composer = new EffectComposer(renderer, target)
    composer.addPass(new RenderPass(scene, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.5, 0.85)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    grade = new ShaderPass(Grade)
    composer.addPass(grade)
  }
  return {
    configure(graphics: Graphics, width: number, height: number, ratio: number) {
      level = graphics
      if (graphics === 'low') return
      if (!composer) build()
      // Bloom runs at reduced resolution on medium to stay cheap on phones.
      base = ratio
      w = width
      h = height
      composer!.setPixelRatio(ratio * scale)
      composer!.setSize(width, height)
      // Bloom at half resolution.
      bloom!.resolution.set(width / 2, height / 2)
      grade!.uniforms.grain.value = graphics === 'high' ? 0.03 : 0
    },
    /** Night lifts bloom so neon strips read; day keeps it subtle. */
    setNight(night: number) {
      if (bloom) {
        bloom.threshold = 0.85 - night * 0.2
        bloom.strength = 0.35 + night * 0.35
      }
    },
    /** Dynamic resolution: drop 10% when frames run over 20 ms, recover slowly. */
    frame(dt: number, t: number) {
      if (grade) grade.uniforms.time.value = t % 100
      if (level === 'low' || !composer) return
      slow = dt > 0.02 ? slow + 1 : Math.max(0, slow - 0.25)
      if (slow > 20 && want > 0.6) { want -= 0.1; slow = 0 }
      else if (slow === 0 && dt < 0.014 && want < 1) want = Math.min(1, want + 0.002)
      if (Math.abs(want - scale) >= 0.05 || (want === 1 && scale !== 1)) {
        scale = want
        renderer.setPixelRatio(base * scale)
        renderer.setSize(w, h, false)
        composer.setPixelRatio(base * scale)
        composer.setSize(w, h)
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
