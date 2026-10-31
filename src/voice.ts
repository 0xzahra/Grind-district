import type { Net } from './net.ts'

const MAX_MS = 30_000

/** Hold-free record button: tap to start (asks for the mic), tap again or wait 30 s to send. */
export function mountVoice(chat: HTMLFormElement, net: Net, toast: (t: string) => void): void {
  if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) return
  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'voice-rec'
  btn.textContent = 'Mic'
  btn.setAttribute('aria-label', 'Record a voice note, up to 30 seconds')
  chat.querySelector('.chat-row')?.append(btn)
  let rec: MediaRecorder | null = null
  let started = 0
  let timer = 0
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
  btn.onclick = async () => {
    if (rec) { rec.stop(); return }
    if (!net.canVoice()) { toast('Voice notes need the live city connection.'); return }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    } catch {
      toast('Microphone permission was not given.')
      return
    }
    const chunks: Blob[] = []
    rec = new MediaRecorder(stream, type ? { mimeType: type, audioBitsPerSecond: 32000 } : undefined)
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
    rec.onstop = async () => {
      clearTimeout(timer)
      stream.getTracks().forEach((t) => t.stop())
      const seconds = Math.min(30, (performance.now() - started) / 1000)
      rec = null
      btn.textContent = 'Mic'
      btn.classList.remove('live')
      if (seconds < 0.6) return
      try {
        await net.sayVoice(new Blob(chunks, { type: chunks[0]?.type || type || 'audio/webm' }), seconds)
      } catch {
        toast('Could not send the voice note.')
      }
    }
    started = performance.now()
    rec.start()
    btn.textContent = 'Stop'
    btn.classList.add('live')
    timer = window.setTimeout(() => rec?.stop(), MAX_MS)
  }
}
