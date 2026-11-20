import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { FXAAPass } from 'three/examples/jsm/postprocessing/FXAAPass.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { Graphics } from './logic.ts'
import { setSurfaceTier } from './surfaces.ts'

/** One-time PMREM env map so metal, glass and cars have something to reflect. */
export function applyEnvironment(renderer: THREE.WebGLRenderer, scene: THREE.Scene, keepIntensity = false): void {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  // Redrawn after a resume or a lost context: free the old one, and keep a room's own brightness.
  const before = scene.environment
  scene.environment = pmrem.fromScene(room, 0.04).texture
  before?.dispose()
  if (!keepIntensity) scene.environmentIntensity = 0.38
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
    // Colour correction: deeper blacks (cuts the haze), clean contrast, richer colour, warm highlights.
    col = max(col - 0.014, 0.0) * 1.016;
    col = (col - 0.5) * 1.08 + 0.5;
    col += vec3(0.0, 0.006, 0.012) * (1.0 - l);
    col *= mix(vec3(1.0), vec3(1.025,1.0,0.965), smoothstep(0.5,1.0,l));
    col = col / (1.0 + 0.06 * max(col - 0.85, 0.0) * 4.0); // gentle highlight shoulder: no blown whites
    float l2 = dot(col, vec3(0.2126,0.7152,0.0722));
    col = mix(vec3(l2), col, 1.1);
    vec2 d = vUv - 0.5;
    col *= 1.0 - 0.04 * smoothstep(0.35, 0.85, dot(d,d) * 2.0);
    float n = fract(sin(dot(vUv * (time + 1.0), vec2(12.9898,78.233))) * 43758.5453);
    col += (n - 0.5) * grain;
    gl_FragColor = vec4(clamp(col,0.0,1.0), c.a);
  }`,
}

/** Contrast-adaptive sharpening after anti-aliasing: crisper edges and textures without halos (strong where flat,
 * light where edges already have contrast). Five texture reads a pixel. */
const Sharpen = {
  uniforms: { tDiffuse: { value: null }, amount: { value: 0.5 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float amount; varying vec2 vUv;
  void main(){
    vec2 px = 1.0 / vec2(textureSize(tDiffuse, 0));
    vec4 c4 = texture2D(tDiffuse, vUv);
    vec3 c = c4.rgb;
    vec3 n = texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb, s = texture2D(tDiffuse, vUv - vec2(0.0, px.y)).rgb;
    vec3 e = texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb, w = texture2D(tDiffuse, vUv - vec2(px.x, 0.0)).rgb;
    vec3 mn = min(c, min(min(n, s), min(e, w))), mx = max(c, max(max(n, s), max(e, w)));
    vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(1e-4)), 0.0, 1.0));
    vec3 wgt = -amp * mix(0.125, 0.2, amount);
    vec3 outc = (c + (n + s + e + w) * wgt) / (1.0 + 4.0 * wgt);
    gl_FragColor = vec4(clamp(outc, 0.0, 1.0), c4.a);
  }`,
}

/**
 * Depth effect (High only): things far behind the subject go gently out of focus, like a long lens.
 * Far field only, and a sample is taken only if it is itself out of focus and is not the sky, so nothing sharp
 * smears and the bright sky never bleeds over roof lines (the old depth-of-field pass did both).
 */
class DepthBlurPass extends Pass {
  focus = 6
  private readonly material: THREE.ShaderMaterial
  private readonly quad: FullScreenQuad
  private readonly camera: THREE.PerspectiveCamera
  constructor(camera: THREE.PerspectiveCamera) {
    super()
    this.camera = camera
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 100 }, focus: { value: 6 }, maxBlur: { value: 4 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `#include <packing>
      uniform sampler2D tDiffuse; uniform sampler2D tDepth; uniform vec2 texel; uniform float near; uniform float far; uniform float focus; uniform float maxBlur; varying vec2 vUv;
      float blurAt(float d){ float dist = -perspectiveDepthToViewZ(d, near, far); return d >= 0.99999 ? 0.0 : clamp((dist - focus - 14.0) / 70.0, 0.0, 1.0); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float r = blurAt(texture2D(tDepth, vUv).x) * maxBlur;
        if (r < 0.4) { gl_FragColor = c; return; }
        vec3 sum = c.rgb; float n = 1.0;
        for (int i = 0; i < 12; i++) {
          // Twelve taps on a golden-angle spiral.
          float a = float(i) * 2.399963, k = sqrt((float(i) + 0.5) / 12.0);
          vec2 uv = vUv + vec2(cos(a), sin(a)) * k * r * texel;
          float w = clamp(blurAt(texture2D(tDepth, uv).x) * 4.0, 0.0, 1.0);
          sum += texture2D(tDiffuse, uv).rgb * w; n += w;
        }
        gl_FragColor = vec4(sum / n, c.a);
      }`,
      depthTest: false, depthWrite: false,
    })
    this.quad = new FullScreenQuad(this.material)
  }
  override render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const u = this.material.uniforms
    u.tDiffuse!.value = readBuffer.texture
    u.tDepth!.value = readBuffer.depthTexture
    u.texel!.value.set(1 / readBuffer.width, 1 / readBuffer.height)
    u.near!.value = this.camera.near
    u.far!.value = this.camera.far
    u.focus!.value = this.focus
    u.maxBlur!.value = 4.5 * readBuffer.height / 900
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer)
    this.quad.render(renderer)
  }
  override dispose(): void { this.material.dispose(); this.quad.dispose() }
}

/**
 * Leaves stay out of an ambient-occlusion pass. GTAO redraws the scene with one plain material that ignores the
 * leaf cut-outs, so every leaf card would land in it as a solid square (pale square patches round each crown)
 * and the leafy heart inside as a round disc. Trees, shrubs and planters simply skip it.
 */
export function keepFoliageOutOfAO(ao: GTAOPass, scene: THREE.Scene): void {
  const aoPass = ao as unknown as { _overrideVisibility: () => void; _visibilityCache: THREE.Object3D[] }
  const hideBase = aoPass._overrideVisibility.bind(ao)
  aoPass._overrideVisibility = () => {
    hideBase()
    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
      const leafy = o.userData.noAO || (m && !Array.isArray(m) && m.userData?.foliage)
      if (leafy && o.visible) { o.visible = false; aoPass._visibilityCache.push(o) }
    })
  }
}

/**
 * Visual-only post stack. Low: none. Medium: colour grade and edge smoothing. High: also glow on lamps, lit
 * windows and signs, the depth effect, and ambient occlusion on desktop. Phones default to Low or Medium.
 */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  let composer: EffectComposer | null = null
  let bloom: UnrealBloomPass | null = null
  let depth: DepthBlurPass | null = null
  let builtFor: Graphics | null = null
  let level: Graphics = 'low'
  let grade: ShaderPass | null = null
  let broken = false
  let checks = 0
  let blackRuns = 0
  let scale = 1
  let want = 1
  let base = 1
  let avg = 1 / 60
  // The frame time aimed for (phones may be paced to 30 or 20 a second, see main.ts): the scaler judges against it.
  let budget = 1 / 60
  let cool = 3
  // The resolution never drops below this share of the tier's sharpness: lower reads as a haze over the city.
  // High renders at the screen's own density (up to 4K, see main.ts), so there it may step further down, never
  // below 1.6x, which is what High drew before it went native.
  const FLOOR = 0.8
  const floor = () => (base > 2 ? Math.max(0.5, Math.min(FLOOR, 1.6 / base)) : FLOOR)
  // A step down that did not make frames faster means the phone itself caps them (battery saver, heat, a 30 Hz
  // screen while idle): the step is undone and no new one is tried for a while, so the picture stays sharp.
  let probe: { before: number; t: number } | null = null
  let holdSharp = 0
  // The highest share it may climb back to (lowered for the visit after the GPU context was lost).
  let cap = 1
  let w = 1
  let h = 1
  let sized = false
  // High's remembered sharpness is kept under a new name: it now means a share of native (up to 4K), and starts
  // from the old 2x, climbing only while frames stay easy.
  const resKey = (g: Graphics) => (g === 'high' ? 'gd.res.high.v2' : `gd.res.${g}`)
  const recall = (g: Graphics) => { try { const raw = localStorage.getItem(resKey(g)); const v = Number(raw); if (raw !== null && v >= 0.5 && v <= 1) return Math.round(v * 10) / 10 } catch { /* private mode */ } return g === 'high' && base > 2 ? Math.max(floor(), Math.round((2 / base) * 10) / 10) : 1 }
  const remember = (g: Graphics, v: number) => { try { localStorage.setItem(resKey(g), String(v)) } catch { /* private mode */ } }
  const build = () => {
    // MSAA target keeps edges clean through the composer (WebGL2).
    // Phones: plain 8-bit target with no MSAA (HalfFloat+MSAA renders black on some Android GPUs).
    const coarse = window.matchMedia('(pointer: coarse)').matches
    const gl2 = renderer.capabilities.isWebGL2
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: coarse || !gl2 ? THREE.UnsignedByteType : THREE.HalfFloatType,
      samples: coarse || !gl2 ? 0 : level === 'high' ? 4 : 2,
      // The depth effect reads the scene's own depth, so High keeps it as a texture.
      ...(level === 'high' && gl2 ? { depthTexture: new THREE.DepthTexture(1, 1) } : {}),
    })
    composer = new EffectComposer(renderer, target)
    composer.addPass(new RenderPass(scene, camera))
    bloom = null
    depth = null
    // No depth blur: it softened everything behind the player into a haze. The city stays sharp to the horizon.
    void DepthBlurPass
    // Ambient occlusion on High, desktop only (too heavy for phone GPUs).
    if (level === 'high' && !coarse && gl2) {
      try {
        const ao = new GTAOPass(scene, camera, 1, 1)
        ao.blendIntensity = 0.75
        keepFoliageOutOfAO(ao, scene)
        ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.2, thickness: 1.0, scale: 1.0, samples: 12 })
        composer.addPass(ao)
      } catch (error) {
        console.warn('[grind] AO unavailable', error)
      }
    }
    // Glow on High only: lamps, lit windows and signs at night; by day only true highlights.
    if (level === 'high') {
      bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.1, 0.55, 1)
      composer.addPass(bloom)
    }
    composer.addPass(new OutputPass())
    grade = new ShaderPass(Grade)
    composer.addPass(grade)
    // SMAA after the grade on High desktop only: cleans shader/alpha edges MSAA misses (thin trims, foliage).
    if (level === 'medium' || coarse || !gl2) {
      try { composer.addPass(new FXAAPass()) } catch (error) { console.warn('[grind] FXAA unavailable', error) }
    } else if (level === 'high') {
      try { composer.addPass(new SMAAPass()) } catch (error) { console.warn('[grind] SMAA unavailable', error) }
    }
    // Sharpen last, after anti-aliasing (which softens a little): Medium a touch, High a bit more.
    { const sharp = new ShaderPass(Sharpen); sharp.uniforms.amount!.value = level === 'high' ? 0.6 : 0.45; composer.addPass(sharp) }
  }
  return {
    configure(graphics: Graphics, width: number, height: number, ratio: number) {
      // A tier remembers the sharpness this device held last time, so it does not start too sharp and stutter
      // down again on every visit (kept beside the settings on this device; not part of the save).
      base = ratio
      if (graphics !== level || !sized) { want = scale = recall(graphics); avg = 1 / 60; cool = 2.5 }
      sized = true
      level = graphics
      setSurfaceTier(graphics)
      w = width
      h = height
      if (scale !== 1) { renderer.setPixelRatio(base * scale); renderer.setSize(w, h, false) }
      if (graphics === 'low') return
      if (!composer || builtFor !== graphics) {
        // Each tier has its own pass list, so changing the setting rebuilds the stack.
        if (composer) { for (const p of composer.passes) p.dispose?.(); composer.dispose() }
        build()
        builtFor = graphics
        broken = false
        checks = 0
      }
      composer!.setPixelRatio(ratio * scale)
      composer!.setSize(width, height)
      // Glow at half resolution.
      bloom?.resolution.set(width / 2, height / 2)
      grade!.uniforms.grain.value = 0
    },
    /** The frame time being aimed for, in ms (paced phones: 33 or 50). */
    setBudget(ms: number) {
      const b = ms / 1000
      if (Math.abs(b - budget) > 1e-4) { budget = b; avg = b; cool = Math.max(cool, 2) }
    },
    /** Distance from the camera to what it is looking at (the player): the depth effect starts well behind it. */
    setFocus(d: number) {
      if (depth && Number.isFinite(d)) depth.focus = d
    },
    /** Night lifts bloom so neon strips read; day keeps it subtle. */
    setNight(night: number) {
      if (bloom) {
        // By day only true highlights pass (the sky stays under the threshold: no white glow behind buildings);
        // at night lamps, lit windows and signs carry a soft halo.
        bloom.threshold = 1 - night * 0.22
        bloom.strength = 0.08 + night * 0.34
        bloom.radius = 0.5 + night * 0.15
      }
    },
    /**
     * Sharp when the device can, smooth always: every tier (Low too) renders at the screen's own density up to
     * its cap and steps the resolution down while frames run long, back up while they run easily. One step at
     * a time with a cooldown, because a resize reallocates every render target.
     */
    frame(dt: number, t: number) {
      if (grade) grade.uniforms.time.value = t % 100
      // A hidden tab or a long hitch says nothing about how hard the scene is to draw.
      if (document.hidden) { cool = Math.max(cool, 2); return }
      if (!Number.isFinite(dt) || dt <= 0 || dt > 0.25) return
      avg += (dt - avg) * 0.05
      cool -= dt
      holdSharp = Math.max(0, holdSharp - dt)
      if (cool <= 0) {
        if (probe && t - probe.t > 2.5) {
          // Judge the last step down: frames no faster means the cap is not ours, so put the sharpness back.
          if (avg > probe.before * 0.92) { want = Math.min(cap, want + 0.1); holdSharp = 90; cool = 3 }
          probe = null
        } else if (avg > budget * 1.56 && want > floor() && holdSharp === 0 && !probe) {
          // Clearly under about 38 fps: step down one notch and see whether it helps.
          probe = { before: avg, t }
          want = Math.max(floor(), Math.round((want - 0.1) * 10) / 10); cool = 2.6
        } else if (avg < budget * 1.2 && want < cap) {
          // A steady 50 fps or better: step back up.
          want = Math.min(cap, Math.round((want + 0.1) * 10) / 10); cool = 4
        }
      }
      if (want !== scale) {
        scale = want
        remember(level, scale)
        renderer.setPixelRatio(base * scale)
        renderer.setSize(w, h, false)
        if (composer && level !== 'low') { composer.setPixelRatio(base * scale); composer.setSize(w, h) }
      }
    },
    /**
     * After the browser drops the GPU context and gives it back (phones do this under memory pressure): every
     * render target is gone, so the stack is rebuilt on the next configure, at a lower resolution that stays put
     * for the rest of the visit (less GPU memory, the usual reason it was dropped).
     */
    recover() {
      if (composer) { try { for (const p of composer.passes) p.dispose?.(); composer.dispose() } catch { /* already gone */ } }
      composer = null; builtFor = null; broken = false; checks = 0; blackRuns = 0; probe = null
      want = scale = floor(); cap = scale; remember(level, scale)
    },
    /** Draw one frame at `ratio` pixels per CSS pixel (a 4K photo); call restore() once it is copied. */
    snapshot(ratio: number) {
      renderer.setPixelRatio(ratio)
      renderer.setSize(w, h, false)
      if (composer && level !== 'low' && !broken) { composer.setPixelRatio(ratio); composer.setSize(w, h) }
      this.render()
    },
    restore() {
      renderer.setPixelRatio(base * scale)
      renderer.setSize(w, h, false)
      if (composer && level !== 'low' && !broken) { composer.setPixelRatio(base * scale); composer.setSize(w, h) }
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
      // Three looks only (reading pixels back stalls the GPU: twenty of them were twenty small freezes at start).
      if (++checks === 45 || checks === 120 || checks === 240) {
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
