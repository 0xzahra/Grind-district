import type { SkillId } from './logic.ts'

/** Practice tasks map to real game activity (matched against the activity log). */
export type TaskKind = 'course' | 'trade' | 'conference' | 'bounty' | 'cafe' | 'gym' | 'pledge' | 'robot' | 'any-course'
export type Track = { id: string; title: string; topics: string; lesson: string; risk: string; task: { kind: TaskKind; course?: SkillId; text: string }; courses: SkillId[]; place?: string }

export const RANKS_LADDER = ['Curious', 'Learner', 'Practitioner', 'Skilled', 'Mentor'] as const
export const RANK_STEPS = [0, 1, 3, 6, 10]
export const DISCLAIMER = 'Education only. Not financial advice. Practice runs on in-game balance; nothing here touches real money.'

export const TRACKS: Track[] = [
  { id: 'trading', title: 'Trading', topics: 'Spot · swing · day · grid · copy', lesson: 'Spot means you own the asset outright. Swing trades hold for days to catch a move; day trades open and close the same day. Grid bots place buy and sell orders at fixed steps in a range. Copy trading mirrors another account, including its mistakes.', risk: 'Most short-term traders lose money after fees. Decide your size and exit before entering. Practice here only.', task: { kind: 'trade', text: 'Place a sized trade on the Trading floor practice book.' }, courses: ['spot', 'risk'], place: 'Trading floor' },
  { id: 'investing', title: 'Investing', topics: 'Long-term · launches · NFTs · governance', lesson: 'Long-term investing means holding through cycles based on what a project does, its supply schedule and who holds it. Token launches often unlock large supply to insiders later. Governance tokens give votes, not guaranteed value.', risk: 'Read the vesting and unlock schedule. Many new tokens fall far below launch price.', task: { kind: 'course', course: 'risk', text: 'Pass Risk sizing in the Campus.' }, courses: ['risk', 'daos', 'nfts'], place: 'Campus' },
  { id: 'defi', title: 'Staking & DeFi', topics: 'Staking · liquid staking · lending · LP · stablecoin yield', lesson: 'Staking locks tokens to help secure a proof-of-stake chain for variable rewards. Liquid staking gives a receipt token you can move. Lending pays interest from borrowers; LPs earn swap fees but carry inventory risk. Stablecoin yield comes from someone paying to borrow.', risk: 'Smart-contract bugs, depegs, slashing and impermanent loss are real. If the yield source is unclear, you are the yield.', task: { kind: 'course', course: 'defi', text: 'Pass Intro to DeFi.' }, courses: ['staking', 'defi', 'liquidity', 'stables'], place: 'Campus' },
  { id: 'airdrops', title: 'Airdrops', topics: 'Testnets · points · early-user · referrals · DePIN', lesson: 'Projects sometimes reward early users with tokens. Testnets let you try a chain before launch; points programs track activity; DePIN networks reward hardware that provides coverage, storage or data.', risk: 'Points are a score, never a promise. Never sign unknown approvals or share a seed for an "eligibility check".', task: { kind: 'course', course: 'airdrops', text: 'Pass Airdrops.' }, courses: ['airdrops', 'wallets'], place: 'Campus' },
  { id: 'infofi', title: 'InfoFi', topics: 'Mindshare · creator campaigns · bounties · research', lesson: 'InfoFi platforms reward attention and useful information: mindshare leaderboards, creator campaigns, content bounties and paid research. Quality and original work tend to last longer than volume.', risk: 'Disclose holdings and paid posts. Engagement farming can cost your reputation.', task: { kind: 'bounty', text: 'Post a bounty on Influencer row.' }, courses: ['content', 'community'], place: 'Influencer row' },
  { id: 'prediction', title: 'Prediction markets', topics: 'Forecasting basics (knowledge only)', lesson: 'A prediction market price can be read as the crowd\u2019s probability of an outcome. Good forecasters write down a base rate, update on evidence and track their accuracy over time.', risk: 'Knowledge only. Grind District has no betting. Some places restrict these markets by law.', task: { kind: 'cafe', text: 'Read the café season board and note one claim to check.' }, courses: ['risk'], place: 'Campus café' },
  { id: 'nfts', title: 'NFTs', topics: 'Minting · collections · royalties', lesson: 'Minting creates a token on-chain. Creating a collection means art, a contract, metadata and a licence. Royalties are a creator fee that many marketplaces now treat as optional.', risk: 'Check the contract address and licence. Fake mint sites are a common scam.', task: { kind: 'course', course: 'nfts', text: 'Pass NFT basics.' }, courses: ['nfts', 'scams'], place: 'Campus' },
  { id: 'gaming', title: 'Crypto gaming', topics: 'Game economies · items · guilds', lesson: 'Blockchain games can let players own items as tokens. Sustainable games are fun first; reward-only economies usually shrink when new players stop arriving.', risk: 'Item prices can fall to near zero. Treat game spending as entertainment.', task: { kind: 'gym', text: 'Log a timing set at the Gym (practice focus).' }, courses: ['nfts'], place: 'Gym' },
  { id: 'content', title: 'Content creation', topics: 'X · YouTube · newsletters · podcasts · sponsorships', lesson: 'Creators build an audience with consistent, sourced work, then earn through sponsorships, subscriptions or paid research. Pick one format and ship on a schedule.', risk: 'Disclose sponsorships and holdings. Many regions require it.', task: { kind: 'course', course: 'content', text: 'Pass Content & threads that grow.' }, courses: ['content'], place: 'Influencer row' },
  { id: 'jobs', title: 'Web3 jobs', topics: 'Community · moderation · social · BD · design · writing · support · dev · security', lesson: 'Teams hire for community management, moderation, social media, business development, design, writing, support, smart-contract development and security. A portfolio of shipped work beats a title.', risk: 'Real employers never ask you to pay to start or to send funds to "verify".', task: { kind: 'course', course: 'community', text: 'Pass Community management in Web3.' }, courses: ['community', 'building', 'content'], place: 'Campus' },
  { id: 'building', title: 'Building products', topics: 'dApps · tools · wallets · analytics', lesson: 'Builders ship dApps, wallets, analytics and tools. Start with a real user problem, ship small, and get feedback from people who are not your friends.', risk: 'Audits, key management and legal review matter before handling user funds.', task: { kind: 'course', course: 'building', text: 'Pass Building.' }, courses: ['building', 'agents'], place: 'Campus' },
  { id: 'daos', title: 'DAOs & communities', topics: 'Contributors · governance · bounties', lesson: 'DAOs pay contributors through bounties, grants and roles. Reading proposals, voting and delegating well builds a record.', risk: 'Governance can be captured by large holders. Read before you vote.', task: { kind: 'course', course: 'daos', text: 'Pass DAOs & governance.' }, courses: ['daos', 'community'], place: 'Campus' },
  { id: 'grants', title: 'Grants & hackathons', topics: 'Ecosystem grants · hackathons · bounties', lesson: 'Ecosystems fund builders and researchers with grants and hackathon prizes. Strong applications show a clear scope, milestones and earlier work.', risk: 'Real grant programmes never charge an application fee.', task: { kind: 'conference', text: 'Attend a demo day or talk at the Conference centre.' }, courses: ['building'], place: 'Conference centre' },
  { id: 'infra', title: 'Infrastructure', topics: 'Validators · nodes · overview', lesson: 'Validators produce or attest blocks; RPC and archive nodes serve data to apps. Running them needs uptime, monitoring and security discipline.', risk: 'Validators can be slashed for downtime or double-signing. Hardware and bandwidth cost money.', task: { kind: 'course', course: 'staking', text: 'Pass Staking.' }, courses: ['staking', 'explorer'], place: 'Campus' },
  { id: 'business', title: 'Crypto businesses', topics: 'Payments · accounting · legal · events · custody', lesson: 'Service businesses support the industry: payment processing, accounting and tax, legal, custody, consulting and events. They earn fees for trust and compliance.', risk: 'Licensing rules vary by country. Get local advice.', task: { kind: 'course', course: 'records', text: 'Pass Reading a transfer.' }, courses: ['records', 'custody', 'explorer'], place: 'Campus' },
  { id: 'ai', title: 'AI agents', topics: 'Agents · jobs for agents · disclosure', lesson: 'AI agents can research, post and run tasks on-chain under limits you set. Good agents are labelled, rate-limited and never hold more than they need.', risk: 'Give agents spending limits, not your seed. Review what they sign.', task: { kind: 'robot', text: 'Read Unit 4\u2019s agent label at the plaza.' }, courses: ['agents'], place: 'Plaza' },
  { id: 'scams', title: 'Spot the scam', topics: 'Drainers · fake support · rugs · impersonation', lesson: 'Common scams: fake support DMs, wallet drainers behind "claim" links, rug pulls, impersonated founders and guaranteed-return schemes. Slow down, verify the URL, and read what you sign.', risk: 'No one legitimate needs your seed phrase. Ever.', task: { kind: 'course', course: 'scams', text: 'Pass Spotting scams & rug pulls.' }, courses: ['scams', 'wallets', 'custody'], place: 'Campus' },
]

/** Jobs: 10 levels; 2-3 daily duties tied to buildings. */
export type Job = { id: string; title: string; duties: Array<{ id: string; text: string; kind: TaskKind; place: string }> }
export const JOBS: Job[] = [
  { id: 'speaker', title: 'Event speaker', duties: [{ id: 'podium', text: 'Talk at the conference podium (attend an event)', kind: 'conference', place: 'Conference centre' }, { id: 'prep', text: 'Read the café board for talking points', kind: 'cafe', place: 'Campus café' }] },
  { id: 'community', title: 'Community manager', duties: [{ id: 'post', text: 'Post an update on Influencer row', kind: 'bounty', place: 'Influencer row' }, { id: 'learn', text: 'Pass or review a course in the hall', kind: 'any-course', place: 'Campus' }, { id: 'robot', text: 'Check Unit 4\u2019s agent notice', kind: 'robot', place: 'Plaza' }] },
  { id: 'analyst', title: 'Market analyst', duties: [{ id: 'trade', text: 'Run a sized practice trade', kind: 'trade', place: 'Trading floor' }, { id: 'board', text: 'Read the season board', kind: 'cafe', place: 'Campus café' }] },
  { id: 'researcher', title: 'Researcher', duties: [{ id: 'course', text: 'Pass a course in the Campus', kind: 'any-course', place: 'Campus' }, { id: 'talk', text: 'Sit in on a conference talk', kind: 'conference', place: 'Conference centre' }, { id: 'pledge', text: 'Review a carbon project at the desk', kind: 'pledge', place: 'Carbon desk' }] },
]
export const JOB_LEVELS = ['Intern', 'Junior', 'Associate', 'Mid-level', 'Senior', 'Lead', 'Principal', 'Head', 'Director', 'Partner']
export const JOB_XP_PER_LEVEL = 4

/** Weekly challenges (5-7) pick from this pool, seeded by the week. */
export const WEEKLY_POOL: Array<{ id: string; text: string; kind: TaskKind; count: number }> = [
  { id: 'c2', text: 'Pass 2 courses', kind: 'any-course', count: 2 },
  { id: 't3', text: 'Make 3 practice trades', kind: 'trade', count: 3 },
  { id: 'ev1', text: 'Attend a conference event', kind: 'conference', count: 1 },
  { id: 'b1', text: 'Post a bounty', kind: 'bounty', count: 1 },
  { id: 'cafe2', text: 'Read the café board twice', kind: 'cafe', count: 2 },
  { id: 'gym2', text: 'Log 2 gym sets', kind: 'gym', count: 2 },
  { id: 'robot', text: 'Read the agent label', kind: 'robot', count: 1 },
  { id: 'pledge', text: 'Make a practice pledge', kind: 'pledge', count: 1 },
]

export type Reward = { at: number; id: string; kind: 'tint' | 'frame' | 'house'; label: string; tint?: number }
export const SEASON: Reward[] = [
  { at: 1, id: 'frame-slate', kind: 'frame', label: 'Slate plate frame' },
  { at: 2, id: 'tint-graphite', kind: 'tint', label: 'Graphite shirt', tint: 0x3a3d42 },
  { at: 3, id: 'house-plant', kind: 'house', label: 'Fiddle-leaf plant' },
  { at: 5, id: 'tint-olive', kind: 'tint', label: 'Olive shirt', tint: 0x6b7350 },
  { at: 7, id: 'frame-brass', kind: 'frame', label: 'Brushed brass frame' },
  { at: 9, id: 'house-lamp', kind: 'house', label: 'Walnut reading lamp' },
  { at: 11, id: 'tint-oxblood', kind: 'tint', label: 'Oxblood shirt', tint: 0x6e2a2a },
  { at: 14, id: 'house-rug', kind: 'house', label: 'Wool kilim rug' },
  { at: 17, id: 'frame-gold', kind: 'frame', label: 'Champagne gold frame' },
  { at: 20, id: 'tint-champagne', kind: 'tint', label: 'Champagne shirt', tint: 0xd9c49a },
]
