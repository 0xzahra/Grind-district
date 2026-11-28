// Small chain marks for the certificate mint dialog: drawn here as simple inline SVG (no network, no image files),
// in each chain's brand colour. Client only.
const svg = (body: string) => `<svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false">${body}</svg>`

export const CHAIN_LOGOS: Record<string, string> = {
  base: svg('<rect x="2" y="2" width="28" height="28" rx="8" fill="#0052ff"/><rect x="9" y="9" width="14" height="14" rx="2.5" fill="#fff"/>'),
  arbitrum: svg('<path d="M16 1.8 28.3 8.9v14.2L16 30.2 3.7 23.1V8.9z" fill="#213147"/><path d="M16 5.6 25 10.8v10.4L16 26.4 7 21.2V10.8z" fill="none" stroke="#9dcced" stroke-width="1.2"/><path d="m12.2 22.4 5.1-13.6h2.4l5 13.4-2.2 1.2-4-10.9-4 11.1z" fill="#28a0f0"/><path d="m9.6 21 4.6-12.2h2.3l-4.8 12.9z" fill="#fff"/>'),
  optimism: svg('<circle cx="16" cy="16" r="14" fill="#ff0420"/><text x="16" y="20.4" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-style="italic" font-size="12.5" fill="#fff">OP</text>'),
  robinhood: svg('<circle cx="16" cy="16" r="14" fill="#101411"/><path d="M10 24c1.5-6.8 5.6-12.6 13.2-16.2-1.2 3.6-3.1 6.4-5.6 8.4 1.9-.2 3.4-.8 4.6-1.8-1.9 4.5-5.7 7.3-11.1 7.6z" fill="#ccff00"/><path d="M9.2 25.2 15.6 15" stroke="#ccff00" stroke-width="1.4" stroke-linecap="round"/>'),
  polygon: svg('<rect x="2" y="2" width="28" height="28" rx="8" fill="#8247e5"/><path d="M19.6 12.4 16.6 10.7a1.2 1.2 0 0 0-1.2 0l-3 1.7a1.2 1.2 0 0 0-.6 1v3.5l-1.6.9-1.6-.9v-1.9l1.6-.9 1 .6v-1.6l-.4-.2a1.2 1.2 0 0 0-1.2 0l-2 1.2a1.2 1.2 0 0 0-.6 1v2.3a1.2 1.2 0 0 0 .6 1l2 1.2a1.2 1.2 0 0 0 1.2 0l2-1.1a1.2 1.2 0 0 0 .6-1v-3.5l1.6-.9 1.6.9v1.9l-1.6.9-1-.6v1.6l.4.2a1.2 1.2 0 0 0 1.2 0l2-1.2a1.2 1.2 0 0 0 .6-1v-2.3" fill="none" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" transform="translate(2.2 1)"/>'),
  bsc: svg('<circle cx="16" cy="16" r="14" fill="#f0b90b"/><g fill="#1e2026"><path d="m16 7.2 2.9 2.9-2.9 2.9-2.9-2.9z"/><path d="m16 19 2.9 2.9-2.9 2.9-2.9-2.9z"/><path d="m10.1 13.1 2.9 2.9-2.9 2.9-2.9-2.9z"/><path d="m21.9 13.1 2.9 2.9-2.9 2.9-2.9-2.9z"/><path d="m16 13.6 2.4 2.4-2.4 2.4-2.4-2.4z"/></g>'),
  near: svg('<rect x="2" y="2" width="28" height="28" rx="8" fill="#0b0d0e"/><path d="M10 23V9h1.6l8.4 10.6V9H22v14h-1.6L12 12.4V23z" fill="#fff"/>'),
}
