import { useRef } from 'react';
import type { Dir, Tile } from '../game/logic';
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

export function GameBoard({
  tiles,
  won,
  over,
  keepPlaying,
  nudgeKey,
  onMove,
  onRestart,
  onContinue,
}: {
  tiles: Tile[];
  won: boolean;
  over: boolean;
  keepPlaying: boolean;
  nudgeKey: number;
  onMove: (d: Dir) => void;
  onRestart: () => void;
  onContinue: () => void;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const showWin = won && !keepPlaying;

  return (
    <div
      dir="ltr"
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
      {/* خانه‌های زمینه */}
      {Array.from({ length: 16 }, (_, i) => (
        <div key={i} className="absolute rounded-lg bg-cell" style={cellPos(i)} />
      ))}

      {/* کاشی‌ها */}
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

      {/* اورلی برد */}
      {showWin && (
        <div className="overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-2xl bg-[rgba(4,10,28,0.82)] backdrop-blur-[3px]">
          <div className="tile t2048 flex h-24 w-24 items-center justify-center rounded-xl font-display text-3xl tile-merged">
            2048
          </div>
          <p className="font-display text-4xl text-gold">بردی! 🎉</p>
          <p className="text-sm text-slate-400">قرارداد ۹۰٪ از pot را به آدرست واریز می‌کند.</p>
          <div className="flex gap-3" dir="rtl">
            <ActionButton variant="amber" onClick={onContinue}>
              ادامه بازی
            </ActionButton>
            <ActionButton variant="ghost" onClick={onRestart}>
              دور جدید
            </ActionButton>
          </div>
        </div>
      )}

      {/* اورلی باخت */}
      {over && (
        <div className="overlay absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 rounded-2xl bg-[rgba(4,10,28,0.86)] backdrop-blur-[3px]">
          <p className="font-display text-4xl text-rose">بازی تمام شد</p>
          <p className="text-sm text-slate-400">حرکتی باقی نمانده — درست مثل revert قرارداد.</p>
          <ActionButton onClick={onRestart}>شروع دوباره</ActionButton>
        </div>
      )}
    </div>
  );
}
