import { boardHex, maxExp, nibbleGrid, type Tile } from '../game/logic';
import type { TxEntry } from '../game/useGame';
import { DIR_ARROWS, DIR_NAMES_FA } from '../data/contract';
import { faInt, faNum } from '../hooks/useBaseChain';
import { ActionButton } from './ui';

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3 text-center">
      <p className="text-[11px] font-medium text-slate-500 mb-1">{label}</p>
      <p className={`font-display text-2xl leading-none ${accent ? 'text-amber' : 'text-white'}`}>{value}</p>
    </div>
  );
}

export function SidePanel({
  score,
  best,
  moves,
  tiles,
  lastGain,
  txs,
  canUndo,
  liveBlock,
  onRestart,
  onUndo,
}: {
  score: number;
  best: number;
  moves: number;
  tiles: Tile[];
  lastGain: { value: number; key: number } | null;
  txs: TxEntry[];
  canUndo: boolean;
  liveBlock: number;
  onRestart: () => void;
  onUndo: () => void;
}) {
  const hex = boardHex(tiles);
  const nibbles = nibbleGrid(tiles);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* امتیاز */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-500 mb-1">امتیاز</p>
            <p className="font-display text-5xl text-white leading-none">{faInt(score)}</p>
            {lastGain && lastGain.value > 0 && (
              <span key={lastGain.key} className="gain-float font-display text-xl text-mint" dir="ltr">
                +{faInt(lastGain.value)}
              </span>
            )}
          </div>
          <div className="text-left" dir="rtl">
            <p className="text-xs text-slate-500 mb-1">بهترین</p>
            <p className="font-display text-2xl text-amber leading-none">{faInt(best)}</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatBox label="حرکت‌ها" value={faInt(moves)} />
          <StatBox label="بزرگ‌ترین کاشی" value={faNum(2 ** maxExp(tiles))} accent />
        </div>
        <div className="mt-4 flex gap-3">
          <ActionButton onClick={onRestart} className="flex-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            دور جدید
          </ActionButton>
          <ActionButton variant="ghost" onClick={onUndo} disabled={!canUndo} className="flex-1">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
              <path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            واگرد
          </ActionButton>
        </div>
      </div>

      {/* راهنمای کنترل */}
      <div className="rounded-2xl border border-line bg-panel p-5">
        <p className="text-xs text-slate-500 mb-3">کنترل‌ها — هر حرکت یک تراکنش <span className="font-mono text-cyan-bright" dir="ltr">move(dir)</span></p>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-1.5" dir="ltr">
            <span className="keycap">↑</span>
            <div className="flex gap-1.5">
              <span className="keycap">←</span>
              <span className="keycap">↓</span>
              <span className="keycap">→</span>
            </div>
          </div>
          <p className="text-[12px] leading-6 text-slate-400 max-w-[46%]">
            کلیدهای جهت‌نما یا <span className="font-mono text-slate-300">WASD</span> — روی موبایل، صفحه را بکشید.
          </p>
        </div>
      </div>

      {/* لاگ تراکنش‌ها */}
      <div className="rounded-2xl border border-line bg-panel p-5 flex-1 min-h-[180px]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-500">تراکنش‌های اخیر</p>
          <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${liveBlock > 0 ? 'bg-mint pulse-dot' : 'bg-amber'}`} />
            {liveBlock > 0 ? 'شبیه‌سازی زنده' : 'شبیه‌سازی محلی'}
          </span>
        </div>
        {txs.length === 0 ? (
          <p className="text-[13px] text-slate-600 leading-7">
            هنوز حرکتی ثبت نشده. اولین جهت را بزن تا تراکنشش همین‌جا بنشیند.
          </p>
        ) : (
          <ul className="space-y-2">
            {txs.map((tx) => (
              <li key={tx.id} className="tx-row flex items-center justify-between gap-2 rounded-lg border border-line/60 bg-ink px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-base/15 font-mono text-xs text-base-bright" dir="ltr">
                    {DIR_ARROWS[tx.dir]}
                  </span>
                  <div className="min-w-0" dir="ltr">
                    <p className="font-mono text-[11px] text-slate-300">move({tx.dir}) · {tx.hash.slice(0, 10)}…</p>
                    <p className="font-mono text-[10px] text-slate-600">
                      block {faNum(tx.block)} · {faNum(tx.gas)} gas
                    </p>
                  </div>
                </div>
                <div className="text-left shrink-0" dir="ltr">
                  {tx.gained > 0 ? (
                    <span className="font-display text-sm text-mint">+{faInt(tx.gained)}</span>
                  ) : (
                    <span className="font-mono text-[10px] text-slate-600">{DIR_NAMES_FA[tx.dir]}</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* اسنپ‌شات storage */}
      <div className="rounded-2xl border border-line bg-panel p-5" dir="ltr">
        <p className="text-[11px] text-slate-500 mb-3" dir="rtl">
          وضعیت برد در یک <span className="font-mono text-cyan-bright">uint64</span> — دقیقاً مثل storage قرارداد
        </p>
        <div className="grid grid-cols-4 gap-1.5 mb-3">
          {nibbles.map((n, i) => (
            <div
              key={i}
              className={`flex h-9 items-center justify-center rounded-md font-mono text-xs transition-colors ${
                n > 0 ? 'bg-base/15 text-base-bright' : 'bg-ink text-slate-700'
              }`}
            >
              {n.toString(16).toUpperCase()}
            </div>
          ))}
        </div>
        <p className="break-all rounded-lg bg-ink px-3 py-2 font-mono text-[11px] leading-5 text-mint/80">{hex}</p>
      </div>
    </div>
  );
}
