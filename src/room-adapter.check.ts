import * as THREE from 'three'
import { buildRoom, RoomSession, ROOM_TYPES } from './room-adapter.ts'
import { blocked, resolveCollision } from './physics.ts'
import { SceneGate } from './scene-gate.ts'
import { COURSES } from './courses.ts'
import { documents, SKILL_META } from './logic.ts'
import { loadSave, startCourse, submitCourse, getSave } from './state.ts'
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } })
loadSave('low')
for (const [id, kind] of Object.entries(ROOM_TYPES)) {
  const street = { id, x: 3, z: 12, r: 2, title: id, body: '', action: kind === 'campus' ? 'learn' as const : 'house' as const, house: undefined }
  const room = buildRoom(kind, street)
  const session = new RoomSession()
  const outside = { x: 3, z: 12 }
  const spawn = session.enter(room, outside)
  outside.x = 99
  check(!blocked(room.obstacles, spawn.x, spawn.z, 0.42, true), `${kind}: spawn clear`)
  for (const use of room.uses) check(!blocked(room.obstacles, use.x, use.z, 0.42, true), `${kind}: ${use.id} clear`)
  for (let z = spawn.z; z <= room.uses[0]!.z; z += 0.1) check(!blocked(room.obstacles, room.origin.x, z, 0.42, true), `${kind}: central exit aisle clear`)
  check(session.cityPosition(spawn).x === 3 && session.cityPosition(spawn).z === 12, 'persistence and presence use copied street position, not indoor coordinates')
  const p = { ...spawn }; resolveCollision(p, { x: 0, z: 0 }, room.obstacles, 0.42, true)
  check(p.x === spawn.x && p.z === spawn.z, 'indoor collision never city-clamps spawn')
  let meshes = 0
  room.group.traverse((object) => { if (object instanceof THREE.Mesh) meshes++ })
  check(meshes < 120, `${kind}: modest mesh budget`)
  for (const detail of room.decor) detail.traverse((object) => check(!object.userData.essential && !object.userData.tapUse && !object.userData.tapGround, 'decor collection excludes furniture, floor and interactions'))
  const gate = new SceneGate(); const before = JSON.stringify(p)
  gate.advance(true, () => { p.x++ })
  check(JSON.stringify(p) === before, 'room state respects paused scene gate')
  if (kind === 'home') {
    for (const name of ['bed', 'work-desk', 'chair', 'bookcase', 'sofa']) check((room.group.getObjectByName(name)?.children.length ?? 0) >= 4, `recognizable composite ${name}`)
  }
  if (kind === 'campus') {
    check(room.uses[1]?.action === 'learn', 'learning lectern opens current course UI')
    const course = COURSES[0]!
    startCourse(course.id)
    check(submitCourse(course.id, course.questions.map(q => q.answer)).ok, 'course completes in room session')
    check(documents(getSave()).cv.includes(SKILL_META[course.id].cv), 'room session keeps earned CV')
  }
  const out = session.exit()
  check(out?.x === 3 && out.z === 12 && session.room === null, 'exit returns to original street position')
  check(session.cityPosition({ x: 9, z: 8 }).x === 9, 'street persistence resumes after exit')
}
loadSave('low')
check(getSave().skills.spot?.passed, 'earned learning progress persists after room round trip')
console.log('room geometry, clearances, navigation and state checks passed')
