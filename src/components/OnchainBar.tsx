import { NETWORKS, type NetId, type OcApi } from '../hooks/useOnchain';
import { fmtNum } from '../hooks/useBaseChain';
import { Reveal } from './ui';

const RUN_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: 'No run yet', cls: 'bg-slate-500/15 text-slate-400 border-line' },
  1: { label: 'Run active', cls: 'bg-mint/15 text-mint border-mint/40' },
  2: { label: 'Run won · 2048', cls: 'bg-gold/15 text-gold border-gold/40' },
  3: { label: 'Game over', cls: 'bg-rose/15 text-rose border-rose/40' },
};

export function OnchainBar({
  netId,
  onNet,
  address,
  onAddress,
  oc,
}: {
  netId: NetId;
  onNet: (n: NetId) => void;
  address: string;
  onAddress: (a: string) => void;
  oc: OcApi;
}) {
  const runState = oc.state?.runState ?? 0;

  return (
    <Reveal className="mb-8">
      <div className="overflow-hidden rounded-2xl border border-base/30 bg-panel shadow-[0_10px_50px_rgba(0,82,255,0.08)]">
        {/* header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              {oc.active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" />}
              <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${oc.active ? 'bg-mint' : 'bg-slate-600'}`} />
            </span>
            <p className="font-display text-base text-white">On-chain mode</p>
            <span className="hidden sm:inline text-[11px] text-slate-500">
              {oc.active ? 'board, score & trophy read live from your deployed contract' : 'play the local simulation until you connect'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-line">
              {(Object.keys(NETWORKS) as NetId[]).map((id) => (
                <button
                  key={id}
                  onClick={() => onNet(id)}
                  className={`px-3 py-1.5 font-mono text-[10px] transition-colors ${
                    netId === id ? 'bg-base text-white' : 'bg-ink text-slate-400 hover:text-white'
                  }`}
                >
                  {NETWORKS[id].label}
                </button>
              ))}
            </div>
            {oc.active && (
              <a
                href={`${oc.net.explorer}/address/${address.trim()}`}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line px-3 py-1.5 font-mono text-[10px] text-cyan-bright transition-all hover:border-base hover:text-white"
              >
                Basescan ↗
              </a>
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-slate-600">
                {oc.validAddress ? '✓' : '0x'}
              </span>
              <input
                value={address}
                onChange={(e) => onAddress(e.target.value)}
                spellCheck={false}
                placeholder="Deployed contract address — paste from Remix “Deployed Contracts”"
                className={`w-full rounded-xl border bg-ink py-3 pl-9 pr-3 font-mono text-[12px] text-slate-200 placeholder:font-body placeholder:text-slate-600 focus:outline-none transition-colors ${
                  address && !oc.validAddress ? 'border-rose/60' : 'border-line focus:border-base'
                }`}
              />
            </div>
            {oc.account ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-mint/30 bg-mint/[0.06] px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-mint pulse-dot" />
                <span className="font-mono text-[12px] text-mint">
                  {oc.account.slice(0, 6)}…{oc.account.slice(-4)}
                </span>
                <button
                  onClick={oc.connect}
                  className="ml-1 font-mono text-[10px] text-slate-500 underline-offset-2 hover:text-white hover:underline"
                >
                  switch
                </button>
              </div>
            ) : (
              <button
                onClick={oc.connect}
                disabled={oc.connecting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-base px-6 py-3 font-display text-sm text-white shadow-[0_6px_24px_rgba(0,82,255,0.4)] transition-all hover:bg-base-hi active:scale-[0.97] disabled:opacity-60"
              >
                {oc.connecting ? (
                  <>
                    <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-white/70 border-t-transparent" />
                    Connecting…
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M20 7H5a2 2 0 0 1 0-4h13v4m2 0v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="16.5" cy="13.5" r="1.3" fill="currentColor" stroke="none" />
                    </svg>
                    Connect wallet
                  </>
                )}
              </button>
            )}
          </div>

          {/* live run status */}
          {oc.active && oc.state && (
            <div className="tx-row flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line/70 bg-ink px-4 py-3">
              <span className={`rounded-md border px-2.5 py-1 font-mono text-[10px] ${RUN_BADGE[runState].cls}`}>
                {RUN_BADGE[runState].label}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                entry <span className="text-white">{oc.entryFeeStr} ETH</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                pot <span className="text-gold">{oc.potStr} ETH</span>
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                score <span className="text-white">{fmtNum(oc.state.score)}</span>
              </span>
              {runState !== 1 && (
                <button
                  onClick={oc.startRun}
                  disabled={oc.pending !== null}
                  className="ml-auto inline-flex items-center gap-2 rounded-lg bg-amber px-4 py-2 font-display text-[13px] text-[#3a2400] shadow-[0_4px_18px_rgba(255,176,58,0.35)] transition-all hover:brightness-110 active:scale-[0.96] disabled:opacity-50"
                >
                  {oc.pending === 'start' ? (
                    <>
                      <span className="spinner h-3 w-3 rounded-full border-2 border-[#3a2400]/60 border-t-transparent" />
                      start() pending…
                    </>
                  ) : runState === 0 ? (
                    `start() — pay ${oc.entryFeeStr} ETH`
                  ) : (
                    'start() — new run'
                  )}
                </button>
              )}
            </div>
          )}

          {oc.notice && (
            <div className="tx-row flex items-start gap-2.5 rounded-xl border border-rose/30 bg-rose/[0.07] px-4 py-3">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0 text-rose">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                <path d="M12 8v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16.2" r="1" fill="currentColor" />
              </svg>
              <p className="text-[12px] leading-5 text-rose">{oc.notice}</p>
            </div>
          )}

          {!oc.active && (
            <p className="text-[11px] leading-5 text-slate-600">
              Deployed on Remix VM? That chain only exists inside Remix — deploy to{' '}
              <span className="text-slate-400">Base Sepolia</span> (faucet.base.org) and paste that address here, or keep
              playing the pixel-perfect local simulation below.
            </p>
          )}
        </div>
      </div>
    </Reveal>
  );
}
