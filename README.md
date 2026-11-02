# Grind District

A browser life sim inside Web3. You start as a shrimp with a zero practice ledger and walk one shared city. Rank moves by courses, reps, and consistency. Balance does not move it.

The tagline is the door: **No tribe. No continent. Just come grind.**

This build is the playable city. Gameplay stays off-chain and there is no in-game token. The practice ledger is browser-only practice USD, not real funds or financial advice. Optional Base USDC deposits can be verified against the treasury, are displayed separately from practice cash, and are not withdrawable.

The city does not run on Solana. `contracts/src/GrindRecord.sol` is Solidity, which is the language for an EVM record. The `.sol` extension is not a Solana program. That file is not deployed, and the practice ledger is not it.

Made by [Zahra](https://0xzahra.github.io).

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

Privy sign-in is configured for Google and X (Twitter), using the public App ID in `VITE_PRIVY_APP_ID`. Enable both login methods and their OAuth settings in the Privy dashboard; this repository cannot verify dashboard configuration. Email one-time-passcode login and any separate email-confirmation step are not part of the app flow. The app secret belongs in `PRIVY_APP_SECRET` and stays on the server, in `.env`, which is not committed. The browser never receives it. `/api/privy/session` checks the login before the city keeps the account.

The dev server listens on port **47321**. Open the local URL Vite prints. The title screen stays up until **Enter the district**. If the browser cannot start WebGL, the same streets open as an overhead map: walk, click a door, press E.

```bash
npm run check
npm run build
```

`check` runs the game-rule assertions. `build` typechecks, runs those assertions, then writes `dist/`.

## Sign-in and sign-up

The Privy login modal is configured to offer **Google** and **X (Twitter)**. Those providers must be enabled and configured in the Privy dashboard; their live availability is not verifiable from this repository. Email OTP/confirmation is not used by the app. X authentication does not require X API credits; credits are only relevant if the app later reads or posts content through X APIs.

- Sign-ups and sign-ins are not recorded in a database in this build.
- Progress and practice earnings remain in localStorage; they are not server-backed account balances.

## Agent claim and first-earn gate

At Unit 4, **Copy fresh prompt** asks the server for a short-lived HMAC-signed claim code after a valid Privy login, then copies instructions for the agent. The code expires after 10 minutes. `POST /api/agents/first-earn` checks the signature and returns HTTP 425 with the remaining wait until five minutes have passed from that code's issue time, then returns `eligible: true`. A newly copied code starts a new wait; earlier codes remain usable until their own expiry because this build has no persistent claim/revocation store. Treat each code as a temporary bearer secret.

This endpoint is a gate check only: it does not prove an agent's identity, make a claim single-use, or issue funds. There is no server-side agent earn endpoint; existing practice earnings are still client-side and are not protected by this gate. Any future agent earn handler must enforce the gate itself before awarding anything.

## How to play

- WASD or the arrow keys walk. Shift runs. On a phone, use the stick.
- Drag to look. The wheel zooms.
- Click the ground to walk there.
- Stand on a mint doorstep and press **E**, or the mint button, to enter.
- Esc closes a sheet. Movement pauses while a sheet is open. Looking still works.
- **Shot** saves a picture of the city.
- **Play theme** starts Market Velocity (3:00, looping). The city stays silent until you press it. Volume is remembered. Playback starts paused each visit.

The in-game day follows Africa/Lagos. The first rep of a Lagos day extends a streak. Skip a day and the streak starts over. Bull and bear seasons flip every six minutes on a shared clock and change the practice books and the café copy. The street still works when the marks fall.

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
| Cafés | Season headlines. Gossip, not a signal. |
| Carbon desk | A practice pledge. It does not retire a real credit. |
| The houses | Your house, plus a notes house, a set house, a grove house, and a vacant room on the east row. |
| Gadgets | Scout, courier, and halo drones. Practice funds. A drone follows you. |
| Conference hall | A short talk. Proof of work, not a slogan. |
| Plaza | Fountain, rank totem, and Unit 4. The robot is labeled **Agent**. |

A family request can ask for a little practice money. Paying is reputation. Declining has no penalty.

Profile holds Today, CV, Resume, Portfolio, and the practice books. Copy a share link from Today. Opening someone else's link shows their profile and does not overwrite your save.

Graphics (low, medium, high) and GN time (night, dusk, day) live in Settings. A fresh visit picks low graphics on a phone or a narrow window, and medium otherwise.

## Later, on purpose

Proximity voice, messaging, licensed NFT bodies, and anything on-chain wait until this city is the one people walk. This build does not pretend those exist.

## The citizen

Signup starts with Google or X through Privy, then asks for a name, a username, and a body before you enter. Gameplay does not require a wallet; optional top-ups link the sending wallet through Privy. The city never asks for a seed phrase. The plate and the profile use the name and `@username`. The man has blonde swept hair, thin glasses, a grey suit, and a blue shirt. The woman has longer hair, a softer face, and a fitted coat. Rank still starts at shrimp. The shrimp mascot, Ledger, Marina, and Signal stay free in the boutique, and the body can be changed there later. People already on the street are not given names. Their plates show rank.

Settings also holds the map size, walking hints, and reduced motion, next to GN time and graphics. The corner map opens the city directory. On the overhead map, mint squares are doors.

The boutique masks are named CryptoPunks, Bored Apes, Pudgy Penguins, Azuki, Nodemonkes, and DeGods. The meshes are original Grind District cuts. They are not the licensed artwork. Gadgets sells three drones.

## Base USDC top-ups

The Top up screen copies the fixed GrindTreasury address and accepts a Base transaction hash. The server verifies a successful Base mainnet receipt with at least 12 confirmations, a USDC transfer to the treasury, and a sender wallet linked to the authenticated Privy account. Credits come from receipt logs and each transfer log can only be credited once. Earlier deposits can be claimed by submitting their hash; wallet history is not scanned automatically. Verified credits appear separately from practice cash and are not used for local purchases.

Apply `supabase/migrations/202606180001_verified_topups.sql` and configure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and the existing server-only Privy credentials before enabling credited balances. `BASE_RPC_URL` is optional and defaults to Base mainnet. Never expose the service-role key in a `VITE_` variable.

## GrindRecord

`contracts/src/GrindRecord.sol` is the proof-of-work record. It is not deployed. The city does not submit transactions; optional top-ups are user-initiated Base USDC transfers. The contract refuses ether. XP follows the same rank cuts as the city, a course can be filed once, and reputation does not move rank.

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
