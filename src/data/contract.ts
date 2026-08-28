// Contract metadata + runtime loader.
// The .sol source is fetched at runtime (works in dev, build and the static
// preview alike — no ?raw imports, so no module-MIME issues).

export const CONTRACT_NAME = 'Onchain2048';
export const CONTRACT_FILE = 'Onchain2048.sol';
export const SOLIDITY_VERSION = '0.8.36';

const sourceUrl = new URL('../../contracts/Onchain2048.sol', import.meta.url);

let cachedSource: string | null = null;

export async function fetchContractSource(): Promise<string> {
  if (cachedSource) return cachedSource;
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`failed to load contract (HTTP ${res.status})`);
  cachedSource = await res.text();
  return cachedSource;
}

export interface FunctionInfo {
  name: string;
  signature: string;
  kind: 'write' | 'payable' | 'view' | 'owner';
  gas: string;
  desc: string;
}

export const FUNCTIONS: FunctionInfo[] = [
  {
    name: 'constructor',
    signature: 'constructor(address vrfCoordinator, uint256 subId, bytes32 keyHash)',
    kind: 'write',
    gas: '≈ 1.9M',
    desc: 'Wires the Chainlink VRF v2.5 coordinator, your funded subscription id and the network key hash. Values live in immutables — they can never change.',
  },
  {
    name: 'start',
    signature: 'start()',
    kind: 'write',
    gas: '≈ 95k + LINK',
    desc: 'Free — only the Base tx fee. Flips the run to ST_PENDING and asks the VRF coordinator for two random words; fulfillRandomWords() spawns the first two tiles.',
  },
  {
    name: 'move',
    signature: 'move(uint8 dir)',
    kind: 'write',
    gas: '≈ 85k + LINK',
    desc: 'Commit phase: 0=left, 1=right, 2=up, 3=down. Slide + merge + score land in this tx, then one random word is requested for the spawn. No-op moves revert (NoopMove) so no VRF fee is wasted.',
  },
  {
    name: 'cancelPending',
    signature: 'cancelPending()',
    kind: 'write',
    gas: '≈ 40k',
    desc: 'Escape hatch: if a VRF request never fulfils (e.g. the subscription ran dry), cancel it after 128 blocks so you are not locked out. A stuck start() wipes the run; a stuck move() keeps your committed board/score and only drops the pending spawn.',
  },
  {
    name: 'fulfillRandomWords',
    signature: 'fulfillRandomWords(uint256, uint256[])',
    kind: 'owner',
    gas: 'coordinator only',
    desc: 'Reveal phase, called by the Chainlink node only: spawns the tile(s) from the verified random words and finalises win / game-over / NFT-trophy checks.',
  },
  {
    name: 'tokenURI',
    signature: 'tokenURI(uint256) → string',
    kind: 'view',
    gas: 'free',
    desc: 'Fully on-chain meta base64 JSON pointing at an SVG that renders the frozen board snapshot. No IPFS, no servers.',
  },
  {
    name: 'nftOf / snapshotOf',
    signature: 'nftOf(address) → uint256',
    kind: 'view',
    gas: 'free',
    desc: 'Trophy token id of a player (0 if not earned yet) and the board/score/moves frozen into any token.',
  },
  {
    name: 'gridOf / awaitingMove',
    signature: 'gridOf(address) → uint8[16]',
    kind: 'view',
    gas: 'free',
    desc: "A player's board as 16 exponents, plus whether a move is still waiting for its VRF fulfilment.",
  },
  {
    name: 'boardOf / scoreOf / stateOf',
    signature: 'boardOf(address) → uint64 …',
    kind: 'view',
    gas: 'free',
    desc: 'Direct access to the packed storage: board, score and state (0 none / 1 active / 2 won / 3 over / 4 pending).',
  },
  {
    name: 'transferFrom / safeTransferFrom',
    signature: 'safeTransferFrom(address,address,uint256)',
    kind: 'write',
    gas: '≈ 32k',
    desc: 'Standard ERC-721 transfers, approvals and operator flags for the trophy token (O2048).',
  },
];

// ── Chainlink VRF v2.5 — values for the constructor ─────────────
export const VRF_NETWORKS = [
  {
    label: 'Base Sepolia',
    coordinator: '0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE',
    keyHash: '0x00000000000000000000000000000000000000000000000000000006fc23ac00',
    keyHashNote: '30 gwei key hash',
  },
  {
    label: 'Base Mainnet',
    coordinator: '<from docs.chain.link/vrf/v2-5/supported-networks>',
    keyHash: '<key hash from the same page>',
    keyHashNote: 'verify before deploying',
  },
];

export const DEPLOY_MAINNET = `forge create contracts/Onchain2048.sol:Onchain2048 \\
  --rpc-url https://mainnet.base.org \\
  --constructor-args $VRF_COORDINATOR $VRF_SUB_ID $VRF_KEY_HASH \\
  --verify \\
  --verifier-url https://api.basescan.org/api \\
  --etherscan-api-key $BASESCAN_API_KEY`;

export const DEPLOY_TESTNET = `forge create contracts/Onchain2048.sol:Onchain2048 \\
  --rpc-url https://sepolia.base.org \\
  --constructor-args 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE $VRF_SUB_ID \\
    0x00000000000000000000000000000000000000000000000000000006fc23ac00 \\
  --account $WALLET_ALIAS \\
  --verify --verifier-url https://api-sepolia.basescan.org/api \\
  --etherscan-api-key $BASESCAN_API_KEY`;

export const VRF_SETUP = `# 1) install the libraries
forge install foundry-rs/forge-std --no-commit
forge install smartcontractkit/chainlink --no-commit

# 2) create a VRF v2.5 subscription & fund it with LINK
#    → https://vrf.chain.link  (Base Sepolia testnet LINK from faucets)

# 3) the three constructor values
#    coordinator + key hash  → docs.chain.link/vrf/v2-5/supported-networks
#    sub id                  → your subscription page on vrf.chain.link`;

export const INTERACT_COMMANDS = `# Start a run — free, the VRF spawns two tiles a few seconds later
cast send $GAME "start()" --rpc-url https://sepolia.base.org

# Commit a move left (dir = 0) — the spawn lands when Chainlink fulfils
cast send $GAME "move(uint8)" 0 --rpc-url https://sepolia.base.org

# Read a player's board / state (4 = awaiting VRF)
cast call $GAME "gridOf(address)" $PLAYER --rpc-url https://sepolia.base.org

# Blocks left before a stuck request can be cancelled (0 = cancellable now)
cast call $GAME "pendingBlocksLeft(address)" $PLAYER --rpc-url https://sepolia.base.org

# Escape hatch — unstick a VRF request that never fulfilled
cast send $GAME "cancelPending()" --rpc-url https://sepolia.base.org

# Trophy metadata — fully on-chain SVG, no IPFS
cast call $GAME "tokenURI(uint256)" 1 --rpc-url https://sepolia.base.org`;

export const DIR_NAMES = ['Left', 'Right', 'Up', 'Down'] as const;
export const DIR_ARROWS = ['←', '→', '↑', '↓'] as const;

export const NFT_THRESHOLD = 4096;
