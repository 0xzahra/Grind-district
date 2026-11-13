import * as THREE from 'three'

// Profile portrait: renders the player's own current avatar (full body, face to camera) into an
// offscreen target under a clean studio light, then returns a PNG data URL. One render on demand, never per frame.
/** Full-body portrait (profile), or with `head` a head-and-shoulders shot (Zahra's face on her card). */
export function createPortrait(renderer: THREE.WebGLRenderer, getObject: () => THREE.Object3D, opts: { w?: number; h?: number; head?: boolean; headY?: number } = {}) {
  const W = opts.w ?? 360
  const H = opts.h ?? 600
  const studio = new THREE.Scene()
  const key = new THREE.DirectionalLight(0xfff4e8, 1.6)
  key.position.set(1.6, 3, 3)
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.7)
  rim.position.set(-2, 2.5, -2.5)
  studio.add(key, rim, new THREE.HemisphereLight(0xf2f0ee, 0x3a332c, 0.9))
  const camera = new THREE.PerspectiveCamera(26, W / H, 0.05, 50)
  const box = new THREE.Box3()
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  return (): string | null => {
    const obj = getObject()
    const parent = obj.parent
    const pos = obj.position.clone()
    const quat = obj.quaternion.clone()
    const target = new THREE.WebGLRenderTarget(W, H, { samples: 0 })
    const prevTarget = renderer.getRenderTarget()
    const prevExposure = renderer.toneMappingExposure
    const prevClear = renderer.getClearColor(new THREE.Color())
    const prevAlpha = renderer.getClearAlpha()
    const env = studio.environment
    // The avatar root never turns in the city: the body inside it does (it faces wherever the player last
    // walked). Zero that inner turn for the shot, or the portrait shows whichever side happens to face +z,
    // often the back.
    const inner = obj.children.map((child) => ({ child, yaw: child.rotation.y }))
    try {
      studio.add(obj)
      obj.position.set(0, 0, 0)
      obj.quaternion.identity()
      for (const { child } of inner) child.rotation.y = 0 // rig faces +z: toward the camera
      obj.updateMatrixWorld(true)
      box.setFromObject(obj)
      box.getSize(size)
      box.getCenter(center)
      // headY: the head's height in the figure (a name tag above the head would throw off the bounding box).
      if (opts.head) center.y = opts.headY ?? box.max.y - size.y * 0.115
      const h = opts.head ? (opts.headY ? opts.headY * 0.27 : size.y * 0.25) : Math.max(size.y, 0.5) * 1.12
      const dist = h / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      camera.position.set(center.x + dist * (opts.head ? 0.22 : 0.18), center.y + h * (opts.head ? 0.08 : 0.04), center.z + dist)
      camera.lookAt(center.x, center.y, center.z)
      studio.environment = parent instanceof THREE.Scene ? parent.environment : env
      studio.environmentIntensity = 0.35
      renderer.toneMappingExposure = 1.0
      renderer.setRenderTarget(target)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()
      renderer.render(studio, camera)
      const px = new Uint8Array(W * H * 4)
      renderer.readRenderTargetPixels(target, 0, 0, W, H, px)
      const canvas = document.createElement('canvas')
      canvas.width = W
      canvas.height = H
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      const img = ctx.createImageData(W, H)
      for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4)
      ctx.putImageData(img, 0, 0)
      return canvas.toDataURL('image/png')
    } catch {
      return null
    } finally {
      studio.environment = env
      for (const { child, yaw } of inner) child.rotation.y = yaw
      parent?.add(obj)
      obj.position.copy(pos)
      obj.quaternion.copy(quat)
      obj.updateMatrixWorld(true)
      renderer.setRenderTarget(prevTarget)
      renderer.setClearColor(prevClear, prevAlpha)
      renderer.toneMappingExposure = prevExposure
      target.dispose()
    }
  }
}
