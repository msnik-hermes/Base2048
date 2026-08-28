import { useEffect, useState } from 'react';
import { Reveal, SectionHeader } from './ui';

// ── findings (free-to-play edition: no entry fee, no pot, no owner) ──
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
    sev: 'safe',
    area: 'No value can enter or leave',
    what: 'Is there any way for the contract to take, hold or move ETH or tokens?',
    status:
      'No. start() and move() are non-payable and there is no payable function, no transfer of value and no withdrawal of any kind. The contract\u2019s ETH balance is always 0. It is structurally impossible to rug-pull or to lose funds beyond the gas you spend.',
  },
  {
    id: 'S-02',
    sev: 'safe',
    area: 'No owner, no admin keys',
    what: 'Who controls the contract after deployment?',
    status:
      'Nobody. There is no owner, no sweep function and no privileged role of any kind. Once deployed it is fully immutable and permissionless — the code is the only authority.',
  },
  {
    id: 'S-03',
    sev: 'safe',
    area: 'Reentrancy',
    what: 'Does the contract make any external value-carrying calls?',
    status:
      'No external calls that transfer value are made at all (the only external call is the ERC-721 receiver hook, which transfers nothing). With no ETH flow there is no reentrancy surface. State still updates before any external interaction.',
  },
  {
    id: 'S-04',
    sev: 'info',
    area: 'Entropy — _entropy()',
    what: 'blockhash + timestamp + player is predictable, so tile spawns can be influenced by a player contract.',
    status:
      'With no pot at stake this only affects which tiles spawn and when a trophy can be minted — i.e. scoreboard cosmetics. Acceptable for a free game. Only revisit (Chainlink VRF) if real value is ever added.',
  },
  {
    id: 'S-05',
    sev: 'info',
    area: 'NFT sybil resistance',
    what: 'One trophy per address — trophies can be farmed across many addresses.',
    status: 'Inherent to per-address rewards and purely cosmetic here; the trophy is a badge, not an asset with yield.',
  },
  {
    id: 'S-06',
    sev: 'info',
    area: 'Numeric bounds',
    what: 'uint40 score overflow; uint64 board corruption; spawn on a full board.',
    status:
      'Max reachable score ≪ 2^40. _spawn no-ops on a full board. All bounds hold by construction.',
  },
  {
    id: 'S-07',
    sev: 'info',
    area: 'Deployment size (EIP-170)',
    what: 'The string-heavy metadata could push runtime bytecode past the 24,576-byte limit.',
    status: 'With optimizer (200 runs) the contract deploys at ~15 KB — verified by the test suite, which deploys it in every case.',
  },
  {
    id: 'S-08',
    sev: 'info',
    area: 'Compiler version',
    what: 'solc 0.8.29–0.8.35 show Basescan\u2019s two medium advisories (SOL-2026-2 / SOL-2026-3).',
    status:
      'False positive — neither trigger (viaIR + mutual recursion, or layout-at + inheritance) exists in this source. Compiling with 0.8.36 clears the banner; the ^0.8.24 pragma already allows it.',
  },
];

// ── checklist (persisted) ───────────────────────────────────────
const CHECKS = [
  'forge install foundry-rs/forge-std --no-commit && forge test -vv — all tests green',
  'Deployed & verified on Base Sepolia; source readable on Basescan',
  'Played a full Sepolia run: start() → moves → win → NFT visible with its SVG',
  'Compiled with solc 0.8.36 (no compiler-bug banner on Basescan)',
  'Independent review by someone who did not write this code',
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

// ── entropy note snippet ────────────────────────────────────────
const ENTROPY_NOTE = `// _entropy() is fine for a free game: it only decides tile
// spawns / trophy timing, so a predictable value cannot steal
// anything. If you EVER add real value, swap it for Chainlink
// VRF v2.5 first (docs.chain.link/vrf/v2-5).`;

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
        title="Security review — free-to-play edition"
        lead="With the entry fee, pot, house cut and every withdrawal removed, the attack surface collapses. Here is the honest, line-by-line picture of what remains."
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
              Funds at risk — none
            </p>
            <p className="text-[13px] leading-7 text-slate-300">
              No value can ever enter or leave the contract. There is no payable function, no pot, no house cut and no
              withdrawal — the balance is always 0. There is no owner and no admin key. The only cost of playing is the
              Base gas you sign for yourself, and the worst case is losing that gas. Nothing can be rug-pulled.
            </p>
          </div>
          <div className="rounded-2xl border border-base/30 bg-base/[0.05] p-6">
            <p className="mb-2 flex items-center gap-2 font-display text-lg text-base-bright">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" strokeLinecap="round" />
                <circle cx="12" cy="16.2" r="1" fill="currentColor" />
              </svg>
              Remaining consideration — entropy
            </p>
            <p className="text-[13px] leading-7 text-slate-300">
              The only thing left to think about is <span className="font-mono text-base-bright">_entropy()</span>, which is
              predictable. Because nothing of value is at stake, that only affects which tiles spawn and when a trophy
              can be minted — scoreboard cosmetics. If real value were ever added, swap it for Chainlink VRF first.
            </p>
          </div>
        </div>
      </Reveal>

      {/* findings table */}
      <Reveal delay={100} className="mt-10">
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-4">
            <h3 className="font-display text-xl text-white">Findings</h3>
            <span className="font-mono text-[11px] text-slate-500">{FINDINGS.length} items · contract reread line-by-line</span>
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
                      <p className={`mt-2 text-[12px] leading-6 ${f.sev === 'safe' ? 'text-mint/90' : f.sev === 'critical' ? 'text-rose/90' : 'text-slate-500'}`}>
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
                  <span className="text-mint">$</span> test/Onchain2048.t.sol — free-to-play suite
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
                  boards with <span className="font-mono text-cyan-bright">vm.store</span>: start-spawns-two-tiles,
                  merge scoring, win at 2048, NoopMove gas protection, mint-once-at-4096, and ERC-721 transfer /
                  approval / auth paths.
                </p>
              </div>
            </div>
          </Reveal>

          {/* entropy note */}
          <Reveal delay={80}>
            <div className="overflow-hidden rounded-2xl border border-line bg-[#050b1c]">
              <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-3">
                <p className="font-display text-sm text-white">Why predictable entropy is acceptable here</p>
                <a
                  href="https://docs.chain.link/vrf/v2-5"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] text-cyan-bright hover:underline underline-offset-2"
                >
                  VRF docs ↗
                </a>
              </div>
              <pre className="overflow-x-auto code-scroll p-4 font-mono text-[11.5px] leading-[1.7] text-slate-400">
                {ENTROPY_NOTE}
              </pre>
            </div>
          </Reveal>
        </div>

        <Reveal delay={140} className="lg:sticky lg:top-24">
          <Checklist />
          <p className="mt-4 text-center text-[11px] leading-5 text-slate-600">
            This review is the author's own — it is not a professional audit. With no value at stake the stakes are
            low, but an independent read is still cheap insurance.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
