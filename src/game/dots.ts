/**
 * Hra „Spoj tečky podle vzoru“ u vánočního stromečku (čistá logika).
 * Mřížka 2 sloupce × 3 řady teček – jako na pracovním listu „Zakresli podle vzoru“.
 * Tečka = [sloupec, řada], sloupec 0–1 (zleva), řada 0–2 (shora).
 */
export type Dot = readonly [number, number];
export type Line = readonly [Dot, Dot];

export const DOT_COLS = 2;
export const DOT_ROWS = 3;

export const ALL_DOTS: Dot[] = Array.from({ length: DOT_COLS * DOT_ROWS }, (_, i) => [i % DOT_COLS, Math.floor(i / DOT_COLS)] as const);

const L = (a: Dot, b: Dot): Line => [a, b];
// zkratky pro čitelnost: levý/pravý sloupec, horní/prostřední/dolní řada
const LT: Dot = [0, 0];
const RT: Dot = [1, 0];
const LM: Dot = [0, 1];
const RM: Dot = [1, 1];
const LB: Dot = [0, 2];
const RB: Dot = [1, 2];

/** 8 úrovní podle předlohy (zleva doprava, shora dolů). */
export const DOT_LEVELS: Line[][] = [
  // 1. špička doleva („<“)
  [L(RT, LM), L(LM, RM), L(LM, RB)],
  // 2. obdélník
  [L(LT, RT), L(RT, RB), L(RB, LB), L(LB, LT)],
  // 3. klikatice
  [L(LT, RM), L(RM, LM), L(LM, RB), L(RB, LB)],
  // 4. trojka obráceně
  [L(LT, RT), L(RT, LM), L(LM, RM), L(LM, RB), L(RB, LB)],
  // 5. špička doprava („>“ se třemi paprsky)
  [L(LT, RM), L(LM, RM), L(LB, RM)],
  // 6. háček
  [L(LT, RT), L(RT, LM), L(LM, LB), L(LB, RB), L(RB, RM)],
  // 7. dvojité Z
  [L(LT, RT), L(RT, LM), L(LM, RM), L(RM, LB), L(LB, RB)],
  // 8. kosodélník
  [L(LT, RM), L(RM, RB), L(RB, LM), L(LM, LT)],
];

const key = (d: Dot) => `${d[0]},${d[1]}`;
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/**
 * Rozloží čáru na úseky mezi sousedními tečkami, kterými prochází
 * (svislá čára přes celý sloupec = dva úseky). Díky tomu je jedno, jestli dítě
 * kreslí po jednom úseku, nebo táhne přes víc teček najednou.
 */
export function splitLine(a: Dot, b: Dot): Line[] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const n = gcd(dx, dy);
  if (n <= 1) return [[a, b]];
  const out: Line[] = [];
  for (let i = 0; i < n; i++) {
    const p: Dot = [a[0] + (dx / n) * i, a[1] + (dy / n) * i];
    const q: Dot = [a[0] + (dx / n) * (i + 1), a[1] + (dy / n) * (i + 1)];
    out.push([p, q]);
  }
  return out;
}

/** Jednoznačný klíč úseku (nezáleží na směru). */
export function lineKey(a: Dot, b: Dot): string {
  const ka = key(a);
  const kb = key(b);
  return ka < kb ? `${ka}-${kb}` : `${kb}-${ka}`;
}

export const parseLineKey = (k: string): Line => {
  const [a, b] = k.split('-').map((p) => p.split(',').map(Number) as unknown as Dot);
  return [a, b];
};

/** Všechny úseky, které má úroveň obsahovat. */
export function levelKeys(level: number): Set<string> {
  const out = new Set<string>();
  for (const [a, b] of DOT_LEVELS[level]) for (const [p, q] of splitLine(a, b)) out.add(lineKey(p, q));
  return out;
}

/** Patří nakreslená čára do vzoru? Vrátí klíče úseků (prázdné = čára do vzoru nepatří). */
export function acceptLine(level: number, a: Dot, b: Dot): string[] {
  const want = levelKeys(level);
  const parts = splitLine(a, b).map(([p, q]) => lineKey(p, q));
  return parts.every((k) => want.has(k)) ? parts : [];
}

export interface DotStatus {
  done: boolean;
  /** Úseky, které ještě chybí. */
  missing: string[];
}

export function dotStatus(level: number, drawn: Iterable<string>): DotStatus {
  const have = new Set(drawn);
  const missing = [...levelKeys(level)].filter((k) => !have.has(k));
  return { done: missing.length === 0, missing };
}

/** Nápověda 1: tečky, které se ještě mají spojit. */
export function hintDots(level: number, drawn: Iterable<string>): Dot[] {
  const seen = new Map<string, Dot>();
  for (const k of dotStatus(level, drawn).missing) for (const d of parseLineKey(k)) seen.set(key(d), d);
  return [...seen.values()];
}
