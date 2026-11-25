import * as THREE from 'three'
import { bodyHit } from './npcs.ts'
import { createAvatar, type Avatar } from './avatars.ts'
import type { BodyId } from './logic.ts'
import { tagPlayer } from './player.ts'
import { createSeating, type Seat } from './seating.ts'

/**
 * Proximity text chat and shared positions over Supabase Realtime.
 *
 * Config (build-time, both public-safe): VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Without them, or when the socket cannot open, the city stays single-player and
 * chat bubbles only show above your own head. Nothing is stored server-side: the
 * channel uses broadcast and presence only, so no table or migration is needed.
 *
 * TODO(voice): proximity voice can reuse this channel for WebRTC signaling
 * (offer/answer/ice as broadcast events addressed by peer id), gated on distance.
 * It still needs a TURN server for phones behind carrier NAT, so it is not wired yet.
 */

export const HEAR_RADIUS = 12
const peerRingGeo = new THREE.RingGeometry(0.42, 0.52, 28)
const peerRingMat = new THREE.MeshBasicMaterial({ color: 0xd9b26a, transparent: true, opacity: 0.7, depthWrite: false, fog: false })
// Positions go out 8 times a second while you move or change pose, and as a 2.5 s heartbeat while you stand still
// (so an idle crowd costs almost nothing). Each one carries your velocity, so the receiver can keep the body moving
// smoothly between packets instead of easing toward stale points (that read as lag: surges, stops, gait flicker).
const SEND_HZ = 8
const IDLE_BEAT = 2.5
const LEAD_MAX = 0.4
const BUBBLE_MS = 7000
const MAX_TEXT = 140

export type Me = { name: string; username: string; body: BodyId; tint: number }
type Wire = { id: string; name: string; username: string; body: BodyId; tint: number; x: number; z: number; yaw: number; moving: boolean; act?: Seat | null; vx?: number; vz?: number; room?: string; emote?: string }
type Peer = Wire & { room?: string; emote?: string; seating?: ReturnType<typeof createSeating>; actKey?: string; avatar: Avatar; tx: number; tz: number; vx: number; vz: number; seen: number; lastX: number; lastZ: number }
/** room: '' in the city, else the shared room you are in ('room:gym', 'area:park') or one person's home
 * ('house:<host>', 'home:duplex:<host>'). You only see, hear and tap players in the same room. */
export type MeNow = { x: number; z: number; yaw: number; moving: boolean; act?: Seat | null; vx?: number; vz?: number; room?: string; emote?: string }
export type Visit = { from: string; name: string; room: string; home: string; label: string }
export type OnlinePlayer = { id: string; username: string; name: string; room: string; here: boolean }

export type Net = {
  online: () => boolean
  peers: () => Array<{ x: number; z: number }>
  say: (text: string) => void
  /** Upload a short voice note to Storage and broadcast its URL to nearby players. */
  sayVoice: (blob: Blob, seconds: number) => Promise<void>
  canVoice: () => boolean
  tick: (dt: number, me: MeNow) => void
  setMe: (me: Me) => void
  /** Peer under a ray (tap), or null. */
  /** Where a player is in the city right now (by username), or null if not in this city. */
  findPeer: (username: string) => { x: number; z: number } | null
  pick: (ray: THREE.Raycaster, maxAlong?: number) => { id: string; name: string; username: string; object: THREE.Object3D } | null
  /** Ask a peer for their public profile (encodeShare payload). Resolves null after 4 s. */
  requestProfile: (peerId: string) => Promise<string | null>
  /** Everyone in the city right now (presence), with where they are; `here` = in your room. */
  players: () => OnlinePlayer[]
  /** Invite a signed-in player (by username) to the room you are in (your home). */
  invite: (username: string, v: Omit<Visit, 'from' | 'name'>) => boolean
  /** This session's id (guests' homes are keyed by it). */
  id: () => string
  /** Grind Market: announce your stall, or buy from someone's (market.ts checks and answers). */
  market: (payload: Record<string, unknown>) => void
}

function bubble(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const g = canvas.getContext('2d')
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }))
  if (!g) return sprite
  g.font = '500 30px -apple-system, BlinkMacSystemFont, "Inter Variable", Inter, sans-serif'
  const words = text.split(/\s+/)
  const rows: string[] = []
  let row = ''
  for (const word of words) {
    const next = row ? `${row} ${word}` : word
    if (g.measureText(next).width > 440 && row) {
      rows.push(row)
      row = word
    } else row = next
    if (rows.length === 3) break
  }
  if (row && rows.length < 3) rows.push(row)
  const width = Math.min(480, Math.max(...rows.map((line) => g.measureText(line).width)) + 40)
  const height = rows.length * 38 + 26
  const left = (512 - width) / 2
  const top = 140 - height
  g.fillStyle = 'rgba(240, 255, 248, 0.95)'
  g.beginPath()
  g.roundRect(left, top, width, height, 22)
  g.fill()
  g.beginPath()
  g.moveTo(246, 140)
  g.lineTo(266, 140)
  g.lineTo(256, 156)
  g.fill()
  g.fillStyle = '#062117'
  g.textAlign = 'center'
  g.textBaseline = 'top'
  rows.forEach((line, index) => g.fillText(line, 256, top + 14 + index * 38))
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  sprite.material.map = texture
  sprite.scale.set(2.2, 0.69, 1)
  sprite.position.y = 2.95
  sprite.renderOrder = 10
  sprite.userData.ghost = true
  sprite.raycast = () => undefined
  return sprite
}

export function showBubble(root: THREE.Object3D, text: string): void {
  const previous = root.getObjectByName('chat-bubble')
  if (previous) {
    previous.removeFromParent()
    ;((previous as THREE.Sprite).material.map as THREE.Texture | null)?.dispose()
  }
  const sprite = bubble(text)
  sprite.name = 'chat-bubble'
  root.add(sprite)
  window.setTimeout(() => {
    if (sprite.parent) sprite.removeFromParent()
    sprite.material.map?.dispose()
    sprite.material.dispose()
  }, BUBBLE_MS)
}

export function clean(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT)
}

export function createNet(options: {
  scene: THREE.Scene
  me: Me
  getSelf: () => THREE.Object3D
  onLine: (line: { from: string; text: string; self: boolean; audio?: string }) => void
  onStatus: (online: boolean) => void
  /** Players in the city right now (presence, includes you). */
  onCount?: (n: number) => void
  /** Public profile payload (encodeShare: no emails, wallets, family requests or location). */
  getProfile?: () => string
  /** Someone invited you to their home. */
  onVisit?: (v: Visit) => void
  /** A Grind Market message (a stall announced, a purchase, an answer). */
  onMarket?: (m: Record<string, unknown>) => void
}): Net {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const peers = new Map<string, Peer>()
  let me = options.me
  let pos: MeNow = { x: 0, z: 0, yaw: 0, moving: false }
  let sentKey = ''
  let sinceSent = 0
  let channel: import('@supabase/supabase-js').RealtimeChannel | null = null
  let connected = false
  let storage: import('@supabase/supabase-js').SupabaseClient | null = null
  const VOICE = import.meta.env.VITE_VOICE_NOTES === '1'
  const BUCKET = 'voice-notes'
  let sendAcc = 0
  const waiting = new Map<string, (d: string | null) => void>()
  const answered = new Map<string, number>()

  const near = (x: number, z: number) => Math.hypot(x - pos.x, z - pos.z) <= HEAR_RADIUS

  const upsert = (wire: Wire) => {
    if (wire.id === id) return
    let peer = peers.get(wire.id)
    if (!peer || peer.body !== wire.body) {
      if (peer) options.scene.remove(peer.avatar.object)
      const avatar = createAvatar(wire.body, wire.tint, false)
      tagPlayer(avatar.object, clean(wire.name).slice(0, 24), clean(wire.username).slice(0, 16))
      // Real players get a soft gold ring at their feet so they never read as NPC passers-by.
      const ring = new THREE.Mesh(peerRingGeo, peerRingMat)
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; ring.userData.ghost = true; ring.raycast = () => undefined
      avatar.object.add(ring)
      avatar.object.position.set(wire.x, 0, wire.z)
      options.scene.add(avatar.object)
      peer = { ...wire, avatar, tx: wire.x, tz: wire.z, vx: 0, vz: 0, seen: performance.now(), lastX: wire.x, lastZ: wire.z }
      peers.set(wire.id, peer)
    }
    if (peer.tint !== wire.tint) peer.avatar.setStyle(wire.tint, false)
    Object.assign(peer, { name: wire.name, username: wire.username, tint: wire.tint, yaw: wire.yaw, moving: wire.moving, room: typeof wire.room === 'string' ? wire.room.slice(0, 80) : '', emote: wire.emote === 'dance' ? 'dance' : '' })
    peer.avatar.object.userData.dance = peer.emote === 'dance' ? 1 : 0
    // Synced actions: sit / lie / workout pose on the peer's rig.
    const act = wire.act && typeof wire.act.x === 'number' ? { x: +wire.act.x, z: +wire.act.z, yaw: +wire.act.yaw || 0, y: Math.min(1.2, Math.max(0, +wire.act.y || 0)), pose: (['sit', 'lie', 'workout'] as const).find((k) => k === wire.act!.pose) ?? 'sit' } : null
    const key = act ? `${act.x.toFixed(2)},${act.z.toFixed(2)},${act.pose}` : ''
    if (key !== (peer.actKey ?? '')) { peer.seating ??= createSeating(); peer.seating.stand(); if (act) peer.seating.sit(act, peer.avatar.object); peer.actKey = key }
    const nx = Number(wire.x) || 0, nz = Number(wire.z) || 0, at = performance.now()
    // Velocity: trust it only within a sane walking/running range. Older clients send none: estimate it from
    // the last two positions instead.
    let vx = Number(wire.vx), vz = Number(wire.vz)
    if (wire.vx === undefined) { const gap = Math.max(0.05, (at - peer.seen) / 1000); vx = (nx - peer.tx) / gap; vz = (nz - peer.tz) / gap }
    const v = Math.hypot(vx, vz)
    const ok = Number.isFinite(v) && v < 14 && wire.moving
    peer.vx = ok ? vx : 0; peer.vz = ok ? vz : 0
    peer.tx = nx
    peer.tz = nz
    peer.seen = at
  }

  const drop = (peerId: string) => {
    const peer = peers.get(peerId)
    if (!peer) return
    options.scene.remove(peer.avatar.object)
    peers.delete(peerId)
  }

  const wire = (): Wire => ({ id, ...me, ...pos })

  if (url && key) {
    void import('@supabase/supabase-js')
      .then(({ createClient }) => {
        const client = createClient(url, key, { realtime: { params: { eventsPerSecond: 10 } } })
        storage = client
        const room = client.channel('grind-district:city', { config: { broadcast: { self: false }, presence: { key: id } } })
        room
          .on('broadcast', { event: 'pos' }, ({ payload }) => upsert(payload as Wire))
          .on('broadcast', { event: 'chat' }, ({ payload }) => {
            const message = payload as { id: string; text: string; x: number; z: number; name: string; room?: string }
            if (!near(message.x, message.z) || (message.room ?? '') !== (pos.room ?? '')) return
            const text = clean(String(message.text ?? ''))
            if (!text) return
            const peer = peers.get(message.id)
            if (peer) showBubble(peer.avatar.object, text)
            options.onLine({ from: clean(String(message.name ?? '')) || 'Someone', text, self: false })
          })
          .on('broadcast', { event: 'voice' }, ({ payload }) => {
            const m = payload as { id: string; url: string; x: number; z: number; name: string; s: number }
            if (!VOICE || !near(m.x, m.z)) return
            // Only accept notes hosted in our own bucket.
            if (typeof m.url !== 'string' || !m.url.startsWith(`${url}/storage/v1/object/public/${BUCKET}/`)) return
            options.onLine({ from: clean(String(m.name ?? '')) || 'Someone', text: `voice note ${Math.round(Number(m.s) || 0)}s`, self: false, audio: m.url })
          })
          .on('broadcast', { event: 'prof-req' }, ({ payload }) => {
            const m = payload as { to: string; from: string }
            if (m.to !== id || !options.getProfile || typeof m.from !== 'string') return
            const now = Date.now()
            if (now - (answered.get(m.from) ?? 0) < 2000) return // one answer per asker every 2 s
            answered.set(m.from, now)
            void room.send({ type: 'broadcast', event: 'prof', payload: { to: m.from, from: id, d: options.getProfile().slice(0, 12000) } })
          })
          .on('broadcast', { event: 'prof' }, ({ payload }) => {
            const m = payload as { to: string; from: string; d: string }
            if (m.to !== id || typeof m.d !== 'string') return
            waiting.get(m.from)?.(m.d)
            waiting.delete(m.from)
          })
          .on('broadcast', { event: 'visit' }, ({ payload }) => {
            const m = payload as { to?: string; from?: string; name?: string; room?: string; home?: string; label?: string }
            const mine = clean(me.username).toLowerCase()
            if (!mine || mine === 'guest' || clean(String(m.to ?? '')).toLowerCase() !== mine) return
            const from = clean(String(m.from ?? '')).slice(0, 20), room = String(m.room ?? '').slice(0, 80)
            if (!from || !/^(house|home):/.test(room)) return
            const now = Date.now()
            if (now - (answered.get(`v:${from}`) ?? 0) < 8000) return // one invite per sender every 8 s
            answered.set(`v:${from}`, now)
            options.onVisit?.({ from, name: clean(String(m.name ?? '')).slice(0, 24) || from, room, home: String(m.home ?? '').slice(0, 20), label: clean(String(m.label ?? 'home')).slice(0, 40) })
          })
          .on('broadcast', { event: 'mkt' }, ({ payload }) => { if (payload && typeof payload === 'object' && JSON.stringify(payload).length < 600) options.onMarket?.(payload as Record<string, unknown>) })
          .on('presence', { event: 'leave' }, ({ key: gone }) => drop(String(gone)))
          .on('presence', { event: 'sync' }, () => { options.onCount?.(Object.keys(room.presenceState()).length) })
          .subscribe((status) => {
            connected = status === 'SUBSCRIBED'
            options.onStatus(connected)
            if (connected) {
              void room.track({ id, at: Date.now(), u: me.username })
              // Announce straight away so others see us without waiting for movement.
              void room.send({ type: 'broadcast', event: 'pos', payload: wire() })
            }
          })
        channel = room
      })
      .catch(() => options.onStatus(false))
  } else {
    queueMicrotask(() => options.onStatus(false))
  }

  return {
    online: () => connected,
    peers: () => [...peers.values()].map((peer) => ({ x: peer.avatar.object.position.x, z: peer.avatar.object.position.z })),
    findPeer(u) {
      const want = u.toLowerCase()
      for (const peer of peers.values()) if (clean(peer.username).toLowerCase() === want) return { x: peer.avatar.object.position.x, z: peer.avatar.object.position.z }
      return null
    },
    pick(ray, maxAlong = Infinity) {
      let best: { id: string; name: string; username: string; object: THREE.Object3D } | null = null
      let bestD = maxAlong // only players in front of where the tap meets the ground
      for (const [peerId, peer] of peers) {
        const o = peer.avatar.object
        if (!o.visible) continue
        // Capsule test around the standing body (slightly wider than residents: players are worth a tap).
        const along = bodyHit(ray.ray, o.position.x, o.position.z, 0.55)
        if (along !== null && along < bestD) { bestD = along; best = { id: peerId, name: clean(peer.name), username: clean(peer.username).toLowerCase(), object: o } }
      }
      return best
    },
    requestProfile(peerId) {
      if (!connected || !channel) return Promise.resolve(null)
      return new Promise((resolve) => {
        waiting.set(peerId, resolve)
        void channel!.send({ type: 'broadcast', event: 'prof-req', payload: { to: peerId, from: id } })
        window.setTimeout(() => { if (waiting.get(peerId) === resolve) { waiting.delete(peerId); resolve(null) } }, 4000)
      })
    },
    setMe(next) {
      me = next
    },
    id: () => id,
    market(payload) {
      if (!connected || !channel) return
      void channel.send({ type: 'broadcast', event: 'mkt', payload: { ...payload, from: id } })
    },
    players() {
      const out: OnlinePlayer[] = []
      const state = (channel?.presenceState() ?? {}) as Record<string, Array<{ id?: string; u?: string }>>
      for (const [key, metas] of Object.entries(state)) {
        if (key === id) continue
        const peer = peers.get(key), u = clean(String(metas[0]?.u ?? peer?.username ?? '')).toLowerCase()
        out.push({ id: key, username: u, name: clean(peer?.name ?? '') || (u && u !== 'guest' ? u : 'Guest'), room: peer?.room ?? '', here: !!peer && (peer.room ?? '') === (pos.room ?? '') })
      }
      return out.sort((a, b) => Number(b.here) - Number(a.here) || a.name.localeCompare(b.name))
    },
    invite(username, v) {
      if (!connected || !channel) return false
      const to = clean(username).toLowerCase()
      if (!to || to === 'guest') return false
      void channel.send({ type: 'broadcast', event: 'visit', payload: { to, from: me.username, name: me.name, ...v } })
      return true
    },
    say(raw) {
      const text = clean(raw)
      if (!text) return
      showBubble(options.getSelf(), text)
      options.onLine({ from: me.name || 'You', text, self: true })
      if (connected && channel) void channel.send({ type: 'broadcast', event: 'chat', payload: { id, text, x: pos.x, z: pos.z, name: me.name, room: pos.room ?? '' } })
    },
    canVoice: () => VOICE && connected && !!storage,
    async sayVoice(blob, seconds) {
      if (!VOICE || !storage || !channel) throw new Error('Voice notes are off')
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
      const path = `${new Date().toISOString().slice(0, 10)}/${id}-${Date.now()}.${ext}`
      const up = await storage.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false })
      if (up.error) throw up.error
      const publicUrl = storage.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
      options.onLine({ from: me.name || 'You', text: `voice note ${Math.round(seconds)}s`, self: true, audio: publicUrl })
      void channel.send({ type: 'broadcast', event: 'voice', payload: { id, url: publicUrl, x: pos.x, z: pos.z, name: me.name, s: seconds } })
    },
    tick(dt, self) {
      pos = { ...self, vx: Math.round((self.vx ?? 0) * 100) / 100, vz: Math.round((self.vz ?? 0) * 100) / 100, x: Math.round(self.x * 100) / 100, z: Math.round(self.z * 100) / 100, yaw: Math.round(self.yaw * 100) / 100 }
      sendAcc += dt
      sinceSent += dt
      if (connected && channel && sendAcc > 1 / SEND_HZ) {
        sendAcc = 0
        // Moving: every tick. Standing: only when the pose, seat or facing changed, or as a heartbeat.
        const key = `${pos.moving ? 1 : 0}|${pos.act ? `${pos.act.x},${pos.act.z},${pos.act.pose}` : ''}|${Math.round(pos.yaw * 4)}|${Math.round(pos.x * 2)},${Math.round(pos.z * 2)}|${pos.room ?? ''}|${pos.emote ?? ''}`
        if (pos.moving || key !== sentKey || sinceSent > IDLE_BEAT) {
          sentKey = key; sinceSent = 0
          void channel.send({ type: 'broadcast', event: 'pos', payload: wire() })
        }
      }
      const now = performance.now()
      for (const [peerId, peer] of peers) {
        if (now - peer.seen > 15000) {
          drop(peerId)
          continue
        }
        const object = peer.avatar.object
        // Where they are now: the last position plus their velocity since it arrived (capped, so a dropped
        // packet never sends anyone sailing off), then a firm spring toward it. Far jumps (a teleport) snap.
        const lead = Math.min(LEAD_MAX, (now - peer.seen) / 1000)
        const gx = peer.tx + peer.vx * lead, gz = peer.tz + peer.vz * lead
        if (Math.hypot(gx - object.position.x, gz - object.position.z) > 6) object.position.set(gx, object.position.y, gz)
        else {
          const k = 1 - Math.exp(-12 * dt)
          object.position.x += (gx - object.position.x) * k
          object.position.z += (gz - object.position.z) * k
        }
        peer.lastX = object.position.x
        peer.lastZ = object.position.z
        const speed = Math.hypot(peer.vx, peer.vz)
        const moving = peer.moving && speed > 0.3 && !peer.actKey
        if (moving) peer.avatar.face(peer.vx, peer.vz, dt, true)
        else if (!peer.actKey) peer.avatar.face(Math.sin(peer.yaw), Math.cos(peer.yaw), dt, true)
        peer.avatar.step(dt, moving, speed)
        peer.seating?.apply(object, dt)
        // Only players in the same room (the city, a venue, or the same person's home) are drawn, out to 60 m.
        object.visible = (peer.room ?? '') === (pos.room ?? '') && Math.hypot(object.position.x - pos.x, object.position.z - pos.z) < 60
      }
    },
  }
}
