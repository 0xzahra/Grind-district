// The beach on the north edge of the city: sand from the edge of the district down to a wet shoreline with a
// moving foam line, then open sea to the horizon. Palms, striped umbrellas and loungers along the sand.
// Scenery beyond the walkable city (the map ends at the promenade). Everything repeated is instanced, so the
// whole beach is about ten draw calls; the sea's waves are a scrolling normal map.
import * as THREE from 'three'
import type { Graphics } from './logic.ts'

const SAND_N = -62, SHORE = -80 // sand from z -62 to the waterline at z -80

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
let seed = 11
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

function sandTexture(): THREE.CanvasTexture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = '#e6d3ad'; g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 9000; i++) {
      const v = rnd()
      g.fillStyle = v < 0.5 ? 'rgba(255,248,230,0.35)' : v < 0.85 ? 'rgba(170,140,95,0.22)' : 'rgba(120,98,70,0.25)'
      g.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5)
    }
    // Soft wind ripples.
    g.strokeStyle = 'rgba(190,160,115,0.18)'; g.lineWidth = 2
    for (let y = 8; y < 256; y += 22) { g.beginPath(); for (let x = 0; x <= 256; x += 8) g.lineTo(x, y + Math.sin(x / 19 + y) * 3); g.stroke() }
  })
}
function waveNormals(): THREE.CanvasTexture {
  const S = 128
  return canvasTex(S, S, (g) => {
    const img = g.createImageData(S, S)
    const h = (x: number, y: number) => Math.sin((x / S) * Math.PI * 2 * 3 + Math.sin((y / S) * Math.PI * 2 * 2) * 1.5) + 0.6 * Math.sin((y / S) * Math.PI * 2 * 5 + (x / S) * Math.PI * 2)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const dx = h(x + 1, y) - h(x - 1, y), dy = h(x, y + 1) - h(x, y - 1)
      const n = new THREE.Vector3(-dx, -dy, 2.2).normalize(), k = (y * S + x) * 4
      img.data[k] = (n.x * 0.5 + 0.5) * 255; img.data[k + 1] = (n.y * 0.5 + 0.5) * 255; img.data[k + 2] = (n.z * 0.5 + 0.5) * 255; img.data[k + 3] = 255
    }
    g.putImageData(img, 0, 0)
  }, false)
}

/** A palm: a leaning trunk in rings and a crown of drooping fronds (two merged geometries: trunk, leaves). */
function palmParts(): { trunk: THREE.BufferGeometry; leaves: THREE.BufferGeometry } {
  const trunkParts: THREE.BufferGeometry[] = []
  let x = 0, y = 0
  for (let i = 0; i < 7; i++) {
    const seg = new THREE.CylinderGeometry(0.16 - i * 0.012, 0.19 - i * 0.012, 0.9, 7)
    seg.rotateZ(-0.05 - i * 0.025)
    seg.translate(x, y + 0.45, 0)
    trunkParts.push(seg)
    x += 0.06 + i * 0.022; y += 0.88
  }
  const leafParts: THREE.BufferGeometry[] = []
  for (let k = 0; k < 9; k++) {
    const leaf = new THREE.ConeGeometry(0.42, 3.2, 4, 1)
    leaf.scale(1, 1, 0.12)
    leaf.translate(0, 1.6, 0)
    leaf.rotateZ(-1.15 - (k % 2) * 0.25) // out and drooping
    leaf.rotateY((k / 9) * Math.PI * 2)
    leaf.translate(x, y + 0.1, 0)
    leafParts.push(leaf)
  }
  const merge = (list: THREE.BufferGeometry[]) => {
    // Small manual merge (positions + normals; no indices) to keep this module free of extra imports.
    const pos: number[] = [], nor: number[] = []
    for (const g0 of list) {
      const g = g0.index ? g0.toNonIndexed() : g0
      pos.push(...Array.from(g.getAttribute('position').array as ArrayLike<number>))
      nor.push(...Array.from(g.getAttribute('normal').array as ArrayLike<number>))
    }
    const out = new THREE.BufferGeometry()
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
    return out
  }
  return { trunk: merge(trunkParts), leaves: merge(leafParts) }
}

export function createBeach(scene: THREE.Scene, graphics: Graphics): { tick: (dt: number) => void } {
  const hi = graphics === 'high'
  const group = new THREE.Group(); group.name = 'beach'
  // Sand: dry sand, then a darker wet band at the waterline.
  const sandMap = sandTexture(); sandMap.repeat.set(60, 6)
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(420, SAND_N - SHORE + 2), new THREE.MeshStandardMaterial({ map: sandMap, roughness: 1, color: 0xffffff }))
  sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.012, (SAND_N + SHORE) / 2 - 1); sand.receiveShadow = true
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(420, 3), new THREE.MeshStandardMaterial({ map: sandMap, color: 0xb59c74, roughness: 0.45, metalness: 0.05 }))
  wet.rotation.x = -Math.PI / 2; wet.position.set(0, 0.016, SHORE + 1.2)
  // Sea to the horizon, with waves from a scrolling normal map.
  const normals = waveNormals(); normals.repeat.set(160, 150)
  const seaMat = new THREE.MeshStandardMaterial({ color: 0x23718a, roughness: 0.16, metalness: 0.08, normalMap: normals, normalScale: new THREE.Vector2(0.45, 0.45), emissive: 0x0b3a48, emissiveIntensity: 0.25 })
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2400, 1600), seaMat)
  sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.03, SHORE - 800)
  // Foam where the waves reach the sand.
  const foamTex = canvasTex(512, 32, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 32); grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.45, 'rgba(255,255,255,0.85)'); grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad; g.fillRect(0, 0, 512, 32)
    g.globalCompositeOperation = 'destination-out'
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(0,0,0,${0.3 + rnd() * 0.5})`; g.beginPath(); g.arc(rnd() * 512, 8 + rnd() * 16, 2 + rnd() * 6, 0, Math.PI * 2); g.fill() }
  })
  foamTex.repeat.set(30, 1)
  const foamMat = new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.8 })
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(420, 2.2), foamMat)
  foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.05, SHORE + 0.2)
  group.add(sand, wet, sea, foam)

  // Palms along the back of the beach.
  const palm = palmParts()
  const spotsPalm: Array<[number, number, number]> = []
  for (let x = -86; x <= 86; x += 13) spotsPalm.push([x + (rnd() - 0.5) * 5, SAND_N - 2.5 - rnd() * 3, rnd() * Math.PI * 2])
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.95 })
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7a3a, roughness: 0.8, side: THREE.DoubleSide })
  const trunks = new THREE.InstancedMesh(palm.trunk, trunkMat, spotsPalm.length)
  const leaves = new THREE.InstancedMesh(palm.leaves, leafMat, spotsPalm.length)
  const m = new THREE.Object3D()
  spotsPalm.forEach(([x, z, ry], i) => { const s = 1.05 + rnd() * 0.35; m.position.set(x, 0, z); m.rotation.set(0, ry, 0); m.scale.setScalar(s); m.updateMatrix(); trunks.setMatrixAt(i, m.matrix); leaves.setMatrixAt(i, m.matrix) })
  trunks.castShadow = leaves.castShadow = hi
  group.add(trunks, leaves)

  // Striped umbrellas with a lounger and a towel beside each.
  const spots: Array<[number, number]> = []
  for (let x = -78; x <= 78; x += 12) spots.push([x + (rnd() - 0.5) * 4, -71 - rnd() * 4])
  const canopyA = new THREE.ConeGeometry(1.5, 0.55, 12, 1, true); canopyA.translate(0, 2.35, 0)
  const pole = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6); pole.translate(0, 1.2, 0)
  const colours = [0xd94b4b, 0x2a8fa0, 0xf2b84b, 0x2f9e6a]
  const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.75, side: THREE.DoubleSide })
  const canopies = new THREE.InstancedMesh(canopyA, canopyMat, spots.length)
  const poles = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.5 }), spots.length)
  const lounger = new THREE.BoxGeometry(0.7, 0.12, 1.9); lounger.translate(0, 0.32, 0)
  const back = new THREE.BoxGeometry(0.7, 0.1, 0.8); back.rotateX(-0.75); back.translate(0, 0.55, -0.95)
  const loungers = new THREE.InstancedMesh(lounger, new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.7 }), spots.length)
  const backs = new THREE.InstancedMesh(back, new THREE.MeshStandardMaterial({ color: 0xf4efe6, roughness: 0.7 }), spots.length)
  const towel = new THREE.PlaneGeometry(0.9, 1.8); towel.rotateX(-Math.PI / 2); towel.translate(0, 0.02, 0)
  const towels = new THREE.InstancedMesh(towel, new THREE.MeshStandardMaterial({ roughness: 0.95 }), spots.length)
  const col = new THREE.Color()
  spots.forEach(([x, z], i) => {
    m.position.set(x, 0, z); m.rotation.set(0, 0, 0); m.scale.setScalar(1); m.updateMatrix()
    canopies.setMatrixAt(i, m.matrix); poles.setMatrixAt(i, m.matrix)
    canopies.setColorAt(i, col.setHex(colours[i % colours.length]!))
    m.position.set(x + 1.1, 0, z + 0.4); m.rotation.set(0, Math.PI + (rnd() - 0.5) * 0.3, 0); m.updateMatrix()
    loungers.setMatrixAt(i, m.matrix); backs.setMatrixAt(i, m.matrix)
    m.position.set(x - 1.2, 0, z + 0.6); m.rotation.set(0, (rnd() - 0.5) * 0.4, 0); m.updateMatrix()
    towels.setMatrixAt(i, m.matrix); towels.setColorAt(i, col.setHex(colours[(i + 2) % colours.length]!))
  })
  for (const im of [canopies, poles, loungers, backs]) { im.castShadow = hi; im.receiveShadow = true }
  group.add(canopies, poles, loungers, backs, towels)

  // A lifeguard tower in the middle of the beach.
  const tw = new THREE.Group()
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 }), red = new THREE.MeshStandardMaterial({ color: 0xc8443c, roughness: 0.6 })
  for (const [lx, lz] of [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]] as const) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), white); leg.position.set(lx, 1.2, lz); tw.add(leg) }
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 2), white); cabin.position.y = 3; tw.add(cabin)
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.7, 0.7, 4), red); roof.position.y = 3.95; roof.rotation.y = Math.PI / 4; tw.add(roof)
  tw.position.set(6, 0, -75)
  tw.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = hi })
  group.add(tw)

  scene.add(group)
  let t = 0
  return {
    tick(dt: number) {
      t += dt
      normals.offset.set(t * 0.012, t * 0.02)
      foamTex.offset.x = t * 0.01
      foam.position.z = SHORE + 0.2 + Math.sin(t * 0.8) * 0.45
      foamMat.opacity = 0.6 + Math.sin(t * 0.8 + 1.2) * 0.2
    },
  }
}
