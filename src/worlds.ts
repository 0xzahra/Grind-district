// Campus as six gamified Worlds (Zahra's outline). Each World has missions, a final check and a reward.
// Old course ids are reused as missions, so saves that passed them stay valid; new missions were appended
// to SKILL_ORDER. Rewards and unlocks are derived from passed courses (nothing new is stored in the save).
// Everyone starts at World 1: the Homie/Normie placement is only a label now.
import { getSave } from './state.ts'
import type { SkillId } from './logic.ts'

export type World = { n: number; title: string; badge: string; reward: string; unlocks: string; missions: SkillId[]; boss?: SkillId; extra?: { title: string; missions: SkillId[]; needsShield?: boolean } }

export const WORLDS: World[] = [
  { n: 1, title: 'The Internet', badge: '', reward: '+$50 in-game balance', unlocks: 'Opens World 2', missions: ['internet', 'money', 'webEras'] },
  { n: 2, title: 'The Scam That Taught Me', badge: 'Scam Shield', reward: 'Scam Shield badge', unlocks: 'Unlocks Wallet missions', missions: ['redFlags', 'p2pSharks', 'scams'], boss: 'w2Boss', extra: { title: 'Wallet missions', missions: ['wallets', 'custody', 'explorer', 'records'], needsShield: true } },
  { n: 3, title: 'Blockchain Basics', badge: 'Chain Builder', reward: 'Chain Builder badge', unlocks: 'Opens World 4', missions: ['chainBlocks', 'chainTraits', 'chainTypes', 'chainHistory'], boss: 'trilemma' },
  { n: 4, title: 'Layers and Uses', badge: "Builder's Eye", reward: "Builder's Eye badge", unlocks: 'Opens World 5', missions: ['layers', 'apps', 'useCases'], boss: 'w4Boss', extra: { title: 'Deep dives', missions: ['defi', 'liquidity', 'stables', 'nfts', 'daos', 'carbon'] } },
  { n: 5, title: 'The Earning Map', badge: 'Pathfinder', reward: 'Pathfinder badge', unlocks: 'Unlocks Careers', missions: ['earnWays', 'web2Skill', 'timePaths', 'moneyPaths', 'builderPaths'], boss: 'w5Boss', extra: { title: 'Deep dives', missions: ['community', 'content', 'airdrops', 'staking', 'building', 'agents'] } },
  { n: 6, title: 'Your Career', badge: '', reward: 'The open city', unlocks: 'Jobs, careers and the Trading floor', missions: ['spot', 'risk', 'memes'] },
]

const passed = (id: SkillId) => Boolean(getSave().skills[id]?.passed)

/** A World is done when its final check is passed (World 1: when its three missions are passed). */
export function worldDone(n: number): boolean {
  const w = WORLDS[n - 1]
  if (!w) return false
  return w.boss ? passed(w.boss) : w.missions.every(passed)
}
/** Worlds open in order. A World where an old save already passed a course stays open, so nothing earned is hidden. */
export function worldOpen(n: number): boolean {
  if (n <= 1) return true
  if (n === 6) return [1, 2, 3, 4, 5].every(worldDone)
  const w = WORLDS[n - 1]!
  return worldDone(n - 1) || [...w.missions, ...(w.extra?.missions ?? [])].some(passed)
}
export const scamShield = () => worldDone(2)
/** Careers (jobs and career paths) open with the Pathfinder badge; a job taken before this update is kept. */
export const careersOpen = () => worldDone(5)
export const tradingOpen = () => worldOpen(6)

export function worldOf(id: SkillId): World | undefined { return WORLDS.find((w) => w.missions.includes(id) || w.boss === id || w.extra?.missions.includes(id)) }
/** Why a mission is locked, or '' when it can be played. Passed missions can always be reviewed. */
export function lockReason(id: SkillId): string {
  if (passed(id)) return ''
  const w = worldOf(id)
  if (!w) return ''
  if (!worldOpen(w.n)) return w.n === 6 ? 'Finish Worlds 1 to 5 to open Your Career' : `Finish World ${w.n - 1} to open`
  if (w.extra?.needsShield && w.extra.missions.includes(id) && !scamShield()) return 'Earn the Scam Shield badge to unlock'
  if (w.boss === id && !w.missions.every(passed)) return 'Finish this World\'s missions first'
  return ''
}
/** Play order: every World's missions, then its final check, then its extra missions. */
export const WORLD_ORDER: SkillId[] = WORLDS.flatMap((w) => [...w.missions, ...(w.boss ? [w.boss] : []), ...(w.extra?.missions ?? [])])
/** Next mission on the main path (extras are optional and never block the next World). */
export function nextMission(): SkillId | undefined {
  const main = WORLDS.flatMap((w) => [...w.missions, ...(w.boss ? [w.boss] : [])])
  return main.find((id) => !passed(id) && !lockReason(id)) ?? WORLD_ORDER.find((id) => !passed(id) && !lockReason(id))
}
export function badges(): string[] { return WORLDS.filter((w) => w.n < 6 && worldDone(w.n)).map((w) => w.badge || w.reward) }
