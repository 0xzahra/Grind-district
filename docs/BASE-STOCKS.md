# Stockholders' Club on Base

Tokenized stocks in Grind District. Coinbase lists hundreds of stocks as tokens on Base; the game reads them, it never sells them.

The Stockholders' Club is a building in the city that opens for players who hold a tokenized stock on Base. A player proves a holding with one signature, uses the club's research sessions, wears a club pin, and loses membership as soon as they sell.

## How to try it

| Do | You should see |
| --- | --- |
| Open [grinddistrict.app](https://www.grinddistrict.app), enter the city, and walk west of the gym to the stone building beside the Members' lounge (or open the Map). Tap **Go in**. | The club card: what the club is, three steps to join, and *Check an address*. |
| Under *Check an address*, paste any public Base address that holds a Coinbase stock token, then tap **Check**. | *Would qualify* and the stocks it holds with share counts, read live from Base. No signature is needed, and nothing is stored. |
| With a wallet that holds at least 0.01 share of a listed stock, open the game in that wallet's browser and tap **Prove a holding**. Sign the message. | *Welcome to the Stockholders' Club*, a gold **Member** card, and *Your stocks (private)*. |
| Tap a stock. | Its research session: the shares you hold, the reference price (NAV) and how fresh it is, the ISIN, what the token is, and a four-step research checklist. |
| Open Profile. | A *Stockholders' Club* pin on your nameplate. You can hide it from the club card. |
| Sell or move the stock so the wallet holds less than 0.01 share, then open the club again. | *Your membership has lapsed*, and the pin is gone. Hold again and tap **Check again** to rejoin. |

Coinbase offers its stock tokens to eligible people outside the United States. Anyone can still use *Check an address*.

## How it works

- **The stock list** comes from Coinbase's public [Tokenized Stocks API](https://docs.base.org/build-on-base/integrate-defi/list-tokenized-stocks): 348 stocks on 13 Nov 2026. That API sends no CORS header, so the game reads it through [`api/_stocks.ts`](../api/_stocks.ts), served at `/api/stocks`, which trims it and caches it for ten minutes.
- **Proof of the address** is one `personal_sign` message: a signature, not a transaction. It is checked with viem's `verifyMessage` against Base, so smart wallets work too.
- **The holding check** calls `balanceOf` for that one address on each listed stock token in a few Multicall3 batches on Base mainnet, then multiplies by each token's multiplier to get shares. At least 0.01 share of any one stock makes a member.
- **Lapse.** Every visit to the club re-checks the wallet without a new signature, and so does opening Profile when the last check is over ten minutes old. Below the minimum, membership ends at once. A wallet proof older than 30 days asks for a new signature.
- **Code:** [`src/stockClub.ts`](../src/stockClub.ts) (logic and the club card), [`api/_stocks.ts`](../api/_stocks.ts) (the list), the building in [`src/world.ts`](../src/world.ts) and the pin in [`src/ui.ts`](../src/ui.ts).

## Privacy

- The game reads only the listed stock tokens' balances for the address you signed with, and nothing else in the wallet.
- The address and the amounts stay on your device, beside the save. No server stores them, and the save format did not change.
- Other players see only the club pin, and only if you choose to show it.

## What the club is not

- It gives no voting or other rights in any company. Its benefits are research sessions and a pin.
- It sells nothing and moves no tokens. Grind District never asks for a seed phrase.
- It is not financial advice, and it has no prediction markets or games of chance.

## Verification

- A headless browser test ran the whole flow on Base mainnet: join with a signature, member card, research session, nameplate pin, then a lapse after the holding was gone. The test wallet does not hold stocks, so the test swapped in a public address that does, but only for the balance read. The signature check ran on the real test wallet.
- *Check an address* was tested live against a public holder of 14 stock tokens.
- Not yet tested: the join flow with a real wallet app on a phone.
