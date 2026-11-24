// Course cards: one original illustration per course, drawn as inline SVG (nothing to download, sharp at any size).
// Premium look: a rich two-tone backdrop with a fine pattern, a soft spotlight behind the subject, glossy objects
// with rims, bevels and highlights, a floor shadow, and a few sparkles. Each picture says what the course is about:
// a candlestick chart for spot trading, a vault door for custody, a baited hook for scams, a trophy for a final check.
import type { SkillId } from './logic.ts'

type Stop = [number, string, number?]
let seq = 0
/** Gradient and pattern definitions for one picture (ids are unique per picture, so many can share a page). */
class Defs {
  private id = `ca${++seq}`
  private n = 0
  private parts: string[] = []
  private stops = (s: Stop[]) => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('')
  lin(s: Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
    const k = `${this.id}-${this.n++}`
    this.parts.push(`<linearGradient id="${k}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${this.stops(s)}</linearGradient>`)
    return `url(#${k})`
  }
  rad(s: Stop[], cx = 0.5, cy = 0.5, r = 0.5): string {
    const k = `${this.id}-${this.n++}`
    this.parts.push(`<radialGradient id="${k}" cx="${cx}" cy="${cy}" r="${r}">${this.stops(s)}</radialGradient>`)
    return `url(#${k})`
  }
  pattern(kind: 'dots' | 'grid' | 'hex' | 'lines'): string {
    const k = `${this.id}-${this.n++}`
    const body = kind === 'dots' ? '<circle cx="1.5" cy="1.5" r=".7" fill="#fff" opacity=".09"/>'
      : kind === 'grid' ? '<path d="M8 0H0V8" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".5"/>'
        : kind === 'hex' ? '<path d="M4 0l4 2.3v4.6L4 9.2 0 6.9V2.3z" fill="none" stroke="#fff" stroke-opacity=".07" stroke-width=".5"/>'
          : '<path d="M0 8L8 0" stroke="#fff" stroke-opacity=".06" stroke-width=".6"/>'
    this.parts.push(`<pattern id="${k}" width="8" height="${kind === 'hex' ? 9.2 : 8}" patternUnits="userSpaceOnUse">${body}</pattern>`)
    return `url(#${k})`
  }
  out(): string { return `<defs>${this.parts.join('')}</defs>` }
}

// ---------------------------------------------------------------- materials
const mix = (a: string, b: string, t: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const x = p(a), y = p(b)
  return '#' + x.map((v, i) => Math.round(v + (y[i]! - v) * t).toString(16).padStart(2, '0')).join('')
}
const lighten = (c: string, t: number) => mix(c, '#ffffff', t)
const darken = (c: string, t: number) => mix(c, '#000000', t)
const GOLD: Stop[] = [[0, '#fff6d6'], [0.35, '#f2c75c'], [0.72, '#c8912e'], [1, '#7a5214']]
const SILVER: Stop[] = [[0, '#ffffff'], [0.4, '#dfe5ec'], [0.8, '#97a3b1'], [1, '#5d6875']]
const sparkle = (x: number, y: number, s: number, o = 0.9) => `<path d="M${x} ${y - s}Q${x} ${y} ${x + s} ${y}Q${x} ${y} ${x} ${y + s}Q${x} ${y} ${x - s} ${y}Q${x} ${y} ${x} ${y - s}Z" fill="#fff" opacity="${o}"/>`
const floor = (d: Defs, x = 60, y = 71, rx = 34) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.14}" fill="${d.rad([[0, '#000', 0.5], [1, '#000', 0]])}"/>`

/** A glossy coin with a thick edge, a raised inner ring and a mark. */
function coin(d: Defs, x: number, y: number, r: number, tone: 'gold' | 'silver' | string = 'gold', mark: 'diamond' | '$' | 'G' | 'none' = 'diamond'): string {
  const base = tone === 'gold' ? '#e8b545' : tone === 'silver' ? '#c9d1db' : tone
  const face = d.rad([[0, lighten(base, 0.7)], [0.55, base], [1, darken(base, 0.35)]], 0.35, 0.3, 0.85)
  const edge = darken(base, 0.45)
  const ink = darken(base, 0.55)
  const m = mark === 'diamond' ? `<path d="M${x} ${y - r * 0.42}L${x + r * 0.3} ${y}L${x} ${y + r * 0.42}L${x - r * 0.3} ${y}Z" fill="${ink}" opacity=".75"/><path d="M${x} ${y - r * 0.42}L${x + r * 0.3} ${y}L${x} ${y}Z" fill="#fff" opacity=".35"/>`
    : mark === 'none' ? '' : `<text x="${x}" y="${y + r * 0.34}" text-anchor="middle" font-family="Georgia, serif" font-weight="700" font-size="${r * 0.95}" fill="${ink}" opacity=".8">${mark}</text>`
  return `<ellipse cx="${x}" cy="${y + r * 0.14}" rx="${r}" ry="${r}" fill="${edge}"/>`
    + `<circle cx="${x}" cy="${y}" r="${r}" fill="${face}"/>`
    + `<circle cx="${x}" cy="${y}" r="${r * 0.76}" fill="none" stroke="${lighten(base, 0.6)}" stroke-opacity=".7" stroke-width="${r * 0.07}"/>`
    + `<circle cx="${x}" cy="${y + r * 0.03}" r="${r * 0.7}" fill="none" stroke="${darken(base, 0.4)}" stroke-opacity=".5" stroke-width="${r * 0.05}"/>`
    + m
    + `<path d="M${x - r * 0.72} ${y - r * 0.2}A${r * 0.78} ${r * 0.78} 0 0 1 ${x - r * 0.1} ${y - r * 0.75}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="${r * 0.1}" stroke-linecap="round"/>`
}
/** A stack of coins seen from the side (ellipses), `n` high. */
function stack(d: Defs, x: number, y: number, r: number, n: number, tone = '#e8b545'): string {
  const side = d.lin([[0, darken(tone, 0.4)], [0.5, lighten(tone, 0.2)], [1, darken(tone, 0.5)]], 0, 0, 1, 0)
  let s = ''
  for (let i = 0; i < n; i++) {
    const yy = y - i * r * 0.3
    s += `<path d="M${x - r} ${yy}v${r * 0.22}a${r} ${r * 0.34} 0 0 0 ${2 * r} 0v-${r * 0.22}z" fill="${side}"/>`
    s += `<path d="M${x - r} ${yy + r * 0.11}a${r} ${r * 0.34} 0 0 0 ${2 * r} 0" fill="none" stroke="${darken(tone, 0.55)}" stroke-opacity=".5" stroke-width=".5"/>`
  }
  const top = y - (n - 1) * r * 0.3
  return s + `<ellipse cx="${x}" cy="${top}" rx="${r}" ry="${r * 0.34}" fill="${d.rad([[0, lighten(tone, 0.6)], [1, tone]], 0.4, 0.35, 0.8)}"/><ellipse cx="${x}" cy="${top}" rx="${r * 0.7}" ry="${r * 0.22}" fill="none" stroke="${darken(tone, 0.35)}" stroke-opacity=".5" stroke-width=".6"/>`
}
/** An isometric cube (top light, left mid, right dark). */
function cube(x: number, y: number, s: number, c: string, glow = false): string {
  const h = s * 0.58
  return `<path d="M${x} ${y - h}L${x + s} ${y - h / 2}L${x} ${y}L${x - s} ${y - h / 2}Z" fill="${lighten(c, 0.35)}"/>`
    + `<path d="M${x - s} ${y - h / 2}L${x} ${y}L${x} ${y + s * 1.05}L${x - s} ${y + s * 1.05 - h / 2}Z" fill="${c}"/>`
    + `<path d="M${x + s} ${y - h / 2}L${x} ${y}L${x} ${y + s * 1.05}L${x + s} ${y + s * 1.05 - h / 2}Z" fill="${darken(c, 0.35)}"/>`
    + `<path d="M${x} ${y - h}L${x + s} ${y - h / 2}L${x} ${y}L${x - s} ${y - h / 2}Z" fill="none" stroke="#fff" stroke-opacity="${glow ? 0.8 : 0.35}" stroke-width=".7"/>`
}
/** A bevelled shield with a mark inside. */
function shield(d: Defs, x: number, y: number, s: number, c: string, mark: 'check' | 'chain' | 'bang' | 'star' = 'check'): string {
  const P = (k: number) => `M${x} ${y - 26 * k}L${x + 22 * k} ${y - 18 * k}V${y - 2 * k}C${x + 22 * k} ${y + 14 * k} ${x + 11 * k} ${y + 23 * k} ${x} ${y + 28 * k}C${x - 11 * k} ${y + 23 * k} ${x - 22 * k} ${y + 14 * k} ${x - 22 * k} ${y - 2 * k}V${y - 18 * k}Z`
  const inner = mark === 'check' ? `<path d="M${x - 9 * s} ${y + 1 * s}l${7 * s} ${7 * s}l${12 * s} ${-14 * s}" fill="none" stroke="#fff" stroke-width="${4.5 * s}" stroke-linecap="round" stroke-linejoin="round"/>`
    : mark === 'bang' ? `<path d="M${x} ${y - 13 * s}V${y + 4 * s}" stroke="#fff" stroke-width="${5 * s}" stroke-linecap="round"/><circle cx="${x}" cy="${y + 12 * s}" r="${3 * s}" fill="#fff"/>`
      : mark === 'star' ? `<path d="M${x} ${y - 13 * s}l${4 * s} ${8.5 * s}l${9 * s} ${1 * s}l${-7 * s} ${6 * s}l${2.2 * s} ${9 * s}l${-8.2 * s} ${-4.8 * s}l${-8.2 * s} ${4.8 * s}l${2.2 * s} ${-9 * s}l${-7 * s} ${-6 * s}l${9 * s} ${-1 * s}z" fill="#fff"/>`
        : `<rect x="${x - 12 * s}" y="${y - 5 * s}" width="${13 * s}" height="${9 * s}" rx="${4.5 * s}" fill="none" stroke="#fff" stroke-width="${3 * s}"/><rect x="${x - 1 * s}" y="${y - 1 * s}" width="${13 * s}" height="${9 * s}" rx="${4.5 * s}" fill="none" stroke="#fff" stroke-width="${3 * s}"/>`
  return `<path d="${P(s * 1.08)}" fill="${d.lin(GOLD, 0, 0, 1, 1)}"/>`
    + `<path d="${P(s)}" fill="${d.lin([[0, lighten(c, 0.35)], [1, darken(c, 0.4)]], 0, 0, 0.6, 1)}"/>`
    + `<path d="${P(s * 0.84)}" fill="${d.lin([[0, darken(c, 0.25)], [1, lighten(c, 0.15)]], 0, 0, 0.4, 1)}" opacity=".9"/>`
    + `<path d="M${x - 18 * s} ${y - 15 * s}L${x} ${y - 22 * s}L${x + 4 * s} ${y - 21 * s}L${x - 15 * s} ${y - 8 * s}Z" fill="#fff" opacity=".22"/>`
    + inner
}
/** A golden trophy with an emblem on the cup. */
function trophy(d: Defs, emblem: string): string {
  const g = d.lin(GOLD, 0, 0, 1, 1)
  return `<path d="M44 20h32v8c0 12-7 20-16 20s-16-8-16-20z" fill="${g}"/>`
    + '<path d="M44 23h-7c0 9 4 14 10 15M76 23h7c0 9-4 14-10 15" fill="none" stroke="#e2ac3c" stroke-width="3" stroke-linecap="round"/>'
    + `<rect x="57" y="47" width="6" height="8" fill="${g}"/><path d="M48 55h24l3 8H45z" fill="${d.lin([[0, '#5a3b1a'], [1, '#2e1d0c']])}"/><rect x="51" y="57.5" width="18" height="2.5" rx="1" fill="#e2ac3c" opacity=".8"/>`
    + '<path d="M47 22c0 8 2 15 6 19" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
    + emblem
}

type Card = { bg: [string, string]; glow: string; pat: 'dots' | 'grid' | 'hex' | 'lines'; draw: (d: Defs) => string }
const ART: Record<SkillId, Card> = {
  spot: {
    bg: ['#0b1f33', '#123d4f'], glow: '#2fd38a', pat: 'grid', draw: (d) => {
      const candles = [[24, 50, 42, 54, 1], [33, 44, 36, 47, 0], [42, 46, 40, 50, 1], [51, 38, 33, 41, 1], [60, 40, 37, 44, 0], [69, 31, 26, 35, 1], [78, 33, 29, 37, 0], [87, 24, 19, 28, 1], [96, 18, 13, 22, 1]] as const
      let s = floor(d, 60, 69, 40) + `<rect x="16" y="10" width="88" height="54" rx="6" fill="#ffffff" fill-opacity=".05" stroke="#fff" stroke-opacity=".14"/>`
      for (const [x, o, hi, lo, up] of candles) {
        const c = up ? '#2fd38a' : '#ff6b6b'
        s += `<path d="M${x} ${hi - 4}V${lo + 10}" stroke="${c}" stroke-width="1"/><rect x="${x - 2.6}" y="${Math.min(o, lo) - 2}" width="5.2" height="${Math.abs(lo - o) + 6}" rx="1" fill="${c}"/>`
      }
      s += '<polyline points="22,54 34,47 44,49 52,40 62,42 70,32 80,34 88,24 98,18" fill="none" stroke="#7dffc0" stroke-opacity=".25" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
      s += '<polyline points="22,54 34,47 44,49 52,40 62,42 70,32 80,34 88,24 98,18" fill="none" stroke="#c9ffe3" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
      return s + '<circle cx="98" cy="18" r="3" fill="#c9ffe3"/>' + sparkle(98, 18, 6)
    },
  },
  risk: {
    bg: ['#2a1410', '#5a2a1a'], glow: '#ffb35c', pat: 'lines', draw: (d) => {
      const arc = (a0: number, a1: number, c: string) => { const p = (a: number, r: number) => `${60 + Math.cos(a) * r} ${56 - Math.sin(a) * r}`; return `<path d="M${p(a0, 30)}A30 30 0 0 0 ${p(a1, 30)}" fill="none" stroke="${c}" stroke-width="8"/>` }
      return floor(d, 60, 68, 30) + `<path d="M26 56a34 34 0 0 1 68 0z" fill="${d.lin([[0, '#3b2a24'], [1, '#1a110d']])}" stroke="${d.lin(GOLD, 0, 0, 1, 1)}" stroke-width="2"/>`
        + arc(Math.PI, Math.PI * 0.68, '#2fd38a') + arc(Math.PI * 0.66, Math.PI * 0.36, '#ffc34d') + arc(Math.PI * 0.34, 0, '#ff5d5d')
        + '<path d="M60 56L42 34" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="56" r="5" fill="#e8b545" stroke="#7a5214"/>' + sparkle(42, 34, 4, 0.7)
    },
  },
  staking: {
    bg: ['#0e2a1d', '#1f5a3a'], glow: '#7dffb0', pat: 'dots', draw: (d) => floor(d) + stack(d, 48, 60, 13, 5) + stack(d, 74, 62, 11, 3)
      + `<rect x="64" y="20" width="22" height="17" rx="3" fill="${d.lin(GOLD, 0, 0, 1, 1)}"/><path d="M68 20v-5a7 7 0 0 1 14 0v5" fill="none" stroke="#d7dde4" stroke-width="3"/><circle cx="75" cy="27.5" r="2.4" fill="#5a3b1a"/>`
      + '<path d="M40 30c0-8 6-12 12-12 0 7-5 12-12 12z" fill="#5fe08f"/><path d="M40 30c-6-1-9-6-8-11 6 0 9 5 8 11z" fill="#3fbf6f"/>' + sparkle(92, 16, 4),
  },
  airdrops: {
    bg: ['#0f2847', '#2e6ea8'], glow: '#bfe4ff', pat: 'dots', draw: (d) => {
      let s = '<path d="M30 30a30 22 0 0 1 60 0z" fill="#f4f1ea"/>'
      for (let i = 0; i < 4; i++) s += `<path d="M${30 + i * 15} 30a7.5 9 0 0 1 15 0z" fill="${i % 2 ? '#e8b545' : '#ffffff'}" opacity=".95"/>`
      s += '<path d="M30 30a30 22 0 0 1 60 0" fill="none" stroke="#fff" stroke-opacity=".5"/>'
      s += '<path d="M31 30L52 50M89 30L68 50M60 30V50" stroke="#e6edf5" stroke-width=".8"/>'
      s += `<rect x="50" y="48" width="20" height="15" rx="2" fill="${d.lin([[0, '#a8743c'], [1, '#6e4520']], 0, 0, 1, 1)}"/><path d="M50 55.5h20M60 48v15" stroke="#4a2e14" stroke-width="1"/>`
      return s + coin(d, 60, 55.5, 5) + sparkle(22, 18, 4) + sparkle(98, 14, 3) + sparkle(100, 48, 2.5, 0.6)
    },
  },
  memes: {
    bg: ['#1c1033', '#4a2a6e'], glow: '#ffcf5c', pat: 'dots', draw: (d) => sparkle(20, 16, 3) + sparkle(100, 22, 4) + sparkle(26, 58, 2.5, 0.6) + sparkle(92, 60, 2.5, 0.6)
      + '<path d="M44 58c-6 6-8 12-6 16 4-2 10-4 14-10z" fill="#ff8a3d"/><path d="M45 60c-3 4-4 8-3 10 3-1 6-3 8-6z" fill="#ffe06b"/>'
      + `<path d="M48 56C52 36 66 22 84 16c-2 18-12 34-30 44z" fill="${d.lin(SILVER, 0, 0, 1, 1)}"/>`
      + '<path d="M48 56l-8-2 6-10 8 2zM54 60l2 8 10-6-2-8z" fill="#ff5d7a"/>'
      + coin(d, 70, 34, 7.5, 'gold', 'none') + '<circle cx="67.5" cy="32.5" r="1.3" fill="#5a3b1a"/><circle cx="72.5" cy="32.5" r="1.3" fill="#5a3b1a"/><path d="M66.5 36q3.5 3 7 0" stroke="#5a3b1a" stroke-width="1.2" fill="none" stroke-linecap="round"/>',
  },
  agents: {
    bg: ['#121633', '#2b3474'], glow: '#6fe7ff', pat: 'grid', draw: (d) => floor(d, 60, 70, 26)
      + `<path d="M60 18V10" stroke="#c9d1db" stroke-width="2"/><circle cx="60" cy="9" r="3.5" fill="${d.rad([[0, '#e8ffff'], [1, '#2bc6e8']])}"/>`
      + `<rect x="36" y="18" width="48" height="38" rx="12" fill="${d.lin(SILVER, 0, 0, 1, 1)}"/>`
      + `<rect x="40" y="25" width="40" height="20" rx="8" fill="${d.lin([[0, '#0c1230'], [1, '#1d2a5a']])}"/>`
      + `<ellipse cx="51" cy="35" rx="5" ry="4" fill="${d.rad([[0, '#ffffff'], [0.4, '#6fe7ff'], [1, '#2bc6e8', 0]])}"/><ellipse cx="69" cy="35" rx="5" ry="4" fill="${d.rad([[0, '#ffffff'], [0.4, '#6fe7ff'], [1, '#2bc6e8', 0]])}"/>`
      + '<path d="M52 50h16" stroke="#7a8794" stroke-width="2" stroke-linecap="round"/><rect x="31" y="31" width="5" height="10" rx="2" fill="#97a3b1"/><rect x="84" y="31" width="5" height="10" rx="2" fill="#97a3b1"/>'
      + '<path d="M40 21q8-3 20-3" stroke="#fff" stroke-opacity=".7" stroke-width="1.5" fill="none" stroke-linecap="round"/><rect x="44" y="56" width="32" height="10" rx="4" fill="#5d6875"/>',
  },
  building: {
    bg: ['#1a1d24', '#3a4150'], glow: '#ffc85c', pat: 'grid', draw: (d) => floor(d) + cube(46, 44, 13, '#3d7fd6') + cube(72, 50, 11, '#e8b545') + cube(60, 26, 9, '#5fd0a8', true)
      + `<path d="M84 18l12 12-4 4-12-12z" fill="${d.lin(SILVER, 0, 0, 1, 1)}"/><path d="M80 22l-14 14" stroke="#8a5a2a" stroke-width="3.5" stroke-linecap="round"/>` + sparkle(66, 18, 3),
  },
  carbon: {
    bg: ['#0e2a1d', '#215a3a'], glow: '#9dffb8', pat: 'dots', draw: (d) => floor(d, 60, 70, 26)
      + `<circle cx="58" cy="44" r="22" fill="${d.rad([[0, '#7fd3ff'], [0.7, '#2a7fbf'], [1, '#174a7a']], 0.35, 0.3, 0.8)}"/>`
      + '<path d="M44 34c6 2 8 6 6 10s2 8 6 10M64 26c-2 6 2 8 6 8s8 6 4 12" fill="none" stroke="#5fd08f" stroke-width="5" stroke-linecap="round"/>'
      + '<path d="M60 22c8-14 26-14 32-12-2 14-14 24-30 20z" fill="#5fe08f"/><path d="M62 30c8-8 16-12 26-17" stroke="#d8ffe4" stroke-width="1.4" fill="none"/>'
      + '<path d="M44 30a22 22 0 0 1 10-7" stroke="#fff" stroke-opacity=".6" stroke-width="2" fill="none" stroke-linecap="round"/>',
  },
  custody: {
    bg: ['#141418', '#34343e'], glow: '#ffd27a', pat: 'lines', draw: (d) => floor(d, 60, 72, 30)
      + `<rect x="32" y="12" width="56" height="56" rx="8" fill="${d.lin([[0, '#9aa4b0'], [0.5, '#5d6875'], [1, '#2b3038']], 0, 0, 1, 1)}"/>`
      + `<rect x="36" y="16" width="48" height="48" rx="6" fill="${d.lin([[0, '#3a414c'], [1, '#6c7785']], 0, 0, 1, 1)}"/>`
      + `<circle cx="60" cy="40" r="15" fill="${d.lin(GOLD, 0, 0, 1, 1)}"/><circle cx="60" cy="40" r="10" fill="${d.rad([[0, '#4a3418'], [1, '#2a1c0a']])}"/>`
      + [0, 1, 2, 3, 4, 5].map((i) => `<path d="M60 40L${60 + Math.cos(i * Math.PI / 3) * 14} ${40 + Math.sin(i * Math.PI / 3) * 14}" stroke="#e2ac3c" stroke-width="2.4" stroke-linecap="round"/>`).join('')
      + '<circle cx="60" cy="40" r="3.5" fill="#f2c75c"/>' + [[40, 20], [80, 20], [40, 60], [80, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#c9d1db"/>`).join(''),
  },
  stables: {
    bg: ['#0c2a2a', '#1d5f5a'], glow: '#9dfff0', pat: 'dots', draw: (d) => floor(d, 60, 71, 30)
      + `<path d="M60 18V62" stroke="${d.lin(GOLD)}" stroke-width="3"/><path d="M50 64h20l-3-4h-14z" fill="#c8912e"/>`
      + '<path d="M28 28H92" stroke="#e8b545" stroke-width="2.5" stroke-linecap="round"/>'
      + '<path d="M32 28L24 46M32 28L40 46M88 28L80 46M88 28L96 46" stroke="#e6edf5" stroke-width=".8"/>'
      + `<path d="M22 46h20a10 5 0 0 1-20 0z" fill="${d.lin(GOLD, 0, 0, 1, 1)}"/><path d="M78 46h20a10 5 0 0 1-20 0z" fill="${d.lin(GOLD, 0, 0, 1, 1)}"/>`
      + coin(d, 32, 41, 5.5, '#7fe0c8', '$') + coin(d, 88, 41, 5.5, 'gold', 'diamond') + coin(d, 60, 18, 7, '#7fe0c8', '$'),
  },
  liquidity: {
    bg: ['#0a2440', '#1e5a8f'], glow: '#9fd8ff', pat: 'dots', draw: (d) => `<ellipse cx="60" cy="64" rx="36" ry="6" fill="${d.rad([[0, '#4fb0ff', 0.55], [1, '#4fb0ff', 0]])}"/>`
      + `<path d="M60 10C70 26 82 36 82 48A22 22 0 0 1 38 48C38 36 50 26 60 10Z" fill="${d.lin([[0, '#bfe8ff'], [0.5, '#4aa8f0'], [1, '#155a9f']], 0, 0, 1, 1)}"/>`
      + coin(d, 53, 46, 7, 'gold', 'none') + coin(d, 67, 52, 6, '#c9d1db', 'none')
      + '<path d="M46 34c4-6 8-10 10-14" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
      + '<path d="M44 50a16 16 0 0 0 26 8" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" fill="none" stroke-dasharray="2 2"/>',
  },
  records: {
    bg: ['#2a2014', '#5a4426'], glow: '#ffe2a8', pat: 'lines', draw: (d) => floor(d, 60, 70, 34)
      + `<path d="M24 24c12-4 24-2 36 4v38c-12-6-24-8-36-4z" fill="${d.lin([[0, '#fff8ea'], [1, '#e6d6b4']], 0, 0, 1, 0)}"/>`
      + `<path d="M96 24c-12-4-24-2-36 4v38c12-6 24-8 36-4z" fill="${d.lin([[0, '#e6d6b4'], [1, '#fff8ea']], 0, 0, 1, 0)}"/>`
      + [33, 40, 47, 54].map((y) => `<path d="M30 ${y}q12-3 24 1" stroke="#8a7350" stroke-width="1.2" fill="none"/><path d="M66 ${y + 1}q12-4 24-1" stroke="#8a7350" stroke-width="1.2" fill="none"/>`).join('')
      + `<circle cx="80" cy="56" r="8" fill="${d.rad([[0, '#ff6b5c'], [1, '#9f2a1f']], 0.4, 0.35, 0.8)}"/><path d="M76 56l3 3 6-6" stroke="#ffe2d8" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  },
  internet: {
    bg: ['#0a1838', '#1a3f7a'], glow: '#6fd3ff', pat: 'hex', draw: (d) => floor(d, 60, 70, 26)
      + `<circle cx="60" cy="40" r="23" fill="${d.rad([[0, '#8fe0ff'], [0.65, '#2a7fd0'], [1, '#0f3a7a']], 0.35, 0.3, 0.85)}"/>`
      + '<ellipse cx="60" cy="40" rx="10" ry="23" fill="none" stroke="#cdeeff" stroke-opacity=".55"/><ellipse cx="60" cy="40" rx="23" ry="8" fill="none" stroke="#cdeeff" stroke-opacity=".55"/><path d="M37 40h46M60 17v46" stroke="#cdeeff" stroke-opacity=".4"/>'
      + [[42, 28], [78, 30], [70, 56], [46, 54], [60, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="#fff"/>`).join('')
      + '<path d="M42 28L60 18L78 30L70 56L46 54Z" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width=".9"/>'
      + '<path d="M88 20a10 10 0 0 1 8 8M91 14a17 17 0 0 1 12 12" stroke="#8fe0ff" stroke-width="2" fill="none" stroke-linecap="round"/>',
  },
  money: {
    bg: ['#1f1a0a', '#4f4214'], glow: '#ffe08a', pat: 'dots', draw: (d) => floor(d)
      + `<g transform="rotate(-10 52 38)"><rect x="24" y="26" width="56" height="28" rx="3" fill="${d.lin([[0, '#bff0c8'], [1, '#5fae78']], 0, 0, 1, 1)}"/><rect x="28" y="30" width="48" height="20" rx="2" fill="none" stroke="#2f6e45" stroke-width="1"/><circle cx="52" cy="40" r="7" fill="none" stroke="#2f6e45" stroke-width="1.4"/><text x="52" y="44" text-anchor="middle" font-family="Georgia, serif" font-size="10" font-weight="700" fill="#2f6e45">$</text></g>`
      + coin(d, 78, 50, 11) + coin(d, 92, 38, 8, '#c9d1db', 'diamond') + sparkle(98, 22, 3.5),
  },
  webEras: {
    bg: ['#151633', '#3a3a7a'], glow: '#b8b0ff', pat: 'grid', draw: (d) => {
      const win = (x: number, y: number, c: string, body: string) => `<rect x="${x}" y="${y}" width="40" height="28" rx="4" fill="${d.lin([[0, '#ffffff'], [1, '#d8dceb']])}"/><rect x="${x}" y="${y}" width="40" height="6" rx="3" fill="${c}"/><circle cx="${x + 4}" cy="${y + 3}" r="1.1" fill="#fff"/><circle cx="${x + 8}" cy="${y + 3}" r="1.1" fill="#fff"/>${body}`
      return win(14, 40, '#8a93a8', '<path d="M19 52h22M19 57h26M19 62h18" stroke="#9aa2b6" stroke-width="1.6"/>')
        + win(40, 26, '#5b8cff', '<rect x="45" y="37" width="16" height="9" rx="4" fill="#5b8cff"/><rect x="58" y="43" width="18" height="9" rx="4" fill="#ff8ab3"/>')
        + win(66, 12, '#e8b545', '') + coin(d, 86, 30, 7) + sparkle(104, 12, 3.5)
    },
  },
  w1Boss: { bg: ['#241a08', '#5a4314'], glow: '#ffd76b', pat: 'dots', draw: (d) => floor(d, 60, 66, 22) + trophy(d, '<path d="M60 26l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="#fff8e1"/>') + sparkle(30, 18, 4) + sparkle(92, 26, 3) },
  redFlags: {
    bg: ['#2a0e10', '#6a1f22'], glow: '#ff8a7a', pat: 'lines', draw: (d) => floor(d, 54, 70, 26)
      + `<path d="M46 22V60" stroke="#c9d1db" stroke-width="2"/><path d="M46 22c8-4 14 4 24 0v16c-10 4-16-4-24 0z" fill="${d.lin([[0, '#ff6b5c'], [1, '#b8261c']], 0, 0, 1, 1)}"/>`
      + `<circle cx="66" cy="40" r="16" fill="${d.rad([[0, '#ffffff', 0.35], [1, '#bfe4ff', 0.12]])}" stroke="${d.lin(GOLD, 0, 0, 1, 1)}" stroke-width="4"/><path d="M77 52L92 66" stroke="#4a2e14" stroke-width="6" stroke-linecap="round"/><path d="M58 31a12 12 0 0 1 9-4" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  },
  p2pSharks: {
    bg: ['#06222e', '#0f4f66'], glow: '#7fe0ff', pat: 'dots', draw: (d) => `<path d="M0 56q10-5 20 0t20 0 20 0 20 0 20 0 20 0V80H0z" fill="${d.lin([[0, '#1f8fb0'], [1, '#0a3a4f']])}"/>`
      + '<path d="M0 62q10-4 20 0t20 0 20 0 20 0 20 0 20 0" fill="none" stroke="#bff0ff" stroke-opacity=".35"/>'
      + `<path d="M30 57C34 40 42 30 52 26c-2 10-1 22 4 31z" fill="${d.lin([[0, '#9aa4b0'], [1, '#3a434f']], 0, 0, 1, 1)}"/>`
      + `<ellipse cx="82" cy="58" rx="14" ry="4" fill="#e6d29a"/>` + coin(d, 82, 48, 8) + sparkle(96, 34, 3),
  },
  w2Boss: { bg: ['#241a08', '#5a4314'], glow: '#ffd76b', pat: 'dots', draw: (d) => floor(d, 60, 66, 22) + trophy(d, shield(d, 60, 32, 0.32, '#c0392b', 'check')) + sparkle(30, 18, 4) + sparkle(92, 26, 3) },
  chainBlocks: {
    bg: ['#0c1a2e', '#1f3f66'], glow: '#7fc4ff', pat: 'hex', draw: (d) => floor(d, 60, 70, 40)
      + cube(26, 40, 11, '#3d7fd6') + cube(60, 40, 11, '#3d7fd6', true) + cube(94, 40, 11, '#3d7fd6')
      + [[37, 46], [71, 46]].map(([x, y]) => `<rect x="${x + 1}" y="${y - 3}" width="10" height="6" rx="3" fill="none" stroke="${d.lin(SILVER)}" stroke-width="2"/><rect x="${x + 7}" y="${y - 3}" width="10" height="6" rx="3" fill="none" stroke="${d.lin(SILVER)}" stroke-width="2"/>`).join('')
      + sparkle(60, 20, 4),
  },
  chainTraits: { bg: ['#0e2a1d', '#1f5a3a'], glow: '#9dffb8', pat: 'hex', draw: (d) => floor(d, 60, 70, 24) + shield(d, 60, 38, 1, '#1f8a55', 'chain') + sparkle(86, 18, 3.5) + sparkle(30, 24, 2.5, 0.7) },
  chainTypes: {
    bg: ['#1a1233', '#43307a'], glow: '#c9b0ff', pat: 'hex', draw: (d) => floor(d, 60, 70, 38)
      + '<path d="M30 36L60 26L90 36" fill="none" stroke="#d8ccff" stroke-opacity=".6" stroke-dasharray="2 2"/>'
      + cube(30, 40, 10, '#2fbf8f') + cube(60, 30, 10, '#e8b545', true) + cube(90, 40, 10, '#ff6b8a')
      + `<circle cx="60" cy="16" r="2" fill="#fff"/>` + sparkle(60, 14, 4),
  },
  chainHistory: {
    bg: ['#20160a', '#4a3416'], glow: '#ffd99a', pat: 'lines', draw: (d) => '<path d="M18 52H102" stroke="#e8b545" stroke-width="2" stroke-dasharray="3 3"/>'
      + coin(d, 26, 48, 9, 'gold', 'G') + `<circle cx="54" cy="50" r="6" fill="${d.rad([[0, '#ffe7b0'], [1, '#c8912e']])}"/>` + `<circle cx="74" cy="50" r="6" fill="${d.rad([[0, '#c9e4ff'], [1, '#4a7fc0']])}"/>`
      + cube(96, 40, 9, '#5fd0a8', true) + sparkle(96, 22, 4) + '<text x="26" y="70" text-anchor="middle" font-size="6" fill="#ffe7b0" font-family="system-ui">2009</text><text x="96" y="70" text-anchor="middle" font-size="6" fill="#ffe7b0" font-family="system-ui">today</text>',
  },
  trilemma: {
    bg: ['#0f1433', '#2a2f6a'], glow: '#ffe08a', pat: 'grid', draw: (d) => '<path d="M60 14L94 64H26Z" fill="none" stroke="#ffe08a" stroke-opacity=".25" stroke-width="6" stroke-linejoin="round"/><path d="M60 14L94 64H26Z" fill="none" stroke="#ffe8a8" stroke-width="1.6" stroke-linejoin="round"/>'
      + `<circle cx="60" cy="14" r="7" fill="${d.rad([[0, '#ffffff'], [1, '#2fd38a']])}"/><circle cx="94" cy="64" r="7" fill="${d.rad([[0, '#ffffff'], [1, '#5b8cff']])}"/><circle cx="26" cy="64" r="7" fill="${d.rad([[0, '#ffffff'], [1, '#ff6b8a']])}"/>`
      + coin(d, 60, 46, 9) + '<path d="M44 52L76 52" stroke="#fff" stroke-opacity=".5" stroke-width="1" stroke-dasharray="1.5 2"/>',
  },
  layers: {
    bg: ['#08202e', '#145066'], glow: '#7ff0ff', pat: 'grid', draw: (d) => {
      const plate = (y: number, c: string, o: number) => `<path d="M60 ${y - 10}L92 ${y}L60 ${y + 10}L28 ${y}Z" fill="${c}" fill-opacity="${o}" stroke="${lighten(c, 0.5)}" stroke-width="1"/>`
      return floor(d, 60, 72, 32) + plate(60, '#3d7fd6', 0.85) + plate(47, '#2fbf8f', 0.8) + plate(34, '#e8b545', 0.8) + plate(21, '#ff6b8a', 0.75) + sparkle(92, 14, 3.5)
    },
  },
  useCases: {
    bg: ['#2a1a08', '#5a3a14'], glow: '#ffe08a', pat: 'dots', draw: (d) => floor(d, 60, 72, 18)
      + `<path d="M60 10a20 20 0 0 1 12 36v8H48v-8A20 20 0 0 1 60 10z" fill="${d.rad([[0, '#fffbe8'], [0.6, '#ffe08a', 0.85], [1, '#ffb84d', 0.6]], 0.45, 0.4, 0.7)}"/>`
      + `<rect x="48" y="54" width="24" height="10" rx="2" fill="${d.lin(SILVER)}"/><path d="M48 58h24M48 61h24" stroke="#7b8794"/>`
      + cube(60, 30, 7, '#3d7fd6', true) + sparkle(84, 16, 4) + sparkle(34, 22, 3),
  },
  w4Boss: { bg: ['#241a08', '#5a4314'], glow: '#ffd76b', pat: 'dots', draw: (d) => floor(d, 60, 66, 22) + trophy(d, '<path d="M54 38l9-9m-1-4a4 4 0 1 0 4 4" stroke="#fff8e1" stroke-width="2.6" fill="none" stroke-linecap="round"/>') + sparkle(30, 18, 4) + sparkle(92, 26, 3) },
  earnWays: {
    bg: ['#0e2a1d', '#1f5a3a'], glow: '#ffe08a', pat: 'dots', draw: (d) => {
      const pod = (x: number, h: number) => `<rect x="${x - 13}" y="${70 - h}" width="26" height="${h}" rx="2" fill="${d.lin([[0, '#e8ecf2'], [1, '#9aa4b0']])}"/>`
      return pod(30, 14) + pod(60, 22) + pod(90, 10)
        + coin(d, 60, 36, 10)
        + `<circle cx="30" cy="44" r="9" fill="${d.rad([[0, '#fffbe8'], [1, '#ffcf5c']])}"/><path d="M27 48h6M28 50h4" stroke="#7a5214"/>`
        + `<path d="M84 46h12M84 64h12M85 46c0 6 10 6 10 9s-10 3-10 9M95 46c0 6-10 6-10 9s10 3 10 9" stroke="${d.lin(GOLD)}" stroke-width="1.6" fill="none"/>`
    },
  },
  apps: {
    bg: ['#141633', '#33307a'], glow: '#b0c4ff', pat: 'grid', draw: (d) => floor(d, 60, 72, 20)
      + `<rect x="42" y="8" width="36" height="62" rx="7" fill="${d.lin([[0, '#3a3f4c'], [1, '#0e1016']])}"/><rect x="45" y="13" width="30" height="52" rx="4" fill="${d.lin([[0, '#1f2a5a'], [1, '#3a2a6e']])}"/>`
      + ['#2fd38a', '#5b8cff', '#ff6b8a', '#e8b545', '#7fe0ff', '#c9b0ff', '#ff8a3d', '#5fe08f', '#ffffff'].map((c, i) => `<rect x="${48 + (i % 3) * 9}" y="${18 + Math.floor(i / 3) * 10}" width="7" height="7" rx="2" fill="${c}"/>`).join('')
      + '<rect x="54" y="60" width="12" height="2" rx="1" fill="#fff" opacity=".6"/><path d="M47 15q8-1 14 0" stroke="#fff" stroke-opacity=".35"/>' + sparkle(88, 18, 3.5),
  },
  web2Skill: {
    bg: ['#1a1d24', '#3a4150'], glow: '#9fd8ff', pat: 'grid', draw: (d) => floor(d, 60, 70, 34)
      + `<rect x="32" y="16" width="56" height="36" rx="3" fill="${d.lin([[0, '#3a3f4c'], [1, '#14161c']])}"/><rect x="35" y="19" width="50" height="30" rx="1.5" fill="${d.lin([[0, '#0f2547'], [1, '#1f4a8a']])}"/>`
      + '<path d="M40 26h18M40 31h26M40 36h14" stroke="#7fe0ff" stroke-width="1.6" stroke-linecap="round"/><rect x="60" y="34" width="20" height="10" rx="4" fill="#2fd38a"/>'
      + `<path d="M26 52h68l-6 8H32z" fill="${d.lin(SILVER)}"/>` + coin(d, 90, 22, 6) + sparkle(100, 36, 3),
  },
  timePaths: {
    bg: ['#0a1838', '#1a3f7a'], glow: '#ffe08a', pat: 'dots', draw: (d) => floor(d, 60, 70, 20)
      + `<rect x="42" y="10" width="36" height="4" rx="2" fill="${d.lin(GOLD)}"/><rect x="42" y="64" width="36" height="4" rx="2" fill="${d.lin(GOLD)}"/>`
      + '<path d="M46 14c0 16 14 18 14 25s-14 9-14 25h28c0-16-14-18-14-25s14-9 14-25z" fill="#cfe8ff" fill-opacity=".35" stroke="#e6f2ff" stroke-width="1"/>'
      + '<path d="M52 20h16l-8 14z" fill="#f2c75c"/><path d="M48 62c2-8 10-10 12-10s10 2 12 10z" fill="#f2c75c"/><path d="M60 36v14" stroke="#f2c75c" stroke-width="1.4" stroke-dasharray="1.5 1.5"/>' + sparkle(86, 22, 3.5),
  },
  moneyPaths: {
    bg: ['#2a1410', '#5a2a1a'], glow: '#ffd27a', pat: 'lines', draw: (d) => floor(d) + stack(d, 40, 62, 12, 4)
      + '<path d="M54 48C66 48 70 30 84 26M54 52C68 54 74 46 92 46" stroke="#ffd27a" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M80 22l6 4-6 4M88 42l6 4-6 4" stroke="#ffd27a" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      + coin(d, 40, 34, 7) + sparkle(98, 20, 3),
  },
  builderPaths: {
    bg: ['#1a1d24', '#3a4150'], glow: '#ffb35c', pat: 'grid', draw: (d) => floor(d, 60, 70, 30)
      + '<path d="M36 26L22 40l14 14M84 26l14 14-14 14" stroke="#ffb35c" stroke-opacity=".3" stroke-width="9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
      + '<path d="M36 26L22 40l14 14M84 26l14 14-14 14" stroke="#ffd9a8" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M66 18L54 62" stroke="#ffd9a8" stroke-width="4" stroke-linecap="round"/>'
      + sparkle(60, 12, 3.5),
  },
  w5Boss: {
    bg: ['#241a08', '#5a4314'], glow: '#ffd76b', pat: 'dots', draw: (d) => floor(d, 60, 70, 26)
      + `<circle cx="60" cy="40" r="24" fill="${d.lin(GOLD, 0, 0, 1, 1)}"/><circle cx="60" cy="40" r="19" fill="${d.rad([[0, '#fff8e8'], [1, '#e6d6b4']])}"/>`
      + '<path d="M60 23l4 17-4 17-4-17z" fill="#c0392b"/><path d="M60 40l4 0-4 17-4-17z" fill="#5d6875"/><path d="M43 40l17-3 17 3-17 3z" fill="#8a93a8" opacity=".6"/><circle cx="60" cy="40" r="2.5" fill="#7a5214"/>'
      + '<path d="M44 30a19 19 0 0 1 12-8" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"/>' + sparkle(92, 18, 4),
  },
  wallets: {
    bg: ['#24170e', '#5a3a22'], glow: '#ffd27a', pat: 'lines', draw: (d) => floor(d, 58, 70, 34)
      + `<rect x="26" y="22" width="62" height="42" rx="7" fill="${d.lin([[0, '#a8683c'], [1, '#5a3218']], 0, 0, 1, 1)}"/>`
      + '<rect x="30" y="16" width="44" height="16" rx="3" fill="#e8ecf2" transform="rotate(-6 52 24)"/><rect x="34" y="20" width="20" height="3" rx="1.5" fill="#5b8cff" transform="rotate(-6 52 24)"/>'
      + '<rect x="29" y="25" width="56" height="36" rx="5" fill="none" stroke="#e6c79a" stroke-opacity=".6" stroke-dasharray="2 1.6"/>'
      + `<rect x="66" y="36" width="26" height="16" rx="5" fill="${d.lin([[0, '#7a4a28'], [1, '#4a2a14']])}"/><circle cx="76" cy="44" r="3.4" fill="${d.lin(GOLD)}"/>` + coin(d, 94, 58, 7),
  },
  explorer: {
    bg: ['#0c1a2e', '#1f3f66'], glow: '#9fd8ff', pat: 'hex', draw: (d) => floor(d, 54, 70, 28) + cube(48, 36, 13, '#3d7fd6')
      + '<path d="M38 50h20M38 54h14" stroke="#9fd8ff" stroke-width="1.2" opacity=".7"/>'
      + `<circle cx="70" cy="38" r="15" fill="${d.rad([[0, '#ffffff', 0.3], [1, '#bfe4ff', 0.1]])}" stroke="${d.lin(SILVER, 0, 0, 1, 1)}" stroke-width="4"/><path d="M80 49L94 63" stroke="#c9d1db" stroke-width="6" stroke-linecap="round"/><path d="M62 30a11 11 0 0 1 8-4" stroke="#fff" stroke-opacity=".8" stroke-width="2" fill="none" stroke-linecap="round"/>`,
  },
  scams: {
    bg: ['#1f0a0c', '#5a1418'], glow: '#ff6b5c', pat: 'lines', draw: (d) => '<path d="M60 0V30" stroke="#e6edf5" stroke-width=".8"/>'
      + `<path d="M60 30v16a10 10 0 0 1-20 0v-4l-4 4" fill="none" stroke="${d.lin(SILVER, 0, 0, 1, 1)}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`
      + coin(d, 50, 56, 9) + '<path d="M86 22l10 18H76z" fill="#ffcf5c" stroke="#7a5214" stroke-width="1"/><path d="M86 28v6" stroke="#5a3b1a" stroke-width="2" stroke-linecap="round"/><circle cx="86" cy="37" r="1.2" fill="#5a3b1a"/>' + sparkle(28, 20, 3, 0.6),
  },
  community: {
    bg: ['#0e2a24', '#1f5a4a'], glow: '#9dffd8', pat: 'dots', draw: (d) => {
      const bust = (x: number, y: number, s: number, c: string) => `<circle cx="${x}" cy="${y}" r="${7 * s}" fill="${d.rad([[0, lighten(c, 0.5)], [1, c]], 0.4, 0.35, 0.8)}"/><path d="M${x - 13 * s} ${y + 22 * s}a${13 * s} ${13 * s} 0 0 1 ${26 * s} 0z" fill="${d.lin([[0, lighten(c, 0.3)], [1, darken(c, 0.3)]])}"/>`
      return floor(d, 60, 70, 34) + bust(38, 42, 0.9, '#c98f6a') + bust(82, 42, 0.9, '#6a4a3a') + bust(60, 36, 1.1, '#e8b88a')
        + `<path d="M74 10h22a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H84l-6 5v-5h-4a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4z" fill="#fff"/><path d="M85 22c-4-3-6-5-6-7a2.4 2.4 0 0 1 6-1 2.4 2.4 0 0 1 6 1c0 2-2 4-6 7z" fill="#ff5d7a"/>`
    },
  },
  content: {
    bg: ['#2a0e33', '#6a2a7a'], glow: '#ffb0f0', pat: 'dots', draw: (d) => floor(d, 54, 70, 28)
      + `<path d="M32 34h10l30-16v44L42 46H32z" fill="${d.lin([[0, '#ffffff'], [1, '#c9b0e8']], 0, 0, 1, 1)}"/><path d="M36 46l4 14h7l-3-14" fill="#9a7ab8"/>`
      + `<rect x="70" y="18" width="5" height="44" rx="2.5" fill="${d.lin([[0, '#ff6bd0'], [1, '#9a2a8a']])}"/>`
      + '<path d="M82 30a12 12 0 0 1 0 20M88 24a20 20 0 0 1 0 32" stroke="#ffb0f0" stroke-width="2.4" fill="none" stroke-linecap="round"/>' + sparkle(98, 16, 3.5) + sparkle(24, 20, 2.5, 0.7),
  },
  defi: {
    bg: ['#0c1433', '#22337a'], glow: '#9fd0ff', pat: 'hex', draw: (d) => floor(d, 60, 70, 34)
      + '<path d="M40 28A24 24 0 0 1 80 28" stroke="#9fd0ff" stroke-width="2.4" fill="none"/><path d="M76 23l4 5-6 1" stroke="#9fd0ff" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      + '<path d="M80 54A24 24 0 0 1 40 54" stroke="#9fd0ff" stroke-width="2.4" fill="none"/><path d="M44 59l-4-5 6-1" stroke="#9fd0ff" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
      + coin(d, 38, 40, 11) + coin(d, 82, 40, 11, '#5b8cff', '$'),
  },
  nfts: {
    bg: ['#2a140e', '#6a3422'], glow: '#ffc4a0', pat: 'dots', draw: (d) => floor(d, 60, 72, 28)
      + `<rect x="30" y="10" width="60" height="56" rx="3" fill="${d.lin(GOLD, 0, 0, 1, 1)}"/><rect x="35" y="15" width="50" height="46" fill="${d.lin([[0, '#2a1f5a'], [0.5, '#7a3a9a'], [1, '#ff8a6b']], 0, 0, 1, 1)}"/>`
      + '<path d="M60 24l10 10-10 18-10-18z" fill="#9ff0ff" fill-opacity=".85"/><path d="M50 34h20M60 24l-4 10 4 18 4-18z" stroke="#fff" stroke-opacity=".7" fill="none" stroke-width=".8"/>'
      + '<circle cx="76" cy="22" r="4" fill="#ffe08a"/><path d="M35 52q12-8 25 0t25-2V61H35z" fill="#1a1238" fill-opacity=".55"/>' + sparkle(92, 12, 4) + sparkle(26, 54, 2.5, 0.7),
  },
  daos: {
    bg: ['#141633', '#33307a'], glow: '#c9c0ff', pat: 'grid', draw: (d) => floor(d, 60, 72, 30)
      + `<rect x="62" y="10" width="22" height="28" rx="2" fill="#fff" transform="rotate(8 73 24)"/><path d="M67 24l4 4 8-9" stroke="#2fd38a" stroke-width="3" fill="none" stroke-linecap="round" transform="rotate(8 73 24)"/>`
      + `<path d="M32 36h56l-4 30H36z" fill="${d.lin([[0, '#5b6cff'], [1, '#2a2f7a']], 0, 0, 1, 1)}"/><path d="M32 36h56v-4H32z" fill="${d.lin(SILVER)}"/><rect x="48" y="33" width="24" height="3" rx="1.5" fill="#14162e"/>`
      + '<path d="M44 52h32" stroke="#fff" stroke-opacity=".3"/>' + [44, 54, 64, 74].map((x) => `<circle cx="${x + 2}" cy="58" r="2.4" fill="#e8ecff" opacity=".8"/>`).join(''),
  },
}

export function courseArt(id: SkillId, cls = 'lx-art'): HTMLElement {
  const a = ART[id] ?? ART.spot
  const d = new Defs()
  const back = d.lin([[0, a.bg[0]], [1, a.bg[1]]], 0, 0, 1, 1)
  const pat = d.pattern(a.pat)
  const glow = d.rad([[0, a.glow, 0.55], [0.55, a.glow, 0.12], [1, a.glow, 0]])
  const vignette = d.rad([[0.55, '#000', 0], [1, '#000', 0.45]], 0.5, 0.45, 0.75)
  const body = a.draw(d)
  const w = document.createElement('div'); w.className = cls; w.setAttribute('aria-hidden', 'true')
  w.innerHTML = `<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice">${d.out()}<rect width="120" height="80" fill="${back}"/><rect width="120" height="80" fill="${pat}"/><ellipse cx="60" cy="40" rx="54" ry="40" fill="${glow}"/>${body}<rect width="120" height="80" fill="${vignette}"/><path d="M0 0H120V22C80 30 40 14 0 26Z" fill="#fff" opacity=".05"/></svg>`
  return w
}

/** The picture for a career track: the course art closest to that kind of work. */
const TRACK_ART: Record<string, SkillId> = {
  trading: 'spot', investing: 'moneyPaths', defi: 'defi', airdrops: 'airdrops', infofi: 'content', prediction: 'risk', nfts: 'nfts', gaming: 'apps',
  content: 'content', jobs: 'web2Skill', building: 'building', daos: 'daos', grants: 'w1Boss', infra: 'chainBlocks', business: 'custody', ai: 'agents', scams: 'scams',
}
export function careerArt(track: string, cls = 'cr-art'): HTMLElement { return courseArt(TRACK_ART[track] ?? 'useCases', cls) }

/** A real photo or diagram for the course (Wikimedia Commons, credited under it); the drawn art when there is none. */
/** The picture at the top of a lesson: the course's own original illustration (the same art as its Campus
 *  card), drawn for the topic. Stock photos from Wikimedia (an old AOL CD, a bank's phishing email) read as
 *  placeholders, so lessons no longer use them. */
export function courseVisual(id: SkillId, cls = 'lx-hero'): HTMLElement {
  return courseArt(id, cls)
}
