// The five daily prayers (and sunrise) for a date and place, from the sun's position: the standard method used by
// prayer timetables (Fajr and Isha at a set sun depression angle, Asr by shadow length, Maghrib at sunset, Dhuhr just
// after solar noon). Pure maths, no DOM: tests/prayer.check.ts runs it in Node.

export type Method = 'mwl' | 'isna' | 'egypt' | 'makkah' | 'karachi' | 'sea' | 'tehran' | 'turkey'
export type AsrRule = 'standard' | 'hanafi'
export type PrayerName = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'

export const METHODS: Record<Method, { name: string; fajr: number; isha: number | { min: number }; maghrib?: number }> = {
  mwl: { name: 'Muslim World League', fajr: 18, isha: 17 },
  isna: { name: 'ISNA (North America)', fajr: 15, isha: 15 },
  egypt: { name: 'Egyptian General Authority', fajr: 19.5, isha: 17.5 },
  makkah: { name: 'Umm al-Qura, Makkah', fajr: 18.5, isha: { min: 90 } },
  karachi: { name: 'Islamic Sciences, Karachi', fajr: 18, isha: 18 },
  sea: { name: 'Southeast Asia (JAKIM, MUIS, Kemenag)', fajr: 20, isha: 18 },
  tehran: { name: 'Geophysics Institute, Tehran', fajr: 17.7, isha: 14, maghrib: 4.5 },
  turkey: { name: 'Diyanet, Türkiye', fajr: 18, isha: 17 },
}

export const PRAYERS: Array<{ id: PrayerName; name: string; arabic: string }> = [
  { id: 'fajr', name: 'Fajr', arabic: 'الفجر' },
  { id: 'sunrise', name: 'Sunrise', arabic: 'الشروق' },
  { id: 'dhuhr', name: 'Dhuhr', arabic: 'الظهر' },
  { id: 'asr', name: 'Asr', arabic: 'العصر' },
  { id: 'maghrib', name: 'Maghrib', arabic: 'المغرب' },
  { id: 'isha', name: 'Isha', arabic: 'العشاء' },
]

const rad = (d: number) => (d * Math.PI) / 180
const deg = (r: number) => (r * 180) / Math.PI
const fix = (a: number, b: number) => { const v = a - b * Math.floor(a / b); return v < 0 ? v + b : v }
const fixHour = (h: number) => fix(h, 24)

function julian(y: number, m: number, d: number): number {
  if (m <= 2) { y -= 1; m += 12 }
  const A = Math.floor(y / 100), B = 2 - A + Math.floor(A / 4)
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5
}

/** Sun declination (degrees) and equation of time (hours) for a Julian date. */
function sun(jd: number): { decl: number; eqt: number } {
  const D = jd - 2451545.0
  const g = fix(357.529 + 0.98560028 * D, 360)
  const q = fix(280.459 + 0.98564736 * D, 360)
  const L = fix(q + 1.915 * Math.sin(rad(g)) + 0.02 * Math.sin(rad(2 * g)), 360)
  const e = 23.439 - 0.00000036 * D
  const RA = fixHour(deg(Math.atan2(Math.cos(rad(e)) * Math.sin(rad(L)), Math.cos(rad(L)))) / 15)
  return { decl: deg(Math.asin(Math.sin(rad(e)) * Math.sin(rad(L)))), eqt: q / 15 - RA }
}

/**
 * Prayer times for the calendar day of `date` (its year, month and day as the device sees them) at a place, as
 * exact instants (Dates, rounded to the minute). Shown with the device clock they read as local times.
 */
export function prayerTimes(date: Date, lat: number, lng: number, method: Method, asr: AsrRule): Record<PrayerName, Date> {
  const y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate()
  const jd = julian(y, m, d) - lng / (15 * 24)
  const cfg = METHODS[method]
  const midDay = (t: number) => fixHour(12 - sun(jd + t).eqt)
  const angleTime = (angle: number, t: number, ccw: boolean) => {
    const s = sun(jd + t)
    const c = (-Math.sin(rad(angle)) - Math.sin(rad(s.decl)) * Math.sin(rad(lat))) / (Math.cos(rad(s.decl)) * Math.cos(rad(lat)))
    if (c > 1 || c < -1) return NaN
    const T = deg(Math.acos(c)) / 15
    return midDay(t) + (ccw ? -T : T)
  }
  const asrTime = (factor: number, t: number) => {
    const s = sun(jd + t)
    const angle = -deg(Math.atan(1 / (factor + Math.tan(rad(Math.abs(lat - s.decl))))))
    return angleTime(angle, t, false)
  }
  const factor = asr === 'hanafi' ? 2 : 1
  // Two passes: the first from rough guesses, the second from the first pass's answers.
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, maghrib: 18, isha: 18 }
  for (let pass = 0; pass < 2; pass++) {
    const p = (h: number) => (Number.isFinite(h) ? h : 12) / 24
    t = {
      fajr: angleTime(cfg.fajr, p(t.fajr), true),
      sunrise: angleTime(0.833, p(t.sunrise), true),
      dhuhr: midDay(p(t.dhuhr)),
      asr: asrTime(factor, p(t.asr)),
      sunset: angleTime(0.833, p(t.sunset), false),
      maghrib: cfg.maghrib ? angleTime(cfg.maghrib, p(t.maghrib), false) : angleTime(0.833, p(t.maghrib), false),
      isha: typeof cfg.isha === 'number' ? angleTime(cfg.isha, p(t.isha), false) : NaN,
    }
  }
  if (typeof cfg.isha !== 'number') t.isha = t.maghrib + cfg.isha.min / 60
  // Far north or south, the sun may not sink far enough for Fajr or Isha: use the share of the night that the
  // angle stands for (the "angle-based" rule used by most timetables there).
  const night = fixHour(t.sunrise - t.sunset)
  const fajrMax = (cfg.fajr / 60) * night
  if (!Number.isFinite(t.fajr) || fixHour(t.sunrise - t.fajr) > fajrMax) t.fajr = t.sunrise - fajrMax
  if (typeof cfg.isha === 'number') {
    const ishaMax = (cfg.isha / 60) * night
    if (!Number.isFinite(t.isha) || fixHour(t.isha - t.sunset) > ishaMax) t.isha = t.sunset + ishaMax
  }
  // The hours above are mean solar time at the place; minus longitude/15 they are hours after midnight UTC.
  const base = Date.UTC(y, m - 1, d)
  const at = (h: number) => new Date(Math.round((base + (h - lng / 15) * 3600e3) / 60e3) * 60e3)
  return { fajr: at(t.fajr), sunrise: at(t.sunrise), dhuhr: at(t.dhuhr + 1 / 60), asr: at(t.asr), maghrib: at(t.maghrib), isha: at(t.isha) }
}

/** Timetable method most mosques use in a time zone. */
export function methodFor(tz: string): Method {
  if (/^America\//.test(tz)) return 'isna'
  if (/^Asia\/(Riyadh|Aden|Kuwait|Bahrain|Qatar|Dubai|Muscat)$/.test(tz)) return 'makkah'
  if (/^(Africa\/(Cairo|Khartoum|Tripoli)|Asia\/(Beirut|Damascus|Amman|Gaza|Hebron|Jerusalem|Baghdad))$/.test(tz)) return 'egypt'
  if (/^Asia\/(Karachi|Kolkata|Calcutta|Dhaka|Kabul|Kathmandu|Colombo)$/.test(tz)) return 'karachi'
  if (/^Asia\/(Kuala_Lumpur|Kuching|Singapore|Jakarta|Makassar|Jayapura|Pontianak|Brunei)$/.test(tz)) return 'sea'
  if (tz === 'Asia/Tehran') return 'tehran'
  if (tz === 'Europe/Istanbul') return 'turkey'
  return 'mwl'
}

/** Hanafi Asr (later) is the custom in South and Central Asia; elsewhere the standard Asr. */
export function asrFor(tz: string): AsrRule {
  return /^Asia\/(Karachi|Kolkata|Calcutta|Dhaka|Kabul|Tashkent|Dushanbe)$/.test(tz) ? 'hanafi' : 'standard'
}

export type City = { name: string; tz: string; lat: number; lng: number }
export const CITIES: City[] = [
  { name: 'Lagos', tz: 'Africa/Lagos', lat: 6.52, lng: 3.38 },
  { name: 'Abuja', tz: 'Africa/Lagos', lat: 9.06, lng: 7.49 },
  { name: 'Kano', tz: 'Africa/Lagos', lat: 12.0, lng: 8.52 },
  { name: 'Accra', tz: 'Africa/Accra', lat: 5.6, lng: -0.19 },
  { name: 'Dakar', tz: 'Africa/Dakar', lat: 14.72, lng: -17.47 },
  { name: 'Abidjan', tz: 'Africa/Abidjan', lat: 5.36, lng: -4.01 },
  { name: 'Niamey', tz: 'Africa/Niamey', lat: 13.51, lng: 2.11 },
  { name: 'Cairo', tz: 'Africa/Cairo', lat: 30.04, lng: 31.24 },
  { name: 'Khartoum', tz: 'Africa/Khartoum', lat: 15.5, lng: 32.56 },
  { name: 'Addis Ababa', tz: 'Africa/Addis_Ababa', lat: 9.03, lng: 38.74 },
  { name: 'Nairobi', tz: 'Africa/Nairobi', lat: -1.29, lng: 36.82 },
  { name: 'Mombasa', tz: 'Africa/Nairobi', lat: -4.04, lng: 39.67 },
  { name: 'Dar es Salaam', tz: 'Africa/Dar_es_Salaam', lat: -6.79, lng: 39.21 },
  { name: 'Mogadishu', tz: 'Africa/Mogadishu', lat: 2.05, lng: 45.32 },
  { name: 'Casablanca', tz: 'Africa/Casablanca', lat: 33.57, lng: -7.59 },
  { name: 'Algiers', tz: 'Africa/Algiers', lat: 36.75, lng: 3.06 },
  { name: 'Tunis', tz: 'Africa/Tunis', lat: 36.81, lng: 10.18 },
  { name: 'Tripoli', tz: 'Africa/Tripoli', lat: 32.89, lng: 13.19 },
  { name: 'Johannesburg', tz: 'Africa/Johannesburg', lat: -26.2, lng: 28.05 },
  { name: 'Cape Town', tz: 'Africa/Johannesburg', lat: -33.92, lng: 18.42 },
  { name: 'Makkah', tz: 'Asia/Riyadh', lat: 21.42, lng: 39.83 },
  { name: 'Madinah', tz: 'Asia/Riyadh', lat: 24.47, lng: 39.61 },
  { name: 'Riyadh', tz: 'Asia/Riyadh', lat: 24.71, lng: 46.68 },
  { name: 'Jeddah', tz: 'Asia/Riyadh', lat: 21.49, lng: 39.19 },
  { name: 'Dubai', tz: 'Asia/Dubai', lat: 25.2, lng: 55.27 },
  { name: 'Abu Dhabi', tz: 'Asia/Dubai', lat: 24.45, lng: 54.38 },
  { name: 'Doha', tz: 'Asia/Qatar', lat: 25.29, lng: 51.53 },
  { name: 'Kuwait City', tz: 'Asia/Kuwait', lat: 29.38, lng: 47.99 },
  { name: 'Manama', tz: 'Asia/Bahrain', lat: 26.23, lng: 50.59 },
  { name: 'Muscat', tz: 'Asia/Muscat', lat: 23.59, lng: 58.41 },
  { name: 'Sanaa', tz: 'Asia/Aden', lat: 15.37, lng: 44.19 },
  { name: 'Al-Quds (Jerusalem)', tz: 'Asia/Jerusalem', lat: 31.78, lng: 35.23 },
  { name: 'Gaza', tz: 'Asia/Gaza', lat: 31.5, lng: 34.47 },
  { name: 'Hebron (Al-Khalil)', tz: 'Asia/Hebron', lat: 31.53, lng: 35.1 },
  { name: 'Amman', tz: 'Asia/Amman', lat: 31.95, lng: 35.93 },
  { name: 'Beirut', tz: 'Asia/Beirut', lat: 33.89, lng: 35.5 },
  { name: 'Damascus', tz: 'Asia/Damascus', lat: 33.51, lng: 36.29 },
  { name: 'Baghdad', tz: 'Asia/Baghdad', lat: 33.31, lng: 44.36 },
  { name: 'Tehran', tz: 'Asia/Tehran', lat: 35.69, lng: 51.39 },
  { name: 'Istanbul', tz: 'Europe/Istanbul', lat: 41.01, lng: 28.98 },
  { name: 'Ankara', tz: 'Europe/Istanbul', lat: 39.93, lng: 32.86 },
  { name: 'Karachi', tz: 'Asia/Karachi', lat: 24.86, lng: 67.01 },
  { name: 'Lahore', tz: 'Asia/Karachi', lat: 31.55, lng: 74.34 },
  { name: 'Islamabad', tz: 'Asia/Karachi', lat: 33.68, lng: 73.05 },
  { name: 'Delhi', tz: 'Asia/Kolkata', lat: 28.61, lng: 77.21 },
  { name: 'Mumbai', tz: 'Asia/Kolkata', lat: 19.08, lng: 72.88 },
  { name: 'Hyderabad', tz: 'Asia/Kolkata', lat: 17.39, lng: 78.49 },
  { name: 'Kolkata', tz: 'Asia/Kolkata', lat: 22.57, lng: 88.36 },
  { name: 'Dhaka', tz: 'Asia/Dhaka', lat: 23.81, lng: 90.41 },
  { name: 'Kabul', tz: 'Asia/Kabul', lat: 34.56, lng: 69.21 },
  { name: 'Tashkent', tz: 'Asia/Tashkent', lat: 41.3, lng: 69.24 },
  { name: 'Almaty', tz: 'Asia/Almaty', lat: 43.24, lng: 76.89 },
  { name: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur', lat: 3.14, lng: 101.69 },
  { name: 'Singapore', tz: 'Asia/Singapore', lat: 1.35, lng: 103.82 },
  { name: 'Jakarta', tz: 'Asia/Jakarta', lat: -6.21, lng: 106.85 },
  { name: 'Manila', tz: 'Asia/Manila', lat: 14.6, lng: 120.98 },
  { name: 'Beijing', tz: 'Asia/Shanghai', lat: 39.9, lng: 116.4 },
  { name: 'Tokyo', tz: 'Asia/Tokyo', lat: 35.68, lng: 139.69 },
  { name: 'Seoul', tz: 'Asia/Seoul', lat: 37.57, lng: 126.98 },
  { name: 'London', tz: 'Europe/London', lat: 51.51, lng: -0.13 },
  { name: 'Birmingham', tz: 'Europe/London', lat: 52.49, lng: -1.89 },
  { name: 'Paris', tz: 'Europe/Paris', lat: 48.86, lng: 2.35 },
  { name: 'Berlin', tz: 'Europe/Berlin', lat: 52.52, lng: 13.4 },
  { name: 'Amsterdam', tz: 'Europe/Amsterdam', lat: 52.37, lng: 4.9 },
  { name: 'Brussels', tz: 'Europe/Brussels', lat: 50.85, lng: 4.35 },
  { name: 'Madrid', tz: 'Europe/Madrid', lat: 40.42, lng: -3.7 },
  { name: 'Rome', tz: 'Europe/Rome', lat: 41.9, lng: 12.5 },
  { name: 'Stockholm', tz: 'Europe/Stockholm', lat: 59.33, lng: 18.07 },
  { name: 'Moscow', tz: 'Europe/Moscow', lat: 55.76, lng: 37.62 },
  { name: 'Kazan', tz: 'Europe/Moscow', lat: 55.8, lng: 49.11 },
  { name: 'New York', tz: 'America/New_York', lat: 40.71, lng: -74.01 },
  { name: 'Washington', tz: 'America/New_York', lat: 38.9, lng: -77.04 },
  { name: 'Chicago', tz: 'America/Chicago', lat: 41.88, lng: -87.63 },
  { name: 'Houston', tz: 'America/Chicago', lat: 29.76, lng: -95.37 },
  { name: 'Dearborn', tz: 'America/Detroit', lat: 42.32, lng: -83.18 },
  { name: 'Denver', tz: 'America/Denver', lat: 39.74, lng: -104.99 },
  { name: 'Los Angeles', tz: 'America/Los_Angeles', lat: 34.05, lng: -118.24 },
  { name: 'Toronto', tz: 'America/Toronto', lat: 43.65, lng: -79.38 },
  { name: 'Mexico City', tz: 'America/Mexico_City', lat: 19.43, lng: -99.13 },
  { name: 'São Paulo', tz: 'America/Sao_Paulo', lat: -23.55, lng: -46.63 },
  { name: 'Sydney', tz: 'Australia/Sydney', lat: -33.87, lng: 151.21 },
  { name: 'Melbourne', tz: 'Australia/Melbourne', lat: -37.81, lng: 144.96 },
  { name: 'Perth', tz: 'Australia/Perth', lat: -31.95, lng: 115.86 },
  { name: 'Auckland', tz: 'Pacific/Auckland', lat: -36.85, lng: 174.76 },
]

/** The city to start from for a device time zone (the first city listed in that zone), or null. */
export function cityFor(tz: string): City | null {
  const alias: Record<string, string> = { 'Asia/Calcutta': 'Asia/Kolkata', 'Europe/Kiev': 'Europe/Moscow', 'America/Detroit': 'America/Detroit' }
  const z = alias[tz] ?? tz
  return CITIES.find((c) => c.tz === z) ?? null
}
