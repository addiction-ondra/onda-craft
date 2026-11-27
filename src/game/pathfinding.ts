import { keyOf, WORLD_D, WORLD_H, WORLD_W, type Vec3, type World } from './world';

/** Kolik kostek umí postavička vylézt nahoru jedním krokem. */
export const MAX_STEP_UP = 1;
/** Z jaké výšky umí seskočit dolů. */
export const MAX_STEP_DOWN = 3;

/**
 * Může tu postavička stát? Pod nohama pevná kostka (ne voda),
 * pole pro tělo i hlavu je volné.
 */
export function isStandable(w: World, p: Vec3): boolean {
  if (p.x < 0 || p.z < 0 || p.x >= WORLD_W || p.z >= WORLD_D) return false;
  if (p.y < 1 || p.y >= WORLD_H - 1) return false;
  if (w.has(p) || w.has({ x: p.x, y: p.y + 1, z: p.z })) return false;
  const below = w.get({ x: p.x, y: p.y - 1, z: p.z });
  return below !== undefined && below !== 'water';
}

/** Nejbližší místo na stání v daném sloupci, hledá se od `fromY` dolů. */
export function dropToStand(w: World, x: number, fromY: number, z: number): Vec3 | null {
  for (let y = Math.min(fromY, WORLD_H - 2); y >= 1; y--) {
    const p = { x, y, z };
    if (isStandable(w, p)) return p;
    if (w.has(p)) return null; // narazili jsme na pevnou kostku – níž se nedostaneme
  }
  return null;
}

function neighbors(w: World, p: Vec3): Vec3[] {
  const out: Vec3[] = [];
  for (const [dx, dz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    const x = p.x + dx;
    const z = p.z + dz;
    // nahoru (lezení po schodu) – hlava nesmí narazit
    for (let dy = MAX_STEP_UP; dy >= 1; dy--) {
      const q = { x, y: p.y + dy, z };
      if (isStandable(w, q) && !w.has({ x: p.x, y: p.y + dy + 1, z: p.z })) {
        out.push(q);
        break;
      }
    }
    // rovně nebo dolů (přes hranu musí projít i hlava)
    if (w.has({ x, y: p.y + 1, z })) continue;
    for (let dy = 0; dy >= -MAX_STEP_DOWN; dy--) {
      const q = { x, y: p.y + dy, z };
      if (w.has(q)) break;
      if (isStandable(w, q)) {
        out.push(q);
        break;
      }
    }
  }
  return out;
}

export interface PathResult {
  /** Kroky od prvního pole za startem až po cíl (start neobsahuje). */
  path: Vec3[];
  /** Došla postavička přesně do cíle? Pokud ne, jde co nejblíž. */
  reached: boolean;
}

/**
 * Najde cestu (BFS) ze `start` do `goal`. Když cíl není dosažitelný,
 * vrátí cestu na nejbližší dosažitelné místo – postavička nikdy „nezamrzne“.
 */
export function findPath(w: World, start: Vec3, goal: Vec3): PathResult {
  const startKey = keyOf(start);
  const goalKey = keyOf(goal);
  const prev = new Map<string, string | null>([[startKey, null]]);
  const nodes = new Map<string, Vec3>([[startKey, start]]);
  const queue: Vec3[] = [start];
  const dist = (p: Vec3) => Math.abs(p.x - goal.x) + Math.abs(p.z - goal.z) + Math.abs(p.y - goal.y) * 0.5;
  let best = start;
  let bestD = dist(start);

  while (queue.length) {
    const cur = queue.shift()!;
    const ck = keyOf(cur);
    if (ck === goalKey) {
      best = cur;
      bestD = 0;
      break;
    }
    const d = dist(cur);
    if (d < bestD) {
      best = cur;
      bestD = d;
    }
    for (const n of neighbors(w, cur)) {
      const nk = keyOf(n);
      if (prev.has(nk)) continue;
      prev.set(nk, ck);
      nodes.set(nk, n);
      queue.push(n);
    }
  }

  const path: Vec3[] = [];
  let k: string | null = keyOf(best);
  while (k && k !== startKey) {
    path.unshift(nodes.get(k)!);
    k = prev.get(k) ?? null;
  }
  return { path, reached: keyOf(best) === goalKey };
}

/**
 * Z ťuknutí na kostku (pozice + stěna) spočítá místo, kam má postavička dojít.
 * Ťuknutí na vrch kostky = stoupnout si na ni. Ťuknutí na bok = stoupnout si vedle.
 */
export function walkGoalFromTap(w: World, pos: Vec3, normal: Vec3): Vec3 {
  if (normal.y === 1) return { x: pos.x, y: pos.y + 1, z: pos.z };
  const side = { x: pos.x + normal.x, y: pos.y + Math.max(0, normal.y), z: pos.z + normal.z };
  return dropToStand(w, side.x, side.y, side.z) ?? { x: pos.x, y: pos.y + 1, z: pos.z };
}
