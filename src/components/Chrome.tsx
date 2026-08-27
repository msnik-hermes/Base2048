import { faInt } from '../hooks/useBaseChain';
import type { ChainState } from '../hooks/useBaseChain';

export function Logo() {
  return (
    <a href="#game" className="group flex items-center gap-3">
      <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-base font-display text-lg text-white shadow-[0_4px_18px_rgba(0,82,255,0.5)] transition-transform group-hover:rotate-6 group-hover:scale-105">
        2
        <span className="absolute -bottom-1 -left-1 flex h-4 w-4 items-center justify-center rounded bg-amber font-mono text-[8px] font-bold text-[#3a2400]">
          11
        </span>
      </span>
      <span className="leading-tight">
        <span className="block font-display text-xl text-white">۲۰۴۸ روی Base</span>
        <span className="block font-mono text-[10px] text-slate-500" dir="ltr">
          onchain · uint64 · solidity
        </span>
      </span>
    </a>
  );
}

export function TopBar({ chain }: { chain: ChainState }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-[rgba(6,12,28,0.82)] backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {[
            ['#game', 'بازی'],
            ['#arch', 'معماری'],
            ['#contract', 'قرارداد'],
            ['#deploy', 'دیپلوی'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-lg px-3.5 py-2 text-sm text-slate-400 transition-colors hover:bg-base/10 hover:text-white"
            >
              {label}
            </a>
          ))}
        </nav>
        <div
          className="flex items-center gap-2.5 rounded-full border border-line bg-panel px-3.5 py-2"
          title={chain.live ? 'اتصال زنده به RPC رسمی Base' : 'RPC در دسترس نیست — حالت شبیه‌سازی'}
        >
          <span className="relative flex h-2 w-2">
            {chain.live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${chain.live ? 'bg-mint' : 'bg-amber'}`} />
          </span>
          <span className="font-mono text-[11px] text-slate-300" dir="ltr">
            {chain.live ? (
              <>
                <span className="text-mint">Base</span> #{faInt(chain.block)} · {chain.gwei} gwei
              </>
            ) : (
              <span className="text-amber">Base · شبیه‌سازی</span>
            )}
          </span>
        </div>
      </div>
    </header>
  );
}

const FLOATERS = [
  { ch: '2', top: '12%', left: '6%', size: '3rem', dur: 14, delay: 0 },
  { ch: '64', top: '24%', left: '88%', size: '2.4rem', dur: 17, delay: 2 },
  { ch: '256', top: '64%', left: '4%', size: '2.8rem', dur: 19, delay: 1 },
  { ch: '1024', top: '78%', left: '90%', size: '2.2rem', dur: 15, delay: 3 },
  { ch: '8', top: '46%', left: '94%', size: '2rem', dur: 16, delay: 5 },
  { ch: '512', top: '8%', left: '68%', size: '2.2rem', dur: 18, delay: 4 },
  { ch: '16', top: '88%', left: '30%', size: '2.4rem', dur: 20, delay: 2 },
  { ch: '128', top: '38%', left: '2%', size: '2rem', dur: 21, delay: 6 },
];

export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* لایه‌های نور */}
      <div className="absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-base/[0.13] blur-[140px]" />
      <div className="absolute top-1/3 -right-40 h-[420px] w-[420px] rounded-full bg-cyan-bright/[0.06] blur-[120px]" />
      <div className="absolute bottom-0 -left-40 h-[420px] w-[420px] rounded-full bg-amber/[0.05] blur-[120px]" />
      {/* شبکه */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(80,120,220,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(80,120,220,0.06) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 0%, black 30%, transparent 100%)',
        }}
      />
      {/* کاشی‌های شناور */}
      {FLOATERS.map((f) => (
        <span
          key={f.ch}
          className="floater absolute font-display text-base-bright/[0.10]"
          style={{
            top: f.top,
            left: f.left,
            fontSize: f.size,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
          }}
        >
          {f.ch}
        </span>
      ))}
    </div>
  );
}

export function Footer() {
  return (
    <footer className="relative border-t border-line/70 bg-[rgba(5,10,24,0.6)]">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="font-display text-lg text-white">۲۰۴۸ روی Base</p>
            <p className="mt-1 text-[13px] text-slate-500 leading-6 max-w-md">
              یک نمونه‌ی آموزشی کامل: قرارداد Solidity + فرانت‌اند. آنتروپی blockhash برای سرگرمی است؛
              در محصول واقعی از Chainlink VRF استفاده کنید.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5" dir="ltr">
            {[
              ['Base Docs', 'https://docs.base.org'],
              ['Solidity', 'https://docs.soliditylang.org'],
              ['Foundry', 'https://book.getfoundry.sh'],
              ['Basescan', 'https://basescan.org'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line px-3.5 py-2 font-mono text-[11px] text-slate-400 transition-all hover:border-base hover:text-white hover:-translate-y-0.5"
              >
                {label} ↗
              </a>
            ))}
          </div>
        </div>
        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-line/50 pt-6 md:flex-row">
          <p className="font-mono text-[11px] text-slate-600" dir="ltr">
            Onchain2048.sol — MIT — made for Base ⬥
          </p>
          <p className="text-[12px] text-slate-600">هر حرکت، یک تراکنش. هر برد، یک واریز.</p>
        </div>
      </div>
    </footer>
  );
}
