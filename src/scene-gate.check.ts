import { createInput } from './input.ts'
import { SceneGate } from './scene-gate.ts'
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const gate = new SceneGate()
let aspect = 0
let graphicsCalls = 0
const resize = (width: number, height: number) => { aspect = width / height }
const graphics = () => { graphicsCalls++ }
gate.requestResize(400, 800)
gate.flush(false, resize, graphics)
check(gate.resizeCount === 1 && aspect === 0.5, 'initial aspect and renderer agree')
const pose = { position: 1, orientation: 2, target: 3, zoom: 4, character: 5, spring: 6 }
const before = JSON.stringify(pose)
for (let i = 0; i < 120; i++) {
  gate.requestResize(400, 800)
  gate.advance(true, () => { pose.position++; pose.orientation++; pose.target++; pose.zoom++; pose.character++; pose.spring++ })
  gate.flush(true, resize, graphics)
}
check(JSON.stringify(pose) === before, '120 paused frames preserve full scene state')
check(gate.resizeCount === 1 && graphicsCalls === 1, 'menu resize burst performs no buffer writes')
gate.flush(false, resize, graphics)
check(gate.resizeCount === 1, 'same-size menu events never resize')
gate.requestResize(500, 700)
gate.requestResize(800, 400)
gate.requestGraphics()
gate.flush(true, resize, graphics)
check(aspect === 0.5, 'rotation deferred while paused')
gate.flush(false, resize, graphics)
check(Number(gate.resizeCount) === 2 && Number(aspect) === 2, 'latest rotation applied once with correct aspect')
check(Number(graphicsCalls) === 2, 'graphics and viewport changes coalesced')
gate.flush(false, resize, graphics)
check(Number(graphicsCalls) === 2, 'idle frames never resize')
gate.advance(false, () => { pose.character++ })
check(pose.character === 6, 'scene resumes after close')
console.log('scene gate checks passed')

// Exercise real input accumulation/capture cancellation, not a copied model.
Object.defineProperty(globalThis, 'window', { value: new EventTarget() })
class Surface extends EventTarget {
  captures = new Set<number>()
  style = { transform: '' }
  setPointerCapture(id: number) { this.captures.add(id) }
  hasPointerCapture(id: number) { return this.captures.has(id) }
  releasePointerCapture(id: number) { this.captures.delete(id) }
  getBoundingClientRect() { return { left: 0, top: 0, width: 400, height: 800 } }
}
const canvas = new Surface()
const stick = new Surface()
const nub = new Surface()
const input = createInput(canvas as unknown as HTMLCanvasElement, stick as unknown as HTMLElement, nub as unknown as HTMLElement)
const pointer = (type: string, x: number) => Object.assign(new Event(type), { pointerId: 7, button: 0, clientX: x, clientY: 20 })
canvas.dispatchEvent(pointer('pointerdown', 10))
canvas.dispatchEvent(pointer('pointermove', 100))
canvas.dispatchEvent(Object.assign(new Event('wheel'), { deltaY: 80 }))
input.discard()
canvas.dispatchEvent(pointer('pointermove', 200))
canvas.dispatchEvent(pointer('pointerup', 200))
const drained = input.read()
check(!drained.lookX && !drained.lookY && !drained.zoom && !drained.tap, 'pause discards accumulated gestures and captured pointer continuation')
check(!canvas.captures.size, 'pause releases canvas capture')
console.log('paused input checks passed')

let releaseSurface: EventTarget = canvas
Object.defineProperty(globalThis, 'document', { value: { elementFromPoint: () => releaseSurface } })
canvas.dispatchEvent(pointer('pointerdown', 10))
releaseSurface = new EventTarget() // release lands on a phone/menu control
canvas.dispatchEvent(pointer('pointerup', 10))
check(input.read().tap === null, 'captured release over UI ignored')
releaseSurface = canvas
canvas.dispatchEvent(pointer('pointerdown', 10))
canvas.dispatchEvent(pointer('pointerup', 10))
check(input.read().tap !== null, 'valid canvas release retained')
console.log('UI release checks passed')
