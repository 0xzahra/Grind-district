import { SKILL_ORDER, type Season, type SkillId } from './logic.ts'

export type Question = {
  prompt: string
  choices: string[]
  answer: number
  hint: string
}

export type Course = {
  id: SkillId
  minutes: string
  paragraphs: string[]
  questions: Question[]
}

export const COURSES: Course[] = [
  {
    id: 'spot',
    minutes: '4 min',
    paragraphs: [
      'Spot means you buy or sell the asset itself, now, at a price someone will actually trade. When the buy fills, you own it. A perp, an IOU, or a promise is a different desk.',
      'The spread is the gap between the best price buyers will pay and the best price sellers will take. Crossing it costs you immediately. Size a small clip before you care about being right.',
    ],
    questions: [
      {
        prompt: 'You buy UNIT on the spot desk and the trade fills. What do you hold?',
        choices: ['A contract that expires Friday', 'The UNIT itself', 'A debt to the house', "Someone else's wallet"],
        answer: 1,
        hint: 'Spot is the asset itself, not a contract and not a debt.',
      },
      {
        prompt: 'The spread is:',
        choices: ['A fee the city adds on every transfer', 'The gap between the best bid and the best offer', 'Proof the trade will profit', 'Your rank'],
        answer: 1,
        hint: 'Look at the gap between what buyers bid and what sellers offer.',
      },
    ],
  },
  {
    id: 'risk',
    minutes: '4 min',
    paragraphs: [
      'Position size is how much of the ledger you put on one idea. Decide it before the story gets loud. A strong opinion can still be the wrong size.',
      'Losing the whole practice ledger on one fill ends the session. A small size lets you stay in the city long enough to learn. The ladder does not score a lucky all-in.',
    ],
    questions: [
      {
        prompt: 'You have $25 of practice funds. A sized first trade is closest to:',
        choices: ['All $25, because conviction', 'About $5 to $10, so a loss is not the end of the day', 'Borrowing to make it $100', 'Waiting for a guarantee'],
        answer: 1,
        hint: 'The point of size is that a loss does not end the day.',
      },
      {
        prompt: 'The price falls after a small buy. The useful read is:',
        choices: ['The lesson failed', 'You were sized so you can still decide again', 'Rank drops to zero', 'The city closes'],
        answer: 1,
        hint: 'Rank does not mark to the last price. Size is what keeps the next decision open.',
      },
    ],
  },
  {
    id: 'staking',
    minutes: '5 min',
    paragraphs: [
      'Staking in proof-of-stake locks coins to help run a network. Rewards are variable. You take lockup, possible penalties, and smart-contract risk. It is not a savings account with a posted rate.',
      'Liquid staking gives you a receipt token you can move while the stake stays locked. That receipt can drift from the coin it claims. Read what the receipt is before you treat it as cash.',
    ],
    questions: [
      {
        prompt: 'Staking rewards are:',
        choices: ['A fixed bank interest rate', 'Variable, and the stake can be locked or penalized', 'Guaranteed by the plaza', 'The same thing as an airdrop'],
        answer: 1,
        hint: 'Variable rewards, plus lockup and penalty risk. Not a bank rate.',
      },
      {
        prompt: 'A liquid staking receipt is:',
        choices: ['Always worth exactly the coin, every second', 'A token that stands for a staked position and can trade at its own price', 'Your seed phrase', 'A rank'],
        answer: 1,
        hint: 'The receipt can move, and its price can drift from the staked coin.',
      },
    ],
  },
  {
    id: 'airdrops',
    minutes: '4 min',
    paragraphs: [
      'Some projects later send tokens to people who used them, tested them, or showed up. A points program is a scoreboard. It is not a promise of a payout.',
      'Never type a seed phrase into a site, a form, or a support chat to claim anything. A real claim does not need your seed. This city will never ask for one.',
    ],
    questions: [
      {
        prompt: 'A points program means:',
        choices: ['You are already owed a payout', 'You have a score a project might, or might not, reward', 'Your rank is now whale', 'The trade is risk-free'],
        answer: 1,
        hint: 'Points are a score. They are not an invoice the project must pay.',
      },
      {
        prompt: 'A claim page asks for your seed phrase. You should:',
        choices: ['Paste it so you do not miss the drop', 'Close it. A real claim does not need your seed', 'Send half the phrase', 'Post it for the timeline to check'],
        answer: 1,
        hint: 'This city will never ask. A real claim will not either.',
      },
    ],
  },
  {
    id: 'memes',
    minutes: '3 min',
    paragraphs: [
      'A memecoin trades on attention. It can double in an hour and go to nearly zero in the next. There is often no cash flow under the joke.',
      'The trenches desk here is practice with wilder swings. Sizing small is the whole skill. A loss does not touch your rank. A story that says you must hurry does not either.',
    ],
    questions: [
      {
        prompt: 'The main thing you are trading in a memecoin is:',
        choices: ["A claim on a company's profits", 'Attention, which can leave', 'An insured deposit', 'Your CV'],
        answer: 1,
        hint: 'Attention moves the price, and attention can leave.',
      },
      {
        prompt: 'The price goes to nearly zero. What happens to your rank?',
        choices: ['It is wiped, because balance is rank', 'Nothing by itself. Rank comes from skill and consistency, not from the mark', 'You are removed from the city', 'Your CV is deleted'],
        answer: 1,
        hint: 'The ladder does not read the practice mark.',
      },
    ],
  },
  {
    id: 'agents',
    minutes: '3 min',
    paragraphs: [
      'An AI agent can watch a task, call tools, and move value if someone gives it permission. In this city an agent is labeled, and it attaches to a robot, not to a person\'s face.',
      'If a figure will not say it is an agent, treat it as a person and do not hand it keys. Unit 4 in the plaza is labeled. That is the standard, not a costume.',
    ],
    questions: [
      {
        prompt: 'Where do agents belong in Grind District?',
        choices: ["Inside a player's head, unlabeled", 'On a robot, with a label', 'Only on the trading floor, in silence', 'They replace the learning center'],
        answer: 1,
        hint: 'Labeled, and on a robot. Unit 4 is the example.',
      },
      {
        prompt: 'An unlabeled figure asks you to approve a signature "for the grind." You:',
        choices: ['Approve quickly', 'Stop. People are not silent agents, and this city does not rush signatures', 'Send your seed to verify them', 'Ignore the ladder'],
        answer: 1,
        hint: 'A person is not an unlabeled agent. Do not rush a signature.',
      },
    ],
  },
  {
    id: 'building',
    minutes: '4 min',
    paragraphs: [
      'The portfolio is proof of work: a course you finished, a bounty you wrote, a pledge you made. It is not a degree, and it is not a balance.',
      'Shipping a small thing beats narrating a large one. Grants and gigs still ask what you did. This city writes that down from the actions, and you can copy it.',
    ],
    questions: [
      {
        prompt: 'Your portfolio here is built from:',
        choices: ['A purchased certificate', 'Actions you actually took in the city', 'Your practice balance alone', 'Follower count'],
        answer: 1,
        hint: 'Actions, not a certificate and not a balance.',
      },
      {
        prompt: 'A strong portfolio line is closest to:',
        choices: ['"I am early"', '"Passed risk sizing. Posted a bounty on Influencer Row. Practice ledger only."', '"Seed phrase available on request"', '"Guaranteed yield"'],
        answer: 1,
        hint: 'Name the work. Leave the seed and the guarantee out.',
      },
    ],
  },
  {
    id: 'carbon',
    minutes: '4 min',
    paragraphs: [
      'A carbon credit is a claim that a project reduced or removed a tonne, against a method and a registry. The claim can be solid or sloppy. Buying one inside a game does not retire a real tonne.',
      'The desk in the grove takes a practice pledge. It records that you showed up for a project. It does not mint an offset. Spending does not move your rank. Reputation notes that you came.',
    ],
    questions: [
      {
        prompt: 'A practice pledge at the carbon desk:',
        choices: ['Retires a real credit on a registry', 'Records that you backed a project inside the game, and says so', 'Increases a token allocation', 'Is required to leave the plaza'],
        answer: 1,
        hint: 'It is a record inside the game. It says so. It does not retire a real tonne.',
      },
      {
        prompt: 'Before you trust a carbon claim outside this city, you want:',
        choices: ['Only the logo', 'The method, the registry, and what the credit actually says', 'A celebrity', 'A memecoin ticker'],
        answer: 1,
        hint: 'Method, registry, and the wording of the claim. Not a logo.',
      },
    ],
  },
]

const BULL = [
  'Floor is bidding the open. Size still matters.',
  'Campus stipend posts are up. Read the course before you size up.',
  'Influencer Row is loud. A bounty is not a thesis.',
  'The mangrove desk has a line. Practice pledges only.',
]

const BEAR = [
  'Green candles left. The street is still open.',
  'Trenches get louder when it hurts. You can walk past them.',
  'Nobody here gets paid for panic. The gym is staffed.',
  'Your CV does not mark to market.',
]

export function courseById(id: SkillId): Course | undefined {
  return COURSES.find((course) => course.id === id)
}

export function headlines(season: Season, day: string): string[] {
  const pool = season === 'bull' ? BULL : BEAR
  const start = [...day].reduce((sum, char) => sum + char.charCodeAt(0), 0) % pool.length
  return [0, 1, 2].map((offset) => pool[(start + offset) % pool.length] ?? pool[0])
}

export function grade(course: Course, picks: number[]): { ok: boolean; hints: string[] } {
  const hints = course.questions.map((question, index) => (picks[index] === question.answer ? '' : question.hint))
  return { ok: hints.every((hint) => hint === ''), hints }
}

export function everySkillHasCourse(): boolean {
  const ids = new Set(COURSES.map((course) => course.id))
  return SKILL_ORDER.every((id) => ids.has(id)) && ids.size === SKILL_ORDER.length
}
