// Live face+body preview for the join-time avatar creator.
// Same avatar pipeline as the city; 2D silhouette fallback if WebGL fails.
import * as THREE from 'three'
import { createAvatar, type Avatar } from './avatars.ts'
import type { BodyId } from './logic.ts'
import { getMorph } from './morph.ts'
import { piece, worn } from './wardrobe.ts'

export type CreatorPreview = { refresh: () => void; dispose: () => void }

export function mountCreatorPreview(host: HTMLElement, getBody: () => BodyId): CreatorPreview {
  host.replaceChildren()
  host.classList.add('creator-preview')
  const label = document.createElement('p')
  label.className = 'muted creator-preview-label'
  label.textContent = 'Live preview'
  const frame = document.createElement('div')
  frame.className = 'creator-preview-frame'
  const canvas = document.createElement('canvas')
  canvas.width = 280
  canvas.height = 360
  canvas.setAttribute('aria-label', 'Live avatar preview')
  frame.append(canvas)
  host.append(label, frame)

  let disposed = false
  let raf = 0
  let avatar: Avatar | null = null
  let bodyId: BodyId | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let use2d = false
  let t0 = performance.now()

  const hexCss = (n: number) => `#${n.toString(16).padStart(6, '0')}`

  const paint2d = () => {
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = canvas.width
    const h = canvas.height
    const g = ctx.createLinearGradient(0, 0, 0, h)
    g.addColorStop(0, '#2a3038')
    g.addColorStop(1, '#14181e')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
    const mo = getMorph()
    const skin = mo.skin ?? 0xe8c3a6
    const lady = getBody() === 'zuri'
    const hair = mo.hair ?? (lady ? 0x2a1a12 : 0xd9c08a)
    const wornNow = worn()
    const top = piece(wornNow.top)?.hex ?? (lady ? 0xc4a574 : 0x5c6b80)
    const bottom = piece(wornNow.bottom)?.hex ?? 0x2b3a67
    const shoes = piece(wornNow.shoes)?.hex ?? 0xf2f2f2
    const cx = w / 2
    const faceF = mo.f ?? 1
    const bodyB = mo.b
    const bodyH = mo.h
    const bw = 56 * bodyB
    const bh = 90 * bodyH
    ctx.fillStyle = hexCss(top)
    roundRect(ctx, cx - bw / 2, 150, bw, bh, 14)
    ctx.fill()
    ctx.fillStyle = hexCss(bottom)
    ctx.fillRect(cx - 22 * bodyB, 150 + bh - 4, 18 * bodyB, 70 * bodyH)
    ctx.fillRect(cx + 4 * bodyB, 150 + bh - 4, 18 * bodyB, 70 * bodyH)
    ctx.fillStyle = hexCss(shoes)
    ctx.fillRect(cx - 24 * bodyB, 150 + bh + 66 * bodyH, 22 * bodyB, 10)
    ctx.fillRect(cx + 2 * bodyB, 150 + bh + 66 * bodyH, 22 * bodyB, 10)
    const hr = 36 * faceF
    ctx.fillStyle = hexCss(skin)
    ctx.beginPath()
    ctx.ellipse(cx, 108, hr * 0.85, hr, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = hexCss(hair)
    ctx.beginPath()
    ctx.ellipse(cx, 88, hr * 0.9, hr * 0.55, 0, Math.PI, Math.PI * 2)
    ctx.fill()
    if (lady) {
      ctx.fillRect(cx - hr * 0.95, 90, hr * 0.28, 50)
      ctx.fillRect(cx + hr * 0.67, 90, hr * 0.28, 50)
    }
    ctx.fillStyle = '#1a1a1a'
    ctx.beginPath(); ctx.ellipse(cx - 12 * faceF, 108, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.beginPath(); ctx.ellipse(cx + 12 * faceF, 108, 3.2, 4, 0, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = '#8a5a4a'
    ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(cx, 118, 8 * faceF, 0.15, Math.PI - 0.15); ctx.stroke()
  }

  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r)
    ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r)
    ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }

  const disposeAvatar = () => {
    if (!avatar || !scene) return
    scene.remove(avatar.object)
    avatar.object.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose?.()
      const mat = mesh.material
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.())
      else if (mat) (mat as THREE.Material).dispose?.()
    })
    avatar = null
  }

  const rebuild3d = () => {
    if (!renderer || !scene || disposed) return
    disposeAvatar()
    bodyId = getBody()
    const tint = bodyId === 'zuri' ? 0xc4a574 : 0x5c6b80
    avatar = createAvatar(bodyId, tint, false)
    avatar.object.position.set(0, 0, 0)
    // Front-facing: Quaternius rig faces +Z toward camera at yaw 0 (Math.PI showed the back).
    avatar.object.rotation.y = 0
    scene.add(avatar.object)
    avatar.setStyle(tint, false)
  }

  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
    renderer.setPixelRatio(Math.min(1.5, devicePixelRatio || 1))
    renderer.setSize(280, 360, false)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1e24)
    camera = new THREE.PerspectiveCamera(28, 280 / 360, 0.1, 20)
    camera.position.set(0.15, 1.2, 3.0)
    camera.lookAt(0, 0.95, 0)
    const key = new THREE.DirectionalLight(0xfff6ea, 1.85)
    key.position.set(0.4, 2.6, 3.2) // key from camera side so the face is lit
    const fill = new THREE.DirectionalLight(0xd8e6ff, 0.55)
    fill.position.set(-1.8, 1.6, 1.2)
    scene.add(key, fill, new THREE.HemisphereLight(0xf2e8dc, 0x3a332c, 0.95), new THREE.AmbientLight(0xfff6ea, 0.35))
    renderer.toneMappingExposure = 1.12
    rebuild3d()
    const loop = (now: number) => {
      if (disposed || !renderer || !scene || !camera || !avatar) return
      raf = requestAnimationFrame(loop)
      const dt = Math.min(0.05, (now - t0) / 1000)
      t0 = now
      // Slow turn around the front so the face stays readable
      avatar.object.rotation.y = Math.sin(now * 0.00055) * 0.35
      try { avatar.step(dt, false, 0) } catch { /* idle */ }
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(loop)
  } catch {
    use2d = true
    renderer = null
    paint2d()
  }

  return {
    refresh: () => {
      if (disposed) return
      if (use2d || !renderer || !scene) { paint2d(); return }
      try {
        const next = getBody()
        if (next !== bodyId || !avatar) rebuild3d()
        else avatar.setStyle(next === 'zuri' ? 0xc4a574 : 0x5c6b80, false)
      } catch {
        use2d = true
        paint2d()
      }
    },
    dispose: () => {
      disposed = true
      cancelAnimationFrame(raf)
      disposeAvatar()
      renderer?.dispose()
      try { renderer?.forceContextLoss() } catch { /* */ }
      renderer = null
      scene = null
      camera = null
      host.replaceChildren()
    },
  }
}
