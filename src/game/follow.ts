import { isStandable } from './pathfinding';
import type { Vec3, World } from './world';

/**
 * Frený chodí za dětmi. Tady se jen počítá, KAM se má postavit (čistá logika, bez renderu).
 */

/** Jak daleko (kroky po mřížce) smí Frený od dítěte zůstat, než se rozběhne za ním. */
export const FOLLOW_DISTANCE = 2;

const gridDist = (a: Vec3, b: Vec3) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);

/** Je Frený dost blízko dítěte (a ve stejné výšce ±1)? */
export function closeEnough(leader: Vec3, follower: Vec3): boolean {
  return gridDist(leader, follower) <= FOLLOW_DISTANCE && Math.abs(leader.y - follower.y) <= 1;
}

/**
 * Místa vedle dítěte, kam se může pejsek postavit – seřazená od nejbližšího k pejskovi
 * (aby neběhal zbytečně kolem dítěte). Vynechá obsazená místa (děti, postavy, loďka).
 */
export function followSpots(w: World, leader: Vec3, follower: Vec3, occupied: Vec3[]): Vec3[] {
  const taken = (x: number, z: number) => occupied.some((o) => o.x === x && o.z === z);
  const out: Vec3[] = [];
  for (let dx = -FOLLOW_DISTANCE; dx <= FOLLOW_DISTANCE; dx++)
    for (let dz = -FOLLOW_DISTANCE; dz <= FOLLOW_DISTANCE; dz++) {
      const d = Math.abs(dx) + Math.abs(dz);
      if (d === 0 || d > FOLLOW_DISTANCE) continue;
      const x = leader.x + dx;
      const z = leader.z + dz;
      if (taken(x, z)) continue;
      const y = w.standLevel(x, z, leader.y);
      if (y === null || Math.abs(y - leader.y) > 1) continue;
      const p = { x, y, z };
      if (isStandable(w, p, 1)) out.push(p);
    }
  // nejdřív hned vedle dítěte, pak nejblíž k pejskovi
  return out.sort((a, b) => gridDist(a, leader) - gridDist(b, leader) || gridDist(a, follower) - gridDist(b, follower));
}
