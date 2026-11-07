// Local learning funnel only: no network requests, identity or paid telemetry.
export type CourseEventName = 'first_course_started' | 'first_course_finished' | 'cv_updated'
export type CourseEvent = { name: CourseEventName; courseId: string; at: number }
const KEY = 'grind-district-course-events-v1'
let cached: CourseEvent[] | undefined
export function courseEvents(): CourseEvent[] {
  if (!cached) {
    try { cached = JSON.parse(localStorage.getItem(KEY) ?? '[]') as CourseEvent[] }
    catch { cached = [] }
    if (!Array.isArray(cached)) cached = []
  }
  return [...cached]
}
export function recordCourseEvent(name: CourseEventName, courseId: string): void {
  const events = courseEvents()
  if (events.some((event) => event.name === name && (name !== 'cv_updated' || event.courseId === courseId))) return
  const event: CourseEvent = { name, courseId, at: Date.now() }
  events.push(event)
  cached = events
  try { localStorage.setItem(KEY, JSON.stringify(events)) } catch { /* Session still works. */ }
  globalThis.dispatchEvent?.(new CustomEvent('grind:course-event', { detail: event }))
}
