import type { WorldId } from '../game/worlds';
import { CS } from '../i18n/cs';

/** Plavba lodičkou: vlny, lodička s Ondrou a Laurou pluje přes obrazovku. */
export function TravelOverlay({ to }: { to: WorldId }) {
  return (
    <div className={`overlay travel travel-${to}`} aria-label={CS.travel.sailing}>
      <div className="travel-sky" />
      <div className="travel-sea">
        <div className="wave w1" />
        <div className="wave w2" />
        <div className="wave w3" />
      </div>
      <div className="travel-boat" aria-hidden>
        <span className="travel-kids">👦👧</span>
        <span className="travel-ship">⛵</span>
      </div>
      {to === 'ice' && (
        <div className="travel-snow" aria-hidden>
          {Array.from({ length: 30 }, (_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 10) * 0.2}s` }}>
              ❄
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
