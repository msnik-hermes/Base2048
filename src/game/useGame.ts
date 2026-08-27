import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyMove,
  hasMoves,
  maxExp,
  newRun,
  randomHash,
  type Dir,
  type Snapshot,
  type Tile,
} from './logic';

export interface TxEntry {
  id: number;
  dir: Dir;
  gained: number;
  score: number;
  hash: string;
  gas: number;
  block: number;
}

export interface GameApi {
  tiles: Tile[];
  score: number;
  best: number;
  moves: number;
  over: boolean;
  won: boolean;
  keepPlaying: boolean;
  lastGain: { value: number; key: number } | null;
  txs: TxEntry[];
  nudgeKey: number;
  move: (dir: Dir) => void;
  restart: () => void;
  undo: () => void;
  continueAfterWin: () => void;
  canUndo: boolean;
}

const DIR_KEYS: Record<string, Dir> = {
  ArrowLeft: 0, KeyA: 0,
  ArrowRight: 1, KeyD: 1,
  ArrowUp: 2, KeyW: 2,
  ArrowDown: 3, KeyS: 3,
};

const BEST_KEY = 'base2048:best';
let txId = 1;

export function useGame(currentBlock: number): GameApi {
  const [tiles, setTiles] = useState<Tile[]>(() => newRun());
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  });
  const [moves, setMoves] = useState(0);
  const [over, setOver] = useState(false);
  const [won, setWon] = useState(false);
  const [keepPlaying, setKeepPlaying] = useState(false);
  const [lastGain, setLastGain] = useState<{ value: number; key: number } | null>(null);
  const [txs, setTxs] = useState<TxEntry[]>([]);
  const [nudgeKey, setNudgeKey] = useState(0);

  const undoRef = useRef<Snapshot | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const simBlock = useRef(24_610_000);
  const lockRef = useRef(false);

  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;

  const move = useCallback(
    (dir: Dir) => {
      if (over || (won && !keepPlaying) || lockRef.current) return;

      const res = applyMove(tilesRef.current, dir);
      if (!res.moved) {
        setNudgeKey((k) => k + 1);
        return;
      }
      lockRef.current = true;

      undoRef.current = { tiles: tilesRef.current, score, moves };
      setCanUndo(true);

      const newScore = score + res.gained;
      setScore(newScore);
      setMoves((m) => m + 1);
      if (newScore > best) {
        setBest(newScore);
        try { localStorage.setItem(BEST_KEY, String(newScore)); } catch { /* noop */ }
      }
      if (res.gained > 0) setLastGain({ value: res.gained, key: Date.now() });

      const block = currentBlock > 0 ? currentBlock : ++simBlock.current;
      setTxs((t) =>
        [
          {
            id: txId++,
            dir,
            gained: res.gained,
            score: newScore,
            hash: randomHash(32),
            gas: 27_400 + Math.floor(Math.random() * 18_600),
            block,
          },
          ...t,
        ].slice(0, 6),
      );

      if (!won && maxExp(res.tiles) >= 11) setWon(true); // 2^11 = 2048
      if (!hasMoves(res.tiles)) setOver(true);
      setTiles(res.tiles);

      window.setTimeout(() => (lockRef.current = false), 90);
    },
    [over, won, keepPlaying, score, best, moves, currentBlock],
  );

  const restart = useCallback(() => {
    setTiles(newRun());
    setScore(0);
    setMoves(0);
    setOver(false);
    setWon(false);
    setKeepPlaying(false);
    undoRef.current = null;
    setCanUndo(false);
  }, []);

  const undo = useCallback(() => {
    const snap = undoRef.current;
    if (!snap) return;
    setTiles(snap.tiles.map((t) => ({ ...t, isNew: false, merged: false })));
    setScore(snap.score);
    setMoves(snap.moves);
    setOver(false);
    undoRef.current = null;
    setCanUndo(false);
  }, []);

  const continueAfterWin = useCallback(() => setKeepPlaying(true), []);

  // کیبورد
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = DIR_KEYS[e.code];
      if (dir === undefined) return;
      e.preventDefault();
      move(dir);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  return {
    tiles, score, best, moves, over, won, keepPlaying,
    lastGain, txs, nudgeKey, move, restart, undo, continueAfterWin, canUndo,
  };
}
