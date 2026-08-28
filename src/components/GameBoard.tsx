import { useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import type { Dir, Tile } from '../game/logic';
import type { NftReward } from '../game/useGame';
import { fmtInt } from '../hooks/useBaseChain';
import { ActionButton } from './ui';

const GAP = 10;

function cellPos(i: number) {
  return {
    width: `calc((100% - ${3 * GAP}px) / 4)`,
    height: `calc((100% - ${3 * GAP}px) / 4)`,
    left: `calc(${i % 4} * ((100% - ${3 * GAP}px) / 4 + ${GAP}px))`,
    top: `calc(${Math.floor(i / 4)} * ((100% - ${3 * GAP}px) / 4 + ${GAP}px))`,
  };
}

function tileClass(exp: number): string {
  const v = 2 ** exp;
  if (v <= 2048) return `t${v}`;
  return 'tmax';
}

function fontSize(exp: number): string {
  const v = 2 ** exp;
  if (v < 100) return 'text-[clamp(1.6rem,7.5vmin,2.6rem)]';
  if (v < 1000) return 'text-[clamp(1.3rem,6vmin,2.1rem)]';
  return 'text-[clamp(1rem,4.6vmin,1.6rem)]';
}

const GOLD = ['#ffd76a', '#ffb03a', '#0052ff', '#5b8cff', '#ffffff'];

export function GameBoard({
  tiles,
  won,
  over,
  keepPlaying,
  nudgeKey,
  nft,
  pending,
  noRun,
  onMove,
  onRestart,
  onContinue,
}: {
  tiles: Tile[];
  won: boolean;
  over: boolean;
  keepPlaying: boolean;
  nudgeKey: number;
  nft: NftReward | null;
  pending?: null | 'start' | 'move';
  noRun?: boolean;
  onMove: (d: Dir) => void;
  onRestart: () => void;
  onContinue: () => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const showWin = won && !keepPlaying;
  const prevNftKey = useRef(0);
  const prevWin = useRef(false);

  // Gold confetti burst when the NFT trophy is minted
  useEffect(() => {
    if (nft && nft.mintKey !== prevNftKey.current) {
      prevNftKey.current = nft.mintKey;
      confetti({ particleCount: 140, spread: 85, origin: { y: 0.35 }, colors: GOLD, ticks: 220, scalar: 1.05 });
      window.setTimeout(
        () => confetti({ particleCount: 70, spread: 120, origin: { y: 0.3 }, colors: GOLD, ticks: 180 }),
        220,
      );
    }
  }, [nft]);

  // Blue/gold burst when 2048 is tiled
  useEffect(() => {
    if (showWin && !prevWin.current) {
      confetti({ particleCount: 110, spread: 90, origin: { y: 0.4 }, colors: GOLD, ticks: 200 });
    }
    prevWin.current = showWin;
  }, [showWin]);

  return (
    <div
      key={nudgeKey}
      className={`relative aspect-square w-full select-none rounded-2xl border border-line bg-board p-0 shadow-[0_30px_80px_rgba(2,8,26,0.75),inset_0_1px_0_rgba(120,160,255,0.08)] ${
        nudgeKey > 0 ? 'nudge' : ''
      }`}
      style={{ touchAction: 'none' }}
      onTouchStart={(e) => {
        const t = e.touches[0];
        touch.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        if (!touch.current) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touch.current.x;
        const dy = t.clientY - touch.current.y;
        touch.current = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        if (Math.abs(dx) > Math.abs(dy)) onMove(dx > 0 ? 1 : 0);
        else onMove(dy > 0 ? 3 : 2);
      }}
    >
      {/* background cells */}
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} className="absolute rounded-lg bg-cell" style={cellPos(i)} />
      ))}

      {/* tiles */}
      {tiles.map((t) => (
        <div
          key={t.id}
          className="absolute"
          style={{ ...cellPos(t.r * 4 + t.c), transition: 'left 130ms ease, top 130ms ease', zIndex: 2 }}
        >
          <div
            className={`tile flex h-full w-full items-center justify-center rounded-lg font-display leading-none ${tileClass(
              t.exp,
            )} ${fontSize(t.exp)} ${t.isNew ? 'tile-new' : ''} ${t.merged ? 'tile-merged' : ''}`}
          >
            {2 ** t.exp}
          </div>
        </div>
      ))}

      {/* NFT mint banner — plays once per mint */}
      {nft && (
        <div
          key={nft.mintKey}
          className="nft-banner pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center gap-3 rounded-xl border border-gold/60 bg-[rgba(20,16,4,0.92)] px-4 py-3 shadow-[0_10px_40px_rgba(255,190,70,0.25)] backdrop-blur-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-gold to-amber text-[#3a2400]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" strokeLinejoin="round" />
              <path d="m3 7 9 5 9-5M12 22V12" strokeLinejoin="round" />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm text-gold leading-tight">NFT MINTED — TOKEN #{nft.tokenId}</p>
            <p className="truncate font-mono text-[10px] text-slate-400">
              score ≥ 4096 · {nft.hash.slice(0, 20)}…
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-md bg-gold/15 px-2 py-1 font-mono text-[10px] text-gold">
            +{fmtInt(nft.score)} pts
          </span>
        </div>
      )}

      {/* win overlay */}
      {showWin && (
        <div className="overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-2xl bg-[rgba(4,10,28,0.82)] backdrop-blur-[3px]">
          <div className="tile t2048 flex h-24 w-24 items-center justify-center rounded-xl font-display text-3xl tile-merged">
            2048
          </div>
          <p className="font-display text-4xl text-gold">YOU WIN! 🎉</p>
          <p className="text-sm text-slate-400">The contract sends 90% of the pot to your address.</p>
          <div className="flex gap-3">
            <ActionButton variant="amber" onClick={onContinue}>
              Keep going
            </ActionButton>
            <ActionButton variant="ghost" onClick={onRestart}>
              New run
            </ActionButton>
          </div>
        </div>
      )}

      {/* game-over overlay */}
      {over && (
        <div className="overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-2xl bg-[rgba(4,10,28,0.86)] backdrop-blur-[3px]">
          <p className="font-display text-4xl text-rose">GAME OVER</p>
          <p className="text-sm text-slate-400">No moves left — exactly like the contract reverting.</p>
          <ActionButton onClick={onRestart}>Play again</ActionButton>
        </div>
      )}

      {/* on-chain: no active run yet */}
      {noRun && !pending && (
        <div className="overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[rgba(4,10,28,0.78)] backdrop-blur-[2px]">
          <p className="font-display text-3xl text-white">No active run</p>
          <p className="max-w-[280px] text-center text-sm leading-6 text-slate-400">
            This wallet has no run on the contract yet — <span className="font-mono text-cyan-bright">start()</span> spawns
            two tiles and pays the entry fee into the pot.
          </p>
          <ActionButton variant="amber" onClick={onRestart}>
            start() — new run
          </ActionButton>
        </div>
      )}

      {/* on-chain: transaction pending on Base */}
      {pending && (
        <div className="overlay absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-2xl bg-[rgba(4,10,28,0.7)] backdrop-blur-[2px]">
          <span className="spinner h-9 w-9 rounded-full border-[3px] border-base-bright border-t-transparent" />
          <p className="font-mono text-sm text-slate-300">
            {pending === 'start' ? 'start()' : 'move(dir)'} pending — waiting for Base…
          </p>
        </div>
      )}
    </div>
  );
}
