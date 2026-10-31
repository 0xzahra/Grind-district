# Grind contracts: internal review (not a third-party audit)

Status: nothing deployed by this repo. `forge test`: 20/20 passing (GrindLedger + GrindTreasury).
Get an independent audit before mainnet if real money flows through.

## GrindTreasury (Ownable2Step, ReentrancyGuard)
- Holds ETH/ERC20; only owner (the Safe) withdraws. Two-step ownership; renounce disabled. Not upgradeable.
- `depositERC20` records the received delta (fee-on-transfer safe). Plain ERC20 transfers emit no event (by design).
- Withdrawals emit before the external call; guarded by nonReentrant + onlyOwner. OK.

## GrindLedger (ERC20 "GRIND", Ownable, ReentrancyGuard)
- `topUp` (ETH) / `topUpUSDC`: forwards funds straight to `treasury` (immutable). Never holds funds.
- `credit(player, amount, ref)`: onlyOwner mint, once per `ref`. **Owner = minting authority**.
- 2% fee (`FEE_BPS=200`) on wallet-to-wallet transfers to the treasury; mint/burn and treasury transfers exempt.

### Findings
1. **Owner = Safe means every credit needs a Safe transaction.** If the server must credit automatically, add a separate `minter` role (hot server key, rate/amount-capped) while the Safe keeps admin. Currently single-step `Ownable`: consider `Ownable2Step` like the treasury.
2. **No mint cap / no amount bound on `credit`.** A compromised owner can mint unlimited GRIND. Mitigated only by the Safe threshold.
3. **Fee applies to DEX/router transfers** (pools, approvals via transferFrom): GRIND is fee-on-transfer; many AMMs mishandle that. Fine if GRIND stays in-game only.
4. **Treasury immutable**: if the Safe changes, redeploy the ledger.
5. **`topUp` ref is caller-chosen**: server must bind ref->player off-chain and credit from the TopUp event, never from client input.
6. Rounding: amounts < 50 wei pay no fee. Negligible.
7. If the treasury address is a contract that rejects ETH, `topUp` reverts (ForwardFailed). Safe accepts ETH: OK.

## Deploy (Base mainnet), when approved
- Treasury: `OWNER=0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a forge script script/DeployGrindTreasury.s.sol --rpc-url https://mainnet.base.org --account <keystore> --broadcast --verify`
- Ledger: `OWNER=0x43985e56ac0c2CD9F95d4C1248cEB14E66Aa254a forge script script/DeployGrindLedgerMainnet.s.sol --rpc-url https://mainnet.base.org --account <keystore> --broadcast --verify` (USDC 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; script requires chainid 8453 and OWNER == Safe with code).
- Run without `--broadcast` first to simulate. Need `BASESCAN_API_KEY` for `--verify`. Deployer 0xD102…eE61 with 0.0005 ETH covers both deploys at current Base fees (each ~1–2M gas at <0.01 gwei), but top up a little for margin.
- Then set `VITE_LEDGER_ADDRESS` / server env and wire the frontend top-up + server crediting.
