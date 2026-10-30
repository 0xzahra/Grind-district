# Where the next session starts

Grind District is a playable city. The title screen stays up until **Enter the district**. If the browser cannot create a WebGL context, the same streets open as an overhead map. The 3D path is real and is what a machine with WebGL should show.

Dev server: port **47321**, host `0.0.0.0`. Leave the existing Vite process running. Do not start a second one.

```bash
npm install
npm run dev
npm run check
```

## Player 8453

`src/player.ts` is the original low-poly citizen. A new save is named **Player 8453** with body `player` and a blue shirt (`0x1a4cff`). Rank still starts at shrimp. The plate on the 3D body reads the profile name in block letters on a blue plate.

The reference plate image reads **PLAYER 8453**. A typed "8438" does not match that image. Keep 8453.

The look to match, from `design/reference/`:

- Faceted skin, long face, blonde geometric hair swept up and back.
- Thin rectangular metal glasses, green-grey eyes.
- Grey suit, bright blue shirt and cuffs, faceted hands.
- Not a licensed collection. Do not copy CryptoPunks, BAYC, Pudgy, or Azuki. The boutique already says those need a license.

`design/reference/player-8453-clip.mp4` shows the same body holding cash in a bedroom. That clip is a visual reference. Do not add a cash-fan emote unless someone asks for it.

The head in `src/player.ts` is a sculpted icosahedron (jaw, chin, nose ridge, cheeks) plus flat hair shards, a pyramid nose, thin rims with a dark outline, and temple arms. A short key light sits on the body so the blonde and the blue shirt still read at night. Shirt color and the gold chain are the only style swaps. Hair stays blonde.

A SwiftShader Chrome on 30 October 2026 created a real WebGL context, entered the city, and showed this body: grey suit, blue shirt, blonde facets, rectangular rims, and a blue plate reading PLAYER 8453. The cloud preview browser still cannot create WebGL and correctly opens the overhead map.

The crowd in `src/npcs.ts` reuses this sculpt with different shirt tints. Unit 4 stays a labeled robot. Varying hair is open work, not a requirement to ship the city.

An old save whose body is still `shrimp` is migrated to `player` in `loadSave`. If the stored name is `Shrimp`, it becomes `Player 8453`, and the old mint tint becomes blue. The shrimp mascot remains a free boutique body, so a player can switch back.

## WebGL

This cloud preview often fails with `THREE.WEBGLRENDERER: ERROR CREATING WEBGL CONTEXT` (`llvmpipe` / `BindToCurrentSequence`). The product fallback is the overhead map, including a small suited figure when the body is `player`. Do not remove that fallback.

To see the mesh, use a separate Chrome that can create a context. Do not pass `--virtual-time-budget`. The animation loop never finishes, and that flag hangs the process. Do not kill the Vite process.

```bash
google-chrome --headless=new --use-angle=swiftshader --enable-unsafe-swiftshader --enable-webgl --window-size=1280,800 http://127.0.0.1:47321/
```

Medium and high graphics use `min(devicePixelRatio, 2)`. Low stays at 1. Shadows are off on low. Shadow map is 2048 on high and 1024 otherwise. Tone mapping is ACES. Night exposure is 0.96, dusk 1.02, day 1.05.

Open work if the mesh still does not match the portrait up close: tighter hair facets, a clearer brow, and hands that read as flat facets at the third-person camera. Keep the silhouette (blonde sweep, wire rims, grey suit, blue shirt) at street distance.

## What stays off the chain

- No wallet button, no seed phrase, no signature prompt.
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

Whale is 1100 XP. Eight courses at the maximum bonus are 760 XP, which is shark. That split is intentional. Reputation does not add XP.

## Theme

Market Velocity is `public/audio/market_velocity.mp3` (about 3:00, looping). Playback stays paused until **Play theme**. The local tree and the Origin push can carry the bytes. A GitHub file API that UTF-8-encodes the body will corrupt the mp3, the png, and the jpg. Do not upload those through that API. Small ASCII parts under `public/audio/parts/` and `public/brand/` are the text fallback in `src/assets.ts` (`#pack1` run-length). If those parts are missing on GitHub, push them with git, not by pasting binary into an API.

## Git

Work on `main`. Do not open a pull request unless someone asks. Origin is the Cursor codebase for `zahra-26/Grind-district`. GitHub is [https://github.com/0xzahra/Grind-district](https://github.com/0xzahra/Grind-district). Open it signed in as `0xzahra`. Do not claim it is public if an anonymous request 404s.

Made by [Zahra](https://0xzahra.github.io).
