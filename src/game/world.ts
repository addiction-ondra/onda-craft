import { BLOCKS, isBoxBlock, type BlockType } from './blocks';

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
const isTowerOf = (r: Rect, x: number, z: number): boolean => (x === r.x0 || x === r.x1) && (z === r.z0 || z === r.z1);

/** Brána: východní zeď, dvě pole uprostřed, dvě kostky vysoká. */
const isGateOf = (r: Rect, x: number, y: number, z: number): boolean =>
  x === r.x1 && (z === r.z0 + 2 || z === r.z0 + 3) && y >= 1 && y <= 2;
export const isCastleGate = (x: number, y: number, z: number): boolean => isGateOf(CASTLE, x, y, z);

/** Nádvoří hradu (uvnitř zdí) – pro libovolný hrad. */
export const isInsideCastle = (r: Rect, p: Vec3): boolean =>
  p.x > r.x0 && p.x < r.x1 && p.z > r.z0 && p.z < r.z1 && !isTowerOf(r, p.x, p.z);
export const isInCastle = (p: Vec3): boolean => isInsideCastle(CASTLE, p);

export function addTree(w: World, x: number, z: number, snowy = false): void {
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
  w.setRaw({ x, y: 5, z }, snowy ? 'snow' : 'leaves');
  if (snowy) {
    // zasněžená koruna
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const p = { x: x + dx, y: 4, z: z + dz };
      if (inBounds(p)) w.setRaw(p, 'snow');
    }
  }
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

export interface CastleMaterials {
  wall: BlockType;
  roof: BlockType;
  ground: BlockType;
}

/** Hrad: hradby s cimbuřím, 4 věže se střechou, brána na východ a volné nádvoří. */
export function addCastle(
  w: World,
  rect: Readonly<Rect> = CASTLE,
  mats: CastleMaterials = { wall: 'stone', roof: 'roof', ground: 'grass' },
): void {
  const { x0, z0, x1, z1 } = rect;
  for (let x = x0; x <= x1; x++)
    for (let z = z0; z <= z1; z++) {
      // vyčistit prostor (i v původním světě)
      for (let y = 1; y < WORLD_H; y++) w.deleteRaw({ x, y, z });
      w.setRaw({ x, y: 0, z }, mats.ground);
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (isTowerOf(rect, x, z)) {
        for (let y = 1; y <= TOWER_H; y++) w.setRaw({ x, y, z }, mats.wall);
        w.setRaw({ x, y: TOWER_H + 1, z }, mats.roof);
      } else if (edge) {
        for (let y = 1; y <= CASTLE_WALL_H; y++) if (!isGateOf(rect, x, y, z)) w.setRaw({ x, y, z }, mats.wall);
        // cimbuří (zuby na hradbách)
        if ((x + z) % 2 === 0) w.setRaw({ x, y: CASTLE_WALL_H + 1, z }, mats.wall);
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
  refillQuestionBoxes(w);
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

// ---------------------------------------------------------------------------
// Domeček pro pejska Freného (mise 5) – plán, který ukazují svítící kostky
// ---------------------------------------------------------------------------

/** Malý domeček na jižním břehu vedle hradu: 3 stěny, střecha, dveře k řece. */
export const DOGHOUSE = {
  inside: { x: 3, y: 1, z: 11 },
  door: { x: 3, y: 1, z: 10 },
  walls: [
    { x: 2, y: 1, z: 11 },
    { x: 4, y: 1, z: 11 },
    { x: 3, y: 1, z: 12 },
  ],
  roof: { x: 3, y: 2, z: 11 },
  /** Ze které strany je domeček dobře vidět (hrad ho jinak zakrývá). */
  viewAzimuthDeg: 225,
} as const;

export const doghouseParts = (): Vec3[] => [...DOGHOUSE.walls, DOGHOUSE.roof];

export interface DoghouseStatus {
  /** Kolik ze 4 kostek (3 stěny + střecha) už je postaveno. */
  filled: number;
  /** Je uvnitř volno pro pejska? */
  insideFree: boolean;
  /** Jsou dveře volné? */
  doorFree: boolean;
  done: boolean;
}

export function doghouseStatus(w: World): DoghouseStatus {
  const filled = doghouseParts().filter((p) => w.isSolid(p)).length;
  const insideFree = !w.has(DOGHOUSE.inside);
  const doorFree = !w.has(DOGHOUSE.door);
  return { filled, insideFree, doorFree, done: filled === 4 && insideFree && doorFree };
}

// ---------------------------------------------------------------------------
// Bedny s otazníkem – k bedně musí dojít Ondra nebo Laura, pak přijde úkol
// ---------------------------------------------------------------------------

/** Místa beden: u startu, na nádvoří hradu a za řekou (tam je potřeba most). */
export const QUESTION_SPOTS: Vec3[] = [
  { x: 15, y: 1, z: 15 },
  { x: 9, y: 1, z: 12 },
  { x: 4, y: 1, z: 2 },
  { x: 14, y: 1, z: 6 },
];

/**
 * Když jsou všechny bedny otevřené, při dalším spuštění se objeví nové
 * (jen na volných místech). Vrací počet nově přidaných.
 */
export function refillQuestionBoxes(w: World, spots: Vec3[] = QUESTION_SPOTS, block: BlockType = 'question'): number {
  if (countBoxes(w) > 0) return 0;
  let n = 0;
  for (const p of spots) {
    const below = w.get({ x: p.x, y: p.y - 1, z: p.z });
    if (w.has(p) || below === undefined || below === 'water') continue;
    w.setRaw(p, block);
    n++;
  }
  return n;
}

/** Kolik je ve světě beden s otazníkem / dárků. */
export const countBoxes = (w: World): number => w.count('question') + w.count('gift');

/** Stojí postavička u bedny (vedle ní nebo na ní)? Vrací pozici bedny. */
export function adjacentQuestionBox(w: World, p: Vec3): Vec3 | null {
  for (const [dx, dy, dz] of [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
    [0, -1, 0],
  ]) {
    const q = { x: p.x + dx, y: p.y + dy, z: p.z + dz };
    if (isBoxBlock(w.get(q))) return q;
  }
  return null;
}

/** „Prázdná louka“: smaže všechno postavené, zůstane jen země (tráva, písek, řeka). */
export function clearToGround(w: World): void {
  const above: Vec3[] = [];
  for (const [k] of w.entries()) {
    const p = parseKey(k);
    if (p.y >= 1) above.push(p);
  }
  for (const p of above) w.deleteRaw(p);
}

/** Kolik beden s otazníkem má ve světě být. */
export const QUESTION_BOX_TARGET = 3;

export interface BoxSpotOptions {
  /** Místa, kam postavičky dojdou (z `reachableCells`). Bedna musí stát vedle jednoho z nich. */
  reachable: Map<string, Vec3>;
  /** Kde bedna být nesmí (postavičky, zvířátka, rozestavěná stavba…). */
  avoid: Vec3[];
  /** Kde byly bedny naposledy – nová má být jinde. */
  recent: Vec3[];
  rng?: () => number;
}

/**
 * Vybere náhodné nové místo pro bednu s otazníkem: na zemi (ne na vodě),
 * dosažitelné pro postavičky, ne těsně u jiné bedny a ne tam, kde nedávno byla.
 */
interface SpotRules {
  /** Jen místa, kam postavičky dojdou. */
  reachableOnly: boolean;
  /** Minimální vzdálenost od jiných beden a nedávných míst. */
  spacing: number;
  /** Kolik sousedních polí musí být volných (3 = neucpe bránu ani úzkou cestu). */
  minFreeSides: number;
}

/** Pravidla od nejpřísnějších po nejvolnější – bedna se nakonec objeví vždy. */
const SPOT_RULES: SpotRules[] = [
  { reachableOnly: true, spacing: 3, minFreeSides: 3 },
  { reachableOnly: true, spacing: 1, minFreeSides: 2 },
  { reachableOnly: true, spacing: 0, minFreeSides: 1 },
  { reachableOnly: false, spacing: 0, minFreeSides: 0 },
];

function spotCandidates(w: World, o: BoxSpotOptions, r: SpotRules): Vec3[] {
  const boxes: Vec3[] = [];
  for (const [k, t] of w.entries()) if (isBoxBlock(t)) boxes.push(parseKey(k));
  const near = (a: Vec3, b: Vec3, d: number) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z) <= d;
  const doghouse = [DOGHOUSE.inside, DOGHOUSE.door, ...doghouseParts()];
  const cells: Vec3[] = [];
  if (r.reachableOnly) {
    for (const c of o.reachable.values()) cells.push({ x: c.x, y: c.y, z: c.z });
  } else {
    for (let x = 0; x < WORLD_W; x++) for (let z = 0; z < WORLD_D; z++) cells.push({ x, y: 1, z });
  }
  const out: Vec3[] = [];
  for (const p of cells) {
    if (p.y !== 1) continue; // jen na zemi, ať je bedna vidět a dá se k ní dojít
    const below = w.get({ x: p.x, y: 0, z: p.z });
    if (below === undefined || below === 'water') continue;
    if (w.has(p) || w.has({ ...p, y: 2 })) continue;
    if (o.avoid.some((a) => near(a, p, 0))) continue;
    if (doghouse.some((a) => near(a, p, 0))) continue;
    if (r.spacing > 0 && boxes.some((b) => near(b, p, r.spacing))) continue;
    if (r.spacing > 0 && o.recent.some((q) => near(q, p, r.spacing))) continue;
    const freeSides = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dz]) => o.reachable.has(`${p.x + dx},1,${p.z + dz}`)).length;
    if (freeSides < r.minFreeSides) continue;
    out.push(p);
  }
  return out;
}

/**
 * Vybere náhodné nové místo pro bednu s otazníkem. Nejdřív hezké místo (dosažitelné,
 * daleko od jiných beden, neucpe cestu); když žádné není, pravidla se postupně uvolní,
 * takže se bedna objeví vždy. null jen tehdy, když na ostrově není jediné volné pole na zemi.
 */
export function pickQuestionSpot(w: World, o: BoxSpotOptions): Vec3 | null {
  const rng = o.rng ?? Math.random;
  for (const rules of SPOT_RULES) {
    const candidates = spotCandidates(w, o, rules);
    if (candidates.length) return candidates[Math.floor(rng() * candidates.length)];
  }
  return null;
}
