# Onchain 2048 · Base ⬥ Chainlink VRF + NFT Edition

Fully on-chain **2048** on the **Base** network — a Solidity contract where the whole board lives in one `uint64`, tile spawns come from **Chainlink VRF v2.5**, and a one-of-one **ERC-721 trophy** with fully on-chain SVG metadata is minted at score 4096. Ships with a React frontend that simulates the exact on-chain engine *and* plays against your deployed contract through your wallet.

## The rules, on-chain

**Free-to-play** — no entry fee, no pot, no house cut, no withdrawals and no owner logic. The only costs are the Base transaction fee and the LINK that funds the VRF subscription.

- **Entry** — `start()` is free (gas only). It requests two random words; `fulfillRandomWords()` spawns the first two tiles a couple of blocks later.
- **Move** — every slide is one `move(uint8 dir)` transaction (`0=left, 1=right, 2=up, 3=down`), using a **commit–reveal** flow:
  - *commit*: slide + merge + score are deterministic, so they land in your transaction;
  - *reveal*: one random word is requested; when Chainlink fulfils it, the new tile spawns and the win / game-over / trophy checks run.
  - A no-op move reverts (`NoopMove`) **before** any VRF request, so neither gas nor LINK is wasted.
- **Randomness** — verified Chainlink VRF v2.5 words, not `blockhash`. Neither validators nor try/catch player contracts can predict or steer the spawns.
- **Win** — tiling **2048** flips the run to `ST_WON`; no money changes hands.
- **Trophy** — the first time a player's score crosses **4096**, the contract mints a one-of-one **ERC-721 trophy** (`Onchain 2048` / `O2048`), freezing the board at mint time. Metadata — including an **SVG render of the board** — is generated fully on-chain inside `tokenURI()`. No IPFS, no servers.

## Storage architecture

The 4×4 board is packed into a single `uint64`: 16 nibbles, each storing a *power of two* (`1 → 2`, …, `11 → 2048`, `0` = empty). A player's entire run (board + score + moves + state) fits in **one storage slot**, so every move touches exactly one slot.

Run states: `0` none · `1` active · `2` won · `3` game over · `4` pending (awaiting VRF).

## Repo structure

```
contracts/Onchain2048.sol   ← the game + VRF consumer + ERC-721 trophy + on-chain SVG metadata
test/Onchain2048.t.sol      ← Foundry suite (16 tests) with a mock VRF coordinator
src/                        ← React + Vite + Tailwind frontend
  game/                     ← the engine (mirrors the contract nibble-for-nibble)
  data/contract.ts          ← imports the .sol via ?raw — UI always shows the real source
  components/               ← board, side panel, sections
foundry.toml                ← Foundry profile (solc 0.8.36, optimizer 200, viaIR off, remappings)
```

## Test the contract

```bash
forge install foundry-rs/forge-std --no-commit
forge install smartcontractkit/chainlink --no-commit
forge test -vv
```

The suite deploys the contract against a **mock VRF coordinator** in every test and engineers exact boards with `vm.store`: start → pending → two spawned tiles, exact merge scoring, one-spawn-per-fulfil, win at 2048, mint-once-at-4096 (with snapshot + tokenURI assertions), ERC-721 transfer/approval/auth paths, `NoopMove` sending no VRF request, `PendingRandomness`/`RunBusy` guards, and a fuzz check that every fresh board is playable.

## Set up Chainlink VRF v2.5 (one-time)

1. Go to [vrf.chain.link](https://vrf.chain.link), switch to **Base Sepolia** (or Mainnet), create a **subscription** and fund it with LINK (test LINK: [faucets.chain.link](https://faucets.chain.link)).
2. Note your **subscription id**.
3. Take the network's **coordinator address** and **key hash** from [docs.chain.link/vrf/v2-5/supported-networks](https://docs.chain.link/vrf/v2-5/supported-networks). For Base Sepolia: coordinator `0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE`, key hash `0x00000000000000000000000000000000000000000000000000000006fc23ac00` (30 gwei).

Those three values are the contract's constructor arguments.

## Deploy with Foundry

```bash
# Base Sepolia (test first — faucet.base.org for ETH)
forge create contracts/Onchain2048.sol:Onchain2048 \
  --rpc-url https://sepolia.base.org \
  --constructor-args 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE $VRF_SUB_ID \
    0x00000000000000000000000000000000000000000000000000000006fc23ac00 \
  --account $WALLET_ALIAS \
  --verify --verifier-url https://api-sepolia.basescan.org/api \
  --etherscan-api-key $BASESCAN_API_KEY

# Base Mainnet (values from the supported-networks page)
forge create contracts/Onchain2048.sol:Onchain2048 \
  --rpc-url https://mainnet.base.org \
  --constructor-args $VRF_COORDINATOR $VRF_SUB_ID $VRF_KEY_HASH \
  --verify \
  --verifier-url https://api.basescan.org/api \
  --etherscan-api-key $BASESCAN_API_KEY
```

Compile with **solc 0.8.36** (pinned in `foundry.toml`), optimizer **200 runs**, **viaIR off** — this avoids both of Basescan's medium compiler-bug advisories (SOL-2026-2 / SOL-2026-3) and the EIP-170 size limit.

## Test on Remix (no install)

1. [remix.ethereum.org](https://remix.ethereum.org) → new file `Onchain2048.sol` → paste the source. Remix resolves the two `@chainlink/contracts` GitHub imports automatically. Compile with **solc 0.8.36**, **Optimization (200)**, viaIR off.
2. Create & fund a VRF v2.5 subscription on [vrf.chain.link](https://vrf.chain.link) (Base Sepolia testnet) — see the section above.
3. Deploy & Run → `Injected Provider – MetaMask` on Base Sepolia (or `Remix VM (Cancun)` for a dry compile). Constructor args: coordinator, subscription id, key hash. **Leave the Value field at 0** — nothing is payable.
4. Call `start()` — free, gas only. `stateOf` shows `4` (pending) until Chainlink fulfils; the two tiles appear a few seconds later.
5. Play with `move(dir)`; each move merges instantly and spawns once fulfilled. Past score 4096, `nftOf(address)` returns your trophy id and `tokenURI(id)` the fully on-chain metadata.

## Play from the command line

```bash
cast send $GAME "start()" --rpc-url https://sepolia.base.org               # free — gas only
cast send $GAME "move(uint8)" 0 --rpc-url https://sepolia.base.org         # commit left; VRF spawns after
cast call $GAME "gridOf(address)" $PLAYER --rpc-url https://sepolia.base.org
cast call $GAME "stateOf(address)" $PLAYER --rpc-url https://sepolia.base.org  # 4 = awaiting VRF
cast call $GAME "tokenURI(uint256)" 1 --rpc-url https://sepolia.base.org   # on-chain SVG
```

## Run the frontend

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
```

### Play your deployed contract from the site

The game ships with an **on-chain mode**: paste your deployed contract address into the bar above the board, pick **Base Sepolia** or **Base Mainnet**, and connect your wallet (MetaMask). The site then reads `gridOf` / `scoreOf` / `stateOf` / `nftOf` live (the badge shows *Awaiting Chainlink VRF…* while state is `4`), sends real `start()` and `move(dir)` transactions, decodes custom-error reverts (`NoopMove` just shakes the board — no gas or LINK spent; `PendingRandomness` means the previous tile is still on its way), and renders your minted trophy straight from the on-chain `tokenURI()` SVG. Until you connect, the page runs a pixel-perfect local simulation of the exact same engine.

## Quick start (clone)

```bash
git clone https://github.com/msnik/Base2048.git
cd Base2048
npm install
npm run dev
```

## Push this project to GitHub

From the project root, just run:

```bash
./push.sh
```

It runs `git init` (if needed), commits, sets the remote to `https://github.com/msnik/Base2048.git` and pushes `main`. If the remote already has commits (e.g. a generated README), run `git pull origin main --rebase` first, then push again.

## Notes

- Randomness is **Chainlink VRF v2.5** — spawns cannot be predicted or steered. Keep the subscription funded with LINK; if it runs dry, runs simply pause at the pending state (no state can be corrupted).
- The contract holds **no ETH and has no owner logic** — the only admin surface is the Chainlink coordinator wiring, fixed at deploy time in immutables.
- Trophy NFTs follow the full ERC-721 spec (ERC-165, approvals, safe transfers).

## License

MIT — same as the contract.
