// Shareable flyers with a public page (/p/<id>): the title and words for the link preview. The picture is
// public/posters/<id>.jpg, made by scripts/flyer-art.mjs from the game's own poster art (src/posters.ts).
// A new flyer goes in both lists with the same id.
export type FlyerPage = { title: string; text: string }

export const FLYER_PAGES: Record<string, FlyerPage> = {
  'mcgrind-1': { title: 'Bear market? McGrind is hiring.', text: 'Flip burgers, not your bags. Day and night shifts in Grind District.' },
  'mcgrind-2': { title: 'GM. Fries? McGrind is open day and night.', text: 'Burgers, shawarma, shakes and boba in Grind District.' },
  'mcgrind-3': { title: "WAGMI: We're All Gonna Make It (fries)", text: 'Paid every shift, tips for speed. McGrind is hiring in Grind District.' },
  'mcgrind-4': { title: 'No seed phrase needed. Just show up and cook.', text: 'The McGrind kitchen is hiring in Grind District.' },
  'mcgrind-5': { title: 'Stack while you wait.', text: 'Save from every McGrind shift. Invest when the bull comes back.' },
  'mcgrind-6': { title: 'Got rugged? Get hired.', text: 'McGrind shifts by the Campus café, all day, all night.' },
  'mcgrind-billboard-1': { title: 'Bear market? McGrind is hiring.', text: 'Flip burgers, not your bags. Paid every shift, by the Campus café.' },
  'mcgrind-billboard-2': { title: 'Wen bull run? Wen lunch.', text: 'Work a shift at McGrind, stack your pay, invest when the market turns.' },
}
