import { QUALITY, applyDecorTier, applyLightTier, LocalPerformanceMetrics } from './quality.ts'
import { buildRoom, ROOM_TYPES } from './room-adapter.ts'
import type { Graphics } from './logic.ts'
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const tiers: Graphics[] = ['low', 'medium', 'high']
const lights = Array.from({ length: 6 }, () => ({ visible: true }))
check(tiers.map(tier => applyLightTier(lights, tier)).join(',') === '0,2,4', 'real-time point lights have distinct budgets, high reduced from six')
const outdoor = Array.from({ length: 16 }, () => ({ visible: true, userData: {} }))
check(tiers.map(tier => applyDecorTier(outdoor, tier)).join(',') === '4,8,16', 'outdoor density changes at runtime')
check(!QUALITY.low.shadows && QUALITY.medium.shadows && QUALITY.high.shadowSize > QUALITY.medium.shadowSize, 'shadow presets differ')
check(tiers.map(tier => Math.min(3, QUALITY[tier].pixelRatioCap)).join(',') === '1,1.5,2', 'pixel ratio caps differ on high-DPR phones')
const essential = { visible: true, userData: { essential: true } }
applyDecorTier([essential], 'low')
check(essential.visible, 'essential objects never hidden')
for (const [id, kind] of Object.entries(ROOM_TYPES)) {
  const room = buildRoom(kind, { id, x: 0, z: 0, r: 2, title: id, body: '', action: 'learn' })
  const obstacles = JSON.stringify(room.obstacles)
  const uses = JSON.stringify(room.uses)
  const counts = tiers.map(tier => applyDecorTier(room.decor, tier))
  check(counts[0]! < counts[1]! && counts[1]! < counts[2]!, `${kind}: lazy room decor has three distinct tiers`)
  check(JSON.stringify(room.obstacles) === obstacles && JSON.stringify(room.uses) === uses, `${kind}: presets preserve colliders and targets`)
  room.group.traverse(object => { if (object.userData.essential || object.userData.tapGround || object.userData.tapUse) check(object.visible, 'gameplay geometry remains visible') })
}
const metrics = new LocalPerformanceMetrics(true, 100)
metrics.phase('world_created', 175)
for (let i = 0; i < 700; i++) metrics.frame(i === 699 ? 1200 : 20)
check(metrics.snapshot().frameSamples === 600, 'bounded local metrics memory')
check(metrics.snapshot().recentFrameMs.includes(1200), 'slow frames not clipped to movement dt limit')
check(metrics.snapshot().estimatedFps === 50 && metrics.snapshot().phasesMs.world_created === 75, 'metrics summaries use measured intervals')
const disabled = new LocalPerformanceMetrics(false, 0)
disabled.frame(50); disabled.phase('test', 100)
check(disabled.snapshot().frameSamples === 0 && !Object.keys(disabled.snapshot().phasesMs).length, 'telemetry inactive without opt-in')
console.log('preset, invariant and local metrics checks passed')
