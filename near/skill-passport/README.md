# Grind District Skill Passport (NEAR)

A small NEAR smart contract that keeps an account-bound record of which Grind District courses an
account has completed. It is new work for the NEAR hackathon. The 3D game, Base contracts and
Privy sign-in in the rest of this repository are the existing baseline and are not part of it.

## What a record is, and what it is not

- **Self-attested.** The account that calls `record_completion` is saying it finished the course.
  The contract does not grade answers or check anything from the game. It is not a verified,
  graded or accredited credential, and nothing here should be described as one.
- **Account-bound.** A record is always written for the calling account
  (`predecessor_account_id`). No method takes another account as the target, so no one,
  including the owner, can write into someone else's passport. Records cannot be edited,
  moved or deleted.
- **Minimal.** A record is `course_id`, `version` and `completed_at_ms` (block time). No names,
  usernames, emails, CV text, scores or balances.
- **No money.** No tokens, no payments, no attached deposits. Storage for records is paid by the
  contract account. Each account can hold at most 64 records and the catalogue at most 64 courses,
  so one account cannot make the contract store an unbounded amount.

## Interface

| Method | Kind | Who | What it does |
| --- | --- | --- | --- |
| `new(owner_id, courses)` | init | deployer | Sets the owner and the course catalogue (`[{course_id, version}]`, version >= 1). |
| `record_completion(course_id, version)` | change | any account | Records the course for the caller. Rejects unknown courses and any version other than the current one. Calling again for the same course and version returns the first record and writes nothing. Emits a `grind_skill_passport` `completion_recorded` event marked `self-attested`. |
| `set_course(course_id, version)` | change | owner only | Adds a course or raises its version. Versions only go up. Older records stay. |
| `get_completion(account_id, course_id)` | view | anyone | The account's record for that course at the highest version it holds, or `null`. |
| `has_completed(account_id, course_id)` | view | anyone | `true` if any record exists. Meant for gating a quest. |
| `list_completions(account_id, from_index?, limit?)` | view | anyone | The account's records in write order, up to 50 per page. |
| `get_courses()` | view | anyone | The catalogue with current versions. |
| `passport_info()` | view | anyone | Owner, `attestation: "self-attested"`, a plain note, course count. |

Course IDs are the game's `SKILL_ORDER` in `src/logic.ts`, all at version 1, as listed in
`init-args.example.json`.

## Run the tests

Needs Rust (stable) and network access to crates.io.

```bash
cd near/skill-passport
cargo test
cargo clippy --all-targets -- -D warnings
```

`Cargo.lock` is committed, so `cargo test --locked` uses the exact dependency versions tested here
(`near-sdk` 5.30.1).

## Build the wasm and deploy to testnet

The commands below follow the NEAR docs (cargo-near and near-cli-rs). They were **not run** for
this checkpoint; check them against the current docs at https://docs.near.org/smart-contracts/quickstart
before use.

```bash
# Tools
rustup target add wasm32-unknown-unknown
cargo install --locked cargo-near near-cli-rs

# Build (cargo-near sets the wasm flags the NEAR runtime accepts)
cd near/skill-passport
cargo near build non-reproducible-wasm
# For a verifiable build, use: cargo near build reproducible-wasm
# (needs Docker and a [package.metadata.near.reproducible_build] section; see the cargo-near docs)

# Deploy and initialise on testnet. Replace OWNER_ACCOUNT in init-args.example.json first.
near contract deploy <contract>.testnet \
  use-file target/near/grind_skill_passport.wasm \
  with-init-call new file-args init-args.example.json \
  prepaid-gas '100.0 Tgas' attached-deposit '0 NEAR' \
  network-config testnet sign-with-keychain send

# A player records a course (signed by the player's own testnet account)
near contract call-function as-transaction <contract>.testnet record_completion \
  json-args '{"course_id":"spot","version":1}' \
  prepaid-gas '30.0 Tgas' attached-deposit '0 NEAR' \
  sign-as <player>.testnet network-config testnet sign-with-keychain send

# Anyone reads it back
near contract call-function as-read-only <contract>.testnet get_completion \
  json-args '{"account_id":"<player>.testnet","course_id":"spot"}' \
  network-config testnet now
```

No testnet or mainnet account, key or deployment exists for this contract yet. Creating the
deployer account, deploying and signing are separate steps that need the owner's approval.

## Status of this checkpoint

| Check | Status |
| --- | --- |
| Unit tests (`cargo test`, 22 tests, native, near-sdk `unit-testing` mock) | Ran, all pass |
| `cargo clippy --all-targets -D warnings` | Ran, clean |
| Mutation check: switching the record target to the signer, removing the duplicate guard, or removing the version check each makes tests fail | Ran by hand |
| wasm build (`cargo near build`) | Not run: the build sandbox could not download the wasm32 target |
| Sandbox integration tests (near-workspaces) | Not written yet |
| Testnet deployment, transactions, explorer links | Not done |
| Game integration (connect a NEAR account, record after a course, unlock a quest) | Not started |

## Tests cover

- Another account's passport cannot be written: a call always lands on the caller; with a
  different signer and caller, the record goes to the caller, not the signer; the owner's calls
  land on the owner's own passport.
- Duplicates: a repeat call returns the first record with its original timestamp, writes nothing
  and emits no second event.
- Invalid courses: unknown ID, empty ID, wrong version, an old version after a bump, malformed IDs
  and version 0 at init. A rejected call leaves no record.
- Persistence and reads: the contract is written to storage, dropped and loaded again, and the
  record, catalogue and owner read back. `get`, `has`, `list` with paging, `get_courses`,
  `passport_info`.
- Catalogue: only the owner can change it, versions only go up, old records survive a bump.
- Bounds: the 65th record for one account is refused with "Passport is full"; the catalogue
  stops at 64 courses.

## Licence

The code in this `near/skill-passport` directory is MIT licensed (see `LICENSE`). That licence does not extend to the rest of the Grind District repository.
