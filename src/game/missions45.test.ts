import { describe, expect, it } from 'vitest';
import { ANIMAL_FOOD, reduceMission, startMission } from './missions';
import { findPath, isStandable } from './pathfinding';
import { generateQuiz, isCorrect, QUIZ_KINDS } from './quiz';
import { deserialize, serialize } from './storage';
import { DEFAULT_SETTINGS } from './settings';
import {
  adjacentQuestionBox,
  DOGHOUSE,
  doghouseParts,
  doghouseStatus,
  generateDefaultWorld,
  QUESTION_SPOTS,
  refillQuestionBoxes,
} from './world';

const seeded = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

describe('mise 4 – nakrm zvířátka', () => {
  it('správné jídlo = pokrok, špatné = jemná nápověda, dvakrát stejné zvířátko se nepočítá', () => {
    const w = generateDefaultWorld();
    let s = startMission('feed', w);
    expect(s.target).toBe(3);
    let r = reduceMission(s, { kind: 'fed', animal: 'sheep', food: 'red' }, w);
    expect(r.feedback).toBe('gentle-hint');
    expect(r.state.progress).toBe(0);
    r = reduceMission(r.state, { kind: 'fed', animal: 'sheep', food: ANIMAL_FOOD.sheep }, w);
    expect(r.feedback).toBe('progress');
    r = reduceMission(r.state, { kind: 'fed', animal: 'sheep', food: ANIMAL_FOOD.sheep }, w);
    expect(r.feedback).toBe('none');
    expect(r.state.progress).toBe(1);
    r = reduceMission(r.state, { kind: 'fed', animal: 'chick', food: 'sand' }, w);
    s = r.state;
    r = reduceMission(s, { kind: 'fed', animal: 'dog', food: 'wood' }, w);
    expect(r.feedback).toBe('complete');
    expect(r.state.fed).toEqual(['sheep', 'chick', 'dog']);
  });

  it('nakrmená zvířátka se uloží', () => {
    const w = generateDefaultWorld();
    const m = reduceMission(startMission('feed', w), { kind: 'fed', animal: 'chick', food: 'sand' }, w).state;
    const raw = JSON.stringify(serialize({ world: w, activeMission: m, completed: [], settings: DEFAULT_SETTINGS, material: 'sand' }));
    expect(deserialize(raw).activeMission?.fed).toEqual(['chick']);
  });
});

describe('mise 5 – domeček pro Freného', () => {
  it('3 stěny + střecha a volné dveře = hotovo', () => {
    const w = generateDefaultWorld();
    let s = startMission('doghouse', w);
    expect(s.progress).toBe(0);
    const parts = doghouseParts();
    for (let i = 0; i < parts.length; i++) {
      w.place(parts[i], i % 2 ? 'stone' : 'wood');
      const r = reduceMission(s, { kind: 'placed', block: 'wood', pos: parts[i] }, w);
      s = r.state;
      expect(r.feedback).toBe(i === parts.length - 1 ? 'complete' : 'progress');
    }
    expect(doghouseStatus(w).done).toBe(true);
  });

  it('zastavěné dveře = rada, ne trest; po odstranění se dá dokončit', () => {
    const w = generateDefaultWorld();
    let s = startMission('doghouse', w);
    w.place(DOGHOUSE.door, 'wood');
    let r = reduceMission(s, { kind: 'placed', block: 'wood', pos: DOGHOUSE.door }, w);
    expect(r.feedback).toBe('gentle-hint');
    s = r.state;
    for (const p of doghouseParts()) w.place(p, 'wood');
    r = reduceMission(s, { kind: 'placed', block: 'wood', pos: DOGHOUSE.roof }, w);
    expect(r.state.done).toBe(false);
    w.remove(DOGHOUSE.door);
    r = reduceMission(r.state, { kind: 'removed', block: 'wood', pos: DOGHOUSE.door }, w);
    expect(r.feedback).toBe('complete');
  });

  it('pejsek (nízký) do domečku vleze, děti (vysoké) ne', () => {
    const w = generateDefaultWorld();
    for (const p of doghouseParts()) w.place(p, 'wood');
    const from = { x: 5, y: 1, z: 11 };
    expect(isStandable(w, DOGHOUSE.inside, 1)).toBe(true);
    expect(isStandable(w, DOGHOUSE.inside, 2)).toBe(false);
    expect(findPath(w, from, DOGHOUSE.inside, 1).reached).toBe(true);
    expect(findPath(w, from, DOGHOUSE.inside, 2).reached).toBe(false);
  });
});

describe('bedny s otazníkem', () => {
  it('výchozí svět má bedny a po otevření všech se doplní nové', () => {
    const w = generateDefaultWorld();
    expect(w.count('question')).toBe(QUESTION_SPOTS.length);
    expect(refillQuestionBoxes(w)).toBe(0); // ještě jsou
    for (const p of QUESTION_SPOTS) w.remove(p);
    expect(refillQuestionBoxes(w)).toBe(QUESTION_SPOTS.length);
  });

  it('k bedně u startu a na nádvoří se dá dojít, k té za řekou až po mostě', () => {
    const w = generateDefaultWorld();
    const start = { x: 15, y: 1, z: 12 };
    const near = (box: { x: number; y: number; z: number }) =>
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dz]) => findPath(w, start, { x: box.x + dx, y: box.y, z: box.z + dz }).reached);
    expect(near(QUESTION_SPOTS[0])).toBe(true);
    expect(near(QUESTION_SPOTS[1])).toBe(true);
    expect(near(QUESTION_SPOTS[2])).toBe(false);
    w.place({ x: 14, y: 1, z: 7 }, 'wood');
    w.place({ x: 14, y: 1, z: 8 }, 'wood');
    expect(near(QUESTION_SPOTS[2])).toBe(true);
  });

  it('postavička vedle bedny ji „najde“', () => {
    const w = generateDefaultWorld();
    expect(adjacentQuestionBox(w, { x: 15, y: 1, z: 14 })).toEqual(QUESTION_SPOTS[0]);
    expect(adjacentQuestionBox(w, { x: 12, y: 1, z: 12 })).toBeNull();
  });
});

describe('úkoly z beden', () => {
  it('vždy 3 různé možnosti, právě jedna správná; druhy se střídají', () => {
    const rng = seeded(7);
    const kinds = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const q = generateQuiz(i, rng);
      kinds.add(q.kind);
      expect(q.options).toHaveLength(3);
      expect(new Set(q.options).size).toBe(3);
      expect(q.options.filter((o) => isCorrect(q, o))).toHaveLength(1);
      if (q.kind === 'count') {
        expect(Number(q.answer)).toBeGreaterThanOrEqual(1);
        expect(Number(q.answer)).toBeLessThanOrEqual(5);
        expect(q.item).toBeDefined();
      }
    }
    expect(kinds.size).toBe(QUIZ_KINDS.length);
    expect(generateQuiz(0, rng).kind).not.toBe(generateQuiz(1, rng).kind);
  });
});
