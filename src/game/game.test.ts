import { describe, expect, it } from 'vitest';
import { PALETTE, BLOCK_TYPES } from './blocks';
import { isMissionTarget, reduceMission, restoreMission, startMission, type MissionState } from './missions';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';
import { deserialize, saveToStorage, loadFromStorage, serialize, SAVE_KEY } from './storage';
import { generateDefaultWorld, hasBridge, World, WORLD_D, WORLD_H, WORLD_W, isRiver } from './world';

const seq = (...vals: number[]) => {
  let i = 0;
  return () => vals[i++ % vals.length];
};

class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  clear() {
    this.m.clear();
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('bloky', () => {
  it('paleta má přesně 6 stavebních materiálů', () => {
    expect(PALETTE).toHaveLength(6);
    expect(new Set(PALETTE).size).toBe(6);
  });
  it('pořadí typů zůstává stabilní (kvůli uloženým hrám)', () => {
    expect(BLOCK_TYPES.slice(0, 6)).toEqual(['grass', 'wood', 'stone', 'red', 'sand', 'blue']);
  });
});

describe('svět', () => {
  it('výchozí svět má terén 16×16 s řekou', () => {
    const w = generateDefaultWorld();
    for (let x = 0; x < WORLD_W; x++)
      for (let z = 0; z < WORLD_D; z++) {
        const t = w.get({ x, y: 0, z });
        expect(t).toBeDefined();
        if (isRiver(x, z)) expect(t).toBe('water');
        else expect(t).not.toBe('water');
      }
    expect(w.count('log')).toBeGreaterThan(0);
    expect(w.count('wall')).toBeGreaterThan(0);
    expect(hasBridge(w)).toBe(false);
  });

  it('pokládání respektuje hranice a obsazená pole', () => {
    const w = generateDefaultWorld();
    expect(w.place({ x: 5, y: 1, z: 5 }, 'wood')).toBe('ok');
    expect(w.place({ x: 5, y: 1, z: 5 }, 'wood')).toBe('occupied');
    expect(w.place({ x: -1, y: 1, z: 5 }, 'wood')).toBe('out-of-bounds');
    expect(w.place({ x: 16, y: 1, z: 5 }, 'wood')).toBe('out-of-bounds');
    expect(w.place({ x: 5, y: WORLD_H, z: 5 }, 'wood')).toBe('too-high');
    expect(w.place({ x: 5, y: 0, z: 5 }, 'wood')).toBe('out-of-bounds');
  });

  it('terén nejde odstranit, postavené kostky ano', () => {
    const w = generateDefaultWorld();
    expect(w.remove({ x: 3, y: 0, z: 3 })).toBe('ground');
    w.place({ x: 5, y: 1, z: 5 }, 'stone');
    expect(w.remove({ x: 5, y: 1, z: 5 })).toBe('ok');
    expect(w.remove({ x: 5, y: 1, z: 5 })).toBe('empty');
  });

  it('verze se zvyšuje při změně', () => {
    const w = new World();
    const v = w.version;
    w.place({ x: 1, y: 1, z: 1 }, 'red');
    expect(w.version).toBeGreaterThan(v);
  });

  it('zvířátko nestojí na vodě a vyleze na kostku', () => {
    const w = generateDefaultWorld();
    expect(w.standLevel(5, 7, 1)).toBeNull();
    expect(w.standLevel(5, 5, 1)).toBe(1);
    w.place({ x: 5, y: 1, z: 5 }, 'stone');
    expect(w.standLevel(5, 5, 1)).toBe(2);
  });
});

describe('mise 1 – 5 dřevěných kostek', () => {
  it('počítá jen dřevo, jiný materiál = jemná nápověda', () => {
    const w = generateDefaultWorld();
    let s = startMission('wood5', w);
    const r1 = reduceMission(s, { kind: 'placed', block: 'stone', pos: { x: 1, y: 1, z: 1 } }, w);
    expect(r1.feedback).toBe('gentle-hint');
    expect(r1.state.progress).toBe(0);
    s = r1.state;
    for (let i = 0; i < 4; i++) {
      const r = reduceMission(s, { kind: 'placed', block: 'wood', pos: { x: i, y: 1, z: 4 } }, w);
      expect(r.feedback).toBe('progress');
      s = r.state;
    }
    // odebrání nesnižuje pokrok
    s = reduceMission(s, { kind: 'removed', block: 'wood', pos: { x: 0, y: 1, z: 4 } }, w).state;
    expect(s.progress).toBe(4);
    const last = reduceMission(s, { kind: 'placed', block: 'wood', pos: { x: 9, y: 1, z: 4 } }, w);
    expect(last.feedback).toBe('complete');
    expect(last.state.done).toBe(true);
  });
});

describe('mise 2 – najdi 3 červené kostky', () => {
  it('schová 3 červené kostky a sbírá je', () => {
    const w = generateDefaultWorld();
    const before = w.count('red');
    let s = startMission('findRed', w, seq(0.1, 0.5, 0.9, 0.3));
    expect(s.target).toBe(3);
    expect(s.targets).toHaveLength(3);
    expect(w.count('red')).toBe(before + 3);
    for (const t of s.targets) expect(isMissionTarget(s, t)).toBe(true);

    const notTarget = reduceMission(s, { kind: 'collected', pos: { x: 0, y: 9, z: 0 } }, w);
    expect(notTarget.feedback).toBe('none');

    const targets = [...s.targets];
    const fb: string[] = [];
    for (const t of targets) {
      w.remove(t);
      const r = reduceMission(s, { kind: 'collected', pos: t }, w);
      fb.push(r.feedback);
      s = r.state;
    }
    expect(fb).toEqual(['progress', 'progress', 'complete']);
    expect(s.done).toBe(true);
  });

  it('po načtení vrátí chybějící cíle do světa', () => {
    const w = generateDefaultWorld();
    const s = startMission('findRed', w, seq(0.2));
    w.remove(s.targets[0]);
    restoreMission(s, w);
    expect(w.get(s.targets[0])).toBe('red');
  });
});

describe('mise 3 – most přes řeku', () => {
  it('splní se, až kostky překryjí oba řádky řeky', () => {
    const w = generateDefaultWorld();
    let s: MissionState = startMission('bridge', w);
    expect(s.progress).toBe(0);
    w.place({ x: 6, y: 1, z: 7 }, 'wood');
    let r = reduceMission(s, { kind: 'placed', block: 'wood', pos: { x: 6, y: 1, z: 7 } }, w);
    expect(r.feedback).toBe('progress');
    expect(r.state.progress).toBe(1);
    s = r.state;
    // kostka jinde most nedokončí
    w.place({ x: 2, y: 1, z: 8 }, 'wood');
    r = reduceMission(s, { kind: 'placed', block: 'wood', pos: { x: 2, y: 1, z: 8 } }, w);
    expect(r.state.done).toBe(false);
    s = r.state;
    w.place({ x: 6, y: 1, z: 8 }, 'stone');
    r = reduceMission(s, { kind: 'placed', block: 'stone', pos: { x: 6, y: 1, z: 8 } }, w);
    expect(r.feedback).toBe('complete');
  });
});

describe('ukládání', () => {
  it('serializace a načtení zachová svět, misi i nastavení', () => {
    const w = generateDefaultWorld();
    w.place({ x: 3, y: 1, z: 3 }, 'blue');
    const mission = startMission('wood5', w);
    const storage = new MemoryStorage();
    const settings = { ...DEFAULT_SETTINGS, voice: false };
    expect(saveToStorage(storage, { world: w, activeMission: mission, completed: ['bridge'], settings, material: 'red' })).toBe(true);
    const loaded = loadFromStorage(storage);
    expect(loaded.world?.size).toBe(w.size);
    expect(loaded.world?.get({ x: 3, y: 1, z: 3 })).toBe('blue');
    expect(loaded.activeMission?.id).toBe('wood5');
    expect(loaded.completed).toEqual(['bridge']);
    expect(loaded.settings.voice).toBe(false);
    expect(loaded.material).toBe('red');
  });

  it('poškozená data hru neshodí', () => {
    expect(deserialize('{nonsense').world).toBeNull();
    expect(deserialize(JSON.stringify({ version: 999 })).world).toBeNull();
    const s = new MemoryStorage();
    s.setItem(SAVE_KEY, JSON.stringify({ ...serialize({ world: new World(), activeMission: null, completed: [], settings: DEFAULT_SETTINGS, material: 'wood' }), completed: ['hack', 'wood5'] }));
    expect(loadFromStorage(s).completed).toEqual(['wood5']);
  });

  it('nastavení se sanitizuje', () => {
    expect(sanitizeSettings({ voice: 'ano', breakReminderMin: 7 })).toEqual(DEFAULT_SETTINGS);
  });
});
