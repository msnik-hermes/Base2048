import { useEffect, useState } from 'react';
import { NETWORKS, type NetId, type OcApi } from '../hooks/useOnchain';
import { fmtNum } from '../hooks/useBaseChain';
import { Reveal } from './ui';

const RUN_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: 'No run yet', cls: 'bg-slate-500/15 text-slate-400 border-line' },
  1: { label: 'Run active', cls: 'bg-mint/15 text-mint border-mint/40' },
  2: { label: 'Run won · 2048', cls: 'bg-gold/15 text-gold border-gold/40' },
  3: { label: 'Game over', cls: 'bg-rose/15 text-rose border-rose/40' },
};

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

async function rpc(url: string, method: string, params: unknown[]): Promise<string> {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result as string;
}

function weiToEth(wei: string): string {
  try {
    const b = BigInt(wei);
    const eth = Number(b / 10n ** 14n) / 1e4;
    return eth.toFixed(eth > 0 && eth < 0.0001 ? 8 : 6);
  } catch {
    return '0';
  }
}

type Probe =
  | { status: 'idle' | 'checking' | 'error' }
  | { status: 'found'; codeKb: number; balanceWei: string }
  | { status: 'empty' };

export function OnchainBar({
  netId,
  onNet,
  address,
  onAddress,
  oc,
  quick,
}: {
  netId: NetId;
  onNet: (n: NetId) => void;
  address: string;
  onAddress: (a: string) => void;
  oc: OcApi;
  quick?: { address: string; label: string; net: NetId };
}) {
  const runState = oc.state?.runState ?? 0;
  const [probe, setProbe] = useState<Probe>({ status: 'idle' });

  // ── live deployment probe: is there code at this address? ─────
  useEffect(() => {
    setProbe({ status: 'idle' });
    const a = address.trim();
    if (!ADDR_RE.test(a)) return;
    let stop = false;
    const t = window.setTimeout(async () => {
      setProbe({ status: 'checking' });
      try {
        const [code, bal] = await Promise.all([
          rpc(NETWORKS[netId].rpc, 'eth_getCode', [a, 'latest']),
          rpc(NETWORKS[netId].rpc, 'eth_getBalance', [a, 'latest']),
        ]);
        if (stop) return;
        if (!code || code === '0x') setProbe({ status: 'empty' });
        else setProbe({ status: 'found', codeKb: (code.length - 2) / 2 / 1024, balanceWei: bal });
      } catch {
        if (!stop) setProbe({ status: 'error' });
      }
    }, 450);
    return () => {
      stop = true;
      window.clearTimeout(t);
    };
  }, [address, netId]);

  const net = NETWORKS[netId];

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

          {/* quick-load the project's own deployment */}
          {quick && (
            <button
              onClick={() => {
                onNet(quick.net);
                onAddress(quick.address);
              }}
              className="group flex w-full items-center gap-3 rounded-xl border border-dashed border-gold/40 bg-gold/[0.05] px-4 py-2.5 text-left transition-all hover:border-gold hover:bg-gold/[0.09] active:scale-[0.995]"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" strokeLinejoin="round" />
                  <path d="m3 7 9 5 9-5M12 22V12" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[12px] font-semibold text-gold">{quick.label}</span>
                <span className="block truncate font-mono text-[10px] text-slate-500 group-hover:text-slate-400">
                  {quick.address} · click to load {NETWORKS[quick.net].label}
                </span>
              </span>
              <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-600 group-hover:text-gold transition-colors">
                load ↓
              </span>
            </button>
          )}

          {/* live probe result */}
          {oc.validAddress && probe.status !== 'idle' && (
            <div
              className={`tx-row flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border px-4 py-2.5 ${
                probe.status === 'found'
                  ? 'border-mint/35 bg-mint/[0.05]'
                  : probe.status === 'empty'
                    ? 'border-rose/35 bg-rose/[0.06]'
                    : 'border-line bg-ink'
              }`}
            >
              {probe.status === 'checking' && (
                <>
                  <span className="spinner h-3 w-3 rounded-full border-2 border-base-bright border-t-transparent" />
                  <span className="font-mono text-[11px] text-slate-400">
                    probing {net.label} — eth_getCode @ {address.trim().slice(0, 10)}…
                  </span>
                </>
              )}
              {probe.status === 'found' && (
                <>
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-mint">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    LIVE on {net.label}
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    runtime <span className="text-white">{probe.codeKb.toFixed(1)} KB</span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400">
                    balance <span className="text-gold">{weiToEth(probe.balanceWei)} ETH</span>{' '}
                    <span className="text-slate-600">(should be 0 — nothing is payable)</span>
                  </span>
                  <a
                    href={`${net.explorer}/address/${address.trim()}`}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-auto font-mono text-[10px] text-cyan-bright underline-offset-2 hover:underline"
                  >
                    open in Basescan ↗
                  </a>
                </>
              )}
              {probe.status === 'empty' && (
                <span className="font-mono text-[11px] leading-5 text-rose">
                  ✗ no contract code at this address on {net.label} — wrong network, or the address never deployed there.
                </span>
              )}
              {probe.status === 'error' && (
                <span className="font-mono text-[11px] text-slate-500">
                  RPC unreachable right now — the probe will retry when you edit the address.
                </span>
              )}
            </div>
          )}

          {/* live run status */}
          {oc.active && oc.state && (
            <div className="tx-row flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-line/70 bg-ink px-4 py-3">
              <span className={`rounded-md border px-2.5 py-1 font-mono text-[10px] ${RUN_BADGE[runState].cls}`}>
                {RUN_BADGE[runState].label}
              </span>
              <span className="font-mono text-[11px] text-slate-400">
                entry fee <span className="text-mint">0 — free to play</span>
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
                    'start() — free, gas only'
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
