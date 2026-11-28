import { describe, expect, it } from 'vitest';
import { CHARACTER_SPAWN, resolveCharacterPos } from './characters';
import { findPath, isStandable, walkGoalFromTap } from './pathfinding';
import { DEFAULT_SETTINGS } from './settings';
import { deserialize, SAVE_VERSION, serialize } from './storage';
import { CASTLE, generateDefaultWorld, isInCastle, World, WORLD_D, WORLD_W, isRiver } from './world';
import { blockIndex } from './blocks';

const courtyard = { x: 9, y: 1, z: 11 };

describe('hrad', () => {
  it('výchozí svět obsahuje hrad s věžemi, bránou a volným nádvořím', () => {
    const w = generateDefaultWorld();
    // rohové věže jsou vyšší než hradby
    expect(w.get({ x: CASTLE.x0, y: 4, z: CASTLE.z0 })).toBe('stone');
    expect(w.get({ x: CASTLE.x1, y: 5, z: CASTLE.z1 })).toBe('roof');
    // hradby jsou nízké (2 kostky + cimbuří), aby bylo na nádvoří vidět
    expect(w.topY(CASTLE.x0 + 3, CASTLE.z1)).toBeLessThanOrEqual(4);
    // brána ve východní zdi
    expect(w.has({ x: CASTLE.x1, y: 1, z: CASTLE.z0 + 2 })).toBe(false);
    expect(w.has({ x: CASTLE.x1, y: 2, z: CASTLE.z0 + 3 })).toBe(false);
    // nádvoří je volné a dá se na něm stát
    expect(isInCastle(courtyard)).toBe(true);
    expect(isStandable(w, courtyard)).toBe(true);
    // domeček je teď na severu
    expect(w.count('wall')).toBeGreaterThan(0);
  });

  it('postavičky začínají na volném místě před hradem', () => {
    const w = generateDefaultWorld();
    for (const p of Object.values(CHARACTER_SPAWN)) expect(isStandable(w, p)).toBe(true);
  });
});

describe('chození postaviček', () => {
  it('na nádvoří se dojde jen přes bránu', () => {
    const w = generateDefaultWorld();
    const r = findPath(w, CHARACTER_SPAWN.ondra, courtyard);
    expect(r.reached).toBe(true);
    // cesta vede bránou
    expect(r.path.some((p) => p.x === CASTLE.x1)).toBe(true);
    // každý krok je jen o jedno pole a nahoru nanejvýš o 1
    let prev = CHARACTER_SPAWN.ondra;
    for (const p of r.path) {
      expect(Math.abs(p.x - prev.x) + Math.abs(p.z - prev.z)).toBe(1);
      expect(p.y - prev.y).toBeLessThanOrEqual(1);
      prev = p;
    }
  });

  it('když se brána zazdí, postavička dojde co nejblíž, ale přes zeď nepřeleze', () => {
    const w = generateDefaultWorld();
    for (const z of [CASTLE.z0 + 2, CASTLE.z0 + 3]) for (const y of [1, 2]) w.setRaw({ x: CASTLE.x1, y, z }, 'stone');
    const r = findPath(w, CHARACTER_SPAWN.ondra, courtyard);
    expect(r.reached).toBe(false);
    expect(r.path.every((p) => !isInCastle(p))).toBe(true);
  });

  it('přes řeku jen po mostě', () => {
    const w = generateDefaultWorld();
    const north = { x: 5, y: 1, z: 5 };
    const south = { x: 4, y: 1, z: 11 };
    expect(findPath(w, south, north).reached).toBe(false);
    w.place({ x: 4, y: 1, z: 7 }, 'wood');
    w.place({ x: 4, y: 1, z: 8 }, 'wood');
    const r = findPath(w, south, north);
    expect(r.reached).toBe(true);
    expect(r.path.some((p) => isRiver(p.x, p.z) && p.y === 2)).toBe(true);
  });

  it('vyleze po schodech o jednu kostku, na vysokou zeď ne', () => {
    const w = new World();
    for (let x = 0; x < WORLD_W; x++) for (let z = 0; z < WORLD_D; z++) w.setRaw({ x, y: 0, z }, 'grass');
    w.setRaw({ x: 2, y: 1, z: 0 }, 'wood'); // schod
    expect(findPath(w, { x: 0, y: 1, z: 0 }, { x: 2, y: 2, z: 0 }).reached).toBe(true);
    w.setRaw({ x: 2, y: 2, z: 0 }, 'wood'); // teď 2 kostky vysoko, žádný schod
    expect(findPath(w, { x: 0, y: 1, z: 0 }, { x: 2, y: 3, z: 0 }).reached).toBe(false);
    w.setRaw({ x: 2, y: 1, z: 1 }, 'stone'); // přidaný schod vedle → už to jde
    expect(findPath(w, { x: 0, y: 1, z: 0 }, { x: 2, y: 3, z: 0 }).reached).toBe(true);
  });

  it('ťuknutí na vrch kostky = stoupnout si na ni, na bok = vedle ní', () => {
    const w = generateDefaultWorld();
    expect(walkGoalFromTap(w, { x: 3, y: 0, z: 4 }, { x: 0, y: 1, z: 0 })).toEqual({ x: 3, y: 1, z: 4 });
    // bok hradby zvenku → místo na zemi před ní
    expect(walkGoalFromTap(w, { x: CASTLE.x1, y: 2, z: CASTLE.z0 + 1 }, { x: 1, y: 0, z: 0 })).toEqual({
      x: CASTLE.x1 + 1,
      y: 1,
      z: CASTLE.z0 + 1,
    });
  });

  it('neplatná uložená pozice se nahradí výchozí', () => {
    const w = generateDefaultWorld();
    expect(resolveCharacterPos(w, 'lauriska', { x: CASTLE.x0, y: 1, z: CASTLE.z0 })).toEqual(CHARACTER_SPAWN.lauriska);
    expect(resolveCharacterPos(w, 'ondra', courtyard)).toEqual(courtyard);
  });
});

describe('ukládání v0.2', () => {
  it('uloží a načte pozice postaviček', () => {
    const w = generateDefaultWorld();
    const raw = JSON.stringify(
      serialize({ world: w, activeMission: null, completed: [], settings: DEFAULT_SETTINGS, material: 'wood', characters: [{ id: 'ondra', pos: courtyard }] }),
    );
    const loaded = deserialize(raw);
    expect(SAVE_VERSION).toBe(5);
    expect(loaded.characters).toEqual([{ id: 'ondra', pos: courtyard }]);
  });

  it('starý svět z v0.1 dostane hrad a stavby mimo hrad zůstanou', () => {
    // svět ve stylu v0.1: tráva, řeka, domeček na jihu, dětská věž na severu
    const blocks: Array<[number, number, number, number]> = [];
    for (let x = 0; x < WORLD_W; x++)
      for (let z = 0; z < WORLD_D; z++) blocks.push([x, 0, z, blockIndex(isRiver(x, z) ? 'water' : 'grass')]);
    blocks.push([8, 1, 11, blockIndex('wall')], [9, 3, 12, blockIndex('roof')]); // starý domeček
    blocks.push([3, 1, 4, blockIndex('red')], [3, 2, 4, blockIndex('red')]); // věž od dítěte
    const v1 = JSON.stringify({
      version: 1,
      blocks,
      activeMission: { id: 'findRed', progress: 1, target: 3, targets: [{ x: 9, y: 4, z: 12 }], otherTries: 0, done: false },
      completed: ['wood5'],
      settings: DEFAULT_SETTINGS,
      material: 'red',
    });
    const loaded = deserialize(v1);
    const w = loaded.world!;
    expect(w.get({ x: 3, y: 2, z: 4 })).toBe('red');
    expect(w.get({ x: CASTLE.x0, y: 4, z: CASTLE.z0 })).toBe('stone');
    expect(w.has({ x: 9, y: 3, z: 12 })).toBe(false);
    expect(w.count('wall')).toBeGreaterThan(0); // nový domeček na severu
    expect(loaded.activeMission).toBeNull();
    expect(loaded.completed).toEqual(['wood5']);
    expect(loaded.characters).toEqual([]);
  });
});
