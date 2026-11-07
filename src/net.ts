import * as THREE from 'three'
import { createAvatar, type Avatar } from './avatars.ts'
import type { BodyId } from './logic.ts'
import { tagPlayer } from './player.ts'

/**
 * Proximity text chat and shared positions over Supabase Realtime.
 *
 * Config (build-time, both public-safe): VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
 * Without them, or when the socket cannot open, the city stays single-player and
 * optional chat stays local. Chat requires an explicit UI capability; the current
 * game does not enable it. Nothing is stored server-side: the
 * channel uses broadcast and presence only, so no table or migration is needed.
 *
 * TODO(voice): proximity voice can reuse this channel for WebRTC signaling
 * (offer/answer/ice as broadcast events addressed by peer id), gated on distance.
 * It still needs a TURN server for phones behind carrier NAT, so it is not wired yet.
 */

export const HEAR_RADIUS = 12
const SEND_HZ = 5
const BUBBLE_MS = 7000
const MAX_TEXT = 140

export type Me = { name: string; username: string; body: BodyId; tint: number }
type Wire = { id: string; name: string; username: string; body: BodyId; tint: number; x: number; z: number; yaw: number; moving: boolean }
type Peer = Wire & { avatar: Avatar; tx: number; tz: number; seen: number; lastX: number; lastZ: number }

export type Net = {
  online: () => boolean
  peers: () => Array<{ x: number; z: number }>
  say: (text: string) => void
  tick: (dt: number, me: { x: number; z: number; yaw: number; moving: boolean }) => void
  setMe: (me: Me) => void
}

function bubble(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const g = canvas.getContext('2d')
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false }))
  if (!g) return sprite
  g.font = '500 30px Outfit, sans-serif'
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
  chat?: {
    getSelf: () => THREE.Object3D
    onLine: (line: { from: string; text: string; self: boolean }) => void
  }
  onStatus?: (online: boolean) => void
}): Net {
  const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined
  const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const peers = new Map<string, Peer>()
  let me = options.me
  let pos = { x: 0, z: 0, yaw: 0, moving: false }
  let channel: import('@supabase/supabase-js').RealtimeChannel | null = null
  let connected = false
  let sendAcc = 0

  const near = (x: number, z: number) => Math.hypot(x - pos.x, z - pos.z) <= HEAR_RADIUS

  const upsert = (wire: Wire) => {
    if (wire.id === id) return
    let peer = peers.get(wire.id)
    if (!peer || peer.body !== wire.body) {
      if (peer) options.scene.remove(peer.avatar.object)
      const avatar = createAvatar(wire.body, wire.tint, false)
      tagPlayer(avatar.object, clean(wire.name).slice(0, 24), clean(wire.username).slice(0, 16))
      avatar.object.position.set(wire.x, 0, wire.z)
      options.scene.add(avatar.object)
      peer = { ...wire, avatar, tx: wire.x, tz: wire.z, seen: performance.now(), lastX: wire.x, lastZ: wire.z }
      peers.set(wire.id, peer)
    }
    if (peer.tint !== wire.tint) peer.avatar.setStyle(wire.tint, false)
    Object.assign(peer, { name: wire.name, username: wire.username, tint: wire.tint, yaw: wire.yaw, moving: wire.moving })
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
        const room = client.channel('grind-district:city', { config: { broadcast: { self: false }, presence: { key: id } } })
        room.on('broadcast', { event: 'pos' }, ({ payload }) => upsert(payload as Wire))
        const chat = options.chat
        if (chat) room.on('broadcast', { event: 'chat' }, ({ payload }) => {
            const message = payload as { id: string; text: string; x: number; z: number; name: string }
            if (!near(message.x, message.z)) return
            const text = clean(String(message.text ?? ''))
            if (!text) return
            const peer = peers.get(message.id)
            if (peer) showBubble(peer.avatar.object, text)
            chat.onLine({ from: clean(String(message.name ?? '')) || 'Someone', text, self: false })
          })
        room.on('presence', { event: 'leave' }, ({ key: gone }) => drop(String(gone)))
          .subscribe((status) => {
            connected = status === 'SUBSCRIBED'
            options.onStatus?.(connected)
            if (connected) void room.track({ id, at: Date.now() })
          })
        channel = room
      })
      .catch(() => options.onStatus?.(false))
  } else {
    queueMicrotask(() => options.onStatus?.(false))
  }

  return {
    online: () => connected,
    peers: () => [...peers.values()].map((peer) => ({ x: peer.avatar.object.position.x, z: peer.avatar.object.position.z })),
    setMe(next) {
      me = next
    },
    say(raw) {
      const chat = options.chat
      if (!chat) return // No public chat UI/capability: do not render or broadcast conversations.
      const text = clean(raw)
      if (!text) return
      showBubble(chat.getSelf(), text)
      chat.onLine({ from: me.name || 'You', text, self: true })
      if (connected && channel) void channel.send({ type: 'broadcast', event: 'chat', payload: { id, text, x: pos.x, z: pos.z, name: me.name } })
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
        // Far players stay drawn, but their plate and bubble only show within earshot.
        object.visible = Math.hypot(object.position.x - pos.x, object.position.z - pos.z) < 60
      }
    },
  }
}
