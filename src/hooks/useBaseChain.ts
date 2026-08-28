import { useEffect, useState } from 'react';

export interface ChainState {
  block: number;
  gwei: number;
  live: boolean;
}

const RPC = 'https://mainnet.base.org';

async function rpc(method: string, params: unknown[] = []): Promise<any> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
    });
    const json = await res.json();
    if (!json.result) throw new Error('no result');
    return json.result;
  } finally {
    window.clearTimeout(t);
  }
}

/** Polls Base mainnet for the latest block + gas price. */
export function useBaseChain(): ChainState {
  const [state, setState] = useState<ChainState>({ block: 0, gwei: 0.0042, live: false });

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const [block, gas] = await Promise.all([rpc('eth_blockNumber'), rpc('eth_gasPrice')]);
        if (!alive) return;
        setState({
          block: parseInt(block, 16),
          gwei: Math.max(0.001, Math.round((parseInt(gas, 16) / 1e9) * 1000) / 1000),
          live: true,
        });
      } catch {
        if (alive) setState((s) => ({ ...s, live: false }));
      }
    }
    tick();
    const id = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return state;
}

export function fmtNum(n: number | string): string {
  const v = typeof n === 'string' ? parseFloat(n) : n;
  if (Number.isNaN(v)) return String(n);
  return v.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function fmtInt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

export function shortAddr(a: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}
