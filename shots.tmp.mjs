import { chromium } from 'playwright'
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const U = 'https://grinddistrict.vercel.app/'
for (const [name, vp, mobile] of [['mobile', { width: 412, height: 915 }, true], ['desktop', { width: 1440, height: 900 }, false]]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1 })
  const p = await ctx.newPage()
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)))
  for (const [tag, q] of [['plaza', '?time=12'], ['east', '?time=12&at=24,-8'], ['park', '?time=12&at=-30,30'], ['marina', '?time=12&at=40,-42']]) {
    await p.goto(U + q, { waitUntil: 'load', timeout: 60000 })
    await p.waitForTimeout(9000)
    await p.screenshot({ path: `/workspace/gdshots/realism/${name}-${tag}.png` })
  }
  console.log(name, 'errors', errs.slice(0, 3))
  await ctx.close()
}
await b.close()
