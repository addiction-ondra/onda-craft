import { isStandable } from './pathfinding';
import type { Vec3, World } from './world';

/** Ovladatelné postavičky. */
/** Interní id se ukládají do LocalStorage – neměnit. Zobrazovaná jména jsou v i18n/cs.ts (lauriska = „Laura“). */
export const CHARACTER_IDS = ['ondra', 'lauriska'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export interface CharacterState {
  id: CharacterId;
  pos: Vec3;
}

/** Výchozí místa – kousek před bránou hradu, ať je první výlet na hrad snadný. */
export const CHARACTER_SPAWN: Record<CharacterId, Vec3> = {
  ondra: { x: 15, y: 1, z: 12 },
  lauriska: { x: 15, y: 1, z: 13 },
};

export const isCharacterId = (v: unknown): v is CharacterId =>
  typeof v === 'string' && (CHARACTER_IDS as readonly string[]).includes(v);

/** Platná pozice z uložení, jinak výchozí (a když ani ta nejde, první volné místo). */
export function resolveCharacterPos(w: World, id: CharacterId, saved?: Vec3 | null): Vec3 {
  if (saved && isStandable(w, saved)) return saved;
  const spawn = CHARACTER_SPAWN[id];
  if (isStandable(w, spawn)) return spawn;
  for (let y = 1; y < 6; y++)
    for (let x = 15; x >= 0; x--)
      for (let z = 15; z >= 0; z--) if (isStandable(w, { x, y, z })) return { x, y, z };
  return spawn;
}
