import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'
const html = readFileSync('index.html', 'utf8')
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1])
assert.equal(new Set(ids).size, ids.length, 'HTML IDs must be unique')
const required = source => [...source.matchAll(/\bmust(?:<[^>]+>)?\(\s*['"](#[^'"]+)['"]/g)].map(m => m[1].slice(1))
const missing = (source, available) => required(source).filter(id => !available.has(id))
const available = new Set(ids)
let count = 0
for (const name of readdirSync('src').filter(name => name.endsWith('.ts') && !name.includes('.check.'))) {
  const source = readFileSync('src/' + name, 'utf8')
  const selectors = required(source)
  count += selectors.length
  assert.deepEqual(missing(source, available), [], `${name}: every required startup/menu/fallback DOM ID must exist in HTML`)
}
assert.deepEqual(missing("must<HTMLFormElement>('#chat'); must('#chat-input'); must('#chat-log'); must('#chat-status')", available), ['chat', 'chat-input', 'chat-log', 'chat-status'], 'audit reproduces all four former orphan chat selectors, not just first failure')
const main = readFileSync('src/main.ts', 'utf8')
assert(main.includes('createNet({ scene, me: identity() })'), 'startup activates presence only, not chat UI')
assert(!main.includes("'#chat"), 'no orphaned public-chat DOM contract')
console.log(`DOM startup contract checks passed (${count} literal required selectors across source, including flat fallback/menu)`)
