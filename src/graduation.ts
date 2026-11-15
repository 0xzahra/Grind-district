// The graduation ceremony in the Campus Great Hall (an area built by homes.ts, lazy). You sit in the front row
// in cap and gown among the class; Zahra opens the ceremony; your name is called; you walk up onto the stage and
// receive the Diploma in Web3 Foundations to applause; then the class tosses its caps under falling confetti.
// The hall stands far from the city; its walls only show from inside, so the camera always sees in.
import * as THREE from 'three'
import type { Arch } from './homes.ts'
import type { TravelCtx } from './travel.ts'
import { std, put, cube, sign, person } from './travel.ts'
import { getSave } from './state.ts'
import { markGraduated } from './diploma.ts'

export const HALL = { x: 0, z: 1400 }
const L = (x: number, z: number) => ({ x: HALL.x + x, z: HALL.z + z })

function mortarboard(): THREE.Group {
  const g = new THREE.Group()
  const black = std(0x101114, 0.6)
  put(g, new THREE.CylinderGeometry(0.105, 0.11, 0.08, 14), black, 0, 0, 0)
  cube(g, 0.42, 0.025, 0.42, black, 0, 0.05, 0)
  put(g, new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), std(0xd9b26a, 0.4, 0.6), 0.17, -0.04, 0.12)
  return g
}

/** Applause: a crowd of short, filtered claps over a few seconds. */
function applause(seconds: number): void {
  try {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!C) return
    const ctx = new C()
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate)
    const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length * 0.18))
    const out = ctx.createGain(); out.gain.value = 0.35; out.connect(ctx.destination)
    const n = Math.floor(seconds * 70)
    for (let k = 0; k < n; k++) {
      const t = ctx.currentTime + Math.random() * seconds
      const s = ctx.createBufferSource(); s.buffer = buf
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900 + Math.random() * 1800; f.Q.value = 1.2
      const gn = ctx.createGain(); gn.gain.value = 0.25 + Math.random() * 0.5 * (1 - Math.abs((t - ctx.currentTime) / seconds - 0.4))
      s.connect(f).connect(gn).connect(out); s.start(t)
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), (seconds + 1) * 1000)
  } catch { /* no audio */ }
}

export function buildGraduation(A: Arch, X: TravelCtx): void {
  const g = new THREE.Group(); A.add(0, g)
  const W = 18, Z0 = -24, Z1 = 22
  // The hall: one box seen from inside (walls, ceiling and floor), warm wood floor, green curtains behind the stage.
  const hall = new THREE.Mesh(new THREE.BoxGeometry(W * 2, 14, Z1 - Z0), [std(0xe9e1d2, 0.8), std(0xe9e1d2, 0.8), std(0xf4f1ea, 0.9), std(0x7a5a3a, 0.5), std(0xe9e1d2, 0.8), std(0x1d4a32, 0.9)].map((m) => { m.side = THREE.BackSide; return m }))
  hall.position.set(HALL.x, 7, HALL.z + (Z0 + Z1) / 2); hall.receiveShadow = true; g.add(hall)
  // Stage, steps, lectern, banner and flags.
  const stageZ = Z0 + 5
  cube(g, 24, 1.0, 10, std(0x5a3a22, 0.45), HALL.x, 0.5, HALL.z + stageZ)
  cube(g, 24.2, 0.08, 0.2, std(0xd9b26a, 0.3, 0.8), HALL.x, 1.02, HALL.z + stageZ + 5.0, false)
  for (let k = 0; k < 3; k++) cube(g, 4, 0.33 * (k + 1), 0.6, std(0x5a3a22, 0.45), HALL.x, 0.165 * (k + 1), HALL.z + stageZ + 6.2 - k * 0.6)
  cube(g, 1.2, 1.3, 0.8, std(0x3a2616, 0.4), HALL.x + 3.4, 1.65, HALL.z + stageZ - 1)
  const crest = sign('GRIND DISTRICT CAMPUS', 16, 1.6, { fg: '#d9b26a', weight: 900 }); crest.position.set(HALL.x, 9.5, HALL.z + Z0 + 0.1); g.add(crest)
  const cls = sign(`CLASS OF ${new Date().getFullYear()}`, 10, 1.4, { bg: '#123524', fg: '#ffffff', glowing: true }); cls.position.set(HALL.x, 7.4, HALL.z + Z0 + 0.12); g.add(cls)
  for (const sx of [-1, 1]) { put(g, new THREE.CylinderGeometry(0.05, 0.05, 6, 8), std(0xd9b26a, 0.3, 0.8), HALL.x + sx * 10, 4, HALL.z + Z0 + 1.5); cube(g, 1.6, 2.4, 0.04, std(0x14a058, 0.8, 0, { side: THREE.DoubleSide }), HALL.x + sx * 10 + 0.85, 5.6, HALL.z + Z0 + 1.5, false) }
  // Chairs: graduates in front, families behind (instanced), facing the stage.
  const chairs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), std(0x2b2e33, 0.5), 96)
  const backs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), std(0x2b2e33, 0.5), 96)
  const mm = new THREE.Matrix4(); let n = 0
  const rowsZ = [-7, -5.8, -4.6, 0, 1.2, 2.4, 3.6, 4.8]
  const seatsX = [-5.4, -4.6, -3.8, -3.0, -1.2, 1.2, 3.0, 3.8, 4.6, 5.4, 6.2, -6.2]
  for (const z of rowsZ) for (const x of seatsX) { chairs.setMatrixAt(n, mm.makeTranslation(HALL.x + x, 0.45, HALL.z + z)); backs.setMatrixAt(n, mm.makeTranslation(HALL.x + x, 0.72, HALL.z + z + 0.24)); n++ }
  chairs.count = backs.count = n; g.add(chairs, backs)
  // The class, in gowns and caps, and some family.
  const lite = matchMedia('(pointer: coarse)').matches
  const caps: Array<{ cap: THREE.Group; x: number; z: number; vy: number; spin: number; y: number }> = []
  const grads: Array<[number, number, 'woman1' | 'man2' | 'woman3' | 'man4' | 'woman4' | 'man1']> = [[-1.2 + 2.4, -7, 'man2'], [3.0, -7, 'woman3'], [3.8, -7, 'man4'], [-3.0, -7, 'woman4'], [-3.8, -7, 'man1'], [4.6, -5.8, 'woman1'], [-4.6, -5.8, 'man2'], [1.2, -5.8, 'woman3']]
  for (const [x, z, m] of lite ? grads.slice(0, 5) : grads) {
    const p = person(m, { pose: 'sit', seatY: 0.48, height: m.startsWith('w') ? 1.66 : 1.78, look: { top: 0x101114, bottom: 0x101114, shoes: 0x111111 } })
    p.position.set(HALL.x + x, 0, HALL.z + z); p.rotation.y = Math.PI; g.add(p)
    const cap = mortarboard(); cap.position.set(HALL.x + x, 1.36, HALL.z + z - 0.02); g.add(cap)
    caps.push({ cap, x: HALL.x + x, z: HALL.z + z, vy: 0, spin: 0, y: 1.36 })
  }
  const family: Array<[number, number, 'woman2' | 'man3' | 'woman1' | 'man1']> = [[-1.2, 1.2, 'woman2'], [1.2, 1.2, 'man3'], [3.0, 2.4, 'woman1'], [-3.0, 2.4, 'man1']]
  for (const [x, z, m] of lite ? family.slice(0, 2) : family) { const p = person(m, { pose: 'sit', seatY: 0.48, height: m.startsWith('w') ? 1.66 : 1.78 }); p.position.set(HALL.x + x, 0, HALL.z + z); p.rotation.y = Math.PI; g.add(p) }
  const zahra = person('woman1', { pose: 'stand', height: 1.7, look: { top: 0x14a058, bottom: 0x14a058, shoes: 0x111111, robe: true } })
  zahra.position.set(HALL.x + 2.2, 1.0, HALL.z + stageZ); zahra.rotation.y = 0; g.add(zahra)
  // The diploma (a scroll with a green ribbon) and your own cap.
  const scroll = new THREE.Group(); put(scroll, new THREE.CylinderGeometry(0.04, 0.04, 0.34, 12).rotateZ(Math.PI / 2), std(0xfbf7ee, 0.7), 0, 0, 0); put(scroll, new THREE.TorusGeometry(0.045, 0.012, 6, 14).rotateY(Math.PI / 2), std(0x14a058, 0.5), 0, 0, 0)
  scroll.visible = false; g.add(scroll)
  const myCap = mortarboard(); g.add(myCap)
  // Confetti.
  const CN = lite ? 220 : 480
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.08, 0.05), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), CN)
  const cp = new Float32Array(CN * 3), cv = new Float32Array(CN), col = new THREE.Color()
  for (let i = 0; i < CN; i++) { cp[i * 3] = HALL.x + (Math.random() - 0.5) * 18; cp[i * 3 + 1] = 9 + Math.random() * 5; cp[i * 3 + 2] = HALL.z - 9 + (Math.random() - 0.5) * 10; cv[i] = 0.6 + Math.random() * 0.8; confetti.setColorAt(i, col.setHex([0xffd36b, 0x14a058, 0xffffff, 0xe0457b, 0x3d7bff][i % 5]!)) }
  confetti.visible = false; confetti.frustumCulled = false; g.add(confetti)
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1)
  // --- The ceremony.
  const name = (getSave().name || getSave().username || 'our graduate').trim()
  const seat = L(-1.2, -7), centre = L(0, stageZ + 1.2), floor = L(0, -9.6)
  let heading = Math.PI, standing = false, tossed = 0, last = X.now(), started = false
  const t0 = X.now()
  const said = new Set<string>(); const say = (k: string, m: string) => { if (!said.has(k)) { said.add(k); X.toast(m) } }
  const T = 42
  const pathAt = (t: number): { x: number; z: number; y: number } => {
    if (t < 9) { standing = false; heading = Math.PI; return { x: seat.x, z: seat.z, y: 0 } }
    if (t < 15) { standing = true; const u = (t - 9) / 6; const pts = [seat, L(-1.2, -8.6), L(0, -9.4), L(0, stageZ + 5.4), centre]; const k = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1))); const f = u * (pts.length - 1) - k; const a = pts[k]!, b = pts[k + 1]!; heading = Math.atan2(b.x - a.x, b.z - a.z); const y = k >= 2 ? Math.min(1, (k - 2 + f) * 1.4) : 0; return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, y } }
    if (t < 23) { standing = true; heading = t < 18 ? Math.PI / 2 : 0; return { x: centre.x, z: centre.z, y: 1.0 } }
    if (t < 29) { standing = true; const u = (t - 23) / 6; const a = centre, b = floor; heading = 0; const y = u < 0.6 ? 1.0 * (1 - u / 0.6) : 0; return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y } }
    standing = true; heading = Math.PI; return { x: floor.x, z: floor.z, y: 0 }
  }
  X.animate((t) => {
    const dt = Math.min(0.1, Math.max(0, t - last)); last = t
    if (!started && t - t0 > 1.2) {
      started = true
      X.startMove({
        from: { x: seat.x, z: seat.z, y: 0 }, to: { x: seat.x, z: seat.z, y: 0 }, t: 0, dur: T, toLv: 0,
        path: (u) => {
          const tt = u * T
          if (tt > 0.5) say('open', 'Zahra: "Welcome, graduates of Grind District Campus, and the families who got you here."')
          if (tt > 5) say('class', 'Zahra: "Six worlds. Every lesson. You learned how money and the internet really work, and how not to be fooled."')
          if (tt > 9) say('name', `Zahra: "${name}!" Rise and walk up to the stage.`)
          if (tt > 16) { say('award', `The Diploma in Web3 Foundations, awarded to ${name}. 🎓`); if (!said.has('clap1')) { said.add('clap1'); applause(5) } }
          if (tt > 29) { say('toss', 'Zahra: "Graduates, you may toss your caps!"'); if (!said.has('clap2')) { said.add('clap2'); applause(7); tossed = tt; confetti.visible = true; for (const c of caps) { c.vy = 5.5 + Math.random() * 2.5; c.spin = (Math.random() - 0.5) * 9 } } }
          scroll.visible = tt > 17
          const p = pathAt(tt)
          scroll.position.set(p.x + Math.sin(heading + 0.6) * 0.32, p.y + 1.05, p.z + Math.cos(heading + 0.6) * 0.32)
          return p
        },
        seat: () => (standing ? null : { yaw: heading, y: 0.45 }),
        face: () => (standing ? heading : null),
        camFn: () => (standing ? (said.has('toss') ? 11 : 7.5) : 6),
        view: () => ({ heading: Math.PI, pitch: said.has('toss') ? 0.32 : 0.2 }),
        done: () => {
          markGraduated()
          window.dispatchEvent(new Event('gd:graduated'))
          X.toast('Congratulations, graduate. Your diploma is in Graduation, ready to download and share.')
          window.setTimeout(() => X.leave(), 2500)
        },
      })
    }
    // Your cap follows you; the class's caps fly when tossed; confetti falls.
    if (tossed) for (const c of caps) { c.vy -= 9.8 * dt; c.y = Math.max(0.05, c.y + c.vy * dt); c.cap.position.y = c.y; c.cap.rotation.x += c.spin * dt; c.cap.rotation.z += c.spin * 0.7 * dt }
    if (confetti.visible) {
      for (let i = 0; i < CN; i++) {
        cp[i * 3 + 1] = Math.max(0.03, cp[i * 3 + 1]! - cv[i]! * dt)
        cp[i * 3] = cp[i * 3]! + Math.sin(t * 2 + i) * 0.2 * dt
        e.set(t * 3 + i, t * 2 + i * 0.3, 0)
        confetti.setMatrixAt(i, mm.compose(v.set(cp[i * 3]!, cp[i * 3 + 1]!, cp[i * 3 + 2]!), q.setFromEuler(e), one))
      }
      confetti.instanceMatrix.needsUpdate = true
    }
  })
  // Your own cap rides on your head through the ceremony.
  let mx = seat.x, mz = seat.z, my = 1.33
  X.animate(() => {
    const p = pathAt(Math.min(T, Math.max(0, X.now() - t0 - 1.2)))
    mx = p.x; mz = p.z; my = p.y + (standing ? 1.76 : 1.33)
    myCap.position.set(mx, my, mz); myCap.rotation.y = heading
    if (tossed) myCap.visible = false
  })
}
