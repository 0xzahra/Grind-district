import * as THREE from 'three'
import { createNet } from './net.ts'
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
// No browser DOM and no public Supabase configuration. Presence initialization must
// remain usable offline, and disabled chat must never try to create speech bubbles.
const scene = new THREE.Scene()
const net = createNet({ scene, me: { name: 'Test', username: 'test', body: 'player', tint: 0x123456 } })
net.say('This must never render or broadcast')
net.tick(0.1, { x: 3, z: 12, yaw: 0, moving: false })
check(scene.children.length === 0, 'disabled public chat creates no bubbles or DOM')
check(!net.online() && net.peers().length === 0, 'offline presence initializes without orphan UI callbacks')
net.setMe({ name: 'Test', username: 'test', body: 'zuri', tint: 0x654321 })
check(net.peers().length === 0, 'identity update remains available independently of chat')
console.log('presence-only startup and disabled public-chat checks passed')
