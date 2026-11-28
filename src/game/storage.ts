import { blockFromIndex, blockIndex, type BlockType } from './blocks';
import { isCharacterId, type CharacterState } from './characters';
import { TEMPLATE_IDS, type TemplateId } from './templates';
import { isFeedable, MISSIONS, type MissionId, type MissionState } from './missions';
import { sanitizeSettings, type Settings } from './settings';
import { inBounds, parseKey, upgradeWorldToCastle, World, type Vec3 } from './world';
import { isWorldId, WORLD_IDS, type WorldId } from './worlds';

export const SAVE_KEY = 'ondacraft:save';
/**
 * Verze formátu:
 * 1 – v0.1 (domeček na jihu)
 * 2 – v0.2 (hrad, postavičky Ondra a Laura); v1 svět se převede přes upgradeWorldToCastle
 * 3 – v0.4 (klíče k pokladu, rozestavěná šablona Stavitele); v2 data jsou kompatibilní
 * 4 – v0.7 (více světů: každý svět má vlastní stavbu, úkoly a postavičky; v1–v3 = ostrov)
 */
export const SAVE_VERSION = 4;

type BlockTuple = [number, number, number, number];

/** Uložení jednoho světa. */
interface WorldSaveData {
  /** Kostky jako [x, y, z, indexTypu]. */
  blocks: BlockTuple[];
  activeMission: MissionState | null;
  completed: MissionId[];
  characters: CharacterState[];
  template: ActiveTemplate | null;
  /** Svět je „prázdná louka“. */
  meadow: boolean;
}

export interface SaveData {
  version: number;
  current: WorldId;
  worlds: Partial<Record<WorldId, WorldSaveData>>;
  settings: Settings;
  material: BlockType;
  keys: string[];
  savedAt: number;
}

/** Rozestavěná šablona v režimu Stavitel. */
export interface ActiveTemplate {
  id: TemplateId;
  origin: Vec3;
}

/** Stav jednoho světa v paměti. */
export interface WorldState {
  world: World | null;
  activeMission: MissionState | null;
  completed: MissionId[];
  characters: CharacterState[];
  template: ActiveTemplate | null;
  meadow: boolean;
}

export interface GameSnapshotForSave {
  /** Více světů (v0.7+). Když chybí, ukládá se jen `world` jako ostrov (zpětná kompatibilita). */
  current?: WorldId;
  worlds?: Partial<Record<WorldId, { world: World } & Omit<WorldState, 'world'>>>;
  world?: World;
  activeMission?: MissionState | null;
  completed?: MissionId[];
  characters?: CharacterState[];
  template?: ActiveTemplate | null;
  meadow?: boolean;
  settings: Settings;
  material: BlockType;
  keys?: string[];
}

function blocksOf(w: World): BlockTuple[] {
  const out: BlockTuple[] = [];
  for (const [k, t] of w.entries()) {
    const p = parseKey(k);
    out.push([p.x, p.y, p.z, blockIndex(t)]);
  }
  return out;
}

export function serialize(s: GameSnapshotForSave): SaveData {
  const worlds: SaveData['worlds'] = {};
  const src = s.worlds ?? (s.world ? { island: { world: s.world, activeMission: s.activeMission ?? null, completed: s.completed ?? [], characters: s.characters ?? [], template: s.template ?? null, meadow: s.meadow ?? false } } : {});
  for (const id of WORLD_IDS) {
    const ws = src[id];
    if (!ws) continue;
    worlds[id] = {
      blocks: blocksOf(ws.world),
      activeMission: ws.activeMission ?? null,
      completed: ws.completed ?? [],
      characters: ws.characters ?? [],
      template: ws.template ?? null,
      meadow: ws.meadow ?? false,
    };
  }
  return {
    version: SAVE_VERSION,
    current: s.current ?? 'island',
    worlds,
    settings: s.settings,
    material: s.material,
    keys: s.keys ?? [],
    savedAt: Date.now(),
  };
}

export interface LoadedGame extends WorldState {
  /** Svět, ve kterém se hrálo naposledy. Pole `world`, `completed`… výše patří jemu. */
  current: WorldId;
  worlds: Partial<Record<WorldId, WorldState>>;
  settings: Settings;
  material: BlockType | null;
  keys: string[];
}

const missionIds = new Set<string>(MISSIONS.map((m) => m.id));

function validMission(raw: unknown): MissionState | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as MissionState;
  if (!missionIds.has(m.id) || typeof m.progress !== 'number' || typeof m.target !== 'number') return null;
  if (!Array.isArray(m.targets)) return null;
  const fed = Array.isArray(m.fed) ? m.fed.filter(isFeedable) : undefined;
  return { ...m, otherTries: m.otherTries ?? 0, fed, done: !!m.done };
}

const emptyWorld = (): WorldState => ({ world: null, activeMission: null, completed: [], characters: [], template: null, meadow: false });

/** Rozbalí uložení jednoho světa (stejné pole jako ve v1–v3). */
function parseWorld(data: Partial<WorldSaveData> & Record<string, unknown>, version: number, worldId: WorldId): WorldState {
  let world: World | null = null;
  if (Array.isArray(data.blocks) && data.blocks.length > 0) {
    world = new World();
    for (const b of data.blocks) {
      if (!Array.isArray(b) || b.length !== 4) continue;
      const [x, y, z, ti] = b;
      const t = blockFromIndex(ti);
      const p = { x, y, z };
      if (t && inBounds(p)) world.setRaw(p, t);
    }
    // v0.1 → v0.2: do uloženého světa přibude hrad a domeček na severu.
    if (version === 1 && worldId === 'island') upgradeWorldToCastle(world);
    world.version = 0;
  }

  let activeMission = validMission(data.activeMission);
  // Schované červené kostky z v0.1 mohou být v místě nového hradu – misi raději zrušíme.
  if (version === 1 && activeMission?.id === 'findRed') activeMission = null;

  const characters: CharacterState[] = [];
  if (Array.isArray(data.characters)) {
    for (const c of data.characters) {
      const p = c?.pos;
      if (isCharacterId(c?.id) && p && [p.x, p.y, p.z].every(Number.isInteger) && inBounds(p)) {
        characters.push({ id: c.id, pos: { x: p.x, y: p.y, z: p.z } });
      }
    }
  }

  const completed = Array.isArray(data.completed) ? data.completed.filter((id): id is MissionId => missionIds.has(id)) : [];
  let template: ActiveTemplate | null = null;
  const t = data.template;
  if (t && (TEMPLATE_IDS as string[]).includes(t.id) && t.origin && inBounds(t.origin)) {
    template = { id: t.id, origin: { x: t.origin.x, y: 1, z: t.origin.z } };
  }
  return { world, activeMission, completed, characters, template, meadow: data.meadow === true };
}

/** Rozbalí uložená data. Poškozená data nikdy neshodí hru – vrátí se výchozí stav. */
export function deserialize(raw: string | null): LoadedGame {
  const empty: LoadedGame = { ...emptyWorld(), current: 'island', worlds: {}, settings: sanitizeSettings(null), material: null, keys: [] };
  if (!raw) return empty;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  const version = data && typeof data === 'object' ? data.version : undefined;
  if (version !== 1 && version !== 2 && version !== 3 && version !== SAVE_VERSION) {
    // Neznámá verze ⇒ zachováme aspoň nastavení.
    return { ...empty, settings: sanitizeSettings(data?.settings) };
  }

  const worlds: Partial<Record<WorldId, WorldState>> = {};
  let current: WorldId = 'island';
  if (version === SAVE_VERSION) {
    const ws = (data.worlds ?? {}) as Record<string, unknown>;
    for (const id of WORLD_IDS) {
      const w = ws[id];
      if (w && typeof w === 'object') worlds[id] = parseWorld(w as Record<string, unknown>, version, id);
    }
    if (isWorldId(data.current)) current = data.current;
  } else {
    // v1–v3: jeden svět = ostrov
    worlds.island = parseWorld(data, version as number, 'island');
  }

  const material = typeof data.material === 'string' && blockIndex(data.material as BlockType) >= 0 ? (data.material as BlockType) : null;
  const keys = Array.isArray(data.keys) ? (data.keys as unknown[]).filter((k): k is string => typeof k === 'string') : [];

  return {
    ...(worlds[current] ?? emptyWorld()),
    current,
    worlds,
    settings: sanitizeSettings(data.settings),
    material,
    keys,
  };
}

export function saveToStorage(storage: Storage, s: GameSnapshotForSave): boolean {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(serialize(s)));
    return true;
  } catch {
    // Plné úložiště / anonymní režim Safari – hra běží dál i bez uložení.
    return false;
  }
}

export function loadFromStorage(storage: Storage): LoadedGame {
  try {
    return deserialize(storage.getItem(SAVE_KEY));
  } catch {
    return deserialize(null);
  }
}
