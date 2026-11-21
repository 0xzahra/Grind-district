import * as THREE from 'three'
import { ESTATE_PINS } from './estate.ts'
const LIMIT = 62
export const MAP_LIMIT = LIMIT

const PLOTS: Array<{ x: number; z: number; w: number; d: number; door?: boolean }> = [
  { x: 0, z: -48, w: 16, d: 11 },
  { x: 16, z: -54, w: 8, d: 7, door: true },
  { x: -16, z: -54, w: 8, d: 7, door: true },
  { x: -48, z: 0, w: 12, d: 16 },
  { x: 48, z: 0, w: 12, d: 16 },
  { x: 0, z: 48, w: 16, d: 11 },
  { x: -22, z: -22, w: 8, d: 8, door: true },
  { x: -28, z: 16, w: 4.4, d: 2.6, door: true },
  { x: 36, z: 32, w: 7, d: 6 },
  { x: 52, z: 18, w: 6, d: 5 },
  { x: 52, z: 28, w: 6, d: 5 },
  { x: 52, z: 40, w: 6, d: 5 },
]

let sat: HTMLCanvasElement | null = null
// Satellite photos are always daylit: the scene's own sky light is turned up for the bake (adding a light, or
// dropping the fog, would make every material compile a second shader: a 4-5 s freeze on a phone).
/**
 * Satellite-style base map: one orthographic top-down render of the real scene, cached in a 2D canvas.
 * Drawn on the game canvas itself (a corner of it, then copied), not into a render target, so it reuses the
 * exact shaders the city already has; `redraw` puts the normal frame back right after.
 */
export function bakeSatellite(renderer: THREE.WebGLRenderer, scene: THREE.Scene, size = 512, sky?: THREE.HemisphereLight, redraw?: () => void): void {
  const cam = new THREE.OrthographicCamera(-LIMIT, LIMIT, LIMIT, -LIMIT, 1, 400)
  cam.position.set(0, 200, 0)
  cam.up.set(0, 0, -1)
  cam.lookAt(0, 0, 0)
  const gl = renderer.getContext()
  const px = Math.floor(Math.min(size, gl.drawingBufferWidth, gl.drawingBufferHeight))
  if (px < 64) return
  const ratio = renderer.getPixelRatio()
  const fog = scene.fog as (THREE.Fog | THREE.FogExp2 | null)
  const fogWas = fog ? ('density' in fog ? fog.density : fog.far) : 0
  const bg = scene.background
  const skyWas = sky ? { i: sky.intensity, c: sky.color.getHex(), g: sky.groundColor.getHex(), v: sky.visible } : null
  const hidden: THREE.Object3D[] = []
  scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined
    const skyish = (o as THREE.Mesh).isMesh && m && !Array.isArray(m) && m.side === THREE.BackSide
    const fx = (o as THREE.Points).isPoints || (o as THREE.LineSegments).isLineSegments || (o as THREE.Sprite).isSprite
    const weather = (o as THREE.InstancedMesh).isInstancedMesh && m && !Array.isArray(m) && m.transparent && !m.depthWrite
    if (o.visible && (skyish || fx || weather || o.userData.noMap)) { hidden.push(o); o.visible = false }
  })
  const prev = renderer.getRenderTarget()
  const vp = new THREE.Vector4(), sc = new THREE.Vector4()
  renderer.getViewport(vp); renderer.getScissor(sc)
  const scissorWas = renderer.getScissorTest()
  const exposure = renderer.toneMappingExposure
  try {
    if (fog) { if ('density' in fog) fog.density = 0; else fog.far = 1e9 }
    scene.background = null
    if (sky && skyWas) { sky.visible = true; sky.color.setHex(0xffffff); sky.groundColor.setHex(0x8a8478); sky.intensity = 1.5 }
    renderer.toneMappingExposure = 0.84
    renderer.setRenderTarget(null)
    const css = px / ratio
    renderer.setViewport(0, 0, css, css)
    renderer.setScissor(0, 0, css, css)
    renderer.setScissorTest(true)
    renderer.render(scene, cam)
    const c = sat ?? document.createElement('canvas')
    c.width = c.height = px
    const ctx = c.getContext('2d')!
    // The viewport sits at the bottom-left of the drawing buffer; copy it before the browser presents the frame.
    ctx.drawImage(renderer.domElement, 0, gl.drawingBufferHeight - px, px, px, 0, 0, px, px)
    sat = c
  } catch { /* keep the vector map */ } finally {
    renderer.setScissorTest(scissorWas)
    renderer.setScissor(sc)
    renderer.setViewport(vp)
    renderer.setRenderTarget(prev)
    renderer.toneMappingExposure = exposure
    if (fog) { if ('density' in fog) fog.density = fogWas; else fog.far = fogWas }
    scene.background = bg
    for (const o of hidden) o.visible = true
    if (sky && skyWas) { sky.intensity = skyWas.i; sky.color.setHex(skyWas.c); sky.groundColor.setHex(skyWas.g); sky.visible = skyWas.v }
    try { redraw?.() } catch { /* the next frame draws anyway */ }
  }
}

export const satelliteUrl = (): string => sat?.toDataURL('image/png') ?? ''
/** The baked top-down picture of the city (null until it has been drawn). */
export const satelliteCanvas = (): HTMLCanvasElement | null => sat

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  player: { x: number; z: number },
  others: Array<{ x: number; z: number }> = [],
): void {
  const X = (x: number) => ((x / LIMIT) * 0.5 + 0.5) * width
  const Y = (z: number) => ((z / LIMIT) * 0.5 + 0.5) * height
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#101816'
  ctx.fillRect(0, 0, width, height)
  if (sat) ctx.drawImage(sat, 0, 0, width, height)
  if (!sat) {
  ctx.strokeStyle = '#2f6d58'
  ctx.lineWidth = Math.max(2, width / 36)
  ctx.beginPath()
  ctx.moveTo(X(-46), Y(0))
  ctx.lineTo(X(46), Y(0))
  ctx.moveTo(X(0), Y(-46))
  ctx.lineTo(X(0), Y(46))
  ctx.stroke()
  for (const plot of PLOTS) {
    const left = X(plot.x - plot.w / 2)
    const top = Y(plot.z - plot.d / 2)
    const w = (plot.w / LIMIT) * 0.5 * width
    const h = (plot.d / LIMIT) * 0.5 * height
    ctx.fillStyle = plot.door ? '#1a4a3c' : '#16362c'
    ctx.fillRect(left, top, w, h)
    if (plot.door) {
      ctx.fillStyle = '#c9a25e'
      ctx.fillRect(left + w / 2 - 2, top + h - 3, 4, 3)
    }
  }
  ctx.fillStyle = '#1a6a5c'
  ctx.beginPath()
  ctx.arc(X(-40), Y(40), Math.max(4, width / 28), 0, Math.PI * 2)
  ctx.fill()
  }
  ctx.fillStyle = '#9dccb6'
  ctx.font = `600 ${Math.max(9, Math.round(width / 12))}px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  // Named markers: home, boutique, gym.
  const marks: Array<[number, number, string, string]> = [[36, 32, 'H', '#e8c98f'], [22, -22, 'B', '#f2ece0'], [-22, -22, 'G', '#f2ece0'], [24, 27, '✝', '#f2ece0'], [-19.8, 33, 'M', '#f2ece0']]
  ctx.font = `700 ${Math.max(9, Math.round(width / 14))}px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif`
  for (const [ex, ez, el] of ESTATE_PINS) marks.push([ex, ez, el, '#e8c98f'])
  for (const [mx, mz, letter, col] of marks) {
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.beginPath()
    ctx.arc(X(mx), Y(mz), Math.max(6, width / 20), 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = col
    ctx.fillText(letter, X(mx), Y(mz) + 0.5)
  }
  ctx.fillStyle = '#ffd27a'
  for (const other of others) {
    ctx.beginPath()
    ctx.arc(X(other.x), Y(other.z), Math.max(2, width / 60), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#f7f9fc'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(X(player.x), Y(player.z), Math.max(4, width / 32), 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#17f790'
  ctx.beginPath()
  ctx.arc(X(player.x), Y(player.z), Math.max(2.5, width / 48), 0, Math.PI * 2)
  ctx.fill()
}
