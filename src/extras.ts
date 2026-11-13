// Account copies of the small stores kept beside the save: needs and mood, the Grind Pass, season and job
// progress, the makeup kit and the wardrobe. They used to live only on the device, so a new phone lost them.
//
// How it works, without changing the save format or any server code:
// - Upload: the copy of the save sent to the account carries one extra key, `extras`, holding these stores.
//   The local save is untouched, and the save loader builds a save field by field, so it ignores the key.
// - Restore: on sign-in, when the account's save is loaded, `extras` is merged into this device's stores.
//   Nothing bought is ever lost in a merge: owned things are kept from both sides and progress takes the
//   higher number.
// - The wardrobe and makeup kit are stored per device, not per account. A marker remembers which account
//   they belong to, so signing in as someone else swaps them for that account's own instead of mixing them.
// The Stockholders' Club is deliberately not here: its wallet address never leaves the device.
import { slotKey } from './state.ts'

const MAKEUP = 'gd.makeup.v1'
const WARDROBE = 'gd.wardrobe.v1'
const OWNER = 'gd.extras.owner'
type Obj = Record<string, unknown>
export type Extras = { v: 1; at: number; needs?: Obj; pass?: Obj; career?: Obj; makeup?: Obj; wardrobe?: Obj }

const get = (k: string): Obj | undefined => { try { const v = JSON.parse(localStorage.getItem(k) ?? 'null') as unknown; return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined } catch { return undefined } }
const put = (k: string, v: Obj) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
const union = (a: unknown, b: unknown) => [...new Set([...strs(a), ...strs(b)])]
const obj = (v: unknown): Obj | undefined => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : undefined)

/** The stores to send with the save. The city feed is left out (it is large and rebuilds itself). */
export function collectExtras(): Extras {
  const slot = slotKey()
  const out: Extras = { v: 1, at: Date.now() }
  const needs = get(`${slot}.needs`); if (needs) out.needs = needs
  const pass = get(`${slot}.pass`); if (pass) out.pass = pass
  const career = get(`${slot}.career`); if (career) { const { feed: _f, feedSeen: _s, ...rest } = career; out.career = rest }
  const makeup = get(MAKEUP); if (makeup) out.makeup = makeup
  const wardrobe = get(WARDROBE); if (wardrobe) out.wardrobe = wardrobe
  return out
}

/** Merge the account's stores into this device's, after its save has been adopted. Returns true if anything changed. */
export function applyExtras(serverSave: unknown, userId: string): boolean {
  const x = obj(obj(serverSave)?.extras)
  const slot = slotKey()
  let owner: string | null = null
  try { owner = localStorage.getItem(OWNER) } catch { /* private mode */ }
  // Another account's wardrobe and kit are on this device: start from this account's own, not a mix.
  const foreign = !!owner && owner !== userId
  let changed = false
  const set = (k: string, v: Obj) => { const was = localStorage.getItem(k); const now = JSON.stringify(v); if (was !== now) { put(k, v); changed = true } }

  if (x) {
    const sNeeds = obj(x.needs), lNeeds = get(`${slot}.needs`)
    if (sNeeds && (!lNeeds || num(sNeeds.at) > num(lNeeds.at))) set(`${slot}.needs`, sNeeds)

    const sPass = obj(x.pass), lPass = get(`${slot}.pass`)
    if (sPass) {
      const free = Math.max(lPass?.free == null ? -1 : num(lPass.free), sPass.free == null ? -1 : num(sPass.free))
      set(`${slot}.pass`, { ...lPass, ...sPass, owned: lPass?.owned === true || sPass.owned === true, at: num(lPass?.at) || num(sPass.at), granted: Math.max(num(lPass?.granted), num(sPass.granted)), ...(free >= 0 ? { free } : {}) })
    }

    const sCareer = obj(x.career), lCareer = get(`${slot}.career`)
    if (sCareer) {
      set(`${slot}.career`, {
        ...lCareer, ...sCareer,
        seasonPts: Math.max(num(lCareer?.seasonPts), num(sCareer.seasonPts)), jobXp: Math.max(num(lCareer?.jobXp), num(sCareer.jobXp)),
        trades: Math.max(num(lCareer?.trades), num(sCareer.trades)), events: Math.max(num(lCareer?.events), num(sCareer.events)),
        houseItems: union(lCareer?.houseItems, sCareer.houseItems),
        feed: lCareer?.feed ?? [], feedSeen: lCareer?.feedSeen ?? [],
      })
    }
  }

  const sMakeup = obj(x?.makeup), lMakeup = foreign ? undefined : get(MAKEUP)
  if (sMakeup || foreign) {
    const owned = lMakeup?.owned === true || sMakeup?.owned === true
    set(MAKEUP, { owned, m: (sMakeup?.owned === true ? obj(sMakeup.m) : obj(lMakeup?.m)) ?? {} })
  }

  const sWard = obj(x?.wardrobe), lWard = foreign ? undefined : get(WARDROBE)
  if (sWard || foreign) {
    const worn = obj(sWard?.worn) ?? obj(lWard?.worn) ?? {}
    set(WARDROBE, { owned: union(lWard?.owned, sWard?.owned), worn: { ...worn, acc: strs(worn.acc) } })
  }

  try { localStorage.setItem(OWNER, userId) } catch { /* private mode */ }
  // Modules that keep these stores in memory read them again.
  if (changed) window.dispatchEvent(new Event('gd:extras-applied'))
  return changed
}

/** Remember which account the device-wide stores belong to (called with each upload). */
export function markOwner(userId: string | null): void {
  if (!userId) return
  try { if (!localStorage.getItem(OWNER)) localStorage.setItem(OWNER, userId) } catch { /* private mode */ }
}
