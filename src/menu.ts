import { COURSES } from './courses.ts'
import { GUIDE } from './guide.ts'
import { SKILL_META } from './logic.ts'
import { getSave, signUp } from './state.ts'
import { agentJoinForm } from './agent.ts'
import { AGENT_EXPLAINER } from './agentPrompt.ts'
import { SKILL_ORDER } from './logic.ts'
import { nearPassportPage } from './nearPassport.ts'

type Page = 'how' | 'city' | 'courses' | 'credits' | 'agents' | 'near'

function must<T extends Element>(selector: string): T {
  const node = document.querySelector<T>(selector)
  if (!node) throw new Error(`Missing ${selector}`)
  return node
}

function copy(text: string): HTMLParagraphElement {
  const node = document.createElement('p')
  node.textContent = text
  return node
}

function list(items: Array<{ title: string; text: string }>): HTMLUListElement {
  const node = document.createElement('ul')
  node.className = 'menu-list'
  for (const item of items) {
    const row = document.createElement('li')
    const title = document.createElement('strong')
    title.textContent = item.title
    const detail = document.createElement('span')
    detail.textContent = item.text
    row.append(title, detail)
    node.append(row)
  }
  return node
}

function pageBody(page: Page): { title: string; body: HTMLElement } {
  const body = document.createElement('div')
  body.className = 'menu-copy'
  switch (page) {
    case 'how':
      body.append(
        copy('Move: WASD or arrows (Shift runs), or the Move stick on a phone. Drag to look, scroll or pinch to zoom. E or the Enter button opens a door.'),
        copy('Climb: shrimp, crab, fish, dolphin, shark, whale. You rank up by learning and showing up, not by balance.'),
        copy('Courses and CV: pass courses in the learning hall to earn certificates. Pass three and your CV page unlocks to share.'),
        copy('Boutique: walk in to try on bodies, shirts and accessories.'),
      )
      return { title: 'How to play', body }
    case 'city':
      body.append(
        copy('One shared city. No tribe. No continent. Walk any of it.'),
        list(GUIDE.map((stop) => ({ title: `${stop.title} · ${stop.where}`, text: stop.text }))),
      )
      return { title: 'The city', body }
    case 'courses':
      body.append(
        copy('Each course is a short reading and four exercises. Miss one and the hall tells you which idea to reread. A pass files itself. There is nothing to buy.'),
        list(COURSES.map((course) => ({
          title: `${SKILL_META[course.id].title} · ${course.minutes}`,
          text: course.paragraphs[0] ?? '',
        }))),
      )
      return { title: 'Courses', body }
    case 'credits':
      body.append(
        copy('Grind District is made by Zahra.'),
        copy('Signup asks for a name, a username, and a body. The gentleman has blonde hair, glasses, and a grey suit. The lady has long hair and a fitted dress. Both are original. The boutique can change the body later.'),
        // NFT disabled: copy('Masks in the boutique use the names CryptoPunks, Bored Apes, Pudgy Penguins, Azuki, Nodemonkes, and DeGods. The shapes are Grind District cuts, not the licensed artwork.'),
        copy('The city does not run on Solana, and it does not ask for a wallet. A Solidity file in the repository uses the extension .sol. That extension means Solidity, an EVM record. It is not a Solana program, it is not deployed, and the practice ledger is not it.'),
        copy('Market Velocity is the theme. It loops at three minutes and stays paused until you press play.'),
      )
      return { title: 'Credits', body }
    case 'agents': {
      body.append(copy(AGENT_EXPLAINER))
      body.append(agentJoinForm())
      return { title: 'Agents', body }
    }
    case 'near': {
      const save = getSave()
      body.append(nearPassportPage(SKILL_ORDER.filter((id) => save.skills[id]?.passed), (id) => SKILL_META[id].title))
      return { title: 'Skill Passport (NEAR testnet)', body }
    }
    default: {
      const neverPage: never = page
      return neverPage
    }
  }
}

export function hasAccountSession(): boolean {
  try {
    return !!(localStorage.getItem('gd.privy.username') || localStorage.getItem('gd.privy.userId') || localStorage.getItem('gd.near.account'))
  } catch {
    return false
  }
}

export function mountMenu(enter: () => void): void {
  const home = must<HTMLElement>('#menu-home')
  const page = must<HTMLElement>('#menu-page')
  const signup = must<HTMLElement>('#menu-signup')
  const title = must<HTMLHeadingElement>('#menu-page-title')
  const slot = must<HTMLElement>('#menu-page-body')
  const play = must<HTMLButtonElement>('#play')
  const form = must<HTMLFormElement>('#signup-form')
  const nameInput = must<HTMLInputElement>('#signup-name')
  const error = must<HTMLParagraphElement>('#signup-error')
  const note = must<HTMLParagraphElement>('#menu-note')
  const account = must<HTMLElement>('#menu-account')
  const profileName = must<HTMLElement>('#menu-profile-name')
  profileName.textContent = ''

  const show = (next: Page) => {
    const built = pageBody(next)
    title.textContent = built.title
    slot.replaceChildren(built.body)
    home.hidden = true
    signup.hidden = true
    account.hidden = true
    page.hidden = false
  }

  const back = () => {
    page.hidden = true
    signup.hidden = true
    account.hidden = true
    slot.replaceChildren()
    home.hidden = false
    const focus = document.querySelector<HTMLButtonElement>('#menu-create') ?? document.querySelector<HTMLButtonElement>('#menu-signin') ?? play
    focus?.focus()
  }

  const showAccount = () => {
    home.hidden = true
    page.hidden = true
    signup.hidden = true
    account.hidden = false
    must<HTMLButtonElement>('#account-existing').focus()
  }

  /** Enter the 3D district only with a real account session (Privy or NEAR). */
  const enterIfSignedIn = () => {
    if (!hasAccountSession()) {
      note.textContent = 'Sign in to enter the district.'
      void import('./login.ts').then((m) => m.openLogin('', 'signin'))
      return
    }
    enter()
  }

  const refreshHome = () => {
    const session = hasAccountSession()
    const handle = localStorage.getItem('gd.privy.username')
    play.hidden = !session
    play.disabled = false
    play.textContent = handle ? `Continue as @${handle}` : 'Continue'
    note.textContent = session ? (handle ? `Signed in as @${handle}.` : 'Signed in on this device.') : ''
    // Opening card: Sign up / Sign in / Agents. Continue only appears after a real session.
    const create = document.querySelector<HTMLButtonElement>('#menu-create')
    const signin = document.querySelector<HTMLButtonElement>('#menu-signin')
    if (create) create.hidden = session
    if (signin) signin.hidden = session
  }

  play.addEventListener('click', enterIfSignedIn)
  const openAuth = (mode: 'signup' | 'signin') => {
    const note = document.getElementById('menu-note')
    if (note) note.textContent = mode === 'signup' ? 'Opening sign up…' : 'Opening sign in…'
    void import('./login.ts')
      .then((m) => m.openLogin('', mode))
      .catch((e: unknown) => {
        if (note) note.textContent = `Could not open ${mode === 'signup' ? 'sign up' : 'sign in'}. Check your connection and try again.`
        console.error('[grind] openLogin failed', e)
      })
  }
  // pointerup + click with debounce: some mobile WebViews swallow click after a full-screen WebGL canvas paints.
  const bindTap = (sel: string, fn: () => void) => {
    const el = must<HTMLButtonElement>(sel)
    let last = 0
    const run = () => {
      const now = Date.now()
      if (now - last < 450) return
      last = now
      fn()
    }
    el.addEventListener('pointerup', (e) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') run()
    })
    el.addEventListener('click', () => run())
  }
  bindTap('#menu-create', () => openAuth('signup'))
  bindTap('#menu-signin', () => openAuth('signin'))
  must('#menu-agents').addEventListener('click', () => show('agents'))

  must('#account-existing').addEventListener('click', () => { void import('./login.ts').then((m) => m.openLogin('', 'signin')) })
  must('#account-new').addEventListener('click', () => { void import('./login.ts').then((m) => m.openLogin('', 'signup')) })
  must('#account-back').addEventListener('click', back)
  must('#menu-profile').addEventListener('click', () => {
    if (hasAccountSession()) enterIfSignedIn()
    else showAccount()
  })
  if (location.search.includes('privy_oauth_code')) void import('./login.ts').then((m) => m.resumeOAuth())
  must('#menu-back').addEventListener('click', back)
  must('#signup-back').addEventListener('click', back)

  // Body picker is no longer a guest door. Keep the form for rare post-auth use; never enter without a session.
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    if (!hasAccountSession()) {
      error.hidden = false
      error.textContent = 'Sign in first.'
      return
    }
    const picked = new FormData(form).get('body')
    const body = picked === 'zuri' ? 'zuri' : picked === 'player' ? 'player' : null
    if (!body) {
      error.hidden = false
      error.textContent = 'Pick a body.'
      return
    }
    const outcome = signUp(nameInput.value, '', body)
    if (!outcome.ok) {
      error.hidden = false
      error.textContent = outcome.error
      return
    }
    enterIfSignedIn()
  })

  window.addEventListener('keydown', (event) => {
    const menu = document.querySelector('#menu')
    if (!(menu instanceof HTMLElement) || menu.hidden || event.repeat) return
    if (event.key === 'Escape' && (!page.hidden || !signup.hidden || !account.hidden)) {
      event.preventDefault()
      back()
      return
    }
    if (!signup.hidden || !account.hidden || !page.hidden) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    if (target instanceof HTMLButtonElement) return
    event.preventDefault()
    if (hasAccountSession()) enterIfSignedIn()
    else void import('./login.ts').then((m) => m.openLogin('', 'signin'))
  })

  window.addEventListener('gd-auth-changed', () => refreshHome())
  refreshHome()
}
