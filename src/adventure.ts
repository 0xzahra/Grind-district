// Grind Adventures at the airport: a sea-cliff climb and a tandem skydive, each guided step by step with a
// direction card and one big button, the way an instructor would talk you through it.
//   Climb ($35): a 34 m rock face on the coast past the spaceport. Harness, knot, helmet; then "Reach" hold to
//   hold (clip the quickdraws, legs not arms, the crux, a shake-out), top out on the cliff, and abseil down.
//   Skydive ($250): briefing at the hangar, the climb in the jump plane, the door, "Jump", freefall in an arch
//   with the altimeter counting down, "Pull" (your instructor pulls if you don't), the canopy check, steering to
//   the target, and "Flare" for the landing.
import * as THREE from 'three'
import type { Arch, Move } from './homes.ts'
import type { TravelCtx } from './travel.ts'
import { std, put, cube, sign, tex, person, leg, route } from './travel.ts'
import { spendInGame } from './state.ts'
import { adjust } from './needs.ts'

const CLIFF = { x: 446, z: -66, h: 34 }
const DZ = { x: 352, z: 64 } // the skydive landing target, on the grass east of the runway
const PLANE_AT = { x: 258, z: 88 }

type Ctx = TravelCtx & { space: (v: number) => void }

/** The instructor's voice on screen: a heading, a line, and one big 3D button. */
function guideHud() {
  const box = document.createElement('div')
  box.setAttribute('style', 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));width:min(340px,88vw);z-index:60;display:none;font:500 15px/1.45 Inter,system-ui,sans-serif;color:#fff;text-align:center')
  const card = document.createElement('div')
  card.setAttribute('style', 'padding:12px 14px;border-radius:16px;background:rgba(10,14,12,.86);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 10px 24px rgba(0,0,0,.35);margin-bottom:10px')
  const h = document.createElement('div'); h.setAttribute('style', 'font:800 12px Inter,system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#ffd36b;margin-bottom:4px')
  const p = document.createElement('div')
  card.append(h, p)
  const btn = document.createElement('button'); btn.type = 'button'
  btn.setAttribute('style', 'width:100%;padding:14px 16px;border:0;border-radius:16px;font:900 18px Inter,system-ui,sans-serif;letter-spacing:.02em;color:#1d1405;background:linear-gradient(#ffe08a,#e5b23a);box-shadow:inset 0 1px 0 rgba(255,255,255,.7),inset 0 -3px 0 rgba(0,0,0,.18),0 5px 0 #9b6f16,0 12px 20px rgba(0,0,0,.35);touch-action:manipulation')
  btn.addEventListener('pointerdown', () => { btn.style.transform = 'translateY(4px)'; btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.6),0 1px 0 #9b6f16,0 4px 8px rgba(0,0,0,.3)' })
  const up = () => { btn.style.transform = ''; btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,.7),inset 0 -3px 0 rgba(0,0,0,.18),0 5px 0 #9b6f16,0 12px 20px rgba(0,0,0,.35)' }
  btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up)
  box.append(card, btn)
  const big = document.createElement('div')
  big.setAttribute('style', 'position:fixed;left:0;right:0;top:118px;text-align:center;font:900 46px Inter,system-ui,sans-serif;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.6);z-index:60;pointer-events:none;display:none')
  document.body.append(box, big)
  let onTap: (() => void) | null = null
  btn.onclick = (e) => { e.stopPropagation(); const f = onTap; if (f) f() }
  return {
    show(title: string, text: string, label?: string, tap?: () => void) { box.style.display = 'block'; h.textContent = title; p.textContent = text; onTap = tap ?? null; btn.style.display = label ? 'block' : 'none'; btn.textContent = label ?? '' },
    hide() { box.style.display = 'none'; onTap = null },
    big(text: string | null) { big.style.display = text ? 'block' : 'none'; big.textContent = text ?? '' },
    remove() { box.remove(); big.remove() },
  }
}

export function buildAdventures(A: Arch, X: Ctx): void {
  const g = new THREE.Group(); A.add(0, g)
  const hud = guideHud()
  X.onLeave(() => hud.remove())
  const lite = matchMedia('(pointer: coarse)').matches

  // ---------------------------------------------------------------- the sea cliff
  const rockTex = tex(256, 256, (c) => {
    c.fillStyle = '#8b8174'; c.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 1800; i++) { const v = 90 + Math.random() * 80; c.fillStyle = `rgba(${v},${v - 8},${v - 18},0.35)`; c.fillRect(Math.random() * 256, Math.random() * 256, 2 + Math.random() * 6, 1 + Math.random() * 3) }
    c.strokeStyle = 'rgba(40,34,28,0.55)'; c.lineWidth = 1.5
    for (let i = 0; i < 26; i++) { c.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y += Math.random() * 30; c.lineTo(x, y) } c.stroke() }
  }, [3, 4])
  const rock = std(0xffffff, 0.92, 0, { map: rockTex })
  // The face: a subdivided plane pushed in and out so it reads as real rock, facing west (-x).
  const FW = 22
  const faceGeo = new THREE.PlaneGeometry(FW, CLIFF.h + 2, 44, 70)
  const fp = faceGeo.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < fp.count; i++) { const x = fp.getX(i), y = fp.getY(i); fp.setZ(i, Math.sin(x * 0.9) * 0.35 + Math.sin(y * 0.55 + x * 0.3) * 0.5 + Math.sin(x * 2.3 + y * 1.7) * 0.15) }
  faceGeo.computeVertexNormals()
  const face = put(g, faceGeo, rock, CLIFF.x, (CLIFF.h + 2) / 2 - 1, CLIFF.z); face.rotation.y = -Math.PI / 2
  cube(g, 30, CLIFF.h, FW, rock, CLIFF.x + 15.6, CLIFF.h / 2, CLIFF.z)
  for (const [x, z, r] of [[CLIFF.x + 6, CLIFF.z - 13, 6], [CLIFF.x + 10, CLIFF.z + 12, 7], [CLIFF.x - 3, CLIFF.z - 12, 2.4], [CLIFF.x - 4, CLIFF.z + 9, 1.8]] as const) { const b = put(g, new THREE.DodecahedronGeometry(r, 1), std(0x80776a, 0.95, 0, { flatShading: true }), x, r * 0.5, z); b.scale.y = 0.8 }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(30, FW), std(0x6f8a4a, 1)); top.rotation.x = -Math.PI / 2; top.position.set(CLIFF.x + 15.6, CLIFF.h + 0.01, CLIFF.z); g.add(top)
  A.block(0, { x0: CLIFF.x - 0.2, z0: CLIFF.z - FW / 2 - 4, x1: CLIFF.x + 31, z1: CLIFF.z + FW / 2 + 4 })
  // The route: holds zigzagging up, a bolt with a quickdraw every other hold, the anchor at the top.
  const N = 11
  const holds: THREE.Vector3[] = []
  for (let k = 0; k <= N; k++) holds.push(new THREE.Vector3(CLIFF.x - 0.42, 0.2 + (k / N) * (CLIFF.h - 1.6), CLIFF.z + Math.sin(k * 1.3) * 1.3))
  const holdM = std(0x5a4f44, 0.9, 0, { flatShading: true }), metal = std(0xcfd4da, 0.25, 0.9)
  for (const h of holds) { put(g, new THREE.DodecahedronGeometry(0.13, 0), holdM, CLIFF.x - 0.05, h.y + 1.9, h.z + 0.35); put(g, new THREE.DodecahedronGeometry(0.11, 0), holdM, CLIFF.x - 0.05, h.y + 0.2, h.z - 0.3) }
  holds.forEach((h, k) => { if (k % 2 === 1) { put(g, new THREE.TorusGeometry(0.05, 0.012, 6, 12), metal, CLIFF.x - 0.06, h.y + 1.2, h.z).rotation.y = Math.PI / 2; put(g, new THREE.CylinderGeometry(0.012, 0.012, 0.16, 5), std(0x1fb85a, 0.5), CLIFF.x - 0.1, h.y + 1.08, h.z) } })
  put(g, new THREE.TorusGeometry(0.08, 0.02, 6, 14), metal, CLIFF.x + 0.4, CLIFF.h + 0.1, CLIFF.z)
  const sgn = sign('SEA CLIFF · GUIDED CLIMBS', 4, 0.6, { bg: '#2b3b22', fg: '#f3e6c4' }); sgn.position.set(CLIFF.x - 7, 1.9, CLIFF.z - 4); sgn.rotation.y = Math.PI / 2; g.add(sgn)
  for (const dz of [-1.6, 1.6]) cube(g, 0.1, 1.9, 0.1, std(0x5a4632, 0.9), CLIFF.x - 7, 0.95, CLIFF.z - 4 + dz)
  // The climber (you) and the rope from the anchor.
  const climber = person('woman3', { pose: 'cheer', height: 1.7, look: { top: 0xe05a2b, bottom: 0x2b2e33, shoes: 0x1a1a1a } })
  climber.visible = false; climber.rotation.y = Math.PI / 2; g.add(climber)
  const ropeM = std(0x2bd46b, 0.6)
  const rope = put(g, new THREE.CylinderGeometry(0.018, 0.018, 1, 5), ropeM, 0, 0, 0, false); rope.visible = false
  const anchor = new THREE.Vector3(CLIFF.x - 0.3, CLIFF.h + 0.1, CLIFF.z)
  const ropeTo = (p: THREE.Vector3) => { const mid = anchor.clone().add(p).multiplyScalar(0.5); rope.position.copy(mid); rope.scale.set(1, anchor.distanceTo(p), 1); rope.lookAt(p); rope.rotateX(Math.PI / 2) }
  const climbLines: Array<[string, string]> = [
    ['Three points of contact', 'Move one hand or one foot at a time; the other three stay on the rock.'],
    ['Feet first', 'Look down for the next foothold before you reach. Your legs are stronger than your arms.'],
    ['Clip in', 'Clip the quickdraw by your waist: rope in through the bottom carabiner, gate facing away from where you\'ll go.'],
    ['Stand up', 'Push up through your legs and keep your hips close to the wall. Pulling with your arms burns them out.'],
    ['Breathe', 'Slow breaths. Relax your grip to just enough; over-gripping tires you in minutes.'],
    ['Clip in', 'Next bolt: clip, then call "Clipped!" so your guide knows.'],
    ['The crux', 'The hardest move: smear your right foot flat on the rock, rock over onto it, and reach long for the big hold above.'],
    ['Shake out', 'You made the crux. Hang on a straight arm, shake out the other hand, then swap.'],
    ['Clip in', 'Last bolt. Clip, breathe, look at the sea.'],
    ['Nearly there', 'Two more moves. Eyes up, feet high, push.'],
    ['Top out', 'Hands over the edge, walk your feet up and roll onto the top. You\'re 34 m above the sea.'],
  ]
  const climb = () => {
    const paid = spendInGame(35, 'Guided sea-cliff climb', 'Grind Adventures')
    if (!paid.ok) { X.toast(paid.message); return }
    const brief: Array<[string, string, string]> = [
      ['Harness', 'Step into the harness, pull it to your waist and double back both buckles. Your guide checks them.', 'Next'],
      ['Tie in', 'Thread the rope through both tie-in points and tie a figure-eight knot, finished with a stopper. Your guide checks it too.', 'Next'],
      ['Helmet and chalk', 'Helmet on, chin strap snug. Chalk your hands. You say "On belay?" Your guide answers "Belay on." You say "Climbing."', 'Start climbing'],
    ]
    let b = 0
    const nextBrief = () => { if (b < brief.length) { const [t, x, l] = brief[b++]!; hud.show(t, x, l, nextBrief) } else startClimb() }
    nextBrief()
  }
  const startClimb = () => {
    let hold = 0, from = holds[0]!.clone(), to = holds[0]!.clone(), moveT = 1, phase: 'climb' | 'top' | 'abseil' | 'done' = 'climb', abseilT = 0
    climber.visible = true; rope.visible = true
    const p = new THREE.Vector3()
    const showStep = () => {
      if (phase === 'climb') { const [t, x] = climbLines[Math.min(climbLines.length - 1, hold)]!; hud.show(`${t} · ${hold} of ${N}`, x, hold < N ? 'Reach ↑' : 'Top out', reach) }
      else if (phase === 'top') hud.show('Safe!', 'Clip into the anchor and shout "Safe!" Take in the view: the sea, the runway, the city. When you\'re ready, your guide sets up the abseil.', 'Abseil down', () => { phase = 'abseil'; abseilT = 0; hud.show('Abseil', 'Lean back until your legs are flat to the rock, feet wide. Let the rope slide through your brake hand and walk backwards down the wall.') })
    }
    const reach = () => {
      if (moveT < 1) return
      if (hold >= N) { phase = 'top'; showStep(); return }
      from = holds[hold]!.clone(); hold++; to = holds[hold]!.clone(); moveT = 0
      showStep()
    }
    showStep()
    let lastC = 0
    const m: Move = {
      from: { x: holds[0]!.x, z: holds[0]!.z, y: 0 }, to: { x: holds[0]!.x, z: holds[0]!.z, y: 0 }, t: 0, dur: 600, toLv: 0, hide: true,
      path: () => {
        // Real time since the last frame (the move's own clock), so every phone climbs at the same pace.
        const dt = Math.min(0.1, Math.max(0, m.t - lastC)); lastC = m.t
        if (phase === 'climb') { moveT = Math.min(1, moveT + dt / 0.9); const e = moveT * moveT * (3 - 2 * moveT); p.lerpVectors(from, to, e); p.y += Math.sin(moveT * Math.PI) * 0.15 }
        else if (phase === 'top') p.set(CLIFF.x + 1.2, CLIFF.h, CLIFF.z)
        else if (phase === 'abseil') { abseilT = Math.min(1, abseilT + dt / 7); p.set(CLIFF.x - 0.9, (1 - abseilT) * (CLIFF.h - 1), CLIFF.z); if (abseilT >= 1 && phase === 'abseil') { phase = 'done'; m.dur = m.t + 0.05 } }
        climber.position.copy(p); climber.rotation.set(phase === 'abseil' ? -0.4 : 0, Math.PI / 2, 0)
        climber.visible = phase !== 'top'
        ropeTo(p.clone().add(new THREE.Vector3(0, 1.0, 0)))
        X.wind(phase === 'top' ? 6 : 2)
        return { x: p.x, z: p.z, y: p.y }
      },
      camFn: () => (phase === 'top' ? 9 : 6.5),
      view: () => (phase === 'top' ? { heading: -Math.PI / 2 - 0.4, pitch: 0.25 } : { heading: Math.PI / 2, pitch: 0.16 }),
      exit: { x: CLIFF.x - 5, z: CLIFF.z - 2 },
      done: () => {
        X.wind(0); climber.visible = false; rope.visible = false
        hud.show('Down safe', 'Untie your knot, then coil the rope for the next climber. That was 34 m of real rock.', 'Done', () => hud.hide())
        X.toast(adjust({ social: 10, energy: -12 }, 'quiet') || 'You climbed a sea cliff.')
      },
    }
    X.startMove(m)
  }
  A.use(0, { id: 'adv-climb', x: CLIFF.x - 5, z: CLIFF.z - 1, r: 1.8, title: 'Sea cliff · guided climb', body: 'A 34 m rock face over the sea, roped from the top with a guide. Harness, knot and helmet first; then hold by hold to the top, and an abseil down. Your guide talks you through every move.', enter: 'Climb the sea cliff · $35', use: () => climb() })

  // ---------------------------------------------------------------- the skydive
  // The jump plane: a high-wing single engine in white and green.
  const plane = new THREE.Group()
  const white = std(0xf4f4f2, 0.35, 0.2), green = std(0x14a058, 0.5)
  put(plane, new THREE.CylinderGeometry(0.75, 0.55, 7, 16).rotateX(Math.PI / 2), white, 0, 1.5, 0)
  put(plane, new THREE.ConeGeometry(0.55, 1.4, 16).rotateX(Math.PI / 2), white, 0, 1.5, 4.1)
  put(plane, new THREE.ConeGeometry(0.55, 2.6, 16).rotateX(-Math.PI / 2), white, 0, 1.6, -4.7)
  cube(plane, 11, 0.14, 1.6, white, 0, 2.35, 0.6)
  cube(plane, 11.05, 0.05, 0.3, green, 0, 2.43, 0.6, false)
  cube(plane, 0.12, 1.6, 1.4, green, 0, 2.5, -5.4)
  cube(plane, 3.4, 0.08, 0.9, white, 0, 1.75, -5.4)
  for (const s of [-1, 1]) { const st = cube(plane, 0.06, 1.2, 0.06, std(0x9aa1a8, 0.4, 0.7), s * 2.2, 1.8, 0.6); st.rotation.z = s * 0.7; put(plane, new THREE.CylinderGeometry(0.28, 0.28, 0.16, 14).rotateZ(Math.PI / 2), std(0x16171a, 0.85), s * 1.1, 0.28, 0.6) }
  put(plane, new THREE.CylinderGeometry(0.18, 0.18, 0.16, 12).rotateZ(Math.PI / 2), std(0x16171a, 0.85), 0, 0.2, 3.6)
  const prop = new THREE.Group(); prop.position.set(0, 1.5, 4.85); cube(prop, 0.12, 2.2, 0.05, std(0x1a1a1a, 0.4), 0, 0, 0); plane.add(prop)
  cube(plane, 0.05, 1.0, 1.1, std(0x1a2129, 0.2, 0.4), -0.76, 1.55, -0.6, false) // the open door on the left
  const ps = sign('GRIND SKYDIVE', 3.2, 0.42, { fg: '#14a058', weight: 900 }); ps.position.set(0.77, 1.6, -1.2); ps.rotation.y = Math.PI / 2; plane.add(ps)
  plane.position.set(PLANE_AT.x, 0, PLANE_AT.z); plane.rotation.order = 'YXZ'; plane.rotation.y = Math.PI
  g.add(plane)
  // The landing target, and the desk by the hangar.
  const target = new THREE.Mesh(new THREE.RingGeometry(3, 9, 40).rotateX(-Math.PI / 2), std(0xff6a1a, 0.8)); target.position.set(DZ.x, 0.02, DZ.z); g.add(target)
  put(g, new THREE.CircleGeometry(1.4, 24).rotateX(-Math.PI / 2), std(0xffffff, 0.8), DZ.x, 0.025, DZ.z)
  cube(g, 2.4, 1.1, 0.8, std(0x2b2e33, 0.5), 251, 0.55, 97.6)
  const ds = sign('GRIND SKYDIVE · TANDEM JUMPS', 4.6, 0.6, { bg: '#123524', fg: '#ffffff', glowing: true }); ds.position.set(251, 2.6, 97.2); ds.rotation.y = Math.PI; g.add(ds)
  A.block(0, { x0: 249.8, z0: 97.2, x1: 252.2, z1: 98 })
  // You and your instructor (tandem), and the canopy.
  const you = person('woman3', { pose: 'cheer', height: 1.7, look: { top: 0xe05a2b, bottom: 0xe05a2b, shoes: 0x1a1a1a } })
  const inst = person('man1', { pose: 'cheer', height: 1.8, look: { top: 0x101114, bottom: 0x101114, shoes: 0x1a1a1a } })
  const pair = new THREE.Group(); pair.add(you, inst); inst.position.set(0, 0.25, -0.32); pair.visible = false; g.add(pair)
  const canopy = new THREE.Group()
  const cells = tex(512, 64, (c) => { for (let i = 0; i < 9; i++) { c.fillStyle = ['#14a058', '#ffd36b', '#ffffff'][i % 3]!; c.fillRect(i * 57, 0, 57, 64) } })
  // A ram-air wing: 8 m across, arched over your head, 3.4 m from front to back.
  const wingGeo = new THREE.CylinderGeometry(8, 8, 3.4, 24, 1, true, -0.55, 1.1).rotateX(-Math.PI / 2).translate(0, -7.3, 0)
  put(canopy, wingGeo, std(0xffffff, 0.8, 0, { map: cells, side: THREE.DoubleSide }), 0, 7.2, 0, false)
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const l = put(canopy, new THREE.CylinderGeometry(0.008, 0.008, 6.4, 4), std(0xdddddd, 0.5), s * (1.2 + k * 1.1), 3.4, 0, false); l.rotation.z = -s * (0.18 + k * 0.12) }
  canopy.visible = false; pair.add(canopy)
  // The jump plane's climb: taxi, take off north, climb in a wide circle over the airport and the sea.
  const climbRoute = route([leg([
    [PLANE_AT.x, 0, PLANE_AT.z, 0.6], [266, 0, 96, 5], [276, 0, 106, 8], [292, 0, 108, 8], [300, 0, 96, 10], [300, 0, 60, 24], [300, 2, 14, 34], [300, 30, -50, 38], [270, 160, -160, 40], [170, 360, -190, 42], [100, 560, -100, 42], [130, 760, 20, 42], [230, 900, 60, 40], [330, 1000, 30, 38], [400, 1060, -40, 36],
  ])])
  const skydive = () => {
    const paid = spendInGame(250, 'Tandem skydive', 'Grind Skydive')
    if (!paid.ok) { X.toast(paid.message); return }
    const brief: Array<[string, string, string]> = [
      ['Your harness', 'You jump in tandem: clipped to your instructor at four points, shoulders and hips. They carry the parachute and the reserve.', 'Next'],
      ['At the door', 'Sit on the edge, head back on your instructor\'s shoulder, legs tucked under the plane, hands on your harness.', 'Next'],
      ['Freefall: the arch', 'Push your hips forward, chin up, arms out wide like a banana. Breathe. You fall at about 200 km/h for around a minute.', 'Next'],
      ['The canopy', 'Pull at 1,500 m (here, at the gold mark). Then check the canopy, steer with the toggles, and flare just above the ground to land softly.', 'Board the plane'],
    ]
    let b = 0
    const nextBrief = () => { if (b < brief.length) { const [t, x, l] = brief[b++]!; hud.show(t, x, l, nextBrief) } else jump() }
    nextBrief()
  }
  const jump = () => {
    let phase: 'climb' | 'door' | 'free' | 'canopy' | 'landed' = 'climb'
    let doorT = 0, jumpNow = false, vy = 0, vh = 0, pullAt = 0, flare = false, flareTried = false
    const p = new THREE.Vector3(), dir = new THREE.Vector3(), w = new THREE.Vector3()
    let heading = Math.PI, tClimb = 0
    hud.show('Climbing to altitude', 'The jump plane climbs in circles over the airport and the bay. Check your goggles and your harness.')
    X.flying(true)
    X.space(0.5)
    X.fade()
    let lastS = 0
    const m: Move = {
      from: { x: PLANE_AT.x, z: PLANE_AT.z, y: 0 }, to: { x: PLANE_AT.x, z: PLANE_AT.z, y: 0 }, t: 0, dur: 900, toLv: 0, hide: true,
      path: () => {
        const dt = Math.min(0.1, Math.max(0, m.t - lastS)); lastS = m.t
        prop.rotation.z += 36 * dt
        if (phase === 'climb' || phase === 'door') {
          tClimb = Math.min(climbRoute.T, tClimb + dt)
          const f = climbRoute.at(tClimb)
          heading = Math.atan2(f.tan.x, f.tan.z)
          plane.position.copy(f.p); plane.rotation.set(-Math.asin(THREE.MathUtils.clamp(f.tan.y, -1, 1)), heading, 0)
          hud.big(`${Math.round(f.p.y * 4).toLocaleString('en-US')} m`)
          if (tClimb >= climbRoute.T && phase === 'climb') {
            phase = 'door'
            hud.show('Door open', 'Wind roaring. Shuffle to the door with your instructor. Head back, legs under the plane. Ready, set…', 'Jump!', () => { if (phase === 'door') jumpNow = true })
          }
          if (phase === 'door') {
            // Holding on a straight line out over the sea; jump on the button (or after a few seconds).
            doorT += dt
            plane.position.x = climbRoute.at(climbRoute.T).p.x + Math.sin(heading) * 36 * doorT; plane.position.z = climbRoute.at(climbRoute.T).p.z + Math.cos(heading) * 36 * doorT
            if (jumpNow || doorT > 9) {
              phase = 'free'; p.copy(plane.position).add(new THREE.Vector3(Math.cos(heading) * 1.4, 0.6, -Math.sin(heading) * 1.4)); vy = 0; vh = 30
              pair.visible = true; plane.visible = true
              hud.show('Freefall: arch!', 'Hips forward, chin up, arms wide. Watch the altimeter: pull at the gold mark.')
            }
          }
          plane.getWorldDirection(dir)
          w.copy(plane.position).add(new THREE.Vector3(0, 1.4, 0))
          X.wind(30)
          return { x: w.x, z: w.z, y: w.y }
        }
        if (phase === 'free') {
          vy = Math.min(55, vy + 9.8 * dt); vh = Math.max(0, vh - 8 * dt)
          p.y -= vy * dt; p.x += Math.sin(heading) * vh * dt; p.z += Math.cos(heading) * vh * dt
          // The plane flies on and away.
          plane.position.x += Math.sin(heading) * 38 * dt; plane.position.z += Math.cos(heading) * 38 * dt
          pair.position.copy(p); pair.rotation.set(-Math.PI / 2 + 0.15, heading, 0)
          const alt = Math.round(p.y * 4)
          hud.big(`${alt.toLocaleString('en-US')} m`)
          if (p.y < 450 && !pullAt && !flareTried) { flareTried = true; hud.show('Pull!', 'Wave off, reach back for the handle, pull hard.', 'Pull', () => { if (phase === 'free') pullAt = p.y }) }
          if (p.y < 370 && !pullAt) { pullAt = p.y; X.toast('Your instructor pulls for you.') }
          if (pullAt) {
            phase = 'canopy'; vy = 11; flareTried = false; canopy.visible = true; pair.rotation.set(0, heading, 0); plane.visible = false
            hud.show('Canopy check', 'Is it square, stable and steerable? Yes. Find the target below and steer with the toggles.')
          }
          X.wind(Math.min(60, vy))
          return { x: p.x, z: p.z, y: p.y }
        }
        if (phase === 'canopy') {
          // Steer gently towards the target so you arrive as you reach the ground.
          const dx = DZ.x - p.x, dz = DZ.z - p.z, dist = Math.hypot(dx, dz)
          const tLeft = Math.max(1, p.y / vy)
          const want = Math.atan2(dx, dz)
          heading += Math.atan2(Math.sin(want - heading), Math.cos(want - heading)) * Math.min(1, dt * 0.8)
          const speed = Math.min(14, dist / tLeft + 1)
          p.x += Math.sin(heading) * speed * dt; p.z += Math.cos(heading) * speed * dt
          if (!flare && p.y < 60) vy = Math.max(8, vy - 4 * dt)
          if (flare) vy = Math.max(1.2, vy - 12 * dt)
          p.y = Math.max(0, p.y - vy * dt)
          pair.position.copy(p); pair.rotation.set(flare ? 0.25 : 0, heading, 0)
          hud.big(p.y > 1 ? `${Math.round(p.y * 4).toLocaleString('en-US')} m` : null)
          if (p.y < 60 && p.y > 30 && !flareTried) hud.show('Final approach', 'Into the wind, towards the orange target. Eyes on the horizon. Get ready to flare.', undefined)
          if (p.y <= 30 && !flareTried) { flareTried = true; hud.show('Flare!', 'Pull both toggles all the way down now.', 'Flare', () => { flare = true; X.toast('Perfect flare: you slide in on your feet.') }) }
          if (p.y < 4 && !flare) { flare = true; X.toast('Your instructor flares for you. A soft slide in.') }
          if (p.y <= 0.01) { phase = 'landed'; m.dur = m.t + 0.05 }
          X.wind(10)
          return { x: p.x, z: p.z, y: p.y }
        }
        return { x: p.x, z: p.z, y: 0 }
      },
      camFn: () => (phase === 'free' ? 8 : phase === 'canopy' ? 13 : 22),
      view: () => (phase === 'free' ? { heading, pitch: 0.82 } : phase === 'canopy' ? { heading, pitch: 0.3 } : { heading, pitch: 0.28 }),
      exit: { x: DZ.x - 3, z: DZ.z + 3 },
      done: () => {
        X.wind(0); X.flying(false); X.space(0)
        hud.big(null)
        pair.visible = false; canopy.visible = false
        plane.visible = true; plane.position.set(PLANE_AT.x, 0, PLANE_AT.z); plane.rotation.set(0, Math.PI, 0)
        hud.show('You did it', 'Feet on the ground. Gather the canopy, high-five your instructor. That was a real skydive.', 'Done', () => hud.hide())
        X.toast(adjust({ social: 18, energy: -8 }, 'quiet') || 'What a jump.')
      },
    }
    X.startMove(m)
    void lite
  }
  A.use(0, { id: 'adv-skydive', x: 251, z: 99.4, r: 1.8, title: 'Grind Skydive · tandem', body: 'A tandem skydive with an instructor: the climb in the jump plane, the door, a minute of freefall over the bay and the city, the canopy, and a landing on the target by the runway. Every step explained.', enter: 'Tandem skydive · $250', use: () => skydive() })
}
