import type { BlockType } from './blocks';
import { PALETTES } from './blocks';
import type { CharacterId } from './characters';
import {
  addCastle,
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
export type WorldId = 'island' | 'ice';
export const WORLD_IDS: WorldId[] = ['island', 'ice'];
export const isWorldId = (v: unknown): v is WorldId => v === 'island' || v === 'ice';

export type AnimalSpec = { kind: 'dog' | 'sheep' | 'chick'; pos: Vec3 };
export type NpcKind = 'princess' | 'snowman';
export type NpcSpec = { kind: NpcKind; pos: Vec3 };

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
  theme: 'summer' | 'winter';
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
      { kind: 'princess', pos: { x: 15, y: 1, z: 12 } },
      { kind: 'snowman', pos: { x: 8, y: 1, z: 15 } },
    ],
    boat: { water: { x: 2, y: 1, z: 0 }, stand: { x: 2, y: 1, z: 1 } },
    castle: ICE_CASTLE,
    theme: 'winter',
  },
};

/** Který svět otevírá klíč ze kterého (ostrov → Ledové království → …). */
export const UNLOCKED_BY: Record<WorldId, string | null> = { island: null, ice: 'island' };
export const isUnlocked = (id: WorldId, keys: string[]): boolean => {
  const k = UNLOCKED_BY[id];
  return k === null || keys.includes(k);
};
