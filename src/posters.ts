// Flyers: every poster, billboard or flyer in the city that players can share. Each one paints itself onto a canvas
// (the same art as in the city) and has a stable id, which is also its public page: /p/<id> shows the picture as
// its link preview (api/page.ts, kind "poster", with the art in public/posters/<id>.jpg made by
// scripts/flyer-art.mjs). A new flyer: add it to FLYERS here (and to api/_posters.ts), then run that script.
import { MCGRIND_FLYERS } from './mcgrindAds.ts'

export type Flyer = {
  id: string
  /** What the share sheet calls it. */
  title: string
  /** Its words. */
  text: string
  /** A post-ready line for this flyer (a sentence or two, with an emoji). */
  caption: string
  /** Its size in drawing units (the paint function draws from 0,0 to w,h). */
  w: number
  h: number
  paint: (g: CanvasRenderingContext2D) => void
}

export const FLYERS: Flyer[] = [...MCGRIND_FLYERS]
export const flyerById = (id: string): Flyer | undefined => FLYERS.find((f) => f.id === id)

/** The words that go with a shared flyer: `short` for X and Farcaster, `full` for the share sheet and Copy caption. */
export function flyerCaption(f: Flyer): { short: string; full: string } {
  return {
    short: `${f.caption} Play free 👇`,
    full: `${f.caption}\n\nGrind District is a free 3D city where you learn Web3, work real jobs like McGrind shifts, and earn a CV with certificates.\n\nPlay in your browser, no download:`,
  }
}
