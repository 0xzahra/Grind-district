// Spoken lines for the city's people: Zahra while she onboards you, residents when they talk to you, the server at
// the Grind Ring stand. Uses the phone's own text-to-speech voices (nothing to download). A woman's voice for
// women, a man's for men, each person with their own pitch. Music dips while someone speaks. Settings has a
// Voices switch; it is on unless the player turned it off.
import { duckMusic } from './music.ts'
import { ZAHRA_CLIPS } from './zahraVoice.ts'
import { isEnglish, speechLang, untranslated, isTranslation } from './i18n.ts'
const PREF = 'gd.voices'
const read = () => { try { return localStorage.getItem(PREF) } catch { return null } }
export const voicesOn = () => read() !== 'off' && typeof speechSynthesis !== 'undefined'
const clipsOn = () => read() !== 'off'
// Zahra's lines are recorded with a neural voice (scripts/gen-zahra-voice.py); the key is the same hash of the
// normalised line. A line without a clip uses the device's voice.
const norm = (t: string) => t.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...').split(/\s+/).filter(Boolean).join(' ').trim().toLowerCase()
export function clipKey(t: string): string { let h = 0x811c9dc5; for (const ch of norm(t)) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0 } return h.toString(16).padStart(8, '0') }
let clip: HTMLAudioElement | null = null
/** Tells the cards who is talking, so Zahra's face can show she is speaking. */
const talking = (who: string, on: boolean) => window.dispatchEvent(new CustomEvent('gd:voice', { detail: { who, on } }))
export function setVoices(on: boolean): void { try { localStorage.setItem(PREF, on ? 'on' : 'off') } catch { /* session only */ } if (!on) stopSpeaking() }

let voices: SpeechSynthesisVoice[] = []
let all: SpeechSynthesisVoice[] = []
const load = () => { try { all = speechSynthesis.getVoices(); voices = all.filter((v) => v.lang.toLowerCase().startsWith('en')) } catch { all = []; voices = [] } }
if (typeof speechSynthesis !== 'undefined') { load(); speechSynthesis.addEventListener?.('voiceschanged', load) }

// Names the common phone and desktop voices go by, so a woman never gets a man's voice.
const FEMALE = /female|woman|samantha|karen|moira|tessa|fiona|victoria|zira|hazel|susan|serena|allison|ava|joanna|salli|kimberly|libby|sonia|aria|jenny|natasha|google uk english female|google us english/i
const MALE = /male|man\b|daniel|alex|fred|oliver|arthur|george|david|mark|guy|ryan|thomas|rishi|aaron|google uk english male/i
function pick(gender: 'f' | 'm', want2 = 'en'): SpeechSynthesisVoice | undefined {
  if (!all.length) load()
  if (want2 !== 'en') {
    // Another language: that language's voices first (woman's or man's by name where the name says so).
    const own = all.filter((v) => v.lang.toLowerCase().startsWith(want2))
    const avoid2 = gender === 'f' ? MALE : FEMALE
    return own.find((v) => (gender === 'f' ? FEMALE : MALE).test(v.name)) ?? own.find((v) => !avoid2.test(v.name)) ?? own[0]
  }
  const want = gender === 'f' ? FEMALE : MALE, avoid = gender === 'f' ? MALE : FEMALE
  const pool = voices.filter((v) => want.test(v.name) && !(gender === 'f' && /\bmale\b/i.test(v.name) && !/female/i.test(v.name)))
  const ordered = [...pool.filter((v) => /en-(gb|ng|za|au)/i.test(v.lang)), ...pool]
  return ordered[0] ?? voices.find((v) => !avoid.test(v.name)) ?? voices[0]
}

const duck = duckMusic

/** Say a line as a person. `seed` gives each person a slightly different pitch and pace. Interrupts the last line. */
export function speak(text: string, who: { gender: 'f' | 'm'; seed?: number; voice?: 'zahra' } = { gender: 'f' }): void {
  if (!clipsOn() || !text.trim()) return
  const name = who.voice ?? 'person'
  // In another language a UI line is spoken once its translation is on screen; other lines stay English.
  if (!isEnglish() && untranslated(text)) return
  if (who.voice === 'zahra' && ZAHRA_CLIPS.has(clipKey(text))) {
    stopSpeaking()
    const a = new Audio(`/assets/voice/zahra/${clipKey(text)}.mp3`)
    clip = a
    a.onplay = () => { duck(true); talking(name, true) }
    a.onended = a.onerror = a.onpause = () => { if (clip === a) clip = null; duck(false); talking(name, false) }
    void a.play().catch(() => { duck(false); talking(name, false) })
    return
  }
  if (!voicesOn()) return
  const want2 = !isEnglish() && isTranslation(text) ? speechLang().slice(0, 2).toLowerCase() : 'en'
  try {
    stopSpeaking()
    const u = new SpeechSynthesisUtterance(text.replace(/[·•]/g, ',').replace(/[\u{1F300}-\u{1FAFF}]/gu, ''))
    const v = pick(who.gender, want2)
    if (v) { u.voice = v; u.lang = v.lang } else if (want2 !== 'en') u.lang = speechLang()
    const k = ((who.seed ?? 0) * 0.618) % 1
    u.pitch = who.gender === 'f' ? 1.02 + k * 0.18 : 0.82 + k * 0.16
    u.rate = 0.97 + k * 0.08
    u.volume = 1
    u.onstart = () => { duck(true); talking(name, true) }
    u.onend = u.onerror = () => { duck(false); talking(name, false) }
    speechSynthesis.speak(u)
  } catch { /* no speech on this device */ }
}
export function stopSpeaking(): void { try { speechSynthesis.cancel() } catch { /* */ } if (clip) { const c = clip; clip = null; c.pause() } duck(false) }
