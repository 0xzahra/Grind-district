// World missions written from Zahra's six-world outline (with Alejandro's review corrections).
// Short cards, then interactive checks: "sort" and "match" chips, and a "slider" for the trilemma tightrope.
import type { Course } from './courses.ts'

const q = (prompt: string, choices: string[], answer: number, hint: string, kind?: 'sort' | 'match' | 'slider') => ({ prompt, choices, answer, hint, ...(kind ? { kind } : {}) })

export const WORLD_COURSES: Course[] = [
  // ---- World 1: The Internet ----
  { id: 'internet', minutes: '1 min', paragraphs: [
    'The internet is a global network of computers and servers. Your phone is one of them. Servers are computers that stay on and answer requests.',
    'When you open a page, your phone asks a server for it. The answer travels back in small packets, and everyone follows the same rules for sending them, called protocols.',
    'People use it to talk, share information, learn, play and buy and sell. No single company owns the whole thing.',
    'Sources: Mozilla MDN, "How does the Internet work?"; the TCP/IP protocol suite.',
  ], questions: [
    q('Connect it: you open a website. Your phone sends the request to…', ['Another phone at random', 'A server that holds the page', 'The bank', 'Nobody, the page is already on your screen'], 1, 'Pages live on servers that answer requests.', 'match'),
    q('Data crosses the internet as:', ['One big file in one go', 'Small packets that follow shared protocols', 'Letters in the post', 'Screenshots'], 1, 'Packets, sent by shared rules.'),
    q('The internet keeps working because:', ['One company runs it', 'Everyone follows shared protocols', 'Phones never go offline', 'It is stored on a blockchain'], 1, 'Shared rules, not one owner.'),
  ] },
  { id: 'money', minutes: '2 min', paragraphs: [
    'Money does three jobs. A medium of exchange: you swap it for things. A unit of account: you price things in it. A store of value: it still buys something later.',
    'It comes in different forms: cash, digital money in a bank or wallet app, and now crypto. Money moved from coins and notes to online payments, and crypto is the newest step.',
    'Ask which of the three jobs something really does before you trust it with savings.',
    'Sources: standard functions of money (for example the Bank of England, "What is money?").',
  ], questions: [
    q('Sort it: "The price tag says ₦5,000" uses money as a…', ['Medium of exchange', 'Unit of account', 'Store of value'], 1, 'Pricing something is the unit-of-account job.', 'sort'),
    q('Sort it: "I paid the tailor with cash" uses money as a…', ['Medium of exchange', 'Unit of account', 'Store of value'], 0, 'Swapping it for a service is the medium-of-exchange job.', 'sort'),
    q('Sort it: "I keep savings for next year" relies on money as a…', ['Medium of exchange', 'Unit of account', 'Store of value'], 2, 'Holding value over time is the store-of-value job.', 'sort'),
  ] },
  { id: 'webEras', minutes: '2 min', paragraphs: [
    'Web 1 (1990s to early 2000s) was read-only: static pages, like a digital library.',
    'Web 2 is the social web: read, write and share. You post and upload, but platforms own the accounts, the data and the rules.',
    'Web 3 is the decentralised web: read, write and own. Wallets and blockchains let users control their own data, assets and identity, and that means you also guard your own keys.',
    'Sources: common read / read-write / read-write-own framing (for example Chris Dixon, "Read Write Own", 2024).',
  ], questions: [
    q('Slide the timeline: which era is "read, write and own"?', ['Web 1', 'Web 2', 'Web 3'], 2, 'Owning assets through a wallet is the Web 3 idea.', 'slider'),
    q('A social app owns your account and can delete it. That is typical of:', ['Web 1', 'Web 2', 'Web 3'], 1, 'Read-write, but the platform owns it: Web 2.', 'sort'),
    q('The price of owning your assets in Web 3 is:', ['Nothing at all', 'You must protect your own keys', 'You must pay a platform monthly', 'You can no longer read pages'], 1, 'Ownership comes with key responsibility.'),
  ] },
  { id: 'w1Boss', minutes: '2 min', paragraphs: [
    'Sorting practice. Sort real examples into Web 1, Web 2 or Web 3.',
    'Web 1 reads. Web 2 reads and writes on someone else\'s platform. Web 3 reads, writes and lets you own.',
    'Get them right and you earn the Netizen badge, which opens World 2.',
    'Sources: the read / read-write / read-write-own framing from Mission 1.3.',
  ], questions: [
    q('A 1990s company page you could only read', ['Web 1', 'Web 2', 'Web 3'], 0, 'Read-only is Web 1.', 'sort'),
    q('Posting a video on a big video platform', ['Web 1', 'Web 2', 'Web 3'], 1, 'Read-write on a platform is Web 2.', 'sort'),
    q('Holding a token in your own wallet', ['Web 1', 'Web 2', 'Web 3'], 2, 'Owning it yourself is Web 3.', 'sort'),
    q('Writing a review on a shopping site', ['Web 1', 'Web 2', 'Web 3'], 1, 'You write, the site owns it: Web 2.', 'sort'),
    q('Voting in a DAO with a governance token you hold', ['Web 1', 'Web 2', 'Web 3'], 2, 'Owned tokens and on-chain votes are Web 3.', 'sort'),
    q('Reading an online encyclopedia page in 1996', ['Web 1', 'Web 2', 'Web 3'], 0, 'Read-only pages are Web 1.', 'sort'),
    q('Sharing photos on a social app', ['Web 1', 'Web 2', 'Web 3'], 1, 'Uploading to a platform is Web 2.', 'sort'),
    q('Holding an onchain name (like an ENS name) in your wallet', ['Web 1', 'Web 2', 'Web 3'], 2, 'You own the name in your wallet: Web 3.', 'sort'),
  ] },
  // ---- World 2: The Scam That Taught Me ----
  { id: 'redFlags', minutes: '2 min', paragraphs: [
    'Every corner of Web3 has the same red flags: pressure to act now, promises of guaranteed profit, and someone asking for your keys or seed phrase.',
    'Fake support accounts, look-alike websites, "airdrop" links that ask you to sign strange approvals, and trading groups that promise signals for a fee all use these tricks.',
    'When something feels urgent and too good, stop. Check the official site yourself and never share a seed phrase with anyone.',
    'Sources: US FTC, "What to know about cryptocurrency and scams"; wallet providers\' own security pages.',
  ], questions: [
    q('Flag it: "Support" messages you first and asks for your seed phrase to fix your wallet.', ['Safe', 'Red flag'], 1, 'Real support never asks for a seed phrase.', 'sort'),
    q('Flag it: a link says "claim your airdrop in 10 minutes or lose it".', ['Safe', 'Red flag'], 1, 'Urgency plus a claim link is a classic trap.', 'sort'),
    q('The best first move when unsure is:', ['Click quickly before it expires', 'Go to the official site yourself and check', 'Ask the sender if it is real', 'Send a small amount to test'], 1, 'Verify through a source you found yourself.'),
  ] },
  { id: 'p2pSharks', minutes: '2 min', paragraphs: [
    'P2P means you trade directly with another person, usually through an exchange that holds the crypto in escrow. OTC means a large trade arranged privately with a dealer.',
    'Sharks try to pull you off the platform: "pay me directly, it is faster". Off-platform you lose the escrow, the dispute process and the record.',
    'Common tricks: fake payment screenshots, reversed bank transfers, and third-party payments from accounts that are not the trader\'s own name.',
    'Sources: major exchanges\' P2P safety guides (escrow, disputes, third-party payment rules).',
  ], questions: [
    q('Roleplay: a buyer says "release the coins, I sent the money, here is the screenshot". You…', ['Release now, a screenshot is proof', 'Check your own bank app for the money first', 'Ask for a second screenshot'], 1, 'Only your own account balance is proof. Screenshots can be faked.'),
    q('Roleplay: a seller asks you to leave the platform and pay them directly for a better rate. The cost is…', ['Nothing, it is just faster', 'You lose escrow and any way to dispute', 'A small fee'], 1, 'Off-platform means no escrow and no dispute.'),
    q('Payment arrives from a name that is not your trade partner\'s. Safest move:', ['Accept it, money is money', 'Do not release; raise it with the platform', 'Split the difference'], 1, 'Third-party payments are a common fraud pattern.'),
  ] },
  { id: 'w2Boss', minutes: '2 min', paragraphs: [
    'The scam inbox. Six messages arrive. Flag the scams and keep the safe ones.',
    'Look for urgency, guaranteed returns, "send first to receive more" and any request for your seed phrase or a signature you do not understand.',
    'Pass and you earn the Scam Shield badge, which unlocks the Wallet missions.',
    'Sources: the red flags from Missions 2.1 to 2.3.',
  ], questions: [
    q('1. "Send 0.1 ETH and get 0.2 ETH back, today only!"', ['Safe', 'Scam'], 1, '"Send first to receive more" is always a scam.', 'sort'),
    q('2. Your exchange app shows a login from your own phone after you logged in.', ['Safe', 'Scam'], 0, 'An expected alert from the app itself is normal.', 'sort'),
    q('3. "Guaranteed 5% a day, our bot never loses."', ['Safe', 'Scam'], 1, 'Guaranteed returns are a red flag.', 'sort'),
    q('4. A DM from "Wallet Support" asking for your 12 words.', ['Safe', 'Scam'], 1, 'Nobody legitimate asks for a seed phrase.', 'sort'),
    q('5. A friend asks to borrow money, but their account has started speaking oddly and wants gift cards.', ['Safe', 'Scam'], 1, 'Hacked accounts often ask for untraceable payment.', 'sort'),
    q('6. Inside the official app, it asks you to confirm a withdrawal you just started.', ['Safe', 'Scam'], 0, 'A confirmation for your own action, in the real app, is normal.', 'sort'),
  ] },
  // ---- World 3: Blockchain Basics ----
  { id: 'chainBlocks', minutes: '2 min', paragraphs: [
    'A blockchain is a shared record made of blocks. Each block holds a batch of transactions and a fingerprint (a hash) of the block before it.',
    'Change one old block and its fingerprint changes, so every block after it no longer matches. The network sees the break and rejects the edited copy.',
    'Thousands of computers keep a copy and agree on the next block, so no single person can quietly rewrite history.',
    'Sources: Bitcoin whitepaper (Nakamoto, 2008); ethereum.org, "Intro to blocks".',
  ], questions: [
    q('Each block links to the one before it by:', ['Its colour', 'The previous block\'s hash', 'A password', 'Its date only'], 1, 'The hash of the previous block is the link.', 'match'),
    q('Someone edits a transaction in an old block. What happens?', ['Nothing, it just updates', 'The hashes after it stop matching and the network rejects it', 'Everyone gets a refund', 'The chain gets faster'], 1, 'A changed block breaks every link after it.'),
    q('Why is it hard for one person to rewrite a public chain?', ['It is password protected', 'Many independent computers hold copies and agree on blocks', 'The government checks it', 'It is stored on one secure server'], 1, 'Many copies, shared agreement.'),
  ] },
  { id: 'chainTraits', minutes: '2 min', paragraphs: [
    'Decentralised: no single owner. Many independent computers (nodes) run the network.',
    'Secure: cryptography and the cost of attacking the network protect the record. Your own wallet is only as secure as your keys.',
    'Transparent: on public chains anyone can read the transactions in a block explorer. Addresses are pseudonymous, not invisible.',
    'Sources: ethereum.org, "What is Ethereum?" and "Nodes and clients".',
  ], questions: [
    q('Match it: "no single company can switch it off"', ['Decentralised', 'Secure', 'Transparent'], 0, 'No single owner is decentralisation.', 'match'),
    q('Match it: "anyone can look up a transaction"', ['Decentralised', 'Secure', 'Transparent'], 2, 'Public readability is transparency.', 'match'),
    q('Match it: "rewriting history would cost an attacker a huge amount"', ['Decentralised', 'Secure', 'Transparent'], 1, 'That is the security of the network.', 'match'),
  ] },
  { id: 'chainTypes', minutes: '2 min', paragraphs: [
    'Public (permissionless) chains are open to anyone: Bitcoin, Ethereum, Litecoin. Monero is public too, with strong privacy features.',
    'Private (permissioned) chains restrict who can join and write, usually inside one company. Hyperledger Fabric is a common example.',
    'Consortium chains are run by a group of organisations, like Energy Web or R3\'s Corda networks. Hybrid chains mix public and private parts, like Dragonchain.',
    'Sources: Hyperledger Foundation (Fabric); getmonero.org; Energy Web; R3; Dragonchain docs.',
  ], questions: [
    q('Match it: Monero is a…', ['Public chain with privacy features', 'Private company chain', 'Consortium chain'], 0, 'Anyone can join Monero. It hides details, but it is public.', 'match'),
    q('Match it: Hyperledger Fabric is mostly used for…', ['Public meme coins', 'Private, permissioned business networks', 'Mining at home'], 1, 'Fabric is the classic private, permissioned example.', 'match'),
    q('Match it: a group of energy companies sharing one ledger', ['Public chain', 'Consortium chain', 'Web 1 site'], 1, 'A group of organisations sharing control is a consortium.', 'match'),
    q('"Permissionless" means:', ['Anyone can join and validate', 'Only one company can write', 'It has no rules'], 0, 'Open to anyone is permissionless.'),
  ] },
  { id: 'chainHistory', minutes: '2 min', paragraphs: [
    'First generation: in 2008 Satoshi Nakamoto published the Bitcoin whitepaper, and the network launched in January 2009. Strangers could share a money ledger without a bank in the middle.',
    'Second generation: Vitalik Buterin\'s Ethereum whitepaper (2013) and launch (2015) added smart contracts and dApps. Then came the 2017 ICO boom and the 2020 DeFi boom.',
    'Third generation (2018 to now) works on scalability, usability and interoperability: more chains, layers and bridges.',
    'Sources: Bitcoin whitepaper (2008); Ethereum whitepaper (2013); ethereum.org history.',
  ], questions: [
    q('Slide the timeline: smart contracts became widely usable with…', ['Bitcoin (2009)', 'Ethereum (2015)', 'Web 1'], 1, 'Ethereum brought general smart contracts.', 'slider'),
    q('A smart contract is:', ['A paper contract scanned to the chain', 'A program on the chain that runs as written', 'A promise from a founder', 'A bank agreement'], 1, 'Code on the chain.'),
    q('Third-generation chains focus on:', ['Scalability, usability and interoperability', 'Printing more coins', 'Removing all fees forever'], 0, 'Making chains faster, easier and connected.'),
  ] },
  { id: 'trilemma', minutes: '2 min', paragraphs: [
    'The trilemma tightrope. A blockchain wants three things: security, scalability (lots of cheap, fast transactions) and decentralisation.',
    'Designs tend to trade one of these off against the other two. Push hard on one and you usually give something up elsewhere.',
    'Layer 2 networks and new designs try to ease the trade-off, but no chain gets all three for free. Pass to earn the Chain Builder badge.',
    'Sources: the blockchain trilemma as described by Vitalik Buterin and ethereum.org, "Scaling".',
  ], questions: [
    q('Slide it: a chain runs on 10 big servers for speed. What did it most likely trade away?', ['Security', 'Scalability', 'Decentralisation'], 2, 'Few powerful nodes is fast but less decentralised.', 'slider'),
    q('Slide it: thousands of home nodes and a small block size. What usually suffers?', ['Security', 'Scalability', 'Decentralisation'], 1, 'Many small nodes keep it decentralised but limit throughput.', 'slider'),
    q('The trilemma says:', ['Every chain maxes all three', 'Designs trade one property off against the other two', 'Only security matters', 'Speed is free'], 1, 'It is a trade-off between the three.'),
  ] },
  // ---- World 4: Layers and Uses ----
  { id: 'layers', minutes: '2 min', paragraphs: [
    'Think of a city map. Layer 1 is the city itself: a base blockchain with its own security, like Bitcoin, Ethereum, Cardano, NEAR or TON.',
    'Layer 2 is an express lane on top of a Layer 1 for cheaper, faster transactions, like Optimism, Arbitrum or Polygon zkEVM. Layer 0 is the road network between cities: base interoperability, like Cosmos.',
    'Layer 3 is application-focused: chains built for one app or use, such as a game.',
    'Sources: ethereum.org, "Layer 2"; Cosmos documentation.',
  ], questions: [
    q('Stack it: Cosmos, which connects many chains, is…', ['Layer 0', 'Layer 1', 'Layer 2', 'Layer 3'], 0, 'Base interoperability is Layer 0.', 'match'),
    q('Stack it: NEAR is a…', ['Layer 0', 'Layer 1', 'Layer 2', 'Layer 3'], 1, 'NEAR is a base chain: Layer 1.', 'match'),
    q('Stack it: Arbitrum, which settles on Ethereum, is…', ['Layer 0', 'Layer 1', 'Layer 2', 'Layer 3'], 2, 'Rollups on Ethereum are Layer 2.', 'match'),
    q('Stack it: a chain made for one game, built on a Layer 2, is…', ['Layer 0', 'Layer 1', 'Layer 2', 'Layer 3'], 3, 'Application-focused chains are Layer 3.', 'match'),
  ] },
  { id: 'apps', minutes: '2 min', paragraphs: [
    'Run a tiny town. Smart contracts are the town rules that run by themselves. dApps are the shops built on them.',
    'DeFi is the town bank without a banker. DEXs are the market stalls for swapping tokens. Stablecoins are the cash that holds a steady price.',
    'NFTs are deeds to one unique thing. DAOs are the town council voting with tokens. Decentralised identity is your ID card that you, not a platform, control.',
    'Sources: ethereum.org pages on smart contracts, DeFi, NFTs, DAOs and decentralised identity.',
  ], questions: [
    q('Match it: the town council votes on how to spend the treasury', ['DAO', 'DEX', 'NFT'], 0, 'Group voting with tokens is a DAO.', 'match'),
    q('Match it: you swap one token for another at a stall with no company in the middle', ['Stablecoin', 'DEX', 'Decentralised identity'], 1, 'That is a decentralised exchange.', 'match'),
    q('Match it: an ID you control, not a platform', ['Decentralised identity', 'Smart contract', 'Stablecoin'], 0, 'Self-controlled identity.', 'match'),
  ] },
  { id: 'useCases', minutes: '2 min', paragraphs: [
    'Use cases are where blockchain applies. Utility is the value it brings there. Applications are the real things built, like crypto, DAOs, DeFi and NFTs.',
    'It is used or piloted in financial services, insurance, healthcare records, supply chains and logistics, IoT, education certificates, e-voting, government records, media rights and sports and esports.',
    'It fits when many parties need one shared record nobody can quietly change. It is a poor fit when one trusted party already keeps the record well.',
    'Sources: World Economic Forum and IBM blockchain case studies.',
  ], questions: [
    q('Match it: tracing where a coffee bag came from', ['Supply chain', 'E-voting', 'Not a blockchain problem'], 0, 'Many parties, one shared trail.', 'match'),
    q('Match it: proving a graduate\'s certificate is real', ['Education', 'Insurance', 'Not a blockchain problem'], 0, 'Verifiable certificates are an education use case.', 'match'),
    q('Match it: a small shop keeping its own private stock list', ['Needs a blockchain', 'Not a blockchain problem'], 1, 'One trusted owner does not need a shared ledger.', 'match'),
  ] },
  { id: 'w4Boss', minutes: '2 min', paragraphs: [
    'Pick the right tool. Five real problems, five Web3 tools.',
    'Smart contracts run rules. Stablecoins hold a steady price. DEXs swap tokens. DAOs let a group vote. NFTs prove ownership of one unique item.',
    'Pass and you earn the Builder\'s Eye badge, which opens World 5.',
    'Sources: Missions 4.1 to 4.3 and the DeFi, stablecoin, NFT and DAO lessons.',
  ], questions: [
    q('Send a family member value that keeps a steady dollar price', ['NFT', 'Stablecoin', 'DAO'], 1, 'A stablecoin targets a steady price.', 'match'),
    q('A club wants members to vote on how to spend a shared fund', ['DAO', 'DEX', 'Layer 0'], 0, 'Group voting on a treasury is a DAO.', 'match'),
    q('Swap one token for another without a company in the middle', ['DEX', 'NFT', 'Private chain'], 0, 'A decentralised exchange.', 'match'),
    q('Prove you own one specific concert ticket', ['Stablecoin', 'NFT', 'DAO'], 1, 'A unique token is an NFT.', 'match'),
    q('Release payment automatically when a delivery is confirmed', ['Smart contract', 'Screenshot', 'Group chat'], 0, 'Rules that run themselves are smart contracts.', 'match'),
  ] },
  // ---- World 5: The Earning Map ----
  { id: 'earnWays', minutes: '2 min', paragraphs: [
    'There are three ways into earning in crypto. Money: you put capital to work, and it can be lost. Skills: you get paid for what you can do. Time: you show up and contribute.',
    'Builders mix all three by making products other people use.',
    'Take the quick "which are you?" check, then open the Earning Map below to explore every branch.',
    'Sources: Zahra\'s Earning Map.',
  ], questions: [
    q('Which are you? You have a little savings, no special skill yet, and an hour a week. Your best way in is…', ['Money first, go big', 'Time and learning first, money small', 'Nothing, give up'], 1, 'Start with time and learning; size money small.'),
    q('Sort it: writing threads and designing graphics for projects', ['Money', 'Skills', 'Time'], 1, 'Getting paid for what you can do is Skills.', 'sort'),
    q('Sort it: joining a testnet and filing bug reports for points', ['Money', 'Skills', 'Time'], 2, 'Showing up and contributing is Time.', 'sort'),
  ] },
  { id: 'web2Skill', minutes: '2 min', paragraphs: [
    'Your Web2 skill already has a Web3 job. A writer becomes a content writer or researcher. A customer support agent becomes a community moderator or support lead.',
    'A designer can make NFT art or product UI. A coder can build dApps, bots and smart contracts. A marketer can do growth and community.',
    'Pick yours and start with one small, public piece of work. Shipped work beats a title.',
    'Sources: common Web3 job board categories (community, content, design, engineering, support).',
  ], questions: [
    q('Match it: you are a writer. Your first Web3 job is likely…', ['Content writer or researcher', 'Validator operator', 'Market maker'], 0, 'Writing maps to content and research.', 'match'),
    q('Match it: you did customer support. Your Web3 job is likely…', ['Community moderator or support', 'Smart-contract auditor', 'Token launcher'], 0, 'Support maps to moderation and support roles.', 'match'),
    q('Match it: you code. Your Web3 path is…', ['dApp or bot builder', 'Only trading', 'Ambassador only'], 0, 'Coding maps to building.', 'match'),
  ] },
  { id: 'timePaths', minutes: '2 min', paragraphs: [
    'Time paths: airdrops, testnets, bounties and ambassador programs. You trade hours, not money.',
    'Be realistic. Most points never turn into much, airdrops are not promised, and many campaigns are farmed by bots. Treat it as a side hustle that builds your name, not a salary.',
    'Never pay to join, never share a seed phrase, and use a separate wallet for campaigns.',
    'Sources: project airdrop terms and public post-mortems of points programs.',
  ], questions: [
    q('A points campaign is…', ['A guaranteed payout', 'A score that may or may not turn into rewards', 'A salary'], 1, 'Points are a score, never a promise.'),
    q('Realistic expectation for time paths:', ['Quit your job next month', 'A side hustle that also builds your reputation', 'Guaranteed $1,000 a week'], 1, 'Side hustle, not a salary.'),
    q('A campaign asks for a joining fee and your seed phrase. You…', ['Pay and share', 'Walk away', 'Pay but keep the seed'], 1, 'Both are red flags from World 2.'),
  ] },
  { id: 'moneyPaths', minutes: '2 min', paragraphs: [
    'Money paths: staking, DeFi, trading and investing. All of them can lose money.',
    'Start with spot: you own the asset and cannot be liquidated. Futures, leverage and complex DeFi come much later, if ever.',
    'Size every position before you buy. A common rule is to risk only a small part of your savings on any single idea, and never money you need for rent or food.',
    'Sources: investor education pages from the US SEC and the UK FCA on crypto risk.',
  ], questions: [
    q('Slide it: how much of your savings would you put into one new token?', ['A small slice you can afford to lose', 'Half', 'Everything'], 0, 'Size small. You can always add later.', 'slider'),
    q('Which comes first for a beginner?', ['Spot', '100x leverage', 'Flash loans'], 0, 'Spot before anything advanced.'),
    q('Staking and DeFi yields are:', ['Guaranteed', 'Variable and carry risks like bugs and depegs', 'Free money'], 1, 'Yields vary and carry risk.'),
  ] },
  { id: 'builderPaths', minutes: '2 min', paragraphs: [
    'Builder paths: dApps, bots, AI tools, and the grants and hackathons that fund them.',
    'Hackathons give deadlines, judges and prizes. Grants fund useful public work. Start small: a bot, a dashboard, a simple dApp.',
    'Ship something real, show it publicly, and keep users\' funds and keys out of your hands unless you know exactly how to protect them.',
    'Sources: ecosystem grant programs and hackathon rules published by major chains.',
  ], questions: [
    q('A good first build is…', ['A small bot or dashboard', 'A new Layer 1 alone', 'A token with no product'], 0, 'Start small and ship.'),
    q('Grants usually fund…', ['Useful public work for an ecosystem', 'Personal trading losses', 'Anything, no questions asked'], 0, 'They fund useful work.'),
    q('Hackathons give you…', ['Deadlines, judges and prizes', 'Guaranteed funding', 'A free audit'], 0, 'Structure and a shot at prizes.'),
  ] },
  { id: 'w5Boss', minutes: '2 min', paragraphs: [
    'Build your own path. Answer a short quiz and pick the safest first step for each player.',
    'Start with what you have. No money? Use skills and time. Some savings? Learn first, start with spot, and size small.',
    'Pass and you earn the Pathfinder badge, which unlocks Careers in the city.',
    'Sources: Missions 5.1 to 5.5 and the Earning Map.',
  ], questions: [
    q('Amina has no savings but writes well. Best first path:', ['Borrow to trade', 'Content and community work (Skills)', 'Run a validator'], 1, 'No capital needed for skills work.'),
    q('Tunde has a few spare hours each week:', ['Bounties, testnets and DAO tasks (Time)', 'Leverage trading', 'Token-launch sniping'], 0, 'Time paths fit spare hours.'),
    q('Chidi codes in his free time:', ['Build a small bot and enter a hackathon (Builder)', 'Put his savings in a meme coin', 'Nothing'], 0, 'Builders ship and compete.'),
    q('A stranger offers to "manage your money for 30% a month". This is:', ['A Money path', 'A scam on the map', 'A grant'], 1, 'Guaranteed high returns are on the map only as a warning.'),
  ] },
]

/** Earning Map from Zahra's tree, grouped Money / Skills / Time / Builder (Content and Web3 jobs are separate branches). */
export const EARNING_MAP: Array<{ group: string; note: string; branches: Array<[string, string[]]> }> = [
  { group: 'Money', note: 'Put capital to work. You can lose it.', branches: [
    ['Trading', ['Spot', 'Swing', 'Day trading', 'Scalping', 'Arbitrage', 'Cross-exchange arbitrage', 'DEX/CEX arbitrage', 'Perpetual futures', 'Options', 'Basis trading', 'Funding-rate arbitrage', 'Market making', 'Grid trading', 'Copy trading', 'MEV']],
    ['Investing', ['Long-term tokens', 'ICOs', 'IDOs', 'IEOs', 'Private and seed rounds', 'Token launches', 'NFT investing', 'Governance tokens', 'Startup investing']],
    ['Staking & DeFi', ['PoS staking', 'Liquid staking', 'Restaking', 'Lending', 'Liquidity providing', 'Yield farming', 'Liquidity mining', 'Stablecoin farming', 'Vaults', 'Leveraged strategies', 'Delta-neutral strategies', 'Yield optimisation']],
    ['P2P & OTC', ['P2P trading', 'OTC trading', 'Stablecoin arbitrage', 'Fiat/on-ramp arbitrage', 'Providing P2P liquidity']],
    ['Advanced onchain strategies (high risk)', ['MEV', 'Liquidation bots', 'Flash-loan strategies', 'Token-launch sniping', 'Bonding-curve arbitrage', 'Cross-chain arbitrage', 'Perpetual funding strategies', 'Options volatility strategies', 'Onchain liquidation strategies']],
  ] },
  { group: 'Skills', note: 'Get paid for what you can do.', branches: [
    ['Content creation & InfoFi', ['Kaito-style campaigns', 'Mindshare rewards', 'Creator campaigns', 'Attention markets', 'Social reputation rewards', 'Content bounties']],
    ['Web3 jobs & services', ['Community management', 'Writing and research', 'Design', 'Development', 'Business development', 'Customer support', 'Moderation']],
    ['Security', ['Bug bounties', 'Smart-contract research', 'Protocol audits', 'Security consulting', 'CTF competitions']],
    ['Crypto businesses', ['Payment processing', 'Accounting', 'Tax services', 'Legal services', 'Consulting', 'OTC brokerage', 'Custody', 'Merchant services', 'Crypto events']],
  ] },
  { group: 'Time', note: 'Show up and contribute.', branches: [
    ['Airdrops', ['Retroactive airdrops', 'Testnet campaigns', 'Mainnet activity', 'Protocol points', 'Early-user rewards', 'Referral campaigns', 'Node rewards', 'DePIN rewards']],
    ['DAOs & communities', ['DAO contributor roles', 'Governance rewards', 'Bounties', 'Community contributor programs', 'Ambassador programs', 'Community moderation']],
    ['Referrals & affiliates', ['Exchange referrals', 'Wallet referrals', 'Protocol referrals', 'Trading-platform affiliates', 'Creator referral programs', 'Invite-based campaigns']],
    ['Grants & competitions', ['Protocol grants', 'Ecosystem grants', 'Hackathons', 'Developer bounties', 'Research grants', 'Creator grants', 'Community grants']],
  ] },
  { group: 'Builder', note: 'Make things other people use.', branches: [
    ['Building products', ['dApps', 'DeFi protocols', 'Trading tools', 'Analytics platforms', 'Bots', 'Wallets', 'Crypto games', 'AI × crypto products', 'SaaS', 'Infrastructure products']],
    ['Infrastructure', ['Validators', 'RPC nodes', 'Archival nodes', 'Indexers', 'Storage', 'Bandwidth', 'Compute', 'Sequencers', 'Relayers', 'Oracles']],
    ['Agentic economy', ['AI agents']],
  ] },
]
export const EARNING_WARNING = 'Scams are not a way to earn. They sit on the map as a warning: World 2 taught you the signs.'
