import { COURSES } from './courses.ts'
import { GUIDE } from './guide.ts'
import { SKILL_META } from './logic.ts'
import { loginWithPrivy, privyConfigured } from './privy.ts'
import { attachPrivy, getSave, signUp } from './state.ts'

type Page = 'how' | 'city' | 'courses' | 'credits' | 'agents'

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
        copy('You start as a shrimp with an empty practice ledger. Rank moves when you learn, show up, and size your reps. Balance does not move it.'),
        copy('WASD or the arrows walk. Shift runs. Drag looks around. The wheel zooms. Click the ground to walk there. Stand on a mint doorstep and press E, or the mint button.'),
        copy('Esc closes a sheet. Movement pauses while a sheet is open.'),
        copy('Twelve courses are in the learning hall, north of the plaza. A pass writes your CV, resume, and portfolio. The houses are the row to the east: yours, a notes house, a set house, a grove house, and a vacant room.'),
        copy('Market Velocity stays silent until you press Play theme. The ledger is practice USD. It is not a deposit, not a token, and not advice.'),
        copy('If this browser cannot start WebGL, the same streets open as an overhead map. The doors are the same doors.'),
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
        copy('Signup asks for a name, a username, and a body. The man has blonde hair, glasses, and a grey suit. The woman has longer hair and a fitted coat. Both are original. The boutique can change the body later.'),
        copy('Masks in the boutique use the names CryptoPunks, Bored Apes, Pudgy Penguins, Azuki, Nodemonkes, and DeGods. The shapes are Grind District cuts, not the licensed artwork.'),
        copy('Privy email sign-in is available when you want to keep your username, rank, and CV across devices. You can also play as a guest. Wallet linking is optional in Settings. NEAR mainnet account IDs and activity are public, so keep names, usernames, and personal details off-chain. The market demo signs a small order message and fills only the local practice book: it sends no transaction, deploys no contract, and moves no real funds. The city never asks for a seed phrase. A Solidity file in the repository uses the extension .sol; it is an undeployed EVM record, not a Solana program or the NEAR integration.'),
        copy('Market Velocity is the theme. It loops at three minutes and stays paused until you press play.'),
      )
      return { title: 'Credits', body }
    case 'agents':
      body.append(
        copy('Agents are labeled and attach to robots. Unit 4 in the plaza is one. A person is not an agent.'),
        copy('Enter the district, walk to Unit 4 in the plaza, and interact there to create a fresh, time-limited claim prompt for your agent. The prompt does not issue funds.'),
      )
      return { title: 'Agents', body }
    default: {
      const neverPage: never = page
      return neverPage
    }
  }
}

export function mountMenu(enter: () => void): void {
  const home = must<HTMLElement>('#menu-home')
  const account = must<HTMLElement>('#menu-account')
  const accountExisting = must<HTMLButtonElement>('#account-existing')
  const accountError = must<HTMLParagraphElement>('#account-error')
  const page = must<HTMLElement>('#menu-page')
  const signup = must<HTMLElement>('#menu-signup')
  const title = must<HTMLHeadingElement>('#menu-page-title')
  const slot = must<HTMLElement>('#menu-page-body')
  const play = must<HTMLButtonElement>('#play')
  const form = must<HTMLFormElement>('#signup-form')
  const nameInput = must<HTMLInputElement>('#signup-name')
  const userInput = must<HTMLInputElement>('#signup-user')
  const error = must<HTMLParagraphElement>('#signup-error')
  const note = must<HTMLParagraphElement>('#menu-note')
  const saved = getSave()
  note.textContent = saved.signedUp ? 'Welcome back.' : ''

  const show = (next: Page) => {
    const built = pageBody(next)
    title.textContent = built.title
    slot.replaceChildren(built.body)
    home.hidden = true
    account.hidden = true
    signup.hidden = true
    page.hidden = false
  }

  const back = () => {
    page.hidden = true
    account.hidden = true
    signup.hidden = true
    accountError.hidden = true
    accountError.textContent = ''
    slot.replaceChildren()
    home.hidden = false
    play.focus()
  }

  const showSignup = () => {
    home.hidden = true
    account.hidden = true
    page.hidden = true
    error.hidden = true
    error.textContent = ''
    signup.hidden = false
    nameInput.focus()
  }

  const showAccount = () => {
    home.hidden = true
    signup.hidden = true
    page.hidden = true
    accountError.hidden = true
    accountError.textContent = ''
    account.hidden = false
    accountExisting.focus()
  }

  const start = async (authenticate: boolean) => {
    if (authenticate) {
      accountExisting.disabled = true
      accountExisting.textContent = 'Opening Privy'
      const outcome = await loginWithPrivy()
      accountExisting.disabled = false
      accountExisting.textContent = 'Sign in with email'
      if ('error' in outcome) {
        accountError.hidden = false
        accountError.textContent = outcome.error
        return
      }
      const linked = attachPrivy(outcome.id)
      if ('error' in linked) {
        accountError.hidden = false
        accountError.textContent = linked.error
        return
      }
    }
    if (getSave().signedUp) {
      enter()
      return
    }
    if (!authenticate && privyConfigured()) {
      showAccount()
      return
    }
    showSignup()
  }

  play.addEventListener('click', () => {
    void start(false)
  })
  accountExisting.addEventListener('click', () => {
    void start(true)
  })
  must('#account-new').addEventListener('click', showSignup)
  must('#account-back').addEventListener('click', back)
  must('#menu-agents').addEventListener('click', () => show('agents'))
  must('#menu-back').addEventListener('click', back)
  must('#signup-back').addEventListener('click', back)
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    const picked = new FormData(form).get('body')
    const body = picked === 'zuri' ? 'zuri' : picked === 'player' ? 'player' : null
    if (!body) {
      error.hidden = false
      error.textContent = 'Pick a body.'
      return
    }
    const outcome = signUp(nameInput.value, userInput.value, body)
    if ('error' in outcome) {
      error.hidden = false
      error.textContent = outcome.error
      return
    }
    enter()
  })

  window.addEventListener('keydown', (event) => {
    const menu = document.querySelector('#menu')
    if (!(menu instanceof HTMLElement) || menu.hidden || event.repeat) return
    if (event.key === 'Escape' && (!page.hidden || !signup.hidden || !account.hidden)) {
      event.preventDefault()
      back()
      return
    }
    if (!signup.hidden || !account.hidden) return
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (!page.hidden) return
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    if (target instanceof HTMLButtonElement && target.id !== 'play') return
    event.preventDefault()
    void start(false)
  })
}
