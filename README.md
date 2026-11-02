# Grind District

A browser life sim inside Web3. You start as a shrimp with a zero practice ledger and walk one shared city. Rank moves by courses and practice actions. Balance does not move it.

The tagline is the door: **No tribe. No continent. Just come grind.**

This build is the playable city. The local practice economy stays off-chain and separate from optional user-initiated Base USDC top-ups, which are verified and displayed apart from practice cash. There is no in-game token or seed-phrase prompt. An optional NEAR mainnet wallet link supports an off-chain signed market-order demo; NEAR account IDs and on-chain activity are public, not private. The practice ledger is browser-only practice USD, not real funds or financial advice.

The city does not run on Solana. `contracts/src/GrindRecord.sol` is Solidity, which is the language for an EVM record. The `.sol` extension is not a Solana program. That file is not deployed, and the practice ledger is not it.

Made by [Zahra](https://0xzahra.github.io).

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Privy login uses the public App ID in `VITE_PRIVY_APP_ID`. The app secret belongs in `PRIVY_APP_SECRET` and stays on the server, in `.env`, which is not committed. The browser never receives it. `/api/privy/session` checks the login before the city keeps the account.

The dev server listens on port **47321**. Open the local URL Vite prints. The title screen stays up until **Enter the district**. If the browser cannot start WebGL, the same streets open as an overhead map: walk, click a door, press E.

```bash
npm run check
npm run build
```

`check` runs the game-rule assertions. `build` typechecks, runs those assertions, then writes `dist/`.

## Sign-in and sign-up

Players sign in and sign up with **Google** or **X**. Both go through Privy.

- Google sign-in is already supported.
- X Login is free for authentication only. The Login with X / OAuth endpoints do not require X API credits. Credits are only needed if the app later reads posts, posts on behalf of users, or makes other API calls.
- Set a $0 spend cap in the X Developer Console to block any accidental paid calls.
- All sign-ups and sign-ins must be recorded in the database (Supabase). Store username, display name, sign-in method, timestamp, and linked wallet if created.
- Current build stores progress in localStorage only. Database recording is the next non-WebGL item.

## NEAR mainnet wallet and market demo

NEAR wallet linking is separate from Privy sign-in and optional. In Settings, connect a mainnet account through NEAR Wallet Selector’s MyNearWallet integration; the game save stores only the account ID in this browser. Google/X/Privy login and the existing local practice save remain separate.

On the Spot book or Trenches book, choose a size and sign an NPC market order. The NEP-413 message contains only the asset, side, size, NPC practice quote, and expiry. The client accepts the wallet response as a local demo gate for a practice-book fill, then discards the signature; it does not send it to a server or blockchain. There is no server-side signature verification, public order, or shared market state. No NEAR transaction, contract call, deposit, or real-funds movement is made. NPC quotes follow the live practice-book price with a fixed spread; NPC wallet state is not shared across players.

NEAR mainnet account IDs, balances, and transaction history are publicly visible. Do not put names, usernames, email addresses, or other personal data in wallet messages or on-chain. This integration does not provide privacy; it limits the data the game handles. Connecting a wallet is optional, and the city remains playable without one.

The repo contains no deployed NEAR contract or NEAR contract address. `contracts/src/GrindRecord.sol` is an undeployed EVM contract and is not used by this integration. Further shared/on-chain market settlement would require a separately reviewed NEAR contract and explicit deployment approval.

## How to play

- WASD or the arrow keys walk. Shift runs. On a phone, use the stick.
- Drag to look. The wheel zooms.
- Click the ground to walk there.
- Stand on a mint doorstep and press **E**, or the mint button, to enter.
- Esc closes a sheet. Movement pauses while a sheet is open. Looking still works.
- **Shot** saves a picture of the city.
- **Play theme** starts Market Velocity (3:00, looping). The city stays silent until you press it. Volume is remembered. Playback starts paused each visit.

Daily action limits follow your local calendar day.

## The city

| Place | What it does |
| --- | --- |
| Learning hall | Twelve short courses. A pass writes the CV, resume, and portfolio. The first Spot pass drops a one-time $25 practice stipend. |
| Trading floor | Practice spot book in UNIT. Buy and sell a fraction of the ledger or the position. Logging a sized plan on a sell can count even when the close is red. |
| Trenches | Practice MEME book. Attention can leave. Rank does not follow it. |
| Influencer row | Post a bounty. Practice pay and a portfolio line. |
| Boutique | Man, woman, Shrimp, Ledger, Marina, Signal. Masks wear the collection names in this city's own shapes. |
| Gym | A timing set. One logged set a day. |
| Church | Rest counts. One visit a day. |
| Prayer space | Focus adds a quarter to the next course you pass. |
| Cafés | A daily board. Gossip, not a signal. |
| Carbon desk | A practice pledge. It does not retire a real credit. |
| The houses | Your house, plus a notes house, a set house, a grove house, and a vacant room on the east row. |
| Gadgets | Scout, courier, and halo drones. Practice funds. A drone follows you. |
| Conference hall | A short talk. Proof of work, not a slogan. |
| Plaza | Fountain, rank totem, and Unit 4. The robot is labeled **Agent**. |

A family request can ask for a little practice money. Paying is reputation. Declining has no penalty.

Profile holds Today, CV, Resume, Portfolio, and the practice books. Copy a share link from Today. Opening someone else's link shows their profile and does not overwrite your save.

Graphics (low, medium, high) and GN time (night, dusk, day) live in Settings. A fresh visit picks low graphics on a phone or a narrow window, and medium otherwise.

## Later, on purpose

Proximity voice, messaging, licensed NFT bodies, shared on-chain market state, and settlement wait until this city is the one people walk. The current NEAR feature is an optional mainnet account link and off-chain signed practice-order demo; it does not provide private transactions or a deployed contract.

## The citizen

Signup can start with Privy email login, then asks for a name, a username, and a body before you enter. Gameplay does not require a wallet. Optional NEAR linking is separate from signup; optional Base top-ups associate the sending wallet through Privy. The city never asks for a seed phrase. The plate and the profile use the name and `@username`. The man has blonde swept hair, thin glasses, a grey suit, and a blue shirt. The woman has longer hair, a softer face, and a fitted coat. Rank still starts at shrimp. The shrimp mascot, Ledger, Marina, and Signal stay free in the boutique, and the body can be changed there later. People already on the street are not given names. Their plates show rank.

Settings also holds the map size, walking hints, reduced motion, and optional NEAR mainnet account link, next to GN time and graphics. The corner map opens the city directory. On the overhead map, mint squares are doors.

The boutique masks are named CryptoPunks, Bored Apes, Pudgy Penguins, Azuki, Nodemonkes, and DeGods. The meshes are original Grind District cuts. They are not the licensed artwork. Gadgets sells three drones.

## Base USDC top-ups

The Top up screen copies the fixed GrindTreasury address and accepts a Base transaction hash. The server verifies a successful Base mainnet receipt with at least 12 confirmations, a USDC transfer to the treasury, and a sender wallet linked to the authenticated Privy account. Credits come from receipt logs and each transfer log can only be credited once. Earlier deposits can be claimed by submitting their hash; wallet history is not scanned automatically. Verified credits appear separately from practice cash and are not used for local purchases.

Apply `supabase/migrations/202606180001_verified_topups.sql` and configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the existing server-only Privy credentials before enabling credited balances. `BASE_RPC_URL` is optional and defaults to Base mainnet. Never expose the service-role key in a `VITE_` variable.

## GrindRecord

`contracts/src/GrindRecord.sol` is the proof-of-work record. It is not deployed. The city does not send transactions to it; optional Base USDC top-ups are user-initiated and handled separately. The optional NEAR mainnet wallet is used only for an off-chain signed market-order demo. The contract refuses ether. XP follows the same rank cuts as the city, a course can be filed once, and reputation does not move rank.

```bash
cd contracts
forge install foundry-rs/forge-std
forge test
```

`contracts/AUDIT.md` is the internal review. It is not a sign-off from an outside firm. Do not deploy it until that review is repeated by someone who does not maintain the contract, and until the owner key is a multisig.

## Where the next session starts

`CONTINUATION.md` lists what is already in the city and what is still open, including the WebGL check on a machine that can create a context.

## Stack

Vite, TypeScript, and Three.js. Progress is stored in this browser under `grind-district-save-v1`. Foundry tests the record contract.
