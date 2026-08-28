import { useEffect, useRef, useState } from 'react';
import { NETWORKS, type NetId, type OcApi } from '../hooks/useOnchain';
import { fmtInt, shortAddr } from '../hooks/useBaseChain';

const RUN_BADGE: Record<number, { label: string; cls: string }> = {
  0: { label: 'No run yet', cls: 'bg-slate-500/15 text-slate-400 border-line' },
  1: { label: 'Run active', cls: 'bg-mint/15 text-mint border-mint/40' },
  2: { label: 'Run won · 2048', cls: 'bg-gold/15 text-gold border-gold/40' },
  3: { label: 'Game over', cls: 'bg-rose/15 text-rose border-rose/40' },
  4: { label: 'Awaiting Chainlink VRF…', cls: 'bg-amber/15 text-amber border-amber/40' },
};

export const KNOWN_DEPLOYMENTS: { label: string; address: string; net: NetId }[] = [
  { label: 'Base2048 — live on Base Mainnet', address: '0x629d0d9acb660afb0daf4d0c740e287473701570', net: 'mainnet' },
];

/** Probes the address with eth_getCode to confirm a contract really lives there. */
function useProbe(netId: NetId, address: string) {
  const [probe, setProbe] = useState<null | { ok: boolean; sizeKb?: number }>(null);
  const [checking, setChecking] = useState(false);
  const last = useRef('');

  useEffect(() => {
    const trimmed = address.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
      setProbe(null);
      return;
    }
    const key = `${netId}:${trimmed}`;
    if (key === last.current) return;
    last.current = key;
    setChecking(true);
    const ctrl = new AbortController();
    fetch(NETWORKS[netId].rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getCode', params: [trimmed, 'latest'] }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((j) => {
        const code = String(j.result ?? '0x');
        setProbe(code && code !== '0x' ? { ok: true, sizeKb: Math.round(((code.length - 2) / 2) / 102.4) / 10 } : { ok: false });
      })
      .catch(() => setProbe({ ok: false }))
      .finally(() => setChecking(false));
    return () => ctrl.abort();
  }, [netId, address]);

  return { probe, checking };
}

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
  const { probe, checking } = useProbe(netId, address);
  const runState = oc.state?.runState ?? 0;
  const badge = RUN_BADGE[runState] ?? RUN_BADGE[0];

  return (
    <div className="mb-8 overflow-hidden rounded-2xl border border-base/30 bg-panel shadow-[0_0_50px_rgba(0,82,255,0.1)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-line/70 bg-base/[0.06] px-5 py-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-base/20 text-base-bright">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="font-display text-sm text-white">On-chain mode</p>
        <span className="font-mono text-[11px] text-slate-500">play your deployed contract with real transactions</span>
        {KNOWN_DEPLOYMENTS.map((d) => (
          <button
            key={d.address}
            onClick={() => {
              onAddress(d.address);
              onNet(d.net);
            }}
            className="ml-auto rounded-md border border-gold/40 bg-gold/10 px-2.5 py-1 font-mono text-[10px] text-gold transition-all hover:bg-gold/20 active:scale-95"
          >
            ★ {d.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center">
        {/* network */}
        <div className="flex rounded-lg border border-line bg-ink p-1">
          {(['sepolia', 'mainnet'] as NetId[]).map((n) => (
            <button
              key={n}
              onClick={() => onNet(n)}
              className={`rounded-md px-3.5 py-1.5 font-mono text-[11px] transition-all ${
                netId === n ? 'bg-base text-white shadow-[0_2px_12px_rgba(0,82,255,0.4)]' : 'text-slate-400 hover:text-white'
              }`}
            >
              {NETWORKS[n].label}
            </button>
          ))}
        </div>

        {/* address */}
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-line bg-ink px-3 py-2 focus-within:border-base">
          <span className="font-mono text-[11px] text-slate-600">contract</span>
          <input
            value={address}
            onChange={(e) => onAddress(e.target.value)}
            placeholder="0x… paste your deployed Onchain2048 address"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-[12px] text-slate-200 placeholder:text-slate-600 focus:outline-none"
          />
          {checking && <span className="spinner h-3.5 w-3.5 rounded-full border-2 border-base-bright border-t-transparent" />}
          {probe && !checking && (
            probe.ok ? (
              <span className="flex items-center gap-1.5 rounded-md bg-mint/15 px-2 py-1 font-mono text-[10px] text-mint">
                <span className="h-1.5 w-1.5 rounded-full bg-mint pulse-dot" />
                LIVE on {NETWORKS[netId].label}{probe.sizeKb ? ` · ${probe.sizeKb} KB` : ''}
              </span>
            ) : (
              <span className="rounded-md bg-rose/15 px-2 py-1 font-mono text-[10px] text-rose">✗ no contract code</span>
            )
          )}
        </div>

        {/* connect / account */}
        {oc.account ? (
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg border border-mint/40 bg-mint/10 px-3 py-2 font-mono text-[11px] text-mint">
              {shortAddr(oc.account)}
            </span>
            {oc.state && (
              <span className={`rounded-lg border px-3 py-2 font-mono text-[11px] ${badge.cls}`}>{badge.label}</span>
            )}
            {oc.stuck && (
              <button
                onClick={oc.cancelPending}
                disabled={oc.pending !== null}
                className="rounded-lg border border-rose/50 bg-rose/15 px-4 py-2 font-display text-xs text-rose transition-all hover:bg-rose/25 active:scale-95 disabled:opacity-40"
              >
                {oc.pending === 'start' ? 'cancelling…' : 'Cancel stuck run'}
              </button>
            )}
            {oc.state && runState !== 1 && runState !== 4 && (
              <button
                onClick={oc.startRun}
                disabled={oc.pending !== null}
                className="rounded-lg bg-amber px-4 py-2 font-display text-xs text-[#3a2400] transition-all hover:brightness-110 active:scale-95 disabled:opacity-40"
              >
                {oc.pending === 'start' ? 'starting…' : runState === 0 ? 'start() — free, gas only' : 'start() — new run'}
              </button>
            )}
            {oc.state && runState === 1 && (
              <span className="rounded-lg border border-line px-3 py-2 font-mono text-[11px] text-slate-400">
                score {fmtInt(oc.state.score)}
              </span>
            )}
          </div>
        ) : (
          <button
            onClick={oc.connect}
            disabled={oc.connecting}
            className="rounded-lg bg-base px-5 py-2.5 font-display text-sm text-white shadow-[0_4px_20px_rgba(0,82,255,0.4)] transition-all hover:bg-base-hi active:scale-95 disabled:opacity-60"
          >
            {oc.connecting ? 'Connecting…' : oc.hasWallet ? 'Connect wallet' : 'No wallet detected'}
          </button>
        )}
      </div>

      {oc.notice && (
        <p className="border-t border-line/60 bg-amber/[0.05] px-5 py-2.5 font-mono text-[11px] leading-5 text-amber">
          {oc.notice}
        </p>
      )}
    </div>
  );
}
