// Birthdays, zodiac readings and holidays.
// - Birthday (month and day only, no year) is kept on this device beside the save slot, not inside the save.
//   The day before, a reminder; on the day, the city celebrates (confetti, a greeting) and gives a $25 in-game
//   gift once a year.
// - Zodiac sign from the birthday with a short daily reading, for fun.
// - Holidays: US federal holidays except the Christian one (Christmas), and Islamic days from the Umm al-Qura
//   Hijri calendar (the device's own calendar data; local moon sighting can move a day by one).
import { earnCash, getSave, slotKey } from './state.ts'
import { addStrings, t } from './i18n.ts'

type MD = { m: number; d: number }
const BDAY = () => `${slotKey()}.birthday`
const read = (k: string) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* session only */ } }
export function getBirthday(): MD | null {
  const m = /^(\d{2})-(\d{2})$/.exec(read(BDAY()) ?? '')
  return m ? { m: Number(m[1]), d: Number(m[2]) } : null
}
export function setBirthday(b: MD | null): void {
  if (!b) { try { localStorage.removeItem(BDAY()) } catch { /* */ } return }
  write(BDAY(), `${String(b.m).padStart(2, '0')}-${String(b.d).padStart(2, '0')}`)
}

// ---------- Zodiac ----------
const SIGNS = [
  { name: 'Capricorn', sym: '♑', from: [12, 22], trait: 'Patient and practical: you build things that last.' },
  { name: 'Aquarius', sym: '♒', from: [1, 20], trait: 'Original and community-minded: you see what others miss.' },
  { name: 'Pisces', sym: '♓', from: [2, 19], trait: 'Kind and imaginative: you learn by feeling it out.' },
  { name: 'Aries', sym: '♈', from: [3, 21], trait: 'Bold and quick to start: first through the door.' },
  { name: 'Taurus', sym: '♉', from: [4, 20], trait: 'Steady and loyal: you hold through the noise.' },
  { name: 'Gemini', sym: '♊', from: [5, 21], trait: 'Curious and quick: you learn two things at once.' },
  { name: 'Cancer', sym: '♋', from: [6, 21], trait: 'Caring and protective: you look after your people.' },
  { name: 'Leo', sym: '♌', from: [7, 23], trait: 'Warm and confident: the room lights up when you speak.' },
  { name: 'Virgo', sym: '♍', from: [8, 23], trait: 'Careful and exact: you read the small print.' },
  { name: 'Libra', sym: '♎', from: [9, 23], trait: 'Fair and social: you bring people together.' },
  { name: 'Scorpio', sym: '♏', from: [10, 23], trait: 'Focused and deep: you see through a scam.' },
  { name: 'Sagittarius', sym: '♐', from: [11, 22], trait: 'Free and adventurous: you love a new path.' },
] as const
export function zodiac(b: MD): (typeof SIGNS)[number] {
  // The last sign whose start is on or before the date (Capricorn wraps the year).
  let hit: (typeof SIGNS)[number] = SIGNS[0]
  for (const s of SIGNS.slice(1)) if (b.m > s.from[0] || (b.m === s.from[0] && b.d >= s.from[1])) hit = s
  if (b.m === 12 && b.d >= 22) hit = SIGNS[0]
  return hit
}
const READINGS = [
  'A good day to finish one lesson you started.',
  'Check the address twice before you send anything.',
  'Someone in the plaza could use a hello. Greet them.',
  'Patience pays. Skip the impulsive trade today.',
  'Write down one thing you learned and share it.',
  'Your streak loves consistency. Show up, even for five minutes.',
  'A message to a friend could open a door.',
  'Visit a building you have not tried yet. Curiosity is your edge.',
  'Review your books: assets in, liabilities out.',
  'Rest is part of the grind. Take a seat at the café.',
  'Your CV grows one pass at a time.',
  'Trust, but verify. Read before you sign.',
  'Help a newcomer today; teaching is learning twice.',
  'Small, steady steps beat one big leap.',
]
export function readingFor(signIndex: number, day = new Date()): string {
  const start = new Date(day.getFullYear(), 0, 0)
  const doy = Math.floor((day.getTime() - start.getTime()) / 86_400_000)
  return READINGS[(doy * 7 + signIndex * 3) % READINGS.length]!
}

// ---------- Holidays ----------
export type Holiday = { name: string; kind: 'us' | 'islam'; emoji: string; greet: string }
const nthWeekday = (y: number, month: number, weekday: number, n: number) => { const d = new Date(y, month - 1, 1); const shift = (weekday - d.getDay() + 7) % 7; return 1 + shift + (n - 1) * 7 }
const lastWeekday = (y: number, month: number, weekday: number) => { const d = new Date(y, month, 0); return d.getDate() - ((d.getDay() - weekday + 7) % 7) }
function usHolidays(d: Date): Holiday[] {
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate()
  const out: Holiday[] = []
  const add = (name: string, emoji: string, greet: string) => out.push({ name, kind: 'us', emoji, greet })
  if (m === 1 && day === 1) add("New Year's Day", '🎉', 'Happy New Year!')
  if (m === 1 && day === nthWeekday(y, 1, 1, 3)) add('Martin Luther King Jr. Day', '✊🏾', 'Honouring Dr. King today.')
  if (m === 2 && day === nthWeekday(y, 2, 1, 3)) add("Presidents' Day", '🇺🇸', "Happy Presidents' Day!")
  if (m === 5 && day === lastWeekday(y, 5, 1)) add('Memorial Day', '🇺🇸', 'Remembering those who served.')
  if (m === 6 && day === 19) add('Juneteenth', '✊🏾', 'Happy Juneteenth!')
  if (m === 7 && day === 4) add('Independence Day', '🎆', 'Happy Fourth of July!')
  if (m === 9 && day === nthWeekday(y, 9, 1, 1)) add('Labor Day', '🛠️', 'Happy Labor Day!')
  if (m === 10 && day === nthWeekday(y, 10, 1, 2)) add("Indigenous Peoples' Day / Columbus Day", '🌎', 'A day to learn the history of the land.')
  if (m === 11 && day === 11) add('Veterans Day', '🎖️', 'Thank you to all who served.')
  if (m === 11 && day === nthWeekday(y, 11, 4, 4)) add('Thanksgiving', '🦃', 'Happy Thanksgiving!')
  return out
}
let hijriFmt: Intl.DateTimeFormat | null | undefined
function hijri(d: Date): { m: number; d: number } | null {
  if (hijriFmt === undefined) { try { hijriFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric' }) } catch { hijriFmt = null } }
  if (!hijriFmt) return null
  try { const p = hijriFmt.formatToParts(d); const g = (k: string) => Number(p.find((x) => x.type === k)?.value); const m = g('month'), dd = g('day'); return m && dd ? { m, d: dd } : null } catch { return null }
}
const ISLAMIC: Array<{ m: number; d: number; name: string; emoji: string; greet: string }> = [
  { m: 1, d: 1, name: 'Islamic New Year', emoji: '🌙', greet: 'Happy Hijri New Year!' },
  { m: 1, d: 10, name: 'Ashura', emoji: '🌙', greet: 'A blessed Ashura to all who observe it.' },
  { m: 3, d: 12, name: 'Mawlid an-Nabi', emoji: '🌙', greet: 'Mawlid an-Nabi, observed by many Muslims today.' },
  { m: 7, d: 27, name: "Isra and Mi'raj", emoji: '✨', greet: "A blessed Isra and Mi'raj." },
  { m: 9, d: 1, name: 'Ramadan begins', emoji: '🌙', greet: 'Ramadan Mubarak!' },
  { m: 9, d: 27, name: 'Laylat al-Qadr', emoji: '✨', greet: 'Laylat al-Qadr: a night of prayer for many.' },
  { m: 10, d: 1, name: 'Eid al-Fitr', emoji: '🌙', greet: 'Eid Mubarak!' },
  { m: 12, d: 9, name: 'Day of Arafah', emoji: '🕋', greet: 'A blessed Day of Arafah.' },
  { m: 12, d: 10, name: 'Eid al-Adha', emoji: '🌙', greet: 'Eid al-Adha Mubarak!' },
]
export function holidaysOn(d: Date): Holiday[] {
  const out = usHolidays(d)
  const h = hijri(d)
  if (h) for (const e of ISLAMIC) if (e.m === h.m && e.d === h.d) out.push({ name: e.name, kind: 'islam', emoji: e.emoji, greet: e.greet })
  return out
}
export function upcoming(days = 120, from = new Date()): Array<{ date: Date; h: Holiday }> {
  const out: Array<{ date: Date; h: Holiday }> = []
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  for (let i = 0; i <= days; i++) { for (const h of holidaysOn(d)) out.push({ date: new Date(d), h }); d.setDate(d.getDate() + 1) }
  return out
}

// ---------- Celebrations ----------
/** A short burst of confetti over the city (no canvas work after it ends). */
export function confetti(symbols = ['🎉', '🎊', '✨']): void {
  if (matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const box = document.createElement('div')
  box.className = 'confetti'
  box.setAttribute('aria-hidden', 'true')
  const colors = ['#1af38f', '#f2c14e', '#ff7a90', '#7ab8ff', '#ffffff']
  for (let i = 0; i < 70; i++) {
    const p = document.createElement('i')
    const emoji = i % 7 === 0
    if (emoji) p.textContent = symbols[i % symbols.length]!
    else p.style.background = colors[i % colors.length]!
    p.className = emoji ? 'emoji' : ''
    p.style.left = `${Math.random() * 100}%`
    p.style.animationDelay = `${Math.random() * 0.9}s`
    p.style.animationDuration = `${2.6 + Math.random() * 1.8}s`
    p.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`)
    p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`)
    box.append(p)
  }
  document.body.append(box)
  window.setTimeout(() => box.remove(), 5200)
}
const today = () => new Date().toLocaleDateString('en-CA')
/** Run once when the player enters the city: birthday and holiday greetings (each once a day). */
export function celebrateToday(toast: (m: string) => void, note?: (title: string, body: string, key: string) => void): void {
  const now = new Date()
  const b = getBirthday()
  const name = getSave().name || 'friend'
  const once = (k: string) => { const key = `${slotKey()}.cal.${k}`; if (read(key) === today()) return false; write(key, today()); return true }
  if (b && b.m === now.getMonth() + 1 && b.d === now.getDate() && once('bday')) {
    confetti(['🎂', '🎉', '🎈'])
    toast(`${t('Happy birthday')}, ${name}! 🎂 The whole district is celebrating you today.`)
    const giftKey = `${slotKey()}.cal.gift`
    if (read(giftKey) !== String(now.getFullYear())) { write(giftKey, String(now.getFullYear())); earnCash(25, 'Birthday gift', 'A gift from the city on your birthday (once a year).') }
    note?.('Happy birthday! 🎂', `Have a great day, ${name}. Your $25 birthday gift is in your balance.`, `bday:${now.getFullYear()}`)
  } else if (b) {
    const tmr = new Date(now); tmr.setDate(now.getDate() + 1)
    if (b.m === tmr.getMonth() + 1 && b.d === tmr.getDate() && once('bday-eve')) {
      toast('Tomorrow is your birthday! 🎂 Come back for a surprise.')
      note?.('Birthday tomorrow 🎂', 'The city has something for you tomorrow.', `bday-eve:${now.getFullYear()}`)
    }
  }
  const hs = holidaysOn(now)
  if (hs.length && once('holiday')) {
    const h = hs[0]!
    window.setTimeout(() => {
      confetti([h.emoji, '✨'])
      toast(`${h.emoji} ${h.greet}`)
    }, b ? 6000 : 0)
    for (const x of hs) note?.(`${x.emoji} ${x.name}`, x.greet, `hol:${x.name}:${now.getFullYear()}`)
  }
}

// ---------- Profile card ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
export function renderCalendar(): HTMLElement {
  const box = document.createElement('div'); box.className = 'cal-card'
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n }
  const paint = () => {
    box.replaceChildren()
    const b = getBirthday()
    // Birthday: month and day (no year is stored).
    const row = el('div', 'cal-bday')
    const mSel = el('select') as HTMLSelectElement; mSel.setAttribute('aria-label', 'Birth month')
    const dSel = el('select') as HTMLSelectElement; dSel.setAttribute('aria-label', 'Birth day')
    mSel.append(new Option('Month', ''), ...MONTHS.map((m, i) => new Option(m, String(i + 1))))
    const days = () => { const n = new Date(2024, Number(mSel.value || 1), 0).getDate(); const keep = dSel.value; dSel.replaceChildren(new Option('Day', ''), ...Array.from({ length: n }, (_, i) => new Option(String(i + 1), String(i + 1)))); if (Number(keep) <= n) dSel.value = keep }
    mSel.value = b ? String(b.m) : ''; days(); dSel.value = b ? String(b.d) : ''
    mSel.onchange = days
    const save = el('button', 'primary', b ? 'Update' : 'Save birthday') as HTMLButtonElement; save.type = 'button'
    save.onclick = () => { const m = Number(mSel.value), d = Number(dSel.value); if (!m || !d) return; setBirthday({ m, d }); paint() }
    row.append(mSel, dSel, save)
    box.append(el('p', 'cal-label', b ? `🎂 ${t('Birthday')}: ${b.d} ${MONTHS[b.m - 1]}` : `🎂 ${t('Add your birthday')} (month and day only)`), row)
    if (b) {
      const z = zodiac(b), idx = SIGNS.indexOf(z)
      const now = new Date(); let next = new Date(now.getFullYear(), b.m - 1, b.d)
      if (next < new Date(now.getFullYear(), now.getMonth(), now.getDate())) next = new Date(now.getFullYear() + 1, b.m - 1, b.d)
      const daysTo = Math.round((next.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86_400_000)
      box.append(el('p', 'cal-count', daysTo === 0 ? 'Today is your birthday! 🎉' : `${daysTo} day${daysTo === 1 ? '' : 's'} to your birthday`))
      const zc = el('div', 'cal-zodiac')
      zc.append(el('span', 'cal-sym', z.sym), (() => { const w = el('div'); w.append(el('strong', '', z.name), el('small', '', z.trait), el('p', 'cal-read', `${t("Today's reading")}: ${readingFor(idx)}`), el('small', 'cal-fun', 'For fun only.')); return w })())
      box.append(zc)
    }
    // Next holidays (US federal holidays except Christmas, and Islamic days).
    box.append(el('p', 'cal-label', `📅 ${t('Coming up')}`))
    const list = el('ul', 'cal-list')
    for (const { date, h } of upcoming(150).slice(0, 6)) { const li = el('li'); li.append(el('span', 'cal-e', h.emoji), el('b', '', h.name), el('time', '', fmt(date))); list.append(li) }
    if (!list.childElementCount) list.append(el('li', '', 'No holidays in the next months.'))
    box.append(list, el('small', 'cal-fun', 'Islamic dates follow the Umm al-Qura calendar and can differ by a day where you live.'))
  }
  paint()
  return box
}

addStrings([
  ['Birthday', 'عيد الميلاد', '生日', 'Cumpleaños', 'Ranar haihuwa', 'Siku ya kuzaliwa', '誕生日', '생일', 'Doğum günü', 'Anniversaire', 'Aniversário', 'जन्मदिन', 'Ọjọ́ ìbí'],
  ['Birthday and calendar', 'عيد الميلاد والتقويم', '生日与日历', 'Cumpleaños y calendario', 'Ranar haihuwa da kalanda', 'Siku ya kuzaliwa na kalenda', '誕生日とカレンダー', '생일과 달력', 'Doğum günü ve takvim', 'Anniversaire et calendrier', 'Aniversário e calendário', 'जन्मदिन और कैलेंडर', 'Ọjọ́ ìbí àti kàlẹ́ńdà'],
  ['Add your birthday', 'أضف عيد ميلادك', '添加你的生日', 'Añade tu cumpleaños', 'Saka ranar haihuwarka', 'Ongeza siku yako ya kuzaliwa', '誕生日を追加', '생일 추가', 'Doğum gününü ekle', 'Ajoute ton anniversaire', 'Adicione seu aniversário', 'अपना जन्मदिन जोड़ें', 'Fi ọjọ́ ìbí rẹ kún un'],
  ['Save birthday', 'حفظ عيد الميلاد', '保存生日', 'Guardar cumpleaños', 'Ajiye ranar haihuwa', 'Hifadhi siku ya kuzaliwa', '誕生日を保存', '생일 저장', 'Doğum gününü kaydet', "Enregistrer l'anniversaire", 'Salvar aniversário', 'जन्मदिन सहेजें', 'Fi ọjọ́ ìbí pamọ́'],
  ['Happy birthday', 'عيد ميلاد سعيد', '生日快乐', 'Feliz cumpleaños', 'Barka da ranar haihuwa', 'Heri ya siku ya kuzaliwa', '誕生日おめでとう', '생일 축하해요', 'İyi ki doğdun', 'Joyeux anniversaire', 'Feliz aniversário', 'जन्मदिन मुबारक', 'Ẹ kú ọjọ́ ìbí'],
  ["Today's reading", 'قراءة اليوم', '今日运势', 'Lectura de hoy', 'Karatun yau', 'Utabiri wa leo', '今日の運勢', '오늘의 운세', 'Bugünün yorumu', 'Lecture du jour', 'Leitura de hoje', 'आज का राशिफल', 'Àsọtẹ́lẹ̀ òní'],
  ['Coming up', 'قريبًا', '即将到来', 'Próximamente', 'Masu zuwa', 'Zinazokuja', '近日', '다가오는 날', 'Yaklaşanlar', 'À venir', 'Em breve', 'आने वाले', 'Ń bọ̀'],
  ['Update', 'تحديث', '更新', 'Actualizar', 'Sabunta', 'Sasisha', '更新', '업데이트', 'Güncelle', 'Mettre à jour', 'Atualizar', 'अपडेट करें', 'Ṣe àtúnṣe'],
])
