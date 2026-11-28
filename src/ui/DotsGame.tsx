import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameController } from '../controller/GameController';
import { acceptLine, ALL_DOTS, DOT_LEVELS, dotStatus, hintDots, parseLineKey, type Dot } from '../game/dots';
import { CS } from '../i18n/cs';
import { IconClose, IconStar } from './Icons';

/**
 * Spoj tečky podle vzoru (vánoční stromeček). Vlevo obrázek, vpravo stejné tečky –
 * dítě táhne prstem od tečky k tečce. Špatná čára jen krátce blikne a zmizí (nic se nebere).
 * Nápověda při nečinnosti: 1) počkat, 2) rozsvítit tečky, které se mají spojit,
 * 3) nakreslit chybějící čáry, aby dítě vidělo jak – a pak to zopakovalo.
 */
const PW = 200;
const PH = 300;
const NEAR = 46;
const HINT1_MS = 8000;
const HINT2_MS = 16000;

const pos = (d: Dot) => ({ x: 50 + d[0] * 100, y: 50 + d[1] * 100 });

export function DotsGame({ game }: { game: GameController }) {
  const [level, setLevel] = useState(0);
  const [drawn, setDrawn] = useState<string[]>([]);
  const [current, setCurrent] = useState<Dot | null>(null);
  const [finger, setFinger] = useState<{ x: number; y: number } | null>(null);
  const [wrong, setWrong] = useState<[Dot, Dot] | null>(null);
  const [hint, setHint] = useState<0 | 1 | 2>(0);
  const [levelDone, setLevelDone] = useState(false);
  const [allDone, setAllDone] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const lastAction = useRef(Date.now());
  const lastWrongVoice = useRef(0);
  const cur = useRef<Dot | null>(null);
  const drawnRef = useRef<string[]>([]);

  useEffect(() => {
    game.sayLine(`${CS.npcs.xmasTree.hello} ${CS.dots.start}`);
  }, [game]);

  // nápověda při nečinnosti
  useEffect(() => {
    const t = window.setInterval(() => {
      if (levelDone || allDone || cur.current) return;
      const idle = Date.now() - lastAction.current;
      if (idle > HINT2_MS && hint < 2) {
        setHint(2);
        game.sayLine(CS.dots.hint2);
      } else if (idle > HINT1_MS && hint < 1) {
        setHint(1);
        game.sayLine(CS.dots.hint1);
      }
    }, 400);
    return () => window.clearInterval(t);
  }, [hint, levelDone, allDone, game]);

  // ukázka čar skončí – tečky dál svítí, dítě to zopakuje
  const missing = dotStatus(level, drawn).missing;
  useEffect(() => {
    if (hint !== 2) return;
    const t = window.setTimeout(() => {
      setHint(1);
      lastAction.current = Date.now() - HINT1_MS; // další ukázka zase až po chvíli
    }, missing.length * 900 + 1800);
    return () => window.clearTimeout(t);
  }, [hint, missing.length]);

  const touch = () => {
    lastAction.current = Date.now();
    if (hint === 2) setHint(1);
  };

  const local = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * PW, y: ((e.clientY - r.top) / r.height) * PH };
  };
  const dotAt = (p: { x: number; y: number }) => ALL_DOTS.find((d) => Math.hypot(pos(d).x - p.x, pos(d).y - p.y) < NEAR) ?? null;

  const addLine = useCallback(
    (a: Dot, b: Dot) => {
      const parts = acceptLine(level, a, b);
      if (!parts.length) {
        setWrong([a, b]);
        game.playSfx('soft');
        if (Date.now() - lastWrongVoice.current > 4000) {
          lastWrongVoice.current = Date.now();
          game.sayLine(CS.dots.wrong);
        }
        window.setTimeout(() => setWrong(null), 600);
        return;
      }
      const prev = drawnRef.current;
      const next = [...new Set([...prev, ...parts])];
      if (next.length === prev.length) return;
      drawnRef.current = next;
      setDrawn(next);
      game.playSfx('place');
      if (!dotStatus(level, next).done) return;
      setLevelDone(true);
      setHint(0);
      if (level === DOT_LEVELS.length - 1) {
        game.playSfx('success');
        window.setTimeout(() => {
          setAllDone(true);
          game.npcGameDone('xmasTree');
        }, 700);
        return;
      }
      game.playSfx('collect');
      game.sayLine(CS.dots.levelDone[level % CS.dots.levelDone.length]);
      window.setTimeout(() => {
        drawnRef.current = [];
        setDrawn([]);
        setLevel((l) => l + 1);
        setLevelDone(false);
        lastAction.current = Date.now();
      }, 1600);
    },
    [level, game],
  );

  const down = (e: React.PointerEvent) => {
    if (levelDone || allDone) return;
    touch();
    const p = local(e);
    const d = dotAt(p);
    if (!d) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    cur.current = d;
    setCurrent(d);
    setFinger(p);
    game.playSfx('click');
  };
  const move = (e: React.PointerEvent) => {
    if (!cur.current) return;
    touch();
    const p = local(e);
    setFinger(p);
    const d = dotAt(p);
    if (d && (d[0] !== cur.current[0] || d[1] !== cur.current[1])) {
      addLine(cur.current, d);
      cur.current = d;
      setCurrent(d);
    }
  };
  const up = () => {
    cur.current = null;
    setCurrent(null);
    setFinger(null);
  };

  const again = () => {
    game.playSfx('click');
    setLevel(0);
    drawnRef.current = [];
    setDrawn([]);
    setLevelDone(false);
    setAllDone(false);
    setHint(0);
    lastAction.current = Date.now();
  };

  const glow = hint >= 1 ? hintDots(level, drawn) : [];
  const isGlow = (d: Dot) => glow.some((g) => g[0] === d[0] && g[1] === d[1]);

  const dotsLayer = (interactive: boolean) =>
    ALL_DOTS.map((d) => {
      const { x, y } = pos(d);
      const g = interactive && isGlow(d);
      const active = interactive && current && current[0] === d[0] && current[1] === d[1];
      return (
        <g key={`${d[0]},${d[1]}`}>
          {interactive && <circle cx={x} cy={y} r={NEAR - 10} fill="transparent" />}
          {g && <circle className="dots-glow" cx={x} cy={y} r="22" fill="#ffd43b" opacity="0.7" />}
          <circle cx={x} cy={y} r={active ? 15 : 11} fill={g ? '#e67700' : '#212529'} />
        </g>
      );
    });

  return (
    <div className="overlay dim">
      <div className="card dots-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="puzzle-head" aria-hidden>
          🎄✏️
        </div>
        <div className="dots-progress" aria-hidden>
          {DOT_LEVELS.map((_, i) => (
            <span key={i} className={`dots-step ${i < level || allDone ? 'done' : i === level ? 'now' : ''}`} />
          ))}
        </div>
        <div className="dots-panels" data-level={level + 1}>
          {/* vzor */}
          <svg viewBox={`0 0 ${PW} ${PH}`} className="dots-panel pattern" aria-hidden>
            <rect x="2" y="2" width={PW - 4} height={PH - 4} rx="14" fill="#fff" stroke="#adb5bd" strokeWidth="4" />
            {DOT_LEVELS[level].map(([a, b], i) => (
              <line key={i} x1={pos(a).x} y1={pos(a).y} x2={pos(b).x} y2={pos(b).y} stroke="#1c7ed6" strokeWidth="9" strokeLinecap="round" />
            ))}
            {dotsLayer(false)}
          </svg>
          {/* kreslení */}
          <svg
            ref={svg}
            viewBox={`0 0 ${PW} ${PH}`}
            className={`dots-panel draw ${levelDone ? 'solved' : ''}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
          >
            <rect x="2" y="2" width={PW - 4} height={PH - 4} rx="14" fill={levelDone ? '#ebfbee' : '#fff'} stroke={levelDone ? '#51cf66' : '#adb5bd'} strokeWidth="4" />
            {hint === 2 &&
              missing.map((k, i) => {
                const [a, b] = parseLineKey(k);
                const len = Math.hypot(pos(b).x - pos(a).x, pos(b).y - pos(a).y);
                return (
                  <line
                    key={`demo-${k}`}
                    className="dots-demo"
                    x1={pos(a).x}
                    y1={pos(a).y}
                    x2={pos(b).x}
                    y2={pos(b).y}
                    stroke="#fab005"
                    strokeWidth="9"
                    strokeLinecap="round"
                    strokeDasharray={len}
                    style={{ strokeDashoffset: len, animationDelay: `${i * 0.9}s`, ['--len' as string]: `${len}` }}
                  />
                );
              })}
            {drawn.map((k) => {
              const [a, b] = parseLineKey(k);
              return <line key={k} x1={pos(a).x} y1={pos(a).y} x2={pos(b).x} y2={pos(b).y} stroke="#e03131" strokeWidth="9" strokeLinecap="round" />;
            })}
            {wrong && (
              <line x1={pos(wrong[0]).x} y1={pos(wrong[0]).y} x2={pos(wrong[1]).x} y2={pos(wrong[1]).y} stroke="#ced4da" strokeWidth="7" strokeLinecap="round" strokeDasharray="4 10" />
            )}
            {current && finger && (
              <line x1={pos(current).x} y1={pos(current).y} x2={finger.x} y2={finger.y} stroke="#e03131" strokeOpacity="0.45" strokeWidth="8" strokeLinecap="round" />
            )}
            {dotsLayer(true)}
          </svg>
        </div>
        <div className="success-actions">
          <button className="go-btn secondary" aria-label={CS.sling.again} onClick={again}>
            🔄
          </button>
          {allDone && (
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
