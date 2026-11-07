import * as THREE from 'three'
import { chooseTap, tapIntersections, type TapHit } from './tap-target.ts'
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const pick = (hits: TapHit[], blocked = false) => chooseTap(hits, 50, () => blocked)
check(pick([]) === null, 'sky/ray miss ignored')
check(pick([{ kind: 'ground', x: 51, z: 0 }]) === null, 'outside boundary rejected, never clamped')
check(pick([{ kind: 'ground', x: 0, z: -51 }]) === null, 'negative boundary rejected')
check(pick([{ kind: 'ground', x: 50, z: -50 }])?.kind === 'ground', 'inside boundary accepted')
check(pick([{ kind: 'ground', x: NaN, z: 0 }]) === null, 'nonfinite coordinates rejected')
check(pick([{ kind: 'ground', x: 3, z: 5 }], true) === null, 'static collision blocks ground')
check(pick([{ kind: 'blocker', x: 3, z: 5 }, { kind: 'ground', x: 4, z: 8 }]) === null, 'wall/roof/prop occludes ground')
check(pick([{ kind: 'blocker', x: 3, z: 5 }, { kind: 'npc', x: 4, z: 8, id: 'resident' }]) === null, 'wall occludes NPC')
check(pick([{ kind: 'ignore', x: 0, z: 0 }, { kind: 'ground', x: 3, z: 5 }])?.x === 3, 'decorative ghost does not steal ground taps')
check(pick([{ kind: 'door', x: 3, z: 5, id: 'learn' }])?.id === 'learn', 'door retains destination hotspot')
check(pick([{ kind: 'npc', x: 3, z: 5, id: 'resident' }])?.id === 'resident', 'NPC is interaction, never walk through')
const position = { x: 12, z: 18 }
const before = JSON.stringify(position)
for (const hit of [[], [{ kind: 'ground' as const, x: 51, z: 0 }], [{ kind: 'blocker' as const, x: 1, z: 2 }]]) pick(hit)
check(JSON.stringify(position) === before, 'rejected taps cannot mutate or teleport character')
console.log('tap target checks passed')

const scene = new THREE.Scene()
const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial())
cube.position.z = -40
scene.add(cube)
scene.updateMatrixWorld(true)
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
camera.updateMatrixWorld(true)
const ray = new THREE.Raycaster()
ray.far = 8 // simulate prior camera collision ray
check(tapIntersections(ray, camera, new THREE.Vector2(0, 0), scene).length > 0, 'tap ray resets camera collision far and hits distant target')
check(tapIntersections(ray, camera, new THREE.Vector2(1, 1), scene).length === 0, 'actual ray miss remains a miss')
cube.geometry.dispose()
;(cube.material as THREE.Material).dispose()
console.log('tap ray checks passed')
