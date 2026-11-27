import { describe, expect, it } from 'vitest';
import { awardKey, allMissionsDone, WORLD_ID } from './rewards';
import { DEFAULT_SETTINGS } from './settings';
import { deserialize, serialize } from './storage';
import { absoluteParts, findTemplateSpot, fitsAt, TEMPLATE_IDS, TEMPLATES, templateBlockAt, templateStatus } from './templates';
import { clearToGround, generateDefaultWorld, isRiver, WORLD_D, WORLD_W } from './world';
import { findPath, isStandable } from './pathfinding';

describe('prázdná louka', () => {
  it('smaže všechno nad zemí, zem a řeka zůstanou', () => {
    const w = generateDefaultWorld();
    clearToGround(w);
    expect(w.size).toBe(WORLD_W * WORLD_D);
    for (let x = 0; x < WORLD_W; x++)
      for (let z = 0; z < WORLD_D; z++) expect(w.get({ x, y: 0, z }) === 'water').toBe(isRiver(x, z));
  });
});

describe('šablony Stavitele', () => {
  it('jsou malé a hratelné (do 30 kostek)', () => {
    for (const id of TEMPLATE_IDS) {
      expect(TEMPLATES[id].parts.length).toBeGreaterThanOrEqual(10);
      expect(TEMPLATES[id].parts.length).toBeLessThanOrEqual(30);
    }
  });

  it('na prázdné louce se najde místo pro každou šablonu, mimo řeku', () => {
    const w = generateDefaultWorld();
    clearToGround(w);
    for (const id of TEMPLATE_IDS) {
      const o = findTemplateSpot(w, id)!;
      expect(o).not.toBeNull();
      expect(fitsAt(w, id, o.x, o.z)).toBe(true);
      for (const p of absoluteParts(id, o)) expect(isRiver(p.pos.x, p.pos.z)).toBe(false);
    }
  });

  it('staví se po vrstvách zespodu, hotovo po vyplnění všech dílů', () => {
    const w = generateDefaultWorld();
    clearToGround(w);
    const o = findTemplateSpot(w, 'castle')!;
    let st = templateStatus(w, 'castle', o);
    expect(st.filled).toBe(0);
    expect(st.nextLayer.every((p) => p.pos.y === 1)).toBe(true);
    let guard = 0;
    while (!st.done && guard++ < 100) {
      const part = st.nextLayer[0];
      w.place(part.pos, part.block);
      st = templateStatus(w, 'castle', o);
    }
    expect(st.done).toBe(true);
    expect(templateBlockAt('castle', o, { x: o.x, y: 4, z: o.z })).toBe('roof');
  });

  it('do hotového hradu a domečku se dá dojít branou/dveřmi', () => {
    for (const id of ['castle', 'house'] as const) {
      const w = generateDefaultWorld();
      clearToGround(w);
      const o = findTemplateSpot(w, id)!;
      for (const p of absoluteParts(id, o)) w.setRaw(p.pos, p.block);
      const inside = { x: o.x + 1, y: 1, z: o.z + 1 };
      const outside = { x: o.x + TEMPLATES[id].entrance.x, y: 1, z: o.z + TEMPLATES[id].entrance.z };
      expect(isStandable(w, outside), `${id} před vchodem ${JSON.stringify(outside)}`).toBe(true);
      expect(findPath(w, outside, inside).reached, `${id} dovnitř`).toBe(true);
    }
  });
});

describe('klíč k pokladu', () => {
  it('za všechny úkoly přesně jeden klíč', () => {
    expect(allMissionsDone(['wood5', 'findRed'])).toBe(false);
    const all = ['wood5', 'findRed', 'bridge', 'feed', 'doghouse'] as const;
    const r1 = awardKey([], [...all]);
    expect(r1).toEqual({ keys: [WORLD_ID], awarded: true });
    expect(awardKey(r1.keys, [...all]).awarded).toBe(false);
    expect(awardKey([], ['wood5']).awarded).toBe(false);
  });

  it('klíče a rozestavěná šablona se uloží', () => {
    const w = generateDefaultWorld();
    const raw = JSON.stringify(
      serialize({ world: w, activeMission: null, completed: [], settings: DEFAULT_SETTINGS, material: 'wood', keys: [WORLD_ID], template: { id: 'farm', origin: { x: 2, y: 1, z: 3 } } }),
    );
    const l = deserialize(raw);
    expect(l.keys).toEqual([WORLD_ID]);
    expect(l.template).toEqual({ id: 'farm', origin: { x: 2, y: 1, z: 3 } });
  });

  it('uložení z verze 2 se načte (bez klíčů)', () => {
    const w = generateDefaultWorld();
    const v2 = { ...serialize({ world: w, activeMission: null, completed: ['wood5'], settings: DEFAULT_SETTINGS, material: 'wood' }), version: 2 } as Record<string, unknown>;
    delete v2.keys;
    delete v2.template;
    const l = deserialize(JSON.stringify(v2));
    expect(l.world?.size).toBe(w.size);
    expect(l.keys).toEqual([]);
    expect(l.completed).toEqual(['wood5']);
  });
});

describe('truhla a kamarádi', () => {
  it('počítá zbývající úkoly do klíče', async () => {
    const { missionsLeft } = await import('./rewards');
    expect(missionsLeft([])).toBe(5);
    expect(missionsLeft(['wood5', 'bridge'])).toBe(3);
    expect(missionsLeft(['wood5', 'findRed', 'bridge', 'feed', 'doghouse'])).toBe(0);
  });

  it('Ondra a Laura se potkají, když stojí vedle sebe', async () => {
    const { areNeighbors } = await import('./characters');
    expect(areNeighbors({ x: 3, y: 1, z: 3 }, { x: 4, y: 1, z: 3 })).toBe(true);
    expect(areNeighbors({ x: 3, y: 1, z: 3 }, { x: 4, y: 1, z: 4 })).toBe(false);
    expect(areNeighbors({ x: 3, y: 1, z: 3 }, { x: 3, y: 4, z: 4 })).toBe(false);
  });
});
