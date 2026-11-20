// Prayer times: sane order, Dhuhr at solar noon, and known timetables within a few minutes.
import { prayerTimes, methodFor, asrFor, cityFor } from '../src/prayerCalc.ts'

let pass = 0, fail = 0
const ok = (c: boolean, msg: string) => { if (c) pass++; else { fail++; console.log('FAIL', msg) } }
// Clock time (hh:mm) of a Date in a fixed UTC offset, independent of the machine's own zone.
const clock = (d: Date, tz: number) => { const m = Math.round((d.getTime() / 60e3 + tz * 60) % 1440 + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}` }
const mins = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3)
const near = (got: string, want: string, tol: number, msg: string) => ok(Math.abs(mins(got) - mins(want)) <= tol, `${msg}: got ${got}, want ${want} ±${tol}`)

// Machine-independent day: build the date at local noon, pass the zone explicitly.
const day = new Date(2026, 10, 20, 12)
const cases = [
  // Lagos, MWL. Solar noon ~12:32 WAT in late November.
  { name: 'Lagos', lat: 6.52, lng: 3.38, tz: 1, m: 'mwl' as const, a: 'standard' as const, dhuhr: '12:33', maghrib: '18:24', fajr: '05:27' },
  // Makkah, Umm al-Qura: Isha 90 min after Maghrib.
  { name: 'Makkah', lat: 21.42, lng: 39.83, tz: 3, m: 'makkah' as const, a: 'standard' as const, dhuhr: '12:07', maghrib: '17:39', fajr: '05:15' },
  // London, MWL, winter.
  { name: 'London', lat: 51.51, lng: -0.13, tz: 0, m: 'mwl' as const, a: 'standard' as const, dhuhr: '11:47', maghrib: '16:04', fajr: '05:33' },
]
for (const c of cases) {
  const t = prayerTimes(day, c.lat, c.lng, c.m, c.a)
  const order = [t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha].map((d) => d.getTime())
  ok(order.every((v, i) => i === 0 || v > order[i - 1]!), `${c.name}: times in order ${order.map((v) => clock(new Date(v), c.tz)).join(' ')}`)
  near(clock(t.dhuhr, c.tz), c.dhuhr, 4, `${c.name} Dhuhr`)
  near(clock(t.maghrib, c.tz), c.maghrib, 6, `${c.name} Maghrib`)
  near(clock(t.fajr, c.tz), c.fajr, 10, `${c.name} Fajr`)
  if (c.m === 'makkah') ok(Math.round((t.isha.getTime() - t.maghrib.getTime()) / 60e3) === 90, 'Makkah Isha is Maghrib + 90 min')
  const h = prayerTimes(day, c.lat, c.lng, c.m, 'hanafi')
  ok(h.asr.getTime() > t.asr.getTime(), `${c.name}: Hanafi Asr is later`)
}
// Far north in summer: Fajr and Isha still come out as real times.
const north = prayerTimes(new Date(2026, 5, 21, 12), 59.33, 18.07, 'mwl', 'standard')
ok([north.fajr, north.isha].every((d) => Number.isFinite(d.getTime())), 'Stockholm midsummer Fajr/Isha are finite')
ok(methodFor('America/Chicago') === 'isna' && methodFor('Asia/Riyadh') === 'makkah' && methodFor('Africa/Lagos') === 'mwl' && methodFor('Asia/Gaza') === 'egypt', 'methods by time zone')
ok(asrFor('Asia/Karachi') === 'hanafi' && asrFor('Africa/Lagos') === 'standard', 'Asr rule by time zone')
ok(cityFor('Africa/Lagos')?.name === 'Lagos' && cityFor('Asia/Calcutta')?.name === 'Delhi' && cityFor('Mars/Base') === null, 'starting city by time zone')
console.log(`prayer: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
