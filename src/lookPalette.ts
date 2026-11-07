import type { Graphics } from './logic.ts'

// Warm-look palette and real-time light budget. Pure data plus two tiny functions, so it can be
// checked in Node without a renderer (src/look.check.ts).
//
// BASE_LOOK holds the exact literals shipped at 072e64b. WARM_LOOK is the default. On a preview,
// `?look=base` in the URL restores BASE_LOOK so the two can be compared side by side.

export type LookPalette = {
  /** Hemisphere ground (bounce) colour at full day, continuous clock (world.setDaylight). */
  bounceDay: number
  /** Hemisphere ground colour at full night, continuous clock. */
  bounceNight: number
  /** Hemisphere ground colour for the discrete Day/Dusk look (world.setLook). */
  lookBounceDay: number
  /** Hemisphere ground colour for the discrete Night look. */
  lookBounceNight: number
  /** Home-furniture metal (lamp stems, brackets, TV stand feet). */
  furnitureMetal: number
}

export const BASE_LOOK: Readonly<LookPalette> = Object.freeze({
  bounceDay: 0x3d4f3a,
  bounceNight: 0x07090c,
  lookBounceDay: 0x3d4f3a,
  lookBounceNight: 0x1c2e26,
  furnitureMetal: 0x3a3c3f,
})

// The base bounce was moss green under warm plaster, brick and brass, which tinted shadowed walls
// and indoor-facing surfaces green. Warm earth bounce at matching brightness (within 15% luminance,
// enforced by look.check.ts) keeps exposure where it was. Metal moves from cool gunmetal to dark
// bronze to sit with the city's brass trim (0xd9b26a).
export const WARM_LOOK: Readonly<LookPalette> = Object.freeze({
  bounceDay: 0x4a4236,
  bounceNight: 0x0a0908,
  lookBounceDay: 0x4a4236,
  lookBounceNight: 0x2a2620,
  furnitureMetal: 0x4a4034,
})

/** Picks the palette once. `?look=base` keeps the 072e64b colours for comparison. */
export function pickLook(search: string = globalThis.location?.search ?? ''): Readonly<LookPalette> {
  try {
    return new URLSearchParams(search).get('look') === 'base' ? BASE_LOOK : WARM_LOOK
  } catch {
    return WARM_LOOK
  }
}

export const LOOK: Readonly<LookPalette> = pickLook()

/**
 * Point lights each tier may keep visible. Every visible point light is evaluated in every lit
 * fragment, even at intensity 0, so this is the main real-time lighting cost on phones.
 * - pool: the player-following lamp lights (world.ts creates 6). They already cover the nearest
 *   landmark glow spots, in the same warm colour.
 * - glow: the 10 fixed landmark lights. Ground glow decals still mark every landmark without them.
 * Visibility changes the shader light count, so this is applied only when the tier changes,
 * never per frame (one recompile, like a shadow toggle).
 */
export type LightBudget = { pool: number; glow: boolean }

export const LIGHT_BUDGET: Readonly<Record<Graphics, Readonly<LightBudget>>> = Object.freeze({
  low: Object.freeze({ pool: 3, glow: false }),
  medium: Object.freeze({ pool: 4, glow: false }),
  high: Object.freeze({ pool: 6, glow: true }),
})

export function lightBudget(graphics: Graphics): Readonly<LightBudget> {
  return LIGHT_BUDGET[graphics] ?? LIGHT_BUDGET.high
}
