import { rankFor, SKILL_META, type SkillId } from './logic.ts'
import { getSave } from './state.ts'
import { shareLink, shareOrCopy } from './share.ts'
import { track } from './track.ts'

const b64url = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Self-contained certificate id: the public page decodes it, no database needed. */
export function certId(course: SkillId): string {
  const s = getSave()
  return b64url(JSON.stringify({ n: s.name, u: s.username, r: rankFor(s.xp).label, c: course, t: SKILL_META[course].title, d: new Date().toISOString().slice(0, 10) }))
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
    setTimeout(() => resolve(null), 3000)
  })
}

async function paintCertificate(course: SkillId): Promise<HTMLCanvasElement> {
  const s = getSave()
  const c = document.createElement('canvas')
  c.width = 1200
  c.height = 850
  const g = c.getContext('2d')!
  const bg = g.createLinearGradient(0, 0, 1200, 850)
  bg.addColorStop(0, '#15130f')
  bg.addColorStop(1, '#0b0a08')
  g.fillStyle = bg
  g.fillRect(0, 0, 1200, 850)
  g.strokeStyle = '#c9a25e'
  g.lineWidth = 3
  g.strokeRect(36, 36, 1128, 778)
  g.lineWidth = 1
  g.strokeRect(50, 50, 1100, 750)
  const logo = await loadImage('/brand/lockup.png')
  if (logo) {
    g.globalCompositeOperation = 'lighten'
    g.drawImage(logo, 520, 80, 160, 108)
    g.globalCompositeOperation = 'source-over'
  }
  g.textAlign = 'center'
  g.fillStyle = '#d9c6a2'
  g.font = '500 22px Outfit, sans-serif'
  g.fillText('CERTIFICATE OF COMPLETION', 600, 240)
  g.fillStyle = '#f2ece0'
  g.font = '54px "Archivo Black", sans-serif'
  g.fillText(SKILL_META[course].title, 600, 330)
  g.font = '400 24px Outfit, sans-serif'
  g.fillStyle = '#bdb3a3'
  g.fillText('is awarded to', 600, 390)
  // Avatar medallion with initials and the tier.
  g.beginPath(); g.arc(600, 480, 54, 0, Math.PI * 2); g.fillStyle = '#1f1b15'; g.fill()
  g.strokeStyle = '#c9a25e'; g.lineWidth = 3; g.stroke()
  g.fillStyle = '#e8c98f'; g.font = '40px "Archivo Black", sans-serif'
  g.fillText((s.name || s.username || '?').slice(0, 2).toUpperCase(), 600, 495)
  g.fillStyle = '#f2ece0'; g.font = '44px "Archivo Black", sans-serif'
  g.fillText(s.name || s.username, 600, 600)
  g.fillStyle = '#c9a25e'; g.font = '500 26px Outfit, sans-serif'
  g.fillText(`@${s.username}  ·  ${rankFor(s.xp).label}`, 600, 645)
  g.fillStyle = '#8f8676'; g.font = '400 18px Outfit, sans-serif'
  g.fillText(`Issued ${new Date().toLocaleDateString()} in Grind District. Practice credential, earned by passing the course.`, 600, 735)
  return c
}

export async function openCertificate(course: SkillId): Promise<void> {
  document.getElementById('cert-dlg')?.remove()
  const dlg = document.createElement('div')
  dlg.id = 'cert-dlg'
  dlg.className = 'wallet-dlg cert-dlg'
  dlg.setAttribute('role', 'dialog')
  dlg.setAttribute('aria-label', 'Certificate')
  const canvas = await paintCertificate(course)
  canvas.style.width = '100%'
  canvas.style.borderRadius = '8px'
  const link = shareLink(`/cert/${certId(course)}`, 'cert', getSave().username)
  const share = document.createElement('button')
  share.className = 'primary'
  share.textContent = 'Share certificate'
  share.onclick = async () => {
    const r = await shareOrCopy(`${SKILL_META[course].title} certificate`, link, 'cert')
    if (r !== 'failed') track('cert_shared', { course })
    share.textContent = r === 'copied' ? 'Link copied' : r === 'shared' ? 'Shared' : 'Could not share'
  }
  const save = document.createElement('a')
  save.textContent = 'Download PNG'
  save.download = `grind-${course}-certificate.png`
  save.href = canvas.toDataURL('image/png')
  const close = document.createElement('button')
  close.className = 'ghost'
  close.textContent = 'Close'
  close.onclick = () => dlg.remove()
  dlg.append(canvas, share, save, close)
  document.body.append(dlg)
}

export function passedCount(): number {
  return Object.values(getSave().skills).filter((v) => v?.passed).length
}

export async function shareCv(): Promise<string> {
  const s = getSave()
  const link = shareLink(`/cv/${encodeURIComponent(s.username)}`, 'cv', s.username)
  const r = await shareOrCopy(`${s.name}'s Grind District CV`, link, 'cv')
  if (r !== 'failed') track('cv_shared', { courses: passedCount() })
  return r
}
