import * as THREE from 'three'

/** Security drones high over the city: slow orbits, blinking nav lights, a scan cone that tracks the player. Visual only. */
export function createWatch(scene: THREE.Scene, count: number) {
  const body = new THREE.MeshStandardMaterial({ color: 0x15181a, roughness: 0.35, metalness: 0.8 })
  const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a })
  const green = new THREE.MeshBasicMaterial({ color: 0x17f790 })
  const cone = new THREE.MeshBasicMaterial({
    color: 0x45eb98, transparent: true, opacity: 0.02, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  })
  const hull = new THREE.BoxGeometry(1.4, 0.32, 0.9)
  const arm = new THREE.BoxGeometry(2.6, 0.08, 0.12)
  const dot = new THREE.SphereGeometry(0.09, 6, 4)
  const beamGeo = new THREE.ConeGeometry(3.2, 1, 18, 1, true).translate(0, -0.5, 0).rotateX(-Math.PI / 2)
  const drones = Array.from({ length: count }, (_, i) => {
    const g = new THREE.Group()
    g.add(new THREE.Mesh(hull, body))
    const a1 = new THREE.Mesh(arm, body); a1.rotation.y = Math.PI / 4; g.add(a1)
    const a2 = new THREE.Mesh(arm, body); a2.rotation.y = -Math.PI / 4; g.add(a2)
    const l = new THREE.Mesh(dot, red); l.position.set(-0.75, 0, 0); g.add(l)
    const r = new THREE.Mesh(dot, green); r.position.set(0.75, 0, 0); g.add(r)
    const beam = new THREE.Mesh(beamGeo, cone)
    beam.frustumCulled = false
    g.add(beam)
    scene.add(g)
    return { g, l, r, beam, radius: 30 + i * 18, speed: 0.05 - i * 0.012, phase: i * 2.1, h: 26 + i * 4 }
  })
  const target = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  return {
    tick(t: number, player: THREE.Vector3, night: number) {
      cone.opacity = 0.012 + night * 0.028
      for (const d of drones) {
        const a = t * d.speed + d.phase
        d.g.position.set(Math.cos(a) * d.radius, d.h + Math.sin(t * 0.7 + d.phase) * 0.5, Math.sin(a) * d.radius)
        d.g.rotation.y = -a
        const blink = Math.sin(t * 5 + d.phase) > 0.6
        d.l.visible = blink
        d.r.visible = !blink
        // Track the player when within range, otherwise sweep the street below.
        tmp.copy(player).sub(d.g.position)
        const close = tmp.length() < 70
        target.set(close ? player.x : d.g.position.x + Math.cos(t * 0.4) * 8, 0, close ? player.z : d.g.position.z + Math.sin(t * 0.4) * 8)
        d.beam.lookAt(target)
        const len = d.g.position.distanceTo(target)
        d.beam.scale.set(1, 1, len)
      }
    },
  }
}
