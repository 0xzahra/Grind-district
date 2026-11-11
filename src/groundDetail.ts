// Real ground: the city's painted ground map decides WHAT is where (plaza, roads, lawn, crossings); this adds
// what it is made of. Photographed stone slabs, asphalt and grass (Poly Haven, CC0) tile in world space and
// are multiplied over the painted colour, each divided by its own average so brightness and layout stay put.
// Three small textures and one extra texture read per pixel on the ground only.
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
        float road = (1.0 - smoothstep(0.05, 0.1, dot(base, vec3(0.299, 0.587, 0.114)))) * (1.0 - turf);
        vec3 pave = texture2D(tPave, vGroundXZ / 3.2).rgb * ${inv(MEAN.pave)};
        vec3 tar = texture2D(tRoad, vGroundXZ / 5.0).rgb * ${inv(MEAN.road)};
        vec3 grass = texture2D(tTurf, vGroundXZ / 3.6).rgb * ${inv(MEAN.turf)};
        diffuseColor.rgb = base * mix(mix(pave, tar, road), grass, turf);
      }`)
  }
  mat.customProgramCacheKey = () => 'ground-detail'
}
