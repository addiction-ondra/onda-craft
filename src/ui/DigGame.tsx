import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameController } from '../controller/GameController';
import { CS } from '../i18n/cs';
import { IconClose, IconKey, IconStar } from './Icons';

/**
 * Kopání pokladu pod palmou: prstem se odhrabává písek (jako stírací los),
 * pod ním je truhla. Ťuknutí na truhlu ji otevře třemi klíči → poklad a oslava.
 */
const W = 720;
const H = 440;
const CLEAR = 0.5;

/** Písek s kamínky a mušličkami (vlastní kresba). */
function paintSand(g: CanvasRenderingContext2D): void {
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = '#f4d470';
  g.fillRect(0, 0, W, H);
  let s = 7;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rnd() < 0.5 ? '#e9c46a' : '#fbe3a1';
    g.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 6, 3 + rnd() * 4);
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = '#ced4da';
    g.beginPath();
    g.arc(rnd() * W, rnd() * H, 6 + rnd() * 8, 0, Math.PI * 2);
    g.fill();
  }
  // velké červené X uprostřed
  g.strokeStyle = '#e03131';
  g.lineWidth = 34;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W / 2 - 110, H / 2 - 110);
  g.lineTo(W / 2 + 110, H / 2 + 110);
  g.moveTo(W / 2 + 110, H / 2 - 110);
  g.lineTo(W / 2 - 110, H / 2 + 110);
  g.stroke();
}

const CONFETTI = ['#ffd43b', '#ff922b', '#69db7c', '#4dabf7', '#f783ac'];

export function DigGame({ game }: { game: GameController }) {
  const sand = useRef<HTMLCanvasElement>(null);
  const [cleared, setCleared] = useState(0);
  const [stage, setStage] = useState<'dig' | 'chest' | 'open'>('dig');
  const said = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pieces = useMemo(
    () => Array.from({ length: 50 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random(), dur: 2 + Math.random() * 1.5, color: CONFETTI[i % CONFETTI.length] })),
    [],
  );

  useEffect(() => {
    paintSand(sand.current!.getContext('2d')!);
  }, []);

  const measure = () => {
    const g = sand.current!.getContext('2d')!;
    const data = g.getImageData(0, 0, W, H).data;
    let gone = 0;
    let n = 0;
    for (let i = 3; i < data.length; i += 4 * 97) {
      n++;
      if (data[i] < 40) gone++;
    }
    return gone / n;
  };

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (stage !== 'dig') return;
    if (e.type === 'pointermove' && e.buttons === 0 && e.pointerType === 'mouse') return;
    const r = sand.current!.getBoundingClientRect();
    const p = { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    const g = sand.current!.getContext('2d')!;
    g.globalCompositeOperation = 'destination-out';
    g.lineCap = 'round';
    g.lineWidth = 90;
    g.beginPath();
    const from = last.current ?? p;
    g.moveTo(from.x, from.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    last.current = p;
  };

  const lift = () => {
    last.current = null;
    if (stage !== 'dig') return;
    game.playSfx('remove');
    const c = measure();
    setCleared(c);
    const step = Math.floor((c / CLEAR) * 3);
    if (step > said.current && step <= 3) {
      said.current = step;
      if (step < 3) game.sayLine(CS.dig.progress[step - 1] ?? CS.dig.progress[0]);
    }
    if (c >= CLEAR) {
      // zbytek písku se sám odsype – truhla je vidět celá
      const g = sand.current!.getContext('2d')!;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      setStage('chest');
      game.playSfx('collect');
      game.sayLine(CS.dig.chest);
    }
  };

  const openChest = () => {
    if (stage !== 'chest') return;
    setStage('open');
    game.playSfx('success');
    game.sayLine(CS.dig.open);
  };

  return (
    <div className={`overlay dim ${stage === 'open' ? 'success' : ''}`}>
      {stage === 'open' && (
        <div className="confetti" aria-hidden>
          {pieces.map((p, i) => (
            <span key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
          ))}
        </div>
      )}
      <div className="card dig-card">
        {stage !== 'open' && (
          <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
            <IconClose />
          </button>
        )}
        <div className="puzzle-head" aria-hidden>
          ⛏️🏝️
        </div>
        <div className="dig-area" data-stage={stage} data-cleared={cleared.toFixed(2)}>
          <button className={`dig-chest ${stage}`} aria-label={CS.ui.treasure} onClick={openChest}>
            {stage === 'open' ? (
              <span className="dig-treasure" aria-hidden>
                <span className="dig-loot">👑</span>
                <span className="dig-loot">💎</span>
                <span className="dig-loot">🪙</span>
                <span className="dig-loot">💍</span>
                <span className="dig-loot">🪙</span>
              </span>
            ) : null}
            <svg viewBox="0 0 240 220" className="dig-chest-svg" aria-hidden>
              {stage === 'open' ? (
                <>
                  {/* otevřené víko opřené dozadu */}
                  <path d="M30 60 L50 8 L190 8 L210 60 Z" fill="#b5651d" stroke="#5c3310" strokeWidth="5" />
                  <path d="M60 10 L52 58 M180 10 L188 58" stroke="#f0b429" strokeWidth="9" />
                  {/* hromada zlata */}
                  <ellipse cx="120" cy="92" rx="96" ry="30" fill="#ffd43b" stroke="#e67700" strokeWidth="4" />
                  {[60, 90, 120, 150, 180, 105, 135].map((x, i) => (
                    <circle key={i} cx={x} cy={i < 5 ? 92 : 76} r="11" fill="#fcc419" stroke="#e67700" strokeWidth="3" />
                  ))}
                </>
              ) : (
                <path d="M20 100 Q20 50 120 50 Q220 50 220 100 Z" fill="#b5651d" stroke="#5c3310" strokeWidth="5" />
              )}
              <rect x="20" y="100" width="200" height="100" rx="8" fill="#c97a2b" stroke="#5c3310" strokeWidth="5" />
              <rect x="55" y="100" width="10" height="100" fill="#f0b429" />
              <rect x="175" y="100" width="10" height="100" fill="#f0b429" />
              <rect x="85" y="118" width="70" height="44" rx="10" fill="#ffd43b" stroke="#b8860b" strokeWidth="4" />
            </svg>
            {stage !== 'dig' && (
              <span className="dig-keys" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={`dig-key ${stage === 'open' ? 'in' : ''}`} style={{ animationDelay: `${i * 0.3}s` }}>
                    <IconKey width="44" height="44" />
                  </span>
                ))}
              </span>
            )}
          </button>
          <canvas
            ref={sand}
            width={W}
            height={H}
            className="dig-sand"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              last.current = null;
              scratch(e);
            }}
            onPointerMove={scratch}
            onPointerUp={lift}
            onPointerCancel={lift}
          />
        </div>
        <div className="success-actions">
          {stage === 'open' && (
            <>
              <span className="sling-won" aria-hidden>
                <IconStar width="56" height="56" />
                <IconStar width="56" height="56" />
                <IconStar width="56" height="56" />
              </span>
              <button className="go-btn sling-done" aria-label={CS.dig.done} onClick={() => game.digDone()}>
                ✔
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
