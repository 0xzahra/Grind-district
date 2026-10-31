import { COURSES } from './courses.ts'
import { GUIDE } from './guide.ts'
import { SKILL_META } from './logic.ts'

type Page = 'how' | 'city' | 'courses' | 'credits'

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
        copy('The eight courses are in the learning hall, north of the plaza. A pass writes your CV, resume, and portfolio. The houses are the row to the east: yours, Adaeze, Malik, Nia, and a vacant room.'),
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
        copy('The street body is an original low-poly citizen, Player 8453. It is not taken from a licensed collection.'),
        copy('The city does not run on Solana, and it does not ask for a wallet. A Solidity file in the repository uses the extension .sol. That extension means Solidity, an EVM record. It is not a Solana program, it is not deployed, and the practice ledger is not it.'),
        copy('Market Velocity is the theme. It loops at three minutes and stays paused until you press play.'),
      )
      return { title: 'Credits', body }
    default: {
      const neverPage: never = page
      return neverPage
    }
  }
}

export function mountMenu(enter: () => void): void {
  const home = must<HTMLElement>('#menu-home')
  const page = must<HTMLElement>('#menu-page')
  const title = must<HTMLHeadingElement>('#menu-page-title')
  const slot = must<HTMLElement>('#menu-page-body')
  const play = must<HTMLButtonElement>('#play')

  const show = (next: Page) => {
    const built = pageBody(next)
    title.textContent = built.title
    slot.replaceChildren(built.body)
    home.hidden = true
    page.hidden = false
  }

  const back = () => {
    page.hidden = true
    slot.replaceChildren()
    home.hidden = false
    play.focus()
  }

  play.addEventListener('click', enter)
  must('#menu-how').addEventListener('click', () => show('how'))
  must('#menu-city').addEventListener('click', () => show('city'))
  must('#menu-courses').addEventListener('click', () => show('courses'))
  must('#menu-credits').addEventListener('click', () => show('credits'))
  must('#menu-back').addEventListener('click', back)

  window.addEventListener('keydown', (event) => {
    const menu = document.querySelector('#menu')
    if (!(menu instanceof HTMLElement) || menu.hidden || event.repeat) return
    if (event.key === 'Escape' && !page.hidden) {
      event.preventDefault()
      back()
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (!page.hidden) return
    const target = event.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return
    if (target instanceof HTMLButtonElement && target.id !== 'play') return
    event.preventDefault()
    enter()
  })
}
