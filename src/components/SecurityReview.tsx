import { useEffect, useState } from 'react';
import { Reveal, SectionHeader } from './ui';

// ── findings ────────────────────────────────────────────────────
type Severity = 'safe' | 'info' | 'medium' | 'critical';

const SEV: Record<Severity, { label: string; cls: string }> = {
  critical: { label: 'CRITICAL', cls: 'bg-rose/15 text-rose border-rose/40' },
  medium: { label: 'MEDIUM', cls: 'bg-amber/15 text-amber border-amber/40' },
  info: { label: 'INFO', cls: 'bg-base/10 text-base-bright border-base/30' },
  safe: { label: 'SAFE', cls: 'bg-mint/10 text-mint border-mint/30' },
};

const FINDINGS: {
  id: string;
  sev: Severity;
  area: string;
  what: string;
  status: string;
}[] = [
  {
    id: 'S-01',
    sev: 'critical',
    area: 'Entropy — _entropy()',
    what: 'blockhash + timestamp + player is fully predictable to validators — and to a player contract that try/catches its own move() and keeps only the lucky outcome. Spawns (and therefore merges, the pot and the NFT) can be forced.',
    status: 'Fine for a demo. For any real pot: replace with Chainlink VRF v2.5 (snippet below) before mainnet.',
  },
  {
    id: 'S-02',
    sev: 'safe',
    area: 'Payout reentrancy — move()',
    what: 'The ETH prize is sent with a low-level call to an arbitrary winner contract. A malicious winner re-enters on receive().',
    status: 'Safe by design: state flips to ST_WON and houseCut is updated BEFORE the call (checks-effects-interactions). A re-entered move() hits NotActive(). Covered by test_Win_FurtherMovesRevert.',
  },
  {
    id: 'S-03',
    sev: 'safe',
    area: 'Player funds at deposit',
    what: 'Does the contract ever touch wallet approvals, ERC-20 allowances, delegatecall, proxy storage or upgradability?',
    status: 'No. Native ETH only, you push value in start() yourself, no external token calls, no delegatecall/selfdestruct, immutable single deployment. Worst case for a player is losing the entry fee they chose to pay.',
  },
  {
    id: 'S-04',
    sev: 'medium',
    area: 'Owner privileges — sweepHouseCut()',
    what: 'A single immutable owner can withdraw the accrued 10%. If that key leaks, the house cut is gone.',
    status: 'Deploy the owner as a Safe multisig or hardware-wallet address. The owner can never touch player runs or the pot.',
  },
  {
    id: 'S-05',
    sev: 'medium',
    area: 'No pause / no pot cap',
    what: 'If a logic bug is found after deploy, the pot keeps accepting fees until manually drained — the contract cannot be frozen.',
    status: 'Start with a small entryFee and a publicly announced pot cap; drain & redeploy a fixed version if anything looks off.',
  },
  {
    id: 'S-06',
    sev: 'info',
    area: 'NFT sybil resistance',
    what: 'One trophy per address — a determined player can farm trophies with many addresses.',
    status: 'Inherent to per-address rewards; cosmetic impact only (the trophy is a scoreboard badge, not a dividend).',
  },
  {
    id: 'S-07',
    sev: 'info',
    area: 'Numeric bounds',
    what: 'uint40 score overflow; uint64 board corruption; spawn on a full board.',
    status: 'Max reachable score ≪ 2^40 (sum of all tiles is bounded by the 2048+ ladder). _spawn no-ops on a full board. Bounds hold by construction.',
  },
  {
    id: 'S-08',
    sev: 'info',
    area: 'Deployment size (EIP-170)',
    what: 'The string-heavy metadata could push runtime bytecode past the 24,576-byte limit.',
    status: 'With optimizer (200 runs) the contract deploys at ~15 KB — verified by the test suite, which deploys it in every case.',
  },
  {
    id: 'S-09',
    sev: 'info',
    area: 'Basescan compiler-bug banner (0.8.29–0.8.35)',
    what: 'Basescan shows two medium advisories for the solc version used at compile time: UnsoundSpillInMutualRecursion (needs viaIR + mutually recursive functions) and InheritanceOrderReversalOnStorageEndWarning (needs a "layout at" storage-end warning + inheritance). This contract uses neither viaIR, nor mutual recursion, nor layout specifiers, nor inheritance — both triggers are provably absent.',
    status: 'False positive for this source. To clear the banner, recompile & redeploy with solc 0.8.36 (first release fixing both, SOL-2026-2 / SOL-2026-3); the ^0.8.24 pragma already allows it.',
  },
  {
    id: 'S-10',
    sev: 'info',
    area: 'No emergency exit — “stuck” ETH',
    what: 'If nobody ever tiles 2048, the pot sits in the contract with no withdrawal path. Tempting “fix”: an owner emergency-drain function. That is itself the vulnerability — a single call that lets the deployer walk off with every player’s entry fee is the textbook rug vector.',
    status: 'Kept as-is by design: the pot stays claimable by any future winner, which is strictly safer than an owner rescue. The owner can only touch the accrued 10% (sweepHouseCut). If a rescue is ever wanted, it must be time-locked (e.g. claimable only after N blocks of total inactivity) and announced before players deposit.',
  },
];

// ── checklist (persisted) ───────────────────────────────────────
const CHECKS = [
  'forge install foundry-rs/forge-std --no-commit && forge test -vv — all 18 tests green',
  'Deployed & verified on Base Sepolia; source readable on Basescan',
  'Played a full Sepolia run: start() → moves → win payout received → NFT visible with its SVG',
  'Independent review by someone who did not write this code',
  'Deployer / owner wallet is a hardware wallet or Safe multisig',
  'Chainlink VRF integrated — or the pot is consciously kept demo-sized',
  'entryFee stays tiny and a pot cap is announced publicly',
  'First ~100 runs monitored (events, balances, tokenURI rendering)',
];

const CHECK_KEY = 'base2048:securityChecks';

function Checklist() {
  const [done, setDone] = useState<boolean[]>(() => {
    try {
      const raw = localStorage.getItem(CHECK_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length === CHECKS.length) return arr;
      }
    } catch { /* fresh start */ }
    return CHECKS.map(() => false);
  });

  useEffect(() => {
    try { localStorage.setItem(CHECK_KEY, JSON.stringify(done)); } catch { /* private mode */ }
  }, [done]);

  const count = done.filter(Boolean).length;
  const pct = (count / CHECKS.length) * 100;

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="font-display text-lg text-white">Pre-mainnet checklist</h3>
          <span className={`font-mono text-xs ${count === CHECKS.length ? 'text-mint' : 'text-slate-400'}`}>
            {count}/{CHECKS.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-ink">
          <div
            className={`h-full rounded-full transition-all duration-500 ${count === CHECKS.length ? 'bg-mint' : 'bg-gradient-to-r from-base to-cyan-bright'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Progress is saved in your browser.</p>
      </div>
      <ul>
        {CHECKS.map((c, i) => (
          <li key={c}>
            <button
              onClick={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              className="group flex w-full items-start gap-3 border-b border-line/50 px-5 py-3.5 text-left transition-colors last:border-0 hover:bg-base/[0.04]"
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all ${
                  done[i] ? 'border-mint bg-mint text-[#04261b]' : 'border-line group-hover:border-base'
                }`}
              >
                {done[i] && (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={`text-[13px] leading-6 transition-colors ${done[i] ? 'text-slate-500 line-through decoration-mint/50' : 'text-slate-300'}`}>
                {c}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── VRF upgrade snippet ─────────────────────────────────────────
const VRF_SNIPPET = `// Swap _entropy() for Chainlink VRF v2.5 (docs.chain.link/vrf/v2-5)
import {VRFConsumerBaseV2Plus} from
    "@chainlink/contracts/src/v0.8/vrf/dev/VRFConsumerBaseV2Plus.sol";

contract Onchain2048VRF is Onchain2048, VRFConsumerBaseV2Plus {
    // from docs.chain.link/vrf/v2-5/supported-networks
    bytes32 constant KEY_HASH = <KEY_HASH_FOR_BASE>;
    uint64  constant SUB_ID   = <YOUR_SUBSCRIPTION_ID>;

    mapping(uint256 => address) private _pending;

    function move(uint8 dir) external override {
        uint256 req = s_vrfCoordinator.requestRandomWords(
            KEY_HASH, SUB_ID, 3, 2_000_000, 1);
        _pending[req] = msg.sender;
        // …execute the move when fulfillRandomWords lands
    }
}`;

const TEST_COMMANDS = `# one-time
forge install foundry-rs/forge-std --no-commit

# run everything (deploys the contract in every test)
forge test -vv

# gas report per function
forge test --gas-report

# size check before deploy
forge build --sizes`;

export function SecurityReview() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(TEST_COMMANDS);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* noop */ }
  };

  return (
    <section id="security" className="relative mx-auto max-w-6xl px-5 py-24">
      <SectionHeader
        index="05"
        kicker="Audit yourself"
        title="Security review — before you ship"
        lead="An honest, line-by-line look at what is safe, what is not, and exactly what to change. The full path set is pinned down by the Foundry suite in test/Onchain2048.t.sol."
      />

      {/* verdict */}
      <Reveal>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-mint/30 bg-mint/[0.05] p-6">
            <p className="mb-2 flex items-center gap-2 font-display text-lg text-mint">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" strokeLinejoin="round" />
                <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Wallet-interaction risk — low
            </p>
            <p className="text-[13px] leading-7 text-slate-300">
              No token approvals are ever requested, no delegatecall, no proxies, no upgradability, no way for the
              contract to reach into your wallet beyond the ETH <em>you</em> explicitly send with{' '}
              <span className="font-mono text-cyan-bright">start()</span>. Payouts follow
              checks-effects-interactions, so the win transfer can't be re-entered. Worst case for a player: losing
              the entry fee they chose to pay.
            </p>
          </div>
          <div className="rounded-2xl border border-rose/30 bg-rose/[0.05] p-6">
            <p className="mb-2 flex items-center gap-2 font-display text-lg text-rose">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M12 3 2.5 19.5h19L12 3Z" strokeLinejoin="round" />
                <path d="M12 10v4.5" strokeLinecap="round" />
                <circle cx="12" cy="17.2" r="1.1" fill="currentColor" />
              </svg>
              Real-stakes fairness risk — high, until VRF
            </p>
            <p className="text-[13px] leading-7 text-slate-300">
              <span className="font-mono text-rose">_entropy()</span> hashes{' '}
              <span className="font-mono">blockhash + timestamp</span> — validators can steer it, and a player contract
              can try/catch its own <span className="font-mono">move()</span>, keeping only spawns that complete a
              merge. That drains the pot and farms trophies. As a demo it's honest; with real money it's exploitable.
              The fix is Chainlink VRF (below).
            </p>
          </div>
        </div>
      </Reveal>

      {/* findings table */}
      <Reveal delay={100} className="mt-10">
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-4">
            <h3 className="font-display text-xl text-white">Findings</h3>
            <span className="font-mono text-[11px] text-slate-500">10 items · contract reread line-by-line</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-right">
              <thead>
                <tr className="bg-ink text-[11px] text-slate-500">
                  <th className="px-5 py-3 font-medium">ID</th>
                  <th className="px-5 py-3 font-medium">Severity</th>
                  <th className="px-5 py-3 font-medium">Area</th>
                  <th className="px-5 py-3 font-medium">Observation & status</th>
                </tr>
              </thead>
              <tbody>
                {FINDINGS.map((f) => (
                  <tr key={f.id} className="border-t border-line/60 align-top transition-colors hover:bg-base/[0.04]">
                    <td className="px-5 py-4 font-mono text-xs text-slate-400">{f.id}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md border px-2 py-1 font-mono text-[10px] ${SEV[f.sev].cls}`}>
                        {SEV[f.sev].label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[13px] font-medium text-slate-200">{f.area}</td>
                    <td className="px-5 py-4">
                      <p className="text-[13px] leading-6 text-slate-400">{f.what}</p>
                      <p className={`mt-2 text-[12px] leading-6 ${f.sev === 'safe' ? 'text-mint/90' : f.sev === 'critical' ? 'text-rose/90' : 'text-amber/90'}`}>
                        ↳ {f.status}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-8 lg:grid-cols-2 items-start">
        <div className="space-y-8">
          {/* test suite */}
          <Reveal>
            <div className="overflow-hidden rounded-2xl border border-line bg-[#050b1c]">
              <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3">
                <p className="font-mono text-xs text-slate-300">
                  <span className="text-mint">$</span> test/Onchain2048.t.sol — 18 tests
                </p>
                <button
                  onClick={copy}
                  className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-all active:scale-95 ${
                    copied ? 'border-mint/60 text-mint' : 'border-line text-slate-500 hover:border-base hover:text-white'
                  }`}
                >
                  {copied ? '✓ copied' : 'copy commands'}
                </button>
              </div>
              <pre className="overflow-x-auto code-scroll p-4 font-mono text-[12px] leading-[1.8] text-slate-300">
                {TEST_COMMANDS}
              </pre>
              <div className="border-t border-line/60 px-4 py-3">
                <p className="text-[12px] leading-6 text-slate-500">
                  The suite <b className="text-slate-300">deploys the contract in every test</b> and engineers exact
                  boards with <span className="font-mono text-cyan-bright">vm.store</span>: merge scoring, the 90/10
                  pot payout (wei-accurate), reentrancy after a win, mint-once-at-4096, ERC-721 transfers & approvals,
                  owner-only sweep, NoopMove gas protection and a fuzz check that every fresh board is playable.
                </p>
              </div>
            </div>
          </Reveal>

          {/* VRF */}
          <Reveal delay={80}>
            <div className="overflow-hidden rounded-2xl border border-line bg-[#050b1c]">
              <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3">
                <p className="font-display text-sm text-white">The one change real stakes need: VRF</p>
                <a
                  href="https://docs.chain.link/vrf/v2-5/supported-networks"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] text-cyan-bright hover:underline underline-offset-2"
                >
                  key hashes ↗
                </a>
              </div>
              <pre className="overflow-x-auto code-scroll p-4 font-mono text-[11.5px] leading-[1.7] text-slate-300">
                {VRF_SNIPPET}
              </pre>
            </div>
          </Reveal>
        </div>

        <Reveal delay={140} className="lg:sticky lg:top-24">
          <Checklist />
          <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
            This review is the author's own — it is not a professional audit. For a public pot, commission one.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
