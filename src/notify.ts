// In-game notifications: bell + unread badge + glass inbox. localStorage only (Supabase sync not added: kept cheap).
import { notificationsOn } from './agent.ts'

// `go` deep-links: 'place:<hotspot title>', 'panel:<panel id>', or 'chat'.
export type Note = { id: string; title: string; body: string; at: number; read: boolean; go?: string }
const KEY = 'gd.notes.v1'
let notes: Note[] = []
try { notes = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Note[] } catch { notes = [] }
let render: () => void = () => {}
let followHook: (go?: string) => boolean = () => false
/** Deep-link handler (set by main): place/panel/chat/dm/balance. */
export function setNoteFollow(fn: (go?: string) => boolean): void { followHook = fn }
const save = () => { localStorage.setItem(KEY, JSON.stringify(notes.slice(0, 50))); render(); for (const fn of changeListeners) fn() }

const recent = new Map<string, number>()
export function notify(title: string, body = '', onceKey?: string, go?: string): void {
  if (!notificationsOn()) return
  // One per event: identical title+body within 60 s is dropped (no spam from repeated taps).
  const sig = title + '|' + body
  const now = Date.now()
  if (now - (recent.get(sig) ?? 0) < 60_000) return
  recent.set(sig, now)
  if (onceKey) {
    if (localStorage.getItem('gd.note.once.' + onceKey)) return
    localStorage.setItem('gd.note.once.' + onceKey, '1')
  }
  notes.unshift({ id: Math.random().toString(36).slice(2), title, body, at: Date.now(), read: false, go })
  save()
}

export function mountNotifications(): void {
  const bell = document.createElement('button')
  bell.id = 'bell'
  bell.type = 'button'
  bell.setAttribute('aria-label', 'Notifications')
  bell.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4"/></svg><span class="badge" hidden></span>'
  const panel = document.createElement('section')
  panel.id = 'inbox'
  panel.hidden = true
  panel.setAttribute('aria-label', 'Notifications')
  document.body.append(bell, panel)
  const badge = bell.querySelector('.badge') as HTMLElement
  render = () => {
    const unread = notificationsOn() ? notes.filter((n) => !n.read).length : 0
    badge.hidden = unread === 0
    badge.textContent = unread > 9 ? '9+' : String(unread)
    if (panel.hidden) return
    const head = document.createElement('header')
    const h = document.createElement('h2'); h.textContent = 'Notifications'
    const all = document.createElement('button'); all.type = 'button'; all.textContent = 'Mark all read'
    all.onclick = () => { notes.forEach((n) => { n.read = true }); save() }
    head.append(h, all)
    const list = document.createElement('ol')
    for (const n of notes) {
      const li = document.createElement('li')
      li.className = n.read ? 'read' : 'unread'
      const t = document.createElement('strong'); t.textContent = n.title
      const time = document.createElement('time'); time.textContent = new Date(n.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      const b = document.createElement('p'); b.textContent = n.body
      li.append(t, time, b)
      li.onclick = () => { n.read = true; save(); if (n.go && followHook(n.go)) panel.hidden = true }
      li.style.cursor = 'pointer'
      list.append(li)
    }
    if (!notes.length) { const e = document.createElement('p'); e.textContent = 'Nothing yet.'; list.append(e) }
    panel.replaceChildren(head, list)
  }
  bell.onclick = () => { panel.hidden = !panel.hidden; render() }
  render()
}

export const getNotes = (): readonly Note[] => notes
export const unreadCount = (): number => (notificationsOn() ? notes.filter((n) => !n.read).length : 0)
export function markRead(id?: string): void { for (const n of notes) if (!id || n.id === id) n.read = true; save() }
const changeListeners = new Set<() => void>()
export function onNotesChange(fn: () => void): void { changeListeners.add(fn) }
const _save = save
void _save
