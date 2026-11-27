import { describe, expect, it } from 'vitest';
import { findPath, reachableCells } from './pathfinding';
import { CHARACTER_SPAWN } from './characters';
import { clearToGround, CASTLE, generateDefaultWorld, isRiver, pickQuestionSpot, QUESTION_SPOTS, type Vec3 } from './world';

const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const starts = Object.values(CHARACTER_SPAWN);

describe('nové bedny s otazníkem', () => {
  it('objeví se na dosažitelném místě, jinde než minule, a postavička k nim dojde', () => {
    const w = generateDefaultWorld();
    for (const p of QUESTION_SPOTS) w.remove(p);
    const rng = seeded(3);
    const recent: Vec3[] = [];
    for (let i = 0; i < 6; i++) {
      const reachable = reachableCells(w, starts);
      const spot = pickQuestionSpot(w, { reachable, avoid: starts, recent, rng })!;
      expect(spot).not.toBeNull();
      expect(isRiver(spot.x, spot.z)).toBe(false);
      for (const r of recent) expect(Math.abs(r.x - spot.x) + Math.abs(r.z - spot.z)).toBeGreaterThan(3);
      w.setRaw(spot, 'question');
      // postavička dojde vedle bedny
      const side = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dz]) => findPath(w, starts[0], { x: spot.x + dx, y: 1, z: spot.z + dz }).reached);
      expect(side).toBe(true);
      // bedna nesmí ucpat bránu hradu – na nádvoří se pořád dá dojít
      expect(findPath(w, starts[0], { x: CASTLE.x0 + 2, y: 1, z: CASTLE.z0 + 2 }).reached).toBe(true);
      w.deleteRaw(spot); // dítě úkol vyřešilo
      recent.push(spot);
      if (recent.length > 2) recent.shift();
    }
  });

  it('za řeku bez mostu bednu nedá, i na prázdné louce se místo najde', () => {
    const w = generateDefaultWorld();
    clearToGround(w);
    const reachable = reachableCells(w, starts);
    for (let i = 0; i < 20; i++) {
      const spot = pickQuestionSpot(w, { reachable, avoid: starts, recent: [], rng: seeded(i) })!;
      expect(spot.z).toBeGreaterThan(8); // postavičky jsou na jižním břehu
    }
  });
});

describe('bedny vždy a úkoly pokaždé jiné', () => {
  it('místo pro bednu se najde i v hodně zastavěném světě (pravidla se uvolní)', () => {
    const w = generateDefaultWorld();
    clearToGround(w);
    // postavičky zavřené v malé ohrádce 2×1, zbytek světa nedosažitelný
    const pen = [
      { x: 4, y: 1, z: 12 },
      { x: 5, y: 1, z: 12 },
    ];
    for (let x = 3; x <= 6; x++)
      for (let z = 11; z <= 13; z++) {
        if (pen.some((p) => p.x === x && p.z === z)) continue;
        for (const y of [1, 2, 3]) w.setRaw({ x, y, z }, 'stone');
      }
    const reachable = reachableCells(w, pen);
    const spot = pickQuestionSpot(w, { reachable, avoid: [pen[0]], recent: [], rng: seeded(1) });
    expect(spot).not.toBeNull();
  });

  it('úkoly z beden se neopakují (posledních 8)', async () => {
    const { generateFreshQuiz, quizKey } = await import('./quiz');
    const rng = seeded(11);
    const recent: string[] = [];
    for (let i = 0; i < 60; i++) {
      const q = generateFreshQuiz(i, recent, rng);
      expect(recent).not.toContain(quizKey(q));
      recent.push(quizKey(q));
      if (recent.length > 8) recent.shift();
    }
  });
});
