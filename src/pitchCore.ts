// The Pitch (pitch.ts): the scenario's words and numbers, kept pure so the checks can read them.
// A promoter outside the Conference Centre pushes a coin that "can't lose". Asking questions uncovers the red
// flags; walking away is the win; buying in (practice money only) shows the pump, a sell that fails (a honeypot)
// and the creator pulling the liquidity. The coin, the promoter and every line are made up for Grind District.

export type Coin = { name: string; sym: string }
/** A new coin each day: the same promoter is back tomorrow with a fresh name (serial ruggers do exactly this). */
export const COINS: Coin[] = [
  { name: 'SkyRise', sym: 'SKY' },
  { name: 'NovaPup', sym: 'NPUP' },
  { name: 'Lambo Lane', sym: 'LANE' },
  { name: 'GoldRush AI', sym: 'GRAI' },
  { name: 'MoonVault', sym: 'MVLT' },
]
export const PROMOTER = 'Dex Sterling'
export const dayIndex = (now = Date.now()): number => Math.floor(now / 86_400_000)
export const coinOfDay = (day: number): Coin => COINS[((day % COINS.length) + COINS.length) % COINS.length]!

/** What he says before you ask anything. Three red flags are already in it. */
export const pitchLines = (c: Coin): string[] => [
  `Yo, you look early. ${c.name} is the next hundred-x.`,
  'Presale closes in nine minutes, so this is your moment.',
  'My guy bought a Lambo off the last one. You literally cannot lose.',
]

export type Flag = { id: string; flag: string; why: string }
/** Red flags in the pitch itself. */
export const PITCH_FLAGS: Flag[] = [
  { id: 'urgency', flag: 'Fake urgency', why: '"Closes in nine minutes" is there to stop you checking. A real opportunity survives a day of research.' },
  { id: 'guarantee', flag: 'Guaranteed returns', why: '"Cannot lose" is never true of anything that can go up.' },
  { id: 'flex', flag: 'Lifestyle flex', why: 'Lambo stories sell a feeling, not a product.' },
]
/** Questions you can ask him; each answer gives away one more red flag. */
export const QUESTIONS: Array<Flag & { ask: string; answer: string }> = [
  { id: 'team', ask: 'Who is on the team?', answer: 'Anon. Privacy, you know? Trust me, they are geniuses.', flag: 'Anonymous team', why: 'No names and no track record: nobody to hold to account when it goes wrong.' },
  { id: 'liquidity', ask: 'Is the liquidity locked?', answer: 'It will be. After launch. Probably.', flag: 'Liquidity not locked', why: 'Unlocked liquidity means the creator can pull the pool and leave you holding a token nobody can buy.' },
  { id: 'supply', ask: 'Who holds the supply?', answer: 'Me and two friends. Like ninety percent. We are long-term, I swear.', flag: 'Supply in three wallets', why: 'When a few wallets hold almost everything, they can sell into your buy. Check the holders on a block explorer.' },
  { id: 'product', ask: 'What does it actually do?', answer: 'Do? It goes up. That is the product.', flag: 'No product, only price', why: 'If the only use is "number go up", the only buyers are the next people who believe the pitch.' },
  { id: 'sell', ask: 'Can I sell whenever I want?', answer: 'Why would you sell? We are going to the moon.', flag: 'Dodges whether you can sell', why: 'Many rug pulls are honeypots: the contract lets you buy but blocks selling. Test a tiny sell, or a honeypot checker, first.' },
]
export const ALL_FLAGS = PITCH_FLAGS.length + QUESTIONS.length

/** Practice stakes, in in-game dollars. */
export const STAKES = [20, 50, 100]

/** When the creator pulls the liquidity, in seconds after you buy (13 to 19 s, varied by the run). */
export const rugTime = (seed: number): number => 13 + Math.abs(Math.sin(seed * 12.9898)) * 6

/** Price as a multiple of your buy price, t seconds after buying: a pump, then the rug at rugAt. */
export function priceAt(t: number, rugAt: number): number {
  const pump = (s: number) => Math.max(0.85, 1 + 1.7 * (1 - Math.exp(-s / 5)) + 0.07 * Math.sin(s * 2.3) + 0.04 * Math.sin(s * 5.1))
  if (t < rugAt) return pump(Math.max(0, t))
  const k = Math.min(1, (t - rugAt) / 1.2)
  return pump(rugAt) * (1 - k) + 0.004 * k
}

/** Reputation for finishing the scenario (once a day): walking away is the win, more so after asking questions. */
export const reputationFor = (outcome: 'walked' | 'rugged', asked: number): number => (outcome === 'walked' ? (asked >= 3 ? 5 : 3) : 1)
