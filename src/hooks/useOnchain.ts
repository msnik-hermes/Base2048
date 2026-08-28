import { useCallback, useEffect, useRef, useState } from 'react';
import type { Contract as ContractType } from 'ethers';
import type { Dir, Tile } from '../game/logic';
import type { NftReward, TxEntry } from '../game/useGame';

/** wei → ETH string without importing ethers at bundle level */
function formatEth(wei: bigint): string {
  const s = wei.toString().padStart(19, '0');
  const int = (s.slice(0, -18).replace(/^0+(?=\d)/, '') || '0');
  const frac = s.slice(-18).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

// ── supported networks ──────────────────────────────────────────
export type NetId = 'sepolia' | 'mainnet';

export const NETWORKS: Record<
  NetId,
  { label: string; chainHex: string; chainId: number; rpc: string; explorer: string }
> = {
  sepolia: {
    label: 'Base Sepolia',
    chainHex: '0x14a34',
    chainId: 84532,
    rpc: 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  },
  mainnet: {
    label: 'Base Mainnet',
    chainHex: '0x2105',
    chainId: 8453,
    rpc: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
  },
};

const ABI = [
  'function start()',
  'function move(uint8 dir)',
  'function gridOf(address) view returns (uint8[16])',
  'function scoreOf(address) view returns (uint40)',
  'function stateOf(address) view returns (uint8)',
  'function movesOf(address) view returns (uint32)',
  'function nftOf(address) view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
  'error NotActive()',
  'error InvalidDirection()',
  'error NoopMove()',
];

export interface OcState {
  runState: number; // 0 none · 1 active · 2 won · 3 over
  score: number;
  moves: number;
  nftId: number;
}

export type OcApi = ReturnType<typeof useOnchain>;

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
let ocTxId = 1;

function revertName(c: ContractType, e: unknown): string {
  const err = e as { data?: string; shortMessage?: string; reason?: string; message?: string };
  try {
    if (typeof err?.data === 'string') {
      const parsed = c.interface.parseError(err.data);
      if (parsed) return parsed.name;
    }
  } catch {
    /* fall through */
  }
  const m = String(err?.shortMessage ?? err?.reason ?? err?.message ?? '');
  const found = m.match(/\b(NoopMove|NotActive|InvalidDirection|FeeTooLow)\b/);
  if (found) return found[1];
  return m.slice(0, 110) || 'unknown revert';
}

export function useOnchain(netId: NetId, contractAddress: string) {
  const net = NETWORKS[netId];
  const eth = typeof window !== 'undefined' ? ((window as unknown as { ethereum?: any }).ethereum as any) : undefined;

  const [account, setAccount] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [notice, setNotice] = useState('');
  const [state, setState] = useState<OcState | null>(null);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [pending, setPending] = useState<null | 'start' | 'move'>(null);
  const [txs, setTxs] = useState<TxEntry[]>([]);
  const [nftImage, setNftImage] = useState<string | null>(null);
  const [nftReward, setNftReward] = useState<NftReward | null>(null);
  const [nudgeKey, setNudgeKey] = useState(0);

  const validAddress = ADDR_RE.test(contractAddress.trim());
  const active = Boolean(account && validAddress && state);

  const readRef = useRef<ContractType | null>(null);
  const writeRef = useRef<ContractType | null>(null);
  const accountRef = useRef(account);
  accountRef.current = account;
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevGridRef = useRef<number[] | null>(null);
  const prevNftRef = useRef(-1); // -1 = first load, don't treat as a fresh mint
  const nftImageRef = useRef(false);
  const pendingRef = useRef(false);

  // ── wallet connect + chain switch ─────────────────────────────
  const connect = useCallback(async () => {
    setNotice('');
    if (!eth) {
      setNotice('No injected wallet found — install MetaMask or open this page in a wallet browser.');
      return;
    }
    if (!validAddress) {
      setNotice('Paste the deployed contract address first (0x… — copy it from Remix “Deployed Contracts”).');
      return;
    }
    setConnecting(true);
    try {
      const accounts: string[] = await eth.request({ method: 'eth_requestAccounts' });
      try {
        await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: net.chainHex }] });
      } catch (e: any) {
        if (e?.code === 4902 || e?.data?.originalError?.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: net.chainHex,
                chainName: net.label,
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: [net.rpc],
                blockExplorerUrls: [net.explorer],
              },
            ],
          });
        } else {
          throw e;
        }
      }
      setAccount(accounts?.[0] ?? null);
    } catch (e: any) {
      setNotice(
        e?.code === 4001
          ? 'Connection request rejected in the wallet.'
          : 'Could not connect: ' + String(e?.message ?? e),
      );
    } finally {
      setConnecting(false);
    }
  }, [eth, net, validAddress]);

  // ── read the full run state from the contract ─────────────────
  const refresh = useCallback(async () => {
    const c = readRef.current;
    const me = accountRef.current;
    if (!c || !me) return;
    try {
      const [grid, score, st, mv, nft] = await Promise.all([
        c.gridOf(me) as Promise<bigint[]>,
        c.scoreOf(me) as Promise<bigint>,
        c.stateOf(me) as Promise<bigint>,
        c.movesOf(me) as Promise<bigint>,
        c.nftOf(me) as Promise<bigint>,
      ]);

      const g = grid.map(Number);
      const nftId = Number(nft);
      setState({
        runState: Number(st),
        score: Number(score),
        moves: Number(mv),
        nftId,
      });

      // board → tiles, diffing against the previous grid for animations
      const prev = prevGridRef.current;
      const next: Tile[] = [];
      g.forEach((e, i) => {
        if (e > 0) {
          next.push({
            id: i,
            r: Math.floor(i / 4),
            c: i % 4,
            exp: e,
            isNew: prev ? prev[i] === 0 : false,
            merged: prev ? e > prev[i] && prev[i] > 0 : false,
          });
        }
      });
      prevGridRef.current = g;
      setTiles(next);

      // fresh mint detected → drive the confetti + banner on the board
      if (prevNftRef.current === 0 && nftId > 0) {
        const lastMint = txsRef.current.find((t) => t.kind === 'move');
        setNftReward({
          tokenId: nftId,
          score: Number(score),
          hash: lastMint?.hash ?? '',
          block: lastMint?.block ?? 0,
          mintKey: Date.now(),
        });
      }
      prevNftRef.current = nftId;

      // render the real on-chain SVG once
      if (nftId > 0 && !nftImageRef.current) {
        nftImageRef.current = true;
        try {
          const uri = (await c.tokenURI(nftId)) as string;
          const meta = JSON.parse(atob(uri.split(',')[1]));
          if (typeof meta.image === 'string' && meta.image.startsWith('data:')) setNftImage(meta.image);
        } catch {
          /* metadata fetch is best-effort */
        }
      }
    } catch {
      /* transient RPC errors are fine — next poll retries */
    }
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const txsRef = useRef<TxEntry[]>([]);
  txsRef.current = txs;

  // ── build contracts when the connection changes ───────────────
  useEffect(() => {
    readRef.current = null;
    writeRef.current = null;
    setState(null);
    prevGridRef.current = null;
    prevNftRef.current = -1;
    nftImageRef.current = false;
    setNftImage(null);
    setNftReward(null);
    if (!eth || !account || !validAddress) return;
    const addr = contractAddress.trim();
    let cancelled = false;
    // ethers is loaded lazily — only when someone actually goes on-chain
    import('ethers').then(({ BrowserProvider, Contract }) => {
      if (cancelled) return;
      const provider = new BrowserProvider(eth);
      readRef.current = new Contract(addr, ABI, provider);
      provider
        .getSigner()
        .then((s) => {
          if (!cancelled) writeRef.current = new Contract(addr, ABI, s);
        })
        .catch(() => {});
      refreshRef.current();
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [eth, account, contractAddress, netId, validAddress]);

  // ── gentle poll so run state stays live ───────────────────────
  useEffect(() => {
    if (!account || !validAddress) return;
    const id = window.setInterval(() => {
      if (!pendingRef.current) refreshRef.current();
    }, 4000);
    return () => window.clearInterval(id);
  }, [account, validAddress]);

  // ── wallet events ─────────────────────────────────────────────
  useEffect(() => {
    if (!eth) return;
    if (eth.selectedAddress) setAccount(eth.selectedAddress);
    const onAcc = (a: string[]) => setAccount(a?.[0] ?? null);
    const onChain = (hex: string) => {
      if (hex !== net.chainHex)
        setNotice(`Wallet switched to chain ${parseInt(hex, 16)} — this contract lives on ${net.label}.`);
    };
    eth.on?.('accountsChanged', onAcc);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAcc);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [eth, net]);

  // ── send a real move(dir) transaction ─────────────────────────
  const play = useCallback(
    async (dir: Dir) => {
      const w = writeRef.current;
      if (!w || pendingRef.current) return;
      setNotice('');
      // dry-run first so reverts surface without spending gas
      try {
        await w.move.staticCall(dir);
      } catch (e) {
        const name = revertName(w, e);
        if (name === 'NoopMove') {
          setNudgeKey((k) => k + 1);
          setNotice('NoopMove() — that slide changes nothing, so the contract would revert. No transaction was sent, no gas spent.');
        } else if (name === 'NotActive') {
          setNotice('Run is not active — hit start() to begin a new run.');
        } else {
          setNotice('Contract reverted: ' + name);
        }
        return;
      }
      pendingRef.current = true;
      setPending('move');
      const before = stateRef.current?.score ?? 0;
      try {
        const tx = await w.move(dir);
        const r = await tx.wait();
        await refreshRef.current();
        const after = stateRef.current?.score ?? 0;
        setTxs((t) =>
          [
            {
              id: ocTxId++,
              kind: 'move' as const,
              dir,
              gained: Math.max(0, after - before),
              score: after,
              hash: r.hash,
              gas: r.gasUsed.toString(),
              block: r.blockNumber,
            },
            ...t,
          ].slice(0, 6),
        );
      } catch (e: any) {
        setNotice(e?.code === 'ACTION_REJECTED' ? 'Transaction rejected in the wallet.' : 'move() failed: ' + String(e?.shortMessage ?? e?.message ?? e));
      } finally {
        pendingRef.current = false;
        setPending(null);
      }
    },
    [],
  );

  // ── send a real start() transaction (free — gas only) ─────────
  const startRun = useCallback(async () => {
    const w = writeRef.current;
    if (!w || pendingRef.current) return;
    setNotice('');
    pendingRef.current = true;
    setPending('start');
    try {
      const tx = await w.start();
      const r = await tx.wait();
      prevGridRef.current = null; // fresh board → full spawn animation
      await refreshRef.current();
      setTxs((t) =>
        [
          {
            id: ocTxId++,
            kind: 'start' as const,
            label: 'start()',
            gained: 0,
            score: 0,
            hash: r.hash,
            gas: r.gasUsed.toString(),
            block: r.blockNumber,
          },
          ...t,
        ].slice(0, 6),
      );
    } catch (e: any) {
      setNotice(
        e?.code === 'ACTION_REJECTED'
          ? 'Transaction rejected in the wallet.'
          : 'start() failed: ' + String(e?.shortMessage ?? e?.message ?? e),
      );
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }, []);

  return {
    net,
    hasWallet: Boolean(eth),
    account,
    connecting,
    notice,
    validAddress,
    active,
    state,
    tiles,
    pending,
    txs,
    nftImage,
    nftReward,
    nudgeKey,
    connect,
    play,
    startRun,
  };
}
