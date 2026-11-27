import * as THREE from 'three';
import type { CharacterId } from '../game/characters';
import { isStandable } from '../game/pathfinding';
import { WORLD_D, WORLD_H, WORLD_W, type Vec3, type World } from '../game/world';
import type { BlockType } from '../game/blocks';
import { blockCanvases } from './textures';

/** Bublina nad zvířátkem: obrázek jídla, které chce, nebo srdíčko po nakrmení. */
export type Bubble = { food: BlockType } | 'heart' | null;

const bubbleCache = new Map<string, THREE.SpriteMaterial>();
function bubbleMaterial(b: Exclude<Bubble, null>): THREE.SpriteMaterial {
  const key = b === 'heart' ? 'heart' : b.food;
  let m = bubbleCache.get(key);
  if (m) return m;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  // bílá „myšlenková“ bublina s ocáskem
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#495057';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(64, 56, 46, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(56, 112, 8, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (b === 'heart') {
    g.fillStyle = '#ff4d6d';
    g.beginPath();
    g.moveTo(64, 84);
    g.bezierCurveTo(20, 56, 34, 22, 64, 40);
    g.bezierCurveTo(94, 22, 108, 56, 64, 84);
    g.fill();
  } else {
    g.imageSmoothingEnabled = false;
    g.drawImage(blockCanvases(b.food).top, 34, 26, 60, 60);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 3;
    g.strokeRect(34, 26, 60, 60);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  m = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
  bubbleCache.set(key, m);
  return m;
}

export type AnimalKind = 'dog' | 'sheep' | 'chick';
export type CreatureKind = AnimalKind | CharacterId;

export const isCharacterKind = (k: CreatureKind): k is CharacterId => k === 'ondra' || k === 'lauriska';

const mats = new Map<string, THREE.MeshLambertMaterial>();
const mat = (color: string) => {
  let m = mats.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    mats.set(color, m);
  }
  return m;
};

function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

/** Končetina otáčená v kloubu (pivot nahoře) – kvůli animaci chůze. */
function limb(w: number, h: number, d: number, color: string, x: number, pivotY: number, z: number, foot?: string): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, pivotY, z);
  g.add(box(w, h, d, color, 0, -h / 2, 0));
  if (foot) g.add(box(w + 0.02, 0.07, d + 0.06, foot, 0, -h + 0.035, 0.02));
  return g;
}

interface Model {
  root: THREE.Group;
  legs: THREE.Group[];
  arms: THREE.Group[];
  height: number;
}

const EYE = '#1b1b1b';
const SKIN = '#f6c9a3';

/** Pejsek Frený – bílý francouzský buldoček s hnědým čumákem a hnědými flíčky. */
function buildBulldog(): Model {
  const g = new THREE.Group();
  const white = '#f8f9fa';
  const brown = '#8d5524';
  const pink = '#ffc9c9';
  // zavalité tělo
  g.add(box(0.44, 0.32, 0.56, white, 0, 0.36, 0));
  g.add(box(0.4, 0.3, 0.16, white, 0, 0.4, 0.26)); // hrudník
  // hnědé flíčky na těle (lehce vystupují)
  g.add(box(0.012, 0.14, 0.18, brown, 0.226, 0.4, -0.06));
  g.add(box(0.012, 0.1, 0.12, brown, -0.226, 0.34, 0.08));
  g.add(box(0.16, 0.012, 0.16, brown, -0.06, 0.526, -0.12));
  g.add(box(0.1, 0.012, 0.1, brown, 0.1, 0.526, 0.1));
  // velká hranatá hlava
  g.add(box(0.42, 0.34, 0.32, white, 0, 0.62, 0.36));
  // flíček kolem oka
  g.add(box(0.13, 0.12, 0.012, brown, 0.1, 0.7, 0.522));
  // krátký hnědý čumák s černým nosem
  g.add(box(0.26, 0.15, 0.1, brown, 0, 0.53, 0.56));
  g.add(box(0.1, 0.06, 0.03, EYE, 0, 0.58, 0.615));
  g.add(box(0.06, 0.06, 0.02, EYE, -0.1, 0.71, 0.525));
  g.add(box(0.06, 0.06, 0.02, EYE, 0.1, 0.71, 0.53));
  // netopýří uši – vztyčené, uvnitř růžové
  for (const s of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(s * 0.15, 0.79, 0.36);
    ear.rotation.z = -s * 0.25;
    ear.add(box(0.13, 0.2, 0.05, white, 0, 0.1, 0));
    ear.add(box(0.08, 0.14, 0.012, pink, 0, 0.09, 0.03));
    g.add(ear);
  }
  // pahýlek ocásku
  g.add(box(0.07, 0.07, 0.07, white, 0, 0.48, -0.31));
  const legs = [
    limb(0.11, 0.2, 0.11, white, -0.14, 0.22, 0.18),
    limb(0.11, 0.2, 0.11, white, 0.14, 0.22, -0.18),
    limb(0.11, 0.2, 0.11, white, 0.14, 0.22, 0.18),
    limb(0.11, 0.2, 0.11, white, -0.14, 0.22, -0.18),
  ];
  legs.forEach((l) => g.add(l));
  return { root: g, legs, arms: [], height: 0.9 };
}

function buildSheep(): Model {
  const g = new THREE.Group();
  g.add(box(0.5, 0.4, 0.66, '#ffffff', 0, 0.45, 0));
  g.add(box(0.28, 0.28, 0.24, '#f1e3d3', 0, 0.58, 0.4));
  g.add(box(0.06, 0.06, 0.02, EYE, -0.07, 0.62, 0.53));
  g.add(box(0.06, 0.06, 0.02, EYE, 0.07, 0.62, 0.53));
  g.add(box(0.32, 0.1, 0.2, '#ffffff', 0, 0.75, 0.38));
  const legs = [
    limb(0.1, 0.26, 0.1, '#5c4033', -0.15, 0.26, 0.2),
    limb(0.1, 0.26, 0.1, '#5c4033', 0.15, 0.26, -0.2),
    limb(0.1, 0.26, 0.1, '#5c4033', 0.15, 0.26, 0.2),
    limb(0.1, 0.26, 0.1, '#5c4033', -0.15, 0.26, -0.2),
  ];
  legs.forEach((l) => g.add(l));
  return { root: g, legs, arms: [], height: 0.9 };
}

function buildChick(): Model {
  const g = new THREE.Group();
  g.add(box(0.28, 0.26, 0.3, '#ffd43b', 0, 0.28, 0));
  g.add(box(0.2, 0.2, 0.2, '#ffe066', 0, 0.48, 0.1));
  g.add(box(0.08, 0.05, 0.08, '#f76707', 0, 0.46, 0.24));
  g.add(box(0.04, 0.04, 0.02, EYE, -0.05, 0.52, 0.2));
  g.add(box(0.04, 0.04, 0.02, EYE, 0.05, 0.52, 0.2));
  const legs = [limb(0.04, 0.15, 0.04, '#f76707', -0.06, 0.15, 0), limb(0.04, 0.15, 0.04, '#f76707', 0.06, 0.15, 0)];
  legs.forEach((l) => g.add(l));
  return { root: g, legs, arms: [], height: 0.6 };
}

/** Kluk Ondra: hnědé vlasy, modré tričko, džíny. */
function buildOndra(): Model {
  const g = new THREE.Group();
  const legs = [limb(0.15, 0.42, 0.16, '#364fc7', -0.09, 0.46, 0, '#343a40'), limb(0.15, 0.42, 0.16, '#364fc7', 0.09, 0.46, 0, '#343a40')];
  legs.forEach((l) => g.add(l));
  g.add(box(0.4, 0.42, 0.22, '#4dabf7', 0, 0.66, 0)); // tričko
  g.add(box(0.41, 0.06, 0.23, '#1c7ed6', 0, 0.56, 0)); // proužek
  const arms = [limb(0.11, 0.38, 0.12, '#4dabf7', -0.26, 0.85, 0), limb(0.11, 0.38, 0.12, '#4dabf7', 0.26, 0.85, 0)];
  for (const a of arms) {
    a.add(box(0.1, 0.1, 0.11, SKIN, 0, -0.33, 0)); // dlaň
    g.add(a);
  }
  // hlava
  g.add(box(0.38, 0.36, 0.34, SKIN, 0, 1.06, 0));
  g.add(box(0.06, 0.07, 0.02, EYE, -0.08, 1.09, 0.17));
  g.add(box(0.06, 0.07, 0.02, EYE, 0.08, 1.09, 0.17));
  g.add(box(0.12, 0.03, 0.02, '#c92a2a', 0, 0.98, 0.17)); // úsměv
  // krátké hnědé vlasy s ofinou
  const hair = '#6b3f1d';
  g.add(box(0.4, 0.1, 0.36, hair, 0, 1.27, 0));
  g.add(box(0.4, 0.07, 0.06, hair, 0, 1.2, 0.16));
  g.add(box(0.4, 0.22, 0.06, hair, 0, 1.13, -0.16));
  g.add(box(0.04, 0.16, 0.34, hair, -0.2, 1.16, 0));
  g.add(box(0.04, 0.16, 0.34, hair, 0.2, 1.16, 0));
  return { root: g, legs, arms, height: 1.34 };
}

/** Holčička Lauriska: dlouhé světlé vlasy s copem, růžové šatičky. */
function buildLauriska(): Model {
  const g = new THREE.Group();
  const legs = [limb(0.12, 0.34, 0.13, SKIN, -0.08, 0.38, 0, '#e64980'), limb(0.12, 0.34, 0.13, SKIN, 0.08, 0.38, 0, '#e64980')];
  legs.forEach((l) => g.add(l));
  const dress = '#f783ac';
  g.add(box(0.46, 0.24, 0.3, dress, 0, 0.42, 0)); // sukýnka
  g.add(box(0.36, 0.3, 0.2, dress, 0, 0.68, 0)); // živůtek
  g.add(box(0.47, 0.04, 0.31, '#ffffff', 0, 0.32, 0)); // lem
  const arms = [limb(0.1, 0.34, 0.11, SKIN, -0.23, 0.8, 0), limb(0.1, 0.34, 0.11, SKIN, 0.23, 0.8, 0)];
  arms.forEach((a) => g.add(a));
  g.add(box(0.36, 0.34, 0.32, SKIN, 0, 1.0, 0));
  g.add(box(0.06, 0.07, 0.02, EYE, -0.08, 1.03, 0.16));
  g.add(box(0.06, 0.07, 0.02, EYE, 0.08, 1.03, 0.16));
  g.add(box(0.05, 0.03, 0.02, '#ff8fab', -0.13, 0.96, 0.16)); // tvářičky
  g.add(box(0.05, 0.03, 0.02, '#ff8fab', 0.13, 0.96, 0.16));
  g.add(box(0.1, 0.03, 0.02, '#c92a2a', 0, 0.93, 0.16));
  // dlouhé světlé vlasy
  const hair = '#f5d76e';
  g.add(box(0.4, 0.1, 0.36, hair, 0, 1.2, 0));
  g.add(box(0.4, 0.06, 0.06, hair, 0, 1.14, 0.15));
  g.add(box(0.4, 0.46, 0.07, hair, 0, 0.98, -0.17));
  g.add(box(0.05, 0.36, 0.34, hair, -0.2, 1.03, 0));
  g.add(box(0.05, 0.36, 0.34, hair, 0.2, 1.03, 0));
  g.add(box(0.1, 0.3, 0.1, hair, 0, 0.76, -0.24)); // cop
  g.add(box(0.16, 0.08, 0.06, '#9775fa', 0, 1.2, -0.2)); // mašle
  return { root: g, legs, arms, height: 1.26 };
}

function buildModel(kind: CreatureKind): Model {
  switch (kind) {
    case 'dog':
      return buildBulldog();
    case 'sheep':
      return buildSheep();
    case 'chick':
      return buildChick();
    case 'ondra':
      return buildOndra();
    case 'lauriska':
      return buildLauriska();
  }
}

/** Zvířátko nebo postavička. Zvířátka se toulají sama, postavičky chodí, kam jim dítě ukáže. */
export class Animal {
  readonly group = new THREE.Group();
  readonly isCharacter: boolean;
  private model: Model;
  private cell: Vec3;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private t = 1;
  private segDur = 0.5;
  private path: Vec3[] = [];
  private onArrive: ((ok: boolean) => void) | null = null;
  private wait = 1 + Math.random() * 2;
  private phase = 0;
  private jump = 0;
  private jumpV = 0;
  private spin = 0;
  private heading = 0;
  private marker: THREE.Group;
  private time = Math.random() * 10;
  private bubble: THREE.Sprite | null = null;
  private bubbleTimer = 0;
  /** Kolik kostek je tvor vysoký pro hledání cesty (děti 2, zvířátka 1). */
  readonly bodyHeight: number;

  constructor(
    readonly kind: CreatureKind,
    start: Vec3,
    world: World,
  ) {
    this.isCharacter = isCharacterKind(kind);
    this.bodyHeight = this.isCharacter ? 2 : 1;
    const lvl = this.isCharacter ? start.y : (world.standLevel(start.x, start.z, start.y) ?? 1);
    this.cell = { x: start.x, y: lvl, z: start.z };
    this.to.set(start.x + 0.5, lvl, start.z + 0.5);
    this.from.copy(this.to);
    this.model = buildModel(kind);
    this.group.add(this.model.root);
    this.group.position.copy(this.to);
    this.heading = this.isCharacter ? Math.PI / 4 : 0;

    // měkký stín
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 16),
      new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.01;
    this.group.add(shadow);

    // neviditelná „klikací“ krabička – malé postavičky se trefují snáz
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.8, this.model.height, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = this.model.height / 2;
    this.model.root.add(hit);
    this.model.root.traverse((o) => (o.userData.animal = this));

    // značka vybrané postavičky: zlatý kruh pod nohama a skákající šipka nad hlavou
    this.marker = new THREE.Group();
    const ringMat = new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.5, 28), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), new THREE.MeshLambertMaterial({ color: '#ffd43b', emissive: '#e67700' }));
    arrow.rotation.x = Math.PI;
    arrow.position.y = this.model.height + 0.45;
    arrow.name = 'arrow';
    this.marker.add(ring, arrow);
    this.marker.visible = false;
    this.group.add(this.marker);
  }

  get standCell(): Vec3 {
    return { ...this.cell };
  }

  get walking(): boolean {
    return this.t < 1 || this.path.length > 0;
  }

  /** Okamžitě přesune na místo (nový svět). */
  teleport(p: Vec3): void {
    this.path = [];
    this.onArrive = null;
    this.cell = { ...p };
    this.to.set(p.x + 0.5, p.y, p.z + 0.5);
    this.from.copy(this.to);
    this.t = 1;
  }

  /** Zobrazí bublinu (null = skrýt). `seconds` > 0 = sama zmizí. */
  setBubble(b: Bubble, seconds = 0): void {
    if (this.bubble) {
      this.group.remove(this.bubble);
      this.bubble = null;
    }
    this.bubbleTimer = seconds;
    if (!b) return;
    this.bubble = new THREE.Sprite(bubbleMaterial(b));
    this.bubble.scale.setScalar(1.15);
    this.bubble.position.y = this.model.height + 0.75;
    this.bubble.renderOrder = 10;
    this.group.add(this.bubble);
  }

  /** Chvíli zůstane na místě (např. pejsek v novém domečku). */
  rest(seconds: number): void {
    this.wait = seconds;
  }

  setSelected(on: boolean): void {
    this.marker.visible = on;
  }

  /** Reakce na ťuknutí – radostný poskok s otočkou. */
  poke(): void {
    if (this.jump <= 0.001) this.jumpV = 4.2;
    this.spin = Math.PI * 2;
  }

  /** Projde zadanou cestu (pole po poli). `onArrive(true)` = došel na konec. */
  walk(path: Vec3[], onArrive?: (ok: boolean) => void): void {
    this.path = [...path];
    this.onArrive = onArrive ?? null;
    if (path.length === 0) this.finish(true);
  }

  private finish(ok: boolean): void {
    const cb = this.onArrive;
    this.onArrive = null;
    this.path = [];
    cb?.(ok);
  }

  private startSegment(next: Vec3, speed: number): void {
    const dx = next.x - this.cell.x;
    const dz = next.z - this.cell.z;
    if (dx || dz) this.heading = Math.atan2(dx, dz);
    this.from.set(this.cell.x + 0.5, this.cell.y, this.cell.z + 0.5);
    this.to.set(next.x + 0.5, next.y, next.z + 0.5);
    this.cell = { ...next };
    this.t = 0;
    this.segDur = 1 / speed + (next.y !== this.from.y ? 0.12 : 0);
  }

  update(dt: number, world: World, blocked: (x: number, z: number) => boolean): void {
    this.time += dt;

    // Někdo postavil kostku přímo na postavičku/zvířátko → vyleze nahoru.
    if (this.t >= 1) {
      let y = this.cell.y;
      if (this.isCharacter) {
        while (y < WORLD_H - 2 && !isStandable(world, { ...this.cell, y }) && world.has({ ...this.cell, y })) y++;
      } else {
        y = world.standLevel(this.cell.x, this.cell.z, this.cell.y) ?? y;
      }
      if (y !== this.cell.y) {
        this.cell.y = y;
        this.to.y = y;
      }
    }

    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / this.segDur);
      this.phase += dt * (this.isCharacter ? 11 : 13);
    } else if (this.path.length > 0) {
      const next = this.path.shift()!;
      const ok = isStandable(world, next, this.bodyHeight) && next.y - this.cell.y <= 1;
      if (ok) this.startSegment(next, 2.4);
      else this.finish(false); // cestu mezitím někdo zastavěl
    } else {
      if (this.onArrive) this.finish(true);
      this.phase = 0;
      if (!this.isCharacter) {
        this.wait -= dt;
        if (this.wait <= 0) {
          this.wait = 1.5 + Math.random() * 3;
          this.wander(world, blocked);
        }
      }
    }

    // skok po ťuknutí
    if (this.jumpV !== 0 || this.jump > 0) {
      this.jumpV -= 14 * dt;
      this.jump = Math.max(0, this.jump + this.jumpV * dt);
      if (this.jump === 0 && this.jumpV < 0) this.jumpV = 0;
    }
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * 9);

    const moving = this.t < 1;
    const p = new THREE.Vector3().lerpVectors(this.from, this.to, this.t);
    const climb = this.from.y !== this.to.y ? Math.sin(Math.PI * this.t) * 0.45 : 0;
    const bob = moving ? Math.abs(Math.sin(this.phase)) * (this.isCharacter ? 0.05 : 0.1) : 0;
    this.group.position.set(p.x, p.y + climb + bob + this.jump, p.z);
    this.model.root.rotation.y = this.heading + this.spin;

    // chůze: nohy a ruce se střídají
    const swing = moving ? Math.sin(this.phase) * 0.7 : 0;
    this.model.legs.forEach((l, i) => (l.rotation.x = i % 2 ? -swing : swing));
    this.model.arms.forEach((a, i) => (a.rotation.x = i % 2 ? swing : -swing));

    if (this.bubble) {
      this.bubble.position.y = this.model.height + 0.75 + Math.sin(this.time * 2.5) * 0.06;
      if (this.bubbleTimer > 0) {
        this.bubbleTimer -= dt;
        if (this.bubbleTimer <= 0) this.setBubble(null);
      }
    }

    if (this.marker.visible) {
      const arrow = this.marker.getObjectByName('arrow');
      if (arrow) {
        arrow.position.y = this.model.height + 0.45 + Math.abs(Math.sin(this.time * 4)) * 0.2;
        arrow.rotation.y += dt * 3;
      }
    }
  }

  private wander(world: World, blocked: (x: number, z: number) => boolean): void {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].sort(() => Math.random() - 0.5);
    for (const [dx, dz] of dirs) {
      const nx = this.cell.x + dx;
      const nz = this.cell.z + dz;
      if (nx < 0 || nz < 0 || nx >= WORLD_W || nz >= WORLD_D) continue;
      if (blocked(nx, nz)) continue;
      const lvl = world.standLevel(nx, nz, this.cell.y);
      if (lvl === null || Math.abs(lvl - this.cell.y) > 1) continue;
      this.startSegment({ x: nx, y: lvl, z: nz }, 1.3);
      return;
    }
  }
}
