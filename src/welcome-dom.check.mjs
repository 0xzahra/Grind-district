import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const dom = new JSDOM(readFileSync('index.html', 'utf8'), { url: 'https://example.test', pretendToBeVisual: true })
for (const key of ['window', 'document', 'HTMLElement', 'HTMLButtonElement', 'HTMLInputElement', 'HTMLTextAreaElement', 'localStorage', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  Object.defineProperty(globalThis, key, { value: key.endsWith('AnimationFrame') ? dom.window[key].bind(dom.window) : dom.window[key], configurable: true })
}
const css = document.createElement('style'); css.textContent = readFileSync('src/style.css', 'utf8'); document.head.append(css)
const { mountUi } = await import('./ui.ts')
const { createEntryView } = await import('./entry-view.ts')
const { loadSave, getSave } = await import('./state.ts')
const { SceneGate } = await import('./scene-gate.ts')
const sheet = document.querySelector('#sheet')
const element = () => document.createElement('span')
const ui = mountUi(sheet, document.querySelector('#toast'), { rank: element(), place: element(), ledger: element(), season: element(), focus: element() }, { onStyle() {}, onBody() {}, onLook() {}, onGraphics() {}, onPrefs() {}, onRank() {} })
const entry = createEntryView(document.querySelector('#menu'), document.querySelector('#boot'), document.querySelector('#boot-text'), document.querySelector('#menu-note'))
for (const path of ['Close', "I'm here", 'Escape', 'programmatic']) {
  localStorage.clear(); loadSave('low')
  entry.begin(); entry.reveal(); ui.open('intro')
  assert.equal(document.querySelector('#sheet-title').textContent, 'You start at zero')
  assert(ui.isOpen() && !sheet.hidden && document.body.classList.contains('sheet-open'))
  assert.equal(window.getComputedStyle(document.querySelector('#menu')).display, 'none', 'landing cannot intercept welcome')
  assert.equal(window.getComputedStyle(document.querySelector('#boot')).pointerEvents, 'none', 'boot cannot intercept welcome after reveal')
  assert.equal(window.getComputedStyle(sheet).pointerEvents, 'auto')
  assert.equal(document.activeElement.textContent, 'Close', 'welcome focuses close control')
  const gate = new SceneGate(); let sceneSteps = 0
  gate.advance(ui.isOpen(), () => sceneSteps++)
  assert.equal(sceneSteps, 0, 'open welcome keeps scene frozen')
  if (path === 'Escape') window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  else if (path === 'programmatic') ui.close()
  else [...sheet.querySelectorAll('button')].find(button => button.textContent === path).click()
  assert(!ui.isOpen() && sheet.hidden && !document.body.classList.contains('sheet-open'), path + ' dismisses actual mounted DOM')
  assert.equal(sheet.children.length, 0, 'removed controls cannot keep intercepting')
  assert(getSave().seenIntro, path + ' saves welcome dismissal')
  gate.advance(ui.isOpen(), () => sceneSteps++)
  assert.equal(sceneSteps, 1, 'dismissal releases SceneGate')
  loadSave('low'); assert(getSave().seenIntro, 'dismissal survives reload')
}
// Shared profile close deliberately transitions to welcome exactly once for new players.
localStorage.clear(); loadSave('low'); ui.open('shared'); ui.close()
assert(ui.isOpen() && document.querySelector('#sheet-title').textContent === 'You start at zero')
ui.close(); assert(!ui.isOpen() && getSave().seenIntro)
// jsdom has no layout/hit testing: supply deterministic geometry to test QA diagnostics,
// not to claim the real browser has the same hit target or layout.
ui.open('intro')
for (const button of sheet.querySelectorAll('button')) button.getBoundingClientRect = () => ({ left: 10, top: 20, width: 80, height: 40 })
const first = sheet.querySelector('button')
document.elementFromPoint = () => first
assert(ui.diagnostics().controls[0].receivesPointer)
document.elementFromPoint = () => document.querySelector('#menu')
assert.equal(ui.diagnostics().controls[0].hitId, 'menu')
assert.equal(ui.diagnostics().controls[0].receivesPointer, false, 'diagnostics identify an actual hit-test blocker')
assert(!JSON.stringify(ui.diagnostics()).includes('You start'), 'diagnostics omit UI/user text')
ui.close(); dom.window.close()
console.log('real-DOM welcome Close/acknowledge/Escape/shared/entry/CSS/SceneGate/persistence checks passed; browser layout not simulated')
