// "Web3 From Zero", the Campus event deck, as the default slides on the lecture boards in the Campus theatres and
// classrooms and on the conference centre's stage screen. The 31 slides are kept here as data and drawn onto a
// canvas in the deck's own look (light paper, deep green ink, green accents, white cards, the same layouts), at
// 1920 x 1080 design units scaled to the board. Pictures come from public/slides (game screenshots from the deck).
// The scam quiz reveals its answers on the second step, as the deck does on click.
import * as THREE from 'three'

type Icon = 'Globe' | 'Users' | 'Chart' | 'Search' | 'PaperPlane' | 'Database' | 'Lock' | 'Activity' | 'Key' | 'Warning' | 'Book' | 'Home' | 'Star' | 'Lightning' | 'Tool' | 'Clock'
type Bg = 'plain' | 'alt' | 'accent'
type Card = { icon?: Icon; tag?: string; big?: string; h?: string; p?: string[]; hl?: boolean }
type Step = { icon?: Icon; tag?: string; year?: string; p: string[] }
type Pic = { src: string; w: number; h: number; phone?: boolean }
type Slide =
  | { k: 'split'; bg?: Bg; eyebrow: string; title: string; h1?: boolean; lead?: string; body?: string; url?: string; terms?: Array<[string, string]>; kw?: number; kSize?: number; foot?: string; pics: Pic[] }
  | { k: 'cards'; bg?: Bg; eyebrow: string; title?: string; statement?: string; lead?: string; cards: Card[]; foot?: string }
  | { k: 'flow'; bg?: Bg; eyebrow: string; title: string; lead?: string; steps: Step[]; arrows: boolean; foot?: string }
  | { k: 'table'; bg?: Bg; eyebrow: string; title: string; cols: number[]; head: string[]; rows: string[][] }
  | { k: 'terms2'; bg?: Bg; eyebrow: string; title: string; left: Array<[string, string]>; right: Array<[string, string]>; kw: number }
  | { k: 'divider'; num: string; title: string; lead: string }
  | { k: 'pills'; bg?: Bg; eyebrow: string; title: string; pills: string[]; go: string }
  | { k: 'quiz'; bg?: Bg; eyebrow: string; title: string; msgs: Array<[string, 'scam' | 'safe']> }

// Rich text: **bold** in ink, [[green]] in the accent green.
export const DECK: Slide[] = [
  { k: 'split', eyebrow: 'Campus Web3 Day', title: 'Web3 From Zero', h1: true, lead: 'The internet, crypto, AI and new ways to earn, explained from the very beginning.', body: '[[Tech & AI]] · [[Modern finance]] · [[Stocks & RWA]]', pics: [{ src: 'city', w: 820, h: 600 }] },
  { k: 'cards', bg: 'alt', eyebrow: 'Today', title: 'Three sessions, one path from zero', cards: [
    { icon: 'Globe', tag: 'Session 1', h: 'Tech & AI', p: ['The internet, crypto, blockchain and AI, in plain words.'] },
    { icon: 'Users', tag: 'Session 2', h: 'Modern finance', p: ['Real ways to earn, jobs for your skills, and how to spot scams.'] },
    { icon: 'Chart', tag: 'Session 3', h: 'Stocks & RWA', p: ['How stocks, gold and property are moving onto the blockchain.'] }] },
  { k: 'cards', eyebrow: 'Before we start', title: 'Three rules that protect your money', cards: [
    { icon: 'Key', h: 'Never share your seed phrase', p: ['Not with “support”, not with a friend. Whoever has it owns your money.'] },
    { icon: 'Warning', h: '“Guaranteed profit” is a lie', p: ['Nobody can promise returns. Anyone who does is selling you something.'] },
    { icon: 'Book', h: 'Learn before you spend', p: ['Today is education, not financial advice. Practise with no money first.'] }] },
  { k: 'divider', num: '01', title: 'Tech & AI', lead: 'From the first internet to money that lives online.' },
  { k: 'flow', eyebrow: 'Start here', title: 'What is the internet?', lead: 'Billions of computers connected together, all speaking the same language.', arrows: true, steps: [
    { icon: 'Search', tag: 'YOU ASK', p: ['Your phone requests a page, like a video or a website.'] },
    { icon: 'PaperPlane', tag: 'IT TRAVELS', p: ['The request is cut into small **packets** that move through cables, towers and satellites.'] },
    { icon: 'Database', tag: 'A SERVER ANSWERS', p: ['A **server**, a computer that stores the page, sends it back in seconds.'] }],
    foot: 'The shared rules every computer follows are called [[protocols]]. They’re why a phone in Kano can load a site hosted in California.' },
  { k: 'flow', bg: 'alt', eyebrow: 'How we got here', title: 'The internet grew up in stages', arrows: false, steps: [
    { year: '1969', tag: 'ARPANET', p: ['Four US university computers link up. The internet is born.'] },
    { year: '1991', tag: 'WEB 1', p: ['The World Wide Web: pages anyone can read.'] },
    { year: '2004+', tag: 'WEB 2', p: ['Social media and apps. Everyone posts, platforms own it.'] },
    { year: '2009', tag: 'BITCOIN', p: ['The first money that runs on the internet with no bank.'] },
    { year: '2015+', tag: 'WEB 3', p: ['Ethereum adds apps on the blockchain. You can own online.'] }],
    foot: 'Each stage gave ordinary people more power: first to [[read]], then to [[write]], now to [[own]].' },
  { k: 'cards', eyebrow: 'Web 1, 2 and 3', title: 'From reading, to posting, to owning', cards: [
    { big: 'Web 1', h: 'Read', p: ['Simple pages, like an online brochure. You could look, but not post.'] },
    { big: 'Web 2', h: 'Read + write', p: ['You post on Instagram, TikTok, X. The company owns your account and audience.'] },
    { big: 'Web 3', h: 'Read + write + own', p: ['You hold your own money, content and identity. No company can freeze them.'] }] },
  { k: 'cards', bg: 'alt', eyebrow: 'Before crypto', title: 'What is money, really?', lead: 'Anything people agree to trust. Cowries, gold, naira notes, numbers in a bank app.', cards: [
    { icon: 'Activity', h: 'Exchange', p: ['You can swap it for food, rent, data.'] },
    { icon: 'Chart', h: 'Measure', p: ['It prices things: this phone costs ₦250,000.'] },
    { icon: 'Lock', h: 'Store', p: ['You can save it and use it later.'] }] },
  { k: 'cards', eyebrow: 'The big word', title: 'What is crypto?', lead: 'Short for [[cryptocurrency]]: digital money protected by maths (cryptography) and recorded on a blockchain instead of in a bank.', cards: [
    { tag: 'Coin', h: 'Has its own blockchain', p: ['Bitcoin (BTC) on Bitcoin. Ether (ETH) on Ethereum. SOL on Solana.'] },
    { tag: 'Token', h: 'Lives on someone else’s chain', p: ['Stablecoins like USDC, project tokens, memecoins. Like a shop inside a mall.'] },
    { tag: 'Stablecoin', h: 'Built to stay at $1', p: ['Used for salaries and payments because the price barely moves.'] }] },
  { k: 'cards', bg: 'alt', eyebrow: 'What is a blockchain?', statement: 'A shared notebook that thousands of computers keep a copy of, and nobody can secretly edit.', cards: [
    { icon: 'Users', h: 'Decentralised', p: ['No single owner. Many computers hold the same record.'] },
    { icon: 'Lock', h: 'Secure', p: ['Changing one page means changing every copy at once.'] },
    { icon: 'Search', h: 'Transparent', p: ['Anyone can look up any payment, any time.'] }] },
  { k: 'flow', eyebrow: 'How it works', title: 'Blocks of records, chained together', arrows: true, steps: [
    { tag: 'BLOCK 1', p: ['Ada pays Tunde 10', '[[Fingerprint #A1]]'] },
    { tag: 'BLOCK 2', p: ['Tunde pays Musa 4', 'Points to #A1', '[[Fingerprint #B7]]'] },
    { tag: 'BLOCK 3', p: ['Musa pays Ngozi 2', 'Points to #B7', '[[Fingerprint #C3]]'] }],
    foot: 'Each block carries the fingerprint (**hash**) of the block before it. Change an old record and every fingerprint after it breaks, so everyone sees the cheating.' },
  { k: 'split', bg: 'alt', eyebrow: 'Wallets and keys', title: 'A crypto wallet is like a house', kw: 280, terms: [
    ['Address', 'Your house address. Safe to share, so people can send you money.'],
    ['Seed phrase', '12 or 24 words: the only key to the door. Share it and you’re robbed.'],
    ['Approval', 'Letting an app spend from your wallet. Read before you sign.']], pics: [{ src: 'wallet', w: 340, h: 736, phone: true }] },
  { k: 'terms2', eyebrow: 'Words you’ll hear everywhere', title: 'The Web3 dictionary, in one slide', kw: 230,
    left: [['Smart contract', 'A program on the blockchain that runs itself: “if paid, then deliver”.'], ['Gas fee', 'The small fee you pay the network to process a transaction.'], ['Exchange', 'Where you buy and sell crypto. CEX: run by a company. DEX: run by smart contracts.'], ['DeFi', 'Decentralised finance: saving, lending and swapping with no bank.']],
    right: [['NFT', 'A one-of-one digital item you own: art, a ticket, a certificate.'], ['DAO', 'An online group that votes on decisions and shares a treasury.'], ['Staking', 'Locking coins to help secure a network, and earning rewards for it.'], ['Airdrop', 'Free tokens a project gives early users. Never pay to “claim” one.']] },
  { k: 'cards', bg: 'alt', eyebrow: 'Layers', title: 'Roads, express lanes, and the shops on them', cards: [
    { big: 'L1', h: 'The main road', p: ['The base blockchain. Secure but can get busy.', '[[Bitcoin, Ethereum, NEAR, Solana]]'] },
    { big: 'L2', h: 'The express lane', p: ['Bundles many payments and settles them on L1. Fees in cents.', '[[Base, Arbitrum, Optimism]]'] },
    { big: 'Apps', h: 'The shops', p: ['What you actually use every day.', '[[Wallets, exchanges, games, NFT markets]]'] }] },
  { k: 'cards', eyebrow: 'AI meets Web3', title: 'AI agents: software that can hold a wallet', lead: 'AI gives it a brain. A wallet gives it hands.', cards: [
    { icon: 'Search', h: 'Research', p: ['Reads markets, news and on-chain data, then summarises.'] },
    { icon: 'Lightning', h: 'Act', p: ['Sends payments, trades or posts, inside limits its owner sets.'] },
    { icon: 'Users', h: 'Work', p: ['Does paid tasks for people, and gets paid on-chain.'] }] },
  { k: 'flow', bg: 'alt', eyebrow: 'Build with AI', title: 'You no longer need a CS degree to build', arrows: true, steps: [
    { tag: '1 · IDEA', p: ['A problem you and your friends actually have'] },
    { tag: '2 · BUILD', p: ['Describe it to an AI coding tool. Test, fix, repeat.'] },
    { tag: '3 · SHIP', p: ['Put it online for free and share the link'] },
    { tag: '4 · GET FUNDED', p: ['Enter hackathons and apply for Web3 grants'] }],
    foot: 'Grind District, the game you’ll play today, was built exactly this way.' },
  { k: 'divider', num: '02', title: 'Modern finance', lead: 'How people actually earn in Web3, get paid, and stay safe.' },
  { k: 'cards', eyebrow: 'The earning map', title: 'Three ways in: money, skills, or time', cards: [
    { icon: 'Chart', h: 'Money', p: ['Trading, investing, staking. Needs savings and discipline. The easiest place to lose it all.'] },
    { icon: 'Tool', h: 'Skills · [[start here]]', p: ['Writing, design, community, research, code. Projects pay you for work, no savings needed.'], hl: true },
    { icon: 'Clock', h: 'Time', p: ['Testnets, bounties, ambassador programs, airdrops. Slow and uncertain, but free to try.'] }] },
  { k: 'table', bg: 'alt', eyebrow: 'Your skill, your job', title: 'The skill you already have is a Web3 job', cols: [0.36, 0.64], head: ['If you can…', 'You could be a…'], rows: [
    ['Write well', 'Content writer, thread writer, docs writer'], ['Run a group chat or page', 'Community manager, moderator, ambassador'], ['Design', 'Brand designer, NFT artist, UI designer'],
    ['Research and analyse', 'Market analyst, researcher'], ['Code, or build with AI', 'Developer, bot builder, product builder'], ['Speak and organise', 'Event host, speaker, partnerships']] },
  { k: 'pills', eyebrow: '16 career tracks', title: 'Pick one to explore first', go: 'All 16 are in Grind District', pills: ['Trading', 'Investing', 'Staking and DeFi', 'Airdrops', 'InfoFi (paid research)', 'NFTs', 'Crypto gaming', 'Content creation', 'Web3 jobs', 'Building products', 'DAOs and communities', 'Grants and hackathons', 'Infrastructure', 'Crypto businesses', 'AI agents', 'Spot the scam'] },
  { k: 'cards', bg: 'alt', eyebrow: 'Getting paid', title: 'Most Web3 work pays in stablecoins', cards: [
    { icon: 'Lock', h: 'What it is', p: ['A token built to stay at $1, like USDC or USDT, backed by reserves.'] },
    { icon: 'Warning', h: 'The catch', p: ['The $1 is a promise, not magic. Stick to the big, audited ones.'] },
    { icon: 'Search', h: 'Check, don’t trust', p: ['Confirm payment by its transaction hash on a block explorer. Screenshots prove nothing.'] }],
    foot: 'Cashing out to naira? Use a known exchange’s P2P with escrow, and never release coins before the money is in your bank.' },
  { k: 'cards', eyebrow: 'Scam shield', title: 'Students are the number-one target', cards: [
    { icon: 'Clock', h: 'Pressure', p: ['“Only 2 spots left!” Urgency stops you thinking.'] },
    { icon: 'Star', h: 'Promises', p: ['Guaranteed or daily returns. Doubling your money.'] },
    { icon: 'Key', h: 'Requests', p: ['Your seed phrase. A “fee” to start a job. A strange link to connect your wallet.'] },
    { icon: 'Users', h: 'P2P traps', p: ['Pay outside escrow. Fake proof. A third person sends the money.'] }] },
  { k: 'quiz', eyebrow: 'Live game', title: 'Scam or safe? Hands up.', msgs: [
    ['“Hi! You’ve been selected for a remote Web3 job. Pay ₦15,000 for onboarding training to start.”', 'scam'],
    ['“Wallet support here. Your account is flagged. Verify by entering your 12-word phrase.”', 'scam'],
    ['“Hackathon results are on our official site. Winners submit a wallet address to receive the prize.”', 'safe'],
    ['“P2P buyer: I sent the money, here’s a screenshot. Please release the coins now, I’m in a hurry.”', 'scam']] },
  { k: 'divider', num: '03', title: 'Stocks & RWA', lead: 'How real-world assets are moving onto the blockchain, and how to invest with a plan.' },
  { k: 'split', eyebrow: 'Start with the basics', title: 'What is a stock?', lead: 'A small slice of a company. Own one share of a company, and you own a tiny part of it.', kw: 250, terms: [
    ['Price goes up', 'when people expect the company to grow and earn more.'], ['Price goes down', 'when they expect it to struggle. Nothing is guaranteed.'], ['Dividends', 'Some companies share part of their profit with owners.']],
    pics: [{ src: 'trading', w: 440, h: 760 }] },
  { k: 'cards', bg: 'alt', eyebrow: 'RWA · Real-world assets', title: 'Tokenization: a token that stands for something real', cards: [
    { icon: 'Chart', h: 'Stocks', p: ['A token that tracks a company share.'] }, { icon: 'Book', h: 'Bonds', p: ['Government or company debt that pays interest.'] },
    { icon: 'Home', h: 'Property', p: ['A building split into many small pieces.'] }, { icon: 'Star', h: 'Gold', p: ['Each token backed by gold in a vault.'] }],
    foot: 'Why students should care: [[small amounts, any time, from your phone]], even without a foreign bank account.' },
  { k: 'table', eyebrow: 'Tokenized stocks vs a normal broker', title: 'Same company, different plumbing', cols: [0.3, 0.35, 0.35], head: ['', 'Normal broker', 'Tokenized stock'], rows: [
    ['Trading hours', 'Market hours only', 'Often 24/7'], ['Smallest amount', 'Can be high', 'Fractions of a share'], ['Who holds the real share', 'A regulated broker', 'The token issuer'],
    ['If the company behind it fails', 'Protections may apply', 'You may lose access'], ['Rules', 'Clear in most countries', 'Still being written']] },
  { k: 'cards', bg: 'alt', eyebrow: 'Mindset', title: 'Trading is not gambling, unless you trade like a gambler', cards: [
    { tag: 'The gambler', p: ['Follows hype and tips', 'Goes all in', 'Chases losses to win them back'] },
    { tag: 'The trader', p: ['Has a plan and a reason to enter', 'Risks a small slice, like 2% of savings', 'Decides the maximum loss [[before]] buying'], hl: true }],
    foot: 'Practise with play money first. Real money comes after your plan works.' },
  { k: 'split', bg: 'accent', eyebrow: 'Sign in and play, free', title: 'Learn all of this as a game', url: 'grinddistrict.app', kw: 90, kSize: 44, terms: [
    ['1', 'Open **grinddistrict.app** on your phone or laptop. No download.'], ['2', 'Sign in with Google, X or email.'], ['3', 'Follow Zahra, your guide, through World 1. Each lesson takes a minute.']],
    foot: '6 worlds · 42 courses · 16 careers · a CV and certificate for every course you pass.', pics: [{ src: 'zahra', w: 300, h: 650, phone: true }, { src: 'campus', w: 300, h: 650, phone: true }] },
  { k: 'split', eyebrow: 'This week', title: 'Your first four steps', kw: 200, terms: [
    ['1 · Learn', 'Finish World 1 and World 2 on grinddistrict.app'], ['2 · Pick', 'Choose one career track that fits a skill you have'], ['3 · Show', 'Post one thread about what you learned today'], ['4 · Join', 'Join one real Web3 community and help first']],
    pics: [{ src: 'certificate', w: 640, h: 456 }] },
  { k: 'split', bg: 'alt', eyebrow: 'Thank you', title: 'Questions?', h1: true, lead: 'Web3 rewards people who learn first. Start free at [[grinddistrict.app]].', pics: [{ src: 'logo', w: 520, h: 520 }] },
]
/** Where each session starts, so neighbouring boards show different parts of the deck. */
export const DECK_START = { cover: 0, tech: 3, finance: 16, rwa: 23 } as const

// ---- the look ----
const C = { paper: '#FBFCF9', alt: '#F1F5EF', accent: '#E3F7EA', ink: '#14201A', muted: '#4A5750', green: '#0A7D47', mint: '#1EC97A', bright: '#1EE88A', line: '#E3E8E0', white: '#FFFFFF' }
const HEAD = '"Space Grotesk", "Inter Variable", Inter, system-ui, sans-serif'
const BODY = '"Inter Variable", Inter, system-ui, sans-serif'
const ICONS: Record<Icon, string> = {
  Globe: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10a15.3 15.3 0 0 1-4 10a15.3 15.3 0 0 1-4-10a15.3 15.3 0 0 1 4-10z',
  Users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8a4 4 0 1 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  Chart: 'M3 3v18h18M7 16l4-5 4 3 5-7',
  Search: 'M11 3a8 8 0 1 0 0 16a8 8 0 1 0 0-16zM21 21l-4.35-4.35',
  PaperPlane: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  Database: 'M3 6c0-1.66 4.03-3 9-3s9 1.34 9 3-4.03 3-9 3-9-1.34-9-3zM21 12c0 1.66-4 3-9 3s-9-1.34-9-3M3 6v12c0 1.66 4 3 9 3s9-1.34 9-3V6',
  Lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  Activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
  Key: 'M7.5 21a5.5 5.5 0 1 0 0-11a5.5 5.5 0 1 0 0 11zM11.4 11.6 21 2M15.5 7.5l3 3M18.5 4.5l2.5 2.5',
  Warning: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  Book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  Home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  Star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  Lightning: 'M13 2 3 14h9l-1 8 10-12h-9z',
  Tool: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z',
  Clock: 'M12 2a10 10 0 1 0 0 20a10 10 0 1 0 0-20zM12 6v6l4 2',
}

// ---- pictures (shared by every board) ----
const pics = new Map<string, HTMLImageElement | null>()
const waiting = new Set<() => void>()
function pic(name: string): HTMLImageElement | null {
  if (!pics.has(name)) {
    pics.set(name, null)
    const img = new Image()
    img.onload = () => { pics.set(name, img); for (const f of waiting) f() }
    img.src = `/slides/${name}.jpg`
  }
  return pics.get(name) ?? null
}

// ---- drawing helpers, in 1920 x 1080 design units ----
type G = CanvasRenderingContext2D
const rr = (g: G, x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); if (typeof g.roundRect === 'function') g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h) }
type Run = { t: string; b: boolean; hl: boolean }
function runs(text: string): Run[] {
  const out: Run[] = []
  const re = /\*\*(.+?)\*\*|\[\[(.+?)\]\]/g
  let at = 0, m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > at) out.push({ t: text.slice(at, m.index), b: false, hl: false })
    out.push({ t: m[1] ?? m[2]!, b: !!m[1], hl: !!m[2] })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push({ t: text.slice(at), b: false, hl: false })
  return out
}
/** Wrap and draw rich text; returns the height used. `draw` false only measures. */
function rich(g: G, text: string, x: number, y: number, maxW: number, o: { size: number; lh: number; color: string; weight?: number; font?: string; draw?: boolean; spacing?: number }): number {
  const font = (bold: boolean) => `${bold ? 700 : (o.weight ?? 400)} ${o.size}px ${o.font ?? BODY}`
  const words: Array<{ w: string; b: boolean; hl: boolean; sp: boolean }> = []
  for (const r of runs(text)) {
    const parts = r.t.split(/(\s+)/)
    parts.forEach((p) => { if (!p) return; if (/^\s+$/.test(p)) words.push({ w: ' ', b: r.b, hl: r.hl, sp: true }); else words.push({ w: p, b: r.b || r.hl, hl: r.hl, sp: false }) })
  }
  const lines: Array<typeof words> = [[]]
  let lw = 0
  for (const wd of words) {
    g.font = font(wd.b)
    const w = g.measureText(wd.w).width
    if (wd.sp) { if (lines[lines.length - 1]!.length) { lines[lines.length - 1]!.push(wd); lw += w } continue }
    if (lw + w > maxW && lines[lines.length - 1]!.length) {
      const last = lines[lines.length - 1]!; while (last.length && last[last.length - 1]!.sp) last.pop()
      lines.push([]); lw = 0
    }
    lines[lines.length - 1]!.push(wd); lw += w
  }
  const lineH = o.size * o.lh
  if (o.draw !== false) {
    g.textBaseline = 'alphabetic'
    lines.forEach((ln, i) => {
      let cx = x
      const by = y + i * lineH + o.size * (0.5 + o.lh / 2) - o.size * 0.18
      for (const wd of ln) { g.font = font(wd.b); g.fillStyle = wd.hl ? C.green : wd.b ? C.ink : o.color; g.fillText(wd.w, cx, by); cx += g.measureText(wd.w).width }
    })
  }
  return lines.length * lineH
}
function eyebrow(g: G, t: string, x: number, y: number): number {
  g.save(); g.font = `600 24px ${BODY}`; g.fillStyle = C.green; g.textBaseline = 'top'
  let cx = x
  for (const ch of t.toUpperCase()) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + 4 }
  g.restore(); return 30
}
function badge(g: G, icon: Icon, x: number, y: number): void {
  g.fillStyle = C.accent; rr(g, x, y, 88, 88, 24); g.fill()
  g.save(); g.translate(x + 20, y + 20); g.scale(2, 2); g.strokeStyle = C.green; g.lineWidth = 2; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke(new Path2D(ICONS[icon])); g.restore()
}
function spaced(g: G, t: string, x: number, y: number, size: number, color: string, gap = 3): void {
  g.font = `600 ${size}px ${BODY}`; g.fillStyle = color; g.textBaseline = 'top'
  let cx = x; for (const ch of t.toUpperCase()) { g.fillText(ch, cx, y); cx += g.measureText(ch).width + gap }
}
/** Heading block: eyebrow, title (or statement), lead. Returns the y below it. */
function head(g: G, s: { eyebrow: string; title?: string; statement?: string; lead?: string; h1?: boolean }, x: number, y: number, w: number): number {
  let cy = y + eyebrow(g, s.eyebrow, x, y) + 20
  if (s.title) cy += rich(g, s.title, x, cy, w, { size: s.h1 ? 112 : 64, lh: s.h1 ? 1.0 : 1.08, color: C.ink, weight: 700, font: HEAD }) + 20
  if (s.statement) cy += rich(g, s.statement, x, cy, w, { size: 64, lh: 1.18, color: C.ink, weight: 700, font: HEAD }) + 20
  if (s.lead) cy += rich(g, s.lead, x, cy, w, { size: 40, lh: 1.35, color: C.muted }) + 20
  return cy - 20
}
function boxCard(g: G, x: number, y: number, w: number, h: number, hl = false, r = 28): void {
  g.save(); g.shadowColor = 'rgba(20, 32, 26, 0.07)'; g.shadowBlur = 32; g.shadowOffsetY = 12
  g.fillStyle = C.white; rr(g, x, y, w, h, r); g.fill(); g.restore()
  g.strokeStyle = hl ? C.mint : C.line; g.lineWidth = 2; rr(g, x + 1, y + 1, w - 2, h - 2, r); g.stroke()
}
function cardContent(g: G, c: Card, x: number, y: number, w: number, draw: boolean): number {
  let cy = y
  const gap = 18
  if (c.icon) { if (draw) badge(g, c.icon, x, cy); cy += 88 + gap }
  if (c.tag) { if (draw) spaced(g, c.tag, x, cy, 24, C.green); cy += 30 + gap }
  if (c.big) { if (draw) { g.font = `700 64px ${HEAD}`; g.fillStyle = C.green; g.textBaseline = 'top'; g.fillText(c.big, x, cy) } cy += 64 + gap }
  if (c.h) cy += rich(g, c.h, x, cy, w, { size: 40, lh: 1.15, color: C.ink, weight: 600, font: HEAD, draw }) + gap
  for (const p of c.p ?? []) cy += rich(g, p, x, cy, w, { size: 30, lh: 1.4, color: C.muted, draw }) + gap
  return cy - gap - y
}
function picture(g: G, p: Pic, x: number, y: number): void {
  const img = pic(p.src), r = p.phone ? 40 : 24
  g.save(); g.shadowColor = 'rgba(20, 32, 26, 0.18)'; g.shadowBlur = 44; g.shadowOffsetY = 22
  g.fillStyle = p.phone ? C.ink : '#dfe6dc'; rr(g, x, y, p.w, p.h, r); g.fill(); g.restore()
  const inset = p.phone ? 10 : 0
  g.save(); rr(g, x + inset, y + inset, p.w - inset * 2, p.h - inset * 2, r - inset); g.clip()
  if (img) {
    const bw = p.w - inset * 2, bh = p.h - inset * 2, k = Math.max(bw / img.width, bh / img.height)
    g.drawImage(img, x + inset + (bw - img.width * k) / 2, y + inset + (bh - img.height * k) / 2, img.width * k, img.height * k)
  }
  g.restore()
}

/** Draw slide `i` (step 1 reveals the quiz answers). */
export function paintSlide(g: G, i: number, step = 0): void {
  const s = DECK[((i % DECK.length) + DECK.length) % DECK.length]!
  const bg = s.k === 'divider' ? 'accent' : s.bg ?? 'plain'
  g.fillStyle = bg === 'alt' ? C.alt : bg === 'accent' ? C.accent : C.paper; g.fillRect(0, 0, 1920, 1080)
  const X = 128, W = 1664
  if (s.k === 'divider') {
    let y = 300
    g.font = `700 200px ${HEAD}`; g.fillStyle = C.green; g.textBaseline = 'top'; g.fillText(s.num, X, y); y += 200
    y += 48 + rich(g, s.title, X, y + 48, W, { size: 112, lh: 1.0, color: C.ink, weight: 700, font: HEAD })
    rich(g, s.lead, X, y + 48, W, { size: 40, lh: 1.35, color: C.muted })
  } else if (s.k === 'cards') {
    let y = head(g, s, X, 128, W) + 48
    const n = s.cards.length, gap = 32, cw = (W - gap * (n - 1)) / n, pad = 44
    const hs = s.cards.map((c) => cardContent(g, c, 0, 0, cw - pad * 2, false))
    const ch = Math.max(...hs) + pad * 2
    s.cards.forEach((c, k) => { const cx = X + k * (cw + gap); boxCard(g, cx, y, cw, ch, c.hl); cardContent(g, c, cx + pad, y + pad, cw - pad * 2, true) })
    y += ch + 48
    if (s.foot) rich(g, s.foot, X, y, W, { size: 32, lh: 1.45, color: C.muted })
  } else if (s.k === 'flow') {
    let y = head(g, s, X, 128, W) + 48
    const n = s.steps.length, aw = s.arrows ? 44 : 0, gap = s.arrows ? 16 : 24, cw = (W - (n - 1) * (aw + gap * (s.arrows ? 2 : 1))) / n, pad = 36
    const content = (st: Step, x: number, yy: number, w: number, draw: boolean) => {
      let cy = yy
      if (st.icon) { if (draw) badge(g, st.icon, x, cy); cy += 88 + 12 }
      if (st.year) { if (draw) { g.font = `700 44px ${HEAD}`; g.fillStyle = C.ink; g.textBaseline = 'top'; g.fillText(st.year, x, cy) } cy += 48 + 12 }
      if (st.tag) { if (draw) spaced(g, st.tag, x, cy, 24, C.green); cy += 30 + 12 }
      for (const p of st.p) cy += rich(g, p, x, cy, w, { size: 28, lh: 1.35, color: C.muted, draw }) + 12
      return cy - 12 - yy
    }
    const ch = Math.max(...s.steps.map((st) => content(st, 0, 0, cw - pad * 2, false))) + pad * 2
    let cx = X
    s.steps.forEach((st, k) => {
      boxCard(g, cx, y, cw, ch, false, 24); content(st, cx + pad, y + pad, cw - pad * 2, true)
      cx += cw
      if (k < n - 1) {
        if (s.arrows) {
          const ax = cx + gap, ay = y + ch / 2
          g.fillStyle = C.mint; g.beginPath(); g.moveTo(ax, ay - 6); g.lineTo(ax + 26, ay - 6); g.lineTo(ax + 26, ay - 12); g.lineTo(ax + 44, ay); g.lineTo(ax + 26, ay + 12); g.lineTo(ax + 26, ay + 6); g.lineTo(ax, ay + 6); g.fill()
          cx += gap * 2 + aw
        } else cx += gap
      }
    })
    y += ch + 48
    if (s.foot) rich(g, s.foot, X, y, W, { size: 32, lh: 1.45, color: C.muted })
  } else if (s.k === 'table') {
    let y = head(g, s, X, 128, W) + 48
    const rowsAll = [s.head, ...s.rows]
    rowsAll.forEach((row, ri) => {
      const hgt = 2.1 * 28
      if (ri === 0) { g.fillStyle = C.accent; g.fillRect(X, y, W, hgt) }
      let cx = X
      row.forEach((cell, ci) => {
        const cw = W * s.cols[ci]!
        g.font = `${ri === 0 ? 700 : ci === 0 ? 600 : 400} 28px ${BODY}`; g.fillStyle = C.ink; g.textBaseline = 'middle'
        g.fillText(cell, cx + 20, y + hgt / 2, cw - 40)
        cx += cw
      })
      y += hgt
      g.fillStyle = C.line; g.fillRect(X, y - 1, W, 2)
    })
  } else if (s.k === 'terms2') {
    const y = head(g, s, X, 128, W) + 48
    const colW = (W - 64) / 2
    for (const [list, x0] of [[s.left, X], [s.right, X + colW + 64]] as const) {
      let cy = y
      for (const [k, v] of list) {
        const vh = rich(g, v, x0 + s.kw + 24, cy, colW - s.kw - 24, { size: 30, lh: 1.35, color: C.muted, draw: false })
        g.font = `600 30px ${BODY}`; g.fillStyle = C.green; g.textBaseline = 'middle'; g.fillText(k, x0, cy + vh / 2, s.kw)
        rich(g, v, x0 + s.kw + 24, cy, colW - s.kw - 24, { size: 30, lh: 1.35, color: C.muted })
        cy += vh + 20
      }
    }
  } else if (s.k === 'pills') {
    const y = head(g, s, X, 128, W) + 48
    const all = [...s.pills, s.go], cols = all.length > 15 ? 4 : 3, gap = 20, pw = (W - gap * (cols - 1)) / cols, ph = 28 * 1.2 + 40
    all.forEach((t, k) => {
      const px = X + (k % cols) * (pw + gap), py = y + Math.floor(k / cols) * (ph + gap), go = k === all.length - 1
      g.fillStyle = go ? C.bright : C.white; rr(g, px, py, pw, ph, 16); g.fill()
      if (!go) { g.strokeStyle = C.line; g.lineWidth = 2; rr(g, px + 1, py + 1, pw - 2, ph - 2, 16); g.stroke() }
      g.font = `${go ? 600 : 400} 28px ${BODY}`; g.fillStyle = go ? '#0A0F0C' : C.ink; g.textBaseline = 'middle'; g.fillText(t, px + 28, py + ph / 2, pw - 56)
    })
  } else if (s.k === 'quiz') {
    let y = head(g, s, X, 128, W) + 32
    for (const [t, v] of s.msgs) {
      const vw = v === 'scam' ? 132 : 120
      const th = rich(g, t, X + 40, y + 30, W - 80 - vw - 32, { size: 28, lh: 1.35, color: C.ink, draw: false })
      const bh = th + 60
      g.fillStyle = C.white; rr(g, X, y, W, bh, 20); g.fill(); g.strokeStyle = C.line; g.lineWidth = 2; rr(g, X + 1, y + 1, W - 2, bh - 2, 20); g.stroke()
      rich(g, t, X + 40, y + 30, W - 80 - vw - 32, { size: 28, lh: 1.35, color: C.ink })
      if (step > 0) {
        const px = X + W - 40 - vw, py = y + bh / 2 - 28
        g.fillStyle = v === 'scam' ? '#FFE1D4' : '#D3F5E2'; rr(g, px, py, vw, 56, 28); g.fill()
        g.font = `600 28px ${BODY}`; g.fillStyle = v === 'scam' ? '#8A2A06' : '#075A33'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(v === 'scam' ? 'Scam' : 'Safe', px + vw / 2, py + 29); g.textAlign = 'left'
      }
      y += bh + 20
    }
  } else if (s.k === 'split') {
    const picW = s.pics.reduce((a, p) => a + p.w, 0) + (s.pics.length - 1) * 28
    const tw = W - picW - 80
    // Measure the text column to centre it against the picture.
    const measure = (draw: boolean, y0: number) => {
      let y = y0
      y += eyebrow(g, s.eyebrow, draw ? X : -9999, y) + 32
      y += rich(g, s.title, X, y, tw, { size: s.h1 ? 112 : 64, lh: s.h1 ? 1.0 : 1.08, color: C.ink, weight: 700, font: HEAD, draw }) + 32
      if (s.url) {
        g.font = `700 64px ${HEAD}`; const uw = g.measureText(s.url).width + 80
        if (draw) { g.fillStyle = C.bright; rr(g, X, y, uw, 64 * 1.2 + 32, 20); g.fill(); g.fillStyle = '#0A0F0C'; g.textBaseline = 'middle'; g.fillText(s.url, X + 40, y + (64 * 1.2 + 32) / 2) }
        y += 64 * 1.2 + 32 + 32
      }
      if (s.lead) y += rich(g, s.lead, X, y, tw, { size: 40, lh: 1.35, color: C.muted, draw }) + 32
      if (s.terms) {
        for (const [k, v] of s.terms) {
          const kw = s.kw ?? 280, vh = rich(g, v, X + kw + 24, y, tw - kw - 24, { size: 30, lh: 1.35, color: C.muted, draw: false })
          if (draw) { g.font = `600 ${s.kSize ?? 30}px ${BODY}`; g.fillStyle = C.green; g.textBaseline = 'middle'; g.fillText(k, X, y + vh / 2, kw); rich(g, v, X + kw + 24, y, tw - kw - 24, { size: 30, lh: 1.35, color: C.muted }) }
          y += Math.max(vh, s.kSize ?? 0) + 20
        }
        y += 12
      }
      if (s.body) y += rich(g, s.body, X, y, tw, { size: 32, lh: 1.45, color: C.muted, draw }) + 32
      if (s.foot) y += rich(g, s.foot, X, y, tw, { size: 32, lh: 1.45, color: C.muted, draw }) + 32
      return y - 32 - y0
    }
    const th = measure(false, 0), ph = Math.max(...s.pics.map((p) => p.h))
    const top = 128 + Math.max(0, (824 - th) / 2)
    measure(true, Math.min(top, 128 + Math.max(0, (824 - th) / 2)))
    let px = X + W - picW
    for (const p of s.pics) { picture(g, p, px, 128 + (824 - ph) / 2 + (ph - p.h) / 2); px += p.w + 28 }
  }
  // A quiet footer: the deck's name and the slide number.
  g.font = `500 22px ${BODY}`; g.fillStyle = 'rgba(74, 87, 80, 0.7)'; g.textBaseline = 'alphabetic'; g.textAlign = 'right'
  g.fillText(`Web3 From Zero · ${(((i % DECK.length) + DECK.length) % DECK.length) + 1} / ${DECK.length}`, 1920 - 64, 1080 - 40)
  g.textAlign = 'left'
}

/** A board that shows the deck from slide `start`. `next()` moves on a step (a quiz reveals, then moves). */
export function deckBoard(o: { width: number; start: number }): { tex: THREE.CanvasTexture; next: () => number; paint: () => void } {
  const cv = document.createElement('canvas'); cv.width = o.width; cv.height = Math.round((o.width * 9) / 16)
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4
  let k = o.start, step = 0
  const paint = () => {
    const g = cv.getContext('2d')!
    g.setTransform(cv.width / 1920, 0, 0, cv.height / 1080, 0, 0)
    paintSlide(g, k, step)
    g.setTransform(1, 0, 0, 1, 0, 0)
    tex.needsUpdate = true
  }
  waiting.add(paint) // repaint once the slide pictures arrive
  paint()
  return {
    tex, paint,
    next: () => {
      const s = DECK[k % DECK.length]!
      if (s.k === 'quiz' && step === 0) step = 1; else { k = (k + 1) % DECK.length; step = 0 }
      paint(); return k
    },
  }
}
