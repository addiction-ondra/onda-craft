import { Speech } from '../audio/speech';
import { Sfx } from '../audio/sfx';
import { BLOCKS, type BlockType } from '../game/blocks';
import {
  getMission,
  isMissionTarget,
  reduceMission,
  restoreMission,
  startMission,
  type GameEvent,
  type MissionFeedback,
  type MissionId,
  type MissionState,
} from '../game/missions';
import { DEFAULT_SETTINGS, HINT_DELAY_MS, type Settings } from '../game/settings';
import { loadFromStorage, saveToStorage } from '../game/storage';
import { bridgeProgress, generateDefaultWorld, isInCastle, RIVER_Z, type Vec3, type World } from '../game/world';
import { CS } from '../i18n/cs';
import { SceneView } from '../render/SceneView';
import type { Animal, AnimalKind } from '../render/animals';
import { CHARACTER_IDS, resolveCharacterPos, type CharacterId, type CharacterState } from '../game/characters';
import { findPath, walkGoalFromTap } from '../game/pathfinding';

export type Mode = 'build' | 'erase';

export type Overlay =
  | null
  | { kind: 'intro'; mission: MissionId }
  | { kind: 'success'; mission: MissionId }
  | { kind: 'missions' }
  | { kind: 'parents' }
  | { kind: 'break' };

export interface UiSnapshot {
  started: boolean;
  mode: Mode;
  material: BlockType;
  mission: Pick<MissionState, 'id' | 'progress' | 'target' | 'done'> | null;
  completed: MissionId[];
  settings: Settings;
  overlay: Overlay;
  /** Materiál, který má v paletě pulzovat (nápověda). */
  highlightMaterial: BlockType | null;
  /** Postavička, která čeká, kam má jít. */
  selectedCharacter: CharacterId | null;
  hasCzechVoice: boolean;
  speechSupported: boolean;
}

const SAVE_DEBOUNCE_MS = 400;
const pickOne = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export class GameController {
  private world: World;
  private view: SceneView | null = null;
  private mission: MissionState | null;
  private speech = new Speech();
  private sfx = new Sfx();
  private listeners = new Set<() => void>();
  private snapshot: UiSnapshot;
  private saveTimer: number | undefined;
  private tickTimer: number | undefined;
  private lastActivity = Date.now();
  private hintCount = 0;
  private playStarted = Date.now();
  private lastGroundMsg = 0;
  private ghostTimer: number | undefined;
  private storage: Storage | null;
  private characters = new Map<CharacterId, Animal>();
  private savedCharacters: CharacterState[];

  constructor() {
    this.storage = (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })();
    const loaded = this.storage ? loadFromStorage(this.storage) : null;
    this.world = loaded?.world ?? generateDefaultWorld();
    this.savedCharacters = loaded?.characters ?? [];
    this.mission = loaded?.activeMission && !loaded.activeMission.done ? loaded.activeMission : null;
    if (this.mission) restoreMission(this.mission, this.world);

    this.snapshot = {
      started: false,
      mode: 'build',
      material: loaded?.material && BLOCKS[loaded.material].buildable ? loaded.material : 'wood',
      mission: this.missionView(),
      completed: loaded?.completed ?? [],
      settings: loaded?.settings ?? { ...DEFAULT_SETTINGS },
      overlay: null,
      highlightMaterial: null,
      selectedCharacter: null,
      hasCzechVoice: this.speech.hasCzechVoice,
      speechSupported: this.speech.supported,
    };
    this.applySettings(this.snapshot.settings);

    window.addEventListener('pagehide', this.saveNow);
    // Každý dotyk je uživatelské gesto – iOS v něm dovolí znovu zapnout uspaný zvuk.
    window.addEventListener('pointerdown', () => this.snapshot.started && this.sfx.wake(), { capture: true });
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  // ---------------------------------------------------------------- store API

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): UiSnapshot => this.snapshot;

  private set(patch: Partial<UiSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((l) => l());
  }

  private missionView(): UiSnapshot['mission'] {
    const m = this.mission;
    return m ? { id: m.id, progress: m.progress, target: m.target, done: m.done } : null;
  }

  // --------------------------------------------------------------- životní cyklus

  mount(container: HTMLElement): void {
    if (this.view) return;
    this.view = new SceneView(container, this.world);
    this.view.onTap = (x, y) => this.handleTap(x, y);
    const animals: Array<[AnimalKind, number, number]> = [
      ['dog', 5, 11],
      ['sheep', 2, 6],
      ['chick', 7, 4],
    ];
    for (const [kind, x, z] of animals) this.view.addAnimal(kind, { x, y: 1, z });
    this.characters.clear();
    for (const id of CHARACTER_IDS) {
      const saved = this.savedCharacters.find((c) => c.id === id)?.pos;
      this.characters.set(id, this.view.addAnimal(id, resolveCharacterPos(this.world, id, saved)));
    }
    this.refreshMissionVisuals();
    this.tickTimer = window.setInterval(this.tick, 1000);
    if (new URLSearchParams(location.search).has('test')) {
      (window as unknown as Record<string, unknown>).__onda = { controller: this, view: this.view, world: () => this.world };
    }
  }

  unmount(): void {
    this.saveNow();
    this.savedCharacters = this.characterStates();
    window.clearInterval(this.tickTimer);
    this.view?.dispose();
    this.view = null;
  }

  /** Tlačítko „Hrát“ – zároveň odemyká zvuk a hlas na iOS. */
  start(): void {
    this.sfx.unlock();
    this.speech.unlock();
    this.set({ started: true, hasCzechVoice: this.speech.hasCzechVoice });
    this.playStarted = Date.now();
    this.markActivity();
    this.sfx.play('click');
    if (this.mission) {
      this.say(CS.missions[this.mission.id].hint);
    } else {
      this.say(CS.voice.welcome);
    }
  }

  // --------------------------------------------------------------- ovládání

  setMode(mode: Mode): void {
    this.markActivity();
    this.sfx.play('select');
    this.set({ mode });
    this.say(mode === 'build' ? CS.voice.buildMode : CS.voice.eraseMode);
  }

  setMaterial(material: BlockType): void {
    this.markActivity();
    this.sfx.play('select');
    const highlight = this.snapshot.highlightMaterial === material ? null : this.snapshot.highlightMaterial;
    this.set({ material, mode: 'build', highlightMaterial: highlight });
    this.say(CS.blockSpoken[material]);
    this.scheduleSave();
  }

  rotate(dir: 1 | -1): void {
    this.markActivity();
    this.sfx.play('click');
    this.view?.rotateStep(dir);
  }

  zoom(f: number): void {
    this.markActivity();
    this.sfx.play('click');
    this.view?.zoomBy(f);
  }

  openMissions(): void {
    this.sfx.play('click');
    this.set({ overlay: { kind: 'missions' } });
    this.say(CS.voice.missionsMenu);
  }

  openParents(): void {
    this.sfx.play('click');
    this.speech.stop();
    this.set({ overlay: { kind: 'parents' } });
  }

  closeOverlay(): void {
    const o = this.snapshot.overlay;
    this.sfx.play('click');
    this.set({ overlay: null });
    this.markActivity();
    if (o?.kind === 'success') this.say(CS.voice.freeBuild);
  }

  /** Výběr mise v menu → úvodní karta s ukázkou a hlasem. */
  chooseMission(id: MissionId): void {
    this.sfx.play('click');
    this.set({ overlay: { kind: 'intro', mission: id } });
    this.say(CS.missions[id].intro);
  }

  /** „Jdeme na to!“ na úvodní kartě. */
  beginMission(id: MissionId): void {
    this.sfx.play('click');
    if (this.mission?.id !== id) {
      this.endMissionVisuals();
      this.mission = startMission(id, this.world);
    }
    this.hintCount = 0;
    const def = getMission(id);
    this.set({
      overlay: null,
      mission: this.missionView(),
      mode: 'build',
      highlightMaterial: def.suggestedBlock && this.snapshot.material !== def.suggestedBlock ? def.suggestedBlock : null,
    });
    this.markActivity();
    // Názorná ukázka přímo ve světě: most ukáže, kam stavět.
    if (id === 'bridge') this.flashGhosts(6000);
    this.scheduleSave();
  }

  quitMission(): void {
    this.sfx.play('click');
    this.speech.stop();
    this.endMissionVisuals();
    this.mission = null;
    this.set({ mission: null, highlightMaterial: null });
    this.scheduleSave();
  }

  repeatInstruction(): void {
    this.markActivity();
    if (!this.mission) {
      this.say(CS.voice.welcome);
      return;
    }
    this.say(CS.missions[this.mission.id].intro);
  }

  /** Nápověda – nikdy netrestá, jen ukáže cestu. */
  showHint(): void {
    const m = this.mission;
    if (!m || m.done) return;
    this.hintCount++;
    this.say(CS.missions[m.id].hint);
    if (m.id === 'wood5' && this.snapshot.material !== 'wood') this.set({ highlightMaterial: 'wood' });
    if (m.id === 'findRed') this.view?.effects.setBeacons(m.targets);
    if (m.id === 'bridge') this.flashGhosts(8000);
  }

  // ----------------------------------------------------------------- nastavení

  updateSettings(patch: Partial<Settings>): void {
    const settings = { ...this.snapshot.settings, ...patch };
    this.applySettings(settings);
    this.set({ settings });
    this.scheduleSave();
  }

  private applySettings(s: Settings): void {
    this.speech.enabled = s.voice;
    this.speech.rate = s.voiceRate === 'slow' ? 0.85 : 1;
    this.sfx.enabled = s.sounds;
    if (!s.voice) this.speech.stop();
  }

  testVoice(): void {
    this.sfx.unlock();
    this.speech.unlock();
    this.sfx.play('success');
    this.say(pickOne(CS.voice.praise));
    this.set({ hasCzechVoice: this.speech.hasCzechVoice });
  }

  resetWorld(): void {
    this.endMissionVisuals();
    this.mission = null;
    this.world = generateDefaultWorld();
    this.view?.setWorld(this.world);
    for (const [id, a] of this.characters) a.teleport(resolveCharacterPos(this.world, id));
    this.view?.effects.setWalkTarget(null);
    this.selectCharacter(null, true);
    this.set({ mission: null, highlightMaterial: null });
    this.saveNow();
  }

  resetMissions(): void {
    this.set({ completed: [] });
    this.saveNow();
  }

  // --------------------------------------------------------------- herní smyčka

  private markActivity(): void {
    this.lastActivity = Date.now();
  }

  private tick = (): void => {
    const s = this.snapshot;
    if (!s.started || s.overlay) return;
    const now = Date.now();
    // Automatická nápověda při nečinnosti v misi. Další nápověda až po delší pauze.
    if (this.mission && !this.mission.done && s.settings.autoHints) {
      const delay = HINT_DELAY_MS * (1 + Math.min(this.hintCount, 2));
      if (now - this.lastActivity > delay) {
        this.showHint();
        this.markActivity();
      }
    }
    // Jemné připomenutí přestávky (rodičovské nastavení).
    if (s.settings.breakReminderMin > 0 && now - this.playStarted > s.settings.breakReminderMin * 60_000) {
      this.playStarted = now;
      this.set({ overlay: { kind: 'break' } });
      this.say(CS.voice.breakTime);
    }
  };

  handleTap(clientX: number, clientY: number): void {
    if (!this.view || !this.snapshot.started || this.snapshot.overlay) return;
    this.markActivity();
    const hit = this.view.pick(clientX, clientY);
    if (!hit) return;

    if (hit.kind === 'animal') {
      const a = hit.animal;
      if (a.isCharacter) {
        const id = a.kind as CharacterId;
        this.selectCharacter(this.snapshot.selectedCharacter === id ? null : id);
      } else {
        this.pokeAnimal(a);
      }
      return;
    }

    const { pos, normal, block } = hit;

    // Vybraná postavička: ťuknutí do mapy = „jdi sem“ (místo stavění).
    if (this.snapshot.selectedCharacter) {
      this.walkCharacter(this.snapshot.selectedCharacter, pos, normal);
      return;
    }

    // Mise „Najdi červené kostky“: ťuknutí na hledanou kostku ji „najde“ v jakémkoli režimu.
    if (isMissionTarget(this.mission, pos)) {
      this.world.remove(pos);
      this.view.effects.burst(pos, BLOCKS.red.color, 16);
      this.sfx.play('collect');
      this.view.effects.setBeacons(this.mission!.targets.filter((t) => t.x !== pos.x || t.y !== pos.y || t.z !== pos.z));
      this.dispatch({ kind: 'collected', pos });
      this.scheduleSave();
      return;
    }

    if (this.snapshot.mode === 'build') {
      const target = { x: pos.x + normal.x, y: pos.y + normal.y, z: pos.z + normal.z };
      const material = this.snapshot.material;
      const res = this.world.place(target, material);
      if (res === 'ok') {
        this.sfx.play('place');
        this.view.effects.pop(target);
        this.dispatch({ kind: 'placed', block: material, pos: target });
        this.scheduleSave();
      } else if (res === 'too-high') {
        this.sfx.play('soft');
        this.say(CS.voice.tooHigh);
      } else {
        this.sfx.play('soft');
      }
    } else {
      const res = this.world.remove(pos);
      if (res === 'ok') {
        this.sfx.play('remove');
        this.view.effects.burst(pos, BLOCKS[block].color);
        this.dispatch({ kind: 'removed', block, pos });
        this.scheduleSave();
      } else {
        this.sfx.play('soft');
        if (res === 'ground' && Date.now() - this.lastGroundMsg > 8000) {
          this.lastGroundMsg = Date.now();
          this.say(CS.voice.groundStays);
        }
      }
    }
  }

  /** Vybere postavičku (ťuknutí na ni nebo na její tlačítko). null = zrušit výběr. */
  selectCharacter(id: CharacterId | null, silent = false): void {
    this.markActivity();
    for (const [cid, a] of this.characters) a.setSelected(cid === id);
    this.set({ selectedCharacter: id });
    if (!id || silent) return;
    this.characters.get(id)?.poke();
    this.sfx.play('select');
    this.say(CS.voice.characters[id].hello);
  }

  private walkCharacter(id: CharacterId, pos: Vec3, normal: Vec3): void {
    const a = this.characters.get(id);
    if (!a || !this.view) return;
    const start = a.standCell;
    const goal = walkGoalFromTap(this.world, pos, normal);
    const { path, reached } = findPath(this.world, start, goal);
    const end = path.length ? path[path.length - 1] : start;
    const wasInCastle = isInCastle(start);
    this.view.effects.setWalkTarget(end);
    this.sfx.play('click');
    this.say(reached ? pickOne(CS.voice.walk) : CS.voice.cantReach);
    a.walk(path, () => {
      this.view?.effects.setWalkTarget(null);
      if (!wasInCastle && isInCastle(a.standCell)) {
        this.sfx.play('collect');
        this.say(CS.voice.inCastle);
      }
      this.scheduleSave();
    });
    // Po zadání cesty se výběr zruší – další ťuknutí zase staví.
    this.selectCharacter(null, true);
  }

  private pokeAnimal(a: Animal): void {
    a.poke();
    this.sfx.play('animal');
    this.say(CS.voice.animals[a.kind as AnimalKind]);
  }

  private dispatch(ev: GameEvent): void {
    if (!this.mission) return;
    const { state, feedback } = reduceMission(this.mission, ev, this.world);
    this.mission = state;
    this.set({ mission: this.missionView() });
    this.onFeedback(feedback, ev);
  }

  private onFeedback(fb: MissionFeedback, ev: GameEvent): void {
    const m = this.mission;
    if (!m || fb === 'none') return;
    const texts = CS.missions;
    if (fb === 'gentle-hint') {
      if (m.id === 'wood5' && m.otherTries % 2 === 1) {
        this.say(texts.wood5.otherMaterial);
        this.set({ highlightMaterial: 'wood' });
      }
      return;
    }
    if (fb === 'progress') {
      if (m.id === 'wood5') this.say(texts.wood5.count[m.progress - 1] ?? '');
      if (m.id === 'findRed') this.say(texts.findRed.found[m.progress - 1] || pickOne(CS.voice.praise));
      if (m.id === 'bridge') {
        this.say(texts.bridge.half);
        this.flashGhosts(5000);
      }
      return;
    }
    // complete
    const id = m.id;
    if (id === 'wood5' && ev.kind === 'placed') this.say(texts.wood5.count[4]);
    this.endMissionVisuals();
    const completed = this.snapshot.completed.includes(id) ? this.snapshot.completed : [...this.snapshot.completed, id];
    this.mission = null;
    this.set({ completed, highlightMaterial: null, mission: { id, progress: m.target, target: m.target, done: true } });
    this.saveNow();
    window.setTimeout(() => {
      this.sfx.play('success');
      this.set({ overlay: { kind: 'success', mission: id }, mission: null });
      this.say(texts[id].success);
    }, 900);
  }

  // ------------------------------------------------------------- vizuální nápovědy

  private bridgeGhosts(): Vec3[] {
    const { x } = bridgeProgress(this.world);
    return RIVER_Z.map((z) => ({ x, y: 1, z })).filter((p) => !this.world.has(p));
  }

  private flashGhosts(ms: number): void {
    window.clearTimeout(this.ghostTimer);
    this.view?.effects.setGhosts(this.bridgeGhosts());
    this.ghostTimer = window.setTimeout(() => this.view?.effects.setGhosts([]), ms);
  }

  private refreshMissionVisuals(): void {
    if (this.mission?.id === 'bridge') this.flashGhosts(4000);
  }

  private endMissionVisuals(): void {
    window.clearTimeout(this.ghostTimer);
    this.view?.effects.setGhosts([]);
    this.view?.effects.setBeacons([]);
  }

  // ------------------------------------------------------------------- zvuk / hlas

  private say(text: string): void {
    this.speech.say(text);
  }

  // ------------------------------------------------------------------- ukládání

  private scheduleSave(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(this.saveNow, SAVE_DEBOUNCE_MS);
  }

  saveNow = (): void => {
    window.clearTimeout(this.saveTimer);
    if (!this.storage) return;
    saveToStorage(this.storage, {
      world: this.world,
      activeMission: this.mission,
      completed: this.snapshot.completed,
      settings: this.snapshot.settings,
      material: this.snapshot.material,
      characters: this.characterStates(),
    });
  };

  private characterStates(): CharacterState[] {
    if (this.characters.size === 0) return this.savedCharacters;
    return [...this.characters].map(([id, a]) => ({ id, pos: a.standCell }));
  }

  private onVisibility = (): void => {
    if (document.visibilityState === 'hidden') {
      this.saveNow();
      this.speech.stop();
    }
  };
}
