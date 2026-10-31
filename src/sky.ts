import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'

// Physical (Preetham) sky. Replaces the gradient dome; driven by the day clock (0 midnight, 0.5 noon).
export function createPhysicalSky(scene: THREE.Scene) {
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh && m.material instanceof THREE.ShaderMaterial && m.geometry instanceof THREE.SphereGeometry && m.geometry.parameters.radius === 200) m.visible = false
  })
  const sky = new Sky()
  sky.scale.setScalar(240)
  sky.userData.ghost = true
  sky.raycast = () => undefined
  sky.renderOrder = -2
  const mat = sky.material as THREE.ShaderMaterial
  mat.fog = false
  const u = mat.uniforms as Record<string, { value: number | THREE.Vector3 }>
  u.turbidity!.value = 6
  u.rayleigh!.value = 1.6
  u.mieCoefficient!.value = 0.004
  u.mieDirectionalG!.value = 0.85
  scene.add(sky)
  const sunDir = new THREE.Vector3()
  return {
    sky,
    sunDir,
    setPhase(phase: number, follow?: THREE.Vector3) {
      const elev = Math.sin((phase - 0.25) * Math.PI * 2) * (Math.PI / 2.3)
      const az = Math.PI * 0.85 + (phase - 0.5) * Math.PI
      sunDir.setFromSphericalCoords(1, Math.PI / 2 - elev, az)
      ;(u.sunPosition!.value as THREE.Vector3).copy(sunDir)
      // Night: dim the scattering so the sky goes deep blue-black instead of grey.
      const night = THREE.MathUtils.clamp(-elev * 3, 0, 1)
      u.rayleigh!.value = 1.6 - night * 1.5
      if (follow) sky.position.copy(follow)
    },
  }
}
