import { createEntryView, showEntryHome } from './entry-view.ts'
import { loadSave, signUp, getSave } from './state.ts'
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => store.set(key, value) } })
loadSave('low')
const home = { hidden: true }, signup = { hidden: false }, page = { hidden: true }, menu = { hidden: false }
const classes = new Set(['hidden'])
const attrs = new Map([['aria-hidden', 'true']])
const boot = { hidden: false, classList: { add: (n: string) => { classes.add(n) }, remove: (n: string) => { classes.delete(n) } }, setAttribute: (n: string, v: string) => { attrs.set(n,v) }, removeAttribute: (n: string) => { attrs.delete(n) } }
const status = { textContent: '' }, note = { textContent: '' }
const view = createEntryView(menu, boot, status, note)
check(signUp('Preview Tester', 'previewguest', 'player').ok, 'reported guest values are accepted')
check(getSave().signedUp, 'signup completes before city starts')
showEntryHome(home, signup, page)
check(signup.hidden && !home.hidden, 'completed signup never remains the active loading/recovery panel')
view.begin()
check(menu.hidden && !classes.has('hidden') && !attrs.has('aria-hidden'), 'loading hides menu hit targets and exposes boot status')
view.reveal()
check(menu.hidden && classes.has('hidden'), 'first rendered city leaves no title overlay')
view.fail('Test initialization failure')
check(!menu.hidden && classes.has('hidden') && note.textContent === 'Test initialization failure' && !home.hidden, 'initialization failure shows error on reachable home, not hidden beneath signup')
view.begin(); view.reveal()
check(menu.hidden, 'retry can reveal without stale signup interception')
loadSave('low')
check(getSave().username === 'previewguest', 'presentation fix preserves saved signup')
console.log('entry lifecycle checks passed')
