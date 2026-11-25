import { blockFromIndex, blockIndex, type BlockType } from './blocks';
import { MISSIONS, type MissionId, type MissionState } from './missions';
import { sanitizeSettings, type Settings } from './settings';
import { inBounds, parseKey, World } from './world';

export const SAVE_KEY = 'ondacraft:save';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: number;
  /** Kostky jako [x, y, z, indexTypu]. */
  blocks: Array<[number, number, number, number]>;
  activeMission: MissionState | null;
  completed: MissionId[];
  settings: Settings;
  material: BlockType;
  savedAt: number;
}

export interface GameSnapshotForSave {
  world: World;
  activeMission: MissionState | null;
  completed: MissionId[];
  settings: Settings;
  material: BlockType;
}

export function serialize(s: GameSnapshotForSave): SaveData {
  const blocks: SaveData['blocks'] = [];
  for (const [k, t] of s.world.entries()) {
    const p = parseKey(k);
    blocks.push([p.x, p.y, p.z, blockIndex(t)]);
  }
  return {
    version: SAVE_VERSION,
    blocks,
    activeMission: s.activeMission,
    completed: s.completed,
    settings: s.settings,
    material: s.material,
    savedAt: Date.now(),
  };
}

export interface LoadedGame {
  world: World | null;
  activeMission: MissionState | null;
  completed: MissionId[];
  settings: Settings;
  material: BlockType | null;
}

const missionIds = new Set<string>(MISSIONS.map((m) => m.id));

function validMission(raw: unknown): MissionState | null {
  if (!raw || typeof raw !== 'object') return null;
  const m = raw as MissionState;
  if (!missionIds.has(m.id) || typeof m.progress !== 'number' || typeof m.target !== 'number') return null;
  if (!Array.isArray(m.targets)) return null;
  return { ...m, otherTries: m.otherTries ?? 0, done: !!m.done };
}

/** Rozbalí uložená data. Poškozená data nikdy neshodí hru – vrátí se výchozí stav. */
export function deserialize(raw: string | null): LoadedGame {
  const empty: LoadedGame = { world: null, activeMission: null, completed: [], settings: sanitizeSettings(null), material: null };
  if (!raw) return empty;
  let data: Partial<SaveData>;
  try {
    data = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!data || typeof data !== 'object' || data.version !== SAVE_VERSION) {
    // Zde budou migrace starších verzí. Neznámá verze ⇒ zachováme aspoň nastavení.
    return { ...empty, settings: sanitizeSettings(data?.settings) };
  }

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
    world.version = 0;
  }

  const completed = Array.isArray(data.completed) ? data.completed.filter((id): id is MissionId => missionIds.has(id)) : [];
  const material = typeof data.material === 'string' && blockIndex(data.material as BlockType) >= 0 ? (data.material as BlockType) : null;

  return {
    world,
    activeMission: validMission(data.activeMission),
    completed,
    settings: sanitizeSettings(data.settings),
    material,
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
