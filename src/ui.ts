import { COURSES } from './courses.ts'
import { logoutPrivy } from './privy.ts'
import { connectNearMainnet, disconnectNearMainnet, signNearMarketOrder } from './near.ts'
import { nearMarketOrderMessage, quoteNpcMarket } from './near-economy.ts'
import { GUIDE } from './guide.ts'
import { BASE_USDC_ADDRESS, formatUsdcMicros, GRIND_TREASURY_ADDRESS } from './topup-config.ts'
import { HOUSES, type HouseId } from './houses.ts'
import {
  BODIES,
  CHAIN_USD,
  CLIMATE_USD,
  COURSE_XP,
  DRONES,
  MASKS,
  PROJECTS,
  RESELL_USD,
  SKILL_META,
  TAX_USD,
  TINTS,
  ZAHRA,
  documents,
  encodeShare,
  money,
  nextRank,
  progressToNext,
  rankFor,
  rankToast,
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
  claimHouse,
  markHouseVisit,
  declineTax,
  describeTrade,
  dismissIntro,
  finishGym,
  getSave,
  linkNearAccount,
  hearTalk,
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
  tradeAtPrice,
  unlinkNearAccount,
  walkGym,
  type CourseResult,
} from './state.ts'

type Tab = 'today' | 'cv' | 'resume' | 'portfolio' | 'books'
type OpenExtra = { shared?: SharedProfile; tab?: Tab; house?: HouseId }

type TopupBalanceResult = { ok: true; balanceMicros: string } | { ok: false; error: string }
type TopupVerifyResult = { ok: true; creditedMicros: string; balanceMicros: string; alreadyProcessed: boolean } | { ok: false; error: string }
type AuthActionResult = { ok: true } | { ok: false; error: string }

type Hooks = {
  onStyle: () => void
  onBody: () => void
  onLook: () => void
  onGraphics: () => void
  onPrefs: () => void
  onRank: (label: string) => void
  onTopupLogin: () => Promise<AuthActionResult>
  onTopupLinkWallet: () => Promise<AuthActionResult>
  onTopupBalance: () => Promise<TopupBalanceResult>
  onTopupVerify: (hash: string) => Promise<TopupVerifyResult>
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
    focus: HTMLElement
  },
  hooks: Hooks,
): Ui {
  let current: PanelId | null = null
  let place = 'The Plaza'
  let profileTab: Tab = 'today'
  let sharedHold: SharedProfile | null = null
  let raf = 0
  let toastTimer = 0

  const toast = (text: string) => {
    toastNode.hidden = false
    toastNode.textContent = text
    window.clearTimeout(toastTimer)
    toastTimer = window.setTimeout(() => {
      toastNode.hidden = true
    }, 4200)
  }

  const refresh = () => {
    const save = getSave()
    pills.rank.textContent = rankFor(save.xp).label
    pills.place.textContent = place
    pills.ledger.textContent = money(save.ledger)
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

  const connectNearAccount = async (): Promise<{ ok: true; accountId: string } | { ok: false; error: string }> => {
    const connected = await connectNearMainnet()
    if (connected.ok === false) return connected
    const saved = linkNearAccount(connected.accountId)
    if (saved.ok === false) return saved
    return connected
  }

  const stop = () => {
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  let open!: (panel: PanelId, extra?: OpenExtra) => void
  let houseId: HouseId = 'yours'

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
    const tabs: Tab[] = ['today', 'cv', 'resume', 'portfolio', 'books']
    const labels: Record<Tab, string> = { today: 'Today', cv: 'CV', resume: 'Resume', portfolio: 'Portfolio', books: 'Books' }
    const bar = document.createElement('div')
    bar.className = 'tabs'
    for (const tab of tabs) {
      const node = button(labels[tab], profileTab === tab ? 'primary' : 'ghost', () => {
        profileTab = tab
        open('profile')
      })
      node.setAttribute('aria-pressed', String(profileTab === tab))
      bar.append(node)
    }
    const body = document.createElement('div')
    body.className = 'stack'
    if (profileTab === 'today') body.append(renderToday(save))
    if (profileTab === 'cv') body.append(renderDoc('cv'))
    if (profileTab === 'resume') body.append(renderDoc('resume'))
    if (profileTab === 'portfolio') body.append(renderDoc('portfolio'))
    if (profileTab === 'books') body.append(renderBooks())
    return frame(save.name, stack(bar, body))
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
    wrap.append(track, para('Balance does not move this bar.', 'muted'))
    wrap.append(para(`Reputation ${save.reputation}.`))
    wrap.append(para(`Practice ledger ${money(save.ledger)}. Not real funds.`, 'muted'))
    for (const task of todayTasks(save)) {
      const row = para(`${task.done ? 'Done' : 'Open'} · ${task.label}`, task.done ? 'task done' : 'task')
      wrap.append(row)
    }
    if (save.taxOpen) wrap.append(button('Family request is open', 'primary', () => open('tax')))
    wrap.append(button('Copy share link', 'ghost', () => {
      const url = new URL(location.href)
      url.hash = `profile=${encodeShare(getSave())}`
      void copyText(url.toString())
    }))
    return wrap
  }

  const renderDoc = (kind: 'cv' | 'resume' | 'portfolio'): HTMLElement => {
    const docs = documents(getSave())
    const text = docs[kind]
    const pre = document.createElement('pre')
    pre.className = 'doc'
    pre.textContent = text
    return stack(pre, button('Copy', 'primary', () => void copyText(text)), advice())
  }

  const renderBooks = (): HTMLElement => {
    const save = getSave()
    const wrap = stack(para('Assets, wants, and open positions. Marks are practice.', 'muted'))
    wrap.append(para('Assets', 'kicker'))
    wrap.append(line('Practice cash', money(save.ledger)))
    const verifiedBalance = line('Verified Base USDC credits', 'Checking…')
    verifiedBalance.classList.add('topup-pair')
    const verifiedValue = verifiedBalance.querySelector('strong')
    const verifiedNote = para('Deposits claimed for this Privy account; separate from practice cash.', 'muted')
    wrap.append(verifiedBalance, verifiedNote, button('View Base top-ups', 'ghost', () => open('topup')))
    void hooks.onTopupBalance().then((result) => {
      if (!verifiedValue?.isConnected) return
      if ('error' in result) {
        verifiedValue.textContent = 'Unavailable'
        verifiedNote.textContent = result.error
      } else {
        verifiedValue.textContent = formatUsdcMicros(result.balanceMicros)
      }
    }).catch(() => {
      if (!verifiedValue?.isConnected) return
      verifiedValue.textContent = 'Unavailable'
      verifiedNote.textContent = 'The verified top-up balance could not be loaded.'
    })
    if (Object.values(save.skills).some((skill) => skill?.passed)) wrap.append(line('Campus pass', 'On you'))
    if (save.luxury) wrap.append(line('Gold chain', `Resell ${money(RESELL_USD)}`))
    if (save.carbon.length === 0) wrap.append(line('Carbon notes', 'None'))
    for (const note of save.carbon) wrap.append(line(note.name, 'Practice pledge'))
    wrap.append(para('Liabilities', 'kicker'))
    wrap.append(line('Open family request', save.taxOpen ? money(TAX_USD) : 'None'))
    if (save.wants.length === 0) wrap.append(line('Wants', 'None'))
    for (const want of save.wants) wrap.append(line(want.label, `${money(want.spent)} spent`))
    wrap.append(para('Investments', 'kicker'))
    wrap.append(positionLine('UNIT', 'unit'))
    wrap.append(positionLine('MEME', 'meme'))
    if (save.luxury) wrap.append(button('Resell the chain', 'ghost', () => {
      const result = sellChain()
      hooks.onStyle()
      finish(result.message)
      open('profile', { tab: 'books' })
    }))
    if (save.taxOpen) wrap.append(button('Respond to the request', 'primary', () => open('tax')))
    return wrap
  }

  const renderTopup = (): HTMLElement => {
    const balanceRow = line('Verified top-up balance', 'Checking…')
    balanceRow.classList.add('topup-pair')
    const balanceValue = balanceRow.querySelector('strong')
    const feedback = para('', 'result')
    feedback.setAttribute('role', 'status')

    const hash = document.createElement('input')
    hash.type = 'text'
    hash.name = 'transaction-hash'
    hash.maxLength = 66
    hash.autocomplete = 'off'
    hash.spellcheck = false
    hash.placeholder = '0x… transaction hash'
    hash.setAttribute('aria-label', 'Base transaction hash')
    const hashLabel = document.createElement('label')
    hashLabel.className = 'field'
    hashLabel.append('Base transaction hash', hash)

    const loadBalance = async () => {
      try {
        const result = await hooks.onTopupBalance()
        if ('error' in result) {
          if (balanceValue) balanceValue.textContent = 'Unavailable'
          feedback.textContent = result.error
          return
        }
        if (balanceValue) balanceValue.textContent = formatUsdcMicros(result.balanceMicros)
      } catch {
        if (balanceValue) balanceValue.textContent = 'Unavailable'
        feedback.textContent = 'The verified balance could not be loaded.'
      }
    }

    const login = button('Log in with Privy', 'ghost', () => {
      login.disabled = true
      void hooks.onTopupLogin().then((result) => {
        login.disabled = false
        if ('error' in result) {
          feedback.textContent = result.error
        } else {
          feedback.textContent = 'Privy login verified.'
          void loadBalance()
        }
      }).catch(() => {
        login.disabled = false
        feedback.textContent = 'Privy login could not be started.'
      })
    })
    const linkWallet = button('Link depositing wallet', 'ghost', () => {
      linkWallet.disabled = true
      void hooks.onTopupLinkWallet().then((result) => {
        linkWallet.disabled = false
        feedback.textContent = 'error' in result
          ? result.error
          : 'Finish linking the wallet in Privy, then verify the deposit hash.'
      }).catch(() => {
        linkWallet.disabled = false
        feedback.textContent = 'The Privy wallet link could not be started.'
      })
    })
    const verify = button('Verify deposit', 'primary', () => {})
    verify.type = 'submit'
    const form = document.createElement('form')
    form.className = 'stack'
    form.append(hashLabel, verify)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const value = hash.value.trim()
      if (!/^0x[0-9a-f]{64}$/i.test(value)) {
        feedback.textContent = 'Enter the 32-byte transaction hash from Base.'
        hash.focus()
        return
      }
      verify.disabled = true
      feedback.textContent = 'Checking Base receipt and linked-wallet ownership…'
      void hooks.onTopupVerify(value).then((result) => {
        verify.disabled = false
        if ('error' in result) {
          feedback.textContent = result.error
          return
        }
        if (balanceValue) balanceValue.textContent = formatUsdcMicros(result.balanceMicros)
        feedback.textContent = result.alreadyProcessed
          ? 'This deposit was already claimed. No duplicate credit was added.'
          : `Verified ${formatUsdcMicros(result.creditedMicros)} to your top-up balance.`
      }).catch(() => {
        verify.disabled = false
        feedback.textContent = 'The top-up service could not verify this request.'
      })
    })

    const treasury = line('Treasury address', GRIND_TREASURY_ADDRESS)
    treasury.classList.add('topup-pair')
    treasury.querySelector('strong')?.classList.add('topup-address')
    const network = line('Network', 'Base mainnet · chain 8453')
    const token = line('Token', `USDC · ${BASE_USDC_ADDRESS}`)
    network.classList.add('topup-pair')
    token.classList.add('topup-pair')
    const body = stack(
      para('Send Base USDC only to this fixed GrindTreasury address. Copy it here, then paste the transaction hash after sending.', 'muted'),
      treasury,
      button('Copy treasury address', 'primary', () => void copyText(GRIND_TREASURY_ADDRESS)),
      network,
      token,
      balanceRow,
      para('Practice cash stays separate from server-verified credits. A pasted hash is not proof: the server checks the chain, token, recipient, linked sender wallet, receipt status, confirmations, and duplicate logs.', 'muted'),
      para('To claim an earlier deposit, link the wallet that sent it and enter its transaction hash. The amount comes from the verified receipt; no manual amount is accepted.', 'muted'),
      login,
      linkWallet,
      form,
      feedback,
    )
    void loadBalance()
    return frame('Top up with Base USDC', body)
  }

  const positionLine = (label: string, symbol: 'unit' | 'meme'): HTMLElement => {
    const book = describeTrade(symbol)
    if (book.qty <= 0) return line(label, 'Flat')
    const sign = book.pnl >= 0 ? '+' : ''
    return line(label, `${book.qty.toFixed(3)} @ ${money(book.avg)} · ${sign}${money(book.pnl)}`)
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
      body.replaceChildren(para('Twelve courses. Pass one and it files itself. No certificates for sale.', 'muted'))
      for (const course of COURSES) {
        const meta = SKILL_META[course.id]
        const passed = getSave().skills[course.id]?.passed
        const node = button(`${meta.title} · ${course.minutes}${passed ? ' · on your CV' : ''}`, passed ? 'ghost' : 'primary', () => showCourse(course.id))
        body.append(node)
      }
      body.append(advice())
    }
    const showCourse = (id: SkillId) => {
      const course = COURSES.find((item) => item.id === id)
      if (!course) return
      const save = getSave()
      const passed = save.skills[id]?.passed
      const picks: Array<number | null> = course.questions.map(() => null)
      const wrap = stack(button('All courses', 'ghost', showList), para(SKILL_META[id].title, 'kicker'), para(`${course.questions.length} exercises. A miss names the idea to reread.`, 'muted'))
      if (save.focus && !passed) wrap.append(para('Prayer focus is on. This pass counts a quarter more.'))
      for (const paragraph of course.paragraphs) wrap.append(para(paragraph))
      const result = para('', 'result')
      course.questions.forEach((question, questionIndex) => {
        wrap.append(para(question.prompt, 'kicker'))
        question.choices.forEach((choice, choiceIndex) => {
          const node = button(choice, 'ghost choice', () => {
            if (passed) return
            picks[questionIndex] = choiceIndex
            question.choices.forEach((_, index) => {
              const peer = wrap.querySelector<HTMLButtonElement>(`[data-q="${questionIndex}"][data-c="${index}"]`)
              peer?.setAttribute('aria-pressed', String(index === choiceIndex))
            })
          })
          node.dataset.q = String(questionIndex)
          node.dataset.c = String(choiceIndex)
          node.disabled = Boolean(passed)
          wrap.append(node)
        })
      })
      const submit = button(passed ? 'On your CV' : `Check · +${COURSE_XP} XP`, 'primary', () => {
        if (picks.some((pick) => pick === null)) {
          result.textContent = 'Answer every exercise, then check.'
          return
        }
        const outcome: CourseResult = submitCourse(id, picks.map((pick) => pick ?? -1))
        if (outcome.ok) {
          const extra = outcome.stipend ? ' Campus put $25 practice on your ledger.' : ''
          const focus = outcome.focus ? ' Focus added a quarter.' : ''
          finish(`Filed to your CV.${focus}${extra}`, outcome.rankedUp)
          showCourse(id)
          return
        }
        if (outcome.already) {
          result.textContent = 'Already on your CV.'
          return
        }
        if ('hints' in outcome) result.textContent = outcome.hints.filter(Boolean).join(' ')
      })
      submit.disabled = Boolean(passed)
      wrap.append(submit, result, advice())
      body.replaceChildren(wrap)
    }
    showList()
    return frame('Learning hall', body)
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
      ctx.strokeStyle = last >= first ? '#1af38f' : '#ff6f61'
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
    const nearResult = para('', 'result')
    const nearStatus = para('', 'muted')
    const connectWallet = button('Connect NEAR mainnet account', 'ghost', () => {
      connectWallet.disabled = true
      nearStatus.textContent = 'Opening the mainnet wallet selector…'
      void connectNearAccount().then((outcome) => {
        nearStatus.textContent = outcome.ok === true
          ? `Connected · ${outcome.accountId}. This account ID is public on NEAR mainnet.`
          : outcome.error
        connectWallet.hidden = outcome.ok
        signBuy.hidden = !outcome.ok
        signSell.hidden = !outcome.ok
      }).finally(() => {
        connectWallet.disabled = false
      })
    })
    const signBuy = button('Sign NPC buy quote with NEAR', 'ghost', () => void signNpcOrder('buy'))
    const signSell = button('Sign NPC sell quote with NEAR', 'ghost', () => void signNpcOrder('sell'))
    let signing = false
    const signNpcOrder = async (side: 'buy' | 'sell') => {
      if (signing) return
      signing = true
      signBuy.disabled = true
      signSell.disabled = true
      try {
        let accountId = getSave().nearAccountId
        if (!accountId) {
          nearStatus.textContent = 'Connect a NEAR mainnet account to continue…'
          const connected = await connectNearAccount()
          if (connected.ok === false) {
            nearResult.textContent = connected.error
            return
          }
          accountId = connected.accountId
          connectWallet.hidden = true
          signBuy.hidden = false
          signSell.hidden = false
        }
        const spot = describeTrade(symbol).price
        const quote = quoteNpcMarket(spot, side)
        const order = {
          asset: name as 'UNIT' | 'MEME',
          side,
          size: fraction,
          quote,
          expiresAt: Date.now() + 120_000,
        }
        nearStatus.textContent = 'Review the exact practice-market order in your wallet…'
        const signature = await signNearMarketOrder(accountId, nearMarketOrderMessage(order))
        if (signature.ok === false) {
          nearResult.textContent = signature.error
          return
        }
        if (Date.now() > order.expiresAt) {
          nearResult.textContent = 'The NPC quote expired before signing finished. No practice trade was made.'
          return
        }
        const outcome = tradeAtPrice(symbol, side, fraction, false, quote, 'near')
        if (!outcome.ok) {
          nearResult.textContent = outcome.message
          return
        }
        nearResult.textContent = `${outcome.message} The NPC quote follows the live practice book at a fixed spread. The NEAR signature stayed off-chain; no mainnet transaction or real funds moved.`
        nearStatus.textContent = `Connected · ${accountId} · NEAR mainnet. Account activity is public.`
        finish(outcome.message, outcome.rankedUp)
        paint()
      } finally {
        signing = false
        signBuy.disabled = false
        signSell.disabled = false
      }
    }
    const savedNearAccount = getSave().nearAccountId
    nearStatus.textContent = savedNearAccount
      ? `Connected · ${savedNearAccount} · NEAR mainnet. Account activity is public.`
      : 'Optional mainnet wallet; the district remains playable without connecting.'
    connectWallet.hidden = Boolean(savedNearAccount)
    signBuy.hidden = !savedNearAccount
    signSell.hidden = !savedNearAccount
    const nearPrivacy = para('NEAR account IDs, balances, and transaction history are public. This signs only the order details; names, usernames, practice balances, and the signature stay off-chain. The client uses the wallet response only as a local practice-market demo gate; it is not server-verified or shared with other players.', 'muted')
    const loop = () => {
      if (current !== (symbol === 'unit' ? 'trade' : 'trench')) return
      paint()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const blurb = symbol === 'unit'
      ? 'A plan logged on the sell can count when the close is red.'
      : 'MEME is attention. Size small. Rank will not follow a crash.'
    return frame(symbol === 'unit' ? 'Spot book' : 'Trenches book', stack(
      para(blurb, 'muted'),
      price,
      book,
      canvas,
      sizes,
      planBox,
      button('Buy', 'primary', () => go('buy')),
      button('Sell', 'ghost', () => go('sell')),
      result,
      para('Player market · NPC quote', 'kicker'),
      nearStatus,
      connectWallet,
      signBuy,
      signSell,
      nearResult,
      nearPrivacy,
      advice(),
    ))
  }

  const renderGym = (): HTMLElement => {
    const save = getSave()
    const practice = save.dailies.gym
    const lane = document.createElement('div')
    lane.className = 'lane'
    const zone = document.createElement('div')
    zone.className = 'zone'
    const marker = document.createElement('div')
    marker.className = 'marker'
    lane.append(zone, marker)
    const status = para(practice ? 'Practice set. Today’s gym is already filed.' : 'Hit while the marker sits in the mint band. Eight swings.')
    const result = para('', 'result')
    let swings = 0
    let hits = 0
    let t = 0
    const hit = button('Hit', 'primary', () => {
      if (swings >= 8) return
      const markerAt = 0.5 + Math.sin(t) * 0.42
      const good = Math.abs(markerAt - 0.5) < 0.09
      swings += 1
      if (good) hits += 1
      status.textContent = `${hits} hits · swing ${swings}/8`
      if (swings >= 8) {
        const outcome = finishGym(hits, 8)
        result.textContent = outcome.message
        finish(outcome.message, outcome.rankedUp)
        hit.disabled = true
      }
    })
    const loop = () => {
      if (current !== 'gym') return
      t += document.body.classList.contains('reduce-motion') ? 0.018 : 0.045
      const markerAt = 0.5 + Math.sin(t) * 0.42
      marker.style.left = `${markerAt * 100}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const walk = button('What the lane counts', 'ghost', () => {
      result.textContent = walkGym().message
    })
    return frame('Gym', stack(status, lane, hit, walk, result, para(`Best filed set: ${save.gymBest}/8. One logged set a day.`, 'muted')))
  }

  const renderBoutique = (): HTMLElement => {
    const save = getSave()
    const wrap = stack(para('Original bodies, free. The man and the woman are on this wall, with the mascots. Collection masks hang beside them.', 'muted'))
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
    const tints = document.createElement('div')
    tints.className = 'tabs'
    for (const tint of TINTS) {
      const node = button(tint.label, save.tint === tint.hex ? 'primary' : 'ghost', () => {
        setTint(tint.hex)
        hooks.onStyle()
        open('boutique')
      })
      tints.append(node)
    }
    wrap.append(para('Color', 'kicker'), tints)
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
      if ('error' in outcome) {
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
      if ('error' in outcome) {
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
      toast('Back to zero. Your name stayed. GN time and volume stayed.')
    })
    const nearStatus = para('NEAR account IDs, balances, and transaction history are public on mainnet. Linking is optional; names, usernames, and practice data remain local and are never written to NEAR.', 'muted')
    const nearResult = para('', 'result')
    const nearAccountDisplay = save.nearAccountId
      ? (() => {
          const link = document.createElement('a')
          link.href = `https://nearblocks.io/address/${encodeURIComponent(save.nearAccountId)}`
          link.target = '_blank'
          link.rel = 'noopener noreferrer'
          link.textContent = `NEAR mainnet · ${save.nearAccountId}`
          return link
        })()
      : para('No NEAR account linked. Privy sign-in and the rest of the game are unchanged.', 'muted')
    const nearConnectButton = button('Connect NEAR mainnet account', 'ghost', () => {
      nearConnectButton.disabled = true
      nearResult.textContent = 'Opening the mainnet wallet selector…'
      void connectNearAccount().then((outcome) => {
        if (outcome.ok === false) {
          nearResult.textContent = outcome.error
          return
        }
        open('settings')
      }).finally(() => {
        nearConnectButton.disabled = false
      })
    })
    nearConnectButton.hidden = Boolean(save.nearAccountId)
    const nearDisconnectButton = button('Disconnect NEAR account', 'ghost', () => {
      nearDisconnectButton.disabled = true
      void disconnectNearMainnet().then(() => {
        unlinkNearAccount()
        open('settings')
      }).catch(() => {
        nearResult.textContent = 'The wallet could not disconnect. The saved account link was kept.'
      }).finally(() => {
        nearDisconnectButton.disabled = false
      })
    })
    nearDisconnectButton.hidden = !save.nearAccountId
    const support = document.createElement('a')
    support.href = ZAHRA
    support.target = '_blank'
    support.rel = 'noopener noreferrer'
    support.textContent = 'Support · Made by Zahra'
    return frame('Settings', stack(
      nameLabel,
      userLabel,
      nameError,
      para('GN time. The city stays open in all three.', 'kicker'),
      times,
      para('Graphics', 'kicker'),
      graphics,
      para('Map', 'kicker'),
      maps,
      para('Comfort', 'kicker'),
      comfort,
      para('Market Velocity stays silent until you press Play theme. Volume is the slider by that button.', 'muted'),
      para('WASD or arrows walk. Shift runs. Drag looks. Scroll zooms. E enters. Esc closes this.', 'muted'),
      para('Agents are labeled and attach to robots. Unit 4 in the plaza is one. A person is not an agent.', 'muted'),
      para('NEAR mainnet wallet · optional', 'kicker'),
      nearStatus,
      nearAccountDisplay,
      nearConnectButton,
      nearDisconnectButton,
      nearResult,
      save.privyId ? para(`Privy · ${save.privyId.slice(-6)}`, 'muted') : para('Privy login is on the title screen.', 'muted'),
      button('Log out of Privy', 'ghost', () => {
        void logoutPrivy().then(() => {
          finish('Privy login ended. The district save stayed.')
        })
      }),
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
          para('Mats by the door. One set is logged and left. The chart is not invited in.'),
          para('Another set today will not be filed again.'),
          button('Stay for the set', 'primary', () => visit('You stayed for the set.')),
        ])
      case 'nia':
        return renderSimple('Grove house', [
          para('Seedlings in jars. A pledge is a note that you showed up. A tonne is a serial on a registry, and this city does not retire one.'),
          button('Hear it out', 'primary', () => visit('You heard the grove house.')),
        ])
      case 'vacant':
        return renderSimple('Vacant house', [
          para('The bed is made. The key is on the hook. Nobody lives here yet. The row kept the room.'),
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
      case 'topup':
        return renderTopup()
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
            finish(outcome.message)
            open('prayer')
          }),
        ])
      case 'cafe':
        return renderSimple('The room', [
          para('The board is gossip, not a signal. Read it once a day.', 'muted'),
          button('Read the room', 'primary', () => {
            const outcome = readCafe()
            finish(outcome.message, outcome.rankedUp)
            open('cafe')
          }),
          button('Order water', 'ghost', () => {
            finish(orderWater().message)
            open('cafe')
          }),
          para('Water is free. The board is not a trade signal.', 'muted'),
        ])
      case 'house':
        return renderHouse()
      case 'city':
        return renderSimple('The city', [
          para('Every door on the street. Walk there and press E.'),
          ...GUIDE.map((stop) => para(`${stop.title} · ${stop.where}. ${stop.text}`)),
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
        return renderSimple('Conference hall', [
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
          para('The ledger is practice. There is no deployed token or seed-phrase prompt. An optional NEAR mainnet wallet can sign a market-order message; NEAR account activity is public, and this demo never submits a transaction or moves real funds. Nothing here is financial advice. This city does not run on Solana.'),
          para('A file in the repository ends in .sol. That extension is Solidity, an EVM record. It is not a Solana program, it is not deployed, and it is not the NEAR market demo.'),
          para('The masks use the collection names. The shapes are original to this city. Messaging and proximity voice are later. The ladder does not wait on them.'),
          button('Made by Zahra', 'primary', () => window.open(ZAHRA, '_blank', 'noopener')),
        ])
      case 'tax':
        return renderSimple('Family request', [
          para(`A cousin asked for ${money(TAX_USD)} practice toward transport. Paying is reputation. Not paying has no penalty.`),
          para('Rank will not move because money moved.', 'muted'),
          button(`Pay ${money(TAX_USD)}`, 'primary', () => {
            const outcome = payTax()
            finish(outcome.message)
            if (outcome.ok) close()
          }),
          button('Not today', 'ghost', () => {
            finish(declineTax().message)
            close()
          }),
        ])
      case 'shared':
        return renderSimple('Shared profile', [
          para('Someone sent a practice profile. Your save was not touched.', 'muted'),
          (() => {
            const pre = document.createElement('pre')
            pre.className = 'doc'
            pre.textContent = sharedHold ? sharedText(sharedHold) : 'That link did not include a profile.'
            return pre
          })(),
          button('Walk in', 'primary', close),
        ])
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
    if (extra?.tab) profileTab = extra.tab
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
