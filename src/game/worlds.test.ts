import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from './characters';
import { findPath, isStandable, reachableCells } from './pathfinding';
import { DEFAULT_SETTINGS } from './settings';
import { deserialize, serialize } from './storage';
import { generateDefaultWorld, isInsideCastle } from './world';
import { generateIceWorld, ICE_CASTLE, isUnlocked, WORLDS, WORLD_IDS } from './worlds';
import { missionsFor, reduceMission, startMission, numberAt } from './missions';
import { patternToFill, snowmanSlots, towerSlots } from './iceMissions';

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
};

describe('světy', () => {
  it('každý svět: postavičky stojí, k loďce i k postavám se dá dojít', () => {
    for (const id of WORLD_IDS) {
      const def = WORLDS[id];
      const w = def.generate();
      const starts = CHARACTER_IDS.map((c) => def.spawn[c]);
      for (const p of starts) expect(isStandable(w, p), `${id} spawn ${JSON.stringify(p)}`).toBe(true);
      expect(w.get({ ...def.boat.water, y: 0 })).toBe('water');
      expect(findPath(w, starts[0], def.boat.stand).reached, `${id} k loďce`).toBe(true);
      const reach = reachableCells(w, starts);
      for (const npc of def.npcs) {
        const side = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dz]) => reach.has(`${npc.pos.x + dx},1,${npc.pos.z + dz}`));
        expect(side, `${id} k postavě ${npc.kind}`).toBe(true);
      }
      expect(w.count(def.boxBlock)).toBeGreaterThan(0);
    }
  });

  it('Ledové království: sníh, led, ledový hrad s volným nádvořím, dárky', () => {
    const w = generateIceWorld();
    expect(w.count('snow')).toBeGreaterThan(100);
    expect(w.count('ice')).toBeGreaterThan(20);
    expect(w.count('gift')).toBeGreaterThan(0);
    expect(w.count('question')).toBe(0);
    const court = { x: ICE_CASTLE.x0 + 2, y: 1, z: ICE_CASTLE.z0 + 2 };
    expect(isInsideCastle(ICE_CASTLE, court)).toBe(true);
    expect(findPath(w, WORLDS.ice.spawn.ondra, court).reached).toBe(true);
  });

  it('Ledové království se otevře klíčem z ostrova', () => {
    expect(isUnlocked('island', [])).toBe(true);
    expect(isUnlocked('ice', [])).toBe(false);
    expect(isUnlocked('ice', ['island'])).toBe(true);
  });

  it('každý svět má 5 misí', () => {
    expect(missionsFor('island')).toHaveLength(5);
    expect(missionsFor('ice')).toHaveLength(5);
  });
});

describe('mise Ledového království', () => {
  it('sněhulák jen ze sněhu, odspodu', () => {
    const w = generateIceWorld();
    let s = startMission('snowman', w);
    const [a, b, c] = snowmanSlots();
    w.place(a.pos, 'wood');
    expect(reduceMission(s, { kind: 'placed', block: 'wood', pos: a.pos }, w).feedback).toBe('gentle-hint');
    w.remove(a.pos);
    for (const slot of [a, b, c]) {
      w.place(slot.pos, 'snow');
      const r = reduceMission(s, { kind: 'placed', block: 'snow', pos: slot.pos }, w);
      s = r.state;
      expect(r.feedback).toBe(slot === c ? 'complete' : 'progress');
    }
  });

  it('věž z 5 kostek – libovolný materiál', () => {
    const w = generateIceWorld();
    let s = startMission('tower5', w);
    const fb: string[] = [];
    for (const slot of towerSlots()) {
      w.place(slot.pos, 'ice');
      const r = reduceMission(s, { kind: 'placed', block: 'ice', pos: slot.pos }, w);
      s = r.state;
      fb.push(r.feedback);
    }
    expect(fb).toEqual(['progress', 'progress', 'progress', 'progress', 'complete']);
  });

  it('dokonči řadu: led, dřevo, led → dřevo, led, dřevo', () => {
    const w = generateIceWorld();
    let s = startMission('pattern', w);
    const slots = patternToFill();
    expect(slots.map((x) => x.block)).toEqual(['wood', 'ice', 'wood']);
    w.place(slots[0].pos, 'ice');
    expect(reduceMission(s, { kind: 'placed', block: 'ice', pos: slots[0].pos }, w).feedback).toBe('gentle-hint');
    w.remove(slots[0].pos);
    for (const slot of slots) {
      w.place(slot.pos, slot.block!);
      s = reduceMission(s, { kind: 'placed', block: slot.block!, pos: slot.pos }, w).state;
    }
    expect(s.done).toBe(true);
  });

  it('čísla 1–5: jen popořadě, jiné číslo = rada', () => {
    const w = generateIceWorld();
    let s = startMission('numbers', w, seeded(4));
    expect(s.targets).toHaveLength(5);
    const pos = (n: number) => s.targets[n - 1];
    expect(numberAt(s, pos(3))).toBe(3);
    expect(reduceMission(s, { kind: 'numberTap', pos: pos(3) }, w).feedback).toBe('gentle-hint');
    for (let n = 1; n <= 5; n++) {
      const r = reduceMission(s, { kind: 'numberTap', pos: pos(n) }, w);
      s = r.state;
      expect(r.feedback).toBe(n === 5 ? 'complete' : 'progress');
    }
  });

  it('krystaly se schovají a sbírají jako červené kostky', () => {
    const w = generateIceWorld();
    let s = startMission('crystals', w, seeded(2));
    expect(s.targets).toHaveLength(3);
    for (const t of [...s.targets]) {
      w.remove(t);
      s = reduceMission(s, { kind: 'collected', pos: t }, w).state;
    }
    expect(s.done).toBe(true);
  });
});

describe('ukládání více světů', () => {
  it('uloží oba světy a aktuální svět', () => {
    const island = generateDefaultWorld();
    const ice = generateIceWorld();
    ice.place({ x: 5, y: 1, z: 9 }, 'ice');
    const raw = JSON.stringify(
      serialize({
        current: 'ice',
        worlds: {
          island: { world: island, activeMission: null, completed: ['wood5'], characters: [], template: null, meadow: false },
          ice: { world: ice, activeMission: null, completed: ['snowman'], characters: [], template: null, meadow: false },
        },
        settings: DEFAULT_SETTINGS,
        material: 'snow',
        keys: ['island'],
      }),
    );
    const l = deserialize(raw);
    expect(l.current).toBe('ice');
    expect(l.world?.get({ x: 5, y: 1, z: 9 })).toBe('ice');
    expect(l.completed).toEqual(['snowman']);
    expect(l.worlds.island?.completed).toEqual(['wood5']);
    expect(l.keys).toEqual(['island']);
  });
});
