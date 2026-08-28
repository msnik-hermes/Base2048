import { useEffect, useRef } from 'react';
import type { Dir, Tile } from '../game/logic';
import type { NftReward } from '../game/useGame';
import { ActionButton } from './ui';

const TILE_CLASS: Record<number, string> = {
  1: 't2', 2: 't4', 3: 't8', 4: 't16', 5: 't32', 6: 't64',
  7: 't128', 8: 't256', 9: 't512', 10: 't1024', 11: 't2048',
};

function tileClass(exp: number): string {
  return TILE_CLASS[exp] ?? 'tmax';
}

const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 137) % 100}%`,
  delay: `${(i % 9) * 0.12}s`,
  dur: `${2 + (i % 5) * 0.4}s`,
  color: ['#ffd76a', '#ffb03a', '#5b8cff', '#4dd4ff', '#37d9a6'][i % 5],
  size: 5 + (i % 3) * 3,
}));

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
  const boardRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  // keyboard controls
  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowLeft: 0, a: 0, A: 0,
      ArrowRight: 1, d: 1, D: 1,
      ArrowUp: 2, w: 2, W: 2,
      ArrowDown: 3, s: 3, S: 3,
    };
    const handler = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir !== undefined) {
        e.preventDefault();
        onMove(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onMove]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
    if (Math.abs(dx) > Math.abs(dy)) onMove(dx > 0 ? 1 : 0);
    else onMove(dy > 0 ? 3 : 2);
  };

  return (
    <div className="relative w-full" dir="ltr">
      {/* NFT mint banner */}
      {nft && (
        <div className="nft-banner pointer-events-none absolute -top-16 left-1/2 z-40 -translate-x-1/2">
          <div className="nft-frame flex items-center gap-3 rounded-xl px-5 py-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffd76a" strokeWidth="2">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" strokeLinejoin="round" />
              <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div>
              <p className="font-display text-sm text-gold">NFT MINTED — TOKEN #{nft.tokenId}</p>
              <p className="font-mono text-[10px] text-slate-400">{nft.hash.slice(0, 22)}…</p>
            </div>
          </div>
        </div>
      )}
      {/* gold confetti on mint */}
      {nft && (
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-2xl">
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="absolute top-0 block rounded-sm"
              style={{
                left: c.left,
                width: c.size,
                height: c.size * 1.6,
                background: c.color,
                animation: `confetti-fall ${c.dur} linear ${c.delay} forwards`,
              }}
            />
          ))}
        </div>
      )}

      <div
        key={nudgeKey}
        ref={boardRef}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`relative aspect-square w-full touch-none rounded-2xl border border-line bg-board p-3 shadow-[0_24px_70px_rgba(2,8,26,0.55)] ${nudgeKey ? 'nudge' : ''}`}
      >
        {/* cells */}
        <div className="grid h-full grid-cols-4 grid-rows-4 gap-3">
          {Array.from({ length: 16 }, (_, i) => (
            <div key={i} className="rounded-xl bg-cell" />
          ))}
        </div>

        {/* tiles — positioned to align exactly with the 4×4 cell grid (gap 0.75rem) */}
        <div className="absolute inset-3">
          {tiles.map((t) => (
            <div
              key={t.id}
              className={`absolute flex items-center justify-center rounded-xl font-display font-bold transition-all duration-150 ease-out tile ${tileClass(t.exp)} ${t.isNew ? 'tile-new' : ''} ${t.merged ? 'tile-merged' : ''}`}
              style={{
                width: 'calc(25% - 0.5625rem)',
                height: 'calc(25% - 0.5625rem)',
                left: `calc(${t.c} * 25% + ${t.c} * 0.1875rem)`,
                top: `calc(${t.r} * 25% + ${t.r} * 0.1875rem)`,
                fontSize: t.exp >= 10 ? '1.25rem' : t.exp >= 7 ? '1.6rem' : '1.9rem',
              }}
            >
              {2 ** t.exp}
            </div>
          ))}
        </div>

        {/* won overlay */}
        {won && !keepPlaying && (
          <div className="overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-2xl bg-[rgba(4,10,28,0.86)] backdrop-blur-[3px]">
            <p className="font-display text-4xl text-gold">YOU WIN — 2048!</p>
            <p className="max-w-[280px] text-center text-sm leading-6 text-slate-400">
              The contract just flipped your run to <span className="font-mono text-cyan-bright">ST_WON</span>. Keep going
              to push past 4096 and mint the trophy.
            </p>
            <div className="flex gap-3">
              <ActionButton variant="gold" onClick={onContinue}>Keep going</ActionButton>
              <ActionButton variant="ghost" onClick={onRestart}>New run</ActionButton>
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
              This wallet has no run on the contract yet — <span className="font-mono text-cyan-bright">start()</span> asks
              Chainlink VRF for two random tiles (they land in a few seconds). It's free; you only pay the Base tx fee.
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

      <style>{`
        @keyframes confetti-fall {
          from { transform: translateY(-10%) rotate(0deg); opacity: 1; }
          to   { transform: translateY(520px) rotate(540deg); opacity: 0; }
        }
        .overlay { animation: tile-appear 0.25s ease backwards; }
      `}</style>
    </div>
  );
}
