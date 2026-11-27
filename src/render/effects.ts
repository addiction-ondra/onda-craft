import * as THREE from 'three';
import type { Vec3 } from '../game/world';

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

/** Drobné vizuální efekty: obláček částic, „pop“ kostky, nápovědní duchové a majáčky. */
export class Effects {
  readonly group = new THREE.Group();
  private particles: Particle[] = [];
  private pops: Array<{ mesh: THREE.Mesh; t: number }> = [];
  private ghosts = new THREE.Group();
  private beacons = new THREE.Group();
  private time = 0;
  private partMats = new Map<string, THREE.MeshBasicMaterial>();
  private partGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  private popGeo = new THREE.BoxGeometry(1.06, 1.06, 1.06);
  private ghostMat = new THREE.MeshBasicMaterial({ color: '#ffd43b', transparent: true, opacity: 0.5, depthWrite: false });
  private ghostEdges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.02, 1.02, 1.02));
  private ghostLineMat = new THREE.LineBasicMaterial({ color: '#f76707', transparent: true, depthTest: false });
  private beaconMat = new THREE.MeshLambertMaterial({ color: '#ffd43b', emissive: '#b8860b' });

  private walkTarget: THREE.Mesh;

  constructor() {
    this.group.add(this.ghosts, this.beacons);
    // značka cíle, kam postavička jde
    this.walkTarget = new THREE.Mesh(
      new THREE.RingGeometry(0.18, 0.42, 24),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.walkTarget.rotation.x = -Math.PI / 2;
    this.walkTarget.visible = false;
    this.group.add(this.walkTarget);
  }

  /** Bílý kroužek tam, kam postavička jde (null = skrýt). */
  setWalkTarget(p: Vec3 | null): void {
    this.walkTarget.visible = !!p;
    if (p) this.walkTarget.position.set(p.x + 0.5, p.y + 0.04, p.z + 0.5);
  }

  burst(p: Vec3, color: string, count = 10): void {
    let m = this.partMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      this.partMats.set(color, m);
    }
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.partGeo, m);
      mesh.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
      const vel = new THREE.Vector3((Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, (Math.random() - 0.5) * 3);
      this.particles.push({ mesh, vel, life: 0.7 });
      this.group.add(mesh);
    }
  }

  /** Bílý záblesk kolem nově položené kostky. */
  pop(p: Vec3): void {
    const mesh = new THREE.Mesh(this.popGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
    mesh.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
    this.pops.push({ mesh, t: 0 });
    this.group.add(mesh);
  }

  /** Průhledné „duchové“ kostky ukazují, kam stavět. */
  setGhosts(list: Vec3[]): void {
    this.ghosts.clear();
    for (const p of list) {
      const m = new THREE.Mesh(this.popGeo, this.ghostMat);
      m.position.set(p.x + 0.5, p.y + 0.5, p.z + 0.5);
      m.userData.ghostPos = { x: p.x, y: p.y, z: p.z };
      const edges = new THREE.LineSegments(this.ghostEdges, this.ghostLineMat);
      edges.renderOrder = 5;
      m.add(edges);
      this.ghosts.add(m);
    }
  }

  /** Svítící místa (pro ťuknutí: kostka se položí přímo do nich). */
  ghostObjects(): THREE.Object3D[] {
    return this.ghosts.children;
  }

  /** Zlaté třpytky nad hledanými kostkami. */
  setBeacons(list: Vec3[]): void {
    this.beacons.clear();
    const geo = new THREE.OctahedronGeometry(0.3);
    for (const p of list) {
      const m = new THREE.Mesh(geo, this.beaconMat);
      m.position.set(p.x + 0.5, p.y + 1.7, p.z + 0.5);
      m.userData.baseY = m.position.y;
      this.beacons.add(m);
    }
  }

  get animating(): boolean {
    return this.particles.length > 0 || this.pops.length > 0 || this.ghosts.children.length > 0 || this.beacons.children.length > 0;
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.life -= dt;
      pt.vel.y -= 9 * dt;
      pt.mesh.position.addScaledVector(pt.vel, dt);
      pt.mesh.scale.setScalar(Math.max(0.01, pt.life / 0.7));
      if (pt.life <= 0) {
        this.group.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.t += dt;
      const k = p.t / 0.25;
      p.mesh.scale.setScalar(1 + 0.25 * (1 - k));
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - k);
      if (k >= 1) {
        this.group.remove(p.mesh);
        (p.mesh.material as THREE.Material).dispose();
        this.pops.splice(i, 1);
      }
    }
    const wave = 0.5 + 0.5 * Math.sin(this.time * 5);
    this.ghostMat.opacity = 0.35 + 0.35 * wave;
    this.ghostLineMat.opacity = 0.6 + 0.4 * wave;
    for (const g of this.ghosts.children) g.scale.setScalar(0.92 + 0.08 * wave);
    if (this.walkTarget.visible) this.walkTarget.scale.setScalar(0.85 + 0.2 * wave);
    for (const b of this.beacons.children) {
      b.rotation.y += dt * 2.5;
      b.position.y = b.userData.baseY + Math.sin(this.time * 3) * 0.2;
    }
  }
}
