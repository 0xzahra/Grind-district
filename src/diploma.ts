// Graduation: the Campus diploma. You graduate once every core course in the six Campus worlds is passed
// (missions and final checks); the ceremony itself is graduation.ts (lazy). This file is light: progress, the
// graduated flag beside the save, and the diploma drawn on a canvas to download or share.
import { getSave, slotKey } from './state.ts'
import { WORLDS } from './worlds.ts'

const KEY = () => `${slotKey()}.graduated`
export const CORE = (): string[] => WORLDS.flatMap((w) => [...w.missions, ...(w.boss ? [w.boss] : [])])
export function campusProgress(): { passed: number; total: number } {
  const s = getSave(), core = CORE()
  return { passed: core.filter((id) => (s.skills as Record<string, { passed?: boolean } | undefined>)[id]?.passed).length, total: core.length }
}
export const canGraduate = (): boolean => { const p = campusProgress(); return p.passed >= p.total }
export function graduatedOn(): string | null { try { return localStorage.getItem(KEY()) } catch { return null } }
export function markGraduated(): void { try { if (!localStorage.getItem(KEY())) localStorage.setItem(KEY(), new Date().toISOString().slice(0, 10)) } catch { /* private mode */ } }

/** The diploma: cream paper, a double green border, the Campus crest, the six worlds and Zahra's signature. */
export function diplomaCanvas(name: string, on: string): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = 1600; c.height = 1130
  const g = c.getContext('2d')!
  const F = '"Inter Variable", Inter, system-ui, sans-serif', S = 'Georgia, "Times New Roman", serif'
  const grad = g.createLinearGradient(0, 0, 1600, 1130); grad.addColorStop(0, '#fbf7ee'); grad.addColorStop(1, '#f1e8d6')
  g.fillStyle = grad; g.fillRect(0, 0, 1600, 1130)
  g.strokeStyle = '#14a058'; g.lineWidth = 14; g.strokeRect(40, 40, 1520, 1050)
  g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(70, 70, 1460, 990)
  // Crest: a laurel-ringed disc with a mortarboard.
  g.fillStyle = '#123524'; g.beginPath(); g.arc(800, 205, 78, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#d9b26a'; g.lineWidth = 5; g.beginPath(); g.arc(800, 205, 66, 0, Math.PI * 2); g.stroke()
  g.fillStyle = '#d9b26a'; g.beginPath(); g.moveTo(752, 198); g.lineTo(800, 176); g.lineTo(848, 198); g.lineTo(800, 220); g.closePath(); g.fill()
  g.fillRect(782, 210, 36, 22); g.fillRect(840, 198, 4, 30)
  g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillStyle = '#123524'; g.font = `800 34px ${F}`; g.fillText('GRIND DISTRICT CAMPUS', 800, 330)
  g.fillStyle = '#6b5a3a'; g.font = `italic 30px ${S}`; g.fillText('This is to certify that', 800, 400)
  g.fillStyle = '#14281d'; g.font = `700 86px ${S}`; g.fillText(name, 800, 490, 1300)
  g.fillStyle = '#c9a24a'; g.fillRect(500, 545, 600, 3)
  g.fillStyle = '#3a3428'; g.font = `400 30px ${S}`
  g.fillText('has completed every course in the six worlds of study', 800, 610)
  g.font = `600 26px ${F}`; g.fillStyle = '#123524'
  g.fillText(WORLDS.slice(0, 3).map((w) => w.title).join('  ·  '), 800, 662, 1380)
  g.fillText(WORLDS.slice(3).map((w) => w.title).join('  ·  '), 800, 702, 1380)
  g.fillStyle = '#3a3428'; g.font = `400 30px ${S}`; g.fillText('and is awarded the', 800, 772)
  g.fillStyle = '#14a058'; g.font = `800 56px ${S}`; g.fillText('Diploma in Web3 Foundations', 800, 840)
  // Date and signature lines.
  g.strokeStyle = '#6b5a3a'; g.lineWidth = 2
  for (const x of [470, 1130]) { g.beginPath(); g.moveTo(x - 190, 960); g.lineTo(x + 190, 960); g.stroke() }
  g.fillStyle = '#3a3428'; g.font = `400 26px ${F}`
  g.fillText(new Date(on).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 470, 930)
  g.fillText('Date of graduation', 470, 995)
  g.font = `italic 44px ${S}`; g.fillStyle = '#123524'; g.fillText('Zahra', 1130, 925)
  g.font = `400 26px ${F}`; g.fillStyle = '#3a3428'; g.fillText('Zahra, Campus mentor', 1130, 995)
  g.font = `600 20px ${F}`; g.fillStyle = '#8a7a5a'; g.fillText('grinddistrict.app', 800, 1040)
  return c
}

type H = { para: (text: string, c?: string) => HTMLElement; button: (text: string, c: string, f: () => void) => HTMLElement }
/** The Graduation panel: progress, or your diploma with download and share. */
export function diplomaNodes(h: H, attend: () => void): HTMLElement[] {
  const out: HTMLElement[] = []
  const p = campusProgress(), on = graduatedOn()
  if (!canGraduate()) {
    out.push(h.para(`Graduation comes when every core course in the six Campus worlds is passed: ${p.passed} of ${p.total} so far. ${p.total - p.passed} to go.`))
    out.push(h.para('Then there is a ceremony in the Great Hall: cap and gown, your name called, the diploma from Zahra on stage, and the cap toss.'))
    return out
  }
  if (!on) {
    out.push(h.para(`All ${p.total} courses passed. Your graduation is ready: cap and gown are waiting in the Great Hall.`))
    out.push(h.button('Attend your graduation 🎓', 'primary', attend))
    return out
  }
  const name = (getSave().name || getSave().username || 'Graduate').trim()
  const c = diplomaCanvas(name, on)
  const img = document.createElement('img'); img.src = c.toDataURL('image/png'); img.alt = `Diploma in Web3 Foundations, ${name}`; img.className = 'diploma-img'
  out.push(img)
  out.push(h.button('Download the diploma', 'primary', () => { const a = document.createElement('a'); a.href = img.src; a.download = 'grind-district-diploma.png'; a.click() }))
  out.push(h.button('Share on 𝕏', 'ghost', () => window.open(`https://x.com/intent/post?text=${encodeURIComponent('I just graduated from Grind District Campus with a Diploma in Web3 Foundations 🎓')}&url=${encodeURIComponent('https://www.grinddistrict.app')}`, '_blank', 'noopener')))
  out.push(h.button('Relive the ceremony', 'ghost', attend))
  return out
}
