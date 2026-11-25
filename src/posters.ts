// Flyers: every poster, billboard or flyer in the city that players can share. Each one paints itself onto a canvas
// (the same art as in the city) and has a stable id, which is also its public page: /p/<id> shows the picture as
// its link preview (api/page.ts, kind "poster", with the art in public/posters/<id>.jpg made by
// scripts/flyer-art.mjs). A new flyer: add it to FLYERS here (and to api/_posters.ts), then run that script.
import { MCGRIND_FLYERS } from './mcgrindAds.ts'

export type Flyer = {
  id: string
  /** What the share sheet calls it. */
  title: string
  /** Its words, for the post. */
  text: string
  /** Its size in drawing units (the paint function draws from 0,0 to w,h). */
  w: number
  h: number
  paint: (g: CanvasRenderingContext2D) => void
}

export const FLYERS: Flyer[] = [...MCGRIND_FLYERS]
export const flyerById = (id: string): Flyer | undefined => FLYERS.find((f) => f.id === id)
