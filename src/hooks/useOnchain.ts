import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dir, Tile } from '../game/logic';
import type { NftReward, TxEntry } from '../game/useGame';

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
  'function awaitingMove(address) view returns (bool)',
  'function nftOf(address) view returns (uint256)',
  'function tokenURI(uint256) view returns (string)',
  'function cancelPending()',
  'function pendingSinceOf(address) view returns (uint256)',
  'function pendingBlocksLeft(address) view returns (uint256)',
  'error NotActive()',
  'error InvalidDirection()',
  'error NoopMove()',
  'error RunBusy()',
  'error PendingRandomness()',
  'error NotPending()',
  'error TooSoon()',
  // Errors the Chainlink VRF coordinator can throw back through our
  // requestRandomWords() call — decoded so the UI explains them.
  'error InvalidSubscription()',
  'error InsufficientBalance(uint256)',
  'error MustBeSubOwner(address)',
  'error TooManyConsumers()',
  'error InvalidConsumer(uint256,address)',
  'error InsufficientGasForConsumer()',
  'error InvalidCalldata()',
  'error GasLimitTooBig(uint32,uint32)',
  'error PendingRequestExists()',
  'error InvalidRandomWords()',
];

export interface OcState {
  runState: number; // 0 none · 1 active · 2 won · 3 over · 4 pending (awaiting VRF)
  score: number;
  moves: number;
  nftId: number;
  awaiting: boolean;
  pendingBlocksLeft: number; // 0 = none pending, or the timeout has elapsed → cancelPending() available
}

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
let ocTxId = 1;

function formatEth(wei: bigint): string {
  const s = (Number(wei) / 1e18).toFixed(6);
  return s.replace(/\.?0+$/, '');
}

function revertName(c: any, e: any): string {
  try {
    if (typeof e?.data === 'string') {
      const parsed = c.interface.parseError(e.data);
      if (parsed) return parsed.name;
    }
  } catch { /* fall through */ }
  const m = String(e?.shortMessage ?? e?.reason ?? e?.message ?? '');
  const found = m.match(
    /\b(NoopMove|NotActive|InvalidDirection|RunBusy|PendingRandomness|NotPending|TooSoon|InvalidSubscription|InsufficientBalance|MustBeSubOwner|TooManyConsumers|InvalidConsumer|InsufficientGasForConsumer|InvalidCalldata|GasLimitTooBig|PendingRequestExists|InvalidRandomWords)\b/,
  );
  if (found) return found[1];
  return m.slice(0, 110) || 'unknown revert';
}

/** Turn a decoded VRF error into an actionable hint. */
function vrfHint(name: string): string | null {
  switch (name) {
    case 'InvalidSubscription':
    case 'InvalidConsumer':
      return 'InvalidSubscription/InvalidConsumer — the deployed game address is not registered on that VRF subscription. On vrf.chain.link open your subscription → “Add consumer” → paste the game contract address.';
    case 'InsufficientBalance':
      return 'InsufficientBalance — the VRF subscription has no LINK left. Fund it on vrf.chain.link (test LINK: faucets.chain.link).';
    case 'MustBeSubOwner':
      return 'MustBeSubOwner — only the subscription owner can perform that action. Use the wallet that created the subscription.';
    case 'TooManyConsumers':
      return 'TooManyConsumers — the subscription already has 100 consumers. Remove an unused one first.';
    case 'InsufficientGasForConsumer':
    case 'GasLimitTooBig':
      return 'The callback gas limit is too high for the subscription. Lower callbackGasLimit in the contract constructor.';
    case 'InvalidCalldata':
    case 'InvalidRandomWords':
      return 'The coordinator rejected the request payload. Double-check coordinator address and key hash for this network.';
    case 'PendingRequestExists':
      return 'PendingRequestExists — a randomness request is already in flight. Wait for it to fulfil before starting again.';
    case 'NotPending':
      return 'NotPending — there is no in-flight request to cancel.';
    case 'TooSoon':
      return 'TooSoon — the pending request is still within the timeout window. Wait for the countdown, then cancel.';
    default:
      return null;
  }
}

/** Connects a wallet to a deployed Onchain2048 and plays it for real. */
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
  const [hasEscape, setHasEscape] = useState(false); // deployed contract has cancelPending()

  const validAddress = ADDR_RE.test(contractAddress.trim());
  const active = Boolean(account && validAddress && state);

  const readRef = useRef<any>(null);
  const writeRef = useRef<any>(null);
  const accountRef = useRef(account);
  accountRef.current = account;
  const stateRef = useRef(state);
  stateRef.current = state;
  const prevGridRef = useRef<number[] | null>(null);
  const prevNftRef = useRef(-1);
  const nftImageRef = useRef(false);
  const pendingRef = useRef(false);
  const hasEscapeRef = useRef(false);
  const txsRef = useRef<TxEntry[]>([]);
  txsRef.current = txs;

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
      setNotice(e?.code === 4001 ? 'Connection request rejected in the wallet.' : 'Could not connect: ' + String(e?.message ?? e));
    } finally {
      setConnecting(false);
    }
  }, [eth, net, validAddress]);

  const refresh = useCallback(async () => {
    const c = readRef.current;
    const me = accountRef.current;
    if (!c || !me) return null;
    try {
      const [grid, score, st, mv, nft, awaiting] = await Promise.all([
        c.gridOf(me) as Promise<bigint[]>,
        c.scoreOf(me) as Promise<bigint>,
        c.stateOf(me) as Promise<bigint>,
        c.movesOf(me) as Promise<bigint>,
        c.nftOf(me) as Promise<bigint>,
        c.awaitingMove(me) as Promise<boolean>,
      ]);

      const g = grid.map(Number);
      const nftId = Number(nft);
      let pendingBlocksLeft = 0;
      if (hasEscapeRef.current) {
        try { pendingBlocksLeft = Number(await c.pendingBlocksLeft(me)); } catch { /* older deployment */ }
      }
      const fresh: OcState = { runState: Number(st), score: Number(score), moves: Number(mv), nftId, awaiting, pendingBlocksLeft };
      setState(fresh);

      const prev = prevGridRef.current;
      let seq = 1;
      const next: Tile[] = g.map((e, i) => {
        if (e > 0) {
          return {
            id: i * 1000 + (seq++),
            r: Math.floor(i / 4),
            c: i % 4,
            exp: e,
            isNew: prev ? prev[i] === 0 : true,
            merged: prev ? e > prev[i] && prev[i] > 0 : false,
          } as Tile;
        }
        return null;
      }).filter(Boolean) as Tile[];
      prevGridRef.current = g;
      setTiles(next);

      if (prevNftRef.current === 0 && nftId > 0) {
        const lastMint = txsRef.current.find((t) => t.kind === 'move');
        setNftReward({
          tokenId: nftId,
          score: Number(score),
          hash: lastMint?.hash ?? '',
          block: lastMint?.block ?? 0,
          mintKey: Date.now(),
          simulated: false,
        });
        // The trophy is minted by the VRF coordinator's fulfilment tx (not by the
        // player's wallet), so surface it in the tx log — otherwise it looks like
        // no mint transaction ever happened.
        setTxs((t) => [
          {
            id: ocTxId++,
            kind: 'nft' as const,
            gained: 0,
            score: Number(score),
            hash: lastMint?.hash ?? '',
            gas: lastMint?.gas ?? 0,
            block: lastMint?.block ?? 0,
            tokenId: nftId,
          },
          ...t,
        ].slice(0, 6));
      }
      prevNftRef.current = nftId;

      if (nftId > 0 && !nftImageRef.current) {
        nftImageRef.current = true;
        try {
          const uri = (await c.tokenURI(nftId)) as string;
          const meta = JSON.parse(atob(uri.split(',')[1]));
          if (typeof meta.image === 'string' && meta.image.startsWith('data:')) setNftImage(meta.image);
        } catch { /* best-effort */ }
      }
      return fresh;
    } catch { return null; }
  }, []);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    readRef.current = null;
    writeRef.current = null;
    setState(null);
    prevGridRef.current = null;
    prevNftRef.current = -1;
    nftImageRef.current = false;
    hasEscapeRef.current = false;
    setHasEscape(false);
    setNftImage(null);
    setNftReward(null);
    if (!eth || !account || !validAddress) return;
    const addr = contractAddress.trim();
    let cancelled = false;
    import('ethers').then(({ BrowserProvider, Contract }) => {
      if (cancelled) return;
      const provider = new BrowserProvider(eth);
      readRef.current = new Contract(addr, ABI, provider);
      const hasCancel = readRef.current.interface.fragments.some((f: { name: string }) => f.name === 'cancelPending');
      hasEscapeRef.current = hasCancel;
      setHasEscape(hasCancel);
      provider.getSigner().then((s: any) => {
        if (!cancelled) writeRef.current = new Contract(addr, ABI, s);
      }).catch(() => {});
      refreshRef.current();
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [eth, account, contractAddress, netId, validAddress]);

  useEffect(() => {
    if (!account || !validAddress) return;
    const id = window.setInterval(() => {
      if (!pendingRef.current) refreshRef.current();
    }, 3000);
    return () => window.clearInterval(id);
  }, [account, validAddress]);

  useEffect(() => {
    if (!eth) return;
    if (eth.selectedAddress) setAccount(eth.selectedAddress);
    const onAcc = (a: string[]) => setAccount(a?.[0] ?? null);
    const onChain = (hex: string) => {
      if (hex !== net.chainHex) setNotice(`Wallet switched to chain ${parseInt(hex, 16)} — this contract lives on ${net.label}.`);
    };
    eth.on?.('accountsChanged', onAcc);
    eth.on?.('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAcc);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [eth, net]);

  const play = useCallback(async (dir: Dir) => {
    const w = writeRef.current;
    if (!w || pendingRef.current) return;
    setNotice('');
    try {
      await w.move.staticCall(dir);
    } catch (e) {
      const name = revertName(w, e);
      if (name === 'NoopMove') {
        setNudgeKey((k) => k + 1);
        setNotice('NoopMove() — that slide changes nothing, so the contract reverts. No tx sent, no gas or LINK spent.');
      } else if (name === 'PendingRandomness') {
        setNotice('PendingRandomness() — the previous tile is still on its way from Chainlink. Give it a couple of seconds.');
      } else if (name === 'NotActive') {
        setNotice('Run is not active — hit start() to begin a new run.');
      } else {
        setNotice(vrfHint(name) ?? 'Contract reverted: ' + name);
      }
      return;
    }
    pendingRef.current = true;
    setPending('move');
    const before = stateRef.current?.score ?? 0;
    try {
      const tx = await w.move(dir);
      const r = await tx.wait();
      const fresh = await refreshRef.current();
      const after = fresh?.score ?? before;
      setTxs((t) => [{ id: ocTxId++, kind: 'move' as const, dir, gained: Math.max(0, after - before), score: after, hash: r.hash, gas: r.gasUsed.toString(), block: r.blockNumber }, ...t].slice(0, 6));
    } catch (e: any) {
      if (e?.code === 'ACTION_REJECTED') {
        setNotice('Transaction rejected in the wallet.');
      } else {
        const hint = vrfHint(revertName(w, e));
        setNotice(hint ?? 'move() failed: ' + String(e?.shortMessage ?? e?.message ?? e));
      }
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }, []);

  const startRun = useCallback(async () => {
    const w = writeRef.current;
    if (!w || pendingRef.current) return;
    setNotice('');
    pendingRef.current = true;
    setPending('start');
    try {
      const tx = await w.start();
      const r = await tx.wait();
      prevGridRef.current = null;
      await refreshRef.current();
      setTxs((t) => [{ id: ocTxId++, kind: 'start' as const, label: 'start()', gained: 0, score: 0, hash: r.hash, gas: r.gasUsed.toString(), block: r.blockNumber }, ...t].slice(0, 6));
    } catch (e: any) {
      if (e?.code === 'ACTION_REJECTED') {
        setNotice('Transaction rejected in the wallet.');
      } else {
        const hint = vrfHint(revertName(w, e));
        setNotice(hint ?? 'start() failed: ' + String(e?.shortMessage ?? e?.message ?? e));
      }
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }, []);

  const cancelPending = useCallback(async () => {
    const w = writeRef.current;
    if (!w || pendingRef.current) return;
    setNotice('');
    pendingRef.current = true;
    setPending('start');
    try {
      const tx = await w.cancelPending();
      const r = await tx.wait();
      prevGridRef.current = null;
      await refreshRef.current();
      setTxs((t) => [{ id: ocTxId++, kind: 'start' as const, label: 'cancelPending()', gained: 0, score: 0, hash: r.hash, gas: r.gasUsed.toString(), block: r.blockNumber }, ...t].slice(0, 6));
      setNotice('Stuck request cancelled — start() a fresh run.');
    } catch (e: any) {
      if (e?.code === 'ACTION_REJECTED') {
        setNotice('Transaction rejected in the wallet.');
      } else {
        const hint = vrfHint(revertName(w, e));
        setNotice(hint ?? 'cancelPending() failed: ' + String(e?.shortMessage ?? e?.message ?? e));
      }
    } finally {
      pendingRef.current = false;
      setPending(null);
    }
  }, []);

  // A request has been pending past the timeout and can be cancelled.
  const stuck = Boolean(
    active &&
    hasEscape &&
    state &&
    (state.awaiting || state.runState === 4) &&
    state.pendingBlocksLeft === 0,
  );

  return {
    net,
    hasWallet: Boolean(eth),
    account,
    connecting,
    notice,
    validAddress,
    active,
    hasEscape,
    stuck,
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
    cancelPending,
  };
}

export type { Tile };
export { formatEth };
export type OcApi = ReturnType<typeof useOnchain>;
