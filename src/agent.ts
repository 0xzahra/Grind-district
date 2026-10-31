// GDD §11: "Menu prompts players for Agents. AI agents are labeled and must attach to robots."
// An agent is never a person-shaped avatar: it always rides a small labeled robot that follows its owner.
import * as THREE from 'three'
import { label } from './npcs.ts'

export type AgentSpec = { name: string; role: string }
const KEY = 'gd.agent.v1'
const NOTIFY = 'gd.notify.v1'

export function getAgent(): AgentSpec | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as AgentSpec | null
    return v && typeof v.name === 'string' && v.name.trim() ? v : null
  } catch { return null }
}
export function setAgent(spec: AgentSpec | null): void {
  if (!spec) localStorage.removeItem(KEY)
  else localStorage.setItem(KEY, JSON.stringify({ name: spec.name.trim().slice(0, 20), role: spec.role.slice(0, 24) }))
  window.dispatchEvent(new Event('gd-agent'))
}
export const agentPrompted = () => localStorage.getItem(KEY + '.asked') === '1'
export const markAgentPrompted = () => localStorage.setItem(KEY + '.asked', '1')
export const notificationsOn = () => localStorage.getItem(NOTIFY) !== '0'
export const setNotifications = (on: boolean) => localStorage.setItem(NOTIFY, on ? '1' : '0')

/** Lightweight companion robot (5 meshes, shared materials, no GLB, no shadows besides body). */
export function createAgentCompanion(scene: THREE.Scene): { tick: (dt: number, target: THREE.Vector3) => void } {
  const root = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.4, metalness: 0.55 })
  const glass = new THREE.MeshStandardMaterial({ color: 0xd9c08a, emissive: 0xd9c08a, emissiveIntensity: 0.5, roughness: 0.3 })
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.22, 4, 10), shell)
  body.position.y = 0.62
  body.castShadow = true
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.18, 0.22), shell)
  head.position.y = 0.95
  const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), glass)
  eye.position.set(0, 0.95, 0.111)
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 20), glass)
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.32
  root.add(body, head, eye, ring)
  let tag: THREE.Sprite | null = null
  const apply = () => {
    const spec = getAgent()
    root.visible = !!spec
    if (tag) { root.remove(tag); tag.material.map?.dispose(); tag.material.dispose() }
    tag = null
    if (spec) { tag = label(spec.name, `AI agent${spec.role ? ' · ' + spec.role : ''}`); tag.position.y -= 0.6; root.add(tag) }
  }
  apply()
  window.addEventListener('gd-agent', apply)
  scene.add(root)
  const goal = new THREE.Vector3()
  let t = 0
  let yaw = 0
  const last = new THREE.Vector3()
  return {
    tick(dt, target) {
      if (!root.visible) return
      const dx = target.x - last.x, dz = target.z - last.z
      if (dx * dx + dz * dz > 1e-5) yaw = Math.atan2(dx, dz)
      last.copy(target)
      t += dt
      goal.set(target.x - Math.sin(yaw) * 1.3 + Math.cos(yaw) * 0.9, 0, target.z - Math.cos(yaw) * 1.3 - Math.sin(yaw) * 0.9)
      const k = 1 - Math.exp(-4 * dt)
      if (root.position.distanceToSquared(goal) > 400) root.position.copy(goal)
      root.position.lerp(goal, k)
      root.position.y = Math.sin(t * 2.4) * 0.04
      root.rotation.y += (yaw - root.rotation.y) * k
    },
  }
}

/** API agents (registered via /api/agent-register) appear as labelled robots. Polls a public, read-only list. */
export function createRemoteAgents(scene: THREE.Scene): { tick: (dt: number) => void } {
  const shell = new THREE.MeshStandardMaterial({ color: 0x2a2f33, roughness: 0.4, metalness: 0.55 })
  const glass = new THREE.MeshStandardMaterial({ color: 0xd9c08a, emissive: 0xd9c08a, emissiveIntensity: 0.5, roughness: 0.3 })
  const bodyGeo = new THREE.CapsuleGeometry(0.16, 0.22, 4, 10)
  const headGeo = new THREE.BoxGeometry(0.26, 0.18, 0.22)
  const bots = new Map<string, { root: THREE.Group; goal: THREE.Vector3; name: string }>()
  const make = (name: string) => {
    const root = new THREE.Group()
    const body = new THREE.Mesh(bodyGeo, shell); body.position.y = 0.62; body.castShadow = true
    const head = new THREE.Mesh(headGeo, shell); head.position.y = 0.95
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), glass); eye.position.set(0, 0.95, 0.111)
    const tag = label(name, 'AI agent'); tag.position.y -= 0.6
    root.add(body, head, eye, tag)
    scene.add(root)
    return root
  }
  const poll = async () => {
    try {
      const r = await fetch('/api/agent-list', { signal: AbortSignal.timeout(5000) })
      const { agents = [] } = (await r.json()) as { agents?: Array<{ id: string; name: string; x: number; z: number }> }
      const seen = new Set<string>()
      for (const a of agents) {
        seen.add(a.id)
        let bot = bots.get(a.id)
        if (!bot) { bot = { root: make(a.name), goal: new THREE.Vector3(a.x, 0, a.z), name: a.name }; bot.root.position.copy(bot.goal); bots.set(a.id, bot) }
        bot.goal.set(a.x, 0, a.z)
      }
      for (const [id, bot] of bots) if (!seen.has(id)) { scene.remove(bot.root); bots.delete(id) }
    } catch { /* offline: keep last positions */ }
  }
  void poll()
  window.setInterval(() => { if (!document.hidden) void poll() }, 15000)
  return {
    tick(dt) {
      const k = 1 - Math.exp(-2 * dt)
      for (const bot of bots.values()) bot.root.position.lerp(bot.goal, k)
    },
  }
}
