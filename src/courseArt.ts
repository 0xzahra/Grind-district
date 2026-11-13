// Original, tiny inline SVG illustrations per course topic (no images to download). Calm palette, no glow.
import type { SkillId } from './logic.ts'
import { COURSE_PHOTOS } from './coursePhotos.ts'
type Art = { bg: [string, string]; m: string }
const coin = (x: number, y: number, r: number, c = '#e9c77b') => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x}" cy="${y}" r="${r * 0.68}" fill="none" stroke="#9c7a35" stroke-width="2"/>`
const bars = (c: string) => [14, 26, 20, 36, 30, 44].map((hh, i) => `<rect x="${18 + i * 14}" y="${70 - hh}" width="9" height="${hh}" rx="2" fill="${c}" opacity="${0.55 + i * 0.07}"/>`).join('')
const line = (c: string) => `<polyline points="14,62 32,50 46,56 62,34 78,40 100,18" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
const shield = (c: string) => `<path d="M60 12 L88 22 V42 C88 58 76 68 60 74 C44 68 32 58 32 42 V22 Z" fill="${c}"/><path d="M48 42 l8 8 l16 -16" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`
const blocks = (c: string) => [[30, 20], [56, 20], [43, 42], [69, 42]].map(([x, y]) => `<rect x="${x}" y="${y}" width="22" height="18" rx="3" fill="${c}" stroke="#fff" stroke-opacity=".5"/>`).join('') + `<path d="M52 29h4M65 51h4M54 38l-4 4M70 38l-4 4" stroke="#fff" stroke-width="2"/>`
const people = (c: string) => [[40, 1], [60, 1.2], [80, 1]].map(([x, s]) => `<circle cx="${x}" cy="${34 - s! * 4}" r="${8 * s!}" fill="${c}"/><path d="M${x! - 13 * s!} 70 a${13 * s!} ${15 * s!} 0 0 1 ${26 * s!} 0z" fill="${c}"/>`).join('')
const leaf = (c: string) => `<path d="M30 66 C30 30 60 14 94 14 C94 50 70 70 34 66 Z" fill="${c}"/><path d="M34 64 C50 48 66 36 86 22" stroke="#fff" stroke-opacity=".7" stroke-width="2.5" fill="none"/>`
const key = (c: string) => `<circle cx="42" cy="42" r="16" fill="none" stroke="${c}" stroke-width="7"/><path d="M56 42 H96 M84 42 v12 M94 42 v8" stroke="${c}" stroke-width="7" stroke-linecap="round"/>`
const bot = (c: string) => `<rect x="34" y="24" width="52" height="40" rx="10" fill="${c}"/><circle cx="50" cy="44" r="5" fill="#fff"/><circle cx="70" cy="44" r="5" fill="#fff"/><path d="M60 24 V14" stroke="${c}" stroke-width="4"/><circle cx="60" cy="12" r="4" fill="${c}"/>`
const chat = (c: string) => `<rect x="22" y="16" width="54" height="32" rx="10" fill="${c}"/><path d="M34 48 l-4 12 l14 -12z" fill="${c}"/><rect x="50" y="36" width="50" height="28" rx="10" fill="#fff" opacity=".85"/><path d="M60 50h30" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`
const lens = (c: string) => `<circle cx="52" cy="38" r="20" fill="none" stroke="${c}" stroke-width="7"/><path d="M66 52 L90 72" stroke="${c}" stroke-width="8" stroke-linecap="round"/><path d="M42 38h20M52 28v20" stroke="${c}" stroke-width="3"/>`
const frame = (c: string) => `<rect x="30" y="14" width="60" height="54" rx="4" fill="#fff" opacity=".9"/><rect x="36" y="20" width="48" height="36" fill="${c}"/><circle cx="50" cy="32" r="5" fill="#fff"/><path d="M36 56 l16 -14 l10 8 l10 -12 l12 18z" fill="#fff" opacity=".7"/>`
const vote = (c: string) => `<rect x="30" y="38" width="60" height="30" rx="4" fill="${c}"/><rect x="48" y="14" width="24" height="30" rx="3" fill="#fff"/><path d="M53 28 l5 5 l9 -10" stroke="${c}" stroke-width="3" fill="none"/><rect x="44" y="36" width="32" height="5" rx="2" fill="#1b1b1b" opacity=".4"/>`
const drop = (c: string) => `<path d="M60 10 C72 30 84 42 84 54 A24 24 0 0 1 36 54 C36 42 48 30 60 10Z" fill="${c}"/><path d="M50 54 a10 10 0 0 0 10 10" stroke="#fff" stroke-width="3" fill="none"/>`
const ART: Record<SkillId, Art> = {
  spot: { bg: ['#1d3b5c', '#2f6a8f'], m: bars('#e9c77b') },
  risk: { bg: ['#4a2b2b', '#8f4f3f'], m: line('#ffd9b0') + `<circle cx="100" cy="18" r="5" fill="#ffd9b0"/>` },
  staking: { bg: ['#23402f', '#3f7a52'], m: coin(46, 50, 16) + coin(66, 40, 16) + coin(86, 30, 16) },
  airdrops: { bg: ['#1e3550', '#4e7fae'], m: `<path d="M30 30 a30 22 0 0 1 60 0z" fill="#f3e3d3"/><path d="M32 30 L60 56 L88 30" stroke="#f3e3d3" stroke-width="2" fill="none"/>` + coin(60, 62, 9) },
  memes: { bg: ['#4b3a1a', '#9c7a35'], m: `<circle cx="60" cy="40" r="26" fill="#f6d27a"/><circle cx="50" cy="34" r="4" fill="#3a2a10"/><circle cx="70" cy="34" r="4" fill="#3a2a10"/><path d="M46 48 q14 12 28 0" stroke="#3a2a10" stroke-width="4" fill="none" stroke-linecap="round"/>` },
  agents: { bg: ['#2a2f4a', '#4f5a8f'], m: bot('#cfd7ff') },
  building: { bg: ['#2b2f36', '#4a5260'], m: blocks('#d9b26a') },
  carbon: { bg: ['#1f3a2a', '#3e7a50'], m: leaf('#b7e0b0') },
  custody: { bg: ['#2d2a40', '#5a4f8a'], m: key('#e9c77b') },
  stables: { bg: ['#1f3c3c', '#3f7a78'], m: coin(60, 40, 24, '#cfe8d8') + `<text x="60" y="48" text-anchor="middle" font-size="22" font-weight="700" fill="#1f3c3c">$</text>` },
  liquidity: { bg: ['#1a3550', '#2f6a9f'], m: drop('#a9d4ff') },
  records: { bg: ['#3a3326', '#6b5c40'], m: `<rect x="34" y="12" width="52" height="60" rx="4" fill="#f3ead8"/>` + [24, 34, 44, 54].map((y) => `<path d="M42 ${y}h36" stroke="#6b5c40" stroke-width="3" stroke-linecap="round"/>`).join('') },
  internet: { bg: ['#1d3b5c', '#2f6a8f'], m: chat('#cfe3ff') },
  money: { bg: ['#4b3a1a', '#9c7a35'], m: coin(46, 44, 18) + coin(74, 40, 18) },
  webEras: { bg: ['#2a2f4a', '#4f5a8f'], m: line('#cfd7ff') },
  w1Boss: { bg: ['#3a2a10', '#c9a25e'], m: shield('#e9c77b') },
  redFlags: { bg: ['#4a2b2b', '#8f4f3f'], m: lens('#ffd9b0') },
  p2pSharks: { bg: ['#1f3c3c', '#3f7a78'], m: people('#cfe8d8') },
  w2Boss: { bg: ['#3a2a10', '#c9a25e'], m: shield('#f3e3d3') },
  chainBlocks: { bg: ['#2b2f36', '#4a5260'], m: blocks('#a9d4ff') },
  chainTraits: { bg: ['#23402f', '#3f7a52'], m: shield('#b7e0b0') },
  chainTypes: { bg: ['#2d2a40', '#5a4f8a'], m: blocks('#e9c77b') },
  chainHistory: { bg: ['#1e3550', '#4e7fae'], m: line('#e9c77b') },
  trilemma: { bg: ['#3a2a10', '#c9a25e'], m: vote('#e9c77b') },
  layers: { bg: ['#1a3550', '#2f6a9f'], m: bars('#a9d4ff') },
  useCases: { bg: ['#1f3a2a', '#3e7a50'], m: frame('#3e7a50') },
  w4Boss: { bg: ['#3a2a10', '#c9a25e'], m: key('#f3e3d3') },
  earnWays: { bg: ['#23402f', '#3f7a52'], m: coin(46, 50, 16) + coin(66, 40, 16) + coin(86, 30, 16) },
  apps: { bg: ['#2b2f36', '#4a5260'], m: people('#d9b26a') },
  web2Skill: { bg: ['#2a2f4a', '#4f5a8f'], m: chat('#cfd7ff') },
  timePaths: { bg: ['#1e3550', '#4e7fae'], m: vote('#f3e3d3') },
  moneyPaths: { bg: ['#4a2b2b', '#8f4f3f'], m: line('#ffd9b0') },
  builderPaths: { bg: ['#2b2f36', '#4a5260'], m: bot('#d9b26a') },
  w5Boss: { bg: ['#3a2a10', '#c9a25e'], m: drop('#e9c77b') },
  wallets: { bg: ['#3a2a20', '#7a5540'], m: `<rect x="24" y="22" width="72" height="46" rx="8" fill="#d9a77a"/><rect x="66" y="36" width="34" height="18" rx="6" fill="#7a5540"/><circle cx="76" cy="45" r="4" fill="#e9c77b"/>` },
  explorer: { bg: ['#203040', '#3f5f7f'], m: lens('#cfe2f5') },
  scams: { bg: ['#40221f', '#7f3f35'], m: shield('#e8b0a0') },
  community: { bg: ['#2a3a30', '#4f7a5f'], m: people('#d8ead0') },
  content: { bg: ['#3a2440', '#6f4a7f'], m: chat('#efd6f5') },
  defi: { bg: ['#1f2f45', '#405f8f'], m: coin(40, 40, 14) + `<path d="M56 40h12m-4 -5l5 5l-5 5" stroke="#fff" stroke-width="3" fill="none"/>` + coin(86, 40, 14, '#a9d4ff') },
  nfts: { bg: ['#40302a', '#8a5f4a'], m: frame('#c98f6a') },
  daos: { bg: ['#2a2f40', '#4f5a7a'], m: vote('#cfd7ff') },
}
export function courseArt(id: SkillId, cls = 'lx-art'): HTMLElement {
  const a = ART[id] ?? ART.spot
  const w = document.createElement('div'); w.className = cls; w.setAttribute('aria-hidden', 'true')
  const gid = `g-${id}-${cls}`
  w.innerHTML = `<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a.bg[0]}"/><stop offset="1" stop-color="${a.bg[1]}"/></linearGradient></defs><rect width="120" height="80" fill="url(#${gid})"/><circle cx="104" cy="10" r="26" fill="#fff" opacity=".06"/><circle cx="12" cy="78" r="30" fill="#000" opacity=".1"/>${a.m}</svg>`
  return w
}

/** A real photo or diagram for the course (Wikimedia Commons, credited under it); the drawn art when there is none. */
export function courseVisual(id: SkillId, cls = 'lx-hero'): HTMLElement {
  const p = COURSE_PHOTOS[id]
  if (!p) return courseArt(id, cls)
  const fig = document.createElement('figure'); fig.className = 'lx-photo'
  const img = document.createElement('img')
  img.src = `/img/courses/${id}.webp`; img.alt = p.alt; img.loading = 'lazy'; img.decoding = 'async'
  img.onerror = () => fig.replaceWith(courseArt(id, cls))
  const cap = document.createElement('figcaption'); cap.dataset.noI18n = ''
  const a = document.createElement('a'); a.href = p.page; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Wikimedia Commons'
  cap.append(`${p.author ? `${p.author} · ` : ''}${p.license} · `, a)
  fig.append(img, cap)
  return fig
}
