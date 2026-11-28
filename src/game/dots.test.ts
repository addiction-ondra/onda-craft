import { describe, expect, it } from 'vitest';
import { acceptLine, DOT_LEVELS, dotStatus, hintDots, levelKeys, lineKey, splitLine } from './dots';
import { lightDots, outlineLength, pointAt, sampleOutline, SKATE_DONE, SKATE_SHAPES, traced } from './skate';

describe('spoj tečky podle vzoru', () => {
  it('8 úrovní jako na předloze', () => {
    expect(DOT_LEVELS).toHaveLength(8);
    // obdélník: 6 úseků (svislé strany přes prostřední tečku)
    expect(levelKeys(1).size).toBe(6);
  });

  it('čára přes prostřední tečku se rozloží na dva úseky', () => {
    expect(splitLine([1, 0], [1, 2])).toHaveLength(2);
    expect(splitLine([0, 0], [1, 1])).toHaveLength(1);
    expect(lineKey([1, 1], [0, 0])).toBe(lineKey([0, 0], [1, 1]));
  });

  it('správná čára se přijme, špatná ne (nic se nebere)', () => {
    expect(acceptLine(0, [1, 0], [0, 1])).toHaveLength(1);
    expect(acceptLine(0, [0, 1], [1, 0])).toHaveLength(1); // i opačným směrem
    expect(acceptLine(0, [0, 0], [1, 0])).toHaveLength(0);
    // obdélník: pravou stranu jde nakreslit najednou i po kouskách
    expect(acceptLine(1, [1, 0], [1, 2])).toHaveLength(2);
    expect(acceptLine(1, [1, 1], [1, 2])).toHaveLength(1);
  });

  it('každá úroveň jde dokončit a nápověda ukáže chybějící tečky', () => {
    DOT_LEVELS.forEach((lines, lvl) => {
      const drawn: string[] = [];
      expect(dotStatus(lvl, drawn).done).toBe(false);
      expect(hintDots(lvl, drawn).length).toBeGreaterThan(1);
      for (const [a, b] of lines) drawn.push(...acceptLine(lvl, a, b));
      expect(dotStatus(lvl, drawn).done, `úroveň ${lvl + 1}`).toBe(true);
      expect(hintDots(lvl, drawn)).toHaveLength(0);
    });
  });
});

describe('krasobruslení tučňáka', () => {
  it('5 tvarů, tečky po celém obvodu', () => {
    expect(SKATE_SHAPES.map((s) => s.id)).toEqual(['circle', 'square', 'triangle', 'heart', 'star']);
    for (const s of SKATE_SHAPES) {
      const dots = sampleOutline(s.points, 7);
      expect(dots.length, s.id).toBeGreaterThan(15);
      for (const [x, y] of dots) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThanOrEqual(100);
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
    }
  });

  it('obtažení prstem po obvodu rozsvítí tečky a tvar je hotový', () => {
    for (const s of SKATE_SHAPES) {
      const dots = sampleOutline(s.points, 7);
      const lit = dots.map(() => false);
      const len = outlineLength(s.points);
      for (let d = 0; d <= len; d += 2) lightDots(dots, lit, pointAt(s.points, d).p, 6);
      expect(traced(lit), s.id).toBeGreaterThanOrEqual(SKATE_DONE);
    }
  });

  it('ťuknutí doprostřed tvar nesplní', () => {
    const dots = sampleOutline(SKATE_SHAPES[0].points, 7);
    const lit = dots.map(() => false);
    lightDots(dots, lit, [50, 50], 6);
    expect(traced(lit)).toBe(0);
  });
});
