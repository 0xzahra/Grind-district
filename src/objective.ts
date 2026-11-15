// "Next step" for the HUD and the Career sheet: one plain sentence telling a player what to do now.
import { getSave } from './state.ts'
import { SKILL_META, SKILL_ORDER, COURSE_CASH } from './logic.ts'
import { careersOpen, nextMission, worldOf } from './worlds.ts'
import { getCareer } from './career.ts'
import { JOBS } from './careerData.ts'

export type Step = { text: string; sub: string; go: string }

export function nextStep(): Step {
  const s = getSave()
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
  // The core loop first: Campus → a short lesson → your CV and certificate → (optional) mint on NEAR.
  if (!passed.length) return { text: 'Go to Campus for your first lesson', sub: 'Zahra teaches it in a few minutes · it goes on your CV', go: 'mentor' }
  const seen = (k: string) => { try { return !!localStorage.getItem(k) } catch { return true } }
  if (!seen('gd.cvSeen')) return { text: 'See your course on your CV', sub: 'Profile · your first certificate is there too', go: 'panel:profile' }
  if (!seen('gd.certSeen')) return { text: 'Open your certificate', sub: 'Download or share it · minting on NEAR is optional', go: `cert:${passed[0]}` }
  const c = getCareer()
  const job = JOBS.find((j) => j.id === c.job)
  const mission = nextMission()
  if (!job && !careersOpen() && mission) { const w = worldOf(mission); return { text: `Next mission: ${SKILL_META[mission].title}`, sub: `World ${w?.n ?? ''} · ${w?.title ?? 'Campus'} · +$${COURSE_CASH}`, go: `course:${mission}` } }
  if (!job) return { text: 'Pick your first job', sub: 'Each daily duty pays +$5 or more in-game', go: 'career:jobs' }
  const today = new Date().toISOString().slice(0, 10)
  const done = c.dutyDay === today ? c.duties : []
  const duty = job.duties.find((d) => !done.includes(d.id))
  if (duty) return { text: `Today: ${duty.text}`, sub: `${job.title} · ${duty.place} · pays in-game $`, go: `place:${duty.place}` }
  const course = mission
  if (course) return { text: `Next lesson: ${SKILL_META[course].title}`, sub: `Study it at Campus · +$${COURSE_CASH}`, go: `course:${course}` }
  return { text: 'Climb the weekly challenges', sub: 'Each weekly challenge pays +$50 in-game', go: 'career:weekly' }
}
