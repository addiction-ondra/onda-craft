import type { BlockType } from './blocks';

/**
 * Úkoly z beden s otazníkem. Jen data – zobrazení je v ui/QuizOverlay.tsx,
 * texty a hlas v i18n/cs.ts. Vždy 3 možnosti, právě jedna správná.
 */
export type QuizKind = 'count' | 'color' | 'shape' | 'letter';
export const QUIZ_KINDS: QuizKind[] = ['count', 'color', 'shape', 'letter'];

export const COUNT_ITEMS = ['apple', 'star', 'fish', 'flower', 'balloon'] as const;
export type CountItem = (typeof COUNT_ITEMS)[number];

export const QUIZ_COLORS: BlockType[] = ['red', 'blue', 'sand', 'grass', 'wood', 'stone'];

export const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart'] as const;
export type Shape = (typeof SHAPES)[number];

/** Písmena s obrázkovým slovem, které dítě zná. */
export const LETTERS = ['O', 'L', 'F', 'M', 'T', 'A', 'P', 'K'] as const;
export type Letter = (typeof LETTERS)[number];

export interface Quiz {
  kind: QuizKind;
  /** Správná odpověď (číslo jako text, barva, tvar nebo písmeno). */
  answer: string;
  /** 3 možnosti v náhodném pořadí. */
  options: string[];
  /** U počítání: co se počítá. */
  item?: CountItem;
}

const pick = <T>(arr: readonly T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Správná odpověď + 2 jiné, zamíchané. */
function withDistractors(answer: string, pool: readonly string[], rng: () => number): string[] {
  const others = shuffle(
    pool.filter((p) => p !== answer),
    rng,
  ).slice(0, 2);
  return shuffle([answer, ...others], rng);
}

/** Vytvoří úkol. Druh se střídá podle `index` (bedny po sobě dají různé úkoly). */
export function generateQuiz(index: number, rng: () => number = Math.random): Quiz {
  const kind = QUIZ_KINDS[((index % QUIZ_KINDS.length) + QUIZ_KINDS.length) % QUIZ_KINDS.length];
  switch (kind) {
    case 'count': {
      // Počítání do 5 – pro předškoláka přiměřené.
      const n = 1 + Math.floor(rng() * 5);
      const pool = ['1', '2', '3', '4', '5', '6'];
      return { kind, answer: String(n), options: withDistractors(String(n), pool, rng), item: pick(COUNT_ITEMS, rng) };
    }
    case 'color': {
      const answer = pick(QUIZ_COLORS, rng);
      return { kind, answer, options: withDistractors(answer, QUIZ_COLORS, rng) };
    }
    case 'shape': {
      const answer = pick(SHAPES, rng);
      return { kind, answer, options: withDistractors(answer, SHAPES, rng) };
    }
    case 'letter': {
      const answer = pick(LETTERS, rng);
      return { kind, answer, options: withDistractors(answer, LETTERS, rng) };
    }
  }
}

export const isCorrect = (q: Quiz, option: string): boolean => q.answer === option;

/** Krátký „otisk“ úkolu – podle něj se pozná opakování. */
export const quizKey = (q: Quiz): string => `${q.kind}:${q.answer}:${q.item ?? ''}`;

/**
 * Nový úkol, který není mezi nedávnými (`recent` = otisky posledních úkolů).
 * Druh se střídá podle `index`, odpověď se losuje, dokud není nová.
 */
export function generateFreshQuiz(index: number, recent: string[], rng: () => number = Math.random): Quiz {
  let q = generateQuiz(index, rng);
  for (let i = 0; i < 30 && recent.includes(quizKey(q)); i++) q = generateQuiz(index, rng);
  return q;
}
