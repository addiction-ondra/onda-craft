import type { BlockType } from './blocks';
import type { PlanSlot } from './iceMissions';
import { PIRATE_PLANS } from './worlds';

/** Stožár: 4 dřevěné kostky na sobě. */
export const mastSlots = (): PlanSlot[] =>
  [1, 2, 3, 4].map((y) => ({ pos: { x: PIRATE_PLANS.mast.x, y, z: PIRATE_PLANS.mast.z }, block: 'wood' as BlockType }));

/** Vlajky se vzorem červená–písek: první `given` položí hra. */
export const flagSlots = (): PlanSlot[] =>
  PIRATE_PLANS.flags.order.map((block, i) => ({ pos: { x: PIRATE_PLANS.flags.x0 + i, y: 1, z: PIRATE_PLANS.flags.z }, block }));
export const flagsToFill = (): PlanSlot[] => flagSlots().slice(PIRATE_PLANS.flags.given);

/** Čtverec: 8 míst kolem středu (jakýkoli materiál – tvar je důležitý). */
export const squareSlots = (): PlanSlot[] => {
  const { cx, cz } = PIRATE_PLANS.square;
  const out: PlanSlot[] = [];
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) out.push({ pos: { x: cx + dx, y: 1, z: cz + dz }, block: null });
  return out;
};

/** Molo přes lagunu: 3 dřevěná prkna od břehu. */
export const pierSlots = (): PlanSlot[] => PIRATE_PLANS.pier.map((pos) => ({ pos, block: 'wood' as BlockType }));
