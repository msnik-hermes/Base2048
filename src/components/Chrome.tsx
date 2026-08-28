import { fmtInt } from '../hooks/useBaseChain';
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
        <span className="block font-display text-xl text-white">2048 on Base</span>
        <span className="block font-mono text-[10px] text-slate-500">
          onchain · VRF · ERC-721
        </span>
      </span>
    </a>
  );
}

/** Always-visible floating button → jump straight to the code delivery section */
export function GetCodeFab() {
  return (
    <a
      href="#export"
      className="group fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-base py-3 pl-5 pr-4 text-white shadow-[0_8px_32px_rgba(0,82,255,0.55)] transition-all duration-200 hover:bg-base-hi hover:shadow-[0_10px_44px_rgba(0,82,255,0.75)] hover:-translate-y-0.5 active:scale-95"
      style={{ animation: 'fab-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) 0.8s backwards' }}
    >
      <span className="font-display text-sm">Get the code</span>
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/15 transition-transform group-hover:translate-y-0.5">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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
            ['#game', 'Play'],
            ['#arch', 'Architecture'],
            ['#contract', 'Contract'],
            ['#remix', 'Remix'],
            ['#deploy', 'Deploy'],
            ['#export', 'Code'],
            ['#security', 'Security'],
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
          title={chain.live ? 'Live connection to the official Base RPC' : 'RPC unreachable — simulation mode'}
        >
          <span className="relative flex h-2 w-2">
            {chain.live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${chain.live ? 'bg-mint' : 'bg-amber'}`} />
          </span>
          <span className="font-mono text-[11px] text-slate-300">
            {chain.live ? (
              <>
                <span className="text-mint">Base</span> #{fmtInt(chain.block)} · {chain.gwei} gwei
              </>
            ) : (
              <span className="text-amber">Base · simulated</span>
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
  { ch: '4096', top: '38%', left: '2%', size: '2rem', dur: 21, delay: 6 },
];

export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {/* faint blueprint grid */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(91,140,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(91,140,255,0.6) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
        }}
      />
      {/* base-blue glows */}
      <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-base/20 blur-[140px]" />
      <div className="absolute top-1/3 -right-48 h-[460px] w-[460px] rounded-full bg-cyan-bright/10 blur-[130px]" />
      <div className="absolute bottom-0 left-1/4 h-[380px] w-[380px] rounded-full bg-gold/10 blur-[120px]" />
      {/* drifting tile numbers */}
      {FLOATERS.map((f) => (
        <span
          key={f.ch}
          className="floater absolute select-none font-display font-800 text-base-bright/10"
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
    <footer className="border-t border-line/70 bg-[rgba(6,12,28,0.6)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-display text-lg text-white">Onchain 2048</p>
          <p className="mt-1.5 max-w-md text-xs leading-6 text-slate-500">
            A complete educational build: Solidity contract + frontend. Randomness is Chainlink VRF v2.5;
            the game is free-to-play and the contract can never hold or move funds.{' '}
            <a href="#security" className="text-base-bright underline underline-offset-2 hover:text-white transition-colors">
              Read the security review
            </a>{' '}
            before you deploy.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {[
            ['Base Docs', 'https://docs.base.org'],
            ['Chainlink VRF', 'https://docs.chain.link/vrf/v2-5'],
            ['Foundry', 'https://book.getfoundry.sh'],
            ['Basescan', 'https://basescan.org'],
            ['Remix IDE', 'https://remix.ethereum.org'],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-xs text-slate-500 transition-colors hover:text-base-bright"
            >
              {label} ↗
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
