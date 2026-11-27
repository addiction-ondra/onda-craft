import { useMemo } from 'react';
import type { GameController } from '../controller/GameController';
import { TREASURE_LOCKS } from '../game/rewards';
import { CS } from '../i18n/cs';
import { IconClose, IconFlag, IconKey, IconMap } from './Icons';

/** Truhla s pokladem: tři zámky, v každém zámku jeden klíč za jeden svět. */
export function TreasureChest({ keys, fresh }: { keys: number; fresh: boolean }) {
  const holes = Array.from({ length: TREASURE_LOCKS }, (_, i) => i);
  const xs = [70, 120, 170];
  return (
    <svg viewBox="0 0 240 200" className="chest" role="img" aria-label={CS.ui.treasure}>
      {/* víko */}
      <path d="M20 80 Q20 30 120 30 Q220 30 220 80 Z" fill="#b5651d" stroke="#5c3310" strokeWidth="5" />
      <path d="M60 36 Q60 80 60 80 M180 36 Q180 80 180 80" stroke="#f0b429" strokeWidth="10" />
      {/* tělo truhly */}
      <rect x="20" y="80" width="200" height="100" rx="8" fill="#c97a2b" stroke="#5c3310" strokeWidth="5" />
      <rect x="20" y="80" width="200" height="18" fill="#a85d1a" />
      <rect x="55" y="80" width="10" height="100" fill="#f0b429" />
      <rect x="175" y="80" width="10" height="100" fill="#f0b429" />
      {/* zámková deska se třemi dírkami */}
      <rect x="45" y="104" width="150" height="56" rx="12" fill="#ffd43b" stroke="#b8860b" strokeWidth="4" />
      {holes.map((i) => {
        const filled = i < keys;
        const isNew = fresh && i === keys - 1;
        return (
          <g key={i} transform={`translate(${xs[i]} 132)`}>
            {filled ? (
              <g className={isNew ? 'key-in new' : 'key-in'}>
                <circle r="15" fill="#fff3bf" stroke="#e67700" strokeWidth="3" />
                <g transform="translate(-13 -13) scale(0.55)">
                  <IconKey width="48" height="48" />
                </g>
              </g>
            ) : (
              <g opacity="0.85">
                <circle cy="-5" r="8" fill="#343a40" />
                <path d="M-5 -2 L5 -2 L3 14 L-3 14 Z" fill="#343a40" />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

const CONFETTI = ['#ffd43b', '#ff922b', '#69db7c', '#4dabf7', '#f783ac'];

export function TreasureOverlay({ game, keys, fresh, allDone }: { game: GameController; keys: number; fresh: boolean; allDone: boolean }) {
  const pieces = useMemo(
    () => Array.from({ length: fresh ? 40 : 0 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random(), dur: 2 + Math.random() * 1.5, color: CONFETTI[i % CONFETTI.length] })),
    [fresh],
  );
  return (
    <div className={`overlay dim ${fresh ? 'success' : ''}`}>
      {fresh && (
        <div className="confetti" aria-hidden>
          {pieces.map((p, i) => (
            <span key={i} style={{ left: `${p.left}%`, background: p.color, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
          ))}
        </div>
      )}
      <div className={`card treasure-card ${fresh ? 'fresh' : ''}`}>
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        {fresh && (
          <div className="flying-key" aria-hidden>
            <IconKey />
          </div>
        )}
        <TreasureChest keys={keys} fresh={fresh} />
        <div className="success-actions">
          {!allDone && (
            <button className="go-btn" aria-label={CS.ui.toMissions} onClick={() => game.openMissions()}>
              <IconFlag />
            </button>
          )}
          <button className="go-btn secondary" aria-label={CS.ui.worlds} onClick={() => game.openWorlds()}>
            <IconMap />
          </button>
        </div>
      </div>
    </div>
  );
}
