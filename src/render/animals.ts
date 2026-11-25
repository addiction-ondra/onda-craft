import * as THREE from 'three';
import { WORLD_D, WORLD_W, type World } from '../game/world';

export type AnimalKind = 'dog' | 'sheep' | 'chick';

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

/** Jednoduché „kostičkové“ modely – vlastní návrh. Model je otočen čumákem k +z. */
function buildModel(kind: AnimalKind): THREE.Group {
  const g = new THREE.Group();
  const eye = '#1b1b1b';
  if (kind === 'dog') {
    // pejsek Freny: hnědý s bílou náprsenkou a tmavýma ušima
    const fur = '#b5773f';
    g.add(box(0.36, 0.3, 0.62, fur, 0, 0.36, 0));
    g.add(box(0.3, 0.12, 0.2, '#fff4e0', 0, 0.28, 0.22));
    g.add(box(0.34, 0.32, 0.32, fur, 0, 0.62, 0.36));
    g.add(box(0.2, 0.14, 0.14, '#fff4e0', 0, 0.55, 0.56));
    g.add(box(0.08, 0.07, 0.05, eye, 0, 0.6, 0.63));
    g.add(box(0.07, 0.07, 0.02, eye, -0.09, 0.7, 0.53));
    g.add(box(0.07, 0.07, 0.02, eye, 0.09, 0.7, 0.53));
    g.add(box(0.08, 0.2, 0.12, '#6b3f1d', -0.2, 0.66, 0.34));
    g.add(box(0.08, 0.2, 0.12, '#6b3f1d', 0.2, 0.66, 0.34));
    const tail = box(0.07, 0.22, 0.07, fur, 0, 0.55, -0.33);
    tail.rotation.x = -0.6;
    g.add(tail);
    g.add(box(0.06, 0.04, 0.03, '#e8590c', 0, 0.52, 0.64));
    for (const [x, z] of [
      [-0.12, 0.2],
      [0.12, 0.2],
      [-0.12, -0.2],
      [0.12, -0.2],
    ])
      g.add(box(0.1, 0.22, 0.1, fur, x, 0.11, z));
  } else if (kind === 'sheep') {
    g.add(box(0.5, 0.4, 0.66, '#ffffff', 0, 0.45, 0));
    g.add(box(0.28, 0.28, 0.24, '#f1e3d3', 0, 0.58, 0.4));
    g.add(box(0.06, 0.06, 0.02, eye, -0.07, 0.62, 0.53));
    g.add(box(0.06, 0.06, 0.02, eye, 0.07, 0.62, 0.53));
    g.add(box(0.32, 0.1, 0.2, '#ffffff', 0, 0.75, 0.38));
    for (const [x, z] of [
      [-0.15, 0.2],
      [0.15, 0.2],
      [-0.15, -0.2],
      [0.15, -0.2],
    ])
      g.add(box(0.1, 0.26, 0.1, '#5c4033', x, 0.13, z));
  } else {
    g.add(box(0.28, 0.26, 0.3, '#ffd43b', 0, 0.28, 0));
    g.add(box(0.2, 0.2, 0.2, '#ffe066', 0, 0.48, 0.1));
    g.add(box(0.08, 0.05, 0.08, '#f76707', 0, 0.46, 0.24));
    g.add(box(0.04, 0.04, 0.02, eye, -0.05, 0.52, 0.2));
    g.add(box(0.04, 0.04, 0.02, eye, 0.05, 0.52, 0.2));
    g.add(box(0.04, 0.14, 0.04, '#f76707', -0.06, 0.08, 0));
    g.add(box(0.04, 0.14, 0.04, '#f76707', 0.06, 0.08, 0));
  }
  // měkký stín
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 16),
    new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  g.add(shadow);
  return g;
}

export class Animal {
  readonly group: THREE.Group;
  private model: THREE.Group;
  private cx: number;
  private cz: number;
  private level = 1;
  private pos: THREE.Vector3;
  private target: THREE.Vector3;
  private wait = 1 + Math.random() * 2;
  private hop = 0;
  private jump = 0;
  private jumpV = 0;
  private spin = 0;
  private heading = 0;

  constructor(readonly kind: AnimalKind, x: number, z: number, world: World) {
    this.cx = x;
    this.cz = z;
    this.level = world.standLevel(x, z, 1) ?? 1;
    this.pos = new THREE.Vector3(x + 0.5, this.level, z + 0.5);
    this.target = this.pos.clone();
    this.group = new THREE.Group();
    this.model = buildModel(kind);
    this.group.add(this.model);
    this.group.position.copy(this.pos);
    this.group.traverse((o) => (o.userData.animal = this));
  }

  /** Reakce na ťuknutí – radostný poskok s otočkou. */
  poke(): void {
    if (this.jump <= 0.001) this.jumpV = 4.2;
    this.spin = Math.PI * 2;
  }

  get cell(): { x: number; z: number } {
    return { x: this.cx, z: this.cz };
  }

  update(dt: number, world: World, blocked: (x: number, z: number) => boolean): void {
    // Když někdo postaví kostku přímo na zvířátko, vyleze nahoru.
    const lvl = world.standLevel(this.cx, this.cz, this.level);
    if (lvl !== null && lvl !== this.level) {
      this.level = lvl;
      this.target.y = lvl;
    }

    const moving = this.pos.distanceTo(this.target) > 0.02;
    if (moving) {
      const step = Math.min(1, (dt * 1.3) / Math.max(0.001, this.pos.distanceTo(this.target)));
      this.pos.lerp(this.target, step);
      this.hop += dt * 12;
    } else {
      this.pos.copy(this.target);
      this.hop = 0;
      this.wait -= dt;
      if (this.wait <= 0) {
        this.wait = 1.5 + Math.random() * 3;
        this.pickNext(world, blocked);
      }
    }

    // skok po ťuknutí
    if (this.jumpV !== 0 || this.jump > 0) {
      this.jumpV -= 14 * dt;
      this.jump = Math.max(0, this.jump + this.jumpV * dt);
      if (this.jump === 0 && this.jumpV < 0) this.jumpV = 0;
    }
    if (this.spin > 0) this.spin = Math.max(0, this.spin - dt * 9);

    const bob = moving ? Math.abs(Math.sin(this.hop)) * 0.12 : 0;
    this.group.position.set(this.pos.x, this.pos.y + bob + this.jump, this.pos.z);
    this.model.rotation.y = this.heading + this.spin;
  }

  private pickNext(world: World, blocked: (x: number, z: number) => boolean): void {
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].sort(() => Math.random() - 0.5);
    for (const [dx, dz] of dirs) {
      const nx = this.cx + dx;
      const nz = this.cz + dz;
      if (nx < 0 || nz < 0 || nx >= WORLD_W || nz >= WORLD_D) continue;
      if (blocked(nx, nz)) continue;
      const lvl = world.standLevel(nx, nz, this.level);
      if (lvl === null || Math.abs(lvl - this.level) > 1) continue;
      this.cx = nx;
      this.cz = nz;
      this.level = lvl;
      this.target.set(nx + 0.5, lvl, nz + 0.5);
      this.heading = Math.atan2(dx, dz);
      return;
    }
  }
}
