// Free Will (paid in-game upgrade). Bought once with in-game balance (players can add to it with the
// existing 5 USDC top-up; nothing here touches top-up, payments or withdrawals).
//  - City residents get daily routines, moods, and talk to you when you walk up to them.
//  - Your character keeps working and studying while you are offline: on return, up to 8 hours are
//    simulated for modest in-game pay, with a short "while you were away" summary.
// Ownership: a flag beside the save slot, plus an activity line in the save so it follows the account.
import { getSave, slotKey, spendInGame, earnCash } from './state.ts'
import { getCareer, jobLevel } from './career.ts'
import { JOBS } from './careerData.ts'
import { money } from './logic.ts'

export const FREE_WILL_PRICE = 2500
const LABEL = 'Unlocked Free Will'
const ownKey = () => `${slotKey()}.freewill`
const seenKey = () => `${slotKey()}.lastSeen`
const MAX_AWAY_H = 8

export function ownsFreeWill(): boolean {
  try { if (localStorage.getItem(ownKey()) === '1') return true } catch { /* private mode */ }
  return getSave().activities.some((a) => a.label === LABEL)
}

export function buyFreeWill(): { ok: boolean; message: string } {
  if (ownsFreeWill()) return { ok: true, message: 'Free Will is already on.' }
  const r = spendInGame(FREE_WILL_PRICE, LABEL, 'Residents live their own day; you keep earning while away (up to 8 h).')
  if (!r.ok) return r
  try { localStorage.setItem(ownKey(), '1') } catch { /* private mode */ }
  window.dispatchEvent(new Event('gd:freewill'))
  return { ok: true, message: `Free Will unlocked for ${money(FREE_WILL_PRICE)} in-game.` }
}

/** Offline pay: $6 an hour with a job (+$1 per job level, max $12), $3 an hour studying without one. */
export function settleAway(now = Date.now()): string | null {
  let last = 0
  try { last = Number(localStorage.getItem(seenKey()) ?? 0) } catch { /* */ }
  markSeen(now)
  if (!last || !ownsFreeWill()) return null
  const hours = Math.min(MAX_AWAY_H, (now - last) / 36e5)
  if (hours < 0.25) return null
  const job = JOBS.find((j) => j.id === getCareer().job)
  const rate = job ? Math.min(12, 6 + jobLevel()) : 3
  const pay = Math.round(hours * rate * 100) / 100
  const what = job ? `worked ${Math.max(1, Math.round(hours))} shift${Math.round(hours) === 1 ? '' : 's'} as ${job.title}` : 'studied at Campus'
  earnCash(pay, 'While you were away', `Free Will: ${hours.toFixed(1)} h away, ${what}.`)
  return `${hours.toFixed(1)} h away${hours >= MAX_AWAY_H ? ' (8 h max)' : ''}: your character ${what}. +${money(pay)} in-game.`
}
export function markSeen(now = Date.now()): void { try { localStorage.setItem(seenKey(), String(now)) } catch { /* */ } }
