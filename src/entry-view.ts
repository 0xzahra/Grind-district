type Visibility = { hidden: boolean | string }
type BootView = Visibility & { classList: { add: (name: string) => void; remove: (name: string) => void }; setAttribute: (name: string, value: string) => void; removeAttribute: (name: string) => void }
export function showEntryHome(home: Visibility, signup: Visibility, page: Visibility): void {
  home.hidden = false; signup.hidden = true; page.hidden = true
}
export function createEntryView(menu: Visibility, boot: BootView, status: { textContent: string | null }, note: { textContent: string | null }) {
  return {
    begin() {
      menu.hidden = true
      boot.hidden = false
      boot.classList.remove('hidden')
      boot.removeAttribute('aria-hidden')
      status.textContent = 'Opening the district'
    },
    reveal() {
      menu.hidden = true
      boot.classList.add('hidden')
      boot.setAttribute('aria-hidden', 'true')
    },
    fail(message: string) {
      menu.hidden = false
      boot.classList.add('hidden')
      boot.setAttribute('aria-hidden', 'true')
      note.textContent = message
    },
  }
}
