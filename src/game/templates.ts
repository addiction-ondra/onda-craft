import type { BlockType } from './blocks';
import { inBounds, WORLD_D, WORLD_W, type Vec3, type World } from './world';

/**
 * Režim Stavitel: šablony staveb. Funguje jako domeček pro Freného –
 * svítící kostky ukazují, kam stavět, staví se zespodu po vrstvách.
 * Šablony jsou malé (16–30 kostek), aby je čtyřleté dítě dokončilo.
 */
export type TemplateId = 'castle' | 'house' | 'farm';
export const TEMPLATE_IDS: TemplateId[] = ['castle', 'house', 'farm'];

export interface TemplatePart {
  pos: Vec3;
  block: BlockType;
}

export interface TemplateDef {
  id: TemplateId;
  /** Půdorys (x × z). */
  w: number;
  d: number;
  /** Díly relativně k rohu (y od 1 = první vrstva nad zemí). */
  parts: TemplatePart[];
  /** Pole před vchodem (relativně) – musí na něm jít stát, jinak se do stavby nedá vejít. */
  entrance: { x: number; z: number };
}

const ring = (w: number, d: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let x = 0; x < w; x++)
    for (let z = 0; z < d; z++) if (x === 0 || z === 0 || x === w - 1 || z === d - 1) out.push([x, z]);
  return out;
};

/** Hrad 4×4: kamenné hradby 2 vysoké, brána vpředu, věže v rozích se střechou. */
function castle(): TemplateDef {
  const w = 4;
  const d = 4;
  const parts: TemplatePart[] = [];
  const corner = (x: number, z: number) => (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
  for (const [x, z] of ring(w, d)) {
    const gate = z === d - 1 && x === 1;
    for (const y of [1, 2]) if (!gate) parts.push({ pos: { x, y, z }, block: 'stone' });
    if (corner(x, z)) {
      parts.push({ pos: { x, y: 3, z }, block: 'stone' });
      parts.push({ pos: { x, y: 4, z }, block: 'roof' });
    }
  }
  return { id: 'castle', w, d, parts, entrance: { x: 1, z: d } };
}

/** Domeček 3×3: zdi 2 vysoké s dveřmi, plochá střecha, komín. */
function house(): TemplateDef {
  const w = 3;
  const d = 3;
  const parts: TemplatePart[] = [];
  for (const [x, z] of ring(w, d)) {
    const door = z === d - 1 && x === 1;
    for (const y of [1, 2]) if (!door) parts.push({ pos: { x, y, z }, block: 'wall' });
  }
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) parts.push({ pos: { x, y: 3, z }, block: 'roof' });
  parts.push({ pos: { x: 0, y: 4, z: 0 }, block: 'red' }); // komín
  return { id: 'house', w, d, parts, entrance: { x: 1, z: d } };
}

/** Farma: dřevěná ohrada s vrátky, uvnitř seno a napajedlo. */
function farm(): TemplateDef {
  const w = 5;
  const d = 4;
  const parts: TemplatePart[] = [];
  for (const [x, z] of ring(w, d)) {
    const gate = z === d - 1 && x === 2;
    if (!gate) parts.push({ pos: { x, y: 1, z }, block: 'wood' });
  }
  parts.push({ pos: { x: 1, y: 1, z: 1 }, block: 'sand' }); // seno
  parts.push({ pos: { x: 1, y: 2, z: 1 }, block: 'sand' });
  parts.push({ pos: { x: 3, y: 1, z: 1 }, block: 'blue' }); // napajedlo
  return { id: 'farm', w, d, parts, entrance: { x: 2, z: d } };
}

export const TEMPLATES: Record<TemplateId, TemplateDef> = { castle: castle(), house: house(), farm: farm() };

export const templateHeight = (t: TemplateDef): number => Math.max(...t.parts.map((p) => p.pos.y));

/** Díly šablony na skutečných souřadnicích. */
export function absoluteParts(id: TemplateId, origin: Vec3): TemplatePart[] {
  return TEMPLATES[id].parts.map((p) => ({ block: p.block, pos: { x: origin.x + p.pos.x, y: p.pos.y, z: origin.z + p.pos.z } }));
}

/** Je tady na šablonu místo? Pevná zem (ne voda) a volný prostor nad ní. */
export function fitsAt(w: World, id: TemplateId, x0: number, z0: number): boolean {
  const t = TEMPLATES[id];
  const h = templateHeight(t);
  for (let x = x0; x < x0 + t.w; x++)
    for (let z = z0; z < z0 + t.d; z++) {
      if (!inBounds({ x, y: 0, z })) return false;
      const ground = w.get({ x, y: 0, z });
      if (ground === undefined || ground === 'water') return false;
      for (let y = 1; y <= h + 1; y++) if (w.has({ x, y, z })) return false;
    }
  // před vchodem musí být pevná zem a volno pro postavičku
  const ex = x0 + t.entrance.x;
  const ez = z0 + t.entrance.z;
  if (!inBounds({ x: ex, y: 0, z: ez })) return false;
  const eg = w.get({ x: ex, y: 0, z: ez });
  if (eg === undefined || eg === 'water' || w.has({ x: ex, y: 1, z: ez }) || w.has({ x: ex, y: 2, z: ez })) return false;
  return true;
}

/** Najde volné místo co nejblíž středu ostrova (nebo `near`). null = není místo. */
export function findTemplateSpot(w: World, id: TemplateId, near: Vec3 = { x: WORLD_W / 2, y: 1, z: WORLD_D / 2 }): Vec3 | null {
  const t = TEMPLATES[id];
  let best: Vec3 | null = null;
  let bestD = Infinity;
  for (let x0 = 0; x0 + t.w <= WORLD_W; x0++)
    for (let z0 = 0; z0 + t.d <= WORLD_D; z0++) {
      if (!fitsAt(w, id, x0, z0)) continue;
      const cx = x0 + t.w / 2;
      const cz = z0 + t.d / 2;
      const dist = Math.abs(cx - near.x) + Math.abs(cz - near.z);
      if (dist < bestD) {
        bestD = dist;
        best = { x: x0, y: 1, z: z0 };
      }
    }
  return best;
}

export interface TemplateStatus {
  filled: number;
  total: number;
  /** Svítící místa: nejnižší vrstva, která ještě není hotová. */
  nextLayer: TemplatePart[];
  done: boolean;
}

export function templateStatus(w: World, id: TemplateId, origin: Vec3): TemplateStatus {
  const parts = absoluteParts(id, origin);
  const missing = parts.filter((p) => !w.has(p.pos));
  const lowest = missing.length ? Math.min(...missing.map((p) => p.pos.y)) : 0;
  return {
    filled: parts.length - missing.length,
    total: parts.length,
    nextLayer: missing.filter((p) => p.pos.y === lowest),
    done: missing.length === 0,
  };
}

/** Jaký materiál patří na dané místo šablony (null = není součástí šablony). */
export function templateBlockAt(id: TemplateId, origin: Vec3, pos: Vec3): BlockType | null {
  const p = absoluteParts(id, origin).find((q) => q.pos.x === pos.x && q.pos.y === pos.y && q.pos.z === pos.z);
  return p ? p.block : null;
}
