# Grind District six-step checkpoint

## Source and safety
- Source of truth: https://github.com/0xzahra/Grind-district, base `Main` at `d78ae2b5ca7c6591b122ae0fedaf389d5ceb11dc`.
- Work branch: `fix/gdd-six-preview`. Existing `Main` and `Duplicate-2` pointed to that same base when checked. Neither has been changed by this work.
- Vercel project `grind-district` links this GitHub repo. Configured production branch is lowercase `main`, whereas GitHub default is uppercase `Main`; no lowercase main ref existed when checked. Do not fix this discrepancy, merge, or deploy production without explicit approval.
- Old `/workspace/repos/Grind-district` is an unsynced, later local history and was preserved, including existing wallet/test modifications. It was geometry reference only, not wholesale merged.
- No wallet/auth protocol/contracts/token/withdrawal/new district changes. No NEAR integration. No posts/submissions performed here.

## Implemented, not visually accepted
1. Exact CV/Resume/Portfolio title/subline, smaller direct-loading supplied logo; guard empty Privy Vite env assignment.
2. First course opens directly for a new learner, persists earned CV and offers View updated CV; local-only start/finish/CV events with duplicate-credit protection.
3. SceneGate freezes camera/character while sheets are open, discards captured input, queues real resizes/graphics, skips unchanged dimensions. Optional `?debugScene=1` exposes nonpersonal pose/resize counters.
4. Valid scene ground, visible door markers/signs and minimal NPC greeting targets only; real occluders and UI-release rejection; no outside-city clamping or tap-home fallback; reset tap ray distance.
5. Dependency-free simplified adapter for existing campus/home/gym/boutique/prayer/trading/studio/conference purposes; composite furniture, wall details, collision/exit checks and original street return/persistence/presence while inside. See INTERIOR-RECONCILIATION.md for intentionally omitted old systems and untouched HTML destinations. Not a claim of production parity.
6. Runtime Low/Medium/High DPR/shadow/light/decor budgets, deferred until sheet closes and applied to lazy rooms. Safe decorative density only. Redundant place DOM updates/map redraws reduced. Local opt-in `?debugMetrics=1` -> `window.__grindPerformance`. See PERFORMANCE-VERIFICATION.md.

## Build / reproducibility
- Upstream lockfile was a literal file-reference placeholder. Regenerated from current declarations; missing existing Supabase import dependency restored.
- Compatible Solana optional peers pinned; Stripe peer installed. `.npmrc` records necessary legacy-peer-deps for existing TypeScript 7 versus Kit 5 optional peer range. No blanket overrides/stubs. Details in DEPENDENCIES.md.
- Clean npm ci, npm run build (TypeScript plus all logic/course/input/scene/tap/room/preset tests), git diff --check must pass before this checkpoint is pushed.
- Build warnings/deprecations exist; no audit/security certification claimed.

## Remaining acceptance / stop rule
Feature work stops after six. Preview only, from exact pushed commit. Compare title, city entry, first course, profile pages and top-up screen to current grinddistrict.vercel.app. Separate intentional changes from regressions; unexpected differences require stopping/reporting before more changes. Current GitHub source lacks later local/live wallet UI and other systems: do not silently restore those or claim parity.

Browser could not reach the local server despite Shell HTTP 200, so no UI/device tests are claimed. Pending: preview-browser review, throttled mid-range measurements, real Android run, non-founder course/CV proof, auth/top-up display comparison. Metrics start at main(), excluding earlier JS download/auth: measure full navigation/Enter-to-walkable separately. Reported ~one-minute entry, sliding and home zoom-out remain observations, not proven fixed.

Other GDD issues remain agent verification/fresh prompt, wallet credits/watcher, stats, professional profile/share polish and character/movement quality. Future NEAR/hackathon research and promotional X posts are separate approved-scope decisions, not implemented in this checkpoint.

## Narrow preview follow-up
Browser tester reported WASD hints behind a still-visible Pick a name panel and Learn taps intercepted by #menu; form completion/first-render success was not established. Source confirms successful signup previously left that panel active until first render, and initialization recovery could put its error in the hidden home view. Fixed presentation only: successful signup switches to home, starting entry hides the menu and shows boot status, reveal clears overlays, and early initialization failure returns to visible home/error. This is not a claim that the browser timeout's complete cause was reproduced. Automated tests use the reported Preview Tester/previewguest values and cover startup/reveal/failure/retry.

404s for /brand/logo-black.jpg and /brand/shrimp.png were confirmed missing static files. Restored their exact existing repository base64 payloads as normal images, preserving original branding. No replacement artwork or auth changes.

Read-only audit: this source configures Privy loginMethods ['email'] only; X/Google are not offered by this code even if dashboard-enabled. /api/privy/session verifies tokens but writes no database records. Supabase integration is ephemeral realtime presence/broadcast, not durable sign-in/session/course statistics. Learning lifecycle records are localStorage + local CustomEvents; no Dune integration or SQL migrations/hooks found. Actual Privy/Supabase data/dashboard configuration was not queried. Provider enablement, database telemetry and top-up repairs remain separate scope.

Next preview acceptance: finish the signup form explicitly; confirm loading status, first city render and absence of #menu interception; finish first course/CV; inspect errors if boot fails; confirm both branding URLs return 200. Then continue profiles/top-up/live comparison and throttled device measurements. Production remains untouched.
