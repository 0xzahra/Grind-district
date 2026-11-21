import { SKILL_META, type SkillId } from './logic.ts'
import { getSave } from './state.ts'
import { shareLink, shareOrCopy, profileLink, publishProfile } from './share.ts'
import { track } from './track.ts'
import { encodeCertId, decodeCertId, drawCertificate, certSerial, issuedWat, CERT_W, CERT_H, type CertData } from '../api/_certArt.ts'
import '@fontsource/outfit/latin-400.css'
import '@fontsource/outfit/latin-500.css'
import '@fontsource/outfit/latin-600.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource/cormorant-garamond/latin-600.css'
import '@fontsource/cormorant-garamond/latin-600-italic.css'

// Issue snapshot per course (time of first issue) so a certificate stays stable on this device.
// The real certificate is the server record (see serverCert); this only paints it before that answers.
// Device-local (localStorage), not part of the save. The pass time comes from the save's activity log when present.
const SNAP_KEY = 'gd.certs.v1'
type Snap = { at: number }
const readSnaps = (): Record<string, Snap> => { try { return JSON.parse(localStorage.getItem(SNAP_KEY) || '{}') as Record<string, Snap> } catch { return {} } }
const writeSnap = (course: string, s: Snap) => { try { localStorage.setItem(SNAP_KEY, JSON.stringify({ ...readSnaps(), [course]: s })) } catch { /* private mode */ } }

/** The certificate's fields for a passed course (stable after first issue on this device). */
export function certData(course: SkillId): CertData {
  const s = getSave()
  const title = SKILL_META[course].title
  let snap = readSnaps()[course]
  if (!snap || !Number.isFinite(snap.at)) {
    const passed = s.activities.find((a) => a.label === `Passed ${title}`)
    snap = { at: passed?.at ?? Date.now() }
    writeSnap(course, snap)
  }
  return decodeCertId(encodeCertId({ n: s.name || s.username, u: s.username, c: course, t: title, at: snap.at }))!
}

/** Adopt the server's certificate fields (keeps the art identical to the server record and what was minted). */
export function adoptCertId(course: SkillId, id: string): void {
  const d = decodeCertId(id)
  if (d?.at && d.c === course) writeSnap(course, { at: d.at })
}

/** This device's certificate id (the public page only accepts the id the server issued). */
export function certId(course: SkillId): string {
  return encodeCertId(certData(course))
}

let assets: Promise<{ lockup: HTMLImageElement; shrimp: HTMLImageElement }> | null = null
const loadImg = (src: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src })
export async function certAssets() {
  assets ??= Promise.all([loadImg('/brand/lockup.png'), loadImg('/brand/shrimp.png')]).then(([lockup, shrimp]) => ({ lockup, shrimp })).catch((e) => { assets = null; throw e })
  const fonts = ['400 20px Outfit', '500 20px Outfit', '600 20px Outfit', '400 20px "Archivo Black"', 'italic 400 20px "Cormorant Garamond"', '600 20px "Cormorant Garamond"', 'italic 600 20px "Cormorant Garamond"']
  await Promise.race([Promise.all(fonts.map((f) => document.fonts?.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 2500))])
  return assets
}

/** Paints the premium certificate (1600 x 1131) with the shared renderer the server also uses. */
export async function paintCertificate(course: SkillId, data = certData(course)): Promise<HTMLCanvasElement> {
  const c = document.createElement('canvas')
  c.width = CERT_W
  c.height = CERT_H
  const g = c.getContext('2d')!
  const a = await certAssets()
  drawCertificate(g, data, encodeCertId(data), { ...a, makeCanvas: (w, h) => { const o = document.createElement('canvas'); o.width = w; o.height = h; return o } })
  return c
}

export async function openCertificate(course: SkillId): Promise<void> {
  try { localStorage.setItem('gd.certSeen', '1') } catch { /* private mode */ }
  document.getElementById('cert-dlg')?.remove()
  const dlg = document.createElement('div')
  dlg.id = 'cert-dlg'
  dlg.className = 'wallet-dlg cert-dlg'
  dlg.setAttribute('role', 'dialog')
  dlg.setAttribute('aria-label', 'Certificate')
  let data = certData(course)
  let id = encodeCertId(data)
  const canvas = await paintCertificate(course, data)
  canvas.style.width = '100%'
  canvas.style.height = 'auto'
  canvas.style.borderRadius = '8px'
  canvas.setAttribute('role', 'img')
  const meta = document.createElement('p')
  meta.className = 'muted cert-meta'
  const share = document.createElement('button')
  share.className = 'primary'
  const save = document.createElement('a')
  save.className = 'cert-dl'
  save.textContent = 'Download PNG'
  save.download = `grind-district-${course}-certificate.png`
  const show = () => {
    canvas.setAttribute('aria-label', `${data.t} certificate for ${data.n}, issued ${issuedWat(data)}`)
    meta.textContent = `Nº ${certSerial(data)} · Issued ${issuedWat(data)}`
    save.href = canvas.toDataURL('image/png')
  }
  show()
  // The share link names the server's record of this certificate; it is fetched (issued on first ask) here.
  let link = ''
  const fetchServer = async () => {
    share.disabled = true
    share.textContent = 'Preparing link…'
    const r = await import('./certMint.ts').then((m) => m.serverCert(course, id)).catch(() => ({ error: 'Could not reach Grind District' }))
    if (!dlg.isConnected) return
    share.disabled = false
    if ('certId' in r) {
      if (r.certId !== id) {
        adoptCertId(course, r.certId)
        const d = decodeCertId(r.certId)
        if (d) { data = d; id = r.certId; await paintCertificate(course, data).then((c) => canvas.getContext('2d')!.drawImage(c, 0, 0)).catch(() => null); show() }
      }
      link = shareLink(`/cert/${r.serial || id}`, 'cert', getSave().username)
      share.textContent = 'Share certificate'
    } else if ('exam' in r && r.exam) {
      // The share link needs a pass on the short exam graded on the server (taken once per course).
      link = ''
      share.textContent = 'Take the exam for a share link'
      share.title = r.error
      share.onclick = async () => {
        const passed = await import('./certMint.ts').then((m) => m.certExam(course)).catch(() => false)
        share.onclick = onShare
        if (passed) void fetchServer()
      }
    } else {
      link = ''
      share.textContent = 'Retry share link'
      share.title = r.error
    }
    void import('./certMint.ts').then((m) => m.renderMint(mint, course, id)).catch(() => { mint.textContent = '' })
  }
  const onShare = async () => {
    if (!link) return void fetchServer()
    const r = await shareOrCopy(`${SKILL_META[course].title} certificate`, link, 'cert')
    if (r !== 'failed') track('cert_shared', { course })
    share.textContent = r === 'copied' ? 'Link copied' : r === 'shared' ? 'Shared' : 'Could not share'
  }
  share.onclick = onShare
  const mint = document.createElement('div')
  mint.className = 'cert-mint'
  const close = document.createElement('button')
  close.className = 'ghost'
  close.textContent = 'Close'
  close.onclick = () => dlg.remove()
  dlg.append(canvas, meta, share, save, mint, close)
  document.body.append(dlg)
  void fetchServer()
}

export function passedCount(): number {
  return Object.values(getSave().skills).filter((v) => v?.passed).length
}

export async function shareCv(): Promise<string> {
  const s = getSave()
  const link = profileLink(s.username)
  void publishProfile()
  const r = await shareOrCopy(`${s.name}'s Grind District CV`, link, 'cv')
  if (r !== 'failed') track('cv_shared', { courses: passedCount() })
  return r
}
