import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { loadOrCreate, signLogin } from './near-keypair.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHOTS = join(ROOT, 'shots/login-test')
mkdirSync(SHOTS, { recursive: true })
const results = []
const ok = (name, detail = '') => { results.push({ name, pass: true, detail }); console.log('PASS', name, detail) }
const fail = (name, detail = '') => { results.push({ name, pass: false, detail }); console.error('FAIL', name, detail) }

const kp = loadOrCreate()
const UNAME = 'gdtest' + String(Date.now()).slice(-6)
const PROD = 'https://grinddistrict.vercel.app'

async function ensureAccount() {
  const nonce = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
  const nonceB64 = nonce.toString('base64')
  const message = `Grind District login\n${Date.now()}\n${nonceB64}`
  const proof = signLogin(kp, message, nonceB64)
  const who = await fetch(`${PROD}/api/claim-username`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ near: proof }),
  }).then(r => r.json())
  if (who.username) return who.username
  const nonce2 = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
  const nonceB642 = nonce2.toString('base64')
  const message2 = `Grind District login\n${Date.now()}\n${nonceB642}`
  const proof2 = signLogin(kp, message2, nonceB642)
  const claimed = await fetch(`${PROD}/api/claim-username`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ near: proof2, username: UNAME }),
  }).then(r => r.json())
  if (!claimed.username) throw new Error('claim failed ' + JSON.stringify(claimed))
  return claimed.username
}

const username = await ensureAccount()
ok('api-near-claim', `user=@${username} id=near:${kp.accountId}`)

// Kill anything on 4177
try { spawn('fuser', ['-k', '4177/tcp'], { stdio: 'ignore' }) } catch {}
await new Promise(r => setTimeout(r, 500))

const preview = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
})
let previewLog = ''
preview.stdout.on('data', d => { previewLog += d })
preview.stderr.on('data', d => { previewLog += d })
for (let i = 0; i < 40; i++) {
  try {
    const r = await fetch('http://127.0.0.1:4177/')
    if (r.ok || r.status === 200) break
  } catch {}
  await new Promise(r => setTimeout(r, 250))
  if (i === 39) { console.error(previewLog); throw new Error('preview failed') }
}

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const page = await ctx.newPage()

// Proxy API to production so NEAR claim works from local static preview
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url())
  const target = PROD + url.pathname + url.search
  const init = {
    method: route.request().method(),
    headers: { ...route.request().headers(), host: 'grinddistrict.vercel.app' },
    body: ['GET', 'HEAD'].includes(route.request().method()) ? undefined : route.request().postData(),
  }
  try {
    const res = await fetch(target, init)
    const buf = Buffer.from(await res.arrayBuffer())
    const headers = {}
    res.headers.forEach((v, k) => { if (k.toLowerCase() !== 'content-encoding') headers[k] = v })
    await route.fulfill({ status: res.status, headers, body: buf })
  } catch (e) {
    await route.fulfill({ status: 502, body: String(e) })
  }
})

await page.exposeFunction('__gdSignNear', async ({ message, nonceB64 }) => signLogin(kp, message, nonceB64))
await page.addInitScript(() => {
  window.__GD_MOCK_NEAR__ = (a) => window.__gdSignNear(a)
})

await page.goto('http://127.0.0.1:4177/', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(5000)
await page.screenshot({ path: join(SHOTS, '01-opening.png') })

const signinText = await page.locator('#menu-signin').innerText().catch(() => '')
const playText = await page.locator('#play').innerText().catch(() => '')
if (/sign in/i.test(signinText) && /guest|continue|play/i.test(playText)) ok('opening-signin-primary', `${signinText} / ${playText}`)
else fail('opening-signin-primary', `${signinText} / ${playText}`)

const tagline = await page.locator('.title-headline').innerText().catch(() => '')
if (/Live a Web3 life/i.test(tagline)) ok('opening-tagline', tagline)
else fail('opening-tagline', tagline)

await page.click('#menu-signin')
await page.waitForTimeout(2500)
await page.screenshot({ path: join(SHOTS, '02-signin-panel.png') })
const bodyText = await page.locator('#login-dlg').innerText()
if (/Continue with NEAR/i.test(bodyText)) ok('signin-near-button')
else fail('signin-near-button', bodyText.slice(0, 200))
if (/No funds or transactions/i.test(bodyText)) ok('signin-no-funds-copy')
else fail('signin-no-funds-copy')

await page.locator('#login-dlg button:has-text("Continue with NEAR")').click()
// Wait for signed-in UI or username picker
for (let i = 0; i < 20; i++) {
  const t = await page.locator('#login-dlg').innerText().catch(() => '')
  if (/Signed in as @|Choose your username|Enter the district/i.test(t)) break
  await page.waitForTimeout(500)
}
await page.screenshot({ path: join(SHOTS, '03-near-after.png') })
let afterNear = await page.locator('#login-dlg').innerText().catch(() => '')
let lsUser = await page.evaluate(() => localStorage.getItem('gd.privy.username'))
let lsNear = await page.evaluate(() => localStorage.getItem('gd.near.account'))

if (/Choose your username/i.test(afterNear)) {
  await page.locator('#login-dlg input').fill(UNAME)
  await page.waitForTimeout(800)
  await page.locator('#login-dlg button:has-text("Claim username")').click()
  await page.waitForTimeout(3500)
  await page.screenshot({ path: join(SHOTS, '03b-claimed.png') })
  afterNear = await page.locator('#login-dlg').innerText().catch(() => '')
  lsUser = await page.evaluate(() => localStorage.getItem('gd.privy.username'))
  lsNear = await page.evaluate(() => localStorage.getItem('gd.near.account'))
}

if (lsUser && lsNear) ok('near-login-storage', `user=${lsUser} near=${lsNear}`)
else fail('near-login-storage', `user=${lsUser} near=${lsNear} dlg=${afterNear.slice(0, 300)}`)
if (/Signed in as @/i.test(afterNear) || /Enter the district/i.test(afterNear)) ok('near-login-ui', afterNear.slice(0, 180).replace(/\n+/g, ' | '))
else fail('near-login-ui', afterNear.slice(0, 300))

// Enter the district if button present, else close and Play
const enter = page.locator('#login-dlg button:has-text("Enter the district")')
if (await enter.count()) {
  await enter.click()
  await page.waitForTimeout(5000)
} else {
  await page.locator('#login-dlg .login-x').click().catch(() => {})
  await page.waitForTimeout(500)
  if (await page.locator('#menu:not([hidden]) #play').count()) {
    await page.click('#play')
    await page.waitForTimeout(5000)
  }
}
await page.screenshot({ path: join(SHOTS, '04-in-game.png') })

// Open Settings (Sign out lives there) and Sign out via the real button
page.on('dialog', async (d) => { try { await d.accept() } catch {} })
// Control centre / nav: open Settings
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button, [role="button"]')]
  const s = btns.find(b => /^\s*Settings\s*$/i.test((b.textContent || '').trim()) || (b.getAttribute('aria-label') || '') === 'Settings')
  if (s) s.click()
  else document.querySelector('#nav-toggle, #cc-toggle, .cc-toggle, #menu-fab')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
})
await page.waitForTimeout(1200)
// If control centre opened, click Settings inside it
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')]
  const s = btns.find(b => /settings/i.test(b.textContent || ''))
  s?.click()
})
await page.waitForTimeout(1500)
await page.screenshot({ path: join(SHOTS, '04b-settings.png') })
// Confirm signed-in flag is set (bug we fixed)
const flags = await page.evaluate(() => ({
  uid: localStorage.getItem('gd.privy.userId'),
  user: localStorage.getItem('gd.privy.username'),
  near: localStorage.getItem('gd.near.account'),
}))
if (flags.uid && flags.user) ok('signedin-flags-set', JSON.stringify(flags))
else fail('signedin-flags-set', JSON.stringify(flags))
const signOutBtn = page.locator('button:has-text("Sign out")')
if (await signOutBtn.count()) {
  await signOutBtn.first().click()
  await page.waitForTimeout(6000)
  ok('logout-button-found')
} else {
  fail('logout-button-found', 'Settings Sign out not visible')
  await page.evaluate(async () => {
    // Last resort: call the same clear path signOut uses
    for (const k of ['gd.privy.username', 'gd.near.account', 'gd.privy.userId', 'grind-district-save-v1']) localStorage.removeItem(k)
    location.assign(location.pathname)
  })
  await page.waitForTimeout(5000)
}
await page.screenshot({ path: join(SHOTS, '05-after-logout.png') })
const afterLs = await page.evaluate(() => ({
  user: localStorage.getItem('gd.privy.username'),
  near: localStorage.getItem('gd.near.account'),
  uid: localStorage.getItem('gd.privy.userId'),
}))
const backHome = await page.locator('#menu-signin').count()
if (!afterLs.user && !afterLs.near && !afterLs.uid && backHome) ok('logout-clears-and-home', JSON.stringify(afterLs))
else fail('logout-clears-and-home', JSON.stringify({ afterLs, backHome, url: page.url() }))

// Guest path (fresh storage)
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForTimeout(4500)
await page.click('#play')
await page.waitForTimeout(2500)
await page.screenshot({ path: join(SHOTS, '06-guest-path.png') })
const guestText = await page.locator('#menu').innerText().catch(() => '')
if (/guest/i.test(guestText)) ok('guest-path', guestText.slice(0, 140).replace(/\n+/g, ' | '))
else fail('guest-path', guestText.slice(0, 200))

// Storage cleared after guest start shouldn't have near/privy keys
const guestLs = await page.evaluate(() => ({
  user: localStorage.getItem('gd.privy.username'),
  near: localStorage.getItem('gd.near.account'),
}))
if (!guestLs.user && !guestLs.near) ok('guest-no-account-keys')
else fail('guest-no-account-keys', JSON.stringify(guestLs))

// Production smoke
const prodCtx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const pp = await prodCtx.newPage()
await pp.goto(PROD + '/', { waitUntil: 'domcontentloaded', timeout: 90000 })
await pp.waitForTimeout(6000)
await pp.screenshot({ path: join(SHOTS, '07-prod-opening.png') })
const pSign = await pp.locator('#menu-signin').innerText().catch(() => '')
if (/sign in/i.test(pSign)) ok('prod-opening-signin', pSign)
else fail('prod-opening-signin', pSign)
await pp.click('#menu-signin')
await pp.waitForTimeout(3500)
await pp.screenshot({ path: join(SHOTS, '08-prod-signin.png') })
const pDlg = await pp.locator('#login-dlg').innerText().catch(() => '')
if (/Continue with NEAR/i.test(pDlg)) ok('prod-signin-near')
else fail('prod-signin-near', pDlg.slice(0, 200))
if (/No funds or transactions/i.test(pDlg)) ok('prod-signin-nofunds')
else fail('prod-signin-nofunds')
await prodCtx.close()

await browser.close()
preview.kill('SIGTERM')

const failed = results.filter(r => !r.pass)
writeFileSync(join(SHOTS, 'results.json'), JSON.stringify({ username, accountId: kp.accountId, results }, null, 2))
console.log('\n=== SUMMARY ===')
for (const r of results) console.log(r.pass ? '✓' : '✗', r.name, r.detail || '')
console.log(failed.length ? `FAILED ${failed.length}` : 'ALL PASSED')
process.exit(failed.length ? 1 : 0)
