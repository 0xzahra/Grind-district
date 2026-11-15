import { CTRL } from './metroRoute.ts'
import * as THREE from 'three'
import type { Graphics } from './logic.ts'

/**
 * Skyline beyond the walkable city: towers with real-scale façades. Every tower is an instanced box, but its
 * windows are laid out in world units (a floor every 3.6 m, a window bay every 3.2 m), so a short tower has a few
 * floors and a tall one has many, the way real buildings read from a distance. Three façade types (glass offices,
 * stone residential towers with balconies, and bronze glass), a darker lobby at street level, setback upper
 * floors, spires and aviation lights on the tallest, rooftop plant, and lit windows that come on at night.
 * About eight draw calls in all, whatever the count.
 */
const FLOOR = 3.6, BAY = 3.2
const TILE_FLOORS = 8, TILE_BAYS = 4

/** One façade tile: TILE_BAYS bays by TILE_FLOORS floors. Albedo plus a glow map of lit panes. */
function facade(kind: 'glass' | 'stone' | 'bronze', seed: number): { map: THREE.CanvasTexture; glow: THREE.CanvasTexture } {
  const W = 256, H = 256
  const bw = W / TILE_BAYS, fh = H / TILE_FLOORS
  const a = document.createElement('canvas'); a.width = W; a.height = H
  const e = document.createElement('canvas'); e.width = W; e.height = H
  const g = a.getContext('2d')!, ge = e.getContext('2d')!
  let s = seed
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H)
  if (kind === 'stone') {
    // Warm stone with punched windows and a balcony slab on every floor.
    g.fillStyle = '#d9d0c2'; g.fillRect(0, 0, W, H)
    for (let f = 0; f < TILE_FLOORS; f++) {
      const y = f * fh
      g.fillStyle = '#c4b9a8'; g.fillRect(0, y + fh - 5, W, 5)
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(0, y + fh - 1, W, 1)
      for (let b = 0; b < TILE_BAYS; b++) {
        const x = b * bw
        const wx = x + 10, wy = y + 7, ww = bw - 20, wh = fh - 17
        const grad = g.createLinearGradient(0, wy, 0, wy + wh); grad.addColorStop(0, '#6f8494'); grad.addColorStop(1, '#4d5d6a')
        g.fillStyle = grad; g.fillRect(wx, wy, ww, wh)
        g.fillStyle = '#efe8dc'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh)
        if (rnd() < 0.35) { g.fillStyle = 'rgba(240,232,214,0.75)'; g.fillRect(wx, wy, ww, wh * (0.3 + rnd() * 0.5)) }
        // Balcony rail on alternate bays.
        if ((b + f) % 2 === 0) { g.fillStyle = 'rgba(60,64,70,0.55)'; g.fillRect(x + 4, y + fh - 12, bw - 8, 7) }
        if (rnd() < 0.42) { ge.fillStyle = rnd() < 0.5 ? '#ffd9a0' : '#ffe9c8'; ge.fillRect(wx, wy, ww, wh) }
      }
    }
  } else {
    // Curtain wall: spandrel band per floor, glass with a sky sheen, thin mullions.
    const frame = kind === 'bronze' ? '#6b5a44' : '#8d979f'
    g.fillStyle = frame; g.fillRect(0, 0, W, H)
    for (let f = 0; f < TILE_FLOORS; f++) {
      const y = f * fh
      g.fillStyle = kind === 'bronze' ? '#5a4a36' : '#6f7a84'; g.fillRect(0, y + fh - 7, W, 7)
      for (let b = 0; b < TILE_BAYS; b++) {
        for (let p = 0; p < 2; p++) {
          const x = b * bw + p * (bw / 2) + 1.5
          const pw = bw / 2 - 3, ph = fh - 9
          const grad = g.createLinearGradient(x, y, x + pw * 0.6, y + ph)
          if (kind === 'bronze') { grad.addColorStop(0, '#a08868'); grad.addColorStop(1, '#5e4c38') }
          else { grad.addColorStop(0, '#c7d6e2'); grad.addColorStop(0.55, '#8ea3b4'); grad.addColorStop(1, '#6a7f90') }
          g.fillStyle = grad; g.fillRect(x, y + 1, pw, ph)
          if (rnd() < 0.18) { g.fillStyle = 'rgba(235,238,240,0.55)'; g.fillRect(x, y + 1, pw, ph * (0.25 + rnd() * 0.5)) }
          if (rnd() < 0.36) { ge.fillStyle = rnd() < 0.6 ? '#fff1d6' : '#d8ecff'; ge.fillRect(x, y + 1, pw, ph) }
        }
      }
      // Whole office floors lit together now and then.
      if (rnd() < 0.12) { ge.fillStyle = 'rgba(255,240,214,0.9)'; ge.fillRect(0, y + 1, W, fh - 9) }
    }
  }
  const out = [a, e].map((c, i) => {
    const t = new THREE.CanvasTexture(c)
    if (i === 0) t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 4
    return t
  })
  return { map: out[0]!, glow: out[1]! }
}

/** Lay the façade in world units: floors by height, bays along each wall; roofs plain; a lobby at street level. */
function worldFacade(mat: THREE.MeshStandardMaterial, lobby: string): void {
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGdW;\nvarying vec3 vGdN;')
      .replace('#include <project_vertex>', `#include <project_vertex>
  vec4 gdW = vec4(transformed, 1.0);
  vec3 gdN = objectNormal;
  #ifdef USE_INSTANCING
    gdW = instanceMatrix * gdW;
    gdN = mat3(instanceMatrix) * gdN;
  #endif
  vGdW = (modelMatrix * gdW).xyz;
  vGdN = normalize(mat3(modelMatrix) * gdN);`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vGdW;
varying vec3 vGdN;
vec2 gdUv() {
  if (abs(vGdN.y) > 0.6) return vec2(0.003, 0.003);
  vec3 tng = normalize(vec3(-vGdN.z, 0.0, vGdN.x));
  return vec2(dot(vGdW, tng) / ${(BAY * TILE_BAYS).toFixed(2)}, vGdW.y / ${(FLOOR * TILE_FLOORS).toFixed(2)});
}`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
  vec4 gdTex = texture2D(map, gdUv());
  if (abs(vGdN.y) < 0.6 && vGdW.y < 4.2) gdTex.rgb = mix(gdTex.rgb, ${lobby}, 0.75);
  diffuseColor *= gdTex;
#endif`)
      .replace('#include <emissivemap_fragment>', `#ifdef USE_EMISSIVEMAP
  vec3 gdGlow = texture2D(emissiveMap, gdUv()).rgb;
  if (abs(vGdN.y) > 0.6) gdGlow = vec3(0.0);
  if (vGdW.y < 4.2 && abs(vGdN.y) < 0.6) gdGlow = vec3(1.0, 0.86, 0.62) * 0.8;
  totalEmissiveRadiance *= gdGlow;
#endif`)
  }
  mat.customProgramCacheKey = () => `gd-facade-${lobby}`
}

export function createSkyline(scene: THREE.Scene, graphics: Graphics) {
  const count = graphics === 'high' ? 56 : graphics === 'medium' ? 42 : 26
  const kinds = ['glass', 'stone', 'bronze'] as const
  const mats = kinds.map((k, i) => {
    const t = facade(k, 11 + i * 97)
    const m = new THREE.MeshStandardMaterial({
      color: 0xffffff, map: t.map, emissive: 0xffffff, emissiveMap: t.glow, emissiveIntensity: 0.02,
      roughness: k === 'stone' ? 0.85 : 0.35, metalness: k === 'stone' ? 0 : 0.35, envMapIntensity: k === 'stone' ? 0.3 : 0.9, fog: true,
    })
    worldFacade(m, k === 'stone' ? 'vec3(0.32, 0.30, 0.28)' : 'vec3(0.16, 0.19, 0.22)')
    return m
  })
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f969c, roughness: 0.9 })
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x9aa1a7, roughness: 0.8, metalness: 0.2 })
  const spireMat = new THREE.MeshStandardMaterial({ color: 0xd8dde2, roughness: 0.25, metalness: 0.9 })
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff2030, toneMapped: false })
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  // Per kind: tower bodies (base + setbacks share one mesh).
  const bodies = mats.map((m) => new THREE.InstancedMesh(box, m, count * 3))
  const used = [0, 0, 0]
  const parapets = new THREE.InstancedMesh(box, roofMat, count * 2)
  const plant = new THREE.InstancedMesh(box, plantMat, count * 3)
  const spires = new THREE.InstancedMesh(new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0), spireMat, count)
  const beacons = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 6, 4), beaconMat, count)
  let nPar = 0, nPlant = 0, nSpire = 0
  const tints: Record<(typeof kinds)[number], number[]> = {
    glass: [0xe9f0f6, 0xd9ece9, 0xdfe5ee, 0xc9d9ea, 0xeef1f3],
    stone: [0xffffff, 0xf3ebe0, 0xe8e2da, 0xf6efe6],
    bronze: [0xffffff, 0xf0e2cf, 0xe6d6c0],
  }
  const m = new THREE.Object3D()
  const c = new THREE.Color()
  let rnd = 7
  const rand = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647)
  // Keep towers off the metro viaduct and out of the airport and Grind Park grounds.
  const line = new THREE.CatmullRomCurve3(CTRL.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal')
  const linePts = line.getSpacedPoints(Math.round(line.getLength() / 4))
  const grounds: Array<[number, number, number, number]> = [[130, -70, 340, 70], [-212, 96, -104, 210]]
  const blocked = (x: number, z: number, rad: number) =>
    linePts.some((p) => Math.hypot(p.x - x, p.z - z) < rad + 5) || grounds.some(([x0, z0, x1, z1]) => x > x0 - rad && x < x1 + rad && z > z0 - rad && z < z1 + rad)
  let skip = false
  const put = (kind: number, x: number, y: number, z: number, w: number, h: number, d: number, a: number, tint: number) => {
    if (skip) return
    const k = used[kind]!++
    m.position.set(x, y, z); m.rotation.set(0, -a, 0); m.scale.set(w, h, d); m.updateMatrix()
    bodies[kind]!.setMatrixAt(k, m.matrix)
    bodies[kind]!.setColorAt(k, c.setHex(tint))
  }
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rand() * 0.05
    // North of the city is the beach and the sea: those towers stand across the bay instead.
    const rr = rand(), north = Math.sin(a) < -0.5
    const r = north ? 330 + rr * 120 : 104 + rr * 36
    const x = Math.cos(a) * r, z = Math.sin(a) * r
    const roll = rand()
    const kind = roll < 0.55 ? 0 : roll < 0.82 ? 1 : 2
    const tint = tints[kinds[kind]!][Math.floor(rand() * tints[kinds[kind]!].length)]!
    // Whole numbers of bays and floors, so windows meet the corners and the roof cleanly.
    const w = BAY * (3 + Math.floor(rand() * 4)), d = BAY * (3 + Math.floor(rand() * 4))
    skip = blocked(x, z, Math.hypot(w, d) / 2)
    const tall = rand()
    const floors = kind === 1 ? 6 + Math.floor(tall * 14) : 6 + Math.floor(tall * tall * 24)
    const h = floors * FLOOR
    put(kind, x, 0, z, w, h, d, a, tint)
    let top = h, tw = w, td = d
    // One or two setbacks on the taller towers.
    if (floors > 14) {
      const f2 = 3 + Math.floor(rand() * Math.min(10, floors * 0.4))
      tw = Math.max(BAY * 2, w - BAY * (1 + Math.floor(rand() * 2))); td = Math.max(BAY * 2, d - BAY * (1 + Math.floor(rand() * 2)))
      put(kind, x, top, z, tw, f2 * FLOOR, td, a, tint)
      top += f2 * FLOOR
      if (floors > 22 && rand() < 0.6) {
        const f3 = 2 + Math.floor(rand() * 5)
        tw = Math.max(BAY * 2, tw - BAY * 2); td = Math.max(BAY * 2, td - BAY * 2)
        put(kind, x, top, z, tw, f3 * FLOOR, td, a, tint)
        top += f3 * FLOOR
      }
    }
    // Parapet and roof, plant boxes, a spire and an aviation light on the tallest.
    if (!skip) { m.position.set(x, top, z); m.rotation.set(0, -a, 0); m.scale.set(tw + 0.3, 0.9, td + 0.3); m.updateMatrix(); parapets.setMatrixAt(nPar++, m.matrix) }
    for (let k = 0; k < 2; k++) {
      m.position.set(x + (rand() - 0.5) * tw * 0.4, top + 0.9, z + (rand() - 0.5) * td * 0.4); m.scale.set(2 + rand() * 3, 1.2 + rand() * 2, 2 + rand() * 3); m.updateMatrix()
      if (!skip) plant.setMatrixAt(nPlant++, m.matrix)
    }
    if (top > 60 && kind !== 1) {
      const sh = 8 + rand() * 18
      if (skip) continue
      m.position.set(x, top + 0.9, z); m.rotation.set(0, 0, 0); m.scale.set(1.4, sh, 1.4); m.updateMatrix(); spires.setMatrixAt(nSpire, m.matrix)
      m.position.set(x, top + 0.9 + sh, z); m.scale.setScalar(0.9); m.updateMatrix(); beacons.setMatrixAt(nSpire, m.matrix)
      nSpire++
    }
  }
  bodies.forEach((b, i) => { b.count = used[i]!; if (b.instanceColor) b.instanceColor.needsUpdate = true })
  parapets.count = nPar; plant.count = nPlant; spires.count = nSpire; beacons.count = nSpire
  for (const mesh of [...bodies, parapets, plant, spires, beacons]) {
    mesh.computeBoundingSphere()
    mesh.castShadow = false
    mesh.receiveShadow = false
    mesh.userData.ghost = true
    mesh.raycast = () => undefined
    scene.add(mesh)
  }
  return {
    tick(t: number, night: number) {
      for (const mt of mats) mt.emissiveIntensity = 0.01 + night * 0.32
      beacons.visible = Math.sin(t * 2.4) > 0.2 && night > 0.2
    },
  }
}
