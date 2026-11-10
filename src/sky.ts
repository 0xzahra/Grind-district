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
  // Calm horizon (no white band glowing behind the buildings) and soft painted clouds that drift with the
  // sky itself: no billboards, so nothing in the sky reads as a flat card moving about.
  mat.uniforms.cloudTime = { value: 0 }
  mat.uniforms.gdDay = { value: 1 }
  mat.fragmentShader = mat.fragmentShader
    .replace('void main() {', `uniform float cloudTime;
		uniform float gdDay;
		float gdHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
		float gdNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
			return mix(mix(gdHash(i), gdHash(i + vec2(1.0, 0.0)), f.x), mix(gdHash(i + vec2(0.0, 1.0)), gdHash(i + vec2(1.0, 1.0)), f.x), f.y); }
		void main() {`)
    .replace('gl_FragColor = vec4( texColor, 1.0 );', `// Daytime: lean on a designed gradient (soft blue overhead, pale warm haze at the horizon) so the sky is
			// never a white glare behind the roofs; dawn, dusk and night keep the scattering colours.
			vec3 gdSky = mix(vec3(0.52, 0.59, 0.66), vec3(0.27, 0.43, 0.68), smoothstep(-0.02, 0.5, direction.y));
			texColor = mix(texColor, gdSky, 0.8 * gdDay);
			vec2 gdP = direction.xz / max(direction.y, 0.08) * 0.55 + vec2(cloudTime * 0.006, cloudTime * 0.002);
			float gdN = gdNoise(gdP) * 0.55 + gdNoise(gdP * 2.3 + 7.1) * 0.3 + gdNoise(gdP * 5.1 + 3.7) * 0.15;
			float gdC = smoothstep(0.56, 0.82, gdN) * smoothstep(0.03, 0.22, direction.y) * (1.0 - smoothstep(0.55, 0.95, direction.y));
			float gdL = dot(texColor, vec3(0.299, 0.587, 0.114));
			texColor = mix(texColor, vec3(gdL) * vec3(1.32, 1.3, 1.26) + texColor * 0.12, gdC * 0.72);
			gl_FragColor = vec4( texColor, 1.0 );`)
  const u = mat.uniforms as Record<string, { value: number | THREE.Vector3 }>
  u.turbidity!.value = 1.9
  u.rayleigh!.value = 2.1
  u.mieCoefficient!.value = 0.0016
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
      u.rayleigh!.value = 2.1 - night * 1.9
      u.cloudTime!.value = performance.now() / 1000
      u.gdDay!.value = THREE.MathUtils.smoothstep(Math.sin(elev), 0.12, 0.5)
      if (follow) sky.position.copy(follow)
    },
  }
}
