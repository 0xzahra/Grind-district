// The Pitch: a scam-awareness scenario on practice money (words and numbers in pitchCore.ts).
// Dex Sterling works a neon booth outside the Conference Centre, pushing the coin of the day. Ask him questions and
// each answer gives a red flag away. Walk away (the win), or buy in with in-game dollars and watch the pump: the
// sell button never works (a honeypot) and then the creator pulls the liquidity. A closing card goes through every
// red flag, found or missed, and links to the scams course. Reputation once a day; nothing touches real money.
import * as THREE from 'three'
import { mergeStatic } from './batch.ts'
import { posedHuman } from './humans.ts'
import { spendInGame, addReputation } from './state.ts'
import { speak, stopSpeaking } from './speech.ts'
import { note as personaNote } from './persona.ts'
import type { Hotspot } from './world.ts'
import type { Obstacle } from './physics.ts'
import { PROMOTER, PITCH_FLAGS, QUESTIONS, ALL_FLAGS, STAKES, coinOfDay, dayIndex, pitchLines, priceAt, rugTime, reputationFor, type Coin } from './pitchCore.ts'

const KEY = 'gd.pitch.v1'
type Mem = { day: number; rep?: boolean; rugged?: { stake: number; asked: string[]; tries: number } }
const readMem = (): Mem => { try { const m = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Mem; return m.day === dayIndex() ? m : { day: dayIndex() } } catch { return { day: dayIndex() } } }
const writeMem = (m: Mem) => { try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* private mode */ } }

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const key = (label: string, cls: string, on: () => void) => { const b = el('button', label, `gm-key ${cls}`); b.type = 'button'; b.onclick = on; return b }
const money = (n: number) => `$${n.toFixed(2)}`

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4
  return t
}
const FONT = '"Inter Variable", Inter, system-ui, sans-serif'

/** The booth's screen: a pumping chart, or the dead site after a rug. */
function drawScreen(g: CanvasRenderingContext2D, c: Coin, offline: boolean): void {
  const W = g.canvas.width, H = g.canvas.height
  g.fillStyle = '#07090d'; g.fillRect(0, 0, W, H)
  if (offline) {
    g.strokeStyle = '#ff3b4e'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 80); for (let i = 0; i <= 20; i++) g.lineTo(40 + i * 22, 80 + (i < 14 ? -i * 4 : -56 + (i - 14) * 50)); g.stroke()
    g.fillStyle = '#ff3b4e'; g.font = `900 64px ${FONT}`; g.textAlign = 'center'; g.fillText('SITE OFFLINE', W / 2, H - 70)
    g.fillStyle = '#9aa3ad'; g.font = `600 28px ${FONT}`; g.fillText(`${c.sym}  -99.6%`, W / 2, H - 26)
    return
  }
  // Rising green candles.
  let y = H - 70
  for (let i = 0; i < 22; i++) {
    const up = i % 5 !== 3, h = 14 + ((i * 37) % 23)
    const ny = Math.max(60, y - (up ? h : -h * 0.6))
    g.fillStyle = up ? '#25e07a' : '#ff5a6a'
    g.fillRect(28 + i * 22, Math.min(y, ny), 14, Math.max(6, Math.abs(ny - y)))
    y = ny
  }
  g.fillStyle = '#ffffff'; g.font = `900 52px ${FONT}`; g.textAlign = 'left'; g.fillText(`$${c.sym}`, 30, 54)
  g.fillStyle = '#25e07a'; g.font = `900 46px ${FONT}`; g.textAlign = 'right'; g.fillText('+312%', W - 26, 54)
}

export function buildPitch(scene: THREE.Scene, o: { obstacles: Obstacle[]; at: { x: number; z: number }; toast: (m: string) => void; openCourse: (id: 'scams') => void }): { spot: Hotspot } {
  const coin = coinOfDay(dayIndex())
  const g = new THREE.Group(); g.position.set(o.at.x, 0, o.at.z); scene.add(g)
  const std = (color: number, roughness = 0.5, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra })
  const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b }
  const glow = (t: THREE.Texture) => std(0xffffff, 0.4, 0, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.9 })
  // The booth faces +z, the way people walk up from the plaza: a pop-up stall on a low riser (back wall, two
  // front posts and a canopy with TO THE MOON across it and a row of bulbs), a glossy counter with a neon front,
  // the promoter behind it, his chart screen on the back wall, and the drinks he hands out to draw a crowd.
  const gold = std(0xd8b04a, 0.25, 0.9), steel = std(0x2a2d33, 0.4, 0.7), plum = std(0x2c1240, 0.6, 0.1, { emissive: 0x1a0828, emissiveIntensity: 0.6 })
  box(3.2, 0.08, 2.2, std(0x15161a, 0.35, 0.3), 0, 0.04, 0.12) // riser
  box(3.2, 0.012, 0.03, gold, 0, 0.085, 1.21) // riser nosing
  box(3.1, 2.86, 0.1, plum, 0, 1.51, -0.86) // back wall
  for (const sx of [-1, 1]) {
    box(0.06, 2.86, 0.1, gold, sx * 1.55, 1.51, -0.86) // wall edge trim
    box(0.08, 2.86, 0.08, steel, sx * 1.52, 1.51, 1.1) // front post
  }
  box(3.3, 0.08, 2.2, std(0x120618, 0.5, 0.2), 0, 2.98, 0.12) // canopy
  box(3.3, 0.42, 0.06, std(0x120618, 0.5, 0.2), 0, 2.79, 1.2) // canopy fascia
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), std(0xfff1c4, 0.4, 0, { emissive: 0xffd88a, emissiveIntensity: 1.4 }), 11)
  for (let i = 0; i < 11; i++) { const m = new THREE.Matrix4().makeTranslation(-1.5 + i * 0.3, 2.53 - Math.sin((i / 10) * Math.PI) * 0.06, 1.24); bulbs.setMatrixAt(i, m) }
  g.add(bulbs)
  box(2.5, 1.02, 0.7, std(0x111318, 0.25, 0.6), 0, 0.51, 0.55)
  box(2.56, 0.05, 0.76, gold, 0, 1.04, 0.55)
  const front = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.62), glow(canvasTex(1024, 264, (c) => {
    c.fillStyle = '#12051a'; c.fillRect(0, 0, 1024, 264)
    c.strokeStyle = '#ff3dd6'; c.lineWidth = 10; c.strokeRect(10, 10, 1004, 244)
    c.fillStyle = '#ff3dd6'; c.font = `900 96px ${FONT}`; c.textAlign = 'center'; c.fillText(`${coin.name.toUpperCase()}`, 512, 118)
    c.fillStyle = '#5ff3ff'; c.font = `800 62px ${FONT}`; c.fillText(`$${coin.sym} PRESALE · 100x`, 512, 210)
  })))
  front.position.set(0, 0.55, 0.905); g.add(front)
  let offline = readMem().rugged !== undefined
  // The chart screen hangs on the back wall to Dex's right, so his raised arms never hide it.
  const screenTex = canvasTex(512, 300, (c) => drawScreen(c, coin, offline))
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), glow(screenTex)); screen.position.set(-0.62, 2.02, -0.775); g.add(screen)
  box(1.58, 0.96, 0.04, std(0x0b0c0f, 0.3, 0.5), -0.62, 2.02, -0.83)
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.4), glow(canvasTex(1024, 128, (c) => {
    c.fillStyle = '#120618'; c.fillRect(0, 0, 1024, 128)
    c.fillStyle = '#ffd23d'; c.font = `900 92px ${FONT}`; c.textAlign = 'center'; c.fillText('TO THE MOON', 512, 98)
  })))
  banner.position.set(0, 2.79, 1.235); g.add(banner)

  // Drinks: champagne on the counter and an ice bucket, a high-top table of glasses, and a glass in each fan's hand.
  const glass = std(0xffffff, 0.05, 0, { transparent: true, opacity: 0.32 })
  const fizz = std(0xf2d36b, 0.2, 0, { emissive: 0x6b5212, emissiveIntensity: 0.35 })
  const bottleGeo = new THREE.LatheGeometry([[0, 0], [0.04, 0], [0.042, 0.01], [0.042, 0.17], [0.036, 0.205], [0.015, 0.255], [0.014, 0.31], [0, 0.31]].map(([r, y]) => new THREE.Vector2(r, y)), 16)
  const fluteGeo = new THREE.LatheGeometry([[0, 0], [0.03, 0], [0.03, 0.005], [0.004, 0.012], [0.004, 0.095], [0.016, 0.11], [0.021, 0.15], [0.022, 0.2], [0.0, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 14)
  const bottleMat = std(0x0e3a22, 0.12, 0.35), foil = gold, labelMat = std(0xf3ead2, 0.6)
  const bottle = (x: number, y: number, z: number, tilt = 0, parent: THREE.Object3D = g) => {
    const b = new THREE.Group(); b.position.set(x, y, z); b.rotation.z = tilt
    const body = new THREE.Mesh(bottleGeo, bottleMat); body.castShadow = true; b.add(body)
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.0165, 0.02, 0.075, 12), foil); neck.position.y = 0.275; b.add(neck)
    const label = new THREE.Mesh(new THREE.CylinderGeometry(0.0425, 0.0425, 0.07, 16, 1, true), labelMat); label.position.y = 0.09; b.add(label)
    parent.add(b); return b
  }
  const flute = (x: number, y: number, z: number, parent: THREE.Object3D = g) => {
    const f = new THREE.Group(); f.position.set(x, y, z)
    f.add(new THREE.Mesh(fluteGeo, glass))
    const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.015, 0.07, 12), fizz); wine.position.y = 0.145; f.add(wine)
    parent.add(f); return f
  }
  const TOP = 1.065
  bottle(-0.95, TOP, 0.62); bottle(-0.78, TOP, 0.42)
  for (const [x, z] of [[-0.42, 0.72], [-0.28, 0.6], [0.3, 0.7], [0.46, 0.58]] as const) flute(x, TOP, z)
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.22, 20), std(0xd9dde2, 0.18, 0.95)); bucket.position.set(0.9, TOP + 0.11, 0.55); bucket.castShadow = true; g.add(bucket)
  const ice = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), std(0xe8f4ff, 0.1, 0, { transparent: true, opacity: 0.8 })); ice.position.set(0.9, TOP + 0.2, 0.55); g.add(ice)
  bottle(0.88, TOP + 0.04, 0.55, 0.3)
  // High-top table on the plaza side, with a bottle and glasses.
  const tx = -2.55, tz = 0.55
  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24), std(0x111318, 0.2, 0.6)); tableTop.position.set(tx, 1.06, tz); tableTop.castShadow = true; g.add(tableTop)
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.012, 6, 32), gold); rim.rotation.x = Math.PI / 2; rim.position.set(tx, 1.06, tz); g.add(rim)
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.02, 10), steel); stem.position.set(tx, 0.53, tz); g.add(stem)
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.03, 20), steel); foot.position.set(tx, 0.015, tz); g.add(foot)
  bottle(tx - 0.1, 1.08, tz - 0.08)
  flute(tx + 0.12, 1.08, tz + 0.06); flute(tx + 0.02, 1.08, tz + 0.16)

  // Dex: a tuxedo, shades, a gold chain and a gold watch, arms up. Two fans cheering in front, glasses raised.
  const dex = posedHuman('look_tux', { pose: 'cheer', height: 1.8, look: { top: 0x6b2bd9, bottom: 0x16171a, shoes: 0x16171a }, extras: { shades: true, necklace: 'chain', watch: 'gold' }, detail: 0.8 })
  dex.position.set(0.55, 0.08, -0.1); g.add(dex)
  const withGlass = (who: THREE.Group) => () => {
    const hand = who.getObjectByName('Bip01_R_Hand')
    if (!hand) return
    who.updateMatrixWorld(true)
    const at = who.worldToLocal(hand.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, 0.02, 0.03))
    const f = flute(at.x, at.y, at.z, who); f.scale.setScalar(1 / (who.scale.x || 1))
    hand.attach(f); f.traverse((n) => { n.userData.ghost = true })
  }
  const fanA: THREE.Group = posedHuman('woman3', { pose: 'cheer', height: 1.66, look: { top: 0x25e07a }, onReady: () => withGlass(fanA)() }); fanA.position.set(-1.75, 0, 1.75); fanA.rotation.y = Math.PI + 0.5; g.add(fanA)
  const fanB: THREE.Group = posedHuman('man2', { pose: 'cheer', height: 1.78, look: { top: 0xff3dd6 }, onReady: () => withGlass(fanB)() }); fanB.position.set(1.6, 0, 1.95); fanB.rotation.y = Math.PI - 0.5; g.add(fanB)
  g.traverse((n) => { n.userData.ghost = true })
  // The stall, counter and drinks never move: one draw per material (people, bulbs and the screen stay their own).
  mergeStatic(g, { skip: (n) => n === dex || n === fanA || n === fanB || n === screen || n === bulbs, byLook: true })
  o.obstacles.push({ kind: 'box', x: o.at.x, z: o.at.z + 0.12, hx: 1.62, hz: 1.1 }, { kind: 'circle', x: o.at.x + tx, z: o.at.z + tz, r: 0.42 })

  const spot: Hotspot = { id: 'pitch', x: o.at.x, z: o.at.z + 2.0, r: 1.7, title: 'The Pitch', body: '', enter: '', use: () => open() }
  const paintSpot = () => {
    if (offline) { spot.body = `The booth is dark. ${PROMOTER} is gone, and so is the liquidity. He will be back tomorrow with a new coin.`; spot.enter = 'What happened here?' }
    else { spot.body = `${PROMOTER} is pushing ${coin.name} ($${coin.sym}), a coin that "cannot lose". Hear him out: practice money only.`; spot.enter = 'Hear the pitch' }
  }
  const goDark = () => {
    offline = true
    dex.visible = false; fanA.visible = false; fanB.visible = false
    drawScreen(screenTex.image.getContext('2d') as CanvasRenderingContext2D, coin, true); screenTex.needsUpdate = true
    paintSpot()
  }
  paintSpot()
  if (offline) goDark()

  // ---- the cards
  let asked: string[] = []
  /** While a buy is live, opening the booth again shows that same run (one pump, one rug). */
  let reopenLive: (() => void) | null = null
  const shell = (kick: string, title: string) => {
    document.getElementById('gd-modal')?.remove()
    const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
    shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', title)
    const card = el('div', '', 'gm-card gm-pitch')
    const head = el('div', '', 'gm-head'), t = el('div')
    t.append(el('p', kick, 'gm-kick'), el('h3', title, 'gm-title'))
    const close = () => { stopSpeaking(); shade.remove() }
    head.append(t, key('Close', 'gm-ghost', close)); card.append(head); shade.append(card); document.body.append(shade)
    return { card, close }
  }
  const open = () => {
    if (reopenLive) { reopenLive(); return }
    const m = readMem()
    if (m.rugged) { lesson('rugged', m.rugged.asked, m.rugged.stake, m.rugged.tries); return }
    asked = []
    pitch(true)
  }
  const pitch = (fresh: boolean) => {
    const { card, close } = shell('The Pitch · outside the Conference Centre', `${PROMOTER} · ${coin.name} ($${coin.sym})`)
    const lines = pitchLines(coin)
    const say = el('div', '', 'pt-say'); for (const l of lines) say.append(el('p', `"${l}"`))
    card.append(say)
    if (fresh) speak(lines.join(' '), { gender: 'm', seed: 17 })
    card.append(el('p', 'Ask him anything before you decide.', 'gm-sub'))
    const qs = el('div', '', 'pt-qs')
    for (const q of QUESTIONS) {
      const row = el('div', '', 'pt-q')
      if (asked.includes(q.id)) {
        row.append(el('p', q.ask, 'pt-ask'), el('p', `"${q.answer}"`, 'pt-ans'), el('p', `Red flag: ${q.flag}`, 'pt-flag'))
      } else {
        row.append(key(q.ask, 'pt-askkey', () => { asked.push(q.id); speak(q.answer, { gender: 'm', seed: 17 }); pitch(false) }))
      }
      qs.append(row)
    }
    card.append(qs)
    if (asked.length) card.append(el('p', `Red flags so far: ${asked.length}`, 'gm-hint'))
    const keys = el('div', '', 'gm-keys')
    keys.append(key('Walk away', 'gm-ghost', () => { close(); lesson('walked', asked, 0, 0) }), key(`Buy ${coin.sym}`, 'gm-go', () => buy()))
    card.append(keys)
  }
  const buy = () => {
    const { card } = shell('The Pitch · presale', `Buy ${coin.name} ($${coin.sym})`)
    card.append(el('p', `"Smart. Get in before the big names do." Practice money only: this comes out of your in-game balance.`, 'gm-sub'))
    const keys = el('div', '', 'gm-keys')
    for (const s of STAKES) keys.append(key(`${money(s)}`, 'gm-go', () => {
      const r = spendInGame(s, `Bought ${coin.sym} at the presale`, `The Pitch: ${PROMOTER}'s ${coin.name}`)
      if (!r.ok) { o.toast(r.message); return }
      live(s)
    }))
    keys.append(key('Back', 'gm-ghost', () => pitch(false)))
    card.append(keys)
  }
  const live = (stake: number) => {
    const t0 = performance.now(), rugAt = rugTime(t0), hist: number[] = []
    let tries = 0, done = false, lastTick = -1
    const TICKER = [`${PROMOTER}: Told you. Hold, do not sell.`, '@degen_dana: aped my rent money, LFG', '@chartwizard: next stop 10x, easy', `${PROMOTER}: Diamond hands only.`, '@moonboi: just bought more']
    const build = () => {
      const { card } = shell(`The Pitch · $${coin.sym} live`, `${coin.name} is pumping`)
      const cv = el('canvas', '', 'pt-chart'); cv.width = 880; cv.height = 300
      const val = el('p', '', 'pt-val'), tick = el('p', '', 'pt-tick'), err = el('p', '', 'pt-err')
      const sell = key('Sell now', 'gm-go', () => {
        if (done) return
        tries++
        err.textContent = `Sell failed (${tries}): execution reverted. This contract only lets the creator's wallets sell. You are holding a honeypot.`
      })
      card.append(cv, val, tick, err)
      const keys = el('div', '', 'gm-keys'); keys.append(sell); card.append(keys)
      return { cv, val, tick, err, sell, keys }
    }
    let ui = build()
    reopenLive = () => { ui = build() }
    const draw = (p: number, t: number) => {
      const c = ui.cv.getContext('2d')!; const W = ui.cv.width, H = ui.cv.height
      c.fillStyle = '#0a0d12'; c.fillRect(0, 0, W, H)
      const top = Math.max(3, ...hist) * 1.1, n = Math.max(2, hist.length)
      c.lineWidth = 5; c.strokeStyle = t >= rugAt ? '#ff3b4e' : '#25e07a'; c.beginPath()
      hist.forEach((v, i) => { const x = 16 + (i / (n - 1)) * (W - 32), y = H - 16 - (v / top) * (H - 40); if (i) c.lineTo(x, y); else c.moveTo(x, y) })
      c.stroke()
      ui.val.textContent = `Your ${money(stake)} is worth ${money(stake * p)} (${p >= 1 ? '+' : ''}${Math.round((p - 1) * 100)}%)`
    }
    const step = () => {
      if (done) return
      const t = (performance.now() - t0) / 1000, p = priceAt(t, rugAt)
      hist.push(p)
      if (document.getElementById('gd-modal') && ui.cv.isConnected) {
        draw(p, t)
        const k = Math.floor(t / 3)
        if (k !== lastTick && t < rugAt) { lastTick = k; ui.tick.textContent = TICKER[k % TICKER.length]! }
      }
      if (t >= rugAt + 1.4) {
        done = true; reopenLive = null
        const m = readMem(); m.rugged = { stake, asked: [...asked], tries }; writeMem(m)
        goDark()
        if (document.getElementById('gd-modal') && ui.cv.isConnected) {
          draw(priceAt(t, rugAt), t)
          ui.tick.textContent = `The creator just pulled the liquidity. $${coin.sym} is worth $0.00. ${PROMOTER} has gone quiet.`
          ui.tick.className = 'pt-tick pt-dead'
          ui.keys.replaceChildren(key('What just happened?', 'gm-go', () => lesson('rugged', asked, stake, tries)))
        } else o.toast(`${coin.name} crashed to zero: the creator pulled the liquidity. Look at the booth to see what happened.`)
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }
  const lesson = (outcome: 'walked' | 'rugged', askedIds: string[], stake: number, tries: number) => {
    const { card, close } = shell('The Pitch · what just happened', outcome === 'walked' ? 'You walked away. That is the win.' : `Rugged: ${money(stake)} of practice money gone`)
    card.append(el('p', outcome === 'walked'
      ? 'Nothing lost, and you kept your time. Most people who hear a pitch like this one lose money.'
      : `In real life this money would be gone for good. Here it was practice.${tries ? ` You tried to sell ${tries} time${tries > 1 ? 's' : ''}: the contract never let you. That is a honeypot.` : ''} The creator then pulled the liquidity, so nobody could sell at any price.`, 'gm-sub'))
    const found = PITCH_FLAGS.length + askedIds.length
    card.append(el('p', `Red flags: ${found} of ${ALL_FLAGS} uncovered`, 'gm-hint'))
    const list = el('ul', '', 'pt-list')
    for (const f of PITCH_FLAGS) { const li = el('li', '', 'pt-li pt-got'); li.append(el('b', `${f.flag} (in the pitch)`), el('span', f.why)); list.append(li) }
    for (const q of QUESTIONS) {
      const got = askedIds.includes(q.id)
      const li = el('li', '', `pt-li ${got ? 'pt-got' : 'pt-miss'}`)
      li.append(el('b', got ? q.flag : `${q.flag} (missed: ask "${q.ask}")`), el('span', q.why)); list.append(li)
    }
    card.append(list)
    card.append(el('p', 'Before you buy any coin: check the liquidity is locked and for how long, read the holders on a block explorer, test a tiny sell first, find out who the team is, and treat any countdown as a reason to wait.', 'gm-sub'))
    const m = readMem()
    if (!m.rep) {
      const n = reputationFor(outcome, askedIds.length)
      addReputation(n, 'The Pitch', outcome === 'walked' ? 'Walked away from a coin that could not lose' : 'Learned a rug pull on practice money')
      personaNote(outcome === 'walked' ? 'pitch-walk' : 'pitch-rug')
      m.rep = true; writeMem(m)
      card.append(el('p', `Reputation +${n}`, 'gm-ok'))
    }
    const keys = el('div', '', 'gm-keys')
    keys.append(key('Done', 'gm-ghost', close), key('Study: Spotting scams & rug pulls', 'gm-go', () => { close(); o.openCourse('scams') }))
    card.append(keys)
  }
  return { spot }
}
