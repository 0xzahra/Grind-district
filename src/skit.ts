// Skits: record what the game camera sees (you, friends around you, chat bubbles, dances) as a video, up to a
// minute, with the city sound, the music and, if you want, your microphone for voices. The menus are not in it.
// Each frame is copied right after it renders onto a recording canvas (the logo in the corner, an optional title
// card at the start), so the video looks exactly like the game. Saved to My Gallery, from where it downloads or
// goes to your socials. MP4 where the browser can record it (best for X, Instagram and TikTok), WebM otherwise.
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }
const key = (label: string, cls: string, on: () => void) => { const b = el('button', label, `gm-key ${cls}`); b.type = 'button'; b.onclick = on; return b }
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

export const MAX_SECS = 60
type Format = 'screen' | 'portrait'
export type SkitDeps = {
  canvas: HTMLCanvasElement
  logo: HTMLImageElement
  /** Called with a function to run right after every rendered frame, or null to stop. */
  onFrame: (fn: (() => void) | null) => void
  /** Game sound to mix in (city sound, music). */
  sounds: () => Promise<MediaStream[]>
  toast: (m: string) => void
  saved: (id: string | null) => void
}

/** The best recording format this browser offers: MP4 first (socials take it), then WebM. */
export function pickMime(can: (t: string) => boolean = (t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)): string {
  for (const t of ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']) if (can(t)) return t
  return ''
}
/** The part of the game frame to record and the output size: the whole screen, or a centred 9:16 crop. */
export function frameFor(cw: number, ch: number, f: Format): { sx: number; sy: number; sw: number; sh: number; w: number; h: number } {
  if (f === 'portrait') {
    let sh = ch, sw = Math.round(ch * 9 / 16)
    if (sw > cw) { sw = cw; sh = Math.round(cw * 16 / 9) }
    const h = Math.min(1280, sh), w = Math.round(h * 9 / 16 / 2) * 2
    return { sx: Math.round((cw - sw) / 2), sy: Math.round((ch - sh) / 2), sw, sh, w, h: Math.round(h / 2) * 2 }
  }
  const k = Math.min(1, 1280 / Math.max(cw, ch))
  return { sx: 0, sy: 0, sw: cw, sh: ch, w: Math.round(cw * k / 2) * 2, h: Math.round(ch * k / 2) * 2 }
}

let busy = false
export function openSkit(d: SkitDeps): void {
  if (busy) { d.toast('A skit is already recording.'); return }
  const mime = pickMime()
  const out = document.createElement('canvas')
  if (!mime || typeof out.captureStream !== 'function') { d.toast('This browser cannot record video. Try Chrome, Edge or Safari on a recent phone.'); return }
  document.getElementById('gd-modal')?.remove()
  const shade = el('div', '', 'gm-shade'); shade.id = 'gd-modal'
  shade.setAttribute('role', 'dialog'); shade.setAttribute('aria-modal', 'true'); shade.setAttribute('aria-label', 'Record a skit')
  const card = el('div', '', 'gm-card sk-card')
  const close = () => shade.remove()
  const head = el('div', '', 'gm-head'), t = el('div')
  t.append(el('p', 'Skits · up to a minute', 'gm-kick'), el('h3', 'Record a skit', 'gm-title'))
  head.append(t, key('Close', 'gm-ghost', close))
  card.append(head, el('p', 'Everything the camera sees goes in: you, friends around you, chat bubbles and dances. The menus and buttons stay out. Walk, chat and move the camera as you film.', 'gm-sub'))
  const title = el('input', '', 'sk-input'); title.type = 'text'; title.maxLength = 48; title.placeholder = 'Title card (optional), e.g. "When the presale closes in 9 minutes"'
  card.append(title)
  let format: Format = window.innerHeight > window.innerWidth ? 'portrait' : 'screen', mic = false
  const opts = el('div', '', 'sk-opts')
  const toggle = (label: string, on: () => boolean, flip: () => void) => { const b = el('button', '', 'sk-opt'); b.type = 'button'; const paint = () => { b.textContent = label.replace('%', on() ? 'on' : 'off'); b.classList.toggle('on', on()) }; b.onclick = () => { flip(); paint() }; paint(); return b }
  const fmt = el('button', '', 'sk-opt on'); fmt.type = 'button'
  const paintFmt = () => { fmt.textContent = format === 'portrait' ? 'Format: 9:16 (Reels, TikTok, Shorts)' : 'Format: full screen (X, YouTube)' }
  fmt.onclick = () => { format = format === 'portrait' ? 'screen' : 'portrait'; paintFmt() }; paintFmt()
  opts.append(fmt, toggle('Microphone: % (for voices)', () => mic, () => { mic = !mic }))
  card.append(opts)
  const keys = el('div', '', 'gm-keys')
  keys.append(key('Cancel', 'gm-ghost', close), key('Start recording', 'gm-go', () => { close(); void record(d, mime, out, format, mic, title.value.trim()) }))
  card.append(keys)
  shade.append(card); document.body.append(shade)
}

async function record(d: SkitDeps, mime: string, out: HTMLCanvasElement, format: Format, mic: boolean, title: string): Promise<void> {
  busy = true
  const bar = el('div', '', 'sk-bar'); bar.id = 'sk-bar'; bar.setAttribute('role', 'status')
  const dot = el('span', '', 'sk-dot'), clock = el('span', '3', 'sk-clock')
  const stop = el('button', 'Stop', 'sk-stop'); stop.type = 'button'
  bar.append(dot, clock, stop); document.body.append(bar)
  let micStream: MediaStream | null = null
  if (mic) { try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }) } catch { d.toast('No microphone: recording without your voice.') } }
  // 3, 2, 1
  for (let n = 3; n > 0; n--) { clock.textContent = String(n); await new Promise((r) => window.setTimeout(r, 700)) }
  const g = out.getContext('2d')!
  const fr = frameFor(d.canvas.width, d.canvas.height, format)
  out.width = fr.w; out.height = fr.h
  // The clock (title card, timer, one-minute cap) starts when the recorder does, after the sound is wired.
  let t0 = performance.now()
  let thumb = ''
  const draw = () => {
    // The game changes its render resolution on the fly (quality.ts): crop from the frame as it is now, into the
    // fixed output size chosen at the start.
    const src = frameFor(d.canvas.width, d.canvas.height, format)
    g.drawImage(d.canvas, src.sx, src.sy, src.sw, src.sh, 0, 0, out.width, out.height)
    const m = Math.round(Math.min(out.width, out.height) * 0.035)
    if (d.logo.complete && d.logo.naturalWidth) {
      const w = Math.round(Math.min(out.width, out.height) * 0.22), h = Math.round(w * d.logo.naturalHeight / d.logo.naturalWidth)
      g.save(); g.shadowColor = 'rgba(0,0,0,0.5)'; g.shadowBlur = 8; g.drawImage(d.logo, out.width - w - m, out.height - h - m, w, h); g.restore()
    }
    const s = (performance.now() - t0) / 1000
    if (title && s < 3) {
      const a = Math.min(1, s / 0.3, (3 - s) / 0.5)
      const fs = Math.round(Math.min(out.width, out.height) * 0.06)
      g.save(); g.globalAlpha = a
      g.font = `800 ${fs}px "Inter Variable", system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
      const lines = wrap(g, title, out.width * 0.84)
      const lh = fs * 1.2, top = out.height * 0.5 - (lines.length * lh) / 2
      g.fillStyle = 'rgba(8,10,12,0.55)'; g.fillRect(0, top - fs * 0.7, out.width, lines.length * lh + fs * 1.4)
      g.fillStyle = '#ffffff'; lines.forEach((l, i) => g.fillText(l, out.width / 2, top + lh * (i + 0.5)))
      g.restore()
    }
    if (!thumb && s > (title ? 3.2 : 0.5)) thumb = out.toDataURL('image/jpeg', 0.7)
  }
  draw()
  d.onFrame(draw)
  // Picture and sound: the recording canvas at 30 fps, and one mixed audio track.
  const stream = out.captureStream(30)
  const mixCtx = new AudioContext()
  const mixOut = mixCtx.createMediaStreamDestination()
  const inputs = [...(await d.sounds().catch(() => [])), ...(micStream ? [micStream] : [])]
  for (const s of inputs) if (s.getAudioTracks().length) { try { mixCtx.createMediaStreamSource(s).connect(mixOut) } catch { /* skip */ } }
  for (const tr of mixOut.stream.getAudioTracks()) stream.addTrack(tr)
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 128_000 })
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const done = new Promise<void>((r) => { rec.onstop = () => r() })
  rec.start(1000)
  t0 = performance.now()
  dot.classList.add('on')
  let finished = false
  const finish = () => { if (finished) return; finished = true; if (rec.state !== 'inactive') rec.stop() }
  stop.onclick = finish
  const tick = window.setInterval(() => {
    const s = (performance.now() - t0) / 1000
    clock.textContent = `${mmss(s)} / ${mmss(MAX_SECS)}`
    if (s >= MAX_SECS) finish()
  }, 250)
  // Leaving the tab ends the take (the game stops drawing while hidden).
  const hide = () => { if (document.hidden) finish() }
  document.addEventListener('visibilitychange', hide)
  await done
  window.clearInterval(tick); document.removeEventListener('visibilitychange', hide)
  d.onFrame(null)
  const secs = (performance.now() - t0) / 1000
  for (const tr of stream.getTracks()) tr.stop()
  micStream?.getTracks().forEach((tr) => tr.stop())
  void mixCtx.close().catch(() => undefined)
  bar.remove(); busy = false
  const blob = new Blob(chunks, { type: mime.split(';')[0] })
  if (!blob.size) { d.toast('Nothing was recorded. Try again.'); return }
  if (!thumb) thumb = out.toDataURL('image/jpeg', 0.7)
  const { saveMedia } = await import('./media.ts')
  d.saved(await saveMedia('skit', blob, { thumb, w: out.width, h: out.height, secs: Math.round(secs), ...(title ? { title } : {}) }))
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number): string[] {
  const out: string[] = []; let line = ''
  for (const w of text.split(/\s+/)) { const next = line ? `${line} ${w}` : w; if (g.measureText(next).width > max && line) { out.push(line); line = w } else line = next }
  if (line) out.push(line)
  return out.slice(0, 3)
}
