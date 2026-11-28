import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameController } from '../controller/GameController';
import { CS } from '../i18n/cs';
import { IconClose, IconStar } from './Icons';

const COLS = 3;
const ROWS = 2;
const IMG_W = 600;
const IMG_H = 400;

/** Obrázek „ledové království s dětmi“ – kreslený kódem (vlastní grafika). */
function drawScene(): string {
  const c = document.createElement('canvas');
  c.width = IMG_W;
  c.height = IMG_H;
  const g = c.getContext('2d')!;
  const sky = g.createLinearGradient(0, 0, 0, IMG_H);
  sky.addColorStop(0, '#74c0fc');
  sky.addColorStop(1, '#e7f5ff');
  g.fillStyle = sky;
  g.fillRect(0, 0, IMG_W, IMG_H);
  // sluníčko
  g.fillStyle = '#ffe066';
  g.beginPath();
  g.arc(520, 70, 40, 0, Math.PI * 2);
  g.fill();
  // hory
  g.fillStyle = '#d0ebff';
  g.beginPath();
  g.moveTo(0, 260);
  g.lineTo(110, 120);
  g.lineTo(220, 260);
  g.lineTo(330, 150);
  g.lineTo(460, 260);
  g.closePath();
  g.fill();
  // ledový hrad
  const ice = '#a5d8ff';
  const iceDark = '#4dabf7';
  g.fillStyle = ice;
  g.strokeStyle = iceDark;
  g.lineWidth = 4;
  const rect = (x: number, y: number, w: number, h: number) => {
    g.fillRect(x, y, w, h);
    g.strokeRect(x, y, w, h);
  };
  rect(300, 170, 220, 130);
  rect(290, 110, 50, 190);
  rect(480, 110, 50, 190);
  rect(385, 80, 50, 220);
  for (const [x, w] of [
    [290, 50],
    [480, 50],
    [385, 50],
  ]) {
    g.fillStyle = '#e599f7';
    g.beginPath();
    g.moveTo(x - 6, x === 385 ? 80 : 110);
    g.lineTo(x + w / 2, x === 385 ? 20 : 60);
    g.lineTo(x + w + 6, x === 385 ? 80 : 110);
    g.closePath();
    g.fill();
  }
  g.fillStyle = '#1971c2';
  g.beginPath();
  g.arc(410, 270, 26, Math.PI, 0);
  g.fillRect(384, 270, 52, 30);
  g.fill();
  // sníh
  g.fillStyle = '#ffffff';
  g.fillRect(0, 300, IMG_W, 100);
  g.fillStyle = '#e7f5ff';
  g.beginPath();
  g.ellipse(150, 300, 200, 20, 0, 0, Math.PI * 2);
  g.fill();
  // děti (Ondra a Laura)
  const kid = (x: number, shirt: string, hair: string, long: boolean) => {
    g.fillStyle = shirt;
    g.fillRect(x - 22, 260, 44, 50);
    g.fillStyle = '#364fc7';
    g.fillRect(x - 18, 310, 14, 30);
    g.fillRect(x + 4, 310, 14, 30);
    g.fillStyle = '#f6c9a3';
    g.fillRect(x - 22, 210, 44, 44);
    g.fillStyle = hair;
    g.fillRect(x - 24, 202, 48, 14);
    if (long) {
      g.fillRect(x - 26, 210, 8, 46);
      g.fillRect(x + 18, 210, 8, 46);
    }
    g.fillStyle = '#212529';
    g.fillRect(x - 10, 226, 6, 6);
    g.fillRect(x + 4, 226, 6, 6);
    g.fillStyle = '#c92a2a';
    g.fillRect(x - 8, 240, 16, 4);
  };
  kid(110, '#4dabf7', '#6b3f1d', false);
  kid(190, '#f783ac', '#f5d76e', true);
  // vločky
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    const x = (i * 97) % IMG_W;
    const y = (i * 53) % 280;
    g.beginPath();
    g.arc(x, y, 3 + (i % 3), 0, Math.PI * 2);
    g.fill();
  }
  return c.toDataURL('image/png');
}

interface Piece {
  id: number;
  x: number;
  y: number;
  locked: boolean;
}

/** Puzzle princezny Vločky: dílky se posouvají prstem na správné místo (zacvaknou). */
export function PuzzleGame({ game }: { game: GameController }) {
  const image = useMemo(drawScene, []);
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(480);
  const cell = W / COLS;
  const boardH = cell * ROWS;
  const trayTop = boardH + 16;
  // výchozí pozice v „šuplíku“ pod deskou – zamíchané
  const order = useMemo(() => [3, 0, 5, 1, 4, 2], []);
  const trayPos = (id: number) => {
    const k = order.indexOf(id);
    return { x: (k % COLS) * cell, y: trayTop + Math.floor(k / COLS) * cell };
  };
  const [pieces, setPieces] = useState<Piece[]>(() => Array.from({ length: COLS * ROWS }, (_, id) => ({ id, x: 0, y: 0, locked: false })));
  const [drag, setDrag] = useState<{ id: number; dx: number; dy: number } | null>(null);
  const done = pieces.every((p) => p.locked);

  useEffect(() => {
    // vejít se na šířku i na výšku (deska 2 řady + šuplík 2 řady + hlavička)
    const measure = () =>
      setW(Math.max(240, Math.min(560, (wrap.current?.clientWidth ?? 480) - 4, ((window.innerHeight - 150) * COLS) / (2 * ROWS + 0.3))));
    measure();
    window.addEventListener('resize', measure);
    game.sayLine(CS.puzzle.hint);
    return () => window.removeEventListener('resize', measure);
  }, [game]);

  // po změně velikosti srovnat pozice
  useEffect(() => {
    setPieces((ps) =>
      ps.map((p) => (p.locked ? { ...p, x: (p.id % COLS) * cell, y: Math.floor(p.id / COLS) * cell } : { ...p, ...trayPos(p.id) })),
    );
  }, [W]);

  const local = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: React.PointerEvent, p: Piece) => {
    if (p.locked || done) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const l = local(e);
    setDrag({ id: p.id, dx: l.x - p.x, dy: l.y - p.y });
    game.playSfx('click');
  };

  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const l = local(e);
    setPieces((ps) => ps.map((p) => (p.id === drag.id ? { ...p, x: l.x - drag.dx, y: l.y - drag.dy } : p)));
  };

  const up = () => {
    if (!drag) return;
    const p = pieces.find((q) => q.id === drag.id)!;
    setDrag(null);
    const cx = p.x + cell / 2;
    const cy = p.y + cell / 2;
    const col = Math.floor(cx / cell);
    const row = Math.floor(cy / cell);
    const onBoard = cy < boardH && col >= 0 && col < COLS && row >= 0 && row < ROWS;
    const slot = row * COLS + col;
    const tx = (p.id % COLS) * cell;
    const ty = Math.floor(p.id / COLS) * cell;
    const near = Math.hypot(p.x - tx, p.y - ty) < cell * 0.45;
    if (near || (onBoard && slot === p.id)) {
      // zacvakne na správné místo
      setPieces((ps) => ps.map((q) => (q.id === p.id ? { ...q, x: tx, y: ty, locked: true } : q)));
      game.playSfx('place');
      const nowDone = pieces.filter((q) => q.locked).length + 1 === pieces.length;
      if (nowDone) {
        window.setTimeout(() => game.npcGameDone('princess'), 300);
      } else {
        game.sayLine(CS.puzzle.good[Math.floor(Math.random() * CS.puzzle.good.length)]);
      }
    } else {
      // vrátí se do šuplíku – žádný trest
      if (onBoard) game.sayLine(CS.puzzle.again);
      game.playSfx('soft');
      setPieces((ps) => ps.map((q) => (q.id === p.id ? { ...q, ...trayPos(q.id) } : q)));
    }
  };

  return (
    <div className="overlay dim">
      <div className="card puzzle-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <div className="puzzle-head" aria-hidden>
          👸🧩
        </div>
        <div ref={wrap} className="puzzle-area" style={{ height: trayTop + cell * ROWS }} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <div className="puzzle-board" style={{ width: W, height: boardH, backgroundImage: `url(${image})` }}>
            {Array.from({ length: COLS * ROWS }, (_, i) => (
              <div key={i} className="puzzle-slot" style={{ left: (i % COLS) * cell, top: Math.floor(i / COLS) * cell, width: cell, height: cell }} />
            ))}
          </div>
          {pieces.map((p) => (
            <div
              key={p.id}
              className={`puzzle-piece ${p.locked ? 'locked' : ''} ${drag?.id === p.id ? 'dragging' : ''}`}
              data-piece={p.id}
              onPointerDown={(e) => down(e, p)}
              style={{
                left: p.x,
                top: p.y,
                width: cell,
                height: cell,
                backgroundImage: `url(${image})`,
                backgroundSize: `${W}px ${boardH}px`,
                backgroundPosition: `-${(p.id % COLS) * cell}px -${Math.floor(p.id / COLS) * cell}px`,
              }}
            />
          ))}
        </div>
        {done && (
          <div className="puzzle-done">
            <div className="quiz-stars" aria-hidden>
              <IconStar width="64" height="64" />
              <IconStar width="64" height="64" />
              <IconStar width="64" height="64" />
            </div>
            <button className="go-btn" aria-label={CS.ui.continue} onClick={() => game.closeOverlay()}>
              ✔
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
