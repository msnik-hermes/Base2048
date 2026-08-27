import { useEffect, useState } from 'react';

export interface ChainState {
  block: number;
  gwei: number;
  live: boolean;
}

const RPC = 'https://mainnet.base.org';

async function rpcCall(method: string, params: unknown[] = []): Promise<string> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
    });
    const json = (await res.json()) as { result?: string };
    if (!json.result) throw new Error('no result');
    return json.result;
  } finally {
    window.clearTimeout(timer);
  }
}

/** Reads Base block height + gas price live; falls back to simulation if the RPC is unreachable */
export function useBaseChain(): ChainState {
  const [state, setState] = useState<ChainState>({ block: 0, gwei: 0.0042, live: false });

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const [blockHex, gasHex] = await Promise.all([
          rpcCall('eth_blockNumber'),
          rpcCall('eth_gasPrice'),
        ]);
        if (!alive) return;
        setState({
          block: parseInt(blockHex, 16),
          gwei: Math.max(0.001, Math.round((parseInt(gasHex, 16) / 1e9) * 1000) / 1000),
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

/** Locale-formatted numbers (en-US) */
export function fmtNum(n: number | string): string {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

export function fmtInt(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}
