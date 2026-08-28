// The 2048 engine — a faithful, nibble-for-nibble port of the Solidity
// contract so the local simulation matches the on-chain game exactly.

export type Dir = 0 | 1 | 2 | 3; // 0=left 1=right 2=up 3=down

export interface Tile {
  id: number;
  r: number;
  c: number;
  exp: number; // power of two; value = 2**exp
  isNew?: boolean;
  merged?: boolean;
}

/** A board is 16 nibbles packed into a number (we keep them in an array). */
export type Nibbles = number[]; // length 16, index = r*4 + c, value = exponent

export function emptyBoard(): Nibbles {
  return Array(16).fill(0);
}

export function nibbleGrid(tiles: Tile[]): Nibbles {
  const b = emptyBoard();
  for (const t of tiles) b[t.r * 4 + t.c] = t.exp;
  return b;
}

export function packBoard(tiles: Tile[]): bigint {
  let v = 0n;
  for (const t of tiles) v |= BigInt(t.exp) << BigInt((t.r * 4 + t.c) * 4);
  return v;
}

export function boardHex(tiles: Tile[]): string {
  return '0x' + packBoard(tiles).toString(16).padStart(16, '0').toUpperCase();
}

export function maxExp(tiles: Tile[]): number {
  return tiles.reduce((m, t) => Math.max(m, t.exp), 0);
}

// ── row slide + merge (mirrors _slideLeft) ──────────────────────
function slideRow(row: number[]): { out: number[]; gained: number } {
  const cells = row.filter((v) => v !== 0);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < cells.length; i++) {
    if (i + 1 < cells.length && cells[i] === cells[i + 1]) {
      const merged = cells[i] + 1;
      out.push(merged);
      gained += 2 ** merged;
      i++;
    } else {
      out.push(cells[i]);
    }
  }
  while (out.length < 4) out.push(0);
  return { out, gained };
}

function getRow(b: Nibbles, r: number): number[] {
  return [b[r * 4], b[r * 4 + 1], b[r * 4 + 2], b[r * 4 + 3]];
}

function transpose(b: Nibbles): Nibbles {
  const out = emptyBoard();
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) out[c * 4 + r] = b[r * 4 + c];
  return out;
}

/** Apply a move to a nibble board. Returns new board + gained score. */
export function applyMove(b: Nibbles, dir: Dir): { board: Nibbles; gained: number } {
  let work = b;
  if (dir === 2 || dir === 3) work = transpose(work); // up/down → left/right on transpose

  const out = emptyBoard();
  let gained = 0;
  for (let r = 0; r < 4; r++) {
    let row = getRow(work, r);
    if (dir === 1 || dir === 3) row = [...row].reverse();
    const { out: slid, gained: g } = slideRow(row);
    const final = dir === 1 || dir === 3 ? [...slid].reverse() : slid;
    for (let c = 0; c < 4; c++) out[r * 4 + c] = final[c];
    gained += g;
  }

  if (dir === 2 || dir === 3) return { board: transpose(out), gained };
  return { board: out, gained };
}

export function boardsEqual(a: Nibbles, b: Nibbles): boolean {
  return a.every((v, i) => v === b[i]);
}

// ── spawning ────────────────────────────────────────────────────
export function emptyCells(b: Nibbles): number[] {
  const e: number[] = [];
  b.forEach((v, i) => { if (v === 0) e.push(i); });
  return e;
}

export function hasMoves(b: Nibbles): boolean {
  if (emptyCells(b).length > 0) return true;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      const v = b[r * 4 + c];
      if (c < 3 && v === b[r * 4 + c + 1]) return true;
      if (r < 3 && v === b[(r + 1) * 4 + c]) return true;
    }
  return false;
}

/** Spawn one tile (90% → 2, 10% → 4) using Math.random for the local sim. */
export function spawnTile(b: Nibbles): Nibbles {
  const empties = emptyCells(b);
  if (empties.length === 0) return b;
  const idx = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.9 ? 1 : 2;
  const out = [...b];
  out[idx] = value;
  return out;
}

export function newGame(): Nibbles {
  return spawnTile(spawnTile(emptyBoard()));
}

// ── conversion to renderable tiles ──────────────────────────────
let tileSeq = 1;
export function toTiles(b: Nibbles, prev?: Nibbles): Tile[] {
  const tiles: Tile[] = [];
  b.forEach((exp, i) => {
    if (exp > 0) {
      tiles.push({
        id: tileSeq++,
        r: Math.floor(i / 4),
        c: i % 4,
        exp,
        isNew: prev ? prev[i] === 0 : true,
        merged: prev ? exp > prev[i] && prev[i] > 0 : false,
      });
    }
  });
  return tiles;
}

export function randomHash(bytes: number): string {
  let s = '0x';
  const chars = '0123456789abcdef';
  for (let i = 0; i < bytes * 2; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}
