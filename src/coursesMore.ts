import type { Course } from './courses.ts'

const q = (prompt: string, choices: string[], answer: number, hint: string) => ({ prompt, choices, answer, hint })

/** Eight on-chain skills a non-coder can learn. Plain facts, not financial advice. */
export const MORE_COURSES: Course[] = [
  {
    id: 'wallets', minutes: '7 min',
    paragraphs: [
      'A self-custody wallet is an app that holds your private keys. The keys sign transactions. The coins stay on the chain; the wallet is how you prove they are yours.',
      'The seed phrase (recovery phrase) is 12 or 24 words that can rebuild every key in the wallet. Anyone who has those words has the wallet. Write it on paper, keep it offline, and never type it into a website, a chat, a form, or a "support" call.',
      'No real support team, exchange, or airdrop will ever ask for your seed phrase. A message that asks for it is a theft attempt, every time.',
      'Use a separate "hot" wallet with small amounts for trying new apps, and keep larger amounts in a wallet you rarely connect, or a hardware wallet. Check the address before you send: copy-paste malware and look-alike addresses exist.',
      'Sources: ethereum.org, wallets and security; Coinbase Help, protecting your recovery phrase.',
    ],
    questions: [
      q('Someone in a support chat asks for your seed phrase to "fix" your wallet. You:', ['Send it, they are support', 'Refuse. Nobody legitimate ever needs it', 'Send half of the words', 'Send a photo instead'], 1, 'The seed phrase is the wallet. Real support never asks for it.'),
      q('The safest place for a seed phrase is:', ['A screenshot in your photos', 'Written down and kept offline', 'An email draft', 'A notes app synced to the cloud'], 1, 'Offline, on paper or metal, out of reach of online attackers.'),
      q('A sensible habit for trying new apps is:', ['Connect your main wallet with everything in it', 'Use a separate wallet with small amounts', 'Share your keys with the app', 'Turn off address checks'], 1, 'Separate a small hot wallet from your savings.'),
      q('Before sending funds you should:', ['Check the full address and the network', 'Only check the first two characters', 'Skip checking, the chain will refund', 'Ask a stranger to send it'], 0, 'Transfers on-chain are usually final. Check the address and network.'),
    ],
  },
  {
    id: 'explorer', minutes: '8 min',
    paragraphs: [
      'A block explorer is a public website that shows what happened on a chain. For Base, the common one is Basescan (basescan.org). Anyone can read it without an account.',
      'Paste a transaction hash and you see: status (Success or Failed), block, timestamp, From, To, value, and the transaction fee. Token moves show up under "ERC-20 Tokens Transferred".',
      'Paste a wallet address and you see its balance, its transaction history, and which tokens it holds. Paste a contract address and you can see if its source code is verified, its holders, and its recent activity.',
      'A screenshot can be faked; an explorer page cannot be edited by the sender. When someone says "I sent it", ask for the transaction hash and check it yourself, on the right chain\'s explorer.',
      'Sources: Basescan documentation; Etherscan "Understanding an Ethereum transaction" guide.',
    ],
    questions: [
      q('Basescan shows data for which chain?', ['Bitcoin', 'Base', 'Every chain at once', 'Only private chains'], 1, 'Basescan is the explorer for Base.'),
      q('To check a payment someone says they sent, ask for:', ['A screenshot', 'The transaction hash', 'Their seed phrase', 'Their password'], 1, 'A hash can be looked up; a screenshot can be edited.'),
      q('A transaction marked "Failed" means:', ['The transfer did not go through, though a fee may still be paid', 'It will finish tomorrow', 'You got double', 'The explorer is down'], 0, 'Failed transactions do not move the value, but gas can still be spent.'),
      q('"Contract source code verified" on an explorer means:', ['The project is safe and audited', 'The published code matches what is deployed, so people can read it', 'The token will go up', 'The team is regulated'], 1, 'Verified means readable, not safe.'),
    ],
  },
  {
    id: 'scams', minutes: '8 min',
    paragraphs: [
      'Most losses in crypto come from tricks, not hacks of the chain. Common ones: fake support accounts, look-alike websites, "airdrop claim" links, fake giveaways ("send 1, get 2 back"), and romance or job scams that end with "invest here".',
      'A wallet approval lets a contract spend your tokens. Phishing sites ask you to sign an approval or a "permit" that looks harmless. Read what you sign. If a site wants unlimited spending of a token you did not mean to trade, stop. You can review and revoke old approvals with tools like revoke.cash.',
      'A rug pull is when a project\'s team drains the money or liquidity and disappears. Warning signs: anonymous team with no track record, a contract where the owner can mint or block selling, most of the supply held by a few wallets, liquidity that is not locked, and pressure to buy fast.',
      'Urgency is the main tell. "Only 10 minutes left", "guaranteed returns", and "DM me" are pressure, not information. Slow down, check the official links from more than one source, and never share keys.',
      'Sources: FTC consumer advice on crypto scams; Chainalysis crypto crime reports; revoke.cash documentation.',
    ],
    questions: [
      q('"Send 1 ETH and get 2 back" from a famous account is:', ['A generous giveaway', 'A scam', 'A staking reward', 'An airdrop'], 1, 'Nobody doubles your money for sending it first.'),
      q('A site asks you to approve unlimited spending of a token you did not mean to trade. You:', ['Approve, it is normal', 'Stop and reject it', 'Approve twice', 'Share your seed instead'], 1, 'Approvals let contracts move your tokens. Reject what you did not intend.'),
      q('Which is a rug-pull warning sign?', ['Liquidity locked and code verified', 'The owner can block selling and a few wallets hold most supply', 'A long public track record', 'A slow, clear roadmap'], 1, 'Owner powers and concentrated supply are red flags.'),
      q('The most common tell of a scam is:', ['Patience', 'Urgency and promised returns', 'A boring website', 'Clear documentation'], 1, 'Pressure to act fast is the main tell.'),
    ],
  },
  {
    id: 'community', minutes: '7 min',
    paragraphs: [
      'Community managers in Web3 run the places where a project\'s people meet: usually Discord, Telegram, and X. The job is part host, part support desk, part moderator.',
      'The basics: clear rules pinned at the top, official links in one place, a welcome channel, and moderators who reply kindly and quickly. Turn on anti-spam and verification bots. Scammers copy admin names, so tell members that admins never DM first.',
      'Good managers listen and report back: collect common questions into an FAQ, pass bugs to the team, and share updates honestly, including bad news. Trust grows when people see the same calm answers every time.',
      'Measure health by real activity, such as questions answered and people who return, not just member count. Bought followers and bot members make a room look busy and empty at the same time.',
      'Sources: Discord Moderator Academy; Telegram admin documentation.',
    ],
    questions: [
      q('Why tell members "admins never DM first"?', ['To look mysterious', 'Because scammers copy admin names and DM people', 'DMs are expensive', 'It is a legal rule'], 1, 'Impersonation is the most common attack in community chats.'),
      q('A good sign of a healthy community is:', ['Many bought followers', 'Questions answered and people coming back', 'No rules', 'Only price talk'], 1, 'Real activity beats raw member counts.'),
      q('When the project has bad news, a community manager should:', ['Delete the questions', 'Share it honestly and calmly', 'Ban everyone who asks', 'Promise price goes up'], 1, 'Honest updates build trust.'),
    ],
  },
  {
    id: 'content', minutes: '7 min',
    paragraphs: [
      'Threads that grow usually teach one clear thing. Start with a first line that says what the reader will get, then deliver it in short posts, one idea each.',
      'Show proof: a screenshot of an explorer page, a chart with its source, a step you actually took. Link sources. Readers in crypto have seen a lot of hype and reward people who are specific and correct.',
      'Be consistent rather than loud. Posting useful notes on a regular rhythm, replying to people in your niche, and crediting others builds an audience that stays.',
      'Disclose when you hold a token you talk about, or when a post is paid. In many places undisclosed paid promotion breaks advertising rules. Never post "guaranteed" returns.',
      'Sources: X Creator guidance; US FTC endorsement guides on disclosure.',
    ],
    questions: [
      q('A strong first line of a thread:', ['Says what the reader will learn', 'Is only emojis', 'Promises 100x', 'Is a long disclaimer'], 0, 'Tell the reader what they will get.'),
      q('If you hold a token you are posting about, you should:', ['Hide it', 'Disclose it', 'Delete the post later', 'Say it is guaranteed'], 1, 'Disclosure keeps trust and often the rules require it.'),
      q('What builds a lasting audience?', ['Consistent, useful posts and replies', 'Buying followers', 'Posting only hype', 'Copying others without credit'], 0, 'Consistency and usefulness compound.'),
    ],
  },
  {
    id: 'defi', minutes: '9 min',
    paragraphs: [
      'DeFi (decentralized finance) means financial apps that run as smart contracts on a chain. Anyone with a wallet can use them, without an account.',
      'A swap on a decentralized exchange trades one token for another against a liquidity pool. The price comes from the pool\'s ratio. Big trades move the price (price impact), and you set a slippage limit so the trade fails instead of filling badly.',
      'Liquidity providers (LPs) deposit two tokens into a pool and earn a share of trading fees. If the prices of the two tokens move apart, the LP can end up with less value than simply holding them: this is called impermanent loss.',
      'Risks to know: smart-contract bugs, oracle or price manipulation, approvals you forgot about, and tokens with no real liquidity. High advertised yields usually mean high risk. Nothing here is advice to use any app.',
      'Sources: ethereum.org DeFi overview; Uniswap documentation on swaps, slippage and impermanent loss.',
    ],
    questions: [
      q('In a DEX swap, the slippage setting:', ['Guarantees profit', 'Sets how far the price may move before the trade fails', 'Sets your gas to zero', 'Is your password'], 1, 'Slippage is your tolerance for a worse price.'),
      q('Liquidity providers earn:', ['A fixed salary', 'A share of trading fees', 'Free tokens forever', 'Nothing ever'], 1, 'LPs earn fees from trades in the pool.'),
      q('Impermanent loss happens when:', ['The two pooled tokens\' prices move apart', 'Gas is cheap', 'You use a hardware wallet', 'The pool is paused'], 0, 'Divergence between the pair causes it.'),
      q('A very high advertised yield usually means:', ['No risk', 'Higher risk', 'A government guarantee', 'A bug in the website'], 1, 'Yield pays you for taking risk.'),
    ],
  },
  {
    id: 'nfts', minutes: '7 min',
    paragraphs: [
      'An NFT (non-fungible token) is a token with a unique ID on a chain. The token records who owns that ID. Usually it points to metadata (name, image, traits) stored somewhere else, like IPFS or a regular server.',
      'Owning an NFT does not automatically give you copyright of the art. The rights are whatever the project\'s licence says. Some grant commercial use; many do not. Read it.',
      'Check the contract address before buying. Copycat collections use the same name and image. Marketplaces show a verified badge and the official contract; compare it with the project\'s own site.',
      'Floor price is the lowest current listing, not what every item is worth. Prices can drop to zero if attention leaves, and thin markets can make an NFT hard to sell.',
      'Sources: ethereum.org NFT overview; a16z "Can\'t Be Evil" NFT licences.',
    ],
    questions: [
      q('Buying an NFT automatically gives you the copyright:', ['Always', 'No, rights depend on the project\'s licence', 'Only on Fridays', 'Only if it is expensive'], 1, 'The licence decides the rights.'),
      q('To avoid copycats you should check:', ['The contract address against official sources', 'Only the picture', 'The number of likes', 'Nothing'], 0, 'The contract address is the identity.'),
      q('The floor price is:', ['The value of every item', 'The lowest current listing', 'A guaranteed resale price', 'The mint price'], 1, 'Floor is the cheapest ask right now.'),
    ],
  },
  {
    id: 'daos', minutes: '7 min',
    paragraphs: [
      'A DAO (decentralized autonomous organization) is a group that coordinates with on-chain rules, often a treasury contract plus votes by token holders.',
      'Proposals usually go through a forum discussion first, then an off-chain vote (for example on Snapshot) or an on-chain vote. Passed on-chain votes can execute automatically, often after a time delay.',
      'You can take part without coding: read proposals, ask clear questions on the forum, vote or delegate your votes to someone who explains their reasoning, and help with work the DAO pays for.',
      'Limits to know: voting power often follows token holdings, so a few large holders can decide outcomes. Turnout is often low. Some DAOs are wrapped in legal entities, and many are not, so members\' legal position can be unclear.',
      'Sources: ethereum.org DAO overview; Snapshot documentation.',
    ],
    questions: [
      q('Delegating your votes means:', ['Selling your tokens', 'Letting someone else vote with your voting power', 'Burning your tokens', 'Leaving the DAO forever'], 1, 'You keep the tokens; someone else casts the votes.'),
      q('A common weakness of token voting is:', ['Large holders can dominate', 'Votes are always unanimous', 'No one can see results', 'It requires coding'], 0, 'Power follows holdings.'),
      q('A non-coder can contribute to a DAO by:', ['Reading proposals, asking questions and voting', 'Nothing, it is code only', 'Sharing their seed', 'Spamming the forum'], 0, 'Governance is mostly reading, writing and voting.'),
    ],
  },
]
