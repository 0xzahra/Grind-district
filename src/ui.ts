import { getMorph, setMorph, HAIRS, SKIN_TONES, LIPS, BLUSH, type Style } from './morph.ts'
import { isLicensed, skinSlots } from './skins.ts'
import { schedule } from './events.ts'
import { NFT_COLLECTIONS_ENABLED } from './nft.ts'
import { notificationsOn, setNotifications } from './agent.ts'
import { type MaskId } from './logic.ts'
import { openCertificate, shareCv } from './certs.ts'
import { equippedFrame } from './career.ts'
// Signed-in players: the look saves to the account through the existing profile upsert (debounced).
let lookTimer = 0
const saveLookSoon = () => { clearTimeout(lookTimer); lookTimer = window.setTimeout(() => void publishProfile(), 1500) }
import { shareLink, shareOrCopy, profileLink, shareToX, publishProfile } from './share.ts'
import { bookRows, publicDoc, type BookRow } from './logic.ts'
import { track } from './track.ts'
import { accessToken } from './login.ts'
import { getAddress } from 'viem'
import { COURSES, headlines } from './courses.ts'
import { renderLearnHome } from './learnUi.ts'
import { renderBadges, renderLuxury } from './luxury.ts'
import { GUIDE } from './guide.ts'
import { HOUSES, type HouseId } from './houses.ts'
import {
  BODIES,
  CHAIN_USD,
  CLIMATE_USD,
  COURSE_XP,
  DRONES,
  VEHICLES,
  COINS,
  COIN_CATEGORIES,
  coinPrice,
  RANKS,
  type CoinCategory,
  MASKS,
  PROJECTS,
  RESELL_USD,
  SKILL_META,
  TAX_USD,
  TINTS,
  TINT_STYLE,
  documents,
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
  buyDrone,
  buyVehicle,
  tradeCoin,
  claimHouse,
  markHouseVisit,
  declineTax,
  describeTrade,
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
  trade,
  walkGym,
  type CourseResult,
} from './state.ts'

type Tab = 'today' | 'cv' | 'resume' | 'portfolio' | 'books'
type PeerView = { shot: string | null; partial: boolean; onMessage: () => void }
type OpenExtra = { shared?: SharedProfile; tab?: Tab; house?: HouseId; peer?: PeerView }

type Hooks = {
  onStyle: () => void
  onBody: () => void
  onLook: () => void
  onGraphics: () => void
  onPrefs: () => void
  onRank: (label: string) => void
  travel?: (title: string, enter?: boolean) => void
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

  // Balance feedback without sound: count the pill toward the new value and float a +/- chip.
  let shownLedger: number | null = null
  let ledgerAnim = 0
  const animateLedger = (target: number) => {
    if (shownLedger === null || Math.abs(target - shownLedger) < 0.005) { shownLedger = target; pills.ledger.textContent = money(target); return }
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
      pills.ledger.textContent = money(from + delta * (1 - Math.pow(1 - k, 3)))
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

  sheet.addEventListener('pointerdown', (event) => { if (event.target === sheet) close() })
  const close = () => {
    const was = current
    stop()
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
    const docs = documents(save)
    const doc = (text: string) => { const pre = document.createElement('pre'); pre.className = 'doc'; pre.textContent = text; return pre }
    glass.append(
      renderLuxury(),
      head('CV'), doc(docs.cv), document.createElement('hr'),
      head('Resume'), doc(docs.resume), document.createElement('hr'),
      head('Portfolio'), doc(docs.portfolio), document.createElement('hr'),
      head('Books'), renderBooks(),
    )
    const share = document.createElement('section')
    share.className = 'glass'
    const link = (src: 'profile' | 'invite') => src === 'profile' ? profileLink(save.username) : shareLink('/', 'invite', save.username)
    const status = para('', 'muted')
    const joined = para('', 'muted')
    share.append(
      head('Invite and share'),
      button('Share on X', 'primary', () => shareToX(save.username, rankFor(getSave().xp).label)),
      button('Share profile link', 'ghost', () => void publishProfile().then(() => shareOrCopy(`${save.name} · Grind District`, link('profile'), 'profile').then((r) => { status.textContent = r === 'copied' ? 'Link copied.' : r === 'shared' ? 'Shared.' : 'Could not share.' }))),
      button('Copy invite link', 'ghost', () => void copyText(link('invite')).then(() => { status.textContent = 'Invite link copied.' })),
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
    wrap.append(para(`Balance ${money(save.ledger)}`, 'muted'))
    for (const task of todayTasks(save)) {
      const row = para(`${task.done ? 'Done' : 'Open'} · ${task.label}`, task.done ? 'task done' : 'task')
      wrap.append(row)
    }
    if (save.taxOpen) wrap.append(button('Family request is open', 'primary', () => open('tax')))
    wrap.append(button('Copy share link', 'ghost', () => {
      void publishProfile(); void copyText(profileLink(getSave().username))
    }))
    wrap.append(button('Courses', 'ghost', () => open('learn')))
    const passedIds = (Object.keys(save.skills) as SkillId[]).filter((k) => save.skills[k]?.passed)
    if (passedIds.length) {
      wrap.append(para('Certificates', 'kicker'))
      for (const id of passedIds) wrap.append(button(SKILL_META[id].title, 'ghost', () => void openCertificate(id)))
    }
    wrap.append(passedIds.length >= 3
      ? button('Share my CV page', 'primary', () => void shareCv())
      : para(`Pass ${3 - passedIds.length} more course${passedIds.length === 2 ? '' : 's'} to unlock your shareable CV page.`, 'muted'))
    return wrap
  }

  const renderBookRows = (rows: BookRow[]): HTMLElement => {
    const wrap = stack()
    let section = ''
    for (const r of rows) {
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
      const t = await accessToken()
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
    const wrap = stack(para('Assets earn. Liabilities (cars, jets, houses, chains) cost upkeep. Investments are coins, new coins and stocks. In-game values only.', 'muted'))
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
      const save = getSave()
      const passed = save.skills[id]?.passed
      const picks: Array<number | null> = course.questions.map(() => null)
      if (!passed) track('course_start', { course: id })
      const total = course.questions.length
      // Each view replaces the whole body and scrolls the sheet to the top, so an exercise never sits on top of lesson text.
      const toTop = () => { let n: HTMLElement | null = body; while (n) { if (n.scrollHeight > n.clientHeight + 1) n.scrollTop = 0; n = n.parentElement } }
      const showLesson = () => {
        const wrap = stack(button('← Your path', 'ghost', showList), para(SKILL_META[id].title, 'kicker'), para(`${total} exercises. A miss names the idea to reread.`, 'muted'))
        if (save.focus && !passed) wrap.append(para('Prayer focus is on. This pass counts a quarter more.'))
        if (passed) wrap.append(button('View certificate', 'primary', () => void openCertificate(id)))
        for (const paragraph of course.paragraphs) wrap.append(para(paragraph))
        wrap.append(button(passed ? 'Review the exercises' : `Start exercises · ${total}`, 'primary', () => showExercise(0)), advice())
        body.replaceChildren(wrap)
        toTop()
      }
      const showExercise = (questionIndex: number) => {
        const question = course.questions[questionIndex]
        if (!question) return
        const wrap = stack(button('← Back to the lesson', 'ghost', showLesson))
        const head = document.createElement('div')
        head.className = 'ex-head'
        head.append(para(SKILL_META[id].title, 'kicker'), para(`Exercise ${questionIndex + 1} of ${total}`, 'ex-count'))
        const bar = document.createElement('div')
        bar.className = 'ex-bar'
        bar.style.setProperty('--p', String((questionIndex + 1) / total))
        head.append(bar)
        wrap.append(head, para(question.prompt, 'ex-prompt'))
        const result = para('', 'result')
        question.choices.forEach((choice, choiceIndex) => {
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
          const submit = button(passed ? 'On your CV' : `Check · +${COURSE_XP} XP · +5 rep`, 'primary', () => {
            const missing = picks.findIndex((pick) => pick === null)
            if (missing >= 0) { if (missing === questionIndex) result.textContent = 'Pick an answer first.'; else showExercise(missing); return }
            const outcome: CourseResult = submitCourse(id, picks.map((pick) => pick ?? -1))
            if (outcome.ok) {
              const extra = outcome.stipend ? ' Campus put $25 practice on your ledger.' : ''
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
    showList()
    return frame('Learning hall', body)
  }

  let marketCat: CoinCategory = 'big'
  const renderMarkets = (): HTMLElement => {
    const wrap = stack(para('Markets', 'kicker'), para('Invest your in-game cash by category. Big caps reward patience: each buy adds reputation. Practice prices only, nothing on chain.', 'muted'))
    const tabs = document.createElement('div')
    tabs.className = 'tabs'
    const rows = stack()
    const paint = () => {
      const save = getSave()
      const rankIdx = RANKS.findIndex((r) => r.id === rankFor(save.xp).id)
      const cat = COIN_CATEGORIES.find((c) => c.id === marketCat)!
      rows.replaceChildren(para(cat.note, 'muted'))
      for (const coin of COINS.filter((c) => c.cat === marketCat)) {
        const price = save.coinPrices[coin.id] ?? coin.base
        const h = save.coins[coin.id]
        const locked = RANKS.findIndex((r) => r.id === coin.minRank) > rankIdx
        rows.append(line(coin.label, locked ? `Opens at ${RANKS.find((r) => r.id === coin.minRank)!.label}` : `${coinPrice(price)}${h && h.qty > 0 ? ` · held ${money(h.qty * price)}` : ''}`))
        if (locked) continue
        const act = document.createElement('div')
        act.className = 'tabs'
        const go = (side: 'buy' | 'sell', f: number) => () => { const r = tradeCoin(coin.id, side, f); finish(r.message); paint() }
        act.append(button('Buy 25%', 'ghost', go('buy', 0.25)), button('Buy 50%', 'ghost', go('buy', 0.5)))
        if (h && h.qty > 0) act.append(button('Sell all', 'ghost', go('sell', 1)))
        rows.append(act)
      }
    }
    for (const cat of COIN_CATEGORIES) {
      const node = button(cat.label, 'ghost', () => {
        marketCat = cat.id
        for (const child of tabs.querySelectorAll('button')) child.setAttribute('aria-pressed', String(child === node))
        paint()
      })
      node.setAttribute('aria-pressed', String(cat.id === marketCat))
      tabs.append(node)
    }
    paint()
    wrap.append(tabs, rows)
    return wrap
  }

  const renderTrade = (symbol: 'unit' | 'meme'): HTMLElement => {
    const name = symbol === 'unit' ? 'UNIT' : 'MEME'
    let fraction = 0.5
    let plan = false
    const price = para('')
    const book = para('')
    const result = para('', 'result')
    const canvas = document.createElement('canvas')
    canvas.className = 'chart'
    canvas.width = 640
    canvas.height = 220
    const sizes = document.createElement('div')
    sizes.className = 'tabs'
    for (const size of [0.25, 0.5, 1] as const) {
      const node = button(size === 1 ? '100%' : `${size * 100}%`, 'ghost', () => {
        fraction = size
        for (const child of sizes.querySelectorAll('button')) child.setAttribute('aria-pressed', 'false')
        node.setAttribute('aria-pressed', 'true')
      })
      if (size === 0.5) node.setAttribute('aria-pressed', 'true')
      sizes.append(node)
    }
    const planBox = document.createElement('label')
    planBox.className = 'check'
    const input = document.createElement('input')
    input.type = 'checkbox'
    input.addEventListener('change', () => {
      plan = input.checked
    })
    planBox.append(input, document.createTextNode('I sized this on purpose'))
    const paint = () => {
      const save = getSave()
      const view = describeTrade(symbol)
      price.textContent = `${name} ${money(view.price)} · ledger ${money(save.ledger)}`
      book.textContent = view.qty > 0 ? `Position ${view.qty.toFixed(3)} @ ${money(view.avg)} · open ${money(view.pnl)}` : 'No open position.'
      const ctx = canvas.getContext('2d')
      const hist = symbol === 'unit' ? save.unitHist : save.memeHist
      if (!ctx || hist.length < 2) return
      const width = canvas.width
      const height = canvas.height
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = '#0c1411'
      ctx.fillRect(0, 0, width, height)
      const min = Math.min(...hist)
      const max = Math.max(...hist)
      const span = Math.max(0.0001, max - min)
      const last = hist[hist.length - 1] ?? min
      const first = hist[0] ?? min
      ctx.strokeStyle = last >= first ? '#7fae8e' : '#c4776c'
      ctx.lineWidth = 4
      ctx.beginPath()
      hist.forEach((value, index) => {
        const x = 16 + (index / (hist.length - 1)) * (width - 32)
        const y = height - 24 - ((value - min) / span) * (height - 48)
        if (index === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }
    const go = (side: 'buy' | 'sell') => {
      const outcome = trade(symbol, side, fraction, plan)
      result.textContent = outcome.message
      finish(outcome.message, outcome.rankedUp)
      paint()
    }
    const loop = () => {
      if (current !== (symbol === 'unit' ? 'trade' : 'trench')) return
      paint()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const season = seasonLabel(seasonAt())
    const blurb = symbol === 'unit'
      ? `${season} season. A plan logged on the sell can count when the close is red.`
      : `${season} season. MEME is attention. Size small. Rank will not follow a crash.`
    return frame(symbol === 'unit' ? 'Spot book' : 'Trenches book', stack(
      renderMarkets(),
      para(symbol === 'unit' ? 'UNIT · district coin' : 'MEME · new coin', 'kicker'),
      para(blurb, 'muted'),
      price,
      book,
      canvas,
      sizes,
      planBox,
      button('Buy', 'primary', () => go('buy')),
      button('Sell', 'ghost', () => go('sell')),
      result,
      advice(),
    ))
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
    const wrap = stack(para('Original bodies, free. The man and the woman are on this wall.', 'muted'))
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
      const node = button(tint.label, save.tint === tint.hex ? 'primary' : 'ghost', () => {
        setTint(tint.hex)
        hooks.onStyle()
        open('boutique')
      })
      tints.append(node)
    }
    wrap.append(para('Color', 'kicker'), tints)
    const mo = getMorph()
    const slider = (label: string, key: 'h' | 'b', min: number, max: number) => {
      const row = document.createElement('label'); row.className = 'morph-row'
      const t = document.createElement('span'); t.textContent = label
      const r = document.createElement('input'); r.type = 'range'; r.min = String(min); r.max = String(max); r.step = '0.01'; r.value = String(mo[key])
      r.oninput = () => { setMorph({ [key]: Number(r.value) }); hooks.onStyle(); saveLookSoon() }
      row.append(t, r); return row
    }
    wrap.append(para('Body', 'kicker'), slider('Height', 'h', 0.92, 1.08), slider('Build', 'b', 0.9, 1.15))
    const hairs = document.createElement('div'); hairs.className = 'tabs'
    for (const hc of HAIRS) hairs.append(button(hc.label, mo.hair === hc.hex ? 'primary' : 'ghost', () => { setMorph({ hair: hc.hex }); hooks.onStyle(); saveLookSoon(); open('boutique') }))
    wrap.append(para('Hair', 'kicker'), hairs)
    const tones = document.createElement('div'); tones.className = 'tabs skin-tones'
    for (const st of SKIN_TONES) { const b = button('', mo.skin === st.hex ? 'primary' : 'ghost', () => { setMorph({ skin: st.hex }); hooks.onStyle(); saveLookSoon(); open('boutique') }); b.style.background = `#${st.hex.toString(16).padStart(6, '0')}`; b.title = st.label; b.setAttribute('aria-label', `Skin tone ${st.label}`); tones.append(b) }
    wrap.append(para('Skin tone', 'kicker'), tones)
    const mkRow = (label: string, list: ReadonlyArray<{ label: string; hex: number | null }>, key: 'lip' | 'blush') => {
      const r = document.createElement('div'); r.className = 'tabs'
      for (const it of list) r.append(button(it.label, (mo[key] ?? null) === it.hex ? 'primary' : 'ghost', () => { setMorph({ [key]: it.hex }); hooks.onStyle(); saveLookSoon(); open('boutique') }))
      wrap.append(para(label, 'kicker'), r)
    }
    mkRow('Makeup · lips', LIPS, 'lip')
    mkRow('Makeup · blush', BLUSH, 'blush')
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

  const renderGadgets = (): HTMLElement => {
    const save = getSave()
    const wrap = stack(
      para('Drones are gadgets. Buy one with practice funds and it follows you. Pocket it and it stays yours.'),
      para('They do not carry messages, take photos, or leave the city.', 'muted'),
    )
    for (const drone of DRONES) {
      const owned = save.ownedDrones.includes(drone.id)
      const equipped = save.drone === drone.id
      const label = equipped ? `${drone.label} · flying` : owned ? `Equip ${drone.label}` : `Buy ${drone.label} · ${money(drone.price)}`
      wrap.append(para(drone.blurb, 'muted'))
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
    wrap.append(para('Vehicles', 'kicker'))
    wrap.append(para('Cars, jets and drones. In-game cash only. Each one lands in Books under liabilities.', 'muted'))
    for (const v of VEHICLES) {
      const owned = (save.ownedVehicles ?? []).includes(v.id)
      wrap.append(para(v.blurb, 'muted'))
      wrap.append(button(owned ? `${v.label} · owned` : `Buy ${v.label} · ${money(v.price)}`, owned ? 'primary' : 'ghost', () => {
        const outcome = buyVehicle(v.id)
        hooks.onStyle()
        finish(outcome.message)
        open('gadgets')
      }))
    }
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
    handle.maxLength = 16
    handle.value = save.username
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
    for (const time of ['night', 'dusk', 'day'] as const) {
      const label = time === 'night' ? 'GN night' : time === 'dusk' ? 'Dusk' : 'Day'
      times.append(button(label, save.timeOfDay === time ? 'primary' : 'ghost', () => {
        setTime(time)
        hooks.onLook()
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
    let armed = false
    const reset = button('Reset progress', 'danger', () => {
      if (!armed) {
        armed = true
        reset.textContent = 'Confirm reset'
        return
      }
      resetProgress()
      hooks.onBody()
      hooks.onStyle()
      hooks.onLook()
      hooks.onGraphics()
      hooks.onRank(rankFor(getSave().xp).label)
      close()
      toast('Back to zero. Your name stayed. GN time stayed.')
    })
    const notifyRow = document.createElement('div')
    notifyRow.className = 'tabs'
    notifyRow.append(button(notificationsOn() ? 'Notifications on' : 'Notifications off', notificationsOn() ? 'primary' : 'ghost', () => {
      setNotifications(!notificationsOn())
      open('settings')
    }))
    const support = document.createElement('a')
    support.href = 'https://x.com/0xarewah'
    support.target = '_blank'
    support.rel = 'noopener noreferrer'
    support.className = 'help-link'
    support.textContent = 'Get help'
    const settingsCard = (body: HTMLElement) => { const c = frame('Settings', body); c.classList.add('glass-sheet', 'settings-glass'); return c }
    return settingsCard(stack(
      nameLabel,
      userLabel,
      nameError,
      para('GN time', 'kicker'),
      para('Choose your GN time. The city stays open in all three.', 'muted'),
      times,
      para('Graphics', 'kicker'),
      graphics,
      para('Map', 'kicker'),
      maps,
      para('Comfort', 'kicker'),
      comfort,
      para('The theme stays silent until you turn Music on. Volume is the slider by that button. With reduced motion on, it never resumes by itself.', 'muted'),
      para('WASD or arrows walk. Shift runs. Drag looks. Scroll zooms. E enters. Esc closes this.', 'muted'),
      para('Notifications', 'kicker'),
      notifyRow,
      para('Grind is in-game currency only. Nothing on-chain moves here.', 'muted'),
      para('Support', 'kicker'),
      support,
      button('About this city', 'ghost', () => open('about')),
      reset,
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
        return renderSimple('You start at zero', [
          para('You are a shrimp in a shared city. The practice ledger is empty. Rank does not read it.'),
          para('Walk north to the learning hall, or east to the houses. Music stays off until you want Market Velocity.'),
          button("I'm here", 'primary', close),
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
        return renderSimple('Prayer space', [
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
          para('Every door on the street. Tap one to go straight there and walk in.'),
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
          para('Grind District is a life sim inside Web3. One shared city. You start as a shrimp with a zero balance and grind through learning, reps, and practice trades toward whale.'),
          para('This build is the city: districts, a man and a woman you can wear, the shrimp mascot, drones, collection masks, the learning hall, and a profile that writes a CV, resume, and portfolio from what you do. You pick the name and the username.'),
          para('The ledger is practice. There is no deployed token and the city never asks for a seed phrase. Nothing here is financial advice. This city does not run on Solana.'),
          para('A file in the repository ends in .sol. That extension is Solidity, an EVM record. It is not a Solana program, it is not deployed, and this city does not send transactions.'),
          para('The masks use the collection names. The shapes are original to this city. Messaging and proximity voice are later. The ladder does not wait on them.'),
          para('Bull and bear seasons change the city’s mood and the practice books. The game still works when the marks fall.'),
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
          if (p.d) g.append(h('CV'), d(p.d.c), h('Resume'), d(p.d.r), h('Portfolio'), d(p.d.p))
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
