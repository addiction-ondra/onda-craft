import * as THREE from 'three';
import { BLOCK_TYPES, type BlockType } from '../game/blocks';
import { WORLD_D, WORLD_H, WORLD_W, parseKey, type Vec3, type World } from '../game/world';
import { Animal, type CreatureKind } from './animals';
import { Effects } from './effects';
import { blockCanvases, blockMaterials } from './textures';

export type PickResult =
  | { kind: 'block'; pos: Vec3; normal: Vec3; block: BlockType }
  | { kind: 'animal'; animal: Animal }
  | null;

const CAPACITY = WORLD_W * WORLD_D * WORLD_H;
const ELEVATION = THREE.MathUtils.degToRad(45);
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.6;
/** Pohyb prstu (px), do kterého se gesto ještě počítá jako ťuknutí. */
const TAP_SLOP = 14;

interface PointerInfo {
  x: number;
  y: number;
  startX: number;
  startY: number;
  t: number;
}

/**
 * Veškerá práce s Three.js: scéna, izometrická kamera, instancované kostky,
 * zvířátka, efekty a dotykové gesto (ťuknutí / otočení / přiblížení).
 */
export class SceneView {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.OrthographicCamera;
  private meshes = new Map<BlockType, THREE.InstancedMesh>();
  private instancePos = new Map<BlockType, Vec3[]>();
  private renderedVersion = -1;
  private raycaster = new THREE.Raycaster();
  private timer = new THREE.Timer();
  private frame = 0;
  private resizeObs: ResizeObserver;
  readonly effects = new Effects();
  readonly animals: Animal[] = [];
  private waterTex: THREE.Texture[] = [];

  // kamera
  private azimuth = THREE.MathUtils.degToRad(45);
  private targetAzimuth = this.azimuth;
  private zoom = 1;
  private targetZoom = 1;
  private center = new THREE.Vector3(WORLD_W / 2, 1, WORLD_D / 2);

  // vstup
  private pointers = new Map<number, PointerInfo>();
  private gestureMoved = false;
  private pinchDist = 0;
  private pinchMid = { x: 0, y: 0 };

  /** Zavolá se při ťuknutí (ne při otáčení/zoomu). */
  onTap: (clientX: number, clientY: number) => void = () => {};

  constructor(
    private container: HTMLElement,
    private world: World,
  ) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'game-canvas';
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.scene.background = new THREE.Color('#8fd3f5');

    this.setupLights();
    this.setupIsland();
    this.setupBlocks();
    this.scene.add(this.effects.group);

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(container);
    this.resize();
    this.setupInput();
    this.loop();
  }

  setWorld(world: World): void {
    this.world = world;
    this.renderedVersion = -1;
  }

  // ------------------------------------------------------------------ scéna

  private setupLights(): void {
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#b2d8a0', 2.1));
    const sun = new THREE.DirectionalLight('#fff6e0', 1.9);
    sun.position.set(6, 14, 9);
    this.scene.add(sun);
  }

  private setupIsland(): void {
    // „Plovoucí ostrov“ – hlína pod terénem.
    const side = blockCanvases('grass').bottom;
    const mk = (rx: number, ry: number) => {
      const t = new THREE.CanvasTexture(side);
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshLambertMaterial({ map: t });
    };
    const sideMat = mk(WORLD_W, 2);
    const bottom = mk(WORLD_W, WORLD_D);
    const island = new THREE.Mesh(new THREE.BoxGeometry(WORLD_W, 2, WORLD_D), [sideMat, sideMat, bottom, bottom, sideMat, sideMat]);
    island.position.set(WORLD_W / 2, -1, WORLD_D / 2);
    this.scene.add(island);
  }

  private setupBlocks(): void {
    const full = new THREE.BoxGeometry(1, 1, 1);
    const waterGeo = new THREE.BoxGeometry(1, 0.84, 1);
    waterGeo.translate(0, -0.08, 0);
    for (const t of BLOCK_TYPES) {
      const materials = blockMaterials(t);
      if (t === 'water') {
        for (const m of materials) {
          const map = (m as THREE.MeshLambertMaterial).map;
          if (map && !this.waterTex.includes(map)) {
            map.wrapS = map.wrapT = THREE.RepeatWrapping;
            this.waterTex.push(map);
          }
        }
      }
      const mesh = new THREE.InstancedMesh(t === 'water' ? waterGeo : full, materials, CAPACITY);
      mesh.count = 0;
      mesh.frustumCulled = false;
      mesh.userData.blockType = t;
      if (t === 'water') mesh.renderOrder = 1;
      this.meshes.set(t, mesh);
      this.instancePos.set(t, []);
      this.scene.add(mesh);
    }
  }


  /** Přidá zvířátko nebo postavičku na dané místo. */
  addAnimal(kind: CreatureKind, start: Vec3): Animal {
    const a = new Animal(kind, start, this.world);
    this.animals.push(a);
    this.scene.add(a.group);
    return a;
  }

  private rebuildBlocks(): void {
    const per = new Map<BlockType, Vec3[]>();
    for (const t of BLOCK_TYPES) per.set(t, []);
    for (const [k, t] of this.world.entries()) per.get(t)!.push(parseKey(k));
    const m4 = new THREE.Matrix4();
    for (const [t, list] of per) {
      const mesh = this.meshes.get(t)!;
      list.forEach((p, i) => {
        m4.makeTranslation(p.x + 0.5, p.y + 0.5, p.z + 0.5);
        mesh.setMatrixAt(i, m4);
      });
      mesh.count = list.length;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      this.instancePos.set(t, list);
    }
    this.renderedVersion = this.world.version;
  }

  // ----------------------------------------------------------------- kamera

  private resize(): void {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    let halfW = aspect < 1 ? 11.8 : 12.5;
    let halfH = halfW / aspect;
    if (halfH < 9.5) {
      halfH = 9.5;
      halfW = halfH * aspect;
    }
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    // Mírný posun obrazu nahoru, ať spodní lišta s materiály nezakrývá svět.
    this.camera.setViewOffset(w, h, 0, h * 0.05, w, h);
  }

  private updateCamera(dt: number): void {
    const k = 1 - Math.exp(-dt * 10);
    this.azimuth += (this.targetAzimuth - this.azimuth) * k;
    this.zoom += (this.targetZoom - this.zoom) * k;
    const d = 50;
    this.camera.position.set(
      this.center.x + Math.sin(this.azimuth) * Math.cos(ELEVATION) * d,
      this.center.y + Math.sin(ELEVATION) * d,
      this.center.z + Math.cos(this.azimuth) * Math.cos(ELEVATION) * d,
    );
    this.camera.lookAt(this.center);
    if (this.camera.zoom !== this.zoom) {
      this.camera.zoom = this.zoom;
      this.camera.updateProjectionMatrix();
    }
  }

  /** Kamera dojela do cílové polohy (pro testy). */
  isSettled(): boolean {
    return Math.abs(this.targetAzimuth - this.azimuth) < 1e-3 && Math.abs(this.targetZoom - this.zoom) < 1e-3;
  }

  /** Otočení o čtvrt kruhu (tlačítka). */
  rotateStep(dir: 1 | -1): void {
    this.targetAzimuth += (dir * Math.PI) / 2;
  }

  zoomBy(f: number): void {
    this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * f, MIN_ZOOM, MAX_ZOOM);
  }

  resetView(): void {
    this.targetZoom = 1;
    this.center.set(WORLD_W / 2, 1, WORLD_D / 2);
  }

  private pan(dxPx: number, dyPx: number): void {
    const h = this.container.clientHeight || 1;
    const worldPerPx = (this.camera.top - this.camera.bottom) / this.zoom / h;
    const right = new THREE.Vector3(Math.cos(this.azimuth), 0, -Math.sin(this.azimuth));
    const fwd = new THREE.Vector3(-Math.sin(this.azimuth), 0, -Math.cos(this.azimuth));
    this.center.addScaledVector(right, -dxPx * worldPerPx);
    this.center.addScaledVector(fwd, (dyPx * worldPerPx) / Math.sin(ELEVATION));
    this.center.x = THREE.MathUtils.clamp(this.center.x, 0, WORLD_W);
    this.center.z = THREE.MathUtils.clamp(this.center.z, 0, WORLD_D);
  }

  // ------------------------------------------------------------------ vstup

  private setupInput(): void {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture?.(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, t: performance.now() });
      if (this.pointers.size === 1) this.gestureMoved = false;
      if (this.pointers.size === 2) {
        this.gestureMoved = true; // dva prsty nikdy nejsou ťuknutí
        const [a, b] = [...this.pointers.values()];
        this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
        this.pinchMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      }
    });
    el.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        if (Math.hypot(p.x - p.startX, p.y - p.startY) > TAP_SLOP) this.gestureMoved = true;
        if (this.gestureMoved) {
          const w = this.container.clientWidth || 1;
          this.targetAzimuth -= (dx / w) * Math.PI * 1.2;
        }
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        if (this.pinchDist > 0) this.targetZoom = THREE.MathUtils.clamp(this.targetZoom * (dist / this.pinchDist), MIN_ZOOM, MAX_ZOOM);
        this.pan(mid.x - this.pinchMid.x, mid.y - this.pinchMid.y);
        this.pinchDist = dist;
        this.pinchMid = mid;
      }
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      const isTap = e.type === 'pointerup' && !this.gestureMoved && this.pointers.size === 0 && performance.now() - p.t < 800;
      if (isTap) this.onTap(e.clientX, e.clientY);
      if (this.pointers.size === 1) {
        // po zoomu zbyl jeden prst – nezačínat ťuknutí
        const rest = [...this.pointers.values()][0];
        rest.startX = rest.x;
        rest.startY = rest.y;
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(e.deltaY > 0 ? 0.9 : 1.1);
      },
      { passive: false },
    );
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  pick(clientX: number, clientY: number): PickResult {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);

    const animalHits = this.raycaster.intersectObjects(
      this.animals.map((a) => a.group),
      true,
    );
    const blockHits = this.raycaster.intersectObjects([...this.meshes.values()], false);
    const blockHit = blockHits.find((h) => h.instanceId !== undefined && h.face);
    const animalHit = animalHits.find((h) => h.object.userData.animal);

    if (animalHit && (!blockHit || animalHit.distance <= blockHit.distance + 0.6)) {
      return { kind: 'animal', animal: animalHit.object.userData.animal as Animal };
    }
    if (!blockHit) return null;
    const t = blockHit.object.userData.blockType as BlockType;
    const pos = this.instancePos.get(t)![blockHit.instanceId!];
    // Voda je nižší než tráva, takže ťuknutí často trefí její boční stěnu.
    // Dítě ale chce stavět „na řeku“ – u vody proto vždy bereme horní stěnu.
    const n = t === 'water' ? new THREE.Vector3(0, 1, 0) : blockHit.face!.normal;
    return { kind: 'block', pos, block: t, normal: { x: Math.round(n.x), y: Math.round(n.y), z: Math.round(n.z) } };
  }

  /** Pro automatické testy: pozice středu horní stěny kostky na obrazovce. */
  projectToScreen(p: Vec3, face: 'top' | 'center' = 'top'): { x: number; y: number } {
    const v = new THREE.Vector3(p.x + 0.5, p.y + (face === 'top' ? 1 : 0.5), p.z + 0.5).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  // ------------------------------------------------------------------ smyčka

  private blockedForAnimals = (x: number, z: number) =>
    this.animals.some((a) => {
      const c = a.standCell;
      return c.x === x && c.z === z;
    });

  private loop = (): void => {
    this.frame = requestAnimationFrame(this.loop);
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    if (this.world.version !== this.renderedVersion) this.rebuildBlocks();
    this.updateCamera(dt);
    for (const a of this.animals) a.update(dt, this.world, this.blockedForAnimals);
    this.effects.update(dt);
    for (const t of this.waterTex) t.offset.x = (t.offset.x + dt * 0.03) % 1;
    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObs.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
