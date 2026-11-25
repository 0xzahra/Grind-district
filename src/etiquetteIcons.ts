// Line icons for the Etiquette House: one per class, drawn to match what the class teaches (a place setting for
// the table, a bow tie for dress codes, a plumb line for posture...). Fixed strings drawn in currentColor, so a
// tile tints them gold for the paid masterclasses and mint for the free classes.
const P = (body: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

export const ETIQUETTE_ICONS: Record<string, string> = {
  // The house crest: a laurel round a key.
  crest: P('<path d="M6.2 18.5C3.6 16.6 2.5 13.4 3.2 10.3M4.2 15.6l-1.6.4M3.4 12.6l-1.5-.3M3.9 9.7l-1.2-.8"/><path d="M17.8 18.5c2.6-1.9 3.7-5.1 3-8.2M19.8 15.6l1.6.4M20.6 12.6l1.5-.3M20.1 9.7l1.2-.8"/><circle cx="12" cy="8.2" r="2.6"/><path d="M12 10.8v8.2M12 15.2h2.2M12 17.4h1.6"/><path d="M8.2 21h7.6"/>'),
  // Free classes
  intro: P('<circle cx="8" cy="8.2" r="2.6"/><circle cx="16" cy="8.2" r="2.6"/><path d="M3.4 18.6c.6-3 2.4-4.7 4.6-4.7s4 1.7 4.6 4.7"/><path d="M11.4 18.6c.6-3 2.4-4.7 4.6-4.7s4 1.7 4.6 4.7"/>'),
  table: P('<path d="M6.5 3v4.6a2.2 2.2 0 0 0 4.4 0V3M8.7 3v4.2M8.7 9.8V21"/><path d="M16.6 21V3c2 1.3 3.2 3.8 3.2 6.8 0 2-1.1 3.2-3.2 3.2"/>'),
  dress: P('<path d="M2.8 8.3l7.4 3.7-7.4 3.7z"/><path d="M21.2 8.3l-7.4 3.7 7.4 3.7z"/><rect x="10.2" y="10.2" width="3.6" height="3.6" rx="1"/>'),
  talk: P('<path d="M4 4.5h10a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9.2l-3.6 3v-3H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2z"/><path d="M18.5 8.5H20a2 2 0 0 1 2 2v4.2a2 2 0 0 1-2 2h-1.2v2.8l-3.4-2.8h-3"/>'),
  thanks: P('<rect x="2.8" y="5.5" width="18.4" height="13" rx="2"/><path d="M3.4 6.6l8.6 6.3 8.6-6.3"/><path d="M12 17.2l-1.6-1.5a1 1 0 0 1 1.6-1.2 1 1 0 0 1 1.6 1.2z"/>'),
  calm: P('<path d="M12 18.4c-3.6 0-6.6-2.3-7.6-5.6 2.7-.2 5.4.8 7.6 3 2.2-2.2 4.9-3.2 7.6-3-1 3.3-4 5.6-7.6 5.6z"/><path d="M12 15.6c-1.6-1.6-2.4-3.6-2.4-5.6S10.4 6 12 4.4c1.6 1.6 2.4 3.6 2.4 5.6s-.8 4-2.4 5.6z"/><path d="M5 21h14"/>'),
  influence: P('<path d="M12 2.8l7.4 2.9v5.6c0 4.6-3.1 8.4-7.4 10-4.3-1.6-7.4-5.4-7.4-10V5.7z"/><path d="M8.6 12.1l2.4 2.4 4.4-4.6"/>'),
  // Society Masterclasses (paid)
  mindset: P('<path d="M3.5 20.5h17"/><path d="M6.5 20.5v-3.5M10.5 20.5v-6M14.5 20.5v-4.5M18.5 20.5V11"/><path d="M4.5 11.5l4.8-4.3 3.6 3 6.4-6.4"/><path d="M15.6 3.8h3.7v3.7"/>'),
  quiet: P('<path d="M6.6 4h10.8l3.6 5.2L12 20.4 3 9.2z"/><path d="M3 9.2h18M9.6 4L12 9.2 14.4 4M8 9.2l4 11.2 4-11.2"/>'),
  signal: P('<path d="M2.4 12S6 5.4 12 5.4 21.6 12 21.6 12 18 18.6 12 18.6 2.4 12 2.4 12z"/><circle cx="12" cy="12" r="3.1"/><circle cx="13.1" cy="10.9" r=".7" fill="currentColor" stroke="none"/>'),
  dining: P('<path d="M4.2 16.6a7.8 7.8 0 0 1 15.6 0"/><path d="M2.6 16.6h18.8"/><circle cx="12" cy="7.4" r="1.2"/><path d="M4 19.6h16"/>'),
  room: P('<circle cx="12" cy="7.4" r="2.6"/><path d="M7 19.4c.5-3.3 2.6-5.1 5-5.1s4.5 1.8 5 5.1"/><circle cx="5.4" cy="9.6" r="2"/><path d="M1.8 18c.3-2.4 1.7-3.7 3.6-3.7.9 0 1.7.3 2.3.9"/><circle cx="18.6" cy="9.6" r="2"/><path d="M22.2 18c-.3-2.4-1.7-3.7-3.6-3.7-.9 0-1.7.3-2.3.9"/>'),
  presence: P('<rect x="9" y="2.8" width="6" height="11" rx="3"/><path d="M5.6 10.8a6.4 6.4 0 0 0 12.8 0M12 17.2v3.8M8.6 21h6.8"/>'),
  travel: P('<path d="M10.6 3.6c0-.8.6-1.5 1.4-1.5s1.4.7 1.4 1.5v5.6l7.4 4.4v2.1l-7.4-2.4v4.6l2.1 1.6v1.7L12 20.4l-3.5.9v-1.7l2.1-1.6v-4.6l-7.4 2.4v-2.1l7.4-4.4z"/>'),
  deals: P('<path d="M12 3.4v17.2M7.4 20.6h9.2M4.8 6.4h14.4"/><circle cx="12" cy="3.4" r=".9"/><path d="M4.8 6.4l-2.8 6.4a2.8 2.8 0 0 0 5.6 0zM19.2 6.4l-2.8 6.4a2.8 2.8 0 0 0 5.6 0z"/>'),
  posture: P('<circle cx="11" cy="4.4" r="2"/><path d="M11 6.9v7.4M11 14.3l-2.4 6.6M11 14.3l2.4 6.6M7.2 10.2l3.8-1.7 3.8 1.7"/><path d="M18.6 2.6v18.8" stroke-dasharray="1.4 2.1"/><path d="M17.2 21.4h2.8"/>'),
}

/** A round medallion holding the icon for `id` (empty for an unknown id). */
export function etiquetteIcon(id: string, cls = 'et-ico'): HTMLElement {
  const n = document.createElement('span')
  n.className = cls
  n.innerHTML = ETIQUETTE_ICONS[id] ?? ''
  return n
}
