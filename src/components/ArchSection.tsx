import { useState } from 'react';
import type { Tile } from '../game/logic';
import { nibbleGrid, packBoard } from '../game/logic';
import { FUNCTIONS } from '../data/contract';
import { Reveal, SectionHeader } from './ui';

const KIND_STYLE: Record<string, string> = {
  payable: 'bg-amber/15 text-amber',
  write: 'bg-base/15 text-base-bright',
  view: 'bg-mint/15 text-mint',
  owner: 'bg-rose/15 text-rose',
};
const KIND_LABEL: Record<string, string> = {
  payable: 'payable',
  write: 'write',
  view: 'view',
  owner: 'onlyOwner',
};

function PackingViz({ tiles }: { tiles: Tile[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const nibbles = nibbleGrid(tiles);
  const packed = packBoard(tiles);
  const hexChars = packed.toString(16).padStart(16, '0').toUpperCase();
  // hex char for nibble i — read from the right (LSB)
  const hexByNibble = [...hexChars].reverse();

  return (
    <Reveal>
      <div className="rounded-2xl border border-line bg-panel p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[auto_1fr] items-start">
          {/* nibble grid */}
          <div>
            <p className="mb-3 font-mono text-[11px] text-slate-500">
              Hover a cell — its nibble lights up inside the uint64
            </p>
            <div className="grid grid-cols-4 gap-2 w-fit">
              {nibbles.map((n, i) => {
                const active = hover === i;
                return (
                  <button
                    key={i}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    className={`relative flex h-16 w-16 md:h-20 md:w-20 flex-col items-center justify-center rounded-lg border transition-all duration-150 ${
                      active
                        ? 'border-base bg-base/20 scale-105 shadow-[0_0_24px_rgba(0,82,255,0.4)]'
                        : n > 0
                          ? 'border-line bg-ink hover:border-base/60'
                          : 'border-line/50 bg-ink/40 hover:border-base/40'
                    }`}
                  >
                    <span className={`font-display text-lg md:text-xl ${n > 0 ? 'text-white' : 'text-slate-700'}`}>
                      {n > 0 ? 2 ** n : '·'}
                    </span>
                    <span className={`font-mono text-[10px] ${active ? 'text-base-bright' : 'text-slate-600'}`}>
                      n{i.toString(16)} = {n}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* packing layout */}
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500 mb-2">One storage slot — 64 bits, 16 nibbles:</p>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {nibbles.map((n, i) => {
                const active = hover === i;
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    className={`flex h-10 w-9 items-center justify-center rounded-md border font-mono text-sm transition-all ${
                      active
                        ? 'border-base bg-base text-white scale-110'
                        : n > 0
                          ? 'border-line bg-base/10 text-base-bright'
                          : 'border-line/50 bg-ink text-slate-700'
                    }`}
                  >
                    {hexByNibble[i]}
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl bg-ink border border-line/60 p-4 mb-4 overflow-x-auto">
              <p className="font-mono text-[11px] text-slate-500 mb-1">
                cell (r,c) → bits <span className="text-cyan-bright">{hover !== null ? `${hover * 4}..${hover * 4 + 3}` : 'r·16 + c·4'}</span>
              </p>
              <p className="font-mono text-sm text-mint break-all">
                uint64 board = 0x{hexChars};
              </p>
            </div>

            <ul className="space-y-2.5 text-[13px] leading-6 text-slate-400">
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-base" />
                <span>
                  Each tile costs just <b className="text-slate-200">4 bits</b> — it stores the exponent, not the
                  number: <span className="font-mono text-base-bright">0xB = 2048</span>.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-bright" />
                <span>
                  A player's whole run (board + score + moves + state) fits in <b className="text-slate-200">one slot</b> —
                  the minimum possible SLOAD/SSTORE per move.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                <span>
                  A move that changes nothing reverts with <span className="font-mono text-rose">NoopMove()</span> so no gas is wasted.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span>
                  Crossing 4096 points freezes the board into a <b className="text-slate-200">Snapshot</b> and mints the ERC-721 trophy in the same transaction.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

const MECHANICS = [
  {
    num: '01',
    title: 'Entry is free — gas only',
    text: 'start() costs nothing but the Base transaction fee. There is no entry fee, no pot and no house cut — the only cost of playing is gas.',
    color: 'text-base-bright',
  },
  {
    num: '02',
    title: 'Move = move(dir) transaction',
    text: 'Slide and merge with pure bit ops on nibbles; up/down run through the matrix transpose as left/right. A fresh tile spawns from blockhash entropy afterwards.',
    color: 'text-cyan-bright',
  },
  {
    num: '03',
    title: 'First 2048 = you win',
    text: 'The moment a nibble hits 11, the run flips to ST_WON. No money changes hands — the prize is the glory (and you can keep playing past it).',
    color: 'text-amber',
  },
  {
    num: '04',
    title: 'Score 4096 mints the NFT trophy',
    text: 'One-of-one ERC-721 per player. The winning board is frozen into storage and tokenURI() renders it as SVG — fully on-chain metadata, no IPFS.',
    color: 'text-gold',
  },
  {
    num: '05',
    title: 'Dead end = GameOver',
    text: 'If _hasMoves finds neither an empty cell nor equal neighbours, the run locks into ST_OVER and the next round waits for a new start().',
    color: 'text-mint',
  },
];

export function ArchSection({ tiles }: { tiles: Tile[] }) {
  return (
    <section id="arch" className="relative mx-auto max-w-6xl px-5 py-24">
      <SectionHeader
        index="01"
        kicker="Storage Architecture"
        title="The whole game in 64 bits"
        lead="No expensive arrays: the 4×4 board is packed into a single uint64, so every move touches exactly one storage slot and gas stays close to a plain transfer. Push your score to 4096 and that same slot gets minted into a one-of-one NFT."
      />

      <PackingViz tiles={tiles} />

      <div className="mt-14 grid gap-x-12 gap-y-8 lg:grid-cols-2">
        {MECHANICS.map((m, i) => (
          <Reveal key={m.num} delay={i * 90}>
            <div className="group flex gap-5 border-b border-line/70 pb-7 transition-colors hover:border-base/50">
              <span className={`font-display text-3xl leading-none ${m.color} opacity-80 group-hover:opacity-100 transition-opacity`}>
                {m.num}
              </span>
              <div>
                <h3 className="font-display text-xl text-white mb-2 group-hover:translate-x-1 transition-transform">
                  {m.title}
                </h3>
                <p className="text-sm leading-7 text-slate-400">{m.text}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* function table */}
      <Reveal className="mt-14">
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="flex items-center justify-between bg-panel px-5 py-4 border-b border-line">
            <h3 className="font-display text-xl text-white">Contract interface</h3>
            <span className="font-mono text-[11px] text-slate-500">interface: Onchain2048</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[640px]">
              <thead>
                <tr className="bg-ink text-[11px] text-slate-500">
                  <th className="px-5 py-3 font-medium">Function</th>
                  <th className="px-5 py-3 font-medium">Kind</th>
                  <th className="px-5 py-3 font-medium">Gas</th>
                  <th className="px-5 py-3 font-medium">What it does</th>
                </tr>
              </thead>
              <tbody>
                {FUNCTIONS.map((f) => (
                  <tr key={f.name} className="border-t border-line/60 transition-colors hover:bg-base/[0.04]">
                    <td className="px-5 py-4">
                      <p className="font-mono text-[13px] text-white">{f.signature}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md px-2 py-1 font-mono text-[10px] ${KIND_STYLE[f.kind]}`}>
                        {KIND_LABEL[f.kind]}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-400">{f.gas}</td>
                    <td className="px-5 py-4 text-[13px] leading-6 text-slate-400">{f.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
