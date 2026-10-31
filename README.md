# Grind District

A browser life sim inside Web3. You start as a shrimp with a zero practice ledger and walk one shared city. Rank moves by courses, reps, and consistency. Balance does not move it.

The tagline is the door: **No tribe. No continent. Just come grind.**

This build is the playable city. Gameplay stays off-chain. There is no token, no wallet, and no seed phrase. The ledger is practice USD, labeled as such. It is not real funds and it is not financial advice.

The city does not run on Solana. `contracts/src/GrindRecord.sol` is Solidity, which is the language for an EVM record. The `.sol` extension is not a Solana program. That file is not deployed, and the practice ledger is not it.

Made by [Zahra](https://0xzahra.github.io).

## Run

```bash
npm install
npm run dev
```

The dev server listens on port **47321**. Open the local URL Vite prints. The title screen stays up until **Enter the district**. If the browser cannot start WebGL, the same streets open as an overhead map: walk, click a door, press E.

```bash
npm run check
npm run build
```

`check` runs the game-rule assertions. `build` typechecks, runs those assertions, then writes `dist/`.

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
| Learning hall | Eight short courses. A pass writes the CV, resume, and portfolio. The first Spot pass drops a one-time $25 practice stipend. |
| Trading floor | Practice spot book in UNIT. Buy and sell a fraction of the ledger or the position. Logging a sized plan on a sell can count even when the close is red. |
| Trenches | Practice MEME book. Attention can leave. Rank does not follow it. |
| Influencer row | Post a bounty. Practice pay and a portfolio line. |
| Boutique | Player 8453 (man), Zuri (woman), Shrimp, Ledger, Marina, Signal. Masks wear the collection names in this city's own shapes. |
| Gym | A timing set. One logged set a day. |
| Church | Rest counts. One visit a day. |
| Prayer space | Focus adds a quarter to the next course you pass. |
| Cafés | Season headlines. Gossip, not a signal. |
| Carbon desk | A practice pledge. It does not retire a real credit. |
| The houses | Your house, plus Adaeze, Malik, Nia, and a vacant room on the east row. |
| Gadgets | Scout, courier, and halo drones. Practice funds. A drone follows you. |
| Conference hall | A short talk. Proof of work, not a slogan. |
| Plaza | Fountain, rank totem, and Unit 4. The robot is labeled **Agent**. |

A family request can ask for a little practice money. Paying is reputation. Declining has no penalty.

Profile holds Today, CV, Resume, Portfolio, and the practice books. Copy a share link from Today. Opening someone else's link shows their profile and does not overwrite your save.

Graphics (low, medium, high) and GN time (night, dusk, day) live in Settings. A fresh visit picks low graphics on a phone or a narrow window, and medium otherwise.

## Later, on purpose

Proximity voice, messaging, licensed NFT bodies, and anything on-chain wait until this city is the one people walk. This build does not pretend those exist.

## The citizen

Player 8453 is a man: blonde swept hair, thin glasses, a grey suit, and a blue shirt. Zuri is a woman: longer hair, a softer face, and a fitted coat, cut to read cleaner than he does. A new city starts as **Player 8453**. Rank still starts at shrimp. The shrimp mascot, Ledger, Marina, and Signal stay free in the boutique.

The boutique masks are named CryptoPunks, Bored Apes, Pudgy Penguins, Azuki, Nodemonkes, and DeGods. The meshes are original Grind District cuts. They are not the licensed artwork. Gadgets sells three drones.

## GrindRecord

`contracts/src/GrindRecord.sol` is the proof-of-work record. It is not deployed. The city does not send transactions and does not ask for a wallet. The contract refuses ether. XP follows the same rank cuts as the city, a course can be filed once, and reputation does not move rank.

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
