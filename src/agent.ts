// GDD §11: "Menu prompts players for Agents. A person is not an agent; agents attach to robots."
// An agent is never a person-shaped avatar: it always rides a small labeled robot that follows its owner.
import * as THREE from 'three'
import { label } from './npcs.ts'
import { AGENT_PROMPT, CURRENCY_NOTE } from './agentPrompt.ts'

export type AgentSpec = { label: string }
const KEY = 'gd.agent.v1'
const NOTIFY = 'gd.notify.v1'

export function getAgent(): AgentSpec | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as AgentSpec | null
    return v && typeof v.label === 'string' && v.label ? v : null
  } catch { return null }
}
function setAgent(spec: AgentSpec): void {
  localStorage.setItem(KEY, JSON.stringify({ label: spec.label }))
  window.dispatchEvent(new Event('gd-agent'))
}
/** Copy text on phones too: async Clipboard API, then a hidden-textarea execCommand fallback. */
export async function copyText(text: string): Promise<boolean> {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true } } catch { /* fall through */ }
  const ta = document.createElement('textarea')
  ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px'
  document.body.append(ta); ta.focus(); ta.select(); ta.setSelectionRange(0, text.length)
  let ok = false
  try { ok = document.execCommand('copy') } catch { ok = false }
  ta.remove()
  return ok
}

/** Agents screen: the full join prompt (with this player's one-time claim code) and a Copy prompt button.
 *  No email box: the agent registers itself through the API with its own email or ERC-8004 id. */
export function agentJoinForm(): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'stack agent-join'
  const prompt = document.createElement('pre')
  prompt.className = 'agent-prompt'
  prompt.dataset.noI18n = '' // the prompt is for the AI agent: always English
  // Signed out: the prompt is shown for reading only and the button never copies a placeholder
  // (a tester's agent once got "claim code invalid" from a copied '<claim code: sign in first>').
  prompt.textContent = AGENT_PROMPT.replaceAll('{{CLAIM}}', '••••••')
  const copyBtn = document.createElement('button')
  copyBtn.type = 'button'; copyBtn.className = 'primary agent-copy'
  const status = document.createElement('p')
  status.className = 'muted'
  const current = getAgent()
  const note = document.createElement('p')
  note.className = 'agent-note'
  note.textContent = CURRENCY_NOTE
  wrap.append(copyBtn, prompt, status, note)
  const signedIn = !!localStorage.getItem('gd.privy.username')
  const nearOnly = (localStorage.getItem('gd.privy.userId') ?? '').startsWith('near:')
  if (!signedIn || nearOnly) {
    copyBtn.textContent = 'Sign in to get your agent code'
    copyBtn.dataset.signin = '1'
    status.textContent = nearOnly
      ? 'Agent codes need a Google, X or email sign-in for now. NEAR sign-in cannot make one yet.'
      : 'Sign in first. Your copied prompt then carries a one-time claim code that links the agent to you.'
    copyBtn.onclick = () => { void import('./login.ts').then((l) => l.openLogin()) }
    return wrap
  }
  copyBtn.textContent = 'Copy prompt'
  status.textContent = current ? `Your agent: ${current.label}.` : 'Copy the prompt and paste it to your AI agent. It registers itself; this page updates when it joins.'
  let watching = false
  /** A fresh one-time code from the server (valid 30 min; each new code replaces the last). */
  const freshPrompt = async (): Promise<{ text: string; username: string; agent: string | null }> => {
    const token = await (await import('./login.ts')).accessToken().catch(() => null)
    if (!token) throw new Error('Your sign-in expired. Sign in again to get a code.')
    const r = await fetch('/api/profile?op=agent-code', { method: 'POST', headers: { authorization: `Bearer ${token}` } }).catch(() => null)
    const j = r && r.ok ? await r.json().catch(() => null) as { code?: string; username?: string; agent?: { label?: string } | null } | null : null
    if (!j?.code || !/^gdc_[\w-]{8,}$/.test(j.code)) throw new Error('Could not get an agent code. Try again.')
    return { text: AGENT_PROMPT.replaceAll('{{CLAIM}}', j.code), username: j.username ?? '', agent: j.agent?.label ?? null }
  }
  const watch = (username: string) => {
    if (watching) return
    watching = true
    const until = Date.now() + 30 * 60_000
    const tick = async () => {
      if (!wrap.isConnected) return
      if (Date.now() > until) { status.textContent = 'This claim code expired after 30 minutes. Tap Copy prompt again for a fresh one.'; watching = false; return }
      const pr = await fetch(`/api/messages?op=profile&u=${encodeURIComponent(username)}`, { headers: { authorization: `Bearer ${await (await import('./login.ts')).accessToken().catch(() => '')}` } }).catch(() => null)
      const pj = pr && pr.ok ? await pr.json().catch(() => null) as { profile?: { agent?: string | null } } | null : null
      if (pj?.profile?.agent) { setAgent({ label: pj.profile.agent }); status.textContent = `Agent joined: ${pj.profile.agent}. Your profile now shows the Agent label.`; return }
      window.setTimeout(() => void tick(), 8000)
    }
    window.setTimeout(() => void tick(), 8000)
  }
  copyBtn.onclick = async () => {
    copyBtn.disabled = true
    copyBtn.textContent = 'Getting a fresh code…'
    const pending = freshPrompt()
    let ok = false
    let got: Awaited<typeof pending> | null = null
    try {
      // ClipboardItem with a promise keeps the tap's permission while the code loads (iOS Safari).
      const CI = (window as unknown as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem
      if (CI && navigator.clipboard?.write && window.isSecureContext) {
        await navigator.clipboard.write([new CI({ 'text/plain': pending.then((g) => new Blob([g.text], { type: 'text/plain' })) })])
        ok = true
      }
    } catch { ok = false }
    try { got = await pending } catch (e) {
      copyBtn.disabled = false; copyBtn.textContent = 'Copy prompt'
      status.textContent = (e as Error).message
      return
    }
    prompt.textContent = got.text
    if (!ok) ok = await copyText(got.text)
    copyBtn.disabled = false
    copyBtn.textContent = ok ? 'Copied ✓' : 'Select and copy the text above'
    if (!ok) { const r = document.createRange(); r.selectNodeContents(prompt); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r) }
    window.setTimeout(() => { copyBtn.textContent = 'Copy prompt' }, 2000)
    if (got.agent) { setAgent({ label: got.agent }); status.textContent = `Your agent: ${got.agent}. This new code links a new agent (valid 30 min).` }
    else status.textContent = 'Copied with a fresh one-time claim code (valid 30 min). Waiting for your agent to register…'
    watch(got.username)
  }
  return wrap
}
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
    if (spec) { tag = label(spec.label, 'AI agent'); tag.position.y -= 0.6; root.add(tag) }
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
