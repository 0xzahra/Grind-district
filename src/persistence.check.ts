import { SAVE_KEY, documents, SKILL_META, TINTS } from './logic.ts'
import { COURSES } from './courses.ts'
import { loadSave, getSave, signUp, attachPrivy, submitCourse, buyDrone, setMask, setTint, setVolume, rememberPlace, tickMarket, localSaveMessage } from './state.ts'
import { RoomSession, buildRoom } from './room-adapter.ts'
const store = new Map<string, string>()
let failRead = false, failWrite = false
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem(key: string) { if (failRead) throw new Error('denied'); return store.get(key) ?? null },
  setItem(key: string, value: string) { if (failWrite) throw new Error('quota'); store.set(key, value) },
} })
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
failWrite = true
loadSave('low')
check(signUp('Memory Tester', 'memorytester', 'player').ok && getSave().signedUp, 'write-refused onboarding keeps playable in-memory identity')
check(!store.has(SAVE_KEY) && localSaveMessage().includes('refused'), 'fresh private-mode session does not claim a durable save')
failWrite = false
loadSave('low')
check(signUp('Save Tester', 'savetester', 'zuri').ok, 'guest signup')
const course = COURSES.find(c => c.id === 'spot')!
check(submitCourse(course.id, course.questions.map(q => q.answer)).ok, 'course earns progress')
check(buyDrone('scout').ok, 'earned practice stipend buys real existing inventory')
setMask('punk'); setTint(TINTS[1]!.hex); rememberPlace(3, 12)
const before = structuredClone(getSave())
loadSave('high')
check(getSave().signedUp && getSave().name === 'Save Tester' && getSave().username === 'savetester' && getSave().body === 'zuri', 'guest identity and selected body survive reload')
check(getSave().xp === before.xp && getSave().skills.spot?.passed, 'XP/course survive real serialize/hydrate reload')
check(documents(getSave()).cv.includes(SKILL_META.spot.cv), 'CV derived from recovered skills')
check(getSave().ownedDrones.includes('scout') && getSave().drone === 'scout' && getSave().mask === 'punk' && getSave().tint === TINTS[1]!.hex, 'inventory/equipped cosmetics survive reload')
check(getSave().ledger === before.ledger && getSave().graphics === 'low', 'practice ledger and preference survive reload')
check(getSave().activities.length === before.activities.length, 'activity history survives reload')
check(!submitCourse(course.id, course.questions.map(q => q.answer)).ok && getSave().xp === before.xp, 'reload cannot duplicate course XP')
const session = new RoomSession()
const room = buildRoom('campus', { id: 'learn', x: 3, z: 12, r: 2, title: 'Learn', body: '', action: 'learn' })
const spawn = session.enter(room, { x: 3, z: 12 })
const remembered = session.cityPosition(spawn)
rememberPlace(remembered.x, remembered.z)
loadSave('low')
check(getSave().posX === 3 && getSave().posZ === 12, 'reload while indoors resumes original street, never indoor coordinates')
check(session.exit()?.x === 3, 'room exit preserves street return')
check(attachPrivy('did:privy:test_account_a').ok, 'guest can attach first Privy identity locally')
check(getSave().xp === before.xp && getSave().skills.spot?.passed && getSave().ownedDrones.includes('scout'), 'local guest link retains progress, not a fresh account overwrite')
loadSave('low')
check(attachPrivy('did:privy:test_account_a').ok, 'same identity remains accepted after reload')
const linked = store.get(SAVE_KEY)
check(!attachPrivy('did:privy:test_account_b').ok && !attachPrivy('invalid').ok, 'different/invalid identity rejected, not merged')
check(store.get(SAVE_KEY) === linked, 'rejected account switch does not rewrite save')
failWrite = true
setVolume(23)
check(getSave().volume === 23 && store.get(SAVE_KEY) === linked, 'failed write keeps session progress and previous durable save')
check(localSaveMessage().includes('refused'), 'write failure is distinguishable from saved')
failWrite = false
setVolume(23)
loadSave('low')
check(getSave().volume === 23 && localSaveMessage().includes('Saved on this browser only'), 'successful retry recovers durable local progress')
const intact = store.get(SAVE_KEY)
failRead = true
loadSave('low'); setVolume(4); tickMarket(6)
check(store.get(SAVE_KEY) === intact, 'read failure must not overwrite unknown existing save on load or autosave')
check(localSaveMessage().includes('paused'), 'protected recovery is reported')
failRead = false
loadSave('low')
check(getSave().volume === 23 && getSave().privyId === 'did:privy:test_account_a', 'storage recovery restores original account/progress')
for (const raw of ['{broken', 'null', '[]', '{"v":2,"xp":900}', '{"xp":900}']) {
  store.set(SAVE_KEY, raw)
  loadSave('low'); setVolume(5); rememberPlace(8, 9); tickMarket(6)
  check(store.get(SAVE_KEY) === raw && localSaveMessage().includes('paused'), 'malformed/unsupported save preserved byte-for-byte, never silently migrated/blanked')
}
console.log('local persistence/reload/inventory/CV/room/identity/storage-failure checks passed')
