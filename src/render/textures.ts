import * as THREE from 'three';
import { BLOCK_TYPES, type BlockType } from '../game/blocks';

/**
 * Vlastní pixelové textury generované kódem (16×16). Žádné převzaté assety.
 * Styl: jasné, měkké barvy, jemný šum, výrazný obrys kostky pro čitelnost.
 */
const S = 16;

/** Deterministický pseudonáhodný generátor (stejné textury při každém spuštění). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function shade(hex: string, amt: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + amt)));
  return `#${c.getHexString()}`;
}

type Painter = (g: CanvasRenderingContext2D, r: () => number) => void;

function canvas(paint: Painter, seed: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  paint(g, rng(seed));
  return c;
}

function noise(base: string, spread: number, density = 1): Painter {
  return (g, r) => {
    g.fillStyle = base;
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        if (r() > density) continue;
        const v = (r() - 0.5) * spread;
        g.fillStyle = shade(base, v);
        g.fillRect(x, y, 1, 1);
      }
  };
}

function border(color: string, alpha = 0.35): Painter {
  return (g) => {
    g.globalAlpha = alpha;
    g.fillStyle = color;
    g.fillRect(0, 0, S, 1);
    g.fillRect(0, S - 1, S, 1);
    g.fillRect(0, 0, 1, S);
    g.fillRect(S - 1, 0, 1, S);
    g.globalAlpha = 1;
  };
}

const combine =
  (...ps: Painter[]): Painter =>
  (g, r) =>
    ps.forEach((p) => p(g, r));

const DIRT = '#9b6b3d';

const planks: Painter = (g, r) => {
  noise('#c98a4b', 0.06)(g, r);
  g.fillStyle = shade('#c98a4b', -0.18);
  for (const y of [3, 7, 11, 15]) g.fillRect(0, y, S, 1);
  for (const [x, y] of [
    [5, 0],
    [12, 4],
    [3, 8],
    [10, 12],
  ])
    g.fillRect(x, y, 1, 3);
};

const brick: Painter = (g, r) => {
  noise('#e53935', 0.08)(g, r);
  g.fillStyle = '#ffb4a8';
  g.globalAlpha = 0.55;
  for (const y of [3, 7, 11, 15]) g.fillRect(0, y, S, 1);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let x = off; x < S; x += 8) g.fillRect(x, row * 4, 1, 3);
  }
  g.globalAlpha = 1;
};

const glassBlue: Painter = (g, r) => {
  noise('#4aa8ff', 0.05)(g, r);
  g.fillStyle = '#d6ecff';
  g.fillRect(3, 3, 3, 1);
  g.fillRect(3, 4, 1, 2);
  g.fillStyle = shade('#4aa8ff', -0.2);
  g.fillRect(1, 1, S - 2, 1);
  g.fillRect(1, S - 2, S - 2, 1);
  g.fillRect(1, 1, 1, S - 2);
  g.fillRect(S - 2, 1, 1, S - 2);
};

const grassSide: Painter = (g, r) => {
  noise(DIRT, 0.1)(g, r);
  for (let x = 0; x < S; x++) {
    const h = 3 + Math.floor(r() * 3);
    for (let y = 0; y < h; y++) {
      g.fillStyle = shade('#5cc43c', (r() - 0.5) * 0.1);
      g.fillRect(x, y, 1, 1);
    }
  }
};

const grassTop: Painter = (g, r) => {
  noise('#5cc43c', 0.12)(g, r);
  // malé kytičky
  const flowers = ['#fff', '#ffe066', '#ff8fab'];
  for (let i = 0; i < 2; i++) {
    g.fillStyle = flowers[Math.floor(r() * flowers.length)];
    g.fillRect(2 + Math.floor(r() * 12), 2 + Math.floor(r() * 12), 1, 1);
  }
};

const logSide: Painter = (g, r) => {
  noise('#8a5a2b', 0.08)(g, r);
  g.fillStyle = shade('#8a5a2b', -0.15);
  for (let x = 1; x < S; x += 4) g.fillRect(x, 0, 1, S);
};

const logTop: Painter = (g, r) => {
  noise('#d9a066', 0.05)(g, r);
  g.strokeStyle = shade('#d9a066', -0.2);
  g.lineWidth = 1;
  for (const rad of [2.5, 5, 7.5]) {
    g.beginPath();
    g.arc(8, 8, rad, 0, Math.PI * 2);
    g.stroke();
  }
};

const leaves: Painter = (g, r) => {
  noise('#2f9e44', 0.25)(g, r);
  for (let i = 0; i < 3; i++) {
    g.fillStyle = '#ff6b6b';
    if (r() > 0.5) g.fillRect(Math.floor(r() * 14) + 1, Math.floor(r() * 14) + 1, 2, 2);
  }
};

const water: Painter = (g, r) => {
  noise('#3d8fe0', 0.05)(g, r);
  g.fillStyle = '#a5d8ff';
  for (let y = 2; y < S; y += 5) for (let x = (y * 3) % 6; x < S; x += 7) g.fillRect(x, y, 3, 1);
};

const wall: Painter = (g, r) => {
  noise('#fbefd5', 0.04)(g, r);
  g.fillStyle = shade('#fbefd5', -0.08);
  g.fillRect(0, 7, S, 1);
  g.fillRect(7, 0, 1, 7);
  g.fillRect(3, 8, 1, 8);
  g.fillRect(11, 8, 1, 8);
};

const roof: Painter = (g, r) => {
  noise('#5c6bc0', 0.06)(g, r);
  g.fillStyle = shade('#5c6bc0', -0.15);
  for (let y = 3; y < S; y += 4) g.fillRect(0, y, S, 1);
  g.fillStyle = shade('#5c6bc0', 0.15);
  for (let y = 0; y < S; y += 4) g.fillRect(0, y, S, 1);
};

const sand: Painter = noise('#f4d470', 0.12);
const stone: Painter = (g, r) => {
  noise('#9aa3ad', 0.16)(g, r);
  g.fillStyle = shade('#9aa3ad', -0.18);
  g.fillRect(3, 4, 4, 1);
  g.fillRect(9, 10, 4, 1);
  g.fillRect(10, 3, 1, 3);
};

/** Dřevěná bedna s bílým otazníkem. */
const QUESTION_MARK = [
  '......',
  '.####.',
  '##..##',
  '....##',
  '...##.',
  '..##..',
  '..##..',
  '......',
  '..##..',
];
const questionBox: Painter = (g, r) => {
  noise('#f59f00', 0.06)(g, r);
  // rám bedny
  g.fillStyle = '#a05a00';
  g.fillRect(0, 0, S, 2);
  g.fillRect(0, S - 2, S, 2);
  g.fillRect(0, 0, 2, S);
  g.fillRect(S - 2, 0, 2, S);
  g.fillStyle = '#ffd43b';
  g.fillRect(2, 2, S - 4, 1);
  // otazník
  const ox = 5;
  const oy = 3;
  QUESTION_MARK.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c !== '#') return;
      g.fillStyle = '#7a3e00';
      g.fillRect(ox + x + 1, oy + y + 1, 1, 1);
      g.fillStyle = '#ffffff';
      g.fillRect(ox + x, oy + y, 1, 1);
    }),
  );
};

interface FacePainters {
  top: Painter;
  side: Painter;
  bottom: Painter;
}

const PAINTERS: Record<BlockType, FacePainters> = {
  grass: { top: combine(grassTop, border('#2b7a1d', 0.3)), side: combine(grassSide, border('#5a3a1a', 0.3)), bottom: noise(DIRT, 0.1) },
  wood: { top: combine(planks, border('#6b4423')), side: combine(planks, border('#6b4423')), bottom: planks },
  stone: { top: combine(stone, border('#555')), side: combine(stone, border('#555')), bottom: stone },
  red: { top: combine(brick, border('#8b1a1a')), side: combine(brick, border('#8b1a1a')), bottom: brick },
  sand: { top: combine(sand, border('#b8932f', 0.3)), side: combine(sand, border('#b8932f', 0.3)), bottom: sand },
  blue: { top: glassBlue, side: glassBlue, bottom: glassBlue },
  water: { top: water, side: water, bottom: water },
  log: { top: logTop, side: logSide, bottom: logTop },
  leaves: { top: leaves, side: leaves, bottom: leaves },
  wall: { top: combine(wall, border('#c9b48a')), side: combine(wall, border('#c9b48a')), bottom: wall },
  roof: { top: combine(roof, border('#2f3a86')), side: combine(roof, border('#2f3a86')), bottom: roof },
  question: { top: questionBox, side: questionBox, bottom: questionBox },
};

export interface BlockCanvases {
  top: HTMLCanvasElement;
  side: HTMLCanvasElement;
  bottom: HTMLCanvasElement;
}

const cache = new Map<BlockType, BlockCanvases>();

export function blockCanvases(t: BlockType): BlockCanvases {
  let c = cache.get(t);
  if (!c) {
    const seed = BLOCK_TYPES.indexOf(t) * 97 + 13;
    const p = PAINTERS[t];
    c = { top: canvas(p.top, seed), side: canvas(p.side, seed + 1), bottom: canvas(p.bottom, seed + 2) };
    cache.set(t, c);
  }
  return c;
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Materiály pro BoxGeometry v pořadí +x, -x, +y, -y, +z, -z. */
export function blockMaterials(t: BlockType): THREE.Material[] {
  const c = blockCanvases(t);
  const transparent = t === 'water';
  const mk = (cv: HTMLCanvasElement) =>
    new THREE.MeshLambertMaterial({ map: toTexture(cv), transparent, opacity: transparent ? 0.82 : 1 });
  const side = mk(c.side);
  return [side, side, mk(c.top), mk(c.bottom), side, side];
}

/** Malá izometrická kostička pro paletu (data URL). */
export function blockIcon(t: BlockType, size = 96): string {
  const c = blockCanvases(t);
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const s = size * 0.46; // délka hrany (výška ikony = 2·s)
  const cx = size / 2;
  const h = s * 0.5;
  const top = size * 0.04;
  // horní stěna
  g.save();
  g.setTransform(s / S, h / S, -s / S, h / S, cx, top);
  g.drawImage(c.top, 0, 0);
  g.restore();
  // levá stěna
  g.save();
  g.setTransform(s / S, h / S, 0, s / S, cx - s, top + h);
  g.drawImage(c.side, 0, 0);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(0, 0, S, S);
  g.restore();
  // pravá stěna
  g.save();
  g.setTransform(s / S, -h / S, 0, s / S, cx, top + 2 * h);
  g.drawImage(c.side, 0, 0);
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(0, 0, S, S);
  g.restore();
  return cv.toDataURL('image/png');
}
