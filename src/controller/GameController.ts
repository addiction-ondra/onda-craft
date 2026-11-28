import { Speech } from '../audio/speech';
import { Sfx } from '../audio/sfx';
import { BLOCKS, type BlockType } from '../game/blocks';
import {
  ANIMAL_FOOD,
  FEED_ORDER,
  getMission,
  isFeedable,
  numberAt,
  isMissionTarget,
  missionsFor,
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
  countBoxes,
  isInsideCastle,
  pickQuestionSpot,
  QUESTION_BOX_TARGET,
  RIVER_Z,
  type Vec3,
  type World,
} from '../game/world';
import { CS } from '../i18n/cs';
import { SceneView } from '../render/SceneView';
import type { Animal, AnimalKind } from '../render/animals';
import { areNeighbors, CHARACTER_IDS, pickDialogIndex, resolveCharacterPos, type CharacterId, type CharacterState } from '../game/characters';
import { dropToStand, findPath, reachableCells, walkGoalFromTap, type PathResult } from '../game/pathfinding';
import { generateFreshQuiz, isCorrect, quizKey, type Quiz } from '../game/quiz';
import { patternToFill, rowStatus, snowmanSlots, stackStatus, towerSlots } from '../game/iceMissions';
import { awardKey, missionsLeft } from '../game/rewards';
import { closeEnough, followSpots } from '../game/follow';
import { isUnlocked, WORLD_IDS, WORLDS, type WorldId } from '../game/worlds';
import { isBoxBlock } from '../game/blocks';
import type { NpcKind } from '../render/animals';
import type { WorldState } from '../game/storage';
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
  | { kind: 'worlds' }
  | { kind: 'travel'; to: WorldId }
  | { kind: 'puzzle' }
  | { kind: 'sling' }
  | { kind: 'templateDone'; template: TemplateId }
  | { kind: 'missions' }
  | { kind: 'parents' }
  | { kind: 'break' }
  | { kind: 'quiz'; quiz: Quiz; box: Vec3; wrong: string[]; solved: boolean; help: boolean };

export interface UiSnapshot {
  started: boolean;
  /** Svět, ve kterém se právě hraje. */
  worldId: WorldId;
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
  /** Kdy naposledy dítě pohladilo Freného (pro testy). */
  lastPetAt = 0;
  /** Poslední rozhovory Ondry a Laury – aby byl pokaždé jiný. */
  private recentDialogs: number[] = [];
  /** Otisky posledních úkolů z beden – aby se neopakovaly. */
  private recentQuizzes: string[] = [];
  private savedCharacters: CharacterState[];
  private worldId: WorldId;
  /** Ostatní (právě nehrané) světy v paměti. */
  private worldStates: Partial<Record<WorldId, WorldState>>;
  private npcs = new Map<NpcKind, Animal>();
  private boat: Animal | null = null;
  /** Za kým chodí Frený (naposledy vybrané / poslané dítě). */
  private leader: CharacterId = 'ondra';
  private followTimer: number | undefined;

  constructor() {
    this.storage = (() => {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    })();
    const loaded = this.storage ? loadFromStorage(this.storage) : null;
    this.worldId = loaded?.current ?? 'island';
    this.worldStates = { ...(loaded?.worlds ?? {}) };
    delete this.worldStates[this.worldId];
    this.world = loaded?.world ?? WORLDS[this.worldId].generate();
    this.savedCharacters = loaded?.characters ?? [];
    this.mission = loaded?.activeMission && !loaded.activeMission.done ? loaded.activeMission : null;
    if (this.mission) restoreMission(this.mission, this.world);
    this.meadow = loaded?.meadow ?? false;
    this.template = loaded?.template ?? null;
    if (this.template && templateStatus(this.world, this.template.id, this.template.origin).done) this.template = null;
    // Kdo už splnil všechny úkoly ve starší verzi, dostane klíč hned (za každý svět).
    let keys = loaded?.keys ?? [];
    for (const id of WORLD_IDS) {
      const done = id === this.worldId ? (loaded?.completed ?? []) : (this.worldStates[id]?.completed ?? []);
      keys = awardKey(keys, done, id).keys;
    }
    const palette = WORLDS[this.worldId].palette;

    this.snapshot = {
      started: false,
      worldId: this.worldId,
      playMode: 'walk',
      keys,
      template: null,
      mode: 'build',
      material: loaded?.material && palette.includes(loaded.material) ? loaded.material : palette[0],
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
    this.populateWorld();
    this.tickTimer = window.setInterval(this.tick, 1000);
    window.clearInterval(this.followTimer);
    this.followTimer = window.setInterval(this.followTick, 450);
    if (new URLSearchParams(location.search).has('test')) {
      (window as unknown as Record<string, unknown>).__onda = { controller: this, view: this.view, world: () => this.world };
    }
  }

  /** Rozmístí do aktuálního světa zvířátka, postavy, děti a loďku; nastaví vzhled. */
  private populateWorld(): void {
    const view = this.view;
    if (!view) return;
    const def = WORLDS[this.worldId];
    view.clearCreatures();
    view.setTheme(def.theme);
    this.animals.clear();
    for (const a of def.animals) this.animals.set(a.kind, view.addAnimal(a.kind, a.pos));
    this.npcs.clear();
    for (const n of def.npcs) {
      const npc = view.addAnimal(n.kind, n.pos);
      npc.faceTowards({ x: n.pos.x - 1, y: 1, z: n.pos.z }); // čelem ke středu ostrova
      this.npcs.set(n.kind, npc);
    }
    this.npcs.get('princess')?.setBubble('alert');
    this.characters.clear();
    for (const id of CHARACTER_IDS) {
      const saved = this.savedCharacters.find((c) => c.id === id)?.pos;
      this.characters.set(id, view.addAnimal(id, resolveCharacterPos(this.world, id, saved, def.spawn)));
    }
    // Frený přijel s dětmi – postaví se hned vedle nich a pak za nimi chodí
    const dog = this.animals.get('dog');
    const lead = this.characters.get(this.leader);
    if (dog && lead) {
      dog.follower = true;
      const spot = followSpots(this.world, lead.standCell, dog.standCell, this.occupiedCells())[0];
      if (spot) dog.teleport(spot);
    }
    this.boat = null;
    this.refreshBoat();
    this.refreshMissionVisuals();
    // Ve světě mají být vždy bedny/dárky – chybějící se doplní hned a potichu.
    while (countBoxes(this.world) < QUESTION_BOX_TARGET && this.spawnQuestionBox(false));
  }

  /**
   * Místa, kde stojí děti, postavy a loďka (tam se Frený nepostaví). Těsně vedle princezny,
   * sněhuláka a loďky taky ne – jinak by je zakryl a ťuknutí by trefilo pejska.
   */
  private occupiedCells(): Vec3[] {
    const out = [...this.characters.values()].map((a) => a.standCell);
    const around = (p: Vec3) => {
      // celý čtverec 3×3 kolem – i šikmo by pejsek z pohledu kamery postavu zakryl
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) out.push({ x: p.x + dx, y: p.y, z: p.z + dz });
    };
    for (const n of this.npcs.values()) around(n.standCell);
    if (this.boat) {
      around(this.boat.standCell);
      out.push(WORLDS[this.worldId].boat.stand);
    }
    return out;
  }

  /** Frený chodí za dítětem, se kterým se zrovna hraje (ve všech světech). */
  private followTick = (): void => {
    const dog = this.animals.get('dog');
    if (!dog || !this.view || !this.snapshot.started || this.snapshot.overlay) return;
    if (dog.walking || dog.resting) return;
    const lead = this.characters.get(this.snapshot.selectedCharacter ?? this.leader);
    if (!lead) return;
    const target = lead.standCell;
    const occupied = this.occupiedCells();
    const d = dog.standCell;
    const inTheWay = occupied.some((o) => o.x === d.x && o.z === d.z);
    if (closeEnough(target, d) && !inTheWay) return;
    for (const spot of followSpots(this.world, target, d, occupied).slice(0, 5)) {
      const r = findPath(this.world, dog.standCell, spot, dog.bodyHeight);
      if (r.reached) {
        // když děti běží, Frený přidá do kroku
        dog.walk(r.path, undefined, lead.walking ? 3.2 : 2.6);
        return;
      }
    }
  };

  /** Kam se dá odsud plout (otevřené světy kromě tohoto). */
  private destinations(): WorldId[] {
    return WORLD_IDS.filter((w) => w !== this.worldId && isUnlocked(w, this.snapshot.keys));
  }

  /** Loďka je na vodě, když je kam plout. Nad ní bublina s mapou. */
  private refreshBoat(): void {
    if (!this.view) return;
    const want = this.destinations().length > 0;
    if (want && !this.boat) {
      this.boat = this.view.addAnimal('boat', WORLDS[this.worldId].boat.water);
      this.boat.setBubble('map');
    } else if (!want && this.boat) {
      this.view.removeCreature(this.boat);
      this.boat = null;
    }
  }

  unmount(): void {
    this.saveNow();
    this.savedCharacters = this.characterStates();
    window.clearInterval(this.tickTimer);
    window.clearInterval(this.followTimer);
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
    // I na prázdné louce jsou bedny s otazníkem vždy – hned se objeví nové.
    this.recentBoxes = [];
    while (countBoxes(this.world) < QUESTION_BOX_TARGET && this.spawnQuestionBox(false));
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
    else if (this.snapshot.keys.includes(this.worldId)) this.say(t.done);
    else this.say(t.notDone(t.left[missionsLeft(this.snapshot.completed, this.worldId)] ?? ''));
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
    if (o?.kind === 'treasure' && o.fresh) {
      // klíč získán: na vodě se objeví lodička do dalšího světa
      const had = !!this.boat;
      this.refreshBoat();
      if (!had && this.boat) {
        this.view?.focusOn(WORLDS[this.worldId].boat.water, 45, 1.2);
        window.setTimeout(() => this.say(CS.travel.boatReady), 300);
        // lodička ukázaná – pohled se vrátí na celý ostrov
        window.setTimeout(() => this.view?.resetView(), 4000);
      }
    }
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
    if (m.id === 'snowman') this.set({ highlightMaterial: 'snow' });
    if (m.id === 'snowman' || m.id === 'tower5') this.refreshMissionVisuals(true);
    if (m.id === 'pattern') {
      const next = rowStatus(this.world, patternToFill()).next[0];
      if (next?.block) this.set({ highlightMaterial: next.block });
      this.refreshMissionVisuals(true);
    }
    if (m.id === 'crystals') this.view?.effects.setBeacons(m.targets);
    if (m.id === 'numbers') {
      const next = m.targets[m.progress];
      if (next) this.view?.effects.setBeacons([next]);
      this.say(CS.missions.numbers.next(CS.quiz.numbers[m.progress + 1] ?? ''));
    }
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
    this.world = WORLDS[this.worldId].generate();
    this.template = null;
    this.meadow = false;
    this.view?.setWorld(this.world);
    for (const [id, a] of this.characters) a.teleport(resolveCharacterPos(this.world, id, null, WORLDS[this.worldId].spawn));
    for (const a of this.animals.values()) a.setBubble(null);
    this.view?.effects.setWalkTarget(null);
    this.selectCharacter(null, true);
    // Nový svět = úplně od začátku: i úkoly a klíč z tohoto světa.
    this.set({
      mission: null,
      highlightMaterial: null,
      template: null,
      completed: [],
      keys: this.snapshot.keys.filter((k) => k !== this.worldId),
    });
    this.refreshBoat();
    this.saveNow();
  }

  resetMissions(): void {
    // Klíč z ostrova patří k úkolům – když se úkoly začnou znovu, zešedne i klíč.
    this.set({ completed: [], keys: this.snapshot.keys.filter((k) => k !== this.worldId) });
    this.refreshBoat();
    this.saveNow();
  }

  // ------------------------------------------------- testovací režim (rodičovská zóna)

  /** Test: rovnou do jiného světa (bez klíče a bez plavby). */
  testJump(target: WorldId): void {
    this.set({ overlay: null });
    if (target !== this.worldId) this.switchWorld(target);
    this.say(CS.travel.welcome[target]);
  }

  /** Test: všechny úkoly tohoto světa splněné → klíč, oslava a loďka. */
  testCompleteAll(): void {
    this.endMissionVisuals();
    this.mission = null;
    const completed = missionsFor(this.worldId).map((m) => m.id);
    const award = awardKey(this.snapshot.keys, completed, this.worldId);
    this.set({ overlay: null, mission: null, highlightMaterial: null, completed, keys: award.keys });
    this.refreshBoat();
    this.saveNow();
    this.openTreasure(award.awarded);
  }

  /** Test: rovnou otevřít minihru / kvíz / plavbu. */
  testOpen(what: 'puzzle' | 'sling' | 'quiz' | 'travel'): void {
    this.set({ overlay: null });
    if (what === 'puzzle' || what === 'sling') {
      this.set({ overlay: { kind: what } });
      this.say(CS.npcs[what === 'puzzle' ? 'princess' : 'snowman'].hello);
    } else if (what === 'quiz') {
      const findBox = (): Vec3 | undefined => {
        for (const [k, t] of this.world.entries())
          if (isBoxBlock(t)) {
            const [x, y, z] = k.split(',').map(Number);
            return { x, y, z };
          }
        return undefined;
      };
      if (!findBox()) this.spawnQuestionBox(false);
      const box = findBox();
      if (box) this.openQuiz(box);
    } else {
      const other = WORLD_IDS.find((w) => w !== this.worldId) ?? this.worldId;
      this.sail(other);
    }
  }

  /** Mapa světů (z truhly nebo z pravého panelu). */
  openWorlds(): void {
    this.markActivity();
    this.sfx.play('click');
    this.set({ overlay: { kind: 'worlds' } });
    this.say(this.destinations().length ? CS.worlds.withKey : CS.worlds.noKey);
  }

  /** Ťuknutí na ostrov v mapě (index 0 = ostrov s hradem, 1 = Ledové království, 2 = připravuje se). */
  tapWorld(index: number): void {
    const target = WORLD_IDS[index];
    if (target === this.worldId) {
      this.sfx.play('click');
      this.say(CS.worlds.here);
      this.closeOverlay();
      return;
    }
    if (!target) {
      // další svět se teprve staví
      this.sfx.play('soft');
      this.say(this.snapshot.keys.includes('ice') ? CS.worlds.building : CS.worlds.locked);
      return;
    }
    if (!isUnlocked(target, this.snapshot.keys)) {
      this.sfx.play('soft');
      this.say(CS.worlds.locked);
      return;
    }
    this.set({ overlay: null });
    this.travelTo(target);
  }

  // ------------------------------------------------------------- cestování lodičkou

  /** Ťuknutí na loďku: kam plout? Jedno místo = rovnou, víc = mapa. */
  private tapBoat(): void {
    const dest = this.destinations();
    if (dest.length === 0) {
      this.say(CS.travel.noTrip);
      return;
    }
    if (dest.length === 1) this.travelTo(dest[0]);
    else this.openWorlds();
  }

  /** Postavička dojde k loďce a pak se pluje. Když k ní dojít nejde, pluje se rovnou. */
  travelTo(target: WorldId): void {
    if (this.snapshot.overlay) return;
    const id = this.snapshot.selectedCharacter ?? 'ondra';
    const a = this.characters.get(id);
    const stand = WORLDS[this.worldId].boat.stand;
    this.sfx.play('click');
    this.say(CS.travel.boatTap);
    if (!a) {
      this.sail(target);
      return;
    }
    const { path, reached } = findPath(this.world, a.standCell, stand);
    if (!reached) {
      window.setTimeout(() => this.sail(target), 600);
      return;
    }
    this.view?.effects.setWalkTarget(stand);
    a.walk(path, () => {
      this.view?.effects.setWalkTarget(null);
      this.sail(target);
    });
  }

  /** Plavba: obrazovka s lodičkou na vlnách, mezitím se přepne svět. */
  private sail(target: WorldId): void {
    this.sfx.play('success');
    this.say(CS.travel.sailing);
    this.set({ overlay: { kind: 'travel', to: target } });
    window.setTimeout(() => {
      this.switchWorld(target);
      window.setTimeout(() => {
        this.set({ overlay: null });
        this.say(CS.travel.welcome[target]);
        this.nudgeCharacters();
      }, 900);
    }, 2200);
  }

  /** Uloží aktuální svět do paměti a načte jiný (nebo ho vytvoří při první návštěvě). */
  switchWorld(target: WorldId): void {
    if (target === this.worldId) return;
    this.endMissionVisuals();
    this.worldStates[this.worldId] = {
      world: this.world,
      activeMission: this.mission,
      completed: this.snapshot.completed,
      characters: this.characterStates(),
      template: this.template,
      meadow: this.meadow,
    };
    const st = this.worldStates[target];
    delete this.worldStates[target];
    this.worldId = target;
    this.world = st?.world ?? WORLDS[target].generate();
    this.mission = st?.activeMission && !st.activeMission.done ? st.activeMission : null;
    if (this.mission) restoreMission(this.mission, this.world);
    this.template = st?.template ?? null;
    this.meadow = st?.meadow ?? false;
    // děti přijely lodičkou – vystoupí u ní
    this.savedCharacters = [];
    this.recentBoxes = [];
    this.nextBoxAt = null;
    this.view?.setWorld(this.world);
    this.view?.resetView();
    const palette = WORLDS[target].palette;
    this.set({
      worldId: target,
      completed: st?.completed ?? [],
      mission: this.missionView(),
      template: this.templateView(),
      highlightMaterial: null,
      selectedCharacter: null,
      playMode: 'walk',
      mode: 'build',
      material: palette.includes(this.snapshot.material) ? this.snapshot.material : palette[0],
    });
    this.populateWorld();
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
    // Když není žádná (nemělo by nastat), objeví se hned.
    if (countBoxes(this.world) === 0) this.spawnQuestionBox(true);
    if (countBoxes(this.world) < QUESTION_BOX_TARGET) {
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
      } else if (a.kind === 'boat') {
        this.tapBoat();
      } else if (a.kind === 'princess' || a.kind === 'snowman') {
        // k postavě musí dojít Ondra nebo Laura – pak se otevře hra
        const npcKind = a.kind;
        if (sel) {
          this.walkCharacter(sel, a.standCell, { x: 0, y: 1, z: 0 }, a.standCell);
        } else {
          a.poke();
          this.sfx.play('soft');
          this.say(CS.npcs[npcKind].tapNeedsFriend);
          this.nudgeCharacters();
        }
      } else if (this.mission?.id === 'feed' && isFeedable(a.kind)) {
        this.feedAnimal(a, a.kind);
      } else if (a.kind === 'dog' && sel) {
        // vybrané dítě dojde k Frenému a pohladí ho („Frený, hudlánka!“)
        const child = this.characters.get(sel);
        if (child && areNeighbors(child.standCell, a.standCell)) {
          if (!this.petDog(sel, child)) this.pokeAnimal(a);
        } else {
          a.rest(8); // Frený počká, než k němu dítě dojde
          this.walkCharacter(sel, a.standCell, { x: 0, y: 1, z: 0 }, a.standCell);
        }
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

    // Mise „Čísla 1–5“: ťuknutí na sněhovou kouli s číslem (v jakémkoli režimu).
    if (numberAt(this.mission, pos) !== null) {
      this.dispatch({ kind: 'numberTap', pos });
      return;
    }

    // Mise „Najdi červené kostky / krystaly“: ťuknutí na hledanou kostku ji „najde“ v jakémkoli režimu.
    if (isMissionTarget(this.mission, pos)) {
      this.world.remove(pos);
      this.view.effects.burst(pos, BLOCKS[block].color, 16);
      this.sfx.play('collect');
      this.view.effects.setBeacons(this.mission!.targets.filter((t) => t.x !== pos.x || t.y !== pos.y || t.z !== pos.z));
      this.dispatch({ kind: 'collected', pos });
      this.scheduleSave();
      return;
    }

    // Bedna s otazníkem: otevře ji jen postavička, která k ní dojde.
    if (isBoxBlock(block)) {
      if (sel) {
        this.walkCharacter(sel, pos, normal, pos);
      } else {
        this.view.effects.burst({ ...pos, y: pos.y + 0.5 }, '#ffd43b', 6);
        this.sfx.play('soft');
        this.say(block === 'gift' ? CS.voice.giftNeedsFriend : CS.voice.boxNeedsFriend);
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
    if (id) this.leader = id;
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
    this.leader = id;
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
    const castle = WORLDS[this.worldId].castle;
    const wasInCastle = isInsideCastle(castle, start);
    // Setkání jen když postavička k druhé opravdu přišla (předtím stály od sebe).
    const friend = this.characters.get(id === 'ondra' ? 'lauriska' : 'ondra');
    const wasNearFriend = !!friend && areNeighbors(start, friend.standCell);
    const dogAtStart = this.animals.get('dog');
    const wasNearDog = !!dogAtStart && areNeighbors(start, dogAtStart.standCell);
    this.view.effects.setWalkTarget(end);
    this.sfx.play('click');
    this.say(reached ? pickOne(CS.voice.walk) : CS.voice.cantReach);
    a.walk(path, () => {
      this.view?.effects.setWalkTarget(null);
      const here = a.standCell;
      const nearBox = adjacentQuestionBox(this.world, here);
      const nearNpc = [...this.npcs.entries()].find(([, n]) => areNeighbors(here, n.standCell));
      if (nearBox && !this.snapshot.overlay) {
        this.openQuiz(nearBox);
      } else if (nearNpc && !this.snapshot.overlay) {
        this.openNpcGame(nearNpc[0], a);
      } else if (!wasNearFriend && this.meetFriends()) {
        // Ondra a Laura se potkali – srdíčka, výskok a rozhovor
      } else if (!wasNearDog && this.petDog(id, a)) {
        // dítě přišlo k Frenému – „Frený, hudlánka!“ a srdíčka
      } else if (!wasInCastle && isInsideCastle(castle, here)) {
        this.sfx.play('collect');
        this.say(CS.voice.inCastle);
      }
      this.scheduleSave();
    });
    // V režimu chození zůstává postavička vybraná – dítě s ní může chodit dál.
  }

  /**
   * Ondra a Laura se potkali (jeden právě došel k druhému): srdíčka, společný výskok,
   * otočí se k sobě a krátký rozhovor – pokaždé jiný. Bublina s tečkami ukazuje, kdo mluví.
   */
  private meetFriends(): boolean {
    const o = this.characters.get('ondra');
    const l = this.characters.get('lauriska');
    if (!o || !l || o.walking || l.walking || this.snapshot.overlay) return false;
    if (!areNeighbors(o.standCell, l.standCell)) return false;
    this.lastMeetAt = Date.now();
    o.faceTowards(l.standCell);
    l.faceTowards(o.standCell);
    for (const a of [o, l]) {
      a.setBubble('heart', 2.2);
      a.poke();
    }
    window.setTimeout(() => [o, l].forEach((a) => a.poke()), 1600);
    this.sfx.play('collect');
    const idx = pickDialogIndex(CS.meet.length, this.recentDialogs);
    this.recentDialogs = [...this.recentDialogs, idx].slice(-4);
    const who = { ondra: o, lauriska: l };
    const lines = CS.meet[idx].map((line, i) => ({
      text: line.text,
      // Ondra má hlas o kousek hlubší, Laura vyšší.
      pitch: line.who === 'ondra' ? 1.0 : 1.45,
      onStart: () => {
        const speaker = who[line.who];
        const other = line.who === 'ondra' ? l : o;
        speaker.setBubble('talk', 1 + line.text.length * 0.08);
        if (i > 0) other.setBubble(null);
      },
    }));
    // na konci rozhovoru ještě jednou srdíčka
    lines.push({ text: '', pitch: 1, onStart: () => [o, l].forEach((a) => a.setBubble('heart', 2.5)) });
    window.setTimeout(() => this.speech.sayLines(lines), 700);
    return true;
  }

  /**
   * Dítě přišlo k Frenému: nad dítětem ikonka pejska, dítě řekne „Frený, hudlánka!“,
   * pak srdíčko nad dítětem i nad Freným a Frený radostí poskočí.
   */
  private petDog(id: CharacterId, child: Animal): boolean {
    const dog = this.animals.get('dog');
    if (!dog || dog.walking || this.snapshot.overlay) return false;
    if (!areNeighbors(child.standCell, dog.standCell)) return false;
    child.faceTowards(dog.standCell);
    dog.faceTowards(child.standCell);
    dog.rest(8); // Frený chvíli zůstane a nechá se pohladit
    this.lastPetAt = Date.now();
    this.speech.sayLines([
      {
        text: CS.voice.petDog,
        pitch: id === 'ondra' ? 1.0 : 1.45,
        onStart: () => child.setBubble('dog', 2.5),
      },
      {
        text: '',
        onStart: () => {
          child.setBubble('heart', 3);
          dog.setBubble('heart', 3);
          dog.poke();
          this.sfx.play('animal');
        },
      },
    ]);
    return true;
  }

  // ------------------------------------------------------------- postavy a minihry

  /** Dítě došlo k princezně / sněhulákovi: pozdrav a hra ve vyskakovacím okně. */
  private openNpcGame(kind: NpcKind, child: Animal): void {
    const npc = this.npcs.get(kind);
    if (!npc || (kind !== 'princess' && kind !== 'snowman')) return;
    child.faceTowards(npc.standCell);
    npc.faceTowards(child.standCell);
    npc.poke();
    this.sfx.play('collect');
    this.say(CS.npcs[kind].hello);
    window.setTimeout(() => this.set({ overlay: { kind: kind === 'princess' ? 'puzzle' : 'sling' } }), 900);
  }

  /** Minihra dohraná (puzzle složené / hrad zbouraný). */
  npcGameDone(kind: 'princess' | 'snowman'): void {
    this.sfx.play('success');
    this.say(CS.npcs[kind].done);
    const npc = this.npcs.get(kind);
    npc?.setBubble('heart', 6);
    npc?.poke();
    for (const c of this.characters.values()) if (npc && areNeighbors(c.standCell, npc.standCell)) c.setBubble('heart', 4);
    if (kind === 'princess') window.setTimeout(() => npc?.setBubble('alert'), 60_000);
  }

  /** Krátké hlášky z miniher (pochvala po dílku puzzle, „bum“ u praku…). */
  sayLine(text: string): void {
    this.say(text);
  }

  playSfx(name: 'place' | 'remove' | 'collect' | 'soft' | 'click' | 'success'): void {
    this.sfx.play(name);
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
    this.world.setRaw(spot, WORLDS[this.worldId].boxBlock);
    if (announce) {
      this.view?.effects.burst(spot, '#ffd43b', 14);
      this.view?.effects.pop(spot);
      this.sfx.play('collect');
      if (!this.snapshot.overlay) this.say(WORLDS[this.worldId].boxBlock === 'gift' ? CS.voice.newGift : CS.voice.newBox);
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
    const quiz = generateFreshQuiz(this.quizCounter++, this.recentQuizzes);
    this.recentQuizzes = [...this.recentQuizzes, quizKey(quiz)].slice(-8);
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
        // Ve světě nesmí být nikdy žádná bedna – poslední se hned nahradí.
        if (countBoxes(this.world) === 0) this.spawnQuestionBox(true);
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
    if ((state.id === 'doghouse' || state.id === 'snowman' || state.id === 'tower5' || state.id === 'pattern') && !state.done) this.refreshMissionVisuals();
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
      if ((m.id === 'snowman' || m.id === 'pattern') && ev.kind === 'placed') {
        // špatný materiál na svítícím místě: rada a kostka se jemně vrátí (svítící místo zůstane)
        const expected = m.id === 'snowman' ? 'snow' : patternToFill().find((x) => x.pos.x === ev.pos.x && x.pos.z === ev.pos.z)?.block;
        this.sfx.play('soft');
        this.say(m.id === 'snowman' ? texts.snowman.wrong : expected === 'wood' ? texts.pattern.wrongWood : texts.pattern.wrongIce);
        if (expected) this.set({ highlightMaterial: expected });
        window.setTimeout(() => {
          if (this.world.get(ev.pos) === ev.block) {
            this.world.deleteRaw(ev.pos);
            this.view?.effects.burst(ev.pos, BLOCKS[ev.block].color, 8);
            this.refreshMissionVisuals();
          }
        }, 700);
      }
      if (m.id === 'numbers') {
        this.sfx.play('soft');
        this.say(texts.numbers.next(CS.quiz.numbers[m.progress + 1] ?? ''));
      }
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
      if (m.id === 'snowman') this.say(texts.snowman.count[m.progress - 1] ?? '');
      if (m.id === 'tower5') this.say(texts.tower5.count[m.progress - 1] ?? '');
      if (m.id === 'pattern') {
        this.say(pickOne(CS.voice.praise));
        this.set({ highlightMaterial: null });
      }
      if (m.id === 'crystals') this.say(texts.crystals.found[m.progress - 1] || pickOne(CS.voice.praise));
      if (m.id === 'numbers') {
        this.sfx.play('collect');
        this.say(texts.numbers.says[m.progress - 1] ?? '');
        this.refreshMissionVisuals();
      }
      if (m.id === 'snowman' || m.id === 'tower5' || m.id === 'pattern') this.refreshMissionVisuals();
      return;
    }
    // complete
    const id = m.id;
    if (id === 'wood5' && ev.kind === 'placed') this.say(texts.wood5.count[4]);
    if (id === 'tower5') this.say(texts.tower5.count[4]);
    if (id === 'numbers') this.view?.effects.setNumberLabels([]);
    this.endMissionVisuals();
    const completed = this.snapshot.completed.includes(id) ? this.snapshot.completed : [...this.snapshot.completed, id];
    const award = awardKey(this.snapshot.keys, completed, this.worldId);
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
    if (m && (m.id === 'snowman' || m.id === 'tower5' || m.id === 'pattern')) {
      const st = m.id === 'pattern' ? rowStatus(this.world, patternToFill()) : stackStatus(this.world, m.id === 'snowman' ? snowmanSlots() : towerSlots());
      const ghosts = m.id === 'pattern' ? st.next : st.next;
      // sněhulák: bílá svítící místa; věž: žlutá; řada: žlutá (správnou barvu má dítě vymyslet)
      this.view?.effects.setGhosts(
        ghosts.map((g) => g.pos),
        ghosts.map(() => (m.id === 'snowman' ? '#ffffff' : '#ffd43b')),
      );
      if (focus) {
        const p = m.id === 'pattern' ? patternToFill()[1].pos : (m.id === 'snowman' ? snowmanSlots() : towerSlots())[0].pos;
        this.view?.focusOn(p, 45, 1.3);
      }
    }
    if (m?.id === 'numbers') {
      this.view?.effects.setNumberLabels(m.targets.map((pos, i) => ({ pos, n: i + 1, done: i < m.progress })));
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
    this.view?.effects.setNumberLabels([]);
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
    // aktuální svět + ostatní navštívené světy z paměti
    const worlds: NonNullable<Parameters<typeof saveToStorage>[1]['worlds']> = {};
    for (const [id, st] of Object.entries(this.worldStates) as Array<[WorldId, WorldState]>) {
      if (st.world) worlds[id] = { ...st, world: st.world };
    }
    worlds[this.worldId] = {
      world: this.world,
      activeMission: this.mission,
      completed: this.snapshot.completed,
      characters: this.characterStates(),
      template: this.template,
      meadow: this.meadow,
    };
    saveToStorage(this.storage, {
      current: this.worldId,
      worlds,
      settings: this.snapshot.settings,
      material: this.snapshot.material,
      keys: this.snapshot.keys,
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
