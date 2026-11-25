// Makes the link-preview pictures for every shareable flyer (src/posters.ts): public/posters/<id>.jpg, 1200 x 630,
// drawn by the game's own code (src/shareArt.ts, flyerPreviewArt) so the preview matches the poster in the city.
// Run with the dev server up: npx vite --port 47400  then  node scripts/flyer-art.mjs [http://localhost:47400]
// (Playwright must be installed; the cloud sessions have it.)
import { createRequire } from 'module'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const { chromium } = createRequire(import.meta.url)('playwright')
const base = process.argv[2] ?? 'http://localhost:47400'
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'posters')
mkdirSync(out, { recursive: true })
const b = await chromium.launch()
const p = await b.newPage()
await p.goto(`${base}/stats.html`, { waitUntil: 'load' })
// The game's own font (Inter), as the city loads it.
await p.addStyleTag({ url: `${base}/node_modules/@fontsource-variable/inter/index.css` }).catch(() => null)
const arts = await p.evaluate(async () => {
  const P = await import('/src/posters.ts')
  const A = await import('/src/shareArt.ts')
  const res = []
  for (const f of P.FLYERS) { const c = await A.flyerPreviewArt(f); res.push([f.id, c.toDataURL('image/jpeg', 0.9)]) }
  return res
})
for (const [id, url] of arts) {
  writeFileSync(join(out, `${id}.jpg`), Buffer.from(url.split(',')[1], 'base64'))
  console.log('wrote', `public/posters/${id}.jpg`)
}
await b.close()
