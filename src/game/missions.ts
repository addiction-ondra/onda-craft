import type { BlockType } from './blocks';
import { bridgeProgress, doghouseStatus, hasBridge, keyOf, WORLD_H, type Vec3, type World } from './world';
import { ICE_PLANS, type WorldId } from './worlds';
import { patternToFill, placeNumberBalls, placePatternStart, rowStatus, snowmanSlots, stackStatus, towerSlots } from './iceMissions';

export type MissionId =
  // Ostrov s hradem
  | 'wood5'
  | 'findRed'
  | 'bridge'
  | 'feed'
  | 'doghouse'
  // Ledové království
  | 'snowman'
  | 'tower5'
  | 'pattern'
  | 'crystals'
  | 'numbers';

/** Zvířátka a jídlo, které mají ráda (mise 4). Barva kostky = jídlo. */
export type FeedableAnimal = 'sheep' | 'chick' | 'dog';
export const FEED_ORDER: FeedableAnimal[] = ['sheep', 'chick', 'dog'];
export const ANIMAL_FOOD: Record<FeedableAnimal, BlockType> = {
  sheep: 'grass', // zelená tráva
  chick: 'sand', // žlutá zrníčka
  dog: 'wood', // hnědé granulky
};
export const isFeedable = (k: string): k is FeedableAnimal => k in ANIMAL_FOOD;

export interface MissionState {
  id: MissionId;
  progress: number;
  target: number;
  /** Pozice cílů (mise „Najdi červené kostky“). */
  targets: Vec3[];
  /** Kolikrát dítě použilo jiný materiál – jen pro dávkování nápovědy. */
  otherTries: number;
  /** Nakrmená zvířátka (mise 4). */
  fed?: FeedableAnimal[];
  done: boolean;
}

export type GameEvent =
  | { kind: 'placed'; block: BlockType; pos: Vec3 }
  | { kind: 'removed'; block: BlockType; pos: Vec3 }
  | { kind: 'collected'; pos: Vec3 }
  | { kind: 'fed'; animal: FeedableAnimal; food: BlockType }
  /** Ťuknutí na sněhovou kouli s číslem (mise „Čísla 1–5“). */
  | { kind: 'numberTap'; pos: Vec3 };

/**
 * Zpětná vazba pro controller:
 * - progress: posun vpřed (pochvala, zvuk)
 * - gentle-hint: dítě dělá něco jiného – jemně navést (nikdy netrestat)
 * - complete: mise splněna
 */
export type MissionFeedback = 'none' | 'progress' | 'gentle-hint' | 'complete';

export interface MissionResult {
  state: MissionState;
  feedback: MissionFeedback;
}

export interface MissionDef {
  id: MissionId;
  /** Ve kterém světě mise je. */
  world: WorldId;
  /** Číslo mise v plánu (1–8). */
  number: number;
  target: number;
  /** Materiál, který mise doporučuje (předvybere se nápověda v paletě). */
  suggestedBlock?: BlockType;
}

export const MISSIONS: MissionDef[] = [
  { id: 'wood5', world: 'island', number: 1, target: 5, suggestedBlock: 'wood' },
  { id: 'findRed', world: 'island', number: 2, target: 3 },
  { id: 'bridge', world: 'island', number: 3, target: 2, suggestedBlock: 'wood' },
  { id: 'feed', world: 'island', number: 4, target: 3 },
  { id: 'doghouse', world: 'island', number: 5, target: 4, suggestedBlock: 'wood' },
  { id: 'snowman', world: 'ice', number: 1, target: 3, suggestedBlock: 'snow' },
  { id: 'tower5', world: 'ice', number: 2, target: 5 },
  { id: 'pattern', world: 'ice', number: 3, target: 3 },
  { id: 'crystals', world: 'ice', number: 4, target: 3 },
  { id: 'numbers', world: 'ice', number: 5, target: 5 },
];

/** Mise jednoho světa (v pořadí). */
export const missionsFor = (world: WorldId): MissionDef[] => MISSIONS.filter((m) => m.world === world);

export const getMission = (id: MissionId): MissionDef => {
  const m = MISSIONS.find((d) => d.id === id);
  if (!m) throw new Error(`Unknown mission ${id}`);
  return m;
};

/** Místa, kam se mohou schovat červené kostky (x, z). Rozložená po celém světě. */
export const RED_HIDING_SPOTS: Array<[number, number]> = [
  [1, 5],
  [14, 4],
  [10, 12], // na střeše domečku
  [4, 14],
  [13, 10],
  [6, 12],
  [11, 1],
  [3, 1],
];

const shuffle = <T>(arr: T[], rng: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Spustí misi. Může upravit svět (např. schová červené kostky).
 * `rng` je injektovaný kvůli testům.
 */
export function startMission(id: MissionId, world: World, rng: () => number = Math.random): MissionState {
  const def = getMission(id);
  const state: MissionState = { id, progress: 0, target: def.target, targets: [], otherTries: 0, done: false };

  if (id === 'findRed' || id === 'crystals') {
    const spots = id === 'findRed' ? RED_HIDING_SPOTS : ICE_PLANS.crystalSpots;
    const block: BlockType = id === 'findRed' ? 'red' : 'crystal';
    for (const [x, z] of shuffle(spots, rng)) {
      if (state.targets.length >= def.target) break;
      const y = world.topY(x, z);
      if (y < 1 || y >= WORLD_H) continue;
      const p = { x, y, z };
      world.setRaw(p, block);
      state.targets.push(p);
    }
    state.target = state.targets.length;
  }

  if (id === 'snowman') state.progress = Math.min(stackStatus(world, snowmanSlots()).filled, def.target - 1);
  if (id === 'tower5') state.progress = Math.min(stackStatus(world, towerSlots()).filled, def.target - 1);
  if (id === 'pattern') {
    placePatternStart(world);
    state.progress = Math.min(rowStatus(world, patternToFill()).filled, def.target - 1);
  }
  if (id === 'numbers') state.targets = placeNumberBalls(world, rng);

  if (id === 'bridge') {
    state.progress = Math.min(bridgeProgress(world).covered, def.target - 1);
  }

  if (id === 'feed') state.fed = [];

  if (id === 'doghouse') {
    // Už postavené kostky se počítají, ale úplně hotovou misi hned neukončíme.
    state.progress = Math.min(doghouseStatus(world).filled, def.target - 1);
  }

  return state;
}

/** Po načtení uložené hry: vrátí do světa chybějící cílové kostky. */
export function restoreMission(state: MissionState, world: World): void {
  if (state.id === 'findRed' || state.id === 'crystals') {
    for (const p of state.targets) if (!world.has(p)) world.setRaw(p, state.id === 'findRed' ? 'red' : 'crystal');
  }
  if (state.id === 'numbers') {
    for (const p of state.targets) if (!world.has(p)) world.setRaw(p, 'snow');
  }
  if (state.id === 'pattern') placePatternStart(world);
}

/** Číslo sněhové koule na místě (1–5), nebo null. */
export const numberAt = (state: MissionState | null, pos: Vec3): number | null => {
  if (!state || state.id !== 'numbers' || state.done) return null;
  const i = state.targets.findIndex((t) => keyOf(t) === keyOf(pos));
  return i < 0 ? null : i + 1;
};

export const isMissionTarget = (state: MissionState | null, pos: Vec3): boolean =>
  !!state && !state.done && (state.id === 'findRed' || state.id === 'crystals') && state.targets.some((t) => keyOf(t) === keyOf(pos));

/** Čistý reducer misí. */
export function reduceMission(state: MissionState, event: GameEvent, world: World): MissionResult {
  if (state.done) return { state, feedback: 'none' };

  switch (state.id) {
    case 'wood5': {
      if (event.kind !== 'placed') return { state, feedback: 'none' };
      if (event.block !== 'wood') {
        return { state: { ...state, otherTries: state.otherTries + 1 }, feedback: 'gentle-hint' };
      }
      const progress = state.progress + 1;
      const done = progress >= state.target;
      return { state: { ...state, progress, done }, feedback: done ? 'complete' : 'progress' };
    }

    case 'findRed':
    case 'crystals': {
      if (event.kind !== 'collected') return { state, feedback: 'none' };
      const k = keyOf(event.pos);
      if (!state.targets.some((t) => keyOf(t) === k)) return { state, feedback: 'none' };
      const targets = state.targets.filter((t) => keyOf(t) !== k);
      const progress = state.progress + 1;
      const done = progress >= state.target;
      return { state: { ...state, targets, progress, done }, feedback: done ? 'complete' : 'progress' };
    }

    case 'bridge': {
      if (event.kind === 'collected') return { state, feedback: 'none' };
      if (hasBridge(world)) {
        return { state: { ...state, progress: state.target, done: true }, feedback: 'complete' };
      }
      const covered = bridgeProgress(world).covered;
      // Odebrání kostky nikdy nesnižuje viditelný pokrok – žádný „trest“.
      const progress = Math.max(state.progress, covered);
      const feedback: MissionFeedback = progress > state.progress ? 'progress' : 'none';
      return { state: { ...state, progress }, feedback };
    }

    case 'feed': {
      if (event.kind !== 'fed') return { state, feedback: 'none' };
      const fed = state.fed ?? [];
      if (fed.includes(event.animal)) return { state, feedback: 'none' };
      if (event.food !== ANIMAL_FOOD[event.animal]) {
        return { state: { ...state, otherTries: state.otherTries + 1 }, feedback: 'gentle-hint' };
      }
      const nextFed = [...fed, event.animal];
      const done = nextFed.length >= state.target;
      return { state: { ...state, fed: nextFed, progress: nextFed.length, done }, feedback: done ? 'complete' : 'progress' };
    }

    case 'doghouse': {
      if (event.kind !== 'placed' && event.kind !== 'removed') return { state, feedback: 'none' };
      const st = doghouseStatus(world);
      if (st.done) return { state: { ...state, progress: state.target, done: true }, feedback: 'complete' };
      // Zastavěné dveře nebo vnitřek = jemná rada, nic se nebere.
      if (event.kind === 'placed' && (!st.insideFree || !st.doorFree)) {
        return { state: { ...state, otherTries: state.otherTries + 1 }, feedback: 'gentle-hint' };
      }
      const progress = Math.max(state.progress, Math.min(st.filled, state.target - 1));
      return { state: { ...state, progress }, feedback: progress > state.progress ? 'progress' : 'none' };
    }

    case 'snowman':
    case 'tower5':
    case 'pattern': {
      if (event.kind !== 'placed' && event.kind !== 'removed') return { state, feedback: 'none' };
      const st =
        state.id === 'pattern'
          ? rowStatus(world, patternToFill())
          : stackStatus(world, state.id === 'snowman' ? snowmanSlots() : towerSlots());
      if (st.done) return { state: { ...state, progress: state.target, done: true }, feedback: 'complete' };
      // Špatný materiál na svítícím místě = jemná rada (controller kostku vrátí).
      if (event.kind === 'placed' && st.wrong.some((w) => keyOf(w.pos) === keyOf(event.pos))) {
        return { state: { ...state, otherTries: state.otherTries + 1 }, feedback: 'gentle-hint' };
      }
      const progress = Math.max(state.progress, st.filled);
      return { state: { ...state, progress }, feedback: progress > state.progress ? 'progress' : 'none' };
    }

    case 'numbers': {
      if (event.kind !== 'numberTap') return { state, feedback: 'none' };
      const n = numberAt(state, event.pos);
      if (n === null) return { state, feedback: 'none' };
      if (n !== state.progress + 1) {
        // jiné číslo – nic se nebere, jen rada, které číslo teď hledáme
        return { state: { ...state, otherTries: state.otherTries + 1 }, feedback: n <= state.progress ? 'none' : 'gentle-hint' };
      }
      const progress = state.progress + 1;
      const done = progress >= state.target;
      return { state: { ...state, progress, done }, feedback: done ? 'complete' : 'progress' };
    }
  }
}
