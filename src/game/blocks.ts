/**
 * Typy kostek. POŘADÍ JE DŮLEŽITÉ – index se ukládá do LocalStorage.
 * Nové typy přidávej pouze na konec seznamu.
 */
export const BLOCK_TYPES = [
  'grass', // 0 – tráva (terén i stavební)
  'wood', // 1 – dřevo (prkna)
  'stone', // 2 – kámen
  'red', // 3 – červená
  'sand', // 4 – písek
  'blue', // 5 – modrá
  'water', // 6 – voda (jen terén)
  'log', // 7 – kmen stromu
  'leaves', // 8 – listí
  'wall', // 9 – zeď domečku
  'roof', // 10 – střecha
  'question', // 11 – bedna s otazníkem (úkol pro postavičky)
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export interface BlockDef {
  type: BlockType;
  /** Hlavní barva – používá se v UI i jako základ textury. */
  color: string;
  /** Dá se vybrat v paletě. */
  buildable: boolean;
  /** Průhledná (voda). */
  transparent: boolean;
  /** Na kostku lze stavět / stát. */
  solid: boolean;
}

const def = (
  type: BlockType,
  color: string,
  buildable: boolean,
  opts: Partial<Pick<BlockDef, 'transparent' | 'solid'>> = {},
): BlockDef => ({ type, color, buildable, transparent: opts.transparent ?? false, solid: opts.solid ?? true });

export const BLOCKS: Record<BlockType, BlockDef> = {
  grass: def('grass', '#5cc43c', true),
  wood: def('wood', '#c98a4b', true),
  stone: def('stone', '#9aa3ad', true),
  red: def('red', '#e53935', true),
  sand: def('sand', '#f4d470', true),
  blue: def('blue', '#4aa8ff', true),
  water: def('water', '#3d8fe0', false, { transparent: true, solid: false }),
  log: def('log', '#8a5a2b', false),
  leaves: def('leaves', '#2f9e44', false),
  wall: def('wall', '#fbefd5', false),
  roof: def('roof', '#5c6bc0', false),
  question: def('question', '#f59f00', false),
};

/** Materiály v paletě – přesně 6, v tomto pořadí. */
export const PALETTE: BlockType[] = ['wood', 'stone', 'red', 'grass', 'sand', 'blue'];

export const blockIndex = (t: BlockType): number => BLOCK_TYPES.indexOf(t);
export const blockFromIndex = (i: number): BlockType | undefined => BLOCK_TYPES[i];
