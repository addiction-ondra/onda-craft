import { Speech } from '../audio/speech';
import { Sfx } from '../audio/sfx';
import { BLOCKS, type BlockType } from '../game/blocks';
import {
  ANIMAL_FOOD,
  FEED_ORDER,
  getMission,
  isFeedable,
  isMissionTarget,
  reduceMission,
  restoreMission,
  startMission,
  type GameEvent,
  type MissionFeedback,
  type MissionId,
  type FeedableAnimal,
  type MissionState,
} from '../game/missions';
import { DEFAULT_SETTINGS, HINT_DELAY_MS, type Settings } from '../game/settings';
import { loadFromStorage, saveToStorage } from '../game/storage';
import {
  adjacentQuestionBox,
  bridgeProgress,
  clearToGround,
  DOGHOUSE,
  doghouseParts,
  generateDefaultWorld,
  isInCastle,
  pickQuestionSpot,
  QUESTION_BOX_TARGET,
  RIVER_Z,
  type Vec3,
  type World,
} from '../game/world';
import { CS } from '../i18n/cs';
import { SceneView } from '../render/SceneView';
import type { Animal, AnimalKind } from '../render/animals';
import { areNeighbors, CHARACTER_IDS, resolveCharacterPos, type CharacterId, type CharacterState } from '../game/characters';
import { dropToStand, findPath, reachableCells, walkGoalFromTap, type PathResult } from '../game/pathfinding';
import { generateQuiz, isCorrect, type Quiz } from '../game/quiz';
import { awardKey, missionsLeft, WORLD_ID } from '../game/rewards';
import { absoluteParts, findTemplateSpot, TEMPLATES, templateBlockAt, templateStatus, type TemplateId } from '../game/templates';
import type { ActiveTemplate } from '../game/storage';

export type Mode = 'build' | 'erase';
/** Hlavní režim (ikony vpravo): chození s postavičkou, stavění z kostek, stavitel podle šablony. */
export type PlayMode = 'walk' | 'build' | 'architect';

export type Overlay =
  | null
  | { kind: 'intro'; mission: MissionId }
  | { kind: 'success'; mission: MissionId; keyAwarded?: boolean }
  | { kind: 'architect'; noRoom?: TemplateId }
  | { kind: 'meadowConfirm' }
  | { kind: 'treasure'; fresh: boolean }
  | { kind: 'templateDone'; template: TemplateId }
  | { kind: 'missions' }
  | { kind: 'parents' }
  | { kind: 'break' }
  | { kind: 'quiz'; quiz: Quiz; box: Vec3; wrong: string[]; solved: boolean; help: boolean };

export interface UiSnapshot {
  started: boolean;
  playMode: PlayMode;
  mode: Mode;
  /** Klíče k pokladu (lišta nahoře). */
  keys: string[];
  /** Rozestavěná šablona v režimu Stavitel. */
  template: { id: TemplateId; filled: number; total: number } | null;
  material: BlockType;
  mission: Pick<MissionState, 'id' | 'progress' | 'target' | 'done' | 'fed'> | null;
  completed: MissionId[];
  settings: Settings;
  overlay: Overlay;
  /** Materiál, který má v paletě pulzovat (nápověda). */
  highlightMaterial: BlockType | null;
  /** Postavička, která čeká, kam má jít. */
  selectedCharacter: CharacterId | null;
  /** Rozblikat tlačítka postaviček (nápověda u bedny s otazníkem). */
  nudgeCharacters: boolean;
  hasCzechVoice: boolean;
  speechSupported: boolean;
}

const SAVE_DEBOUNCE_MS = 400;
/** Za jak dlouho po vyřešení úkolu se objeví nová bedna. */
const BOX_RESPAWN_MS = 30_000;
/** Jak často si Ondra a Laura můžou povídat. */
const MEET_COOLDOWN_MS = 40_000;
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
  private animals = new Map<AnimalKind, Animal>();
  private quizCounter = Math.floor(Math.random() * 4);
  private nudgeTimer: number | undefined;
  private successShown = false;
  private template: ActiveTemplate | null = null;
  private meadow = false;
  private lastGlowHint = 0;
  /** Kde byly bedny naposledy – nová se objeví jinde. */
  private recentBoxes: Vec3[] = [];
  /** Kdy se má objevit další bedna (null = nic nečeká). */
  private nextBoxAt: number | null = null;
  /** Kdy se Ondra a Laura naposledy potkali (aby si nepovídali pořád dokola). */
  lastMeetAt = 0;
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
    this.meadow = loaded?.meadow ?? false;
    this.template = loaded?.template ?? null;
    if (this.template && templateStatus(this.world, this.template.id, this.template.origin).done) this.template = null;
    const completedLoaded = loaded?.completed ?? [];
    // Kdo už splnil všechny úkoly ve starší verzi, dostane klíč hned.
    const keys = awardKey(loaded?.keys ?? [], completedLoaded).keys;

    this.snapshot = {
      started: false,
      playMode: 'walk',
      keys,
      template: null,
      mode: 'build',
      material: loaded?.material && BLOCKS[loaded.material].buildable ? loaded.material : 'wood',
      mission: this.missionView(),
      completed: loaded?.completed ?? [],
      settings: loaded?.settings ?? { ...DEFAULT_SETTINGS },
      overlay: null,
      highlightMaterial: null,
      selectedCharacter: null,
      nudgeCharacters: false,
      hasCzechVoice: this.speech.hasCzechVoice,
      speechSupported: this.speech.supported,
    };
    this.applySettings(this.snapshot.settings);
    this.snapshot.template = this.templateView();

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
    return m ? { id: m.id, progress: m.progress, target: m.target, done: m.done, fed: m.fed } : null;
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
    this.animals.clear();
    for (const [kind, x, z] of animals) this.animals.set(kind, this.view.addAnimal(kind, { x, y: 1, z }));
    this.characters.clear();
    for (const id of CHARACTER_IDS) {
      const saved = this.savedCharacters.find((c) => c.id === id)?.pos;
      this.characters.set(id, this.view.addAnimal(id, resolveCharacterPos(this.world, id, saved)));
    }
    this.refreshMissionVisuals();
    // Ve světě mají být vždy 3 bedny – chybějící (např. ze starší verze) se doplní hned a potichu.
    while (this.world.count('question') < QUESTION_BOX_TARGET && this.spawnQuestionBox(false));
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
      // rozehraný úkol pokračuje stavěním
      this.set({ playMode: 'build' });
      this.say(CS.missions[this.mission.id].hint);
    } else {
      // výchozí režim: panáček – vybrat kamaráda a chodit po světě
      this.say(CS.voice.chooseFriend);
      this.nudgeCharacters();
    }
  }

  /** Ikony vpravo: panáček / kladivo / hrad. */
  setPlayMode(mode: PlayMode): void {
    this.markActivity();
    this.sfx.play('select');
    if (mode === 'architect') {
      this.openArchitect();
      return;
    }
    this.set({ playMode: mode, mode: 'build' });
    if (mode === 'walk') {
      this.say(this.snapshot.selectedCharacter ? CS.voice.walkMode : CS.voice.chooseFriend);
      if (!this.snapshot.selectedCharacter) this.nudgeCharacters();
    } else {
      this.selectCharacter(null, true);
      this.say(CS.voice.buildMode);
    }
    this.refreshTemplateGhosts();
  }

  // ------------------------------------------------------------- Stavitel (šablony)

  private templateView(): UiSnapshot['template'] {
    const t = this.template;
    if (!t) return null;
    const st = templateStatus(this.world, t.id, t.origin);
    return { id: t.id, filled: st.filled, total: st.total };
  }

  openArchitect(): void {
    this.sfx.play('click');
    this.set({ overlay: { kind: 'architect' } });
    this.say(CS.builder.menu);
  }

  /** Výběr šablony v menu Stavitele. */
  chooseTemplate(id: TemplateId): void {
    this.sfx.play('click');
    // rozestavěná stejná šablona pokračuje na stejném místě
    let origin = this.template?.id === id ? this.template.origin : null;
    if (!origin) origin = findTemplateSpot(this.world, id);
    if (!origin) {
      this.set({ overlay: { kind: 'architect', noRoom: id } });
      this.say(CS.builder.noRoom);
      return;
    }
    const continuing = this.template?.id === id;
    if (this.mission) this.quitMission(true);
    this.template = { id, origin };
    this.selectCharacter(null, true);
    this.set({ overlay: null, playMode: 'architect', template: this.templateView() });
    this.view?.focusOn({ x: origin.x + 1, y: 1, z: origin.z + 1 }, 45, 1.3);
    this.refreshTemplateGhosts();
    this.say(continuing ? CS.builder.continue : CS.builder.start[id]);
    this.scheduleSave();
  }

  private refreshTemplateGhosts(): void {
    const t = this.template;
    if (this.mission) return; // svítící místa mise mají přednost
    if (!t || this.snapshot.playMode !== 'architect') {
      if (!this.mission) this.view?.effects.setGhosts([]);
      return;
    }
    const st = templateStatus(this.world, t.id, t.origin);
    this.view?.effects.setGhosts(
      st.nextLayer.map((p) => p.pos),
      st.nextLayer.map((p) => BLOCKS[p.block].color),
    );
  }

  /** Ťuknutí na svítící místo šablony: kostka správného materiálu se dá sama. */
  private placeTemplateBlock(pos: Vec3): void {
    const t = this.template;
    if (!t) return;
    const block = templateBlockAt(t.id, t.origin, pos);
    if (!block) return;
    const before = templateStatus(this.world, t.id, t.origin);
    if (this.world.place(pos, block) !== 'ok') {
      this.sfx.play('soft');
      return;
    }
    this.sfx.play('place');
    this.view?.effects.pop(pos);
    const st = templateStatus(this.world, t.id, t.origin);
    this.set({ template: this.templateView() });
    if (st.done) {
      this.view?.effects.setGhosts([]);
      this.template = null;
      this.sfx.play('success');
      this.say(CS.builder.done[t.id]);
      this.set({ template: null });
      window.setTimeout(() => this.set({ overlay: { kind: 'templateDone', template: t.id } }), 700);
    } else {
      const layerDone = before.nextLayer.length > 0 && st.nextLayer[0]?.pos.y !== before.nextLayer[0].pos.y;
      if (layerDone) {
        this.sfx.play('collect');
        this.say(CS.builder.nextLayer);
      }
      this.refreshTemplateGhosts();
    }
    this.scheduleSave();
  }

  /** Prázdná louka: v menu Stavitele s velkým potvrzením (✔/✖), v rodičovské zóně přímo. */
  askMeadow(): void {
    this.sfx.play('click');
    this.set({ overlay: { kind: 'meadowConfirm' } });
    this.say(CS.builder.meadowAsk);
  }

  clearToMeadow(): void {
    this.endMissionVisuals();
    this.mission = null;
    this.template = null;
    clearToGround(this.world);
    this.meadow = true;
    for (const a of this.animals.values()) a.setBubble(null);
    this.view?.effects.setWalkTarget(null);
    this.selectCharacter(null, true);
    this.view?.resetView();
    this.set({ mission: null, template: null, highlightMaterial: null, overlay: null, playMode: 'build', mode: 'build' });
    this.sfx.play('success');
    this.say(CS.builder.meadowDone);
    this.saveNow();
  }

  /** Ťuknutí na klíč v liště: ukáže truhlu se třemi zámky. */
  tapKeys(): void {
    this.openTreasure(false);
  }

  /** Truhla s pokladem. `fresh` = právě získaný klíč (oslava). */
  openTreasure(fresh: boolean): void {
    this.markActivity();
    this.sfx.play(fresh ? 'success' : 'collect');
    this.set({ overlay: { kind: 'treasure', fresh } });
    const t = CS.treasure;
    if (fresh) this.say(t.fresh);
    else if (this.snapshot.keys.includes(WORLD_ID)) this.say(t.done);
    else this.say(t.notDone(t.left[missionsLeft(this.snapshot.completed)] ?? ''));
  }

  // --------------------------------------------------------------- ovládání

  setMode(mode: Mode): void {
    this.markActivity();
    this.sfx.play('select');
    this.set({ mode, playMode: 'build' });
    this.say(mode === 'build' ? CS.voice.buildMode : CS.voice.eraseMode);
  }

  setMaterial(material: BlockType): void {
    this.markActivity();
    this.sfx.play('select');
    const highlight = this.snapshot.highlightMaterial === material ? null : this.snapshot.highlightMaterial;
    this.set({ material, mode: 'build', highlightMaterial: highlight, playMode: this.snapshot.playMode === 'walk' ? 'build' : this.snapshot.playMode });
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
    if (o?.kind === 'templateDone') {
      this.set({ playMode: 'walk' });
      this.nudgeCharacters();
      this.view?.resetView();
    }
    if (o?.kind === 'success' && o.keyAwarded) {
      // po poslední misi: oslava s truhlou pokladu a klíčem
      this.view?.resetView();
      this.openTreasure(true);
      return;
    }
    if (o?.kind === 'success') {
      this.say(CS.voice.freeBuild);
      // po úkolu se pohled vrátí na celý ostrov
      this.view?.resetView();
    }
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
      playMode: 'build',
      highlightMaterial: def.suggestedBlock && this.snapshot.material !== def.suggestedBlock ? def.suggestedBlock : null,
    });
    this.markActivity();
    // Názorná ukázka přímo ve světě: most ukáže, kam stavět.
    if (id === 'bridge') this.flashGhosts(6000);
    else this.refreshMissionVisuals(true);
    this.scheduleSave();
  }

  quitMission(silent = false): void {
    if (!silent) {
      this.sfx.play('click');
      this.speech.stop();
    }
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
    if (m.id === 'feed') {
      const hungry = FEED_ORDER.find((k) => !(m.fed ?? []).includes(k));
      if (hungry) {
        this.set({ highlightMaterial: ANIMAL_FOOD[hungry] });
        this.animals.get(hungry)?.poke();
      }
      this.refreshMissionVisuals();
    }
    if (m.id === 'doghouse') this.refreshMissionVisuals(true);
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
    this.template = null;
    this.meadow = false;
    this.view?.setWorld(this.world);
    for (const [id, a] of this.characters) a.teleport(resolveCharacterPos(this.world, id));
    for (const a of this.animals.values()) a.setBubble(null);
    this.view?.effects.setWalkTarget(null);
    this.selectCharacter(null, true);
    this.set({ mission: null, highlightMaterial: null, template: null });
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
    // Nová bedna s otazníkem – chvíli po vyřešení úkolu, vždy na jiném místě.
    if (this.world.count('question') < QUESTION_BOX_TARGET) {
      if (this.nextBoxAt === null) this.nextBoxAt = now + BOX_RESPAWN_MS;
      else if (now >= this.nextBoxAt) {
        this.nextBoxAt = null;
        this.spawnQuestionBox(true);
      }
    } else {
      this.nextBoxAt = null;
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

    const pm = this.snapshot.playMode;
    const sel = pm === 'walk' ? this.snapshot.selectedCharacter : null;

    if (hit.kind === 'animal') {
      const a = hit.animal;
      if (a.isCharacter) {
        // ťuknutí na postavičku = chození s ní (i z jiného režimu)
        const id = a.kind as CharacterId;
        if (pm !== 'walk') this.set({ playMode: 'walk' });
        this.refreshTemplateGhosts();
        this.selectCharacter(this.snapshot.selectedCharacter === id && pm === 'walk' ? null : id);
      } else if (this.mission?.id === 'feed' && isFeedable(a.kind)) {
        this.feedAnimal(a, a.kind);
      } else {
        this.pokeAnimal(a);
      }
      return;
    }

    if (hit.kind === 'ghost') {
      if (sel) this.walkCharacter(sel, { ...hit.pos, y: hit.pos.y - 1 }, { x: 0, y: 1, z: 0 });
      else if (pm === 'architect' && this.template && !this.mission) this.placeTemplateBlock(hit.pos);
      else if (pm === 'build' && this.snapshot.mode === 'build') this.placeBlock(hit.pos);
      else this.sfx.play('soft');
      return;
    }

    const { pos, normal, block } = hit;

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

    // Bedna s otazníkem: otevře ji jen postavička, která k ní dojde.
    if (block === 'question') {
      if (sel) {
        this.walkCharacter(sel, pos, normal, pos);
      } else {
        this.view.effects.burst({ ...pos, y: pos.y + 0.5 }, '#ffd43b', 6);
        this.sfx.play('soft');
        this.say(CS.voice.boxNeedsFriend);
        this.nudgeCharacters();
      }
      return;
    }

    // Režim chození: ťuknutí do mapy = „jdi sem“.
    if (pm === 'walk') {
      if (sel) {
        this.walkCharacter(sel, pos, normal);
      } else {
        this.sfx.play('soft');
        this.say(CS.voice.pickFirst);
        this.nudgeCharacters();
      }
      return;
    }

    // Stavitel: stavět se dá jen na svítící místa.
    if (pm === 'architect' && this.template && !this.mission) {
      this.sfx.play('soft');
      if (Date.now() - this.lastGlowHint > 6000) {
        this.lastGlowHint = Date.now();
        this.say(CS.builder.tapGlow);
      }
      return;
    }

    if (this.snapshot.mode === 'build') {
      this.placeBlock({ x: pos.x + normal.x, y: pos.y + normal.y, z: pos.z + normal.z });
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

  private placeBlock(target: Vec3): void {
    const material = this.snapshot.material;
    const res = this.world.place(target, material);
    if (res === 'ok') {
      this.sfx.play('place');
      this.view?.effects.pop(target);
      this.dispatch({ kind: 'placed', block: material, pos: target });
      this.scheduleSave();
    } else if (res === 'too-high') {
      this.sfx.play('soft');
      this.say(CS.voice.tooHigh);
    } else {
      this.sfx.play('soft');
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

  private nudgeCharacters(): void {
    window.clearTimeout(this.nudgeTimer);
    this.set({ nudgeCharacters: true });
    this.nudgeTimer = window.setTimeout(() => this.set({ nudgeCharacters: false }), 4000);
  }

  /** Pošle postavičku na místo. S `box` jde k bedně (na nejbližší volné místo vedle ní). */
  private walkCharacter(id: CharacterId, pos: Vec3, normal: Vec3, box?: Vec3): void {
    const a = this.characters.get(id);
    if (!a || !this.view) return;
    const start = a.standCell;
    let result: PathResult | null = null;
    if (box) {
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const g = dropToStand(this.world, box.x + dx, box.y + 1, box.z + dz);
        if (!g) continue;
        const r = findPath(this.world, start, g);
        if (r.reached && (!result || !result.reached || r.path.length < result.path.length)) result = r;
        else if (!result) result = r;
      }
    }
    if (!result) result = findPath(this.world, start, walkGoalFromTap(this.world, pos, normal));
    const { path, reached } = result;
    const end = path.length ? path[path.length - 1] : start;
    const wasInCastle = isInCastle(start);
    this.view.effects.setWalkTarget(end);
    this.sfx.play('click');
    this.say(reached ? pickOne(CS.voice.walk) : CS.voice.cantReach);
    a.walk(path, () => {
      this.view?.effects.setWalkTarget(null);
      const here = a.standCell;
      const nearBox = adjacentQuestionBox(this.world, here);
      if (nearBox && !this.snapshot.overlay) {
        this.openQuiz(nearBox);
      } else if (this.meetFriends()) {
        // Ondra a Laura se potkali – srdíčka, výskok a rozhovor
      } else if (!wasInCastle && isInCastle(here)) {
        this.sfx.play('collect');
        this.say(CS.voice.inCastle);
      }
      this.scheduleSave();
    });
    // V režimu chození zůstává postavička vybraná – dítě s ní může chodit dál.
  }

  /** Když stojí Ondra a Laura vedle sebe: srdíčka v bublinách, společný výskok a krátký rozhovor. */
  private meetFriends(): boolean {
    const o = this.characters.get('ondra');
    const l = this.characters.get('lauriska');
    if (!o || !l || o.walking || l.walking || this.snapshot.overlay) return false;
    if (!areNeighbors(o.standCell, l.standCell)) return false;
    if (Date.now() - this.lastMeetAt < MEET_COOLDOWN_MS) return false;
    this.lastMeetAt = Date.now();
    o.faceTowards(l.standCell);
    l.faceTowards(o.standCell);
    for (const a of [o, l]) {
      a.setBubble('heart', 6);
      a.poke();
    }
    window.setTimeout(() => [o, l].forEach((a) => a.poke()), 1600);
    this.sfx.play('collect');
    const dialog = pickOne(CS.meet);
    dialog.forEach((line, i) =>
      // Ondra má hlas o kousek hlubší, Laura vyšší; repliky jdou po sobě (fronta).
      this.speech.say(line.text, { interrupt: i === 0, pitch: line.who === 'ondra' ? 1.0 : 1.45 }),
    );
    return true;
  }

  // ------------------------------------------------------------- bedny s otazníkem

  /** Postaví novou bednu na náhodné dosažitelné místo. `announce` = třpyt + hlas. */
  private spawnQuestionBox(announce: boolean): boolean {
    const starts = [...this.characters.values()].map((a) => a.standCell);
    if (!starts.length) starts.push(...this.savedCharacters.map((c) => c.pos));
    const avoid = [...starts, ...[...this.animals.values()].map((a) => a.standCell)];
    if (this.template) {
      const t = this.template;
      for (const p of absoluteParts(t.id, t.origin)) avoid.push({ ...p.pos, y: 1 });
      const e = TEMPLATES[t.id].entrance;
      avoid.push({ x: t.origin.x + e.x, y: 1, z: t.origin.z + e.z });
    }
    const spot = pickQuestionSpot(this.world, { reachable: reachableCells(this.world, starts), avoid, recent: this.recentBoxes });
    if (!spot) return false;
    this.world.setRaw(spot, 'question');
    if (announce) {
      this.view?.effects.burst(spot, '#ffd43b', 14);
      this.view?.effects.pop(spot);
      this.sfx.play('collect');
      if (!this.snapshot.overlay) this.say(CS.voice.newBox);
    }
    this.scheduleSave();
    return true;
  }

  private quizPrompt(q: Quiz): string {
    const t = CS.quiz;
    switch (q.kind) {
      case 'count':
        return t.count[q.item ?? 'apple'];
      case 'color':
        return t.color(t.colorNames[q.answer]);
      case 'shape':
        return t.shape(t.shapeNames[q.answer]);
      case 'letter':
        return t.letter(q.answer, t.letterWords[q.answer]);
    }
  }

  private openQuiz(box: Vec3): void {
    const quiz = generateQuiz(this.quizCounter++);
    this.sfx.play('collect');
    this.set({ overlay: { kind: 'quiz', quiz, box, wrong: [], solved: false, help: false } });
    this.say(`${CS.quiz.intro} ${this.quizPrompt(quiz)}`);
  }

  repeatQuiz(): void {
    const o = this.snapshot.overlay;
    if (o?.kind === 'quiz') this.say(this.quizPrompt(o.quiz));
  }

  /** Odpověď v úkolu z bedny. Špatná odpověď = „zkus znovu“, po 2 pokusech se správná rozsvítí. */
  answerQuiz(option: string): void {
    const o = this.snapshot.overlay;
    if (o?.kind !== 'quiz' || o.solved) return;
    this.markActivity();
    if (isCorrect(o.quiz, option)) {
      this.sfx.play('success');
      this.say(`${pickOne(CS.voice.praise)} ${CS.quiz.opened}`);
      this.set({ overlay: { ...o, solved: true } });
      window.setTimeout(() => {
        const cur = this.snapshot.overlay;
        if (cur?.kind !== 'quiz' || cur.box !== o.box) return;
        this.world.deleteRaw(o.box);
        this.recentBoxes = [...this.recentBoxes, o.box].slice(-3);
        this.nextBoxAt = Date.now() + BOX_RESPAWN_MS;
        this.view?.effects.burst(o.box, '#ffd43b', 18);
        this.view?.effects.pop(o.box);
        this.set({ overlay: null });
        this.saveNow();
      }, 2000);
      return;
    }
    if (o.wrong.includes(option)) return;
    const wrong = [...o.wrong, option];
    const help = wrong.length >= 2;
    this.sfx.play('soft');
    this.say(help ? CS.quiz.showHelp : CS.quiz.again);
    this.set({ overlay: { ...o, wrong, help } });
  }

  // ------------------------------------------------------------------ zvířátka

  private feedAnimal(a: Animal, kind: FeedableAnimal): void {
    a.poke();
    if ((this.mission?.fed ?? []).includes(kind)) {
      this.sfx.play('animal');
      this.say(CS.missions.feed.full);
      return;
    }
    this.dispatch({ kind: 'fed', animal: kind, food: this.snapshot.material });
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
    // svítící místa domečku vždy odpovídají tomu, co ještě chybí
    if (state.id === 'doghouse' && !state.done) this.refreshMissionVisuals();
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
      if (m.id === 'feed' && ev.kind === 'fed') {
        this.sfx.play('soft');
        this.say(texts.feed.wants[ev.animal]);
        this.set({ highlightMaterial: ANIMAL_FOOD[ev.animal] });
      }
      if (m.id === 'doghouse' && m.otherTries % 2 === 1) this.say(texts.doghouse.keepFree);
      return;
    }
    if (ev.kind === 'fed') {
      // nakrmeno (pokrok i dokončení): srdíčko a poděkování
      this.animals.get(ev.animal)?.setBubble('heart', 3);
      this.sfx.play('collect');
      this.set({ highlightMaterial: null });
      if (fb === 'progress') {
        this.say(texts.feed.yum[ev.animal]);
        return;
      }
    }
    if (fb === 'progress') {
      if (m.id === 'wood5') this.say(texts.wood5.count[m.progress - 1] ?? '');
      if (m.id === 'findRed') this.say(texts.findRed.found[m.progress - 1] || pickOne(CS.voice.praise));
      if (m.id === 'bridge') {
        this.say(texts.bridge.half);
        this.flashGhosts(5000);
      }
      if (m.id === 'doghouse') this.say(pickOne(CS.voice.praise));
      return;
    }
    // complete
    const id = m.id;
    if (id === 'wood5' && ev.kind === 'placed') this.say(texts.wood5.count[4]);
    this.endMissionVisuals();
    const completed = this.snapshot.completed.includes(id) ? this.snapshot.completed : [...this.snapshot.completed, id];
    const award = awardKey(this.snapshot.keys, completed);
    if (award.awarded) this.set({ keys: award.keys });
    this.mission = null;
    this.set({ completed, highlightMaterial: null, mission: { id, progress: m.target, target: m.target, done: true, fed: m.fed } });
    this.saveNow();
    this.successShown = false;
    const showSuccess = (speak: boolean) => {
      if (this.successShown) return;
      this.successShown = true;
      this.sfx.play('success');
      this.set({ overlay: { kind: 'success', mission: id, keyAwarded: award.awarded }, mission: null });
      if (speak) this.say(texts[id].success);
    };
    if (id === 'doghouse') {
      // Frený nejdřív sám doběhne do nového domečku, pak teprve oslava.
      this.sfx.play('success');
      this.say(texts.doghouse.success);
      const dog = this.animals.get('dog');
      if (dog) {
        const { path } = findPath(this.world, dog.standCell, DOGHOUSE.inside, dog.bodyHeight);
        dog.walk(path, () => {
          dog.rest(30);
          dog.setBubble('heart', 4);
          window.setTimeout(() => showSuccess(false), 1200);
        });
      }
      window.setTimeout(() => showSuccess(false), 9000);
      return;
    }
    window.setTimeout(() => showSuccess(true), 900);
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

  /** `focus` = natočit kameru na místo úkolu (start mise, nápověda). */
  private refreshMissionVisuals(focus = false): void {
    const m = this.mission;
    if (m?.id === 'bridge') this.flashGhosts(4000);
    if (m?.id === 'feed') {
      // bublina s jídlem nad každým hladovým zvířátkem
      for (const k of FEED_ORDER) {
        if (!(m.fed ?? []).includes(k)) this.animals.get(k)?.setBubble({ food: ANIMAL_FOOD[k] });
      }
    }
    if (m?.id === 'doghouse') {
      if (focus) {
        this.view?.focusOn(DOGHOUSE.inside, DOGHOUSE.viewAzimuthDeg);
        this.animals.get('dog')?.rest(90); // Frený sedí a dívá se, jak mu stavíš domeček
      }
      window.clearTimeout(this.ghostTimer);
      this.view?.effects.setGhosts(doghouseParts().filter((p) => !this.world.has(p)));
    }
  }

  private endMissionVisuals(): void {
    window.clearTimeout(this.ghostTimer);
    this.view?.effects.setGhosts([]);
    this.view?.effects.setBeacons([]);
    for (const a of this.animals.values()) a.setBubble(null);
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
      keys: this.snapshot.keys,
      template: this.template,
      meadow: this.meadow,
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
