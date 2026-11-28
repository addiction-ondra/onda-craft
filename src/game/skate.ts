/**
 * Krasobruslení tučňáka Pepíka (čistá logika): tečkované tvary na ledě,
 * dítě je obtáhne prstem a tučňák pak tvar objede.
 * Souřadnice 0–100 (pohled shora na ledovou plochu).
 */
export type Pt = readonly [number, number];

export interface SkateShape {
  id: 'circle' | 'square' | 'triangle' | 'heart' | 'star';
  /** Uzavřená lomená čára (poslední bod se spojí s prvním). */
  points: Pt[];
}

const circle = (n: number, r: number): Pt[] =>
  Array.from({ length: n }, (_, i) => [50 + r * Math.cos((i / n) * Math.PI * 2 - Math.PI / 2), 50 + r * Math.sin((i / n) * Math.PI * 2 - Math.PI / 2)] as const);

const heart = (n: number): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [50 + x * 2.3, 47 - y * 2.3] as const;
  });

const star = (): Pt[] =>
  Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? 36 : 16;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return [50 + r * Math.cos(a), 52 + r * Math.sin(a)] as const;
  });

/** Od nejjednoduššího: kruh, čtverec, trojúhelník, srdíčko, hvězda. */
export const SKATE_SHAPES: SkateShape[] = [
  { id: 'circle', points: circle(40, 32) },
  {
    id: 'square',
    points: [
      [20, 20],
      [80, 20],
      [80, 80],
      [20, 80],
    ],
  },
  {
    id: 'triangle',
    points: [
      [50, 15],
      [85, 80],
      [15, 80],
    ],
  },
  { id: 'heart', points: heart(48) },
  { id: 'star', points: star() },
];

/** Body po obvodu tvaru s rovnoměrnými rozestupy (uzavřeně). */
export function sampleOutline(points: Pt[], spacing: number): Pt[] {
  const out: Pt[] = [];
  let carry = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = carry;
    while (d < len) {
      const t = d / len;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      d += spacing;
    }
    carry = d - len;
  }
  return out;
}

/** Délka obvodu (pro animaci bruslení). */
export function outlineLength(points: Pt[]): number {
  let l = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    l += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return l;
}

/** Bod na obvodu ve vzdálenosti `d` od začátku (a směr pohybu v radiánech). */
export function pointAt(points: Pt[], d: number): { p: Pt; angle: number } {
  const total = outlineLength(points);
  let rest = ((d % total) + total) % total;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (rest <= len) {
      const t = len ? rest / len : 0;
      return { p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    }
    rest -= len;
  }
  return { p: points[0], angle: 0 };
}

/** Rozsvítí tečky, kolem kterých prst projel (vrátí indexy nově rozsvícených). */
export function lightDots(dots: Pt[], lit: boolean[], finger: Pt, radius: number): number[] {
  const out: number[] = [];
  dots.forEach((d, i) => {
    if (!lit[i] && Math.hypot(d[0] - finger[0], d[1] - finger[1]) <= radius) {
      lit[i] = true;
      out.push(i);
    }
  });
  return out;
}

/** Hotovo, když je obtaženo aspoň 90 % teček (malé zakolísání prstu nevadí). */
export const SKATE_DONE = 0.9;
export const traced = (lit: boolean[]): number => lit.filter(Boolean).length / Math.max(1, lit.length);
