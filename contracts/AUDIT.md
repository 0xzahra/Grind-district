# Grind contracts: internal review (not a third-party audit)

This is an internal review by the maintainers. It is not an audit by an outside firm.

## Deployment (Base mainnet)
- **GrindTreasury**: `0x6bc81e26832986d56b6e59c31599f3113971ec33`
- **GrindLedger**: `0x88091d65d38a4e153267f43744fb48e10e456d30`
- Both are owned by a Safe multisig. USDC on Base: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`.

## Tests
`forge test`: **30/30 passing** (15 GrindTreasury, 15 GrindLedger).

## GrindTreasury (Ownable2Step, ReentrancyGuard)
- Holds ETH/ERC20; only the owner (the Safe) withdraws. Two-step ownership; renounce disabled. Not upgradeable.
- `depositERC20` records the received delta (fee-on-transfer safe). Plain ERC20 transfers emit no event (by design).
- Withdrawals emit before the external call; guarded by nonReentrant + onlyOwner.

## GrindLedger (ERC20 "GRIND", Ownable, ReentrancyGuard)
- `topUp` (ETH) / `topUpUSDC`: forwards funds straight to `treasury` (immutable). Never holds funds.
- `credit(player, amount, ref)`: onlyOwner mint, once per `ref`. Players are credited 98% of the top-up.
- 2% fee (`FEE_BPS=200`) on wallet-to-wallet transfers to the treasury; mint/burn and treasury transfers exempt.

### Findings
1. **Owner = Safe means every credit needs a Safe transaction.** For automatic crediting, consider a separate capped `minter` role while the Safe keeps admin. Consider `Ownable2Step` like the treasury.
2. **No mint cap on `credit`.** A compromised owner could mint unlimited GRIND; mitigated by the Safe threshold.
3. **Fee applies to DEX/router transfers**: GRIND is fee-on-transfer; many AMMs mishandle that. Fine while GRIND stays in-game.
4. **Treasury is immutable**: if the Safe changes, redeploy the ledger.
5. **`topUp` ref is caller-chosen**: the server must bind ref->player off-chain and credit from the TopUp event, never from client input.
6. Rounding: amounts < 50 wei pay no fee. Negligible.
7. If the treasury rejected ETH, `topUp` would revert (ForwardFailed). The treasury accepts ETH.
