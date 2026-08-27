// ═══════════════════════════════════════════════════════════════
//  موتور ۲۰۴۸ — آینه‌ی تمام‌نمای Onchain2048.sol
//  همان الگوریتم نیبل‌ها: هر کاشی «توان ۲» است و برد می‌تواند
//  در یک uint64 بسته‌بندی شود. dir: 0=چپ 1=راست 2=بالا 3=پایین
// ═══════════════════════════════════════════════════════════════

export type Dir = 0 | 1 | 2 | 3;

export interface Tile {
  id: number;
  r: number;
  c: number;
  exp: number;        // توان ۲ — دقیقاً مثل نیبل‌های قرارداد
  isNew?: boolean;    // تازه spawn شده (انیمیشن ظهور)
  merged?: boolean;   // حاصل ادغام (انیمیشن پالس)
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
      exp: Math.random() < 0.9 ? 1 : 2, // ۹۰٪ → ۲ ، ۱۰٪ → ۴
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

/** دقیقاً معادل حلقه‌ی move() در قرارداد: اسلاید+ادغام ردیف‌ها، سپس spawn */
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
      if (dir === 0) line.push([i, j]); // چپ
      if (dir === 1) line.push([i, 3 - j]); // راست
      if (dir === 2) line.push([j, i]); // بالا
      if (dir === 3) line.push([3 - j, i]); // پایین
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

/** بسته‌بندی برد در uint64 — دقیقاً مثل storage قرارداد */
export function packBoard(tiles: Tile[]): bigint {
  let b = 0n;
  for (const t of tiles) b |= BigInt(t.exp) << BigInt(16 * t.r + 4 * t.c);
  return b;
}

export function boardHex(tiles: Tile[]): string {
  return '0x' + packBoard(tiles).toString(16).padStart(16, '0');
}

/** نیبل هر خانه برای نمایش تعاملی — هم‌تراز با gridOf() */
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
