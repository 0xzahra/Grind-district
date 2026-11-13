import { itemPic } from './itemPics.ts'
import { getMorph, setMorph, HAIRS, SKIN_TONES, type Style } from './morph.ts'
import { isLicensed, skinSlots } from './skins.ts'
import { schedule } from './events.ts'
import { NFT_COLLECTIONS_ENABLED } from './nft.ts'
import { notificationsOn, setNotifications } from './agent.ts'
import { type MaskId } from './logic.ts'
import { openCertificate, shareCv } from './certs.ts'
import { renderCvPaper, printCv } from './cvPaper.ts'
import { lockReason, worldOf } from './worlds.ts'
import { equippedFrame } from './career.ts'
// Signed-in players: the look saves to the account through the existing profile upsert (debounced).
let lookTimer = 0
const saveLookSoon = () => { clearTimeout(lookTimer); lookTimer = window.setTimeout(() => void publishProfile(), 1500) }
import { shareLink, profileLink, shareToX, publishProfile } from './share.ts'
import { bookRows, publicDoc, type BookRow } from './logic.ts'
import { renderExchange } from './exchange.ts'
import { watchPerps } from './perps.ts'
import { track } from './track.ts'
import { getAddress } from 'viem'
import { COURSES, headlines } from './courses.ts'
import { renderLearnHome } from './learnUi.ts'
import { biteCards } from './mentor.ts'
import { courseVisual } from './courseArt.ts'
import { nearPassportOn, nearPassportPanel } from './nearPassport.ts'
import { renderBadges, renderLuxury } from './luxury.ts'
import { GUIDE } from './guide.ts'
import { PIECES, owns, own, wear, worn, type Piece, type Slot } from './wardrobe.ts'
import { lookShot, newShootBatch, type Frame } from './lookShots.ts'
import type { Extras, HumanModel, Look } from './humans.ts'
import { HOUSES, type HouseId } from './houses.ts'
import { languagePicker } from './i18n.ts'
import { renderCalendar } from './calendar.ts'
import { speak, stopSpeaking } from './speech.ts'
import {
  BODIES,
  CHAIN_USD,
  CLIMATE_USD,
  COURSE_XP,
  COURSE_CASH,
  DRONES,
  VEHICLES,
  MASKS,
  PROJECTS,
  RESELL_USD,
  SKILL_META,
  TAX_USD,
  TINTS,
  TINT_STYLE,
  money,
  nextRank,
  progressToNext,
  rankFor,
  rankToast,
  seasonAt,
  seasonLabel,
  sharedText,
  todayTasks,
  type PanelId,
  type RankId,
  type SharedProfile,
  type SkillId,
} from './logic.ts'
import {
  attendChurch,
  buyChain,
  buyWant,
  buyDrone,
  buyVehicle,
  claimHouse,
  markHouseVisit,
  declineTax,
  dismissIntro,
  finishGym,
  getSave,
  balanceSplit,
  hearTalk,
  joinEvent,
  noteTalk,
  orderWater,
  payTax,
  pledge,
  postBounty,
  readCafe,
  readRobot,
  resetProgress,
  pocketDrone,
  sellChain,
  setBody,
  setMask,
  setGraphics,
  setHints,
  setMapSize,
  setReduceMotion,
  setTime,
  setTint,
  setName,
  setUsername,
  sitPrayer,
  submitCourse,
  subscribe,
  walkGym,
  type CourseResult,
} from './state.ts'

type Tab = 'today' | 'cv' | 'resume' | 'portfolio' | 'books'
type PeerView = { shot: string | null; partial: boolean; onMessage: () => void }
type OpenExtra = { shared?: SharedProfile; tab?: Tab; house?: HouseId; peer?: PeerView; course?: SkillId }

type Hooks = {
  onStyle: () => void
  onBody: () => void
  onLook: () => void
  onGraphics: () => void
  onPrefs: () => void
  onRank: (label: string) => void
  travel?: (title: string, enter?: boolean) => void
  /** Baked top-down map (data URL, '' if not baked yet), its half-extent in metres, and pin positions by guide title. */
  satMap?: () => { url: string; limit: number; pins: Array<{ title: string; x: number; z: number }>; me?: { x: number; z: number } }
  portrait?: () => string | null
}

export type Ui = {
  isOpen: () => boolean
  open: (panel: PanelId, extra?: OpenExtra) => void
  close: () => void
  toast: (text: string) => void
  setPlace: (place: string) => void
  refresh: () => void
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const node = document.createElement('button')
  node.type = 'button'
  node.className = className
  node.textContent = label
  node.addEventListener('click', onClick)
  return node
}

function para(text: string, className = ''): HTMLParagraphElement {
  const node = document.createElement('p')
  if (className) node.className = className
  node.textContent = text
  return node
}

function stack(...nodes: Array<Node | string>): HTMLDivElement {
  const node = document.createElement('div')
  node.className = 'stack'
  node.append(...nodes)
  return node
}

/** Which figure, colours and framing photograph a boutique piece (the same choice the avatar itself makes). */
function shotFor(pc: Piece, lady: boolean): { key: string; model: HumanModel; look?: Look; frame: Frame; extras?: Extras } | null {
  const key = `${pc.id}:${lady ? 'f' : 'm'}`
  if (pc.slot === 'look') return pc.figure ? { key, model: pc.figure as HumanModel, look: pc.palette, frame: 'full' } : null
  if (pc.slot === 'top') {
    const model: HumanModel = lady ? (/^abaya/.test(pc.id) ? 'abaya' : pc.model === 'casual' ? 'woman3' : 'woman4') : /kaftan|agbada/.test(pc.id) ? 'kurta' : pc.model === 'suit' ? 'man4' : 'man1'
    return { key, model, look: { top: pc.hex, ...(pc.model === 'suit' ? { bottom: pc.hex } : {}) }, frame: 'full' }
  }
  if (pc.slot === 'bottom') return { key, model: lady ? 'woman3' : 'man1', look: { bottom: pc.hex }, frame: 'legs' }
  if (pc.slot === 'shoes') return { key, model: lady ? 'woman3' : 'man1', look: { shoes: pc.hex }, frame: 'feet' }
  // Jewellery on the neck, ear, hand or wrist it is measured to.
  const on: HumanModel = lady ? 'look_gown' : 'look_navy'
  if (pc.kind === 'earrings') return { key, model: 'look_skirtsuit', frame: 'face', extras: { earrings: pc.id === 'ear-drops' ? 'drops' : pc.id === 'ear-hoops' ? 'hoops' : 'studs' } }
  if (pc.kind === 'necklace') return { key, model: on, frame: 'top', extras: { necklace: pc.id === 'neck-pendant' ? 'pendant' : pc.id === 'pearls' ? 'pearls' : 'chain' } }
  return null
}

/** Small original clothing silhouette in the piece's own colour, so the boutique shows clothes, not labels. */
function garment(slot: string, label: string, c: string): string {
  const L = label.toLowerCase()
  const svg = (b: string) => `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">${b}</svg>`
  const st = 'stroke="rgba(0,0,0,.35)" stroke-width="1"'
  if (slot === 'look') {
    if (/abaya|thobe|tunic|kurta|gown/.test(L)) return svg(`<path d="M16 3h8l2 6 8 5-3 6-4-2 3 19H10l3-19-4 2-3-6 8-5z" fill="${c}" ${st}/>`)
    if (/dress|skirt|soir|set/.test(L)) return svg(`<path d="M15 4h10l2 8-3 3 8 21H8l8-21-3-3z" fill="${c}" ${st}/>`)
    return svg(`<path d="M13 5l7 6 7-6 8 5-3 9-4-2v19H12V17l-4 2-3-9z" fill="${c}" ${st}/><path d="M20 11v25M20 11l-4 10M20 11l4 10" stroke="rgba(0,0,0,.4)" fill="none"/>`)
  }
  if (slot === 'earrings') return svg(`<circle cx="13" cy="11" r="2.4" fill="${c}"/><circle cx="27" cy="11" r="2.4" fill="${c}"/><circle cx="13" cy="24" r="6" fill="none" stroke="${c}" stroke-width="2.4"/><circle cx="27" cy="24" r="6" fill="none" stroke="${c}" stroke-width="2.4"/>`)
  if (slot === 'necklace') return svg(`<path d="M8 6c0 16 6 24 12 24s12-8 12-24" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/><path d="M20 28l4 5-4 4-4-4z" fill="${c}" ${st}/>`)
  if (slot === 'ring') return svg(`<circle cx="20" cy="25" r="9" fill="none" stroke="${c}" stroke-width="3.2"/><path d="M20 6l5 5-5 6-5-6z" fill="${c}" ${st}/>`)
  if (slot === 'watch') return svg(`<rect x="15" y="3" width="10" height="34" rx="3" fill="rgba(255,255,255,.18)"/><circle cx="20" cy="20" r="9" fill="${c}" ${st}/><path d="M20 15v5l4 2" stroke="rgba(0,0,0,.55)" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)
  if (slot === 'top') {
    if (/dress|gown|kaftan|boubou/.test(L)) return svg(`<path d="M15 4h10l2 8-3 3 8 21H8l8-21-3-3z" fill="${c}" ${st}/>`)
    if (/suit|blazer|jacket|coat/.test(L)) return svg(`<path d="M13 5l7 6 7-6 8 5-3 9-4-2v19H12V17l-4 2-3-9z" fill="${c}" ${st}/><path d="M20 11v25M20 11l-4 10M20 11l4 10" stroke="rgba(0,0,0,.4)" fill="none"/>`)
    return svg(`<path d="M14 5c2 3 10 3 12 0l9 5-3 8-4-2v20H12V16l-4 2-3-8z" fill="${c}" ${st}/>`)
  }
  if (slot === 'bottom') {
    if (/skirt/.test(L)) return svg(`<path d="M13 5h14l6 30H7z" fill="${c}" ${st}/>`)
    return svg(`<path d="M12 4h16l2 32h-7l-3-22-3 22h-7z" fill="${c}" ${st}/>`)
  }
  if (slot === 'shoes') {
    if (/heel|pump/.test(L)) return svg(`<path d="M6 26c6 0 12-10 18-10 4 0 9 4 10 10H24l-2 4h-2l1-4z" fill="${c}" ${st}/>`)
    return svg(`<path d="M5 22c4 0 7-6 12-6 3 4 9 6 14 6 3 0 4 3 4 6H5z" fill="${c}" ${st}/><path d="M5 28h30" stroke="#eee" stroke-width="2"/>`)
  }
  if (/bag|tote/.test(L)) return svg(`<path d="M14 14a6 6 0 0 1 12 0" fill="none" stroke="${c}" stroke-width="3"/><rect x="8" y="14" width="24" height="20" rx="3" fill="${c}" ${st}/>`)
  if (/hat|cap/.test(L)) return svg(`<path d="M8 26c0-10 24-10 24 0z" fill="${c}" ${st}/><path d="M4 26h32" stroke="${c}" stroke-width="4"/>`)
  if (/glass|shade/.test(L)) return svg(`<circle cx="12" cy="20" r="7" fill="${c}" ${st}/><circle cx="28" cy="20" r="7" fill="${c}" ${st}/><path d="M19 20h2" stroke="${c}" stroke-width="2"/>`)
  if (/watch/.test(L)) return svg(`<rect x="16" y="4" width="8" height="32" rx="3" fill="#444"/><circle cx="20" cy="20" r="8" fill="${c}" ${st}/>`)
  return svg(`<circle cx="20" cy="20" r="11" fill="${c}" ${st}/>`)
}

// Lesson voice: on unless the player paused it (then it stays paused until they press Play).
const LESSON_VOICE = 'gd.lessonVoice'
const lessonVoiceOn = () => { try { return localStorage.getItem(LESSON_VOICE) !== 'off' } catch { return true } }
const setLessonVoice = (on: boolean) => { try { localStorage.setItem(LESSON_VOICE, on ? 'on' : 'off') } catch { /* session only */ } }
const ZAHRA = { gender: 'f', seed: 3, voice: 'zahra' } as const

export function mountUi(
  sheet: HTMLElement,
  toastNode: HTMLElement,
  pills: {
    rank: HTMLElement
    place: HTMLElement
    ledger: HTMLElement
    season: HTMLElement
    focus: HTMLElement
  },
  hooks: Hooks,
): Ui {
  let current: PanelId | null = null
  let place = 'The Plaza'
  let sharedHold: SharedProfile | null = null
  let peerHold: PeerView | null = null
  let raf = 0
  let toastTimer = 0

  let lastToast = ''
  let lastToastAt = 0
  const toast = (text: string) => {
    if (!notificationsOn()) return
    // Same message again within 4 s: keep the one on screen (no stacking/spam from repeated taps).
    if (text === lastToast && Date.now() - lastToastAt < 4000) return
    lastToast = text
    lastToastAt = Date.now()
    toastNode.hidden = false
    toastNode.textContent = text
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toastNode.hidden = true
    }, 4200)
  }

  // Open practice perpetuals are checked against the market while the game runs; a liquidation is announced.
  watchPerps(toast)

  // Balance feedback without sound: count the pill toward the new value and float a +/- chip.
  let shownLedger: number | null = null
  let ledgerAnim = 0
  const animateLedger = (target: number) => {
    if (shownLedger === null || Math.abs(target - shownLedger) < 0.005) { shownLedger = target; pills.ledger.textContent = `Balance ${money(target)}`; return }
    const from = shownLedger
    const delta = target - from
    shownLedger = target
    const chip = document.createElement('span')
    chip.className = `ledger-chip ${delta >= 0 ? 'up' : 'down'}`
    chip.textContent = `${delta >= 0 ? '+' : '-'}${money(Math.abs(delta))}`
    pills.ledger.parentElement?.append(chip)
    setTimeout(() => chip.remove(), 1600)
    pills.ledger.classList.remove('ledger-up', 'ledger-down')
    void pills.ledger.offsetWidth
    pills.ledger.classList.add(delta >= 0 ? 'ledger-up' : 'ledger-down')
    cancelAnimationFrame(ledgerAnim)
    const t0 = performance.now()
    const stepFn = (t: number) => {
      const k = Math.min(1, (t - t0) / 700)
      pills.ledger.textContent = `Balance ${money(from + delta * (1 - Math.pow(1 - k, 3)))}`
      if (k < 1) ledgerAnim = requestAnimationFrame(stepFn)
    }
    ledgerAnim = requestAnimationFrame(stepFn)
  }

  const refresh = () => {
    const save = getSave()
    pills.rank.textContent = rankFor(save.xp).label
    pills.place.textContent = place
    animateLedger(save.ledger)
    pills.season.textContent = seasonLabel(seasonAt())
    pills.focus.hidden = !save.focus
  }

  const finish = (message: string, rankedUp?: RankId) => {
    if (rankedUp) {
      hooks.onRank(rankFor(getSave().xp).label)
      toast(`${rankToast(rankedUp)} ${message}`)
      return
    }
    toast(message)
  }

  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  let open!: (panel: PanelId, extra?: OpenExtra) => void
  let houseId: HouseId = 'yours'
  let courseHold: SkillId | null = null

  sheet.addEventListener('pointerdown', (event) => { if (event.target === sheet) close() })
  const close = () => {
    const was = current
    stop()
    stopSpeaking()
    current = null
    sheet.hidden = true
    sheet.replaceChildren()
    document.body.classList.remove('sheet-open')
    if (was === 'intro') dismissIntro()
    if (was === 'shared' && !getSave().seenIntro) open('intro')
  }

  const frame = (title: string, body: HTMLElement): HTMLElement => {
    const card = document.createElement('div')
    card.className = 'sheet-card'
    const head = document.createElement('div')
    head.className = 'sheet-head'
    const heading = document.createElement('h2')
    heading.id = 'sheet-title'
    heading.textContent = title
    head.append(heading, button('Close', 'ghost', close))
    card.append(head, body)
    return card
  }

  const advice = () => para('Practice only. Not financial, legal, or investment advice.', 'muted')

  const strip = (...btns: HTMLElement[]): HTMLElement => {
    const s = document.createElement('div'); s.className = 'share-strip'
    const labels = ['Share on X', 'Share profile link', 'Copy invite link']
    btns.forEach((b, i) => { b.setAttribute('aria-label', labels[i] ?? ''); b.title = labels[i] ?? '' })
    s.append(...btns); return s
  }
  const renderProfile = (): HTMLElement => {
    const save = getSave()
    const hero = document.createElement('div')
    hero.className = 'profile-hero'
    const shot = hooks.portrait?.() ?? null
    if (shot) {
      const img = document.createElement('img')
      img.src = shot
      img.alt = `${save.name}, full body`
      hero.append(img)
      window.setTimeout(() => { if (!img.isConnected) return; const next = hooks.portrait?.(); if (next) img.src = next }, 900)
    }
    // Nameplate under the portrait wears the equipped season frame (slate, brass, gold).
    const plate = document.createElement('div')
    const fr = equippedFrame()
    plate.className = `nameplate${fr ? ` ${fr}` : ''}`
    const pn = document.createElement('strong'); pn.textContent = save.name || 'Player'
    const pu = document.createElement('span'); pu.textContent = save.username ? `@${save.username}` : rankFor(save.xp).label
    plate.append(pn, pu)
    hero.append(plate, renderBadges())
    const glass = document.createElement('section')
    glass.className = 'glass'
    const head = (text: string) => { const h = document.createElement('h3'); h.textContent = text; return h }
    const certIds = (Object.keys(save.skills) as SkillId[]).filter((k) => save.skills[k]?.passed)
    glass.append(
      renderLuxury(),
      head('CV'), (() => { const wrap = document.createElement('div'); wrap.className = 'cv-wrap'; const paper = renderCvPaper(); const bar = document.createElement('div'); bar.className = 'cv-actions'; bar.append(button('Download PDF', 'primary', () => printCv(paper))); if (certIds.length >= 3) bar.append(button('Share my CV page', 'ghost', () => void shareCv())); wrap.append(paper, bar); if (certIds.length < 3) wrap.append(para(`Pass ${3 - certIds.length} more course${certIds.length === 2 ? '' : 's'} to unlock your shareable CV page.`, 'muted')); return wrap })(),
      // Certificates sit with the CV they belong to.
      head('Certificates'), (() => { const list = document.createElement('div'); list.className = 'cert-list'; for (const id of certIds) { const b = button(SKILL_META[id].title, 'ghost', () => void openCertificate(id)); b.dataset.course = id; list.append(b) } if (!certIds.length) list.append(para('Pass a course on Campus to earn your first certificate.', 'muted')); list.append(button('Open courses', 'primary', () => open('learn'))); return list })(), document.createElement('hr'),
      head('Birthday and calendar'), renderCalendar(),
      head('Books'), renderBooks(),
    )
    // Certificates minted on NEAR are read back from the chain and marked Verified (CV, list, nameplate).
    if (certIds.length) void import('./nftAccess.ts').then((m) => { void m.markVerified(hero); void m.markVerified(glass) })
    const share = document.createElement('section')
    share.className = 'glass'
    const link = (src: 'profile' | 'invite') => src === 'profile' ? profileLink(save.username) : shareLink('/', 'invite', save.username)
    const status = para('', 'muted')
    const joined = para('', 'muted')
    share.append(
      head('Invite and share'),
      // Two actions only: post to X, or copy the one invite link.
      strip(
      button('Share on 𝕏', 'ghost', () => shareToX(save.username, rankFor(getSave().xp).label)),
      button('Copy invite link', 'primary', () => void publishProfile().then(() => copyText(link('invite'))).then(() => { status.textContent = 'Invite link copied.' })),
      ),
      status, joined,
    )
    if (save.username) void fetch(`/api/referrals?u=${encodeURIComponent(save.username)}`).then((r) => r.json()).then((j: { joined?: string[] }) => {
      joined.textContent = j.joined?.length ? j.joined.map((p) => `@${p} joined via your invite link.`).join(' ') : 'No one has joined via your link yet.'
    }).catch(() => {})
    const card = frame(save.name, stack(hero, renderToday(save), glass, share, renderRewardWallet(), advice()))
    card.classList.add('glass-sheet')
    return card
  }

  const renderToday = (save: ReturnType<typeof getSave>): HTMLElement => {
    const rank = rankFor(save.xp)
    const next = nextRank(save.xp)
    const wrap = stack()
    wrap.append(para(`@${save.username}`, 'muted'))
    wrap.append(para(next ? `${rank.label} · ${save.xp} XP · ${next.label} at ${next.xp}` : `${rank.label} · ${save.xp} XP. The ladder stays open.`))
    const track = document.createElement('div')
    track.className = 'bar'
    const fill = document.createElement('div')
    fill.className = 'bar-fill'
    fill.style.width = `${Math.round(progressToNext(save.xp) * 100)}%`
    track.append(fill)
    wrap.append(track)
    const streakNote = save.dailies && todayTasks(save).some((task) => task.done)
      ? `Streak ${save.streak}. You already logged a rep today.`
      : save.streak > 0
        ? `Streak ${save.streak}. One rep today makes it ${save.streak + 1}.`
        : 'No streak yet. One rep today starts it.'
    wrap.append(para(`${streakNote} Reputation ${save.reputation}.`))
    const bal = document.createElement('div'); bal.className = 'bal-card'
    bal.append(para('Balance', 'kicker'), para(money(save.ledger), 'bal-num'), para('In-game dollars. Cannot be withdrawn.', 'muted'))
    wrap.prepend(bal)
    const tasks = todayTasks(save)
    wrap.append(para(`Daily quests · ${tasks.filter((t) => t.done).length}/${tasks.length}`, 'kicker'))
    const GO: Record<string, string> = { 'Pass a course': 'Campus', 'Log a sized trade': 'Trading floor', 'Gym set': 'Gym', 'Read the café': 'Campus café', 'Post a bounty': 'Influencer row', 'Church or prayer': 'Masjid', 'Carbon desk': 'Carbon desk' }
    for (const task of tasks) {
      const q = document.createElement('div'); q.className = `quest${task.done ? ' done' : ''}`
      const bar = document.createElement('div'); bar.className = 'bar'; const f = document.createElement('div'); f.className = 'bar-fill'; f.style.width = task.done ? '100%' : '0%'; bar.append(f)
      const t = document.createElement('div'); t.className = 'quest-main'; t.append(para(task.label, 'quest-title'), bar)
      q.append(t)
      if (!task.done && GO[task.label]) q.append(button('Go ›', 'ghost', () => { close(); hooks.travel?.(GO[task.label]!, true) }))
      else if (task.done) q.append(para('✓', 'quest-tick'))
      wrap.append(q)
    }
    if (save.taxOpen) wrap.append(button('Family request is open', 'primary', () => open('tax')))
    return wrap
  }

  const renderBookRows = (rows: BookRow[]): HTMLElement => {
    const cols = document.createElement('div'); cols.className = 'book-cols'
    const col = (sec: string) => { const c = stack(para(sec, 'kicker')); for (const r of rows.filter((x) => x.section === sec)) c.append(line(r.label + (sec === 'Liabilities' && r.value.includes('spent') ? ' · want' : ''), r.value)); return c }
    cols.append(col('Assets'), col('Liabilities'))
    const rest = rows.filter((r) => r.section !== 'Assets' && r.section !== 'Liabilities')
    const wrap = stack(cols)
    if (!rest.length) return wrap
    let section = ''
    for (const r of rest) {
      if (r.section !== section) { section = r.section; wrap.append(para(section, 'kicker')) }
      wrap.append(line(r.label, r.value))
    }
    return wrap
  }

  const renderRewardWallet = (): HTMLElement => {
    const box = document.createElement('section')
    box.className = 'glass'
    const h = document.createElement('h3'); h.textContent = 'Rewards wallet (Base)'
    const input = document.createElement('input')
    input.type = 'text'; input.placeholder = '0x… (paste)'; input.autocomplete = 'off'; input.spellcheck = false; input.maxLength = 42
    input.setAttribute('aria-label', 'Rewards wallet address on Base')
    input.addEventListener('keydown', (e) => { if (!(e.ctrlKey || e.metaKey) && e.key.length === 1) e.preventDefault() })
    input.addEventListener('drop', (e) => e.preventDefault())
    const msg = para('Optional. Kept private. Never share seed phrases or private keys.', 'muted')
    const check = (v: string): string | null => { if (!/^0x[0-9a-fA-F]{40}$/.test(v)) return null; try { return getAddress(v) } catch { return null } }
    input.addEventListener('paste', (e) => {
      e.preventDefault()
      const v = (e.clipboardData?.getData('text') ?? '').trim()
      const a = check(v)
      if (a) { input.value = a; msg.textContent = 'Looks valid. Save to keep it.' } else { msg.textContent = 'That is not a valid Base address (0x + 40 hex, checksum). Never share seed phrases or private keys.' }
    })
    const call = async (method: 'GET' | 'POST' | 'DELETE', body?: unknown) => {
      const t = await import('./login.ts').then((m) => m.accessToken())
      if (!t) throw new Error('sign in')
      const r = await fetch('/api/reward-wallet', { method, headers: { authorization: `Bearer ${t}`, ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
      const j = await r.json().catch(() => ({})) as { address?: string | null; error?: string }
      if (!r.ok) throw new Error(j.error ?? 'failed')
      return j
    }
    void call('GET').then((j) => { if (j.address) input.value = j.address }).catch(() => {})
    box.append(h, input, msg,
      button('Save wallet', 'ghost', () => {
        const a = check(input.value.trim())
        if (!a) { msg.textContent = 'Paste a valid 0x address first.'; return }
        void call('POST', { address: a }).then(() => { msg.textContent = 'Saved privately. No payouts yet.' }).catch((e: Error) => { msg.textContent = `Could not save: ${e.message}.` })
      }),
      button('Remove', 'ghost', () => void call('DELETE').then(() => { input.value = ''; msg.textContent = 'Removed.' }).catch((e: Error) => { msg.textContent = `Could not remove: ${e.message}.` })),
    )
    return box
  }

  const renderBooks = (): HTMLElement => {
    const save = getSave()
    const wrap = stack(para('Assets earn. Liabilities (cars, jets, houses, chains) cost upkeep. Investments are split into coins, tokens and stocks. In-game values only.', 'muted'))
    wrap.append(renderBookRows(bookRows(save)))
    const split = balanceSplit()
    wrap.append(para(`Balance history: $${split.total.toFixed(2)} spendable · $${split.earned.toFixed(2)} earned · $${split.toppedUp.toFixed(2)} topped up. Earned is spent first.`, 'muted'))
    if (save.luxury) wrap.append(button('Resell the chain', 'ghost', () => {
      const result = sellChain()
      hooks.onStyle()
      finish(result.message)
      open('profile', { tab: 'books' })
    }))
    if (save.taxOpen) wrap.append(button('Respond to the request', 'primary', () => open('tax')))
    return wrap
  }

  const line = (label: string, value: string): HTMLElement => {
    const row = document.createElement('p')
    row.className = 'pair'
    const name = document.createElement('span')
    name.textContent = label
    const strong = document.createElement('strong')
    strong.textContent = value
    row.append(name, strong)
    return row
  }

  const renderLearn = (): HTMLElement => {
    const body = document.createElement('div')
    body.className = 'stack'
    const showList = () => {
      body.replaceChildren(renderLearnHome((id) => showCourse(id)))
      body.append(advice())
    }
    const showCourse = (id: SkillId) => {
      const course = COURSES.find((item) => item.id === id)
      if (!course) return
      const lock = lockReason(id)
      if (lock) { const w = worldOf(id); body.replaceChildren(stack(button('← Your worlds', 'ghost', showList), courseVisual(id), para(SKILL_META[id].title, 'kicker'), para(`🔒 ${lock}.${w ? ` This mission is in World ${w.n}: ${w.title}.` : ''}`))); return }
      const save = getSave()
      const passed = save.skills[id]?.passed
      const picks: Array<number | null> = course.questions.map(() => null)
      if (!passed) {
        // first: the player has never passed a course and has not opened one before on this device.
        let fresh = !Object.values(save.skills).some((skill) => skill?.passed)
        try {
          if (localStorage.getItem('gd.firstCourseStarted')) fresh = false
          else if (fresh) localStorage.setItem('gd.firstCourseStarted', '1')
        } catch { /* private mode: still log the start */ }
        track('course_start', { course: id, first: fresh })
      }
      const total = course.questions.length
      // Each view replaces the whole body and scrolls the sheet to the top, so an exercise never sits on top of lesson text.
      const toTop = () => { let n: HTMLElement | null = body; while (n) { if (n.scrollHeight > n.clientHeight + 1) n.scrollTop = 0; n = n.parentElement } }
      const showLesson = () => {
        const wrap = stack(button('← Your path', 'ghost', showList), courseVisual(id), para(SKILL_META[id].title, 'kicker'))
        if (save.focus && !passed) wrap.append(para('Prayer focus is on. This pass counts a quarter more.'))
        if (passed) wrap.append(button('View certificate', 'primary', () => void openCertificate(id)))
        if (passed && nearPassportOn()) wrap.append(nearPassportPanel(id, passed))
        // Bite-size cards (one or two sentences, large type) instead of a wall of small text.
        const cards = biteCards(course.paragraphs)
        const sources = course.paragraphs.find((p) => /^Sources?:/i.test(p.trim()))
        const cardBox = document.createElement('div')
        cardBox.className = 'bite'
        const paint = (i: number) => {
          const dots = document.createElement('div')
          dots.className = 'bite-dots'
          for (let k = 0; k < cards.length; k++) { const d = document.createElement('i'); if (k < i) d.className = 'on'; else if (k === i) d.className = 'now'; dots.append(d) }
          const nav = document.createElement('div')
          nav.className = 'ex-nav'
          if (i > 0) nav.append(button('← Back', 'ghost', () => paint(i - 1)))
          if (i < cards.length - 1) nav.append(button(`Next · ${i + 1}/${cards.length}`, 'primary', () => paint(i + 1)))
          else nav.append(button(passed ? 'Review the exercises' : `Quick check · ${total}`, 'primary', () => showExercise(0)))
          const voice = button(lessonVoiceOn() ? '⏸ Pause voice' : '▶ Play voice', 'ghost lx-voice', () => {
            const on = !lessonVoiceOn(); setLessonVoice(on)
            voice.textContent = on ? '⏸ Pause voice' : '▶ Play voice'
            if (on) speak(cards[i] ?? '', ZAHRA); else stopSpeaking()
          })
          cardBox.replaceChildren(dots, voice, para(cards[i] ?? '', 'bite-say'), nav)
          if (lessonVoiceOn()) speak(cards[i] ?? '', ZAHRA); else stopSpeaking()
          if (i === cards.length - 1 && sources) cardBox.append(para(sources, 'muted'))
        }
        paint(0)
        wrap.append(cardBox, button(passed ? 'Jump to the exercises' : 'Skip to the quick check', 'ghost', () => showExercise(0)), advice())
        body.replaceChildren(wrap)
        toTop()
      }
      const showExercise = (questionIndex: number) => {
        const question = course.questions[questionIndex]
        if (!question) return
        stopSpeaking()
        const wrap = stack(button('← Back to the lesson', 'ghost', showLesson))
        const head = document.createElement('div')
        head.className = 'ex-head'
        head.append(para(SKILL_META[id].title, 'kicker'), para(`Exercise ${questionIndex + 1} of ${total}`, 'ex-count'))
        const bar = document.createElement('div')
        bar.className = 'ex-bar'
        bar.style.setProperty('--p', String((questionIndex + 1) / total))
        head.append(bar)
        if (question.kind) wrap.append(head, para(question.kind === 'sort' ? 'Sort it' : question.kind === 'match' ? 'Match it' : 'Slide it', 'ex-kind'), para(question.prompt, 'ex-prompt'))
        else wrap.append(head, para(question.prompt, 'ex-prompt'))
        const result = para('', 'result')
        if (question.kind === 'slider') {
          // Slider check: drag along the options (timeline / trilemma tightrope); the stop you leave it on is your answer.
          const val = picks[questionIndex] ?? Math.floor((question.choices.length - 1) / 2)
          const range = document.createElement('input'); range.type = 'range'; range.min = '0'; range.max = String(question.choices.length - 1); range.step = '1'; range.value = String(val); range.className = 'ex-slider'; range.disabled = Boolean(passed)
          const ticks = document.createElement('div'); ticks.className = 'ex-ticks'
          const paintTicks = () => { ticks.replaceChildren(...question.choices.map((c, k) => { const t = document.createElement('span'); t.textContent = c; if (String(k) === range.value) t.className = 'on'; return t })) }
          range.oninput = () => { picks[questionIndex] = Number(range.value); paintTicks(); result.textContent = '' }
          if (picks[questionIndex] === null) picks[questionIndex] = val
          paintTicks(); wrap.append(range, ticks)
          range.addEventListener('change', () => { picks[questionIndex] = Number(range.value) })
          range.addEventListener('pointerup', () => { picks[questionIndex] = Number(range.value) })
        }
        if (question.kind !== 'slider') question.choices.forEach((choice, choiceIndex) => {
          const node = button(choice, 'ghost choice', () => {
            if (passed) return
            picks[questionIndex] = choiceIndex
            wrap.querySelectorAll<HTMLButtonElement>('[data-c]').forEach((peer) => peer.setAttribute('aria-pressed', String(peer.dataset.c === String(choiceIndex))))
            result.textContent = ''
          })
          node.dataset.c = String(choiceIndex)
          node.setAttribute('aria-pressed', String(picks[questionIndex] === choiceIndex))
          node.disabled = Boolean(passed)
          wrap.append(node)
        })
        const nav = document.createElement('div')
        nav.className = 'ex-nav'
        if (questionIndex > 0) nav.append(button('← Previous', 'ghost', () => showExercise(questionIndex - 1)))
        if (questionIndex < total - 1) {
          nav.append(button('Next →', 'primary', () => {
            if (picks[questionIndex] === null && !passed) { result.textContent = 'Pick an answer first.'; return }
            showExercise(questionIndex + 1)
          }))
        } else {
          const submit = button(passed ? 'On your CV' : `Check · +${COURSE_XP} XP · +${money(COURSE_CASH)}`, 'primary', () => {
            const missing = picks.findIndex((pick) => pick === null)
            if (missing >= 0) { if (missing === questionIndex) result.textContent = 'Pick an answer first.'; else showExercise(missing); return }
            const outcome: CourseResult = submitCourse(id, picks.map((pick) => pick ?? -1))
            if (outcome.ok) {
              const extra = (outcome.stipend ? ' Campus put $25.00 practice on your ledger.' : '') + ` +${money(COURSE_CASH)} course bonus.`
              const focus = outcome.focus ? ' Focus added a quarter.' : ''
              const bonus = outcome.bonus ? ` Streak +${outcome.bonus} XP.` : ''
              finish(`Filed to your CV.${focus}${bonus}${extra}`, outcome.rankedUp)
              showCourse(id)
              return
            }
            if (outcome.already) { result.textContent = 'Already on your CV.'; return }
            result.textContent = outcome.hints.filter(Boolean).join(' ')
          })
          submit.disabled = Boolean(passed)
          nav.append(submit)
        }
        wrap.append(nav, result)
        body.replaceChildren(wrap)
        toTop()
      }
      showLesson()
    }
    if (courseHold) { const c = courseHold; courseHold = null; showCourse(c) } else showList()
    return frame('Campus', body)
  }

  // Trading: Spot, Perps and Convert on one card (exchange.ts). The card repaints its numbers a few times a
  // second while it is open.
  const renderTrade = (symbol: 'unit' | 'meme'): HTMLElement => {
    const ex = renderExchange(symbol, { finish })
    const loop = () => {
      if (current !== (symbol === 'unit' ? 'trade' : 'trench')) return
      ex.paint()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return frame(symbol === 'unit' ? 'Trade' : 'Trenches desk', stack(ex.el, advice()))
  }

  // Gym: the timing minigame is gone. In 3D you walk to four stations inside; this panel is only the flat-map fallback.
  const renderGym = (): HTMLElement => {
    const result = para('', 'result')
    const log = button('Do the four stations', 'primary', () => {
      const outcome = finishGym(8, 8)
      result.textContent = outcome.message
      finish(outcome.message, outcome.rankedUp)
      log.disabled = true
    })
    const walk = button('What the set counts', 'ghost', () => {
      result.textContent = walkGym().message
    })
    return frame('Gym', stack(para('Treadmill, bench, rack and mats. One logged set a day.'), log, walk, result))
  }

  let boutiqueStyle: Style = 'all'
  const renderBoutique = (): HTMLElement => {
    const save = getSave()
    const wrap = stack(para('Everyday clothes are free. The Runway collection and fine jewellery are premium, paid from your in-game balance. Tap a piece to wear it.', 'muted'))
    { // Live outfit preview: a fresh portrait of your own avatar after every change.
      const shot = hooks.portrait?.() ?? null
      if (shot) {
        const img = document.createElement('img'); img.src = shot; img.alt = 'Your current outfit'; img.className = 'outfit-preview'; wrap.append(img)
        // A new body or outfit swaps in its real model a moment later; retake the picture then, so the
        // preview never shows the placeholder body.
        const retake = () => { if (!img.isConnected) return; const next = hooks.portrait?.(); if (next) img.src = next }
        window.addEventListener('gd-avatar-ready', () => window.setTimeout(retake, 60), { once: true })
        window.setTimeout(retake, 900)
      }
    }
    const bodies = document.createElement('div')
    bodies.className = 'tabs'
    for (const body of BODIES) {
      const node = button(body.label, save.body === body.id ? 'primary' : 'ghost', () => {
        setBody(body.id)
        hooks.onBody()
        open('boutique')
      })
      bodies.append(node)
    }
    wrap.append(bodies, para(BODIES.find((body) => body.id === save.body)?.blurb ?? '', 'muted'))
    const styles = document.createElement('div')
    styles.className = 'tabs'
    for (const [id, label] of [['all', 'All'], ['office', 'Office'], ['street', 'Street'], ['african', 'African-inspired']] as const) {
      styles.append(button(label, boutiqueStyle === id ? 'primary' : 'ghost', () => { boutiqueStyle = id; open('boutique') }))
    }
    wrap.append(para('Style', 'kicker'), styles)
    const tints = document.createElement('div')
    tints.className = 'tabs'
    for (const tint of TINTS.filter((t) => boutiqueStyle === 'all' || (TINT_STYLE[t.id] ?? []).includes(boutiqueStyle))) {
      const node = button('', save.tint === tint.hex ? 'primary' : 'ghost', () => {
        setTint(tint.hex)
        { const w = worn(); if (w.top) { const cur = PIECES.find((x) => x.id === w.top); if (cur) wear(cur) } } // colour wins over a worn top so the change is visible
        hooks.onBody()
        hooks.onStyle()
        open('boutique')
      })
      node.style.setProperty('background', `#${tint.hex.toString(16).padStart(6, '0')}`, 'important'); node.title = tint.label; node.setAttribute('aria-label', `Colour ${tint.label}`)
      tints.append(node)
    }
    tints.classList.add('swatches')
    wrap.append(para('Colour · recolours your top', 'kicker'), tints)
    // Wardrobe. Two clearly separate rails: FREE (the outfits the figures already wear, and the free pieces) and
    // PREMIUM (the Runway collection and jewellery, paid in in-game dollars). Buying wears it; tapping an owned
    // piece wears or removes it.
    const lady = save.body === 'zuri'
    newShootBatch()
    const mineOf = (pc: Piece) => !pc.for || pc.for === (lady ? 'lady' : 'gent')
    const isOn = (pc: Piece) => pc.slot === 'acc' ? worn().acc.includes(pc.id) : worn()[pc.slot] === pc.id
    const card = (pc: Piece, premium: boolean) => {
      const on = isOn(pc), mine = owns(pc.id)
      const node = button('', `ghost ward${on ? ' on' : ''}${premium ? ' lux' : ''}${pc.pass && !mine ? ' pass-locked' : ''}`, () => {
        // Grind Pass exclusives are never sold here: a locked one opens the Season tab.
        if (pc.pass && !mine) { close(); window.dispatchEvent(new CustomEvent('gd:career', { detail: 'weekly' })); return }
        if (!mine) { const r = buyWant(pc.label, pc.usd); if (!r.ok) { finish(r.message); return } own(pc.id) }
        wear(pc)
        hooks.onBody()
        open('boutique')
      })
      const sw = document.createElement('i'); sw.innerHTML = garment(pc.kind ?? pc.slot, pc.label, `#${pc.hex.toString(16).padStart(6, '0')}`)
      const nm = document.createElement('b'); nm.textContent = pc.label
      const pr = document.createElement('small'); pr.textContent = on ? 'Wearing' : mine ? (pc.usd ? 'Owned · tap to wear' : 'Free · tap to wear') : pc.pass ? `Grind Pass · tier ${pc.pass}` : money(pc.usd)
      // Clothes are shown on the real figure that wears them (a studio photograph), not as an icon.
      const shot = shotFor(pc, lady)
      if (shot) {
        node.classList.add('photo')
        const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'
        const show = (url: string) => { img.src = url; sw.replaceChildren(img) }
        const have = lookShot(shot.key, shot.model, shot.look, shot.frame, (url) => { if (node.isConnected) show(url) }, shot.extras)
        if (have) show(have)
      }
      node.append(sw, nm, pr)
      if (pc.note) node.title = pc.note
      return node
    }
    const rail = (title: string, list: Piece[], premium: boolean, into: HTMLElement) => {
      if (!list.length) return
      const grid = document.createElement('div'); grid.className = 'wardrobe'
      for (const pc of list) grid.append(card(pc, premium))
      into.append(para(title, 'kicker'), grid)
    }
    const all = PIECES.filter((x) => mineOf(x) && !x.pass)
    const by = (slot: Slot, paid: boolean) => all.filter((x) => x.slot === slot && !x.kind && (x.usd > 0) === paid)
    const passPieces = PIECES.filter((x) => mineOf(x) && x.pass)
    const free = document.createElement('section'); free.className = 'rail-free'
    const freeHead = document.createElement('div'); freeHead.className = 'rail-head'
    freeHead.append(Object.assign(document.createElement('b'), { textContent: 'Free wardrobe' }), Object.assign(document.createElement('small'), { textContent: 'Yours from day one. Nothing here costs anything.' }))
    free.append(freeHead)
    rail('Everyday looks', by('look', false), false, free)
    rail('Tops & dresses', by('top', false), false, free)
    rail('Trousers', by('bottom', false), false, free)
    rail('Shoes', by('shoes', false), false, free)
    const lux = document.createElement('section'); lux.className = 'rail-lux'
    const luxHead = document.createElement('div'); luxHead.className = 'rail-head'
    luxHead.append(Object.assign(document.createElement('b'), { textContent: 'Premium · Runway collection' }), Object.assign(document.createElement('small'), { textContent: 'Evening wear, tailoring and fine jewellery. Paid with your in-game balance.' }))
    lux.append(luxHead)
    rail('Grind Pass exclusives', passPieces, true, lux)
    rail('Runway looks', by('look', true), true, lux)
    rail('Tailoring & dresses', by('top', true), true, lux)
    rail('Trousers', by('bottom', true), true, lux)
    rail('Shoes', by('shoes', true), true, lux)
    const jewel = (kind: string) => all.filter((x) => x.kind === kind)
    rail('Earrings', jewel('earrings'), true, lux)
    rail('Necklaces', jewel('necklace'), true, lux)
    rail('Rings', jewel('ring'), true, lux)
    rail('Watches', jewel('watch'), true, lux)
    rail('Accessories', all.filter((x) => x.slot === 'acc' && !x.kind), true, lux)
    wrap.append(free, lux)
    const mo = getMorph()
    const slider = (label: string, key: 'h' | 'b' | 'f', min: number, max: number) => {
      const row = document.createElement('label'); row.className = 'morph-row'
      const t = document.createElement('span'); t.textContent = label
      const r = document.createElement('input'); r.type = 'range'; r.min = String(min); r.max = String(max); r.step = '0.01'; r.value = String(mo[key])
      r.oninput = () => { setMorph({ [key]: Number(r.value) }); hooks.onStyle(); saveLookSoon() }
      row.append(t, r); return row
    }
    const looks = document.createElement('details'); looks.className = 'looks-more'
    const lsum = document.createElement('summary'); lsum.textContent = 'Body, face, hair & skin'; looks.append(lsum)
    const realAppend = wrap.append.bind(wrap)
    wrap.append(looks)
    const intoLooks = (...n: Array<Node | string>) => looks.append(...n)
    intoLooks(para('Body', 'kicker'), slider('Height', 'h', 0.92, 1.08), slider('Build', 'b', 0.9, 1.15))
    intoLooks(para('Face shape', 'kicker'), slider('Face', 'f', 0.88, 1.12))
    const hairs = document.createElement('div'); hairs.className = 'tabs'
    for (const hc of HAIRS) hairs.append(button(hc.label, mo.hair === hc.hex ? 'primary' : 'ghost', () => { setMorph({ hair: hc.hex }); hooks.onStyle(); saveLookSoon(); open('boutique') }))
    intoLooks(para('Hair', 'kicker'), hairs)
    const tones = document.createElement('div'); tones.className = 'tabs skin-tones'
    for (const st of SKIN_TONES) { const b = button('', mo.skin === st.hex ? 'primary' : 'ghost', () => { setMorph({ skin: st.hex }); hooks.onStyle(); saveLookSoon(); open('boutique') }); b.style.setProperty('background', `#${st.hex.toString(16).padStart(6, '0')}`, 'important'); b.title = st.label; b.setAttribute('aria-label', `Skin tone ${st.label}`); tones.append(b) }
    intoLooks(para('Skin tone', 'kicker'), tones)
    void realAppend
    wrap.append(para(`Gold chain · ${money(CHAIN_USD)} practice. A want, not a need. Resells for ${money(RESELL_USD)}.`, 'muted'))
    if (save.luxury) {
      wrap.append(button('Resell the chain', 'ghost', () => {
        const result = sellChain()
        hooks.onStyle()
        finish(result.message)
        open('boutique')
      }))
    } else {
      wrap.append(button('Buy the chain', 'primary', () => {
        const result = buyChain()
        hooks.onStyle()
        finish(result.message)
        open('boutique')
      }))
    }
    if (NFT_COLLECTIONS_ENABLED) {
    wrap.append(para('Masks', 'kicker'))
    wrap.append(para('The collection names from the city list, worn as masks. Each mesh is a Grind District cut. It is not the licensed artwork.', 'muted'))
    const masks = document.createElement('div')
    masks.className = 'tabs'
    masks.append(button('Bare face', save.mask === 'none' ? 'primary' : 'ghost', () => {
      setMask('none')
      hooks.onStyle()
      open('boutique')
    }))
    for (const mask of MASKS) {
      masks.append(button(mask.label, save.mask === mask.id ? 'primary' : 'ghost', () => {
        setMask(mask.id)
        hooks.onStyle()
        open('boutique')
      }))
    }
    const worn = MASKS.find((mask) => mask.id === save.mask)
    wrap.append(masks, para(worn?.blurb ?? 'No mask. The face is yours.', 'muted'))
    wrap.append(para('Collection skins', 'kicker'))
    const slotRows = Object.entries(skinSlots()).map(([id, slot]) =>
      `${slot!.collection}: ${isLicensed(id as MaskId) ? 'licensed face live' : 'awaiting permission (original placeholder)'}`)
    wrap.append(para(slotRows.length ? slotRows.join(' · ') : 'Collection slots load with the city.', 'muted'))
    }
    return frame('Boutique', wrap)
  }

  const shopItem = (v: (typeof VEHICLES)[number], panel: 'gadgets' | 'dealer'): HTMLElement[] => {
    const owned = (getSave().ownedVehicles ?? []).includes(v.id)
    return [itemPic(v.id, v.label), para(`${v.label} · ${v.blurb}`, 'muted'), button(owned ? `${v.label} · owned` : `Buy ${v.label} · ${money(v.price)}`, owned ? 'primary' : 'ghost', () => {
      const outcome = buyVehicle(v.id)
      hooks.onStyle()
      finish(outcome.message)
      open(panel)
    })]
  }
  const renderDealer = (): HTMLElement => {
    const wrap = stack(para('Cars, jets and air taxis. In-game cash only. Each one lands in Books under liabilities.', 'muted'))
    for (const v of VEHICLES.filter((x) => x.kind === 'car' || x.kind === 'jet' || x.kind === 'drone')) wrap.append(...shopItem(v, 'dealer'))
    return frame('Auto dealership', wrap)
  }
  const renderGadgets = (): HTMLElement => {
    const save = getSave()
    const wrap = stack(
      para('Phones, computers, accessories and drones. In-game cash only. A drone follows you; pocket it and it stays yours.'),
      para('They do not carry messages, take photos, or leave the city.', 'muted'),
    )
    for (const drone of DRONES) {
      const owned = save.ownedDrones.includes(drone.id)
      const equipped = save.drone === drone.id
      const label = equipped ? `${drone.label} · flying` : owned ? `Equip ${drone.label}` : `Buy ${drone.label} · ${money(drone.price)}`
      wrap.append(itemPic(drone.id, drone.label), para(drone.blurb, 'muted'))
      wrap.append(button(label, equipped ? 'primary' : 'ghost', () => {
        const outcome = buyDrone(drone.id)
        hooks.onStyle()
        finish(outcome.message)
        open('gadgets')
      }))
    }
    if (save.drone !== 'none') {
      wrap.append(button('Pocket the drone', 'ghost', () => {
        hooks.onStyle()
        finish(pocketDrone().message)
        open('gadgets')
      }))
    }
    wrap.append(para('Phones, computers and accessories', 'kicker'))
    for (const v of VEHICLES.filter((x) => x.kind === 'phone' || x.kind === 'laptop' || x.kind === 'accessory')) wrap.append(...shopItem(v, 'gadgets'))
    wrap.append(advice())
    return frame('Gadgets', wrap)
  }

  const renderSettings = (): HTMLElement => {
    const save = getSave()
    const nameError = para('', 'result')
    const display = document.createElement('input')
    display.type = 'text'
    display.maxLength = 24
    display.value = save.name
    display.autocomplete = 'name'
    display.addEventListener('change', () => {
      const outcome = setName(display.value)
      if (!outcome.ok) {
        nameError.textContent = outcome.error
        return
      }
      nameError.textContent = ''
      hooks.onStyle()
    })
    const handle = document.createElement('input')
    handle.type = 'text'
    handle.maxLength = 20
    handle.value = save.username
    handle.readOnly = true // bound to the Privy account; guests get one when they sign in
    handle.title = 'Your username is tied to your account'
    handle.autocomplete = 'username'
    handle.spellcheck = false
    handle.addEventListener('change', () => {
      const outcome = setUsername(handle.value)
      if (!outcome.ok) {
        nameError.textContent = outcome.error
        return
      }
      nameError.textContent = ''
      hooks.onStyle()
    })
    const nameLabel = document.createElement('label')
    nameLabel.className = 'field'
    nameLabel.append(para('Name', 'kicker'), display)
    const userLabel = document.createElement('label')
    userLabel.className = 'field'
    userLabel.append(para('Username', 'kicker'), handle)
    const times = document.createElement('div')
    times.className = 'tabs'
    // GN night, Dusk and GM day stay where you put them. Auto lets the day run through all three.
    const held = (() => { try { return localStorage.getItem('gd.clock') === 'hold' } catch { return false } })()
    const clock = (mode: 'hold' | 'auto') => { try { localStorage.setItem('gd.clock', mode) } catch { /* private mode */ } }
    for (const time of ['night', 'dusk', 'day'] as const) {
      const label = time === 'night' ? 'GN night' : time === 'dusk' ? 'Dusk' : 'GM day'
      times.append(button(label, held && save.timeOfDay === time ? 'primary' : 'ghost', () => {
        clock('hold')
        setTime(time)
        hooks.onLook()
        open('settings')
      }))
    }
    times.append(button('Auto', held ? 'ghost' : 'primary', () => { clock('auto'); hooks.onLook(); open('settings') }))
    // Panel theme: Dark (default) or Light. Separate from GM day / Dusk / GN night, which light the city.
    const theme = document.createElement('div')
    theme.className = 'tabs'
    const light = document.documentElement.dataset.ui === 'light'
    for (const [label, on] of [['Dark', false], ['Light', true]] as const) {
      theme.append(button(label, on === light ? 'primary' : 'ghost', () => {
        if (on) document.documentElement.dataset.ui = 'light'; else delete document.documentElement.dataset.ui
        try { localStorage.setItem('gd.ui', on ? 'light' : 'dark') } catch { /* session only */ }
        open('settings')
      }))
    }
    const graphics = document.createElement('div')
    graphics.className = 'tabs'
    for (const level of ['low', 'medium', 'high'] as const) {
      graphics.append(button(level, save.graphics === level ? 'primary' : 'ghost', () => {
        setGraphics(level)
        hooks.onGraphics()
        open('settings')
      }))
    }
    const maps = document.createElement('div')
    maps.className = 'tabs'
    for (const size of ['compact', 'large'] as const) {
      maps.append(button(size, save.mapSize === size ? 'primary' : 'ghost', () => {
        setMapSize(size)
        hooks.onPrefs()
        open('settings')
      }))
    }
    const comfort = document.createElement('div')
    comfort.className = 'tabs'
    comfort.append(button(save.hints ? 'Hints on' : 'Hints off', save.hints ? 'primary' : 'ghost', () => {
      setHints(!getSave().hints)
      hooks.onPrefs()
      open('settings')
    }))
    comfort.append(button(save.reduceMotion ? 'Motion reduced' : 'Motion full', save.reduceMotion ? 'primary' : 'ghost', () => {
      setReduceMotion(!getSave().reduceMotion)
      hooks.onPrefs()
      open('settings')
    }))
    const reset = button('Reset game progress…', 'danger', () => {
      const dlg = document.createElement('div')
      dlg.className = 'wallet-dlg'
      dlg.setAttribute('role', 'dialog')
      dlg.setAttribute('aria-label', 'Confirm reset')
      const body = document.createElement('div')
      body.className = 'wallet-body'
      body.append(
        para('Reset game progress?', 'kicker'),
        para('This erases your in-game balance, XP and rank progress, courses, trades, inventory, and activity history — including the cloud copy — and syncs $0.00 to your account.', 'muted'),
        para('It does NOT sign you out. Username, email/sign-in, and avatar stay. The $1,000 starting bonus is not paid again.'),
        para('Separate from Delete my account.', 'muted'),
      )
      const row = document.createElement('div'); row.className = 'tabs'
      row.append(
        button('Keep my progress', 'ghost', () => dlg.remove()),
        button('Erase progress', 'danger', () => {
          resetProgress()
          void import('./login.ts').then((l) => l.syncProgress().catch(() => {}))
          hooks.onBody(); hooks.onStyle(); hooks.onLook(); hooks.onGraphics()
          hooks.onRank(rankFor(getSave().xp).label)
          dlg.remove(); close()
          toast('Progress erased. Account kept. Balance is $0.00.')
        }),
      )
      body.append(row); dlg.append(body); document.body.append(dlg)
    })
    const notifyRow = document.createElement('div')
    notifyRow.className = 'tabs'
    notifyRow.append(button(notificationsOn() ? 'Notifications on' : 'Notifications off', notificationsOn() ? 'primary' : 'ghost', () => {
      setNotifications(!notificationsOn())
      open('settings')
    }))
    // Alerts outside the game: push to this phone or computer, and email for Google / email sign-ins.
    void import('./messages.ts').then((m) => {
      const phone = button(m.pushOn() ? 'Phone alerts on' : 'Phone alerts off', m.pushOn() ? 'primary' : 'ghost', () => {
        phone.disabled = true
        void m.setPush(!m.pushOn()).then((line) => { toast(line); open('settings') })
      })
      const mail = button('Email alerts…', 'ghost', () => {
        mail.disabled = true
        void m.emailAlerts(mail.dataset.on !== '1').then((st) => { if (!st) { toast('Sign in with Google or email to get email alerts.'); mail.disabled = false; return } toast(st.on ? 'Email alerts are on for new messages.' : 'Email alerts are off.'); open('settings') })
      })
      notifyRow.append(phone, mail)
      void m.emailAlerts().then((st) => { if (!st) { mail.textContent = 'Email alerts (sign in)'; return } mail.dataset.on = st.on ? '1' : ''; mail.textContent = st.on ? 'Email alerts on' : 'Email alerts off'; if (st.on) { mail.classList.remove('ghost'); mail.classList.add('primary') } })
    })
    const support = document.createElement('a')
    support.href = 'https://t.me/flowerflowchat'
    support.target = '_blank'
    support.rel = 'noopener noreferrer'
    support.className = 'help-link'
    support.textContent = 'Suggestions & feedback'
    const soundRow = document.createElement('div')
    soundRow.className = 'tabs'
    const slider = (value: number, label: string, set: (v: number) => void) => { const r = document.createElement('input'); r.type = 'range'; r.min = '0'; r.max = '100'; r.value = String(value); r.setAttribute('aria-label', label); r.oninput = () => set(Number(r.value)); return r }
    void import('./music.ts').then((m) => import('./ambient-audio.ts').then((a) => import('./speech.ts').then((v) => {
      soundRow.append(
        button(v.voicesOn() ? 'Voices on' : 'Voices off', v.voicesOn() ? 'primary' : 'ghost', () => { v.setVoices(!v.voicesOn()); if (v.voicesOn()) v.speak('Voices are on.', { gender: 'f', seed: 3 }); open('settings') }),
        button('Tour with Zahra', 'ghost', () => { close(); window.dispatchEvent(new Event('gd:tour')) }),
        button(m.musicOn() ? 'Music on' : 'Music off', m.musicOn() ? 'primary' : 'ghost', () => { void m.setMusic(!m.musicOn()).then((ok) => { if (!ok) toast('This browser blocked the music. Tap again.'); open('settings') }) }),
        slider(m.musicVolume(), 'Music volume', m.setMusicVolume),
        button(a.ambientState().wanted ? 'City sound on' : 'City sound off', a.ambientState().wanted ? 'primary' : 'ghost', () => { void a.setAmbientEnabled(!a.ambientState().wanted).then(() => open('settings')) }),
        slider(a.ambientState().volume, 'City sound volume', a.setAmbientVolume),
      )
    })))
    const signedIn = !!(localStorage.getItem('gd.privy.userId') || localStorage.getItem('gd.privy.username') || localStorage.getItem('gd.near.account'))
    const accountRow = document.createElement('div')
    accountRow.className = 'tabs'
    if (signedIn) {
      accountRow.append(button('Sign out', 'ghost', () => { void import('./login.ts').then((l) => l.signOut()) }))
      accountRow.append(button('Remove / change email…', 'ghost', () => { void import('./login.ts').then((l) => l.openEmailAccountActions()) }))
      accountRow.append(button('Delete my account / data…', 'danger', () => {
        const dlg = document.createElement('div')
        dlg.className = 'wallet-dlg'
        dlg.setAttribute('role', 'dialog')
        dlg.setAttribute('aria-label', 'Delete account')
        const body = document.createElement('div')
        body.className = 'wallet-body'
        body.append(
          para('Delete your Grind District account?', 'kicker'),
          para('Permanently removes username, cloud progress, wallet records, and public profile, and deletes Privy sign-in for this app.', 'muted'),
          para('Game Reset only clears progress. This deletes the account.'),
        )
        const row1 = document.createElement('div'); row1.className = 'tabs'
        row1.append(
          button('Cancel', 'ghost', () => dlg.remove()),
          button('I understand — continue', 'danger', () => {
            body.replaceChildren(para('Final confirmation', 'kicker'), para('Type DELETE below, then confirm. This cannot be undone.'))
            const input = document.createElement('input')
            input.type = 'text'; input.placeholder = 'DELETE'; input.autocomplete = 'off'
            input.style.cssText = 'width:100%;margin:8px 0;padding:10px;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.35);color:#fff'
            const status = para('', 'result')
            const row2 = document.createElement('div'); row2.className = 'tabs'
            row2.append(
              button('Cancel', 'ghost', () => dlg.remove()),
              button('Delete forever', 'danger', () => {
                if (input.value.trim().toUpperCase() !== 'DELETE') { status.textContent = 'Type DELETE exactly to confirm.'; return }
                status.textContent = 'Deleting…'
                void import('./login.ts').then(async (l) => {
                  const ok = await l.deleteAccount()
                  if (!ok) { status.textContent = 'Could not delete. Sign in again and retry.'; return }
                  dlg.remove(); toast('Account and data deleted.')
                })
              }),
            )
            body.append(input, status, row2)
          }),
        )
        body.append(row1); dlg.append(body); document.body.append(dlg)
      }))
    } else {
      accountRow.append(button('Sign in', 'ghost', () => { close(); void import('./login.ts').then((l) => l.openLogin()) }))
    }
    const settingsCard = (body: HTMLElement) => { const c = frame('Settings', body); c.classList.add('glass-sheet', 'settings-glass'); return c }
    return settingsCard(stack(
      nameLabel,
      userLabel,
      nameError,
      para('GN time', 'kicker'),
      para('Choose your GN time. The city stays open in all three.', 'muted'),
      times,
      para('Language', 'kicker'),
      languagePicker(),
      para('Theme', 'kicker'),
      para('Dark or light panels, menu and buttons. The city keeps its own time of day.', 'muted'),
      theme,
      para('Graphics', 'kicker'),
      graphics,
      para(({
        low: 'Low: fastest. Plain resolution, 3 street lights, no shadows or effects. Best for mid-range phones.',
        medium: 'Medium: sharper, 4 street lights, soft effects. Shadows on computers.',
        high: 'High: sharpest, every street light and glow, full shadows on computers.',
      } as const)[save.graphics], 'muted'),
      para('Map', 'kicker'),
      maps,
      para('Comfort', 'kicker'),
      comfort,
      para('Sound', 'kicker'),
      soundRow,
      para('Music starts with your first tap and city sound plays in the streets. Turn either off here.', 'muted'),
      para('WASD or arrows walk. Shift runs. Drag looks. Scroll zooms. E enters. Esc closes this.', 'muted'),
      para('Notifications', 'kicker'),
      notifyRow,
      para('Account', 'kicker'),
      accountRow,
      para('Sign-in stays until you sign out or delete the account. Reset only clears game progress.', 'muted'),
      reset,
      para('Grind is in-game currency only. Nothing on-chain moves here.', 'muted'),
      para('Support', 'kicker'),
      support,
      button('About this city', 'ghost', () => open('about')),
    ))
  }

  const renderSimple = (title: string, nodes: HTMLElement[]): HTMLElement => frame(title, stack(...nodes))

  const renderHouse = (): HTMLElement => {
    const home = HOUSES.find((item) => item.id === houseId) ?? HOUSES[0]
    if (!home) return renderSimple('House', [para('That door did not open.')])
    const visit = (line: string) => {
      const outcome = markHouseVisit(home.id)
      finish(outcome.already ? 'You already stopped here.' : `${line} Reputation +2.`)
      open('house', { house: home.id })
    }
    switch (home.id) {
      case 'yours': {
        const claimed = getSave().houseClaimed
        return renderSimple('Your house', [
          para('Front room, a desk, and a closet. Messaging and voice are later.'),
          para(claimed ? 'The key is yours. The notes house, the set house, the grove house, and a vacant room are on this row.' : 'The room is empty until you claim it.'),
          button(claimed ? 'The room is yours' : 'Claim the room', 'primary', () => {
            const outcome = claimHouse()
            finish(outcome.message)
            open('house', { house: 'yours' })
          }),
          button('Desk · profile', 'ghost', () => open('profile')),
          button('Closet · boutique', 'ghost', () => open('boutique')),
          button('Lamp · GN night', 'ghost', () => {
            setTime('night')
            hooks.onLook()
          }),
          button('Window · day', 'ghost', () => {
            setTime('day')
            hooks.onLook()
          }),
        ])
      }
      case 'adaeze':
        return renderSimple('Notes house', [
          para('Notes from the hall, on paper. Spot means you hold the asset. The spread is a cost you pay before the idea can be right.'),
          para('The notes will not tell you the next mark.'),
          button('Sit with the notes', 'primary', () => visit('You sat with the notes.')),
        ])
      case 'malik':
        return renderSimple('Set house', [
          para('A home gym. Log one workout set a day to keep your streak.'),
          para('A second set the same day does not stack the streak.'),
          button('Stay for the set', 'primary', () => visit('You stayed for the set.')),
        ])
      case 'nia':
        return renderSimple('Grove house', [
          para('Seedlings line the windows. The owner explains how climate pledges work: back a project and it is logged on your profile.'),
          button('Hear it out', 'primary', () => visit('You heard the grove house.')),
        ])
      case 'vacant':
        return renderSimple('Vacant house', [
          para('An empty, furnished house. Nobody lives here yet.'),
          button('Look through', 'primary', () => visit('You looked through the vacant house.')),
        ])
      default: {
        const neverHouse: never = home.id
        return neverHouse
      }
    }
  }

  const render = (panel: PanelId): HTMLElement => {
    switch (panel) {
      case 'intro':
        return renderSimple('Welcome to Grind District', [
          para('Everyone starts at zero here.'),
          para('Your first step: follow the gold marker north to Campus. Zahra gives you a 1-minute lesson.'),
          button("Let's go", 'primary', close),
        ])
      case 'profile':
        return renderProfile()
      case 'learn':
        return renderLearn()
      case 'trade':
        return renderTrade('unit')
      case 'trench':
        return renderTrade('meme')
      case 'boutique':
        return renderBoutique()
      case 'gadgets':
        return renderGadgets()
      case 'dealer':
        return renderDealer()
      case 'gym':
        return renderGym()
      case 'church':
        return renderSimple('Church', [
          para('Rest is part of the grind. Leave the chart outside.'),
          para('One visit a day. Reputation moves. The ladder moves only by the rep, not by a donation.'),
          button('Step inside', 'primary', () => {
            const outcome = attendChurch()
            finish(outcome.message, outcome.rankedUp)
            open('church')
          }),
        ])
      case 'prayer':
        return renderSimple('Masjid', [
          para('A bench, stones, and no questions about what you believe.'),
          para('Sitting puts focus on the next course you pass.'),
          button('Sit', 'primary', () => {
            const outcome = sitPrayer()
            finish(outcome.message, outcome.rankedUp)
            open('prayer')
          }),
        ])
      case 'cafe':
        return renderSimple('The room', [
          ...headlines(seasonAt(), getSave().dailies.day).map((lineText) => para(lineText)),
          para(`${seasonLabel(seasonAt())} season. The board is gossip, not a signal.`, 'muted'),
          button('Read the room', 'primary', () => {
            const outcome = readCafe()
            finish(outcome.message, outcome.rankedUp)
            open('cafe')
          }),
          button('Order water', 'ghost', () => {
            finish(orderWater().message)
            open('cafe')
          }),
          para('Water is free. It does not turn a headline into a trade.', 'muted'),
        ])
      case 'house':
        return renderHouse()
      case 'city':
        return renderSimple('The city', [
          ...(() => {
            const m = hooks.satMap?.()
            if (!m || !m.url) return []
            const box = document.createElement('div')
            box.className = 'sat-map'
            const inner = document.createElement('div')
            inner.className = 'sat-inner'
            const img = document.createElement('img')
            img.src = m.url; img.alt = 'Top-down map of the city'; img.draggable = false
            inner.append(img)
            box.append(inner)
            // Drag to pan, pinch (or +/−) to zoom. Pins counter-scale so labels stay readable.
            let z = 1, tx = 0, ty = 0
            const pts = new Map<number, { x: number; y: number }>()
            let pinch0 = 0, z0 = 1
            const apply = () => {
              const w = box.clientWidth || 1, lim = (w * (z - 1)) / 2
              tx = Math.max(-lim, Math.min(lim, tx)); ty = Math.max(-lim, Math.min(lim, ty))
              inner.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`
              inner.style.setProperty('--iz', String(1 / z))
            }
            box.addEventListener('pointerdown', (e) => { if ((e.target as HTMLElement).closest('.sat-pin, .sat-zoom')) return; box.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { const [a1, b1] = [...pts.values()]; pinch0 = Math.hypot(a1!.x - b1!.x, a1!.y - b1!.y); z0 = z } })
            box.addEventListener('pointermove', (e) => {
              const prev = pts.get(e.pointerId); if (!prev) return
              const cur = { x: e.clientX, y: e.clientY }; pts.set(e.pointerId, cur)
              if (pts.size === 2) { const [a1, b1] = [...pts.values()]; const d = Math.hypot(a1!.x - b1!.x, a1!.y - b1!.y); if (pinch0) z = Math.max(1, Math.min(5, z0 * d / pinch0)) }
              else { tx += cur.x - prev.x; ty += cur.y - prev.y }
              apply()
            })
            const end = (e: PointerEvent) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0 }
            box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end)
            box.addEventListener('wheel', (e) => { e.preventDefault(); z = Math.max(1, Math.min(5, z * (e.deltaY < 0 ? 1.15 : 1 / 1.15))); apply() }, { passive: false })
            const zoom = document.createElement('div'); zoom.className = 'sat-zoom'
            for (const [t, f] of [['+', 1.4], ['−', 1 / 1.4]] as const) { const zb = document.createElement('button'); zb.type = 'button'; zb.textContent = t; zb.setAttribute('aria-label', t === '+' ? 'Zoom in' : 'Zoom out'); zb.onclick = () => { z = Math.max(1, Math.min(5, z * f)); apply() }; zoom.append(zb) }
            box.append(zoom)
            const legend = document.createElement('small'); legend.className = 'sat-legend'; legend.textContent = 'Drag · pinch to zoom · tap a pin to go'; box.append(legend)
            const at = (x: number, z: number, n: HTMLElement) => { n.style.left = `${((x + m.limit) / (2 * m.limit)) * 100}%`; n.style.top = `${((z + m.limit) / (2 * m.limit)) * 100}%` }
            for (const pin of m.pins) {
              const b = document.createElement('button')
              b.type = 'button'; b.className = 'sat-pin'; b.setAttribute('aria-label', pin.title); b.title = pin.title
              const label = document.createElement('span'); label.textContent = pin.title
              b.append(label)
              b.onclick = () => hooks.travel?.(pin.title, true)
              at(pin.x, pin.z, b); inner.append(b)
            }
            if (m.me) { const me = document.createElement('i'); me.className = 'sat-me'; me.title = 'You are here'; at(m.me.x, m.me.z, me); inner.append(me); requestAnimationFrame(() => { z = 1.8; tx = (0.5 - (m.me!.x + m.limit) / (2 * m.limit)) * box.clientWidth * z; ty = (0.5 - (m.me!.z + m.limit) / (2 * m.limit)) * box.clientWidth * z; apply() }) }
            const toggle = button('Show list of places', 'ghost', () => { const l = box.parentElement?.querySelectorAll<HTMLElement>('.map-entry'); const hide = !(l?.[0]?.hidden); l?.forEach((n) => { n.hidden = hide }); toggle.textContent = hide ? 'Show list of places' : 'Hide list' })
            requestAnimationFrame(() => box.parentElement?.querySelectorAll<HTMLElement>('.map-entry').forEach((n) => { n.hidden = true }))
            return [box, toggle]
          })(),
          para('Every door on the street. Tap a pin or a row to go straight there and walk in.'),
          ...GUIDE.map((stop) => {
            const row = document.createElement('div')
            row.className = 'map-entry'
            // One tap: travel there and walk straight in.
            const name = button(`${stop.title} · ${stop.where}`, 'ghost', () => hooks.travel?.(stop.title, true))
            name.title = stop.text
            row.append(name)
            return row
          }),
        ])
      case 'climate':
        return renderSimple('Carbon desk', [
          para(`A practice pledge costs ${money(CLIMATE_USD)}. It does not retire a real credit. Rank does not move because you spent.`),
          para('A method names what was reduced, who measured it, and whether the work needed the credit revenue. A logo does not. This desk records a practice note and does not issue a tonne.'),
          ...PROJECTS.map((project) => button(project.name, 'primary', () => {
            const outcome = pledge(project.name)
            finish(outcome.message, outcome.rankedUp)
            open('climate')
          })),
          advice(),
        ])
      case 'bounty': {
        const area = document.createElement('textarea')
        area.maxLength = 180
        area.placeholder = 'What did you actually do?'
        const result = para('', 'result')
        return renderSimple('Influencer row', [
          para('One post a day. Twenty characters minimum. It files to the portfolio and pays practice funds.'),
          area,
          button('Post', 'primary', () => {
            const outcome = postBounty(area.value)
            result.textContent = outcome.message
            finish(outcome.message, outcome.rankedUp)
          }),
          result,
          advice(),
        ])
      }
      case 'conference':
        return renderSimple('Conference centre', [
          para('Upcoming Web3 events in the hall. Doors open two hours before each one; join to earn in-game cash and reputation.'),
          ...schedule().slice(0, 4).map((ev) => {
            const joined = getSave().eventsJoined.includes(ev.id)
            const row = stack(
              para(`${ev.label} · ${ev.kind} · ${ev.host}`, 'muted'),
              para(ev.title),
              button(joined ? 'Joined' : ev.open ? `Join event (+$${ev.xp})` : 'Doors not open yet', ev.open && !joined ? 'primary' : 'ghost', () => {
                const outcome = joinEvent(ev)
                finish(outcome.message, outcome.rankedUp)
                open('conference')
              }),
            )
            return row
          }),
          para('The house talk, any time:', 'muted'),
          para('The talk is short. Proof of work is a course, a bounty, a pledge. It is not a slogan and it is not a balance.'),
          para('Ninety seconds, then the street again. The hall does not take a fee.'),
          button(getSave().conference ? 'You already sat' : 'Stay for it', 'primary', () => {
            const outcome = hearTalk()
            finish(outcome.message, outcome.rankedUp)
            open('conference')
          }),
          button('Keep the note', 'ghost', () => {
            const outcome = noteTalk()
            finish(outcome.message)
            open('conference')
          }),
          para('The note is the last line: a course, a bounty, or a pledge. A balance is not the proof.', 'muted'),
        ])
      case 'robot':
        return renderSimple('Unit 4', [
          para('This is an agent. The label says so. Agents attach to robots, not to people.'),
          para('If a figure will not say it is an agent, treat it as a person. Do not hand it a signature because it hurried you.'),
          button('Read the label', 'primary', () => {
            const outcome = readRobot()
            finish(outcome.message, outcome.rankedUp)
            open('robot')
          }),
        ])
      case 'settings':
        return renderSettings()
      case 'about':
        return renderSimple('About', [
          para('Grind District is a Web3 life sim: one shared city where you learn crypto safely, practise with in-game money, and build a CV you can share.'),
          para('Learn', 'kicker'),
          para('Zahra meets you at Campus and places you as a Normie or a Homie. Six worlds take you from what the internet is, through scams and wallet safety, blockchain basics, layers and real uses, to the earning map and your career. Every course you pass is filed to your CV with a certificate, and certificates can be minted on Base or NEAR.'),
          para('Practise', 'kicker'),
          para('The trading screen has Spot, Perps and Convert for the District Coin, the major coins and tokens. Prices are simulated and no real order is ever placed. Take a job in Careers, do its task each day, and rise from Curious to Mentor.'),
          para('Live', 'kicker'),
          para('Claim your home and use it: cook, shower, do the laundry, tend the garden, work at the desk, sleep. Dress at the Boutique, train at the gym, sit in the masjid or the church, read at the café, hear a talk at the conference centre, and meet other players. Search any player by username in Messages, add friends, party up, or talk to people standing near you.'),
          para('Money', 'kicker'),
          para('Everything in the city is priced in in-game dollars. You earn them by learning, working and checking in each day, and you can add to them with a top-up in USDC or ETH on Base. Your balance always shows how much was earned and how much was topped up.'),
          para('The city never asks for a seed phrase. Nothing here is financial, legal or investment advice. The city does not run on Solana.', 'muted'),
          para('Made by Zahra. grinddistrict.app', 'muted'),
        ])
      case 'tax':
        return renderSimple('Family request', [
          para(`A cousin asked for ${money(TAX_USD)} practice toward transport. Paying is reputation. Not paying has no penalty.`),
          para('Rank will not move because money moved.', 'muted'),
          button(`Pay ${money(TAX_USD)}`, 'primary', () => {
            const outcome = payTax()
            finish(outcome.message, outcome.rankedUp)
            if (outcome.ok) close()
          }),
          button('Not today', 'ghost', () => {
            finish(declineTax().message)
            close()
          }),
        ])
      case 'season':
        return renderSimple(`${seasonLabel(seasonAt())} season`, [
          para(seasonAt() === 'bull'
            ? 'Bids are easier. Size still matters. The café is loud.'
            : 'Marks are heavy. The street is open. Your CV does not mark to market.'),
          para('Seasons flip every six minutes in this build, for everyone on the same clock.'),
          button('Read it at the café', 'primary', () => open('cafe')),
        ])
      case 'shared': {
        const p = sharedHold
        const body = stack()
        if (!p) body.append(para('That link did not include a profile.', 'muted'))
        else {
          const peer = peerHold
          if (peer?.shot) { const img = document.createElement('img'); img.className = 'peer-shot'; img.alt = `${p.n}, full body`; img.src = peer.shot; body.append(img) }
          if (peer) {
            const row = document.createElement('div'); row.className = 'peer-actions'
            row.append(button(p.u ? `Message @${p.u}` : 'Message', 'primary', () => { close(); peer.onMessage() }))
            body.append(row)
            if (peer.partial) body.append(para('Their full profile did not arrive. They may be on a slow connection.', 'muted'))
          }
          const inviter = !peer && new URLSearchParams(location.search).get('src') === 'invite' ? p.u : ''
          if (inviter) body.append(para(`You were invited by @${inviter}. Sign up and it shows as joined via their invite link.`, 'muted'))
          const intro = document.createElement('pre')
          intro.className = 'doc'
          intro.textContent = sharedText(p)
          const g = document.createElement('section')
          g.className = 'glass'
          const h = (t: string) => { const e = document.createElement('h3'); e.textContent = t; return e }
          const d = (t: string) => { const e = document.createElement('pre'); e.className = 'doc'; e.textContent = publicDoc(t) || 'Not filed yet.'; return e }
          if (p.d) g.append(h('CV'), d(p.d.c))
          g.append(h('Books'), renderBookRows((p.b ?? []).map(([section, label, value]) => ({ section: section as BookRow['section'], label, value }))))
          body.append(intro, g)
        }
        if (peerHold) body.append(para('Public profile only. Emails, wallets, family requests and location are never shown.', 'muted'))
        else body.append(para('Your own save was not touched.', 'muted'), button('Walk in', 'primary', close))
        const card = frame(p ? `${p.n}'s profile` : 'Shared profile', body)
        card.classList.add('glass-sheet')
        return card
      }
      default: {
        const neverPanel: never = panel
        return neverPanel
      }
    }
  }

  open = (panel: PanelId, extra?: OpenExtra) => {
    const previous = current
    stop()
    current = panel
    if (extra?.shared) sharedHold = extra.shared
    if (extra?.shared) peerHold = extra.peer ?? null
    if (extra?.house) houseId = extra.house
    courseHold = extra?.course ?? null
    sheet.hidden = false
    sheet.setAttribute('role', 'dialog')
    sheet.setAttribute('aria-modal', 'true')
    sheet.setAttribute('aria-labelledby', 'sheet-title')
    document.body.classList.add('sheet-open')
    sheet.replaceChildren(render(panel))
    if (previous !== panel) {
      const closeButton = sheet.querySelector('button')
      if (closeButton instanceof HTMLElement) closeButton.focus()
    }
    sheet.scrollTop = 0
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied.')
    } catch {
      toast('Copy was blocked. Select the text instead.')
    }
  }

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && current) {
      event.preventDefault()
      close()
    }
  })

  subscribe(() => refresh())
  refresh()

  // Courses tab in the Control Centre: opens the same learn panel as the hall, so progress is shared.
  document.querySelector('#nav-courses')?.addEventListener('click', () => open('learn'))
  return {
    isOpen: () => current !== null,
    open,
    close,
    toast,
    setPlace(next) {
      place = next
      refresh()
    },
    refresh,
  }
}
