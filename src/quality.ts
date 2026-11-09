import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js'
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { Graphics } from './logic.ts'

/** One-time PMREM env map so metal, glass and cars have something to reflect. */
export function applyEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene): void {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  scene.environment = pmrem.fromScene(room, 0.04).texture
  scene.environmentIntensity = 0.38
  room.traverse((o) => { if (o instanceof THREE.Mesh) o.geometry.dispose() })
  pmrem.dispose()
  // Then swap in a real sky: Poly Haven "Kloofendal 48d Partly Cloudy (Pure Sky)" (CC0), 512x256.
  new HDRLoader().setDataType(THREE.HalfFloatType).load('/tex/sky.hdr', (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const gen = new THREE.PMREMGenerator(renderer)
    const old = scene.environment
    scene.environment = gen.fromEquirectangular(hdr).texture
    old?.dispose()
    hdr.dispose()
    gen.dispose()
  }, undefined, () => { /* keep the room environment */ })
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
    col = (col - 0.5) * 1.05 + 0.5;
    col += vec3(0.03,0.035,0.04) * 0.10 * (1.0 - l);
    col *= mix(vec3(1.0), vec3(1.02,1.0,0.96), smoothstep(0.5,1.0,l));
    col = col / (1.0 + 0.06 * max(col - 0.85, 0.0) * 4.0); // gentle highlight shoulder: no blown whites
    col = mix(vec3(l), col, 0.9);
    vec2 d = vUv - 0.5;
    col *= 1.0 - 0.16 * smoothstep(0.25, 0.75, dot(d,d) * 2.0);
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
  let bokeh: BokehPass | null = null
  let broken = false
  let checks = 0
  let blackRuns = 0
  let scale = 1
  let want = 1
  let base = 1
  let avg = 1 / 60
  let cool = 3
  let w = 1
  let h = 1
  const build = () => {
    // MSAA target keeps edges clean through the composer (WebGL2).
    // Phones: plain 8-bit target with no MSAA (HalfFloat+MSAA renders black on some Android GPUs).
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const gl2 = renderer.capabilities.isWebGL2
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: coarse || !gl2 ? THREE.UnsignedByteType : THREE.HalfFloatType,
      samples: coarse || !gl2 ? 0 : level === 'high' ? 4 : 2,
    })
    composer = new EffectComposer(renderer, target)
    composer.addPass(new RenderPass(scene, camera))
    // Ambient occlusion on High, desktop only (too heavy for phone GPUs).
    if (level === 'high' && !coarse && gl2) {
      try {
        const ao = new GTAOPass(scene, camera, 1, 1)
        ao.blendIntensity = 0.75
        ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.0, scale: 1.0, samples: 12 })
        composer.addPass(ao)
      } catch (error) {
        console.warn('[grind] AO unavailable', error)
      }
    }
    // Subtle lens depth of field on High desktop only: wide aperture is off, just a soft far falloff.
    if (level === 'high' && !coarse && gl2) {
      try { bokeh = new BokehPass(scene, camera, { focus: 7, aperture: 0.00012, maxblur: 0.004 }); composer.addPass(bokeh) } catch (error) { console.warn('[grind] DOF unavailable', error) }
    }
    bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.04, 0.55, 0.98)
    composer.addPass(bloom)
    composer.addPass(new OutputPass())
    grade = new ShaderPass(Grade)
    composer.addPass(grade)
    // SMAA after the grade on High desktop only: cleans shader/alpha edges MSAA misses (thin trims, foliage).
    if (level === 'medium' || coarse || !gl2) {
      try { composer.addPass(new FXAAPass()) } catch (error) { console.warn('[grind] FXAA unavailable', error) }
    } else if (level === 'high') {
      try { composer.addPass(new SMAAPass()) } catch (error) { console.warn('[grind] SMAA unavailable', error) }
    }
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
      grade!.uniforms.grain.value = 0
    },
    setFocus(d: number) {
      if (bokeh) (bokeh.uniforms as Record<string, { value: number }>).focus!.value = d
    },
    /** Night lifts bloom so neon strips read; day keeps it subtle. */
    setNight(night: number) {
      if (bloom) {
        // Premium, not neon: only true highlights (lamps, sun glints) bloom, and barely.
        bloom.threshold = 0.99 - night * 0.02
        bloom.strength = 0.006 + night * 0.012 // Zahra: no white glow behind buildings
      }
    },
    /** Dynamic resolution: drop 10% when frames run over 20 ms, recover slowly. */
    frame(dt: number, t: number) {
      if (grade) grade.uniforms.time.value = t % 100
      if (level === 'low' || !composer) return
      if (!Number.isFinite(dt) || dt <= 0) return
      // Smoothed frame time with hysteresis + cooldown: resizing reallocates every render target,
      // so the old per-few-frames up/down oscillation caused visible hitches on phones.
      avg += (dt - avg) * 0.05
      cool -= dt
      if (cool <= 0) {
        if (avg > 0.022 && want > 0.6) { want = Math.max(0.6, want - 0.1); cool = 1.5 }
        else if (avg < 0.0145 && want < 1) { want = Math.min(1, want + 0.1); cool = 4 }
      }
      if (want !== scale) {
        scale = want
        renderer.setPixelRatio(base * scale)
        renderer.setSize(w, h, false)
        composer.setPixelRatio(base * scale)
        composer.setSize(w, h)
      }
    },
    render() {
      if (level === 'low' || !composer || broken) {
        renderer.render(scene, camera)
        return
      }
      try {
        composer.render()
      } catch (error) {
        console.warn('Post stack failed; rendering without it.', error)
        broken = true
        renderer.render(scene, camera)
        return
      }
      // Black-frame guard: if the composer output is pure black for ~1.5 s, drop to direct rendering.
      if (++checks % 30 === 0 && checks < 600) {
        const gl = renderer.getContext()
        const px = new Uint8Array(4)
        let lit = false
        for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.3], [0.75, 0.3], [0.5, 0.8]]) {
          gl.readPixels(Math.floor(gl.drawingBufferWidth * fx!), Math.floor(gl.drawingBufferHeight * fy!), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
          if (px[0]! + px[1]! + px[2]! > 0) lit = true
        }
        blackRuns = lit ? 0 : blackRuns + 1
        if (blackRuns >= 3) {
          console.warn('Post stack produced black frames; rendering without it.')
          broken = true
        }
      }
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
    // Phones and narrow windows default to Low; without this they can never probe up,
    // so a capable phone stays stuck on the one tier with no bloom, grade or AO.
    else if (fps > 40 && g === 'low') next = 'medium'
    done = true
    try { localStorage.setItem(PROBED, '1') } catch { /* private mode */ }
    if (next !== g) apply(next)
  }
}
