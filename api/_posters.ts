// Shareable flyers with a public page (/p/<id>): the title and words for the link preview. The picture is
// public/posters/<id>.jpg, made by scripts/flyer-art.mjs from the game's own poster art (src/posters.ts).
// A new flyer goes in both lists with the same id.
export type FlyerPage = { title: string; text: string }

export const FLYER_PAGES: Record<string, FlyerPage> = {
  'mcgrind-1': { title: 'Get hired at McGrind in Grind District', text: 'A 3D city job that pays per shift, with tips for speed. Bear market? Flip burgers, not your bags.' },
  'mcgrind-2': { title: 'McGrind is open day and night', text: 'Grab a meal or work a paid shift in Grind District, a free 3D city. GM. Fries?' },
  'mcgrind-3': { title: 'Get hired at McGrind in Grind District', text: "A 3D city job that pays per shift, with tips for speed. WAGMI: We're All Gonna Make It (fries)." },
  'mcgrind-4': { title: 'Get hired at McGrind in Grind District', text: 'A 3D city job that pays per shift, with tips for speed. No seed phrase needed: just show up and cook.' },
  'mcgrind-5': { title: 'Work shifts at McGrind in Grind District', text: 'A 3D city job that pays per shift. Stack while you wait, invest when the bull comes back.' },
  'mcgrind-6': { title: 'Get hired at McGrind in Grind District', text: 'A 3D city job that pays per shift, with tips for speed. Got rugged? Get hired.' },
  'mcgrind-billboard-1': { title: 'Get hired at McGrind in Grind District', text: 'A 3D city job that pays per shift, with tips for speed. Bear market? Flip burgers, not your bags.' },
  'mcgrind-billboard-2': { title: 'Work a shift at McGrind', text: 'A 3D city job that pays per shift, with tips for speed. Wen bull run? Wen lunch.' },
}
