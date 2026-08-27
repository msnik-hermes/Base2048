import { useState } from 'react';
import { nibbleGrid, type Tile } from '../game/logic';
import { Reveal, SectionHeader } from './ui';

// ── Base Sepolia network details ────────────────────────────────
const NETWORK = [
  { label: 'Network name', value: 'Base Sepolia' },
  { label: 'RPC URL', value: 'https://sepolia.base.org' },
  { label: 'Chain ID', value: '84532' },
  { label: 'Currency symbol', value: 'ETH' },
  { label: 'Block explorer', value: 'https://sepolia.basescan.org' },
];

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* noop */
    }
  };
  return (
    <div className="group flex items-center justify-between gap-3 border-b border-line/50 px-4 py-2.5 last:border-0">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p>
        <p className="truncate font-mono text-[12px] text-slate-200">{value}</p>
      </div>
      <button
        onClick={copy}
        className={`shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] transition-all active:scale-95 ${
          copied ? 'border-mint/60 text-mint' : 'border-line text-slate-500 hover:border-base hover:text-white'
        }`}
      >
        {copied ? '✓' : 'copy'}
      </button>
    </div>
  );
}

const STEPS = [
  {
    title: 'Fund a wallet (or skip it)',
    body: 'For a real Base Sepolia test grab ~0.001 ETH from the faucet — enough to deploy and play dozens of moves. Want zero cost? Use the built-in Remix VM instead and skip this step entirely.',
    chips: ['faucet.base.org', '≈ 0.001 ETH'],
  },
  {
    title: 'Load the contract into Remix',
    body: 'Open remix.ethereum.org → File Explorer → new file Onchain2048.sol → paste the source (or drop in the file you downloaded from this page). Compile with the Solidity compiler — 0.8.24 or newer; Remix\u2019s current default works as-is.',
    chips: ['solc ≥ 0.8.24', 'single file, no imports'],
  },
  {
    title: 'Deploy',
    body: 'Deploy & Run → Environment: "Injected Provider – MetaMask" (wallet on Base Sepolia), or "Remix VM (Cancun)" for local testing. Select Onchain2048, set the constructor arg to 42000000000000 (the 0.000042 ETH entry fee, in wei) and hit Deploy. Important: leave the Value field at 0 — the constructor isn\u2019t payable; the fee is paid later by start().',
    chips: ['ctor arg: 42000000000000', 'Value = 0', 'chainId 84532'],
  },
  {
    title: 'Play & mint',
    body: 'Remix\u2019s Value field only accepts whole numbers — so switch the unit dropdown from Ether to Wei and type 42000000000000 (= 0.000042 ETH), then call start(). After that, call move(dir) — 0 left, 1 right, 2 up, 3 down — and watch Moved events in the console. Read gridOf / scoreOf to follow your run. Push the score past 4096: nftOf(address) returns your trophy id, and tokenURI(id) returns the on-chain metadata — paste it into the decoder on the right.',
    chips: ['Value unit → Wei', '42000000000000', 'start() → move(dir)', '4096 → RewardMinted'],
  },
];

// ── local replica of the contract's _svg / _palette / tokenURI ──
const PALETTE: [string, string][] = [
  ['#101d3d', '#101d3d'],
  ['#182a52', '#9fb4e0'],
  ['#203a6e', '#c2d1f3'],
  ['#1447b8', '#dce8ff'],
  ['#0052ff', '#ffffff'],
  ['#2f7dff', '#ffffff'],
  ['#00b3e6', '#042633'],
  ['#00c2b0', '#04302b'],
  ['#ffb03a', '#3a2400'],
  ['#ff8f2e', '#401f00'],
  ['#ff6a2e', '#ffffff'],
  ['#ffd76a', '#3d2a00'],
  ['#ff4d6d', '#ffffff'],
];

function svgForBoard(nibbles: number[], score: number, moves: number, id: number): string {
  let svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 388">' +
    '<rect width="320" height="388" rx="18" fill="#071026"/>' +
    '<rect x="1" y="1" width="318" height="386" rx="17" fill="none" stroke="#1d3468"/>' +
    '<text x="160" y="34" font-family="monospace" font-size="13" font-weight="bold"' +
    ' fill="#5b8cff" text-anchor="middle">ONCHAIN 2048 &#183; BASE</text>';
  for (let i = 0; i < 16; i++) {
    const e = nibbles[i];
    const [bg, fg] = PALETTE[Math.min(e, 12)];
    svg += `<rect x="${14 + (i % 4) * 76}" y="${56 + Math.floor(i / 4) * 76}" width="64" height="64" rx="10" fill="${bg}"/>`;
    if (e > 0) {
      svg += `<text x="${46 + (i % 4) * 76}" y="${94 + Math.floor(i / 4) * 76}" font-family="monospace" font-size="${e > 3 ? 14 : 17}" font-weight="bold" fill="${fg}" text-anchor="middle">${2 ** e}</text>`;
    }
  }
  svg += `<text x="160" y="368" font-family="monospace" font-size="12" fill="#9fb4e0" text-anchor="middle">SCORE ${score} &#183; MOVES ${moves} &#183; TOKEN #${id}</text></svg>`;
  return svg;
}

function sampleTokenUri(nibbles: number[], score: number, moves: number): string {
  const id = 1;
  const svg = svgForBoard(nibbles, score, moves, id);
  const json = JSON.stringify({
    name: `Onchain 2048 #${id}`,
    description:
      'Trophy for scoring 4096+ in Onchain2048 on Base. The winning board is frozen on-chain as SVG.',
    attributes: [
      { trait_type: 'Score', value: score },
      { trait_type: 'Moves', value: moves },
      { trait_type: 'Network', value: 'Base' },
    ],
    image: 'data:image/svg+xml;base64,' + btoa(svg),
  });
  return 'data:application/json;base64,' + btoa(json);
}

interface Decoded {
  name?: string;
  description?: string;
  attributes?: { trait_type: string; value: string | number }[];
  image?: string;
}

function decodeTokenUri(raw: string): Decoded {
  const trimmed = raw.trim().replace(/^data:/, '');
  const comma = trimmed.indexOf(',');
  if (comma < 0) throw new Error('No base64 payload found — paste the full tokenURI output.');
  const head = trimmed.slice(0, comma);
  if (!/base64/i.test(head)) throw new Error('Expected a base64 data URI (application/json;base64,…).');
  const json = JSON.parse(atob(trimmed.slice(comma + 1).replace(/\s/g, '')));
  if (typeof json !== 'object' || json === null) throw new Error('Decoded payload is not JSON metadata.');
  return json as Decoded;
}

function TrophyDecoder({ tiles, score, moves }: { tiles: Tile[]; score: number; moves: number }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Decoded | null>(null);
  const [error, setError] = useState('');

  const decode = (raw?: string) => {
    const src = raw ?? input;
    try {
      const json = decodeTokenUri(src);
      setResult(json);
      setError('');
      if (raw !== undefined) setInput(raw);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error && err.message.includes('JSON') ? err.message : 'Could not decode — check the string starts with data:application/json;base64,');
    }
  };

  const useMyBoard = () => {
    const nibbles = nibbleGrid(tiles);
    const trophyScore = Math.max(score, 4096);
    const uri = sampleTokenUri(nibbles, trophyScore, moves > 0 ? moves : 87);
    decode(uri);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gold/25 bg-panel shadow-[0_0_50px_rgba(255,190,70,0.07)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h3 className="font-display text-xl text-white">tokenURI decoder</h3>
        <span className="rounded-md bg-gold/15 px-2 py-1 font-mono text-[10px] text-gold">
          base64 → metadata → SVG
        </span>
      </div>

      <div className="flex-1 p-5">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste the output of tokenURI(id) from Remix here…"
          className="h-24 w-full resize-none rounded-lg border border-line bg-ink p-3 font-mono text-[11px] leading-5 text-slate-300 placeholder:text-slate-600 focus:border-base focus:outline-none"
        />
        <div className="mt-3 flex gap-2.5">
          <button
            onClick={() => decode()}
            disabled={!input.trim()}
            className="flex-1 rounded-lg bg-gold py-2.5 font-display text-sm text-[#3a2400] transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
          >
            Decode
          </button>
          <button
            onClick={useMyBoard}
            className="rounded-lg border border-line px-4 py-2.5 font-mono text-[11px] text-slate-300 transition-all hover:border-gold hover:text-gold active:scale-[0.97]"
          >
            Try my board
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-600">
          "Try my board" builds the exact tokenURI the contract would return for your current board — same SVG, same palette, generated on-chain in Solidity.
        </p>

        {error && (
          <p className="tx-row mt-4 rounded-lg border border-rose/30 bg-rose/10 px-3.5 py-2.5 font-mono text-[11px] leading-5 text-rose">
            {error}
          </p>
        )}

        {result && (
          <div className="tx-row mt-4 space-y-4">
            <div className="overflow-hidden rounded-xl border border-line bg-ink">
              {result.image ? (
                <img src={result.image} alt={result.name ?? 'NFT preview'} className="block w-full" />
              ) : (
                <p className="p-4 font-mono text-[11px] text-slate-500">No image field in this metadata.</p>
              )}
            </div>
            <div>
              <p className="font-display text-lg text-white">{result.name}</p>
              <p className="mt-1 text-[12px] leading-6 text-slate-400">{result.description}</p>
              {result.attributes && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.attributes.map((a) => (
                    <span key={a.trait_type} className="rounded-md border border-line bg-ink px-2.5 py-1.5 font-mono text-[10px] text-slate-300">
                      <span className="text-slate-500">{a.trait_type}:</span> {String(a.value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {!result && !error && (
          <p className="mt-4 text-center text-[12px] text-slate-600">
            Nothing decoded yet — paste a tokenURI or try your live board.
          </p>
        )}
      </div>
    </div>
  );
}

export function RemixSection({ tiles, score, moves }: { tiles: Tile[]; score: number; moves: number }) {
  return (
    <section id="remix" className="relative mx-auto max-w-6xl px-5 py-24">
      <SectionHeader
        index="03"
        kicker="No-install testing"
        title="Test it on Remix in minutes"
        lead="No Foundry, no terminal — remix.ethereum.org compiles and deploys the single-file contract straight from your browser. Start on the built-in Remix VM for a free dry run, then point MetaMask at Base Sepolia for the real thing."
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_400px] items-start">
        <div className="space-y-4">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} delay={i * 80}>
              <div className="group relative rounded-2xl border border-line bg-panel p-6 transition-all duration-300 hover:border-base/50 hover:bg-panel/80">
                <span className="absolute -top-3 start-6 rounded-md bg-base px-2.5 py-1 font-display text-xs text-white shadow-[0_4px_16px_rgba(0,82,255,0.45)]">
                  STEP {i + 1}
                </span>
                <h3 className="mt-2 font-display text-xl text-white transition-transform group-hover:-translate-y-0.5">
                  {s.title}
                </h3>
                <p className="mt-2.5 text-sm leading-7 text-slate-400">{s.body}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.chips.map((c) => (
                    <span key={c} className="rounded-md border border-line/70 bg-ink px-2.5 py-1 font-mono text-[10px] text-cyan-bright">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}

          <Reveal delay={300}>
            <div className="rounded-2xl border border-amber/30 bg-amber/[0.06] p-5">
              <div className="flex items-center gap-2.5">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="shrink-0 text-amber">
                  <path d="M12 3 2.5 19.5h19L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                  <path d="M12 10v4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="12" cy="17.2" r="1.1" fill="currentColor" />
                </svg>
                <p className="font-display text-base text-amber">Two Remix gotchas that make transactions “revert”</p>
              </div>
              <div className="mt-4 space-y-4">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber/20 font-mono text-[11px] font-bold text-amber">1</span>
                  <div>
                    <p className="text-sm font-semibold text-white">Value must be 0 when you Deploy</p>
                    <p className="mt-1 text-[13px] leading-6 text-slate-300">
                      The constructor isn't payable — it only stores the fee. If the Value field still holds wei
                      when you hit Deploy, Remix sends it with the creation transaction and the whole deploy
                      reverts (“mined but execution failed”). Clear Value to <span className="font-mono text-[12px] text-white">0</span>, Deploy,
                      and pay the fee later through <span className="font-mono text-[12px] text-cyan-bright">start()</span>.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber/20 font-mono text-[11px] font-bold text-amber">2</span>
                  <div>
                    <p className="text-sm font-semibold text-white">“I can't type a decimal in the Value field”</p>
                    <p className="mt-1 text-[13px] leading-6 text-slate-300">
                      The field only takes whole numbers in the selected unit. Switch the unit dropdown next to
                      Value from <span className="font-mono text-[12px] text-slate-400">Ether</span> to <span className="font-mono text-[12px] text-mint">Wei</span> and
                      enter <span className="font-mono text-[12px] text-white">42000000000000</span> — the exact wei value of 0.000042 ETH —
                      then call <span className="font-mono text-[12px] text-cyan-bright">start()</span>.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber/20 font-mono text-[11px] font-bold text-amber">3</span>
                  <div>
                    <p className="text-sm font-semibold text-white">“Deploy fails: out of gas”</p>
                    <p className="mt-1 text-[13px] leading-6 text-slate-300">
                      The string-heavy <span className="font-mono text-[12px] text-slate-400">tokenURI()</span> bloats
                      unoptimized bytecode past Remix's 3M default limit. In the{' '}
                      <span className="font-mono text-[12px] text-mint">Solidity Compiler</span> tab tick{' '}
                      <span className="font-mono text-[12px] text-white">Optimization (200)</span>, recompile, and as a
                      safety net raise the <span className="font-mono text-[12px] text-slate-400">Gas limit</span> under
                      Deploy's advanced settings to <span className="font-mono text-[12px] text-white">8000000</span>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={340}>
            <div className="overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="font-display text-base text-white">Add Base Sepolia to your wallet</p>
                <a
                  href="https://faucet.base.org"
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-mint transition-colors hover:text-white"
                >
                  faucet.base.org ↗
                </a>
              </div>
              {NETWORK.map((row) => (
                <CopyRow key={row.label} label={row.label} value={row.value} />
              ))}
            </div>
          </Reveal>
        </div>

        <Reveal delay={150} className="lg:sticky lg:top-24">
          <TrophyDecoder tiles={tiles} score={score} moves={moves} />
        </Reveal>
      </div>
    </section>
  );
}
