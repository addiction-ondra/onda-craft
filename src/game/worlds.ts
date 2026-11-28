import type { BlockType } from './blocks';
import { PALETTES } from './blocks';
import type { CharacterId } from './characters';
import {
  addCastle,
  addPalm,
  addTree,
  CASTLE,
  generateDefaultWorld,
  QUESTION_SPOTS,
  refillQuestionBoxes,
  World,
  WORLD_D,
  WORLD_W,
  type Rect,
  type Vec3,
} from './world';

/**
 * Světy hry. Každý svět má vlastní mapu, úkoly, postavy a uložení.
 * Herní princip je všude stejný (chození, stavění, Stavitel, bedny/dárky, mise, klíč).
 */
export type WorldId = 'island' | 'ice' | 'pirate';
export const WORLD_IDS: WorldId[] = ['island', 'ice', 'pirate'];
export const isWorldId = (v: unknown): v is WorldId => v === 'island' || v === 'ice' || v === 'pirate';

export type AnimalSpec = { kind: 'dog' | 'sheep' | 'chick'; pos: Vec3 };
export type NpcKind = 'princess' | 'snowman' | 'pirate' | 'skeleton' | 'penguin' | 'xmasTree';
/** `face` = kam se postava dívá (dx, dz); výchozí na západ (−x). */
export type NpcSpec = { kind: NpcKind; pos: Vec3; face?: [number, number] };

export interface WorldDef {
  id: WorldId;
  generate: () => World;
  /** Kostka s úkolem: bedna s otazníkem nebo dárek. */
  boxBlock: BlockType;
  boxSpots: Vec3[];
  palette: BlockType[];
  spawn: Record<CharacterId, Vec3>;
  animals: AnimalSpec[];
  npcs: NpcSpec[];
  /** Loďka: kde stojí na vodě a kde k ní dojdou děti. */
  boat: { water: Vec3; stand: Vec3 };
  castle: Readonly<Rect>;
  /** Vzhled (barva oblohy, sněžení). */
  theme: 'summer' | 'winter' | 'tropic';
  /** Ozdoba mimo plochu světa (pirátská loď). */
  ship?: Vec3;
  /** Kde se po všech úkolech a klíčích objeví červené X s pokladem. */
  treasureX?: Vec3;
}

// ---------------------------------------------------------------------------
// Ledové království
// ---------------------------------------------------------------------------
//
//  z=0  ≈≈≈≈ . . . . . . . . . . . .    záliv s loďkou (vlevo nahoře)
//       ≈≈ T . . . . . . . ░░░░░░ .     ░ zamrzlé jezero (led – dá se po něm chodit)
//       . . . . . S . . . ░░░░░░ .      S sněhulák Bobek
//       . . . . . . . . . ░░░░░░ .
//  z=8  . . . . . . . IIIIIII . .       I ledový hrad, brána na východ
//       . T . . . . . I . . . I P       P princezna Vločka
//  z=15 . . . . . . . . . . . . . .

export const ICE_CASTLE: Readonly<Rect> = { x0: 7, z0: 8, x1: 13, z1: 13 };
export const ICE_LAKE: Readonly<Rect> = { x0: 9, z0: 1, x1: 14, z1: 5 };
/** Záliv pro loďku. */
const ICE_WATER: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [0, 1],
  [1, 1],
];
export const ICE_TREES: Array<[number, number]> = [
  [1, 10],
  [3, 14],
  [6, 1],
  [15, 7],
];
export const GIFT_SPOTS: Vec3[] = [
  { x: 5, y: 1, z: 12 },
  { x: 11, y: 1, z: 15 },
  { x: 12, y: 1, z: 7 },
  { x: 4, y: 1, z: 2 },
];

/** Plány svítících míst pro mise v Ledovém království. */
export const ICE_PLANS = {
  /** Sněhulák: 3 sněhové kostky na sobě (vedle Bobka). */
  snowman: { x: 7, z: 15 },
  /** Věž z 5 kostek. */
  tower: { x: 12, z: 15 },
  /** Řada se vzorem: led, dřevo, led, ? ? ? (x od 2 do 7, z = 7). */
  pattern: { x0: 2, z: 7, order: ['ice', 'wood', 'ice', 'wood', 'ice', 'wood'] as BlockType[], given: 3 },
  /** Místa, kam se schovají krystaly. */
  crystalSpots: [
    [1, 4],
    [14, 3],
    [10, 10],
    [15, 15],
    [0, 14],
    [12, 0],
    [5, 14],
    [13, 7],
  ] as Array<[number, number]>,
  /** Sněhové koule s čísly 1–5. */
  numberSpots: [
    { x: 7, y: 1, z: 3 },
    { x: 3, y: 1, z: 6 },
    { x: 12, y: 1, z: 6 },
    { x: 6, y: 1, z: 14 },
    { x: 14, y: 1, z: 14 },
  ] as Vec3[],
};

export function generateIceWorld(): World {
  const w = new World();
  for (let x = 0; x < WORLD_W; x++)
    for (let z = 0; z < WORLD_D; z++) {
      const lake = x >= ICE_LAKE.x0 && x <= ICE_LAKE.x1 && z >= ICE_LAKE.z0 && z <= ICE_LAKE.z1;
      const water = ICE_WATER.some(([wx, wz]) => wx === x && wz === z);
      w.setRaw({ x, y: 0, z }, water ? 'water' : lake ? 'ice' : 'snow');
    }
  for (const [x, z] of ICE_TREES) addTree(w, x, z, true);
  addCastle(w, ICE_CASTLE, { wall: 'ice', roof: 'snow', ground: 'snow' });
  // ledové krystaly na věžích hradu
  for (const [x, z] of [
    [ICE_CASTLE.x0, ICE_CASTLE.z0],
    [ICE_CASTLE.x1, ICE_CASTLE.z0],
    [ICE_CASTLE.x0, ICE_CASTLE.z1],
    [ICE_CASTLE.x1, ICE_CASTLE.z1],
  ])
    w.setRaw({ x, y: 6, z }, 'crystal');
  // pár sněhových hromádek a kamenů
  w.setRaw({ x: 2, y: 1, z: 5 }, 'snow');
  w.setRaw({ x: 13, y: 1, z: 14 }, 'stone');
  refillQuestionBoxes(w, GIFT_SPOTS, 'gift');
  w.version = 0;
  return w;
}

// ---------------------------------------------------------------------------
// Pirátský ostrov
// ---------------------------------------------------------------------------
//
//  z=0  . . . . . . ≈≈≈≈ . . . . . .    zátoka s naší loďkou (nahoře)
//       . . . . . . . ≈≈ . . . . S .    S kostlivec Kostík u skal
//  z=5  . . . . R s R s R s . . . . .   řada se vzorem (červená, písek…)
//       . . . . . . . . □□□ . . . . .   čtverec z kamenů (8 svítících míst)
//  z=11 ≈≈≈ . . . . . . . . . . . . .   laguna, molo k pirátské lodi (mimo ostrov vlevo)
//       ≈≈≈ P . . . . . . . . P . .     P pirát Fousek u laguny, palma s X vpravo dole
//  z=15 . . . . . . . M . . . . . . .   M stožár

export const PIRATE_GRASS: Readonly<Rect> = { x0: 3, z0: 3, x1: 12, z1: 12 };
const PIRATE_WATER: Array<[number, number]> = [
  [6, 0],
  [7, 0],
  [8, 0],
  [9, 0],
  [7, 1],
  [8, 1],
  ...[9, 10, 11, 12, 13, 14].flatMap((z) => [0, 1, 2].map((x) => [x, z] as [number, number])),
];
export const PIRATE_PALMS: Array<[number, number]> = [
  [2, 4],
  [5, 9],
  [12, 12],
  [10, 2],
];
export const BARREL_SPOTS: Vec3[] = [
  { x: 6, y: 1, z: 8 },
  { x: 12, y: 1, z: 9 },
  { x: 14, y: 1, z: 10 },
  { x: 4, y: 1, z: 10 },
];

/** Plány pro mise na Pirátském ostrově. */
export const PIRATE_PLANS = {
  /** Stožár: 4 dřevěné kostky na sobě. */
  mast: { x: 7, z: 15 },
  /** Vlajky: červená, písek, červená, ? ? ? */
  flags: { x0: 4, z: 5, order: ['red', 'sand', 'red', 'sand', 'red', 'sand'] as BlockType[], given: 3 },
  /** Čtverec z kamenů kolem středu. */
  square: { cx: 9, cz: 9 },
  /** Molo přes lagunu směrem k pirátské lodi (od břehu ven). */
  pier: [
    { x: 2, y: 1, z: 11 },
    { x: 1, y: 1, z: 11 },
    { x: 0, y: 1, z: 11 },
  ] as Vec3[],
  coinSpots: [
    [1, 1],
    [15, 0],
    [14, 14],
    [3, 7],
    [11, 6],
    [15, 12],
    [9, 14],
    [1, 6],
  ] as Array<[number, number]>,
};

export function generatePirateWorld(): World {
  const w = new World();
  for (let x = 0; x < WORLD_W; x++)
    for (let z = 0; z < WORLD_D; z++) {
      const water = PIRATE_WATER.some(([wx, wz]) => wx === x && wz === z);
      const grass = x >= PIRATE_GRASS.x0 && x <= PIRATE_GRASS.x1 && z >= PIRATE_GRASS.z0 && z <= PIRATE_GRASS.z1;
      w.setRaw({ x, y: 0, z }, water ? 'water' : grass ? 'grass' : 'sand');
    }
  for (const [x, z] of PIRATE_PALMS) addPalm(w, x, z);
  // skály u kostlivce
  for (const p of [
    { x: 14, y: 1, z: 2 },
    { x: 15, y: 1, z: 2 },
    { x: 15, y: 2, z: 2 },
    { x: 15, y: 1, z: 3 },
    { x: 11, y: 1, z: 4 },
  ])
    w.setRaw(p, 'stone');
  refillQuestionBoxes(w, BARREL_SPOTS, 'barrel');
  w.version = 0;
  return w;
}

export const WORLDS: Record<WorldId, WorldDef> = {
  island: {
    id: 'island',
    generate: generateDefaultWorld,
    boxBlock: 'question',
    boxSpots: QUESTION_SPOTS,
    palette: PALETTES.island,
    spawn: { ondra: { x: 15, y: 1, z: 12 }, lauriska: { x: 15, y: 1, z: 13 } },
    animals: [
      { kind: 'dog', pos: { x: 5, y: 1, z: 11 } },
      { kind: 'sheep', pos: { x: 2, y: 1, z: 6 } },
      { kind: 'chick', pos: { x: 7, y: 1, z: 4 } },
    ],
    npcs: [],
    boat: { water: { x: 1, y: 1, z: 8 }, stand: { x: 1, y: 1, z: 9 } },
    castle: CASTLE,
    theme: 'summer',
  },
  ice: {
    id: 'ice',
    generate: generateIceWorld,
    boxBlock: 'gift',
    boxSpots: GIFT_SPOTS,
    palette: PALETTES.ice,
    spawn: { ondra: { x: 2, y: 1, z: 2 }, lauriska: { x: 3, y: 1, z: 2 } },
    // Frený jezdí s dětmi do všech světů
    animals: [{ kind: 'dog', pos: { x: 3, y: 1, z: 3 } }],
    npcs: [
      // princezna stojí zády k hradu – čelem k dětem
      { kind: 'princess', pos: { x: 15, y: 1, z: 12 }, face: [1, 0] },
      { kind: 'snowman', pos: { x: 8, y: 1, z: 15 } },
      // tučňák bruslí na zamrzlém jezeře
      { kind: 'penguin', pos: { x: 11, y: 1, z: 2 }, face: [1, 1] },
      // vánoční stromeček na okraji (nic ho z kamery nezakryje)
      { kind: 'xmasTree', pos: { x: 15, y: 1, z: 9 } },
    ],
    boat: { water: { x: 2, y: 1, z: 0 }, stand: { x: 2, y: 1, z: 1 } },
    castle: ICE_CASTLE,
    theme: 'winter',
  },
  pirate: {
    id: 'pirate',
    generate: generatePirateWorld,
    boxBlock: 'barrel',
    boxSpots: BARREL_SPOTS,
    palette: PALETTES.pirate,
    spawn: { ondra: { x: 6, y: 1, z: 3 }, lauriska: { x: 8, y: 1, z: 3 } },
    animals: [{ kind: 'dog', pos: { x: 7, y: 1, z: 4 } }],
    npcs: [
      { kind: 'pirate', pos: { x: 3, y: 1, z: 13 } },
      { kind: 'skeleton', pos: { x: 13, y: 1, z: 4 } },
    ],
    boat: { water: { x: 7, y: 1, z: 1 }, stand: { x: 7, y: 1, z: 2 } },
    // žádný hrad – prázdný obdélník mimo svět
    castle: { x0: -10, z0: -10, x1: -10, z1: -10 },
    theme: 'tropic',
    ship: { x: -4, y: 1, z: 11 },
    treasureX: { x: 13, y: 1, z: 13 },
  },
};

/** Který svět otevírá klíč ze kterého (ostrov → Ledové království → …). */
export const UNLOCKED_BY: Record<WorldId, string | null> = { island: null, ice: 'island', pirate: 'ice' };
export const isUnlocked = (id: WorldId, keys: string[]): boolean => {
  const k = UNLOCKED_BY[id];
  return k === null || keys.includes(k);
};
