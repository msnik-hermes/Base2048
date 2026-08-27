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
  // کاراکتر هگز متناظر با نیبل i — از LSB سمت راست خوانده می‌شود
  const hexByNibble = [...hexChars].reverse();

  return (
    <Reveal>
      <div className="rounded-2xl border border-line bg-panel p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[auto_1fr] items-start" dir="ltr">
          {/* شبکه نیبل‌ها */}
          <div>
            <p className="mb-3 font-mono text-[11px] text-slate-500" dir="rtl">
              روی هر خانه برو — نیبل متناظرش در uint64 روشن می‌شود
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

          {/* نمایش بسته‌بندی */}
          <div className="min-w-0">
            <p className="font-mono text-xs text-slate-500 mb-2" dir="rtl">یک storage slot — ۶۴ بیت، ۱۶ نیبل:</p>
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
              <p className="font-mono text-[11px] text-slate-500 mb-1" dir="rtl">
                خانهٔ (r,c) → بیت‌های <span className="text-cyan-bright">{hover !== null ? `${hover * 4}..${hover * 4 + 3}` : 'r·16 + c·4'}</span>
              </p>
              <p className="font-mono text-sm text-mint break-all" dir="ltr">
                uint64 board = 0x{hexChars};
              </p>
            </div>

            <ul className="space-y-2.5 text-[13px] leading-6 text-slate-400" dir="rtl">
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-base" />
                <span>
                  هر کاشی فقط <b className="text-slate-200">۴ بیت</b> فضا می‌گیرد — توانِ ۲ به‌جای خود عدد؛
                  <span className="font-mono text-base-bright" dir="ltr"> 0xB = 2048</span>.
                </span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-bright" />
                <span>کل وضعیت هر بازیکن (برد + امتیاز + حرکت‌ها + وضعیت) در <b className="text-slate-200">یک slot</b> جا می‌شود: کمترین SLOAD/SSTORE ممکن.</span>
              </li>
              <li className="flex gap-2.5">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-mint" />
                <span>حرکت بی‌اثر با <span className="font-mono text-rose" dir="ltr">NoopMove()</span> ریورت می‌شود تا گاز کسی هدر نرود.</span>
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
    num: '۰۱',
    title: 'ورودی = سهم تو از pot',
    text: 'هر start() با پرداخت entryFee (پیش‌فرض ۰٫۰۰۰۰۴۲ اتر) انجام می‌شود؛ پول مستقیم در قرارداد می‌ماند و pot را می‌سازد.',
    color: 'text-base-bright',
  },
  {
    num: '۰۲',
    title: 'حرکت = تراکنش move(dir)',
    text: 'اسلاید و ادغام با عملیات بیتی روی نیبل‌ها؛ بالا/پایین با ترانهاده‌ی ماتریس به چپ/راست تبدیل می‌شود. بعد کاشی جدید با آنتروپی blockhash spawn می‌شود.',
    color: 'text-cyan-bright',
  },
  {
    num: '۰۳',
    title: 'اولین ۲۰۴۸ = ۹۰٪ pot',
    text: 'به‌محض رسیدن نیبل به ۱۱، قرارداد جایزه را همان‌جا واریز می‌کند و ۱۰٪ به‌عنوان کارمزد خانه در houseCut انباشته می‌شود.',
    color: 'text-amber',
  },
  {
    num: '۰۴',
    title: 'بن‌بست = GameOver',
    text: 'اگر _hasMoves صفرِ فشرده‌شده و همسایهٔ برابر پیدا نکند، وضعیت روی ST_OVER قفل می‌شود و دور بعدی منتظر start() جدید است.',
    color: 'text-mint',
  },
];

export function ArchSection({ tiles }: { tiles: Tile[] }) {
  return (
    <section id="arch" className="relative mx-auto max-w-6xl px-5 py-24">
      <SectionHeader
        index="01"
        kicker="Storage Architecture"
        title="کل بازی در ۶۴ بیت"
        lead="به‌جای آرایه‌های پرخرج، صفحه‌ی ۲۰۴۸ به‌صورت فشرده در یک uint64 ذخیره می‌شود. این یعنی هر حرکت فقط یک slot را لمس می‌کند و گاز در حد یک انتقال ساده باقی می‌ماند."
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
                <h3 className="font-display text-xl text-white mb-2 group-hover:translate-x-[-4px] transition-transform">
                  {m.title}
                </h3>
                <p className="text-sm leading-7 text-slate-400">{m.text}</p>
              </div>
            </div>
          </Reveal>
        ))}
      </div>

      {/* جدول توابع */}
      <Reveal className="mt-14">
        <div className="overflow-hidden rounded-2xl border border-line">
          <div className="flex items-center justify-between bg-panel px-5 py-4 border-b border-line">
            <h3 className="font-display text-xl text-white">رابط قرارداد</h3>
            <span className="font-mono text-[11px] text-slate-500" dir="ltr">interface: Onchain2048</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right min-w-[640px]">
              <thead>
                <tr className="bg-ink text-[11px] text-slate-500">
                  <th className="px-5 py-3 font-medium">تابع</th>
                  <th className="px-5 py-3 font-medium">نوع</th>
                  <th className="px-5 py-3 font-medium">گاز تقریبی</th>
                  <th className="px-5 py-3 font-medium">توضیح</th>
                </tr>
              </thead>
              <tbody>
                {FUNCTIONS.map((f) => (
                  <tr key={f.name} className="border-t border-line/60 transition-colors hover:bg-base/[0.04]">
                    <td className="px-5 py-4">
                      <p className="font-mono text-[13px] text-white" dir="ltr">{f.signature}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-md px-2 py-1 font-mono text-[10px] ${KIND_STYLE[f.kind]}`}>
                        {KIND_LABEL[f.kind]}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-400" dir="ltr">{f.gas}</td>
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
