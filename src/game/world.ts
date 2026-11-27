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
//
//  z=0  ┌────────────────┐   sever: stromy, domeček
//       │ T   T     HHHH │
//       │           HHHH │
//  z=7  │≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│   řeka
//  z=8  │≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈≈│
//  z=9  │ssss  CCCCCCCC  │   jih: hrad (brána na východ, k výchozí kameře)
//       │ T    C      G  │
//  z=15 └────────────────┘

export const TREE_SPOTS: Array<[number, number]> = [
  [2, 2],
  [6, 2],
  [15, 1],
  [2, 13],
];

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Domeček na severním břehu, dveře směrem k řece. */
export const HOUSE: Readonly<Rect> = { x0: 10, z0: 1, x1: 13, z1: 4 };

/** Hrad na jižním břehu. Věže v rozích, brána ve východní zdi. */
export const CASTLE: Readonly<Rect> = { x0: 6, z0: 9, x1: 13, z1: 14 };
const CASTLE_WALL_H = 2;
const TOWER_H = 4;


/** Věže jsou štíhlé (1×1) v rozích – široké věže by zakrývaly nádvoří. */
const isTower = (x: number, z: number): boolean => {
  const { x0, z0, x1, z1 } = CASTLE;
  return (x === x0 || x === x1) && (z === z0 || z === z1);
};

/** Brána: východní zeď, dvě pole uprostřed, dvě kostky vysoká. */
export const isCastleGate = (x: number, y: number, z: number): boolean =>
  x === CASTLE.x1 && (z === CASTLE.z0 + 2 || z === CASTLE.z0 + 3) && y >= 1 && y <= 2;

/** Nádvoří hradu (uvnitř zdí). */
export const isInCastle = (p: Vec3): boolean =>
  p.x > CASTLE.x0 && p.x < CASTLE.x1 && p.z > CASTLE.z0 && p.z < CASTLE.z1 && !isTower(p.x, p.z);

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

/** Odstraní strom (kmen + korunu) – jen přírodní kostky, stavby dítěte nechá být. */
function removeTree(w: World, x: number, z: number): void {
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      for (let y = 1; y <= 5; y++) {
        const p = { x: x + dx, y, z: z + dz };
        const t = w.get(p);
        if (t === 'log' || t === 'leaves') w.deleteRaw(p);
      }
}

/** Domeček: zdi, dveře k řece (jižní strana), okno, plochá střecha a komín. */
function addHouse(w: World, onlyEmpty = false): void {
  const { x0, z0, x1, z1 } = HOUSE;
  const put = (p: Vec3, t: BlockType) => {
    if (!onlyEmpty || !w.has(p)) w.setRaw(p, t);
  };
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (edge) {
        for (let y = 1; y <= 2; y++) {
          const isDoor = z === z1 && x === x0 + 1;
          const isWindow = y === 2 && x === x1 && z === z0 + 2;
          if (!isDoor && !isWindow) put({ x, y, z }, 'wall');
        }
      }
      put({ x, y: 3, z }, 'roof');
    }
  put({ x: x0 + 1, y: 4, z: z0 + 1 }, 'stone'); // komín
}

/** Hrad z kamene: hradby s cimbuřím, 4 věže se střechou, brána a volné nádvoří. */
function addCastle(w: World): void {
  const { x0, z0, x1, z1 } = CASTLE;
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      // vyčistit prostor (i v původním světě)
      for (let y = 1; y < WORLD_H; y++) w.deleteRaw({ x, y, z });
      w.setRaw({ x, y: 0, z }, 'grass');
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (isTower(x, z)) {
        for (let y = 1; y <= TOWER_H; y++) w.setRaw({ x, y, z }, 'stone');
        w.setRaw({ x, y: TOWER_H + 1, z }, 'roof');
      } else if (edge) {
        for (let y = 1; y <= CASTLE_WALL_H; y++) if (!isCastleGate(x, y, z)) w.setRaw({ x, y, z }, 'stone');
        // cimbuří (zuby na hradbách)
        if ((x + z) % 2 === 0) w.setRaw({ x, y: CASTLE_WALL_H + 1, z }, 'stone');
      }
    }
  // volný prostor před bránou, aby se dalo dojít dovnitř
  for (let z = z0 + 1; z <= z1 - 1; z++)
    for (let x = x1 + 1; x < WORLD_W; x++)
      for (let y = 1; y <= 2; y++) {
        const t = w.get({ x, y, z });
        if (t === 'log' || t === 'leaves') w.deleteRaw({ x, y, z });
      }
}

export function generateDefaultWorld(): World {
  const w = new World();
  for (let x = 0; x < WORLD_W; x++)
    for (let z = 0; z < WORLD_D; z++) w.setRaw({ x, y: 0, z }, isRiver(x, z) ? 'water' : 'grass');
  for (const [x, z] of TREE_SPOTS) addTree(w, x, z);
  addHouse(w);
  addCastle(w);
  // pískový břeh u řeky
  for (const x of [0, 1, 2, 3]) w.setRaw({ x, y: 0, z: 9 }, 'sand');
  // pár kamenů
  w.setRaw({ x: 4, y: 1, z: 5 }, 'stone');
  w.setRaw({ x: 8, y: 1, z: 5 }, 'stone');
  w.version = 0;
  return w;
}

/**
 * Převod světa z verze 0.1 (domeček na jihu) na verzi 0.2 (hrad na jihu, domeček na severu).
 * Stavby dítěte mimo oblast hradu zůstanou; v oblasti hradu se nahradí hradem.
 */
export function upgradeWorldToCastle(w: World): void {
  // staré stromy, které překáží hradu a domečku
  removeTree(w, 14, 11);
  removeTree(w, 13, 2);
  addCastle(w);
  addHouse(w, true);
  w.version = 0;
}
