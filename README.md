# Onchain 2048 · Base ⬥ NFT Edition

Fully on-chain **2048** on the **Base** network — a single-file Solidity contract where the whole board lives in one `uint64`, plus a React frontend that simulates the exact on-chain engine and the contract source with syntax highlighting.

## The rules, on-chain

- **Entry** — `start()` is payable; the entry fee (`0.000042 ETH` by default) feeds the prize pot.
- **Move** — every slide is one `move(uint8 dir)` transaction (`0=left, 1=right, 2=up, 3=down`). Slides, merges, spawns and win/lose checks all happen in that single call; a no-op move reverts, so no gas is wasted.
- **Prize** — the first player to tile **2048** takes **90% of the pot** in the same transaction; 10% accrues to the house.
- **Trophy** — the first time a player's score crosses **4096**, the contract mints a one-of-one **ERC-721 trophy** (`Onchain 2048` / `O2048`), freezing the board at mint time. Metadata — including an **SVG render of the board** — is generated fully on-chain inside `tokenURI()`. No IPFS, no servers.

## Storage architecture

The 4×4 board is packed into a single `uint64`: 16 nibbles, each storing a *power of two* (`1 → 2`, …, `11 → 2048`, `0` = empty). A player's entire run (board + score + moves + state) fits in **one storage slot**, so every move touches exactly one slot — roughly **35k gas** per move.

## Repo structure

```
contracts/Onchain2048.sol   ← the game + ERC-721 trophy + on-chain SVG metadata
src/                        ← React + Vite + Tailwind frontend
  game/                     ← the engine (mirrors the contract nibble-for-nibble)
  data/contract.ts          ← contract source displayed in the UI
  components/               ← board, side panel, sections
foundry.toml                ← Foundry profile for compiling/deploying the contract
```

## Deploy with Foundry

```bash
# Base Sepolia (test first — faucet.base.org)
forge create contracts/Onchain2048.sol:Onchain2048 \
  --rpc-url https://sepolia.base.org \
  --constructor-args 42000000000000 \
  --account $WALLET_ALIAS \
  --verify --verifier-url https://api-sepolia.basescan.org/api \
  --etherscan-api-key $BASESCAN_API_KEY

# Base Mainnet
forge create contracts/Onchain2048.sol:Onchain2048 \
  --rpc-url https://mainnet.base.org \
  --constructor-args 42000000000000 \
  --verify \
  --verifier-url https://api.basescan.org/api \
  --etherscan-api-key $BASESCAN_API_KEY
```

## Test on Remix (no install)

1. [remix.ethereum.org](https://remix.ethereum.org) → create `Onchain2048.sol`, paste the source, compile with **solc ≥ 0.8.24**.
2. Deploy & Run → environment `Remix VM (Cancun)` (free) or `Injected Provider – MetaMask` on **Base Sepolia** (chainId 84532, faucet: faucet.base.org).
3. Constructor arg: `42000000000000`. **Leave the Value field at 0** — the constructor isn't payable; the entry fee is paid via `start()`.
4. Value field only takes whole numbers: set the unit to **Wei** and enter `42000000000000` (= 0.000042 ETH), then call `start()`.
5. Play with `move(dir)` (`0=left 1=right 2=up 3=down`), read `gridOf` / `scoreOf`; past score 4096 `nftOf(address)` returns your trophy id and `tokenURI(id)` the fully on-chain metadata.

## Play from the command line

```bash
cast send $GAME "start()" --value 0.000042ether --rpc-url https://mainnet.base.org
cast send $GAME "move(uint8)" 0 --rpc-url https://mainnet.base.org        # move left
cast call $GAME "gridOf(address)" $PLAYER --rpc-url https://mainnet.base.org
cast call $GAME "tokenURI(uint256)" 1 --rpc-url https://mainnet.base.org  # on-chain SVG
```

## Run the frontend

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

The page opens straight into the playable game: keyboard / swipe controls, per-move transaction log, a live `uint64` storage snapshot of your board, live Base block & gas data, the contract source with highlighting, and a deploy guide.

## Quick start (clone)

```bash
git clone https://github.com/msnik/Base2048.git
cd Base2048
npm install
npm run dev
```

## Push this project to GitHub

From the project root:

```bash
git init
git add .
git commit -m "Onchain 2048 on Base — Solidity game + ERC-721 trophy + React frontend"
git branch -M main
git remote add origin https://github.com/msnik/Base2048.git
git push -u origin main
```

Or just run `./push.sh` — it does exactly the steps above (skips `git init` if already done). If the remote already has commits (e.g. a generated README), run `git pull origin main --rebase` before pushing.

## Notes

- `blockhash`-based entropy is fine for a demo — use **Chainlink VRF** before running with real stakes.
- Trophy NFTs follow the full ERC-721 spec (ERC-165, approvals, safe transfers).

## License

MIT — same as the contract.
