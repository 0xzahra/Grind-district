// Lite mode for low-end phones (e.g. Helio G99 / Mali-G57 class): the city drawn at 1x, without MSAA, with one
// street-lamp light, no wind in the trees, a shorter view distance, fewer far-away residents and cars on screen.
// Decided once per visit, kept on this device only (localStorage, never the save):
//   gd.lite      'auto' (default) | 'on' | 'off'   the player's choice in Settings
//   gd.lite.auto '1' once this phone has been seen struggling (slow frames or a known low-end GPU)
//   gd.gpu       the GPU name the browser reported last visit (anti-aliasing is chosen before the 3D view exists)
export type LitePref = 'auto' | 'on' | 'off'
const get = (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } }
const set = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* private mode */ } }

export const coarseDevice = (): boolean => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

/** Phone GPUs that cannot carry the full city at a steady frame rate: Mali G31-G68 / T-series, PowerVR, older Adreno. */
export const LOW_END_GPU = /Mali-(G(3[1-9]|5[0-9]|6[0-8])|T\d)|PowerVR|IMG|Adreno \(TM\) ([1-5]\d\d|6[0-1]\d)\b|Adreno (TM )?([1-5]\d\d|6[0-1]\d)\b/i

export function litePref(): LitePref { const v = get('gd.lite'); return v === 'on' || v === 'off' ? v : 'auto' }
export function setLitePref(v: LitePref): void { set('gd.lite', v) }

/** A phone that looks low-end before any frame is drawn: few cores or little memory, or a low-end GPU seen last visit. */
export function guessLowEnd(gpu = get('gd.gpu') ?? ''): boolean {
  if (!coarseDevice()) return false
  const nav = navigator as Navigator & { deviceMemory?: number }
  if (LOW_END_GPU.test(gpu)) return true
  if ((nav.deviceMemory ?? 8) <= 3) return true
  if ((nav.hardwareConcurrency ?? 8) <= 4) return true
  return false
}

let decided: boolean | null = null
/** Is Lite on for this visit? */
export function liteOn(): boolean {
  if (decided !== null) return decided
  const pref = litePref()
  decided = pref === 'on' ? true : pref === 'off' ? false : coarseDevice() && (get('gd.lite.auto') === '1' || guessLowEnd())
  return decided
}
/** Switch Lite on or off for the rest of the visit (Settings, or a phone found struggling). */
export function setLiteNow(on: boolean): void { decided = on }

/** Remember the GPU name and whether it is low-end; returns true if this visit should switch to Lite now. */
export function noteGpu(gl: WebGLRenderingContext | WebGL2RenderingContext | null): boolean {
  if (!gl) return false
  let name = ''
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    name = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
  } catch { /* hidden */ }
  if (name) set('gd.gpu', name.slice(0, 120))
  if (coarseDevice() && LOW_END_GPU.test(name)) { set('gd.lite.auto', '1'); return litePref() === 'auto' && !liteOn() }
  return false
}
/** The phone could not hold its frame rate: use Lite from now on (unless the player chose Full). */
export function noteStruggling(): boolean {
  if (!coarseDevice()) return false
  set('gd.lite.auto', '1')
  return litePref() === 'auto' && !liteOn()
}
