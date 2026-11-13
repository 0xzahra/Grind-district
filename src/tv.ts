import * as THREE from 'three'
import { getSave } from './state.ts'
import { passedCount } from './certs.ts'
import { rankFor } from './logic.ts'

// Wall TVs: a small canvas screen that wakes when the player is close (or taps it) and sleeps when far or
// offscreen. Repaints at ~6 fps while on, nothing at all while off, so it costs a phone almost nothing.
const W = 512
const H = 288
const NEWS = [
  'Campus adds a liquidity module · four exercises, one source line',
  'Plaza benches restored · sit a while, the city keeps moving',
  'Trading floor reminder · size the position before the entry',
  'Studio row · bounties pay in in-game cash',
  'Gym streaks count once a day · four stations, one set',
  'Not your keys, not your coins',
]

type Tv = { mesh: THREE.Mesh; tex: THREE.CanvasTexture; g: CanvasRenderingContext2D; on: boolean; forced: boolean; acc: number; t: number; glow: number; channel: number; sphere: THREE.Sphere }
const tvs: Tv[] = []
const frustum = new THREE.Frustum()
const m4 = new THREE.Matrix4()

function paint(tv: Tv) {
  const g = tv.g
  const s = getSave()
  g.globalAlpha = 1
  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#16181c'); bg.addColorStop(1, '#0c0d10')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  // Header.
  g.fillStyle = '#c9a25e'; g.fillRect(24, 26, 4, 22)
  g.fillStyle = '#efe9dc'; g.font = '600 20px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textBaseline = 'middle'
  g.fillText('GRIND DISTRICT', 38, 37)
  g.fillStyle = '#8d877c'; g.font = '500 16px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
  const clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  g.textAlign = 'right'; g.fillText(clock, W - 24, 37); g.textAlign = 'left'
  const slide = Math.floor(tv.t / 7 + tv.channel) % 2
  if (slide === 0) {
    // City stats.
    g.fillStyle = '#8d877c'; g.font = '500 15px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText('YOUR CITY FILE', 24, 82)
    const rows: Array<[string, string]> = [['Rank', rankFor(s.xp).label], ['Reputation', String(s.reputation ?? 0)], ['Courses passed', String(passedCount())]]
    rows.forEach(([k, val], i) => {
      const y = 118 + i * 38
      g.fillStyle = '#b9b2a5'; g.font = '400 19px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText(k, 24, y)
      g.fillStyle = '#efe9dc'; g.font = '600 21px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.textAlign = 'right'; g.fillText(val, W - 24, y); g.textAlign = 'left'
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(24, y + 18, W - 48, 1)
    })
  } else {
    // A calm market line, drawn as it ticks.
    g.fillStyle = '#8d877c'; g.font = '500 15px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText('DISTRICT COIN · PRACTICE MARKET', 24, 82)
    g.strokeStyle = 'rgba(255,255,255,0.05)'; g.lineWidth = 1
    for (let y = 110; y <= 220; y += 36) { g.beginPath(); g.moveTo(24, y); g.lineTo(W - 24, y); g.stroke() }
    g.beginPath(); g.lineWidth = 2.5; g.strokeStyle = '#c9a25e'
    for (let i = 0; i <= 46; i++) {
      const k = i + tv.t * 1.5
      const y = 168 - Math.sin(k * 0.31) * 26 - Math.sin(k * 0.11 + 1) * 18
      const x = 24 + (i / 46) * (W - 48)
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y)
    }
    g.stroke()
  }
  // News ticker.
  g.fillStyle = '#1d2025'; g.fillRect(0, H - 44, W, 44)
  g.fillStyle = '#c9a25e'; g.fillRect(0, H - 44, 70, 44)
  g.fillStyle = '#14110e'; g.font = '700 14px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'; g.fillText('NEWS', 14, H - 22)
  g.save(); g.beginPath(); g.rect(70, H - 44, W - 70, 44); g.clip()
  g.fillStyle = '#d9d3c6'; g.font = '500 17px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
  const line = NEWS.join('     ·     ')
  const lw = g.measureText(line).width + 60
  const off = (tv.t * 55) % lw
  g.fillText(line, 84 - off, H - 22); g.fillText(line, 84 - off + lw, H - 22)
  g.restore()
  // Power-on fade.
  if (tv.glow < 1) { g.fillStyle = `rgba(0,0,0,${1 - tv.glow})`; g.fillRect(0, 0, W, H) }
  tv.tex.needsUpdate = true
}

function blank(tv: Tv) {
  const g = tv.g
  g.fillStyle = '#07080a'; g.fillRect(0, 0, W, H)
  // Faint glass reflection so an off TV still reads as a screen.
  const r = g.createLinearGradient(0, 0, W, H)
  r.addColorStop(0, 'rgba(255,255,255,0.07)'); r.addColorStop(0.45, 'rgba(255,255,255,0)')
  g.fillStyle = r; g.fillRect(0, 0, W, H)
  tv.tex.needsUpdate = true
}

/** A 16:9 screen plane (front faces +z). Add it to a group just in front of the TV body. */
export function createTvScreen(width: number): { mesh: THREE.Mesh; toggle: () => void } {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, width * (H / W)), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }))
  const tv: Tv = { mesh, tex, g: c.getContext('2d')!, on: false, forced: false, acc: 0, t: 0, glow: 0, channel: tvs.length, sphere: new THREE.Sphere(new THREE.Vector3(), width) }
  blank(tv)
  tvs.push(tv)
  return { mesh, toggle: () => { tv.forced = !tv.on; tv.channel++; tv.acc = 1 } }
}

/** Per frame from the render loop. Wakes TVs within 7 m that are visible; sleeps the rest. */
export function tickTvs(dt: number, x: number, z: number, camera: THREE.Camera) {
  if (!tvs.length) return
  let frustumReady = false
  for (const tv of tvs) {
    if (!tv.mesh.parent || !tv.mesh.parent.visible) { if (tv.on) { tv.on = false; tv.forced = false; blank(tv) } continue }
    tv.mesh.getWorldPosition(tv.sphere.center)
    const near = Math.hypot(tv.sphere.center.x - x, tv.sphere.center.z - z) < 7
    if (!near) tv.forced = false
    let visible = false
    if (near || tv.forced) {
      if (!frustumReady) { m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(m4); frustumReady = true }
      visible = frustum.intersectsSphere(tv.sphere)
    }
    const want = (near || tv.forced) && visible
    if (!want) { if (tv.on && !near) { tv.on = false; tv.glow = 0; blank(tv) } continue }
    if (!tv.on) { tv.on = true; tv.glow = 0; tv.acc = 1 }
    tv.t += dt
    tv.acc += dt
    tv.glow = Math.min(1, tv.glow + dt * 2.5)
    if (tv.acc >= (tv.glow < 1 ? 0.05 : 0.16)) { tv.acc = 0; paint(tv) }
  }
}
