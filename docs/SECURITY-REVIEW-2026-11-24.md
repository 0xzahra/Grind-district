# Security review, 24 Nov 2026 (before deploy)

Scope: everything in the repo (`src/`, `api/`, `index.html`, `public/sw.js`, `scripts/`, `tools/`), all 448 commits of
history, `package-lock.json`, the two forks, and the unmerged `gasless-paymaster` branch.

## Result: safe to deploy

| Check | Result |
| --- | --- |
| Secrets in browser code | None. The browser only sees public values (`VITE_*`: Supabase URL and anon key, Privy app id, contract addresses, NEAR account names). No server key, service-role key, Privy secret or private key is referenced from `src/`. |
| Secrets in git history | None. Full history scanned for private keys, service keys, JWTs, AWS/GitHub/Google keys and PEM blocks. The only 64-hex values are public event topics, a NEAR token id, and the well-known public Anvil test key used in a test (never funded). `.env.example` only ever held public testnet account names. |
| Suspicious network calls | None. Every outbound host is expected: Base / Ethereum / Arbitrum / Solana / NEAR public RPCs, block explorers, Coinbase price API, Privy, NEAR Intents (1click), IPFS gateways and an image resizer for the art gallery, Google News RSS, and the owner's GitHub Pages. No hidden RPC, no command-and-control pattern, no websocket to unknown hosts. |
| eval / dynamic code | None. No `eval`, `new Function`, string timers, `document.write` or injected `<script>` tags. The only base64 decoding is the game's own packed logo (same-origin `/brand/shrimp.b64`) and normal signature/nonce handling. |
| Timer-based connections | All timers call the game's own `/api/*` routes (tracking flush, messages, presence, progress sync, top-up order polling) or the Coinbase price feed. Nothing phones home to a third party on a timer. |
| Wallet / transaction code | Safe. Top-ups send only to the hard-coded treasury `0x6bc8…ec33` (unchanged in history). Player-to-address sends need a review tap and then a confirm tap, and validate the address. No token `approve` calls anywhere. Certificate mints call only the certificate contract with a server-signed voucher. |
| Dependencies | All 217 packages come from registry.npmjs.org; none run install scripts. Fixed now: **nodemailer** 6 → 10.4.1 (two high advisories: mail to an unintended domain, SMTP command injection). Left as is (low real risk, explained below): **zod** inside the Privy login SDK (high on paper: memory use when validating oversized data; here it only validates Privy's own replies, and the owner's rule is not to touch login code) and **satori** inside `@vercel/og` (moderate: SVG escaping in share images; the output is a PNG, so at worst one share image renders wrong). |
| Backdoor patterns | None. No obfuscated strings, no hidden admin routes, no code that runs only on certain dates or for certain users. Commit authors are the owner, the owner's AI sessions, and the project's first two set-up commits (31 Oct). |

## The two forks

* `abdoullfurya/Grind-district`, created 24 Nov
* `grinchchristmasinc/0xzahra--grind-district`, created 21 Nov

Neither has pushed anything of its own (their last push equals this repo's last push) and neither has opened a pull
request or issue here. A fork is a copy: it cannot change this repo, the live site, Vercel, Supabase or any wallet.
The repo has no GitHub Actions, so a pull request from a fork cannot run anything with this repo's credentials.
Because history has no secrets, the copies hold nothing private. What to keep doing:

* Never merge a pull request from a stranger without reading it (any wallet address, `fetch` to a new host, or
  change to `grindConfig.ts` / top-up code is a red flag).
* Keep Vercel's fork protection on (default), so pull requests from forks never build with your env vars.
* A fork could put up a copy of the site to phish players. The game never asks for seed phrases; keep saying so.

## Low risks noted (no change needed now)

* `/api/track` accepts anonymous events (allow-listed names, max 200 per request). Someone could post junk to skew
  the stats; it cannot read or change anything else.
* `/stats.html` shows counts only (no names, wallets or ids). To make it private, set `STATS_KEY` in Vercel and open
  `/stats.html?key=<that value>`.
* `gasless-paymaster` branch: reviewed separately when finishing item 18 (it is off unless two settings are switched on).
