// Static guard for the "Courses tab closes the panel" bug: lesson buttons must not click hidden menu buttons
// (which the control-centre click handler treats as a menu choice and closes on), and must go through gd:course.
import { readFileSync } from 'node:fs'
const career = readFileSync(new URL('../src/career.ts', import.meta.url), 'utf8')
const main = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8')
const fail = (m) => { console.error('FAIL - ' + m); process.exit(1) }
if (/getElementById\('nav-courses'\)[^\n]*click\(\)/.test(career)) fail('career.ts still clicks the hidden #nav-courses button')
if (!career.includes("new CustomEvent('gd:course'")) fail('lesson rows do not dispatch gd:course')
const h = main.slice(main.indexOf("addEventListener('gd:course'"), main.indexOf("addEventListener('gd:course'") + 400)
if (!h.includes('setCC(false)') || !h.includes("ui.open('learn', { course })")) fail('main.ts gd:course handler must close the menu then open that course')
console.log('ok - career lessons open the course without the menu close race')
// Career button opens a sheet inside the control centre; the menu click handler must not close it.
{
  const i = main.indexOf("nav.addEventListener('click'")
  const h2 = main.slice(i, i + 1200)
  if (!/'cc-career'/.test(h2)) fail('cc-career must be exempt from the menu close')
  if (!h2.includes('if (ccSheet.hidden) setCC(false)')) fail('menu close must not run while a sheet is open')
  console.log('ok - Career button keeps its sheet open')
}
