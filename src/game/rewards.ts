import { MISSIONS, type MissionId } from './missions';

/**
 * Klíče k pokladu: za každý svět se všemi splněnými úkoly jeden klíč.
 * Klíče se sbírají v liště nahoře; poklad se jimi otevře v dalších světech.
 * Konečná, předvídatelná odměna – žádná náhoda, žádné denní bonusy.
 */
export const WORLD_ID = 'island';
export type KeyId = string;

export const allMissionsDone = (completed: MissionId[]): boolean => MISSIONS.every((m) => completed.includes(m.id));

/** Vrátí nový seznam klíčů, pokud si dítě právě zasloužilo klíč za tento svět. */
export function awardKey(keys: KeyId[], completed: MissionId[], worldId: string = WORLD_ID): { keys: KeyId[]; awarded: boolean } {
  if (!allMissionsDone(completed) || keys.includes(worldId)) return { keys, awarded: false };
  return { keys: [...keys, worldId], awarded: true };
}

/** Kolik zámků má truhla s pokladem (jeden klíč za každý svět). */
export const TREASURE_LOCKS = 3;

/** Kolik úkolů v tomto světě ještě zbývá do klíče. */
export const missionsLeft = (completed: MissionId[]): number => MISSIONS.filter((m) => !completed.includes(m.id)).length;
