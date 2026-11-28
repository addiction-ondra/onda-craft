import { useEffect, useRef, useState } from 'react';
import type { GameController } from '../controller/GameController';
import { CS } from '../i18n/cs';
import { IconClose, IconStar } from './Icons';

/**
 * Prak u sněhuláka Bobka: zatáhni za prak, pusť – kostka letí a boří ledový hrad.
 * Vlastní jednoduchá fyzika (gravitace, dopad, padání bez podpory). Bez prohry a bez časomíry.
 */
const W = 900;
const H = 500;
const GROUND = 450;
const SLING = { x: 160, y: 340 };
const MAX_PULL = 115;
/** Síla praku – s rezervou dostřelí i na nejvzdálenější hrad. */
const POWER = 10.5;
const GRAV = 1400;
const B = 40; // velikost kostky hradu

interface Block {
  x: number;
  y: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  awake: boolean;
  crystal: boolean;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flying: boolean;
  rest: number;
}

type Cell = [col: number, row: number, crystal: boolean];

/** Tři hrady na výběr: malý, střední, velký (sloupec, řada od země, krystal). */
export const SLING_LEVELS: Array<{ x0: number; cells: Cell[] }> = [
  {
    // malý: 3×2 a krystal nahoře
    x0: 600,
    cells: [
      [0, 0, false],
      [1, 0, false],
      [2, 0, false],
      [0, 1, false],
      [1, 1, false],
      [2, 1, false],
      [1, 2, true],
    ],
  },
  {
    // střední: dvě věže, zeď, most a krystaly
    x0: 590,
    cells: (() => {
      const c: Cell[] = [];
      for (let r = 0; r < 3; r++) c.push([0, r, false], [4, r, false]);
      for (let x = 1; x <= 3; x++) for (let r = 0; r < 2; r++) c.push([x, r, false]);
      for (let x = 0; x <= 4; x++) c.push([x, 3, false]);
      c.push([0, 4, true], [2, 4, true], [4, 4, true]);
      return c;
    })(),
  },
  {
    // velký: strážní věž vpředu a velký hrad za ní
    x0: 500,
    cells: (() => {
      const c: Cell[] = [];
      for (let r = 0; r < 3; r++) c.push([0, r, false], [1, r, false]);
      c.push([0, 3, true], [1, 3, true]);
      for (let r = 0; r < 4; r++) c.push([4, r, false], [8, r, false]);
      for (let x = 5; x <= 7; x++) for (let r = 0; r < 3; r++) c.push([x, r, false]);
      c.push([5, 3, false], [6, 3, false], [7, 3, false]);
      for (let x = 4; x <= 8; x++) c.push([x, 4, false]);
      c.push([4, 5, true], [6, 5, true], [8, 5, true]);
      return c;
    })(),
  },
];

function buildCastle(level: number): Block[] {
  const { x0, cells } = SLING_LEVELS[level];
  return cells.map(([c, r, crystal]) => {
    const x = x0 + c * B + B / 2;
    const y = GROUND - r * B - B / 2;
    return { x, y, ox: x, oy: y, vx: 0, vy: 0, rot: 0, vr: 0, awake: false, crystal };
  });
}

/** Malý náhled hradu na tlačítku výběru (bez čtení – dítě pozná velikost). */
function LevelPreview({ level }: { level: number }) {
  const { cells } = SLING_LEVELS[level];
  const cols = Math.max(...cells.map((c) => c[0])) + 1;
  // jednotná velikost kostky pro všechny náhledy (aby byl vidět rozdíl velikosti hradů)
  const size = 100 / 9;
  const ASPECT = 1.3;
  return (
    <span className="sling-preview" aria-hidden>
      {cells.map(([c, r, crystal], i) => (
        <i
          key={i}
          className={crystal ? 'crystal' : ''}
          style={{ left: `${50 + (c - cols / 2) * size}%`, bottom: `${r * size * ASPECT}%`, width: `${size}%`, height: `${size * ASPECT}%` }}
        />
      ))}
    </span>
  );
}

const knocked = (b: Block) => Math.hypot(b.x - b.ox, b.y - b.oy) > 25 || Math.abs(b.rot) > 0.35;

export function SlingshotGame({ game }: { game: GameController }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [won, setWon] = useState(false);
  const [round, setRound] = useState(0);
  const [level, setLevel] = useState<number | null>(null);
  const state = useRef<{ blocks: Block[]; shot: Shot; drag: boolean; won: boolean; lastBoom: number; level: number }>({
    blocks: buildCastle(0),
    level: 0,
    shot: { x: SLING.x, y: SLING.y, vx: 0, vy: 0, flying: false, rest: 0 },
    drag: false,
    won: false,
    lastBoom: 0,
  });

  useEffect(() => {
    game.sayLine(CS.sling.pick);
    // pro automatické testy (?test): přístup ke stavu hry
    if (new URLSearchParams(location.search).has('test')) (window as unknown as Record<string, unknown>).__sling = state.current;
  }, [game]);

  // nová hra (vybraný hrad / postavit znovu)
  useEffect(() => {
    if (level === null) return;
    state.current.level = level;
    state.current.blocks = buildCastle(level);
    state.current.shot = { x: SLING.x, y: SLING.y, vx: 0, vy: 0, flying: false, rest: 0 };
    state.current.won = false;
    setWon(false);
  }, [round, level]);

  const pick = (l: number) => {
    game.playSfx('click');
    game.sayLine(CS.npcs.snowman.shoot);
    setLevel(l);
    setRound((r) => r + 1);
  };

  useEffect(() => {
    if (level === null) return;
    const cv = canvas.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    let last = performance.now();

    const toLocal = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };
    const onDown = (e: PointerEvent) => {
      const s = state.current;
      if (s.shot.flying) return;
      const p = toLocal(e);
      if (Math.hypot(p.x - s.shot.x, p.y - s.shot.y) < 90) {
        s.drag = true;
        cv.setPointerCapture?.(e.pointerId);
      }
    };
    const onMove = (e: PointerEvent) => {
      const s = state.current;
      if (!s.drag) return;
      const p = toLocal(e);
      let dx = p.x - SLING.x;
      let dy = p.y - SLING.y;
      const d = Math.hypot(dx, dy);
      if (d > MAX_PULL) {
        dx = (dx / d) * MAX_PULL;
        dy = (dy / d) * MAX_PULL;
      }
      s.shot.x = SLING.x + dx;
      s.shot.y = SLING.y + dy;
    };
    const onUp = () => {
      const s = state.current;
      if (!s.drag) return;
      s.drag = false;
      const dx = SLING.x - s.shot.x;
      const dy = SLING.y - s.shot.y;
      if (Math.hypot(dx, dy) < 15) {
        s.shot.x = SLING.x;
        s.shot.y = SLING.y;
        return;
      }
      s.shot.vx = dx * POWER;
      s.shot.vy = dy * POWER;
      s.shot.flying = true;
      game.playSfx('click');
    };
    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);

    const supported = (b: Block, all: Block[]) =>
      b.y + B / 2 >= GROUND - 1 ||
      all.some((o) => o !== b && !o.awake && Math.abs(o.x - b.x) < B * 0.8 && Math.abs(o.y - B - b.y) < 3);

    const step = (dt: number) => {
      const s = state.current;
      const sh = s.shot;
      if (sh.flying) {
        sh.vy += GRAV * dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        for (const b of s.blocks) {
          if (Math.abs(sh.x - b.x) < B / 2 + 18 && Math.abs(sh.y - b.y) < B / 2 + 18) {
            b.awake = true;
            b.vx += sh.vx * 0.55;
            b.vy += sh.vy * 0.4 - 220;
            b.vr += (Math.random() - 0.5) * 10;
            sh.vx *= 0.6;
            sh.vy *= 0.6;
            const now = performance.now();
            if (now - s.lastBoom > 1200) {
              s.lastBoom = now;
              game.playSfx('remove');
              game.sayLine(CS.npcs.snowman.hit[Math.floor(Math.random() * CS.npcs.snowman.hit.length)]);
            }
          }
        }
        if (sh.y > GROUND - 18) {
          sh.y = GROUND - 18;
          sh.vy *= -0.3;
          sh.vx *= 0.7;
        }
        if (sh.x > W + 50 || (Math.abs(sh.vx) < 20 && sh.y >= GROUND - 19)) {
          sh.rest += dt;
          if (sh.rest > 0.6 || sh.x > W + 50) {
            // nová kostka do praku
            s.shot = { x: SLING.x, y: SLING.y, vx: 0, vy: 0, flying: false, rest: 0 };
          }
        }
      }
      // spící kostky bez podpory začnou padat
      for (const b of s.blocks) if (!b.awake && !supported(b, s.blocks)) b.awake = true;
      for (const b of s.blocks) {
        if (!b.awake) continue;
        b.vy += GRAV * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.rot += b.vr * dt;
        // dopad na zem
        if (b.y + B / 2 > GROUND) {
          b.y = GROUND - B / 2;
          b.vy *= -0.25;
          b.vx *= 0.75;
          b.vr *= 0.7;
          if (Math.abs(b.vy) < 30 && Math.abs(b.vx) < 15) {
            b.vx = 0;
            b.vy = 0;
            b.vr = 0;
          }
        }
        // dopad na jinou kostku
        for (const o of s.blocks) {
          if (o === b || o.awake) continue;
          if (Math.abs(o.x - b.x) < B * 0.8 && b.vy > 0 && b.y + B / 2 > o.y - B / 2 && b.y < o.y) {
            b.y = o.y - B;
            b.vy = 0;
            b.vx *= 0.6;
          }
        }
        if (b.x < -60 || b.x > W + 60) b.vx = 0;
      }
      // po výhře se zbytek hradu sám sesype – spadne opravdu všechno
      if (s.won)
        for (const b of s.blocks)
          if (!knocked(b) && Math.abs(b.vx) < 5 && Math.abs(b.vy) < 5) {
            b.awake = true;
            b.vx = 160 + Math.random() * 220;
            b.vy = -280 - Math.random() * 160;
            b.vr = 3 + Math.random() * 5;
          }
      // vyhráno? (většina hradu je dole)
      if (!s.won && s.blocks.filter(knocked).length >= s.blocks.length * 0.7) {
        s.won = true;
        setWon(true);
        game.npcGameDone('snowman');
      }
    };

    const draw = () => {
      const s = state.current;
      const sky = g.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#74c0fc');
      sky.addColorStop(1, '#e7f5ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffffff';
      g.fillRect(0, GROUND, W, H - GROUND);
      // Bobek u praku
      g.fillStyle = '#f8f9fa';
      g.strokeStyle = '#adb5bd';
      g.lineWidth = 2;
      for (const [y, r] of [
        [GROUND - 30, 30],
        [GROUND - 78, 22],
        [GROUND - 112, 16],
      ]) {
        g.beginPath();
        g.arc(70, y, r, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
      g.fillStyle = '#ff922b';
      g.fillRect(84, GROUND - 114, 16, 5);
      g.fillStyle = '#212529';
      g.fillRect(62, GROUND - 120, 5, 5);
      g.fillRect(74, GROUND - 120, 5, 5);
      g.fillRect(56, GROUND - 136, 30, 6);
      g.fillRect(62, GROUND - 156, 18, 20);
      // prak (vidlice)
      g.strokeStyle = '#8b4513';
      g.lineWidth = 12;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(SLING.x, GROUND);
      g.lineTo(SLING.x, SLING.y + 40);
      g.moveTo(SLING.x, SLING.y + 40);
      g.lineTo(SLING.x - 22, SLING.y);
      g.moveTo(SLING.x, SLING.y + 40);
      g.lineTo(SLING.x + 22, SLING.y);
      g.stroke();
      const sh = s.shot;
      if (!sh.flying) {
        // gumy
        g.strokeStyle = '#c92a2a';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(SLING.x - 22, SLING.y);
        g.lineTo(sh.x, sh.y);
        g.lineTo(SLING.x + 22, SLING.y);
        g.stroke();
        // tečkovaná dráha při míření
        if (s.drag) {
          let px = sh.x;
          let py = sh.y;
          let vx = (SLING.x - sh.x) * POWER;
          let vy = (SLING.y - sh.y) * POWER;
          g.fillStyle = 'rgba(255,255,255,0.9)';
          for (let i = 0; i < 22; i++) {
            for (let k = 0; k < 4; k++) {
              vy += GRAV * 0.012;
              px += vx * 0.012;
              py += vy * 0.012;
            }
            if (py > GROUND) break;
            g.beginPath();
            g.arc(px, py, 5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      // ledový hrad
      for (const b of s.blocks) {
        g.save();
        g.translate(b.x, b.y);
        g.rotate(b.rot);
        g.fillStyle = b.crystal ? '#66d9e8' : '#a5d8ff';
        g.fillRect(-B / 2, -B / 2, B, B);
        g.strokeStyle = b.crystal ? '#1098ad' : '#4dabf7';
        g.lineWidth = 3;
        g.strokeRect(-B / 2, -B / 2, B, B);
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.fillRect(-B / 2 + 5, -B / 2 + 5, 14, 4);
        g.restore();
      }
      // kostka v praku / v letu (dřevěná)
      g.save();
      g.translate(sh.x, sh.y);
      g.fillStyle = '#c98a4b';
      g.fillRect(-18, -18, 36, 36);
      g.strokeStyle = '#6b4423';
      g.lineWidth = 3;
      g.strokeRect(-18, -18, 36, 36);
      g.beginPath();
      g.moveTo(-18, -6);
      g.lineTo(18, -6);
      g.moveTo(-18, 6);
      g.lineTo(18, 6);
      g.stroke();
      g.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      step(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
    };
  }, [game, level === null]);

  return (
    <div className="overlay dim">
      <div className="card sling-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="puzzle-head" aria-hidden>
          ⛄🎯
        </div>
        {level === null ? (
          <div className="sling-levels">
            {SLING_LEVELS.map((_, i) => (
              <button key={i} className="sling-level" data-level={i + 1} aria-label={CS.sling.levels[i]} onClick={() => pick(i)}>
                <LevelPreview level={i} />
                <span className="sling-level-stars" aria-hidden>
                  {Array.from({ length: i + 1 }, (_, k) => (
                    <IconStar key={k} width="28" height="28" />
                  ))}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <canvas ref={canvas} width={W} height={H} className="sling-canvas" />
            <div className="success-actions">
              <button className="go-btn secondary" aria-label={CS.sling.levelsTitle} onClick={() => setLevel(null)}>
                🏰
              </button>
              <button className="go-btn secondary" aria-label={CS.sling.again} onClick={() => setRound((r) => r + 1)}>
                🔄
              </button>
              {won && (
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
          </>
        )}
      </div>
    </div>
  );
}
