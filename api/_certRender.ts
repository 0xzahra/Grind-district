// Server-side certificate PNG: same drawCertificate() as the game, on @napi-rs/canvas. Underscore = not a function.
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { drawCertificate, CERT_W, CERT_H, type CertData } from './_certArt.js'

type Canvas = { getContext(k: '2d'): unknown; toBuffer(mime: 'image/png'): Buffer; width: number; height: number }
type Napi = {
  createCanvas(w: number, h: number): Canvas
  loadImage(src: Buffer): Promise<{ width: number; height: number }>
  GlobalFonts: { registerFromPath(path: string, family?: string): unknown }
}

const ROOT = process.env.GD_ROOT || process.cwd()
const FAMILY: Record<string, string> = { outfit: 'Outfit', 'archivo-black': 'Archivo Black', 'cormorant-garamond': 'Cormorant Garamond' }
let ready: Promise<{ napi: Napi; lockup: unknown; shrimp: unknown }> | null = null

function setup() {
  return (ready ??= (async () => {
    const napi = (await import('@napi-rs/canvas')) as unknown as Napi
    const dir = join(ROOT, 'api/_fonts')
    for (const f of readdirSync(dir)) {
      const key = Object.keys(FAMILY).find((k) => f.startsWith(k + '-latin'))
      if (key) napi.GlobalFonts.registerFromPath(join(dir, f), FAMILY[key])
    }
    const lockup = await napi.loadImage(readFileSync(join(ROOT, 'public/brand/lockup.png')))
    const shrimp = await napi.loadImage(readFileSync(join(ROOT, 'public/brand/shrimp.png')))
    return { napi, lockup, shrimp }
  })())
}

/** PNG bytes of the certificate. width defaults to the full 1600 px print size. */
export async function renderCertPng(d: CertData, id: string, width = CERT_W): Promise<Buffer> {
  const { napi, lockup, shrimp } = await setup()
  const s = Math.max(0.25, Math.min(2, width / CERT_W))
  const cv = napi.createCanvas(Math.round(CERT_W * s), Math.round(CERT_H * s))
  drawCertificate(cv.getContext('2d') as CanvasRenderingContext2D, d, id, { lockup: lockup as never, shrimp: shrimp as never, makeCanvas: (w, h) => napi.createCanvas(w, h) }, s)
  return cv.toBuffer('image/png')
}
