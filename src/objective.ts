// "Next step" for the HUD and the Career sheet: one plain sentence telling a player what to do now.
import { getSave } from './state.ts'
import { SKILL_META, SKILL_ORDER } from './logic.ts'
import { getCareer } from './career.ts'
import { JOBS } from './careerData.ts'

export type Step = { text: string; sub: string; go: string }

export function nextStep(): Step {
  const s = getSave()
  const passed = SKILL_ORDER.filter((id) => s.skills[id]?.passed)
  if (!passed.length) return { text: 'Walk to the gold marker at Campus', sub: 'Ada gives you a 1-minute first lesson', go: 'mentor' }
  const c = getCareer()
  const job = JOBS.find((j) => j.id === c.job)
  if (!job) return { text: 'Pick your first job', sub: 'Jobs pay you for daily duties around the city', go: 'career:jobs' }
  const today = new Date().toISOString().slice(0, 10)
  const done = c.dutyDay === today ? c.duties : []
  const duty = job.duties.find((d) => !done.includes(d.id))
  if (duty) return { text: `Today: ${duty.text}`, sub: `${job.title} duty at ${duty.place}`, go: `place:${duty.place}` }
  const course = SKILL_ORDER.find((id) => !s.skills[id]?.passed)
  if (course) return { text: `Next lesson: ${SKILL_META[course].title}`, sub: 'Study it at Campus', go: `course:${course}` }
  return { text: 'Climb the weekly challenges', sub: 'Free season rewards', go: 'career:weekly' }
}
