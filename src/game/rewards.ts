import { missionsFor, type MissionId } from './missions';
import type { WorldId } from './worlds';

/**
 * Klíče k pokladu: za každý svět se všemi splněnými úkoly jeden klíč.
 * Klíče se sbírají v liště nahoře; poklad se jimi otevře v dalších světech.
 * Konečná, předvídatelná odměna – žádná náhoda, žádné denní bonusy.
 */
export const WORLD_ID = 'island';
export type KeyId = string;

export const allMissionsDone = (completed: MissionId[], world: WorldId = 'island'): boolean =>
  missionsFor(world).every((m) => completed.includes(m.id));

/** Vrátí nový seznam klíčů, pokud si dítě právě zasloužilo klíč za tento svět. */
export function awardKey(keys: KeyId[], completed: MissionId[], worldId: WorldId = 'island'): { keys: KeyId[]; awarded: boolean } {
  if (!allMissionsDone(completed, worldId) || keys.includes(worldId)) return { keys, awarded: false };
  return { keys: [...keys, worldId], awarded: true };
}

/** Kolik zámků má truhla s pokladem (jeden klíč za každý svět). */
export const TREASURE_LOCKS = 3;

/** Kolik úkolů v tomto světě ještě zbývá do klíče. */
export const missionsLeft = (completed: MissionId[], world: WorldId = 'island'): number =>
  missionsFor(world).filter((m) => !completed.includes(m.id)).length;
