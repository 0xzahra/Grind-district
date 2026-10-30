import { COURSES, headlines } from './courses.ts'
import {
  BODIES,
  CHAIN_USD,
  CLIMATE_USD,
  COURSE_XP,
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
  claimHouse,
  declineTax,
  describeTrade,
  dismissIntro,
  finishGym,
  getSave,
  hearTalk,
  payTax,
  pledge,
  postBounty,
  readCafe,
  readRobot,
  resetProgress,
  sellChain,
  setBody,
  setGraphics,
  setTime,
  setTint,
  setUsername,
  sitPrayer,
  submitCourse,
  subscribe,
  trade,
  type CourseResult,
} from './state.ts'

type Tab = 'today' | 'cv' | 'resume' | 'portfolio' | 'books'

type Hooks = {
  onStyle: () => void
  onBody: () => void
  onLook: () => void
  onGraphics: () => void
  onRank: (label: string) => void
}

export type Ui = {
  isOpen: () => boolean
  open: (panel: PanelId, extra?: { shared?: SharedProfile; tab?: Tab }) => void
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

  let open!: (panel: PanelId, extra?: { shared?: SharedProfile; tab?: Tab }) => void

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
    return frame(`${save.username}`, stack(bar, body))
  }

  const renderToday = (save: ReturnType<typeof getSave>): HTMLElement => {
    const rank = rankFor(save.xp)
    const next = nextRank(save.xp)
    const wrap = stack()
    wrap.append(para(next ? `${rank.label} · ${save.xp} XP · ${next.label} at ${next.xp}` : `${rank.label} · ${save.xp} XP. The ladder stays open.`))
    const track = document.createElement('div')
    track.className = 'bar'
    const fill = document.createElement('div')
    fill.className = 'bar-fill'
    fill.style.width = `${Math.round(progressToNext(save.xp) * 100)}%`
    track.append(fill)
    wrap.append(track, para('Balance does not move this bar.', 'muted'))
    const streakNote = save.dailies && todayTasks(save).some((task) => task.done)
      ? `Streak ${save.streak}. You already logged a rep today.`
      : save.streak > 0
        ? `Streak ${save.streak}. One rep today makes it ${save.streak + 1}.`
        : 'No streak yet. One rep today starts it.'
    wrap.append(para(`${streakNote} Reputation ${save.reputation}.`))
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
      body.replaceChildren(para('Pass a course and it files itself. No certificates for sale.', 'muted'))
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
      const picks: Array<number | null> = [null, null]
      const wrap = stack(button('All courses', 'ghost', showList), para(SKILL_META[id].title, 'kicker'))
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
        if (picks[0] === null || picks[1] === null) {
          result.textContent = 'Answer both, then check.'
          return
        }
        const outcome: CourseResult = submitCourse(id, [picks[0], picks[1]])
        if (outcome.ok) {
          const extra = outcome.stipend ? ' Campus put $25 practice on your ledger.' : ''
          const focus = outcome.focus ? ' Focus added a quarter.' : ''
          const bonus = outcome.bonus ? ` Streak +${outcome.bonus} XP.` : ''
          finish(`Filed to your CV.${focus}${bonus}${extra}`, outcome.rankedUp)
          showCourse(id)
          return
        }
        if (outcome.already) {
          result.textContent = 'Already on your CV.'
          return
        }
        result.textContent = outcome.hints.filter(Boolean).join(' ')
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
      t += 0.045
      const markerAt = 0.5 + Math.sin(t) * 0.42
      marker.style.left = `${markerAt * 100}%`
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return frame('Gym', stack(status, lane, hit, result, para(`Best filed set: ${save.gymBest}/8.`, 'muted')))
  }

  const renderBoutique = (): HTMLElement => {
    const save = getSave()
    const wrap = stack(para('Original bodies, free to everyone. Holder collections are not on this street.', 'muted'))
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
    wrap.append(para('CryptoPunks, Bored Apes, Pudgy Penguins, Azuki, Nodemonkes, DeGods, and the rest of the design list need a license or a holder check before a body can wear them. The bodies on this wall do not.', 'muted'))
    return frame('Boutique', wrap)
  }

  const renderSettings = (): HTMLElement => {
    const save = getSave()
    const name = document.createElement('input')
    name.type = 'text'
    name.maxLength = 24
    name.value = save.username
    name.addEventListener('change', () => {
      setUsername(name.value)
      name.value = getSave().username
      refresh()
    })
    const nameLabel = document.createElement('label')
    nameLabel.className = 'field'
    nameLabel.append(para('Username', 'kicker'), name)
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
      toast('Back to zero. GN time and volume stayed.')
    })
    const support = document.createElement('a')
    support.href = ZAHRA
    support.target = '_blank'
    support.rel = 'noopener noreferrer'
    support.textContent = 'Support · Made by Zahra'
    return frame('Settings', stack(
      nameLabel,
      para('GN time. The city stays open in all three.', 'kicker'),
      times,
      para('Graphics', 'kicker'),
      graphics,
      para('Market Velocity stays silent until you press Play theme. Volume is the slider by that button.', 'muted'),
      para('WASD or arrows walk. Shift runs. Drag looks. Scroll zooms. E enters. Esc closes this.', 'muted'),
      para('Agents are labeled and attach to robots. Unit 4 in the plaza is one. A person is not an agent.', 'muted'),
      support,
      button('About this city', 'ghost', () => open('about')),
      reset,
    ))
  }

  const renderSimple = (title: string, nodes: HTMLElement[]): HTMLElement => frame(title, stack(...nodes))

  const render = (panel: PanelId): HTMLElement => {
    switch (panel) {
      case 'intro':
        return renderSimple('You start at zero', [
          para('You are a shrimp in a shared city. The practice ledger is empty. Rank does not read it.'),
          para('Walk north to the learning hall, or follow a mint road. Music stays off until you want Market Velocity.'),
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
        ])
      case 'house':
        return renderSimple('Your room', [
          para('Messaging and proximity voice are not in this build. The room is still private.'),
          para('GN time is in settings. You can set the light from here too.'),
          button('Claim the room', 'primary', () => {
            const outcome = claimHouse()
            finish(outcome.message)
            open('house')
          }),
          button('GN night', 'ghost', () => {
            setTime('night')
            hooks.onLook()
          }),
        ])
      case 'climate':
        return renderSimple('Carbon desk', [
          para(`A practice pledge costs ${money(CLIMATE_USD)}. It does not retire a real credit. Rank does not move because you spent.`),
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
          button('Stay for it', 'primary', () => {
            const outcome = hearTalk()
            finish(outcome.message, outcome.rankedUp)
            open('conference')
          }),
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
          para('This build is the city: districts, the original low-poly citizen, the shrimp mascot, the learning hall, and a profile that writes a CV, resume, and portfolio from what you do.'),
          para('The ledger is practice. There is no deployed token, no wallet prompt, and no seed phrase. Nothing here is financial advice.'),
          para('GrindRecord.sol sits in the repository. It can record a course and reputation, it uses the same rank cuts as the city, and it refuses ether. It is not deployed, and this city does not send transactions.'),
          para('Licensed NFT bodies, a live chain, messaging, and proximity voice are later. The ladder does not wait on them.'),
          para('Bull and bear seasons change the city’s mood and the practice books. The game still works when the marks fall.'),
          button('Made by Zahra', 'primary', () => window.open(ZAHRA, '_blank', 'noopener')),
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

  open = (panel: PanelId, extra?: { shared?: SharedProfile; tab?: Tab }) => {
    const previous = current
    stop()
    current = panel
    if (extra?.shared) sharedHold = extra.shared
    if (extra?.tab) profileTab = extra.tab
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
