// Benches seat two (plaza, 1.35 m) or three (street, 1.6 m): the player takes the free place nearest to them,
// never one a resident sits on, and a bench with every place taken is full.
import { PLAZA_BENCH_LEN, STREET_BENCH_LEN, benchSlots, pickBenchSlot, plazaSeats } from '../src/seating.ts'

let pass = 0, fail = 0
const check = (c: boolean, m: string) => { if (c) pass++; else { fail++; console.log('  FAIL', m) } }
const bench = plazaSeats()[0]!
const two = benchSlots(bench, PLAZA_BENCH_LEN), three = benchSlots({ x: 0, z: 0, yaw: 0, y: 0.45 }, STREET_BENCH_LEN)
check(two.length === 2, 'plaza bench seats two')
check(three.length === 3, 'street bench seats three')
const gap = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z)
check(gap(two[0]!, two[1]!) > 0.6, 'plaza places are apart (no overlap)')
check(gap(three[0]!, three[1]!) > 0.5 && gap(three[1]!, three[2]!) > 0.5, 'street places are apart')
check(Math.abs(gap(two[0]!, bench) - gap(two[1]!, bench)) < 1e-9, 'places centred on the bench')
const at = (s: { x: number; z: number }) => (x: number, z: number) => Math.hypot(s.x - x, s.z - z) < 0.3
// A resident on place 0: the player gets place 1, even standing right by place 0.
const r = pickBenchSlot(two, at(two[0]!), two[0]!.x, two[0]!.z)
check(!!r && gap(r, two[1]!) < 1e-9, 'resident on one place: player gets the other')
// Nothing taken: the nearest place.
check(gap(pickBenchSlot(three, () => false, three[2]!.x + 0.1, three[2]!.z)!, three[2]!) < 1e-9, 'nearest free place')
// Two of three taken: the last one, wherever the player stands.
const taken2 = (x: number, z: number) => at(three[0]!)(x, z) || at(three[2]!)(x, z)
check(gap(pickBenchSlot(three, taken2, three[0]!.x, three[0]!.z)!, three[1]!) < 1e-9, 'last free place')
// All taken: full.
check(pickBenchSlot(two, () => true, 0, 0) === null, 'two-seat bench full')
check(pickBenchSlot(three, () => true, 0, 0) === null, 'three-seat bench full')
console.log(`bench: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
