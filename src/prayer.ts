// Prayer times in the game. The Masjid card and the menu's Prayer key show today's five prayers (and sunrise) for
// the player's place, the next prayer with a live countdown, and the Hijri date; on Fridays Dhuhr is Jumu'ah.
// Reminders are opt-in: at each prayer a banner and a soft chime while the game is open, and a phone-style
// notification when the game is in a background tab and notifications are allowed.
// The place comes from the device's time zone (its main city), a city picked from the list, or the phone's location
// (asked only when the player taps it). It is kept on this device only and never sent anywhere.
import { prayerTimes, PRAYERS, METHODS, methodFor, asrFor, cityFor, CITIES, type Method, type AsrRule, type PrayerName } from './prayerCalc.ts'

type Place = { lat: number; lng: number; label: string; src: 'city' | 'gps' }
type Stored = { place?: Place; method?: Method; asr?: AsrRule; remind?: boolean }
type Prefs = { lat: number; lng: number; label: string; src: 'zone' | 'city' | 'gps' | 'guess'; method: Method; asr: AsrRule; remind: boolean }

const KEY = 'gd.prayer.v1'
const FIRED = 'gd.prayer.fired'
const zone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || '' } catch { return '' } }
const read = (): Stored => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') as Stored } catch { return {} } }
const write = (patch: Stored) => { try { localStorage.setItem(KEY, JSON.stringify({ ...read(), ...patch })) } catch { /* private mode: this visit only */ } }

export function prayerPrefs(): Prefs {
  const s = read(), tz = zone()
  const method = s.method ?? methodFor(tz), asr = s.asr ?? asrFor(tz), remind = !!s.remind
  if (s.place && Number.isFinite(s.place.lat) && Number.isFinite(s.place.lng)) return { ...s.place, method, asr, remind }
  const c = cityFor(tz)
  if (c) return { lat: c.lat, lng: c.lng, label: c.name, src: 'zone', method, asr, remind }
  // A zone we have no city for: a point on the device's own meridian keeps the times close until a city is set.
  return { lat: 21.42, lng: (-new Date().getTimezoneOffset() / 60) * 15, label: 'your time zone', src: 'guess', method, asr, remind }
}

export const PRAYER_KEYS: PrayerName[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
const isFriday = (d: Date) => d.getDay() === 5
export const prayerLabel = (id: PrayerName, d: Date) => (id === 'dhuhr' && isFriday(d) ? 'Jumuʿah' : PRAYERS.find((p) => p.id === id)!.name)

export function timesFor(day = new Date()): Record<PrayerName, Date> {
  const p = prayerPrefs()
  return prayerTimes(day, p.lat, p.lng, p.method, p.asr)
}

/** The next of the five prayers from `now` (tomorrow's Fajr after Isha). */
export function nextPrayer(now = new Date()): { id: PrayerName; at: Date; label: string } {
  const t = timesFor(now)
  for (const id of PRAYER_KEYS) if (t[id].getTime() > now.getTime()) return { id, at: t[id], label: prayerLabel(id, now) }
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 12)
  return { id: 'fajr', at: timesFor(tomorrow).fajr, label: 'Fajr' }
}

const clock = (d: Date) => d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
const until = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60e3))
  return m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h ${m % 60} min`
}
export function hijri(d = new Date()): string {
  for (const cal of ['islamic-umalqura', 'islamic']) {
    try { return new Intl.DateTimeFormat(`en-u-ca-${cal}`, { day: 'numeric', month: 'long', year: 'numeric' }).format(d) } catch { /* next */ }
  }
  return ''
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); if (text) n.textContent = text; if (cls) n.className = cls; return n }

type Kit = { para: (t: string, c?: string) => HTMLParagraphElement; button: (l: string, c: string, f: () => void) => HTMLButtonElement }

/** Today's timetable card with the next prayer, the reminder switch and the place/method settings. */
export function prayerNodes(kit: Kit, opts: { rerender: () => void; toast: (m: string) => void }): HTMLElement[] {
  const now = new Date()
  const p = prayerPrefs()
  const t = timesFor(now)
  const next = nextPrayer(now)
  const card = el('div', '', 'pt-card')
  const head = el('div', '', 'pt-head')
  const lead = el('div', '', 'pt-lead')
  lead.append(el('small', now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })), el('b', `Next: ${next.label}`))
  const count = el('span', `${until(next.at.getTime() - now.getTime())} · ${clock(next.at)}`, 'pt-count')
  lead.append(count)
  const moon = el('span', '', 'pt-moon'); moon.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 3.2A8.5 8.5 0 1 0 20.8 15 7 7 0 0 1 15.5 3.2Z"/><path d="m18.2 4.6.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5.5-1.4Z"/></svg>'
  head.append(lead, moon)
  card.append(head)
  const hj = hijri(now)
  if (hj) card.append(el('p', hj, 'pt-hijri'))
  const list = el('ol', '', 'pt-list')
  for (const pr of PRAYERS) {
    const li = el('li', '', pr.id === next.id && next.at.getDate() === now.getDate() ? 'next' : t[pr.id].getTime() < now.getTime() ? 'past' : '')
    if (pr.id === 'sunrise') li.classList.add('rise')
    const name = el('span', '', 'pt-name')
    name.append(el('b', prayerLabel(pr.id, now)), el('i', pr.id === 'dhuhr' && isFriday(now) ? 'الجمعة' : pr.arabic))
    li.append(name, el('time', clock(t[pr.id])))
    list.append(li)
  }
  card.append(list)
  const where = el('p', `${p.src === 'gps' ? 'Your location' : p.label} · ${METHODS[p.method].name} · Asr ${p.asr === 'hanafi' ? 'Hanafi' : 'standard'}`, 'pt-where')
  card.append(where)
  const tick = window.setInterval(() => {
    if (!count.isConnected) { window.clearInterval(tick); return }
    const n = nextPrayer(new Date())
    count.textContent = `${until(n.at.getTime() - Date.now())} · ${clock(n.at)}`
  }, 20e3)

  const out: HTMLElement[] = [card]
  if (isFriday(now)) out.push(kit.para(`Jumuʿah mubarak. The Friday congregational prayer replaces Dhuhr today at about ${clock(t.dhuhr)}: the sermon comes first, so arrive early at your masjid.`, 'pt-note'))
  if (p.src === 'guess') out.push(kit.para('We could not tell your city from this device. Pick it below, or use your location, so the times are exact.', 'pt-note'))

  // Reminder switch.
  const remind = el('label', '', 'pt-toggle')
  const box = el('input'); box.type = 'checkbox'; box.checked = p.remind
  remind.append(box, el('span', 'Remind me at each prayer time'))
  box.onchange = () => {
    write({ remind: box.checked })
    if (box.checked && 'Notification' in window && Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined)
    opts.toast(box.checked ? 'Prayer reminders on. You will get a gentle alert at each prayer while the game is open.' : 'Prayer reminders off.')
  }
  out.push(remind, kit.para('Reminders come while Grind District is open, also in a background tab.', 'muted'))

  // Place and method.
  const set = el('details', '', 'pt-set')
  set.append(el('summary', 'Change city or method'))
  const citySel = el('select'); citySel.setAttribute('aria-label', 'City')
  const auto = el('option', `Automatic (${cityFor(zone())?.name ?? 'time zone'})`); auto.value = ''; citySel.append(auto)
  for (const c of [...CITIES].sort((a, b) => a.name.localeCompare(b.name))) { const o = el('option', c.name); o.value = c.name; citySel.append(o) }
  const stored = read().place
  if (stored && (stored.src === 'gps' || !CITIES.some((c) => c.name === stored.label))) {
    const o = el('option', stored.src === 'gps' ? 'Your location' : stored.label); o.value = '__here'; citySel.insertBefore(o, auto.nextSibling)
  }
  citySel.value = !stored ? '' : stored.src === 'gps' || !CITIES.some((c) => c.name === stored.label) ? '__here' : stored.label
  citySel.onchange = () => {
    if (citySel.value === '__here') return
    const c = CITIES.find((x) => x.name === citySel.value)
    if (!c) { const s = read(); delete s.place; try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* ignore */ } } else write({ place: { lat: c.lat, lng: c.lng, label: c.name, src: 'city' } })
    opts.rerender()
  }
  const gps = kit.button(p.src === 'gps' ? '📍 Using your location · update' : '📍 Use my location', 'ghost', () => {
    if (!navigator.geolocation) { opts.toast('This device cannot share its location.'); return }
    navigator.geolocation.getCurrentPosition((pos) => {
      // Two decimals (about a kilometre) is plenty for prayer times; it stays on this device.
      write({ place: { lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2), label: 'Your location', src: 'gps' } })
      opts.toast('Prayer times now follow your location.')
      opts.rerender()
    }, () => opts.toast('Location was not shared. Pick your city from the list instead.'), { maximumAge: 6 * 3600e3, timeout: 15000 })
  })
  const methodSel = el('select'); methodSel.setAttribute('aria-label', 'Calculation method')
  for (const [id, m] of Object.entries(METHODS)) { const o = el('option', m.name); o.value = id; methodSel.append(o) }
  methodSel.value = p.method
  methodSel.onchange = () => { write({ method: methodSel.value as Method }); opts.rerender() }
  const asrSel = el('select'); asrSel.setAttribute('aria-label', 'Asr time')
  for (const [id, label] of [['standard', 'Asr: standard (Shafiʿi, Maliki, Hanbali)'], ['hanafi', 'Asr: Hanafi (later)']] as const) { const o = el('option', label); o.value = id; asrSel.append(o) }
  asrSel.value = p.asr
  asrSel.onchange = () => { write({ asr: asrSel.value as AsrRule }); opts.rerender() }
  const grid = el('div', '', 'pt-set-grid')
  grid.append(el('label', 'City'), citySel, gps, el('label', 'Method'), methodSel, asrSel)
  set.append(grid, kit.para('Your place is kept on this device only. Check your local masjid’s timetable: they may add a few minutes of caution.', 'muted'))
  out.push(set)
  return out
}

// ---------------------------------------------------------------- reminders
const fired = (k: string) => { try { return (localStorage.getItem(FIRED) || '').split(',').includes(k) } catch { return false } }
const markFired = (k: string) => { try { const list = (localStorage.getItem(FIRED) || '').split(',').filter(Boolean).slice(-12); list.push(k); localStorage.setItem(FIRED, list.join(',')) } catch { /* ignore */ } }

/** A soft two-note chime (no recording): rises then settles. */
function chime() {
  try {
    const A = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
    const ctx = new A()
    const t0 = ctx.currentTime
    for (const [f, at] of [[587.33, 0], [783.99, 0.28], [659.25, 0.7]] as const) {
      const o = ctx.createOscillator(), g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = f
      g.gain.setValueAtTime(0, t0 + at); g.gain.linearRampToValueAtTime(0.12, t0 + at + 0.04); g.gain.exponentialRampToValueAtTime(0.0008, t0 + at + 1.6)
      o.connect(g).connect(ctx.destination); o.start(t0 + at); o.stop(t0 + at + 1.7)
    }
    window.setTimeout(() => void ctx.close().catch(() => undefined), 3000)
  } catch { /* no audio */ }
}

/** Watch the clock and remind at each prayer (and 30 minutes before Jumu'ah) while reminders are on. */
export function startPrayerReminders(show: (title: string, line: string) => void): void {
  const check = () => {
    const p = prayerPrefs()
    // Wait until the player is in the city (a reminder on the loading screen would be missed).
    if (!p.remind || !performance.getEntriesByName('gd:revealed').length) return
    const now = new Date(), t = timesFor(now)
    const day = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
    const alert = (key: string, title: string, line: string) => {
      if (fired(key)) return
      markFired(key)
      show(title, line)
      if (!document.hidden) chime()
      else if ('Notification' in window && Notification.permission === 'granted') {
        void navigator.serviceWorker?.ready.then((r) => r.showNotification(title, { body: line, icon: '/notify/zahra-icon.png', badge: '/icons/badge-96.png', tag: 'gd-prayer' })).catch(() => undefined)
      }
    }
    if (isFriday(now)) {
      const lead = t.dhuhr.getTime() - now.getTime()
      if (lead > 0 && lead <= 30 * 60e3) alert(`${day}:jumuah`, `Jumuʿah at ${clock(t.dhuhr)}`, 'The Friday prayer is in about half an hour. Time to make wudu and head to the masjid.')
    }
    for (const id of PRAYER_KEYS) {
      const since = now.getTime() - t[id].getTime()
      if (since >= 0 && since < 15 * 60e3) alert(`${day}:${id}`, `It’s time for ${prayerLabel(id, now)}`, `${prayerLabel(id, now)} began at ${clock(t[id])}. The game will be right here when you are back.`)
    }
  }
  window.setTimeout(check, 4000)
  window.setInterval(check, 20e3)
}
