import * as THREE from 'three'

// Pool water: one tileable ripple texture (painted once), scrolled in two directions on the colour and
// emissive maps for a slow shimmer. Updates only while the pool is in a visible room and on screen.
let tile: THREE.CanvasTexture | null = null
function rippleTile(): THREE.CanvasTexture {
  if (tile) return tile
  const S = 256
  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S)
  // Soft caustic web: thin light arcs, drawn wrapped so the tile repeats without seams.
  g.lineWidth = 2.2
  for (let i = 0; i < 46; i++) {
    const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1 * S
    const y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1 * S
    const r = 14 + (i % 5) * 7
    g.strokeStyle = `rgba(210,236,246,${0.35 + (i % 3) * 0.12})`
    for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.beginPath(); g.arc(x + dx, y + dy, r, i, i + 2.2); g.stroke() }
  }
  tile = new THREE.CanvasTexture(c)
  tile.wrapS = tile.wrapT = THREE.RepeatWrapping
  tile.colorSpace = THREE.SRGBColorSpace
  return tile
}

type Pool = { mesh: THREE.Mesh; map: THREE.Texture; glow: THREE.Texture; mat: THREE.MeshStandardMaterial; t: number }
const pools: Pool[] = []
const frustum = new THREE.Frustum()
const m4 = new THREE.Matrix4()
const sphere = new THREE.Sphere()

export function animateWater(mesh: THREE.Mesh, repeat = 2) {
  const mat = mesh.material as THREE.MeshStandardMaterial
  const base = rippleTile()
  const map = base.clone(); map.repeat.set(repeat, repeat * 1.6); map.needsUpdate = true
  const glow = base.clone(); glow.repeat.set(repeat * 0.7, repeat * 1.1); glow.needsUpdate = true
  mat.map = map
  mat.emissiveMap = glow
  mat.needsUpdate = true
  mesh.geometry.computeBoundingSphere()
  pools.push({ mesh, map, glow, mat, t: 0 })
}

export function tickWater(dt: number, camera: THREE.Camera) {
  if (!pools.length) return
  let ready = false
  for (const p of pools) {
    let o: THREE.Object3D | null = p.mesh, shown = true
    while (o) { if (!o.visible) { shown = false; break } o = o.parent }
    if (!shown) continue
    if (!ready) { m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); frustum.setFromProjectionMatrix(m4); ready = true }
    sphere.copy(p.mesh.geometry.boundingSphere!).applyMatrix4(p.mesh.matrixWorld)
    if (!frustum.intersectsSphere(sphere)) continue
    p.t += dt
    p.map.offset.set(p.t * 0.018, p.t * 0.031)
    p.glow.offset.set(-p.t * 0.024, p.t * 0.012 + Math.sin(p.t * 0.6) * 0.02)
    p.mat.emissiveIntensity = 0.1 + Math.sin(p.t * 1.3) * 0.025
  }
}
