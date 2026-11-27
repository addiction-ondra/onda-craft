import type { GameController } from '../controller/GameController';
import { CS } from '../i18n/cs';
import { IconClose } from './Icons';

/**
 * Mapa světů: náš ostrov s hradem (jsi tady) a další ostrovy v mlze.
 * Další světy zatím nejsou – s klíčem se u dalšího ostrova rozzáří třpyt („staví se“).
 */
export function WorldsMap({ game, hasKey }: { game: GameController; hasKey: boolean }) {
  const islands = [
    { x: 90, y: 170, color: '#5cc43c', emoji: '🏰' },
    { x: 250, y: 95, color: '#e7f5ff', emoji: '⛄' },
    { x: 410, y: 165, color: '#f4d470', emoji: '🗼' },
  ];
  return (
    <div className="overlay dim">
      <div className="card worlds-card">
        <button className="round-btn ghost close" aria-label={CS.ui.close} onClick={() => game.closeOverlay()}>
          <IconClose />
        </button>
        <svg viewBox="0 0 500 260" className="worlds-map" role="img" aria-label={CS.worlds.title}>
          <rect x="0" y="0" width="500" height="260" rx="24" fill="#74c0fc" />
          {[40, 110, 190].map((y) => (
            <path key={y} d={`M20 ${y} q20 -8 40 0 t40 0`} stroke="#d0ebff" strokeWidth="4" fill="none" opacity="0.8" />
          ))}
          {/* tečkovaná cesta mezi ostrovy */}
          <path d="M120 160 Q170 90 220 100 M280 105 Q340 100 385 150" stroke="#fff" strokeWidth="6" strokeDasharray="4 12" strokeLinecap="round" fill="none" />
          {islands.map((isl, i) => {
            const locked = i > 0;
            return (
              <g
                key={i}
                className={`world-island ${locked ? 'locked' : 'here'} ${locked && hasKey && i === 1 ? 'soon' : ''}`}
                transform={`translate(${isl.x} ${isl.y})`}
                onClick={() => game.tapWorld(i)}
                role="button"
                aria-label={CS.worlds.names[i]}
              >
                <ellipse rx="70" ry="34" fill="#c2a36b" />
                <ellipse rx="62" ry="28" cy="-6" fill={isl.color} />
                <text y="2" textAnchor="middle" fontSize="44">
                  {isl.emoji}
                </text>
                {locked && (
                  <>
                    <ellipse className="fog" rx="74" ry="40" cy="-6" fill="#f8f9fa" opacity="0.75" />
                    <text y="10" textAnchor="middle" fontSize="34">
                      {hasKey && i === 1 ? '✨' : '🔒'}
                    </text>
                  </>
                )}
                {!locked && (
                  <text x="34" y="-34" textAnchor="middle" fontSize="34">
                    👦👧
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
