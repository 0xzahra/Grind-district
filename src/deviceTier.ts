// Performance mode, for every device (phones, tablets and computers): Auto, Light or Full.
//   Light: the city drawn at 1x, without MSAA, with one street-lamp light, no wind in the trees, a shorter view
//          distance, fewer far-away residents and cars on screen. Smoothest.
//   Full:  everything the Graphics setting (Low / Medium / High) asks for. The game still paces frames and lowers
//          sharpness a little while frames run long, so Full does not freeze.
//   Auto:  picks Light or Full from the device (memory, processor cores, graphics chip), then keeps watching: a device
//          that cannot hold its frame rate is locked to a steady 30, then steps Graphics down, then goes Light.
// Decided once per visit, kept on this device only (localStorage, never the save):
//   gd.lite      'auto' (default) | 'on' | 'off'   the player's choice in Settings (on = Light, off = Full)
//   gd.lite.auto '1' once this device has been seen struggling (slow frames or a known weak graphics chip)
//   gd.gpu       the graphics chip the browser reported last visit (anti-aliasing is chosen before the 3D view exists)
export type LitePref = 'auto' | 'on' | 'off'
const get = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const set = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export const coarseDevice = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** Phone GPUs that cannot carry the full city at a steady frame rate: Mali G31-G68 / T-series, PowerVR, older Adreno. */
export const LOW_END_GPU = /Mali-(G(3[1-9]|5[0-9]|6[0-8])|T\d)|PowerVR|IMG|Adreno \(TM\) ([1-5]\d\d|6[0-1]\d)\b|Adreno (TM )?([1-5]\d\d|6[0-1]\d)\b/i
/** Computers drawing with no real graphics chip (software rendering) or an old integrated one (Intel HD, before UHD). */
export const LOW_END_PC_GPU = /SwiftShader|llvmpipe|softpipe|Microsoft Basic Render|Intel\(R\) HD Graphics|Intel HD Graphics|GMA \d/i
/** Integrated computer graphics: fine for Medium, but High at the screen's full 4K density is too much for them. */
export const INTEGRATED_PC_GPU = /Intel|AMD Radeon(\(TM\))? (Graphics|Vega \d+ Graphics)|Radeon\(TM\) Graphics|Mali|Adreno/i

export function litePref(): LitePref { const v = get('gd.lite'); return v === 'on' || v === 'off' ? v : 'auto' }
export function setLitePref(v: LitePref): void { set('gd.lite', v) }

/** A device that looks low-end before any frame is drawn: little memory, few cores, or a weak graphics chip. */
export function guessLowEnd(gpu = get('gd.gpu') ?? ''): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  const mem = nav.deviceMemory ?? 8, cores = nav.hardwareConcurrency ?? 8
  if (coarseDevice()) {
    if (LOW_END_GPU.test(gpu)) return true
    if (mem <= 3) return true
    if (cores <= 4) return true
    return false
  }
  // Computers: software rendering or an old integrated chip, or a machine with very little memory or two cores.
  if (LOW_END_PC_GPU.test(gpu)) return true
  if (mem <= 2) return true
  if (cores <= 2) return true
  return false
}

/** A computer whose graphics are built into the processor: keep High at 2x instead of the screen's full density. */
export function integratedGpu(gpu = get('gd.gpu') ?? ''): boolean {
  return !coarseDevice() && INTEGRATED_PC_GPU.test(gpu) && !/NVIDIA|GeForce|Radeon RX|Radeon Pro|Arc\b/i.test(gpu)
}

let decided: boolean | null = null
/** Is Light on for this visit? */
export function liteOn(): boolean {
  if (decided !== null) return decided
  const pref = litePref()
  decided = pref === 'on' ? true : pref === 'off' ? false : get('gd.lite.auto') === '1' || guessLowEnd()
  return decided
}
/** Switch Light on or off for the rest of the visit (Settings, or a device found struggling). */
export function setLiteNow(on: boolean): void { decided = on }

/** Remember the graphics chip and whether it is weak; returns true if this visit should switch to Light now. */
export function noteGpu(gl: WebGLRenderingContext | WebGL2RenderingContext | null): boolean {
  if (!gl) return false
  let name = ''
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
  } catch { /* hidden */ }
  if (name) set('gd.gpu', name.slice(0, 120))
  const weak = coarseDevice() ? LOW_END_GPU.test(name) : LOW_END_PC_GPU.test(name)
  if (weak) { set('gd.lite.auto', '1'); return litePref() === 'auto' && !liteOn() }
  return false
}
/** The device could not hold its frame rate even on Low: use Light from now on (unless the player chose Full). */
export function noteStruggling(): boolean {
  set('gd.lite.auto', '1')
  return litePref() === 'auto' && !liteOn()
}
/** Auto is in charge (the player has not picked Light or Full). */
export const autoPerformance = (): boolean => litePref() === 'auto'
