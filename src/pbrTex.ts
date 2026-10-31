import * as THREE from 'three'

// Shared, cached loader for CC0 Poly Haven PBR sets packed to 512 px WebP (see CREDITS.md).
const loader = new THREE.TextureLoader()
const cache = new Map<string, THREE.Texture>()
export function pbrSet(name: string, repeat = 2, anisotropy = 4) {
  const load = (ch: string, srgb: boolean) => {
    const key = `${name}_${ch}_${repeat}`
    let t = cache.get(key)
    if (!t) {
      t = loader.load(`/tex/${name}_${ch}.webp`)
      t.wrapS = t.wrapT = THREE.RepeatWrapping
      t.repeat.set(repeat, repeat)
      t.anisotropy = anisotropy
      if (srgb) t.colorSpace = THREE.SRGBColorSpace
      cache.set(key, t)
    }
    return t
  }
  return { map: load('diff', true), normalMap: load('nor_gl', false), roughnessMap: load('rough', false) }
}
