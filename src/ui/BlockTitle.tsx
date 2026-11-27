/**
 * Kostičkový 3D nápis – vlastní pixelové písmo 5×7 kreslené z kostek
 * (přední stěna, hloubka a světlá hrana nahoře). Žádný převzatý font ani logo.
 */
const GLYPHS: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
};

export type TitleStyle = 'stone' | 'grass';

interface Pixel {
  x: number;
  y: number;
  row: number;
}

const CELL = 10;
const DEPTH = 5;
const OUTLINE = 2;
const GAP = 1; // mezera mezi písmeny (v pixelech)
const SPACE = 3; // šířka mezery

function layout(text: string): { pixels: Pixel[]; width: number } {
  const pixels: Pixel[] = [];
  let cx = 0;
  for (const ch of text.toUpperCase()) {
    if (ch === ' ') {
      cx += SPACE;
      continue;
    }
    const g = GLYPHS[ch];
    if (!g) continue;
    g.forEach((row, y) => [...row].forEach((c, x) => c === '#' && pixels.push({ x: cx + x, y, row: y })));
    cx += 5 + GAP;
  }
  return { pixels, width: Math.max(0, cx - GAP) };
}

/** Barvy kostiček: kámen (šedý) nebo tráva na hlíně (zelený vršek, hnědý zbytek). */
function colors(style: TitleStyle, p: Pixel): { face: string; side: string; light: string } {
  const alt = (p.x + p.y) % 2 === 0;
  if (style === 'grass') {
    if (p.row <= 1) return { face: alt ? '#5cc43c' : '#52b334', side: '#2b7a1d', light: '#8ee56d' };
    return { face: alt ? '#9b6b3d' : '#8d6036', side: '#5a3a1a', light: '#b88552' };
  }
  return { face: alt ? '#ced4da' : '#bfc6cd', side: '#6c7580', light: '#f8f9fa' };
}

export function BlockTitle({ text, style, className }: { text: string; style: TitleStyle; className?: string }) {
  const { pixels, width } = layout(text);
  const w = width * CELL + DEPTH + 2 * OUTLINE + 2;
  const h = 7 * CELL + DEPTH + 2 * OUTLINE + 2;
  return (
    <svg className={className} viewBox={`${-OUTLINE - 1} ${-OUTLINE - 1} ${w} ${h}`} role="img" aria-label={text} shapeRendering="crispEdges">
      {/* tmavý obrys celého písmene (i s hloubkou) – písmena vystoupí z oblohy */}
      {pixels.map((p, i) => (
        <rect
          key={`o${i}`}
          x={p.x * CELL - OUTLINE}
          y={p.y * CELL - OUTLINE}
          width={CELL + DEPTH + 2 * OUTLINE}
          height={CELL + DEPTH + 2 * OUTLINE}
          fill={style === 'grass' ? '#2d1d0c' : '#2b2f36'}
        />
      ))}
      {/* hloubka (stín kostek) */}
      {pixels.map((p, i) => (
        <rect key={`d${i}`} x={p.x * CELL + DEPTH} y={p.y * CELL + DEPTH} width={CELL} height={CELL} fill={colors(style, p).side} />
      ))}
      {/* přední stěny */}
      {pixels.map((p, i) => {
        const c = colors(style, p);
        return (
          <g key={`f${i}`}>
            <rect x={p.x * CELL} y={p.y * CELL} width={CELL} height={CELL} fill={c.face} />
            <rect x={p.x * CELL} y={p.y * CELL} width={CELL} height={2} fill={c.light} />
            <rect x={p.x * CELL} y={p.y * CELL} width={2} height={CELL} fill={c.light} opacity={0.6} />
            <rect x={p.x * CELL} y={p.y * CELL} width={CELL} height={CELL} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth={0.8} />
          </g>
        );
      })}
    </svg>
  );
}
