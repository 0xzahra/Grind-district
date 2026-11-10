// "Next step" for the HUD and the Career sheet: one plain sentence telling a player what to do now.
import { getSave } from './state.ts'
import { SKILL_META, SKILL_ORDER, COURSE_CASH } from './logic.ts'
import { getCareer } from './career.ts'
import { JOBS } from './careerData.ts'
import { getLevel, advancedNext } from './mentor.ts'

export type Step = { text: string; sub: string; go: string }

export function nextStep(): Step {
  const s = getSave()
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
  if (!passed.length && getLevel() === 'homie') { const adv = advancedNext(); if (adv) return { text: `Next lesson: ${SKILL_META[adv].title}`, sub: `Homie track · +$${COURSE_CASH} on pass · basics stay open`, go: `course:${adv}` } }
  if (!passed.length) return { text: 'Walk to the gold marker at Campus', sub: `Zahra's 1-minute first lesson · +$${COURSE_CASH} + $25 practice funds`, go: 'mentor' }
  const c = getCareer()
  const job = JOBS.find((j) => j.id === c.job)
  if (!job) return { text: 'Pick your first job', sub: 'Each daily duty pays +$5 or more in-game', go: 'career:jobs' }
  const today = new Date().toISOString().slice(0, 10)
  const done = c.dutyDay === today ? c.duties : []
  const duty = job.duties.find((d) => !done.includes(d.id))
  if (duty) return { text: `Today: ${duty.text}`, sub: `${job.title} · ${duty.place} · pays in-game $`, go: `place:${duty.place}` }
  const course = SKILL_ORDER.find((id) => !s.skills[id]?.passed)
  if (course) return { text: `Next lesson: ${SKILL_META[course].title}`, sub: `Study it at Campus · +$${COURSE_CASH}`, go: `course:${course}` }
  return { text: 'Climb the weekly challenges', sub: 'Each weekly challenge pays +$50 in-game', go: 'career:weekly' }
}
