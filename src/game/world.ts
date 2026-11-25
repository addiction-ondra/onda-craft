import { BLOCKS, type BlockType } from './blocks';

export const WORLD_W = 16; // osa x
export const WORLD_D = 16; // osa z
export const WORLD_H = 12; // osa y
export const RIVER_Z = [7, 8] as const;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const keyOf = (p: Vec3): string => `${p.x},${p.y},${p.z}`;
export const parseKey = (k: string): Vec3 => {
  const [x, y, z] = k.split(',').map(Number);
  return { x, y, z };
};

export const inBounds = (p: Vec3): boolean =>
  p.x >= 0 && p.x < WORLD_W && p.z >= 0 && p.z < WORLD_D && p.y >= 0 && p.y < WORLD_H;

export const isRiver = (x: number, z: number): boolean => (RIVER_Z as readonly number[]).includes(z) && x >= 0 && x < WORLD_W;

export type PlaceResult = 'ok' | 'out-of-bounds' | 'occupied' | 'too-high';
export type RemoveResult = 'ok' | 'empty' | 'ground';

/** Čistý datový model světa. Žádné Three.js, žádné DOM. */
export class World {
  private blocks = new Map<string, BlockType>();
  /** Zvyšuje se při každé změně – renderer podle toho pozná, že má překreslit. */
  version = 0;

  get(p: Vec3): BlockType | undefined {
    return this.blocks.get(keyOf(p));
  }

  has(p: Vec3): boolean {
    return this.blocks.has(keyOf(p));
  }

  isSolid(p: Vec3): boolean {
    const t = this.get(p);
    return t !== undefined && BLOCKS[t].solid;
  }

  /** Přímé nastavení bez pravidel (generování, načítání). */
  setRaw(p: Vec3, t: BlockType): void {
    this.blocks.set(keyOf(p), t);
    this.version++;
  }

  deleteRaw(p: Vec3): void {
    if (this.blocks.delete(keyOf(p))) this.version++;
  }

  /** Položení kostky hráčem. */
  place(p: Vec3, t: BlockType): PlaceResult {
    if (p.y >= WORLD_H) return 'too-high';
    if (!inBounds(p) || p.y < 1) return 'out-of-bounds';
    if (this.has(p)) return 'occupied';
    this.setRaw(p, t);
    return 'ok';
  }

  /** Odstranění kostky hráčem. Terén (y = 0) zůstává vždy. */
  remove(p: Vec3): RemoveResult {
    if (p.y <= 0) return 'ground';
    if (!this.has(p)) return 'empty';
    this.deleteRaw(p);
    return 'ok';
  }

  clear(): void {
    this.blocks.clear();
    this.version++;
  }

  entries(): IterableIterator<[string, BlockType]> {
    return this.blocks.entries();
  }

  get size(): number {
    return this.blocks.size;
  }

  count(t: BlockType): number {
    let n = 0;
    for (const v of this.blocks.values()) if (v === t) n++;
    return n;
  }

  /**
   * Výška, na které by stálo zvířátko v daném sloupci, pokud vychází z výšky `fromY`.
   * Vrací null, pokud je pod ním voda.
   */
  standLevel(x: number, z: number, fromY: number): number | null {
    let y = Math.max(1, fromY);
    while (y < WORLD_H && this.has({ x, y, z })) y++;
    while (y > 1 && !this.has({ x, y: y - 1, z })) y--;
    const below = this.get({ x, y: y - 1, z });
    if (below === undefined || below === 'water') return null;
    if (y >= WORLD_H) return null;
    return y;
  }

  /** Nejvyšší volné místo ve sloupci (pro umístění cílů misí). */
  topY(x: number, z: number): number {
    for (let y = WORLD_H - 1; y >= 0; y--) if (this.has({ x, y, z })) return y + 1;
    return 0;
  }
}

/** Je přes řeku postavený most? (pro některé x jsou pevné kostky nad oběma řádky řeky) */
export function findBridgeColumns(world: World): number[] {
  const xs: number[] = [];
  for (let x = 0; x < WORLD_W; x++) {
    if (RIVER_Z.every((z) => world.isSolid({ x, y: 1, z }))) xs.push(x);
  }
  return xs;
}

export const hasBridge = (world: World): boolean => findBridgeColumns(world).length > 0;

/** Nejlepší rozestavěný sloupec mostu (kolik ze 2 polí řeky je zakryto). */
export function bridgeProgress(world: World): { x: number; covered: number } {
  let best = { x: 8, covered: 0 };
  for (let x = 0; x < WORLD_W; x++) {
    const covered = RIVER_Z.filter((z) => world.isSolid({ x, y: 1, z })).length;
    if (covered > best.covered) best = { x, covered };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Výchozí svět
// ---------------------------------------------------------------------------

export const TREE_SPOTS: Array<[number, number]> = [
  [2, 2],
  [13, 2],
  [6, 3],
  [2, 12],
  [14, 11],
];

function addTree(w: World, x: number, z: number): void {
  for (let y = 1; y <= 3; y++) w.setRaw({ x, y, z }, 'log');
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      const p = { x: x + dx, y: 4, z: z + dz };
      if (inBounds(p)) w.setRaw(p, 'leaves');
      if (dx === 0 || dz === 0) {
        const p3 = { x: x + dx, y: 3, z: z + dz };
        if (inBounds(p3) && !w.has(p3)) w.setRaw(p3, 'leaves');
      }
    }
  w.setRaw({ x, y: 5, z }, 'leaves');
}

/** Domeček: zdi 4×4, dveře vpředu (směr k řece), plochá střecha. */
export const HOUSE: Readonly<{ x0: number; z0: number; x1: number; z1: number }> = { x0: 8, z0: 11, x1: 11, z1: 14 };

function addHouse(w: World): void {
  const { x0, z0, x1, z1 } = HOUSE;
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (edge) {
        for (let y = 1; y <= 2; y++) {
          const isDoor = z === z0 && x === x0 + 1;
          const isWindow = y === 2 && x === x1 && z === z0 + 2;
          if (!isDoor && !isWindow) w.setRaw({ x, y, z }, 'wall');
        }
      }
      w.setRaw({ x, y: 3, z }, 'roof');
    }
  // komín
  w.setRaw({ x: x1 - 1, y: 4, z: z1 - 1 }, 'stone');
}

export function generateDefaultWorld(): World {
  const w = new World();
  for (let x = 0; x < WORLD_W; x++)
    for (let z = 0; z < WORLD_D; z++) w.setRaw({ x, y: 0, z }, isRiver(x, z) ? 'water' : 'grass');
  for (const [x, z] of TREE_SPOTS) addTree(w, x, z);
  addHouse(w);
  // pískový břeh u řeky
  for (const x of [0, 1, 2, 3]) w.setRaw({ x, y: 0, z: 9 }, 'sand');
  // pár kamenů
  w.setRaw({ x: 4, y: 1, z: 5 }, 'stone');
  w.setRaw({ x: 13, y: 1, z: 6 }, 'stone');
  w.version = 0;
  return w;
}
