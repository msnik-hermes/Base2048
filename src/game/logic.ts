// ═══════════════════════════════════════════════════════════════
//  2048 engine — a full mirror of Onchain2048.sol
//  Same nibble algorithm: every tile stores a power of two, so the
//  board can be packed into a single uint64.
//  dir: 0=left 1=right 2=up 3=down
// ═══════════════════════════════════════════════════════════════

export type Dir = 0 | 1 | 2 | 3;

export interface Tile {
  id: number;
  r: number;
  c: number;
  exp: number;        // power of two — exactly like the contract's nibbles
  isNew?: boolean;    // just spawned (appear animation)
  merged?: boolean;   // result of a merge (pop animation)
}

export interface Snapshot {
  tiles: Tile[];
  score: number;
  moves: number;
}

let nextId = 1;
const newId = () => nextId++;

const rnd = (n: number) => Math.floor(Math.random() * n);

export function spawnTile(tiles: Tile[]): Tile[] {
  const occupied = new Set(tiles.map((t) => t.r * 4 + t.c));
  const empty: number[] = [];
  for (let i = 0; i < 16; i++) if (!occupied.has(i)) empty.push(i);
  if (empty.length === 0) return tiles;
  const cell = empty[rnd(empty.length)];
  return [
    ...tiles,
    {
      id: newId(),
      r: Math.floor(cell / 4),
      c: cell % 4,
      exp: Math.random() < 0.9 ? 1 : 2, // 90% → 2, 10% → 4
      isNew: true,
    },
  ];
}

export function newRun(): Tile[] {
  return spawnTile(spawnTile([]));
}

export interface MoveResult {
  tiles: Tile[];
  gained: number;
  moved: boolean;
}

/** Mirrors the move() loop in the contract exactly: slide+merge rows, then spawn */
export function applyMove(tiles: Tile[], dir: Dir): MoveResult {
  const grid: (Tile | null)[][] = Array.from({ length: 4 }, () => Array(4).fill(null));
  for (const t of tiles) grid[t.r][t.c] = { ...t, isNew: false, merged: false };

  const out: Tile[] = [];
  let gained = 0;
  let moved = false;

  const lines: [number, number][][] = [];
  for (let i = 0; i < 4; i++) {
    const line: [number, number][] = [];
    for (let j = 0; j < 4; j++) {
      if (dir === 0) line.push([i, j]); // left
      if (dir === 1) line.push([i, 3 - j]); // right
      if (dir === 2) line.push([j, i]); // up
      if (dir === 3) line.push([3 - j, i]); // down
    }
    lines.push(line);
  }

  for (const line of lines) {
    const cells = line.map(([r, c]) => grid[r][c]).filter((t): t is Tile => t !== null);
    const placed: Tile[] = [];
    for (let i = 0; i < cells.length; i++) {
      if (i + 1 < cells.length && cells[i].exp === cells[i + 1].exp) {
        const exp = cells[i].exp + 1;
        placed.push({ id: newId(), r: 0, c: 0, exp, merged: true });
        gained += 2 ** exp;
        i++;
      } else {
        placed.push({ ...cells[i], merged: false });
      }
    }
    placed.forEach((t, idx) => {
      const [r, c] = line[idx];
      if (t.r !== r || t.c !== c || t.merged) moved = true;
      t.r = r;
      t.c = c;
      out.push(t);
    });
  }

  if (!moved) return { tiles, gained: 0, moved: false };
  return { tiles: spawnTile(out), gained, moved: true };
}

export function hasMoves(tiles: Tile[]): boolean {
  const grid: number[][] = Array.from({ length: 4 }, () => Array(4).fill(0));
  for (const t of tiles) grid[t.r][t.c] = t.exp;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (grid[r][c] === 0) return true;
      if (c < 3 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < 3 && grid[r][c] === grid[r + 1][c]) return true;
    }
  return false;
}

export function maxExp(tiles: Tile[]): number {
  return tiles.reduce((m, t) => Math.max(m, t.exp), 0);
}

/** Packs the board into a uint64 — exactly like contract storage */
export function packBoard(tiles: Tile[]): bigint {
  let b = 0n;
  for (const t of tiles) b |= BigInt(t.exp) << BigInt(16 * t.r + 4 * t.c);
  return b;
}

export function boardHex(tiles: Tile[]): string {
  return '0x' + packBoard(tiles).toString(16).padStart(16, '0');
}

/** Per-cell nibble for the interactive viz — aligned with gridOf() */
export function nibbleGrid(tiles: Tile[]): number[] {
  const g = Array(16).fill(0);
  for (const t of tiles) g[t.r * 4 + t.c] = t.exp;
  return g;
}

export function randomHash(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return '0x' + Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}
