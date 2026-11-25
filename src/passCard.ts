// Passing cards: walk past someone and a small card says who they are. A resident shows their name, trade and
// what they are doing now (and if they mentor a career); a real player shows their name, @username and a gold
// "Real player" tag. Tap the card for their full profile. Each person's card shows once as you pass and not
// again for a while, so standing in a crowd does not flicker; it slides away when you walk on.
export type PassSubject = {
  key: string
  kind: 'npc' | 'player'
  name: string
  sub: string
  line: string
  hue: number
  open: () => void
  extra?: Promise<string | null>
}

const SHOW_MS = 8000 // a card stays at most this long while you stand by them
const AGAIN_MS = 45_000 // the same person's card comes back after this long
const LEAVE_MS = 1400 // after they are out of reach

export function createPassCard(): { update: (s: PassSubject | null) => void; hide: () => void } {
  let el: HTMLButtonElement | null = null
  let cur: PassSubject | null = null
  let shownAt = 0, goneAt = 0
  const seen = new Map<string, number>()
  const hide = () => {
    if (!el) return
    const e = el; el = null; cur = null
    e.classList.remove('on')
    window.setTimeout(() => e.remove(), 240)
  }
  const show = (s: PassSubject) => {
    hide()
    const b = document.createElement('button'); b.type = 'button'; b.className = `pass-card ${s.kind}`
    b.setAttribute('aria-label', `${s.name}, ${s.kind === 'player' ? 'real player' : s.sub}. Open their profile.`)
    const face = document.createElement('span'); face.className = 'pass-face'
    face.textContent = (s.name.replace(/^@/, '').trim()[0] ?? '?').toUpperCase()
    face.style.background = `hsl(${s.hue} 42% 38%)`
    const words = document.createElement('span'); words.className = 'pass-words'
    const top = document.createElement('span'); top.className = 'pass-top'
    const nm = document.createElement('b'); nm.textContent = s.name
    const tag = document.createElement('i'); tag.textContent = s.kind === 'player' ? 'Real player' : 'Resident'
    top.append(nm, tag)
    const sub = document.createElement('small'); sub.className = 'pass-sub'; sub.textContent = s.sub
    const line = document.createElement('small'); line.className = 'pass-line'; line.textContent = s.line
    words.append(top, sub, line)
    const go = document.createElement('span'); go.className = 'pass-go'; go.setAttribute('aria-hidden', 'true'); go.textContent = '›'
    b.append(face, words, go)
    b.onclick = (e) => { e.stopPropagation(); const open = s.open; hide(); open() }
    b.addEventListener('pointerdown', (e) => e.stopPropagation())
    document.body.append(b)
    requestAnimationFrame(() => b.classList.add('on'))
    void s.extra?.then((x) => { if (x && el === b) { const m = document.createElement('small'); m.className = 'pass-extra'; m.textContent = x; words.append(m) } })
    el = b; cur = s; shownAt = performance.now(); goneAt = 0
    seen.set(s.key, shownAt)
  }
  return {
    hide,
    /** Call a few times a second with whoever is nearest (or null). */
    update(s) {
      const now = performance.now()
      if (!s) {
        if (el && !goneAt) goneAt = now
        if (el && now - goneAt > LEAVE_MS) hide()
        return
      }
      if (cur && s.key === cur.key) {
        goneAt = 0
        const line = el?.querySelector('.pass-line')
        if (line && line.textContent !== s.line) line.textContent = s.line
        if (now - shownAt > SHOW_MS) hide()
        return
      }
      const last = seen.get(s.key)
      if (last !== undefined && now - last < AGAIN_MS) { if (el && !goneAt) goneAt = now; if (el && now - goneAt > LEAVE_MS) hide(); return }
      show(s)
    },
  }
}
