import { describe, expect, it } from 'vitest';
import { closeEnough, followSpots } from './follow';
import { World } from './world';
import { generateIceWorld, WORLDS } from './worlds';
import { findPath } from './pathfinding';

const flat = () => {
  const w = new World();
  for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) w.setRaw({ x, y: 0, z }, 'grass');
  return w;
};

describe('Frený chodí za dětmi', () => {
  it('blízko dítěte = nemusí nikam', () => {
    expect(closeEnough({ x: 5, y: 1, z: 5 }, { x: 6, y: 1, z: 6 })).toBe(true);
    expect(closeEnough({ x: 5, y: 1, z: 5 }, { x: 9, y: 1, z: 5 })).toBe(false);
  });

  it('místo hned vedle dítěte, ne na dítěti ani na kamarádovi', () => {
    const w = flat();
    const leader = { x: 5, y: 1, z: 5 };
    const friend = { x: 4, y: 1, z: 5 };
    const spots = followSpots(w, leader, { x: 0, y: 1, z: 5 }, [leader, friend]);
    expect(spots.length).toBeGreaterThan(0);
    expect(spots[0]).not.toEqual(friend);
    expect(Math.abs(spots[0].x - 5) + Math.abs(spots[0].z - 5)).toBe(1);
    expect(spots.some((s) => s.x === 5 && s.z === 5)).toBe(false);
  });

  it('nevleze do vody ani do zdi', () => {
    const w = flat();
    w.setRaw({ x: 6, y: 0, z: 5 }, 'water');
    w.setRaw({ x: 5, y: 1, z: 6 }, 'stone');
    w.setRaw({ x: 5, y: 2, z: 6 }, 'stone');
    const spots = followSpots(w, { x: 5, y: 1, z: 5 }, { x: 9, y: 1, z: 5 }, []);
    expect(spots.some((s) => s.x === 6 && s.z === 5)).toBe(false);
    expect(spots.some((s) => s.x === 5 && s.z === 6)).toBe(false);
  });

  it('v obou světech dojde Frený ke startu dětí', () => {
    for (const id of ['island', 'ice'] as const) {
      const def = WORLDS[id];
      const w = id === 'ice' ? generateIceWorld() : def.generate();
      const dog = def.animals.find((a) => a.kind === 'dog');
      expect(dog, `Frený je v ${id}`).toBeTruthy();
      const spots = followSpots(w, def.spawn.ondra, dog!.pos, [def.spawn.ondra, def.spawn.lauriska]);
      expect(spots.length).toBeGreaterThan(0);
      expect(findPath(w, dog!.pos, spots[0], 1).reached).toBe(true);
    }
  });
});
