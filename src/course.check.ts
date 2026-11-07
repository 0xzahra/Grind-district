import { COURSES } from './courses.ts'
import { documents, SKILL_META } from './logic.ts'
import { loadSave, getSave, startCourse, submitCourse } from './state.ts'
import { courseEvents } from './course-events.ts'
const store = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', { value: {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
} })
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message) }
loadSave('low')
const first = COURSES[0]!
check(!documents(getSave()).cv.includes(SKILL_META[first.id].cv), 'fresh CV has no unearned skill')
startCourse(first.id)
startCourse(first.id)
check(courseEvents().length === 1, 'opening twice records one start')
check(!submitCourse(first.id, first.questions.map(() => -1)).ok, 'incorrect answers cannot complete')
check(courseEvents().length === 1, 'failure records no finish or CV update')
check(submitCourse(first.id, first.questions.map(q => q.answer)).ok, 'first course completes')
check(documents(getSave()).cv.includes(SKILL_META[first.id].cv), 'CV contains earned skill')
const xp = getSave().xp
check(!submitCourse(first.id, first.questions.map(q => q.answer)).ok, 'repeat completion refused')
check(getSave().xp === xp, 'no duplicate XP credit')
check(courseEvents().map(e => e.name).join(',') === 'first_course_started,first_course_finished,cv_updated', 'ordered distinct events without duplicates')
loadSave('low')
check(getSave().skills[first.id]?.passed, 'completion persists across reload')
check(documents(getSave()).cv.includes(SKILL_META[first.id].cv), 'CV remains updated after reload')
startCourse(first.id)
check(courseEvents().length === 3, 'reopening completed course emits nothing')
console.log('course lifecycle checks passed')
