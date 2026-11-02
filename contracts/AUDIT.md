# Internal review of GrindRecord

Reviewed 30 October 2026, in the same session that wrote the contract.

This is an internal review of the source. It is not a sign-off from an outside firm. `GrindRecord` is not deployed. The city does not send transactions to it, does not ask for a wallet, and does not treat the practice USD ledger as an on-chain balance.

## Scope

- `contracts/src/GrindRecord.sol` only.
- Solidity 0.8.24, optimizer on, 200 runs.
- Tests in `contracts/test/GrindRecord.t.sol` (`forge test` from `contracts/` after `forge install foundry-rs/forge-std`).
- The browser game, the theme file, and the practice books are out of scope except where a later change might wire them in. That wiring is not allowed by this review.

## What the contract is

A soulbound proof-of-work record.

- Eight course ids, in the same order as the learning hall: 0 spot, 1 risk, 2 staking, 3 airdrops, 4 memes, 5 agents, 6 building, 7 carbon.
- Each course can be filed once. XP gained is 70 plus a bonus of 0 to 25.
- Reputation is a separate counter. A note is 1 to 25 and does not change XP or rank. Declining a family request is a city rule and is not a transaction.
- Rank is a pure function of XP, with the same cuts as the city: shrimp 0, crab 70, fish 210, dolphin 420, shark 700, whale 1100.
- There is no token, no transfer, and no practice-USD balance.
- `receive` and `fallback` revert `FundsNotAccepted`. The contract does not custody ether.
- Owner and attestor are different roles. The owner can pause, replace the attestor, and start a two-step ownership transfer. The owner cannot file a course or note reputation. There is no renounce.

## Checks

| Check | Result |
| --- | --- |
| Course bit test parenthesized | Solidity binds `!=` tighter than `&`. `courses & bit != 0` means `courses & (bit != 0)`. Both bit tests use parentheses. |
| Unknown course rejected before the shift | Course 8 reverts `UnknownCourse` and leaves XP at 0. The view `courseFiled` returns false for an out-of-range id and does not revert. |
| One filing per course | A second file reverts `CourseAlreadyFiled`. XP stays at the first filing. |
| Bonus cap | Bonus 26 reverts and writes nothing. |
| Full card | Eight courses at bonus 25 is 760 XP and course bits `255`. Rank is shark (4), not whale. |
| Reputation cannot buy rank | A note of 25 leaves XP at 0 and rank at shrimp. Zero and 26 revert. |
| Access | A stranger cannot file, note, pause, rotate the attestor, or accept ownership. The owner cannot file or note. |
| Pause | Pause blocks `fileCourse` and `noteReputation`. Views stay available. |
| Ownership | Transfer does not move `owner` until `acceptOwnership`. A non-pending caller reverts. |
| Zero addresses | Constructor, `fileCourse`, `noteReputation`, `setAttestor`, and `transferOwnership` reject `address(0)`. |
| Ether | A value call with empty calldata and a value call with calldata both revert `FundsNotAccepted` and leave balance 0. |
| Reentrancy | The contract makes no external call to a player, a token, or any other contract. State is written before the events. There is no callback surface. |
| Arithmetic | Solidity 0.8.24 checks overflow. XP and reputation are `uint256`. |

## Accepted design

These are not defects to "fix" by adding a token or a wallet.

1. The attestor is trusted. The contract does not check that a player passed a course. A filing is permanent for that course id. Deploying this with an externally owned attestor on a public chain would let that key write anyone's record.
2. The owner can replace the attestor in one transaction and can pause. There is no timelock.
3. Whale is 1100 XP. The learning hall at the maximum bonus stops at shark (760). Other practice actions that reach whale live in the city, not in this contract. Reputation must not be added to XP to close that gap.
4. `setAttestor` is not two-step. A mistaken address can be corrected by the owner. If the owner key is lost, the attestor cannot be rotated and the contract cannot be paused.
5. There is no proxy and no upgrade path. A deployed mistake would be permanent. That is why this file stays source.

## Residual risk

Do not deploy from this review.

- No outside reviewer has read it.
- The owner is a single address, not a multisig.
- A bad filing cannot be undone.
- Nothing here authorizes the city to prompt for a wallet, a seed phrase, or a signature.
- The practice ledger in the browser is still labeled practice USD. It is not this contract and it is not real funds.

## Before any future deploy

Repeat this review by someone who does not maintain the contract. Put the owner behind a multisig. Keep the attestor separate from the owner. Decide how a course filing is attested without moving the practice ledger on chain. Until that exists, the next session leaves `GrindRecord` as source and tests.
