import { useEffect, useRef, useState } from 'react';
import type { GameController } from '../controller/GameController';
import { CS } from '../i18n/cs';
import { IconClose, IconStar } from './Icons';

/**
 * Barevná lodní bitva piráta Fouska: prakem posíláš barevné balónky na bílé plachty
 * pirátské lodi. Každý zásah plachtu obarví (hlas řekne barvu). Nic se neničí,
 * žádná prohra, žádná časomíra. Hotovo, když jsou všechny plachty barevné.
 */
const W = 900;
const H = 500;
const SEA = 400;
const SLING = { x: 150, y: 320 };
const MAX_PULL = 115;
const POWER = 10.5;
const GRAV = 1400;
const R = 16;
const COLORS = ['#e03131', '#fcc419', '#1c7ed6', '#37b24d', '#f06595', '#fd7e14'];

interface Sail {
  dx: number;
  top: number;
  w: number;
  h: number;
  color: string | null;
  wobble: number;
}

interface Shot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  flying: boolean;
  color: number;
}

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

// velké plachty – trefit se musí zvládnout i malé dítě
const newSails = (): Sail[] => [
  { dx: -110, top: 150, w: 96, h: 110, color: null, wobble: 0 },
  { dx: 0, top: 110, w: 104, h: 130, color: null, wobble: 0 },
  { dx: 110, top: 150, w: 96, h: 110, color: null, wobble: 0 },
];

export function PaintShipGame({ game }: { game: GameController }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [won, setWon] = useState(false);
  const [round, setRound] = useState(0);
  const state = useRef({
    sails: newSails(),
    shot: { x: SLING.x, y: SLING.y, vx: 0, vy: 0, flying: false, color: 0 } as Shot,
    drag: false,
    won: false,
    drops: [] as Drop[],
    shipX: 640,
    flag: 0,
    lastMiss: 0,
  });

  useEffect(() => {
    game.sayLine(CS.npcs.pirate.shoot);
    if (new URLSearchParams(location.search).has('test')) (window as unknown as Record<string, unknown>).__paint = state.current;
  }, [game]);

  useEffect(() => {
    const s = state.current;
    s.sails = newSails();
    s.shot = { x: SLING.x, y: SLING.y, vx: 0, vy: 0, flying: false, color: 0 };
    s.won = false;
    s.flag = 0;
    setWon(false);
  }, [round]);

  useEffect(() => {
    const cv = canvas.current!;
    const g = cv.getContext('2d')!;
    let raf = 0;
    let last = performance.now();
    let time = 0;

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

    const splash = (x: number, y: number, color: string, n = 14) => {
      for (let i = 0; i < n; i++)
        state.current.drops.push({ x, y, vx: (Math.random() - 0.5) * 360, vy: -120 - Math.random() * 260, life: 0.8, color });
    };
    const reload = () => {
      const s = state.current;
      s.shot = { x: SLING.x, y: SLING.y, vx: 0, vy: 0, flying: false, color: (s.shot.color + 1) % COLORS.length };
    };

    const step = (dt: number) => {
      const s = state.current;
      time += dt;
      // loď se pomalu houpe sem a tam
      s.shipX = 650 + Math.sin(time * 0.3) * 40;
      const sh = s.shot;
      if (sh.flying) {
        sh.vy += GRAV * dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        for (const sail of s.sails) {
          // obarvená plachta balónek propustí – trefí se další bílá (jinak by přední plachta zakrývala zadní)
          if (sail.color) continue;
          const sx = s.shipX + sail.dx - sail.w / 2;
          if (sh.x > sx - R && sh.x < sx + sail.w + R && sh.y > sail.top - R && sh.y < sail.top + sail.h + R) {
            const color = COLORS[sh.color];
            sail.color = color;
            sail.wobble = 1;
            splash(sh.x, sh.y, color);
            game.playSfx('place');
            game.sayLine(CS.paint.colors[sh.color]);
            reload();
            if (!s.won && s.sails.every((q) => q.color)) {
              s.won = true;
              setWon(true);
              game.npcGameDone('pirate');
            }
            return;
          }
        }
        if (sh.y > SEA) {
          splash(sh.x, SEA, '#a5d8ff', 10);
          game.playSfx('soft');
          const now = performance.now();
          if (now - s.lastMiss > 2500) {
            s.lastMiss = now;
            game.sayLine(CS.paint.miss[Math.floor(Math.random() * CS.paint.miss.length)]);
          }
          reload();
        } else if (sh.x > W + 60 || sh.x < -60) reload();
      }
      for (const sail of s.sails) sail.wobble = Math.max(0, sail.wobble - dt * 2);
      for (const d of s.drops) {
        d.vy += GRAV * 0.6 * dt;
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.life -= dt;
      }
      s.drops = s.drops.filter((d) => d.life > 0);
      if (s.won) s.flag = Math.min(1, s.flag + dt * 0.8);
    };

    const draw = () => {
      const s = state.current;
      const sky = g.createLinearGradient(0, 0, 0, SEA);
      sky.addColorStop(0, '#74c0fc');
      sky.addColorStop(1, '#d0f4f7');
      g.fillStyle = sky;
      g.fillRect(0, 0, W, H);
      // sluníčko
      g.fillStyle = '#ffe066';
      g.beginPath();
      g.arc(820, 70, 36, 0, Math.PI * 2);
      g.fill();
      // duha po výhře
      if (s.won) {
        ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'].forEach((c, i) => {
          g.strokeStyle = c;
          g.lineWidth = 10;
          g.globalAlpha = s.flag;
          g.beginPath();
          g.arc(s.shipX, SEA + 40, 330 - i * 11, Math.PI * 1.08, Math.PI * 1.92);
          g.stroke();
          g.globalAlpha = 1;
        });
      }
      // moře s vlnkami
      g.fillStyle = '#3d8fe0';
      g.fillRect(0, SEA, W, H - SEA);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 3;
      for (let x = 0; x < W; x += 60) {
        const y = SEA + 25 + Math.sin(x * 0.05 + time * 2) * 4;
        g.beginPath();
        g.arc(x + 30, y, 14, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      }
      // pirátská loď
      const bx = s.shipX;
      const bob = Math.sin(time * 1.6) * 4;
      g.save();
      g.translate(0, bob);
      g.fillStyle = '#8b4513';
      g.beginPath();
      g.moveTo(bx - 190, SEA - 70);
      g.lineTo(bx + 200, SEA - 70);
      g.lineTo(bx + 150, SEA + 10);
      g.lineTo(bx - 150, SEA + 10);
      g.closePath();
      g.fill();
      g.fillStyle = '#5c2b12';
      g.fillRect(bx - 195, SEA - 78, 400, 12);
      g.fillStyle = '#ffd43b';
      for (const x of [-100, -30, 40, 110]) {
        g.beginPath();
        g.arc(bx + x, SEA - 35, 9, 0, Math.PI * 2);
        g.fill();
      }
      // stěžně a plachty
      for (const sail of s.sails) {
        const mx = bx + sail.dx;
        g.fillStyle = '#6b3f1d';
        g.fillRect(mx - 4, sail.top - 20, 8, SEA - 70 - (sail.top - 20));
        const wob = Math.sin(time * 18) * 4 * sail.wobble;
        g.fillStyle = sail.color ?? '#ffffff';
        g.strokeStyle = '#adb5bd';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(mx - sail.w / 2, sail.top);
        g.quadraticCurveTo(mx + wob, sail.top + 10, mx + sail.w / 2, sail.top);
        g.lineTo(mx + sail.w / 2 + 6, sail.top + sail.h);
        g.quadraticCurveTo(mx, sail.top + sail.h + 14, mx - sail.w / 2 - 6, sail.top + sail.h);
        g.closePath();
        g.fill();
        g.stroke();
      }
      // vlajka (po výhře vyjede nahoru)
      const fy = 120 - s.flag * 40;
      g.fillStyle = '#6b3f1d';
      g.fillRect(bx - 3, fy - 10, 6, 40);
      g.fillStyle = s.won ? '#f06595' : '#e03131';
      g.fillRect(bx + 3, fy - 10, 44, 28);
      g.fillStyle = '#ffd43b';
      g.beginPath();
      g.arc(bx + 25, fy + 4, 7, 0, Math.PI * 2);
      g.fill();
      // pirát Fousek na palubě mává
      g.fillStyle = '#f6c9a3';
      g.fillRect(bx + 140, SEA - 125, 28, 28);
      g.fillStyle = '#212529';
      g.fillRect(bx + 138, SEA - 104, 32, 12);
      g.fillStyle = '#e03131';
      g.fillRect(bx + 138, SEA - 132, 32, 10);
      g.fillStyle = '#f8f9fa';
      g.fillRect(bx + 140, SEA - 96, 28, 26);
      g.restore();
      // naše loďka s prakem
      g.fillStyle = '#a0522d';
      g.beginPath();
      g.moveTo(60, SEA - 20);
      g.lineTo(240, SEA - 20);
      g.lineTo(210, SEA + 15);
      g.lineTo(90, SEA + 15);
      g.closePath();
      g.fill();
      g.strokeStyle = '#8b4513';
      g.lineWidth = 12;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(SLING.x, SEA - 20);
      g.lineTo(SLING.x, SLING.y + 40);
      g.moveTo(SLING.x, SLING.y + 40);
      g.lineTo(SLING.x - 22, SLING.y);
      g.moveTo(SLING.x, SLING.y + 40);
      g.lineTo(SLING.x + 22, SLING.y);
      g.stroke();
      const sh = s.shot;
      if (!sh.flying) {
        g.strokeStyle = '#495057';
        g.lineWidth = 6;
        g.beginPath();
        g.moveTo(SLING.x - 22, SLING.y);
        g.lineTo(sh.x, sh.y);
        g.lineTo(SLING.x + 22, SLING.y);
        g.stroke();
        if (s.drag) {
          let px = sh.x;
          let py = sh.y;
          const vx = (SLING.x - sh.x) * POWER;
          let vy = (SLING.y - sh.y) * POWER;
          g.fillStyle = 'rgba(255,255,255,0.9)';
          for (let i = 0; i < 22; i++) {
            for (let k = 0; k < 4; k++) {
              vy += GRAV * 0.012;
              px += vx * 0.012;
              py += vy * 0.012;
            }
            if (py > SEA) break;
            g.beginPath();
            g.arc(px, py, 5, 0, Math.PI * 2);
            g.fill();
          }
        }
      }
      // balónek s barvou
      g.fillStyle = COLORS[sh.color];
      g.beginPath();
      g.arc(sh.x, sh.y, R, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.beginPath();
      g.arc(sh.x - 5, sh.y - 6, 5, 0, Math.PI * 2);
      g.fill();
      // kapky barvy
      for (const d of s.drops) {
        g.globalAlpha = Math.max(0, d.life / 0.8);
        g.fillStyle = d.color;
        g.beginPath();
        g.arc(d.x, d.y, 6, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
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
  }, [game]);

  return (
    <div className="overlay dim">
      <div className="card sling-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="puzzle-head" aria-hidden>
          ⛵🎨
        </div>
        <canvas ref={canvas} width={W} height={H} className="sling-canvas paint-canvas" />
        <div className="success-actions">
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
      </div>
    </div>
  );
}
