import { describe, expect, it } from 'vitest';
import { findPath, isStandable, reachableCells } from './pathfinding';
import { generatePirateWorld, isUnlocked, PIRATE_PLANS, WORLDS } from './worlds';
import { isPlanMission, missionsFor, planSlots, reduceMission, startMission } from './missions';
import { flagsToFill, mastSlots, pierSlots, squareSlots } from './pirateMissions';
import { treasureReady, TREASURE_FOUND, worldKeys } from './rewards';
import type { MissionState } from './missions';
import type { World } from './world';

const seeded = (seed: number) => {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
};

/** Položí kostku a pošle událost do reduceru. */
const place = (w: World, st: MissionState, pos: { x: number; y: number; z: number }, block: 'wood' | 'red' | 'sand' | 'stone') => {
  w.setRaw(pos, block);
  return reduceMission(st, { kind: 'placed', block, pos }, w);
};

describe('Pirátský ostrov', () => {
  it('písek, tráva, palmy, laguna a sudy místo beden', () => {
    const w = generatePirateWorld();
    expect(w.count('sand')).toBeGreaterThan(60);
    expect(w.count('water')).toBeGreaterThan(15);
    expect(w.count('barrel')).toBeGreaterThan(0);
    expect(w.count('question')).toBe(0);
    expect(w.count('gift')).toBe(0);
  });

  it('otevře se klíčem z Ledového království', () => {
    expect(isUnlocked('pirate', ['island'])).toBe(false);
    expect(isUnlocked('pirate', ['island', 'ice'])).toBe(true);
  });

  it('5 misí, všechna svítící místa jsou volná a dá se k nim dojít', () => {
    expect(missionsFor('pirate').map((m) => m.id)).toEqual(['coins', 'mast', 'flags', 'square', 'pier']);
    const w = generatePirateWorld();
    const reach = reachableCells(w, [WORLDS.pirate.spawn.ondra]);
    for (const m of missionsFor('pirate')) {
      if (!isPlanMission(m.id)) continue;
      for (const s of planSlots(m.id)) expect(w.has(s.pos), `${m.id} ${JSON.stringify(s.pos)} volné`).toBe(false);
    }
    // stožár a čtverec stojí na zemi, kam se dá dojít
    for (const s of [...mastSlots().slice(0, 1), ...squareSlots()]) expect(reach.has(`${s.pos.x},1,${s.pos.z}`), JSON.stringify(s.pos)).toBe(true);
    // molo vede od břehu nad vodu
    for (const s of pierSlots()) expect(w.get({ ...s.pos, y: 0 })).toBe('water');
    expect(reach.has(`${pierSlots()[0].pos.x + 1},1,${pierSlots()[0].pos.z}`)).toBe(true);
  });

  it('k červenému X pod palmou se dá dojít', () => {
    const w = generatePirateWorld();
    const x = WORLDS.pirate.treasureX!;
    expect(isStandable(w, x)).toBe(true);
    expect(findPath(w, WORLDS.pirate.spawn.ondra, x).reached).toBe(true);
  });

  it('stožár jen ze dřeva, odspodu – 4 kostky', () => {
    const w = generatePirateWorld();
    let st = startMission('mast', w);
    const [a, b, c, d] = mastSlots().map((s) => s.pos);
    let r = place(w, st, a, 'stone');
    expect(r.feedback).toBe('gentle-hint');
    w.deleteRaw(a);
    st = r.state;
    for (const p of [a, b, c]) {
      r = place(w, st, p, 'wood');
      expect(r.feedback).toBe('progress');
      st = r.state;
    }
    r = place(w, st, d, 'wood');
    expect(r.feedback).toBe('complete');
  });

  it('vlajky: červená, písek, červená → písek, červená, písek', () => {
    const w = generatePirateWorld();
    let st = startMission('flags', w);
    const first = { x: PIRATE_PLANS.flags.x0, y: 1, z: PIRATE_PLANS.flags.z };
    expect(w.get(first)).toBe('red');
    const todo = flagsToFill();
    let r = place(w, st, todo[0].pos, 'red');
    expect(r.feedback).toBe('gentle-hint');
    w.deleteRaw(todo[0].pos);
    st = r.state;
    for (const s of todo) {
      r = place(w, st, s.pos, s.block as 'red' | 'sand');
      st = r.state;
    }
    expect(r.feedback).toBe('complete');
  });

  it('čtverec z 8 kostek (jakýkoli materiál) a molo ze 3 prken', () => {
    const w = generatePirateWorld();
    let st = startMission('square', w);
    let r = { state: st, feedback: 'none' as string };
    for (const s of squareSlots()) {
      r = place(w, st, s.pos, 'stone');
      st = r.state;
    }
    expect(r.feedback).toBe('complete');
    st = startMission('pier', w);
    for (const s of pierSlots()) {
      r = place(w, st, s.pos, 'wood');
      st = r.state;
    }
    expect(r.feedback).toBe('complete');
  });

  it('zlaté mince se schovají a sbírají', () => {
    const w = generatePirateWorld();
    let st = startMission('coins', w, seeded(3));
    expect(st.targets).toHaveLength(4);
    for (const t of st.targets) expect(w.get(t)).toBe('gold');
    let r = reduceMission(st, { kind: 'collected', pos: st.targets[0] }, w);
    for (const t of [...st.targets.slice(1)]) {
      r = reduceMission(r.state, { kind: 'collected', pos: t }, w);
    }
    expect(r.feedback).toBe('complete');
    st = r.state;
    expect(st.done).toBe(true);
  });

  it('poklad: X až se všemi třemi klíči, po vykopání už ne', () => {
    expect(treasureReady(['island', 'ice'])).toBe(false);
    expect(treasureReady(['island', 'ice', 'pirate'])).toBe(true);
    expect(treasureReady(['island', 'ice', 'pirate', TREASURE_FOUND])).toBe(false);
    expect(worldKeys(['island', TREASURE_FOUND, 'ice'])).toEqual(['island', 'ice']);
  });
});
