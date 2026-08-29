import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyMove,
  boardsEqual,
  hasMoves,
  maxExp,
  newGame,
  nibbleGrid,
  randomHash,
  spawnTile,
  toTiles,
  type Dir,
  type Nibbles,
  type Tile,
} from './logic';

export interface TxEntry {
  id: number;
  kind: 'move' | 'nft' | 'start';
  dir?: Dir;
  label?: string;
  gained: number;
  score: number;
  hash: string;
  gas: number | string;
  block: number;
  tokenId?: number;
}

export interface NftReward {
  tokenId: number;
  score: number;
  hash: string;
  block: number;
  mintKey: number;
  /** true when this reward is the local demo simulation — no on-chain transaction happened */
  simulated: boolean;
}

const BEST_KEY = 'base2048:best';
const NFT_KEY = 'base2048:nftCount';
const NFT_THRESHOLD = 4096;
const WIN_EXP = 11;

let txSeq = 1;
let tokenSeq = 1;

function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

/**
 * Local, deterministic-feeling simulation of the on-chain engine.
 * Every move is logged like a transaction; crossing 4096 "mints" the trophy.
 */
export function useGame(currentBlock: number, enabled: boolean) {
  const [board, setBoard] = useState<Nibbles>(() => newGame());
  const [tiles, setTiles] = useState<Tile[]>(() => toTiles(newGame()));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => readNum(BEST_KEY));
  const [moves, setMoves] = useState(0);
  const [txs, setTxs] = useState<TxEntry[]>([]);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [over, setOver] = useState(false);
  const [nft, setNft] = useState<NftReward | null>(null);
  const [nftLifetime, setNftLifetime] = useState(() => readNum(NFT_KEY));
  const [nudgeKey, setNudgeKey] = useState(0);
  const [lastGain, setLastGain] = useState<{ value: number; key: number } | null>(null);

  const history = useRef<{ board: Nibbles; score: number; moves: number }[]>([]);
  const lockRef = useRef(false);
  const mintedRef = useRef(false);
  const blockRef = useRef(currentBlock);
  blockRef.current = currentBlock;

  // keep the rendered tiles in sync with the board
  useEffect(() => {
    setTiles(toTiles(board));
  }, [board]);

  const pushTx = useCallback((tx: Omit<TxEntry, 'id' | 'block'>) => {
    setTxs((t) => [{ ...tx, id: txSeq++, block: blockRef.current || 24_610_000 }, ...t].slice(0, 6));
  }, []);

  const move = useCallback(
    (dir: Dir) => {
      if (!enabled || over || (won && !keepPlaying) || lockRef.current) return;

      const { board: slid, gained } = applyMove(board, dir);
      if (boardsEqual(slid, board)) {
        setNudgeKey((k) => k + 1); // NoopMove() — the contract would revert
        return;
      }

      lockRef.current = true;
      history.current.push({ board, score, moves });

      const spawned = spawnTile(slid);
      const newScore = score + gained;

      setBoard(spawned);
      setScore(newScore);
      setMoves((m) => m + 1);
      if (gained > 0) setLastGain({ value: gained, key: Date.now() });
      if (newScore > best) {
        setBest(newScore);
        try { localStorage.setItem(BEST_KEY, String(newScore)); } catch { /* private mode */ }
      }

      pushTx({ kind: 'move', dir, gained, score: newScore, hash: randomHash(32), gas: 33_000 + Math.floor(Math.random() * 4000) });

      // Trophy mint — first time the score crosses 4096
      let nftReward: NftReward | null = null;
      if (!mintedRef.current && newScore >= NFT_THRESHOLD) {
        mintedRef.current = true;
        const tokenId = 1023 + tokenSeq++;
        const hash = randomHash(32);
        nftReward = { tokenId, score: newScore, hash, block: blockRef.current || 24_610_000, mintKey: Date.now(), simulated: true };
        setNft(nftReward);
        setNftLifetime((n) => {
          const next = n + 1;
          try { localStorage.setItem(NFT_KEY, String(next)); } catch { /* private mode */ }
          return next;
        });
        pushTx({ kind: 'nft', dir, gained: 0, score: newScore, hash, gas: 118_000, tokenId });
      }

      if (maxExp(toTiles(spawned)) >= WIN_EXP && !won) {
        setWon(true);
      } else if (!hasMoves(spawned)) {
        setOver(true);
      }

      window.setTimeout(() => { lockRef.current = false; }, 130);
    },
    [enabled, over, won, keepPlaying, board, score, moves, best, pushTx],
  );

  const restart = useCallback(() => {
    history.current = [];
    mintedRef.current = false;
    const b = newGame();
    setBoard(b);
    setScore(0);
    setMoves(0);
    setWon(false);
    setKeepPlaying(false);
    setOver(false);
    setNft(null);
    setTxs([]);
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (!prev) return;
    setBoard(prev.board);
    setScore(prev.score);
    setMoves(prev.moves);
    setOver(false);
  }, []);

  const continueAfterWin = useCallback(() => setKeepPlaying(true), []);

  return {
    tiles,
    score,
    best,
    moves,
    txs,
    won,
    over,
    keepPlaying,
    nft,
    nftLifetime,
    nudgeKey,
    lastGain,
    canUndo: history.current.length > 0,
    move,
    restart,
    undo,
    continueAfterWin,
    boardNibbles: nibbleGrid(tiles),
  };
}
