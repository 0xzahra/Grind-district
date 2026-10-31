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
    minutes: '8 min',
    paragraphs: [
      'A spot trade is a trade for the asset itself, for delivery now, at the price someone will actually deal. When a buy of UNIT fills on the spot desk, you hold UNIT. A futures or perpetual contract is a different instrument: it can give you price exposure without handing you the asset.',
      'The bid is the highest price a buyer will pay. The ask, or offer, is the lowest price a seller will accept. The spread is ask minus bid. Crossing it is a cost before any fee. A tight spread usually means a deeper book. A wide spread means it costs more to get in or out, which is common when few people are quoting.',
      'The spot price is the price for that immediate trade. It moves as orders fill. A market order takes the quotes that are already there, so a large order in a thin book can fill at worse prices as it walks up the offers. That gap between the price you saw and the price you got is slippage. A limit order waits for your price or better, and it can also wait forever.',
      'On this street the book is practice UNIT. Owning the clip is not the same thing as being right about the next mark. Size it before you care about the story.',
      'Sources: Investopedia, spot market and bid-ask spread; Crypto.com, spot ownership versus a futures contract.',
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
      {
        prompt: 'A wider spread usually means:',
        choices: ['The book is deeper and cheaper to cross', 'It costs more to get in or out, often because the book is thin', 'The city guarantees the fill', 'Rank moves up'],
        answer: 1,
        hint: 'A wide bid-ask gap is a sign of a thinner market and a higher cost to cross.',
      },
      {
        prompt: 'Slippage is:',
        choices: ['A seed phrase', 'The fill landing away from the price you were looking at', 'A course certificate', 'The stipend'],
        answer: 1,
        hint: 'The fill can walk through several offers when the book is thin or the order is large.',
      },
    ],
  },
  {
    id: 'risk',
    minutes: '10 min',
    paragraphs: [
      'Position size answers how much you can lose if the idea is wrong. Decide that before the story gets loud. Van Tharp’s teaching split is simple: the cash at risk is a fraction of equity, and the number of units is that cash divided by the distance from entry to the stop. A $10,000 account risking 1% can lose $100 on the idea. If the entry is $50 and the stop is $48, each unit risks $2, so the size is 50 units. Those units cost $2,500. The planned loss if the stop is hit is still $100.',
      'The 1% figure is a teaching cap, not a law of markets. Investopedia’s one-percent rule is the same family of advice: keep one idea from ending the account. Many people risk well under 1% while they are new. The percent is the loss if you are stopped, not a promise about the cash you spend to open.',
      'This city’s practice ledger starts at zero. The first Spot pass can put $25 of practice funds on it. One percent of $25 is a quarter, which is smaller than the book will trade. The street’s own first clip is about $5 to $10, so a loss is not the end of the day. That is a size for a tiny ledger. It is not the 1% formula pretending $25 is a trading account.',
      'A strong opinion can still be the wrong size. Losing the whole practice ledger on one fill ends the session. The ladder does not score a lucky all-in, and it does not mark you down for a red close that was sized.',
      'Sources: Van Tharp Institute, position size as cash at risk divided by risk per unit; Investopedia, the one-percent rule as a cap, not a statute.',
    ],
    questions: [
      {
        prompt: 'A $10,000 account risks 1%. Entry is $50, stop is $48. How many units keep the planned loss at $100?',
        choices: ['50', '200', '10,000', '2'],
        answer: 0,
        hint: 'Cash at risk is $100. Each unit can lose $2. 100 divided by 2 is 50.',
      },
      {
        prompt: 'In that example, the $2,500 you spend to open is:',
        choices: ['The amount you have agreed to lose', 'The cost of the units. The planned loss is still the $100 down to the stop', 'Your rank', 'A fee the city keeps'],
        answer: 1,
        hint: 'What you invest and what you risk are different numbers when a stop is in the plan.',
      },
      {
        prompt: 'You have $25 of practice funds. A sized first trade on this street is closest to:',
        choices: ['All $25, because conviction', 'About $5 to $10, so a loss is not the end of the day', 'Borrowing to make it $100', 'Waiting for a guarantee'],
        answer: 1,
        hint: 'The point of size is that a loss does not end the day. One percent of $25 is too small for this book.',
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
    minutes: '10 min',
    paragraphs: [
      'On a proof-of-stake network, staking is how the chain picks who may vote on blocks. Ethereum’s own docs describe it as both the security mechanism and a way to earn rewards for taking part honestly. The ether a validator puts at stake is what makes the vote costly to fake. Rewards are variable. They are not a bank rate posted on a door.',
      'Honesty is enforced with penalties. Going offline misses rewards and can lose a little ether. Provable misbehavior, such as signing two conflicting blocks, can be slashed: part of the stake is destroyed and the validator is removed. A price drop is not slashing. Slashing is a protocol penalty for breaking the rules.',
      'Running a validator yourself on Ethereum means staking 32 ETH, with the penalties above. Pools exist for people who will not do that. A liquid staking token is a receipt. Ethereum.org describes it as a token that stands for staked ether and the rewards, while the underlying stake stays locked with the pool’s validators. You can often sell the receipt on a market. Its price can sit away from the ether it claims, especially when an exit queue is long and people would rather sell than wait.',
      'The receipt adds risks the protocol stake did not have by itself: the pool’s contracts, the pool’s operators, and the chance you sell at a discount because redemption is slow. Read what the receipt is before you treat it as cash.',
      'Sources: ethereum.org, staking and liquid staking; the receipt can trade away from the coin it claims when exits are slow.',
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
      {
        prompt: 'Slashing is:',
        choices: ['Any day the price falls', 'A protocol penalty for provable misbehavior, such as signing two conflicting blocks', 'The spread', 'A course you failed'],
        answer: 1,
        hint: 'Ethereum.org separates a price move from a penalty for breaking validator rules.',
      },
      {
        prompt: 'You want out of a liquid staking token while the exit queue is long. The fast path can be:',
        choices: ['A guaranteed redeem at the full coin, this second', 'Selling the receipt on a market, possibly below the coin it claims', 'Sending your seed to the pool', 'Waiting inside the gym'],
        answer: 1,
        hint: 'Redemption waits on the queue. A market sale does not, and the price can be a discount.',
      },
    ],
  },
  {
    id: 'airdrops',
    minutes: '9 min',
    paragraphs: [
      'An airdrop is a distribution of a real token under rules the project has actually announced. A points program is different. Points are usually an off-chain score for using a product: volume, time, tasks. Galaxy’s write-up of points programs says they often have no stated cash value, and the project may not have said what a point redeems for, or when. A leaderboard is not an invoice.',
      'Until a project publishes the formula, a guess about what a point is worth is a guess about other people’s hopes. Rules can change. Some points never become a token.',
      'Claim pages are where the theft is. Coinbase’s warning is plain: a legitimate campaign does not need your seed phrase or private key. A site that asks you to type either one is the scam, including when the art matches a real project. CoinGecko describes the other hook: a lookalike domain, then a wallet connection that asks you to approve a contract. An unlimited token approval can let that contract move the tokens later. Read the prompt. A signature is not a formality.',
      'This city will never ask for a seed. A real claim will not either. If the only announcement is a hurried post, and the project’s own channels are quiet, leave it.',
      'Sources: Galaxy, crypto points programs; Coinbase, claim-page scams; CoinGecko, seed phrases and unlimited approvals.',
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
      {
        prompt: 'A site matches a project’s art, but the domain is one letter off. You:',
        choices: ['Connect quickly, because the art is right', 'Leave. Lookalike domains are how fake claim pages travel', 'Type the seed to see if it is real', 'Send the link to your cousin to test'],
        answer: 1,
        hint: 'Matching art is not a check. The domain is.',
      },
      {
        prompt: 'An unlimited token approval on a claim page can:',
        choices: ['Only decorate your profile', 'Let that contract move the approved tokens later', 'Raise your rank', 'Retire a carbon credit'],
        answer: 1,
        hint: 'Approving a contract can hand it the right to transfer the token. Read the prompt.',
      },
    ],
  },
  {
    id: 'memes',
    minutes: '8 min',
    paragraphs: [
      'A memecoin is a token wrapped around a joke, a character, or a moment. People buy it for the crowd, the bit, and the chance the crowd gets larger. In February 2025 the SEC’s Division of Corporation Finance described typical meme coins as bought for entertainment and priced by market demand, and said that kind of coin usually does not pay a yield or a claim on a business. That text is a staff statement. It is not a statute, and it does not make a coin safe.',
      'Investor.gov warns about the version that is a pump: promoters tout a coin, the price rises on that attention, and the promoters sell into the buyers. After they sell, the price often collapses. The people who bought the hurry are the ones left in it.',
      'There is often no cash flow under the joke. Attention can double a price in an hour and leave in the next. The trenches desk here is practice, with wilder swings on purpose. Sizing small is the skill. A loss does not touch your rank. A story that says you must hurry does not either.',
      'Sources: SEC staff statement on meme coins, 27 February 2025, which is not a Commission rule; Investor.gov, pump-and-dump warnings.',
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
      {
        prompt: 'Investor.gov’s pump-and-dump warning says the promoters:',
        choices: ['Hold forever with the buyers', 'Tout the coin, then sell into the demand they stirred up', 'Register a savings rate', 'File your course'],
        answer: 1,
        hint: 'The tout pulls buyers in. The sale is the promoters leaving.',
      },
      {
        prompt: 'A staff statement that describes meme coins is:',
        choices: ['A statute that makes the trade safe', 'A description, not a law, and not a floor under the price', 'Your seed phrase', 'Proof of a cash flow'],
        answer: 1,
        hint: 'The February 2025 text is staff. It does not insure the coin.',
      },
    ],
  },
  {
    id: 'agents',
    minutes: '8 min',
    paragraphs: [
      'An agent, in the plain sense, is software that can watch a task and take actions through tools: browse, post, trade, sign. It does not get those tools by magic. A person grants them. If it can move value, that permission is the whole risk.',
      'In this city an agent is labeled, and it stands on a robot, not inside a person’s face. Unit 4 in the plaza is the standard. The plaque says Agent. That is not a costume.',
      'A figure who will not say they are an agent is a person. Treat them as one. Do not hand them a signature because they hurried you, and do not hand them a seed for any reason. An unlabeled request “for the grind” is a reason to stop.',
      'The label is how you tell the tool from the neighbor. The houses on the east row are people. Unit 4 is not.',
      'Sources: the city’s own rule for agents, plus the ordinary definition of a tool-using agent that acts only with the permission it was given.',
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
      {
        prompt: 'An agent can move value when:',
        choices: ['It feels early', 'A person has granted that permission', 'The season is bull', 'The café says so'],
        answer: 1,
        hint: 'Tools and value move only with a grant. The grant is the risk.',
      },
      {
        prompt: 'Someone at a house on the east row is:',
        choices: ['An unlabeled agent', 'A person. The labeled agent in the plaza is Unit 4', 'A liquid staking receipt', 'A carbon credit'],
        answer: 1,
        hint: 'Neighbors are people. Unit 4 is the robot with the label.',
      },
    ],
  },
  {
    id: 'building',
    minutes: '8 min',
    paragraphs: [
      'A portfolio here is a list of things you did: a course you passed, a bounty you wrote, a pledge you made, a set you logged. The city writes those lines from the actions. You can copy them. They are not a degree, and they are not a balance.',
      'People who hire, grant, or collaborate still ask what you finished. A small shipped thing beats a large story that never left the group chat. “Passed risk sizing. Posted a bounty. Practice ledger only.” is a line. “I am early” is not.',
      'Leave the seed phrase out of every line. Leave guaranteed yield out too. The work can be practice and still be real work, as long as the page says it is practice.',
      'The houses count. Knocking on a neighbor’s door, claiming your room, sitting through the campus talk: those are visits and notes. The courses are the spine. Finish one before you narrate ten.',
      'Sources: the city’s profile, which files the CV, resume, and portfolio from actions rather than from a purchased certificate.',
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
      {
        prompt: 'A certificate you could buy without doing the course is:',
        choices: ['The portfolio', 'Not this city’s record. The hall files a pass only after the exercises', 'A VCU', 'Unit 4'],
        answer: 1,
        hint: 'The hall writes the line when you pass. A purchase does not.',
      },
      {
        prompt: 'The better proof of building is:',
        choices: ['A long description of a product that does not exist', 'A small thing you finished and can point at', 'Your practice balance', 'A hurried signature'],
        answer: 1,
        hint: 'Shipped and named. The story of a large unbuilt thing does not file itself.',
      },
    ],
  },
  {
    id: 'carbon',
    minutes: '9 min',
    paragraphs: [
      'A carbon credit is a claim that a project reduced or removed greenhouse gas, measured against a method, checked by someone who is not the project, and recorded on a registry. Verra’s Verified Carbon Unit is one example: one VCU is one metric tonne of carbon dioxide reduced or removed, and the registry tracks issuance and retirement. Gold Standard projects are held to additionality too: the cut is supposed to be below what would have happened without the project.',
      'Additionality, in Verra’s own FAQ, means the reduction or removal came from an activity that would not have happened without the revenue from selling the credits. A first check is that the activity is not already required by law. A logo does not answer that. The method, the registry, and the retirement of a specific serial do.',
      'Buying a practice pledge in this city does not retire a serial number on any registry. The desk records that you backed a named project with practice funds: Lagos mangrove, clean cookstoves, or row trees. It says so. Spending does not move your rank. Reputation notes that you came.',
      'Outside, a credit you cannot match to a method and a retirement is a story. Inside, the pledge is allowed to be a story, because the page never calls it a tonne.',
      'Sources: Verra, a VCU is one tonne and additionality means the activity needed the credit revenue; Gold Standard, additionality against what would have happened otherwise.',
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
      {
        prompt: 'One Verified Carbon Unit, as Verra defines it, is:',
        choices: ['A rank', 'One metric tonne of CO₂ reduced or removed, issued on their registry', 'A liquid staking receipt', 'A practice dollar'],
        answer: 1,
        hint: 'One VCU, one tonne, tracked on the registry. This desk does not issue one.',
      },
      {
        prompt: 'Additionality means the reduction:',
        choices: ['Was already required by law', 'Would not have happened without the credit revenue, and is not just business as usual', 'Is whatever the logo says', 'Moves your rank'],
        answer: 1,
        hint: 'Verra’s FAQ: the activity needed the carbon revenue, and it is not already the law.',
      },
    ],
  },
]

const BULL = [
  'Floor is bidding the open. Size still matters.',
  'Campus stipend posts are up. Read the course before you size up.',
  'Influencer Row is loud. A bounty is not a thesis.',
  'The mangrove desk has a line. Practice pledges only.',
  'The house row is lit. Knock before you size up.',
]

const BEAR = [
  'Green candles left. The street is still open.',
  'Trenches get louder when it hurts. You can walk past them.',
  'Nobody here gets paid for panic. The gym is staffed.',
  'Your CV does not mark to market.',
  'The houses stay open when the marks fall.',
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
