import { useEffect, useRef, useState } from 'react';
import { DEPLOY_MAINNET, DEPLOY_TESTNET, INTERACT_COMMANDS } from '../data/contract';
import { randomHash } from '../game/logic';
import { fmtInt } from '../hooks/useBaseChain';
import { Reveal, SectionHeader } from './ui';

function CodeBlock({ title, code, note }: { title: string; code: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };
  return (
    <Reveal className="group/cb">
      <div className="overflow-hidden rounded-xl border border-line bg-[#050b1c] transition-colors hover:border-base/40">
        <div className="flex items-center justify-between border-b border-line/70 bg-panel px-4 py-2.5">
          <span className="font-mono text-[11px] text-slate-400">
            <span className="text-mint">$</span> {title}
          </span>
          <button
            onClick={copy}
            className={`rounded-md border px-2 py-1 font-mono text-[10px] transition-all active:scale-95 ${
              copied ? 'border-mint/60 text-mint' : 'border-line text-slate-500 hover:text-white hover:border-base'
            }`}
          >
            {copied ? '✓ copied' : 'copy'}
          </button>
        </div>
        <pre className="overflow-x-auto code-scroll p-4 font-mono text-[12px] leading-[1.8] text-slate-300">
          {code}
        </pre>
        {note && <p className="border-t border-line/60 px-4 py-2.5 text-[12px] leading-6 text-slate-500">{note}</p>}
      </div>
    </Reveal>
  );
}

type Phase = 'idle' | 'compile' | 'broadcast' | 'mined' | 'done';

interface SimResult {
  address: string;
  tx: string;
  block: number;
  network: string;
}

const PHASE_LINES: Record<Exclude<Phase, 'idle'>, string> = {
  compile: 'forge build — compiling Onchain2048.sol …',
  broadcast: 'forge create — broadcasting deployment to Base …',
  mined: 'Waiting for inclusion in the next block …',
  done: '✓ Contract mined & verified on Basescan',
};

function DeploySimulator({ liveBlock }: { liveBlock: number }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [results, setResults] = useState<SimResult[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const run = () => {
    if (phase !== 'idle' && phase !== 'done') return;
    setPhase('compile');
    timers.current.push(window.setTimeout(() => setPhase('broadcast'), 1000));
    timers.current.push(window.setTimeout(() => setPhase('mined'), 2300));
    timers.current.push(
      window.setTimeout(() => {
        const address = randomHash(20);
        const network = liveBlock > 0 ? 'Base Mainnet' : 'Base (offline simulation)';
        setResults((r) =>
          [
            {
              address,
              tx: randomHash(32),
              block: liveBlock > 0 ? liveBlock + 1 : 24_610_000 + r.length + 1,
              network,
            },
            ...r,
          ].slice(0, 3),
        );
        setPhase('done');
      }, 3700),
    );
  };

  const active = phase !== 'idle' && phase !== 'done';

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-base/30 bg-panel shadow-[0_0_50px_rgba(0,82,255,0.12)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h3 className="font-display text-xl text-white">Deploy simulator</h3>
        <span className="rounded-md bg-base/15 px-2 py-1 font-mono text-[10px] text-base-bright">
          forge create --simulate
        </span>
      </div>

      <div className="flex-1 p-5">
        <div className="space-y-2 font-mono text-[12px] leading-6">
          {(['compile', 'broadcast', 'mined', 'done'] as const).map((p) => {
            const order = ['compile', 'broadcast', 'mined', 'done'];
            const state =
              order.indexOf(p) < order.indexOf(phase === 'idle' ? 'x' : phase) || phase === 'done'
                ? 'past'
                : phase === p
                  ? 'now'
                  : 'next';
            return (
              <div
                key={p}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all duration-300 ${
                  state === 'now' ? 'bg-base/15 text-white' : state === 'past' ? 'text-mint' : 'text-slate-600'
                }`}
              >
                {state === 'now' ? (
                  <span className="spinner h-3 w-3 shrink-0 rounded-full border-2 border-base-bright border-t-transparent" />
                ) : state === 'past' ? (
                  <span className="text-mint">✓</span>
                ) : (
                  <span className="inline-block h-1.5 w-1.5 shrink-0 translate-x-[3px] rounded-full bg-slate-700" />
                )}
                {PHASE_LINES[p]}
              </div>
            );
          })}
        </div>

        {results.length > 0 && (
          <div className="mt-5 space-y-2.5">
            {results.map((r) => (
              <div key={r.tx} className="tx-row rounded-xl border border-mint/25 bg-mint/[0.05] p-3.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-mint">{r.network}</span>
                  <span className="font-mono text-[10px] text-slate-500">block {fmtInt(r.block)}</span>
                </div>
                <p className="font-mono text-[11px] text-slate-300 break-all">
                  {r.address.slice(0, 24)}…{r.address.slice(-8)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line p-5">
        <button
          onClick={run}
          disabled={active}
          className="w-full rounded-xl bg-base py-3.5 font-display text-lg text-white shadow-[0_6px_30px_rgba(0,82,255,0.45)] transition-all hover:bg-base-hi hover:shadow-[0_8px_40px_rgba(0,82,255,0.6)] active:scale-[0.98] disabled:opacity-60"
        >
          {active ? 'Deploying…' : phase === 'done' ? 'Deploy again (simulated)' : 'Run simulated deploy'}
        </button>
        <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
          Educational simulation — use the Foundry commands on the left for a real deployment.
        </p>
      </div>
    </div>
  );
}

export function DeploySection({ liveBlock }: { liveBlock: number }) {
  return (
    <section id="deploy" className="relative mx-auto max-w-6xl px-5 py-24">
      <SectionHeader
        index="04"
        kicker="Ship to Base"
        title="Deploy to Base in three commands"
        lead="The contract is a single file and only needs Foundry. Test it on Base Sepolia first, then ship to mainnet with verification on Basescan — Base's 2-second blocks mean every game move lands almost instantly."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_380px] items-start">
        <div className="space-y-6">
          <CodeBlock
            title="1 · deploy → Base Sepolia"
            code={DEPLOY_TESTNET}
            note="Grab test ETH from faucet.base.org. WALLET_ALIAS is the output of cast wallet import."
          />
          <CodeBlock
            title="2 · deploy → Base Mainnet"
            code={DEPLOY_MAINNET}
            note="No constructor arguments — the contract is free-to-play by design. At current Base gas prices the whole deployment costs pennies."
          />
          <CodeBlock
            title="3 · verify the source on Basescan"
            code={`# Basescan → your contract → "Verify and Publish"
#   Method:  Solidity (Single file)
#   Compiler: v0.8.36  ·  Optimization: Yes (200)  ·  viaIR: No
#   Constructor args: none`}
            note="Deployed with Remix? The same fields work in the Basescan web form — paste the exact source from this page. Verified contracts show readable code and a Read/Write console on Basescan."
          />
          <CodeBlock title="4 · play from the command line" code={INTERACT_COMMANDS} />
        </div>

        <Reveal delay={150} className="lg:sticky lg:top-24">
          <DeploySimulator liveBlock={liveBlock} />
        </Reveal>
      </div>
    </section>
  );
}
