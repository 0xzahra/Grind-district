// Spoken lines for the city's people: Zahra while she onboards you, residents when they talk to you, the server at
// the Grind Ring stand. Uses the phone's own text-to-speech voices (nothing to download). A woman's voice for
// women, a man's for men, each person with their own pitch. Music dips while someone speaks. Settings has a
// Voices switch; it is on unless the player turned it off.
import { duckMusic } from './music.ts'
const PREF = 'gd.voices'
const read = () => { try { return localStorage.getItem(PREF) } catch { return null } }
export const voicesOn = () => read() !== 'off' && typeof speechSynthesis !== 'undefined'
export function setVoices(on: boolean): void { try { localStorage.setItem(PREF, on ? 'on' : 'off') } catch { /* session only */ } if (!on) stopSpeaking() }

let voices: SpeechSynthesisVoice[] = []
const load = () => { try { voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en')) } catch { voices = [] } }
if (typeof speechSynthesis !== 'undefined') { load(); speechSynthesis.addEventListener?.('voiceschanged', load) }

// Names the common phone and desktop voices go by, so a woman never gets a man's voice.
const FEMALE = /female|woman|samantha|karen|moira|tessa|fiona|victoria|zira|hazel|susan|serena|allison|ava|joanna|salli|kimberly|libby|sonia|aria|jenny|natasha|google uk english female|google us english/i
const MALE = /male|man\b|daniel|alex|fred|oliver|arthur|george|david|mark|guy|ryan|thomas|rishi|aaron|google uk english male/i
function pick(gender: 'f' | 'm'): SpeechSynthesisVoice | undefined {
  if (!voices.length) load()
  const want = gender === 'f' ? FEMALE : MALE, avoid = gender === 'f' ? MALE : FEMALE
  const pool = voices.filter((v) => want.test(v.name) && !(gender === 'f' && /\bmale\b/i.test(v.name) && !/female/i.test(v.name)))
  const ordered = [...pool.filter((v) => /en-(gb|ng|za|au)/i.test(v.lang)), ...pool]
  return ordered[0] ?? voices.find((v) => !avoid.test(v.name)) ?? voices[0]
}

const duck = duckMusic

/** Say a line as a person. `seed` gives each person a slightly different pitch and pace. Interrupts the last line. */
export function speak(text: string, who: { gender: 'f' | 'm'; seed?: number } = { gender: 'f' }): void {
  if (!voicesOn() || !text.trim()) return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text.replace(/[·•]/g, ',').replace(/[\u{1F300}-\u{1FAFF}]/gu, ''))
    const v = pick(who.gender)
    if (v) { u.voice = v; u.lang = v.lang }
    const k = ((who.seed ?? 0) * 0.618) % 1
    u.pitch = who.gender === 'f' ? 1.02 + k * 0.18 : 0.82 + k * 0.16
    u.rate = 0.97 + k * 0.08
    u.volume = 1
    u.onstart = () => duck(true)
    u.onend = u.onerror = () => duck(false)
    speechSynthesis.speak(u)
  } catch { /* no speech on this device */ }
}
export function stopSpeaking(): void { try { speechSynthesis.cancel() } catch { /* */ } duck(false) }
