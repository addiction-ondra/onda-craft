import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameController } from '../controller/GameController';
import { lightDots, outlineLength, pointAt, sampleOutline, SKATE_DONE, SKATE_SHAPES, traced, type Pt } from '../game/skate';
import { CS } from '../i18n/cs';
import { IconClose, IconStar } from './Icons';

/**
 * Krasobruslení tučňáka Pepíka: pohled shora na zamrzlé jezero, tečkovaný tvar.
 * Dítě obtáhne tečky prstem (tečky se rozsvěcují), pak Pepík tvar objede na bruslích.
 * Nápověda při nečinnosti: blikající začátek s ručičkou, pak Pepík cestu ukáže.
 */
const SPACING = 6.5;
const RADIUS = 7.5;
const SKATE_MS = 4200;
const HINT1_MS = 7000;
const HINT2_MS = 15000;

/** Tučňák shora (malý, s šálou). */
function Penguin({ p, angle, ghost }: { p: Pt; angle: number; ghost?: boolean }) {
  return (
    <g transform={`translate(${p[0]} ${p[1]}) rotate(${(angle * 180) / Math.PI + 90})`} opacity={ghost ? 0.45 : 1}>
      <ellipse rx="5.2" ry="6.4" fill="#212529" />
      <ellipse rx="3.4" ry="4.6" cy="0.8" fill="#f8f9fa" />
      <rect x="-4.6" y="-2.2" width="9.2" height="1.8" rx="0.9" fill="#e03131" />
      <circle cy="-4.2" r="3.4" fill="#212529" />
      <circle cx="-1.2" cy="-5" r="0.7" fill="#fff" />
      <circle cx="1.2" cy="-5" r="0.7" fill="#fff" />
      <path d="M-1 -7.2 L1 -7.2 L0 -9.2 Z" fill="#ff922b" />
    </g>
  );
}

export function SkateGame({ game }: { game: GameController }) {
  const [shapeIdx, setShapeIdx] = useState(0);
  const shape = SKATE_SHAPES[shapeIdx];
  const dots = useMemo(() => sampleOutline(shape.points, SPACING), [shape]);
  const total = useMemo(() => outlineLength(shape.points), [shape]);
  const [lit, setLit] = useState<boolean[]>(() => dots.map(() => false));
  const [stroke, setStroke] = useState<Pt[]>([]);
  const [phase, setPhase] = useState<'trace' | 'skate' | 'shapeDone' | 'allDone'>('trace');
  const [skateT, setSkateT] = useState(0);
  const [hint, setHint] = useState<0 | 1 | 2>(0);
  const [ghostT, setGhostT] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  const litRef = useRef<boolean[]>(lit);
  const lastAction = useRef(Date.now());

  useEffect(() => {
    game.sayLine(`${CS.npcs.penguin.hello}`);
  }, [game]);

  // nový tvar
  useEffect(() => {
    const l = dots.map(() => false);
    litRef.current = l;
    setLit(l);
    setStroke([]);
    setPhase('trace');
    setHint(0);
    lastAction.current = Date.now();
  }, [dots]);

  // nápověda při nečinnosti
  useEffect(() => {
    if (phase !== 'trace') return;
    const t = window.setInterval(() => {
      if (drawing.current) return;
      const idle = Date.now() - lastAction.current;
      if (idle > HINT2_MS && hint < 2) {
        setHint(2);
        game.sayLine(CS.skate.hint2);
      } else if (idle > HINT1_MS && hint < 1) {
        setHint(1);
        game.sayLine(CS.skate.hint1);
      }
    }, 400);
    return () => window.clearInterval(t);
  }, [hint, phase, game]);

  // animace: Pepík bruslí (po dokončení) / ukazuje cestu (nápověda)
  useEffect(() => {
    if (phase !== 'skate' && hint !== 2) return;
    let raf = 0;
    const start = performance.now();
    const dur = phase === 'skate' ? SKATE_MS : SKATE_MS * 1.6;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      if (phase === 'skate') setSkateT(k);
      else setGhostT(k);
      if (k < 1) raf = requestAnimationFrame(tick);
      else if (phase === 'skate') {
        if (shapeIdx === SKATE_SHAPES.length - 1) {
          setPhase('allDone');
          game.npcGameDone('penguin');
        } else setPhase('shapeDone');
      } else {
        setHint(1);
        lastAction.current = Date.now() - HINT1_MS;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, hint, shapeIdx, game]);

  const local = (e: React.PointerEvent): Pt => {
    const r = svg.current!.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100];
  };

  const trace = (p: Pt) => {
    const l = [...litRef.current];
    const fresh = lightDots(dots, l, p, RADIUS);
    if (!fresh.length) return;
    litRef.current = l;
    setLit(l);
    if (traced(l) >= SKATE_DONE) {
      drawing.current = false;
      setPhase('skate');
      setSkateT(0);
      setHint(0);
      game.playSfx('success');
      game.sayLine(`${CS.skate.names[shape.id]} ${CS.skate.skating}`);
    } else if (fresh.length) game.playSfx('click');
  };

  const down = (e: React.PointerEvent) => {
    if (phase !== 'trace') return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drawing.current = true;
    lastAction.current = Date.now();
    if (hint === 2) setHint(1);
    const p = local(e);
    setStroke([p]);
    trace(p);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || phase !== 'trace') return;
    lastAction.current = Date.now();
    const p = local(e);
    setStroke((s) => [...s.slice(-120), p]);
    trace(p);
  };
  const up = () => {
    drawing.current = false;
  };

  const next = () => {
    game.playSfx('click');
    setShapeIdx((i) => i + 1);
  };
  const again = () => {
    game.playSfx('click');
    if (shapeIdx === 0) {
      const l = dots.map(() => false);
      litRef.current = l;
      setLit(l);
      setStroke([]);
      setPhase('trace');
    } else setShapeIdx(0);
  };

  const outline = shape.points.map((p) => p.join(',')).join(' ');
  const skater = phase === 'skate' || phase === 'shapeDone' || phase === 'allDone' ? pointAt(shape.points, total * (phase === 'skate' ? skateT : 1)) : null;
  const ghost = hint === 2 && phase === 'trace' ? pointAt(shape.points, total * ghostT) : null;
  // stopa bruslí za Pepíkem
  const trail: Pt[] = [];
  if (skater) for (let d = 0; d <= total * (phase === 'skate' ? skateT : 1); d += 2) trail.push(pointAt(shape.points, d).p);

  return (
    <div className="overlay dim">
      <div className="card skate-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="puzzle-head" aria-hidden>
          🐧⛸️
        </div>
        <div className="dots-progress" aria-hidden>
          {SKATE_SHAPES.map((s, i) => (
            <span key={s.id} className={`dots-step ${i < shapeIdx || phase === 'allDone' ? 'done' : i === shapeIdx ? 'now' : ''}`} />
          ))}
        </div>
        <svg
          ref={svg}
          viewBox="0 0 100 100"
          className="skate-rink"
          data-shape={shape.id}
          data-phase={phase}
          data-traced={traced(lit).toFixed(2)}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        >
          <defs>
            <radialGradient id="ice" cx="50%" cy="45%" r="70%">
              <stop offset="0%" stopColor="#f1f9ff" />
              <stop offset="100%" stopColor="#a5d8ff" />
            </radialGradient>
          </defs>
          <rect x="1" y="1" width="98" height="98" rx="12" fill="url(#ice)" stroke="#74c0fc" strokeWidth="1.2" />
          {/* škrábance na ledu */}
          {[
            [12, 20, 26, 16],
            [70, 88, 86, 84],
            [80, 12, 90, 22],
            [8, 74, 18, 90],
          ].map(([a, b, c, d], i) => (
            <line key={i} x1={a} y1={b} x2={c} y2={d} stroke="#fff" strokeWidth="0.6" opacity="0.8" />
          ))}
          {/* tvar – slabě, ať dítě ví, kam jet */}
          <polygon points={outline} fill="none" stroke="#d0ebff" strokeWidth="2.2" strokeLinejoin="round" />
          {/* stopa prstu */}
          {stroke.length > 1 && phase === 'trace' && (
            <polyline points={stroke.map((p) => p.join(',')).join(' ')} fill="none" stroke="#4dabf7" strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          )}
          {/* stopa bruslí */}
          {trail.length > 1 && <polyline points={trail.map((p) => p.join(',')).join(' ')} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" />}
          {dots.map((d, i) => (
            <circle key={i} cx={d[0]} cy={d[1]} r={lit[i] ? 1.9 : 1.5} fill={lit[i] ? '#1c7ed6' : '#495057'} />
          ))}
          {hint >= 1 && phase === 'trace' && (
            <g>
              <circle className="skate-start" cx={dots[0][0]} cy={dots[0][1]} r="4.5" fill="#ffd43b" opacity="0.8" />
              <text x={dots[0][0] + 2} y={dots[0][1] + 9} fontSize="8" aria-hidden>
                👆
              </text>
            </g>
          )}
          {ghost && <Penguin p={ghost.p} angle={ghost.angle} ghost />}
          {skater ? <Penguin p={skater.p} angle={skater.angle} /> : <Penguin p={[50, 50]} angle={-Math.PI / 2} />}
        </svg>
        <div className="success-actions">
          <button className="go-btn secondary" aria-label={CS.sling.again} onClick={again}>
            🔄
          </button>
          {phase === 'shapeDone' && (
            <button className="go-btn sling-done skate-next" aria-label={CS.skate.next} onClick={next}>
              ▶
            </button>
          )}
          {phase === 'allDone' && (
            <>
              <span className="sling-won" aria-hidden>
                <IconStar width="56" height="56" />
                <IconStar width="56" height="56" />
                <IconStar width="56" height="56" />
              </span>
              <button className="go-btn sling-done" aria-label={CS.sling.done} onClick={() => game.closeOverlay()}>
                ✔
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
