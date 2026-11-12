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
const SEND_HZ = 5
const BUBBLE_MS = 7000
const MAX_TEXT = 140

export type Me = { name: string; username: string; body: BodyId; tint: number }
type Wire = { id: string; name: string; username: string; body: BodyId; tint: number; x: number; z: number; yaw: number; moving: boolean; act?: Seat | null }
type Peer = Wire & { seating?: ReturnType<typeof createSeating>; actKey?: string; avatar: Avatar; tx: number; tz: number; seen: number; lastX: number; lastZ: number }

export type Net = {
  online: () => boolean
  peers: () => Array<{ x: number; z: number }>
  say: (text: string) => void
  /** Upload a short voice note to Storage and broadcast its URL to nearby players. */
  sayVoice: (blob: Blob, seconds: number) => Promise<void>
  canVoice: () => boolean
  tick: (dt: number, me: { x: number; z: number; yaw: number; moving: boolean; act?: Seat | null }) => void
  setMe: (me: Me) => void
  /** Peer under a ray (tap), or null. */
  /** Where a player is in the city right now (by username), or null if not in this city. */
  findPeer: (username: string) => { x: number; z: number } | null
  pick: (ray: THREE.Raycaster, maxAlong?: number) => { id: string; name: string; username: string; object: THREE.Object3D } | null
  /** Ask a peer for their public profile (encodeShare payload). Resolves null after 4 s. */
  requestProfile: (peerId: string) => Promise<string | null>
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
}): Net {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const peers = new Map<string, Peer>()
  let me = options.me
  let pos: { x: number; z: number; yaw: number; moving: boolean; act?: Seat | null } = { x: 0, z: 0, yaw: 0, moving: false }
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
      peer = { ...wire, avatar, tx: wire.x, tz: wire.z, seen: performance.now(), lastX: wire.x, lastZ: wire.z }
      peers.set(wire.id, peer)
    }
    if (peer.tint !== wire.tint) peer.avatar.setStyle(wire.tint, false)
    Object.assign(peer, { name: wire.name, username: wire.username, tint: wire.tint, yaw: wire.yaw, moving: wire.moving })
    // Synced actions: sit / lie / workout pose on the peer's rig.
    const act = wire.act && typeof wire.act.x === 'number' ? { x: +wire.act.x, z: +wire.act.z, yaw: +wire.act.yaw || 0, y: Math.min(1.2, Math.max(0, +wire.act.y || 0)), pose: (['sit', 'lie', 'workout'] as const).find((k) => k === wire.act!.pose) ?? 'sit' } : null
    const key = act ? `${act.x.toFixed(2)},${act.z.toFixed(2)},${act.pose}` : ''
    if (key !== (peer.actKey ?? '')) { peer.seating ??= createSeating(); peer.seating.stand(); if (act) peer.seating.sit(act, peer.avatar.object); peer.actKey = key }
    peer.tx = wire.x
    peer.tz = wire.z
    peer.seen = performance.now()
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
            const message = payload as { id: string; text: string; x: number; z: number; name: string }
            if (!near(message.x, message.z)) return
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
    say(raw) {
      const text = clean(raw)
      if (!text) return
      showBubble(options.getSelf(), text)
      options.onLine({ from: me.name || 'You', text, self: true })
      if (connected && channel) void channel.send({ type: 'broadcast', event: 'chat', payload: { id, text, x: pos.x, z: pos.z, name: me.name } })
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
      pos = self
      sendAcc += dt
      if (connected && channel && sendAcc > 1 / SEND_HZ) {
        sendAcc = 0
        void channel.send({ type: 'broadcast', event: 'pos', payload: wire() })
      }
      const now = performance.now()
      for (const [peerId, peer] of peers) {
        if (now - peer.seen > 15000) {
          drop(peerId)
          continue
        }
        const object = peer.avatar.object
        const glide = 1 - Math.exp(-8 * dt)
        object.position.x += (peer.tx - object.position.x) * glide
        object.position.z += (peer.tz - object.position.z) * glide
        const dx = object.position.x - peer.lastX
        const dz = object.position.z - peer.lastZ
        peer.lastX = object.position.x
        peer.lastZ = object.position.z
        const speed = Math.hypot(dx, dz) / Math.max(dt, 0.001)
        const moving = speed > 0.3
        peer.avatar.face(dx, dz, dt, moving)
        peer.avatar.step(dt, moving, speed)
        peer.seating?.apply(object, dt)
        // Far players stay drawn, but their plate and bubble only show within earshot.
        object.visible = Math.hypot(object.position.x - pos.x, object.position.z - pos.z) < 60
      }
    },
  }
}
