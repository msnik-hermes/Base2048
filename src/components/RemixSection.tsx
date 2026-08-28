import { useMemo, useState } from 'react';
import type { Tile } from '../game/logic';
import { nibbleGrid } from '../game/logic';
import { Reveal, SectionHeader } from './ui';

const STEPS = [
  {
    title: 'Fund a wallet + test LINK',
    body: 'For a real Base Sepolia test grab ~0.001 ETH from faucet.base.org (deploy + dozens of moves) and some test LINK from faucets.chain.link — LINK pays the VRF requests, ETH only pays gas.',
    chips: ['faucet.base.org', 'faucets.chain.link', '≈ 0.001 ETH + 1 LINK'],
  },
  {
    title: 'Load the contract into Remix',
    body: 'Open remix.ethereum.org → File Explorer → new file Onchain2048.sol → paste the source (or drop in the file you downloaded from this page). Pick solc 0.8.36+, tick Optimization (200), keep viaIR off, then Compile.',
    chips: ['solc 0.8.36 recommended', 'optimization 200', 'viaIR off'],
  },
  {
    title: 'Create a VRF v2.5 subscription',
    body: 'On vrf.chain.link switch to the Base Sepolia testnet, create a subscription and fund it with test LINK. The subscription id is one of the three constructor arguments.',
    chips: ['vrf.chain.link', 'subscription id = subId'],
  },
  {
    title: 'Deploy with the three VRF values',
    body: 'Deploy & Run → Environment: "Injected Provider – MetaMask" (wallet on Base Sepolia). Constructor args: the Base Sepolia coordinator 0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE, your subscription id, and the key hash 0x…06fc23ac00 (30 gwei). Leave the Value field at 0 — nothing is payable.',
    chips: ['coordinator', 'subId', 'keyHash', 'Value = 0'],
  },
  {
    title: 'Add the deployed contract as a consumer',
    body: 'The step everyone misses. Back on vrf.chain.link, open your subscription details and click “Add consumer”, then paste the freshly deployed game address and confirm. Until the game is a registered consumer, every start()/move() reverts with InvalidConsumer — even with a funded subscription.',
    chips: ['Add consumer → game address', 'required before start()'],
  },
  {
    title: 'Play & mint',
    body: 'Call start() — free, gas only. stateOf shows 4 (pending) until Chainlink fulfils; the two tiles appear a few seconds later. Then move(dir) — 0 left, 1 right, 2 up, 3 down; each move merges instantly and spawns once fulfilled. Past score 4096, nftOf(address) returns your trophy id and tokenURI(id) the on-chain metadata — paste it into the decoder on the right.',
    chips: ['two-phase moves', 'state 4 = awaiting VRF', '4096 → RewardMinted'],
  },
];

const GOTCHAS = [
  {
    title: 'Keep the Value field at 0 — always',
    body: 'The game is free-to-play: no function is payable, so there is never a reason to put wei in the Value field. If it holds a value when you Deploy or call a function, Remix sends it along and the transaction reverts. Clear it to 0 and you\u2019re set — the only cost is gas.',
  },
  {
    title: 'No imports at all — fully self-contained',
    body: 'The downloadable contract has ZERO import statements. The Chainlink VRF request struct, the coordinator interface and the fulfilment guard are inlined with an ABI byte-identical to @chainlink/contracts, so Remix has nothing to fetch and can never 404. Paste the single file and compile — that is the whole dependency story.',
    code: '// Onchain2048.sol — first lines\n// SPDX-License-Identifier: MIT\npragma solidity ^0.8.24;\n\n// No external imports — fully self-contained.\nlibrary VRFV2PlusClient { /* … */ }\ninterface IVRFCoordinatorV2Plus { /* … */ }',
  },
  {
    title: '\u201CFile import callback not supported\u201D',
    body: 'Your file must be named with a .sol extension (e.g. Onchain2048.sol). Remix only resolves GitHub/npm imports for Solidity files — a file called \u201Cmyc\u201D with no extension disables the import callback entirely. Rename it and recompile.',
  },
  {
    title: '\u201CDeploy fails: out of gas\u201D',
    body: 'The string-heavy tokenURI() bloats unoptimized bytecode past Remix\u2019s 3M default limit. In the Solidity Compiler tab tick Optimization (200), recompile, and as a safety net raise the Gas limit under Deploy\u2019s advanced settings to 8000000.',
  },
  {
    title: '\u201CThe new tile appears a few seconds late\u201D',
    body: 'That is the Chainlink VRF commit\u2013reveal flow working as designed: your move() lands the merge instantly, then the coordinator fulfils the randomness request a couple of blocks later and fulfillRandomWords() spawns the tile. On Base that is typically 2\u20135 seconds. If nothing ever spawns, check the subscription has LINK.',
  },
];

// ── local replica of the contract's _svg / _palette / tokenURI ──
const PALETTE: [string, string][] = [
  ['#101d3d', '#101d3d'], ['#182a52', '#9fb4e0'], ['#203a6e', '#c2d1f3'], ['#1447b8', '#dce8ff'],
  ['#0052ff', '#ffffff'], ['#2f7dff', '#ffffff'], ['#00b3e6', '#042633'], ['#00c2b0', '#04302b'],
  ['#ffb03a', '#3a2400'], ['#ff8f2e', '#401f00'], ['#ff6a2e', '#ffffff'], ['#ffd76a', '#3d2a00'],
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

function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

function sampleTokenUri(nibbles: number[], score: number, moves: number): string {
  const id = 1;
  const svg = svgForBoard(nibbles, score, moves, id);
  const json = JSON.stringify({
    name: `Onchain 2048 #${id}`,
    description: 'Trophy for scoring 4096+ in Onchain2048 on Base. The winning board is frozen on-chain as SVG.',
    attributes: [
      { trait_type: 'Score', value: score },
      { trait_type: 'Moves', value: moves },
      { trait_type: 'Network', value: 'Base' },
    ],
    image: 'data:image/svg+xml;base64,' + b64(svg),
  });
  return 'data:application/json;base64,' + b64(json);
}

interface Decoded {
  name?: string;
  description?: string;
  image?: string;
  attributes?: { trait_type: string; value: string | number }[];
}

function TokenDecoder({ tiles, score, moves }: { tiles: Tile[]; score: number; moves: number }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<Decoded | null>(null);
  const [error, setError] = useState('');
  const nibbles = useMemo(() => nibbleGrid(tiles), [tiles]);

  const decode = () => {
    setError('');
    setResult(null);
    try {
      const raw = input.trim();
      const b64part = raw.includes(',') ? raw.split(',')[1] : raw;
      const json = JSON.parse(atob(b64part));
      setResult(json);
    } catch {
      setError('Could not decode — paste the exact output of tokenURI(id) (a base64 data URI).');
    }
  };

  const tryMine = () => {
    setInput(sampleTokenUri(nibbles, score, moves));
    setError('');
    try {
      setResult(JSON.parse(atob(sampleTokenUri(nibbles, score, moves).split(',')[1])));
    } catch { /* noop */ }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-gold/25 bg-panel shadow-[0_0_50px_rgba(255,190,70,0.07)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h3 className="font-display text-xl text-white">tokenURI decoder</h3>
        <span className="rounded-md bg-gold/15 px-2 py-1 font-mono text-[10px] text-gold">base64 → metadata → SVG</span>
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
            onClick={decode}
            disabled={!input.trim()}
            className="flex-1 rounded-lg bg-gold py-2.5 font-display text-sm text-[#3d2a00] transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-40"
          >
            Decode
          </button>
          <button
            onClick={tryMine}
            className="rounded-lg border border-line px-4 py-2.5 font-mono text-[11px] text-slate-300 transition-all hover:border-gold hover:text-gold active:scale-[0.97]"
          >
            Try my board
          </button>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-slate-600">
          {'\u201C'}Try my board{'\u201D'} builds the exact tokenURI the contract would return for your current board — same SVG, same palette, generated on-chain in Solidity.
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

const NETWORK_CARD = [
  { label: 'Network', value: 'Base Sepolia' },
  { label: 'Chain ID', value: '84532' },
  { label: 'RPC', value: 'https://sepolia.base.org' },
  { label: 'Currency', value: 'ETH' },
  { label: 'Explorer', value: 'https://sepolia.basescan.org' },
];

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
                <span className="absolute -top-3 left-6 rounded-md bg-base px-2.5 py-1 font-display text-xs text-white shadow-[0_4px_16px_rgba(0,82,255,0.45)]">
                  STEP {i + 1}
                </span>
                <h3 className="mt-2 font-display text-xl text-white transition-transform group-hover:-translate-y-0.5">{s.title}</h3>
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
                <p className="font-display text-base text-amber">Five Remix gotchas worth knowing</p>
              </div>
              <div className="mt-4 space-y-4">
                {GOTCHAS.map((g, i) => (
                  <div key={g.title} className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber/20 font-mono text-[11px] font-bold text-amber">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-white">{g.title}</p>
                      <p className="mt-1 text-[13px] leading-6 text-slate-300">{g.body}</p>
                      {'code' in g && g.code && (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-ink border border-line/60 p-3 font-mono text-[11px] leading-5 text-mint">
                          {g.code}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          <Reveal delay={340}>
            <div className="overflow-hidden rounded-2xl border border-line bg-panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="font-display text-base text-white">Add Base Sepolia to your wallet</p>
                <a href="https://faucet.base.org" target="_blank" rel="noreferrer" className="font-mono text-[11px] text-mint transition-colors hover:text-white">
                  faucet.base.org ↗
                </a>
              </div>
              <div className="p-4">
                {NETWORK_CARD.map((r) => (
                  <div key={r.label} className="flex items-center justify-between border-b border-line/50 py-2 last:border-0">
                    <span className="text-[12px] text-slate-500">{r.label}</span>
                    <span className="font-mono text-[11px] text-slate-300">{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delay={150} className="lg:sticky lg:top-24">
          <TokenDecoder tiles={tiles} score={score} moves={moves} />
        </Reveal>
      </div>
    </section>
  );
}
