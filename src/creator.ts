// First-time avatar creator shown right after Sign up / username claim.
// Body + face shape, free modest clothes (incl. kaftan/abaya). No makeup. Paid boutique pieces stay paid.
// Live face+body preview updates as options change.
import { setBody } from './state.ts'
import { setMorph, getMorph, HAIRS, SKIN_TONES, FACE_SHAPES } from './morph.ts'
import { PIECES, own, wear, worn, type Piece } from './wardrobe.ts'
import { mountCreatorPreview } from './creatorPreview.ts'

const KEY = 'gd.avatar.created'

export const needsAvatarCreator = (): boolean => {
  try { return localStorage.getItem(KEY) !== '1' } catch { return true }
}
export const markAvatarCreated = (): void => {
  try { localStorage.setItem(KEY, '1') } catch { /* private */ }
  try { if (!localStorage.getItem('gd.morph.v1')) setMorph({ h: 1, b: 1, f: 1 }) } catch { /* */ }
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => {
  const n = document.createElement(tag)
  if (text) n.textContent = text
  if (cls) n.className = cls
  return n
}

const FREE_MODEST: Array<{ id: string; note: string }> = [
  { id: 'tee-ivory', note: 'Free tee' },
  { id: 'kaftan-sand', note: 'Free kaftan' },
  { id: 'abaya-ink', note: 'Free abaya' },
  { id: 'jeans-indigo', note: 'Free jeans' },
  { id: 'sneakers-white', note: 'Free sneakers' },
]

/** Fill a container with the join-time creator. Calls onDone when the player taps Continue. */
export function mountAvatarCreator(root: HTMLElement, onDone: () => void): void {
  root.replaceChildren()
  let body: 'player' | 'zuri' = 'player'
  const previewHost = el('div', '', 'creator-preview-host')
  const controls = el('div', '', 'creator-controls')
  const preview = mountCreatorPreview(previewHost, () => body)

  const paint = () => {
    // Body
    const bodies = el('div', '', 'tabs')
    for (const [id, label] of [['player', 'Gentleman'], ['zuri', 'Lady']] as const) {
      const b = el('button', label, id === body ? 'glass-btn primary' : 'glass-btn ghost')
      b.type = 'button'
      b.onclick = () => { body = id; setBody(id); paint(); preview.refresh() }
      bodies.append(b)
    }
    // Sliders
    const mo = getMorph()
    const slider = (label: string, key: 'h' | 'b' | 'f', min: number, max: number) => {
      const row = el('label', '', 'morph-row')
      row.append(el('span', label))
      const r = document.createElement('input')
      r.type = 'range'; r.min = String(min); r.max = String(max); r.step = '0.01'
      r.value = String(key === 'f' ? (mo.f ?? 1) : mo[key])
      r.oninput = () => { setMorph({ [key]: Number(r.value) }); preview.refresh() }
      row.append(r)
      return row
    }
    // Face presets
    const faces = el('div', '', 'tabs')
    for (const fs of FACE_SHAPES) {
      const on = Math.abs((mo.f ?? 1) - fs.f) < 0.02
      const b = el('button', fs.label, on ? 'glass-btn primary' : 'glass-btn ghost')
      b.type = 'button'
      b.onclick = () => { setMorph({ f: fs.f }); paint(); preview.refresh() }
      faces.append(b)
    }
    // Hair
    const hairs = el('div', '', 'tabs')
    for (const hc of HAIRS) {
      const on = mo.hair === hc.hex
      const b = el('button', hc.label, on ? 'glass-btn primary' : 'glass-btn ghost')
      b.type = 'button'
      b.onclick = () => { setMorph({ hair: hc.hex }); paint(); preview.refresh() }
      hairs.append(b)
    }
    // Skin
    const tones = el('div', '', 'tabs skin-tones')
    for (const st of SKIN_TONES) {
      const on = mo.skin === st.hex
      const b = el('button', '', on ? 'glass-btn primary' : 'glass-btn ghost')
      b.type = 'button'
      b.title = st.label
      b.setAttribute('aria-label', `Skin ${st.label}`)
      b.style.setProperty('background', `#${st.hex.toString(16).padStart(6, '0')}`, 'important')
      b.onclick = () => { setMorph({ skin: st.hex }); paint(); preview.refresh() }
      tones.append(b)
    }
    // Free modest clothes
    const clothes = el('div', '', 'tabs')
    const w = worn()
    for (const item of FREE_MODEST) {
      const pc = PIECES.find((p) => p.id === item.id) as Piece | undefined
      if (!pc) continue
      if (pc.for === 'lady' && body !== 'zuri') continue
      if (pc.for === 'gent' && body !== 'player') continue
      const on = pc.slot === 'acc' ? w.acc.includes(pc.id) : w[pc.slot] === pc.id
      const b = el('button', pc.label, on ? 'glass-btn primary' : 'glass-btn ghost')
      b.type = 'button'
      b.title = item.note
      b.onclick = () => { own(pc.id); wear(pc); paint(); preview.refresh() }
      clothes.append(b)
    }

    const go = el('button', 'Continue into the district', 'glass-btn primary')
    go.type = 'button'
    go.onclick = () => {
      setBody(body)
      setMorph({ lip: null, blush: null }) // enforce no makeup
      markAvatarCreated()
      preview.dispose()
      onDone()
    }

    controls.replaceChildren(
      el('p', 'Create your look. Body and face shape, free modest clothes. No makeup.', 'muted'),
      el('p', 'Body', 'kicker'), bodies,
      el('p', 'Body shape', 'kicker'),
      slider('Height', 'h', 0.92, 1.08),
      slider('Build', 'b', 0.9, 1.15),
      el('p', 'Face shape', 'kicker'), faces,
      slider('Fine-tune face', 'f', 0.88, 1.12),
      el('p', 'Hair', 'kicker'), hairs,
      el('p', 'Skin', 'kicker'), tones,
      el('p', 'Free modest clothes', 'kicker'), clothes,
      el('p', 'Paid boutique pieces stay paid — open Boutique in the city later.', 'muted'),
      go,
    )
  }
  setBody(body)
  root.replaceChildren(previewHost, controls)
  paint()
  preview.refresh()
}
