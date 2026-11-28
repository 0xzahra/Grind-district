// Real ground: the city's painted ground map decides WHAT is where (plaza, roads, lawn, crossings); this adds
// what it is made of. Photographed stone slabs, asphalt and grass (Poly Haven, CC0) tile in world space and
// are multiplied over the painted colour, each divided by its own average so brightness and layout stay put.
// Three small textures and one extra texture read per pixel on the ground only. Interlock pavers (the aprons round
// buildings and the district forecourts) are drawn from the painted colour alone, with no texture.
export const INTERLOCK = '#bb6f50' // terracotta field
export const INTERLOCK_EDGE = '#a65a40' // darker soldier course along the edges (light enough not to read as asphalt)
import * as THREE from 'three'

// Linear averages printed by tools/pack-nature.mjs.
const MEAN = { pave: [0.441, 0.34, 0.194], road: [0.104, 0.102, 0.091], turf: [0.311, 0.23, 0.101] } as const

export function groundDetail(mat: THREE.MeshStandardMaterial, anisotropy: number): void {
  const loader = new THREE.TextureLoader()
  const slot = (file: string, mean: readonly number[]) => {
    // Until the photograph arrives the slot holds its own average colour, so the ground never flashes dark.
    const toByte = (x: number) => Math.round(255 * (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055))
    const flat = new THREE.DataTexture(new Uint8Array([toByte(mean[0]!), toByte(mean[1]!), toByte(mean[2]!), 255]), 1, 1)
    flat.colorSpace = THREE.SRGBColorSpace
    flat.needsUpdate = true
    const u = { value: flat as THREE.Texture }
    loader.load(file, (t) => { t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; u.value = t; flat.dispose() })
    return u
  }
  const uniforms = { tPave: slot('/tex/surf/stone_d.webp', MEAN.pave), tRoad: slot('/tex/nature/asphalt.webp', MEAN.road), tTurf: slot('/tex/nature/grass.webp', MEAN.turf) }
  const inv = (m: readonly number[]) => `vec3(${m.map((x) => (1 / x).toFixed(4)).join(', ')})`
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tPave;\nuniform sampler2D tRoad;\nuniform sampler2D tTurf;\nvarying vec2 vGroundXZ;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        // What the painted map says is here: green is lawn, near-black is asphalt, everything else is paving.
        vec3 base = diffuseColor.rgb;
        float turf = smoothstep(0.012, 0.05, base.g - max(base.r, base.b));
        float road = (1.0 - smoothstep(0.085, 0.15, dot(base, vec3(0.299, 0.587, 0.114)))) * (1.0 - turf);
        vec3 pave = texture2D(tPave, vGroundXZ / 3.2).rgb * ${inv(MEAN.pave)};
        // The asphalt photo is flattened and mixed lightly: grain stays, cracks and oil stains do not blotch the roads.
        vec3 tar = mix(vec3(1.0), texture2D(tRoad, vGroundXZ / 5.0).rgb * ${inv(MEAN.road)}, 0.4);
        vec3 grass = texture2D(tTurf, vGroundXZ / 3.6).rgb * ${inv(MEAN.turf)};
        vec3 laid = base * mix(mix(pave, tar, road), grass, turf);
        // Interlock: ground painted a terracotta hue (red well above green, whatever its shading) is laid as
        // herringbone pavers, 20 x 10 cm, with sand joints. Cells of 10 cm pair up into bricks: along a row the
        // pattern runs flat, flat, upright, upright, and each row steps one cell over (mod(i - j, 4)).
        float hue = (base.r - base.g) / max(base.r, 0.02);
        float brick = smoothstep(0.45, 0.6, hue) * (1.0 - road) * (1.0 - turf);
        vec2 hp = vGroundXZ / 0.1;
        vec2 cell = floor(hp), f = fract(hp);
        float t = mod(cell.x - cell.y, 4.0);
        // Joints on this cell's left, right, near and far edges (the edge it shares with its own brick has none).
        vec4 e = t < 0.5 ? vec4(1.0, 0.0, 1.0, 1.0) : t < 1.5 ? vec4(0.0, 1.0, 1.0, 1.0) : t < 2.5 ? vec4(1.0, 1.0, 0.0, 1.0) : vec4(1.0, 1.0, 1.0, 0.0);
        vec2 fw = max(fwidth(hp), vec2(1e-4));
        float jw = 0.07;
        float joint = max(
          max(e.x * (1.0 - smoothstep(jw, jw + fw.x, f.x)), e.y * (1.0 - smoothstep(jw, jw + fw.x, 1.0 - f.x))),
          max(e.z * (1.0 - smoothstep(jw, jw + fw.y, f.y)), e.w * (1.0 - smoothstep(jw, jw + fw.y, 1.0 - f.y))));
        // Seen from far away the joints are finer than a pixel: fade them rather than shimmer.
        joint *= 1.0 - smoothstep(0.18, 0.45, max(fw.x, fw.y));
        vec2 anchor = cell + vec2(t > 0.5 && t < 1.5 ? -1.0 : 0.0, t > 2.5 ? 1.0 : 0.0);
        float shade = 0.86 + 0.22 * fract(sin(dot(anchor, vec2(12.9898, 78.233))) * 43758.5453);
        vec3 paver = base * shade * mix(vec3(1.0), pave, 0.35);
        vec3 sand = vec3(dot(base, vec3(0.299, 0.587, 0.114))) * vec3(1.5, 1.38, 1.18);
        diffuseColor.rgb = mix(laid, mix(paver, sand, joint), brick);
      }`)
  }
  mat.customProgramCacheKey = () => 'ground-detail'
}
