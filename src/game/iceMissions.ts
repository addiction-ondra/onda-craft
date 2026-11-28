import type { BlockType } from './blocks';
import { WORLD_H, type Vec3, type World } from './world';
import { ICE_PLANS } from './worlds';

/** Svítící místo s materiálem, který na něj patří (null = jakýkoli). */
export interface PlanSlot {
  pos: Vec3;
  block: BlockType | null;
}

/** Sněhulák: 3 sněhové kostky na sobě. */
export const snowmanSlots = (): PlanSlot[] =>
  [1, 2, 3].map((y) => ({ pos: { x: ICE_PLANS.snowman.x, y, z: ICE_PLANS.snowman.z }, block: 'snow' as BlockType }));

/** Věž z 5 kostek (jakýkoli materiál). */
export const towerSlots = (): PlanSlot[] =>
  [1, 2, 3, 4, 5].map((y) => ({ pos: { x: ICE_PLANS.tower.x, y, z: ICE_PLANS.tower.z }, block: null }));

/** Řada se vzorem: první `given` kostky položí hra, zbytek doplní dítě. */
export const patternSlots = (): PlanSlot[] =>
  ICE_PLANS.pattern.order.map((block, i) => ({ pos: { x: ICE_PLANS.pattern.x0 + i, y: 1, z: ICE_PLANS.pattern.z }, block }));
export const patternToFill = (): PlanSlot[] => patternSlots().slice(ICE_PLANS.pattern.given);

export interface PlanStatus {
  /** Kolik míst je správně vyplněno (u věže/sněhuláka: odspodu bez mezery). */
  filled: number;
  total: number;
  /** Místa se špatným materiálem (hra je jemně vrátí). */
  wrong: PlanSlot[];
  /** Svítící místa, která ještě chybí (jen další patro / další v řadě). */
  next: PlanSlot[];
  done: boolean;
}

const ok = (w: World, s: PlanSlot) => {
  const t = w.get(s.pos);
  return t !== undefined && (s.block === null || t === s.block);
};

/** Stavba zespodu (sněhulák, věž): počítá se souvislá řada odspodu. */
export function stackStatus(w: World, slots: PlanSlot[]): PlanStatus {
  let filled = 0;
  while (filled < slots.length && ok(w, slots[filled])) filled++;
  const wrong = slots.filter((s) => w.has(s.pos) && !ok(w, s));
  const next = filled < slots.length && !w.has(slots[filled].pos) ? [slots[filled]] : [];
  return { filled, total: slots.length, wrong, next, done: filled === slots.length };
}

/** Řada se vzorem: každé místo zvlášť. */
export function rowStatus(w: World, slots: PlanSlot[]): PlanStatus {
  const filled = slots.filter((s) => ok(w, s)).length;
  const wrong = slots.filter((s) => w.has(s.pos) && !ok(w, s));
  const next = slots.filter((s) => !w.has(s.pos));
  return { filled, total: slots.length, wrong, next, done: filled === slots.length };
}

/** Položí do světa dané kostky vzoru (začátek mise „Dokonči řadu“). */
export function placePatternStart(w: World): void {
  for (const s of patternSlots().slice(0, ICE_PLANS.pattern.given)) {
    w.deleteRaw(s.pos);
    w.setRaw(s.pos, s.block!);
  }
}

/** Sněhové koule s čísly 1–5: vrátí pozice (index = číslo − 1) v náhodném pořadí. */
export function placeNumberBalls(w: World, rng: () => number): Vec3[] {
  const spots = [...ICE_PLANS.numberSpots];
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return spots.map((p) => {
    // když je místo zastavěné, koule se postaví navrch
    let y = p.y;
    while (y < WORLD_H - 1 && w.has({ ...p, y }) && w.get({ ...p, y }) !== 'snow') y++;
    const q = { ...p, y };
    w.setRaw(q, 'snow');
    return q;
  });
}
