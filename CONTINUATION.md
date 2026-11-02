# Where the next session starts

Grind District is a playable city. The title screen stays up until **Enter the district**. If the browser cannot create a WebGL context, the same streets open as an overhead map. The 3D path is real and is what a machine with WebGL should show.

Dev server: port **47321**, host `0.0.0.0`. Leave the existing Vite process running. Do not start a second one.

```bash
npm install
npm run dev
npm run check
```

## Sign-in and sign-up

Players sign in and sign up with **Google** or **X**. Both go through Privy.

- Google sign-in is already supported.
- X Login is free for authentication only. The Login with X / OAuth endpoints do not require X API credits. Credits are only needed if the app later reads posts, posts on behalf of users, or makes other API calls.
- Set a $0 spend cap in the X Developer Console to block any accidental paid calls.
- All sign-ups and sign-ins must be recorded in the database (Supabase). Store username, display name, sign-in method, timestamp, and linked wallet if created.
- Current build stores progress in localStorage only. Database recording is the next non-WebGL item.

## Name and username

A save starts with `name: ''`, `username: ''`, `privyId: ''`, `nearAccountId: ''`, and `signedUp: false`. The title screen can log in with Privy email, then asks for a display name, a username, and a body before **Enter the district**. `signUp` in `src/state.ts` stores the display name (1–24, spaces kept), the username (3–16, `[a-z0-9_]`, stored lowercase), and the body (`player` for the man, `zuri` for the woman). `attachPrivy` stores `did:privy:…` after `/api/privy/session` verifies the access token. The browser uses `VITE_PRIVY_APP_ID` only. `PRIVY_APP_SECRET` stays in `.env` and in the server check in `server/verify-session.ts`. Do not commit the secret, and do not put it in client code. Settings can edit the name and username later. The boutique can change the body. Reset progress keeps the name, the username, the Privy id, the NEAR account link, and the body. Privy login/signup does not ask for a wallet; optional NEAR linking is in Settings.

The plate (`tagPlayer`) draws the display name in block letters and `@username` under it. The profile, CV, resume, and portfolio use the same pair. Share links put the display name in `n` and the username in `u`. An old link with no `u` still opens.

Do not invent a default name. `Player 8453`, `Shrimp`, and `Zuri` are not identities. An old save that lacks `signedUp: true` is unsigned, even if it still says Player 8453, and the city asks again.

## NEAR mainnet wallet and market demo

`src/near.ts` lazy-loads NEAR Wallet Selector’s MyNearWallet integration with `network: 'mainnet'`; it has no contract ID and exposes only connect, disconnect, and NEP-413 message-signing methods. The wallet signs a short order for the existing UNIT/MEME practice books. `src/near-economy.ts` derives the local NPC quote from the current practice price and Bull/Bear season. The client accepts the wallet response as a local demo gate, fills the practice book, then discards the signature; there is no server-side signature verification, public order, transaction, contract call, or server post. Only the public NEAR account ID is kept in the local save, separate from Privy.

NEAR mainnet account IDs, balances, and transaction history are public. Keep personal data off-chain. The feature is optional and does not provide transaction privacy. The repository contains no NEAR contract or address; `contracts/src/GrindRecord.sol` is an undeployed EVM contract and is not used here. Shared player orders and NPC wallet state remain future work.

## The man and the woman

`src/player.ts` is the original low-poly man. Body id `player`. A new save wears that body and a blue shirt (`0x1a4cff`). Rank still starts at shrimp. Do not turn this mesh into a woman.

`src/zuri.ts` is the woman. Body id `zuri`. Longer dark hair, a softer jaw, lashes, and a fitted plum coat. Shirt tint still recolors her scarf. Keep both sculpts. The boutique labels are **Man** and **Woman**.

`src/citizens.ts` is the street roster. It has no names. Women use the `zuri` body. Men use the `player` body. `src/npcs.ts` labels them with rank only. Unit 4 stays **Unit 4** / **Agent**. The overhead map draws the same list.

The reference plate image reads **PLAYER 8453**. That image is the lettering style. A typed "8438" does not match it. The in-game plate text is the name the person chose.

The look to match, from `design/reference/`:

- Faceted skin, long face, blonde geometric hair swept up and back.
- Thin rectangular metal glasses, green-grey eyes.
- Grey suit, bright blue shirt and cuffs, faceted hands.
- Not a licensed collection. Do not copy CryptoPunks, BAYC, Pudgy, or Azuki. The boutique already says those need a license.

`design/reference/player-8453-clip.mp4` shows the same body holding cash in a bedroom. That clip is a visual reference. Do not add a cash-fan emote unless someone asks for it.

The head in `src/player.ts` is a sculpted icosahedron (jaw, chin, nose ridge, cheeks) plus flat hair shards, a pyramid nose, thin rims with a dark outline, and temple arms. A short key light sits on the body so the blonde and the blue shirt still read at night. Shirt color and the gold chain are the only style swaps. Hair stays blonde.

A SwiftShader Chrome on 30 October 2026 created a real WebGL context and showed this body: grey suit, blue shirt, blonde facets, rectangular rims, and a blue plate. The plate text is now the name from signup, with `@username` on the second line. The cloud preview browser still cannot create WebGL and correctly opens the overhead map.

The crowd in `src/npcs.ts` reuses this sculpt with different shirt tints. Unit 4 stays a labeled robot. Varying hair is open work, not a requirement to ship the city.

An unsigned save whose body is still `shrimp` is migrated to `player` in `loadSave`, and the old mint tint becomes blue. After signup, a chosen shrimp body stays. The shrimp mascot remains a free boutique body.

## WebGL

This cloud preview often fails with `THREE.WEBGLRENDERER: ERROR CREATING WEBGL CONTEXT` (`llvmpipe` / `BindToCurrentSequence`). The product fallback is the overhead map, including a small suited figure when the body is `player`. Do not remove that fallback.

To see the mesh, use a separate Chrome that can create a context. Do not pass `--virtual-time-budget`. The animation loop never finishes, and that flag hangs the process. Do not kill the Vite process.

```bash
google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --enable-webgl --window-size=1280,800 http://127.0.0.1:47321/
```

Medium and high graphics use `min(devicePixelRatio, 2)`. Low stays at 1. Shadows are off on low. Shadow map is 2048 on high and 1024 otherwise. Tone mapping is ACES. Night exposure is 0.96, dusk 1.02, day 1.05.

Open work if the mesh still does not match the portrait up close: tighter hair facets, a clearer brow, and hands that read as flat facets at the third-person camera. Keep the silhouette (blonde sweep, wire rims, grey suit, blue shirt) at street distance.

## Menu, houses, and courses

The title screen is a menu: Enter the district, How to play, The city, Courses, and Credits. Enter and Space start the city only from the home page, and only after signup. If they are not signed up, those keys open the name form. Credits says the city does not run on Solana, and that `.sol` is Solidity.

`src/houses.ts` is the east row: your house, the notes house (`adaeze`), the set house (`malik`), the grove house (`nia`), and a vacant room. Keep those ids so old `houseVisits` still match. The signs and sheets do not use personal names. The same list builds the 3D meshes and the overhead map. Claim the room once (+3 reputation). A first visit to each neighbor is +2. Messaging and voice stay out.

`src/courses.ts` holds twelve lessons. Each one is several paragraphs with a source line, plus four exercises. The first eight match the city’s original hall: spot, risk, staking, airdrops, memes, agents, building, carbon. The four added in the city only are custody, stablecoins, liquidity pools, and reading a transfer. `GrindRecord` still has bits for the original eight. Do not add contract bits in a city pass. The learning hall grades every answer. Spot’s first pass still drops the $25 practice stipend once.

Twelve courses at 70 XP are 840 before streak and focus. Whale stays at 1100, so courses alone still stop short of whale. That split is intentional.

Café: read the board, then order water (free, once that day, after the board). Gym: the timing set, plus a line that says what a second set does. Carbon desk: the method is on the sheet before the pledge buttons. Conference hall: sit once, then keep the note. Mint squares on the overhead map are those doors. The corner map is clickable and opens the directory. `#map` sets `pointer-events: auto` because `#hud` ignores pointers.

`tickMarket` uses its clock argument for the season. The Lagos day is always `new Date()`. Do not pass `performance.now()` into that day. A frame timestamp is milliseconds since the page opened, and `new Date` of that value is 1970, which wipes every daily on the next frame. Both loops pass `Date.now()`.

`districtName` labels the band east of x 30 and south of z 14 as The houses, including the notes-house door, which sits inside the old influencer-row circle.

## Masks and drones

`src/masks.ts` mounts a mask on any avatar's `mask-anchor`. The ids are `punk`, `ape`, `pudgy`, `azuki`, `nodemonke`, `degods`. The labels are CryptoPunks, Bored Apes, Pudgy Penguins, Azuki, Nodemonkes, and DeGods. The geometry is original. Do not paste the licensed images, sprites, or character sheets into the repo. A later session can refine the silhouettes. It should not trace those collections.

`src/drones.ts` is Scout ($18), Courier ($32), and Halo ($48) practice. `buyDrone` in `src/state.ts` equips one the player owns. The mesh follows the player in `src/main.ts` and is drawn on the overhead map. NPCs with a drone carry one as a child. Drones do not deliver, photograph, or open a camera.

The gadgets stall is south of the plaza (`x: -16, z: 14`). The boutique sheet wears masks. Save fields are `mask`, `drone`, and `ownedDrones` on version 1. Settings also store `mapSize` (`compact` or `large`), `hints`, and `reduceMotion`. `applyPrefs` in `src/prefs.ts` toggles the body classes. `src/minimap.ts` draws the corner map for both the 3D path and the overhead map.

## What a later session can still add

These are the open pieces. WebGL context, shared markets/NPC wallet state, a multisig, and any contract deployment remain open. The optional NEAR mainnet account link and off-chain signed practice-order demo are already implemented above.

- Proximity voice and player-to-player messaging. House copy still says they are later.
- Other people are scripted citizens in `src/citizens.ts`. There is no networked player.
- Drone jobs: a delivery, a photo, a race. Today a drone only follows.
- Licensed collection artwork. The masks are named and wearable. They are not the real images.
- Hair that changes per person. Every man shares the blonde mesh. Every woman shares the dark-hair mesh.
- A closer match of both faces to a portrait at camera distance: brow, hair facets, hands.
- The theme mp3 on GitHub. The file API corrupts it. Push audio with git.
- A fuller nature district. The basin and the carbon desk are the outdoor piece.
- Cash-fan emote. Do not add it unless someone asks.
- Database recording of sign-ups (Supabase). Currently localStorage only.

## What stays off the chain

- NEAR wallet linking is optional; the game never asks for a seed phrase.
- NEP-413 market-order signatures stay in the browser and are discarded; the game sends no NEAR transactions.
- Names, usernames, email, practice balances, positions, and game activity remain local. User-initiated Base top-up transfers and NEAR account activity are public on their respective chains; the NEAR feature does not send profile data and should not be described as private.
- The practice ledger is local USD. It is labeled as practice. It is not financial advice and it is not `GrindRecord`.
- Do not deploy `contracts/src/GrindRecord.sol`.
- Do not point the city at a contract address.
- `contracts/AUDIT.md` is the internal review. It is not an outside audit. Read it before changing the contract. The bit tests must stay parenthesized.

```bash
cd contracts
forge install foundry-rs/forge-std
forge test
```

`contracts/lib` is gitignored. Install forge-std locally. Do not commit `out/` or `cache/`.

Whale is 1100 XP. Reputation does not add XP. The original eight courses, with focus and a streak, were described as 760 XP. Twelve courses at 70 XP are 840 before those bonuses. Do not retune the ladder to make whale a course reward.

## Theme

Market Velocity is `public/audio/market_velocity.mp3` (about 3:00, looping). Playback stays paused until **Play theme**. The local tree and the Origin push can carry the bytes. A GitHub file API that UTF-8-encodes the body will corrupt the mp3, the png, and the jpg. Do not upload those through that API. Small ASCII parts under `public/audio/parts/` and `public/brand/` are the text fallback in `src/assets.ts` (`#pack1` run-length). If those parts are missing on GitHub, push them with git, not by pasting binary into an API.

## Git

Work on `main`. Do not open a pull request unless someone asks. Origin is the Cursor codebase for `zahra-26/Grind-district`. GitHub is [https://github.com/0xzahra/Grind-district](https://github.com/0xzahra/Grind-district). Open it signed in as `0xzahra`. Do not claim it is public if an anonymous request 404s.

Made by [Zahra](https://0xzahra.github.io).
